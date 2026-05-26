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

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="text-brand-blue" />
            Agenda de Lembretes
          </h1>
          <p className="text-gray-400 text-sm">Gerencie suas tarefas e compromissos diários.</p>
        </div>
        <button 
          onClick={() => { setLembreteEdicao(null); setModalAberto(true); }}
          className="btn-primary"
        >
          <Plus size={18} />
          Nova Tarefa
        </button>
      </div>

      {usuario?.tipoConta === 'cac_individual' && (
        <div className="card border-brand-dark-5 bg-brand-dark-3/30 overflow-hidden shadow-lg animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} className="text-orange-500" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Alertas de Documentação e Vencimentos</h2>
            </div>
            {alertasVencimento.length > 0 ? (
              <span className="badge badge-erro">{alertasVencimento.length} pendência{alertasVencimento.length > 1 ? 's' : ''}</span>
            ) : (
              <span className="bg-brand-green/20 text-brand-green border border-brand-green/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                Tudo em dia! 🎉
              </span>
            )}
          </div>

          {carregandoAlertas ? (
            <div className="text-center py-6 text-gray-500 text-sm animate-pulse">Carregando vencimentos...</div>
          ) : alertasVencimento.length === 0 ? (
            <div className="p-4 bg-brand-green/5 border border-brand-green/10 rounded-xl text-center text-gray-400 text-sm italic">
              Não há documentos perto do vencimento. Excelente! 🛡️
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-dark-5 scrollbar-track-transparent">
              {alertasVencimento.map((alerta) => (
                <div 
                  key={alerta.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all hover:brightness-110 ${obterClasseAlerta(alerta.nivel)}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1">
                      {alerta.tipo === 'CRAF' ? <Target size={16} /> : 
                       alerta.tipo === 'GT' ? <MapPin size={16} /> :
                       alerta.tipo === 'MANEJO' ? <Calendar size={16} /> :
                       <Shield size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                         <p className="text-xs font-bold truncate text-white">{alerta.label}</p>
                         <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/20 font-black uppercase tracking-tighter">
                           {alerta.nivel === 'VENCIDO' ? 'VENCIDO' : 
                            alerta.nivel === 'CRITICO' ? 'URGENTE' : 'AVISO'}
                         </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                         <Calendar size={10} className="opacity-50 text-white" />
                         <p className="text-[10px] font-medium text-gray-300">Vencimento: {formatarData(alerta.dataVencimento)}</p>
                         <span className="text-[10px] font-black text-gray-500">•</span>
                         <p className="text-[10px] font-black italic text-gray-300">
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
                    className="p-2 hover:bg-black/10 rounded-lg transition-colors flex-shrink-0 text-white"
                    title="Ver no Meu Acervo"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4 pt-3 border-t border-brand-dark-5 flex justify-end">
            <p className="text-[9px] text-gray-500 font-bold uppercase italic">* Baseado nas regras de alerta do SisGCorp e IBAMA</p>
          </div>
        </div>
      )}

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
