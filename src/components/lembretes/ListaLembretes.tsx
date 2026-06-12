import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Calendar, 
  CheckCircle2, Clock, Trash2, Edit2, 
  Bell, CheckCircle, User, MessageCircle, AlertCircle, ListTodo,
  ShieldAlert, ExternalLink, Shield, Target, MapPin
} from 'lucide-react';
import { useLembretes } from '../../context/LembretesContext';
import { useClientes } from '../../context/ClientesContext';
import { useAuth } from '../../context/AuthContext';
import { FormularioLembrete } from './FormularioLembrete';
import { formatarData, removerAcentos } from '../../utils/formatters';
import { buscarAlertasGlobais } from '../../services/vencimentosService';
import { AlertaDocumento, obterClasseAlerta } from '../../utils/vencimentos';
import { useNavigate } from 'react-router-dom';

export function ListaLembretes() {
  const { lembretes, deletarLembrete, marcarConcluido, estaCarregando } = useLembretes();
  const { clientes } = useClientes();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [modalAberto, setModalAberto] = useState(false);
  const [lembreteEdicao, setLembreteEdicao] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const [alertasVencimento, setAlertasVencimento] = useState<AlertaDocumento[]>([]);
  const [carregandoAlertas, setCarregandoAlertas] = useState(false);

  useEffect(() => {
    async function obterAlertas() {
      if (usuario?.tipoConta === 'cac_individual' && usuario?.empresaId) {
        setCarregandoAlertas(true);
        try {
          const data = await buscarAlertasGlobais(usuario.empresaId);
          setAlertasVencimento(data);
        } catch (error) {
          console.error('Erro ao buscar alertas de vencimento:', error);
        } finally {
          setCarregandoAlertas(false);
        }
      }
    }
    obterAlertas();
  }, [usuario]);

  const lembretesFiltrados = useMemo(() => {
    const termo = removerAcentos(filtro.toLowerCase());
    return lembretes.filter(l => 
      removerAcentos(l.titulo.toLowerCase()).includes(termo) ||
      removerAcentos(l.descricao?.toLowerCase() || '').includes(termo) ||
      removerAcentos(l.clienteNome?.toLowerCase() || '').includes(termo)
    );
  }, [lembretes, filtro]);

  const pendentes = lembretesFiltrados.filter(l => !l.concluido);
  const concluidos = lembretesFiltrados.filter(l => l.concluido);

  const handleEdit = (lembrete: any) => {
    setLembreteEdicao(lembrete);
    setModalAberto(true);
  };

  const abrirWhatsapp = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    const fone = cliente.contato.replace(/\D/g, '');
    window.open(`https://wa.me/55${fone}`, '_blank');
  };

  const isCac = usuario?.tipoConta === 'cac_individual';

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="text-brand-blue" />
            {isCac ? 'Meus Lembretes & Alertas' : 'Agenda de Lembretes'}
          </h1>
          <p className="text-gray-400 text-sm">
            {isCac 
              ? 'Acompanhe a validade dos seus documentos e acervo.' 
              : 'Gerencie suas tarefas e compromissos diários.'}
          </p>
        </div>
        {!isCac && (
          <button 
            onClick={() => { setLembreteEdicao(null); setModalAberto(true); }}
            className="btn-primary"
          >
            <Plus size={18} />
            Nova Tarefa
          </button>
        )}
      </div>

      {isCac ? (
        /* Renderização Exclusiva para CAC Individual */
        <div className="space-y-4">
          <div className="card border-brand-dark-5 bg-brand-dark-3/30 overflow-hidden shadow-lg animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-orange-500" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Status de Documentos & Validades
                </h2>
              </div>
              {alertasVencimento.length > 0 ? (
                <span className="badge badge-erro text-xs px-3 py-1 font-bold">
                  {alertasVencimento.length} alerta{alertasVencimento.length > 1 ? 's' : ''} ativo{alertasVencimento.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="bg-brand-green/20 text-brand-green border border-brand-green/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  Todos documentos em dia! 🎉
                </span>
              )}
            </div>

            {carregandoAlertas ? (
              <div className="text-center py-12 text-gray-500 text-sm animate-pulse">
                Carregando vencimentos e acervo...
              </div>
            ) : alertasVencimento.length === 0 ? (
              <div className="card py-16 text-center text-gray-500 text-sm italic border-dashed border-2 flex flex-col items-center justify-center gap-3">
                <Shield size={40} className="text-brand-green opacity-60 mb-2" />
                <span>Excelente! Todos os seus documentos (CR, CR IBAMA, CRAF, GT, Manejo) estão válidos e seguros. 🛡️</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alertasVencimento.map((alerta) => (
                  <div 
                    key={alerta.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:border-white/10 ${obterClasseAlerta(alerta.nivel)}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1 p-2 rounded-lg bg-black/20 text-white flex-shrink-0">
                        {alerta.tipo === 'CRAF' ? <Target size={18} /> : 
                         alerta.tipo === 'GT' ? <MapPin size={18} /> :
                         alerta.tipo === 'MANEJO' ? <Calendar size={18} /> :
                         <Shield size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                           <p className="text-sm font-bold text-white truncate">{alerta.label}</p>
                           <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/30 font-black uppercase tracking-tighter text-white">
                             {alerta.nivel === 'VENCIDO' ? 'VENCIDO' : 
                              alerta.nivel === 'CRITICO' ? 'URGENTE' : 'AVISO'}
                           </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                           <Calendar size={12} className="opacity-60 text-white" />
                           <p className="text-xs font-semibold text-gray-300">
                             Vencimento: {formatarData(alerta.dataVencimento)}
                           </p>
                           <span className="text-gray-500">•</span>
                           <p className="text-xs font-black italic text-gray-300">
                            {alerta.diasRestantes < 0 
                              ? `${Math.abs(alerta.diasRestantes)} dia(s) atrasado` 
                              : `Faltam ${alerta.diasRestantes} dia(s)`}
                           </p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        navigate('/clientes', { 
                          state: { 
                            aba: 'documentos',
                            armaId: alerta.armaId 
                          } 
                        });
                      }}
                      className="p-2.5 hover:bg-white/10 rounded-xl transition-all flex-shrink-0 text-white"
                      title="Ver no Meu Acervo"
                    >
                      <ExternalLink size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-brand-dark-5 flex justify-end">
              <p className="text-[10px] text-gray-500 font-bold uppercase italic tracking-wider">
                * Regras oficiais SisGCorp (Exercito) e IBAMA (Manejo/SIMAF)
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Renderização para Despachante / Empresas */
        <>
          {/* Busca */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-brand-blue-light transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar lembretes, clientes ou descrições..."
              className="input pl-10 w-full bg-brand-dark-3/50 focus:bg-brand-dark-3 transition-all"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Pendentes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-brand-dark-5 pb-2">
                <h2 className="text-sm font-black text-brand-blue-light uppercase tracking-widest flex items-center gap-2">
                  <Clock size={16} />
                  Pendentes ({pendentes.length})
                </h2>
              </div>

              <div className="space-y-3">
                {estaCarregando ? (
                  <div className="card py-10 text-center text-gray-500 text-sm animate-pulse">Carregando tarefas...</div>
                ) : pendentes.length === 0 ? (
                  <div className="card py-10 text-center text-gray-500 text-sm italic border-dashed border-2">
                    Nenhuma tarefa pendente. Tudo em dia! 🎉
                  </div>
                ) : (
                  pendentes.map(l => (
                    <CardLembrete 
                      key={l.id} 
                      lembrete={l} 
                      onEdit={() => handleEdit(l)}
                      onDelete={() => deletarLembrete(l.id)}
                      onToggle={() => marcarConcluido(l.id, true)}
                      onWpp={abrirWhatsapp}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Coluna Concluídos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-brand-dark-5 pb-2">
                <h2 className="text-sm font-black text-brand-green uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Concluídos ({concluidos.length})
                </h2>
              </div>

              <div className="space-y-3 opacity-60">
                {concluidos.length === 0 ? (
                  <div className="card py-10 text-center text-gray-500 text-sm italic">
                    Nenhuma tarefa concluída hoje.
                  </div>
                ) : (
                  concluidos.map(l => (
                    <CardLembrete 
                      key={l.id} 
                      lembrete={l} 
                      onDelete={() => deletarLembrete(l.id)}
                      onToggle={() => marcarConcluido(l.id, false)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <FormularioLembrete 
        aberto={modalAberto} 
        onClose={() => setModalAberto(false)} 
        lembreteEdicao={lembreteEdicao}
      />
    </div>
  );
}

function CardLembrete({ lembrete, onEdit, onDelete, onToggle, onWpp }: any) {
  const agora = new Date();
  const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const isHoje = lembrete.data === hojeLocal;
  const isAtrasado = !lembrete.concluido && lembrete.data < hojeLocal;

  return (
    <div className={`card overflow-hidden group shadow-lg transition-all hover:border-brand-blue/30 border-l-4 ${
      lembrete.prioridade === 'alta' ? 'border-l-red-500' : 
      lembrete.prioridade === 'media' ? 'border-l-brand-blue' : 'border-l-gray-600'
    } ${lembrete.concluido ? 'bg-brand-dark-3/30 border-l-brand-green' : 'bg-brand-dark-3/50'}`}>
      <div className="p-4 space-y-3">
        {/* Topo */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                isAtrasado ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                isHoje ? 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30' : 
                'bg-gray-700/50 text-gray-400 border border-gray-600/30'
              }`}>
                {isAtrasado ? 'Atrasado ⚠️' : isHoje ? 'Hoje ✨' : formatarData(lembrete.data)}
              </span>
              {lembrete.horario && (
                <span className="text-[10px] bg-brand-dark-5 text-gray-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/5">
                  <Clock size={10} /> {lembrete.horario}
                </span>
              )}
            </div>
            <h3 className={`font-bold text-white text-base ${lembrete.concluido ? 'line-through text-gray-500' : ''}`}>
              {lembrete.titulo}
            </h3>
          </div>
          <button 
            onClick={onToggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${
              lembrete.concluido 
              ? 'bg-brand-green/20 border-brand-green text-brand-green hover:bg-brand-green/30' 
              : 'bg-brand-dark-4 border-gray-600 text-gray-600 hover:border-brand-green hover:text-brand-green'
            }`}
          >
            <CheckCircle size={18} />
          </button>
        </div>

        {/* Descrição */}
        {lembrete.descricao && (
          <p className="text-sm text-gray-400 line-clamp-3">
            {lembrete.descricao}
          </p>
        )}

        {/* Rodapé (Ações) */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 bg-black/5 -mx-4 -mb-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {lembrete.clienteId && (
              <div className="flex items-center gap-2 px-2 py-1 bg-brand-blue/10 rounded-lg border border-brand-blue/20">
                <User size={12} className="text-brand-blue-light" />
                <span className="text-[11px] font-bold text-brand-blue-light truncate max-w-[120px]">{lembrete.clienteNome}</span>
                {onWpp && (
                  <button 
                    onClick={() => onWpp(lembrete.clienteId)}
                    className="p-1 hover:bg-brand-blue/20 rounded pointer transition-all"
                    title="WhatsApp do Cliente"
                  >
                    <MessageCircle size={12} className="text-brand-green" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button 
                onClick={onEdit}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-brand-dark-5 rounded-lg transition-all"
              >
                <Edit2 size={14} />
              </button>
            )}
            <button 
              onClick={onDelete}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
