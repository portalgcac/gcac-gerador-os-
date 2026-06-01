import jsPDF from 'jspdf';
import { OrdemDeServico } from '../types';
import { formatarMoeda, formatarData, formatarNumeroOS, formatarCPF, formatarTelefone } from '../utils/formatters';

// Cores GCAC
const AZUL   = '#1B6FBF';
const VERDE  = '#6DBE45';
const ESCURO = '#0D0D0D';
const CINZA  = '#555555';
const LINHA  = '#DDDDDD';

export async function gerarPdfBlob(ordem: OrdemDeServico): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

  // Obter dados da empresa logada para cabeçalho do PDF
  let nomeEmpresa = 'GCAC Despachante Bélico';
  let responsavel = 'Guilherme Gomes';
  let telefone = '(64) 9.9995-9865';
  let endereco = 'Av. Goias, n 1802, Sala 04 - Bairro Santa Maria - Jatai-GO';
  let clubeParceiro = 'CLUBE DE TIRO E CAÇA PRÓ TIRO (JATAÍ)';

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa) {
        nomeEmpresa = u.dadosEmpresa.razaoSocialFantasia || u.dadosEmpresa.nome || nomeEmpresa;
        responsavel = u.dadosEmpresa.responsavelNome || responsavel;
        telefone = u.dadosEmpresa.contatoTelefone || telefone;
        endereco = u.dadosEmpresa.endereco || endereco;
        clubeParceiro = u.dadosEmpresa.clubeParceiroPadrao || clubeParceiro;
      }
    }
  } catch (err) {
    console.error('Erro ao ler dados da empresa do localStorage:', err);
  }

  // ── Cabeçalho ───────────────────────────────────────────────────────────
  doc.setFillColor(ESCURO);
  doc.rect(0, 0, largura, 42, 'F');

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
      doc.addImage(logoBase64, format, 6, 2, 34, 38);
    }
  } catch { /* logo nao disponivel */ }

  // Dados da empresa
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, 46, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#CCCCCC');
  doc.text(responsavel, 46, 17);
  doc.text(telefone, 46, 22);
  doc.text(endereco, 46, 27);

  // Linha separadora interna
  doc.setDrawColor('#333333');
  doc.line(46, 30, largura - 12, 30);

  // Número OS e Data
  doc.setFontSize(14);
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.text(formatarNumeroOS(ordem.numero), largura - 12, 35, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#AAAAAA');
  doc.text('Data: ' + formatarData(ordem.criadoEm), largura - 12, 40, { align: 'right' });

  // Badge de Status
  const corStatus = getCorStatus(ordem.status);
  doc.setFillColor(corStatus);
  doc.roundedRect(46, 33, 55, 8, 1.5, 1.5, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS: ' + ordem.status.toUpperCase(), 73.5, 38.5, { align: 'center' });


  y = 50;

  // ── Dados do Cliente ─────────────────────────────────────────────────────
  y = secaoTitulo(doc, 'DADOS DO CLIENTE', y, AZUL);
  y += 2;

  y = linhaInfo(doc, 'Nome Completo:', ordem.nomeCliente, y, largura);
  y = linhaInfo(doc, 'Endereço:', ordem.endereco || 'NÃO INFORMADO', y, largura);
  y = linhaInfo(doc, 'CPF:', formatarCPF(ordem.cpf), y, largura);
  y = linhaInfo(doc, 'Contato:', formatarTelefone(ordem.contato), y, largura);
  y = linhaInfo(doc, 'Senha GOV.br:', ordem.senhaGov, y, largura);

  const textoFiliacao = ordem.filiadoProTiro
    ? `Filiado ao ${clubeParceiro}`
    : `Não filiado ao ${clubeParceiro}` + (ordem.clubeFiliado ? ' | Clube: ' + ordem.clubeFiliado : '');
  y = linhaInfo(doc, 'Filiação:', textoFiliacao, y, largura);

  y += 4;

  // ── Descrição dos Serviços (Múltiplos) ───────────────────────────────────
  y = secaoTitulo(doc, 'DESCRIÇÃO DOS SERVIÇOS', y, AZUL);
  y += 2;

  const arrayServicos = (ordem.servicos && ordem.servicos.length > 0)
    ? ordem.servicos
    : [{ id: 'legacy', nome: 'SERVIÇO REGISTRADO', detalhes: (ordem as any).servico || 'Nenhum serviço informado.', protocolo: undefined, valor: ordem.valor }];

  arrayServicos.forEach((serv) => {
    const nomeFormatado = serv.nome.toUpperCase();
    
    // Configura fonte para o nome
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    
    // Quebra o nome em linhas se for muito longo (largura - 75 para dar espaço ao valor)
    const linhasNome = doc.splitTextToSize(nomeFormatado, largura - 75);
    const alturaNome = linhasNome.length * 5;

    // Calcula linhas do bloco de detalhe e altura final
    doc.setFontSize(9.5);
    const linhasDetalhe = serv.detalhes ? doc.splitTextToSize(serv.detalhes, largura - 34) : [];
    const alturaBloco = 8 + alturaNome + (linhasDetalhe.length * 4.5) + (serv.protocolo ? 6 : 0);

    // Quebra de página se não couber o bloco inteiro
    if (y + alturaBloco > 275) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor('#F8F9FA');
    doc.setDrawColor(LINHA);
    doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'F');
    doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'S');

    // Imprimir Nome do Serviço em NEGRITO
    doc.setTextColor(ESCURO);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(linhasNome, 17, y + 6);

    // Imprimir Valor do Serviço à Direita
    doc.setTextColor(AZUL);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(serv.valor || 0), largura - 16, y + 6, { align: 'right' });

    // Imprimir Detalhes em NORMAL, alinhados sutilmente
    if (serv.detalhes && serv.detalhes.trim()) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#444444');
      doc.text(linhasDetalhe, 17, y + 6 + alturaNome);
    }
    
    // Imprimir Protocolo se houver
    if (serv.protocolo) {
      const offsetProt = (serv.detalhes && serv.detalhes.trim()) ? (linhasDetalhe.length * 4.5 + 2) : 2;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AZUL);
      doc.text(`PROTOCOLO: ${serv.protocolo}`, 17, y + 6 + alturaNome + offsetProt);
    }
    
    y += alturaBloco + 2; // espaçamento de um card pro outro
  });

  y += 2;
  // ── Valores e Pagamento ──────────────────────────────────────────────────
  y = secaoTitulo(doc, 'VALORES E PAGAMENTO', y, AZUL);
  y += 2;

  // Detalhamento de valores
  const honorarios = (ordem.servicos || []).filter(s => s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0);
  const laudos = (ordem.servicos || []).filter(s => s.categoria === 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0);

  // Caixa valor
  doc.setFillColor('#EBF5FB');
  doc.roundedRect(12, y, (largura - 28) / 2, 26, 2, 2, 'F');
  doc.setDrawColor(LINHA);
  doc.roundedRect(12, y, (largura - 28) / 2, 26, 2, 2, 'S');
  doc.setTextColor(CINZA);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(`HONORÁRIOS: ${formatarMoeda(honorarios)}`, 17, y + 5);
  doc.text(`LAUDOS/EXTERNOS: ${formatarMoeda(laudos)}`, 17, y + 9);
  
  doc.setDrawColor('#D6EAF8');
  doc.line(15, y + 11, (largura - 28) / 2 + 9, y + 11);

  doc.setTextColor(CINZA);
  doc.setFontSize(8);
  doc.text('VALOR TOTAL DA O.S.', 17, y + 16);
  doc.setTextColor(AZUL);
  doc.setFontSize(15);
  const totalGeral = (ordem.servicos || []).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);
  doc.text(formatarMoeda(totalGeral), 17, y + 23);

  // Caixa pagamento (ajustada altura para alinhar com a da esquerda)
  doc.setFillColor('#EBF5FB');
  const xPag = largura / 2 + 2;
  const wPag = (largura - 28) / 2;
  doc.roundedRect(xPag, y, wPag, 26, 2, 2, 'F');
  doc.roundedRect(xPag, y, wPag, 26, 2, 2, 'S');
  doc.setTextColor(CINZA);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO', xPag + 5, y + 5);
  doc.setTextColor(ESCURO);
  doc.setFontSize(12);
  doc.text(ordem.formaPagamento, xPag + 5, y + 16);

  // Status de pagamento
  doc.setFillColor(corStatus);
  doc.roundedRect(12, y + 29, largura - 24, 8, 1.5, 1.5, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS: ' + ordem.status.toUpperCase(), largura / 2, y + 34.5, { align: 'center' });

  y += 44;

  // ── Observações ──────────────────────────────────────────────────────────
  if (ordem.observacoes && ordem.observacoes.trim()) {
    y = secaoTitulo(doc, 'OBSERVAÇÕES', y, CINZA);
    y += 2;
    doc.setTextColor('#333333');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    const linhasObs = doc.splitTextToSize(ordem.observacoes, largura - 34);
    doc.text(linhasObs, 17, y);
    y += linhasObs.length * 5.5 + 5;
  }

  // ── Canal de Atendimento ─────────────────────────────────────────────────
  if (ordem.canalAtendimento || (ordem.observacaoContato && ordem.observacaoContato.trim())) {
    y = secaoTitulo(doc, 'CANAL DE ATENDIMENTO', y, CINZA);
    y += 2;

    if (ordem.canalAtendimento) {
      y = linhaInfo(doc, 'Canal:', ordem.canalAtendimento, y, largura);
    }
    if (ordem.observacaoContato && ordem.observacaoContato.trim()) {
      y = linhaInfo(doc, 'Observação:', ordem.observacaoContato, y, largura);
    }
    y += 2;
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  // Linha separadora
  doc.setDrawColor(LINHA);
  doc.line(12, altura - 20, largura - 12, altura - 20);

  doc.setFillColor(ESCURO);
  doc.rect(0, altura - 16, largura, 16, 'F');
  doc.setTextColor('#AAAAAA');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomeEmpresa} — Documento gerado eletronicamente`, largura / 2, altura - 8, { align: 'center' });
  const emitidoPor = ordem.criadoPorNome ? `Emitido por: ${ordem.criadoPorNome} | ` : '';
  doc.text(emitidoPor + 'Gerado em: ' + new Date().toLocaleString('pt-BR'), largura / 2, altura - 4, { align: 'center' });

  return doc.output('blob');
}

export async function baixarPdf(ordem: OrdemDeServico): Promise<void> {
  const blob = await gerarPdfBlob(ordem);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `OS_${String(ordem.numero).padStart(4, '0')}_${ordem.nomeCliente.replace(/\s/g, '_')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function imprimirPdf(ordem: OrdemDeServico): Promise<void> {
  const blob = await gerarPdfBlob(ordem);
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank');
  if (janela) {
    janela.addEventListener('load', () => {
      janela.print();
    });
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function secaoTitulo(doc: jsPDF, titulo: string, y: number, cor: string): number {
  // Barra colorida lateral
  doc.setFillColor(cor);
  doc.rect(12, y, 4, 7, 'F');

  // Texto do título
  doc.setTextColor(cor);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 19, y + 5.5);

  // Linha separadora
  doc.setDrawColor('#EEEEEE');
  doc.line(12, y + 10, doc.internal.pageSize.getWidth() - 12, y + 10);

  return y + 14;
}

function linhaInfo(
  doc: jsPDF,
  rotulo: string,
  valor: string,
  y: number,
  largura: number
): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#555555');
  doc.text(rotulo, 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111111');
  const texto = doc.splitTextToSize(valor || '-', largura - 70);
  doc.text(texto, 55, y);
  return y + texto.length * 5 + 2;
}

function getCorStatus(status: string): string {
  switch (status) {
    case 'Aguardando Pagamento': return '#F59E0B';
    case 'Gratuidade':           return '#3B82F6';
    case 'Pago':                 return '#16A34A';
    default:                     return '#6B7280';
  }
}

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
