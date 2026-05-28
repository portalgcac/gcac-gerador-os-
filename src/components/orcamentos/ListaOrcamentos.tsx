import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useAuth } from '../../context/AuthContext';
import { StatusOrcamento } from '../../types';
import { formatarMoeda, formatarDataHora, classeStatusOrcamento, removerAcentos } from '../../utils/formatters';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';

const STATUS_FILTROS: { label: string; valor: StatusOrcamento | 'Todos' }[] = [
  { label: 'Todos',              valor: 'Todos' },
  { label: 'Pendentes',          valor: 'Pendente' },
  { label: 'Aprovados',          valor: 'Aprovado' },
  { label: 'Recusados',          valor: 'Recusado' },
];

export function ListaOrcamentos() {
  const navigate = useNavigate();
  const { orcamentos, deletarOrcamento } = useOrcamentos();
  const { usuario } = useAuth();
  const podeExcluir = usuario?.role === 'admin' || usuario?.permissoes?.includes('excluir_registros');
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusOrcamento | 'Todos'>('Todos');
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);

  const handleDeletar = async () => {
    if (!confirmandoDelete) return;
    try {
      await deletarOrcamento(confirmandoDelete);
      setConfirmandoDelete(null);
      mostrar('sucesso', 'Orçamento excluído com sucesso.');
    } catch (error) {
      console.error(error);
      mostrar('erro', 'Falha ao excluir o orçamento.');
    }
  };

  const orcamentosFiltrados = orcamentos.filter(o => {
    const matchBusca = !busca || [
      o.nomeCliente, 
      o.cpf, 
      o.servicos?.map(s => s.nome).join(' '), 
      String(o.numero)
    ].some(v => removerAcentos(String(v || '').toLowerCase()).includes(removerAcentos(busca.toLowerCase())));
    
    const matchStatus = filtroStatus === 'Todos' || o.status === filtroStatus;
    
    return matchBusca && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Orçamentos</h1>
          <p className="text-sm text-gray-400">{orcamentos.length} total • {orcamentosFiltrados.length} exibidos</p>
        </div>
        <button
          onClick={() => navigate('/orcamentos/novo')}
          className="btn-primary bg-brand-green border border-brand-green/60 hover:bg-brand-green/80 text-white"
        >
          <Plus size={16} />
          Novo Orçamento
        </button>
      </div>

      {/* ── Busca e Filtros ── */}
      <div className="card space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nome, CPF, número ou serviço..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTROS.map(({ label, valor }) => (
            <button
              key={valor}
              onClick={() => setFiltroStatus(valor)}
              className={`text-sm px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${
                filtroStatus === valor
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-dark-5 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ── */}
      {orcamentosFiltrados.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-full bg-brand-dark-5 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-500" />
          </div>
          <p className="text-gray-400 font-medium">Nenhum orçamento encontrado</p>
          <p className="text-sm text-gray-500 mt-1">
            {busca || filtroStatus !== 'Todos'
              ? 'Tente ajustar os filtros de busca'
              : 'Clique em "Novo Orçamento" para criar o primeiro orçamento'}
          </p>
          {!busca && filtroStatus === 'Todos' && (
            <button onClick={() => navigate('/orcamentos/novo')} className="btn-primary mt-4 mx-auto">
              <Plus size={16} />
              Criar primeiro orçamento
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orcamentosFiltrados.map(orcamento => (
            <div
              key={orcamento.id}
              onClick={() => navigate(`/orcamentos/${orcamento.id}`)}
              className="card-hover flex items-center gap-4 cursor-pointer"
            >
              {/* Número */}
              <div className="flex-shrink-0 w-14 text-center">
                <p className="text-xs text-gray-500">ORC</p>
                <p className="text-base font-bold text-white">#{String(orcamento.numero).padStart(4, '0')}</p>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-brand-dark-5 flex-shrink-0" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{orcamento.nomeCliente}</p>
                <p className="text-xs text-brand-blue-light mt-0.5">
                  {orcamento.servicos && orcamento.servicos.length > 0
                    ? orcamento.servicos.map(s => s.nome).join(', ')
                    : 'Sem serviços especificados'}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {formatarDataHora(orcamento.criadoEm)}
                  {orcamento.criadoPorNome && ` • Emitido por: ${orcamento.criadoPorNome}`}
                </p>
              </div>

              {/* Valor e Status */}
              <div className="flex-shrink-0 text-right space-y-1">
                <p className="text-sm font-bold text-white">{formatarMoeda(orcamento.valorTotal)}</p>
                <span className={classeStatusOrcamento(orcamento.status)}>{orcamento.status}</span>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col items-center gap-2">
                {podeExcluir && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmandoDelete(orcamento.id);
                    }}
                    className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Excluir Orçamento"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
      <Notificacao {...notif} onFechar={fechar} />
      
      <DialogConfirmacao
        aberto={!!confirmandoDelete}
        titulo="Excluir Orçamento"
        mensagem="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(null)}
      />
    </div>
  );
}
