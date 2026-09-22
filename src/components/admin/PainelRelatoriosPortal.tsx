import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  Building2,
  Users,
  Target,
  BadgeDollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Search,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  DollarSign,
  PieChart,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  HelpCircle,
  Lock
} from 'lucide-react';
import { supabase } from '../../db/supabase';
import { useAuth } from '../../context/AuthContext';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { formatarMoeda, formatarData, formatarCPF, formatarCNPJ } from '../../utils/formatters';
import { baixarRelatorioExecutivoPdf, RelatorioExecutivoDados } from '../../services/geradorPdfRelatorioExecutivo';

export function PainelRelatoriosPortal() {
  const { usuario, ehGestorPrincipal } = useAuth();
  const { estado: notif, mostrar, fechar } = useNotificacao();

  // Estados de Carregamento
  const [carregando, setCarregando] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [exportandoCsv, setExportandoCsv] = useState(false);

  // Aba ativa interna de relatórios
  const [abaRelatorio, setAbaRelatorio] = useState<'geral' | 'b2b' | 'financeiro' | 'acervo' | 'leads'>('geral');

  // Filtros
  const [periodoFiltro, setPeriodoFiltro] = useState<'tudo' | 'mes_atual' | 'ultimos_30' | 'ultimos_90' | 'ano_atual'>('tudo');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPlano, setFiltroPlano] = useState<string>('todos');
  const [busca, setBusca] = useState('');

  // Dados brutos carregados do banco de dados
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [totalCacs, setTotalCacs] = useState<number>(0);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [totalArmas, setTotalArmas] = useState<number>(0);
  const [totalGts, setTotalGts] = useState<number>(0);
  const [totalManejos, setTotalManejos] = useState<number>(0);
  const [socios, setSocios] = useState<any[]>([]);

  // Carrega todas as informações estratégicas da plataforma
  const carregarDados = async () => {
    setCarregando(true);
    try {
      // 1. Carregar Empresas / Despachantes (excluindo a administradora master)
      const { data: dataEmpresas, error: errEmpresas } = await supabase
        .from('empresas')
        .select('*')
        .neq('id', '00000000-0000-0000-0000-000000000001')
        .order('created_at', { ascending: false });

      if (errEmpresas) throw errEmpresas;
      setEmpresas(dataEmpresas || []);

      // 2. Carregar Histórico de Pagamentos de Assinatura
      const { data: dataPagtos, error: errPagtos } = await supabase
        .from('historico_pagamentos_empresa')
        .select('*')
        .order('created_at', { ascending: false });

      if (errPagtos) console.warn('Aviso ao carregar pagamentos:', errPagtos);
      setPagamentos(dataPagtos || []);

      // 3. Carregar Leads / Pré-Cadastros do site
      const { data: dataLeads, error: errLeads } = await supabase
        .from('leads_pre_cadastro')
        .select('*')
        .order('created_at', { ascending: false });

      if (errLeads) console.warn('Aviso ao carregar leads:', errLeads);
      setLeads(dataLeads || []);

      // 4. Carregar Vínculos Despachante <-> CAC
      const { data: dataVinculos, error: errVinculos } = await supabase
        .from('vinculos_despachante_cac')
        .select('*');

      if (errVinculos) console.warn('Aviso ao carregar vinculos:', errVinculos);
      setVinculos(dataVinculos || []);

      // 5. Contar Atiradores & CACs cadastrados
      const { count: cacsCount, error: errCacs } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'cac_individual');

      setTotalCacs(cacsCount || 0);

      // 6. Contar Armas no Ecossistema
      const { count: armasCount } = await supabase
        .from('armas')
        .select('*', { count: 'exact', head: true });

      setTotalArmas(armasCount || 0);

      // 7. Contar Guias de Tráfego (GT)
      const { count: gtsCount } = await supabase
        .from('guias_trafego')
        .select('*', { count: 'exact', head: true });

      setTotalGts(gtsCount || 0);

      // 8. Contar Autorizações de Manejo
      const { count: manejosCount } = await supabase
        .from('autorizacoes_manejo')
        .select('*', { count: 'exact', head: true });

      setTotalManejos(manejosCount || 0);

      // 9. Carregar Sócios para o relatório executivo
      const { data: dataSocios } = await supabase
        .from('usuarios_autorizados')
        .select('*');

      const listaSocios = [
        { nome: 'Guilherme Gomes', cargo: 'Fundador & Gestor Principal', ehGestorPrincipal: true },
        { nome: 'Gabriel Dias Benevides', cargo: 'Sócio do App / Co-Administrador' },
        { nome: 'Hector Henrique Furtado Meira', cargo: 'Sócio do App / Gestão de Operações' },
      ];

      if (dataSocios) {
        dataSocios.forEach(u => {
          const emailLower = (u.email || '').trim().toLowerCase();
          if (emailLower === 'gui.gomesassis@gmail.com') return;
          if (emailLower === 'hectoruk80@gmail.com' || (u.permissoes && u.permissoes.includes('socio_portal')) || u.role === 'socio_portal') {
            if (!listaSocios.some(s => s.nome.toLowerCase() === u.nome.toLowerCase())) {
              listaSocios.push({
                nome: u.nome,
                cargo: 'Sócio do Portal G CAC',
                ehGestorPrincipal: false
              });
            }
          }
        });
      }
      setSocios(listaSocios);

    } catch (err: any) {
      console.error('Erro ao carregar levantamentos do portal:', err);
      mostrar('erro', 'Falha ao carregar dados estratégicos do Portal G CAC.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ── Cálculos e Métricas Estratégicas ───────────────────────────────────────
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Empresas B2B (exclui cac_individual para focar em despachantes e clubes)
  const empresasB2B = useMemo(() => {
    return empresas.filter(e => e.tipo !== 'cac_individual');
  }, [empresas]);

  // Processamento detalhado das empresas com dias até o vencimento e status calculado
  const empresasProcessadas = useMemo(() => {
    return empresasB2B.map(emp => {
      const planoStatus = emp.plano_status || 'ativo';
      const dataVenc = emp.data_vencimento;
      const isGratis = Boolean(emp.is_gratis);
      const valorMensalidade = Number(emp.valor_mensalidade || 0);

      let diasAteVencer: number | null = null;
      let estaAtrasado = false;
      let venceEmBreve = false;

      if (dataVenc && !isGratis) {
        const vencDate = new Date(dataVenc + 'T00:00:00');
        const diffTime = vencDate.getTime() - hoje.getTime();
        diasAteVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diasAteVencer < 0) {
          estaAtrasado = true;
        } else if (diasAteVencer <= 5) {
          venceEmBreve = true;
        }
      }

      let statusFormatado = 'Ativo';
      if (planoStatus === 'suspenso' || estaAtrasado) {
        statusFormatado = 'Vencido / Atrasado';
      } else if (venceEmBreve) {
        statusFormatado = 'Vencendo em breve';
      } else if (planoStatus === 'teste') {
        statusFormatado = 'Período de Testes';
      } else if (isGratis) {
        statusFormatado = 'Isento / Gratuito';
      }

      return {
        ...emp,
        diasAteVencer,
        estaAtrasado,
        venceEmBreve,
        statusFormatado,
        valorMensalidade
      };
    });
  }, [empresasB2B, hoje]);

  // Empresas filtradas pela busca e pelos selects
  const empresasFiltradas = useMemo(() => {
    return empresasProcessadas.filter(emp => {
      // Filtro de Busca
      const matchBusca =
        busca.trim() === '' ||
        emp.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        emp.cnpj?.includes(busca) ||
        emp.cpf?.includes(busca) ||
        emp.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
        emp.estado?.toLowerCase().includes(busca.toLowerCase()) ||
        emp.responsavel?.toLowerCase().includes(busca.toLowerCase());

      // Filtro de Status
      let matchStatus = true;
      if (filtroStatus === 'ativos') matchStatus = !emp.estaAtrasado && emp.plano_status === 'ativo';
      if (filtroStatus === 'vencendo') matchStatus = emp.venceEmBreve;
      if (filtroStatus === 'atrasados') matchStatus = emp.estaAtrasado || emp.plano_status === 'suspenso';
      if (filtroStatus === 'teste') matchStatus = emp.plano_status === 'teste';
      if (filtroStatus === 'gratis') matchStatus = emp.is_gratis;

      // Filtro de Plano
      let matchPlano = true;
      if (filtroPlano !== 'todos') {
        matchPlano = (emp.plano || '').toLowerCase() === filtroPlano.toLowerCase();
      }

      return matchBusca && matchStatus && matchPlano;
    });
  }, [empresasProcessadas, busca, filtroStatus, filtroPlano]);

  // Indicadores Chave de Desempenho (KPIs)
  const kpis = useMemo(() => {
    const totalEmpresas = empresasB2B.length;
    let empresasAtivas = 0;
    let empresasEmTeste = 0;
    let empresasSuspensas = 0;
    let empresasGratis = 0;
    let mrrTotal = 0;
    let valorInadimplente = 0;
    let totalInadimplentes = 0;

    empresasProcessadas.forEach(emp => {
      if (emp.is_gratis) {
        empresasGratis++;
      } else if (emp.estaAtrasado || emp.plano_status === 'suspenso') {
        empresasSuspensas++;
        valorInadimplente += emp.valorMensalidade;
        totalInadimplentes++;
      } else if (emp.plano_status === 'teste') {
        empresasEmTeste++;
      } else {
        empresasAtivas++;
        mrrTotal += emp.valorMensalidade;
      }
    });

    const arrProjetado = mrrTotal * 12;

    // Faturamento realizado no mês corrente
    const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const pagamentosMes = pagamentos.filter(p => {
      const dt = p.data_pagamento || p.created_at || '';
      return dt.startsWith(mesAtualStr) && (p.status === 'aprovado' || p.status === 'pago');
    });
    const faturamentoMesRealizado = pagamentosMes.reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

    const ticketMedio = empresasAtivas > 0 ? mrrTotal / empresasAtivas : 0;

    // Métricas de CACs e vínculos
    const cacsVinculados = vinculos.filter(v => v.status === 'aprovado' || v.ativo).length;
    const cacsAutonomos = Math.max(0, totalCacs - cacsVinculados);

    // Métricas de Leads
    const totalLeads = leads.length;
    const leadsConvertidos = leads.filter(l => l.status === 'convertido').length;
    const taxaConversaoLeads = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0;

    return {
      totalEmpresas,
      empresasAtivas,
      empresasEmTeste,
      empresasSuspensas,
      empresasGratis,
      mrrTotal,
      arrProjetado,
      faturamentoMesRealizado,
      valorInadimplente,
      totalInadimplentes,
      ticketMedio,
      totalCacs,
      cacsVinculados,
      cacsAutonomos,
      totalArmas,
      totalGts,
      totalManejos,
      totalLeads,
      leadsConvertidos,
      taxaConversaoLeads
    };
  }, [empresasB2B, empresasProcessadas, pagamentos, vinculos, totalCacs, totalArmas, totalGts, totalManejos, leads, hoje]);

  // Lista de empresas inadimplentes para cobrança rápida
  const inadimplentes = useMemo(() => {
    return empresasProcessadas.filter(e => e.estaAtrasado || e.plano_status === 'suspenso');
  }, [empresasProcessadas]);

  // ── Ações de Exportação ───────────────────────────────────────────────────

  // 1. Exportar Relatório Executivo em PDF
  const handleBaixarPdf = async () => {
    setGerandoPdf(true);
    try {
      const periodoTexto =
        periodoFiltro === 'mes_atual' ? 'Mês Vigente' :
        periodoFiltro === 'ultimos_30' ? 'Últimos 30 Dias' :
        periodoFiltro === 'ultimos_90' ? 'Últimos 90 Dias' :
        periodoFiltro === 'ano_atual' ? 'Ano Atual' : 'Todo o Histórico';

      const dadosParaPdf: RelatorioExecutivoDados = {
        periodoFiltro: periodoTexto,
        dataGeracao: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        gestorNome: usuario?.nome || 'Guilherme Gomes (Gestor Principal)',
        kpis,
        empresas: empresasFiltradas.map(e => ({
          nome: e.nome,
          cnpjCpf: e.cnpj ? formatarCNPJ(e.cnpj) : (e.cpf ? formatarCPF(e.cpf) : '-'),
          cidadeUf: e.cidade && e.estado ? `${e.cidade}/${e.estado}` : (e.cidade || e.estado || 'Brasil'),
          plano: e.plano || 'Padrão',
          valorMensalidade: e.valorMensalidade,
          status: e.plano_status,
          dataVencimento: e.data_vencimento ? formatarData(e.data_vencimento) : '-',
          diasAteVencer: e.diasAteVencer,
          isGratis: Boolean(e.is_gratis)
        })),
        socios
      };

      await baixarRelatorioExecutivoPdf(dadosParaPdf);
      mostrar('sucesso', 'Relatório Executivo PDF gerado e baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF executivo:', err);
      mostrar('erro', 'Falha ao gerar o relatório executivo em PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // 2. Exportar Base em CSV / Planilha Excel
  const handleExportarCsv = () => {
    setExportandoCsv(true);
    try {
      const cabecalhos = [
        'Nome do Escritório',
        'CNPJ / CPF',
        'Responsável',
        'Cidade',
        'UF',
        'Telefone / Contato',
        'Plano',
        'Mensalidade (R$)',
        'Status',
        'Próximo Vencimento',
        'Dias até Vencer',
        'Isento'
      ];

      const linhas = empresasFiltradas.map(emp => [
        `"${(emp.nome || '').replace(/"/g, '""')}"`,
        `"${emp.cnpj || emp.cpf || ''}"`,
        `"${(emp.responsavel || '').replace(/"/g, '""')}"`,
        `"${emp.cidade || ''}"`,
        `"${emp.estado || ''}"`,
        `"${emp.contato || emp.telefone || ''}"`,
        `"${emp.plano || 'Padrão'}"`,
        (emp.valorMensalidade || 0).toFixed(2).replace('.', ','),
        `"${emp.statusFormatado}"`,
        `"${emp.data_vencimento || ''}"`,
        emp.diasAteVencer !== null ? emp.diasAteVencer : '',
        emp.is_gratis ? 'SIM' : 'NÃO'
      ]);

      const conteudoCsv = [
        cabecalhos.join(';'),
        ...linhas.map(l => l.join(';'))
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + conteudoCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RELATORIO_B2B_PORTAL_GCAC_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      mostrar('sucesso', 'Planilha CSV exportada com sucesso para o seu dispositivo!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      mostrar('erro', 'Erro ao gerar o arquivo de planilha CSV.');
    } finally {
      setExportandoCsv(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Notificacao {...notif} onFechar={fechar} />

      {/* ── CABEÇALHO DO PAINEL DE RELATÓRIOS ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-dark-3/60 border border-brand-dark-5 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl shrink-0 shadow-lg shadow-purple-500/5">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                Relatórios & Indicadores Estratégicos (BI)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Diretoria SaaS
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Levantamentos executivos em tempo real de receita, carteira B2B, comunidade CAC e operações bélicas.
            </p>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={carregarDados}
            disabled={carregando}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-dark-2 hover:bg-brand-dark-4 border border-brand-dark-5 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all shadow-sm"
            title="Recarregar métricas do banco de dados"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin text-purple-400' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportarCsv}
            disabled={exportandoCsv || carregando}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm"
            title="Exportar base em formato compatível com Excel"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleBaixarPdf}
            disabled={gerandoPdf || carregando}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20"
          >
            {gerandoPdf ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileText size={15} />
                <span>Baixar PDF Executivo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── GRID DE CARDS KPI EXECUTIVOS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: MRR */}
        <div className="bg-brand-dark-2/90 border border-brand-dark-5 hover:border-purple-500/40 p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
              MRR (Receita Recorrente)
            </span>
            <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
              <BadgeDollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {formatarMoeda(kpis.mrrTotal)}
            <span className="text-xs text-gray-400 font-normal"> /mês</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 border-t border-brand-dark-5/60 pt-2">
            <span>ARR Projetado:</span>
            <span className="font-bold text-gray-200">{formatarMoeda(kpis.arrProjetado)}/ano</span>
          </div>
        </div>

        {/* Card 2: Faturamento do Mês */}
        <div className="bg-brand-dark-2/90 border border-brand-dark-5 hover:border-emerald-500/40 p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Faturado no Mês
            </span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {formatarMoeda(kpis.faturamentoMesRealizado)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 border-t border-brand-dark-5/60 pt-2">
            <span>Ticket Médio B2B:</span>
            <span className="font-bold text-emerald-400">{formatarMoeda(kpis.ticketMedio)}</span>
          </div>
        </div>

        {/* Card 3: Despachantes & Clubes B2B */}
        <div className="bg-brand-dark-2/90 border border-brand-dark-5 hover:border-blue-500/40 p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue-light">
              Despachantes & Clubes (B2B)
            </span>
            <div className="p-1.5 bg-blue-500/10 text-brand-blue-light rounded-lg">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis.totalEmpresas}
            <span className="text-xs text-gray-400 font-normal"> escritórios</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 border-t border-brand-dark-5/60 pt-2">
            <span className="text-emerald-400 font-semibold">{kpis.empresasAtivas} ativos</span>
            <span className="text-amber-400 font-semibold">{kpis.empresasEmTeste} em teste</span>
            <span className="text-red-400 font-semibold">{kpis.empresasSuspensas} suspensos</span>
          </div>
        </div>

        {/* Card 4: Inadimplência / Risco */}
        <div className={`bg-brand-dark-2/90 border p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all group ${
          kpis.totalInadimplentes > 0 ? 'border-red-500/40 hover:border-red-500/70' : 'border-brand-dark-5'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
              Inadimplência / Atraso
            </span>
            <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {formatarMoeda(kpis.valorInadimplente)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 border-t border-brand-dark-5/60 pt-2">
            <span>Contas em aberto:</span>
            <span className={`font-bold ${kpis.totalInadimplentes > 0 ? 'text-red-400' : 'text-gray-200'}`}>
              {kpis.totalInadimplentes} cliente(s)
            </span>
          </div>
        </div>
      </div>

      {/* Grid Secundário: Comunidade B2C e Acervos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Atiradores & CACs */}
        <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block mb-1">
              Comunidade CAC (B2C)
            </span>
            <div className="text-xl font-black text-white">
              {kpis.totalCacs} <span className="text-xs text-gray-400 font-normal">atiradores</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              🔗 <strong className="text-white">{kpis.cacsVinculados}</strong> vinculados a escritórios
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Target size={22} />
          </div>
        </div>

        {/* Acervo Bélico Protegido */}
        <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block mb-1">
              Acervo Bélico Total
            </span>
            <div className="text-xl font-black text-white">
              {kpis.totalArmas} <span className="text-xs text-gray-400 font-normal">armas gerenciadas</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              📄 <strong className="text-white">{kpis.totalGts}</strong> GTs e <strong className="text-white">{kpis.totalManejos}</strong> Manejos
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield size={22} />
          </div>
        </div>

        {/* Aquisição de Leads */}
        <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-1">
              Funil de Leads (Site)
            </span>
            <div className="text-xl font-black text-white">
              {kpis.totalLeads} <span className="text-xs text-gray-400 font-normal">contatos captados</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              ⚡ Conversão: <strong className="text-amber-400">{kpis.taxaConversaoLeads.toFixed(1)}%</strong> ({kpis.leadsConvertidos} ativos)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE SUB-ABAS DE RELATÓRIO ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-brand-dark-5 pb-3">
        <button
          type="button"
          onClick={() => setAbaRelatorio('geral')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            abaRelatorio === 'geral'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold shadow-md shadow-purple-500/10'
              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
          }`}
        >
          <PieChart size={14} />
          Visão Geral & Gráficos
        </button>

        <button
          type="button"
          onClick={() => setAbaRelatorio('b2b')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            abaRelatorio === 'b2b'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold shadow-md shadow-purple-500/10'
              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
          }`}
        >
          <Building2 size={14} />
          Carteira B2B (Despachantes)
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-white/10 text-gray-300 font-bold">
            {empresasFiltradas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaRelatorio('financeiro')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            abaRelatorio === 'financeiro'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold shadow-md shadow-purple-500/10'
              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
          }`}
        >
          <DollarSign size={14} />
          Cobranças & Inadimplência
          {kpis.totalInadimplentes > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-red-500/20 text-red-300 font-bold">
              {kpis.totalInadimplentes}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaRelatorio('acervo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            abaRelatorio === 'acervo'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold shadow-md shadow-purple-500/10'
              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
          }`}
        >
          <Shield size={14} />
          Acervos & Operações Bélicas
        </button>

        <button
          type="button"
          onClick={() => setAbaRelatorio('leads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            abaRelatorio === 'leads'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold shadow-md shadow-purple-500/10'
              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp size={14} />
          Expansão & Leads
        </button>
      </div>

      {/* ── ABA 1: VISÃO GERAL & GRÁFICOS ESTRATÉGICOS ──────────────────────── */}
      {abaRelatorio === 'geral' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico / Distribuição por Planos */}
            <div className="bg-brand-dark-2 border border-brand-dark-5 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart size={18} className="text-purple-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Distribuição da Carteira por Planos
                  </h3>
                </div>
                <span className="text-[11px] text-gray-500 font-bold">
                  {empresasB2B.length} clientes
                </span>
              </div>

              <div className="space-y-3">
                {(() => {
                  const planosContagem: Record<string, number> = {};
                  empresasB2B.forEach(e => {
                    const pl = (e.plano || 'Bronze').toUpperCase();
                    planosContagem[pl] = (planosContagem[pl] || 0) + 1;
                  });

                  const total = empresasB2B.length || 1;
                  return Object.entries(planosContagem).map(([plano, qtd]) => {
                    const pct = Math.round((qtd / total) * 100);
                    return (
                      <div key={plano} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-300">{plano}</span>
                          <span className="text-purple-400">{qtd} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-brand-dark-5 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl text-xs text-gray-300 leading-relaxed">
                💡 <strong>Dica Estratégica:</strong> Empresas no plano Bronze com alto volume de clientes podem ser migradas para os planos Prata ou Ouro aumentando o MRR da plataforma.
              </div>
            </div>

            {/* Metas Estratégicas da Diretoria */}
            <div className="bg-brand-dark-2 border border-brand-dark-5 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Metas & Objetivos dos Sócios Gestores
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-400 font-bold">Ano 2026</span>
              </div>

              <div className="space-y-4">
                {/* Meta 1: Despachantes */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-300">🏢 Escritórios B2B (Meta: 100)</span>
                    <span className="text-emerald-400">{kpis.totalEmpresas} de 100 ({Math.min(100, Math.round((kpis.totalEmpresas / 100) * 100))}%)</span>
                  </div>
                  <div className="w-full bg-brand-dark-5 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (kpis.totalEmpresas / 100) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Meta 2: Atiradores CAC */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-300">🎯 Comunidade de CACs (Meta: 5.000)</span>
                    <span className="text-sky-400">{kpis.totalCacs} de 5.000 ({Math.min(100, Math.round((kpis.totalCacs / 5000) * 100))}%)</span>
                  </div>
                  <div className="w-full bg-brand-dark-5 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (kpis.totalCacs / 5000) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Meta 3: MRR */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-300">💰 MRR Recorrente (Meta: R$ 50.000)</span>
                    <span className="text-purple-400">{formatarMoeda(kpis.mrrTotal)} de R$ 50.000 ({Math.min(100, Math.round((kpis.mrrTotal / 50000) * 100))}%)</span>
                  </div>
                  <div className="w-full bg-brand-dark-5 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (kpis.mrrTotal / 50000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-brand-dark-5/60 flex items-center justify-between text-xs text-gray-400">
                <span>Gestão Compartilhada:</span>
                <span className="font-bold text-gray-200">Guilherme Gomes • Gabriel Benevides • Hector Meira</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA 2: CARTEIRA B2B (DESPACHANTES & CLUBES) ────────────────────── */}
      {abaRelatorio === 'b2b' && (
        <div className="space-y-4 animate-fade-in">
          {/* Barra de Filtros e Busca */}
          <div className="bg-brand-dark-2 border border-brand-dark-5 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-lg">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, CNPJ, cidade ou responsável..."
                className="input-field pl-9 w-full text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Select Status */}
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="input-field text-xs py-2 px-3 bg-brand-dark-3"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativos">Em Dia / Ativos</option>
                <option value="vencendo">Vencendo em breve (&le; 5 dias)</option>
                <option value="atrasados">Em Atraso / Suspensos</option>
                <option value="teste">Período de Testes (Trial)</option>
                <option value="gratis">Isentos / Gratuitos</option>
              </select>

              {/* Select Plano */}
              <select
                value={filtroPlano}
                onChange={e => setFiltroPlano(e.target.value)}
                className="input-field text-xs py-2 px-3 bg-brand-dark-3"
              >
                <option value="todos">Todos os Planos</option>
                <option value="bronze">Bronze</option>
                <option value="prata">Prata</option>
                <option value="ouro">Ouro</option>
                <option value="cac">CAC Individual</option>
              </select>

              {(busca || filtroStatus !== 'todos' || filtroPlano !== 'todos') && (
                <button
                  type="button"
                  onClick={() => { setBusca(''); setFiltroStatus('todos'); setFiltroPlano('todos'); }}
                  className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white bg-brand-dark-3 rounded-lg border border-brand-dark-5"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Empresas Clientes */}
          <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-brand-dark-3 text-gray-400 font-black uppercase text-[10px] tracking-wider border-b border-brand-dark-5">
                  <tr>
                    <th className="py-3 px-4">Escritório / Despachante</th>
                    <th className="py-3 px-3">CNPJ / CPF</th>
                    <th className="py-3 px-3">Localização</th>
                    <th className="py-3 px-3">Plano</th>
                    <th className="py-3 px-3">Mensalidade</th>
                    <th className="py-3 px-3">Vencimento</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {empresasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-500">
                        Nenhum escritório localizado para os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    empresasFiltradas.map((emp) => {
                      const telWhatsapp = (emp.contato || emp.telefone || '').replace(/\D/g, '');
                      return (
                        <tr key={emp.id} className="hover:bg-brand-dark-3/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm">{emp.nome}</div>
                            {emp.responsavel && (
                              <div className="text-[11px] text-gray-400">Resp: {emp.responsavel}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-300 font-mono text-[11px]">
                            {emp.cnpj ? formatarCNPJ(emp.cnpj) : (emp.cpf ? formatarCPF(emp.cpf) : 'Não informado')}
                          </td>
                          <td className="py-3 px-3 text-gray-300">
                            {emp.cidade && emp.estado ? `${emp.cidade} / ${emp.estado}` : (emp.cidade || emp.estado || 'Brasil')}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {emp.plano || 'Bronze'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-white">
                            {emp.is_gratis ? (
                              <span className="text-emerald-400 text-[11px]">ISENTO</span>
                            ) : (
                              formatarMoeda(emp.valorMensalidade)
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {emp.data_vencimento ? (
                              <div>
                                <span className="font-mono text-[11px] text-gray-200">
                                  {formatarData(emp.data_vencimento)}
                                </span>
                                {emp.diasAteVencer !== null && (
                                  <div className={`text-[10px] font-bold ${
                                    emp.diasAteVencer < 0 ? 'text-red-400' : emp.diasAteVencer <= 5 ? 'text-amber-400' : 'text-gray-500'
                                  }`}>
                                    {emp.diasAteVencer < 0 ? `${Math.abs(emp.diasAteVencer)}d atrasado` : `em ${emp.diasAteVencer}d`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {emp.estaAtrasado || emp.plano_status === 'suspenso' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                                <AlertTriangle size={11} /> Vencido
                              </span>
                            ) : emp.venceEmBreve ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Clock size={11} /> Vencendo
                              </span>
                            ) : emp.plano_status === 'teste' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                Trial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 size={11} /> Em dia
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {telWhatsapp ? (
                              <a
                                href={`https://wa.me/55${telWhatsapp}?text=${encodeURIComponent(`Olá, ${emp.responsavel || emp.nome}! Aqui é Guilherme Gomes da equipe do Portal G CAC.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/20 transition-all"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageCircle size={13} />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-gray-500 text-[11px]">Sem tel</span>
                            )}
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

      {/* ── ABA 3: FINANCEIRO, COBRANÇAS & INADIMPLÊNCIA ────────────────────── */}
      {abaRelatorio === 'financeiro' && (
        <div className="space-y-6 animate-fade-in">
          {/* Alerta de Atraso e Risco */}
          {inadimplentes.length > 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-red-400">
                  <AlertTriangle size={20} />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Ação Prioritária: {inadimplentes.length} Escritório(s) com Mensalidade Atrasada
                  </h3>
                </div>
                <span className="text-sm font-black text-red-400">
                  Total em Aberto: {formatarMoeda(kpis.valorInadimplente)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {inadimplentes.map(emp => {
                  const telLimpo = (emp.contato || emp.telefone || '').replace(/\D/g, '');
                  const msgCobranca = `Olá, ${emp.responsavel || emp.nome}! Identificamos que a assinatura do Portal G CAC venceu em ${formatarData(emp.data_vencimento || '')} no valor de ${formatarMoeda(emp.valorMensalidade)}. Gostaria da chave PIX para renovar o acesso?`;

                  return (
                    <div key={emp.id} className="bg-brand-dark-2 border border-red-500/20 p-3.5 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-xs">{emp.nome}</p>
                          <p className="text-[10px] text-gray-400">Venceu em: {formatarData(emp.data_vencimento || '')}</p>
                        </div>
                        <span className="text-xs font-black text-red-400">
                          {formatarMoeda(emp.valorMensalidade)}
                        </span>
                      </div>

                      {telLimpo && (
                        <a
                          href={`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msgCobranca)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg text-xs font-bold border border-red-500/20 transition-all"
                        >
                          <MessageCircle size={13} />
                          Cobrar via WhatsApp
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Nenhuma Mensalidade em Atraso no Momento!
              </h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Todos os escritórios e despachantes parceiros estão em dia ou dentro do período de carência regular.
              </p>
            </div>
          )}

          {/* Histórico Recente de Pagamentos */}
          <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Lançamentos Recentes de Pagamentos
              </h3>
              <span className="text-xs text-gray-400">{pagamentos.length} registros</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-brand-dark-3 text-gray-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Forma</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {pagamentos.slice(0, 10).map((pg, idx) => (
                    <tr key={idx} className="hover:bg-brand-dark-3/30">
                      <td className="py-2.5 px-3 font-mono">{formatarData(pg.data_pagamento || pg.created_at)}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">{formatarMoeda(pg.valor)}</td>
                      <td className="py-2.5 px-3 uppercase text-gray-400">{pg.forma_pagamento || 'PIX'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {pg.status || 'Aprovado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA 4: ACERVOS & OPERAÇÕES BÉLICAS ──────────────────────────────── */}
      {abaRelatorio === 'acervo' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-brand-dark-2 border border-brand-dark-5 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-brand-dark-5 pb-4">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Centralização do Ecossistema Bélico Nacional
                </h3>
                <p className="text-xs text-gray-400">
                  O Portal G CAC atua como infraestrutura segura de custódia e controle de conformidade legal de armas e documentos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5">
                <span className="text-gray-400 text-xs block mb-1">Armas Registradas nos Acervos</span>
                <span className="text-2xl font-black text-white">{kpis.totalArmas}</span>
                <span className="text-[10px] text-gray-500 block mt-1">CRAFs do Exército Brasileiro e SIGMA/SINARM</span>
              </div>

              <div className="p-4 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5">
                <span className="text-gray-400 text-xs block mb-1">Guias de Tráfego Eletrônicas (GT)</span>
                <span className="text-2xl font-black text-sky-400">{kpis.totalGts}</span>
                <span className="text-[10px] text-gray-500 block mt-1">Treinamento, competição e caça ativa</span>
              </div>

              <div className="p-4 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5">
                <span className="text-gray-400 text-xs block mb-1">Autorizações de Manejo (Ibama)</span>
                <span className="text-2xl font-black text-emerald-400">{kpis.totalManejos}</span>
                <span className="text-[10px] text-gray-500 block mt-1">Controle de javalis e fauna invasora</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA 5: LEADS & EXPANSÃO COMERCIAL ───────────────────────────────── */}
      {abaRelatorio === 'leads' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-brand-dark-2 border border-brand-dark-5 p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Pipeline de Pré-Cadastros do Site Institucional
                </h3>
                <p className="text-xs text-gray-400">Leads interessados em assinar o Portal G CAC.</p>
              </div>
              <span className="text-xs font-bold text-amber-400">
                {leads.length} leads captados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-brand-dark-3 text-gray-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3">Contato / Telefone</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {leads.slice(0, 15).map((ld) => {
                    const tel = (ld.telefone || ld.contato || '').replace(/\D/g, '');
                    return (
                      <tr key={ld.id} className="hover:bg-brand-dark-3/30">
                        <td className="py-2.5 px-3 font-bold text-white">{ld.nome}</td>
                        <td className="py-2.5 px-3">
                          {tel ? (
                            <a
                              href={`https://wa.me/55${tel}?text=${encodeURIComponent(`Olá, ${ld.nome}! Recebemos seu interesse no Portal G CAC através do nosso site.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <MessageCircle size={12} />
                              {ld.telefone || ld.contato}
                            </a>
                          ) : (
                            ld.email || '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-purple-400">
                          {ld.tipo || 'Despachante'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400">
                          {formatarData(ld.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ld.status === 'convertido' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {ld.status || 'Novo Lead'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
