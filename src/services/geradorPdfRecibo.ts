import jsPDF from 'jspdf';
import { Recibo } from '../types';
import { formatarMoeda, formatarData } from '../utils/formatters';

// Cores GCAC
const AZUL_BRAND    = '#1B6FBF';
const AZUL_FUNDO    = '#F0F7FF';
const ESCURO_BRAND  = '#0D0D0D';
const CINZA_TEXTO  = '#666666';
const LINHA_LEVE    = '#EEEEEE';

export async function gerarPdfReciboBlob(recibo: Recibo): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

  // 1. Cliched / Header superior
  // Logo
  try {
    let logoBase64 = '';
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa?.logoUrl) {
        logoBase64 = u.dadosEmpresa.logoUrl;
      }
    }

    if (!logoBase64) {
      const logoRes = await fetch('/Logo oficial.png');
      if (logoRes.ok) {
        const logoBlob = await logoRes.blob();
        logoBase64 = await blobParaBase64(logoBlob);
      }
    }

    if (logoBase64) {
      let format = 'PNG';
      if (logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg')) {
        format = 'JPEG';
      } else if (logoBase64.startsWith('data:image/webp')) {
        format = 'WEBP';
      }
      doc.addImage(logoBase64, format, 12, 12, 22, 22);
    }
  } catch { /* erro no logo */ }

  // Titulo Empresa
  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text((recibo.emitenteNome || 'GCAC DESPACHANTE BÉLICO').toUpperCase(), 38, 20);
  
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(11);
  doc.text('GESTÃO E ASSESSORIA C.A.C.', 38, 26);
  
  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNPJ: ${recibo.emitenteCNPJ}`, 38, 30);

  // Bloco Numero Recibo (Preto)
  doc.setFillColor(ESCURO_BRAND);
  doc.roundedRect(largura - 65, 15, 53, 18, 3, 3, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('NÚMERO DO RECIBO', largura - 38.5, 20, { align: 'center' });
  doc.setFontSize(16);
  doc.text(`# ${String(recibo.numero).padStart(4, '0')}`, largura - 38.5, 28, { align: 'center' });

  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`EMISSÃO: ${formatarData(recibo.criadoEm)}`, largura - 12, 38, { align: 'right' });

  // Linha grossa separadora do header
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.8);
  doc.line(12, 45, largura - 12, 45);
  doc.setLineWidth(0.1); // reset

  y = 55;

  // 2. Texto Principal (Box Azul)
  doc.setFillColor(AZUL_FUNDO);
  doc.rect(12, y, largura - 24, 28, 'F');
  doc.setDrawColor(AZUL_BRAND);
  doc.setLineWidth(1);
  doc.line(12, y, 12, y + 28); // Borda lateral azul
  doc.setLineWidth(0.1);

  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const textoRecibo = `Recebemos de ${recibo.clienteNome}, `;
  const textoCpf = `inscrito no CPF/CNPJ ${recibo.clienteCPF}, `;
  const textoImportancia = `a importância de:`;
  
  doc.text(textoRecibo, 18, y + 10);
  doc.text(textoCpf, 18, y + 16);
  doc.text(textoImportancia, 18, y + 22);

  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(formatarMoeda(recibo.valorTotal), largura - 18, y + 18, { align: 'right' });

  y += 45;

  // 3. Tabela de Servicos
  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO DOS SERVIÇOS E PRODUTOS', 12, y);
  y += 5;

  // Header Tabela
  doc.setFillColor(ESCURO_BRAND);
  doc.rect(12, y, largura - 24, 10, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(9);
  doc.text('ITEM / SERVIÇO', 18, y + 6.5);
  doc.text('VALOR UNITÁRIO', largura - 18, y + 6.5, { align: 'right' });
  y += 10;

  // Linhas
  doc.setTextColor(ESCURO_BRAND);
  recibo.servicos.forEach((s) => {
    // --- LOGICA DE QUEBRA DE PAGINA ---
    const alturaNecessaria = 12 + (s.detalhes ? (doc.splitTextToSize(s.detalhes, largura - 60).length * 4) : 0);
    if (y + alturaNecessaria > 215) { // Aumentado de 195 para 215 para melhor aproveitamento de página
      doc.addPage();
      y = 25;
      
      // Reaplica header da tabela na nova página (opcional, mas recomendado para o layout não "morrer")
      doc.setFillColor(ESCURO_BRAND);
      doc.rect(12, y, largura - 24, 10, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('ITEM / SERVIÇO (CONT.)', 18, y + 6.5);
      doc.text('VALOR UNITÁRIO', largura - 18, y + 6.5, { align: 'right' });
      y += 12;
    }

    // Nome em Negrito e Quebrado
    doc.setTextColor(ESCURO_BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const linhasNome = doc.splitTextToSize(s.nome.toUpperCase(), largura - 60);
    doc.text(linhasNome, 18, y + 7);
    const alturaNome = linhasNome.length * 5;
    
    // Valor à direita (alinhado com o topo do nome)
    doc.setFontSize(11);
    doc.text(formatarMoeda(s.valor), largura - 18, y + 7, { align: 'right' });

    if (s.detalhes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(CINZA_TEXTO);
      const detalhes = doc.splitTextToSize(s.detalhes, largura - 60);
      doc.text(detalhes, 18, y + 6 + alturaNome);
      y += alturaNome + (detalhes.length * 4) + 4; // Reduzido de 6 para 4
    } else {
      y += alturaNome + 2; // Reduzido de 4 para 2
    }

    doc.setDrawColor(LINHA_LEVE);
    doc.line(12, y, largura - 12, y);
  });



  // 4. Totais e Pagamento (Box Cinza/Claro)
  // O box tem 32mm, observações ~25mm e as assinaturas precisam de mais uns 60mm
  const alturaTotalPendente = 32 + (recibo.observacoes ? 25 : 0) + 60;
  if (y + alturaTotalPendente > altura) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor('#F9F9F9');
  doc.roundedRect(12, y, largura - 24, 32, 2, 2, 'F');
  doc.setDrawColor('#CCCCCC');
  doc.setLineWidth(0.2);
  doc.roundedRect(12, y, largura - 24, 32, 2, 2, 'S');

  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO', 18, y + 10);
  doc.setTextColor(ESCURO_BRAND);
  doc.text(recibo.formaPagamento.toUpperCase(), largura - 18, y + 10, { align: 'right' });

  doc.setLineWidth(0.3);
  doc.line(18, y + 15, largura - 18, y + 15);

  doc.setTextColor(CINZA_TEXTO);
  doc.text('VALOR TOTAL DO RECIBO', 18, y + 24);
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(22); // Aumentado para dar destaque
  doc.text(formatarMoeda(recibo.valorTotal), largura - 18, y + 26, { align: 'right' });

  y += 38;

  // 4.1 Observações Adicionais (Se houver)
  if (recibo.observacoes && recibo.observacoes.trim()) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(CINZA_TEXTO);
    doc.text('OBSERVAÇÕES ADICIONAIS', 12, y);
    y += 3;

    doc.setDrawColor(LINHA_LEVE);
    doc.setLineWidth(0.5);
    const linhasObs = doc.splitTextToSize(recibo.observacoes, largura - 34);
    const alturaObsBox = Math.max(12, (linhasObs.length * 4.5) + 6);
    doc.roundedRect(12, y, largura - 24, alturaObsBox, 2, 2, 'S');
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(ESCURO_BRAND);
    doc.text(linhasObs, 18, y + 7);
    y += alturaObsBox + 10;
  }
  const yAssIn = altura - 60;

  // 5.1 Assinatura Guilherme (Rubrica Master) - Desenhar primeiro para ficar por baixo
  try {
    const assRes = await fetch('/assinatura_guilherme.png');
    if (assRes.ok) {
      const assBlob = await assRes.blob();
      const assBase64 = await blobParaBase64(assBlob);
      // Maior: Width 80mm, Height 40mm. Centralizada (57.5 - 40 = 17.5) e sobrepondo a linha.
      doc.addImage(assBase64, 'PNG', 17.5, yAssIn - 32, 80, 40);
    }
  } catch { /* erro na rubrica */ }
  
  // 5.2 Linha e Textos (Por cima)
  doc.setLineWidth(1);
  doc.setDrawColor(ESCURO_BRAND);
  doc.line(20, yAssIn, largura / 2 - 10, yAssIn);

  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PELO RESPONSÁVEL / EMITENTE', (20 + (largura / 2 - 10)) / 2, yAssIn + 5, { align: 'center' });
  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(11);
  doc.text('GUILHERME GOMES', (20 + (largura / 2 - 10)) / 2, yAssIn + 12, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`CNPJ: ${recibo.emitenteCNPJ}`, (20 + (largura / 2 - 10)) / 2, yAssIn + 17, { align: 'center' });

  // Linha do Cliente (Destinatario)
  doc.line(largura / 2 + 10, yAssIn, largura - 20, yAssIn);
  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PELO CLIENTE / BENEFICIÁRIO', (largura / 2 + 10 + largura - 20) / 2, yAssIn + 5, { align: 'center' });
  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(11);
  doc.text(recibo.clienteNome.toUpperCase(), (largura / 2 + 10 + largura - 20) / 2, yAssIn + 12, { align: 'center' });

  // 6. Rodapé Final
  doc.setLineWidth(1);
  doc.setDrawColor(ESCURO_BRAND);
  doc.line(12, altura - 30, largura - 12, altura - 30);

  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const footer1 = 'ESTE RECIBO É UM DOCUMENTO DE QUITAÇÃO DE PAGAMENTO EMITIDO ELETRONICAMENTE PELA PLATAFORMA PORTAL G CAC.';
  const footer2 = `SISTEMAS PORTAL G CAC © ${new Date().getFullYear()} — TODOS OS DIREITOS RESERVADOS.`;
  const operador = recibo.criadoPorNome ? ` — OPERADOR: ${recibo.criadoPorNome.toUpperCase()}` : '';
  doc.text(footer1, largura / 2, altura - 20, { align: 'center' });
  doc.text(footer2 + operador, largura / 2, altura - 15, { align: 'center' });

  return doc.output('blob');
}

// Helpers
async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function baixarPdfRecibo(recibo: Recibo): Promise<void> {
  const blob = await gerarPdfReciboBlob(recibo);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RECIBO_${String(recibo.numero).padStart(4, '0')}_${recibo.clienteNome.replace(/\s/g, '_')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
