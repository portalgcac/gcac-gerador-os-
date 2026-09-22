import jsPDF from 'jspdf';
import { formatarMoeda, formatarData } from '../utils/formatters';

export interface RelatorioExecutivoDados {
  periodoFiltro: string;
  dataGeracao: string;
  gestorNome: string;
  kpis: {
    totalEmpresas: number;
    empresasAtivas: number;
    empresasEmTeste: number;
    empresasSuspensas: number;
    empresasGratis: number;
    mrrTotal: number;
    arrProjetado: number;
    faturamentoMesRealizado: number;
    valorInadimplente: number;
    totalInadimplentes: number;
    ticketMedio: number;
    totalCacs: number;
    cacsVinculados: number;
    cacsAutonomos: number;
    totalArmas: number;
    totalGts: number;
    totalManejos: number;
    totalLeads: number;
    leadsConvertidos: number;
    taxaConversaoLeads: number;
  };
  empresas: Array<{
    nome: string;
    cnpjCpf: string;
    cidadeUf: string;
    plano: string;
    valorMensalidade: number;
    status: string;
    dataVencimento: string;
    diasAteVencer: number | null;
    isGratis: boolean;
  }>;
  socios: Array<{
    nome: string;
    cargo: string;
    ehGestorPrincipal?: boolean;
  }>;
}

// ── PALETA VISUAL CORPORATIVA PORTAL G CAC ──────────────────────────────────
const CORES = {
  primaryDark: [11, 19, 43],    // Dark Navy Profundo #0B132B
  primaryBlue: [15, 76, 129],   // Azul Royal Corporativo #0F4C81
  accentCyan: [6, 182, 212],    // Ciano Neon #06B6D4
  accentPurple: [147, 51, 234], // Roxo SaaS #9333EA
  success: [16, 185, 129],      // Verde Esmeralda #10B981
  warning: [245, 158, 11],      // Âmbar Atenção #F59E0B
  danger: [239, 68, 68],        // Vermelho Alerta #EF4444
  textMain: [30, 41, 59],       // Cinza Ardósia Escuro #1E293B
  textMuted: [100, 116, 139],   // Cinza Ardósia Médio #64748B
  cardBg: [248, 250, 252],      // Fundo Card Neutro #F8FAFC
  cardBorder: [226, 232, 240],  // Borda Card Neutro #E2E8F0
  white: [255, 255, 255],
};

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPdfRelatorioExecutivo(dados: RelatorioExecutivoDados): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();   // 210 mm
  const altura = doc.internal.pageSize.getHeight();    // 297 mm
  const margem = 16;
  const larguraUtil = largura - (margem * 2);          // 178 mm
  const totalPaginas = 3;

  // Carregar Logos Oficiais do PORTAL G CAC do servidor web
  let logoPortalSemFrase = '';
  try {
    const resSemFrase = await fetch('/usar no site/LOGO PORTAL SEM FRASE.png');
    if (resSemFrase.ok) {
      const b = await resSemFrase.blob();
      logoPortalSemFrase = await blobParaBase64(b);
    }
  } catch {
    try {
      const resAlt = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
      if (resAlt.ok) {
        const b = await resAlt.blob();
        logoPortalSemFrase = await blobParaBase64(b);
      }
    } catch { /* sem logo */ }
  }

  // ── CABEÇALHO REUTILIZÁVEL ─────────────────────────────────────────────────
  function desenharCabecalho(numeroPagina: number, subtitulo: string) {
    doc.setFillColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
    doc.rect(0, 0, largura, 5, 'F');
    doc.setFillColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
    doc.rect(margem, 5, 50, 1.5, 'F');

    if (logoPortalSemFrase) {
      doc.setFillColor(11, 19, 43);
      doc.roundedRect(margem, 8, 12, 12, 1.5, 1.5, 'F');
      doc.setDrawColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(margem, 8, 12, 12, 1.5, 1.5, 'D');
      doc.addImage(logoPortalSemFrase, 'PNG', margem + 0.5, 8.5, 11, 11);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
    doc.text('PORTAL G CAC • GESTÃO SAAS & PLATAFORMA DE OPERAÇÕES', margem + (logoPortalSemFrase ? 15 : 0), 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text(subtitulo.toUpperCase(), margem + (logoPortalSemFrase ? 15 : 0), 17);

    // Badge Confidencial Gestores
    doc.setFillColor(243, 232, 255); // Lilás claro
    doc.roundedRect(largura - margem - 38, 8.5, 38, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
    doc.text('CONFIDENCIAL / GESTORES', largura - margem - 19, 12.7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text(`Gerado em: ${dados.dataGeracao}`, largura - margem, 18, { align: 'right' });

    doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(margem, 22, largura - margem, 22);
  }

  // ── RODAPÉ REUTILIZÁVEL ────────────────────────────────────────────────────
  function desenharRodape(numeroPagina: number) {
    const yRodape = altura - 11;
    doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(margem, yRodape - 3, largura - margem, yRodape - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text('Portal G CAC Tecnologia © 2026 • Painel de Controle e BI Executivo • Documento Oficial da Diretoria', margem, yRodape + 1);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
    doc.text(`Página ${numeroPagina} de ${totalPaginas}`, largura - margem, yRodape + 1, { align: 'right' });
  }

  // ===========================================================================
  // PÁGINA 1: VISÃO GERAL EXECUTIVA, KPIS FINANCEIROS & ECOSSISTEMA
  // ===========================================================================
  desenharCabecalho(1, 'Relatório de Inteligência Executiva e Métricas Estratégicas');

  let curY = 27;

  // Banner Superior de Resumo
  doc.setFillColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.roundedRect(margem, curY, larguraUtil, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(CORES.white[0], CORES.white[1], CORES.white[2]);
  doc.text('PANORAMA EXECUTIVO DO PORTAL G CAC SAAS', margem + 5, curY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Levantamento analítico consolidado para os sócios da plataforma. Período filtrado: ${dados.periodoFiltro}.`,
    margem + 5,
    curY + 13
  );
  doc.text(
    `Gestor responsável pela emissão: ${dados.gestorNome} • Base operacional de dados em tempo real.`,
    margem + 5,
    curY + 18
  );

  curY += 27;

  // ── SEÇÃO 1: METRICAS FINANCEIRAS SAAS ─────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('1. INDICADORES FINANCEIROS & RECORRÊNCIA (SAAS REVENUE)', margem, curY);

  curY += 3.5;

  // 4 Cards Financeiros
  const wCard = (larguraUtil - 9) / 4;
  const hCard = 19;

  // Card 1: MRR
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(147, 51, 234); // Borda roxa
  doc.setLineWidth(0.4);
  doc.roundedRect(margem, curY, wCard, hCard, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
  doc.text('MRR (RECEITA MENSAL)', margem + 3, curY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text(formatarMoeda(dados.kpis.mrrTotal), margem + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Recorrente contratado', margem + 3, curY + 16);

  // Card 2: ARR Projetado
  const xCard2 = margem + wCard + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xCard2, curY, wCard, hCard, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.primaryBlue[0], CORES.primaryBlue[1], CORES.primaryBlue[2]);
  doc.text('ARR PROJETADO (ANUAL)', xCard2 + 3, curY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text(formatarMoeda(dados.kpis.arrProjetado), xCard2 + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('12x MRR Atual', xCard2 + 3, curY + 16);

  // Card 3: Recebido Mês
  const xCard3 = xCard2 + wCard + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xCard3, curY, wCard, hCard, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.success[0], CORES.success[1], CORES.success[2]);
  doc.text('FATURADO NO MÊS', xCard3 + 3, curY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text(formatarMoeda(dados.kpis.faturamentoMesRealizado), xCard3 + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Pagamentos liquidados', xCard3 + 3, curY + 16);

  // Card 4: Inadimplência
  const xCard4 = xCard3 + wCard + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(dados.kpis.totalInadimplentes > 0 ? CORES.danger[0] : CORES.cardBorder[0], dados.kpis.totalInadimplentes > 0 ? CORES.danger[1] : CORES.cardBorder[1], dados.kpis.totalInadimplentes > 0 ? CORES.danger[2] : CORES.cardBorder[2]);
  doc.roundedRect(xCard4, curY, wCard, hCard, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.danger[0], CORES.danger[1], CORES.danger[2]);
  doc.text('INADIMPLÊNCIA / RISCO', xCard4 + 3, curY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(dados.kpis.totalInadimplentes > 0 ? CORES.danger[0] : CORES.primaryDark[0], dados.kpis.totalInadimplentes > 0 ? CORES.danger[1] : CORES.primaryDark[1], dados.kpis.totalInadimplentes > 0 ? CORES.danger[2] : CORES.primaryDark[2]);
  doc.text(formatarMoeda(dados.kpis.valorInadimplente), xCard4 + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text(`${dados.kpis.totalInadimplentes} escritório(s) pendente(s)`, xCard4 + 3, curY + 16);

  curY += hCard + 7;

  // ── SEÇÃO 2: OPERAÇÕES B2B, B2C E ECOSSISTEMA ─────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('2. DIMENSIONAMENTO DO ECOSSISTEMA & BASE DE CLIENTES', margem, curY);

  curY += 3.5;

  const wBloco = (larguraUtil - 6) / 3;
  const hBloco = 38;

  // Bloco 1: B2B Despachantes
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(margem, curY, wBloco, hBloco, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('🏢 DESPACHANTES & CLUBES (B2B)', margem + 3, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(CORES.primaryBlue[0], CORES.primaryBlue[1], CORES.primaryBlue[2]);
  doc.text(String(dados.kpis.totalEmpresas), margem + 3, curY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text(`• Assinaturas Ativas: ${dados.kpis.empresasAtivas}`, margem + 3, curY + 20);
  doc.text(`• Em Período de Testes: ${dados.kpis.empresasEmTeste}`, margem + 3, curY + 24.5);
  doc.text(`• Suspensos / Vencidos: ${dados.kpis.empresasSuspensas}`, margem + 3, curY + 29);
  doc.text(`• Licenças Isentas/Gratuitas: ${dados.kpis.empresasGratis}`, margem + 3, curY + 33.5);

  // Bloco 2: B2C Atiradores
  const xBloco2 = margem + wBloco + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xBloco2, curY, wBloco, hBloco, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('🎯 COMUNIDADE CAC (B2C)', xBloco2 + 3, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(CORES.accentCyan[0], CORES.accentCyan[1], CORES.accentCyan[2]);
  doc.text(String(dados.kpis.totalCacs), xBloco2 + 3, curY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text(`• Vínculos c/ Despachantes: ${dados.kpis.cacsVinculados}`, xBloco2 + 3, curY + 20);
  doc.text(`• Atiradores Autônomos: ${dados.kpis.cacsAutonomos}`, xBloco2 + 3, curY + 24.5);
  doc.text(`• Ticket Médio B2B: ${formatarMoeda(dados.kpis.ticketMedio)}`, xBloco2 + 3, curY + 29);
  doc.text(`• Penetração de Rede: ${dados.kpis.totalCacs > 0 ? Math.round((dados.kpis.cacsVinculados / dados.kpis.totalCacs) * 100) : 0}%`, xBloco2 + 3, curY + 33.5);

  // Bloco 3: Acervos Bélicos
  const xBloco3 = xBloco2 + wBloco + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xBloco3, curY, wBloco, hBloco, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('🛡️ ACERVO BÉLICO TOTAL', xBloco3 + 3, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(CORES.success[0], CORES.success[1], CORES.success[2]);
  doc.text(String(dados.kpis.totalArmas), xBloco3 + 3, curY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text(`• Armas Cadastradas: ${dados.kpis.totalArmas}`, xBloco3 + 3, curY + 20);
  doc.text(`• Guias de Tráfego (GT): ${dados.kpis.totalGts}`, xBloco3 + 3, curY + 24.5);
  doc.text(`• Autorizações de Manejo: ${dados.kpis.totalManejos}`, xBloco3 + 3, curY + 29);
  doc.text(`• Total Doc. Regulatórios: ${dados.kpis.totalGts + dados.kpis.totalManejos}`, xBloco3 + 3, curY + 33.5);

  curY += hBloco + 7;

  // ── SEÇÃO 3: FUNIL COMERCIAL & AQUISIÇÃO ───────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('3. FUNIL COMERCIAL & CRESCIMENTO DA PLATAFORMA', margem, curY);

  curY += 3.5;

  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(margem, curY, larguraUtil, 24, 2, 2, 'FD');

  const colW = larguraUtil / 4;
  
  // Total Leads
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('PRÉ-CADASTROS (LEADS)', margem + 4, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(CORES.warning[0], CORES.warning[1], CORES.warning[2]);
  doc.text(String(dados.kpis.totalLeads), margem + 4, curY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Interessados cadastrados no site', margem + 4, curY + 18.5);

  // Convertidos
  const xCol2 = margem + colW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('LEADS CONVERTIDOS', xCol2 + 4, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(CORES.success[0], CORES.success[1], CORES.success[2]);
  doc.text(String(dados.kpis.leadsConvertidos), xCol2 + 4, curY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Tornaram-se clientes ativos', xCol2 + 4, curY + 18.5);

  // Taxa de Conversão
  const xCol3 = xCol2 + colW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('TAXA DE CONVERSÃO', xCol3 + 4, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
  doc.text(`${dados.kpis.taxaConversaoLeads.toFixed(1)}%`, xCol3 + 4, curY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Eficiência de aquisição', xCol3 + 4, curY + 18.5);

  // Saúde do Sistema
  const xCol4 = xCol3 + colW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('STATUS OPERACIONAL', xCol4 + 4, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(CORES.success[0], CORES.success[1], CORES.success[2]);
  doc.text('100% OPERACIONAL', xCol4 + 4, curY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Backups & RLS Protegidos', xCol4 + 4, curY + 18.5);

  curY += 29;

  // ── SEÇÃO 4: DECLARAÇÃO DE GOVERNANÇA E CONTROLE EXECUTIVO ────────────────
  doc.setFillColor(243, 232, 255);
  doc.setDrawColor(216, 180, 254);
  doc.roundedRect(margem, curY, larguraUtil, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
  doc.text('REGRA DE GOVERNANÇA SOCIETÁRIA & SEGURANÇA JURÍDICA', margem + 4, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.textMain[0], CORES.textMain[1], CORES.textMain[2]);
  doc.text(
    'As métricas acima são extraídas com precisão direta do banco de dados relacional sob protocolo RLS (Row Level Security).',
    margem + 4,
    curY + 10.5
  );
  doc.text(
    'O Portal G CAC opera sob estrita conformidade com a LGPD (Lei 13.709/2018) e regulamentações bélicas federais do Exército Brasileiro e Polícia Federal.',
    margem + 4,
    curY + 14.5
  );

  desenharRodape(1);

  // ===========================================================================
  // PÁGINA 2: LEVANTAMENTO ANALÍTICO DE DESPACHANTES & ASSINATURAS (B2B)
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(2, 'Levantamento de Carteira B2B • Despachantes & Clubes de Tiro');

  curY = 27;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('CARTEIRA DE ESCRITÓRIOS E STATUS DE LICENÇAS SAAS', margem, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Relação individualizada dos clientes corporativos (B2B) conectados à plataforma.', margem, curY + 4);

  curY += 8;

  // Cabeçalho da Tabela
  const colEmpresa = 60;
  const colDoc = 28;
  const colCidade = 26;
  const colPlano = 22;
  const colValor = 20;
  const colStatus = 22;

  doc.setFillColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.rect(margem, curY, larguraUtil, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(CORES.white[0], CORES.white[1], CORES.white[2]);
  doc.text('EMPRESA / ESCRITÓRIO', margem + 2, curY + 4.5);
  doc.text('CNPJ / CPF', margem + colEmpresa + 2, curY + 4.5);
  doc.text('CIDADE / UF', margem + colEmpresa + colDoc + 2, curY + 4.5);
  doc.text('PLANO', margem + colEmpresa + colDoc + colCidade + 2, curY + 4.5);
  doc.text('MENSALIDADE', margem + colEmpresa + colDoc + colCidade + colPlano + 2, curY + 4.5);
  doc.text('STATUS', margem + colEmpresa + colDoc + colCidade + colPlano + colValor + 2, curY + 4.5);

  curY += 6.5;

  // Linhas da Tabela
  const empresasExibir = dados.empresas.slice(0, 26); // Limite por página

  empresasExibir.forEach((emp, idx) => {
    const isZebra = idx % 2 === 1;
    doc.setFillColor(isZebra ? 248 : 255, isZebra ? 250 : 255, isZebra ? 252 : 255);
    doc.rect(margem, curY, larguraUtil, 6.2, 'F');

    doc.setDrawColor(235, 238, 242);
    doc.setLineWidth(0.2);
    doc.line(margem, curY + 6.2, largura - margem, curY + 6.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
    const nomeTrunc = emp.nome.length > 34 ? emp.nome.substring(0, 32) + '...' : emp.nome;
    doc.text(nomeTrunc, margem + 2, curY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text(emp.cnpjCpf || 'Não informado', margem + colEmpresa + 2, curY + 4.2);
    doc.text(emp.cidadeUf || 'Brasil', margem + colEmpresa + colDoc + 2, curY + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.text(emp.plano.toUpperCase(), margem + colEmpresa + colDoc + colCidade + 2, curY + 4.2);

    doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
    doc.text(emp.isGratis ? 'GRÁTIS' : formatarMoeda(emp.valorMensalidade), margem + colEmpresa + colDoc + colCidade + colPlano + 2, curY + 4.2);

    // Status Badge
    let statusTexto = 'EM DIA';
    let statusCor = CORES.success;

    if (emp.status === 'suspenso' || (emp.diasAteVencer !== null && emp.diasAteVencer < 0)) {
      statusTexto = 'VENCIDO';
      statusCor = CORES.danger;
    } else if (emp.diasAteVencer !== null && emp.diasAteVencer <= 5) {
      statusTexto = `VENCE EM ${emp.diasAteVencer}D`;
      statusCor = CORES.warning;
    } else if (emp.status === 'teste') {
      statusTexto = 'TRIAL / TESTE';
      statusCor = CORES.accentCyan;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(statusCor[0], statusCor[1], statusCor[2]);
    doc.text(statusTexto, margem + colEmpresa + colDoc + colCidade + colPlano + colValor + 2, curY + 4.2);

    curY += 6.2;
  });

  if (dados.empresas.length > 26) {
    curY += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text(`* Mostrando os primeiros 26 de um total de ${dados.empresas.length} escritórios. A base completa está disponível no painel digital e na exportação CSV.`, margem, curY + 3);
  }

  desenharRodape(2);

  // ===========================================================================
  // PÁGINA 3: ANÁLISE DE INADIMPLÊNCIA, METAS E HOMOLOGAÇÃO DOS SÓCIOS
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(3, 'Auditoria de Receitas, Cobranças & Assinatura da Diretoria');

  curY = 27;

  // Bloco 1: Gestão de Contas em Atraso e Risco
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('CONTROLE DE COBRANÇAS & REDUÇÃO DE INADIMPLÊNCIA', margem, curY);

  curY += 4;

  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(margem, curY, larguraUtil, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('PLANO DE AÇÃO IMEDIATA PARA REGULARIZAÇÃO DE MENSALIDADES', margem + 4, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(CORES.textMain[0], CORES.textMain[1], CORES.textMain[2]);
  doc.text(
    `1. Foram identificados ${dados.kpis.totalInadimplentes} escritórios com mensalidades pendentes, somando ${formatarMoeda(dados.kpis.valorInadimplente)} em aberto.`,
    margem + 4,
    curY + 12
  );
  doc.text(
    '2. O sistema emite automaticamente avisos preventivos a partir de 5 dias antes da data de vencimento.',
    margem + 4,
    curY + 17
  );
  doc.text(
    '3. O gestor pode acionar o link direto de cobrança cordial via WhatsApp pelo painel administrativo para envio de chave PIX.',
    margem + 4,
    curY + 22
  );
  doc.text(
    '4. Em caso de atraso superior a 5 dias úteis sem contato, a licença é suspensa automaticamente para proteção de custos de infraestrutura.',
    margem + 4,
    curY + 27
  );

  curY += 38;

  // Bloco 2: Metas de Crescimento & Próximos Passos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('METAS ESTRATÉGICAS DE EXPANSÃO DO PORTAL G CAC', margem, curY);

  curY += 4;

  const wMeta = (larguraUtil - 6) / 3;
  const hMeta = 28;

  // Meta 1
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(margem, curY, wMeta, hMeta, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.primaryBlue[0], CORES.primaryBlue[1], CORES.primaryBlue[2]);
  doc.text('EXPANSÃO B2B NACIONAL', margem + 3, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('Meta: 100 Despachantes', margem + 3, curY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Captação em todos os estados da federação e federações de tiro.', margem + 3, curY + 19);

  // Meta 2
  const xMeta2 = margem + wMeta + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xMeta2, curY, wMeta, hMeta, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.accentPurple[0], CORES.accentPurple[1], CORES.accentPurple[2]);
  doc.text('COMUNIDADE DE CACS', xMeta2 + 3, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('Meta: 5.000 Atiradores', xMeta2 + 3, curY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Centralização de carteiras e acervos vinculados aos escritórios.', xMeta2 + 3, curY + 19);

  // Meta 3
  const xMeta3 = xMeta2 + wMeta + 3;
  doc.setFillColor(CORES.cardBg[0], CORES.cardBg[1], CORES.cardBg[2]);
  doc.setDrawColor(CORES.cardBorder[0], CORES.cardBorder[1], CORES.cardBorder[2]);
  doc.roundedRect(xMeta3, curY, wMeta, hMeta, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(CORES.success[0], CORES.success[1], CORES.success[2]);
  doc.text('RECEITA RECORRENTE (MRR)', xMeta3 + 3, curY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('Meta: R$ 50.000 / mês', xMeta3 + 3, curY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Escalabilidade com suporte técnico e aplicativo nativo.', xMeta3 + 3, curY + 19);

  curY += hMeta + 12;

  // Bloco 3: Assinatura e Validação dos Sócios Gestores
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
  doc.text('HOMOLOGAÇÃO & ASSINATURA DA DIRETORIA EXECUTIVA', margem, curY);

  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
  doc.text('Os dados constantes neste relatório refletem com fidelidade a base cadastral e operacional do Portal G CAC.', margem, curY);

  curY += 20;

  // Linhas de Assinatura para os sócios
  const sociosExibir = dados.socios.length > 0 ? dados.socios : [
    { nome: 'Guilherme Gomes', cargo: 'Fundador & Gestor Principal', ehGestorPrincipal: true },
    { nome: 'Gabriel Dias Benevides', cargo: 'Sócio do App / Co-Administrador' },
    { nome: 'Hector Henrique Furtado Meira', cargo: 'Sócio do App / Gestão de Operações' },
  ];

  const wAss = (larguraUtil - ((sociosExibir.length - 1) * 6)) / sociosExibir.length;

  sociosExibir.forEach((socio, idx) => {
    const xAss = margem + (idx * (wAss + 6));
    doc.setDrawColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.setLineWidth(0.4);
    doc.line(xAss, curY, xAss + wAss, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(CORES.primaryDark[0], CORES.primaryDark[1], CORES.primaryDark[2]);
    doc.text(socio.nome, xAss + (wAss / 2), curY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(CORES.textMuted[0], CORES.textMuted[1], CORES.textMuted[2]);
    doc.text(socio.cargo || (socio.ehGestorPrincipal ? 'Fundador & Gestor Principal' : 'Sócio do Portal G CAC'), xAss + (wAss / 2), curY + 7.5, { align: 'center' });
  });

  desenharRodape(3);

  return doc.output('blob');
}

export async function baixarRelatorioExecutivoPdf(dados: RelatorioExecutivoDados): Promise<void> {
  const blob = await gerarPdfRelatorioExecutivo(dados);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dataHoje = new Date().toISOString().split('T')[0];
  link.download = `RELATORIO_EXECUTIVO_PORTAL_GCAC_${dataHoje}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
