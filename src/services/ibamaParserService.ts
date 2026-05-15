import * as pdfjs from 'pdfjs-dist';

// Usar uma versão específica e estável do worker via CDN para evitar problemas de versão
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface IbamaData {
  nomeFazenda: string;
  numeroCar: string;
  nomeProprietario: string;
  cidade: string;
  vencimento: string;
}

export async function parseIbamaPdf(file: File): Promise<IbamaData> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  let textItems: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items.map((item: any) => item.str);
    textItems = [...textItems, ...items];
    fullText += items.join(' ') + '\n';
  }

  const data: IbamaData = {
    nomeFazenda: '',
    numeroCar: '',
    nomeProprietario: '',
    cidade: '',
    vencimento: ''
  };

  // 1. Extrair Vencimento (Período Fim)
  const matchVenc = fullText.match(/Fim:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (matchVenc) {
    const [d, m, y] = matchVenc[1].split('/');
    data.vencimento = `${y}-${m}-${d}`;
  }

  // Normalizar texto para busca
  const cleanText = fullText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  // Isolar a parte da tabela
  const tableKeywords = ['LOCAL(IS) DO MANEJO', 'LOCAL DO MANEJO', 'LOCALIS DO MANEJO', 'PROPRIEDADE', 'CIDADE'];
  let tableStartIndex = -1;
  for (const kw of tableKeywords) {
    tableStartIndex = cleanText.indexOf(kw);
    if (tableStartIndex !== -1) break;
  }
  
  const tableArea = tableStartIndex !== -1 ? fullText.substring(tableStartIndex) : fullText;

  // 2. Extrair CAR
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+)/i;
  const carMatch = tableArea.match(carRegex);
  if (carMatch) {
    let carStr = carMatch[0].trim();
    const possibleHashes = tableArea.match(/[A-Z0-9]{10,}/g) || [];
    const filteredHashes = possibleHashes.filter(h => 
      h.length > 10 && 
      !['SOLICITANTE', 'AUTORIZACAO', 'CONTROLADOR', 'MATRICULA', 'PROPRIEDADE', 'ENDERECO', 'CIDADE', 'JAVALI'].includes(h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()) &&
      !h.includes('/')
    );
    if (filteredHashes.length > 0) {
      carStr += ' ' + filteredHashes.join(' ');
    }
    data.numeroCar = carStr.replace(/\s+/g, ' ').trim();
  }

  // 3. Extrair Fazenda
  const fazendaMatch = tableArea.match(/FAZENDA\s+([A-ZÀ-ÿ\s]{3,40})(?=\s+[A-Z]{2}-\d{7})/i);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase().replace(/\s+/g, ' ');
  } else {
    const fallback = tableArea.match(/FAZENDA\s+([A-ZÀ-ÿ\s]+?)(?=\s+[A-Z]{2}-\d{7}|$)/i);
    if (fallback) data.nomeFazenda = fallback[0].trim().toUpperCase();
  }

  // 4. Extrair Cidade/UF
  // Procurar "Nome/UF" (ex: ITIQUIRA/MT) - padrão bem específico
  const cidadeRegex = /([A-ZÀ-ÿ\s]{3,30})\/([A-Z]{2})(?=\s|$|\n)/i;
  const matchCidade = tableArea.match(cidadeRegex);
  if (matchCidade) {
    const nome = matchCidade[1].trim().toUpperCase();
    if (!['MTS', 'KM', 'RUA', 'AV', 'RODOVIA', 'ENDERECO', 'CAR'].some(excl => nome.includes(excl))) {
      data.cidade = `${nome}/${matchCidade[2].toUpperCase()}`;
    }
  }

  // 5. Extrair Proprietário
  const blacklist = [
    'INSTITUTO', 'BRASILEIRO', 'MEIO', 'AMBIENTE', 'RECURSOS', 'NATURAIS', 'RENOVAVEIS', 'IBAMA', 
    'MINISTERIO', 'CONTROLE', 'ESPECIES', 'EXOTICAS', 'INVASORAS', 'SOLICITANTE', 'CTF', 'DATA', 
    'SOLICITACAO', 'AUTORIZACAO', 'ESPECIE', 'JAVALI', 'TIPO', 'MANEJO', 'ARMADILHA', 'GAIOLA', 
    'BUSCA', 'CAES', 'ESPERA', 'CEVA', 'CURRAL', 'UNIDADE', 'CONSERVACAO', 'MANEJADOR', 'SIM', 'NAO',
    'METODOS', 'ABATE', 'FOGO', 'BRANCA', 'PERIODO', 'INICIO', 'FIM', 'PROPRIEDADE', 'CAR', 'MATRICULA', 
    'NOME', 'PROPRIETARIO', 'CONTROLADOR', 'ENDERECO', 'CIDADE', 'FAZENDA', 'RODOVIA', 'ESTRADA', 'KM', 'MTS'
  ];

  // Pegar todos os blocos de palavras em maiúsculo na tabela
  const blocks = tableArea.match(/[A-ZÀ-ÿ]{3,}(\s[A-ZÀ-ÿ]{2,})*/g) || [];
  const validNames = blocks.filter(b => {
    const bClean = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    if (bClean.length < 5) return false;
    if (blacklist.some(word => bClean.includes(word))) return false;
    if (data.numeroCar && data.numeroCar.includes(bClean)) return false;
    if (data.nomeFazenda && data.nomeFazenda.includes(bClean)) return false;
    if (data.cidade && data.cidade.includes(bClean.split('/')[0])) return false;
    if (/\d/.test(bClean)) return false; // Nomes não têm números
    return true;
  });

  if (validNames.length > 0) {
    // Unir os blocos que sobrarem, pois o nome pode estar quebrado em linhas
    data.nomeProprietario = validNames.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  return data;
}
