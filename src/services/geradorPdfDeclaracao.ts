import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPdfDeclaracaoBlob(titulo: string, textoHtml: string, nomeCliente: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
      const logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
      if (logoRes.ok) {
        const logoBlob = await logoRes.blob();
        logoBase64 = await blobParaBase64(logoBlob);
      }
      nomeEmpresa = 'GCAC DESPACHANTE BÉLICO';
    }
  } catch (err) {
    console.error('Erro ao carregar cabeçalho:', err);
  }

  // Create hidden DOM container for high fidelity PDF layout
  const container = document.createElement('div');
  container.className = 'pdf-render-container';
  container.style.width = '794px'; // 210mm at 96 DPI
  container.style.padding = '60px 80px';
  container.style.boxSizing = 'border-box';
  container.style.backgroundColor = '#FFFFFF';
  container.style.color = '#000000';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const hoje = new Date();
  const dataExtenso = `${cidadeEmpresa} - ${estadoEmpresa}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  container.innerHTML = `
    <!-- Header -->
    <div style="display: flex; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 24px;">
      ${logoBase64 ? `<img src="${logoBase64}" style="width: 60px; height: 60px; margin-right: 16px; object-fit: contain;" />` : ''}
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 15px; font-weight: bold; color: #0D0D0D; font-family: Helvetica, Arial, sans-serif;">${nomeEmpresa}</span>
        <span style="font-size: 9px; font-weight: bold; color: #1B6FBF; letter-spacing: 1px; margin-top: 2px; font-family: Helvetica, Arial, sans-serif;">DOCUMENTO OFICIAL DE DECLARAÇÃO</span>
      </div>
    </div>

    <!-- Title -->
    <div style="text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 24px; text-transform: uppercase; font-family: Helvetica, Arial, sans-serif; color: #0D0D0D;">
      ${titulo}
    </div>

    <!-- Body text (render HTML) -->
    <div style="text-align: justify; font-size: 13px; color: #1F2937; margin-bottom: 30px; font-family: Helvetica, Arial, sans-serif; line-height: 1.6; word-wrap: break-word;">
      ${textoHtml}
    </div>

    <!-- Date -->
    <div style="font-size: 13px; color: #0D0D0D; margin-bottom: 40px; font-family: Helvetica, Arial, sans-serif;">
      ${dataExtenso}
    </div>

    <!-- Signature -->
    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 40px; page-break-inside: avoid; break-inside: avoid;">
      <div style="width: 250px; border-top: 1.5px solid #94A3B8; margin-bottom: 6px;"></div>
      <span style="font-size: 13px; font-weight: bold; text-transform: uppercase; font-family: Helvetica, Arial, sans-serif; color: #0D0D0D;">${nomeCliente}</span>
      <span style="font-size: 10px; color: #64748B; font-family: Helvetica, Arial, sans-serif;">Declarante</span>
    </div>
  `;

  document.body.appendChild(container);
  (window as any).html2canvas = html2canvas;

  try {
    await new Promise<void>((resolve, reject) => {
      doc.html(container, {
        callback: () => resolve(),
        x: 0,
        y: 0,
        width: 210, // A4 width in mm
        windowWidth: 794,
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false
        }
      });
    });
  } catch (err) {
    console.error('Erro na renderização do PDF:', err);
    throw err;
  } finally {
    document.body.removeChild(container);
  }

  return doc.output('blob');
}
