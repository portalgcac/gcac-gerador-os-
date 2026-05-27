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
