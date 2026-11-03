import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { formatarData } from '../utils/formatters';

// Cores GCAC
const AZUL   = '#1B6FBF';
const VERDE  = '#6DBE45';
const ESCURO = '#0D0D0D';
const CINZA  = '#555555';
const LINHA  = '#DDDDDD';

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

function linhaInfo(doc: jsPDF, rotulo: string, valor: string, y: number, largura: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#555555');
  doc.text(rotulo, 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111111');
  const texto = doc.splitTextToSize(valor || '-', largura - 60);
  doc.text(texto, 55, y);
  return y + texto.length * 5 + 2;
}

export async function exportarAcervoPdf(perfil: any, armas: any[], manejos: any[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

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
      let logoRes = await fetch('/logo_oficial_documentos.png');
      if (!logoRes.ok) {
        logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
      }
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
      doc.addImage(logoBase64, format, 12, 4, 34, 34);
    }
  } catch { /* logo nao disponivel */ }

  // Dados da empresa
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Portal G CAC — Acervo do Atirador', 48, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#CCCCCC');
  doc.text('Relatório Consolidado de Documentos e Validades', 48, 20);
  doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 48, 25);

  doc.setDrawColor('#333333');
  doc.line(48, 30, largura - 12, 30);

  y = 48;

  // ── Dados Pessoais e CR ──
  y = secaoTitulo(doc, 'DADOS DO ATIRADOR e CR', y, AZUL);
  y += 2;

  y = linhaInfo(doc, 'Nome Completo:', perfil.nome, y, largura);
  y = linhaInfo(doc, 'CPF:', perfil.cpf || 'NÃO INFORMADO', y, largura);
  y = linhaInfo(doc, 'Contato:', perfil.contato || 'NÃO INFORMADO', y, largura);
  
  // Obter Atividades do CR
  const atividades: string[] = [];
  if (perfil.crTiroDesportivo) atividades.push('TIRO DESPORTIVO');
  if (perfil.crCaca) atividades.push('CAÇA');
  if (perfil.crColecionamento) atividades.push('COLECIONAMENTO');
  const atividadesStr = atividades.join(', ') || 'NÃO ESPECIFICADA';

  y = linhaInfo(doc, 'CR Exército / PF:', perfil.cr ? `${perfil.cr} (Validade: ${formatarData(perfil.vencimentoCr)})` : 'NÃO INFORMADO', y, largura);
  y = linhaInfo(doc, 'Atividades do CR:', atividadesStr, y, largura);
  y = linhaInfo(doc, 'CR IBAMA:', perfil.crIbama ? `${perfil.crIbama} (Validade: ${formatarData(perfil.vencimentoCrIbama)})` : 'NÃO INFORMADO', y, largura);
  if (perfil.endereco) {
    y = linhaInfo(doc, 'Endereço:', perfil.endereco, y, largura);
  }

  y += 6;

    // ── Seção Armas & CRAFs Divididas por Acervo ──
  const categorizarAcervoPdf = (acervo?: string) => {
    if (!acervo) return 'outros';
    const a = acervo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (a.includes('caca')) return 'caca';
    if (a.includes('tiro')) return 'tiro';
    if (a.includes('colec')) return 'colecao';
    return 'outros';
  };

  const gruposArmas: { titulo: string; armas: any[]; cor: string }[] = [];
  const armasTiro = armas.filter(a => categorizarAcervoPdf(a.acervo) === 'tiro');
  const armasCaca = armas.filter(a => categorizarAcervoPdf(a.acervo) === 'caca');
  const armasColecao = armas.filter(a => categorizarAcervoPdf(a.acervo) === 'colecao');
  const armasOutras = armas.filter(a => categorizarAcervoPdf(a.acervo) === 'outros');

  if (armasTiro.length > 0) gruposArmas.push({ titulo: `ACERVO DE TIRO DESPORTIVO (${armasTiro.length} ARMA${armasTiro.length > 1 ? 'S' : ''})`, armas: armasTiro, cor: AZUL });
  if (armasCaca.length > 0) gruposArmas.push({ titulo: `ACERVO DE CAÇA (${armasCaca.length} ARMA${armasCaca.length > 1 ? 'S' : ''})`, armas: armasCaca, cor: '#B45309' });
  if (armasColecao.length > 0) gruposArmas.push({ titulo: `ACERVO DE COLEÇÃO (${armasColecao.length} ARMA${armasColecao.length > 1 ? 'S' : ''})`, armas: armasColecao, cor: '#6B21A8' });
  if (armasOutras.length > 0) gruposArmas.push({ titulo: `DEMAIS ARMAS (${armasOutras.length})`, armas: armasOutras, cor: CINZA });

  y = secaoTitulo(doc, `ARMAS & CRAFs CADASTRADAS (${armas.length} TOTAL)`, y, AZUL);
  y += 2;

  if (armas.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor('#777777');
    doc.text('Nenhuma arma cadastrada no acervo.', 14, y);
    y += 8;
  } else {
    let indiceGlobal = 1;
    gruposArmas.forEach(grupo => {
      if (y + 16 > 270) {
        doc.addPage();
        y = 20;
      }

      // Subcabeçalho do Grupo
      doc.setFillColor('#F0F4F8');
      doc.setDrawColor(grupo.cor);
      doc.roundedRect(12, y, largura - 24, 7, 1.5, 1.5, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grupo.cor);
      doc.text(grupo.titulo, 16, y + 5);
      y += 10;

      grupo.armas.forEach((arma: any) => {
        const gtsCount = arma.gts?.length || 0;
        const alturaBloco = 26 + (gtsCount * 10) + (gtsCount > 0 ? 6 : 0);

        if (y + alturaBloco > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor('#F8F9FA');
        doc.setDrawColor(LINHA);
        doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'F');
        doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'S');

        // Nome da Arma com tag do Acervo
        doc.setTextColor(ESCURO);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${indiceGlobal++}. ${arma.tipo || 'ARMA'} ${arma.modelo} • ${arma.calibre}`, 16, y + 6);

        // Detalhes da arma
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#555555');
        doc.text(`Fabricante: ${arma.fabricante || 'N/I'}  |  Série: ${arma.numeroSerie || 'N/I'}  |  SIGMA: ${arma.numeroSigma || 'N/I'}  |  Acervo: ${arma.acervo}`, 16, y + 12);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(grupo.cor);
        doc.text(`Validade do CRAF: ${formatarData(arma.vencimentoCraf)}`, 16, y + 18);

        let subY = y + 22;

        // Guias de Tráfego
        if (gtsCount > 0) {
          doc.setDrawColor('#E5E7EB');
          doc.line(16, subY, largura - 16, subY);
          subY += 4;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(CINZA);
          doc.text('GUIAS DE TRÁFEGO (GTs) ATIVAS:', 16, subY);
          subY += 4;

          arma.gts.forEach((gt: any) => {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(ESCURO);
            doc.text(`• GT ${gt.tipo} - Vencimento: ${formatarData(gt.vencimento)} - Destino: ${gt.destino}`, 18, subY);
            subY += 5;
          });
        }

        y += alturaBloco + 4;
      });

      y += 2;
    });
  }

  // ── Seção Manejo IBAMA ──
  if (manejos.length > 0) {
    if (y + 30 > 270) {
      doc.addPage();
      y = 20;
    }

    y = secaoTitulo(doc, 'AUTORIZAÇÕES DE MANEJO (SIMAF)', y, VERDE);
    y += 2;

    manejos.forEach((m, index) => {
      const fazendaNome = m.fazenda || m.nomeFazenda || '';
      const carNum = m.car || m.numeroCar || '';
      const propNome = m.proprietario || m.nomeProprietario || '';

      const carText = `CAR: ${carNum}`;
      const propText = `Proprietário: ${propNome}  |  Status: ${m.status}`;
      const validadeText = `Validade da Autorização: ${formatarData(m.vencimento)}`;

      const maxTextoLargura = largura - 32;
      const carLines = doc.splitTextToSize(carText, maxTextoLargura);
      const propLines = doc.splitTextToSize(propText, maxTextoLargura);

      // Altura base calculada dinamicamente: 9 + (carLines * 3.5) + (propLines * 3.5) + 2 de padding inferior
      const alturaBloco = 9 + (carLines.length * 3.5) + (propLines.length * 3.5) + 2;

      if (y + alturaBloco > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor('#F3FBF2');
      doc.setDrawColor('#D1E7DD');
      doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'F');
      doc.roundedRect(12, y, largura - 24, alturaBloco, 2, 2, 'S');

      doc.setTextColor(ESCURO);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      
      // Linha 1: Fazenda
      doc.text(`${index + 1}. Fazenda: ${fazendaNome} • ${m.cidade}`, 16, y + 5);

      // Linha 2: CAR
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#444444');
      
      let currentY = y + 9;
      doc.text(carLines, 16, currentY);
      currentY += (carLines.length * 3.5);

      // Linha 3: Proprietário & Status
      doc.text(propLines, 16, currentY);
      currentY += (propLines.length * 3.5);

      // Linha 4: Validade
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(VERDE);
      doc.text(validadeText, 16, currentY);

      y += alturaBloco + 4;
    });
  }

  // ── Rodapé de todas as páginas ──
  const totalPaginas = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINHA);
    doc.line(12, altura - 18, largura - 12, altura - 18);

    doc.setTextColor(CINZA);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Portal G CAC — Gestão Inteligente de Acervos', 12, altura - 12);
    doc.text(`Página ${i} de ${totalPaginas}`, largura - 12, altura - 12, { align: 'right' });
  }

  // Baixar PDF
  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `acervo_gcac_${perfil.nome.toLowerCase().replace(/\s+/g, '_')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportarAcervoExcel(perfil: any, armas: any[], manejos: any[]): void {
  const wb = XLSX.utils.book_new();

  // 1. Planilha Perfil
  const perfilData = [
    { Campo: 'Nome Completo', Valor: perfil.nome },
    { Campo: 'CPF', Valor: perfil.cpf || 'Não Informado' },
    { Campo: 'Contato', Valor: perfil.contato || 'Não Informado' },
    { Campo: 'CR Exército/PF', Valor: perfil.cr || 'Não Informado' },
    { Campo: 'Vencimento CR', Valor: perfil.vencimentoCr ? formatarData(perfil.vencimentoCr) : 'Não Informado' },
    { Campo: 'CR IBAMA', Valor: perfil.crIbama || 'Não Informado' },
    { Campo: 'Vencimento CR IBAMA', Valor: perfil.vencimentoCrIbama ? formatarData(perfil.vencimentoCrIbama) : 'Não Informado' },
    { Campo: 'Endereço', Valor: perfil.endereco || 'Não Informado' }
  ];
  const wsPerfil = XLSX.utils.json_to_sheet(perfilData);
  XLSX.utils.book_append_sheet(wb, wsPerfil, 'Meu Perfil');

  // 2. Planilha Armas
  const armasData = armas.map((a, idx) => ({
    Índice: idx + 1,
    Tipo: a.tipo || 'Arma',
    Modelo: a.modelo || '',
    Calibre: a.calibre || '',
    Fabricante: a.fabricante || '',
    'Nº de Série': a.numeroSerie || '',
    'Nº SIGMA': a.numeroSigma || '',
    Acervo: a.acervo || '',
    'Vencimento CRAF': a.vencimentoCraf ? formatarData(a.vencimentoCraf) : ''
  }));
  const wsArmas = XLSX.utils.json_to_sheet(armasData);
  XLSX.utils.book_append_sheet(wb, wsArmas, 'Armas & CRAFs');

  // 3. Planilha Guias de Tráfego (GTs)
  const gtsData = armas.flatMap((a) => (a.gts || []).map((g: any) => ({
    'Arma Modelo': a.modelo || '',
    'Arma Série': a.numeroSerie || '',
    'Tipo de Guia': g.tipo || '',
    Vencimento: g.vencimento ? formatarData(g.vencimento) : '',
    Destino: g.destino || ''
  })));
  if (gtsData.length > 0) {
    const wsGts = XLSX.utils.json_to_sheet(gtsData);
    XLSX.utils.book_append_sheet(wb, wsGts, 'Guias de Tráfego');
  }

  // 4. Planilha Manejos
  if (manejos.length > 0) {
    const manejosData = manejos.map((m, idx) => ({
      Índice: idx + 1,
      Fazenda: m.fazenda || m.nomeFazenda || '',
      CAR: m.car || m.numeroCar || '',
      Proprietário: m.proprietario || m.nomeProprietario || '',
      Cidade: m.cidade || '',
      Vencimento: m.vencimento ? formatarData(m.vencimento) : '',
      Status: m.status || ''
    }));
    const wsManejos = XLSX.utils.json_to_sheet(manejosData);
    XLSX.utils.book_append_sheet(wb, wsManejos, 'SIMAF Manejo');
  }

  // Salvar Excel
  XLSX.writeFile(wb, `acervo_gcac_${perfil.nome.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
}
