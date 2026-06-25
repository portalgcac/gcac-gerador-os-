import jsPDF from 'jspdf';

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPdfDeclaracaoBlob(titulo: string, texto: string, nomeCliente: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 15;

  let nomeEmpresa = '';
  let logoBase64 = '';
  let cidadeEmpresa = 'Jataí';
  let estadoEmpresa = 'GO';

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa?.logoUrl) {
        logoBase64 = u.dadosEmpresa.logoUrl;
      }
      nomeEmpresa = u.dadosEmpresa?.razaoSocialFantasia?.toUpperCase() || u.dadosEmpresa?.nome?.toUpperCase() || '';
      if (u.dadosEmpresa?.cidade) {
        cidadeEmpresa = u.dadosEmpresa.cidade;
      }
      if (u.dadosEmpresa?.estado) {
        estadoEmpresa = u.dadosEmpresa.estado;
      }
    }

    if (!logoBase64 && !nomeEmpresa) {
      // Fallback para logo padrão se não houver dados da empresa
      const logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
      if (logoRes.ok) {
        const logoBlob = await logoRes.blob();
        logoBase64 = await blobParaBase64(logoBlob);
      }
      nomeEmpresa = 'GCAC DESPACHANTE BÉLICO';
    }

    if (logoBase64) {
      let format = 'PNG';
      if (logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg')) {
        format = 'JPEG';
      } else if (logoBase64.startsWith('data:image/webp')) {
        format = 'WEBP';
      }
      doc.addImage(logoBase64, format, 12, 10, 20, 20);
    }
  } catch (err) {
    console.error('Erro ao carregar cabeçalho:', err);
  }

  // Nome e Identificação do Despachante
  doc.setTextColor('#0D0D0D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nomeEmpresa, 36, 18);

  doc.setTextColor('#1B6FBF');
  doc.setFontSize(9);
  doc.text('DOCUMENTO OFICIAL DE DECLARAÇÃO', 36, 24);

  // Linha divisória do cabeçalho
  doc.setDrawColor('#E2E8F0');
  doc.setLineWidth(0.5);
  doc.line(12, 33, largura - 12, 33);
  doc.setLineWidth(0.1);

  y = 48;

  // Título da Declaração
  doc.setTextColor('#0D0D0D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const tituloSplitted = doc.splitTextToSize(titulo.toUpperCase(), largura - 30);
  doc.text(tituloSplitted, largura / 2, y, { align: 'center' });
  
  y += (tituloSplitted.length * 6) + 12;

  // Corpo do Texto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor('#1F2937'); // cinza escuro para melhor legibilidade

  const paragrafos = texto.split('\n');
  const maxLarguraTexto = largura - 32; // 16mm de margem esquerda e direita

  for (const paragrafo of paragrafos) {
    const textoLimpo = paragrafo.trim();
    if (!textoLimpo) {
      y += 5; // espaço entre parágrafos
      continue;
    }

    const linhas = doc.splitTextToSize(textoLimpo, maxLarguraTexto);
    for (const linha of linhas) {
      if (y > altura - 45) { // Se passar perto do final da página, cria nova
        doc.addPage();
        y = 20;
      }
      // Alinhamento à esquerda (jsPDF nativo justificado é limitado)
      doc.text(linha, 16, y);
      y += 6.5; // Espaçamento de linha
    }
    y += 4; // Espaçamento após parágrafo
  }

  y += 10;

  // Data e Assinatura
  if (y > altura - 55) {
    doc.addPage();
    y = 30;
  }

  // Data por extenso
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor('#0D0D0D');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const hoje = new Date();
  const dataExtenso = `${cidadeEmpresa} - ${estadoEmpresa}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
  doc.text(dataExtenso, 16, y);

  y += 25;

  // Linha de assinatura
  if (y > altura - 25) {
    doc.addPage();
    y = 40;
  }
  doc.setDrawColor('#94A3B8');
  doc.setLineWidth(0.3);
  doc.line(largura / 2 - 50, y, largura / 2 + 50, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(nomeCliente.toUpperCase(), largura / 2, y + 5, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#64748B');
  doc.text('Declarante', largura / 2, y + 9, { align: 'center' });

  return doc.output('blob');
}
