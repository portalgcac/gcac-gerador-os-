import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Calendar, 
  CheckSquare, 
  Square,
  Filter,
  Download,
  Settings,
  Database,
  FileText
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useFinanceiro } from '../../context/FinanceiroContext';
import { STATUS_OS, FORMAS_PAGAMENTO } from '../../types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from '../../db/supabase';
import { useAuth } from '../../context/AuthContext';
import { jsPDF } from 'jspdf';
import { formatarMoeda } from '../../utils/formatters';

interface ExportadorRelatorioProps {
  isOpen: boolean;
  onClose: () => void;
  dataInicioProp?: string;
  dataFimProp?: string;
}

export function ExportadorRelatorio({ isOpen, onClose, dataInicioProp, dataFimProp }: ExportadorRelatorioProps) {
  const { ordens } = useOrdens();
  const { despesas } = useFinanceiro();
  const { usuario } = useAuth();

  // Filtros
  const [dataInicio, setDataInicio] = useState(dataInicioProp || format(new Date(), 'yyyy-MM-01'));
  const [dataFim, setDataFim] = useState(dataFimProp || format(new Date(), 'yyyy-MM-dd'));
  
  // Foco do Relatório
  const [tipoRelatorio, setTipoRelatorio] = useState<'completo' | 'recebidos' | 'pendentes' | 'despesas'>('completo');

  // Filtros detalhados
  const [formasPagamentoFiltro, setFormasPagamentoFiltro] = useState<string[]>(FORMAS_PAGAMENTO);
  const [statusOSFiltro, setStatusOSFiltro] = useState<string[]>(STATUS_OS);
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('Todos');
  const [usuarios, setUsuarios] = useState<{id: string, nome: string}[]>([]);

  // Configurações de Seções
  const [incluirResumo, setIncluirResumo] = useState(true);
  const [incluirPagamentos, setIncluirPagamentos] = useState(true);
  const [incluirServicos, setIncluirServicos] = useState(true);
  const [incluirOS, setIncluirOS] = useState(true);
  const [incluirDespesas, setIncluirDespesas] = useState(true);

  // Sincroniza datas vindas da prop
  useEffect(() => {
    if (dataInicioProp) setDataInicio(dataInicioProp);
    if (dataFimProp) setDataFim(dataFimProp);
  }, [dataInicioProp, dataFimProp]);

  // Carrega colaboradores da empresa
  useEffect(() => {
    const carregarUsuarios = async () => {
      if (!usuario?.empresaId) return;
      const { data } = await supabase
        .from('usuarios_autorizados')
        .select('id, nome')
        .eq('ativo', true)
        .eq('empresa_id', usuario.empresaId);
      if (data) setUsuarios(data);
    };
    carregarUsuarios();
  }, [usuario?.empresaId]);

  // Modifica os seletores de forma inteligente ao alterar o foco do relatório
  const handleMudarTipoRelatorio = (tipo: 'completo' | 'recebidos' | 'pendentes' | 'despesas') => {
    setTipoRelatorio(tipo);
    if (tipo === 'completo') {
      setStatusOSFiltro(STATUS_OS);
      setFormasPagamentoFiltro(FORMAS_PAGAMENTO);
      setIncluirResumo(true);
      setIncluirPagamentos(true);
      setIncluirServicos(true);
      setIncluirOS(true);
      setIncluirDespesas(true);
    } else if (tipo === 'recebidos') {
      setStatusOSFiltro(['Pago', 'Parcialmente Pago']);
      setFormasPagamentoFiltro(FORMAS_PAGAMENTO);
      setIncluirResumo(true);
      setIncluirPagamentos(true);
      setIncluirServicos(true);
      setIncluirOS(true);
      setIncluirDespesas(false);
    } else if (tipo === 'pendentes') {
      setStatusOSFiltro(['Aguardando Pagamento', 'Parcialmente Pago']);
      setFormasPagamentoFiltro(FORMAS_PAGAMENTO);
      setIncluirResumo(true);
      setIncluirPagamentos(true);
      setIncluirServicos(true);
      setIncluirOS(true);
      setIncluirDespesas(false);
    } else if (tipo === 'despesas') {
      setStatusOSFiltro([]);
      setFormasPagamentoFiltro([]);
      setIncluirResumo(false);
      setIncluirPagamentos(false);
      setIncluirServicos(false);
      setIncluirOS(false);
      setIncluirDespesas(true);
    }
  };

  const toggleFormaPagamento = (forma: string) => {
    setFormasPagamentoFiltro(prev => 
      prev.includes(forma) ? prev.filter(f => f !== forma) : [...prev, forma]
    );
  };

  const toggleStatusOS = (status: any) => {
    setStatusOSFiltro(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleExportar = async (formato: 'excel' | 'pdf' = 'excel') => {
    // Tenta carregar a logo da empresa (base64) ou o fallback
    let logoBase64 = usuario?.dadosEmpresa?.logoUrl || '';
    if (!logoBase64) {
      try {
        const logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
        if (logoRes.ok) {
          const logoBlob = await logoRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
        }
      } catch (e) {
        console.error('Erro ao buscar logo padrao:', e);
      }
    }

    const cnpj = usuario?.dadosEmpresa?.cnpj || '';
    const contato = usuario?.dadosEmpresa?.contatoTelefone || '';
    const endereco = usuario?.dadosEmpresa?.endereco || '';

    // 1. Filtragem das OSs com base nos critérios selecionados (criadas no período OU com pagamento recebido no período)
    const intervaloData = {
      start: startOfDay(parseISO(dataInicio)),
      end: endOfDay(parseISO(dataFim))
    };

    const ordensFiltradas = ordens.filter(item => {
      const ehMigracao = item.migrado === true || item.observacoes?.includes('[MIGRAÇÃO]');
      if (ehMigracao) return false;

      const dataItem = item.criadoEm ? parseISO(item.criadoEm) : null;
      const criadaNoIntervalo = dataItem ? isWithinInterval(dataItem, intervaloData) : false;
      const tevePagamentoNoIntervalo = item.historicoPagamentos?.some(p => p.data && isWithinInterval(parseISO(p.data), intervaloData));

      if (!criadaNoIntervalo && !tevePagamentoNoIntervalo) return false;

      // Filtro de Status OS
      if (statusOSFiltro.length > 0 && !statusOSFiltro.includes(item.status)) return false;

      // Filtro de Forma de Pagamento (se a principal ou algum histórico bater com o filtro)
      if (formasPagamentoFiltro.length > 0) {
        const mainMatches = formasPagamentoFiltro.includes(item.formaPagamento);
        const historyMatches = item.historicoPagamentos?.some(p => formasPagamentoFiltro.includes(p.metodo));
        if (!mainMatches && !historyMatches) return false;
      }

      // Filtro de Colaborador
      if (colaboradorFiltro !== 'Todos' && item.criadoPorNome !== colaboradorFiltro) return false;

      return true;
    });

    // 2. Filtragem de Despesas PJ
    const despesasFiltradas = despesas.filter(item => {
      const dataItem = parseISO(item.data);
      return isWithinInterval(dataItem, intervaloData);
    });

    // 3. Totais calculados considerando apenas as formas de pagamento ativas no filtro
    let faturamento = 0;
    ordensFiltradas.forEach(o => {
      if (o.historicoPagamentos && o.historicoPagamentos.length > 0) {
        o.historicoPagamentos.forEach(p => {
          const dataPagamento = parseISO(p.data);
          if (isWithinInterval(dataPagamento, intervaloData)) {
            if (formasPagamentoFiltro.includes(p.metodo)) {
              faturamento += (p.valor || 0);
            }
          }
        });
      } else if (o.valorPago > 0) {
        const dataOS = parseISO(o.criadoEm);
        if (isWithinInterval(dataOS, intervaloData)) {
          if (formasPagamentoFiltro.includes(o.formaPagamento)) {
            faturamento += (o.valorPago || 0);
          }
        }
      }
    });

    // Dedução das Taxas GRU correspondentes às ordens que movimentaram no período
    const ordensPagasPeriodo = ordensFiltradas.filter(o => {
      const temPagamentoNoPeriodo = o.historicoPagamentos?.some(p => p.data && isWithinInterval(parseISO(p.data), intervaloData));
      const criadaNoPeriodoPaga = (o.status === 'Pago' || o.status === 'Parcialmente Pago') && (o.valorPago || 0) > 0;
      return temPagamentoNoPeriodo || criadaNoPeriodoPaga;
    });

    const taxas = ordensPagasPeriodo.reduce((s, o) => {
      const taxaOS = Number(o.taxaPFTotal) || 0;
      const sumServ = (o.servicos || []).reduce((acc: number, serv: any) => acc + (Number(serv.taxaPF) || 0), 0);
      return s + Math.max(taxaOS, sumServ);
    }, 0);

    const despesasTotal = despesasFiltradas.reduce((s, d) => s + (d.valor || 0), 0);
    const margemBruta = faturamento - taxas;
    const lucroLiquido = margemBruta - despesasTotal;

    // Agrupamento por Meios de Pagamento
    const formasPgtoBreakdown: Record<string, number> = {};
    const formasPgtoQtd: Record<string, number> = {};
    ordensFiltradas.forEach(o => {
      if (o.historicoPagamentos && o.historicoPagamentos.length > 0) {
        o.historicoPagamentos.forEach(p => {
          const dataPagamento = parseISO(p.data);
          if (isWithinInterval(dataPagamento, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
            const metodo = p.metodo || 'Pendente';
            if (formasPagamentoFiltro.includes(metodo)) {
              formasPgtoBreakdown[metodo] = (formasPgtoBreakdown[metodo] || 0) + (p.valor || 0);
              formasPgtoQtd[metodo] = (formasPgtoQtd[metodo] || 0) + 1;
            }
          }
        });
      } else if (o.valorPago > 0) {
        const dataOS = parseISO(o.criadoEm);
        if (isWithinInterval(dataOS, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
          const metodo = o.formaPagamento || 'Pendente';
          if (formasPagamentoFiltro.includes(metodo)) {
            formasPgtoBreakdown[metodo] = (formasPgtoBreakdown[metodo] || 0) + (o.valorPago || 0);
            formasPgtoQtd[metodo] = (formasPgtoQtd[metodo] || 0) + 1;
          }
        }
      }
    });

    // Agrupamento de Faturamento proporcional por Tipo de Serviço
    const servicosBreakdown: Record<string, { nome: string; qtd: number; bruto: number; taxas: number; liquido: number }> = {};
    ordensFiltradas.forEach(o => {
      const totalOSVal = o.valor || 1;
      const oStatusPago = o.status === 'Pago' || o.status === 'Parcialmente Pago';

      // Calcula faturamento filtrado na OS atual
      let paidOnOSFiltered = 0;
      if (o.historicoPagamentos && o.historicoPagamentos.length > 0) {
        o.historicoPagamentos.forEach(p => {
          const dataPagamento = parseISO(p.data);
          if (isWithinInterval(dataPagamento, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
            if (formasPagamentoFiltro.includes(p.metodo)) {
              paidOnOSFiltered += (p.valor || 0);
            }
          }
        });
      } else if (o.valorPago > 0) {
        const dataOS = parseISO(o.criadoEm);
        if (isWithinInterval(dataOS, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
          if (formasPagamentoFiltro.includes(o.formaPagamento)) {
            paidOnOSFiltered += (o.valorPago || 0);
          }
        }
      }

      (o.servicos || []).forEach(s => {
        const servVal = s.valor || 0;
        const brutoProp = (servVal / totalOSVal) * paidOnOSFiltered;
        const taxasProp = oStatusPago ? (s.taxaPF || 0) : 0;
        const liquidoProp = brutoProp - taxasProp;

        if (!servicosBreakdown[s.nome]) {
          servicosBreakdown[s.nome] = { nome: s.nome, qtd: 0, bruto: 0, taxas: 0, liquido: 0 };
        }
        servicosBreakdown[s.nome].qtd += 1;
        servicosBreakdown[s.nome].bruto += brutoProp;
        servicosBreakdown[s.nome].taxas += taxasProp;
        servicosBreakdown[s.nome].liquido += liquidoProp;
      });
    });

    const empresaName = usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.empresaNome || 'G CAC Despachante Bélico';

    // 4. Executa a exportação no formato escolhido
    if (formato === 'pdf') {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      let pageCount = 1;

      const drawHeaderFooter = (pageNum: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(empresaName.toUpperCase(), 15, 12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`, 130, 12);
        doc.setDrawColor(220, 225, 230);
        doc.line(15, 14, 195, 14);

        // Rodapé
        doc.line(15, 282, 195, 282);
        doc.setFontSize(8);
        doc.text('Portal G CAC - Gestão Financeira', 15, 287);
        doc.text(`Página ${pageNum}`, 180, 287);
      };

      drawHeaderFooter(pageCount);

      // Renderização do cabeçalho da empresa
      let textX = 15;
      let logoValido = false;
      let imgFormat = 'PNG';
      if (logoBase64 && logoBase64.startsWith('data:image/')) {
        logoValido = true;
        if (logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg')) {
          imgFormat = 'JPEG';
        } else if (logoBase64.startsWith('data:image/webp')) {
          imgFormat = 'WEBP';
        }
      }

      if (logoValido) {
        try {
          doc.addImage(logoBase64, imgFormat, 15, 20, 24, 24);
          textX = 44;
        } catch (e) {
          console.error('Erro ao renderizar logo no PDF:', e);
          textX = 15;
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 32, 67); // Azul marinho
      doc.text(empresaName, textX, 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text(cnpj ? `CNPJ: ${cnpj}` : '', textX, 29);
      doc.text(contato ? `Contato: ${contato}` : '', textX, 34);
      if (endereco) {
        let cleanEndereco = endereco;
        if (doc.getTextWidth(cleanEndereco) > 195 - textX) {
          while (cleanEndereco.length > 5 && doc.getTextWidth(cleanEndereco + '...') > 195 - textX) {
            cleanEndereco = cleanEndereco.slice(0, -1);
          }
          cleanEndereco += '...';
        }
        doc.text(`Endereço: ${cleanEndereco}`, textX, 39);
      }

      doc.setDrawColor(200, 205, 210);
      doc.line(15, 48, 195, 48);

      // Título do documento
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 32, 67);
      doc.text('RELATÓRIO DE FATURAMENTO DETALHADO', 15, 56);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Período de Referência: ${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`, 15, 61);

      let y = 70;

      const checkSpace = (needed: number) => {
        if (y + needed > 275) {
          doc.addPage();
          pageCount++;
          drawHeaderFooter(pageCount);
          y = 25;
        }
      };

      const drawSectionTable = (
        headers: { label: string; width: number; align?: 'left' | 'right' }[],
        rows: string[][],
        title: string
      ) => {
        checkSpace(20 + rows.length * 6);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 32, 67);
        doc.text(title, 15, y);
        y += 5;

        doc.setFillColor(235, 240, 248);
        doc.rect(15, y, 180, 6.5, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        
        let currentX = 15;
        headers.forEach(h => {
          const xPos = h.align === 'right' ? currentX + h.width - 2 : currentX + 2;
          doc.text(h.label, xPos, y + 4.5, { align: h.align || 'left' });
          currentX += h.width;
        });
        y += 6.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(60, 60, 60);

        rows.forEach((row, rIdx) => {
          checkSpace(6);
          if (rIdx % 2 === 1) {
            doc.setFillColor(248, 250, 253);
            doc.rect(15, y, 180, 5.5, 'F');
          }

          currentX = 15;
          row.forEach((cell, cIdx) => {
            const h = headers[cIdx];
            const xPos = h.align === 'right' ? currentX + h.width - 2 : currentX + 2;
            
            let cellText = cell || '';
            if (doc.getTextWidth(cellText) > h.width - 3) {
              while (cellText.length > 3 && doc.getTextWidth(cellText + '...') > h.width - 3) {
                cellText = cellText.slice(0, -1);
              }
              cellText = cellText + '...';
            }

            doc.text(cellText, xPos, y + 4, { align: h.align || 'left' });
            currentX += h.width;
          });
          y += 5.5;
        });
        y += 6;
      };

      // 1. Resumo Geral (DRE)
      if (incluirResumo) {
        checkSpace(40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 32, 67);
        doc.text('DRE SIMPLIFICADA / RESUMO GERAL', 15, y);
        y += 5;

        const summaryItems = [
          { label: 'FATURAMENTO BRUTO (ENTRADAS NO PERÍODO)', val: faturamento, color: [46, 117, 89] },
          { label: '(-) DEDUÇÃO TAXAS PF (GRU OPERACIONAIS)', val: taxas, color: [165, 42, 42] },
          { label: '(=) MARGEM / LUCRO BRUTO OPERACIONAL', val: margemBruta, color: [15, 32, 67] },
          { label: '(-) DESPESAS PJ (SAÍDAS OPERACIONAIS)', val: despesasTotal, color: [165, 42, 42] },
          { label: '(=) LUCRO LÍQUIDO REAL DO PERÍODO', val: lucroLiquido, color: [46, 117, 89] }
        ];

        summaryItems.forEach(item => {
          doc.setFillColor(245, 247, 250);
          doc.rect(15, y, 180, 6, 'F');
          doc.setDrawColor(220, 225, 230);
          doc.rect(15, y, 180, 6, 'S');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          doc.text(item.label, 18, y + 4.2);

          doc.setTextColor(item.color[0], item.color[1], item.color[2]);
          doc.text(formatarMoeda(item.val), 190, y + 4.2, { align: 'right' });
          y += 6.5;
        });
        y += 4;
      }

      // 2. Receitas por Meio de Pagamento
      if (incluirPagamentos && Object.keys(formasPgtoBreakdown).length > 0) {
        const pgtoHeaders = [
          { label: 'Meio de Pagamento', width: 80 },
          { label: 'Transações', width: 40, align: 'right' as const },
          { label: 'Total Recebido', width: 60, align: 'right' as const }
        ];
        const pgtoRows = Object.entries(formasPgtoBreakdown).map(([metodo, valor]) => [
          metodo,
          String(formasPgtoQtd[metodo] || 0),
          formatarMoeda(valor)
        ]);
        drawSectionTable(pgtoHeaders, pgtoRows, 'RECEITAS POR MEIO DE PAGAMENTO');
      }

      // 3. Faturamento por Tipo de Serviço
      if (incluirServicos && Object.keys(servicosBreakdown).length > 0) {
        const servHeaders = [
          { label: 'Serviço Prestado', width: 75 },
          { label: 'Quant.', width: 20, align: 'right' as const },
          { label: 'Faturamento Bruto', width: 30, align: 'right' as const },
          { label: 'Dedução Taxas', width: 25, align: 'right' as const },
          { label: 'Faturamento Líquido', width: 30, align: 'right' as const }
        ];
        const servRows = Object.values(servicosBreakdown).map((s: any) => [
          s.nome,
          String(s.qtd),
          formatarMoeda(s.bruto),
          formatarMoeda(s.taxas),
          formatarMoeda(s.liquido)
        ]);
        drawSectionTable(servHeaders, servRows, 'DETALHAMENTO DE FATURAMENTO POR SERVIÇO');
      }

      // 4. Detalhes de Entradas (O.S.)
      if (incluirOS && ordensFiltradas.length > 0) {
        const osHeaders = [
          { label: 'OS', width: 14 },
          { label: 'Data', width: 18 },
          { label: 'Cliente', width: 48 },
          { label: 'Forma Pagamento', width: 38 },
          { label: 'Total (OS)', width: 22, align: 'right' as const },
          { label: 'Taxa GRU', width: 18, align: 'right' as const },
          { label: 'Líquido', width: 22, align: 'right' as const }
        ];
        const osRows = ordensFiltradas.map(o => [
          `#${String(o.numero).padStart(4, '0')}`,
          format(parseISO(o.criadoEm), 'dd/MM/yy'),
          o.nomeCliente,
          o.formaPagamento || 'A Combinar',
          formatarMoeda(o.valor),
          formatarMoeda(o.taxaPFTotal || 0),
          o.status === 'Pago' ? formatarMoeda((o.valorPago || o.valor) - (o.taxaPFTotal || 0)) : formatarMoeda(0)
        ]);
        drawSectionTable(osHeaders, osRows, 'HISTÓRICO DETALHADO DE ENTRADAS (ORDENS DE SERVIÇO)');
      }

      // 5. Detalhes de Despesas (Saídas)
      if (incluirDespesas && despesasFiltradas.length > 0) {
        const despHeaders = [
          { label: 'Data', width: 25 },
          { label: 'Descrição da Despesa PJ', width: 85 },
          { label: 'Categoria', width: 45 },
          { label: 'Valor Pago', width: 25, align: 'right' as const }
        ];
        const despRows = despesasFiltradas.map(d => [
          format(parseISO(d.data), 'dd/MM/yyyy'),
          d.descricao,
          d.categoria,
          `-${formatarMoeda(d.valor)}`
        ]);
        drawSectionTable(despHeaders, despRows, 'HISTÓRICO DETALHADO DE DESPESAS PJ (SAÍDAS OPERACIONAIS)');
      }

      doc.save(`Faturamento_Detalhado_${dataInicio}_a_${dataFim}.pdf`);
    } else {
      // Formato Excel estruturado
      const rowsResumo: any[] = [
        ['PORTAL G CAC - RELATÓRIO DE FATURAMENTO DETALHADO'],
        [`Empresa: ${empresaName}`],
        [`CNPJ: ${cnpj}`],
        [`Contato: ${contato}`],
        [`Período: ${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`],
        [],
        ['1. DRE SIMPLIFICADA / RESUMO GERAL'],
        ['Indicador', 'Valor no Caixa'],
        ['Faturamento Bruto (Entradas)', faturamento],
        ['Dedução Taxas PF (GRU)', taxas],
        ['Margem / Lucro Bruto Operacional', faturamento - taxas],
        ['Despesas PJ (Saídas)', despesasTotal],
        ['Lucro Líquido Real', faturamento - taxas - despesasTotal],
        []
      ];

      if (incluirPagamentos && Object.keys(formasPgtoBreakdown).length > 0) {
        rowsResumo.push(['2. RECEITAS POR MEIO DE PAGAMENTO']);
        rowsResumo.push(['Meio de Pagamento', 'Transações', 'Total Recebido']);
        Object.entries(formasPgtoBreakdown).forEach(([metodo, valor]) => {
          rowsResumo.push([metodo, formasPgtoQtd[metodo] || 0, valor]);
        });
        rowsResumo.push([]);
      }

      if (incluirServicos && Object.keys(servicosBreakdown).length > 0) {
        rowsResumo.push(['3. FATURAMENTO POR TIPO DE SERVIÇO']);
        rowsResumo.push(['Serviço', 'Quantidade', 'Faturamento Bruto', 'Taxas GRU', 'Faturamento Líquido']);
        Object.values(servicosBreakdown).forEach((s: any) => {
          rowsResumo.push([s.nome, s.qtd, s.bruto, s.taxas, s.liquido]);
        });
        rowsResumo.push([]);
      }

      const wsResumo = XLSX.utils.aoa_to_sheet(rowsResumo);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Financeiro');

      if (incluirOS && ordensFiltradas.length > 0) {
        const rowsEntradas = ordensFiltradas.map(o => ({
          'Nº OS': `#${String(o.numero).padStart(4, '0')}`,
          'Data Criação': format(parseISO(o.criadoEm), 'dd/MM/yyyy HH:mm'),
          'Cliente': o.nomeCliente,
          'CPF': o.cpf,
          'Valor Total (OS)': o.valor,
          'Desconto': o.desconto || 0,
          'Valor Pago': o.valorPago,
          'Taxas PF (GRU)': o.taxaPFTotal || 0,
          'Líquido (OS)': o.status === 'Pago' ? (o.valorPago || o.valor) - (o.taxaPFTotal || 0) : 0,
          'Status': o.status,
          'Forma de Pagamento': o.formaPagamento
        }));
        const wsEntradas = XLSX.utils.json_to_sheet(rowsEntradas);
        XLSX.utils.book_append_sheet(wb, wsEntradas, 'Entradas Detalhadas');
      }

      if (incluirDespesas && despesasFiltradas.length > 0) {
        const rowsSaidas = despesasFiltradas.map(d => ({
          'Data': format(parseISO(d.data), 'dd/MM/yyyy'),
          'Descrição': d.descricao,
          'Categoria': d.categoria,
          'Valor Pago': d.valor
        }));
        const wsSaidas = XLSX.utils.json_to_sheet(rowsSaidas);
        XLSX.utils.book_append_sheet(wb, wsSaidas, 'Saídas PJ');
      }

      XLSX.writeFile(wb, `Faturamento_Detalhado_${dataInicio}_a_${dataFim}.xlsx`);
    }
    onClose();
  };

  const selectTodasFormasPagamento = () => setFormasPagamentoFiltro(FORMAS_PAGAMENTO);
  const desmarcarTodasFormasPagamento = () => setFormasPagamentoFiltro([]);

  const selectTodosStatusOS = () => setStatusOSFiltro(STATUS_OS);
  const desmarcarTodosStatusOS = () => setStatusOSFiltro([]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="card w-full max-w-4xl relative z-10 animate-scale-up overflow-hidden p-0 border-brand-dark-5">
        {/* Header */}
        <div className="bg-brand-dark-3 p-5 border-b border-brand-dark-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="text-brand-green" />
              Exportador Financeiro Avançado
            </h2>
            <p className="text-gray-400 text-xs mt-1">Configure todos os filtros em uma única tela para emitir relatórios estruturados.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto pr-3 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Coluna Esquerda: Filtros */}
          <div className="space-y-5">
            <h3 className="text-xs font-black text-brand-blue-light uppercase tracking-wider border-b border-brand-dark-5 pb-1">
              1. Filtros de Período & Foco
            </h3>

            {/* Período */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Data Início</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="date" 
                    className="input pl-9 text-xs py-1.5" 
                    value={dataInicio} 
                    onChange={e => setDataInicio(e.target.value)} 
                  />
                </div>
              </div>
              <div>
                <label className="label">Data Fim</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="date" 
                    className="input pl-9 text-xs py-1.5" 
                    value={dataFim} 
                    onChange={e => setDataFim(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Foco / Tipo do Relatório */}
            <div>
              <label className="label">Foco do Relatório (Filtro Rápido)</label>
              <select 
                className="select text-xs py-1.5" 
                value={tipoRelatorio}
                onChange={e => handleMudarTipoRelatorio(e.target.value as any)}
              >
                <option value="completo">Consolidado Geral (Completo)</option>
                <option value="recebidos">Apenas Valores Recebidos (Entradas de Caixa)</option>
                <option value="pendentes">Apenas Valores Pendentes / A Receber</option>
                <option value="despesas">Apenas Despesas PJ (Saídas)</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Isso ajusta automaticamente as caixas abaixo para o foco selecionado.</p>
            </div>

            {/* Formas de Pagamento Checkbox Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label">Meios de Pagamento</label>
                <div className="flex gap-2">
                  <button onClick={selectTodasFormasPagamento} className="text-[9px] text-brand-blue font-bold uppercase hover:underline">Marcar Todos</button>
                  <button onClick={desmarcarTodasFormasPagamento} className="text-[9px] text-gray-500 font-bold uppercase hover:underline">Limpar</button>
                </div>
              </div>
              <div className="bg-brand-dark-3/50 rounded-xl border border-brand-dark-5 p-3 max-h-[140px] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FORMAS_PAGAMENTO.map(forma => {
                  const isChecked = formasPagamentoFiltro.includes(forma);
                  return (
                    <button
                      key={forma}
                      onClick={() => toggleFormaPagamento(forma)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                        isChecked ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-transparent text-gray-500 hover:text-gray-400'
                      }`}
                    >
                      {isChecked ? <CheckSquare size={14} className="text-brand-blue" /> : <Square size={14} />}
                      <span className="text-[10px] font-medium truncate">{forma}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status da OS Checkbox Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label">Status das OSs</label>
                <div className="flex gap-2">
                  <button onClick={selectTodosStatusOS} className="text-[9px] text-brand-blue font-bold uppercase hover:underline">Marcar Todos</button>
                  <button onClick={desmarcarTodosStatusOS} className="text-[9px] text-gray-500 font-bold uppercase hover:underline">Limpar</button>
                </div>
              </div>
              <div className="bg-brand-dark-3/50 rounded-xl border border-brand-dark-5 p-3 max-h-[120px] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STATUS_OS.map(status => {
                  const isChecked = statusOSFiltro.includes(status);
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatusOS(status)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                        isChecked ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-transparent text-gray-500 hover:text-gray-400'
                      }`}
                    >
                      {isChecked ? <CheckSquare size={14} className="text-brand-blue" /> : <Square size={14} />}
                      <span className="text-[10px] font-medium">{status}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colaborador */}
            <div>
              <label className="label">Responsável pelo Registro</label>
              <select 
                className="select text-xs py-1.5" 
                value={colaboradorFiltro}
                onChange={e => setColaboradorFiltro(e.target.value)}
              >
                <option value="Todos">Todos os Colaboradores</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.nome}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Coluna Direita: Seções do Relatório & Download */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-brand-blue-light uppercase tracking-wider border-b border-brand-dark-5 pb-1">
                2. Conteúdo do Relatório (Seções)
              </h3>
              <p className="text-gray-500 text-[11px]">Selecione os blocos de informações que serão renderizados no seu arquivo Excel ou PDF final:</p>
              
              <div className="space-y-2">
                <button
                  onClick={() => setIncluirResumo(!incluirResumo)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition-all ${
                    incluirResumo ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incluirResumo ? <CheckSquare size={16} className="text-brand-blue" /> : <Square size={16} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Resumo Geral (DRE Simplificada)</span>
                      <span className="text-[9px] text-gray-500">Lucro líquido, bruto, GRUs e despesas consolidadas.</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIncluirPagamentos(!incluirPagamentos)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition-all ${
                    incluirPagamentos ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incluirPagamentos ? <CheckSquare size={16} className="text-brand-blue" /> : <Square size={16} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Faturamento por Meio de Pagamento</span>
                      <span className="text-[9px] text-gray-500">Tabela com totais recebidos em PIX, Dinheiro, Cartões, etc.</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIncluirServicos(!incluirServicos)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition-all ${
                    incluirServicos ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incluirServicos ? <CheckSquare size={16} className="text-brand-blue" /> : <Square size={16} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Faturamento por Tipo de Serviço</span>
                      <span className="text-[9px] text-gray-500">Divisão do que entrou por CAC, CR, Portes, GRUs e líquido.</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIncluirOS(!incluirOS)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition-all ${
                    incluirOS ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incluirOS ? <CheckSquare size={16} className="text-brand-blue" /> : <Square size={16} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Histórico de OSs (Entradas Detalhadas)</span>
                      <span className="text-[9px] text-gray-500">Lista completa com data, cliente, valor, GRUs e meio de pgto.</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIncluirDespesas(!incluirDespesas)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition-all ${
                    incluirDespesas ? 'border-brand-blue/30 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incluirDespesas ? <CheckSquare size={16} className="text-brand-blue" /> : <Square size={16} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Histórico de Despesas PJ (Saídas Detalhadas)</span>
                      <span className="text-[9px] text-gray-500">Lista de pagamentos efetuados, descrição, valor e categorias.</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Ações Rápidas de Download */}
            <div className="bg-brand-dark-3/50 border border-brand-dark-5 rounded-2xl p-4 space-y-3">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">3. Gerar Documento</h4>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleExportar('pdf')}
                  className="btn-primary flex-1 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-red-600 border-red-600 hover:bg-red-600/90 py-2.5"
                >
                  <FileText size={16} />
                  Baixar PDF
                </button>
                <button 
                  onClick={() => handleExportar('excel')}
                  className="btn-primary flex-1 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-brand-green border-brand-green hover:bg-brand-green/90 py-2.5"
                >
                  <FileSpreadsheet size={16} />
                  Baixar Excel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-brand-dark-3 p-4 border-t border-brand-dark-5 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="btn-ghost px-5 font-black text-xs uppercase tracking-widest"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
