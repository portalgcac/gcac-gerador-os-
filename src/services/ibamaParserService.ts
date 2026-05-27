// Polyfill para Uint8Array.prototype.toHex (necessário para navegadores móveis e WebViews mais antigos)
if (typeof Uint8Array !== 'undefined' && !(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function(this: Uint8Array) {
    return Array.from(this)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

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
  
  let rawText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    rawText += pageText + '\n';
  }

  const data: IbamaData = {};

  // Normalizar texto para busca (Remover acentos e colocar em caixa alta)
  const text = rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  console.log('IBAMA Parser v3.2 - Texto extraído:', text);

  // 1. Extrair Vencimento
  const matchVenc = text.match(/FIM:?\s*(\d{2}\/\d{2}\/\d{4})/);
  if (matchVenc) {
    const [d, m, y] = matchVenc[1].split('/');
    data.vencimento = `${y}-${m}-${d}`;
  }

  // 2. IDENTIFICAR O SOLICITANTE / INTERESSADO (Candidato primário a proprietário)
  const solicitanteMatch = text.match(/(SOLICITANTE|INTERESSADO):?\s*([A-Z\s]{10,60})(?=\s+CTF|DATA|$)/);
  const solicitanteNome = solicitanteMatch ? solicitanteMatch[2].trim() : '';
  if (solicitanteNome && solicitanteNome.length > 5) {
    data.nomeProprietario = solicitanteNome;
  }

  // 3. EXTRAIR CAR
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+)/;
  const carMatch = text.match(carRegex);
  if (carMatch) {
    const carMain = carMatch[0].trim();
    // Tenta encontrar o hash longo do CAR que costuma vir depois
    const hashes = text.match(/[A-Z0-9]{20,}/g) || [];
    const filteredHashes = hashes.filter(h => h.length > 20 && !h.includes('/') && !['SOLICITANTE', 'INTERESSADO', 'AUTORIZACAO'].some(k => h.includes(k)));
    data.numeroCar = (carMain + ' ' + filteredHashes.join(' ')).replace(/\s+/g, ' ').trim();
  }

  // 4. EXTRAIR TODOS OS NOMES POSSÍVEIS (Para desempate e identificação de fazenda)
  const allNames = text.match(/[A-Z]{3,}\s[A-Z]{2,}(\s[A-Z]{2,})*/g) || [];

  // 5. EXTRAIR NOME DA PROPRIEDADE (FAZENDA, SITIO, etc)
  const propertyPrefixesList = [
    'FAZENDA', 'SITIO', 'STIO', 'CHACARA', 'ESTANCIA', 'GLEBA', 'LOTE', 
    'PROPRIEDADE', 'RANCHO', 'AREA', 'RESERVA', 'CONDOMINIO', 'PROPRIEDADE RURAL'
  ];
  const propertyPrefixes = propertyPrefixesList.join('|');
  
  // Tenta encontrar o prefixo vindo antes do número do CAR (usando o carMain como âncora mais estável)
  const carAnchor = carMatch ? carMatch[0].substring(0, 15) : '';
  let fazendaMatch = null;
  
  if (carAnchor) {
    const carIndex = text.indexOf(carAnchor);
    if (carIndex !== -1) {
      const beforeCar = text.substring(Math.max(0, carIndex - 300), carIndex);
      const matches = Array.from(beforeCar.matchAll(new RegExp(`(${propertyPrefixes})\\s+([A-Z\\s]{3,60})`, 'g')));
      if (matches.length > 0) {
        fazendaMatch = matches[matches.length - 1];
      }
    }
  }

  // Fallback 1: Busca em todo o texto com lookahead de CAR
  if (!fazendaMatch) {
    fazendaMatch = text.match(new RegExp(`(${propertyPrefixes})\\s+([A-Z\\s]{3,60})(?=\\s+[A-Z]{2}-\\d{7})`));
  }

  // Fallback 2: Busca entre os nomes encontrados algum que comece com prefixo
  if (fazendaMatch) {
    data.nomeFazenda = `${fazendaMatch[1]} ${fazendaMatch[2].trim()}`.toUpperCase();
  } else {
    const propertyCandidate = allNames.find(n => propertyPrefixesList.some(p => n.trim().startsWith(p)));
    if (propertyCandidate) {
      data.nomeFazenda = propertyCandidate.trim();
    }
  }

  // 6. EXTRAIR CIDADE
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const cidadeRegex = /([A-Z\s]{3,30})\s*\/\s*([A-Z]{2})(?=\s|$|\n)/g;
  let matchC;
  while ((matchC = cidadeRegex.exec(text)) !== null) {
    let nome = matchC[1].trim();
    const uf = matchC[2];
    if (UFS.includes(uf)) {
      nome = nome.replace(/\d+/g, '').replace('MTS', '').replace('KM', '').trim();
      if (!['RUA', 'AV', 'RODOVIA', 'ENDERECO', 'MATRICULA', 'EMENDAS', 'RASURAS', 'VALIDA', 'ESTRADA'].some(excl => nome.includes(excl))) {
        data.cidade = `${nome}/${uf}`;
      }
    }
  }

  // 7. REFINAR PROPRIETÁRIO (Se não foi encontrado via Solicitante ou se precisar de validação)
  const blacklist = [
    'INSTITUTO', 'BRASILEIRO', 'IBAMA', 'MINISTERIO', 'AMBIENTE', 'RECURSOS', 'NATURAIS', 
    'RENOVAVEIS', 'SOLICITANTE', 'INTERESSADO', 'AUTORIZACAO', 'CONTROLADOR', 'MATRICULA', 'ENDERECO', 
    'CIDADE', 'FAZENDA', 'SITIO', 'STIO', 'CHACARA', 'ESTANCIA', 'GLEBA', 'LOTE', 'RODOVIA', 'ESTRADA', 
    'ESTA', 'PERMITE', 'TRANSPORTE', 'ESPECIES', 'JAVALI', 'ARMADILHA', 'CAES', 'ESPERA', 
    'SIM', 'NAO', 'PROPRIEDADE', 'NOME', 'PROPRIETARIO', 'VALIDO', 'CHAVE', 'AUTENTICIDADE', 'SISTEMA'
  ];

  if (!data.nomeProprietario) {
    const validNames = allNames.filter(n => {
      const nClean = n.trim();
      
      // NUNCA é proprietário se começar com prefixo de propriedade
      if (propertyPrefixesList.some(p => nClean.startsWith(p))) return false;
      
      // Ignorar se contiver palavras da blacklist
      if (blacklist.some(b => nClean.includes(b))) return false;
      
      // Ignorar se for o nome da fazenda (mesmo sem prefixo)
      if (data.nomeFazenda) {
        const parts = data.nomeFazenda.split(' ');
        const mainName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
        if (nClean.includes(mainName)) return false;
      }
      
      return nClean.length >= 8 && nClean.length < 50 && !/\d/.test(nClean);
    });

    if (validNames.length > 0) {
      const carIdx = carMatch ? text.indexOf(carMatch[0]) : 0;
      let selecionado = validNames.find(n => text.indexOf(n) > carIdx) || validNames[0];
      data.nomeProprietario = selecionado.trim();
    }
  } else {
    // Se já temos o proprietário via Solicitante, garantimos que ele não é um falso positivo (prefixo de fazenda)
    if (propertyPrefixesList.some(p => data.nomeProprietario!.startsWith(p))) {
      data.nomeProprietario = undefined; // Força re-avaliação ou deixa vazio
    }
  }

  return data;
}
