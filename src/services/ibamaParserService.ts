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

  // Normalizar texto para busca (remover acentos e excesso de espaços)
  const cleanText = fullText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  // Isolar a parte da tabela (abaixo de "LOCAL(IS) DO MANEJO")
  const tableKeywords = ['LOCAL(IS) DO MANEJO', 'LOCAL DO MANEJO', 'LOCALIS DO MANEJO'];
  let tableStartIndex = -1;
  for (const kw of tableKeywords) {
    tableStartIndex = cleanText.indexOf(kw);
    if (tableStartIndex !== -1) break;
  }
  
  const tableArea = tableStartIndex !== -1 ? fullText.substring(tableStartIndex) : fullText;
  const tableAreaClean = tableStartIndex !== -1 ? cleanText.substring(tableStartIndex) : cleanText;

  // 2. Extrair CAR
  // Padrão: UF-0000000-000 + Hashes alfanuméricos
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+)/i;
  const carMatch = tableArea.match(carRegex);
  if (carMatch) {
    let carStr = carMatch[0].trim();
    // Tentar pegar as linhas de baixo (hashes)
    const possibleHashes = tableArea.match(/[A-Z0-9]{10,}/g) || [];
    const filteredHashes = possibleHashes.filter(h => 
      h.length > 10 && 
      !['SOLICITANTE', 'AUTORIZACAO', 'CONTROLADOR', 'MATRICULA', 'PROPRIEDADE', 'ENDERECO', 'CIDADE'].includes(h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()) &&
      !h.includes('/')
    );
    if (filteredHashes.length > 0) {
      carStr += ' ' + filteredHashes.join(' ');
    }
    data.numeroCar = carStr.replace(/\s+/g, ' ').trim();
  }

  // 3. Extrair Fazenda
  // Sempre começa com FAZENDA e termina antes do CAR
  const fazendaMatch = tableArea.match(/FAZENDA\s+([A-ZÀ-ÿ\s]{3,40})(?=\s+[A-Z]{2}-\d{7})/i);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase().replace(/\s+/g, ' ');
  }

  // 4. Extrair Cidade/UF
  // Procurar "NOME/UF" (ex: ITIQUIRA/MT)
  const cidadeRegex = /([A-ZÀ-ÿ\s]{3,})\/([A-Z]{2})(?=\s|$|\n)/g;
  let m;
  while ((m = cidadeRegex.exec(tableArea)) !== null) {
    const nome = m[1].trim().toUpperCase();
    if (nome.length > 2 && !['MTS', 'KM', 'RUA', 'AV', 'MATRICULA', 'ENDERECO'].includes(nome)) {
      data.cidade = `${nome}/${m[2]}`;
    }
  }

  // 5. Extrair Proprietário
  // Lista negra pesada de palavras do cabeçalho do IBAMA e do formulário
  const blacklist = [
    'INSTITUTO', 'BRASILEIRO', 'MEIO', 'AMBIENTE', 'RECURSOS', 'NATURAIS', 'RENOVAVEIS', 'IBAMA', 
    'MINISTERIO', 'CONTROLE', 'ESPECIES', 'EXOTICAS', 'INVASORAS', 'SOLICITANTE', 'CTF', 'DATA', 
    'SOLICITACAO', 'AUTORIZACAO', 'ESPECIE', 'JAVALI', 'TIPO', 'MANEJO', 'ARMADILHA', 'GAIOLA', 
    'BUSCA', 'CAES', 'ESPERA', 'CEVA', 'CURRAL', 'UNIDADE', 'CONSERVACAO', 'MANEJADOR', 'SIM', 'NAO',
    'METODOS', 'ABATE', 'FOGO', 'BRANCA', 'PERIODO', 'INICIO', 'FIM', 'PROPRIEDADE', 'CAR', 'MATRICULA', 
    'NOME', 'PROPRIETARIO', 'CONTROLADOR', 'ENDERECO', 'CIDADE', 'FAZENDA'
  ];

  const blocks = tableArea.match(/[A-ZÀ-ÿ\s]{8,50}/g) || [];
  const validBlocks = blocks.filter(b => {
    const bClean = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    if (bClean.length < 8) return false;
    // Não pode ter palavras da blacklist
    const hasBlacklisted = blacklist.some(word => bClean.includes(word));
    if (hasBlacklisted) return false;
    // Não pode ser o CAR
    if (data.numeroCar && data.numeroCar.includes(bClean)) return false;
    // Não pode ser a fazenda
    if (data.nomeFazenda && data.nomeFazenda.includes(bClean)) return false;
    // Não pode ser a cidade
    if (data.cidade && data.cidade.includes(bClean)) return false;
    
    return true;
  });

  if (validBlocks.length > 0) {
    // Pegar o bloco que mais se parece com um nome (sem números)
    const provavel = validBlocks.find(b => !/\d/.test(b));
    if (provavel) data.nomeProprietario = provavel.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  return data;
}
