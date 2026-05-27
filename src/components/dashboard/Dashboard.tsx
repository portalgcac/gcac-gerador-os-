import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, Gift, Plus, ChevronRight, Loader, Receipt, XCircle, TrendingDown, AlertCircle } from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { StatusExecucaoServico, STATUS_EXECUCAO_SERVICO } from '../../types';
import { isSameMonth, parseISO } from 'date-fns';
import { formatarMoeda, formatarData, formatarNumeroOS, classeStatus, classeStatusOrcamento, classeStatusExecucao, iconeStatusExecucao } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';
import { useFinanceiro } from '../../context/FinanceiroContext';
import { BriefingDiario } from './BriefingDiario';
import { WidgetLembretes } from './WidgetLembretes';
import { WidgetVencimentos } from './WidgetVencimentos';

export function Dashboard() {
  const navigate = useNavigate();
  const { ordens, itensFila } = useOrdens();
  const { orcamentos } = useOrcamentos();
  const { despesas } = useFinanceiro();
  const { usuario, temAcessoRecurso } = useAuth();
  const online = useStatusConexao();

  const dataAtual = new Date();

  const ordensParaStats = ordens.filter(o => {
    // Só entra no painel se NÃO for migração
    const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
    if (ehMigracao) return false;

    // Filtro por mês atual
    return isSameMonth(parseISO(o.criadoEm), dataAtual);
  });

  const despesasMes = despesas.filter(d => isSameMonth(parseISO(d.data), dataAtual));
  const valorDespesas = despesasMes.reduce((s, d) => s + (d.valor || 0), 0);
  
  const ehAdmin = usuario?.role === 'admin';

  const stats = {
    // Contagens Globais (Mês Atual)
    total:       ordensParaStats.length,
    pendente:    ordensParaStats.filter(o => o.status === 'Aguardando Pagamento').length,
    pagas:       ordensParaStats.filter(o => o.status === 'Pago' || o.status === 'Gratuidade').length,

    // Financeiro Bruto (Mês Atual)
    receita:     ordensParaStats.reduce((s, o) => s + (o.valorPago || 0), 0),
    taxas:       ordensParaStats.filter(o => o.status === 'Pago' || o.status === 'Parcialmente Pago').reduce((s, o) => s + (o.taxaPFTotal || 0), 0),
    receitaPendente: ordensParaStats.reduce((s, o) => s + (o.valor - (o.valorPago || 0)), 0),
  };

  const margemServicos = stats.receita - stats.taxas;
  const lucroLiquido = margemServicos - valorDespesas;

  // Alertas de Rotina
  const totalPF = ordens.filter(o => o.servicos?.some(s => s.statusExecucao === 'Protocolado — Ag. PF')).length;
  const possuiAlertas = totalPF > 0;

  const orcStats = {
    total:       orcamentos.length,
    pendente:    orcamentos.filter((o: any) => o.status === 'Pendente').length,
    aprovado:    orcamentos.filter((o: any) => o.status === 'Aprovado').length,
    recusado:    orcamentos.filter((o: any) => o.status === 'Recusado').length,
  };

  // Estatísticas de Execução (Operacional)
  // Estatísticas de Execução (Operacional - Total de serviços ativos no banco)
  const todosServicos = ordens.flatMap((o: any) => o.servicos || []);
  const operStats = STATUS_EXECUCAO_SERVICO.reduce((acc, status) => {
    acc[status] = todosServicos.filter((s: any) => (s.statusExecucao || 'Não Iniciado') === status).length;
    return acc;
  }, {} as Record<StatusExecucaoServico, number>);
 
  const servicosNaoIniciados = operStats['Não Iniciado'];
 
  const recentes = [...ordensParaStats].slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {temAcessoRecurso('dash_atencao_diaria') && <BriefingDiario />}
      {/* ── Saudação ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Olá{usuario ? `, ${usuario.nome.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={online ? 'dot-online' : 'dot-offline'} />
          <span className={`text-xs font-medium ${online ? 'text-brand-green' : 'text-red-400'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
          {itensFila > 0 && (
            <span className="ml-2 badge badge-andamento">
              <Loader size={10} className="animate-spin" />
              {itensFila} pendente{itensFila > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      {/* ── Widget de Atenção (Rotina Diária) ── */}
      {temAcessoRecurso('dash_atencao_diaria') && possuiAlertas && (
        <div 
          onClick={() => navigate('/rotina')}
          className="bg-brand-blue/10 border border-brand-blue/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:bg-brand-blue/20 transition-all shadow-[0_0_15px_rgba(45,141,224,0.1)]"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue-light animate-pulse">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Resumo de Atenção Diária</h3>
              <div className="flex gap-4 mt-0.5">
                {totalPF > 0 && (
                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    <div className="w-1 h-1 bg-brand-blue rounded-full" />
                    {totalPF} processos aguardando conferência na PF
                  </span>
                )}

              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-brand-blue-light font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
            Ver Rotina
            <ChevronRight size={14} />
          </div>
        </div>
      )}

      {/* ── Widget de Lembretes ── */}
      {temAcessoRecurso('dash_lembretes') && <WidgetLembretes />}
      {temAcessoRecurso('dash_alertas_vencimento') && <WidgetVencimentos />}

      {/* ── Cards de Estatísticas ── */}
      {temAcessoRecurso('dash_resumo_os') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-brand-blue rounded-full" />
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Resumo de Ordens de Serviço</h2>
          </div>
          <div className={`grid grid-cols-1 ${ehAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
            <StatCard
              titulo="Total de OS (Mês Atual)"
              valor={stats.total}
              icone={<FileText size={20} className="text-brand-blue-light" />}
              cor="blue"
              onClick={() => navigate('/ordens')}
            />
            {ehAdmin && (
              <>
                <StatCard
                  titulo="Pagamento Pendente"
                  valor={stats.pendente}
                  icone={<Clock size={20} className="text-yellow-400" />}
                  cor="yellow"
                  onClick={() => navigate('/ordens')}
                />
                <StatCard
                  titulo="Pagas"
                  valor={stats.pagas}
                  icone={<CheckCircle size={20} className="text-brand-green" />}
                  cor="green"
                  onClick={() => navigate('/ordens')}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Banner de Receita e Lucro ── */}
      {temAcessoRecurso('dash_margem_operacional') && ehAdmin && (
        <div className="card bg-gradient-to-br from-brand-dark-3 to-brand-dark-2 border border-brand-dark-5 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="flex flex-col md:flex-row items-stretch gap-6 relative z-10">
            {/* Margem Operacional - Principal */}
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Margem Operacional (Lucro Bruto)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-white">{formatarMoeda(margemServicos)}</p>
                <span className="text-xs font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
                  {stats.receita > 0 ? ((margemServicos / stats.receita) * 100).toFixed(0) : 0}% de margem
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">Reflete faturamento menos taxas da PF (Mês atual).</p>
            </div>

            <div className="hidden md:block w-px bg-brand-dark-5" />

            {/* Lucro Líquido e Breakdown */}
            <div className="grid grid-cols-2 md:block gap-4 md:space-y-4 min-w-[200px]">
              <div>
                <p className="text-[10px] font-bold text-brand-blue uppercase tracking-wider">Lucro Líquido Real</p>
                <p className="text-lg font-bold text-white">{formatarMoeda(lucroLiquido)}</p>
                <p className="text-[9px] text-gray-500">Já subtraídas as despesas PJ</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Despesas PJ</p>
                  <p className="text-xs font-bold text-red-400">-{formatarMoeda(valorDespesas)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-green uppercase tracking-wider">Total Recebido</p>
                  <p className="text-xs font-bold text-brand-green-light">{formatarMoeda(stats.receita)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Resumo Operacional ── */}
      {temAcessoRecurso('dash_resumo_operacional') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Loader size={18} className="text-brand-blue-light" />
              Resumo Operacional
            </h2>
            <span className="text-xs text-brand-metal font-medium uppercase tracking-wider">Status de Execução</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {STATUS_EXECUCAO_SERVICO.map(status => (
              <div 
                key={status} 
                onClick={() => navigate('/ordens', { state: { filtroStatusExecucao: status } })}
                className="card bg-brand-dark-3/50 border-brand-dark-5 p-3 flex flex-col gap-1 cursor-pointer hover:border-brand-blue/30 hover:bg-brand-dark-3 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{iconeStatusExecucao(status)}</span>
                  <span className="text-lg font-black text-white">{operStats[status]}</span>
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase truncate" title={status}>
                  {status === 'Iniciado — Montando Processo' ? 'Iniciado' : 
                   status === 'Protocolado — Ag. PF' ? 'Protocolado' : status}
                </p>
                <div className="w-full h-1 bg-brand-dark-5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full opacity-50 ${
                      status === 'Concluído' ? 'bg-brand-green' : 
                      status === 'Não Iniciado' ? 'bg-gray-500' :
                      'bg-brand-blue'
                    }`}
                    style={{ width: `${todosServicos.length > 0 ? (operStats[status] / todosServicos.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resumo de Orçamentos ── */}
      {temAcessoRecurso('dash_resumo_orcamentos') && ehAdmin && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt size={18} className="text-yellow-500" />
              Resumo de Orçamentos
            </h2>
            <button onClick={() => navigate('/orcamentos')} className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors">
              Ver orçamentos →
            </button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              titulo="Total Emitidos"
              valor={orcStats.total}
              icone={<Receipt size={20} className="text-brand-blue-light" />}
              cor="blue"
              onClick={() => navigate('/orcamentos')}
            />
            <StatCard
              titulo="Aguardando Aprovação"
              valor={orcStats.pendente}
              icone={<Clock size={20} className="text-yellow-400" />}
              cor="yellow"
              onClick={() => navigate('/orcamentos')}
            />
            <StatCard
              titulo="Aprovados (Convertidos)"
              valor={orcStats.aprovado}
              icone={<CheckCircle size={20} className="text-brand-green" />}
              cor="green"
              onClick={() => navigate('/orcamentos')}
            />
            <StatCard
              titulo="Recusados"
              valor={orcStats.recusado}
              icone={<XCircle size={20} className="text-red-400" />}
              cor="red"
              onClick={() => navigate('/orcamentos')}
            />
          </div>
        </div>
      )}

      {/* ── Ordens Recentes ── */}
      {temAcessoRecurso('dash_ordens_recentes') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Ordens Recentes</h2>
            <button onClick={() => navigate('/ordens')} className="text-sm text-brand-blue-light hover:text-white transition-colors">
              Ver todas →
            </button>
          </div>

          {recentes.length === 0 ? (
            <div className="card text-center py-10">
              <FileText size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">Nenhuma OS criada ainda</p>
              <button onClick={() => navigate('/ordens/nova')} className="btn-primary mx-auto">
                <Plus size={16} />
                Criar primeira OS
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentes.map(ordem => (
                <div
                  key={ordem.id}
                  onClick={() => navigate(`/ordens/${ordem.id}`)}
                  className="card-hover flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-xs text-gray-500 leading-none">OS</p>
                    <p className="text-sm font-bold text-white">#{String(ordem.numero).padStart(4, '0')}</p>
                    {ordem.migrado && (
                      <span className="text-[8px] font-black text-brand-blue-light border border-brand-blue/30 px-1 rounded-sm mt-1 inline-block uppercase tracking-tighter">Histórico</span>
                    )}
                  </div>
                  <div className="w-px h-8 bg-brand-dark-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{ordem.nomeCliente}</p>
                    <p className="text-xs text-gray-400">{formatarData(ordem.criadoEm)}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {ehAdmin && (
                      <span className="text-sm font-bold text-brand-green">{formatarMoeda(ordem.valor)}</span>
                    )}
                    <span className={classeStatus(ordem.status)}>{ordem.status}</span>
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Botão de Nova OS ── */}
      <button
        onClick={() => navigate('/ordens/nova')}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full btn-primary shadow-2xl shadow-brand-blue/30 text-xl z-30"
        id="fab-nova-os"
        title="Nova OS"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function StatCard({
  titulo, valor, icone, cor, onClick, grande = false,
}: {
  titulo: string;
  valor: string | number;
  icone: React.ReactNode;
  cor: 'blue' | 'green' | 'yellow' | 'red' | 'orange';
  onClick?: () => void;
  grande?: boolean;
}) {
  const cores = {
    blue:    'bg-brand-blue/10 border-brand-blue/20',
    green:   'bg-brand-green/10 border-brand-green/20',
    yellow:  'bg-yellow-500/10 border-yellow-500/20',
    red:     'bg-red-500/10 border-red-500/20',
    orange:  'bg-orange-500/10 border-orange-500/20',
  };

  return (
    <div
      onClick={onClick}
      className={`card ${cores[cor]} ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''} transition-all duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>{icone}</div>
        {onClick && <ChevronRight size={14} className="text-gray-600" />}
      </div>
      <p className={`font-black text-white ${grande ? 'text-xl' : 'text-3xl'}`}>{valor}</p>
      <p className="text-xs text-gray-400 mt-1">{titulo}</p>
    </div>
  );
}
