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

  // 2. Extrair CAR (Pode estar em múltiplas linhas)
  // O CAR sempre começa com UF- e tem uma sequência de números e letras
  const carMatch = fullText.match(/[A-Z]{2}-\d{7}-[\w\s-]+?(?=\s+Matrícula|\s+Nome do|\s+Endereço|$)/i);
  if (carMatch) {
    // Pegamos o bloco do CAR e também procuramos por continuações (hashes) que o IBAMA coloca abaixo
    const carLines = fullText.match(/[A-Z0-9]{10,}/g) || [];
    const mainCar = carMatch[0].split(/\s{2,}/)[0].trim();
    
    // Filtramos apenas o que parece ser parte do CAR (letras e números longos)
    const carParts = carLines.filter(l => l.length > 10 && !l.includes('/') && l !== data.vencimento.replace(/-/g, ''));
    if (carParts.length > 0) {
      data.numeroCar = (mainCar + ' ' + carParts.join(' ')).replace(/\s+/g, ' ').trim();
    } else {
      data.numeroCar = mainCar;
    }
  }

  // 3. Extrair Fazenda
  // Procurar por "FAZENDA" seguido de um nome, evitando os cabeçalhos
  const fazendaRegex = /FAZENDA\s+([A-ZÀ-ÿ\s]{3,30})(?=\s+[A-Z]{2}-\d{7})/i;
  const fazendaMatch = fullText.match(fazendaRegex);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase();
  } else {
    // Fallback: procurar no texto geral por FAZENDA + Próxima palavra em maiúsculo
    const fallbackFazenda = fullText.match(/FAZENDA\s+([A-ZÀ-ÿ]+(\s+[A-ZÀ-ÿ]+)?)/);
    if (fallbackFazenda && !fallbackFazenda[0].includes('PROPRIEDADE')) {
      data.nomeFazenda = fallbackFazenda[0].toUpperCase();
    }
  }

  // 4. Extrair Cidade/UF
  // Procurar padrão Cidade/UF no final de blocos de texto
  const cidadeRegex = /([A-ZÀ-ÿ\s]{3,})\/([A-Z]{2})(?=\s|$|\n)/g;
  let matches;
  while ((matches = cidadeRegex.exec(fullText)) !== null) {
    const cidadeNome = matches[1].trim();
    // Evitar pegar "MTS" ou partes do endereço
    if (cidadeNome.length > 2 && !['MTS', 'KM', 'RUA', 'AV'].includes(cidadeNome.toUpperCase())) {
      data.cidade = `${cidadeNome}/${matches[2]}`.toUpperCase();
    }
  }

  // 5. Extrair Proprietário
  // Geralmente é um nome em maiúsculas após o CAR ou perto de "controlador"
  const proprietarioRegex = /(?:controlador|Matrícula)\s+([A-Z\s]{10,40})(?=\s+RODOVIA|\s+Endereço|\s+ESTRADA)/i;
  const propMatch = fullText.match(proprietarioRegex);
  if (propMatch) {
    data.nomeProprietario = propMatch[1].trim().toUpperCase();
  } else {
    // Se não achou, procurar por nomes próprios longos em maiúsculas que não sejam a fazenda
    const nomes = fullText.match(/[A-Z]{3,}\s[A-Z]{3,}\s[A-Z]{3,}/g);
    if (nomes) {
      const provavel = nomes.find(n => !n.includes('FAZENDA') && !n.includes('MINISTÉRIO') && !n.includes('INSTITUTO'));
      if (provavel) data.nomeProprietario = provavel.trim().toUpperCase();
    }
  }

  return data;
}
