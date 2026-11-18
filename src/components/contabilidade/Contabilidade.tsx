import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Calendar, 
  ShieldCheck, 
  Coins, 
  BadgePercent, 
  DollarSign, 
  Layers, 
  Building2, 
  PieChart, 
  Info, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Printer,
  Check,
  Receipt
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useFinanceiro } from '../../context/FinanceiroContext';
import { useAuth } from '../../context/AuthContext';
import { useRecibos } from '../../context/RecibosContext';
import { listarFechamentosColaboradores } from '../../services/pontoColaboradoresService';
import { FechamentoColaborador, OrdemDeServico } from '../../types';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  isWithinInterval, 
  getYear, 
  getMonth,
  setMonth,
  setYear,
  subMonths,
  addMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportarPlanilhaContabilCompleta, exportarRelatorioOficialMEIPdf } from './exportadorContabil';

const LIMITE_MEI_ANUAL = 81000;
const LIMITE_MEI_TOLERANCIA_20 = 97200; // Tolerância máxima antes do desenquadramento retroativo
const LIMITE_ME_SIMPLES = 360000;

export function Contabilidade() {
  const { ordens } = useOrdens();
  const { despesas } = useFinanceiro();
  const { recibos } = useRecibos();
  const { usuario } = useAuth();

  const [fechamentosColaboradores, setFechamentosColaboradores] = useState<FechamentoColaborador[]>([]);
  const [dataReferencia, setDataReferencia] = useState(new Date());
  const [abaAtiva, setAbaAtiva] = useState<'visao_geral' | 'relatorio_mei' | 'dre' | 'meios_pagamento' | 'fechamento'>('visao_geral');
  const [regimeContabil, setRegimeContabil] = useState<'caixa' | 'competencia'>('caixa');

  const anoAtual = getYear(dataReferencia);
  const mesAtual = getMonth(dataReferencia);

  // Carrega fechamentos de colaboradores PJ
  useEffect(() => {
    if (usuario?.empresaId) {
      listarFechamentosColaboradores(usuario.empresaId).then(dados => {
        setFechamentosColaboradores(dados || []);
      }).catch(err => {
        console.error('Erro ao listar fechamentos de colaboradores:', err);
      });
    }
  }, [usuario?.empresaId]);

  // Intervalo do Mês Selecionado
  const { inicioMes, fimMes } = useMemo(() => {
    return {
      inicioMes: startOfMonth(dataReferencia),
      fimMes: endOfMonth(dataReferencia)
    };
  }, [dataReferencia]);

  // Intervalo do Ano Selecionado
  const { inicioAno, fimAno } = useMemo(() => {
    return {
      inicioAno: startOfYear(dataReferencia),
      fimAno: endOfYear(dataReferencia)
    };
  }, [dataReferencia]);

  // ── Filtragem de Ordens do Mês e do Ano ──────────────────────────────────
  const { ordensMes, ordensAno, despesasMes, despesasAno, fechamentosMes } = useMemo(() => {
    const filtrarOS = (inicio: Date, fim: Date) => {
      return ordens.filter(o => {
        const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
        if (ehMigracao) return false;

        if (regimeContabil === 'caixa') {
          // Regime de Caixa: data do pagamento efetivo
          const temPagamentoNoIntervalo = o.historicoPagamentos?.some(p => {
            if (!p.data) return false;
            const dataPgto = parseISO(p.data);
            return isWithinInterval(dataPgto, { start: inicio, end: fim });
          });
          const criadoNoIntervaloPaga = (o.status === 'Pago' || o.status === 'Parcialmente Pago') && 
            o.criadoEm && isWithinInterval(parseISO(o.criadoEm), { start: inicio, end: fim });
          return temPagamentoNoIntervalo || criadoNoIntervaloPaga;
        } else {
          // Regime de Competência: data de criação/conclusão da OS
          if (!o.criadoEm) return false;
          return isWithinInterval(parseISO(o.criadoEm), { start: inicio, end: fim });
        }
      });
    };

    const oMes = filtrarOS(inicioMes, fimMes);
    const oAno = filtrarOS(inicioAno, fimAno);

    const dMes = despesas.filter(d => d.data && isWithinInterval(parseISO(d.data), { start: inicioMes, end: fimMes }));
    const dAno = despesas.filter(d => d.data && isWithinInterval(parseISO(d.data), { start: inicioAno, end: fimAno }));

    const fMes = fechamentosColaboradores.filter(f => {
      const dataFim = f.dataFimPeriodo ? parseISO(f.dataFimPeriodo) : null;
      return dataFim && isWithinInterval(dataFim, { start: inicioMes, end: fimMes });
    });

    return {
      ordensMes: oMes,
      ordensAno: oAno,
      despesasMes: dMes,
      despesasAno: dAno,
      fechamentosMes: fMes
    };
  }, [ordens, despesas, fechamentosColaboradores, inicioMes, fimMes, inicioAno, fimAno, regimeContabil]);

  // ── Totais do Mês e DRE ───────────────────────────────────────────────────
  const apuracaoMes = useMemo(() => {
    let receitaBruta = 0;
    let taxasGru = 0;
    const meiosMap: Record<string, { total: number; qtd: number }> = {};

    ordensMes.forEach(os => {
      // Valor efetivo
      let valorCobrado = 0;
      if (regimeContabil === 'caixa') {
        if (os.historicoPagamentos && os.historicoPagamentos.length > 0) {
          os.historicoPagamentos.forEach(p => {
            if (!p.data) return;
            const dataPgto = parseISO(p.data);
            if (isWithinInterval(dataPgto, { start: inicioMes, end: fimMes })) {
              const val = Number(p.valor) || 0;
              valorCobrado += val;
              const metodo = p.metodo || 'Pendente';
              if (!meiosMap[metodo]) meiosMap[metodo] = { total: 0, qtd: 0 };
              meiosMap[metodo].total += val;
              meiosMap[metodo].qtd += 1;
            }
          });
        } else if ((os.valorPago || 0) > 0) {
          valorCobrado = Number(os.valorPago);
          const metodo = os.formaPagamento || 'Outro';
          if (!meiosMap[metodo]) meiosMap[metodo] = { total: 0, qtd: 0 };
          meiosMap[metodo].total += valorCobrado;
          meiosMap[metodo].qtd += 1;
        }
      } else {
        valorCobrado = Number(os.valor || 0) - Number(os.desconto || 0);
        const metodo = os.formaPagamento || 'A Combinar';
        if (!meiosMap[metodo]) meiosMap[metodo] = { total: 0, qtd: 0 };
        meiosMap[metodo].total += valorCobrado;
        meiosMap[metodo].qtd += 1;
      }

      receitaBruta += valorCobrado;

      // Taxas GRU reembolsáveis
      const taxaOS = Number(os.taxaPFTotal) || (os.servicos || []).reduce((acc, s) => acc + (Number(s.taxaPF) || 0), 0);
      taxasGru += taxaOS;
    });

    const receitaLiquida = Math.max(0, receitaBruta - taxasGru);

    // Despesas por Categoria Contábil
    let folhaPrestadoresPJ = 0;
    let proLabore = 0;
    let impostosPagos = 0;
    let despesasOperacionais = 0;
    let insumosCompras = 0;

    despesasMes.forEach(d => {
      const val = Number(d.valor) || 0;
      if (d.categoria === 'Pagamento Colaboradores (NF)') {
        folhaPrestadoresPJ += val;
      } else if (d.categoria === 'Retirada (Pró-labore)') {
        proLabore += val;
      } else if (d.categoria === 'Impostos da PJ') {
        impostosPagos += val;
      } else if (d.categoria === 'Insumos') {
        insumosCompras += val;
        despesasOperacionais += val;
      } else {
        despesasOperacionais += val;
      }
    });

    // Se houver fechamentos de colaboradores que não foram lançados em despesas avulsas
    fechamentosMes.forEach(f => {
      if (!f.despesaId && f.status === 'pago') {
        folhaPrestadoresPJ += Number(f.valorLiquidoFinal) || 0;
      }
    });

    const custosDiretos = 0; // Custos específicos de laudos/terceiros quando não são despesas
    const margemBruta = receitaLiquida - custosDiretos;
    const totalSaidasGeral = despesasOperacionais + folhaPrestadoresPJ + proLabore + impostosPagos;
    const lucroLiquido = receitaLiquida - totalSaidasGeral;

    return {
      receitaBruta,
      taxasGru,
      receitaLiquida,
      custosDiretos,
      margemBruta,
      despesasOperacionais,
      folhaPrestadoresPJ,
      proLabore,
      impostosPagos,
      insumosCompras,
      totalSaidasGeral,
      lucroLiquido,
      meiosMap
    };
  }, [ordensMes, despesasMes, fechamentosMes, regimeContabil, inicioMes, fimMes]);

  // ── Apuração Acumulada do Ano (Termômetro MEI) ─────────────────────────────
  const apuracaoAno = useMemo(() => {
    let receitaBrutaAno = 0;
    let taxasGruAno = 0;

    ordensAno.forEach(os => {
      let valor = 0;
      if (regimeContabil === 'caixa') {
        if (os.historicoPagamentos && os.historicoPagamentos.length > 0) {
          os.historicoPagamentos.forEach(p => {
            if (p.data && isWithinInterval(parseISO(p.data), { start: inicioAno, end: fimAno })) {
              valor += Number(p.valor) || 0;
            }
          });
        } else if ((os.valorPago || 0) > 0) {
          valor = Number(os.valorPago);
        }
      } else {
        valor = Number(os.valor || 0) - Number(os.desconto || 0);
      }
      receitaBrutaAno += valor;
      taxasGruAno += Number(os.taxaPFTotal) || (os.servicos || []).reduce((acc, s) => acc + (Number(s.taxaPF) || 0), 0);
    });

    const faturamentoTributavelAno = Math.max(0, receitaBrutaAno - taxasGruAno);

    const totalDespesasAno = despesasAno.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    const totalComprasInsumosAno = despesasAno
      .filter(d => d.categoria === 'Insumos' || d.categoria === 'Sistemas')
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0);

    // Média Mensal (calculada até o mês selecionado ou meses decorridos)
    const mesesDecorridos = Math.max(1, mesAtual + 1);
    const mediaMensalFaturamento = faturamentoTributavelAno / mesesDecorridos;
    const projecaoAnual = mediaMensalFaturamento * 12;

    const percentualMEI = (faturamentoTributavelAno / LIMITE_MEI_ANUAL) * 100;
    const percentualTolerancia = (faturamentoTributavelAno / LIMITE_MEI_TOLERANCIA_20) * 100;

    // Regra dos 80% de compras
    const limiteComprasPermitido = faturamentoTributavelAno * 0.8;
    const percentualCompras = faturamentoTributavelAno > 0 ? (totalComprasInsumosAno / faturamentoTributavelAno) * 100 : 0;

    // Estimativa de mês de estouro do MEI se mantido o ritmo
    let mesEstouroEstimado: string | null = null;
    if (mediaMensalFaturamento > 0) {
      const mesesParaEstourar = LIMITE_MEI_ANUAL / mediaMensalFaturamento;
      if (mesesParaEstourar <= 12) {
        const dataEstouro = new Date(anoAtual, Math.floor(mesesParaEstourar) - 1, 1);
        mesEstouroEstimado = format(dataEstouro, 'MMMM', { locale: ptBR });
      }
    }

    // Estimativa tributária no Simples Nacional caso vire ME (Anexo III - ~6%)
    const impostoEstimadoSimplesNacional = faturamentoTributavelAno * 0.06;
    const impostoMensalEstimadoSimples = apuracaoMes.receitaLiquida * 0.06;

    return {
      receitaBrutaAno,
      taxasGruAno,
      faturamentoTributavelAno,
      totalDespesasAno,
      totalComprasInsumosAno,
      mediaMensalFaturamento,
      projecaoAnual,
      percentualMEI,
      percentualTolerancia,
      limiteComprasPermitido,
      percentualCompras,
      mesEstouroEstimado,
      impostoEstimadoSimplesNacional,
      impostoMensalEstimadoSimples
    };
  }, [ordensAno, despesasAno, regimeContabil, inicioAno, fimAno, mesAtual, anoAtual, apuracaoMes.receitaLiquida]);

  // ── Fechamento do Mês (Status e Auditoria) ────────────────────────────────
  const chaveFechamento = useMemo(() => {
    return `gcac_fechamento_contabil_${usuario?.empresaId || 'default'}_${anoAtual}_${mesAtual + 1}`;
  }, [usuario?.empresaId, anoAtual, mesAtual]);

  const [statusFechamento, setStatusFechamento] = useState<'aberto' | 'em_analise' | 'fechado'>('aberto');
  const [checklistFechamento, setChecklistFechamento] = useState<Record<string, boolean>>({
    gru_separadas: true,
    despesas_conferidas: false,
    extrato_cartoes_batido: false,
    nfs_colaboradores_anexadas: false,
    recibos_conferidos: false
  });

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveFechamento);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed.status) setStatusFechamento(parsed.status);
        if (parsed.checklist) setChecklistFechamento(parsed.checklist);
      } else {
        setStatusFechamento('aberto');
        setChecklistFechamento({
          gru_separadas: true,
          despesas_conferidas: false,
          extrato_cartoes_batido: false,
          nfs_colaboradores_anexadas: false,
          recibos_conferidos: false
        });
      }
    } catch {
      // ignore
    }
  }, [chaveFechamento]);

  const salvarStatusFechamento = (novoStatus: 'aberto' | 'em_analise' | 'fechado') => {
    setStatusFechamento(novoStatus);
    try {
      const payload = {
        status: novoStatus,
        checklist: checklistFechamento,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: usuario?.nome || 'Admin'
      };
      localStorage.setItem(chaveFechamento, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const toggleChecklist = (key: string) => {
    setChecklistFechamento(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        const payload = {
          status: statusFechamento,
          checklist: updated,
          atualizadoEm: new Date().toISOString()
        };
        localStorage.setItem(chaveFechamento, JSON.stringify(payload));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // ── Navegação entre Meses ─────────────────────────────────────────────────
  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    setDataReferencia(prev => direcao === 'anterior' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const mesAnoTexto = format(dataReferencia, 'MMMM / yyyy', { locale: ptBR });

  // ── Handlers de Exportação ────────────────────────────────────────────────
  const handleExportarPlanilha = () => {
    exportarPlanilhaContabilCompleta({
      empresaNome: usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.dadosEmpresa?.nome || 'Empresa Despachantaria',
      cnpjEmpresa: usuario?.dadosEmpresa?.cnpj || '',
      mesAnoTexto,
      mesReferencia: dataReferencia,
      ordensPeriodo: ordensMes,
      despesasPeriodo: despesasMes,
      fechamentosPeriodo: fechamentosMes,
      recibosPeriodo: recibos,
      dre: {
        receitaBruta: apuracaoMes.receitaBruta,
        taxasGru: apuracaoMes.taxasGru,
        receitaLiquida: apuracaoMes.receitaLiquida,
        custosDiretos: apuracaoMes.custosDiretos,
        margemBruta: apuracaoMes.margemBruta,
        despesasOperacionais: apuracaoMes.despesasOperacionais,
        folhaPrestadoresPJ: apuracaoMes.folhaPrestadoresPJ,
        proLabore: apuracaoMes.proLabore,
        impostosPagos: apuracaoMes.impostosPagos,
        lucroLiquido: apuracaoMes.lucroLiquido
      },
      meiosPagamento: apuracaoMes.meiosMap
    });
  };

  const handleExportarRelatorioOficialMEI = () => {
    exportarRelatorioOficialMEIPdf({
      empresaNome: usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.dadosEmpresa?.nome || 'Empreendedor Individual',
      cnpjEmpresa: usuario?.dadosEmpresa?.cnpj || '',
      mesAnoTexto,
      mesReferencia: dataReferencia,
      receitaComercioSemNF: 0,
      receitaComercioComNF: 0,
      receitaIndustriaSemNF: 0,
      receitaIndustriaComNF: 0,
      receitaServicosSemNF: apuracaoMes.receitaLiquida, // Prestação de serviços despachante
      receitaServicosComNF: 0,
      taxasGruDeducoes: apuracaoMes.taxasGru,
      acumuladoAno: apuracaoAno.faturamentoTributavelAno,
      limiteMEI: LIMITE_MEI_ANUAL
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in p-2 md:p-4">
      {/* ── TOPO: TÍTULO, IDENTIFICAÇÃO E SELETOR DE MÊS ─────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-brand-dark-light/80 border border-gray-800 p-5 rounded-2xl shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light rounded-2xl shadow-inner">
            <Calculator size={28} className="text-brand-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Contabilidade & Gestão Fiscal</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <ShieldCheck size={12} /> MEI & Transição ME
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Auditoria de receitas, dedução de GRUs federais, controle do teto anual e fechamentos para o contador.
            </p>
          </div>
        </div>

        {/* Controles de Período e Botões de Exportação */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Mês */}
          <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => navegarMes('anterior')}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 py-1 text-center min-w-[140px]">
              <span className="text-xs font-bold text-brand-blue uppercase tracking-wider block">Competência</span>
              <span className="text-sm font-black text-white capitalize">{mesAnoTexto}</span>
            </div>
            <button
              onClick={() => navegarMes('proximo')}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Botões de Ação Rápida */}
          <button
            onClick={handleExportarPlanilha}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
            title="Download da Planilha Completa do Contador com abas DRE, Receitas, Despesas e GRUs"
          >
            <FileSpreadsheet size={16} />
            <span>Pacote Contador (.XLSX)</span>
          </button>

          <button
            onClick={handleExportarRelatorioOficialMEI}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-blue/30"
            title="Gera o Relatório Mensal das Receitas Brutas (Anexo X CGSN) no modelo oficial para guarda física"
          >
            <Printer size={16} />
            <span>Relatório MEI (.PDF)</span>
          </button>
        </div>
      </div>

      {/* ── CARDS DE RESUMO DO MÊS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Bruta Total */}
        <div className="bg-brand-dark-light/60 border border-gray-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Entrada Bruta no Mês</span>
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Coins size={18} /></span>
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {formatarMoeda(apuracaoMes.receitaBruta)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>{ordensMes.length} ordens movimentadas</span>
            <span className="text-blue-400 font-semibold">{regimeContabil === 'caixa' ? 'Regime de Caixa' : 'Competência'}</span>
          </div>
        </div>

        {/* Dedução de GRUs / Taxas Federais */}
        <div className="bg-brand-dark-light/60 border border-amber-900/40 p-4 rounded-xl bg-gradient-to-br from-brand-dark-light/60 to-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Taxas GRU Reembolsáveis</span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg"><ShieldCheck size={18} /></span>
          </div>
          <div className="text-2xl font-black text-amber-300 mt-2">
            {formatarMoeda(apuracaoMes.taxasGru)}
          </div>
          <p className="text-[11px] text-amber-400/80 mt-1">
            PF / Exército (Excluído da base de faturamento MEI)
          </p>
        </div>

        {/* Faturamento Líquido Real (Honorários) */}
        <div className="bg-brand-dark-light/60 border border-emerald-900/40 p-4 rounded-xl bg-gradient-to-br from-brand-dark-light/60 to-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Faturamento Real (MEI)</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><TrendingUp size={18} /></span>
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-2">
            {formatarMoeda(apuracaoMes.receitaLiquida)}
          </div>
          <p className="text-[11px] text-emerald-400/80 mt-1">
            Honorários da empresa sujeitos à contabilidade
          </p>
        </div>

        {/* Lucro Líquido Contábil */}
        <div className="bg-brand-dark-light/60 border border-gray-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lucro Líquido do Mês</span>
            <span className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><DollarSign size={18} /></span>
          </div>
          <div className={`text-2xl font-black mt-2 ${apuracaoMes.lucroLiquido >= 0 ? 'text-purple-300' : 'text-red-400'}`}>
            {formatarMoeda(apuracaoMes.lucroLiquido)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>Saídas: {formatarMoeda(apuracaoMes.totalSaidasGeral)}</span>
            <span className="text-purple-400 font-semibold">
              {apuracaoMes.receitaLiquida > 0 ? `${((apuracaoMes.lucroLiquido / apuracaoMes.receitaLiquida) * 100).toFixed(1)}% margem` : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* ── NAVEGAÇÃO ENTRE ABAS ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAbaAtiva('visao_geral')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              abaAtiva === 'visao_geral'
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <TrendingUp size={16} />
            <span>Termômetro MEI & Teto Anual</span>
          </button>

          <button
            onClick={() => setAbaAtiva('relatorio_mei')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              abaAtiva === 'relatorio_mei'
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FileText size={16} />
            <span>Relatório Oficial MEI (Anexo X)</span>
          </button>

          <button
            onClick={() => setAbaAtiva('dre')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              abaAtiva === 'dre'
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Layers size={16} />
            <span>DRE & Cruzamento de Resultados</span>
          </button>

          <button
            onClick={() => setAbaAtiva('meios_pagamento')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              abaAtiva === 'meios_pagamento'
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <PieChart size={16} />
            <span>Conciliação DIMP / Meios de Pgto</span>
          </button>

          <button
            onClick={() => setAbaAtiva('fechamento')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              abaAtiva === 'fechamento'
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Fechamento Mensal do Contador</span>
            {statusFechamento === 'fechado' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Alternador de Regime (Caixa vs Competência) */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-1 text-xs">
          <span className="text-gray-400 px-2 font-medium">Regime:</span>
          <button
            onClick={() => setRegimeContabil('caixa')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              regimeContabil === 'caixa' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Regime de Caixa: Considera a data real que o dinheiro caiu na conta/maquininha (padrão MEI)"
          >
            Caixa
          </button>
          <button
            onClick={() => setRegimeContabil('competencia')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              regimeContabil === 'competencia' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Regime de Competência: Considera a data de emissão/prestação do serviço (padrão ME / Simples)"
          >
            Competência
          </button>
        </div>
      </div>

      {/* ── CONTEÚDO DA ABA ATIVA ─────────────────────────────────────────── */}

      {/* ABA 1: TERMÔMETRO MEI & TETO ANUAL */}
      {abaAtiva === 'visao_geral' && (
        <div className="space-y-6 animate-fade-in">
          {/* Card Principal: Barra de Progresso do Teto MEI */}
          <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">Saúde Fiscal do Exercício {anoAtual}</span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Termômetro de Faturamento Acumulado no Ano
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Base líquida de honorários apurada: <strong className="text-white">{formatarMoeda(apuracaoAno.faturamentoTributavelAno)}</strong> de <strong className="text-white">{formatarMoeda(LIMITE_MEI_ANUAL)}</strong>.
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {apuracaoAno.percentualMEI <= 75 ? (
                  <span className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Operação Segura no MEI
                  </span>
                ) : apuracaoAno.percentualMEI <= 100 ? (
                  <span className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-2">
                    <AlertTriangle size={16} /> Atenção: Próximo ao Limite de R$ 81k
                  </span>
                ) : apuracaoAno.percentualTolerancia <= 100 ? (
                  <span className="px-4 py-2 rounded-xl text-xs font-black bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center gap-2">
                    <AlertTriangle size={16} /> Faixa de Tolerância (Desenquadra em {anoAtual + 1})
                  </span>
                ) : (
                  <span className="px-4 py-2 rounded-xl text-xs font-black bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-2">
                    <AlertTriangle size={16} /> Estouro de Limite (&gt; R$ 97,2k)
                  </span>
                )}
              </div>
            </div>

            {/* Barra Gráfica de Teto */}
            <div className="space-y-2 mt-6">
              <div className="flex justify-between text-xs font-bold text-gray-400">
                <span>R$ 0,00</span>
                <span>Teto Oficial MEI: R$ 81.000,00 (100%)</span>
                <span>Tolerância 20%: R$ 97.200,00</span>
              </div>
              <div className="h-4 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700/60 p-0.5 relative">
                {/* Marcador dos 81k */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10" 
                  style={{ left: `${(LIMITE_MEI_ANUAL / LIMITE_MEI_TOLERANCIA_20) * 100}%` }}
                  title="Teto Oficial de R$ 81.000,00"
                />
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    apuracaoAno.percentualMEI <= 70
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : apuracaoAno.percentualMEI <= 95
                      ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (apuracaoAno.faturamentoTributavelAno / LIMITE_MEI_TOLERANCIA_20) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                <span>Consumido: <strong className="text-white">{apuracaoAno.percentualMEI.toFixed(1)}% do teto anual</strong></span>
                <span>Saldo restante até R$ 81k: <strong className="text-emerald-400">{formatarMoeda(Math.max(0, LIMITE_MEI_ANUAL - apuracaoAno.faturamentoTributavelAno))}</strong></span>
              </div>
            </div>

            {/* Projeção Inteligente e Avisos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
              <div className="p-3.5 bg-gray-900/60 border border-gray-800 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Média Mensal do Ano</span>
                <div className="text-lg font-black text-white mt-1">
                  {formatarMoeda(apuracaoAno.mediaMensalFaturamento)} / mês
                </div>
                <span className="text-[11px] text-gray-500">Média máxima permitida MEI: R$ 6.750,00</span>
              </div>

              <div className="p-3.5 bg-gray-900/60 border border-gray-800 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Previsão de Fechamento do Ano</span>
                <div className="text-lg font-black text-brand-blue mt-1">
                  {formatarMoeda(apuracaoAno.projecaoAnual)}
                </div>
                <span className="text-[11px] text-gray-500">Projeção estimada no ritmo atual</span>
              </div>

              <div className="p-3.5 bg-gray-900/60 border border-gray-800 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Alerta de Desenquadramento</span>
                <div className="text-lg font-black mt-1 text-amber-400">
                  {apuracaoAno.mesEstouroEstimado ? `Estouro previsto em ${apuracaoAno.mesEstouroEstimado}` : 'Sem risco previsto'}
                </div>
                <span className="text-[11px] text-gray-500">Baseado no giro financeiro acumulado</span>
              </div>
            </div>
          </div>

          {/* Grid: Regra dos 80% de Compras & Simulador de Transição ME */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regra dos 80% de Compras do MEI */}
            <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Regra dos 80% de Compras / Despesas</h3>
                  <p className="text-xs text-gray-400">Limite legal de aquisições de insumos e mercadorias</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Pela legislação da Receita Federal, o valor total de compras e despesas com insumos do MEI não pode ultrapassar <strong>80% das receitas brutas</strong> apuradas. Caso ultrapasse, a Receita pode presumir faturamento oculto e desenquadrar a empresa de ofício.
              </p>

              <div className="space-y-2 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Compras/Insumos no Ano:</span>
                  <span className="font-bold text-white">{formatarMoeda(apuracaoAno.totalComprasInsumosAno)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Limite Máximo Permitido (80% da receita):</span>
                  <span className="font-bold text-amber-400">{formatarMoeda(apuracaoAno.limiteComprasPermitido)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-gray-800">
                  <span className="text-gray-400">Percentual de Compras Utilizado:</span>
                  <span className={`font-bold ${apuracaoAno.percentualCompras <= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {apuracaoAno.percentualCompras.toFixed(1)}% (Status: {apuracaoAno.percentualCompras <= 80 ? 'Regular' : 'Atenção'})
                  </span>
                </div>
              </div>
            </div>

            {/* Simulador Tributário: Transição para Microempresa (Simples Nacional) */}
            <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Simulador de Transição para ME (Simples)</h3>
                  <p className="text-xs text-gray-400">Planejamento tributário para quando o negócio ultrapassar o MEI</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Ao migrar para <strong>Microempresa (ME)</strong>, o limite de faturamento sobe para <strong>R$ 360.000,00/ano</strong>. A empresa passa a recolher tributos pelo Simples Nacional (Anexo III para serviços de despachante com alíquota inicial em 6%).
              </p>

              <div className="space-y-2 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Faturamento Mensal Atual:</span>
                  <span className="font-bold text-white">{formatarMoeda(apuracaoMes.receitaLiquida)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">DAS-MEI Atual (Fixo):</span>
                  <span className="font-bold text-emerald-400">~R$ 75,00 a R$ 80,00 / mês</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-gray-800">
                  <span className="text-gray-400">Simulação Imposto ME (Anexo III - 6%):</span>
                  <span className="font-bold text-purple-400">{formatarMoeda(apuracaoAno.impostoMensalEstimadoSimples)} / mês</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Novo Teto de Faturamento ME:</span>
                  <span className="font-bold text-blue-400">R$ 360.000,00 / ano</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RELATÓRIO OFICIAL MEI (ANEXO X) */}
      {abaAtiva === 'relatorio_mei' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">Obrigação Acessória Oficial</span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Relatório Mensal das Receitas Brutas (Anexo X CGSN)
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Documento exigido pelo Art. 106 da Resolução CGSN nº 140/2018 para guarda e comprovação da apuração fiscal do MEI.
                </p>
              </div>

              <button
                onClick={handleExportarRelatorioOficialMEI}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-blue/30 self-start md:self-auto"
              >
                <Printer size={16} />
                <span>Imprimir Modelo Oficial (.PDF)</span>
              </button>
            </div>

            {/* Visualização Idêntica ao Modelo da Receita Federal */}
            <div className="mt-6 bg-gray-950 border border-gray-800 rounded-xl p-6 font-sans space-y-6">
              {/* Cabeçalho */}
              <div className="text-center space-y-1 pb-4 border-b border-gray-800">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  RELATÓRIO MENSAL DAS RECEITAS BRUTAS
                </h3>
                <p className="text-xs text-gray-400">Anexo X da Resolução CGSN nº 140, de 22 de maio de 2018</p>
              </div>

              {/* Identificação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                <div>
                  <span className="text-gray-400 block font-medium">CNPJ:</span>
                  <span className="font-bold text-white text-sm">{usuario?.dadosEmpresa?.cnpj || 'Não informado / Em cadastro'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Empreendedor Individual:</span>
                  <span className="font-bold text-white text-sm">{usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.dadosEmpresa?.nome || 'Portal G CAC'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Período de Apuração:</span>
                  <span className="font-bold text-brand-blue text-sm uppercase">{mesAnoTexto}</span>
                </div>
              </div>

              {/* Tabela Oficial */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-gray-800">
                  <thead className="bg-gray-900/90 text-gray-300 uppercase text-[11px]">
                    <tr>
                      <th className="p-3 border-b border-gray-800">Discriminação das Receitas Brutas Mensais</th>
                      <th className="p-3 border-b border-gray-800 text-right w-44">Valor Apurado (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/80">
                    <tr className="bg-gray-900/30">
                      <td colSpan={2} className="p-2.5 font-black text-gray-200 uppercase bg-gray-900/50">
                        RECEITA BRUTA MENSAL — REVENDA DE MERCADORIAS (COMÉRCIO)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-gray-400">I - Revenda de mercadorias com dispensa de emissão de documento fiscal</td>
                      <td className="p-2.5 text-right font-medium text-white">{formatarMoeda(0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-gray-400">II - Revenda de mercadorias com documento fiscal emitido</td>
                      <td className="p-2.5 text-right font-medium text-white">{formatarMoeda(0)}</td>
                    </tr>
                    <tr className="bg-gray-900/20 font-bold">
                      <td className="p-2.5 pl-6 text-gray-300">III - Total das receitas com revenda de mercadorias (I + II)</td>
                      <td className="p-2.5 text-right text-brand-blue">{formatarMoeda(0)}</td>
                    </tr>

                    <tr className="bg-gray-900/30">
                      <td colSpan={2} className="p-2.5 font-black text-gray-200 uppercase bg-gray-900/50">
                        RECEITA BRUTA MENSAL — PRESTAÇÃO DE SERVIÇOS
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-gray-400">VII - Receita com prestação de serviços com dispensa de emissão de documento fiscal</td>
                      <td className="p-2.5 text-right font-medium text-white">{formatarMoeda(apuracaoMes.receitaLiquida)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6 text-gray-400">VIII - Receita com prestação de serviços com documento fiscal emitido</td>
                      <td className="p-2.5 text-right font-medium text-white">{formatarMoeda(0)}</td>
                    </tr>
                    <tr className="bg-gray-900/20 font-bold">
                      <td className="p-2.5 pl-6 text-gray-300">IX - Total das receitas com prestação de serviços (VII + VIII)</td>
                      <td className="p-2.5 text-right text-emerald-400">{formatarMoeda(apuracaoMes.receitaLiquida)}</td>
                    </tr>

                    <tr className="bg-brand-blue/15 font-black text-sm border-t-2 border-brand-blue/40">
                      <td className="p-3 text-white uppercase">X - TOTAL GERAL DAS RECEITAS BRUTAS NO MÊS (III + VI + IX)</td>
                      <td className="p-3 text-right text-emerald-300">{formatarMoeda(apuracaoMes.receitaLiquida)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Informações Complementares e Dedução de GRU */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-xs text-amber-300/90">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Info size={16} /> Nota Explicativa Contábil para o Contador / Fisco:
                </div>
                <p>
                  • Foram arrecadados e repassados no mês <strong>{formatarMoeda(apuracaoMes.taxasGru)}</strong> em Taxas Federais (GRUs da Polícia Federal, Exército e IBAMA). Estas taxas representam meros reembolsos de custas públicas em nome dos clientes e <strong>não integram a receita própria tributável</strong> da empresa.
                </p>
                <p>
                  • Devem ser anexados a este relatório todos os comprovantes de compras e despesas do mês, mantendo-os em arquivo pelo prazo legal de 5 anos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: DRE & CRUZAMENTO DE RESULTADOS */}
      {abaAtiva === 'dre' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">Demonstrativo Contábil</span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  DRE Gerencial — Apuração de Entradas x Saídas
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Visão contábil estruturada por contas de resultado ({regimeContabil === 'caixa' ? 'Regime de Caixa' : 'Regime de Competência'}).
                </p>
              </div>

              <button
                onClick={handleExportarPlanilha}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md self-start md:self-auto"
              >
                <Download size={14} />
                <span>Exportar DRE em Planilha</span>
              </button>
            </div>

            {/* Linhas da DRE Estruturada */}
            <div className="space-y-3 font-mono text-xs">
              {/* 1. Receita Bruta */}
              <div className="flex items-center justify-between p-3 bg-gray-900/80 rounded-xl border border-gray-800">
                <span className="font-bold text-white text-sm">(+) RECEITA BRUTA OPERACIONAL (ENTRADAS TOTAIS)</span>
                <span className="font-bold text-white text-sm">{formatarMoeda(apuracaoMes.receitaBruta)}</span>
              </div>

              {/* 2. Dedução GRU */}
              <div className="flex items-center justify-between p-3 pl-8 bg-amber-950/20 rounded-xl border border-amber-900/30 text-amber-300">
                <span>(-) Taxas Públicas Reembolsáveis (GRU Polícia Federal / Exército)</span>
                <span className="font-bold">-{formatarMoeda(apuracaoMes.taxasGru)}</span>
              </div>

              {/* 3. Receita Líquida */}
              <div className="flex items-center justify-between p-3 bg-brand-blue/15 rounded-xl border border-brand-blue/30 text-brand-blue-light font-bold">
                <span>(=) RECEITA OPERACIONAL LÍQUIDA (BASE CONTÁBIL DO ESCRITÓRIO)</span>
                <span className="text-sm">{formatarMoeda(apuracaoMes.receitaLiquida)}</span>
              </div>

              {/* 4. Custos Diretos */}
              {apuracaoMes.custosDiretos > 0 && (
                <div className="flex items-center justify-between p-3 pl-8 bg-gray-900/40 rounded-xl text-gray-400">
                  <span>(-) Custos Diretos com Laudos e Terceiros Credenciados</span>
                  <span>-{formatarMoeda(apuracaoMes.custosDiretos)}</span>
                </div>
              )}

              {/* 5. Despesas Operacionais e Insumos */}
              <div className="flex items-center justify-between p-3 pl-8 bg-gray-900/60 rounded-xl text-gray-300">
                <span>(-) Despesas Administrativas e Insumos (Sistemas, Internet, Material de Escritório)</span>
                <span className="text-red-400">-{formatarMoeda(apuracaoMes.despesasOperacionais)}</span>
              </div>

              {/* 6. Folha Prestadores PJ */}
              <div className="flex items-center justify-between p-3 pl-8 bg-gray-900/60 rounded-xl text-gray-300">
                <span>(-) Pagamento a Colaboradores e Prestadores PJ (com emissão de NF)</span>
                <span className="text-red-400">-{formatarMoeda(apuracaoMes.folhaPrestadoresPJ)}</span>
              </div>

              {/* 7. Retirada Pró-labore */}
              {apuracaoMes.proLabore > 0 && (
                <div className="flex items-center justify-between p-3 pl-8 bg-gray-900/60 rounded-xl text-gray-300">
                  <span>(-) Retiradas de Pró-labore dos Sócios / Titular</span>
                  <span className="text-red-400">-{formatarMoeda(apuracaoMes.proLabore)}</span>
                </div>
              )}

              {/* 8. Impostos Pagos */}
              {apuracaoMes.impostosPagos > 0 && (
                <div className="flex items-center justify-between p-3 pl-8 bg-gray-900/60 rounded-xl text-gray-300">
                  <span>(-) Tributos e Impostos Pagos (DAS-MEI / Taxas Municipais)</span>
                  <span className="text-red-400">-{formatarMoeda(apuracaoMes.impostosPagos)}</span>
                </div>
              )}

              {/* 9. Resultado Líquido Final */}
              <div className={`flex items-center justify-between p-4 rounded-xl border text-base font-black ${
                apuracaoMes.lucroLiquido >= 0
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}>
                <span>(=) RESULTADO LÍQUIDO DO PERÍODO (LUCRO / PREJUÍZO CONTÁBIL)</span>
                <span>{formatarMoeda(apuracaoMes.lucroLiquido)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: CONCILIAÇÃO DE MEIOS DE PAGAMENTO (DIMP) */}
      {abaAtiva === 'meios_pagamento' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">Confronto Fisco & DIMP</span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Conciliação por Meio de Pagamento & Adquirentes
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Valores apurados em maquininhas (Stone, Infinity), PIX e espécie no mês de {mesAnoTexto}.
                </p>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs max-w-md">
                <span className="font-bold block">Atenção ao Cruzamento DIMP:</span>
                Todas as adquirentes e bancos informam o Fisco automaticamente. Garanta que o saldo das maquininhas coincida com a apuração.
              </div>
            </div>

            {/* Grid dos Meios de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(apuracaoMes.meiosMap).map(([meio, dados]) => (
                <div key={meio} className="bg-gray-900/70 border border-gray-800 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">{meio}</span>
                    <span className="text-gray-400">{dados.qtd} transações</span>
                  </div>
                  <div className="text-xl font-black text-emerald-400">
                    {formatarMoeda(dados.total)}
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-blue h-full rounded-full" 
                      style={{ width: `${apuracaoMes.receitaBruta > 0 ? (dados.total / apuracaoMes.receitaBruta) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 block text-right">
                    {apuracaoMes.receitaBruta > 0 ? `${((dados.total / apuracaoMes.receitaBruta) * 100).toFixed(1)}% do giro` : '0%'}
                  </span>
                </div>
              ))}
            </div>

            {/* Comparativo com Recibos Emitidos no Mês */}
            <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt size={16} className="text-brand-blue" />
                Cruzamento de Recibos Emitidos vs Pagamentos Recebidos
              </h4>
              <p className="text-xs text-gray-400">
                Total de recibos avulsos emitidos no sistema: <strong className="text-white">{recibos.length} recibos cadastrados</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: FECHAMENTO MENSAL DO CONTADOR & PACOTE */}
      {abaAtiva === 'fechamento' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-brand-dark-light/70 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">Auditoria e Encerramento</span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Fechamento Contábil do Mês — {mesAnoTexto}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Valide a conferência contábil, arquive comprovantes e libere o fechamento do período.
                </p>
              </div>

              {/* Status do Fechamento */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-bold uppercase">Status do Mês:</span>
                <select
                  value={statusFechamento}
                  onChange={(e) => salvarStatusFechamento(e.target.value as any)}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                    statusFechamento === 'fechado'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : statusFechamento === 'em_analise'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-gray-800 text-gray-300 border-gray-700'
                  }`}
                >
                  <option value="aberto">Em Aberto</option>
                  <option value="em_analise">Em Auditoria / Com o Contador</option>
                  <option value="fechado">Fechado e Aprovado pelo Contador</option>
                </select>
              </div>
            </div>

            {/* Checklist de Conferência do Contador */}
            <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Checklist de Validação Fiscal / Contábil
              </h3>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklistFechamento.gru_separadas}
                    onChange={() => toggleChecklist('gru_separadas')}
                    className="w-4 h-4 rounded text-brand-blue bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">
                    Taxas de GRU da Polícia Federal e Exército devidamente isoladas da receita bruta (Total: <strong>{formatarMoeda(apuracaoMes.taxasGru)}</strong>).
                  </span>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklistFechamento.despesas_conferidas}
                    onChange={() => toggleChecklist('despesas_conferidas')}
                    className="w-4 h-4 rounded text-brand-blue bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">
                    Todas as despesas administrativas e notas fiscais de insumos foram anexadas e conferidas ({despesasMes.length} despesas lançadas).
                  </span>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklistFechamento.extrato_cartoes_batido}
                    onChange={() => toggleChecklist('extrato_cartoes_batido')}
                    className="w-4 h-4 rounded text-brand-blue bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">
                    Extratos de maquininhas de cartão (Stone e Infinity) e PIX PJ batidos com os registros do sistema.
                  </span>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklistFechamento.nfs_colaboradores_anexadas}
                    onChange={() => toggleChecklist('nfs_colaboradores_anexadas')}
                    className="w-4 h-4 rounded text-brand-blue bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">
                    Notas fiscais de prestação de serviços dos colaboradores/equipe PJ emitidas e validadas ({fechamentosMes.length} fechamentos no período).
                  </span>
                </label>
              </div>
            </div>

            {/* Caixa de Ações do Pacote Mensal */}
            <div className="p-5 bg-gradient-to-r from-gray-900 to-gray-950 border border-gray-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">Pacote do Contador para Download</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Baixe os arquivos consolidados e envie diretamente ao escritório de contabilidade.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportarPlanilha}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  <FileSpreadsheet size={16} />
                  <span>Planilha Completa (.XLSX)</span>
                </button>

                <button
                  onClick={handleExportarRelatorioOficialMEI}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  <Printer size={16} />
                  <span>Relatório Oficial MEI (.PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
