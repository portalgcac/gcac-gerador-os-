import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  User, Mail, Phone, MapPin, Shield, Copy, Check, 
  FileText, Receipt, Clock, Calendar, Plus, 
  ArrowLeft, ChevronRight, ExternalLink, MessageCircle, Trash2, Pencil
} from 'lucide-react';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';
import { FormularioCliente } from './FormularioCliente';
import { AbaDocumentacao } from './AbaDocumentacao';
import { AbaCreditos } from './AbaCreditos';
import { Cliente } from '../../types';
import { formatarCPF, formatarTelefone, formatarMoeda, formatarData, isOrdemConcluida } from '../../utils/formatters';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useRecibos } from '../../context/RecibosContext';
import { useAgendamentos } from '../../context/AgendamentosContext';
import { useClientes } from '../../context/ClientesContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { useAuth } from '../../context/AuthContext';
import { visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { BotaoConvidarCac } from './BotaoConvidarCac';
import { supabase } from '../../db/supabase';

interface DetalheClienteProps {
  cliente: Cliente;
}

export function DetalheCliente({ cliente }: DetalheClienteProps) {
  const navigate = useNavigate();
  const { usuario, temAcessoRecurso } = useAuth();
  const { ordens } = useOrdens();
  const { orcamentos } = useOrcamentos();
  const { recibos } = useRecibos();
  const { agendamentos } = useAgendamentos();
  const { deletarCliente, atualizarCliente } = useClientes();

  const temPermissao = (slug: string) => {
    return usuario?.role === 'admin' || usuario?.permissoes?.includes(slug);
  };
  
  const location = useLocation();
  const [copiou, setCopiou] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [mostrarTodasOrdens, setMostrarTodasOrdens] = useState(false);
  const [cacEmpresaId, setCacEmpresaId] = useState<string | undefined>(undefined);

  // Filtros de histórico
  const todasOrdensCliente = ordens.filter(o => o.cpf === cliente.cpf);
  const ordensClienteAbertas = todasOrdensCliente.filter(o => !isOrdemConcluida(o));
  const ordensExibidas = mostrarTodasOrdens ? todasOrdensCliente : ordensClienteAbertas;

  const orcamentosCliente = orcamentos.filter(o => o.cpf === cliente.cpf);
  const recibosCliente = recibos.filter(r => r.clienteCPF === cliente.cpf);
  const agendamentosCliente = agendamentos.filter(a => a.clienteCPF === cliente.cpf && a.status === 'pendente');

  const tabsDisponiveis = [
    { id: 'ordens', label: 'O.S.', slug: 'ordens', count: todasOrdensCliente.length },
    { id: 'orcamentos', label: 'Orçamentos', slug: 'orcamentos', count: orcamentosCliente.length },
    { id: 'recibos', label: 'Recibos', slug: 'recibos', count: recibosCliente.length },
    { id: 'agendamentos', label: 'Agendamentos', slug: 'agendamentos', count: agendamentosCliente.length },
    { id: 'documentos', label: 'Acervo & Docs', slug: null, count: 0 },
    { id: 'creditos', label: 'Haver', slug: null, count: 0 },
  ].filter(tab => {
    if (usuario?.tipoConta === 'cac_individual') {
      return tab.id === 'documentos';
    }
    return !tab.slug || temPermissao(tab.slug);
  });

  const [abaAtiva, setAbaAtiva] = useState<'ordens' | 'orcamentos' | 'recibos' | 'agendamentos' | 'documentos' | 'creditos'>(() => {
    const defaultAba = (location.state as any)?.aba;
    if (defaultAba && tabsDisponiveis.some(t => t.id === defaultAba)) {
      return defaultAba;
    }
    return (tabsDisponiveis[0]?.id || 'documentos') as any;
  });

  // Sincroniza dados do cliente com o perfil do Portal CAC se houver vínculo ativo
  useEffect(() => {
    const despachanteEmpresaId = usuario?.empresaId;
    if (usuario?.tipoConta === 'cac_individual' || !despachanteEmpresaId || !cliente.cpf) return;

    let cancelado = false;

    async function sincronizarComPortal() {
      try {
        const cpfLimpo = cliente.cpf.replace(/\D/g, '');
        const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        // 1. Busca vínculo ativo para esse cliente
        const { data: vinculo } = await supabase
          .from('vinculos_despachante_cac')
          .select('cac_empresa_id')
          .eq('despachante_empresa_id', despachanteEmpresaId)
          .or(`cac_cpf.eq.${cpfLimpo},cac_cpf.eq.${cpfFormatado}`)
          .eq('status', 'ativo')
          .maybeSingle();

        if (cancelado) return;

        if (!vinculo?.cac_empresa_id) {
          setCacEmpresaId(undefined);
          return;
        }

        setCacEmpresaId(vinculo.cac_empresa_id);

        // 2. Busca o perfil do cliente no workspace dele
        const { data: clienteCac } = await supabase
          .from('clientes')
          .select('numero_cr, vencimento_cr, numero_cr_ibama, vencimento_cr_ibama, foto_url, cr_url, cr_ibama_url, endereco, contato')
          .eq('empresa_id', vinculo.cac_empresa_id)
          .maybeSingle();

        if (cancelado || !clienteCac) return;

        // 3. Compara e monta as atualizações
        const mudancas: Partial<Cliente> = {};
        if (clienteCac.numero_cr && clienteCac.numero_cr !== cliente.numeroCr) mudancas.numeroCr = clienteCac.numero_cr;
        if (clienteCac.vencimento_cr && clienteCac.vencimento_cr !== cliente.vencimentoCr) mudancas.vencimentoCr = clienteCac.vencimento_cr;
        if (clienteCac.numero_cr_ibama && clienteCac.numero_cr_ibama !== cliente.numeroCrIbama) mudancas.numeroCrIbama = clienteCac.numero_cr_ibama;
        if (clienteCac.vencimento_cr_ibama && clienteCac.vencimento_cr_ibama !== cliente.vencimentoCrIbama) mudancas.vencimentoCrIbama = clienteCac.vencimento_cr_ibama;
        if (clienteCac.foto_url && clienteCac.foto_url !== cliente.fotoUrl) mudancas.fotoUrl = clienteCac.foto_url;
        if (clienteCac.cr_url && clienteCac.cr_url !== cliente.crUrl) mudancas.crUrl = clienteCac.cr_url;
        if (clienteCac.cr_ibama_url && clienteCac.cr_ibama_url !== cliente.crIbamaUrl) mudancas.crIbamaUrl = clienteCac.cr_ibama_url;
        if (clienteCac.endereco && clienteCac.endereco !== cliente.endereco) mudancas.endereco = clienteCac.endereco;
        if (clienteCac.contato && clienteCac.contato !== cliente.contato) mudancas.contato = clienteCac.contato;

        if (Object.keys(mudancas).length > 0) {
          console.log('Sincronizando dados com o Portal GCAC:', mudancas);
          await atualizarCliente(cliente.id, mudancas);
        }
      } catch (err) {
        console.error('Erro ao sincronizar dados do cliente:', err);
      }
    }

    sincronizarComPortal();

    return () => {
      cancelado = true;
    };
  }, [cliente, usuario, atualizarCliente]);

  const handleCopiarSenha = (senha: string) => {
    navigator.clipboard.writeText(senha);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 2000);
  };

  const acoesRapidas = [
    { 
      label: 'Gerar O.S.', 
      icon: <FileText size={20} />, 
      color: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
      path: '/ordens/nova',
      slug: 'ordens'
    },
    { 
      label: 'Gerar Orçamento', 
      icon: <Receipt size={20} />, 
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      path: '/orcamentos/novo',
      slug: 'orcamentos'
    },
    { 
      label: 'Gerar Recibo', 
      icon: <FileText size={20} />, 
      color: 'bg-brand-green/10 text-brand-green border-brand-green/20',
      path: '/recibos/novo',
      slug: 'recibos'
    },
    { 
      label: 'Agendar Laudo', 
      icon: <Calendar size={20} />, 
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      path: '/agendamentos',
      slug: 'agendamentos'
    },
    { 
      label: 'Iniciar Conversa', 
      icon: <MessageCircle size={20} />, 
      color: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/20',
      onClick: () => setModalWhatsAppAberto(true),
      slug: null
    },
  ].filter(acao => {
    if (usuario?.tipoConta === 'cac_individual') {
      return false;
    }
    return !acao.slug || temPermissao(acao.slug);
  });

  const handleAcao = (acao: any) => {
    if (acao.onClick) {
      acao.onClick();
    } else {
      navigate(acao.path, { state: { clientePreDefinido: cliente } });
    }
  };

  const handleDeletar = async () => {
    try {
      await deletarCliente(cliente.id);
      navigate('/clientes');
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      alert('Falha ao excluir o cliente. Verifique se existem registros vinculados.');
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          
          atualizarCliente(cliente.id, { fotoUrl: base64 })
            .then(() => {
              if (usuario?.tipoConta === 'cac_individual') {
                const dadosUsuario = localStorage.getItem('gcac_usuario');
                if (dadosUsuario) {
                  const u = JSON.parse(dadosUsuario);
                  u.fotoPerfil = base64;
                  localStorage.setItem('gcac_usuario', JSON.stringify(u));
                }
              }
              window.location.reload();
            })
            .catch(err => {
              console.error('Erro ao atualizar foto de perfil:', err);
              alert('Erro ao salvar a foto de perfil.');
            });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {usuario?.tipoConta !== 'cac_individual' && (
            <button 
              onClick={() => navigate('/clientes')}
              className="p-2 bg-brand-dark-3 border border-brand-dark-5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {cliente.nome}
            </h1>
            <p className="text-gray-400 text-sm">
              {usuario?.tipoConta === 'cac_individual' ? 'Meu Acervo & Documentação' : 'Perfil do Cliente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setEditando(true)}
            className="btn-ghost px-3 py-1.5 text-sm font-black uppercase tracking-wider flex items-center gap-2 border border-brand-dark-5"
          >
            <Pencil size={16} />
            Editar Cadastro
          </button>

          {/* Botão de convite para Portal CAC (apenas despachantes/empresa) */}
          {usuario?.tipoConta !== 'cac_individual' && (usuario?.role === 'admin' || temAcessoRecurso('modulo_clientes_cac')) && (
            <BotaoConvidarCac cliente={cliente} />
          )}
          
          {usuario?.tipoConta !== 'cac_individual' && (
            <button 
              onClick={() => setConfirmandoDelete(true)}
              className="btn-danger-soft px-3 py-1.5 text-sm font-black uppercase tracking-wider"
            >
              <Trash2 size={16} />
              Excluir Cliente
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Coluna Esquerda: Cadastro ── */}
        <div className="space-y-6">
          <div className="card border-brand-blue/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Informações Pessoais</span>
              <User size={16} className="text-brand-blue" />
            </div>

            <div className="space-y-4">
              {/* Foto de Perfil (Disponível apenas para CAC Individual) */}
              {usuario?.tipoConta === 'cac_individual' && (
                <div className="flex flex-col items-center justify-center pb-4 border-b border-brand-dark-5">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-blue/30 group-hover:border-brand-blue transition-all flex items-center justify-center bg-brand-dark-2">
                      {cliente.fotoUrl ? (
                        <img src={cliente.fotoUrl} alt={cliente.nome} className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-gray-600 group-hover:text-brand-blue-light transition-colors" />
                      )}
                    </div>
                    
                    <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider transition-opacity duration-200">
                      <Pencil size={14} className="mb-1" />
                      Alterar
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">Foto de Perfil</p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Nome Completo</p>
                <p className="text-white font-semibold text-lg">{cliente.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CPF</p>
                  <p className="text-white font-medium">{formatarCPF(cliente.cpf)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Telefone</p>
                  <p className="text-white font-medium">{formatarTelefone(cliente.contato)}</p>
                </div>
              </div>
              {cliente.email && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">E-mail</p>
                  <p className="text-white font-medium text-sm break-all">{cliente.email}</p>
                </div>
              )}
              {cliente.endereco && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Endereço</p>
                  <p className="text-white font-medium text-sm uppercase">{cliente.endereco}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                  Clube de Tiro e Caça Filiado
                </p>
                <p className="text-white font-medium uppercase text-sm">
                  {cliente.filiadoProTiro ? (
                    <span className="text-brand-green font-bold">
                      {usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE DE TIRO E CAÇA PRÓ TIRO'}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {cliente.clubeFiliado || 'NÃO FILIADO'}
                    </span>
                  )}
                </p>
              </div>

              {(cliente.numeroCr || cliente.vencimentoCr) && (
                <div className="pt-2 border-t border-brand-dark-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CR Exército / PF</p>
                    <p className="text-white font-medium">
                      {cliente.numeroCr || 'Não informado'} 
                      {cliente.vencimentoCr && <span className="text-gray-500 text-xs ml-2">({formatarData(cliente.vencimentoCr)})</span>}
                    </p>
                  </div>
                  {cliente.crUrl && (
                    <button 
                      onClick={() => visualizarDocumentoBase64(cliente.crUrl!, `CR-${cliente.numeroCr || 'exercito'}`)}
                      className="p-1.5 rounded-lg bg-brand-dark-3 text-brand-blue hover:text-brand-blue-light border border-brand-dark-5 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                      title="Visualizar CR Exército"
                    >
                      <FileText size={14} /> Ver Doc
                    </button>
                  )}
                </div>
              )}

              {(cliente.numeroCrIbama || cliente.vencimentoCrIbama) && (
                <div className="pt-2 border-t border-brand-dark-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CR IBAMA</p>
                    <p className="text-white font-medium">
                      {cliente.numeroCrIbama || 'Não informado'} 
                      {cliente.vencimentoCrIbama && <span className="text-gray-500 text-xs ml-2">({formatarData(cliente.vencimentoCrIbama)})</span>}
                    </p>
                  </div>
                  {cliente.crIbamaUrl && (
                    <button 
                      onClick={() => visualizarDocumentoBase64(cliente.crIbamaUrl!, `CR-IBAMA-${cliente.numeroCrIbama || 'ibama'}`)}
                      className="p-1.5 rounded-lg bg-brand-dark-3 text-brand-blue hover:text-brand-blue-light border border-brand-dark-5 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                      title="Visualizar CR IBAMA"
                    >
                      <FileText size={14} /> Ver Doc
                    </button>
                  )}
                </div>
              )}
              </div>
            </div>

            {cliente.observacoes && (
              <div className="card bg-brand-dark-3/50 border-brand-dark-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-brand-blue" />
                  <p className="text-xs text-white font-bold uppercase tracking-wider">Observações</p>
                </div>
                <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {cliente.observacoes}
                </p>
              </div>
            )}

            <div className="card bg-brand-dark-3/50 border-brand-dark-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-blue" />
                  <p className="text-xs text-white font-bold uppercase tracking-wider">Acesso GOV.BR</p>
                </div>
                <button 
                  onClick={() => handleCopiarSenha(cliente.senhaGov)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    copiou ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30'
                  }`}
                >
                  {copiou ? <Check size={12} /> : <Copy size={12} />}
                  {copiou ? 'Copiado!' : 'Copiar Senha'}
                </button>
              </div>
              <div className="bg-brand-dark-2 p-3 rounded-lg border border-brand-dark-5 font-mono text-xl text-brand-blue-light tracking-widest text-center">
                {cliente.senhaGov}
              </div>
            </div>
          </div>

        {/* ── Coluna Direita: Ações e Histórico ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ações Rápidas */}
          {acoesRapidas.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {acoesRapidas.map((acao) => (
                <button
                  key={acao.label}
                  onClick={() => handleAcao(acao)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg ${acao.color}`}
                >
                  <div className="mb-2">{acao.icon}</div>
                  <span className="text-[10px] font-black uppercase text-center leading-tight">{acao.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Histórico com Tabs */}
          <div className="card p-0 overflow-hidden border-brand-dark-5">
            <div className="flex bg-brand-dark-3 border-b border-brand-dark-5 overflow-x-auto">
              {tabsDisponiveis.map(tab => (
                <TabButton 
                  key={tab.id}
                  ativo={abaAtiva === tab.id} 
                  onClick={() => setAbaAtiva(tab.id as any)} 
                  count={tab.id === 'ordens' && !mostrarTodasOrdens ? ordensClienteAbertas.length : tab.count}
                >
                  {tab.label}
                </TabButton>
              ))}
            </div>

            <div className="p-4">
              {abaAtiva === 'ordens' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      {mostrarTodasOrdens ? 'Todas as Ordens' : 'Ordens em Aberto'}
                    </h3>
                    <button 
                      onClick={() => setMostrarTodasOrdens(!mostrarTodasOrdens)}
                      className="text-[10px] font-bold text-brand-blue hover:text-white transition-colors uppercase tracking-wider underline underline-offset-4"
                    >
                      {mostrarTodasOrdens ? 'Ver apenas abertas' : `Ver histórico completo (${todasOrdensCliente.length})`}
                    </button>
                  </div>
                  <HistoryList 
                    items={ordensExibidas.map(o => ({ 
                      id: o.id, 
                      title: `OS #${String(o.numero).padStart(4, '0')}`, 
                      date: o.criadoEm, 
                      value: o.valor, 
                      status: o.status,
                      path: `/ordens/${o.id}`
                    }))} 
                    emptyMsg={mostrarTodasOrdens ? "Nenhuma ordem de serviço encontrada para este cliente." : "Não há ordens de serviço em aberto para este cliente."}
                  />
                </div>
              )}
              {abaAtiva === 'orcamentos' && (
                <HistoryList 
                  items={orcamentosCliente.map(o => ({ 
                    id: o.id, 
                    title: `Orçamento #${String(o.numero).padStart(4, '0')}`, 
                    date: o.criadoEm, 
                    value: o.valorTotal, 
                    status: o.status,
                    path: `/orcamentos/${o.id}`
                  }))} 
                  emptyMsg="Nenhum orçamento encontrado para este cliente."
                />
              )}
              {abaAtiva === 'recibos' && (
                <HistoryList 
                  items={recibosCliente.map(r => ({ 
                    id: r.id, 
                    title: `Recibo #${String(r.numero).padStart(4, '0')}`, 
                    date: r.criadoEm, 
                    value: r.valorTotal, 
                    status: 'Pago',
                    path: `/recibos/${r.id}`
                  }))} 
                  emptyMsg="Nenhum recibo encontrado para este cliente."
                />
              )}
              {abaAtiva === 'agendamentos' && (
                <HistoryList 
                  items={agendamentosCliente.map(a => ({ 
                    id: a.id, 
                    title: `${a.tipo} - ${a.local}`, 
                    date: a.data, 
                    value: a.valor, 
                    status: a.confirmado ? 'Confirmado' : 'Pendente',
                    path: '/agendamentos'
                  }))} 
                  emptyMsg="Nenhum agendamento encontrado para este cliente."
                />
              )}
              {abaAtiva === 'documentos' && (
                <AbaDocumentacao 
                  cliente={cliente} 
                  armaIdInicial={(location.state as any)?.armaId}
                  cacEmpresaId={cacEmpresaId}
                />
              )}
              {abaAtiva === 'creditos' && (
                <div className="pt-2">
                  <AbaCreditos cliente={cliente} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalEscolhaWhatsApp 
        aberto={modalWhatsAppAberto}
        onFechar={() => setModalWhatsAppAberto(false)}
        telefone={cliente.contato}
        mensagem={`Olá, ${cliente.nome}!`}
      />

      <DialogConfirmacao
        aberto={confirmandoDelete}
        titulo="Excluir Cliente"
        mensagem={`Tem certeza que deseja excluir o cadastro de ${cliente.nome}? Esta ação apagará permanentemente os dados do cliente.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(false)}
      />

      {editando && (
        <FormularioCliente 
          clienteEditando={cliente}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}

function TabButton({ children, ativo, onClick, count }: { children: React.ReactNode, ativo: boolean, onClick: () => void, count: number }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 lg:px-4 py-4 text-[11px] lg:text-xs font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
        ativo ? 'text-brand-blue border-brand-blue bg-brand-blue/5' : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${ativo ? 'bg-brand-blue text-white' : 'bg-brand-dark-5 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function HistoryList({ items, emptyMsg }: { items: any[], emptyMsg: string }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-500 text-sm">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div 
          key={item.id} 
          onClick={() => navigate(item.path)}
          className="flex items-center justify-between p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-5 hover:border-brand-blue/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-dark-2 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{item.title}</p>
              <p className="text-[10px] text-gray-500">{formatarData(item.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-white">{formatarMoeda(item.value)}</p>
              <p className="text-[10px] text-brand-green font-bold uppercase tracking-widest">{item.status}</p>
            </div>
            <ChevronRight size={16} className="text-gray-600 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
