import React, { useState } from 'react';
import { Search, X, UserCheck, AlertTriangle, Send, ChevronRight, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { buscarCacPorCpf, solicitarVinculo } from '../../services/vinculosService';

interface Props {
  onClose: () => void;
  onSucesso: () => void;
}

type Etapa = 'busca' | 'preview' | 'mensagem' | 'sucesso';

export function ModalSolicitarVinculo({ onClose, onSucesso }: Props) {
  const { usuario } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>('busca');
  const [cpf, setCpf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroGlobal, setErroGlobal] = useState('');
  const [resultado, setResultado] = useState<{
    cacEmpresaId: string;
    cacEmail: string;
    cacNome: string;
    cacCpf: string;
  } | null>(null);

  const formatarCpf = (v: string) => {
    const nums = v.replace(/\D/g, '').slice(0, 11);
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
               .replace(/(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3')
               .replace(/(\d{3})(\d{3})$/, '$1.$2')
               .replace(/(\d{3})$/, '$1');
  };

  const handleBuscar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErroGlobal('Digite um CPF válido com 11 dígitos.');
      return;
    }
    setErroGlobal('');
    setBuscando(true);

    const res = await buscarCacPorCpf(cpfLimpo);
    setBuscando(false);

    if (!res.encontrado || !res.cacEmpresaId || !res.cacEmail || !res.cacNome) {
      setErroGlobal('Nenhum atirador com portal GCAC encontrado para este CPF. O atirador precisa estar cadastrado no Portal GCAC Individual.');
      return;
    }

    setResultado({
      cacEmpresaId: res.cacEmpresaId,
      cacEmail: res.cacEmail,
      cacNome: res.cacNome,
      cacCpf: res.cacCpf || cpfLimpo,
    });
    setEtapa('preview');
  };

  const handleEnviar = async () => {
    if (!usuario?.empresaId || !resultado) return;
    setEnviando(true);
    setErroGlobal('');

    const res = await solicitarVinculo({
      despachante_empresa_id: usuario.empresaId,
      despachante_nome: usuario.empresaNome || 'Despachante',
      cac_empresa_id: resultado.cacEmpresaId,
      cac_email: resultado.cacEmail,
      cac_nome: resultado.cacNome,
      cac_cpf: resultado.cacCpf,
      mensagem: mensagem.trim() || undefined,
    });

    setEnviando(false);

    if (!res.sucesso) {
      setErroGlobal(res.erro || 'Erro ao enviar solicitação.');
      return;
    }

    setEtapa('sucesso');
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-brand-dark-2 w-full max-w-md rounded-2xl border border-brand-dark-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-dark-3 to-brand-dark-2 border-b border-brand-dark-5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-xl border border-brand-blue/20">
              <Search size={16} className="text-brand-blue-light" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Solicitar Acesso a Atirador</h2>
              <p className="text-[10px] text-gray-500">Busca por CPF no portal GCAC</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Etapa 1: Busca por CPF */}
          {etapa === 'busca' && (
            <>
              <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
                Digite o <strong className="text-white">CPF do atirador</strong> para verificar se ele possui uma conta no Portal GCAC Individual. Se encontrado, você poderá enviar uma solicitação de acesso que ele deverá aprovar.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  CPF do Atirador
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    value={cpf}
                    onChange={e => { setCpf(formatarCpf(e.target.value)); setErroGlobal(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                    placeholder="000.000.000-00"
                    className="w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/40 font-mono tracking-widest"
                    maxLength={14}
                  />
                </div>
                {erroGlobal && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{erroGlobal}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleBuscar}
                disabled={buscando || cpf.replace(/\D/g,'').length < 11}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {buscando ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                {buscando ? 'Buscando...' : 'Buscar Atirador'}
              </button>
            </>
          )}

          {/* Etapa 2: Preview do atirador */}
          {etapa === 'preview' && resultado && (
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                <UserCheck size={20} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-300">Atirador encontrado no Portal GCAC</p>
                  <p className="text-xs text-green-400/70 mt-0.5">Conta verificada e ativa</p>
                </div>
              </div>

              <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 uppercase tracking-wide font-bold">Nome</span>
                  <span className="text-white font-bold">{resultado.cacNome}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 uppercase tracking-wide font-bold">CPF</span>
                  <span className="text-white font-mono">{formatarCpf(resultado.cacCpf)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 uppercase tracking-wide font-bold">Email</span>
                  <span className="text-gray-400">{resultado.cacEmail}</span>
                </div>
              </div>

              <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-4">
                <p className="text-xs font-bold text-white mb-2">O que você poderá ver após autorização:</p>
                <div className="space-y-1.5">
                  {['Armas cadastradas (modelo, calibre, série, CRAF)', 'Guias de Tráfego por arma', 'Autorizações de Manejo IBAMA', 'CR e CR IBAMA com validades', 'Alertas de documentos próximos ao vencimento'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                      <ChevronRight size={10} className="text-brand-blue shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-brand-dark-5">
                  <p className="text-[10px] text-gray-600">
                    ❌ Você <strong className="text-gray-500">NÃO poderá</strong> editar, excluir ou exportar os dados do atirador.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEtapa('busca')} className="btn-ghost flex-1">
                  ← Voltar
                </button>
                <button onClick={() => setEtapa('mensagem')} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Continuar <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* Etapa 3: Mensagem opcional */}
          {etapa === 'mensagem' && resultado && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Mensagem para o Atirador <span className="text-gray-600 normal-case font-normal">(opcional)</span>
                </label>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder={`Ex: Olá ${resultado.cacNome.split(' ')[0]}, sou seu despachante autorizado. Solicito acesso para acompanhar sua documentação e alertá-lo sobre vencimentos.`}
                  className="w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/40 resize-none h-28"
                  maxLength={300}
                />
                <p className="text-[10px] text-gray-600 text-right mt-1">{mensagem.length}/300</p>
              </div>

              <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-3 text-xs text-gray-500">
                📱 O atirador receberá uma <strong className="text-gray-300">notificação no portal</strong> com sua solicitação. Ele terá 30 dias para responder.
              </div>

              {erroGlobal && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{erroGlobal}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setEtapa('preview')} className="btn-ghost flex-1">
                  ← Voltar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={enviando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {enviando ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                  {enviando ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </>
          )}

          {/* Etapa 4: Sucesso */}
          {etapa === 'sucesso' && resultado && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                <Send size={28} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white mb-1">Solicitação Enviada!</h3>
                <p className="text-sm text-gray-400">
                  <strong className="text-white">{resultado.cacNome}</strong> receberá uma notificação no portal para autorizar seu acesso.
                </p>
                <p className="text-xs text-gray-600 mt-2">O acesso ao acervo só será liberado após a confirmação do atirador.</p>
              </div>
              <button onClick={onSucesso} className="btn-primary w-full">
                Concluído
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
