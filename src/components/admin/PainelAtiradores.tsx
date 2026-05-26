import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Target, AlertTriangle, Clock, RefreshCw,
  Search, Filter, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Eye, MessageSquare, Download, Wifi, WifiOff, Shield,
  TrendingUp, BarChart2, Calendar, Award, User, X, ExternalLink,
  Crosshair, FileText, Zap, Info, Link2
} from 'lucide-react';
import {
  buscarTodosAtiradores,
  calcularEstatisticasGlobais,
  PerfilAtirador,
  EstatisticasGlobaisCAC,
} from '../../services/adminCacService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataRelativa(iso?: string): string {
  if (!iso) return 'Nunca acessou';
  const diff = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);
  if (minutos < 2) return 'Agora há pouco';
  if (minutos < 60) return `Há ${minutos} min`;
  if (horas < 24) return `Há ${horas}h`;
  if (dias === 1) return 'Ontem';
  if (dias < 30) return `Há ${dias} dias`;
  if (dias < 365) return `Há ${Math.floor(dias / 30)} meses`;
  return `Há ${Math.floor(dias / 365)} anos`;
}

function formatarDataCurta(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function statusAtividade(ultimoAcesso?: string): { label: string; color: string } {
  if (!ultimoAcesso) return { label: 'Nunca acessou', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' };
  const dias = Math.floor((Date.now() - new Date(ultimoAcesso).getTime()) / 86400000);
  if (dias <= 7) return { label: 'Ativo', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
  if (dias <= 30) return { label: 'Recente', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
  if (dias <= 90) return { label: 'Inativo', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
  return { label: 'Dormindo', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
}

// ── Card de Estatísticas Global ───────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, pulse
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; pulse?: boolean
}) {
  return (
    <div className={`bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-opacity-60 transition-all duration-300`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-6 translate-x-6 ${color}`} style={{ background: 'currentColor' }} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-xl ${color} bg-opacity-10 border border-opacity-20`} style={{ borderColor: 'currentColor' }}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-black ${color} flex items-end gap-1`}>
          {value}
          {pulse && <span className="w-2 h-2 rounded-full bg-current animate-pulse mb-1.5" />}
        </div>
        {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Barra de Progresso ───────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-brand-dark-4 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 font-bold w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Modal de Detalhe do Atirador ─────────────────────────────────────────────

function ModalDetalheAtirador({ perfil, onClose }: { perfil: PerfilAtirador; onClose: () => void }) {
  const status = statusAtividade(perfil.ultimoAcesso);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-brand-dark-2 w-full max-w-2xl rounded-2xl border border-brand-dark-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-dark-3 to-brand-dark-2 border-b border-brand-dark-5 p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {perfil.fotoUrl ? (
                <img src={perfil.fotoUrl} alt={perfil.nome} className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-blue/30" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-brand-dark-4 border-2 border-brand-dark-5 flex items-center justify-center">
                  <User size={28} className="text-gray-600" />
                </div>
              )}
              {perfil.alertasCriticos > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-brand-dark-2">
                  <span className="text-[9px] font-black text-white">{perfil.alertasCriticos}</span>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{perfil.nome}</h2>
              <p className="text-sm text-gray-400">{perfil.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                  {status.label}
                </span>
                {perfil.onboardingConcluido ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-green-400 bg-green-500/10 border-green-500/20 flex items-center gap-1">
                    <CheckCircle size={9} /> Onboarding OK
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-yellow-400 bg-yellow-500/10 border-yellow-500/20 flex items-center gap-1">
                    <Info size={9} /> Onboarding Pendente
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-brand-dark-4 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Alertas */}
          {perfil.alertasCriticos > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-300">{perfil.alertasCriticos} documento(s) com alerta</p>
                <p className="text-xs text-red-400/70 mt-0.5">Documentos vencidos ou com vencimento em menos de 30 dias. Contate o usuário se necessário.</p>
              </div>
            </div>
          )}

          {/* Grid de Dados */}
          <div className="grid grid-cols-2 gap-4">
            {/* Identificação */}
            <div className="col-span-2 bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <User size={12} /> Identificação
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <DataField label="CPF" value={perfil.cpf || '—'} />
                <DataField label="Contato" value={perfil.contato || '—'} />
                <DataField label="Conta criada em" value={formatarDataCurta(perfil.criadoEm)} />
                <DataField label="Último Acesso" value={formatarDataCurta(perfil.ultimoAcesso)} />
              </div>
            </div>

            {/* CR e Documentos */}
            <div className="col-span-2 bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Shield size={12} /> Certificados de Registro
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <DataField label="Nº CR (Exército)" value={perfil.numeroCr || 'Não cadastrado'} alert={!perfil.numeroCr} />
                <DataField label="Validade CR" value={formatarDataCurta(perfil.vencimentoCr)} alert={isVencendoEmBreve(perfil.vencimentoCr)} />
                <DataField label="Nº CR IBAMA" value={perfil.numeroCrIbama || 'Não cadastrado'} />
                <DataField label="Validade CR IBAMA" value={formatarDataCurta(perfil.vencimentoCrIbama)} alert={isVencendoEmBreve(perfil.vencimentoCrIbama)} />
              </div>
            </div>

            {/* Acervo */}
            <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Crosshair size={12} /> Acervo
              </h4>
              <div className="space-y-2">
                <MetricaAcervo label="Armas Cadastradas" value={perfil.totalArmas} icon={Target} />
                <MetricaAcervo label="Guias de Tráfego" value={perfil.totalGts} icon={FileText} />
                <MetricaAcervo label="Manejos IBAMA" value={perfil.totalManejos} icon={Award} />
              </div>
            </div>

            {/* Uso da Plataforma */}
            <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity size={12} /> Uso da Plataforma
              </h4>
              <div className="space-y-2">
                <MetricaAcervo label="Exportações Realizadas" value={perfil.totalExportacoes} icon={Download} />
                <MetricaAcervo
                  label="Onboarding"
                  value={perfil.onboardingConcluido ? 'Concluído' : 'Pendente'}
                  icon={perfil.onboardingConcluido ? CheckCircle : Clock}
                  textValue
                />
                <MetricaAcervo
                  label="Último acesso"
                  value={formatarDataRelativa(perfil.ultimoAcesso)}
                  icon={Wifi}
                  textValue
                />
              </div>
            </div>

            {/* Despachantes Vinculados */}
            <div className="col-span-2 bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Link2 size={12} className="text-brand-blue-light" /> Despachantes Vinculados
              </h4>
              {perfil.despachantesVinculados?.length === 0 ? (
                <p className="text-xs text-gray-600 italic">Este atirador não está vinculado a nenhuma empresa despachante no momento.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {perfil.despachantesVinculados?.map(v => (
                    <span key={v.id} className="text-xs font-bold px-3 py-1 rounded-lg bg-brand-blue/10 border border-brand-blue/20 text-brand-blue-light">
                      {v.nome}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nota de suporte */}
          <div className="bg-brand-dark-3 rounded-xl p-4 border border-brand-dark-5">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <MessageSquare size={12} /> Suporte Técnico
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Este painel é somente de <strong className="text-white">leitura e monitoramento</strong>. Para ações de suporte direto, entre em contato com o usuário pelo email <strong className="text-brand-blue-light">{perfil.email}</strong>{perfil.contato ? ` ou pelo WhatsApp ${perfil.contato}` : ''}.
            </p>
            <a
              href={`mailto:${perfil.email}?subject=Suporte GCAC Portal - ${perfil.nome}`}
              className="inline-flex items-center gap-2 mt-3 text-xs font-bold text-brand-blue-light hover:text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 border border-brand-blue/20 px-3 py-1.5 rounded-lg transition-all"
            >
              <MessageSquare size={12} /> Enviar Email de Suporte
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataField({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function MetricaAcervo({
  label, value, icon: Icon, textValue
}: {
  label: string; value: string | number; icon: React.ElementType; textValue?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon size={13} />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-bold ${textValue ? 'text-gray-300' : 'text-white tabular-nums'}`}>
        {value}
      </span>
    </div>
  );
}

function isVencendoEmBreve(data?: string): boolean {
  if (!data) return false;
  const d = new Date(data);
  const diff = d.getTime() - Date.now();
  return diff <= 30 * 24 * 60 * 60 * 1000; // 30 dias
}

// ── Linha da Tabela ──────────────────────────────────────────────────────────

function LinhaAtirador({ perfil, onClick }: { perfil: PerfilAtirador; onClick: () => void }) {
  const status = statusAtividade(perfil.ultimoAcesso);

  return (
    <tr
      className="border-b border-brand-dark-5 hover:bg-brand-dark-3/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Avatar + Nome */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {perfil.fotoUrl ? (
              <img src={perfil.fotoUrl} alt={perfil.nome} className="w-9 h-9 rounded-xl object-cover border border-brand-dark-5" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-brand-dark-4 border border-brand-dark-5 flex items-center justify-center">
                <User size={16} className="text-gray-600" />
              </div>
            )}
            {perfil.alertasCriticos > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border border-brand-dark-2">
                <span className="text-[8px] font-black text-white">{perfil.alertasCriticos}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate group-hover:text-brand-blue-light transition-colors">{perfil.nome}</p>
            <p className="text-[11px] text-gray-500 truncate">{perfil.email}</p>
          </div>
        </div>
      </td>

      {/* CPF */}
      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{perfil.cpf || '—'}</td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
          {status.label}
        </span>
      </td>

      {/* Último Acesso */}
      <td className="px-4 py-3 text-xs text-gray-400">{formatarDataRelativa(perfil.ultimoAcesso)}</td>

      {/* Acervo */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-white font-bold">
            <Target size={11} className="text-brand-blue" />
            {perfil.totalArmas}
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <FileText size={11} />
            {perfil.totalGts}
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Award size={11} />
            {perfil.totalManejos}
          </div>
        </div>
      </td>

      {/* CR Validade */}
      <td className="px-4 py-3">
        <span className={`text-xs font-mono ${isVencendoEmBreve(perfil.vencimentoCr) ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
          {formatarDataCurta(perfil.vencimentoCr)}
        </span>
      </td>

      {/* Alertas */}
      <td className="px-4 py-3">
        {perfil.alertasCriticos > 0 ? (
          <div className="flex items-center gap-1 text-red-400">
            <AlertTriangle size={13} />
            <span className="text-xs font-bold">{perfil.alertasCriticos}</span>
          </div>
        ) : (
          <CheckCircle size={13} className="text-green-500 opacity-50" />
        )}
      </td>

      {/* Exportações */}
      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{perfil.totalExportacoes}</td>

      {/* Onboarding */}
      <td className="px-4 py-3">
        {perfil.onboardingConcluido
          ? <CheckCircle size={14} className="text-green-500" />
          : <Clock size={14} className="text-yellow-500 opacity-60" />
        }
      </td>

      {/* Vínculos */}
      <td className="px-4 py-3">
        <span className={`text-xs font-bold ${perfil.despachantesVinculados?.length > 0 ? 'text-brand-blue-light' : 'text-gray-600'}`}>
          {perfil.despachantesVinculados?.length || 0}
        </span>
      </td>

      {/* Cadastro */}
      <td className="px-4 py-3 text-[11px] text-gray-600">{formatarDataCurta(perfil.criadoEm)}</td>

      {/* Ação */}
      <td className="px-4 py-3">
        <button className="p-1.5 rounded-lg text-gray-600 hover:text-brand-blue-light hover:bg-brand-blue/10 transition-colors" title="Ver detalhes">
          <Eye size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────

type FiltroStatus = 'todos' | 'ativo' | 'recente' | 'inativo' | 'nunca';
type OrdemSort = 'alertas' | 'ultimo_acesso' | 'nome' | 'armas' | 'cadastro';

export function PainelAtiradores() {
  const [perfis, setPerfis] = useState<PerfilAtirador[]>([]);
  const [stats, setStats] = useState<EstatisticasGlobaisCAC | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [ordenarPor, setOrdenarPor] = useState<OrdemSort>('alertas');
  const [ordenarDesc, setOrdenarDesc] = useState(true);
  const [perfilSelecionado, setPerfilSelecionado] = useState<PerfilAtirador | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    setBuscando(true);
    try {
      const dados = await buscarTodosAtiradores();
      setPerfis(dados);
      setStats(calcularEstatisticasGlobais(dados));
      setUltimaAtualizacao(new Date());
    } finally {
      setBuscando(false);
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Filtragem e ordenação
  const perfisFiltrados = perfis
    .filter(p => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!p.nome.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q) && !p.cpf?.includes(q)) return false;
      }
      if (filtroStatus !== 'todos') {
        const status = statusAtividade(p.ultimoAcesso).label.toLowerCase();
        const map: Record<FiltroStatus, string> = { todos: '', ativo: 'ativo', recente: 'recente', inativo: 'inativo', nunca: 'nunca acessou' };
        if (!status.includes(map[filtroStatus])) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (ordenarPor) {
        case 'alertas': cmp = b.alertasCriticos - a.alertasCriticos; break;
        case 'ultimo_acesso': {
          const ta = a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0;
          const tb = b.ultimoAcesso ? new Date(b.ultimoAcesso).getTime() : 0;
          cmp = tb - ta; break;
        }
        case 'nome': cmp = a.nome.localeCompare(b.nome); break;
        case 'armas': cmp = b.totalArmas - a.totalArmas; break;
        case 'cadastro': cmp = new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(); break;
      }
      return ordenarDesc ? cmp : -cmp;
    });

  function toggleOrdem(col: OrdemSort) {
    if (ordenarPor === col) setOrdenarDesc(!ordenarDesc);
    else { setOrdenarPor(col); setOrdenarDesc(true); }
  }

  function SortIcon({ col }: { col: OrdemSort }) {
    if (ordenarPor !== col) return <ChevronDown size={11} className="opacity-20" />;
    return ordenarDesc ? <ChevronDown size={11} className="text-brand-blue" /> : <ChevronUp size={11} className="text-brand-blue" />;
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Carregando dados dos atiradores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-brand-blue/10 border border-brand-blue/20 rounded-xl">
              <Users size={18} className="text-brand-blue-light" />
            </div>
            <h1 className="text-2xl font-black text-white">Gestão de Atiradores</h1>
          </div>
          <p className="text-sm text-gray-500">
            Monitoramento dos usuários CAC Individual ativos na plataforma
            {ultimaAtualizacao && (
              <span className="ml-2 text-[11px] text-gray-600">
                · Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={carregar}
          disabled={buscando}
          className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm border border-brand-dark-5 hover:border-brand-blue/30"
        >
          <RefreshCw size={15} className={buscando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Cards de Estatísticas */}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de Atiradores" value={stats.totalAtiradores} icon={Users} color="text-brand-blue-light" sub="Contas CAC cadastradas" />
            <StatCard label="Ativos (7 dias)" value={stats.ativos7dias} icon={Wifi} color="text-green-400" pulse={stats.ativos7dias > 0} sub="Acessaram na última semana" />
            <StatCard label="Inativos (+30 dias)" value={stats.inativos30dias} icon={WifiOff} color="text-yellow-400" sub="Precisam de reengajamento" />
            <StatCard label="Alertas Críticos" value={stats.totalAlertasCriticos} icon={AlertTriangle} color="text-red-400" pulse={stats.totalAlertasCriticos > 0} sub="Docs vencidos ou a vencer" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Armas Cadastradas" value={stats.totalArmasCadastradas} icon={Target} color="text-purple-400" sub={`Média: ${stats.mediaArmasPorAtirador} por atirador`} />
            <StatCard label="Ativos (30 dias)" value={stats.ativos30dias} icon={Activity} color="text-blue-400" sub="Acessaram no último mês" />
            <StatCard label="Exportações" value={perfis.reduce((s, p) => s + p.totalExportacoes, 0)} icon={Download} color="text-teal-400" sub="PDFs/Excel gerados" />
            <StatCard label="Onboarding Concluído" value={`${stats.onboardingConcluidos}/${stats.totalAtiradores}`} icon={Zap} color="text-orange-400" sub="Completaram o tutorial" />
          </div>

          {/* Gráfico de Distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Engajamento */}
            <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 col-span-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp size={12} /> Distribuição de Atividade
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400 font-bold">Ativos (7 dias)</span>
                    <span className="text-white font-bold">{stats.ativos7dias}</span>
                  </div>
                  <ProgressBar value={stats.ativos7dias} max={stats.totalAtiradores} color="bg-green-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-blue-400 font-bold">Recentes (30 dias)</span>
                    <span className="text-white font-bold">{stats.ativos30dias}</span>
                  </div>
                  <ProgressBar value={stats.ativos30dias} max={stats.totalAtiradores} color="bg-blue-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-yellow-400 font-bold">Inativos (+30 dias)</span>
                    <span className="text-white font-bold">{stats.inativos30dias}</span>
                  </div>
                  <ProgressBar value={stats.inativos30dias} max={stats.totalAtiradores} color="bg-yellow-500" />
                </div>
              </div>
            </div>

            {/* Acervo médio */}
            <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 col-span-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart2 size={12} /> Dados do Acervo (Totais)
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Armas', value: stats.totalArmasCadastradas, color: 'bg-brand-blue' },
                  { label: 'Guias de Tráfego', value: perfis.reduce((s, p) => s + p.totalGts, 0), color: 'bg-purple-500' },
                  { label: 'Manejos IBAMA', value: perfis.reduce((s, p) => s + p.totalManejos, 0), color: 'bg-teal-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-bold">{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-brand-dark-4 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, (item.value / Math.max(1, stats.totalArmasCadastradas + 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Onboarding e alertas */}
            <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 col-span-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield size={12} /> Saúde da Plataforma
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Onboarding completo</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-brand-dark-4 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${stats.totalAtiradores > 0 ? (stats.onboardingConcluidos / stats.totalAtiradores) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-white">{stats.onboardingConcluidos}/{stats.totalAtiradores}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Sem alertas críticos</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-green-400">{perfis.filter(p => p.alertasCriticos === 0).length}</span>
                    <CheckCircle size={12} className="text-green-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Com alertas críticos</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-400">{perfis.filter(p => p.alertasCriticos > 0).length}</span>
                    <AlertTriangle size={12} className="text-red-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">CR cadastrado</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{perfis.filter(p => p.numeroCr).length}/{stats.totalAtiradores}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Nunca exportaram</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-yellow-400">{perfis.filter(p => p.totalExportacoes === 0).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tabela de Usuários */}
      <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl overflow-hidden">
        {/* Barra de Ferramentas */}
        <div className="p-4 border-b border-brand-dark-5 flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, email ou CPF..."
              className="w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/40"
            />
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={13} className="text-gray-600" />
            {(['todos', 'ativo', 'recente', 'inativo', 'nunca'] as FiltroStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFiltroStatus(f)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                  filtroStatus === f
                    ? 'bg-brand-blue/20 border-brand-blue/40 text-brand-blue-light'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-500 hover:text-gray-300'
                }`}
              >
                {f === 'nunca' ? 'Nunca acessou' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-600 ml-auto">
            {perfisFiltrados.length} resultado(s)
          </span>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          {perfisFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Users size={36} className="mb-3 opacity-30" />
              <p className="text-sm">Nenhum atirador encontrado</p>
              {busca && <p className="text-xs mt-1">Tente ajustar os filtros de busca</p>}
              {!busca && perfis.length === 0 && (
                <p className="text-xs mt-1 text-gray-700">Ainda não há usuários CAC Individual cadastrados na plataforma</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-dark-5">
                  {[
                    { label: 'Atirador', col: 'nome' as OrdemSort },
                    { label: 'CPF', col: null },
                    { label: 'Status', col: null },
                    { label: 'Último Acesso', col: 'ultimo_acesso' as OrdemSort },
                    { label: 'Acervo', col: 'armas' as OrdemSort },
                    { label: 'CR Válido até', col: null },
                    { label: 'Alertas', col: 'alertas' as OrdemSort },
                    { label: 'Exports', col: null },
                    { label: 'Tutorial', col: null },
                    { label: 'Vínculos', col: null },
                    { label: 'Cadastro', col: 'cadastro' as OrdemSort },
                    { label: '', col: null },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap ${h.col ? 'cursor-pointer hover:text-gray-400 select-none' : ''}`}
                      onClick={h.col ? () => toggleOrdem(h.col!) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {h.label}
                        {h.col && <SortIcon col={h.col} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfisFiltrados.map(p => (
                  <LinhaAtirador
                    key={p.id}
                    perfil={p}
                    onClick={() => setPerfilSelecionado(p)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Detalhe */}
      {perfilSelecionado && (
        <ModalDetalheAtirador
          perfil={perfilSelecionado}
          onClose={() => setPerfilSelecionado(null)}
        />
      )}
    </div>
  );
}
