/**
 * Converte um objeto File em uma string Base64 Data URL.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Redimensiona e comprime uma imagem para caber nas dimensões máximas especificadas,
 * retornando a imagem como string Base64.
 */
export function compressImage(
  file: File, 
  maxWidth = 350, 
  maxHeight = 350, 
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context no available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Abre uma imagem/PDF em base64 em uma nova aba do navegador,
 * ou realiza o download se for outro tipo de arquivo.
 */
export function visualizarDocumentoBase64(base64Data: string, nomeArquivo: string) {
  try {
    if (!base64Data) {
      alert('Nenhum documento anexado.');
      return;
    }
    const partes = base64Data.split(';base64,');
    if (partes.length < 2) {
      // Se não for data URL, pode ser um link normal do Supabase Storage
      window.open(base64Data, '_blank');
      return;
    }
    const tipoMime = partes[0].split(':')[1];
    const bytesBrutos = atob(partes[1]);
    const arrayBytes = new Uint8Array(bytesBrutos.length);
    for (let i = 0; i < bytesBrutos.length; i++) {
      arrayBytes[i] = bytesBrutos.charCodeAt(i);
    }
    const blob = new Blob([arrayBytes], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    
    if (tipoMime.includes('pdf') || tipoMime.includes('image')) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
    }
  } catch (err) {
    console.error('Erro ao abrir documento:', err);
    alert('Não foi possível abrir o documento.');
  }
}
