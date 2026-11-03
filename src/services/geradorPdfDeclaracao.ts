import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatarCPF } from '../utils/formatters';

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function obterLogoOficialBase64(): Promise<string> {
  // 1. Tentar pegar a logo configurada no perfil da empresa
  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      const customLogo = u.dadosEmpresa?.logoUrl;
      if (customLogo) {
        if (customLogo.startsWith('data:image/')) {
          return customLogo;
        }
        try {
          const res = await fetch(customLogo);
          if (res.ok) {
            const blob = await res.blob();
            const b64 = await blobParaBase64(blob);
            if (b64) return b64;
          }
        } catch (e) {
          console.warn('Erro ao carregar logo personalizada:', e);
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao ler dados da empresa:', e);
  }

  // 2. Fallbacks de imagem oficial do Portal GCAC (logo oficial com brasão GCAC Despachante Bélico)
  const fallbacks = [
    '/logo_oficial_documentos.png',
    '/Logo oficial.png',
    '/LOGO PORTAL G CAC 2 SEM FRASE.png',
    '/logo.png',
    '/LOGO CORRETA.png'
  ];

  for (const path of fallbacks) {
    try {
      const res = await fetch(encodeURI(path));
      if (res.ok) {
        const blob = await res.blob();
        const base64 = await blobParaBase64(blob);
        if (base64) return base64;
      }
    } catch {
      // continua para o próximo fallback
    }
  }

  return '';
}

export async function gerarPdfDeclaracaoBlob(
  titulo: string, 
  textoHtml: string, 
  nomeCliente: string,
  cpfCliente?: string
): Promise<Blob> {
  let cidadeEmpresa = 'Jataí';
  let estadoEmpresa = 'GO';

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa?.cidade) {
        cidadeEmpresa = u.dadosEmpresa.cidade;
      }
      if (u.dadosEmpresa?.estado) {
        estadoEmpresa = u.dadosEmpresa.estado;
      }
    }
  } catch (err) {
    console.error('Erro ao ler dados da empresa:', err);
  }

  // Carregar logo oficial (com brasão e texto GCAC Despachante Bélico)
  const logoBase64 = await obterLogoOficialBase64();

  // Formatar CPF para a assinatura
  const cpfFormatado = cpfCliente ? formatarCPF(cpfCliente) : '';

  // Criar container DOM com layout A4 oficial para captura de alta resolução
  const container = document.createElement('div');
  container.className = 'pdf-render-declaracao-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px'; // 210mm a 96 DPI
  container.style.minHeight = '1120px'; // Proporção exata da página A4 (297mm)
  container.style.padding = '50px 75px 60px 75px';
  container.style.boxSizing = 'border-box';
  container.style.backgroundColor = '#FFFFFF';
  container.style.color = '#000000';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'space-between';

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const hoje = new Date();
  const dataExtenso = `${cidadeEmpresa} - ${estadoEmpresa}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  const jaTemFechamento = textoHtml.toLowerCase().includes('por ser verdade');

  container.innerHTML = `
    <!-- Top Content -->
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Logo Oficial Centralizada no Topo (conforme layout oficial de declarações GCAC) -->
      <div style="display: flex; justify-content: center; align-items: center; margin-top: 5px; margin-bottom: 25px;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo GCAC Despachante Bélico" style="width: 175px; height: 175px; object-fit: contain;" />` : ''}
      </div>

      <!-- Título da Declaração Centralizado em Negrito -->
      <div style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 28px; text-transform: uppercase; color: #000000; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px;">
        ${titulo}
      </div>

      <!-- Corpo da Declaração Justificado -->
      <div style="text-align: justify; font-size: 13.5px; color: #000000; font-family: Arial, Helvetica, sans-serif; line-height: 1.65; word-wrap: break-word;">
        ${textoHtml}
      </div>

      <!-- Fechamento e Data Alinhados à Direita -->
      <div style="text-align: right; font-size: 13px; color: #000000; margin-top: 30px; margin-bottom: 25px; font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
        ${!jaTemFechamento ? 'Por ser verdade, firmo o presente documento.<br>' : ''}
        ${dataExtenso}
      </div>
    </div>

    <!-- Linha de Assinatura Centralizada com Nome e CPF -->
    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 35px; padding-bottom: 10px;">
      <div style="width: 340px; border-top: 1px solid #000000; margin-bottom: 6px;"></div>
      <span style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: #000000; font-family: Arial, Helvetica, sans-serif;">${nomeCliente}</span>
      ${cpfFormatado ? `<span style="font-size: 12px; color: #222222; font-family: Arial, Helvetica, sans-serif; margin-top: 2px;">${cpfFormatado}</span>` : ''}
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Aguardar o carregamento de todas as imagens internas (incluindo a logo)
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>(res => {
          img.onload = () => res();
          img.onerror = () => res();
        });
      })
    );

    // Intervalo para renderização estável no DOM
    await new Promise(r => setTimeout(r, 60));

    // Captura com html2canvas em alta resolução (scale: 2)
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      windowWidth: 794
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidthMm = 210;
    const pageHeightMm = 297;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const totalHeightMm = (canvasHeight * pageWidthMm) / canvasWidth;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Se o conteúdo cabe em 1 página (com tolerância de 3mm)
    if (totalHeightMm <= pageHeightMm + 3) {
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, Math.min(totalHeightMm, pageHeightMm), undefined, 'FAST');
    } else {
      // Caso exceda 1 página, aplica paginação fluida
      let heightLeft = totalHeightMm;
      let position = 0;

      doc.addImage(imgData, 'JPEG', 0, position, pageWidthMm, totalHeightMm, undefined, 'FAST');
      heightLeft -= pageHeightMm;

      while (heightLeft > 5) {
        position -= pageHeightMm;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, pageWidthMm, totalHeightMm, undefined, 'FAST');
        heightLeft -= pageHeightMm;
      }
    }

    return doc.output('blob');
  } catch (err) {
    console.error('Erro na renderização do PDF da declaração:', err);
    throw err;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
