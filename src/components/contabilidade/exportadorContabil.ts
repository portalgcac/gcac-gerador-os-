import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarMoeda } from '../../utils/formatters';
import { OrdemDeServico, Recibo, FechamentoColaborador } from '../../types';
import { Despesa } from '../../context/FinanceiroContext';

interface ExportarContabilParams {
  empresaNome: string;
  cnpjEmpresa: string;
  mesAnoTexto: string;
  mesReferencia: Date;
  ordensPeriodo: OrdemDeServico[];
  despesasPeriodo: Despesa[];
  fechamentosPeriodo: FechamentoColaborador[];
  recibosPeriodo: Recibo[];
  dre: {
    receitaBruta: number;
    taxasGru: number;
    receitaLiquida: number;
    custosDiretos: number;
    margemBruta: number;
    despesasOperacionais: number;
    folhaPrestadoresPJ: number;
    proLabore: number;
    impostosPagos: number;
    lucroLiquido: number;
  };
  meiosPagamento: Record<string, { total: number; qtd: number }>;
}

export function exportarPlanilhaContabilCompleta(params: ExportarContabilParams) {
  const {
    empresaNome,
    cnpjEmpresa,
    mesAnoTexto,
    ordensPeriodo,
    despesasPeriodo,
    fechamentosPeriodo,
    recibosPeriodo,
    dre,
    meiosPagamento
  } = params;

  const workbook = XLSX.utils.book_new();

  // ── ABA 1: DRE & Resumo Contábil ──────────────────────────────────────────
  const dadosDRE = [
    ['DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL & CONTÁBIL)'],
    ['Empresa:', empresaNome, 'CNPJ:', cnpjEmpresa || 'Não informado'],
    ['Competência / Período:', mesAnoTexto, 'Gerado em:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [''],
    ['ESTRUTURA CONTÁBIL', 'VALOR (R$)', '% SOBRE FATURAMENTO'],
    ['(+) RECEITA BRUTA TOTAL', dre.receitaBruta, '100,0%'],
    ['(-) Taxas Federais / GRU Reembolsáveis (PF / Exército / Terceiros)', -dre.taxasGru, dre.receitaBruta > 0 ? `${((-dre.taxasGru / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(=) RECEITA OPERACIONAL LÍQUIDA (BASE CONTÁBIL)', dre.receitaLiquida, dre.receitaBruta > 0 ? `${((dre.receitaLiquida / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(-) Custos Diretos com Serviços e Laudos de Terceiros', -dre.custosDiretos, dre.receitaBruta > 0 ? `${((-dre.custosDiretos / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(=) MARGEM OPERACIONAL BRUTA', dre.margemBruta, dre.receitaBruta > 0 ? `${((dre.margemBruta / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(-) Despesas Operacionais e Administrativas (Sistemas, Internet, Insumos)', -dre.despesasOperacionais, dre.receitaBruta > 0 ? `${((-dre.despesasOperacionais / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(-) Pagamentos a Colaboradores / Prestadores de Serviço (com NF)', -dre.folhaPrestadoresPJ, dre.receitaBruta > 0 ? `${((-dre.folhaPrestadoresPJ / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(-) Retiradas de Pró-labore dos Sócios', -dre.proLabore, dre.receitaBruta > 0 ? `${((-dre.proLabore / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(-) Impostos e Tributos Pagos (DAS-MEI / Taxas Municipais)', -dre.impostosPagos, dre.receitaBruta > 0 ? `${((-dre.impostosPagos / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    ['(=) RESULTADO LÍQUIDO DO PERÍODO (LUCRO / PREJUÍZO CONTÁBIL)', dre.lucroLiquido, dre.receitaBruta > 0 ? `${((dre.lucroLiquido / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
    [''],
    ['NOTAS EXPLICATIVAS PARA A CONTABILIDADE:'],
    ['1. As Taxas Federais (GRUs) referem-se a custas recolhidas em favor de órgãos federais (Polícia Federal, DFPC/Exército, IBAMA) e não constituem receita da pessoa jurídica.'],
    ['2. Para fins de apuração de MEI ou Simples Nacional, a base de cálculo recomendada corresponde à Receita Operacional Líquida de honorários de despachante.']
  ];

  const wsDRE = XLSX.utils.aoa_to_sheet(dadosDRE);
  wsDRE['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, wsDRE, 'DRE Resumo Fiscal');

  // ── ABA 2: Entradas & Serviços (Ordens de Serviço) ─────────────────────────
  const cabecalhoOrdens = [
    'Nº OS',
    'Data Emissão',
    'Nome do Cliente / Tomador',
    'CPF / CNPJ Tomador',
    'Serviços Prestados',
    'Forma de Pagamento',
    'Valor Total Cobrado (R$)',
    'Taxa GRU Reembolsável (R$)',
    'Valor Líquido Honorários (R$)',
    'Status OS',
    'Canal de Atendimento'
  ];

  const linhasOrdens = ordensPeriodo.map(os => {
    const nomesServicos = (os.servicos || []).map(s => s.nome).join(' | ');
    const taxaGru = Number(os.taxaPFTotal) || (os.servicos || []).reduce((acc, s) => acc + (Number(s.taxaPF) || 0), 0);
    const valorCobrado = Number(os.valorPago || os.valor || 0);
    const liquido = Math.max(0, valorCobrado - taxaGru);

    return [
      `OS-${String(os.numero).padStart(4, '0')}`,
      os.criadoEm ? format(parseISO(os.criadoEm), 'dd/MM/yyyy') : '',
      os.nomeCliente || '',
      os.cpf || '',
      nomesServicos || 'Prestação de Serviços Despachante',
      os.formaPagamento || 'Não especificado',
      valorCobrado,
      taxaGru,
      liquido,
      os.status || '',
      os.canalAtendimento || ''
    ];
  });

  const wsOrdens = XLSX.utils.aoa_to_sheet([cabecalhoOrdens, ...linhasOrdens]);
  wsOrdens['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 32 }, { wch: 18 },
    { wch: 45 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
    { wch: 25 }, { wch: 18 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(workbook, wsOrdens, 'Receitas e Serviços');

  // ── ABA 3: Conciliação por Meio de Pagamento (Fisco / DIMP) ────────────────
  const cabecalhoMeios = ['Meio de Pagamento / Operadora', 'Quantidade de Transações', 'Valor Total Movimentado (R$)', '% do Giro'];
  const linhasMeios = Object.entries(meiosPagamento).map(([meio, dados]) => [
    meio,
    dados.qtd,
    dados.total,
    dre.receitaBruta > 0 ? `${((dados.total / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'
  ]);

  const wsMeios = XLSX.utils.aoa_to_sheet([
    ['CONCILIAÇÃO DE MEIOS DE PAGAMENTO (ALINHAMENTO COM DIMP / DECLARAÇÕES BANCÁRIAS)'],
    ['Atenção: Estes valores devem coincidir com os relatórios fornecidos pelas maquininhas Stone, Infinity e extrato de PIX PJ.'],
    [''],
    cabecalhoMeios,
    ...linhasMeios
  ]);
  wsMeios['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 28 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, wsMeios, 'Conciliação Meios Pgto');

  // ── ABA 4: Despesas e Insumos ──────────────────────────────────────────────
  const cabecalhoDespesas = ['Data', 'Categoria Contábil', 'Descrição da Despesa', 'Valor (R$)', 'Nº Nota Fiscal', 'Prestador / Favorecido', 'Comprovante'];
  const linhasDespesas = despesasPeriodo.map(d => [
    d.data ? format(parseISO(d.data), 'dd/MM/yyyy') : '',
    d.categoria || 'Geral',
    d.descricao || '',
    Number(d.valor || 0),
    d.numeroNf || 'Sem NF',
    d.colaboradorNome || 'Fornecedor Diverso',
    d.notaFiscalUrl ? 'Anexado' : 'Não anexado'
  ]);

  const wsDespesas = XLSX.utils.aoa_to_sheet([cabecalhoDespesas, ...linhasDespesas]);
  wsDespesas['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, wsDespesas, 'Despesas e Insumos');

  // ── ABA 5: Prestadores PJ e Folha ─────────────────────────────────────────
  const cabecalhoColab = ['Colaborador / Prestador', 'Cargo / Função', 'Período de Apuração', 'Valor Base (R$)', 'Comissões OS (R$)', 'Líquido Pago (R$)', 'Nº NF Emitida', 'Status'];
  const linhasColab = fechamentosPeriodo.map(f => [
    f.colaboradorNome || '',
    'Prestador de Serviço PJ',
    `${format(parseISO(f.dataInicioPeriodo), 'dd/MM')} a ${format(parseISO(f.dataFimPeriodo), 'dd/MM/yyyy')}`,
    Number(f.valorBaseProporcional || 0),
    Number(f.valorComissoesOs || 0),
    Number(f.valorLiquidoFinal || 0),
    f.numeroNf || 'Pendente',
    f.status === 'pago' ? 'Pago' : f.status
  ]);

  const wsColab = XLSX.utils.aoa_to_sheet([cabecalhoColab, ...linhasColab]);
  wsColab['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, wsColab, 'Prestadores PJ (NFs)');

  // ── ABA 6: Extrato de Taxas Públicas (GRUs) ────────────────────────────────
  const cabecalhoGru = ['Nº OS', 'Data', 'Nome do Contribuinte', 'CPF', 'Valor Taxa GRU (R$)', 'Status Taxa'];
  const linhasGru: any[] = [];
  ordensPeriodo.forEach(os => {
    const taxa = Number(os.taxaPFTotal) || (os.servicos || []).reduce((acc, s) => acc + (Number(s.taxaPF) || 0), 0);
    if (taxa > 0) {
      linhasGru.push([
        `OS-${String(os.numero).padStart(4, '0')}`,
        os.criadoEm ? format(parseISO(os.criadoEm), 'dd/MM/yyyy') : '',
        os.nomeCliente || '',
        os.cpf || '',
        taxa,
        os.status === 'Pago' ? 'Taxa Recolhida' : 'Aguardando Pagamento'
      ]);
    }
  });

  const wsGru = XLSX.utils.aoa_to_sheet([cabecalhoGru, ...linhasGru]);
  wsGru['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 18 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, wsGru, 'Taxas Públicas (GRUs)');

  // Salvar o arquivo
  const nomeSanitizado = (empresaNome || 'Empresa').replace(/[^a-zA-Z0-9]/g, '_');
  const dataRefStr = format(params.mesReferencia, 'yyyy_MM');
  const nomeArquivo = `Contabilidade_GCAC_${nomeSanitizado}_${dataRefStr}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
}

// ── EXPORTAÇÃO OFICIAL MEI: ANEXO X (CGSN nº 140/2018) ──────────────────────
export function exportarRelatorioOficialMEIPdf(params: {
  empresaNome: string;
  cnpjEmpresa: string;
  mesAnoTexto: string;
  mesReferencia: Date;
  receitaComercioSemNF: number;
  receitaComercioComNF: number;
  receitaIndustriaSemNF: number;
  receitaIndustriaComNF: number;
  receitaServicosSemNF: number;
  receitaServicosComNF: number;
  taxasGruDeducoes: number;
  acumuladoAno: number;
  limiteMEI: number;
}) {
  const {
    empresaNome,
    cnpjEmpresa,
    mesAnoTexto,
    receitaComercioSemNF,
    receitaComercioComNF,
    receitaIndustriaSemNF,
    receitaIndustriaComNF,
    receitaServicosSemNF,
    receitaServicosComNF,
    taxasGruDeducoes,
    acumuladoAno,
    limiteMEI
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const totalComercio = receitaComercioSemNF + receitaComercioComNF;
  const totalIndustria = receitaIndustriaSemNF + receitaIndustriaComNF;
  const totalServicos = receitaServicosSemNF + receitaServicosComNF;
  const totalMes = totalComercio + totalIndustria + totalServicos;

  // Cabeçalho Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RELATÓRIO MENSAL DAS RECEITAS BRUTAS', 105, 18, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('(Anexo X da Resolução CGSN nº 140, de 2018)', 105, 23, { align: 'center' });

  // Borda externa
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.rect(14, 27, 182, 245);

  // Identificação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CNPJ:', 18, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(cnpjEmpresa || 'Não informado / Em cadastro', 32, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('Empreendedor Individual:', 18, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(empresaNome || 'Portal G CAC Despachantaria Bélica', 65, 41);

  doc.setFont('helvetica', 'bold');
  doc.text('Período de Apuração (Mês/Ano):', 18, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(mesAnoTexto.toUpperCase(), 75, 48);

  doc.line(14, 52, 196, 52);

  // Título da Tabela
  let y = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RECEITA BRUTA MENSAL — REVENDA DE MERCADORIAS (COMÉRCIO)', 18, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('I - Revenda de mercadorias com dispensa de emissão de documento fiscal', 20, y);
  doc.text(formatarMoeda(receitaComercioSemNF), 190, y, { align: 'right' });
  y += 5;

  doc.text('II - Revenda de mercadorias com documento fiscal emitido', 20, y);
  doc.text(formatarMoeda(receitaComercioComNF), 190, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('III - Total das receitas com revenda de mercadorias (I + II)', 20, y);
  doc.text(formatarMoeda(totalComercio), 190, y, { align: 'right' });
  y += 8;

  doc.line(14, y, 196, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RECEITA BRUTA MENSAL — VENDA DE PRODUTOS INDUSTRIALIZADOS (INDÚSTRIA)', 18, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('IV - Venda de produtos industrializados com dispensa de emissão de documento fiscal', 20, y);
  doc.text(formatarMoeda(receitaIndustriaSemNF), 190, y, { align: 'right' });
  y += 5;

  doc.text('V - Venda de produtos industrializados com documento fiscal emitido', 20, y);
  doc.text(formatarMoeda(receitaIndustriaComNF), 190, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('VI - Total das receitas com venda de produtos industrializados (IV + V)', 20, y);
  doc.text(formatarMoeda(totalIndustria), 190, y, { align: 'right' });
  y += 8;

  doc.line(14, y, 196, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RECEITA BRUTA MENSAL — PRESTAÇÃO DE SERVIÇOS', 18, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('VII - Receita com prestação de serviços com dispensa de emissão de documento fiscal', 20, y);
  doc.text(formatarMoeda(receitaServicosSemNF), 190, y, { align: 'right' });
  y += 5;

  doc.text('VIII - Receita com prestação de serviços com documento fiscal emitido', 20, y);
  doc.text(formatarMoeda(receitaServicosComNF), 190, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('IX - Total das receitas com prestação de serviços (VII + VIII)', 20, y);
  doc.text(formatarMoeda(totalServicos), 190, y, { align: 'right' });
  y += 8;

  doc.line(14, y, 196, y);
  y += 7;

  // TOTAL GERAL DO MÊS
  doc.setFillColor(240, 245, 250);
  doc.rect(14.5, y - 4, 181, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('X - TOTAL GERAL DAS RECEITAS BRUTAS NO MÊS (III + VI + IX)', 18, y + 2);
  doc.text(formatarMoeda(totalMes), 190, y + 2, { align: 'right' });
  y += 14;

  // Quadro de Notas Explicativas e Fiscal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DEMONSTRATIVO DE REEMBOLSOS & LIMITES LEGAIS DO MEI:', 18, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`• Taxas Federais (GRUs) recolhidas de terceiros no mês: ${formatarMoeda(taxasGruDeducoes)} (não compõem faturamento)`, 20, y);
  y += 4.5;
  doc.text(`• Faturamento acumulado no ano fiscal até este mês: ${formatarMoeda(acumuladoAno)}`, 20, y);
  y += 4.5;
  const saldoMEI = Math.max(0, limiteMEI - acumuladoAno);
  doc.text(`• Limite anual vigente do MEI: ${formatarMoeda(limiteMEI)} | Saldo anual disponível: ${formatarMoeda(saldoMEI)}`, 20, y);
  y += 4.5;
  doc.text('• Comprovantes fiscais e recibos de compras do mês devem ser arquivados anexos a este relatório pelo prazo de 5 anos.', 20, y);
  y += 14;

  // Campos de Assinatura
  doc.line(18, y + 16, 95, y + 16);
  doc.line(115, y + 16, 192, y + 16);

  doc.setFontSize(8);
  doc.text('Local e Data', 56, y + 21, { align: 'center' });
  doc.text('Assinatura do Titular / MEI', 56, y + 25, { align: 'center' });

  doc.text('Contador Responsável / Visto', 153, y + 21, { align: 'center' });
  doc.text('CRC / Identificação Profissional', 153, y + 25, { align: 'center' });

  // Rodapé com data de emissão eletrônica
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Documento emitido eletronicamente pelo Portal G CAC em ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 105, 267, { align: 'center' });

  const nomeSanitizado = (empresaNome || 'MEI').replace(/[^a-zA-Z0-9]/g, '_');
  const dataRefStr = format(params.mesReferencia, 'yyyy_MM');
  doc.save(`Relatorio_Receitas_Brutas_MEI_${nomeSanitizado}_${dataRefStr}.pdf`);
}
