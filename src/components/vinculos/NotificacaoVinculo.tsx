import React, { useState } from 'react';
import { Shield, Check, X, Info, AlertTriangle, Link2, ChevronRight, Loader } from 'lucide-react';
import { responderVinculo, VinculoDespachanteCac } from '../../services/vinculosService';

interface Props {
  vinculo: VinculoDespachanteCac;
  onClose: () => void;
  onRespondido: () => void;
}

export function NotificacaoVinculo({ vinculo, onClose, onRespondido }: Props) {
  const [carregando, setCarregando] = useState<'ativo' | 'rejeitado' | null>(null);
  const [erro, setErro] = useState('');
  const [aceitouTermo, setAceitouTermo] = useState(false);

  const handleResposta = async (status: 'ativo' | 'rejeitado') => {
    setCarregando(status);
    setErro('');
    const termoTexto = (status === 'ativo' && vinculo.permite_edicao) 
      ? 'Estou ciente e autorizo este despachante a gerenciar, atualizar e editar os dados do meu acervo.' 
      : undefined;
    const res = await responderVinculo(vinculo.id, status, vinculo.cac_empresa_id, termoTexto);
    setCarregando(null);

    if (!res.sucesso) {
      setErro(res.erro || 'Erro ao registrar resposta.');
      return;
    }

    onRespondido();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-brand-dark-2 w-full max-w-md rounded-2xl border border-brand-dark-5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-dark-3 to-brand-dark-2 border-b border-brand-dark-5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-xl border border-brand-blue/20">
              <Link2 size={16} className="text-brand-blue-light" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Solicitação de Vínculo</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Autorização de Acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Informações da solicitação */}
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-500">O despachante profissional</p>
            <p className="text-base font-black text-white">{vinculo.despachante_nome}</p>
            <p className="text-xs text-gray-400">solicitou acesso ao acervo digital da sua conta.</p>
          </div>

          {/* Mensagem enviada pelo despachante */}
          {vinculo.mensagem_solicitacao && (
            <div className="bg-brand-dark-3 rounded-xl p-3 border border-brand-dark-5 text-xs text-gray-400 leading-relaxed italic">
              "{vinculo.mensagem_solicitacao}"
            </div>
          )}

          {/* O que ele verá */}
          <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 p-4 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-3 uppercase tracking-wider text-brand-blue-light">
              <Shield size={12} /> O que será compartilhado:
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Seu perfil básico', desc: 'Nome, CPF mascarado e dados de contato.' },
                { label: 'Certificado de Registro (CR)', desc: 'Número e validade do CR do Exército/IBAMA.' },
                { label: 'Seu acervo de armas', desc: 'Modelo, calibre, CRAF, Sigma e número de série.' },
                { label: 'Guias de Tráfego & Manejos', desc: 'Todas as guias e autorizações anexadas.' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start text-xs">
                  <div className="p-0.5 rounded-full bg-brand-blue/10 text-brand-blue-light mt-0.5">
                    <Check size={10} />
                  </div>
                  <div>
                    <strong className="text-gray-300 font-bold">{item.label}:</strong>{' '}
                    <span className="text-gray-400">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Declaração LGPD e Limitações */}
          <div className="space-y-2 text-[11px] text-gray-500 leading-relaxed">
            <div className="flex gap-1.5 items-start">
              <Info size={12} className="text-brand-blue shrink-0 mt-0.5" />
              {vinculo.permite_edicao ? (
                <p>
                  <strong>Permissão de Edição:</strong> Com sua autorização e aceite do termo abaixo, este despachante poderá cadastrar, alterar e excluir armas, guias e manejos directly in your account.
                </p>
              ) : (
                <p>
                  <strong>Apenas Leitura:</strong> O despachante NÃO poderá alterar, excluir ou cadastrar nenhuma informação na sua conta. Ele apenas visualizará os dados.
                </p>
              )}
            </div>
            <div className="flex gap-1.5 items-start">
              <Info size={12} className="text-brand-blue shrink-0 mt-0.5" />
              <p>
                <strong>Controle total:</strong> Você pode revogar essa autorização a qualquer momento na tela de configurações da sua conta. O acesso cessa imediatamente.
              </p>
            </div>
          </div>

          {/* Consentimento explícito caso solicite edição */}
          {vinculo.permite_edicao && (
            <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-4 space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-yellow-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle size={12} /> Consentimento de Edição (Escrita)
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Este despachante solicitou permissão para gerenciar e atualizar os dados do seu acervo. Para autorizar, marque a caixa de aceite abaixo:
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer group pt-2 border-t border-brand-dark-5/50">
                <input 
                  type="checkbox"
                  checked={aceitouTermo}
                  onChange={e => setAceitouTermo(e.target.checked)}
                  className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-brand-blue/30 focus:ring-offset-0 focus:outline-none w-4 h-4 shrink-0 mt-0.5"
                />
                <span className="text-[11px] text-gray-300 group-hover:text-white leading-normal transition-colors font-semibold">
                  Estou ciente e autorizo este despachante a gerenciar, atualizar e editar os dados do meu acervo.
                </span>
              </label>
            </div>
          )}

          {erro && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={12} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleResposta('rejeitado')}
              disabled={carregando !== null}
              className="btn-ghost flex-1 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-brand-dark-5 hover:border-red-500/20 font-bold"
            >
              {carregando === 'rejeitado' ? <Loader size={14} className="animate-spin mx-auto" /> : 'Recusar'}
            </button>
            <button
              onClick={() => handleResposta('ativo')}
              disabled={carregando !== null || (vinculo.permite_edicao === true && !aceitouTermo)}
              className="btn-primary flex-1 py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando === 'ativo' ? <Loader size={14} className="animate-spin" /> : <Check size={16} />}
              {carregando === 'ativo' ? 'Autorizando...' : 'Autorizar Acesso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
