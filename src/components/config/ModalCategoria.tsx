import React, { useState, useEffect } from 'react';
import { X, Save, HelpCircle } from 'lucide-react';
import { CategoriaServico } from '../../types';

interface ModalCategoriaProps {
  aberto: boolean;
  fechar: () => void;
  categoriaParaEditar?: CategoriaServico | null;
  onSalvar: (dados: { nome: string; calculaComoServico: boolean }) => Promise<void>;
}

export function ModalCategoria({ aberto, fechar, categoriaParaEditar, onSalvar }: ModalCategoriaProps) {
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [calculaComoServico, setCalculaComoServico] = useState(true);

  useEffect(() => {
    if (categoriaParaEditar) {
      setNome(categoriaParaEditar.nome);
      setCalculaComoServico(categoriaParaEditar.calculaComoServico);
    } else {
      setNome('');
      setCalculaComoServico(true);
    }
  }, [categoriaParaEditar, aberto]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        calculaComoServico
      });
      fechar();
    } catch (err) {
      alert('Erro ao salvar categoria');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={fechar} />
      
      <div className="card w-full max-w-md shadow-2xl relative z-10 animate-scale-up border border-brand-dark-5 bg-brand-dark-2">
        <button onClick={fechar} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {categoriaParaEditar ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome da Categoria</label>
            <input 
              type="text" 
              className="input uppercase font-bold" 
              placeholder="Ex: CURSO, TAXA DE ASSOCIAÇÃO"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              autoFocus
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-brand-dark-3 border border-brand-blue/20 rounded-xl cursor-pointer hover:bg-brand-dark-4 transition-colors">
            <input
              type="checkbox"
              checked={calculaComoServico}
              onChange={(e) => setCalculaComoServico(e.target.checked)}
              className="checkbox checkbox-primary"
            />
            <div>
              <div className="font-bold text-white text-sm">Calcular como Receita/Serviço da Empresa?</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Se ativado, esta categoria será contabilizada em "Honorários". Se desativado, se comportará como custo externo/laudo (pago direto a instrutores ou terceiros).
              </div>
            </div>
          </label>

          <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-3 flex gap-2">
            <HelpCircle size={16} className="text-brand-blue-light shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Categorias como **Honorário** devem ser marcadas como receita da empresa. Categorias como **Laudo** devem ser desmarcadas para que o repasse aos instrutores ocorra separadamente.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={fechar} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1">
              <Save size={16} />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
