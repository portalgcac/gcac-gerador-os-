import * as pdfjs from 'pdfjs-dist';

// Configurar o worker usando um CDN compatível com a versão instalada
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  // No documento: "Fim: 13/11/2026"
  const matchVenc = fullText.match(/Fim:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (matchVenc) {
    const [d, m, y] = matchVenc[1].split('/');
    data.vencimento = `${y}-${m}-${d}`; // Formato ISO para o input date
  }

  // 2. Extrair dados da tabela "Local(is) do manejo"
  // Heurística: Procurar pela palavra "Propriedade" e "CAR" que indicam o início da tabela
  // E depois procurar pelos dados.
  
  // Tentar encontrar o CAR primeiro (padrão mais único)
  // Ex: MT-5104609-603 D11FCA5C74AF9 A9208FE7C21EF 8D1
  const carRegex = /[A-Z]{2}-\d{7}-[\w\s-]+/;
  const carMatch = fullText.match(carRegex);
  if (carMatch) {
    // O CAR do IBAMA às vezes é quebrado em várias linhas/espaços
    // Vamos pegar uma sequência que pareça o CAR
    const carContent = carMatch[0].split('Matrícula')[0].trim();
    data.numeroCar = carContent.replace(/\s+/g, ' ');
  }

  // Localizar a cidade (geralmente no final da linha da tabela)
  // Padrão: "NomeCidade/UF"
  const cidadeMatch = fullText.match(/([A-Za-zÀ-ÿ\s]+)\/([A-Z]{2})(?=\s|$)/);
  if (cidadeMatch) {
    data.cidade = `${cidadeMatch[1].trim()}/${cidadeMatch[2]}`;
  }

  // Para o nome da fazenda e proprietário, vamos tentar uma abordagem por proximidade na lista de itens
  // já que o join(' ') pode misturar colunas se o PDF não for bem estruturado.
  
  const idxPropriedade = textItems.findIndex(t => t.includes('Propriedade'));
  if (idxPropriedade !== -1) {
    // No exemplo, "FAZENDA" e "MARIMBONDO" podem estar em itens separados logo após os cabeçalhos
    // Vamos procurar após os cabeçalhos da tabela
    const headersCount = 6; // Propriedade, CAR, Matrícula, Nome..., Endereço, Cidade
    const startIdx = idxPropriedade + headersCount;
    
    if (textItems[startIdx]) {
      // Se o primeiro item for "FAZENDA", pegamos ele e o próximo
      if (textItems[startIdx].toUpperCase().includes('FAZENDA')) {
         data.nomeFazenda = (textItems[startIdx] + ' ' + (textItems[startIdx+1] || '')).trim();
      } else {
         data.nomeFazenda = textItems[startIdx].trim();
      }
    }

    // Tentar achar o proprietário (está entre Matrícula e Endereço)
    const idxMatricula = textItems.findIndex(t => t.includes('Matrícula'));
    if (idxMatricula !== -1) {
       // O proprietário costuma vir após o espaço da matrícula (que pode estar vazio)
       // No print: ADEMILTON MORAES RESENDE
       // Vamos procurar um nome em caixa alta após o CAR/Matrícula
       for (let j = idxMatricula + 1; j < idxMatricula + 10; j++) {
         const item = textItems[j];
         if (item && item.length > 5 && item === item.toUpperCase() && !item.includes('-') && !item.includes('/')) {
           data.nomeProprietario = item.trim();
           break;
         }
       }
    }
  }

  // Fallback se não pegou o nome da fazenda
  if (!data.nomeFazenda) {
    const fazendaMatch = fullText.match(/FAZENDA\s+([A-ZÀ-ÿ\s]+)(?=\s+MT-)/i);
    if (fazendaMatch) data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`;
  }

  return data;
}
