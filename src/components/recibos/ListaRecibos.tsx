import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Receipt, Calendar, User, FileText, 
  Trash2, Eye, ChevronRight, AlertCircle 
} from 'lucide-react';
import { useRecibos } from '../../context/RecibosContext';
import { formatarMoeda, formatarData, removerAcentos } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export function ListaRecibos() {
  const navigate = useNavigate();
  const { recibos, deletarRecibo } = useRecibos();
  const { usuario } = useAuth();
  const podeExcluir = usuario?.role === 'admin' || usuario?.permissoes?.includes('excluir_registros');
  const [busca, setBusca] = useState('');

  const filtrados = recibos.filter(r => 
    removerAcentos(r.clienteNome.toLowerCase()).includes(removerAcentos(busca.toLowerCase())) ||
    String(r.numero).includes(busca)
  );

  const handleDeletar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja deletar este recibo?')) {
      try {
        await deletarRecibo(id);
      } catch (err) {
        alert('Erro ao deletar recibo');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Recibos Emitidos</h1>
          <p className="text-gray-400 text-sm">Gerencie o histórico de pagamentos e recibos</p>
        </div>
        <button
          onClick={() => navigate('/recibos/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          Novo Recibo
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-blue-light transition-colors" size={18} />
        <input
          type="text"
          placeholder="Buscar por cliente ou número..."
          className="input pl-10 bg-brand-dark-2/50 border-brand-dark-5 focus:bg-brand-dark-2"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Grid de Recibos */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20 bg-brand-dark-2/30 rounded-3xl border border-dashed border-brand-dark-5">
          <Receipt size={48} className="text-brand-dark-5 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum recibo encontrado</p>
          <button 
            onClick={() => navigate('/recibos/novo')}
            className="text-brand-blue-light hover:underline text-sm mt-2"
          >
            Emitir o primeiro recibo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((recibo) => (
            <div
              key={recibo.id}
              onClick={() => navigate(`/recibos/${recibo.id}`)}
              className="card group hover:border-brand-blue/30 transition-all cursor-pointer relative overflow-hidden"
            >
              {/* Badge Número */}
              <div className="absolute top-0 right-0 bg-brand-dark-4 px-3 py-1 rounded-bl-xl border-l border-b border-brand-dark-5 text-[10px] font-bold text-gray-500 group-hover:text-brand-blue-light transition-colors">
                # {String(recibo.numero).padStart(4, '0')}
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green shrink-0">
                  <Receipt size={20} />
                </div>
                <div className="min-w-0 pr-12">
                  <h3 className="text-sm font-bold text-white uppercase">{recibo.clienteNome}</h3>
                  <p className="text-xs text-brand-green-light font-bold mt-0.5">
                    {formatarMoeda(recibo.valorTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar size={14} className="shrink-0" />
                  <span>{formatarData(recibo.criadoEm)}</span>
                </div>
                {recibo.criadoPorNome && (
                  <div className="flex items-center gap-2 text-[10px] text-brand-blue-light/70 font-bold uppercase">
                    <User size={12} className="shrink-0" />
                    <span>Emitido por: {recibo.criadoPorNome}</span>
                  </div>
                )}
                {recibo.ordemId && (
                  <div className="flex items-center gap-2 text-xs text-brand-blue-light font-medium">
                    <FileText size={14} className="shrink-0" />
                    <span>Ref. OS vinculada</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-brand-dark-5">
                {podeExcluir && (
                  <button
                    onClick={(e) => handleDeletar(recibo.id, e)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    title="Deletar Recibo"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="flex items-center gap-1 text-xs text-brand-blue-light font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver Detalhes
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
