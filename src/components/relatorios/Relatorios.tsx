import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  BarChart3, 
  Users, 
  Bell, 
  Calendar, 
  Download, 
  Printer, 
  TrendingUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  Percent, 
  Target, 
  MapPin, 
  Shield, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Info,
  ChevronDown,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { useFinanceiro, CATEGORIAS_DESPESA } from '../../context/FinanceiroContext';
import { useServicos } from '../../context/ServicosContext';
import { buscarAlertasGlobais, buscarAlertasCacsVinculados } from '../../services/vencimentosService';
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone } from '../../utils/formatters';
import { 
  format, 
  parseISO, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  subDays,
  isBefore,
  isAfter
} from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from '../../db/supabase';
import { FORMAS_PAGAMENTO, STATUS_OS, STATUS_EXECUCAO_SERVICO } from '../../types';

type TabType = 'ordens' | 'financeiro' | 'clientes' | 'alertas';
type PeriodoPreset = 'hoje' | 'semana' | 'mes' | '30dias' | 'ano' | 'personalizado';

interface AlertaDocumento {
  id: string;
  tipo: string;
  label: string;
  dataVencimento: string;
  nivel: string;
  diasRestantes: number;
  clienteNome: string;
  clienteId: string;
  armaModelo?: string;
  armaId?: string;
  documentoId?: string;
  isVinculado?: boolean;
  emRenovacao?: boolean;
}

// Helper para evitar travamentos ao digitar datas inválidas ou incompletas
function safeIsWithinInterval(date: Date, start: Date | null, end: Date | null): boolean {
  if (!date || isNaN(date.getTime())) return false;
  if (!start || isNaN(start.getTime())) return true;
  if (!end || isNaN(end.getTime())) return true;
  return isWithinInterval(date, { start, end });
}

export function Relatorios() {
  const { usuario } = useAuth();
  const { ordens } = useOrdens();
  const { clientes } = useClientes();
  const { despesas } = useFinanceiro();
  const { servicos: servicosCatalog } = useServicos();

  // Abas e Filtro de Período Geral
  const [activeTab, setActiveTab] = useState<TabType>('ordens');
  const [presetPeriodo, setPresetPeriodo] = useState<PeriodoPreset>('mes');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Estados locais para dados avançados
  const [armas, setArmas] = useState<any[]>([]);
  const [gts, setGts] = useState<any[]>([]);
  const [manejos, setManejos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<AlertaDocumento[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(false);

  // Estado para visibilidade do painel de filtros interativos
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  // ───────────────────────────────────────────────────────────────────────────
  // ESTADOS DOS FILTROS INTERATIVOS (Por aba)
  // ───────────────────────────────────────────────────────────────────────────
  
  // 1. Aba: Ordens de Serviço
  const [filtroStatusOS, setFiltroStatusOS] = useState<string[]>([...STATUS_OS]);
  const [filtroExecOS, setFiltroExecOS] = useState<string[]>([...STATUS_EXECUCAO_SERVICO]);
  const [filtroResponsavelOS, setFiltroResponsavelOS] = useState<string>('Todos');
  const [filtroCanalOS, setFiltroCanalOS] = useState<string[]>(['WhatsApp', 'Presencial', 'Ligação', 'E-mail', 'Outro']);
  const [filtroNomesServicos, setFiltroNomesServicos] = useState<string[]>([]);

  // 2. Aba: Financeiro
  const [incluirEntradas, setIncluirEntradas] = useState(true);
  const [incluirSaidas, setIncluirSaidas] = useState(true);
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string[]>([...FORMAS_PAGAMENTO]);
  const [filtroCategoriaDespesa, setFiltroCategoriaDespesa] = useState<string[]>([...CATEGORIAS_DESPESA, 'Outros']);
  const [secoesFinanceiro, setSecoesFinanceiro] = useState({
    resumo: true,
    meiosPagamento: true,
    categoriasDespesa: true,
    taxasPF: true,
    comissoes: true,
    extrato: true
  });

  // 3. Aba: Clientes & Acervo
  const [filtroFiliacao, setFiltroFiliacao] = useState<'Todos' | 'Filiados' | 'NaoFiliados'>('Todos');
  const [filtroPossuiArmas, setFiltroPossuiArmas] = useState<'Todos' | 'ComArmas' | 'SemArmas'>('Todos');
  const [colunasClientes, setColunasClientes] = useState({
    cpf: true,
    contato: true,
    filiado: true,
    cr: true,
    vencimentoCr: true,
    crIbama: false, // Ocultado por padrão para economizar espaço
    vencimentoIbama: false, // Ocultado por padrão
    armasCount: true,
    gtsCount: true,
    manejosCount: true
  });

  // 4. Aba: Painel de Alertas
  const [filtroTipoAlerta, setFiltroTipoAlerta] = useState<string[]>(['CR', 'IBAMA_CR', 'CRAF', 'GT', 'MANEJO']);
  const [filtroNivelAlerta, setFiltroNivelAlerta] = useState<string[]>(['VENCIDO', 'CRITICO', 'AVISO', 'EM_RENOVACAO']);

  // Obter lista única de colaboradores/responsáveis pelas OSs
  const listaColaboradoresOS = useMemo(() => {
    const nomes = new Set<string>();
    ordens.forEach(o => {
      o.servicos?.forEach(s => {
        if (s.responsavelNome) {
          nomes.add(s.responsavelNome.trim());
        }
      });
    });
    return Array.from(nomes).sort();
  }, [ordens]);

  // Obter lista única de nomes de serviços registrados nas OSs
  const listaNomesServicos = useMemo(() => {
    const nomes = new Set<string>();
    ordens.forEach(o => {
      o.servicos?.forEach(s => {
        if (s.nome) {
          nomes.add(s.nome.trim());
        }
      });
    });
    return Array.from(nomes).sort();
  }, [ordens]);

  // Manipular alteração de presets de data
  const handlePresetChange = (preset: PeriodoPreset) => {
    setPresetPeriodo(preset);
    const hoje = new Date();
    let inicio = startOfMonth(hoje);
    let fim = endOfMonth(hoje);

    switch (preset) {
      case 'hoje':
        inicio = startOfDay(hoje);
        fim = endOfDay(hoje);
        break;
      case 'semana':
        inicio = startOfWeek(hoje, { weekStartsOn: 1 });
        fim = endOfWeek(hoje, { weekStartsOn: 1 });
        break;
      case 'mes':
        inicio = startOfMonth(hoje);
        fim = endOfMonth(hoje);
        break;
      case '30dias':
        inicio = subDays(hoje, 30);
        fim = endOfDay(hoje);
        break;
      case 'ano':
        inicio = startOfYear(hoje);
        fim = endOfYear(hoje);
        break;
      default:
        return;
    }

    setDataInicio(format(inicio, 'yyyy-MM-dd'));
    setDataFim(format(fim, 'yyyy-MM-dd'));
  };

  // Carregar dados complementares (Armas, GTs, Manejos, Alertas)
  useEffect(() => {
    async function carregarDadosRelatorios() {
      if (!usuario?.empresaId) return;
      setCarregandoDados(true);
      try {
        const { data: armasData } = await supabase
          .from('armas')
          .select('*, clientes:cliente_id(nome)')
          .eq('empresa_id', usuario.empresaId);
        
        const { data: gtsData } = await supabase
          .from('guias_trafego')
          .select('*, armas:arma_id(modelo, cliente_id, clientes:cliente_id(nome))')
          .eq('empresa_id', usuario.empresaId);

        const { data: manejosData } = await supabase
          .from('autorizacoes_manejo')
          .select('*, clientes:cliente_id(nome)')
          .eq('empresa_id', usuario.empresaId);

        const [alertasDiretos, alertasVinculados] = await Promise.all([
          buscarAlertasGlobais(usuario.empresaId),
          buscarAlertasCacsVinculados(usuario.empresaId)
        ]);

        if (armasData) setArmas(armasData);
        if (gtsData) setGts(gtsData);
        if (manejosData) setManejos(manejosData);
        
        const todosAlertas = [...alertasDiretos, ...alertasVinculados];
        setAlertas(todosAlertas as AlertaDocumento[]);

      } catch (err) {
        console.error('Erro ao carregar dados complementares:', err);
      } finally {
        setCarregandoDados(false);
      }
    }

    carregarDadosRelatorios();
  }, [usuario?.empresaId]);

  // Intervalo de Datas Geral
  const intervalFiltro = useMemo(() => {
    const parsedStart = parseISO(dataInicio);
    const parsedEnd = parseISO(dataFim);
    return {
      start: parsedStart instanceof Date && !isNaN(parsedStart.getTime()) ? startOfDay(parsedStart) : null,
      end: parsedEnd instanceof Date && !isNaN(parsedEnd.getTime()) ? endOfDay(parsedEnd) : null
    };
  }, [dataInicio, dataFim]);

  // ───────────────────────────────────────────────────────────────────────────
  // FILTRAGEM REATIVA: ABA ORDENS DE SERVIÇO
  // ───────────────────────────────────────────────────────────────────────────
  const ordensFiltradas = useMemo(() => {
    return ordens.filter(o => {
      // 1. Filtro de Data
      if (!o.criadoEm) return false;
      const dataCriacao = parseISO(o.criadoEm);
      if (!safeIsWithinInterval(dataCriacao, intervalFiltro.start, intervalFiltro.end)) return false;

      // 2. Filtro de Status Financeiro (Se vazio, ignora o filtro)
      if (filtroStatusOS.length > 0 && !filtroStatusOS.includes(o.status)) return false;

      // 3. Filtro de Canal de Atendimento (Se vazio, ignora o filtro)
      if (filtroCanalOS.length > 0) {
        if (o.canalAtendimento && !filtroCanalOS.includes(o.canalAtendimento)) return false;
        if (!o.canalAtendimento && !filtroCanalOS.includes('Outro')) return false;
      }

      // 4. Filtro de Responsável pelo Serviço
      if (filtroResponsavelOS !== 'Todos') {
        const temResponsavel = o.servicos?.some(s => s.responsavelNome?.trim() === filtroResponsavelOS);
        if (!temResponsavel) return false;
      }

      // 5. Filtro de Status de Execução (Se vazio, ignora o filtro)
      if (filtroExecOS.length > 0) {
        if (o.servicos && o.servicos.length > 0) {
          const temExecStatus = o.servicos.some(s => filtroExecOS.includes(s.statusExecucao || 'Não Iniciado'));
          if (!temExecStatus) return false;
        } else {
          if (!filtroExecOS.includes('Não Iniciado')) return false;
        }
      }

      // 6. Filtro de Tipos de Serviço (Se vazio, ignora o filtro)
      if (filtroNomesServicos.length > 0) {
        const temServicoTipo = o.servicos?.some(s => filtroNomesServicos.includes(s.nome?.trim() || ''));
        if (!temServicoTipo) return false;
      }

      return true;
    });
  }, [ordens, intervalFiltro, filtroStatusOS, filtroCanalOS, filtroResponsavelOS, filtroExecOS, filtroNomesServicos]);

  // Estatísticas calculadas sobre a lista de OS filtradas
  const statusOsCounts = useMemo(() => {
    const counts = { Pago: 0, 'Aguardando Pagamento': 0, 'Parcialmente Pago': 0, Gratuidade: 0 };
    ordensFiltradas.forEach(o => {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    });
    return counts;
  }, [ordensFiltradas]);

  const execStatusCounts = useMemo(() => {
    const counts = { 'Não Iniciado': 0, 'Iniciado — Montando Processo': 0, 'Aguardando Documentos': 0, 'Protocolado — Ag. PF': 0, Concluído: 0, 'Cancelado / Não Executado': 0 };
    ordensFiltradas.forEach(o => {
      o.servicos?.forEach(s => {
        const stat = s.statusExecucao || 'Não Iniciado';
        if (stat in counts) counts[stat as keyof typeof counts]++;
      });
    });
    return counts;
  }, [ordensFiltradas]);

  // OS abertas na semana/mês/ano para estatísticas rápidas
  const ordensPorPeriodoSemanaMesAno = useMemo(() => {
    const agora = new Date();
    const startWeek = startOfWeek(agora, { weekStartsOn: 1 });
    const endWeek = endOfWeek(agora, { weekStartsOn: 1 });
    const startMonth = startOfMonth(agora);
    const endMonth = endOfMonth(agora);
    const startYear = startOfYear(agora);
    const endYear = endOfYear(agora);

    let semana = 0, mes = 0, ano = 0;

    ordens.forEach(o => {
      if (!o.criadoEm) return;
      const date = parseISO(o.criadoEm);
      if (isWithinInterval(date, { start: startWeek, end: endWeek })) semana++;
      if (isWithinInterval(date, { start: startMonth, end: endMonth })) mes++;
      if (isWithinInterval(date, { start: startYear, end: endYear })) ano++;
    });

    return { semana, mes, ano };
  }, [ordens]);

  // ───────────────────────────────────────────────────────────────────────────
  // FILTRAGEM REATIVA: ABA FINANCEIRO
  // ───────────────────────────────────────────────────────────────────────────
  
  // Extrato unificado de lançamentos (recebimentos das OS e despesas da empresa)
  const extratoTransacoes = useMemo(() => {
    const transacoes: any[] = [];

    // Recebimentos (Entradas)
    if (incluirEntradas) {
      ordens.forEach(o => {
        const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
        if (ehMigracao) return;

        if (o.historicoPagamentos && o.historicoPagamentos.length > 0) {
          o.historicoPagamentos.forEach(p => {
            if (!p.data) return;
            const dataPag = parseISO(p.data);
            if (safeIsWithinInterval(dataPag, intervalFiltro.start, intervalFiltro.end)) {
              // Filtro por Forma de Pagamento (Se vazio, ignora o filtro)
              if (filtroFormaPagamento.length === 0 || filtroFormaPagamento.includes(p.metodo)) {
                transacoes.push({
                  id: `rec-${p.id}`,
                  ordemId: o.id,
                  ordemNumero: o.numero,
                  data: p.data,
                  tipo: 'entrada',
                  categoria: p.metodo,
                  descricao: `Recebimento OS-${String(o.numero).padStart(4, '0')}`,
                  entidade: o.nomeCliente,
                  valor: p.valor
                });
              }
            }
          });
        } else if ((o.valorPago || 0) > 0 && o.criadoEm) {
          const dataOS = parseISO(o.criadoEm);
          if (safeIsWithinInterval(dataOS, intervalFiltro.start, intervalFiltro.end)) {
            const metodo = o.formaPagamento || 'Outro';
            if (filtroFormaPagamento.length === 0 || filtroFormaPagamento.includes(metodo)) {
              transacoes.push({
                id: `rec-os-${o.id}`,
                ordemId: o.id,
                ordemNumero: o.numero,
                data: o.criadoEm,
                tipo: 'entrada',
                categoria: metodo,
                descricao: `Recebimento OS-${String(o.numero).padStart(4, '0')}`,
                entidade: o.nomeCliente,
                valor: o.valorPago
              });
            }
          }
        }
      });
    }

    // Despesas (Saídas)
    if (incluirSaidas) {
      despesas.forEach(d => {
        if (!d.data) return;
        const dataDespesa = parseISO(d.data);
        if (safeIsWithinInterval(dataDespesa, intervalFiltro.start, intervalFiltro.end)) {
          const cat = d.categoria || 'Outros';
          // Filtro por Categoria de Despesa (Se vazio, ignora o filtro)
          if (filtroCategoriaDespesa.length === 0 || filtroCategoriaDespesa.includes(cat)) {
            transacoes.push({
              id: `desp-${d.id}`,
              data: d.data,
              tipo: 'saida',
              categoria: cat,
              descricao: d.descricao,
              entidade: 'Despesa PJ',
              valor: d.valor
            });
          }
        }
      });
    }

    return transacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [ordens, despesas, intervalFiltro, incluirEntradas, incluirSaidas, filtroFormaPagamento, filtroCategoriaDespesa]);

  // Mapa de taxas padrão por nome de serviço cadastrado
  const catalogTaxaMap = useMemo(() => {
    const map: Record<string, number> = {};
    (servicosCatalog || []).forEach(sc => {
      if (sc.nome && typeof sc.taxaPF === 'number') {
        map[sc.nome.trim()] = sc.taxaPF;
      }
    });
    return map;
  }, [servicosCatalog]);

  // Identificação das ordens únicas que geraram receita ou pagamento no período filtrado
  const ordensPagasNoPeriodo = useMemo(() => {
    const ids = new Set<string>();
    const lista: typeof ordens = [];

    // 1. Ordens que tiveram lançamentos de entrada no extrato filtrado do período
    extratoTransacoes.forEach(t => {
      if (t.tipo === 'entrada' && t.ordemId && !ids.has(t.ordemId)) {
        const ord = ordens.find(o => o.id === t.ordemId);
        if (ord) {
          ids.add(ord.id);
          lista.push(ord);
        }
      }
    });

    // 2. Ordens criadas no período com pagamento confirmado
    ordens.forEach(o => {
      const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
      if (ehMigracao) return;
      if (ids.has(o.id)) return;
      if (!o.criadoEm) return;
      const dataCriacao = parseISO(o.criadoEm);
      if (safeIsWithinInterval(dataCriacao, intervalFiltro.start, intervalFiltro.end)) {
        if ((o.status === 'Pago' || o.status === 'Parcialmente Pago') && (o.valorPago || 0) > 0) {
          ids.add(o.id);
          lista.push(o);
        }
      }
    });

    return lista;
  }, [extratoTransacoes, ordens, intervalFiltro]);

  // Detalhamento de Faturamento e Taxas PF por Tipo de Serviço no Período
  const servicosBreakdown = useMemo(() => {
    const map: Record<string, { nome: string; count: number; bruto: number; taxas: number; liquido: number }> = {};

    ordensPagasNoPeriodo.forEach(o => {
      const valorOS = (o.valor || 0) > 0 ? o.valor : 1;
      const valorPagoOS = o.valorPago || 0;
      const ehPago = o.status === 'Pago' || o.status === 'Parcialmente Pago';

      (o.servicos || []).forEach(s => {
        const nomeServ = s.nome?.trim() || 'Serviço Não Identificado';
        if (!map[nomeServ]) {
          map[nomeServ] = { nome: nomeServ, count: 0, bruto: 0, taxas: 0, liquido: 0 };
        }

        const servVal = (s.valor !== undefined && s.valor > 0) ? s.valor : (valorOS / (o.servicos.length || 1));
        const brutoProp = valorOS > 0 ? (servVal / valorOS) * valorPagoOS : servVal;
        const taxaProp = ehPago ? (Number(s.taxaPF) || catalogTaxaMap[s.nome?.trim() || ''] || 0) : 0;
        const liquidoProp = brutoProp - taxaProp;

        map[nomeServ].count += 1;
        map[nomeServ].bruto += brutoProp;
        map[nomeServ].taxas += taxaProp;
        map[nomeServ].liquido += liquidoProp;
      });
    });

    return Object.values(map).sort((a, b) => b.bruto - a.bruto);
  }, [ordensPagasNoPeriodo, catalogTaxaMap]);

  // Estatísticas consolidadas com base nas transações ativas no extrato filtrado e dedução de Taxas PF
  const faturamentoStats = useMemo(() => {
    let faturamentoBruto = 0;
    let totalDespesasVal = 0;
    let aReceberVal = 0;

    extratoTransacoes.forEach(t => {
      if (t.tipo === 'entrada') faturamentoBruto += t.valor;
      else totalDespesasVal += t.valor;
    });

    // Calcular "A Receber" apenas das OSs do período filtrado
    ordens.forEach(o => {
      if (!o.criadoEm) return;
      const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
      if (ehMigracao) return;
      const dataCriacao = parseISO(o.criadoEm);
      if (safeIsWithinInterval(dataCriacao, intervalFiltro.start, intervalFiltro.end)) {
        if (o.status !== 'Pago' && o.status !== 'Gratuidade') {
          const restante = Math.max(0, (o.valor || 0) - (o.desconto || 0) - (o.valorPago || 0));
          aReceberVal += restante;
        }
      }
    });

    // Dedução das Taxas PF (GRU Operacionais) das ordens pagas no período
    let totalTaxasPF = 0;
    if (incluirEntradas) {
      ordensPagasNoPeriodo.forEach(o => {
        let taxaOS = Number(o.taxaPFTotal) || 0;
        const sumServ = (o.servicos || []).reduce((acc, s) => {
          const t = Number(s.taxaPF) || catalogTaxaMap[s.nome?.trim() || ''] || 0;
          return acc + t;
        }, 0);
        taxaOS = Math.max(taxaOS, sumServ);
        totalTaxasPF += taxaOS;
      });
    }

    const margemBruta = faturamentoBruto - totalTaxasPF;
    const saldoLiquido = margemBruta - totalDespesasVal;
    const margemLucro = faturamentoBruto > 0 ? (saldoLiquido / faturamentoBruto) * 100 : 0;

    return {
      faturamentoBruto,
      totalTaxasPF,
      margemBruta,
      totalDespesas: totalDespesasVal,
      saldoLiquido,
      margemLucro,
      aReceber: aReceberVal
    };
  }, [extratoTransacoes, ordens, intervalFiltro, incluirEntradas, ordensPagasNoPeriodo, catalogTaxaMap]);

  // Agrupamento de receitas por meio de pagamento (dos filtros ativos)
  const receitasPorMetodo = useMemo(() => {
    const metodos: Record<string, { count: number; total: number }> = {};
    extratoTransacoes.filter(t => t.tipo === 'entrada').forEach(t => {
      const met = t.categoria;
      if (!metodos[met]) metodos[met] = { count: 0, total: 0 };
      metodos[met].count++;
      metodos[met].total += t.valor;
    });
    return Object.entries(metodos).map(([metodo, dados]) => ({
      metodo, ...dados
    })).sort((a, b) => b.total - a.total);
  }, [extratoTransacoes]);

  // Agrupamento de despesas por categoria (dos filtros ativos)
  const despesasPorCategoria = useMemo(() => {
    const categorias: Record<string, { count: number; total: number }> = {};
    extratoTransacoes.filter(t => t.tipo === 'saida').forEach(t => {
      const cat = t.categoria;
      if (!categorias[cat]) categorias[cat] = { count: 0, total: 0 };
      categorias[cat].count++;
      categorias[cat].total += t.valor;
    });
    return Object.entries(categorias).map(([categoria, dados]) => ({
      categoria, ...dados
    })).sort((a, b) => b.total - a.total);
  }, [extratoTransacoes]);

  // Fechamento de Comissões e Repasses por Colaborador no período filtrado
  const comissoesEquipe = useMemo(() => {
    const repasses: Record<string, { count: number; total: number }> = {};
    ordensFiltradas.forEach(o => {
      o.servicos?.forEach(s => {
        const resp = s.responsavelNome;
        const valorRep = s.valorRepasse || 0;
        if (resp && valorRep > 0) {
          const respTrim = resp.trim();
          if (!repasses[respTrim]) repasses[respTrim] = { count: 0, total: 0 };
          repasses[respTrim].count++;
          repasses[respTrim].total += valorRep;
        }
      });
    });
    return Object.entries(repasses).map(([colaborador, dados]) => ({
      colaborador, ...dados
    })).sort((a, b) => b.total - a.total);
  }, [ordensFiltradas]);

  // ───────────────────────────────────────────────────────────────────────────
  // FILTRAGEM REATIVA: ABA CLIENTES & ACERVO
  // ───────────────────────────────────────────────────────────────────────────
  const tabelaClientesRelatorio = useMemo(() => {
    // 1. Filtrar a lista bruta de clientes
    const clientesFiltrados = clientes.filter(c => {
      // Filtro de Filiação ProTiro
      if (filtroFiliacao === 'Filiados' && !c.filiadoProTiro) return false;
      if (filtroFiliacao === 'NaoFiliados' && c.filiadoProTiro) return false;

      // Filtro de Possuir Armas no Acervo
      const armasCliCount = armas.filter(a => a.cliente_id === c.id).length;
      if (filtroPossuiArmas === 'ComArmas' && armasCliCount === 0) return false;
      if (filtroPossuiArmas === 'SemArmas' && armasCliCount > 0) return false;

      return true;
    });

    // 2. Mapear e enriquecer os dados para exibição na tabela
    return clientesFiltrados.map(c => {
      const armasCliente = armas.filter(a => a.cliente_id === c.id);
      const gtsCliente = gts.filter(g => g.armas?.cliente_id === c.id || (g.arma_id && armasCliente.some(a => a.id === g.arma_id)));
      const manejosCliente = manejos.filter(m => m.cliente_id === c.id && m.status === 'Ativo');

      return {
        id: c.id,
        nome: c.nome,
        cpf: c.cpf,
        contato: c.contato,
        filiado: c.filiadoProTiro ? 'Sim' : 'Não',
        numeroCr: c.numeroCr || 'N/I',
        vencimentoCr: c.vencimentoCr ? formatarData(c.vencimentoCr) : 'N/I',
        vencimentoCrRaw: c.vencimentoCr,
        numeroCrIbama: c.numeroCrIbama || 'N/I',
        vencimentoCrIbama: c.vencimentoCrIbama ? formatarData(c.vencimentoCrIbama) : 'N/I',
        vencimentoCrIbamaRaw: c.vencimentoCrIbama,
        armasCount: armasCliente.length,
        gtsCount: gtsCliente.length,
        manejosCount: manejosCliente.length
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clientes, armas, gts, manejos, filtroFiliacao, filtroPossuiArmas]);

  // Estatísticas reativas baseadas na listagem filtrada de clientes
  const clientesStats = useMemo(() => {
    const total = tabelaClientesRelatorio.length;
    const filiados = tabelaClientesRelatorio.filter(c => c.filiado === 'Sim').length;
    const naoFiliados = total - filiados;

    // Calcular totais de armas, gts e manejos vinculados aos clientes da lista atual
    let totalArmas = 0, totalGts = 0, totalManejos = 0;
    tabelaClientesRelatorio.forEach(c => {
      totalArmas += c.armasCount;
      totalGts += c.gtsCount;
      totalManejos += c.manejosCount;
    });

    return { total, filiados, naoFiliados, totalArmas, totalGts, totalManejos };
  }, [tabelaClientesRelatorio]);

  // Distribuição de armas baseada apenas nas armas dos clientes exibidos na tabela atual
  const armasFiltradasClientes = useMemo(() => {
    const clientIds = new Set(tabelaClientesRelatorio.map(c => c.id));
    return armas.filter(a => clientIds.has(a.cliente_id));
  }, [armas, tabelaClientesRelatorio]);

  const armasPorAcervo = useMemo(() => {
    const acervos = { 'Tiro Desportivo': 0, 'Caça': 0, 'Coleção': 0 };
    armasFiltradasClientes.forEach(a => {
      const ac = a.acervo || 'Tiro Desportivo';
      if (ac in acervos) acervos[ac as keyof typeof acervos]++;
    });
    return Object.entries(acervos).map(([acervo, count]) => ({ acervo, count }));
  }, [armasFiltradasClientes]);

  const armasPorFabricante = useMemo(() => {
    const fabricantes: Record<string, number> = {};
    armasFiltradasClientes.forEach(a => {
      if (a.fabricante) {
        const fab = a.fabricante.toUpperCase().trim();
        fabricantes[fab] = (fabricantes[fab] || 0) + 1;
      }
    });
    return Object.entries(fabricantes)
      .map(([fabricante, count]) => ({ fabricante, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [armasFiltradasClientes]);

  const armasPorCalibre = useMemo(() => {
    const calibres: Record<string, number> = {};
    armasFiltradasClientes.forEach(a => {
      if (a.calibre) {
        const cal = a.calibre.toUpperCase().trim();
        calibres[cal] = (calibres[cal] || 0) + 1;
      }
    });
    return Object.entries(calibres)
      .map(([calibre, count]) => ({ calibre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [armasFiltradasClientes]);

  // ───────────────────────────────────────────────────────────────────────────
  // FILTRAGEM REATIVA: ABA PAINEL DE ALERTAS
  // ───────────────────────────────────────────────────────────────────────────
  const alertasFiltrados = useMemo(() => {
    return alertas.filter(a => {
      // 1. Filtro por tipo de documento/alerta (Se vazio, ignora o filtro)
      if (filtroTipoAlerta.length > 0 && !filtroTipoAlerta.includes(a.tipo)) return false;

      // 2. Filtro por nível de gravidade/status (Se vazio, ignora o filtro)
      if (filtroNivelAlerta.length > 0) {
        let nivel = a.nivel;
        if (a.emRenovacao) {
          nivel = 'EM_RENOVACAO';
        } else if (a.nivel === 'VENCIDO' || a.diasRestantes < 0) {
          nivel = 'VENCIDO';
        } else if (a.nivel === 'CRITICO' || a.diasRestantes <= 30) {
          nivel = 'CRITICO';
        } else {
          nivel = 'AVISO';
        }

        if (!filtroNivelAlerta.includes(nivel)) return false;
      }

      // 3. Filtro geral de datas (se houver vencimento no intervalo selecionado)
      if (a.dataVencimento) {
        const dateV = parseISO(a.dataVencimento);
        if (!safeIsWithinInterval(dateV, intervalFiltro.start, intervalFiltro.end)) return false;
      }

      return true;
    });
  }, [alertas, filtroTipoAlerta, filtroNivelAlerta, intervalFiltro]);

  const alertasStats = useMemo(() => {
    let vencidos = 0, criticos = 0, avisos = 0, emRenovacao = 0;

    alertasFiltrados.forEach(a => {
      if (a.emRenovacao) emRenovacao++;
      else if (a.nivel === 'VENCIDO' || a.diasRestantes < 0) vencidos++;
      else if (a.nivel === 'CRITICO' || a.diasRestantes <= 30) criticos++;
      else avisos++;
    });

    return { total: alertasFiltrados.length, vencidos, criticos, avisos, emRenovacao };
  }, [alertasFiltrados]);

  // ───────────────────────────────────────────────────────────────────────────
  // MANIPULADORES DE SELEÇÃO MULTIPLA
  // ───────────────────────────────────────────────────────────────────────────
  const handleToggleFiltroStatusOS = (val: string) => {
    setFiltroStatusOS(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleFiltroExecOS = (val: string) => {
    setFiltroExecOS(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleFiltroCanalOS = (val: string) => {
    setFiltroCanalOS(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleFiltroNomesServicos = (val: string) => {
    setFiltroNomesServicos(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleFormaPagamento = (val: string) => {
    setFiltroFormaPagamento(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleCategoriaDespesa = (val: string) => {
    setFiltroCategoriaDespesa(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleTipoAlerta = (val: string) => {
    setFiltroTipoAlerta(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleNivelAlerta = (val: string) => {
    setFiltroNivelAlerta(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EXPORTAÇÃO EXCEL (.xlsx) respeitando filtros ativos
  // ───────────────────────────────────────────────────────────────────────────
  const exportarParaExcel = () => {
    const wb = XLSX.utils.book_new();
    const dataRefStr = `${dataInicio}_a_${dataFim}`;

    if (activeTab === 'ordens') {
      const resumoOS = [
        ['Métrica', 'Quantidade'],
        ['Total de O.S. Filtradas', ordensFiltradas.length],
        ['Status: Pago', statusOsCounts.Pago],
        ['Status: Aguardando Pagamento', statusOsCounts['Aguardando Pagamento']],
        ['Status: Parcialmente Pago', statusOsCounts['Parcialmente Pago']],
        ['Status: Gratuidade', statusOsCounts.Gratuidade],
        ['Serviços: Não Iniciado', execStatusCounts['Não Iniciado']],
        ['Serviços: Iniciado', execStatusCounts['Iniciado — Montando Processo']],
        ['Serviços: Aguardando Documentos', execStatusCounts['Aguardando Documentos']],
        ['Serviços: Protocolado', execStatusCounts['Protocolado — Ag. PF']],
        ['Serviços: Concluído', execStatusCounts.Concluído],
        ['Serviços: Cancelado / Não Executado', execStatusCounts['Cancelado / Não Executado']],
      ];
      const wsRes = XLSX.utils.aoa_to_sheet(resumoOS);
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo OS');

      const detalheOS = ordensFiltradas.map(o => ({
        'Número OS': o.numero,
        'Cliente': o.nomeCliente,
        'CPF': o.cpf,
        'Contato': o.contato,
        'Data Abertura': o.criadoEm ? format(parseISO(o.criadoEm), 'dd/MM/yyyy HH:mm') : '',
        'Valor Total': o.valor,
        'Desconto': o.desconto || 0,
        'Valor Pago': o.valorPago,
        'Status Financeiro': o.status,
        'Canal Atendimento': o.canalAtendimento || '',
        'Serviços': o.servicos?.map(s => `${s.nome} (${s.statusExecucao || 'N/I'})`).join(' | ') || ''
      }));
      const wsDet = XLSX.utils.json_to_sheet(detalheOS);
      XLSX.utils.book_append_sheet(wb, wsDet, 'Listagem OS');

      XLSX.writeFile(wb, `Relatorio_OrdensServico_Filtrado_${dataRefStr}.xlsx`);

    } else if (activeTab === 'financeiro') {
      const resumoFin = [
        ['Métrica', 'Valor'],
        ['Faturamento Bruto (Entradas)', faturamentoStats.faturamentoBruto],
        ['(-) Dedução Taxas PF (GRU Operacionais)', faturamentoStats.totalTaxasPF],
        ['(=) Margem / Lucro Bruto Operacional', faturamentoStats.margemBruta],
        ['(-) Total Despesas PJ (Saídas)', faturamentoStats.totalDespesas],
        ['(=) Saldo Líquido Real', faturamentoStats.saldoLiquido],
        ['Margem de Lucro Real (%)', faturamentoStats.margemLucro.toFixed(2) + '%'],
        ['A Receber (Previsão Período)', faturamentoStats.aReceber],
      ];
      const wsRes = XLSX.utils.aoa_to_sheet(resumoFin);
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo Financeiro');

      const servicosDet = servicosBreakdown.map(s => ({
        'Serviço Prestado': s.nome,
        'Quantidade': s.count,
        'Faturamento Bruto (R$)': s.bruto,
        'Taxas PF / GRU (R$)': s.taxas,
        'Faturamento Líquido Real (R$)': s.liquido
      }));
      const wsServ = XLSX.utils.json_to_sheet(servicosDet);
      XLSX.utils.book_append_sheet(wb, wsServ, 'Taxas PF e Serviços');

      const extratoDet = extratoTransacoes.map(t => ({
        'Data': format(parseISO(t.data), 'dd/MM/yyyy'),
        'Tipo': t.tipo === 'entrada' ? 'Entrada (Recebimento)' : 'Saída (Despesa)',
        'Categoria / Método': t.categoria,
        'Descrição': t.descricao,
        'Cliente / Destino': t.entidade,
        'Valor (R$)': t.valor
      }));
      const wsExt = XLSX.utils.json_to_sheet(extratoDet);
      XLSX.utils.book_append_sheet(wb, wsExt, 'Extrato Financeiro');

      const comissoesDet = comissoesEquipe.map(c => ({
        'Colaborador': c.colaborador,
        'Serviços Realizados': c.count,
        'Total Comissão (R$)': c.total
      }));
      const wsCom = XLSX.utils.json_to_sheet(comissoesDet);
      XLSX.utils.book_append_sheet(wb, wsCom, 'Comissões');

      XLSX.writeFile(wb, `Relatorio_Financeiro_Filtrado_${dataRefStr}.xlsx`);

    } else if (activeTab === 'clientes') {
      const resumoCli = [
        ['Indicador', 'Valor'],
        ['Clientes Filtrados', clientesStats.total],
        ['Filiados ProTiro', clientesStats.filiados],
        ['Não Filiados', clientesStats.naoFiliados],
        ['Total de Armas dos Clientes', clientesStats.totalArmas],
        ['Total de GTs dos Clientes', clientesStats.totalGts],
        ['Manejos Ativos', clientesStats.totalManejos],
      ];
      const wsRes = XLSX.utils.aoa_to_sheet(resumoCli);
      XLSX.utils.book_append_sheet(wb, wsRes, 'Estatísticas');

      // Exportar apenas colunas visíveis
      const listagemCli = tabelaClientesRelatorio.map(c => {
        const row: Record<string, any> = { 'Nome': c.nome };
        if (colunasClientes.cpf) row['CPF'] = c.cpf;
        if (colunasClientes.contato) row['Contato'] = c.contato;
        if (colunasClientes.filiado) row['Filiado'] = c.filiado;
        if (colunasClientes.cr) row['Nº CR'] = c.numeroCr;
        if (colunasClientes.vencimentoCr) row['Vencimento CR'] = c.vencimentoCr;
        if (colunasClientes.crIbama) row['Nº CR IBAMA'] = c.numeroCrIbama;
        if (colunasClientes.vencimentoIbama) row['Vencimento IBAMA'] = c.vencimentoCrIbama;
        if (colunasClientes.armasCount) row['Armas'] = c.armasCount;
        if (colunasClientes.gtsCount) row['GTs'] = c.gtsCount;
        if (colunasClientes.manejosCount) row['Manejos'] = c.manejosCount;
        return row;
      });
      const wsList = XLSX.utils.json_to_sheet(listagemCli);
      XLSX.utils.book_append_sheet(wb, wsList, 'Clientes');

      const armasDet = armasFiltradasClientes.map(a => ({
        'Proprietário': a.clientes?.nome || 'N/I',
        'Tipo': a.tipo,
        'Modelo': a.modelo,
        'Calibre': a.calibre,
        'Fabricante': a.fabricante,
        'Nº Série': a.numeroSerie,
        'Nº Sigma': a.numeroSigma,
        'Acervo': a.acervo,
        'Vencimento CRAF': a.vencimentoCraf ? format(parseISO(a.vencimentoCraf), 'dd/MM/yyyy') : 'N/I'
      }));
      const wsArm = XLSX.utils.json_to_sheet(armasDet);
      XLSX.utils.book_append_sheet(wb, wsArm, 'Armas Cadastradas');

      XLSX.writeFile(wb, `Relatorio_Clientes_Acervo_Filtrado_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    } else if (activeTab === 'alertas') {
      const resumoAlert = [
        ['Métrica', 'Valor'],
        ['Total Alertas', alertasStats.total],
        ['Vencidos', alertasStats.vencidos],
        ['Críticos (<30d)', alertasStats.criticos],
        ['Avisos (<90d)', alertasStats.avisos],
        ['Em Renovação', alertasStats.emRenovacao]
      ];
      const wsRes = XLSX.utils.aoa_to_sheet(resumoAlert);
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo Alertas');

      const detalheAlert = alertasFiltrados.map(a => ({
        'Tipo Documento': a.tipo,
        'Descrição Registro': a.label,
        'Nome Cliente': a.clienteNome,
        'Vencimento': a.dataVencimento ? format(parseISO(a.dataVencimento), 'dd/MM/yyyy') : '',
        'Dias Restantes': a.diasRestantes,
        'Status Alerta': a.emRenovacao ? 'Em Renovação' : a.diasRestantes < 0 ? 'Vencido' : a.nivel
      }));
      const wsDet = XLSX.utils.json_to_sheet(detalheAlert);
      XLSX.utils.book_append_sheet(wb, wsDet, 'Alertas Documentos');

      XLSX.writeFile(wb, `Relatorio_Vencimentos_Filtrado_${dataRefStr}.xlsx`);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const periodoExibicaoText = useMemo(() => {
    const parsedStart = parseISO(dataInicio);
    const parsedEnd = parseISO(dataFim);
    const startValido = parsedStart instanceof Date && !isNaN(parsedStart.getTime());
    const endValido = parsedEnd instanceof Date && !isNaN(parsedEnd.getTime());

    const txtStart = startValido ? format(parsedStart, 'dd/MM/yyyy') : '—';
    const txtEnd = endValido ? format(parsedEnd, 'dd/MM/yyyy') : '—';

    if (presetPeriodo === 'personalizado') {
      return `Período: ${txtStart} a ${txtEnd}`;
    }
    const presetsNomes = {
      hoje: 'Hoje',
      semana: 'Esta Semana',
      mes: 'Este Mês',
      '30dias': 'Últimos 30 Dias',
      ano: 'Ano Atual'
    };
    return `Período: ${presetsNomes[presetPeriodo as keyof typeof presetsNomes]} (${txtStart} a ${txtEnd})`;
  }, [presetPeriodo, dataInicio, dataFim]);

  return (
    <div className="w-full space-y-6">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, .print\\:hidden, button, input, select, aside, nav, header, .dica-filtros {
            display: none !important;
          }
          
          html, body, #root, #root > div, #scroll-main, main, .flex-grow, .flex-1 {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
          }

          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }

          .print-header {
            display: flex !important;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 4px !important;
            margin-bottom: 12px !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8px !important;
            color: #000 !important;
            background: #fff !important;
          }
          th {
            background-color: #f3f4f6 !important;
            border: 1px solid #d1d5db !important;
            padding: 4px 6px !important;
            font-weight: bold !important;
            text-align: left !important;
            white-space: nowrap !important;
          }
          td {
            border: 1px solid #e5e7eb !important;
            padding: 3px 5px !important;
            color: #000 !important;
          }

          /* Evitar quebra de linha nas colunas comuns de dados nas tabelas */
          table td:nth-child(1),
          table td:nth-child(3),
          table td:nth-child(4),
          table td:nth-child(5),
          table td:nth-child(6),
          table td:nth-child(7) {
            white-space: nowrap !important;
          }

          .print-cards-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .print-cards-grid-6 {
            grid-template-columns: repeat(6, 1fr) !important;
          }
          .print-card {
            border: 1px solid #9ca3af !important;
            background-color: #f9fafb !important;
            padding: 6px !important;
            border-radius: 4px !important;
            text-align: center !important;
          }
          .print-card h4 {
            font-size: 7px !important;
            text-transform: uppercase !important;
            color: #374151 !important;
            margin-bottom: 2px !important;
            font-weight: bold !important;
          }
          .print-card p {
            font-size: 11px !important;
            font-weight: 900 !important;
            color: #000 !important;
            margin: 0 !important;
          }
          
          .print-section-title {
            font-size: 9px !important;
            font-weight: bold !important;
            border-bottom: 1.5px solid #000 !important;
            padding-bottom: 2px !important;
            margin-top: 10px !important;
            margin-bottom: 5px !important;
            text-transform: uppercase !important;
            color: #000 !important;
          }
          
          #print-area {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
          }

          .text-white, .text-gray-300, .text-gray-400 {
            color: #000 !important;
          }
          .text-brand-green, .text-brand-green-light {
            color: #047857 !important;
          }
          .text-brand-blue, .text-brand-blue-light {
            color: #1d4ed8 !important;
          }
          .text-yellow-400, .text-yellow-500 {
            color: #b45309 !important;
          }
          .text-red-400, .text-red-500 {
            color: #b91c1c !important;
          }
        }
      `}} />

      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-dark-5 pb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="text-brand-blue" />
            Central de Relatórios
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Analise e exporte dados consolidados de OS, financeiro, clientes e alertas.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={`btn-ghost btn-sm text-xs flex items-center gap-1.5 ${
              mostrarFiltros ? 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue-light' : 'text-gray-400'
            }`}
            title="Mostrar ou Ocultar Painel de Filtros"
          >
            <Filter size={14} />
            <span>Filtros {mostrarFiltros ? 'Abertos' : 'Fechados'}</span>
          </button>
          <button 
            onClick={handleImprimir}
            className="btn-ghost btn-sm text-xs flex items-center gap-1.5"
            title="Imprimir ou Salvar como PDF"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>
          <button 
            onClick={exportarParaExcel}
            className="btn-success btn-sm text-xs flex items-center gap-1.5 font-bold"
            title="Exportar dados para Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Exportar Planilha</span>
          </button>
        </div>
      </div>

      {/* FILTRO DE DATA GERAL */}
      <div className="card bg-brand-dark-2/50 border-brand-dark-5 p-4 sm:p-5 flex flex-col gap-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex flex-wrap gap-1.5">
            {(['hoje', 'semana', 'mes', '30dias', 'ano'] as PeriodoPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  presetPeriodo === p
                    ? 'bg-brand-blue text-white shadow-glow-blue'
                    : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-400 hover:text-white border border-brand-dark-5'
                }`}
              >
                {p === '30dias' ? '30 Dias' : p === 'mes' ? 'Mês' : p === 'semana' ? 'Semana' : p === 'ano' ? 'Ano' : p}
              </button>
            ))}
            <button
              onClick={() => setPresetPeriodo('personalizado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                presetPeriodo === 'personalizado'
                  ? 'bg-brand-blue text-white shadow-glow-blue'
                  : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-400 hover:text-white border border-brand-dark-5'
              }`}
            >
              Personalizado
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-3 text-gray-500" />
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPresetPeriodo('personalizado');
                }}
                className="bg-brand-dark-4 border border-brand-dark-5 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-blue w-36"
              />
            </div>
            <span className="text-gray-500 text-xs">até</span>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-3 text-gray-500" />
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPresetPeriodo('personalizado');
                }}
                className="bg-brand-dark-4 border border-brand-dark-5 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-blue w-36"
              />
            </div>
          </div>

        </div>
      </div>

      {/* PAINÉIS DE FILTROS INTERATIVOS (Por aba) */}
      {mostrarFiltros && (
        <div className="card bg-brand-dark-3/30 border-brand-dark-5/80 p-4 sm:p-5 space-y-4 print:hidden animate-fade-in">
          
          <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
            <h3 className="text-xs font-black uppercase text-brand-blue-light flex items-center gap-1.5">
              <Filter size={12} />
              Configurar Filtros do Relatório
            </h3>
            <span className="text-[10px] text-gray-500 font-bold">Os filtros abaixo atualizam os dados da tela e as exportações</span>
          </div>

          {/* 1. FILTROS DA ABA: ORDENS DE SERVIÇO */}
          {activeTab === 'ordens' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Status Financeiro */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Status Financeiro</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  {STATUS_OS.map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={filtroStatusOS.includes(status)}
                        onChange={() => handleToggleFiltroStatusOS(status)}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold uppercase tracking-tight">{status}</span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroStatusOS([...STATUS_OS])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroStatusOS([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Status de Execução */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Status de Execução</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  {STATUS_EXECUCAO_SERVICO.map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={filtroExecOS.includes(status)}
                        onChange={() => handleToggleFiltroExecOS(status)}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold uppercase tracking-tight text-left">
                        {status === 'Iniciado — Montando Processo' ? 'Iniciado' : 
                         status === 'Protocolado — Ag. PF' ? 'Protocolado' : status}
                      </span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroExecOS([...STATUS_EXECUCAO_SERVICO])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroExecOS([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Tipos de Serviços */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Tipos de Serviços</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50 max-h-36 overflow-y-auto custom-scrollbar">
                  {listaNomesServicos.length === 0 ? (
                    <span className="text-[10px] text-gray-500 italic">Nenhum serviço registrado</span>
                  ) : (
                    listaNomesServicos.map(nome => (
                      <label key={nome} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                        <input
                          type="checkbox"
                          checked={filtroNomesServicos.includes(nome)}
                          onChange={() => handleToggleFiltroNomesServicos(nome)}
                          className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-semibold uppercase tracking-tight truncate max-w-[140px]" title={nome}>
                          {nome}
                        </span>
                      </label>
                    ))
                  )}
                  {listaNomesServicos.length > 0 && (
                    <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1 mt-auto">
                      <button
                        type="button"
                        onClick={() => setFiltroNomesServicos([...listaNomesServicos])}
                        className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                      >
                        Todos
                      </button>
                      <span className="text-gray-600 text-[9px] font-bold">|</span>
                      <button
                        type="button"
                        onClick={() => setFiltroNomesServicos([])}
                        className="text-[9px] font-black uppercase text-red-400 hover:underline"
                      >
                        Nenhum
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Canal Atendimento */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Canal Atendimento</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  {['WhatsApp', 'Presencial', 'Ligação', 'E-mail', 'Outro'].map(canal => (
                    <label key={canal} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={filtroCanalOS.includes(canal)}
                        onChange={() => handleToggleFiltroCanalOS(canal)}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold uppercase tracking-tight">{canal}</span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroCanalOS(['WhatsApp', 'Presencial', 'Ligação', 'E-mail', 'Outro'])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroCanalOS([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Responsável e Informação */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Responsável pelo Serviço</label>
                  <select
                    value={filtroResponsavelOS}
                    onChange={(e) => setFiltroResponsavelOS(e.target.value)}
                    className="w-full bg-brand-dark-4 border border-brand-dark-5 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="Todos">Todos os Responsáveis</option>
                    {listaColaboradoresOS.map(nome => (
                      <option key={nome} value={nome}>{nome}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-3 text-[10px] text-gray-400 space-y-1">
                  <span className="font-bold text-brand-blue-light uppercase block">💡 Dica de Filtros</span>
                  <p>
                    Se o resultado sair em branco, confirme se o status de execução ou financeiro correspondente está marcado ao lado. Por padrão, deixe <strong>"Todos"</strong> selecionados para listar tudo.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* 2. FILTROS DA ABA: FINANCEIRO */}
          {activeTab === 'financeiro' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 text-xs">
              
              {/* Tipo de Transação */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Tipo de Lançamento</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={incluirEntradas}
                      onChange={() => setIncluirEntradas(!incluirEntradas)}
                      className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-green focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-brand-green-light">Entradas (Faturamento)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={incluirSaidas}
                      onChange={() => setIncluirSaidas(!incluirSaidas)}
                      className="rounded border-brand-dark-5 bg-brand-dark-4 text-red-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-red-400">Saídas (Despesas)</span>
                  </label>
                </div>
              </div>

              {/* Meios de Pagamento */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Formas de Pagamento</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50 max-h-36 overflow-y-auto custom-scrollbar">
                  {FORMAS_PAGAMENTO.map(forma => (
                    <label key={forma} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={filtroFormaPagamento.includes(forma)}
                        onChange={() => handleToggleFormaPagamento(forma)}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold uppercase tracking-tight">{forma}</span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroFormaPagamento([...FORMAS_PAGAMENTO])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroFormaPagamento([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Categorias Despesa */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Categorias de Despesa</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50 max-h-36 overflow-y-auto custom-scrollbar">
                  {[...CATEGORIAS_DESPESA, 'Outros'].map(cat => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={filtroCategoriaDespesa.includes(cat)}
                        onChange={() => handleToggleCategoriaDespesa(cat)}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold uppercase tracking-tight truncate max-w-[150px]" title={cat}>{cat}</span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroCategoriaDespesa([...CATEGORIAS_DESPESA, 'Outros'])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroCategoriaDespesa([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Seções Ativas do Relatório */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Seções Visíveis (PDF / Print)</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  {Object.entries(secoesFinanceiro).map(([chave, ativo]) => (
                    <label key={chave} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={ativo}
                        onChange={() => setSecoesFinanceiro({
                          ...secoesFinanceiro,
                          [chave]: !ativo
                        })}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>
                        {chave === 'resumo' ? 'Resumos rápidos' :
                         chave === 'meiosPagamento' ? 'Meios de Recebimento' :
                         chave === 'categoriasDespesa' ? 'Categorias de Despesa' :
                         chave === 'taxasPF' ? 'Taxas PF (GRU) e Serviços' :
                         chave === 'comissoes' ? 'Comissões de Equipe' : 'Extrato de Caixa'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 3. FILTROS DA ABA: CLIENTES & ACERVO */}
          {activeTab === 'clientes' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
              
              {/* Filtro Filiação */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Filiação do Cliente</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroFiliacao"
                      checked={filtroFiliacao === 'Todos'}
                      onChange={() => setFiltroFiliacao('Todos')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight">Todos os Clientes</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroFiliacao"
                      checked={filtroFiliacao === 'Filiados'}
                      onChange={() => setFiltroFiliacao('Filiados')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-brand-green-light">Filiados (ProTiro)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroFiliacao"
                      checked={filtroFiliacao === 'NaoFiliados'}
                      onChange={() => setFiltroFiliacao('NaoFiliados')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-yellow-400">Clientes Avulsos</span>
                  </label>
                </div>
              </div>

              {/* Filtro Armas */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Armas no Acervo</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroPossuiArmas"
                      checked={filtroPossuiArmas === 'Todos'}
                      onChange={() => setFiltroPossuiArmas('Todos')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight">Indiferente</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroPossuiArmas"
                      checked={filtroPossuiArmas === 'ComArmas'}
                      onChange={() => setFiltroPossuiArmas('ComArmas')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-brand-blue-light">Com Armas Cadastradas</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                    <input
                      type="radio"
                      name="filtroPossuiArmas"
                      checked={filtroPossuiArmas === 'SemArmas'}
                      onChange={() => setFiltroPossuiArmas('SemArmas')}
                      className="rounded-full border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold uppercase tracking-tight text-gray-400">Sem Armas Cadastradas</span>
                  </label>
                </div>
              </div>

              {/* Seletor de Colunas Visíveis */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Colunas Visíveis na Tabela</label>
                <div className="grid grid-cols-2 gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50 max-h-36 overflow-y-auto custom-scrollbar">
                  {Object.entries(colunasClientes).map(([col, ativo]) => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer text-[10px] font-semibold text-gray-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={ativo}
                        onChange={() => setColunasClientes({
                          ...colunasClientes,
                          [col]: !ativo
                        })}
                        className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="truncate max-w-[90px]">
                        {col === 'cpf' ? 'CPF' :
                         col === 'contato' ? 'Contato' :
                         col === 'filiado' ? 'Filiado' :
                         col === 'cr' ? 'Nº CR' :
                         col === 'vencimentoCr' ? 'Venc. CR' :
                         col === 'crIbama' ? 'Nº IBAMA' :
                         col === 'vencimentoIbama' ? 'Venc. IBAMA' :
                         col === 'armasCount' ? 'Armas' :
                         col === 'gtsCount' ? 'GTs' : 'Manejos'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 4. FILTROS DA ABA: PAINEL DE ALERTAS */}
          {activeTab === 'alertas' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              
              {/* Tipo de Documento */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Tipo do Documento / Alerta</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  <div className="grid grid-cols-2 gap-2">
                    {['CR', 'IBAMA_CR', 'CRAF', 'GT', 'MANEJO'].map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                        <input
                          type="checkbox"
                          checked={filtroTipoAlerta.includes(tipo)}
                          onChange={() => handleToggleTipoAlerta(tipo)}
                          className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-semibold uppercase tracking-tight">{tipo}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroTipoAlerta(['CR', 'IBAMA_CR', 'CRAF', 'GT', 'MANEJO'])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroTipoAlerta([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Nível de Gravidade */}
              <div className="space-y-2">
                <label className="text-gray-400 font-bold uppercase block text-[10px] tracking-wider">Gravidade do Alerta</label>
                <div className="flex flex-col gap-2 bg-brand-dark-4/40 p-3 rounded-xl border border-brand-dark-5/50">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'VENCIDO', label: 'Vencidos' },
                      { key: 'CRITICO', label: 'Críticos (<30d)' },
                      { key: 'AVISO', label: 'Avisos (<90d)' },
                      { key: 'EM_RENOVACAO', label: 'Em Renovação' }
                    ].map(nivel => (
                      <label key={nivel.key} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white select-none">
                        <input
                          type="checkbox"
                          checked={filtroNivelAlerta.includes(nivel.key)}
                          onChange={() => handleToggleNivelAlerta(nivel.key)}
                          className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-semibold uppercase tracking-tight truncate max-w-[120px]" title={nivel.label}>{nivel.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1.5 border-t border-brand-dark-5/40 mt-1">
                    <button
                      type="button"
                      onClick={() => setFiltroNivelAlerta(['VENCIDO', 'CRITICO', 'AVISO', 'EM_RENOVACAO'])}
                      className="text-[9px] font-black uppercase text-brand-blue-light hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-600 text-[9px] font-bold">|</span>
                    <button
                      type="button"
                      onClick={() => setFiltroNivelAlerta([])}
                      className="text-[9px] font-black uppercase text-red-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* MENU DE ABAS */}
      <div className="border-b border-brand-dark-5 flex overflow-x-auto print:hidden no-scrollbar">
        <button
          onClick={() => setActiveTab('ordens')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ordens'
              ? 'border-brand-blue text-brand-blue-light bg-brand-blue/5'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <FileText size={16} />
          Ordens de Serviço
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'financeiro'
              ? 'border-brand-blue text-brand-blue-light bg-brand-blue/5'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <BarChart3 size={16} />
          Financeiro
        </button>
        <button
          onClick={() => setActiveTab('clientes')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'clientes'
              ? 'border-brand-blue text-brand-blue-light bg-brand-blue/5'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <Users size={16} />
          Clientes & Acervo
        </button>
        <button
          onClick={() => setActiveTab('alertas')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'alertas'
              ? 'border-brand-blue text-brand-blue-light bg-brand-blue/5'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <Bell size={16} />
          Painel de Alertas
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO IMPRIMÍVEL */}
      <div id="print-area" className="space-y-6">
        
        <div className="hidden print-header">
          <div>
            <h2 className="text-lg font-black text-black tracking-tight">PORTAL GCAC - RELATÓRIOS</h2>
            <p className="text-[10px] text-gray-600 font-bold uppercase">{usuario?.dadosEmpresa?.nome || usuario?.empresaNome || 'GCAC'}</p>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-bold uppercase">
              {activeTab === 'ordens' ? 'Relatório de Ordens de Serviço' :
               activeTab === 'financeiro' ? 'Relatório Financeiro & Fluxo de Caixa' :
               activeTab === 'clientes' ? 'Relatório de Clientes & Acervo' :
               'Relatório de Alertas e Vencimento de Documentos'}
            </h3>
            <p className="text-[9px] text-gray-600 font-bold">{periodoExibicaoText}</p>
          </div>
        </div>

        {carregandoDados && (
          <div className="text-center py-12 print:hidden">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-xs">Carregando dados complementares...</p>
          </div>
        )}

        {/* 1. ABA: ORDENS DE SERVIÇO */}
        {!carregandoDados && activeTab === 'ordens' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-cards-grid">
              <div className="card bg-brand-dark-3 border-brand-dark-5 flex flex-col justify-between print-card">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Total OS no Período</p>
                  <h3 className="text-2xl font-black text-white mt-1">{ordensFiltradas.length}</h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-brand-blue-light font-bold mt-3 print:hidden">
                  <TrendingUp size={12} />
                  <span>Geral da Semana: {ordensPorPeriodoSemanaMesAno.semana}</span>
                </div>
              </div>
              
              <div className="card bg-brand-dark-3 border-brand-dark-5 flex flex-col justify-between print-card">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Aguardando Pagamento</p>
                  <h3 className="text-2xl font-black text-yellow-500 mt-1">{statusOsCounts['Aguardando Pagamento']}</h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold mt-3 print:hidden">
                  <Clock size={12} />
                  <span>Geral do Mês: {ordensPorPeriodoSemanaMesAno.mes}</span>
                </div>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 flex flex-col justify-between print-card">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Pagas / Parciais</p>
                  <h3 className="text-2xl font-black text-brand-green mt-1">
                    {statusOsCounts.Pago + statusOsCounts['Parcialmente Pago']}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold mt-3 print:hidden">
                  <CheckCircle2 size={12} />
                  <span>Geral do Ano: {ordensPorPeriodoSemanaMesAno.ano}</span>
                </div>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 flex flex-col justify-between print-card">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Gratuidades</p>
                  <h3 className="text-2xl font-black text-purple-400 mt-1">{statusOsCounts.Gratuidade}</h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold mt-3 print:hidden">
                  <Info size={12} />
                  <span>Sem custo</span>
                </div>
              </div>
            </div>

            <div className="card bg-brand-dark-3/30 border-brand-dark-5 p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider print-section-title">Status de Execução dos Serviços</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(execStatusCounts).map(([status, count]) => (
                  <div key={status} className="bg-brand-dark-4/50 border border-brand-dark-5/50 rounded-xl p-3 text-center print:border-gray-300 print:bg-gray-50">
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-tight truncate" title={status}>
                      {status === 'Iniciado — Montando Processo' ? 'Iniciado' : 
                       status === 'Protocolado — Ag. PF' ? 'Protocolado' : 
                       status === 'Cancelado / Não Executado' ? 'Cancelado' : status}
                    </p>
                    <h4 className="text-lg font-black text-white mt-1 print:text-black">{count}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">Listagem das Ordens de Serviço do Período</h3>
              <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                  <thead className="bg-brand-dark-4 print:bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">OS</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Cliente</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">CPF</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Abertura</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Valor Total</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Valor Pago</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Serviços</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                    {ordensFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-500">
                          Nenhuma OS encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      ordensFiltradas.map((o) => (
                        <tr key={o.id} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-2.5 text-xs font-bold text-white print:text-black whitespace-nowrap">
                            #{String(o.numero).padStart(4, '0')}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-300 font-bold truncate max-w-[150px] print:text-black">
                            {o.nomeCliente}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap print:text-black">
                            {formatarCPF(o.cpf)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap print:text-black">
                            {o.criadoEm ? format(parseISO(o.criadoEm), 'dd/MM/yyyy') : ''}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-white print:text-black">
                            {formatarMoeda(o.valor)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-brand-green font-bold print:text-black">
                            {formatarMoeda(o.valorPago)}
                          </td>
                          <td className="px-4 py-2.5 text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full ${
                              o.status === 'Pago' ? 'bg-brand-green/10 text-brand-green-light border border-brand-green/20' :
                              o.status === 'Parcialmente Pago' ? 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20' :
                              o.status === 'Gratuidade' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' :
                              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            } print:bg-transparent print:border-none print:text-black print:p-0`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-gray-400 max-w-[200px] truncate print:text-black" title={o.servicos?.map(s => s.nome).join(', ')}>
                            {o.servicos?.map(s => s.nome).join(', ')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* 2. ABA: FINANCEIRO */}
        {!carregandoDados && activeTab === 'financeiro' && (
          <div className="space-y-6">
            
            {/* Resumo */}
            {secoesFinanceiro.resumo && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 print-cards-grid print-cards-grid-6">
                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Faturamento Bruto</p>
                  <h3 className="text-lg sm:text-xl font-black text-brand-green mt-1">{formatarMoeda(faturamentoStats.faturamentoBruto)}</h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <ArrowUpCircle size={10} className="text-brand-green" />
                    <span>Entradas filtradas</span>
                  </div>
                </div>

                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Taxas PF (GRU)</p>
                  <h3 className="text-lg sm:text-xl font-black text-amber-400 mt-1">-{formatarMoeda(faturamentoStats.totalTaxasPF)}</h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <ArrowDownCircle size={10} className="text-amber-400" />
                    <span>Dedução operacional</span>
                  </div>
                </div>

                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Total de Despesas</p>
                  <h3 className="text-lg sm:text-xl font-black text-red-400 mt-1">-{formatarMoeda(faturamentoStats.totalDespesas)}</h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <ArrowDownCircle size={10} className="text-red-400" />
                    <span>Saídas filtradas</span>
                  </div>
                </div>

                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Saldo Líquido Real</p>
                  <h3 className={`text-lg sm:text-xl font-black mt-1 ${faturamentoStats.saldoLiquido >= 0 ? 'text-brand-blue-light' : 'text-red-400'}`}>
                    {formatarMoeda(faturamentoStats.saldoLiquido)}
                  </h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <DollarSign size={10} className="text-brand-blue-light" />
                    <span>Líquido pós taxas</span>
                  </div>
                </div>

                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Margem de Lucro</p>
                  <h3 className="text-lg sm:text-xl font-black text-purple-400 mt-1">{faturamentoStats.margemLucro.toFixed(1)}%</h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <Percent size={10} className="text-purple-400" />
                    <span>Rentabilidade Real</span>
                  </div>
                </div>

                <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">A Receber (Período)</p>
                  <h3 className="text-lg sm:text-xl font-black text-yellow-500 mt-1">{formatarMoeda(faturamentoStats.aReceber)}</h3>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-gray-500 print:hidden">
                    <Clock size={10} className="text-yellow-500" />
                    <span>OS do período</span>
                  </div>
                </div>
              </div>
            )}

            {/* Listas agrupadas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
              
              {/* Meios de Pagamento */}
              {secoesFinanceiro.meiosPagamento && (
                <div className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider print-section-title">Receitas por Meio de Pagamento</h3>
                  <div className="space-y-2">
                    {receitasPorMetodo.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhum recebimento.</p>
                    ) : (
                      receitasPorMetodo.map((r) => (
                        <div key={r.metodo} className="flex justify-between items-center bg-brand-dark-4/30 px-3 py-2 rounded-lg border border-brand-dark-5/30 print:border-gray-200">
                          <span className="text-xs font-semibold text-gray-300 print:text-black">{r.metodo}</span>
                          <div className="text-right">
                            <p className="text-xs font-black text-brand-green print:text-black">{formatarMoeda(r.total)}</p>
                            <p className="text-[9px] text-gray-500 print:hidden">{r.count} lanc.</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Despesas por Categoria */}
              {secoesFinanceiro.categoriasDespesa && (
                <div className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider print-section-title">Despesas por Categoria</h3>
                  <div className="space-y-2">
                    {despesasPorCategoria.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">Nenhuma despesa.</p>
                    ) : (
                      despesasPorCategoria.map((d) => (
                        <div key={d.categoria} className="flex justify-between items-center bg-brand-dark-4/30 px-3 py-2 rounded-lg border border-brand-dark-5/30 print:border-gray-200">
                          <span className="text-xs font-semibold text-gray-300 print:text-black">{d.categoria}</span>
                          <div className="text-right">
                            <p className="text-xs font-black text-red-400 print:text-black">{formatarMoeda(d.total)}</p>
                            <p className="text-[9px] text-gray-500 print:hidden">{d.count} lanc.</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Detalhamento de Taxas PF (GRU) e Faturamento por Serviço */}
            {secoesFinanceiro.taxasPF && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">
                    Detalhamento de Taxas PF (GRU) e Faturamento por Serviço
                  </h3>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 print:hidden">
                    Total Taxas PF: -{formatarMoeda(faturamentoStats.totalTaxasPF)}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                  <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                    <thead className="bg-brand-dark-4 print:bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Serviço Prestado</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">Quant. Executada</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Faturamento Bruto</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Dedução Taxas PF (GRU)</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Líquido Real</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                      {servicosBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                            Nenhum serviço registrado com recebimento para o período filtrado.
                          </td>
                        </tr>
                      ) : (
                        servicosBreakdown.map((s) => (
                          <tr key={s.nome} className="hover:bg-white/[0.01]">
                            <td className="px-4 py-2.5 text-xs font-bold text-white print:text-black">{s.nome}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-300 text-center print:text-black">{s.count}</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-brand-green text-right print:text-black">{formatarMoeda(s.bruto)}</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-amber-400 text-right print:text-black">
                              {s.taxas > 0 ? `-${formatarMoeda(s.taxas)}` : 'R$ 0,00'}
                            </td>
                            <td className={`px-4 py-2.5 text-xs font-black text-right print:text-black ${s.liquido >= 0 ? 'text-brand-blue-light' : 'text-red-400'}`}>
                              {formatarMoeda(s.liquido)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {servicosBreakdown.length > 0 && (
                      <tfoot className="bg-brand-dark-4/70 font-black text-xs border-t-2 border-brand-dark-5 print:bg-gray-100 print:border-gray-400">
                        <tr>
                          <td className="px-4 py-2.5 text-white uppercase print:text-black">Total Consolidado</td>
                          <td className="px-4 py-2.5 text-center text-gray-300 print:text-black">
                            {servicosBreakdown.reduce((sum, s) => sum + s.count, 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-brand-green print:text-black">
                            {formatarMoeda(servicosBreakdown.reduce((sum, s) => sum + s.bruto, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-amber-400 print:text-black">
                            -{formatarMoeda(servicosBreakdown.reduce((sum, s) => sum + s.taxas, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-brand-blue-light print:text-black">
                            {formatarMoeda(servicosBreakdown.reduce((sum, s) => sum + s.liquido, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Repasses e Comissões */}
            {secoesFinanceiro.comissoes && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">Repasses e Comissões devidas no Período</h3>
                <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                  <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                    <thead className="bg-brand-dark-4 print:bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Responsável / Colaborador</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">Serviços Executados</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Total a Repassar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                      {comissoesEquipe.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-xs text-gray-500">
                            Nenhum repasse de comissão detectado para o período.
                          </td>
                        </tr>
                      ) : (
                        comissoesEquipe.map((c) => (
                          <tr key={c.colaborador}>
                            <td className="px-4 py-2.5 text-xs font-bold text-white print:text-black">{c.colaborador}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-300 text-center print:text-black">{c.count}</td>
                            <td className="px-4 py-2.5 text-xs font-black text-brand-green text-right print:text-black">{formatarMoeda(c.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Extrato unificado */}
            {secoesFinanceiro.extrato && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">Extrato de Transações do Caixa</h3>
                <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                  <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                    <thead className="bg-brand-dark-4 print:bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Data</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Tipo</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Método / Categoria</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Descrição</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Cliente / Destino</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                      {extratoTransacoes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                            Nenhuma transação financeira encontrada com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        extratoTransacoes.map((t) => (
                          <tr key={t.id} className="hover:bg-white/[0.01]">
                            <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap print:text-black">
                              {format(parseISO(t.data), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-2 text-xs font-black uppercase">
                              <span className={t.tipo === 'entrada' ? 'text-brand-green' : 'text-red-400'}>
                                {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-300 print:text-black">{t.categoria}</td>
                            <td className="px-4 py-2 text-xs text-gray-300 print:text-black">{t.descricao}</td>
                            <td className="px-4 py-2 text-xs text-gray-400 truncate max-w-[150px] print:text-black">{t.entidade}</td>
                            <td className={`px-4 py-2 text-xs font-black text-right print:text-black ${t.tipo === 'entrada' ? 'text-brand-green' : 'text-red-400'}`}>
                              {t.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(t.valor)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 3. ABA: CLIENTES & ACERVO */}
        {!carregandoDados && activeTab === 'clientes' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 print-cards-grid">
              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Clientes Filtrados</p>
                <h3 className="text-2xl font-black text-white mt-1">{clientesStats.total}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Filiados ProTiro</p>
                <h3 className="text-2xl font-black text-brand-green mt-1">{clientesStats.filiados}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Clientes Avulsos</p>
                <h3 className="text-2xl font-black text-yellow-500 mt-1">{clientesStats.naoFiliados}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Total de Armas</p>
                <h3 className="text-2xl font-black text-brand-blue-light mt-1">{clientesStats.totalArmas}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Total de GTs</p>
                <h3 className="text-2xl font-black text-purple-400 mt-1">{clientesStats.totalGts}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Manejos Ativos</p>
                <h3 className="text-2xl font-black text-orange-400 mt-1">{clientesStats.totalManejos}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
              
              <div className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 sm:p-5">
                <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider print-section-title">Distribuição por Acervo</h3>
                <div className="space-y-2">
                  {armasPorAcervo.map((a) => (
                    <div key={a.acervo} className="flex justify-between items-center bg-brand-dark-4/30 px-3 py-2 rounded-lg border border-brand-dark-5/30 print:border-gray-200">
                      <span className="text-xs text-gray-300 print:text-black">{a.acervo}</span>
                      <span className="text-xs font-black text-brand-blue-light print:text-black">{a.count} arma(s)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 sm:p-5">
                <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider print-section-title">Calibres Mais Frequentes</h3>
                <div className="space-y-2">
                  {armasPorCalibre.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4 text-center">Nenhuma arma.</p>
                  ) : (
                    armasPorCalibre.map((c) => (
                      <div key={c.calibre} className="flex justify-between items-center bg-brand-dark-4/30 px-3 py-1.5 rounded-lg border border-brand-dark-5/30 print:border-gray-200">
                        <span className="text-xs text-gray-300 print:text-black">{c.calibre}</span>
                        <span className="text-xs font-black text-brand-blue-light print:text-black">{c.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 sm:p-5">
                <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider print-section-title">Fabricantes Populares</h3>
                <div className="space-y-2">
                  {armasPorFabricante.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4 text-center">Nenhuma arma.</p>
                  ) : (
                    armasPorFabricante.map((f) => (
                      <div key={f.fabricante} className="flex justify-between items-center bg-brand-dark-4/30 px-3 py-1.5 rounded-lg border border-brand-dark-5/30 print:border-gray-200">
                        <span className="text-xs text-gray-300 print:text-black">{f.fabricante}</span>
                        <span className="text-xs font-black text-brand-blue-light print:text-black">{f.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">Listagem Consolidada de Clientes</h3>
              <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                  <thead className="bg-brand-dark-4 print:bg-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Cliente</th>
                      {colunasClientes.cpf && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">CPF</th>}
                      {colunasClientes.contato && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Contato</th>}
                      {colunasClientes.filiado && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">Filiado</th>}
                      {colunasClientes.cr && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Nº CR</th>}
                      {colunasClientes.vencimentoCr && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Vencimento CR</th>}
                      {colunasClientes.crIbama && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Nº CR IBAMA</th>}
                      {colunasClientes.vencimentoIbama && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400">Vencimento IBAMA</th>}
                      {colunasClientes.armasCount && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">Armas</th>}
                      {colunasClientes.gtsCount && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">GTs</th>}
                      {colunasClientes.manejosCount && <th className="px-3 py-3 text-[10px] font-bold uppercase text-gray-400 text-center">Manejos</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                    {tabelaClientesRelatorio.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-xs text-gray-500">
                          Nenhum cliente cadastrado com os filtros ativos.
                        </td>
                      </tr>
                    ) : (
                      tabelaClientesRelatorio.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.01]">
                          <td className="px-3 py-2 text-xs font-bold text-white print:text-black truncate max-w-[140px]" title={c.nome}>
                            {c.nome}
                          </td>
                          {colunasClientes.cpf && (
                            <td className="px-3 py-2 text-xs text-gray-400 print:text-black whitespace-nowrap">
                              {formatarCPF(c.cpf)}
                            </td>
                          )}
                          {colunasClientes.contato && (
                            <td className="px-3 py-2 text-xs text-gray-400 print:text-black whitespace-nowrap">
                              {formatarTelefone(c.contato)}
                            </td>
                          )}
                          {colunasClientes.filiado && (
                            <td className="px-3 py-2 text-xs text-center font-bold text-gray-300 print:text-black">
                              <span className={c.filiado === 'Sim' ? 'text-brand-green' : 'text-gray-500'}>
                                {c.filiado}
                              </span>
                            </td>
                          )}
                          {colunasClientes.cr && <td className="px-3 py-2 text-xs text-gray-300 print:text-black whitespace-nowrap">{c.numeroCr}</td>}
                          {colunasClientes.vencimentoCr && (
                            <td className={`px-3 py-2 text-xs whitespace-nowrap print:text-black ${
                              c.vencimentoCrRaw && isBefore(parseISO(c.vencimentoCrRaw), new Date()) ? 'text-red-400 font-bold' : 'text-gray-400'
                            }`}>{c.vencimentoCr}</td>
                          )}
                          {colunasClientes.crIbama && <td className="px-3 py-2 text-xs text-gray-300 print:text-black whitespace-nowrap">{c.numeroCrIbama}</td>}
                          {colunasClientes.vencimentoIbama && (
                            <td className={`px-3 py-2 text-xs whitespace-nowrap print:text-black ${
                              c.vencimentoCrIbamaRaw && isBefore(parseISO(c.vencimentoCrIbamaRaw), new Date()) ? 'text-red-400 font-bold' : 'text-gray-400'
                            }`}>{c.vencimentoCrIbama}</td>
                          )}
                          {colunasClientes.armasCount && <td className="px-3 py-2 text-xs text-center text-brand-blue-light font-bold print:text-black">{c.armasCount}</td>}
                          {colunasClientes.gtsCount && <td className="px-3 py-2 text-xs text-center text-purple-300 font-bold print:text-black">{c.gtsCount}</td>}
                          {colunasClientes.manejosCount && <td className="px-3 py-2 text-xs text-center text-orange-300 font-bold print:text-black">{c.manejosCount}</td>}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* 4. ABA: PAINEL DE ALERTAS */}
        {!carregandoDados && activeTab === 'alertas' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print-cards-grid">
              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Total Alertas</p>
                <h3 className="text-2xl font-black text-white mt-1">{alertasStats.total}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Vencidos</p>
                <h3 className="text-2xl font-black text-red-500 mt-1">{alertasStats.vencidos}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Urgentes (&lt;30d)</p>
                <h3 className="text-2xl font-black text-orange-400 mt-1">{alertasStats.criticos}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Avisos (&lt;90d)</p>
                <h3 className="text-2xl font-black text-yellow-400 mt-1">{alertasStats.avisos}</h3>
              </div>

              <div className="card bg-brand-dark-3 border-brand-dark-5 print-card">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">Em Renovação</p>
                <h3 className="text-2xl font-black text-brand-blue-light mt-1">{alertasStats.emRenovacao}</h3>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider print-section-title">Detalhamento dos Alertas de Documentação</h3>
              <div className="overflow-x-auto rounded-xl border border-brand-dark-5 bg-brand-dark-3 print:border-gray-300 print:bg-white">
                <table className="min-w-full divide-y divide-brand-dark-5 print:divide-gray-300">
                  <thead className="bg-brand-dark-4 print:bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Tipo Doc.</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Descrição / Identificação</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Cliente</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Vencimento</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Status Alerta</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 text-right">Tempo Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark-5 bg-transparent print:divide-gray-200">
                    {alertasFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                          Nenhum alerta de vencimento encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      alertasFiltrados.map((a) => {
                        const isVencido = a.diasRestantes < 0;
                        const emRenovacao = a.emRenovacao;
                        
                        return (
                          <tr key={a.id} className="hover:bg-white/[0.01]">
                            <td className="px-4 py-2.5 text-xs font-black print:text-black">
                              <span className={`px-2 py-0.5 rounded-md ${
                                a.tipo === 'CR' || a.tipo === 'IBAMA_CR' ? 'bg-brand-blue/15 text-brand-blue-light' :
                                a.tipo === 'CRAF' ? 'bg-purple-500/15 text-purple-300' :
                                a.tipo === 'GT' ? 'bg-orange-500/15 text-orange-400' : 'bg-brand-green/15 text-brand-green-light'
                              } print:bg-transparent print:text-black print:p-0`}>
                                {a.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-200 font-bold print:text-black">{a.label}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-300 font-bold print:text-black truncate max-w-[150px]">{a.clienteNome}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 print:text-black whitespace-nowrap">{formatarData(a.dataVencimento)}</td>
                            <td className="px-4 py-2.5 text-xs font-black uppercase whitespace-nowrap">
                              {emRenovacao ? (
                                <span className="text-brand-blue-light print:text-black">Ag. Liberação</span>
                              ) : isVencido ? (
                                <span className="text-red-500 font-black">Vencido</span>
                              ) : a.diasRestantes <= 30 ? (
                                <span className="text-orange-400 font-black">Crítico</span>
                              ) : (
                                <span className="text-yellow-400 font-black">Aviso</span>
                              )}
                            </td>
                            <td className={`px-4 py-2.5 text-xs font-black text-right whitespace-nowrap print:text-black ${
                              emRenovacao ? 'text-brand-blue-light' : isVencido ? 'text-red-500' : a.diasRestantes <= 30 ? 'text-orange-400' : 'text-yellow-400'
                            }`}>
                              {emRenovacao ? 'Em Renovação' : isVencido ? `${Math.abs(a.diasRestantes)}d vencido` : `${a.diasRestantes}d restantes`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
