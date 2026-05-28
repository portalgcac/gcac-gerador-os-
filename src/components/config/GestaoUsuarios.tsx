import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, User, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronUp, Lock, Building, ArrowLeft, Settings2 } from 'lucide-react';
import { supabase } from '../../db/supabase';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { useAuth } from '../../context/AuthContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';

interface UsuarioAutorizado {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  contato: string | null;
  role: 'admin' | 'colaborador';
  ativo: boolean;
  permissoes: string[];
  empresa_id?: string;
}

const MODULOS = [
  { slug: 'painel', label: 'Painel / Dashboard' },
  { slug: 'rotina', label: 'Rotina Diária' },
  { slug: 'agenda', label: 'Agenda / Lembretes' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'orcamentos', label: 'Orçamentos' },
  { slug: 'ordens', label: 'Ordens de Serviço' },
  { slug: 'recibos', label: 'Recibos' },
  { slug: 'agendamentos', label: 'Agendamentos' },
  { slug: 'clientes', label: 'Meus Clientes' },
  { slug: 'config', label: 'Configurações' },
];

const RECURSOS_SISTEMA = [
  { key: 'dash_atencao_diaria', label: 'Dashboard — Resumo de Atenção Diária' },
  { key: 'dash_alertas_vencimento', label: 'Dashboard — Alertas de Vencimentos' },
  { key: 'dash_lembretes', label: 'Dashboard — Lembretes da Equipe' },
  { key: 'dash_resumo_os', label: 'Dashboard — Resumo de Ordens de Serviço' },
  { key: 'dash_margem_operacional', label: 'Dashboard — Margem de Operações e Lucros' },
  { key: 'dash_resumo_operacional', label: 'Dashboard — Resumo Operacional de Serviços' },
  { key: 'dash_resumo_orcamentos', label: 'Dashboard — Resumo de Orçamentos' },
  { key: 'dash_ordens_recentes', label: 'Dashboard — Listagem de Ordens de Serviço Recentes' },
  { key: 'fin_fluxo_caixa', label: 'Financeiro — Fluxo de Caixa e Lançamentos' },
  { key: 'fin_relatorio_equipe', label: 'Financeiro — Relatório de Produtividade da Equipe' },
  { key: 'fin_exportacao', label: 'Financeiro — Exportação de Relatórios Financeiros' },
  { key: 'modulo_ordens', label: 'Módulo Ordens de Serviço — Emissão e Controle de Ordens de Serviço' },
  { key: 'modulo_orcamentos', label: 'Módulo Orçamentos — Emissão e Controle de Orçamentos' },
  { key: 'modulo_recibos', label: 'Módulo Recibos — Emissão de Recibos de Pagamento' },
  { key: 'modulo_agendamentos', label: 'Módulo Agendamentos — Controle de Agendamentos e Calendário' },
  { key: 'modulo_clientes', label: 'Módulo Clientes — Cadastro e Gestão de Clientes' },
  { key: 'modulo_clientes_cac', label: 'Módulo Clientes CAC — Vinculação e Gestão de Atiradores/Colecionadores' },
  { key: 'acervo_anexos', label: 'Acervo — Armazenamento de Arquivos e Anexos nos Documentos' },
  { key: 'acervo_gerenciador', label: 'Acervo — Gerenciador de Clientes Vinculados' },
  // ── Configurações (seções internas) ──
  { key: 'config_alertas_vencimento', label: 'Configurações — Alertas de Prazos de Vencimento (CR, CRAF, GT, Manejo)' },
  { key: 'config_notificacoes_push', label: 'Configurações — Notificações Push no Celular' },
  { key: 'config_servicos', label: 'Configurações — Gerenciar Serviços e Taxas' },
  { key: 'config_manual', label: 'Configurações — Manual de Instruções' },
];

export function GestaoUsuarios() {
  const { usuario } = useAuth();
  const isMasterAdmin = usuario?.email === 'gui.gomesassis@gmail.com';

  // Sub-painel ativo para Master Admin
  const [subPainelAtivo, setSubPainelAtivo] = useState<'empresas' | 'cacs' | 'equipe_interna'>('empresas');
  
  // Empresa ativamente em edição/gestão pelo Master Admin
  const [empresaGerenciada, setEmpresaGerenciada] = useState<any | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { estado: notif, mostrar, fechar } = useNotificacao();

  // Empresas State (apenas para master admin)
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; tipo_conta?: string; limite_cac_vinculados?: number; recursos_liberados?: string[] }[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaTipo, setNovaEmpresaTipo] = useState<'empresa' | 'cac_individual'>('empresa');
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);
  
  const [empresaEditando, setEmpresaEditando] = useState<{ id: string; nome: string; tipo_conta: 'empresa' | 'cac_individual'; limite_cac_vinculados?: number; recursos_liberados: string[] } | null>(null);
  const [confirmandoDeleteEmpresa, setConfirmandoDeleteEmpresa] = useState<{ id: string; nome: string } | null>(null);
  
  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioAutorizado | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    contato: '',
    role: 'colaborador' as 'admin' | 'colaborador',
    permissoes: ['ordens'] as string[],
    empresa_id: '00000000-0000-0000-0000-000000000001'
  });

  const getRecursosDisponiveis = () => {
    return RECURSOS_SISTEMA;
  };

  const carregarEmpresas = async () => {
    if (!isMasterAdmin) return;
    setCarregandoEmpresas(true);
    const { data, error } = await supabase
      .from('empresas')
      .select('id, nome, tipo_conta, limite_cac_vinculados, recursos_liberados')
      .order('nome');
    if (!error && data) {
      setEmpresas(data);
    }
    setCarregandoEmpresas(false);
  };

  const carregarUsuarios = async () => {
    if (!usuario) return;
    setCarregando(true);
    let query = supabase
      .from('usuarios_autorizados')
      .select('*')
      .order('nome');

    if (!isMasterAdmin) {
      query = query.eq('empresa_id', usuario.empresaId);
    }

    const { data, error } = await query;
    
    if (error) {
      mostrar('erro', 'Erro ao carregar usuários.');
    } else {
      setUsuarios(data || []);
    }
    setCarregando(false);
  };

  useEffect(() => {
    if (usuario) {
      carregarUsuarios();
      if (isMasterAdmin) {
        carregarEmpresas();
      }
    }
  }, [usuario]);

  // Se o master admin atualizou a lista de empresas, sincroniza o estado de empresaGerenciada
  useEffect(() => {
    if (empresaGerenciada && empresas.length > 0) {
      const atual = empresas.find(e => e.id === empresaGerenciada.id);
      if (atual) {
        setEmpresaGerenciada(atual);
      }
    }
  }, [empresas, empresaGerenciada]);

  const handleAbrirModal = (user?: UsuarioAutorizado) => {
    if (user) {
      setEditando(user);
      setFormData({
        nome: user.nome,
        email: user.email,
        cpf: user.cpf || '',
        contato: user.contato || '',
        role: user.role,
        permissoes: user.permissoes,
        empresa_id: user.empresa_id || '00000000-0000-0000-0000-000000000001'
      });
    } else {
      let defaultEmpId = '00000000-0000-0000-0000-000000000001';
      if (!isMasterAdmin && usuario?.empresaId) {
        defaultEmpId = usuario.empresaId;
      } else if (empresaGerenciada) {
        defaultEmpId = empresaGerenciada.id;
      } else if (subPainelAtivo === 'equipe_interna') {
        defaultEmpId = '00000000-0000-0000-0000-000000000001';
      }

      setEditando(null);
      setFormData({
        nome: '',
        email: '',
        cpf: '',
        contato: '',
        role: 'colaborador',
        permissoes: ['ordens'],
        empresa_id: defaultEmpId
      });
    }
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let targetEmpresaId = formData.empresa_id;

      // Onboarding de CAC Individual criado manualmente pelo Master Admin
      if (isMasterAdmin && subPainelAtivo === 'cacs' && !editando) {
        const { data: novaEmp, error: errEmp } = await supabase
          .from('empresas')
          .insert([{
            nome: `CAC - ${formData.nome.toUpperCase()}`,
            tipo_conta: 'cac_individual',
            recursos_liberados: [
              'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes',
              'modulo_clientes', 'acervo_anexos', 'acervo_gerenciador'
            ]
          }])
          .select()
          .single();
        
        if (errEmp || !novaEmp) throw new Error(errEmp?.message || 'Erro ao criar tenant para CAC.');
        targetEmpresaId = novaEmp.id;
      } else if (isMasterAdmin && subPainelAtivo === 'equipe_interna') {
        targetEmpresaId = '00000000-0000-0000-0000-000000000001';
      } else if (isMasterAdmin && empresaGerenciada) {
        targetEmpresaId = empresaGerenciada.id;
      } else if (!isMasterAdmin && usuario?.empresaId) {
        targetEmpresaId = usuario.empresaId;
      }

      const payload: any = {
        nome: formData.nome,
        email: formData.email.trim().toLowerCase(),
        cpf: formData.cpf || null,
        contato: formData.contato || null,
        role: formData.role,
        permissoes: formData.permissoes,
        empresa_id: targetEmpresaId
      };

      if (editando) {
        const { error } = await supabase
          .from('usuarios_autorizados')
          .update(payload)
          .eq('id', editando.id);
        
        if (error) throw error;
        mostrar('sucesso', 'Usuário atualizado com sucesso.');
      } else {
        payload.ativo = true;
        const { error } = await supabase
          .from('usuarios_autorizados')
          .insert([payload]);
        
        if (error) throw error;
        mostrar('sucesso', 'Usuário cadastrado com sucesso.');
      }
      setModalAberto(false);
      carregarUsuarios();
      if (isMasterAdmin) {
        carregarEmpresas();
      }
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao realizar operação.');
    }
  };

  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaEmpresaNome.trim()) return;
    try {
      const { error } = await supabase
        .from('empresas')
        .insert([{ 
          nome: novaEmpresaNome.trim(),
          tipo_conta: novaEmpresaTipo
        }]);
      
      if (error) throw error;
      
      mostrar('sucesso', 'Empresa cadastrada com sucesso (Perfil: ' + (novaEmpresaTipo === 'empresa' ? 'Empresa Limpa' : 'CAC Individual') + ').');
      setNovaEmpresaNome('');
      setNovaEmpresaTipo('empresa');
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao cadastrar empresa.');
    }
  };

  const handleSalvarEdicaoEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaEditando || !empresaEditando.nome.trim()) return;
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome: empresaEditando.nome.trim(),
          tipo_conta: empresaEditando.tipo_conta,
          limite_cac_vinculados: empresaEditando.tipo_conta === 'empresa' ? (empresaEditando.limite_cac_vinculados || 10) : null,
          recursos_liberados: empresaEditando.recursos_liberados
        })
        .eq('id', empresaEditando.id);

      if (error) throw error;

      mostrar('sucesso', 'Empresa atualizada com sucesso.');
      setEmpresaEditando(null);
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao editar empresa.');
    }
  };

  const handleDeletarEmpresa = async () => {
    if (!confirmandoDeleteEmpresa) return;
    try {
      const { count, error: countError } = await supabase
        .from('usuarios_autorizados')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', confirmandoDeleteEmpresa.id);
      
      if (countError) throw countError;
      
      if (count && count > 0) {
        mostrar('erro', 'Não é possível excluir esta empresa pois existem usuários vinculados a ela.');
        setConfirmandoDeleteEmpresa(null);
        return;
      }

      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', confirmandoDeleteEmpresa.id);

      if (error) throw error;

      mostrar('sucesso', 'Empresa excluída com sucesso.');
      setConfirmandoDeleteEmpresa(null);
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao excluir empresa. Verifique se existem outros registros vinculados.');
      setConfirmandoDeleteEmpresa(null);
    }
  };

  const toggleStatus = async (user: UsuarioAutorizado) => {
    if (user.email === 'gui.gomesassis@gmail.com') {
      mostrar('aviso', 'O administrador mestre não pode ser desativado.');
      return;
    }

    const novoStatus = !user.ativo;
    const { error } = await supabase
      .from('usuarios_autorizados')
      .update({ ativo: novoStatus })
      .eq('id', user.id);
    
    if (error) {
      mostrar('erro', 'Erro ao alterar status.');
    } else {
      setUsuarios(usuarios.map(u => u.id === user.id ? { ...u, ativo: novoStatus } : u));
      mostrar('sucesso', `Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`);
    }
  };

  const togglePermissao = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(slug)
        ? prev.permissoes.filter(p => p !== slug)
        : [...prev.permissoes, slug]
    }));
  };

  // Filtros de dados com base na aba ou empresa ativa
  const empresasClientes = empresas.filter(e => e.tipo_conta === 'empresa' && e.id !== '00000000-0000-0000-0000-000000000001');
  
  const cacsUsuarios = usuarios.filter(u => {
    const emp = empresas.find(e => e.id === u.empresa_id);
    return emp?.tipo_conta === 'cac_individual';
  });

  const equipeInternaUsuarios = usuarios.filter(u => u.empresa_id === '00000000-0000-0000-0000-000000000001');

  const getUsuariosExibidos = () => {
    let baseLista: UsuarioAutorizado[] = [];
    if (!isMasterAdmin) {
      baseLista = usuarios;
    } else if (empresaGerenciada) {
      baseLista = usuarios.filter(u => u.empresa_id === empresaGerenciada.id);
    } else if (subPainelAtivo === 'cacs') {
      baseLista = cacsUsuarios;
    } else if (subPainelAtivo === 'equipe_interna') {
      baseLista = equipeInternaUsuarios;
    }
    
    const termo = buscaUsuario.toLowerCase().trim();
    if (!termo) return baseLista;
    return baseLista.filter(u => 
      (u.nome || '').toLowerCase().includes(termo) ||
      (u.email || '').toLowerCase().includes(termo) ||
      (u.cpf || '').toLowerCase().includes(termo)
    );
  };

  return (
    <div className="space-y-6">
      <Notificacao {...notif} onFechar={fechar} />

      {/* ──────────────── MASTER ADMIN PANEL ──────────────── */}
      {isMasterAdmin && (
        <div className="space-y-4">
          {/* Seletor de Perfis no topo (apenas se nenhuma empresa estiver sendo gerenciada no detalhe) */}
          {!empresaGerenciada && (
            <div className="flex flex-wrap gap-2 pb-4 border-b border-brand-dark-5">
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('empresas'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'empresas'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <Building size={14} />
                Usuários Empresa (B2B Tenants)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('cacs'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'cacs'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <User size={14} />
                Atiradores e Caçadores (CAC Individual)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('equipe_interna'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'equipe_interna'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <Shield size={14} />
                Equipe do Escritório (Staff)
              </button>
            </div>
          )}

          {/* ABA 1: GERENCIAMENTO GERAL DE EMPRESAS (Se nenhuma empresa específica estiver aberta) */}
          {subPainelAtivo === 'empresas' && !empresaGerenciada && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building size={16} className="text-brand-blue" />
                    Empresas & Clientes Contratantes (B2B)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Crie e configure workspaces para escritórios de despachantes externos</p>
                </div>
              </div>

              {/* Form Cadastro Empresa */}
              <form onSubmit={handleCriarEmpresa} className="flex flex-col sm:flex-row gap-2 max-w-xl bg-brand-dark-3/50 p-4 rounded-xl border border-brand-dark-5">
                <input
                  type="text"
                  required
                  placeholder="Nome do Novo Despachante / Empresa"
                  value={novaEmpresaNome}
                  onChange={e => setNovaEmpresaNome(e.target.value)}
                  className="input flex-1"
                />
                <select
                  value={novaEmpresaTipo}
                  onChange={e => setNovaEmpresaTipo(e.target.value as any)}
                  className="input sm:w-56"
                >
                  <option value="empresa" className="bg-brand-dark-2 text-white">Perfil Empresa (Banco Limpo)</option>
                  <option value="cac_individual" className="bg-brand-dark-2 text-white">Perfil CAC Individual</option>
                </select>
                <button type="submit" className="btn-primary px-4 shrink-0">
                  Criar Cadastro
                </button>
              </form>

              {/* Lista Empresas */}
              {carregandoEmpresas ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : empresasClientes.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">Nenhuma empresa B2B cadastrada.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-wider">Empresa (Tenant)</th>
                        <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-wider">Limite Contratado</th>
                        <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {empresasClientes.map(e => (
                        <tr key={e.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-sm">{e.nome}</p>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                B2B
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono select-all mt-0.5">{e.id}</p>
                          </td>
                          <td className="p-4 text-xs text-gray-300">
                            {e.limite_cac_vinculados ?? 10} Atiradores CAC
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEmpresaGerenciada(e)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-blue/10 border border-brand-blue/20 hover:bg-brand-blue/20 text-brand-blue-light text-xs font-bold uppercase tracking-wider transition-colors"
                              >
                                <Settings2 size={13} />
                                Gerenciar Empresa
                              </button>
                              <button 
                                onClick={() => setEmpresaEditando({
                                  id: e.id,
                                  nome: e.nome,
                                  tipo_conta: (e.tipo_conta || 'empresa') as any,
                                  limite_cac_vinculados: e.limite_cac_vinculados ?? 10,
                                  recursos_liberados: e.recursos_liberados || []
                                })}
                                className="p-2 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                                title="Editar Cadastro Básico"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => setConfirmandoDeleteEmpresa({ id: e.id, nome: e.nome })}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-brand-dark-3 rounded-xl transition-all"
                                title="Excluir Empresa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DETALHE DA EMPRESA GERENCIADA (Controles da Empresa + Colaboradores dela) */}
          {subPainelAtivo === 'empresas' && empresaGerenciada && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setEmpresaGerenciada(null)}
                  className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-400 hover:text-white transition-colors bg-brand-dark-3 px-3 py-1.5 rounded-xl border border-brand-dark-5"
                >
                  <ArrowLeft size={14} />
                  Voltar para Lista de Empresas
                </button>
                <div className="text-right">
                  <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <Building className="text-brand-blue" size={18} />
                    Gerenciando: {empresaGerenciada.nome}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lado Esquerdo: Configuração da Empresa */}
                <div className="card space-y-4 h-fit border border-brand-dark-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
                  <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Parâmetros do Workspace</span>
                    <Building size={14} className="text-brand-blue" />
                  </div>
                  
                  <form onSubmit={handleSalvarEdicaoEmpresa} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase">Nome do Despachante</label>
                      <input
                        type="text"
                        required
                        value={empresaGerenciada.nome}
                        onChange={e => setEmpresaGerenciada({ ...empresaGerenciada, nome: e.target.value })}
                        className="input text-sm w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase">Limite de CACs Vinculados</label>
                      <input
                        type="number"
                        min={1} max={1000}
                        required
                        value={empresaGerenciada.limite_cac_vinculados ?? 10}
                        onChange={e => setEmpresaGerenciada({ ...empresaGerenciada, limite_cac_vinculados: parseInt(e.target.value) || 10 })}
                        className="input text-sm w-full font-bold text-brand-blue-light"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-brand-dark-5">
                      <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
                        Ferramentas / Recursos Habilitados
                      </label>
                      <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {RECURSOS_SISTEMA.map(rec => {
                          const ativo = empresaGerenciada.recursos_liberados?.includes(rec.key);
                          return (
                            <button
                              key={rec.key}
                              type="button"
                              onClick={() => {
                                const novosRecursos = ativo
                                  ? (empresaGerenciada.recursos_liberados || []).filter((r: string) => r !== rec.key)
                                  : [...(empresaGerenciada.recursos_liberados || []), rec.key];
                                setEmpresaGerenciada({
                                  ...empresaGerenciada,
                                  recursos_liberados: novosRecursos
                                });
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition-all text-left ${
                                ativo
                                  ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                                  : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-gray-700'
                              }`}
                            >
                              <span className="break-words pr-3 leading-tight">{rec.label}</span>
                              {ativo ? (
                                <CheckCircle size={13} className="text-brand-green shrink-0 ml-1" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('empresas')
                            .update({
                              nome: empresaGerenciada.nome.trim(),
                              limite_cac_vinculados: empresaGerenciada.limite_cac_vinculados,
                              recursos_liberados: empresaGerenciada.recursos_liberados
                            })
                            .eq('id', empresaGerenciada.id);
                          if (error) throw error;
                          mostrar('sucesso', 'Configurações da empresa salvas com sucesso.');
                          carregarEmpresas();
                        } catch (err: any) {
                          mostrar('erro', err.message || 'Erro ao salvar alterações.');
                        }
                      }}
                      className="btn-primary w-full py-2.5 font-bold uppercase tracking-wider text-xs"
                    >
                      Salvar Alterações
                    </button>
                  </form>
                </div>

                {/* Lado Direito: Usuários vinculados a este Despachante */}
                <div className="lg:col-span-2 card space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Colaboradores & Acessos do Despachante</span>
                      <p className="text-xs text-gray-400 mt-0.5">Gerencie os funcionários que acessam o workspace deste cliente</p>
                    </div>
                    <button 
                      onClick={() => handleAbrirModal()} 
                      className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                    >
                      <UserPlus size={13} /> Adicionar Membro
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={buscaUsuario}
                      onChange={e => setBuscaUsuario(e.target.value)}
                      placeholder="Buscar por nome, e-mail ou CPF..."
                      className="input w-full text-xs"
                    />
                  </div>

                  {getUsuariosExibidos().length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-8">Nenhum funcionário cadastrado para esta empresa.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                      <table className="w-full text-left border-collapse min-w-[850px]">
                        <thead>
                          <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Usuário</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Função</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-dark-5">
                          {getUsuariosExibidos().map(u => (
                            <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                              <td className="p-3">
                                <p className="font-bold text-white text-sm">{u.nome}</p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                              </td>
                              <td className="p-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                                  u.role === 'admin' 
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                    : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                                }`}>
                                  {u.role === 'admin' ? 'Admin' : 'Colaborador'}
                                </span>
                              </td>
                              <td className="p-3 text-xs text-gray-300">
                                {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                                {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(u)}
                                  className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                                >
                                  <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                    {u.ativo ? 'Ativo' : 'Inativo'}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleAbrirModal(u)}
                                  className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                                  title="Editar Acessos"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: ATIRADORES E CAÇADORES (CAC INDIVIDUAL - B2C) */}
          {subPainelAtivo === 'cacs' && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <User size={16} className="text-brand-blue" />
                    Atiradores e Caçadores (CAC Individual)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Gerencie os usuários finais CPF que usam o portal de forma autônoma</p>
                </div>
                <button 
                  onClick={() => handleAbrirModal()} 
                  className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  <UserPlus size={13} /> Cadastrar CAC Manual
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar atirador por nome, e-mail ou CPF..."
                  className="input w-full text-xs"
                />
              </div>

              {getUsuariosExibidos().length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-8">Nenhum atirador ou caçador individual cadastrado no sistema.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Atirador / Caçador</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Vínculo de Sistema (ID Workspace)</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Contatos / CPF</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {getUsuariosExibidos().map(u => (
                        <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-white text-sm">{u.nome}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="p-3 text-xs font-mono text-gray-400">
                            {u.empresa_id ? (
                              <span className="bg-brand-dark-3 px-2 py-1 rounded text-xs select-all hover:text-white transition-colors animate-fade-in" title={u.empresa_id}>
                                {u.empresa_id.substring(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-gray-600 italic">Não Vinculado</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-gray-300">
                            {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                            {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                            >
                              <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleAbrirModal(u)}
                              className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                              title="Editar Atcessos"
                            >
                              <Edit2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: EQUIPE INTERNA DO ESCRITÓRIO MÃE (STAFF) */}
          {subPainelAtivo === 'equipe_interna' && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield size={16} className="text-brand-blue" />
                    Equipe do Escritório (Staff Interno)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Gerencie os colaboradores da matriz do G CAC Despachante Bélico</p>
                </div>
                <button 
                  onClick={() => handleAbrirModal()} 
                  className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  <UserPlus size={13} /> Novo Colaborador
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar colaborador por nome, e-mail ou CPF..."
                  className="input w-full text-xs"
                />
              </div>

              {getUsuariosExibidos().length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-8">Nenhum funcionário cadastrado no escritório central.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Colaborador</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Nível de Staff</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {getUsuariosExibidos().map(u => (
                        <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-white text-sm">{u.nome}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                              u.role === 'admin' 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                            }`}>
                              {u.role === 'admin' ? 'Admin Mestre' : 'Colaborador Matriz'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-300">
                            {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                            {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                            >
                              <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleAbrirModal(u)}
                              className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                              title="Editar Permissões"
                            >
                              <Edit2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────── CO-ADMIN (TENANT ADMIN) PANEL ──────────────── */}
      {!isMasterAdmin && (
        <div className="card space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-brand-blue" />
                Painel de Controle de Usuários
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Gerencie os colaboradores autorizados a acessar as informações da sua empresa</p>
            </div>
            <button 
              onClick={() => handleAbrirModal()} 
              className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
            >
              <UserPlus size={13} /> Adicionar Colaborador
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={buscaUsuario}
              onChange={e => setBuscaUsuario(e.target.value)}
              placeholder="Buscar colaborador por nome, e-mail ou CPF..."
              className="input w-full text-xs"
            />
          </div>

          {getUsuariosExibidos().length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-8">Nenhum colaborador cadastrado para esta empresa.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Usuário</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Função</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {getUsuariosExibidos().map(u => (
                    <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-white text-sm">{u.nome}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                      </td>
                      <td className="p-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                          u.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : 'Colaborador'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-300">
                        {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                        {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleStatus(u)}
                          className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                        >
                          <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleAbrirModal(u)}
                          className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                          title="Editar Acessos"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── MODAL CADASTRO/EDIÇÃO DE USUÁRIO ──────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-brand-blue" />
                {editando ? 'Editar Usuário' : 'Novo Usuário Autorizado'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">E-mail (Google)</label>
                  <input
                    type="email"
                    required
                    disabled={!!editando && editando.email === 'gui.gomesassis@gmail.com'}
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="email@gmail.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Contato</label>
                  <input
                    type="text"
                    value={formData.contato}
                    onChange={e => setFormData({ ...formData, contato: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Se for Master Admin e não houver empresa selecionada, nem for aba interna/CAC, exibe dropdown de Empresa */}
              {isMasterAdmin && !empresaGerenciada && subPainelAtivo === 'empresas' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Empresa (Tenant)</label>
                  <select
                    value={formData.empresa_id}
                    onChange={e => setFormData({ ...formData, empresa_id: e.target.value })}
                    className="input w-full text-sm"
                  >
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-brand-dark-2 text-white text-xs">
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Nível de Acesso</label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer group">
                    <input
                      type="radio"
                      className="hidden"
                      checked={formData.role === 'colaborador'}
                      onChange={() => setFormData({ ...formData, role: 'colaborador' })}
                    />
                    <div className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      formData.role === 'colaborador' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-dark-5 bg-brand-dark-4 hover:border-gray-700'
                    }`}>
                      <User size={18} className={formData.role === 'colaborador' ? 'text-brand-blue' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase ${formData.role === 'colaborador' ? 'text-white' : 'text-gray-500'}`}>Colaborador</span>
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer group">
                    <input
                      type="radio"
                      className="hidden"
                      checked={formData.role === 'admin'}
                      onChange={() => setFormData({ ...formData, role: 'admin' })}
                    />
                    <div className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      formData.role === 'admin' ? 'border-purple-500 bg-purple-500/5' : 'border-brand-dark-5 bg-brand-dark-4 hover:border-gray-700'
                    }`}>
                      <Shield size={18} className={formData.role === 'admin' ? 'text-purple-400' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase ${formData.role === 'admin' ? 'text-white' : 'text-gray-500'}`}>Administrador</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Módulos Permitidos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODULOS.map(m => (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => togglePermissao(m.slug)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes(m.slug)
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      {m.label}
                      {formData.permissoes.includes(m.slug) ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                  ))}
                </div>
              </div>

              {formData.role === 'colaborador' && (
                <div className="space-y-2 border-t border-brand-dark-5 pt-3">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Permissões Especiais</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => togglePermissao('fat_geral')}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes('fat_geral')
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      Ver Faturamento Geral
                      {formData.permissoes.includes('fat_geral') ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePermissao('excluir_registros')}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes('excluir_registros')
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      Excluir Registros (OS/Fin/etc.)
                      {formData.permissoes.includes('excluir_registros') ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-brand-dark-5 pt-3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Ferramentas / Recursos Liberados
                </label>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                  {getRecursosDisponiveis().map(rec => {
                    const ativo = formData.permissoes.includes(rec.key);
                    return (
                      <button
                        key={rec.key}
                        type="button"
                        onClick={() => {
                          const novasPermissoes = ativo
                            ? formData.permissoes.filter(p => p !== rec.key)
                            : [...formData.permissoes, rec.key];
                          setFormData({
                            ...formData,
                            permissoes: novasPermissoes
                          });
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all text-left ${
                          ativo
                            ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                            : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        <span className="break-words pr-4">{rec.label}</span>
                        {ativo ? (
                          <CheckCircle size={14} className="text-brand-green shrink-0 ml-1" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  {editando ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Empresa */}
      {empresaEditando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Building size={18} className="text-brand-blue" />
                Editar Informações da Empresa
              </h3>
              <button onClick={() => setEmpresaEditando(null)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoEmpresa} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={empresaEditando.nome}
                  onChange={e => setEmpresaEditando({ ...empresaEditando, nome: e.target.value })}
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Conta</label>
                <select
                  value={empresaEditando.tipo_conta}
                  onChange={e => setEmpresaEditando({ ...empresaEditando, tipo_conta: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="empresa" className="bg-brand-dark-2 text-white">Empresa/Despachante</option>
                  <option value="cac_individual" className="bg-brand-dark-2 text-white">CAC Individual</option>
                </select>
              </div>

              {empresaEditando.tipo_conta === 'empresa' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Limite de CACs Vinculados</label>
                  <input
                    type="number"
                    min={1} max={1000}
                    required
                    value={empresaEditando.limite_cac_vinculados ?? 10}
                    onChange={e => setEmpresaEditando({ ...empresaEditando, limite_cac_vinculados: parseInt(e.target.value) || 10 })}
                    className="input w-full"
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setEmpresaEditando(null)}
                  className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de Deletar Empresa */}
      <DialogConfirmacao
        aberto={!!confirmandoDeleteEmpresa}
        titulo="Excluir Empresa"
        mensagem={`Tem certeza que deseja excluir permanentemente a empresa "${confirmandoDeleteEmpresa?.nome}"? Esta ação não poderá ser desfeita e exigirá que não haja usuários associados.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletarEmpresa}
        onCancelar={() => setConfirmandoDeleteEmpresa(null)}
      />
    </div>
  );
}
