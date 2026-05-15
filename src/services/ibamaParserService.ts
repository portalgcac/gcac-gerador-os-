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

  // 2. IDENTIFICAR E BANIR O SOLICITANTE
  // O solicitante aparece no início: "Solicitante: NOME COMPLETO"
  const solicitanteMatch = fullText.match(/Solicitante:?\s*([A-ZÀ-ÿ\s]{10,60})(?=\s+CTF|Data|$)/i);
  const solicitanteNome = solicitanteMatch ? solicitanteMatch[1].trim().toUpperCase() : '';

  // 3. ISOLAR A ÁREA DA TABELA (Abaixo de Propriedade/CAR)
  const cleanText = fullText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const tableKeywords = [/PROPRIEDADE\s+CAR\s+MATRICULA/i, /LOCAL\(IS\)\s+DO\s+MANEJO/i, /LOCAL\s+DO\s+MANEJO/i];
  let tableStartIndex = -1;
  for (const regex of tableKeywords) {
    const match = cleanText.match(regex);
    if (match) {
      tableStartIndex = match.index!;
      break;
    }
  }

  const tableArea = tableStartIndex !== -1 ? fullText.substring(tableStartIndex) : fullText;

  // 4. EXTRAIR CAR
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+)/i;
  const carMatch = tableArea.match(carRegex);
  let carMainPart = '';
  if (carMatch) {
    carMainPart = carMatch[0].trim();
    // Pegar hashes extras
    const allHashes = tableArea.match(/[A-Z0-9]{15,}/g) || [];
    const filteredHashes = allHashes.filter(h => 
      h.length > 15 && !h.includes('/') && !h.includes(solicitanteNome.split(' ')[0])
    );
    data.numeroCar = (carMainPart + ' ' + filteredHashes.join(' ')).replace(/\s+/g, ' ').trim();
  }

  // 5. EXTRAIR FAZENDA
  const fazendaMatch = tableArea.match(/FAZENDA\s+([A-ZÀ-ÿ\s]{3,40})(?=\s+[A-Z]{2}-\d{7})/i);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase();
  }

  // 6. EXTRAIR PROPRIETÁRIO (Focar no nome que NÃO é o solicitante)
  const blacklist = [
    'INSTITUTO', 'BRASILEIRO', 'IBAMA', 'MINISTERIO', 'AMBIENTE', 'RECURSOS', 'NATURAIS', 
    'RENOVAVEIS', 'SOLICITANTE', 'AUTORIZACAO', 'CONTROLADOR', 'MATRICULA', 'ENDERECO', 
    'CIDADE', 'FAZENDA', 'RODOVIA', 'ESTRADA', 'GLEICKSUEL', 'FERRERA'
  ];

  // Procurar por nomes próprios (2 ou mais palavras em maiúsculo) na área da tabela
  const nameBlocks = tableArea.match(/[A-ZÀ-ÿ]{4,}\s[A-ZÀ-ÿ]{3,}(\s[A-ZÀ-ÿ]{2,})*/g) || [];
  const validNames = nameBlocks.filter(n => {
    const nClean = n.toUpperCase().trim();
    // Não pode ser o solicitante
    if (solicitanteNome && nClean.includes(solicitanteNome)) return false;
    // Não pode ter palavras da blacklist
    if (blacklist.some(b => nClean.includes(b))) return false;
    // Não pode ser a fazenda
    if (data.nomeFazenda && nClean.includes(data.nomeFazenda)) return false;
    return nClean.length > 10;
  });

  if (validNames.length > 0) {
    // Pegar o primeiro nome válido que aparece após o CAR (heurística de posição)
    const afterCarIdx = carMainPart ? tableArea.indexOf(carMainPart) : 0;
    const bestMatch = validNames.find(n => tableArea.indexOf(n) > afterCarIdx) || validNames[0];
    data.nomeProprietario = bestMatch.trim().toUpperCase();
  }

  // 7. EXTRAIR CIDADE
  const cidadeMatch = tableArea.match(/([A-ZÀ-ÿ\s]{3,25})\/([A-Z]{2})(?=\s|$|\n)/i);
  if (cidadeMatch) {
    const nome = cidadeMatch[1].trim().toUpperCase();
    if (!['MTS', 'KM', 'RUA', 'AV', 'MATRICULA'].includes(nome)) {
      data.cidade = `${nome}/${cidadeMatch[2].toUpperCase()}`;
    }
  }

  return data;
}
