import React, { useState } from 'react';
import { X, DollarSign, Calendar, CreditCard, FileText, Upload, Check, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { criarVale } from '../../services/valesColaboradoresService';
import { fileToBase64 } from '../../utils/fileUtils';
import { format } from 'date-fns';
import { formatarMoeda } from '../../utils/formatters';
import { gerarReciboValePdf } from '../../utils/reciboValePdf';

interface ModalEmitirValeProps {
  isOpen: boolean;
  onClose: () => void;
  onSucesso?: () => void;
  colaboradorPreSelecionado?: {
    id?: string;
    nome: string;
    cpf?: string;
    email?: string;
  };
  listaColaboradores?: Array<{
    id?: string;
    nome: string;
    cpf?: string;
    email?: string;
  }>;
}

export function ModalEmitirVale({
  isOpen,
  onClose,
  onSucesso,
  colaboradorPreSelecionado,
  listaColaboradores = []
}: ModalEmitirValeProps) {
  const { usuario } = useAuth();

  const [colaboradorSelecionado, setColaboradorSelecionado] = useState(() => {
    return colaboradorPreSelecionado || (listaColaboradores.length > 0 ? listaColaboradores[0] : null);
  });

  const [valor, setValor] = useState('');
  const [dataAdiantamento, setDataAdiantamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'Dinheiro' | 'Transferência' | 'Outro'>('PIX');
  const [motivo, setMotivo] = useState('Adiantamento salarial a pedido do colaborador');
  const [observacoes, setObservacoes] = useState('');
  const [comprovanteGestor, setComprovanteGestor] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const b64 = await fileToBase64(file);
        setComprovanteGestor(b64);
      } catch (err) {
        console.error('Erro ao ler comprovante:', err);
      }
    }
  };

  const handleSalvar = async (imprimirApos: boolean = false) => {
    if (!usuario?.empresaId) return;
    const valNum = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (!valNum || valNum <= 0) {
      setErro('Informe um valor de adiantamento válido maior que zero.');
      return;
    }

    const colabNome = colaboradorSelecionado?.nome || colaboradorPreSelecionado?.nome;
    if (!colabNome) {
      setErro('Selecione o colaborador beneficiário do vale.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const novoVale = await criarVale(usuario.empresaId, {
        colaboradorId: colaboradorSelecionado?.id,
        colaboradorNome: colabNome,
        colaboradorCpf: colaboradorSelecionado?.cpf || colaboradorPreSelecionado?.cpf,
        usuarioEmail: colaboradorSelecionado?.email || colaboradorPreSelecionado?.email,
        valor: valNum,
        dataAdiantamento,
        formaPagamento,
        motivo,
        comprovanteGestorUrl: comprovanteGestor || undefined,
        observacoes: observacoes || undefined,
        criadoPorNome: usuario.nome || 'Gestor'
      });

      if (imprimirApos) {
        gerarReciboValePdf(novoVale, {
          nome: usuario.dadosEmpresa?.razaoSocialFantasia || usuario.dadosEmpresa?.nome || 'Portal G CAC',
          cnpj: usuario.dadosEmpresa?.cnpj,
          endereco: usuario.dadosEmpresa?.endereco
        });
      }

      onSucesso?.();
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar vale.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="bg-brand-dark-2 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-fade-in my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-blue/15 text-brand-blue-light border border-brand-blue/30 rounded-xl">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Emitir Vale / Adiantamento</h3>
              <p className="text-xs text-gray-400">Registra o repasse e solicita a confirmação do colaborador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{erro}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Seletor de Colaborador */}
          <div>
            <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Colaborador Beneficiário *
            </label>
            {colaboradorPreSelecionado ? (
              <div className="p-3 bg-gray-900/80 border border-gray-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-black text-white block">{colaboradorPreSelecionado.nome}</span>
                  <span className="text-gray-400 text-[11px]">
                    {colaboradorPreSelecionado.cpf ? `CPF: ${colaboradorPreSelecionado.cpf}` : 'Sem CPF cadastrado'}
                    {colaboradorPreSelecionado.email ? ` • ${colaboradorPreSelecionado.email}` : ''}
                  </span>
                </div>
                <User size={18} className="text-brand-blue" />
              </div>
            ) : (
              <select
                value={colaboradorSelecionado?.email || ''}
                onChange={e => {
                  const achou = listaColaboradores.find(c => c.email === e.target.value);
                  setColaboradorSelecionado(achou || null);
                }}
                className="input w-full bg-gray-900 border-gray-800 text-white rounded-xl"
              >
                <option value="">Selecione um colaborador da equipe...</option>
                {listaColaboradores.map((colab, idx) => (
                  <option key={colab.email || colab.id || idx} value={colab.email || ''}>
                    {colab.nome} {colab.cpf ? `(${colab.cpf})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Grid: Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Valor do Vale (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-bold">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={valor}
                  onChange={e => {
                    const limpo = e.target.value.replace(/\D/g, '');
                    if (!limpo) {
                      setValor('');
                      return;
                    }
                    const num = (parseInt(limpo, 10) / 100).toFixed(2);
                    const partes = num.split('.');
                    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                    setValor(partes.join(','));
                  }}
                  className="input w-full pl-9 font-black text-emerald-400 text-base bg-gray-900 border-gray-800 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Data do Repasse *
              </label>
              <input
                type="date"
                value={dataAdiantamento}
                onChange={e => setDataAdiantamento(e.target.value)}
                className="input w-full bg-gray-900 border-gray-800 text-white rounded-xl"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Forma de Repasse / Pagamento *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PIX', 'Dinheiro', 'Transferência'] as const).map(metodo => (
                <button
                  key={metodo}
                  type="button"
                  onClick={() => setFormaPagamento(metodo)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                    formaPagamento === metodo
                      ? 'bg-brand-blue/15 border-brand-blue text-white shadow-sm'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {metodo}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo do Adiantamento */}
          <div>
            <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Motivo / Descrição *
            </label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Adiantamento quinzenal, ajuda de custo..."
              className="input w-full bg-gray-900 border-gray-800 text-white rounded-xl"
            />
            {/* Atalhos Rápidos */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[
                'Adiantamento quinzenal',
                'Vale alimentação/refeição',
                'Ajuda de custo combustível',
                'Solicitação pessoal'
              ].map(sugestao => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setMotivo(sugestao)}
                  className="px-2 py-0.5 rounded-lg bg-gray-900 border border-gray-800 text-[10px] text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>

          {/* Comprovante do Gestor (Opcional) */}
          <div>
            <label className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Comprovante Bancário do Repasse (Opcional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl cursor-pointer text-gray-300 transition-colors">
                <Upload size={14} />
                <span>{comprovanteGestor ? 'Comprovante Carregado ✓' : 'Anexar Comprovante PIX/Doc'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleUploadComprovante}
                  className="hidden"
                />
              </label>
              {comprovanteGestor && (
                <button
                  type="button"
                  onClick={() => setComprovanteGestor('')}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-bold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={salvando}
            onClick={() => handleSalvar(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            title="Salva o vale e já baixa o PDF com 2 vias para assinatura manual em papel"
          >
            <FileText size={14} />
            <span>Emitir & Imprimir PDF</span>
          </button>

          <button
            type="button"
            disabled={salvando}
            onClick={() => handleSalvar(false)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold transition-all shadow-lg shadow-brand-blue/30 flex items-center justify-center gap-1.5"
          >
            {salvando ? (
              <span>Salvando...</span>
            ) : (
              <>
                <Check size={16} />
                <span>Emitir Vale & Notificar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
