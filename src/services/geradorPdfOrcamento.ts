import jsPDF from 'jspdf';
import { Orcamento } from '../types';
import { formatarMoeda, formatarData, formatarNumeroOS, formatarCPF, formatarTelefone } from '../utils/formatters';

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
  let nomeEmpresa = 'GCAC Despachante Bélico';
  let responsavel = 'Guilherme Gomes';
  let telefone = '(64) 9.9995-9865';
  let endereco = 'Av. Goias, n 1802, Sala 04 - Bairro Santa Maria - Jatai-GO';

  try {
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa) {
        nomeEmpresa = u.dadosEmpresa.razaoSocialFantasia || u.dadosEmpresa.nome || nomeEmpresa;
        responsavel = u.dadosEmpresa.responsavelNome || responsavel;
        telefone = u.dadosEmpresa.contatoTelefone || telefone;
        endereco = u.dadosEmpresa.endereco || endereco;
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

  // Número ORC e Data
  doc.setFontSize(14);
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  const numRotulo = `ORC-${String(orcamento.numero).padStart(4, '0')}`;
  doc.text(numRotulo, largura - 12, 35, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#AAAAAA');
  doc.text('Emitido em: ' + formatarData(orcamento.criadoEm), largura - 12, 40, { align: 'right' });

  // Badge de Propósito
  doc.setFillColor('#444444');
  doc.roundedRect(46, 33, 50, 8, 1.5, 1.5, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO DE SERVIÇO', 71, 38.5, { align: 'center' });


  y = 50;

  // ── Dados do Cliente ─────────────────────────────────────────────────────
  y = secaoTitulo(doc, 'DADOS DO CLIENTE', y, VERDE);
  y += 2;

  y = linhaInfo(doc, 'Nome Completo:', orcamento.nomeCliente, y, largura);
  y = linhaInfo(doc, 'Endereço:', orcamento.endereco || 'NÃO INFORMADO', y, largura);
  if (orcamento.cpf) y = linhaInfo(doc, 'CPF:', formatarCPF(orcamento.cpf), y, largura);
  y = linhaInfo(doc, 'Contato:', formatarTelefone(orcamento.contato), y, largura);

  y += 4;

  // ── Descrição dos Serviços (Múltiplos) ───────────────────────────────────
  y = secaoTitulo(doc, 'DESCRIÇÃO DOS SERVIÇOS E VALORES', y, VERDE);
  y += 2;

  const arrayServicos = (orcamento.servicos && orcamento.servicos.length > 0)
    ? orcamento.servicos
    : [];

  if (arrayServicos.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(CINZA);
    doc.text('Nenhum serviço informado.', 14, y + 2);
    y += 10;
  } else {
    arrayServicos.forEach((serv) => {
      const nomeFormatado = serv.nome.toUpperCase();
      
      // Configura fonte para o nome
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      
      // Quebra o nome em linhas se for muito longo (largura - 75 para dar espaço generoso ao valor)
      const linhasNome = doc.splitTextToSize(nomeFormatado, largura - 75);
      const alturaNome = linhasNome.length * 5;

      // Calcula linhas do detalhe
      doc.setFontSize(9.5);
      const linhasDetalhe = serv.detalhes ? doc.splitTextToSize(serv.detalhes, largura - 34) : [];
      let alturaBloco = 8 + alturaNome + (linhasDetalhe.length * 4.5);
      
      // Ajusta se bloco ficar pequeno 
      if (alturaBloco < 11) alturaBloco = 11;

      // Quebra de página se não couber o bloco inteiro
      if (y + alturaBloco > 275) {
        doc.addPage();
        y = 15;
      }

      // Card do serviço
      doc.setFillColor('#F8F9FA');
      doc.setDrawColor(LINHA);
      doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'F');
      doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'S');

      // Nome do Serviço 
      doc.setTextColor(ESCURO);
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text(linhasNome, 17, y + 6);

      // Valor à direita do bloco (alinhado com a primeira linha do nome)
      doc.setTextColor(VERDE);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatarMoeda(serv.valor), largura - 16, y + 6, { align: 'right' });

      // Detalhes
      if (serv.detalhes && serv.detalhes.trim()) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#444444');
        doc.text(linhasDetalhe, 17, y + 6 + alturaNome);
      }
      
      y += alturaBloco + 2; // espaçamento de um card pro outro
    });
  }

  y += 2;

  // ── Aviso de Renovação CRAF (Condicional) ────────────────────────────────
  const temRenovacaoCRAF = orcamento.servicos.some(s => s.nome.toUpperCase().includes('RENOVAÇÃO DE CRAF'));
  if (temRenovacaoCRAF) {
    if (y + 35 > 275) {
      doc.addPage();
      y = 15;
    }
    
    doc.setFillColor('#FFFBEB');
    doc.setDrawColor('#F59E0B');
    doc.roundedRect(12, y, largura - 24, 30, 2, 2, 'FD');
    
    doc.setTextColor('#B45309');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('AVISO DE EXIGÊNCIAS PARA RENOVAÇÃO DE CRAF', 17, y + 6);
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const msgRenovacao = [
      '• Tiro Desportivo (Nível 1): 8 habitualidades/tipo de arma nos ciclos 27/12/23 a 27/12/24 e 8 habitualidades de 27/12/24 a 27/12/25.',
      '• Caça: Comprovar 18 meses de SIMAF/IBAMA ativos.',
      '(Base Legal: Decreto 11.615/23, arts. 35 e 37; Portaria 166-COLOG/23, arts. 12, 16 e 17).'
    ];
    
    doc.text(msgRenovacao[0], 17, y + 12);
    doc.text(msgRenovacao[1], 17, y + 17);
    doc.setFontSize(6.5);
    doc.setTextColor('#D97706');
    doc.text(msgRenovacao[2], 17, y + 24);
    
    y += 36;
  }

  // ── Resumo Geral ─────────────────────────────────────────────────────────
  // Verifica se cabe o bloco de resumo (aproximadamente 45mm de altura necessária)
  if (y + 45 > 270) {
    doc.addPage();
    y = 15;
  }

  y = secaoTitulo(doc, 'RESUMO GERAL', y, VERDE);
  y += 2;

  // Detalhamento de valores
  const honorarios = orcamento.servicos.filter(s => s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0);
  const laudos = orcamento.servicos.filter(s => s.categoria === 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0);

  // Caixa valor total (aumentada para caber o detalhamento)
  doc.setFillColor('#EDF7ED');
  const cxY = y;
  const cxAltura = 28; // Aumentado de 26 para 28
  doc.roundedRect(largura - 75, cxY, 63, cxAltura, 2, 2, 'F');
  doc.setDrawColor(VERDE);
  doc.setLineWidth(0.5);
  doc.roundedRect(largura - 75, cxY, 63, cxAltura, 2, 2, 'S');
  doc.setLineWidth(0.1); 
  
  doc.setTextColor(CINZA);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(`HONORÁRIOS: ${formatarMoeda(honorarios)}`, largura - 43.5, cxY + 5, { align: 'center' });
  doc.text(`LAUDOS/EXTERNOS: ${formatarMoeda(laudos)}`, largura - 43.5, cxY + 9, { align: 'center' });
  
  doc.setDrawColor('#CCE6CC');
  doc.line(largura - 70, cxY + 11, largura - 17, cxY + 11);

  doc.setTextColor(CINZA);
  doc.setFontSize(8);
  doc.text('TOTAL PREVISTO', largura - 43.5, cxY + 16, { align: 'center' });
  doc.setTextColor('#16A34A');
  doc.setFontSize(15);
  const totalGeral = orcamento.servicos.reduce((acc, s) => acc + (s.valor || 0), 0);
  doc.text(formatarMoeda(totalGeral), largura - 43.5, cxY + 23, { align: 'center' });

  y += cxAltura + 6;

  // ── Observações ──────────────────────────────────────────────────────────
  if (orcamento.observacoes && orcamento.observacoes.trim()) {
    y = secaoTitulo(doc, 'OBSERVAÇÕES E CONDIÇÕES', y, CINZA);
    y += 2;
    doc.setTextColor('#333333');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    const linhasObs = doc.splitTextToSize(orcamento.observacoes, largura - 34);
    doc.text(linhasObs, 17, y);
    y += linhasObs.length * 5.5 + 5;
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
  doc.text(`${nomeEmpresa} — Orçamento gerado eletronicamente`, largura / 2, altura - 8, { align: 'center' });
  const emitidoPor = orcamento.criadoPorNome ? `Emitido por: ${orcamento.criadoPorNome} | ` : '';
  doc.text(emitidoPor + 'Gerado em: ' + new Date().toLocaleString('pt-BR'), largura / 2, altura - 4, { align: 'center' });

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
  doc.rect(12, y, 4, 7, 'F');
  doc.setTextColor(cor);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 19, y + 5.5);
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

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
