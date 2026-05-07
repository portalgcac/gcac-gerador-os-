import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../db/supabase';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useRecibos } from '../../context/RecibosContext';
import { isSameMonth, parseISO } from 'date-fns';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  Receipt, 
  ClipboardCheck,
  TrendingUp,
  Award,
  Send,
  Target
} from 'lucide-react';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

interface RelatorioEquipeProps {
  dataFiltro: Date;
}

interface Usuario {
  id: string;
  nome: string;
}

interface AtividadeDetalhe {
  id: string;
  data: string;
  usuario: string;
  acao: string;
  ordemNumero: number;
  ordemId: string;
  clienteNome: string;
}

export function RelatorioEquipe({ dataFiltro }: RelatorioEquipeProps) {
  const navigate = useNavigate();
  const { ordens } = useOrdens();
  const { orcamentos } = useOrcamentos();
  const { recibos } = useRecibos();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string>('Todos');

  useEffect(() => {
    const carregarUsuarios = async () => {
      const { data } = await supabase
        .from('usuarios_autorizados')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      
      if (data) setUsuarios(data);
    };
    carregarUsuarios();
  }, []);

  const stats = useMemo(() => {
    // Filtro por Mês
    const filtrosMes = {
      ordens: ordens.filter(o => isSameMonth(parseISO(o.criadoEm), dataFiltro)),
      orcamentos: orcamentos.filter(o => isSameMonth(parseISO(o.criadoEm), dataFiltro)),
      recibos: recibos.filter(r => isSameMonth(parseISO(r.criadoEm), dataFiltro)),
    };

    // Filtro por Colaborador (se selecionado)
    const filtrarPorNome = (lista: any[], campo: string) => {
      if (colaboradorSelecionado === 'Todos') return lista;
      return lista.filter(item => item[campo] === colaboradorSelecionado);
    };

    const osEmitidas = filtrarPorNome(filtrosMes.ordens, 'criadoPorNome');
    const osConcluidas = filtrarPorNome(filtrosMes.ordens, 'concluidoPorNome').filter(o => o.status === 'Pago');
    const orcamentosGerados = filtrarPorNome(filtrosMes.orcamentos, 'criadoPorNome');
    const recibosGerados = filtrarPorNome(filtrosMes.recibos, 'criadoPorNome');

    const volumeFinanceiro = osEmitidas.reduce((acc, o) => acc + (o.valor || 0), 0);
    const volumeConcluido = osConcluidas.reduce((acc, o) => acc + (o.valor || 0), 0);

    // Detalhamento de Atividades (Operacional e Criação)
    const atividades: AtividadeDetalhe[] = [];
    
    filtrosMes.ordens.forEach(o => {
      // Criação de O.S.
      if (colaboradorSelecionado === 'Todos' || o.criadoPorNome === colaboradorSelecionado) {
        atividades.push({
          id: `criacao-${o.id}`,
          data: o.criadoEm,
          usuario: o.criadoPorNome || 'Sistema',
          acao: 'Criou OS',
          ordemNumero: o.numero,
          ordemId: o.id,
          clienteNome: o.nomeCliente
        });
      }

      // Histórico Operacional
      if (o.historicoStatus) {
        o.historicoStatus.forEach(evento => {
          // Apenas eventos que ocorreram no mês selecionado
          if (isSameMonth(parseISO(evento.data), dataFiltro)) {
            if (evento.tipo === 'status_execucao') {
              if (colaboradorSelecionado === 'Todos' || evento.usuario === colaboradorSelecionado) {
                if (evento.valorNovo === 'Protocolado — Ag. PF') {
                  atividades.push({
                    id: evento.id,
                    data: evento.data,
                    usuario: evento.usuario,
                    acao: 'Protocolou Serviço',
                    ordemNumero: o.numero,
                    ordemId: o.id,
                    clienteNome: o.nomeCliente
                  });
                } else if (evento.valorNovo === 'Concluído') {
                  atividades.push({
                    id: evento.id,
                    data: evento.data,
                    usuario: evento.usuario,
                    acao: 'Concluiu Serviço',
                    ordemNumero: o.numero,
                    ordemId: o.id,
                    clienteNome: o.nomeCliente
                  });
                }
              }
            }
          }
        });
      }
    });

    atividades.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const servicosProtocolados = atividades.filter(a => a.acao === 'Protocolou Serviço').length;
    const servicosConcluidos = atividades.filter(a => a.acao === 'Concluiu Serviço').length;

    return {
      osEmitidas: osEmitidas.length,
      osConcluidas: osConcluidas.length,
      orcamentosGerados: orcamentosGerados.length,
      recibosGerados: recibosGerados.length,
      volumeFinanceiro,
      volumeConcluido,
      servicosProtocolados,
      servicosConcluidos,
      atividades
    };
  }, [ordens, orcamentos, recibos, dataFiltro, colaboradorSelecionado]);

  return (
    <div className="space-y-6">
      {/* Filtro de Colaborador */}
      <div className="flex items-center gap-3 bg-brand-dark-3 p-4 rounded-2xl border border-brand-dark-5">
        <Users size={20} className="text-brand-blue-light" />
        <div className="flex-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Filtrar por Colaborador</label>
          <select 
            className="bg-transparent text-white font-bold text-sm outline-none w-full cursor-pointer"
            value={colaboradorSelecionado}
            onChange={(e) => setColaboradorSelecionado(e.target.value)}
          >
            <option value="Todos" className="bg-brand-dark-2">Todos os Colaboradores</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.nome} className="bg-brand-dark-2">{u.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Cards Operacionais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatCard 
          icon={<FileText size={24} />} 
          label="OS Emitidas" 
          value={stats.osEmitidas} 
          color="blue"
        />
        <StatCard 
          icon={<Send size={24} />} 
          label="Serviços Protocolados" 
          value={stats.servicosProtocolados} 
          color="orange"
        />
        <StatCard 
          icon={<Target size={24} />} 
          label="Serviços Concluídos (Deferidos)" 
          value={stats.servicosConcluidos} 
          color="green"
        />
      </div>

      {/* Grid de Cards Financeiros */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 bg-gray-500 rounded-full" />
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Indicadores Financeiros / Secundários</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          icon={<ClipboardCheck size={24} />} 
          label="OS Pagas (Caixa)" 
          value={stats.osConcluidas} 
          subValue={`Vol: ${formatarMoeda(stats.volumeConcluido)}`}
          color="green"
        />
        <StatCard 
          icon={<Award size={24} />} 
          label="Orçamentos Gerados" 
          value={stats.orcamentosGerados} 
          color="purple"
        />
        <StatCard 
          icon={<Receipt size={24} />} 
          label="Recibos Emitidos" 
          value={stats.recibosGerados} 
          color="orange"
        />
      </div>

      {/* Detalhamento em Tabela */}
      <div className="card p-0 overflow-hidden border-brand-dark-5 mt-6">
        <div className="p-4 border-b border-brand-dark-5 flex items-center justify-between bg-brand-dark-3/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardCheck size={18} className="text-brand-blue-light" />
            Detalhamento de Atividades ({stats.atividades.length})
          </h3>
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Operações Registradas</span>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-brand-dark-3 z-10 shadow-sm">
              <tr>
                <th className="table-header">Data/Hora</th>
                <th className="table-header">Colaborador</th>
                <th className="table-header">Ação</th>
                <th className="table-header">O.S.</th>
                <th className="table-header">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-dark-5/30">
              {stats.atividades.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-500 text-sm">
                    Nenhuma atividade registrada para o filtro atual.
                  </td>
                </tr>
              ) : (
                stats.atividades.map(atividade => (
                  <tr key={atividade.id} className="hover:bg-brand-dark-4 transition-colors">
                    <td className="table-cell font-mono text-[11px] whitespace-nowrap">
                      {formatarData(atividade.data)}
                    </td>
                    <td className="table-cell font-bold text-gray-300">
                      {atividade.usuario}
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        atividade.acao === 'Criou OS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        atividade.acao === 'Protocolou Serviço' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {atividade.acao}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button 
                        onClick={() => navigate(`/ordens/${atividade.ordemId}`)}
                        className="font-bold text-white hover:text-brand-blue hover:underline transition-all"
                      >
                        #{String(atividade.ordemNumero).padStart(4, '0')}
                      </button>
                    </td>
                    <td className="table-cell text-gray-400 truncate max-w-[200px]" title={atividade.clienteNome}>
                      {atividade.clienteNome}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: any) {
  const colors: any = {
    blue:   'text-brand-blue-light bg-brand-blue/10 border-brand-blue/20',
    green:  'text-brand-green bg-brand-green/10 border-brand-green/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20'
  };

  return (
    <div className={`card ${colors[color]} border transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-white">{value}</p>
            {subValue && <span className="text-[9px] text-gray-500 font-bold">{subValue}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, total, color }: any) {
  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-[11px] font-bold text-gray-400">{label}</span>
        <span className="text-xs font-black text-white">{percentage}%</span>
      </div>
      <div className="h-2 bg-brand-dark-5 rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div 
          className={`h-full ${color} transition-all duration-700 shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
        <span>{current} concluídos</span>
        <span>{total} total</span>
      </div>
    </div>
  );
}
