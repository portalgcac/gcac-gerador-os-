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
  Package
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { formatarMoeda, formatarNumeroOS, formatarData, removerAcentos } from '../../utils/formatters';

export function RotinaDiaria() {
  const navigate = useNavigate();
  const { 
    ordens, 
    atualizarStatusServico
  } = useOrdens();
  const { clientes } = useClientes();
  const [busca, setBusca] = useState('');

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

  const conferenciasFiltradas = useMemo(() => {
    return conferenciasPF.filter(o => 
      removerAcentos(o.nomeCliente.toLowerCase()).includes(removerAcentos(busca.toLowerCase()))
    );
  }, [conferenciasPF, busca]);

  // Auto-scroll e realce de O.S. ao voltar para a listagem
  useEffect(() => {
    const lastOsId = sessionStorage.getItem('last_os_id');
    if (lastOsId && conferenciasFiltradas.length > 0) {
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
  }, [conferenciasFiltradas]);

  const copiarParaTransferencia = (texto: string, tipo: string) => {
    navigator.clipboard.writeText(texto);
  };

  const handleConcluirServico = async (ordemId: string, servicoId: string) => {
    if (confirm('Deseja marcar este serviço como CONCLUÍDO?')) {
      await atualizarStatusServico(ordemId, servicoId, 'Concluído');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="text-brand-blue" />
            Rotina Diária de Acompanhamento
          </h1>
          <p className="text-gray-400 text-sm">Central de ações rápidas para processos protocolados.</p>
        </div>
        
        {/* Barra de Pesquisa */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            className="input pl-9 w-full"
            placeholder="Buscar por cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Seção 1: Conferência na PF */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-brand-blue-light uppercase tracking-widest flex items-center gap-2">
            <Package size={16} />
            Conferir na PF ({conferenciasFiltradas.length})
          </h2>
        </div>

        <div className="space-y-3">
          {conferenciasFiltradas.length === 0 ? (
            <div className="card py-10 text-center text-gray-500 text-sm italic">
              {busca ? 'Nenhum processo correspondente encontrado.' : 'Nenhum processo aguardando resposta da PF no momento.'}
            </div>
          ) : (
            conferenciasFiltradas.map((o, index) => (
              <div 
                key={o.id}
                id={`os-card-${o.id}`}
                className="card bg-brand-dark-3/50 border-brand-dark-5 hover:border-brand-blue/30 transition-all p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group animate-scale-up"
              >
                {/* 1. O.S. Info & Cliente */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-black text-brand-blue-light bg-brand-blue/10 px-1.5 py-0.5 rounded border border-brand-blue/20 font-mono">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                      #{formatarNumeroOS(o.numero)}
                    </p>
                    <span className="text-[10px] text-gray-500 font-mono">
                      • Aberta em {formatarData(o.criadoEm)}
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
                    className="text-sm font-bold text-white hover:text-brand-blue-light cursor-pointer transition-colors"
                  >
                    {o.nomeCliente}
                  </h3>
                </div>

                {/* 2. Credenciais */}
                <div className="flex flex-wrap gap-2 items-center min-w-[280px]">
                  <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2 py-1.5 rounded-lg border border-white/5 flex-1 max-w-[160px]">
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
                  <div className="flex items-center gap-1.5 bg-brand-dark-4 px-2 py-1.5 rounded-lg border border-white/5 flex-1 max-w-[160px]">
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

                {/* 3. Lista de Serviços Protocolados e botões de Concluir */}
                <div className="flex-[1.5] min-w-[250px] flex flex-col gap-1.5">
                  {o.servicosProtocolados.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3 bg-black/20 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex flex-col overflow-hidden pr-2 flex-1">
                        <span className="text-[10px] font-bold text-white leading-tight">{s.nome}</span>
                        {s.protocolo && (
                          <span className="text-[9px] text-brand-blue-light font-mono mt-0.5">Prot: {s.protocolo}</span>
                        )}
                        {s.detalhes && s.detalhes.trim() && (
                          <span className="text-[9px] text-gray-400 font-sans leading-tight mt-0.5 break-words">
                            Obs: {s.detalhes}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => handleConcluirServico(o.id, s.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue-light hover:text-white text-[9px] font-black uppercase rounded border border-brand-blue/30 transition-all shrink-0"
                      >
                        <CheckCircle size={10} />
                        Concluir
                      </button>
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
    </div>
  );
}
