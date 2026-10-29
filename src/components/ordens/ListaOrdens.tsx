import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, ChevronRight, FileText, Trash2, CheckCircle, Clock } from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useServicos } from '../../context/ServicosContext';
import { StatusOS, StatusExecucaoServico, StatusOperacionalOS } from '../../types';
import {
  formatarMoeda,
  classeStatus,
  obterResumoExecucao,
  obterStatusOperacionalOS,
  isOrdemConcluida,
  removerAcentos
} from '../../utils/formatters';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { useAuth } from '../../context/AuthContext';

const STATUS_FILTROS: { label: string; valor: StatusOS }[] = [
  { label: 'Aguardando Pagamento', valor: 'Aguardando Pagamento' },
  { label: 'Parciais',            valor: 'Parcialmente Pago' },
  { label: 'Gratuidades',         valor: 'Gratuidade' },
  { label: 'Pagas',               valor: 'Pago' },
];

const STATUS_EXEC_FILTROS: { label: string; valor: StatusExecucaoServico }[] = [
  { label: 'Não Iniciado',            valor: 'Não Iniciado' },
  { label: 'Iniciado',                valor: 'Iniciado — Montando Processo' },
  { label: 'Agd Documentos',          valor: 'Aguardando Documentos' },
  { label: 'Protocolado',             valor: 'Protocolado — Ag. PF' },
  { label: 'Em Espera / Programado',  valor: 'Aguardando Etapa / Programado' },
  { label: 'Concluídos',              valor: 'Concluído' },
  { label: 'Cancelados',              valor: 'Cancelado / Não Executado' },
];

export function ListaOrdens() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ordens, deletarOrdem } = useOrdens();
  const { usuario } = useAuth();
  const podeExcluir = usuario?.role === 'admin' || usuario?.permissoes?.includes('excluir_registros');
  const { servicos } = useServicos();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  
  // Estados derivados da URL
  const busca = searchParams.get('busca') || '';
  const abaAtiva = (searchParams.get('aba') as 'ativas' | 'concluidas') || 'ativas';
  const filtroOpGeral = (searchParams.get('op') as StatusOperacionalOS | '') || '';
  const filtrosStatus = useMemo(() => searchParams.getAll('status') as StatusOS[], [searchParams]);
  const filtrosStatusExec = useMemo(() => searchParams.getAll('exec') as StatusExecucaoServico[], [searchParams]);
  const filtrosServico = useMemo(() => searchParams.getAll('servico'), [searchParams]);
  const filtrosGru = useMemo(() => searchParams.getAll('gru'), [searchParams]);

  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);
  const [expandirFiltros, setExpandirFiltros] = useState(false);

  // Helper para atualizar params de forma fluida
  const updateParams = (key: string, value: string | string[] | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      if (Array.isArray(value)) {
        value.forEach(v => next.append(key, v));
      } else if (value) {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const handleDeletar = async () => {
    if (!confirmandoDelete) return;
    try {
      await deletarOrdem(confirmandoDelete);
      setConfirmandoDelete(null);
      mostrar('sucesso', 'Ordem de serviço excluída com sucesso.');
    } catch (error) {
      console.error(error);
      mostrar('erro', 'Falha ao excluir a O.S.');
    }
  };

  useEffect(() => {
    const state = location.state as { filtroStatusExecucao?: StatusExecucaoServico };
    if (state?.filtroStatusExecucao) {
      updateParams('exec', [state.filtroStatusExecucao]);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Contadores de Status Operacional Geral das O.S. em aberto
  const contadoresOperacionais = useMemo(() => {
    const abertas = ordens.filter(o => !isOrdemConcluida(o));
    let pendenteProtocolar = 0;
    let aguardandoPF = 0;
    let emEspera = 0;
    abertas.forEach(o => {
      const st = obterStatusOperacionalOS(o).status;
      if (st === 'Pendente Protocolar') pendenteProtocolar++;
      else if (st === 'Aguardando PF') aguardandoPF++;
      else if (st === 'Em Espera / Programada') emEspera++;
    });
    return { pendenteProtocolar, aguardandoPF, emEspera };
  }, [ordens]);

  const ordensFiltradas = ordens.filter(o => {
    // Primeiro filtro: Aba Ativa vs Concluída
    const statusConclusao = isOrdemConcluida(o);
    if (abaAtiva === 'ativas' && statusConclusao) return false;
    if (abaAtiva === 'concluidas' && !statusConclusao) return false;

    if (filtroOpGeral && abaAtiva === 'ativas') {
      const stOp = obterStatusOperacionalOS(o).status;
      if (stOp !== filtroOpGeral) return false;
    }

    const matchBusca = !busca || [
      o.nomeCliente, 
      o.cpf, 
      o.servicos ? o.servicos.map(s => s.nome).join(' ') : (o as any).servico, 
      String(o.numero)
    ].some(v => removerAcentos(String(v || '').toLowerCase()).includes(removerAcentos(busca.toLowerCase())));
    
    const matchStatus = filtrosStatus.length === 0 || filtrosStatus.includes(o.status);
    const matchStatusExec = filtrosStatusExec.length === 0 || 
      (o.servicos && o.servicos.some((s: any) => filtrosStatusExec.includes(s.statusExecucao || 'Não Iniciado')));
    
    const matchServico = filtrosServico.length === 0 || 
      (o.servicos && o.servicos.some((s: any) => filtrosServico.includes(s.nome)));
    
    const matchGru = filtrosGru.length === 0 || (() => {
      const servicosExigemGru = o.servicos?.filter((s: any) => s.exigeGRU === true || (s.exigeGRU === undefined && (s.taxaPF || 0) > 0)) || [];
      if (servicosExigemGru.length === 0) return false;
      
      const todasPagas = servicosExigemGru.every((s: any) => s.pagoGRU === true);
      const algumaPendente = servicosExigemGru.some((s: any) => !s.pagoGRU);
      
      return filtrosGru.some(f => {
        if (f === 'paga') return todasPagas;
        if (f === 'pendente') return algumaPendente;
        return false;
      });
    })();
    
    return matchBusca && matchStatus && matchStatusExec && matchServico && matchGru;
  });

  const toggleFiltroStatus = (val: StatusOS) => {
    const next = filtrosStatus.includes(val) ? filtrosStatus.filter(v => v !== val) : [...filtrosStatus, val];
    updateParams('status', next);
  };

  const toggleFiltroStatusExec = (val: StatusExecucaoServico) => {
    const next = filtrosStatusExec.includes(val) ? filtrosStatusExec.filter(v => v !== val) : [...filtrosStatusExec, val];
    updateParams('exec', next);
  };
  
  const toggleFiltroServico = (val: string) => {
    const next = filtrosServico.includes(val) ? filtrosServico.filter(v => v !== val) : [...filtrosServico, val];
    updateParams('servico', next);
  };

  const toggleFiltroGru = (val: string) => {
    const next = filtrosGru.includes(val) ? filtrosGru.filter(v => v !== val) : [...filtrosGru, val];
    updateParams('gru', next);
  };

  const limparFiltros = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Ordens de Serviço</h1>
          <p className="text-sm text-gray-400">{ordens.length} total • {ordensFiltradas.length} exibidas</p>
        </div>
        <button
          id="btn-nova-os"
          onClick={() => navigate('/ordens/nova')}
          className="btn-primary"
        >
          <Plus size={16} />
          Nova OS
        </button>
      </div>

      {/* ── Seletor de Abas + Filtros Rápidos de Status Geral da O.S. ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-brand-dark-3 border border-brand-dark-5 rounded-xl w-fit">
          <button 
            onClick={() => {
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('aba', 'ativas');
                return next;
              }, { replace: true });
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
              abaAtiva === 'ativas' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Clock size={14} />
            Em Aberto
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${abaAtiva === 'ativas' ? 'bg-white/20' : 'bg-brand-dark-5'}`}>
              {ordens.filter(o => !isOrdemConcluida(o)).length}
            </span>
          </button>
          <button 
            onClick={() => {
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('aba', 'concluidas');
                next.delete('op');
                return next;
              }, { replace: true });
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
              abaAtiva === 'concluidas' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <CheckCircle size={14} />
            Histórico / Concluídas
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${abaAtiva === 'concluidas' ? 'bg-white/20' : 'bg-brand-dark-5'}`}>
              {ordens.filter(o => isOrdemConcluida(o)).length}
            </span>
          </button>
        </div>

        {/* Pílulas de Status Operacional Geral da O.S. */}
        {abaAtiva === 'ativas' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => updateParams('op', filtroOpGeral === 'Pendente Protocolar' ? null : 'Pendente Protocolar')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                filtroOpGeral === 'Pendente Protocolar'
                  ? 'bg-red-500/25 text-red-300 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                  : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:border-red-500/40 hover:text-red-300'
              }`}
            >
              <span>🚨 Pendente Protocolar</span>
              <span className="px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 text-[10px]">
                {contadoresOperacionais.pendenteProtocolar}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateParams('op', filtroOpGeral === 'Aguardando PF' ? null : 'Aguardando PF')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                filtroOpGeral === 'Aguardando PF'
                  ? 'bg-purple-500/25 text-purple-300 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                  : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:border-purple-500/40 hover:text-purple-300'
              }`}
            >
              <span>📤 Aguardando PF</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                {contadoresOperacionais.aguardandoPF}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateParams('op', filtroOpGeral === 'Em Espera / Programada' ? null : 'Em Espera / Programada')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                filtroOpGeral === 'Em Espera / Programada'
                  ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:border-indigo-500/40 hover:text-indigo-300'
              }`}
            >
              <span>⏸️ Em Espera / Programada</span>
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                {contadoresOperacionais.emEspera}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Busca e Filtros ── */}
      <div className="card space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Buscar por nome, CPF, número ou serviço..."
              value={busca}
              onChange={e => updateParams('busca', e.target.value)}
            />
          </div>
          <button
            onClick={() => setExpandirFiltros(!expandirFiltros)}
            className={`px-4 flex items-center gap-2 rounded-xl border transition-all ${
              expandirFiltros || filtrosStatus.length > 0 || filtrosStatusExec.length > 0 || filtrosServico.length > 0 || filtrosGru.length > 0
                ? 'bg-brand-blue/10 border-brand-blue text-brand-blue-light'
                : 'bg-brand-dark-5 border-brand-dark-5 text-gray-400'
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Filtros</span>
            {(filtrosStatus.length + filtrosStatusExec.length + filtrosServico.length + filtrosGru.length) > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] flex items-center justify-center font-bold">
                {filtrosStatus.length + filtrosStatusExec.length + filtrosServico.length + filtrosGru.length}
              </span>
            )}
          </button>
        </div>

        {(expandirFiltros || filtrosStatus.length > 0 || filtrosStatusExec.length > 0 || filtrosServico.length > 0 || filtrosGru.length > 0) && (
          <div className="pt-4 border-t border-brand-dark-5 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Status Pagamento */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  Pagamento
                  {filtrosStatus.length > 0 && <button onClick={() => updateParams('status', [])} className="text-brand-blue hover:text-white transition-colors">Limpar</button>}
                </p>
                <div className="flex flex-col gap-2">
                  {STATUS_FILTROS.map(({ label, valor }) => (
                    <div key={valor} className="flex items-center gap-3 group cursor-pointer">
                      <div 
                        onClick={() => toggleFiltroStatus(valor)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          filtrosStatus.includes(valor) ? 'bg-brand-blue border-brand-blue' : 'bg-brand-dark-5 border-brand-dark-5 group-hover:border-brand-metal'
                        }`}
                      >
                        {filtrosStatus.includes(valor) && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className={`text-xs font-semibold transition-colors ${filtrosStatus.includes(valor) ? 'text-brand-blue-light' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Execução */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  Execução / Operacional
                  {filtrosStatusExec.length > 0 && <button onClick={() => updateParams('exec', [])} className="text-brand-blue hover:text-white transition-colors">Limpar</button>}
                </p>
                <div className="flex flex-col gap-2">
                  {STATUS_EXEC_FILTROS.map(({ label, valor }) => (
                    <div key={valor} className="flex items-center gap-3 group cursor-pointer">
                      <div 
                        onClick={() => toggleFiltroStatusExec(valor)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          filtrosStatusExec.includes(valor) ? 'bg-brand-blue border-brand-blue' : 'bg-brand-dark-5 border-brand-dark-5 group-hover:border-brand-metal'
                        }`}
                      >
                        {filtrosStatusExec.includes(valor) && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className={`text-xs font-semibold transition-colors ${filtrosStatusExec.includes(valor) ? 'text-brand-blue-light' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* GRU */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  Controle de GRU
                  {filtrosGru.length > 0 && <button onClick={() => updateParams('gru', [])} className="text-brand-blue hover:text-white transition-colors">Limpar</button>}
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'GRU Paga', valor: 'paga' },
                    { label: 'GRU Pendente', valor: 'pendente' }
                  ].map(({ label, valor }) => (
                    <div key={valor} className="flex items-center gap-3 group cursor-pointer">
                      <div 
                        onClick={() => toggleFiltroGru(valor)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          filtrosGru.includes(valor) ? 'bg-brand-blue border-brand-blue' : 'bg-brand-dark-5 border-brand-dark-5 group-hover:border-brand-metal'
                        }`}
                      >
                        {filtrosGru.includes(valor) && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className={`text-xs font-semibold transition-colors ${filtrosGru.includes(valor) ? 'text-brand-blue-light' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Serviços */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  Serviços
                  {filtrosServico.length > 0 && (
                    <button onClick={() => updateParams('servico', [])} className="text-brand-blue hover:text-white transition-colors">Limpar</button>
                  )}
                </p>
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-dark-5 scrollbar-track-transparent">
                  {servicos.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 group cursor-pointer">
                      <div 
                        onClick={() => toggleFiltroServico(s.nome)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                          filtrosServico.includes(s.nome) ? 'bg-brand-blue border-brand-blue' : 'bg-brand-dark-5 border-brand-dark-5 group-hover:border-brand-metal'
                        }`}
                      >
                        {filtrosServico.includes(s.nome) && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className={`text-xs font-semibold truncate transition-colors ${filtrosServico.includes(s.nome) ? 'text-brand-blue-light' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        {s.nome}
                      </span>
                    </div>
                  ))}
                  {servicos.length === 0 && (
                    <p className="text-[10px] text-gray-600 italic">Nenhum serviço configurado</p>
                  )}
                </div>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-brand-dark-5/30 flex justify-end">
              <button 
                onClick={limparFiltros}
                className="text-[10px] font-bold text-red-400/70 hover:text-red-400 underline underline-offset-4 uppercase tracking-wider transition-all"
              >
                Resetar Todos os Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      {ordensFiltradas.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-full bg-brand-dark-5 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-500" />
          </div>
          <p className="text-gray-400 font-medium">Nenhuma OS encontrada</p>
          <p className="text-sm text-gray-500 mt-1">
            {busca || filtroOpGeral || filtrosStatus.length > 0 || filtrosStatusExec.length > 0 || filtrosServico.length > 0 || filtrosGru.length > 0
              ? 'Tente ajustar os filtros de busca'
              : 'Clique em "Nova OS" para criar a primeira ordem'}
          </p>
          {!busca && !filtroOpGeral && filtrosStatus.length === 0 && filtrosStatusExec.length === 0 && filtrosServico.length === 0 && filtrosGru.length === 0 && (
            <button onClick={() => navigate('/ordens/nova')} className="btn-primary mt-4 mx-auto">
              <Plus size={16} />
              Criar primeira OS
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ordensFiltradas.map(ordem => {
            const stOp = obterStatusOperacionalOS(ordem);
            return (
            <div
              key={ordem.id}
              onClick={() => navigate(`/ordens/${ordem.id}`)}
              className="card-hover !py-2.5 !px-4 flex items-center gap-4"
            >
              {/* Número */}
              <div className="flex-shrink-0 w-14 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">OS</p>
                <p className="text-sm font-bold text-white">#{String(ordem.numero).padStart(4, '0')}</p>
                {ordem.migrado && (
                  <span className="text-[8px] font-black text-brand-blue-light border border-brand-blue/30 px-1 rounded-sm mt-0.5 inline-block uppercase tracking-tighter shadow-[0_0_5px_rgba(45,141,224,0.1)]">Histórico</span>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-brand-dark-5 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white leading-tight">{ordem.nomeCliente}</p>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${stOp.classe}`}
                    title={stOp.resumo}
                  >
                    <span>{stOp.icone}</span>
                    <span>{stOp.rotuloCurto}</span>
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{ordem.servicos ? ordem.servicos.map((s: any) => s.nome).join(', ') : (ordem as any).servico}</p>
                {ordem.criadoPorNome && (
                  <p className="text-[8px] text-brand-blue-light/70 font-bold uppercase mt-0.5 tracking-tighter">Emitido por: {ordem.criadoPorNome}</p>
                )}
                
                {/* Status de Execução e GRU */}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {ordem.servicos && ordem.servicos.length > 0 ? (
                    (() => {
                      const resumo = obterResumoExecucao(ordem.servicos);
                      if (!resumo) return null;

                      if (resumo.tipo === 'unificado' || resumo.tipo === 'parcial') {
                        return (
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shadow-sm ${resumo.classe}`}>
                            <span>{resumo.icone}</span>
                            <span>{resumo.texto}</span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-1.5 w-fit">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter whitespace-nowrap">
                            {resumo.texto}
                          </span>
                          <div className="w-16 h-1 bg-brand-dark-5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-brand-blue transition-all duration-500 shadow-[0_0_8px_rgba(45,141,224,0.4)]"
                              style={{ width: `${resumo.progresso}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-brand-blue-light">{resumo.progresso}%</span>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter italic">Sem serviços</span>
                  )}

                  {/* Status de GRU */}
                  {(() => {
                    const servicosExigemGru = ordem.servicos?.filter((s: any) => s.exigeGRU === true || (s.exigeGRU === undefined && (s.taxaPF || 0) > 0)) || [];
                    if (servicosExigemGru.length === 0) return null;
                    const todasPagas = servicosExigemGru.every((s: any) => s.pagoGRU === true);
                    return (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider shadow-sm ${
                        todasPagas 
                          ? 'bg-brand-green/10 text-brand-green border-brand-green/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <span>{todasPagas ? '✅' : '❌'}</span>
                        <span>GRU {todasPagas ? 'Paga' : 'Pendente'}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="flex-shrink-0 text-right flex flex-col items-end gap-0.5">
                {ordem.desconto && ordem.desconto > 0 ? (
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[9px] text-gray-500 line-through">{formatarMoeda(ordem.valor)}</span>
                    <span className={`text-xs font-black ${ordem.status === 'Pago' ? 'text-brand-green' : 'text-white'}`}>{formatarMoeda(ordem.valor - ordem.desconto)}</span>
                  </div>
                ) : (
                  <p className={`text-xs font-bold ${ordem.status === 'Pago' ? 'text-brand-green' : 'text-white'}`}>{formatarMoeda(ordem.valor)}</p>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter shadow-sm border ${classeStatus(ordem.status)}`}>
                  {ordem.status}
                </span>
                {ordem.status === 'Parcialmente Pago' && (
                  <p className="text-[8px] font-bold text-orange-400 uppercase">Falta {formatarMoeda((ordem.valor - (ordem.desconto || 0)) - (ordem.valorPago || 0))}</p>
                )}
              </div>

              {/* Ações */}
              <div className="flex flex-col items-center gap-1">
                {podeExcluir && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmandoDelete(ordem.id);
                    }}
                    className="p-1 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                    title="Excluir O.S."
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
              </div>
            </div>
            );
          })}
        </div>
      )}
      <Notificacao {...notif} onFechar={fechar} />
      
      <DialogConfirmacao
        aberto={!!confirmandoDelete}
        titulo="Excluir Ordem de Serviço"
        mensagem="Tem certeza que deseja excluir esta O.S.? Esta ação não pode ser desfeita."
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(null)}
      />
    </div>
  );
}
