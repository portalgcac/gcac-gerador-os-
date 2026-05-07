import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  Search,
  User,
  Key,
  CreditCard,
  ArrowRight,
  Package,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { formatarMoeda, formatarNumeroOS } from '../../utils/formatters';

export function RotinaDiaria() {
  const navigate = useNavigate();
  const { 
    ordens, 
    atualizarGruServico, 
    atualizarStatusServico
  } = useOrdens();
  const { clientes } = useClientes();

  // 1. Filtro: Conferência na PF (Protocolados)
  const conferenciasPF = useMemo(() => {
    return ordens.filter(o => 
      o.servicos?.some(s => s.statusExecucao === 'Protocolado — Ag. PF')
    ).map(o => {
      const clienteLive = clientes.find(c => c.cpf === o.cpf);
      return {
        ...o,
        senhaGov: clienteLive?.senhaGov || o.senhaGov,
        servicosProtocolados: o.servicos.filter(s => s.statusExecucao === 'Protocolado — Ag. PF')
      };
    });
  }, [ordens, clientes]);

  // 2. Filtro: Pendências de GRU
  const pendenciasGRU = useMemo(() => {
    return ordens.filter(o => 
      o.servicos?.some(s => (s.taxaPF || 0) > 0 && !s.pagoGRU)
    ).map(o => {
      const clienteLive = clientes.find(c => c.cpf === o.cpf);
      return {
        ...o,
        senhaGov: clienteLive?.senhaGov || o.senhaGov,
        servicosSemGRU: o.servicos.filter(s => (s.taxaPF || 0) > 0 && !s.pagoGRU)
      };
    });
  }, [ordens, clientes]);



  const copiarParaTransferencia = (texto: string, tipo: string) => {
    navigator.clipboard.writeText(texto);
  };

  const handleConcluirServico = async (ordemId: string, servicoId: string) => {
    if (confirm('Deseja marcar este serviço como CONCLUÍDO?')) {
      await atualizarStatusServico(ordemId, servicoId, 'Concluído');
    }
  };

  const handlePagarGRU = async (ordemId: string, servicoId: string) => {
    await atualizarGruServico(ordemId, servicoId, true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardCheck className="text-brand-blue" />
          Rotina Diária de Acompanhamento
        </h1>
        <p className="text-gray-400 text-sm">Central de ações rápidas para processos protocolados e taxas pendentes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Seção 1: Conferência na PF */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-brand-blue-light uppercase tracking-widest flex items-center gap-2">
              <Search size={16} />
              Conferir na PF ({conferenciasPF.length})
            </h2>
          </div>

          <div className="space-y-3">
            {conferenciasPF.length === 0 ? (
              <div className="card py-10 text-center text-gray-500 text-sm italic">
                Nenhum processo aguardando resposta da PF no momento.
              </div>
            ) : (
              conferenciasPF.map(o => (
                <div key={o.id} className="card bg-brand-dark-3/50 border-brand-dark-5 hover:border-brand-blue/30 transition-all p-4 space-y-4 group">
                  <div className="flex items-start justify-between">
                    <div 
                      onClick={() => navigate(`/ordens/${o.id}`)}
                      className="cursor-pointer group/header"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">#{formatarNumeroOS(o.numero)}</p>
                        {o.filiadoProTiro && <span className="text-[9px] bg-brand-blue/20 text-brand-blue-light px-1.5 py-0.5 rounded font-black uppercase">Filiado</span>}
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover/header:text-brand-blue-light transition-colors">{o.nomeCliente}</h3>
                    </div>
                    <button 
                      onClick={() => navigate(`/ordens/${o.id}`)}
                      className="p-1.5 text-gray-500 hover:text-white transition-colors bg-brand-dark-4 rounded-lg hover:bg-brand-dark-5 border border-white/5"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>

                  {/* Dados para Cópia - Compacto */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2 py-1.5 rounded-lg border border-white/5 flex-1 min-w-[120px]">
                      <User size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.cpf}</span>
                      <button 
                        onClick={() => copiarParaTransferencia(o.cpf, 'CPF')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all"
                        title="Copiar CPF"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2 py-1.5 rounded-lg border border-white/5 flex-1 min-w-[120px]">
                      <Key size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-300 truncate flex-1">{o.senhaGov || '---'}</span>
                      <button 
                        onClick={() => copiarParaTransferencia(o.senhaGov, 'Senha Gov')}
                        className="p-1 text-brand-blue hover:text-brand-blue-light transition-all"
                        disabled={!o.senhaGov}
                        title="Copiar Senha"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Todos os Serviços da OS */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <Package size={10} />
                      Serviços Contratados
                    </p>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5 space-y-1">
                      {o.servicos.map(s => {
                        const isProtocolado = s.statusExecucao === 'Protocolado — Ag. PF';
                        const isConcluido = s.statusExecucao === 'Concluído';
                        
                        return (
                          <div key={s.id} className="flex items-center justify-between group/item">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {isConcluido ? (
                                <CheckCircle2 size={10} className="text-brand-green shrink-0" />
                              ) : isProtocolado ? (
                                <Clock size={10} className="text-brand-blue-light shrink-0 animate-pulse" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full border border-gray-600 shrink-0" />
                              )}
                              <span className={`text-[10px] ${isProtocolado ? 'text-brand-blue-light font-bold' : isConcluido ? 'text-gray-500 line-through' : 'text-gray-400'}`}>
                                {s.nome}
                              </span>
                              {s.protocolo && (
                                <span className="text-[9px] bg-brand-blue/10 text-brand-blue-light px-1.5 py-0.5 rounded border border-brand-blue/20">
                                  {s.protocolo}
                                </span>
                              )}
                            </div>
                            
                            {isProtocolado && (
                              <button 
                                onClick={() => handleConcluirServico(o.id, s.id)}
                                className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 px-1.5 py-0.5 bg-brand-green/20 text-brand-green hover:bg-brand-green hover:text-white text-[9px] font-black uppercase rounded transition-all ml-2 shrink-0 border border-brand-green/30"
                              >
                                <CheckCircle size={10} />
                                Deferido
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Destaque para Ação Rápida (Se houver protocolados) */}
                  {o.servicosProtocolados.some(s => s.statusExecucao === 'Protocolado — Ag. PF') && (
                    <div className="pt-1">
                      {o.servicosProtocolados.map(s => (
                        <div key={`cta-${s.id}`} className="flex items-center justify-between bg-brand-blue/10 p-2.5 rounded-lg border border-brand-blue/20 group-hover:border-brand-blue/40 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-brand-blue-light uppercase tracking-tight">Ação Pendente</span>
                            <span className="text-[11px] font-bold text-white leading-tight">{s.nome}</span>
                            {s.protocolo && <span className="text-[10px] text-brand-blue-light font-mono mt-0.5">{s.protocolo}</span>}
                          </div>
                          <button 
                            onClick={() => handleConcluirServico(o.id, s.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-brand-blue text-white hover:bg-brand-blue-light text-[10px] font-black uppercase rounded-lg transition-all shadow-lg shadow-brand-blue/20"
                          >
                            <CheckCircle size={12} />
                            Concluir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Seção 2: Pendências de GRU */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={16} />
              Pagar Taxas GRU ({pendenciasGRU.length})
            </h2>
          </div>

          <div className="space-y-3">
            {pendenciasGRU.length === 0 ? (
              <div className="card py-10 text-center text-gray-500 text-sm italic">
                Nenhuma taxa GRU pendente de pagamento.
              </div>
            ) : (
              pendenciasGRU.map(o => (
                <div key={o.id} className="card bg-brand-dark-3/50 border-brand-dark-5 hover:border-orange-500/30 transition-all p-4 space-y-4 group">
                  <div className="flex items-start justify-between">
                    <div 
                      onClick={() => navigate(`/ordens/${o.id}`)}
                      className="cursor-pointer group/header"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">#{formatarNumeroOS(o.numero)}</p>
                        {o.filiadoProTiro && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-black uppercase">Filiado</span>}
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover/header:text-orange-400 transition-colors">{o.nomeCliente}</h3>
                    </div>
                    <button 
                      onClick={() => navigate(`/ordens/${o.id}`)}
                      className="p-1.5 text-gray-500 hover:text-white transition-colors bg-brand-dark-4 rounded-lg hover:bg-brand-dark-5 border border-white/5"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>

                  {/* Lista de Todos os Serviços da OS - Contexto GRU */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <Package size={10} />
                      Serviços Contratados
                    </p>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5 space-y-1">
                      {o.servicos.map(s => {
                        const needsGRU = (s.taxaPF || 0) > 0 && !s.pagoGRU;
                        const hasGRU = (s.taxaPF || 0) > 0 && s.pagoGRU;
                        
                        return (
                          <div key={s.id} className="flex items-center justify-between group/item">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {hasGRU ? (
                                <CreditCard size={10} className="text-brand-green shrink-0" />
                              ) : needsGRU ? (
                                <CreditCard size={10} className="text-orange-400 shrink-0" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full border border-gray-600 shrink-0" />
                              )}
                              <span className={`text-[10px] ${needsGRU ? 'text-orange-400 font-bold' : hasGRU ? 'text-brand-green' : 'text-gray-400'}`}>
                                {s.nome}
                              </span>
                              {s.protocolo && (
                                <span className="text-[9px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded border border-white/5">
                                  {s.protocolo}
                                </span>
                              )}
                            </div>
                            
                            {needsGRU && (
                              <button 
                                onClick={() => handlePagarGRU(o.id, s.id)}
                                className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white text-[9px] font-black uppercase rounded transition-all ml-2 shrink-0 border border-orange-500/30"
                              >
                                Pagar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Destaque para Ação Rápida (GRU Pendente) */}
                  <div className="pt-1">
                    {o.servicosSemGRU.map(s => (
                      <div key={`cta-gru-${s.id}`} className="flex items-center justify-between bg-orange-500/10 p-2.5 rounded-lg border border-orange-500/20 group-hover:border-orange-500/40 transition-colors mb-2 last:mb-0">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-tight">Taxa Pendente</span>
                          <span className="text-[11px] font-bold text-white leading-tight">{s.nome}</span>
                          <span className="text-[10px] text-gray-500 font-bold">{formatarMoeda(s.taxaPF || 0)}</span>
                        </div>
                        <button 
                          onClick={() => handlePagarGRU(o.id, s.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white hover:bg-orange-400 text-[10px] font-black uppercase rounded-lg transition-all shadow-lg shadow-orange-500/20"
                        >
                          Marcar Pago
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
