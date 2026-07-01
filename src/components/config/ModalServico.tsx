import React, { useState, useEffect } from 'react';
import { X, Save, Info } from 'lucide-react';
import { ServicoConfig } from '../../types';
import { useServicos } from '../../context/ServicosContext';
import { useAuth } from '../../context/AuthContext';
import { obterRotuloCategoria } from '../../utils/categoriaHelper';

interface ModalServicoProps {
  aberto: boolean;
  fechar: () => void;
  servicoParaEditar?: ServicoConfig | null;
}

export function ModalServico({ aberto, fechar, servicoParaEditar }: ModalServicoProps) {
  const { criarServico, atualizarServico } = useServicos();
  const { usuario } = useAuth();
  const [salvando, setSalvando] = useState(false);
  
  const [nome, setNome] = useState('');
  const [valorPadrao, setValorPadrao] = useState('');
  const [valorFiliado, setValorFiliado] = useState('');
  const [taxaPF, setTaxaPF] = useState('');
  const [exigeGRU, setExigeGRU] = useState(false);
  const [categoria, setCategoria] = useState<string>('Honorário');

  const categorias = usuario?.dadosEmpresa?.categoriasServico || [
    { id: 'honorario', nome: 'Honorário', calculaComoServico: true },
    { id: 'laudo', nome: 'Laudo', calculaComoServico: false }
  ];

  useEffect(() => {
    if (servicoParaEditar) {
      setNome(servicoParaEditar.nome);
      setValorPadrao(servicoParaEditar.valorPadrao.toString().replace('.', ','));
      setValorFiliado(servicoParaEditar.valorFiliado?.toString().replace('.', ',') || '');
      setTaxaPF(servicoParaEditar.taxaPF.toString().replace('.', ','));
      setExigeGRU(servicoParaEditar.exigeGRU ?? false);
      setCategoria(servicoParaEditar.categoria || 'Honorário');
    } else {
      setNome('');
      setValorPadrao('');
      setValorFiliado('');
      setTaxaPF('');
      setExigeGRU(false);
      setCategoria(categorias[0]?.nome || 'Honorário');
    }
  }, [servicoParaEditar, aberto, categorias]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    try {
      const v = parseFloat(valorPadrao.replace(',', '.')) || 0;
      const vf = parseFloat(valorFiliado.replace(',', '.')) || 0;
      const t = parseFloat(taxaPF.replace(',', '.')) || 0;

      if (servicoParaEditar) {
        await atualizarServico(servicoParaEditar.id, { nome: nome.trim().toUpperCase(), valorPadrao: v, valorFiliado: vf, taxaPF: t, exigeGRU, categoria });
      } else {
        await criarServico({ nome: nome.trim().toUpperCase(), valorPadrao: v, valorFiliado: vf, taxaPF: t, exigeGRU, categoria });
      }
      fechar();
    } catch (err) {
      alert('Erro ao salvar serviço');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={fechar} />
      
      <div className="card w-full max-w-md shadow-2xl relative z-10 animate-scale-up">
        <button onClick={fechar} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {servicoParaEditar ? 'Editar Serviço' : 'Novo Serviço'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome do Serviço</label>
            <input 
              type="text" 
              className="input uppercase" 
              placeholder="Ex: GUIA DE TRÁFEGO"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label text-brand-blue-light font-bold">Categoria do Serviço</label>
            <select 
              className="input bg-brand-dark-3 border-brand-blue/20"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
            >
              {categorias.map(cat => (
                <option key={cat.id} value={cat.nome}>
                  {obterRotuloCategoria(cat.nome)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor de Venda (R$)</label>
              <input 
                type="text" 
                className="input" 
                placeholder="0,00"
                value={valorPadrao}
                onChange={e => setValorPadrao(e.target.value.replace(/[^\d,]/g, ''))}
              />
            </div>
            <div>
              <label className="label text-brand-blue-light">Valor Filiado (R$)</label>
              <input 
                type="text" 
                className="input border-brand-blue/30 focus:border-brand-blue" 
                placeholder="0,00"
                value={valorFiliado}
                onChange={e => setValorFiliado(e.target.value.replace(/[^\d,]/g, ''))}
              />
            </div>
          </div>

          <div>
            <label className="label text-yellow-500/80">Taxa PF (R$)</label>
            <input 
              type="text" 
              className="input border-yellow-500/20 focus:border-yellow-500" 
              placeholder="0,00"
              value={taxaPF}
              onChange={e => setTaxaPF(e.target.value.replace(/[^\d,]/g, ''))}
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-brand-dark-3 border border-brand-blue/20 rounded-xl cursor-pointer hover:bg-brand-dark-2 transition-colors">
            <input
              type="checkbox"
              checked={exigeGRU}
              onChange={(e) => setExigeGRU(e.target.checked)}
              className="checkbox checkbox-primary"
            />
            <div>
              <div className="font-bold text-white text-sm">Exige Pagamento de GRU / Taxa?</div>
              <div className="text-xs text-gray-400">Ative para exibir controles de GRU e protocolo na Ordem de Serviço</div>
            </div>
          </label>

          <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-3 flex gap-2">
            <Info size={16} className="text-brand-blue-light shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              A **Taxa PF** é apenas para controle interno de lucro e **nunca** aparecerá nos orçamentos ou PDFs enviados aos clientes.
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
