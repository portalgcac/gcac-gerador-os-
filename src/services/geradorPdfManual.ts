import jsPDF from 'jspdf';
import { SecaoManual, CONTEUDO_MANUAL } from './manualService';

// Cores GCAC
const AZUL   = '#1B6FBF';
const ESCURO = '#0D0D0D';
const LINHA  = '#DDDDDD';

export async function gerarPdfManual(secoesIds: string[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

  // ── Capa ───────────────────────────────────────────────────────────────
  doc.setFillColor(ESCURO);
  doc.rect(0, 0, largura, altura, 'F');

  let nomeEmpresa = 'GCAC Despachante Bélico';
  // Logo (Tentativa)
  try {
    let logoBase64 = '';
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa?.logoUrl) {
        logoBase64 = u.dadosEmpresa.logoUrl;
      }
      if (u.dadosEmpresa?.razaoSocialFantasia) {
        nomeEmpresa = u.dadosEmpresa.razaoSocialFantasia;
      }
    }

    if (!logoBase64) {
      const logoRes = await fetch('/LOGO CORRETA.png');
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
      doc.addImage(logoBase64, format, (largura / 2) - 25, 40, 50, 55);
    }
  } catch { /* logo nao disponivel */ }

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('MANUAL DE INSTRUÇÕES', largura / 2, 110, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(AZUL);
  doc.text('Plataforma Gestão GCAC', largura / 2, 120, { align: 'center' });

  doc.setDrawColor(AZUL);
  doc.setLineWidth(1);
  doc.line(largura * 0.25, 130, largura * 0.75, 130);

  doc.setFontSize(10);
  doc.setTextColor('#AAAAAA');
  doc.setFont('helvetica', 'normal');
  doc.text('Versão: 1.0.0 — Atualizado em: ' + new Date().toLocaleDateString('pt-BR'), largura / 2, altura - 20, { align: 'center' });
  doc.text(nomeEmpresa, largura / 2, altura - 15, { align: 'center' });

  // ── Conteúdo ───────────────────────────────────────────────────────────
  const secoesParaGerar = CONTEUDO_MANUAL.filter(s => secoesIds.includes(s.id));

  for (const secao of secoesParaGerar) {
    doc.addPage();
    y = 20;

    // Título da Seção
    doc.setFillColor(AZUL);
    doc.rect(15, y - 5, 2, 10, 'F');
    doc.setTextColor(ESCURO);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(secao.titulo, 22, y + 2);
    y += 15;

    // Conteúdo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#333333');

    secao.conteudo.forEach(paragrafo => {
      const linhas = doc.splitTextToSize(paragrafo, largura - 40);
      
      // Quebra de página se não couber
      if (y + (linhas.length * 6) > 270) {
        doc.addPage();
        y = 30;
      }

      doc.text(linhas, 20, y);
      y += (linhas.length * 6) + 4;
    });

    // Imagem Ilustrativa (Se disponível)
    if (secao.imagemPath) {
      try {
        const imgRes = await fetch(secao.imagemPath);
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          const imgBase64 = await blobParaBase64(imgBlob);
          
          y += 5;
          // Desenha uma borda suave ao redor da imagem
          doc.setDrawColor(LINHA);
          doc.setLineWidth(0.1);
          doc.roundedRect(19, y - 1, largura - 38, 62, 2, 2, 'S');
          
          doc.addImage(imgBase64, 'PNG', 20, y, largura - 40, 60);
          y += 70;
        }
      } catch (err) {
        console.error('Erro ao carregar imagem para o manual:', err);
      }
    }
  }

  // ── Rodapé (Números de página) ──────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#999999');
    doc.text(`Página ${i - 1} de ${pageCount - 1}`, largura - 20, altura - 10, { align: 'right' });
    doc.text(`${nomeEmpresa} — Manual de Uso Privado`, 20, altura - 10);
  }

  return doc.output('blob');
}

export async function baixarManualPdf(secoesIds: string[]): Promise<void> {
  const blob = await gerarPdfManual(secoesIds);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Manual_GCAC_${new Date().getFullYear()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

// Helper: Converte blob em base64
async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
