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

async function obterLogoEscritorioBase64(): Promise<string> {
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
          console.warn('Erro ao carregar logo personalizada do escritório:', e);
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao ler dados da empresa:', e);
  }

  // 2. Fallbacks de imagem oficial do Portal GCAC
  const fallbacks = [
    '/LOGO PORTAL G CAC 2 SEM FRASE.png',
    '/logo.png',
    '/LOGO CORRETA.png',
    '/Logo oficial.png'
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

export async function gerarPdfDeclaracaoBlob(titulo: string, textoHtml: string, nomeCliente: string): Promise<Blob> {
  let nomeEmpresa = 'GCAC DESPACHANTE BÉLICO';
  let enderecoEmpresa = '';
  let contatoTelefone = '';
  let cidadeEmpresa = 'Jataí';
  let estadoEmpresa = 'GO';

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      const ehGuilherme = u.email === 'gui.gomesassis@gmail.com';
      nomeEmpresa = u.dadosEmpresa?.razaoSocialFantasia?.toUpperCase() || 
                    u.dadosEmpresa?.nome?.toUpperCase() || 
                    (ehGuilherme ? 'GCAC DESPACHANTE BÉLICO' : 'GCAC DESPACHANTE BÉLICO');
      
      if (u.dadosEmpresa?.endereco) {
        enderecoEmpresa = u.dadosEmpresa.endereco;
      }
      if (u.dadosEmpresa?.contatoTelefone) {
        contatoTelefone = u.dadosEmpresa.contatoTelefone;
      }
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

  // Carregar logo garantido (do escritório ou fallback oficial)
  const logoBase64 = await obterLogoEscritorioBase64();

  // Criar container DOM com layout A4 oficial para captura de alta resolução
  const container = document.createElement('div');
  container.className = 'pdf-render-declaracao-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px'; // 210mm a 96 DPI
  container.style.minHeight = '1120px'; // Proporção da página A4 (297mm)
  container.style.padding = '55px 70px';
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

  container.innerHTML = `
    <!-- Top Content -->
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Header com Logo do Escritório -->
      <div style="display: flex; align-items: center; border-bottom: 2px solid #1B6FBF; padding-bottom: 14px; margin-bottom: 28px;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="width: 65px; height: 65px; margin-right: 18px; object-fit: contain; flex-shrink: 0;" />` : ''}
        <div style="display: flex; flex-direction: column; justify-content: center;">
          <span style="font-size: 16px; font-weight: 800; color: #0D0D0D; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif;">${nomeEmpresa}</span>
          <span style="font-size: 10px; font-weight: 700; color: #1B6FBF; letter-spacing: 1.5px; margin-top: 3px; font-family: Arial, Helvetica, sans-serif;">DOCUMENTO OFICIAL DE DECLARAÇÃO</span>
          ${(enderecoEmpresa || contatoTelefone) ? `
            <span style="font-size: 9px; color: #64748B; margin-top: 3px; font-family: Arial, Helvetica, sans-serif;">
              ${[enderecoEmpresa, contatoTelefone].filter(Boolean).join(' • ')}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Título da Declaração -->
      <div style="text-align: center; font-size: 15px; font-weight: 800; margin-bottom: 26px; text-transform: uppercase; color: #0D0D0D; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px;">
        ${titulo}
      </div>

      <!-- Corpo da Declaração -->
      <div style="text-align: justify; font-size: 13.5px; color: #1F2937; margin-bottom: 28px; font-family: Arial, Helvetica, sans-serif; line-height: 1.7; word-wrap: break-word;">
        ${textoHtml}
      </div>

      <!-- Data e Localidade -->
      <div style="font-size: 13.5px; color: #0D0D0D; margin-top: 15px; margin-bottom: 25px; font-family: Arial, Helvetica, sans-serif;">
        ${dataExtenso}
      </div>
    </div>

    <!-- Assinatura do Declarante -->
    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 35px; padding-bottom: 10px;">
      <div style="width: 280px; border-top: 1.5px solid #0D0D0D; margin-bottom: 8px;"></div>
      <span style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0D0D0D; font-family: Arial, Helvetica, sans-serif;">${nomeCliente}</span>
      <span style="font-size: 10.5px; color: #64748B; font-weight: 600; font-family: Arial, Helvetica, sans-serif; margin-top: 2px;">Declarante</span>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Aguardar o carregamento e renderização de todas as imagens internas (incluindo a logo)
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

    // Pequeno intervalo para renderização estável no DOM
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
