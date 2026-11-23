import { supabase } from '../db/supabase';

/**
 * Converte uma string Base64 em Blob para upload.
 */
export async function base64ToBlob(base64Data: string): Promise<{ blob: Blob; mimeType: string }> {
  const parts = base64Data.split(';base64,');
  const mimeType = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return {
    blob: new Blob([byteArray], { type: mimeType }),
    mimeType
  };
}

/**
 * Realiza o upload de um arquivo em Base64 para um bucket do Supabase Storage.
 * Retorna a URL pública do arquivo enviado.
 */
export async function uploadBase64File(
  base64Data: string | null | undefined,
  bucketName: string,
  path: string
): Promise<string | null> {
  if (!base64Data) return null;
  if (!base64Data.startsWith('data:')) {
    return base64Data; // Já é uma URL ou caminho normal
  }

  const { blob, mimeType } = await base64ToBlob(base64Data);

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}

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
    // Se for SVG, não redimensiona por canvas para não perder vetorização
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Falha ao ler dados da imagem.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || maxWidth;
          let height = img.height || maxHeight;

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

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Se canvas não estiver disponível, resolve com o dataUrl original
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const outputFormat = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          resolve(canvas.toDataURL(outputFormat, quality));
        } catch (canvasErr) {
          console.warn('[compressImage] Fallback para dataUrl original:', canvasErr);
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        // Fallback para dataUrl se a imagem não puder ser renderizada no elemento Image
        console.warn('[compressImage] img.onerror disparado, usando dataUrl original.');
        resolve(dataUrl);
      };

      // Define src após configurar os listeners de onload e onerror
      img.src = dataUrl;
    };

    reader.onerror = (err) => reject(err);
    // Inicia a leitura do arquivo após registrar os callbacks
    reader.readAsDataURL(file);
  });
}

/**
 * Abre uma imagem/PDF em base64 em uma nova aba do navegador,
 * ou realiza o download se for outro tipo de arquivo.
 */
export async function visualizarDocumentoBase64(base64Data: string, nomeArquivo: string) {
  try {
    if (!base64Data) {
      alert('Nenhum documento anexado.');
      return;
    }

    // Interceptar URLs públicas do Supabase Storage para converter em URLs assinadas temporárias
    if (base64Data.startsWith('http') && base64Data.includes('/documentos-clientes/')) {
      const match = base64Data.match(/\/storage\/v1\/object\/public\/documentos-clientes\/(.+)$/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        try {
          const { data, error } = await supabase.storage
            .from('documentos-clientes')
            .createSignedUrl(path, 300); // URL assinada válida por 5 minutos (300 segundos)

          if (error) throw error;
          if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
            return;
          }
        } catch (err) {
          console.error('Erro ao gerar URL assinada:', err);
          // Fallback: tenta abrir a URL original se houver erro
          window.open(base64Data, '_blank');
          return;
        }
      }
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
