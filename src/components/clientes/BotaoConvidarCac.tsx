import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Copy, Check, MessageCircle, X, Clock, CheckCircle2, XCircle, RefreshCw, Link, UserCheck } from 'lucide-react';
import {
  gerarConvite,
  cancelarConvite,
  buscarConvitesPorCliente,
  gerarUrlConvite,
  gerarLinkWhatsApp,
  ConviteCac,
} from '../../services/convitesService';
import { buscarCacPorCpf, solicitarVinculo } from '../../services/vinculosService';
import { useAuth } from '../../context/AuthContext';
import { Cliente } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';

interface BotaoConvidarCacProps {
  cliente: Cliente;
  isUsuarioPortal?: boolean;
  portalStatus?: string;
}

export function BotaoConvidarCac({ cliente, isUsuarioPortal, portalStatus }: BotaoConvidarCacProps) {
  const { usuario } = useAuth();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [copiou, setCopiou] = useState(false);
  const [convites, setConvites] = useState<ConviteCac[]>([]);
  const [carregandoConvites, setCarregandoConvites] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [conviteAtivo, setConviteAtivo] = useState<ConviteCac | null>(null);

  // Estados para fluxo de Solicitação de Vínculo direto
  const [solicitarEdicao, setSolicitarEdicao] = useState(false);
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState('');
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [dadosCacPortal, setDadosCacPortal] = useState<any>(null);
  const [erroSolicitacao, setErroSolicitacao] = useState('');

  const carregarConvitesInfo = useCallback(async () => {
    if (!cliente.id) return;
    const lista = await buscarConvitesPorCliente(cliente.id);
    setConvites(lista);

    // Verifica se há convite pendente válido
    const ativo = lista.find(
      c => c.status === 'pendente' && new Date(c.expira_em) > new Date()
    );
    if (ativo) {
      setConviteAtivo(ativo);
      setLinkGerado(gerarUrlConvite(ativo.token));
    } else {
      setConviteAtivo(null);
      setLinkGerado(null);
    }
  }, [cliente.id]);

  useEffect(() => {
    if (usuario?.tipoConta !== 'cac_individual' && usuario?.empresaId && !isUsuarioPortal) {
      carregarConvitesInfo();
    }
  }, [carregarConvitesInfo, usuario, isUsuarioPortal]);

  // Não exibe para CAC Individual nem sem empresa
  if (usuario?.tipoConta === 'cac_individual' || !usuario?.empresaId) return null;

  const abrirModal = async () => {
    setModalAberto(true);
    setErroSolicitacao('');
    
    if (isUsuarioPortal) {
      setCarregando(true);
      try {
        const cpfLimpo = cliente.cpf ? cliente.cpf.replace(/\D/g, '') : '';
        const res = await buscarCacPorCpf(cpfLimpo);
        if (res.encontrado && res.cacEmpresaId) {
          setDadosCacPortal(res);
        } else {
          setErroSolicitacao('Não foi possível carregar os dados do atirador no portal.');
        }
      } catch (err) {
        console.error('Erro ao buscar CAC por CPF:', err);
        setErroSolicitacao('Erro ao buscar dados do atirador.');
      } finally {
        setCarregando(false);
      }
    } else {
      setCarregandoConvites(true);
      await carregarConvitesInfo();
      setCarregandoConvites(false);
    }
  };

  const handleGerar = async () => {
    if (!usuario?.empresaId || !usuario?.empresaNome) return;
    setCarregando(true);
    try {
      const resultado = await gerarConvite({
        despachante_empresa_id: usuario.empresaId,
        despachante_nome: usuario.dadosEmpresa?.razaoSocialFantasia || usuario.empresaNome,
        cliente_nome: cliente.nome,
        cliente_cpf: cliente.cpf || undefined,
        cliente_id: cliente.id,
      });

      if (resultado.sucesso && resultado.token) {
        const url = gerarUrlConvite(resultado.token);
        setLinkGerado(url);
        // Recarrega lista de convites
        const lista = await buscarConvitesPorCliente(cliente.id);
        setConvites(lista);
        const ativo = lista.find(c => c.status === 'pendente' && new Date(c.expira_em) > new Date());
        setConviteAtivo(ativo || null);
        mostrar('sucesso', 'Link de convite gerado! Envie ao cliente via WhatsApp.');
      } else {
        mostrar('erro', resultado.erro || 'Erro ao gerar convite.');
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleCopiar = async () => {
    if (!linkGerado) return;
    await navigator.clipboard.writeText(linkGerado);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!linkGerado || !usuario) return;
    const despNome = usuario.dadosEmpresa?.razaoSocialFantasia || usuario.empresaNome || 'Despachante';
    const telefone = cliente.contato || '';
    if (!telefone.trim()) {
      mostrar('aviso', 'Este cliente não possui telefone cadastrado. Copie o link manualmente.');
      return;
    }
    const url = gerarLinkWhatsApp(telefone, cliente.nome, despNome, linkGerado);
    window.open(url, '_blank');
  };

  const handleCancelar = async (conviteId: string) => {
    if (!confirm('Cancelar este convite?')) return;
    const res = await cancelarConvite(conviteId);
    if (res.sucesso) {
      mostrar('sucesso', 'Convite cancelado.');
      const lista = await buscarConvitesPorCliente(cliente.id);
      setConvites(lista);
      setConviteAtivo(null);
      setLinkGerado(null);
    } else {
      mostrar('erro', res.erro || 'Erro ao cancelar.');
    }
  };

  // Funções para fluxo de solicitação de vínculo direto
  const handleSolicitarVinculo = async () => {
    if (!usuario?.empresaId || !dadosCacPortal) return;
    setEnviandoSolicitacao(true);
    setErroSolicitacao('');
    try {
      const res = await solicitarVinculo({
        despachante_empresa_id: usuario.empresaId,
        despachante_nome: usuario.dadosEmpresa?.razaoSocialFantasia || usuario.empresaNome || 'Despachante',
        cac_empresa_id: dadosCacPortal.cacEmpresaId,
        cac_email: dadosCacPortal.cacEmail,
        cac_nome: dadosCacPortal.cacNome,
        cac_cpf: dadosCacPortal.cacCpf,
        mensagem: mensagemSolicitacao.trim() || undefined,
        permite_edicao: solicitarEdicao,
      });

      if (res.sucesso) {
        mostrar('sucesso', 'Solicitação de vínculo enviada com sucesso!');
        setModalAberto(false);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErroSolicitacao(res.erro || 'Erro ao solicitar vínculo.');
      }
    } catch (err: any) {
      setErroSolicitacao(err.message || 'Erro ao processar solicitação.');
    } finally {
      setEnviandoSolicitacao(false);
    }
  };

  const handleWhatsAppNotificarVinculo = () => {
    if (!usuario) return;
    const cacNome = dadosCacPortal?.cacNome || cliente.nome;
    const telefone = cliente.contato || '';
    if (!telefone.trim()) {
      mostrar('aviso', 'Este cliente não possui telefone cadastrado.');
      return;
    }
    const texto = `Olá, ${cacNome}! Enviei uma solicitação de vínculo no Portal GCAC para termos acesso ao seu acervo e documentos. Por favor, acesse sua conta no Portal GCAC (https://portalgcac.com.br) para aceitar a solicitação. Obrigado!`;
    const url = `https://api.whatsapp.com/send?phone=55${telefone.replace(/\D/g, '')}&text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const jaAceitoUmaVez = convites.some(c => c.status === 'aceito') || portalStatus === 'ativo';

  const statusLabel = (c: ConviteCac) => {
    if (c.status === 'aceito') return { label: 'Aceito', cor: 'text-brand-green', icon: <CheckCircle2 size={12} /> };
    if (c.status === 'cancelado') return { label: 'Cancelado', cor: 'text-gray-500', icon: <XCircle size={12} /> };
    if (c.status === 'expirado' || new Date(c.expira_em) < new Date()) return { label: 'Expirado', cor: 'text-red-400', icon: <Clock size={12} /> };
    return { label: 'Pendente', cor: 'text-yellow-400', icon: <Clock size={12} /> };
  };

  return (
    <>
      <button
        id={`btn-convidar-cac-${cliente.id}`}
        onClick={abrirModal}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
          portalStatus === 'ativo'
            ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
            : portalStatus === 'pendente'
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            : isUsuarioPortal
            ? 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue-light hover:bg-brand-blue/20'
            : 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue-light hover:bg-brand-blue/20'
        }`}
        title={
          portalStatus === 'ativo'
            ? 'Vínculo ativo com o Portal GCAC'
            : portalStatus === 'pendente'
            ? 'Solicitação de vínculo pendente no Portal'
            : isUsuarioPortal
            ? 'Solicitar acesso ao acervo do cliente no Portal GCAC'
            : 'Convidar cliente para o Portal GCAC'
        }
      >
        {portalStatus === 'ativo' ? (
          <CheckCircle2 size={14} />
        ) : portalStatus === 'pendente' ? (
          <Clock size={14} />
        ) : isUsuarioPortal ? (
          <UserCheck size={14} className="text-brand-blue-light" />
        ) : (
          <UserPlus size={14} />
        )}
        {portalStatus === 'ativo'
          ? 'Portal Ativo'
          : portalStatus === 'pendente'
          ? 'Vínculo Pendente'
          : isUsuarioPortal
          ? 'Solicitar Vínculo'
          : 'Convidar para Portal'}
      </button>

      {/* Modal */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setModalAberto(false); }}
        >
          <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-md shadow-2xl space-y-5 p-6 animate-slide-up">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  {isUsuarioPortal ? (
                    <UserCheck size={16} className="text-brand-blue-light" />
                  ) : (
                    <UserPlus size={16} className="text-brand-blue-light" />
                  )}
                  {portalStatus === 'pendente'
                    ? 'Vínculo Pendente'
                    : isUsuarioPortal
                    ? 'Solicitar Vínculo com Atirador'
                    : 'Convidar para Portal GCAC'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Cliente: <strong className="text-white">{cliente.nome}</strong>
                </p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo dependente de o cliente ser usuário do portal ou não */}
            {portalStatus === 'pendente' ? (
              <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-5 text-center space-y-4">
                <Clock size={24} className="mx-auto text-yellow-400 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-white">Solicitação de Vínculo Pendente</p>
                  <p className="text-xs text-gray-400 mt-1">O atirador precisa aceitar a solicitação em sua conta do Portal GCAC.</p>
                </div>
                <button
                  onClick={handleWhatsAppNotificarVinculo}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/25 transition-all"
                >
                  <MessageCircle size={14} />
                  Relembrar via WhatsApp
                </button>
              </div>
            ) : isUsuarioPortal ? (
              <>
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 text-xs text-gray-400 leading-relaxed space-y-1.5">
                  <p>👤 Este cliente <strong className="text-white">já possui cadastro</strong> no Portal GCAC Individual.</p>
                  <p>🔗 Ao enviar, ele receberá um alerta em sua conta para autorizar o seu acesso ao acervo dele.</p>
                </div>

                {erroSolicitacao && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-3">
                    {erroSolicitacao}
                  </div>
                )}

                {carregando ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  dadosCacPortal && (
                    <div className="space-y-4">
                      <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 p-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500 uppercase tracking-wide font-bold">Nome no Portal:</span>
                          <span className="text-white font-bold">{dadosCacPortal.cacNome}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 uppercase tracking-wide font-bold">E-mail:</span>
                          <span className="text-gray-300">{dadosCacPortal.cacEmail}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-start gap-2.5 cursor-pointer group">
                          <input 
                            type="checkbox"
                            checked={solicitarEdicao}
                            onChange={e => setSolicitarEdicao(e.target.checked)}
                            className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-brand-blue/30 focus:ring-offset-0 focus:outline-none w-4 h-4 mt-0.5"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-white group-hover:text-brand-blue-light transition-colors">Solicitar permissão de edição</p>
                            <p className="text-[10px] text-gray-500 leading-snug">Permite que você adicione, edite ou exclua armas e documentos no acervo do cliente.</p>
                          </div>
                        </label>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            Mensagem Personalizada (Opcional)
                          </label>
                          <textarea
                            value={mensagemSolicitacao}
                            onChange={e => setMensagemSolicitacao(e.target.value)}
                            placeholder="Ex: Olá, solicito acesso para gerenciar suas GTs e CRAF..."
                            className="w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/40 resize-none h-16"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSolicitarVinculo}
                          disabled={enviandoSolicitacao}
                          className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 text-xs font-bold"
                        >
                          {enviandoSolicitacao ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                          {enviandoSolicitacao ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                        <button
                          onClick={handleWhatsAppNotificarVinculo}
                          className="btn-ghost border-brand-dark-5 px-3 py-2.5 flex items-center justify-center text-gray-400 hover:text-white"
                          title="Notificar via WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                {/* Explicação padrão para convite de cadastro */}
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 text-xs text-gray-400 leading-relaxed space-y-1.5">
                  <p>📱 O cliente receberá o link pelo <strong className="text-white">WhatsApp</strong> e fará login com o Google.</p>
                  <p>🔗 Após aceitar, ficará vinculado à sua empresa e terá acesso ao acervo de armas e documentos.</p>
                  <p>⏰ O link é válido por <strong className="text-white">24 horas</strong>.</p>
                </div>

                {carregandoConvites ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Link gerado */}
                    {linkGerado && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                          Link de Convite (válido 24h)
                        </label>
                        <div className="flex items-center gap-2 bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                          <Link size={14} className="text-brand-blue-light shrink-0" />
                          <span className="text-xs text-gray-300 truncate flex-1">{linkGerado}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopiar}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand-dark-5 text-xs font-bold text-gray-300 hover:text-white hover:border-gray-600 transition-all"
                          >
                            {copiou ? <Check size={14} className="text-brand-green" /> : <Copy size={14} />}
                            {copiou ? 'Copiado!' : 'Copiar Link'}
                          </button>
                          <button
                            onClick={handleWhatsApp}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/25 transition-all"
                          >
                            <MessageCircle size={14} />
                            Enviar WhatsApp
                          </button>
                        </div>
                        {conviteAtivo && (
                          <button
                            onClick={() => handleCancelar(conviteAtivo.id)}
                            className="w-full text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1"
                          >
                            <XCircle size={12} /> Cancelar este convite
                          </button>
                        )}
                      </div>
                    )}

                    {/* Gerar novo convite */}
                    {!linkGerado && (
                      <button
                        onClick={handleGerar}
                        disabled={carregando}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                      >
                        {carregando ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <UserPlus size={16} />
                        )}
                        {carregando ? 'Gerando link...' : 'Gerar Link de Convite'}
                      </button>
                    )}

                    {/* Histórico de convites */}
                    {convites.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Histórico</p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {convites.map(c => {
                            const { label, cor, icon } = statusLabel(c);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-xs bg-brand-dark-4 rounded-lg px-3 py-2"
                              >
                                <span className="text-gray-400">
                                  {new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                                <span className={`flex items-center gap-1 font-bold ${cor}`}>
                                  {icon} {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Notificacao {...notif} onFechar={fechar} />
    </>
  );
}
