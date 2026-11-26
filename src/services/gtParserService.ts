import * as pdfjsLib from 'pdfjs-dist';

// Configurar o worker do PDF.js usando o mesmo CDN do ibamaParser
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface GtData {
  vencimento?: string;
  tipo?: string;
  cidade?: string;
  uf?: string;
  rawText?: string;
}

export async function parseGtPdf(file: File): Promise<GtData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let rawText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    rawText += pageText + '\n';
  }

  const data: GtData = {};

  // Normalizar texto para busca (Remover acentos e colocar em caixa alta)
  const text = rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  console.log('GT Parser - Texto extraído:', text);

  // 1. Extrair Vencimento (Data de Validade Final)
  // Exemplo: "Validade: 28/01/2026 à 28/07/2026"
  const validadeRegex = /VALIDADE:?\s*\d{2}\/\d{2}\/\d{4}\s*(?:A|ATE|AL|À)\s*(\d{2}\/\d{2}\/\d{4})/i;
  const matchVal = text.match(validadeRegex);
  if (matchVal) {
    const [d, m, y] = matchVal[1].split('/');
    data.vencimento = `${y}-${m}-${d}`;
  } else {
    // Fallback: Tenta encontrar todas as datas DD/MM/AAAA e pega a última (normalmente é o vencimento)
    const dates = text.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (dates && dates.length >= 2) {
      const [d, m, y] = dates[dates.length - 1].split('/');
      data.vencimento = `${y}-${m}-${d}`;
    }
  }

  // 2. Extrair Finalidade / Tipo de Guia
  // Exemplo: "4. FINALIDADE CAÇA (manejo e controle da fauna)"
  const finalidadeMatch = text.match(/FINALIDADE\s*(.+)/);
  let finalidadeText = '';
  if (finalidadeMatch) {
    finalidadeText = finalidadeMatch[1].trim();
  } else {
    finalidadeText = text; // Varredura no texto inteiro caso falhe a âncora
  }

  // Mapeamento das nomenclaturas para os tipos suportados no sistema
  if (finalidadeText.includes('CACA') && finalidadeText.includes('TREINO')) {
    data.tipo = 'Caça Treino';
  } else if (finalidadeText.includes('CACA') || finalidadeText.includes('CONTROLE') || finalidadeText.includes('MANEJO')) {
    data.tipo = 'Caça';
  } else if (finalidadeText.includes('TREINO') || finalidadeText.includes('DESPORTIVO') || finalidadeText.includes('COMPETICAO')) {
    data.tipo = 'Treino';
  } else if (finalidadeText.includes('MANUTENCAO') || finalidadeText.includes('REPARO') || finalidadeText.includes('CONSERVA')) {
    data.tipo = 'Manutenção';
  } else if (finalidadeText.includes('TRANSFERENCIA')) {
    data.tipo = 'Transferência';
  } else {
    data.tipo = 'Outro';
  }

  // 3. Extrair Local de Destino (Cidade e UF)
  // Exemplo: "PAIS / CIDADE / UF / AEROPORTO-PORTO: XXX / JATAI /GO / XXX"
  const localDestinoRegex = /PAIS\s*\/\s*CIDADE\s*\/\s*UF\s*\/\s*AEROPORTO-PORTO:\s*[^/]+\/\s*([A-Z\s.-]+)\s*\/\s*([A-Z]{2})\s*\//;
  const matchLocal = text.match(localDestinoRegex);
  if (matchLocal) {
    data.cidade = matchLocal[1].trim();
    data.uf = matchLocal[2].trim();
  }

  data.rawText = text;

  return data;
}

export interface CrafData {
  vencimento?: string;
  rawText?: string;
  tipo?: string;
  fabricante?: string;
  modelo?: string;
  calibre?: string;
  numeroSerie?: string;
  numeroSigma?: string;
}

export async function parseCrafPdf(file: File): Promise<CrafData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let rawText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    rawText += pageText + '\n';
  }

  const data: CrafData = { rawText };

  // Normalizar texto para busca (Remover acentos e colocar em caixa alta)
  const text = rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  console.log('CRAF Parser - Texto extraído:', text);

  // Procure por datas de validade / vencimento no texto do CRAF
  // O CRAF costuma ter: "VALIDO ATE DD/MM/AAAA" ou "VALIDADE: DD/MM/AAAA"
  const validadeRegex = /(?:VALIDO ATE|VALIDADE|VENCIMENTO):?\s*(\d{2}\/\d{2}\/\d{4})/;
  const matchVal = text.match(validadeRegex);
  if (matchVal) {
    const [d, m, y] = matchVal[1].split('/');
    data.vencimento = `${y}-${m}-${d}`;
  } else {
    // Fallback: Pega a última data encontrada no PDF
    const dates = text.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (dates && dates.length > 0) {
      const [d, m, y] = dates[dates.length - 1].split('/');
      data.vencimento = `${y}-${m}-${d}`;
    }
  }

  // Nº de Série
  const serieMatch = text.match(/(?:N[ºO\.]?\s*(?:DE\s*)?S[EÉ]RIE|SERIE)[\s:]+([A-Z0-9\.\-]+)/);
  if (serieMatch && serieMatch[1] && !serieMatch[1].includes('VALID') && !serieMatch[1].includes('DATA')) {
    data.numeroSerie = serieMatch[1].trim();
  }

  // Nº SIGMA ou SINARM
  const sigmaMatch = text.match(/(?:N[ºO\.]?\s*)?(?:SIGMA|SINARM|CRAF)[\s:]+([0-9\.\-]+)/);
  if (sigmaMatch && sigmaMatch[1]) {
    data.numeroSigma = sigmaMatch[1].trim();
  }

  // Calibre
  const calMatch = text.match(/CALIBRE[\s:]+([0-9\.\/]+(?:\s*[A-Z]+)?)/);
  if (calMatch && calMatch[1]) {
    data.calibre = calMatch[1].trim();
  }

  // Tipo / Espécie
  const tipoMatch = text.match(/(?:ESP[EÉ]CIE|TIPO)[\s:]+([A-Z\/\s]+?)(?:\s{2,}|\n|MARCA|FABRICANTE|CALIBRE)/);
  if (tipoMatch && tipoMatch[1]) {
    const t = tipoMatch[1].trim();
    if (t.includes('PISTOLA')) data.tipo = 'PISTOLA';
    else if (t.includes('REVOLVER')) data.tipo = 'REVOLVER';
    else if (t.includes('CARABINA') || t.includes('FUZIL')) data.tipo = 'CARABINA / FUZIL';
    else if (t.includes('ESPINGARDA')) data.tipo = 'ESPINGARDA';
    else if (t.includes('RIFLE')) data.tipo = 'RIFLE';
  }

  // Fabricante / Marca
  const fabMatch = text.match(/(?:FABRICANTE|MARCA)[\s:]+([A-Z0-9\s]+?)(?:\s{2,}|\n|MODELO|CALIBRE)/);
  if (fabMatch && fabMatch[1]) {
    data.fabricante = fabMatch[1].trim();
  }

  // Modelo
  const modMatch = text.match(/MODELO[\s:]+([A-Z0-9\s\.\-]+?)(?:\s{2,}|\n|CALIBRE|N[ºO])/);
  if (modMatch && modMatch[1]) {
    data.modelo = modMatch[1].trim();
  }

  return data;
}
