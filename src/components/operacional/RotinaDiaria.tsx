import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  Search,
  User,
  Key,
  Package,
  AlertCircle,
  CalendarClock,
  Send,
  PauseCircle,
  Zap,
  Clock,
  Hammer,
  FileWarning
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import {
  formatarNumeroOS,
  formatarData,
  removerAcentos,
  isServicoPendenteProtocolar,
  isServicoEmEsperaAtiva,
  isServicoProgramadoLiberado,
  classeStatusExecucao,
  iconeStatusExecucao
} from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { StatusExecucaoServico } from '../../types';

type AbaOperacional = 'protocolar' | 'conferir_pf' | 'espera';

export function RotinaDiaria() {
  const navigate = useNavigate();
  const { 
    ordens, 
    atualizarStatusServico,
    atualizarDadosServico
  } = useOrdens();
  const { clientes } = useClientes();
  const { estado: notif, mostrar, fechar } = useNotificacao();

  const [abaAtiva, setAbaAtiva] = useState<AbaOperacional>('protocolar');
  const [busca, setBusca] = useState('');
  const [servicoFiltro, setServicoFiltro] = useState('');
  const [filiadoFiltro, setFiliadoFiltro] = useState('');
  const [apenasPagos, setApenasPagos] = useState(false);

  // Modal rápido para Protocolar
  const [modalProtocolar, setModalProtocolar] = useState<{
    ordemId: string;
    numeroOS: number;
    nomeCliente: string;
    servicoId: string;
    servicoNome: string;
    protocoloAtual: string;
  } | null>(null);
  const [protocoloInput, setProtocoloInput] = useState('');
  const [salvandoModal, setSalvandoModal] = useState(false);

  // Modal rápido para Adiar / Colocar em Espera
  const [modalEspera, setModalEspera] = useState<{
    ordemId: string;
    numeroOS: number;
    nomeCliente: string;
    servicoId: string;
    servicoNome: string;
    dataAtual?: string;
  } | null>(null);
  const [dataEsperaInput, setDataEsperaInput] = useState<string>('');

  // 1. Fila para Protocolar (Itens não protocolados ou com agendamento já vencido/atingido)
  const filaProtocolar = useMemo(() => {
    return ordens
      .filter(o => o.servicos?.some(s => isServicoPendenteProtocolar(s)))
      .map(o => {
        const clienteLive = clientes.find(c => c.cpf === o.cpf);
        const diasAberta = Math.max(
          0,
          Math.floor((Date.now() - new Date(o.criadoEm).getTime()) / (1000 * 60 * 60 * 24))
        );
        return {
          ...o,
          senhaGov: clienteLive?.senhaGov || o.senhaGov,
          diasAberta,
          servicosPendentes: o.servicos.filter(s => isServicoPendenteProtocolar(s))
        };
      })
      .sort((a, b) => {
        // Prioridade máxima: O.S. já PAGA primeiro!
        const pesoPago = (status: string) =>
          status === 'Pago' ? 0 : status === 'Parcialmente Pago' ? 1 : status === 'Gratuidade' ? 2 : 3;
        const diffPago = pesoPago(a.status) - pesoPago(b.status);
        if (diffPago !== 0) return diffPago;
        // Em seguida, mais antigas primeiro para não cair no esquecimento
        return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
      });
  }, [ordens, clientes]);

  // 2. Conferência na PF (Protocolados)
  const conferenciasPF = useMemo(() => {
    return ordens
      .filter(o => o.servicos?.some(s => s.statusExecucao === 'Protocolado — Ag. PF'))
      .map(o => {
        const clienteLive = clientes.find(c => c.cpf === o.cpf);
        return {
          ...o,
          senhaGov: clienteLive?.senhaGov || o.senhaGov,
          servicosProtocolados: o.servicos.filter(s => s.statusExecucao === 'Protocolado — Ag. PF')
        };
      });
  }, [ordens, clientes]);

  // 3. Em Espera / Programados (Aguardando etapa anterior da PF ou data futura)
  const filaEspera = useMemo(() => {
    return ordens
      .filter(o => o.servicos?.some(s => isServicoEmEsperaAtiva(s)))
      .map(o => {
        const clienteLive = clientes.find(c => c.cpf === o.cpf);
        return {
          ...o,
          senhaGov: clienteLive?.senhaGov || o.senhaGov,
          servicosEmEspera: o.servicos.filter(s => isServicoEmEsperaAtiva(s))
        };
      })
      .sort((a, b) => {
        const dataA = a.servicosEmEspera.find(s => s.dataProgramada)?.dataProgramada || '9999-12-31';
        const dataB = b.servicosEmEspera.find(s => s.dataProgramada)?.dataProgramada || '9999-12-31';
        return dataA.localeCompare(dataB);
      });
  }, [ordens, clientes]);

  // Serviços únicos disponíveis na aba ativa para o filtro dropdown
  const servicosDisponiveis = useMemo(() => {
    const nomes = new Set<string>();
    if (abaAtiva === 'protocolar') {
      filaProtocolar.forEach(o => o.servicosPendentes.forEach(s => nomes.add(s.nome)));
    } else if (abaAtiva === 'conferir_pf') {
      conferenciasPF.forEach(o => o.servicosProtocolados.forEach(s => nomes.add(s.nome)));
    } else {
      filaEspera.forEach(o => o.servicosEmEspera.forEach(s => nomes.add(s.nome)));
    }
    return Array.from(nomes).sort();
  }, [abaAtiva, filaProtocolar, conferenciasPF, filaEspera]);

  const filtrarLista = <T extends { nomeCliente: string; cpf: string; numero: number; filiadoProTiro: boolean; status: string }>(
    lista: T[],
    getServicos: (item: T) => { nome: string; protocolo?: string }[]
  ) => {
    return lista.filter(o => {
      const servs = getServicos(o);
      const matchBusca = !busca || [
        o.nomeCliente,
        o.cpf,
        String(o.numero),
        servs.map(s => s.nome).join(' '),
        servs.map(s => s.protocolo || '').join(' ')
      ].some(v => removerAcentos(String(v || '').toLowerCase()).includes(removerAcentos(busca.toLowerCase())));

      const matchServico = !servicoFiltro || servs.some(s => s.nome === servicoFiltro);

      let matchFiliado = true;
      if (filiadoFiltro === 'filiado') matchFiliado = o.filiadoProTiro === true;
      else if (filiadoFiltro === 'nao_filiado') matchFiliado = o.filiadoProTiro === false;

      const matchPago = !apenasPagos || o.status === 'Pago';

      return matchBusca && matchServico && matchFiliado && matchPago;
    });
  };

  const protocolarFiltrados = useMemo(
    () => filtrarLista(filaProtocolar, o => o.servicosPendentes),
    [filaProtocolar, busca, servicoFiltro, filiadoFiltro, apenasPagos]
  );

  const conferenciasFiltradas = useMemo(
    () => filtrarLista(conferenciasPF, o => o.servicosProtocolados),
    [conferenciasPF, busca, servicoFiltro, filiadoFiltro, apenasPagos]
  );

  const esperaFiltrados = useMemo(
    () => filtrarLista(filaEspera, o => o.servicosEmEspera),
    [filaEspera, busca, servicoFiltro, filiadoFiltro, apenasPagos]
  );

  // Auto-scroll e realce de O.S. ao voltar para a listagem
  useEffect(() => {
    const lastOsId = sessionStorage.getItem('last_os_id');
    if (lastOsId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`os-card-${lastOsId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('border-brand-blue');
          element.classList.remove('border-brand-dark-5');
          setTimeout(() => {
            element.classList.remove('border-brand-blue');
            element.classList.add('border-brand-dark-5');
          }, 2500);
        }
        sessionStorage.removeItem('last_os_id');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [protocolarFiltrados, conferenciasFiltradas, esperaFiltrados]);

  const copiarParaTransferencia = (texto: string, tipo: string) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    mostrar('sucesso', `${tipo} copiado para a área de transferência!`);
  };

  const handleAlterarStatusRapido = async (ordemId: string, servicoId: string, novoStatus: StatusExecucaoServico) => {
    try {
      await atualizarStatusServico(ordemId, servicoId, novoStatus);
      mostrar('sucesso', `Status atualizado para "${novoStatus}"!`);
    } catch (err: any) {
      mostrar('erro', 'Erro ao atualizar status: ' + (err.message || ''));
    }
  };

  const handleConfirmarProtocoloRapido = async () => {
    if (!modalProtocolar) return;
    setSalvandoModal(true);
    try {
      await atualizarStatusServico(
        modalProtocolar.ordemId,
        modalProtocolar.servicoId,
        'Protocolado — Ag. PF',
        protocoloInput.trim().toUpperCase()
      );
      setModalProtocolar(null);
      setProtocoloInput('');
      mostrar('sucesso', '📤 Serviço marcado como Protocolado e movido para Conferência na PF!');
    } catch (err: any) {
      mostrar('erro', 'Erro ao protocolar serviço: ' + (err.message || ''));
    } finally {
      setSalvandoModal(false);
    }
  };

  const handleConfirmarEsperaRapida = async () => {
    if (!modalEspera) return;
    setSalvandoModal(true);
    try {
      await atualizarDadosServico(modalEspera.ordemId, modalEspera.servicoId, {
        statusExecucao: 'Aguardando Etapa / Programado',
        dataProgramada: dataEsperaInput || undefined
      });
      setModalEspera(null);
      setDataEsperaInput('');
      mostrar(
        'sucesso',
        dataEsperaInput
          ? `⏸️ Serviço programado para ${dataEsperaInput.split('-').reverse().join('/')}!`
          : '⏸️ Serviço colocado em espera (aguardando etapa da PF)!'
      );
    } catch (err: any) {
      mostrar('erro', 'Erro ao programar serviço: ' + (err.message || ''));
    } finally {
      setSalvandoModal(false);
    }
  };

  const definirDiasModalEspera = (dias: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + dias);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setDataEsperaInput(iso);
  };

  const handleConcluirServico = async (ordemId: string, servicoId: string) => {
    if (confirm('Deseja marcar este serviço como CONCLUÍDO?')) {
      try {
        const res = await atualizarStatusServico(ordemId, servicoId, 'Concluído');
        if (res && res.etapaDesbloqueada) {
          mostrar(
            'sucesso',
            `✅ Concluído! ⚡ Efeito Dominó: "${res.etapaDesbloqueada}" foi liberada automaticamente para a Fila de Protocolar!`
          );
        } else {
          mostrar('sucesso', 'Serviço marcado como Concluído!');
        }
      } catch (err: any) {
        console.error('[DEBUG Rotina] Erro ao concluir serviço:', err);
        mostrar('erro', 'Erro ao concluir serviço: ' + (err.message || ''));
      }
    }
  };

  const totalPagosNaoProtocolados = useMemo(
    () => filaProtocolar.filter(o => o.status === 'Pago').length,
    [filaProtocolar]
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="text-brand-blue" />
            Central Operacional & Rotina Diária
          </h1>
          <p className="text-gray-400 text-sm">
            Controle total para nenhuma O.S. cair no esquecimento: protocole pendências, confira processos na PF e gerencie serviços futuros.
          </p>
        </div>
      </div>

      {/* Abas Principais com Contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => { setAbaAtiva('protocolar'); setServicoFiltro(''); }}
          className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
            abaAtiva === 'protocolar'
              ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
              : 'bg-brand-dark-3/70 border-brand-dark-5 hover:border-red-500/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400">
              <AlertCircle size={15} />
              1. Fila para Protocolar
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {totalPagosNaoProtocolados > 0 ? (
                <span className="text-brand-green-light font-bold">
                  💰 {totalPagosNaoProtocolados} O.S. já paga(s) aguardando protocolo
                </span>
              ) : (
                'Serviços prontos para montar e protocolar'
              )}
            </p>
          </div>
          <span className={`text-xl font-black px-3 py-1 rounded-lg border ${
            filaProtocolar.length > 0
              ? 'bg-red-500/20 text-red-300 border-red-500/40'
              : 'bg-brand-dark-4 text-gray-500 border-brand-dark-5'
          }`}>
            {filaProtocolar.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setAbaAtiva('conferir_pf'); setServicoFiltro(''); }}
          className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
            abaAtiva === 'conferir_pf'
              ? 'bg-purple-500/15 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
              : 'bg-brand-dark-3/70 border-brand-dark-5 hover:border-purple-500/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
              <Package size={15} />
              2. Conferir na PF
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Processos já protocolados aguardando deferimento
            </p>
          </div>
          <span className={`text-xl font-black px-3 py-1 rounded-lg border ${
            conferenciasPF.length > 0
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-brand-dark-4 text-gray-500 border-brand-dark-5'
          }`}>
            {conferenciasPF.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setAbaAtiva('espera'); setServicoFiltro(''); }}
          className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
            abaAtiva === 'espera'
              ? 'bg-indigo-500/15 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
              : 'bg-brand-dark-3/70 border-brand-dark-5 hover:border-indigo-500/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-300">
              <CalendarClock size={15} />
              3. Em Espera / Programados
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              2ª etapa (CRAF/GT) ou agendados para 1–2 meses
            </p>
          </div>
          <span className={`text-xl font-black px-3 py-1 rounded-lg border ${
            filaEspera.length > 0
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              : 'bg-brand-dark-4 text-gray-500 border-brand-dark-5'
          }`}>
            {filaEspera.length}
          </span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="card p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            className="input pl-9 w-full"
            placeholder="Buscar por cliente, CPF, nº da O.S. ou protocolo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <select
          className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-blue outline-none transition-colors w-full sm:w-52"
          value={servicoFiltro}
          onChange={e => setServicoFiltro(e.target.value)}
        >
          <option value="">Todos os Serviços</option>
          {servicosDisponiveis.map(nome => (
            <option key={nome} value={nome}>{nome}</option>
          ))}
        </select>

        <select
          className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-blue outline-none transition-colors w-full sm:w-40"
          value={filiadoFiltro}
          onChange={e => setFiliadoFiltro(e.target.value)}
        >
          <option value="">Afiliação (Todas)</option>
          <option value="filiado">Filiados</option>
          <option value="nao_filiado">Não Filiados</option>
        </select>

        <button
          type="button"
          onClick={() => setApenasPagos(p => !p)}
          className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap w-full sm:w-auto ${
            apenasPagos
              ? 'bg-brand-green/20 text-brand-green-light border-brand-green/50'
              : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:text-white'
          }`}
        >
          💰 Só O.S. Pagas
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ABA 1: FILA PARA PROTOCOLAR
         ═══════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'protocolar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={16} />
              O.S. com Serviços Pendentes de Protocolar ({protocolarFiltrados.length})
            </h2>
            <span className="text-xs text-gray-400">
              💡 Ordenado automaticamente priorizando <strong>O.S. já Pagas</strong> e mais antigas
            </span>
          </div>

          <div className="space-y-3">
            {protocolarFiltrados.length === 0 ? (
              <div className="card py-10 text-center text-gray-400 text-sm">
                🎉 Excelente! Nenhuma O.S. pendente de protocolar encontrada neste filtro.
              </div>
            ) : (
              protocolarFiltrados.map((o, index) => (
                <div
                  key={o.id}
                  id={`os-card-${o.id}`}
                  className={`card transition-all p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-scale-up ${
                    o.status === 'Pago'
                      ? 'bg-brand-dark-3/80 border-red-500/35 hover:border-red-500/60'
                      : 'bg-brand-dark-3/40 border-brand-dark-5 hover:border-brand-blue/30'
                  }`}
                >
                  {/* 1. O.S. Info & Cliente */}
                  <div className="w-full lg:w-[240px] xl:w-[270px] shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-[10px] font-black text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded border border-red-500/30 font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-black text-white">
                        {formatarNumeroOS(o.numero)}
                      </span>
                      {o.status === 'Pago' ? (
                        <span className="text-[10px] bg-brand-green/20 text-brand-green-light border border-brand-green/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          💰 JÁ PAGO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                          {o.status}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                        o.diasAberta >= 7
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-brand-dark-4 text-gray-400'
                      }`}>
                        <Clock size={10} />
                        {o.diasAberta === 0 ? 'Aberta hoje' : `Há ${o.diasAberta}d (${formatarData(o.criadoEm)})`}
                      </span>
                      {o.filiadoProTiro && (
                        <span className="text-[9px] bg-brand-blue/20 text-brand-blue-light px-1.5 py-0.5 rounded font-black uppercase">
                          Filiado
                        </span>
                      )}
                    </div>
                    <h3
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="text-sm font-bold text-white hover:text-brand-blue-light cursor-pointer transition-colors break-words"
                    >
                      {o.nomeCliente}
                    </h3>
                  </div>

                  {/* 2. Credenciais Rápidas */}
                  <div className="flex flex-row lg:flex-col xl:flex-row gap-2 items-stretch lg:items-start xl:items-center w-full lg:w-[175px] xl:w-[300px] shrink-0">
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <User size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.cpf}</span>
                      <button
                        onClick={() => copiarParaTransferencia(o.cpf, 'CPF')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        title="Copiar CPF"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <Key size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.senhaGov || '---'}</span>
                      <button
                        onClick={() => copiarParaTransferencia(o.senhaGov, 'Senha GOV.br')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        disabled={!o.senhaGov}
                        title="Copiar Senha GOV.br"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 3. Lista de Serviços Pendentes de Protocolar e Ações Rápidas */}
                  <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
                    {o.servicosPendentes.map(s => {
                      const liberadoPorData =
                        s.statusExecucao === 'Aguardando Etapa / Programado' &&
                        s.dataProgramada &&
                        isServicoProgramadoLiberado(s.dataProgramada);

                      return (
                        <div
                          key={s.id}
                          className="flex flex-col gap-2 bg-black/25 p-2.5 rounded-lg border border-white/10"
                        >
                          <div className="flex flex-col w-full min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white leading-tight">{s.nome}</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold whitespace-nowrap ${classeStatusExecucao(s.statusExecucao)}`}>
                                  {iconeStatusExecucao(s.statusExecucao)} {s.statusExecucao || 'Não Iniciado'}
                                </span>
                                {liberadoPorData && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-black whitespace-nowrap">
                                    📅 Data atingida ({s.dataProgramada?.split('-').reverse().join('/')})
                                  </span>
                                )}
                              </div>
                            </div>
                            {s.armaModelo && (
                              <span className="text-[10px] text-amber-400 font-semibold mt-1 break-words">
                                ⚔️ {s.armaModelo}
                              </span>
                            )}
                            {s.detalhes && s.detalhes.trim() && (
                              <span className="text-[11px] text-gray-300 leading-snug mt-1 break-words">
                                <strong className="text-gray-400 font-semibold">Obs:</strong> {s.detalhes}
                              </span>
                            )}
                          </div>

                          {/* Ações Rápidas em 1 Clique */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                            {s.statusExecucao !== 'Iniciado — Montando Processo' && (
                              <button
                                type="button"
                                onClick={() => handleAlterarStatusRapido(o.id, s.id, 'Iniciado — Montando Processo')}
                                className="px-2 py-1 rounded text-[9px] font-bold bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 flex items-center gap-1 transition-all whitespace-nowrap"
                                title="Marcar como Iniciado — Montando Processo"
                              >
                                <Hammer size={10} />
                                Montando
                              </button>
                            )}
                            {s.statusExecucao !== 'Aguardando Documentos' && (
                              <button
                                type="button"
                                onClick={() => handleAlterarStatusRapido(o.id, s.id, 'Aguardando Documentos')}
                                className="px-2 py-1 rounded text-[9px] font-bold bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 flex items-center gap-1 transition-all whitespace-nowrap"
                                title="Marcar como Aguardando Documentos do cliente"
                              >
                                <FileWarning size={10} />
                                Ag. Docs
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setModalProtocolar({
                                  ordemId: o.id,
                                  numeroOS: o.numero,
                                  nomeCliente: o.nomeCliente,
                                  servicoId: s.id,
                                  servicoNome: s.nome,
                                  protocoloAtual: s.protocolo || ''
                                });
                                setProtocoloInput(s.protocolo || '');
                              }}
                              className="px-2.5 py-1 rounded text-[9px] font-black uppercase bg-purple-500/20 hover:bg-purple-500 text-purple-200 hover:text-white border border-purple-500/40 flex items-center gap-1 transition-all whitespace-nowrap"
                              title="Inserir protocolo e mover para Conferir na PF"
                            >
                              <Send size={10} />
                              Protocolar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModalEspera({
                                  ordemId: o.id,
                                  numeroOS: o.numero,
                                  nomeCliente: o.nomeCliente,
                                  servicoId: s.id,
                                  servicoNome: s.nome,
                                  dataAtual: s.dataProgramada
                                });
                                setDataEsperaInput(s.dataProgramada || '');
                              }}
                              className="px-2 py-1 rounded text-[9px] font-bold bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-all whitespace-nowrap"
                              title="Adiar para 1-2 meses ou aguardar etapa anterior da PF"
                            >
                              <PauseCircle size={10} />
                              Adiar / Espera
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 4. Link Externo */}
                  <div className="flex items-center self-end lg:self-auto">
                    <button
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors bg-brand-dark-4 rounded-lg hover:bg-brand-dark-5 border border-white/5"
                      title="Abrir O.S. Completa"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ABA 2: CONFERIR NA PF (PROTOCOLADOS)
         ═══════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'conferir_pf' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-purple-300 uppercase tracking-widest flex items-center gap-2">
              <Package size={16} />
              Conferir na PF — Processos Protocolados ({conferenciasFiltradas.length})
            </h2>
          </div>

          <div className="space-y-3">
            {conferenciasFiltradas.length === 0 ? (
              <div className="card py-10 text-center text-gray-500 text-sm italic">
                {(busca || servicoFiltro || filiadoFiltro || apenasPagos)
                  ? 'Nenhum processo correspondente encontrado.'
                  : 'Nenhum processo aguardando resposta da PF no momento.'}
              </div>
            ) : (
              conferenciasFiltradas.map((o, index) => (
                <div 
                  key={o.id}
                  id={`os-card-${o.id}`}
                  className="card bg-brand-dark-3/50 border-brand-dark-5 hover:border-brand-blue/30 transition-all p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group animate-scale-up"
                >
                  {/* 1. O.S. Info & Cliente */}
                  <div className="w-full lg:w-[240px] xl:w-[270px] shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-[10px] font-black text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30 font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-black text-white">
                        {formatarNumeroOS(o.numero)}
                      </span>
                      {o.status === 'Pago' ? (
                        <span className="text-[10px] bg-brand-green/20 text-brand-green-light border border-brand-green/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          💰 JÁ PAGO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                          {o.status}
                        </span>
                      )}
                      <span className="text-[10px] bg-brand-dark-4 text-gray-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <Clock size={10} />
                        Aberta em {formatarData(o.criadoEm)}
                      </span>
                      {o.filiadoProTiro && (
                        <span className="text-[9px] bg-brand-blue/20 text-brand-blue-light px-1.5 py-0.5 rounded font-black uppercase">
                          Filiado
                        </span>
                      )}
                    </div>
                    <h3 
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="text-sm font-bold text-white hover:text-brand-blue-light cursor-pointer transition-colors break-words"
                    >
                      {o.nomeCliente}
                    </h3>
                  </div>

                  {/* 2. Credenciais Rápidas */}
                  <div className="flex flex-row lg:flex-col xl:flex-row gap-2 items-stretch lg:items-start xl:items-center w-full lg:w-[175px] xl:w-[300px] shrink-0">
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <User size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.cpf}</span>
                      <button 
                        onClick={() => copiarParaTransferencia(o.cpf, 'CPF')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        title="Copiar CPF"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <Key size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.senhaGov || '---'}</span>
                      <button 
                        onClick={() => copiarParaTransferencia(o.senhaGov, 'Senha GOV.br')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        disabled={!o.senhaGov}
                        title="Copiar Senha"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 3. Lista de Serviços Protocolados e botões de Concluir */}
                  <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
                    {o.servicosProtocolados.map(s => (
                      <div key={s.id} className="flex flex-col gap-2 bg-black/25 p-2.5 rounded-lg border border-white/10 hover:border-white/15 transition-colors">
                        <div className="flex flex-col w-full min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white leading-tight">{s.nome}</span>
                            {s.protocolo && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 font-mono font-bold whitespace-nowrap">
                                📤 Prot: {s.protocolo}
                              </span>
                            )}
                          </div>
                          {s.armaModelo && (
                            <span className="text-[10px] text-amber-400 font-semibold mt-1 break-words">
                              ⚔️ {s.armaModelo}
                            </span>
                          )}
                          {s.detalhes && s.detalhes.trim() && (
                            <span className="text-[11px] text-gray-300 leading-snug mt-1 break-words">
                              <strong className="text-gray-400 font-semibold">Obs:</strong> {s.detalhes}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                          <button 
                            onClick={() => handleConcluirServico(o.id, s.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-brand-blue/15 hover:bg-brand-blue text-brand-blue-light hover:text-white text-[9px] font-black uppercase rounded border border-brand-blue/30 transition-all whitespace-nowrap"
                          >
                            <CheckCircle size={10} />
                            Concluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 4. Link Externo */}
                  <div className="flex items-center self-end lg:self-auto">
                    <button 
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="p-1.5 text-gray-500 hover:text-white transition-colors bg-brand-dark-4 rounded-lg hover:bg-brand-dark-5 border border-white/5"
                      title="Ver OS Completa"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ABA 3: EM ESPERA / PROGRAMADOS (ETAPAS FUTURAS)
         ═══════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'espera' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <CalendarClock size={16} />
              Serviços Aguardando Etapa Anterior ou Programados ({esperaFiltrados.length})
            </h2>
            <span className="text-xs text-gray-400">
              💡 Quando a etapa anterior é concluída ou a data chega, o item vai sozinho para a <strong>Fila para Protocolar</strong>!
            </span>
          </div>

          <div className="space-y-3">
            {esperaFiltrados.length === 0 ? (
              <div className="card py-10 text-center text-gray-500 text-sm italic">
                Nenhum serviço em espera programada no momento.
              </div>
            ) : (
              esperaFiltrados.map((o, index) => (
                <div
                  key={o.id}
                  id={`os-card-${o.id}`}
                  className="card bg-brand-dark-3/50 border-indigo-500/25 hover:border-indigo-500/50 transition-all p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-scale-up"
                >
                  {/* 1. O.S. Info & Cliente */}
                  <div className="w-full lg:w-[240px] xl:w-[270px] shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/30 font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-black text-white">
                        {formatarNumeroOS(o.numero)}
                      </span>
                      {o.status === 'Pago' ? (
                        <span className="text-[10px] bg-brand-green/20 text-brand-green-light border border-brand-green/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          💰 JÁ PAGO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                          {o.status}
                        </span>
                      )}
                      <span className="text-[10px] bg-brand-dark-4 text-gray-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <Clock size={10} />
                        Aberta em {formatarData(o.criadoEm)}
                      </span>
                      {o.filiadoProTiro && (
                        <span className="text-[9px] bg-brand-blue/20 text-brand-blue-light px-1.5 py-0.5 rounded font-black uppercase">
                          Filiado
                        </span>
                      )}
                    </div>
                    <h3
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="text-sm font-bold text-white hover:text-indigo-300 cursor-pointer transition-colors break-words"
                    >
                      {o.nomeCliente}
                    </h3>
                  </div>

                  {/* 2. Credenciais Rápidas */}
                  <div className="flex flex-row lg:flex-col xl:flex-row gap-2 items-stretch lg:items-start xl:items-center w-full lg:w-[175px] xl:w-[300px] shrink-0">
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <User size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.cpf}</span>
                      <button
                        onClick={() => copiarParaTransferencia(o.cpf, 'CPF')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        title="Copiar CPF"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2.5 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 w-full">
                      <Key size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.senhaGov || '---'}</span>
                      <button
                        onClick={() => copiarParaTransferencia(o.senhaGov, 'Senha GOV.br')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all shrink-0"
                        disabled={!o.senhaGov}
                        title="Copiar Senha GOV.br"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 3. Lista de Serviços em Espera */}
                  <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
                    {o.servicosEmEspera.map(s => (
                      <div
                        key={s.id}
                        className="flex flex-col gap-2 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/20"
                      >
                        <div className="flex flex-col w-full min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white leading-tight">{s.nome}</span>
                            {s.dataProgramada ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-bold whitespace-nowrap">
                                📅 Programado p/ {s.dataProgramada.split('-').reverse().join('/')}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-bold whitespace-nowrap">
                                🔗 Aguardando liberação da etapa anterior ({s.etapaOrigemNome || 'PF'})
                              </span>
                            )}
                          </div>
                          {s.armaModelo && (
                            <span className="text-[10px] text-amber-400 font-semibold mt-1 break-words">
                              ⚔️ {s.armaModelo}
                            </span>
                          )}
                          {s.detalhes && s.detalhes.trim() && (
                            <span className="text-[11px] text-gray-300 leading-snug mt-1 break-words">
                              <strong className="text-gray-400 font-semibold">Obs:</strong> {s.detalhes}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-indigo-500/15">
                          <button
                            type="button"
                            onClick={() => {
                              setModalEspera({
                                ordemId: o.id,
                                numeroOS: o.numero,
                                nomeCliente: o.nomeCliente,
                                servicoId: s.id,
                                servicoNome: s.nome,
                                dataAtual: s.dataProgramada
                              });
                              setDataEsperaInput(s.dataProgramada || '');
                            }}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-brand-dark-4 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all whitespace-nowrap"
                          >
                            📅 Data
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAlterarStatusRapido(o.id, s.id, 'Não Iniciado')}
                            className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-indigo-500 hover:bg-indigo-400 text-white flex items-center gap-1 transition-all whitespace-nowrap"
                            title="Tirar da espera e jogar para a Fila de Protocolar agora"
                          >
                            <Zap size={11} />
                            Liberar p/ Fila Agora
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 3. Link Externo */}
                  <div className="flex items-center self-end lg:self-auto">
                    <button
                      onClick={() => {
                        sessionStorage.setItem('last_os_id', o.id);
                        navigate(`/ordens/${o.id}`);
                      }}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors bg-brand-dark-4 rounded-lg hover:bg-brand-dark-5 border border-white/5"
                      title="Abrir O.S. Completa"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal Rápido: Protocolar Serviço */}
      {modalProtocolar && (
        <Modal
          aberto={!!modalProtocolar}
          onFechar={() => setModalProtocolar(null)}
          titulo={`Protocolar — ${formatarNumeroOS(modalProtocolar.numeroOS)}`}
          tamanho="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-5">
              <p className="text-xs text-gray-400">{modalProtocolar.nomeCliente}</p>
              <p className="text-sm font-bold text-white mt-0.5">{modalProtocolar.servicoNome}</p>
            </div>
            <div>
              <label className="label">Número do Protocolo (Opcional)</label>
              <input
                type="text"
                className="input uppercase font-mono"
                placeholder="Ex: 08795.000385/2026-65"
                value={protocoloInput}
                onChange={e => setProtocoloInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmarProtocoloRapido();
                }}
                autoFocus
              />
              <p className="text-[11px] text-gray-500 mt-1">
                O serviço será movido para a aba <strong>Conferir na PF</strong>.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalProtocolar(null)}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoModal}
                onClick={handleConfirmarProtocoloRapido}
                className="btn-primary flex-1"
              >
                <Send size={14} />
                {salvandoModal ? 'Salvando...' : 'Confirmar Protocolo'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Rápido: Adiar / Colocar em Espera */}
      {modalEspera && (
        <Modal
          aberto={!!modalEspera}
          onFechar={() => setModalEspera(null)}
          titulo={`Programar / Espera — ${formatarNumeroOS(modalEspera.numeroOS)}`}
          tamanho="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-5">
              <p className="text-xs text-gray-400">{modalEspera.nomeCliente}</p>
              <p className="text-sm font-bold text-white mt-0.5">{modalEspera.servicoNome}</p>
            </div>

            <div className="space-y-2">
              <label className="label">Quando este serviço deve voltar para a Fila de Protocolar?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDataEsperaInput('')}
                  className={`p-2 rounded-lg text-xs font-bold border text-center transition-all ${
                    !dataEsperaInput
                      ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400'
                      : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:text-white'
                  }`}
                >
                  🔗 Aguardar Etapa PF
                </button>
                <button
                  type="button"
                  onClick={() => definirDiasModalEspera(15)}
                  className="p-2 rounded-lg text-xs font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all"
                >
                  📅 Daqui 15 dias
                </button>
                <button
                  type="button"
                  onClick={() => definirDiasModalEspera(30)}
                  className="p-2 rounded-lg text-xs font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all"
                >
                  📅 Daqui 1 mês (+30d)
                </button>
                <button
                  type="button"
                  onClick={() => definirDiasModalEspera(60)}
                  className="p-2 rounded-lg text-xs font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all"
                >
                  📅 Daqui 2 meses (+60d)
                </button>
              </div>
            </div>

            <div>
              <label className="label">Ou escolha uma data específica (opcional)</label>
              <input
                type="date"
                className="input"
                value={dataEsperaInput}
                onChange={e => setDataEsperaInput(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEspera(null)}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoModal}
                onClick={handleConfirmarEsperaRapida}
                className="btn-primary flex-1"
              >
                <CalendarClock size={14} />
                {salvandoModal ? 'Salvando...' : 'Salvar Espera'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Notificacao {...notif} onFechar={fechar} />
    </div>
  );
}
