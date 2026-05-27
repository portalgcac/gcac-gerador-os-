import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Cliente, CreditoCliente } from '../../types';
import { useClientes } from '../../context/ClientesContext';
import { useAuth } from '../../context/AuthContext';
import { formatarMoeda, formatarData, formatarDataHora } from '../../utils/formatters';

export function AbaCreditos({ cliente }: { cliente: Cliente }) {
  const { buscarCreditos, adicionarCredito, deletarCredito } = useClientes();
  const { usuario } = useAuth();
  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  const carregar = async () => {
    setCarregando(true);
    try {
      const data = await buscarCreditos(cliente.id);
      setCreditos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [cliente.id]);

  const saldo = creditos.reduce((acc, c) => acc + (c.tipo === 'entrada' ? c.valor : -c.valor), 0);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valor.replace(/\D/g, '')) / 100;
    if (val <= 0 || !descricao.trim()) return;

    try {
      await adicionarCredito({
        clienteId: cliente.id,
        tipo,
        valor: val,
        descricao,
        criadoPorNome: usuario?.nome
      });
      setValor('');
      setDescricao('');
      setShowForm(false);
      carregar();
    } catch (error: any) {
      console.error('Erro ao salvar crédito:', error);
      alert(`Erro ao salvar crédito: ${error?.message || JSON.stringify(error) || 'Erro desconhecido'}`);
    }
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta movimentação? Isso afetará o saldo atual.')) {
      try {
        await deletarCredito(id);
        carregar();
      } catch (error: any) {
        console.error('Erro ao excluir crédito:', error);
        alert(`Erro ao excluir: ${error?.message || JSON.stringify(error) || 'Erro desconhecido'}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Saldo em Haver</p>
            <p className={`text-2xl font-black ${saldo >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
              {formatarMoeda(saldo)}
            </p>
          </div>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus size={16} /> Lançamento Manual
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="card bg-brand-dark-3 border-brand-dark-5 space-y-4">
          <h4 className="text-sm font-bold text-white mb-2">Novo Lançamento</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Tipo</label>
              <select 
                value={tipo} 
                onChange={(e) => setTipo(e.target.value as any)}
                className="select w-full"
              >
                <option value="entrada">Entrada (Adicionar Saldo)</option>
                <option value="saida">Saída (Remover Saldo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Valor</label>
              <input 
                type="text" 
                value={valor}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (!v) v = '0';
                  setValor((Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                className="input w-full"
                placeholder="0,00"
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">Descrição</label>
              <input 
                type="text" 
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="input w-full"
                placeholder="Ex: Troco de serviço, Ajuste manual..."
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      )}

      <div className="card p-0 border-brand-dark-5 overflow-hidden">
        <div className="px-4 py-3 bg-brand-dark-3 border-b border-brand-dark-5">
          <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Extrato de Movimentações</h4>
        </div>
        {carregando ? (
          <div className="p-8 text-center text-gray-500 text-sm">Carregando...</div>
        ) : creditos.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhuma movimentação de crédito encontrada.</div>
        ) : (
          <div className="divide-y divide-brand-dark-5">
            {creditos.map(c => (
              <div key={c.id} className="p-4 hover:bg-brand-dark-3/50 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    c.tipo === 'entrada' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {c.tipo === 'entrada' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{c.descricao}</p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {formatarDataHora(c.criadoEm)} {c.criadoPorNome ? `• Lançado por ${c.criadoPorNome}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`text-sm font-bold ${c.tipo === 'entrada' ? 'text-brand-green' : 'text-red-500'}`}>
                    {c.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(c.valor)}
                  </p>
                  <button 
                    onClick={() => handleExcluir(c.id)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir Lançamento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
