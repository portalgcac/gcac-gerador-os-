import jsPDF from 'jspdf';
import { Orcamento } from '../types';
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone } from '../utils/formatters';
import { isLaudoExame } from '../utils/categoriaHelper';

// Cores GCAC
const VERDE  = '#6DBE45';
const ESCURO = '#0D0D0D';
const CINZA  = '#555555';
const LINHA  = '#DDDDDD';

export async function gerarPdfOrcamentoBlob(orcamento: Orcamento): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

  // Obter dados da empresa logada para cabeçalho do PDF
  let nomeEmpresa = '';
  let responsavel = '';
  let telefone = '';
  let endereco = '';
  let categoriasConfig: any[] = [];

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      const ehGuilherme = u.email === 'gui.gomesassis@gmail.com';
      nomeEmpresa = u.dadosEmpresa?.razaoSocialFantasia || u.dadosEmpresa?.nome || (ehGuilherme ? 'GCAC Despachante Bélico' : '');
      responsavel = u.dadosEmpresa?.responsavelNome || (ehGuilherme ? 'Guilherme Gomes' : '');
      telefone = u.dadosEmpresa?.contatoTelefone || (ehGuilherme ? '(64) 9.9995-9865' : '');
      endereco = u.dadosEmpresa?.endereco || (ehGuilherme ? 'Av. Goias, n 1802, Sala 04 - Bairro Santa Maria - Jatai-GO' : '');
      categoriasConfig = u.dadosEmpresa?.categoriasServico || [];
    }
  } catch (err) {
    console.error('Erro ao ler dados da empresa do localStorage:', err);
  }

  // ── Cabeçalho ───────────────────────────────────────────────────────────
  doc.setFillColor(ESCURO);
  doc.rect(0, 0, largura, 32, 'F');

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
      const logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
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
      doc.addImage(logoBase64, format, 6, 2, 27, 28);
    }
  } catch { /* logo nao disponivel */ }

  // Dados da empresa
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, 37, 8.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#D1D5DB');
  doc.text(responsavel, 37, 13);
  doc.text(telefone, 37, 17);
  doc.text(endereco, 37, 21);

  // Linha separadora interna
  doc.setDrawColor('#374151');
  doc.line(37, 23.5, largura - 12, 23.5);

  // Número ORC e Data
  doc.setFontSize(12);
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  const numRotulo = `ORC-${String(orcamento.numero).padStart(4, '0')}`;
  doc.text(numRotulo, largura - 12, 27.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#9CA3AF');
  doc.text('Emitido em: ' + formatarData(orcamento.criadoEm), largura - 12, 31, { align: 'right' });

  // Badge de Propósito
  doc.setFillColor('#374151');
  doc.roundedRect(37, 25, 44, 5.5, 1, 1, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO DE SERVIÇO', 59, 28.8, { align: 'center' });

  y = 35;

  // ── Dados do Cliente ─────────────────────────────────────────────────────
  y = secaoTitulo(doc, 'DADOS DO CLIENTE', y, VERDE);

  // Card do Cliente compacto em 2 colunas
  const endTexto = orcamento.endereco || 'NÃO INFORMADO';
  const endLinhas = doc.splitTextToSize(endTexto, 68);
  const alturaBoxCliente = Math.max(11, 4 + 4 + (endLinhas.length * 3.4));

  doc.setFillColor('#F9FAFB');
  doc.setDrawColor('#E5E7EB');
  doc.setLineWidth(0.3);
  doc.roundedRect(12, y, largura - 24, alturaBoxCliente, 1.5, 1.5, 'FD');

  // Marcador verde lateral
  doc.setFillColor(VERDE);
  doc.rect(12, y + 1, 1.5, alturaBoxCliente - 2, 'F');

  // Coluna 1
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#4B5563');
  doc.text('Cliente:', 16, y + 3.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#111827');
  doc.setFontSize(8.5);
  const nomeClienteCortado = doc.splitTextToSize(orcamento.nomeCliente || '-', 70);
  doc.text(nomeClienteCortado[0], 28, y + 3.8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#4B5563');
  doc.text('Contato:', 16, y + 7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111827');
  doc.text(formatarTelefone(orcamento.contato) || '-', 29, y + 7.8);

  // Coluna 2
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#4B5563');
  doc.text('CPF:', 108, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111827');
  doc.text(orcamento.cpf ? formatarCPF(orcamento.cpf) : 'NÃO INFORMADO', 116, y + 3.8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#4B5563');
  doc.text('Endereço:', 108, y + 7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111827');
  doc.setFontSize(7.5);
  doc.text(endLinhas, 124, y + 7.8);

  y += alturaBoxCliente + 2.5;

  // ── Descrição dos Serviços (Múltiplos) ───────────────────────────────────
  y = secaoTitulo(doc, 'DESCRIÇÃO DOS SERVIÇOS E VALORES', y, VERDE);

  const arrayServicos = (orcamento.servicos && orcamento.servicos.length > 0)
    ? orcamento.servicos
    : [];

  if (arrayServicos.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(CINZA);
    doc.setFontSize(8.5);
    doc.text('Nenhum serviço informado.', 14, y + 3);
    y += 8;
  } else {
    arrayServicos.forEach((serv) => {
      const nomeFormatado = serv.nome.toUpperCase();

      // Configura fonte para o nome
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const linhasNome = doc.splitTextToSize(nomeFormatado, largura - 65);
      const alturaNome = linhasNome.length * 3.6;

      // Calcula linhas do detalhe
      doc.setFontSize(8);
      const linhasDetalhe = (serv.detalhes && serv.detalhes.trim()) 
        ? doc.splitTextToSize(serv.detalhes, largura - 32) 
        : [];
      const temDetalhe = linhasDetalhe.length > 0;
      const alturaDetalhe = temDetalhe ? (linhasDetalhe.length * 3.3) : 0;

      let alturaBloco = 3.6 + alturaNome + (temDetalhe ? (alturaDetalhe + 1.2) : 0);
      if (alturaBloco < 7) alturaBloco = 7;

      // Quebra de página se não couber o bloco inteiro
      if (y + alturaBloco > 272) {
        doc.addPage();
        y = 15;
      }

      // Card do serviço
      doc.setFillColor('#F9FAFB');
      doc.setDrawColor('#E5E7EB');
      doc.setLineWidth(0.25);
      doc.roundedRect(12, y, largura - 24, alturaBloco, 1.5, 1.5, 'FD');

      // Barrinha verde lateral sutil
      doc.setFillColor(VERDE);
      doc.rect(12, y + 0.8, 1.2, alturaBloco - 1.6, 'F');

      // Nome do Serviço 
      doc.setTextColor(ESCURO);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(linhasNome, 16, y + 3.6);

      // Valor à direita do bloco (alinhado com a primeira linha do nome)
      doc.setTextColor('#16A34A');
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(formatarMoeda(serv.valor), largura - 16, y + 3.6, { align: 'right' });

      // Detalhes
      if (temDetalhe) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#4B5563');
        doc.text(linhasDetalhe, 16, y + 3.6 + alturaNome + 0.5);
      }

      y += alturaBloco + 1.2; // espaçamento compacto entre cards
    });
  }

  y += 1.5;

  // ── Resumo Geral e Observações ───────────────────────────────────────────
  const honorarios = orcamento.servicos.filter(s => !isLaudoExame(s.categoria || '', categoriasConfig)).reduce((acc, s) => acc + (s.valor || 0), 0);
  const laudos = orcamento.servicos.filter(s => isLaudoExame(s.categoria || '', categoriasConfig)).reduce((acc, s) => acc + (s.valor || 0), 0);
  const totalGeral = orcamento.servicos.reduce((acc, s) => acc + (s.valor || 0), 0);

  const temObs = Boolean(orcamento.observacoes && orcamento.observacoes.trim());
  let linhasObs: string[] = [];
  let alturaObs = 0;
  if (temObs) {
    doc.setFontSize(7.5);
    linhasObs = doc.splitTextToSize(orcamento.observacoes!.trim(), 108);
    alturaObs = Math.max(20, 6 + (linhasObs.length * 3.3));
  }

  const alturaResumo = 20;
  const alturaSecaoFinal = Math.max(alturaResumo, alturaObs);

  // Verifica se cabe o bloco de resumo na página
  if (y + alturaSecaoFinal + 9 > 272) {
    doc.addPage();
    y = 15;
  }

  y = secaoTitulo(doc, 'RESUMO GERAL', y, VERDE);

  if (temObs) {
    // Box de Observações à esquerda
    doc.setFillColor('#F9FAFB');
    doc.setDrawColor('#E5E7EB');
    doc.setLineWidth(0.25);
    doc.roundedRect(12, y, 114, alturaSecaoFinal, 1.5, 1.5, 'FD');

    doc.setTextColor('#374151');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES E CONDIÇÕES:', 15, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#4B5563');
    doc.setFontSize(7.5);
    doc.text(linhasObs, 15, y + 8);

    // Box de Totais à direita
    doc.setFillColor('#F0FDF4');
    doc.setDrawColor('#86EFAC');
    doc.setLineWidth(0.3);
    doc.roundedRect(130, y, 68, alturaSecaoFinal, 1.5, 1.5, 'FD');

    doc.setTextColor('#4B5563');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`HONORÁRIOS: ${formatarMoeda(honorarios)}`, 164, y + 4, { align: 'center' });
    doc.text(`LAUDOS/EXTERNOS: ${formatarMoeda(laudos)}`, 164, y + 7.5, { align: 'center' });

    doc.setDrawColor('#BBF7D0');
    doc.setLineWidth(0.2);
    doc.line(134, y + 9.2, 194, y + 9.2);

    doc.setTextColor('#374151');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PREVISTO', 164, y + 12.8, { align: 'center' });

    doc.setTextColor('#15803D');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(totalGeral), 164, y + 18, { align: 'center' });
  } else {
    // Apenas Box de Totais à direita
    const boxW = 68;
    const boxX = largura - 12 - boxW;

    doc.setFillColor('#F0FDF4');
    doc.setDrawColor('#86EFAC');
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, y, boxW, alturaResumo, 1.5, 1.5, 'FD');

    doc.setTextColor('#4B5563');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`HONORÁRIOS: ${formatarMoeda(honorarios)}`, boxX + (boxW / 2), y + 4, { align: 'center' });
    doc.text(`LAUDOS/EXTERNOS: ${formatarMoeda(laudos)}`, boxX + (boxW / 2), y + 7.5, { align: 'center' });

    doc.setDrawColor('#BBF7D0');
    doc.setLineWidth(0.2);
    doc.line(boxX + 4, y + 9.2, boxX + boxW - 4, y + 9.2);

    doc.setTextColor('#374151');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PREVISTO', boxX + (boxW / 2), y + 12.8, { align: 'center' });

    doc.setTextColor('#15803D');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(totalGeral), boxX + (boxW / 2), y + 18, { align: 'center' });
  }

  // ── Rodapé (em todas as páginas) ──────────────────────────────────────────
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Linha separadora
    doc.setDrawColor('#E5E7EB');
    doc.setLineWidth(0.3);
    doc.line(12, altura - 18, largura - 12, altura - 18);

    // Barra escura
    doc.setFillColor(ESCURO);
    doc.rect(0, altura - 14, largura, 14, 'F');
    doc.setTextColor('#9CA3AF');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${nomeEmpresa} — Orçamento gerado eletronicamente`, largura / 2, altura - 8, { align: 'center' });
    const emitidoPor = orcamento.criadoPorNome ? `Emitido por: ${orcamento.criadoPorNome} | ` : '';
    const paginacao = totalPaginas > 1 ? ` | Pág. ${i}/${totalPaginas}` : '';
    doc.text(emitidoPor + 'Gerado em: ' + new Date().toLocaleString('pt-BR') + paginacao, largura / 2, altura - 4, { align: 'center' });
  }

  return doc.output('blob');
}

export async function baixarPdfOrcamento(orcamento: Orcamento): Promise<void> {
  const blob = await gerarPdfOrcamentoBlob(orcamento);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ORC_${String(orcamento.numero).padStart(4, '0')}_${orcamento.nomeCliente.replace(/\s/g, '_')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function imprimirPdfOrcamento(orcamento: Orcamento): Promise<void> {
  const blob = await gerarPdfOrcamentoBlob(orcamento);
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank');
  if (janela) {
    // Para funcionar em navegadores modernos, damos um tempo para carregar
    setTimeout(() => {
      janela.print();
    }, 500);
  }
  // Limpamos o objeto da memória após 1 minuto
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function secaoTitulo(doc: jsPDF, titulo: string, y: number, cor: string): number {
  doc.setFillColor(cor);
  doc.rect(12, y, 3.5, 4.5, 'F');
  doc.setTextColor(cor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 17.5, y + 3.6);
  doc.setDrawColor('#E5E7EB');
  doc.setLineWidth(0.3);
  doc.line(12, y + 5.5, doc.internal.pageSize.getWidth() - 12, y + 5.5);
  return y + 7.5;
}

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
