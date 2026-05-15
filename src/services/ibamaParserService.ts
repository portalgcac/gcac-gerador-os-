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

  // Isolar a parte da tabela para evitar pegar cabeçalhos do topo do PDF
  const idxLocal = fullText.indexOf('Local(is) do manejo');
  const tableText = idxLocal !== -1 ? fullText.substring(idxLocal) : fullText;

  // 2. Extrair CAR
  // O CAR do IBAMA: UF-0000000-000 + Hashes
  const carRegex = /([A-Z]{2}-\d{7}-[\w\s-]+?)(?=\s+Matrícula|\s+Nome do|\s+Endereço|\s+ADEMILTON|\s+RESENDE|$)/i;
  const carMatch = tableText.match(carRegex);
  if (carMatch) {
    // Pegar hashes de continuação (blocos alfanuméricos longos)
    const carParts = tableText.match(/[A-Z0-9]{10,}/g) || [];
    const mainCar = carMatch[0].trim();
    const filteredParts = carParts.filter(p => 
      p.length > 10 && 
      !['SOLICITANTE', 'AUTORIZAÇÃO', 'CONTROLADOR'].includes(p) &&
      !p.includes('/')
    );
    data.numeroCar = (mainCar + ' ' + filteredParts.join(' ')).replace(/\s+/g, ' ').trim();
  }

  // 3. Extrair Fazenda
  const fazendaMatch = tableText.match(/FAZENDA\s+([A-ZÀ-ÿ\s]{3,30})(?=\s+[A-Z]{2}-\d{7})/i);
  if (fazendaMatch) {
    data.nomeFazenda = `FAZENDA ${fazendaMatch[1].trim()}`.toUpperCase();
  } else {
    const fallback = tableText.match(/FAZENDA\s+([A-ZÀ-ÿ\s]+?)(?=\s+[A-Z]{2}-\d{7})/i);
    if (fallback) data.nomeFazenda = fallback[0].trim().toUpperCase();
  }

  // 4. Extrair Cidade/UF
  // Geralmente no final da tabela
  const cidadeMatch = tableText.match(/([A-ZÀ-ÿ\s]{3,})\/([A-Z]{2})(?=\s|$|\n)/);
  if (cidadeMatch) {
    const cidadeNome = cidadeMatch[1].trim();
    if (cidadeNome.length > 2 && !['MTS', 'KM', 'RUA', 'AV'].includes(cidadeNome.toUpperCase())) {
      data.cidade = `${cidadeNome}/${cidadeMatch[2]}`.toUpperCase();
    }
  }

  // 5. Extrair Proprietário
  // Excluir palavras que pertencem ao cabeçalho do IBAMA
  const blacklist = ['INSTITUTO', 'BRASILEIRO', 'RECURSOS', 'NATURAIS', 'IBAMA', 'MINISTÉRIO', 'AMBIENTE', 'CONTROLE', 'ESPÉCIES', 'EXÓTICAS', 'INVASORAS'];
  
  const nomesCandidatos = tableText.match(/[A-ZÀ-ÿ]{4,}\s[A-ZÀ-ÿ]{4,}(\s[A-ZÀ-ÿ]{4,})?/g);
  if (nomesCandidatos) {
    const filtrados = nomesCandidatos.filter(n => 
      !blacklist.some(b => n.includes(b)) && 
      !n.includes('FAZENDA') &&
      !n.includes('PROPRIEDADE') &&
      !n.includes('LOCAL')
    );
    if (filtrados.length > 0) {
      // O proprietário costuma vir após o CAR ou no meio da tabela
      data.nomeProprietario = filtrados[0].trim().toUpperCase();
      // Se houver um segundo nome (continuação), podemos tentar juntar
      if (filtrados[1] && tableText.indexOf(filtrados[1]) > tableText.indexOf(filtrados[0])) {
         // heurística simples de proximidade
         data.nomeProprietario += ' ' + filtrados[1].trim().toUpperCase();
      }
    }
  }

  return data;
}
