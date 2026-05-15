import * as pdfjsLib from 'pdfjs-dist';

// Configurar o worker do PDF.js usando um CDN estável
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface IbamaData {
  numeroCar?: string;
  nomeFazenda?: string;
  nomeProprietario?: string;
  cidade?: string;
  vencimento?: string;
}

export async function parseIbamaPdf(file: File): Promise<IbamaData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  const data: IbamaData = {};

  // 1. Extrair Vencimento (Período Fim)
  const matchVenc = fullText.match(/Fim:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (matchVenc) {
    const [d, m, y] = matchVenc[1].split('/');
    data.vencimento = `${y}-${m}-${d}`;
  }

  // 2. IDENTIFICAR O SOLICITANTE (PARA FILTRO)
  const solicitanteMatch = fullText.match(/Solicitante:?\s*([A-ZÀ-ÿ\s]{10,60})(?=\s+CTF|Data|$)/i);
  const solicitanteNome = solicitanteMatch ? solicitanteMatch[1].trim().toUpperCase() : '';

  // 3. EXTRAIR CAR
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+)/i;
  const carMatch = fullText.match(carRegex);
  if (carMatch) {
    const carMain = carMatch[0].trim();
    const hashes = fullText.match(/[A-Z0-9]{15,}/g) || [];
    const filteredHashes = hashes.filter(h => 
      h.length > 15 && 
      !h.includes('/') && 
      !['SOLICITANTE', 'AUTORIZACAO', 'CONTROLADOR'].some(ex => h.includes(ex))
    );
    data.numeroCar = (carMain + ' ' + filteredHashes.join(' ')).replace(/\s+/g, ' ').trim();
  }

  // 4. EXTRAIR FAZENDA
  const fazendaMatch = fullText.match(/FAZENDA\s+([A-ZÀ-ÿ\s]{3,40})(?=\s+[A-Z]{2}-\d{7})/i);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase();
  }

  // 5. EXTRAIR CIDADE
  const cidadeRegex = /([A-ZÀ-ÿ\s]{3,30})\/([A-Z]{2})(?=\s|$|\n)/g;
  let matches;
  while ((matches = cidadeRegex.exec(fullText)) !== null) {
    let nome = matches[1].trim().toUpperCase();
    nome = nome.replace(/\d+/g, '').replace('MTS', '').replace('KM', '').trim();
    if (nome.length > 2 && !['RUA', 'AV', 'RODOVIA', 'ENDERECO', 'MATRICULA'].some(excl => nome.includes(excl))) {
      data.cidade = `${nome}/${matches[2].toUpperCase()}`;
    }
  }

  // 6. EXTRAIR PROPRIETÁRIO (ESTRATÉGIA DE ELIMINAÇÃO)
  const blacklist = [
    'INSTITUTO', 'BRASILEIRO', 'IBAMA', 'MINISTERIO', 'AMBIENTE', 'RECURSOS', 'NATURAIS', 
    'RENOVAVEIS', 'SOLICITANTE', 'AUTORIZACAO', 'CONTROLADOR', 'MATRICULA', 'ENDERECO', 
    'CIDADE', 'FAZENDA', 'RODOVIA', 'ESTRADA', 'ESTA', 'PERMITE', 'TRANSPORTE', 'ESPECIES', 
    'INVASORAS', 'JAVALI', 'ARMADILHA', 'CAES', 'ESPERA', 'SIM', 'NAO', 'PROPRIEDADE', 'NOME', 'PROPRIETARIO'
  ];

  // Pegar todos os blocos de nomes próprios (Ex: ADEMILTON MORAES RESENDE)
  const allNames = fullText.match(/[A-ZÀ-ÿ]{3,}\s[A-ZÀ-ÿ]{2,}(\s[A-ZÀ-ÿ]{2,})*/g) || [];
  
  const validNames = allNames.filter(n => {
    const nClean = n.toUpperCase().trim();
    // Filtros
    if (solicitanteNome && nClean.includes(solicitanteNome.split(' ')[0])) return false;
    if (blacklist.some(b => nClean.includes(b))) return false;
    if (data.nomeFazenda && nClean.includes(data.nomeFazenda.replace('FAZENDA ', ''))) return false;
    if (data.cidade && nClean.includes(data.cidade.split('/')[0])) return false;
    return nClean.length >= 8;
  });

  if (validNames.length > 0) {
    // O proprietário costuma estar na tabela, perto do CAR
    const afterCarIdx = data.numeroCar ? fullText.indexOf(data.numeroCar.split(' ')[0]) : 0;
    const bestMatch = validNames.find(n => fullText.indexOf(n) > afterCarIdx) || validNames[0];
    data.nomeProprietario = bestMatch.trim().toUpperCase();
  }

  return data;
}
