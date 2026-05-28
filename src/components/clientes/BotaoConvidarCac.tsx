import React, { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, MessageCircle, X, Clock, CheckCircle2, XCircle, RefreshCw, Link } from 'lucide-react';
import {
  gerarConvite,
  cancelarConvite,
  buscarConvitesPorCliente,
  gerarUrlConvite,
  gerarLinkWhatsApp,
  ConviteCac,
} from '../../services/convitesService';
import { useAuth } from '../../context/AuthContext';
import { Cliente } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';

interface BotaoConvidarCacProps {
  cliente: Cliente;
}

export function BotaoConvidarCac({ cliente }: BotaoConvidarCacProps) {
  const { usuario } = useAuth();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [copiou, setCopiou] = useState(false);
  const [convites, setConvites] = useState<ConviteCac[]>([]);
  const [carregandoConvites, setCarregandoConvites] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [conviteAtivo, setConviteAtivo] = useState<ConviteCac | null>(null);

  // Não exibe para CAC Individual nem sem empresa
  if (usuario?.tipoConta === 'cac_individual' || !usuario?.empresaId) return null;

  const abrirModal = async () => {
    setModalAberto(true);
    setCarregandoConvites(true);
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
    setCarregandoConvites(false);
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

  const jaAceitoUmaVez = convites.some(c => c.status === 'aceito');

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
          jaAceitoUmaVez
            ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
            : 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue-light hover:bg-brand-blue/20'
        }`}
        title="Convidar cliente para o Portal GCAC"
      >
        <UserPlus size={14} />
        {jaAceitoUmaVez ? 'Portal Ativo' : 'Convidar para Portal'}
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
                  <UserPlus size={16} className="text-brand-blue-light" />
                  Convidar para Portal GCAC
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Cliente: <strong className="text-white">{cliente.nome}</strong>
                </p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Explicação */}
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
          </div>
        </div>
      )}

      <Notificacao {...notif} onFechar={fechar} />
    </>
  );
}
