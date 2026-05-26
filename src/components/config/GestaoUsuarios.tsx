import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, User, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronUp, Lock, Building } from 'lucide-react';
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

export function GestaoUsuarios() {
  const { usuario } = useAuth();
  const isMasterAdmin = usuario?.email === 'gui.gomesassis@gmail.com';

  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { estado: notif, mostrar, fechar } = useNotificacao();

  // Empresas State (only for master admin)
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; tipo_conta?: string }[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaTipo, setNovaEmpresaTipo] = useState<'empresa' | 'cac_individual'>('empresa');
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);
  const [mostrarGerenciarEmpresas, setMostrarGerenciarEmpresas] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<{ id: string; nome: string; tipo_conta: 'empresa' | 'cac_individual' } | null>(null);
  const [confirmandoDeleteEmpresa, setConfirmandoDeleteEmpresa] = useState<{ id: string; nome: string } | null>(null);
  
  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioAutorizado | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    contato: '',
    role: 'colaborador' as 'admin' | 'colaborador',
    permissoes: ['ordens'] as string[],
    empresa_id: '00000000-0000-0000-0000-000000000001'
  });

  const carregarEmpresas = async () => {
    if (!isMasterAdmin) return;
    setCarregandoEmpresas(true);
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
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
      setEditando(null);
      setFormData({
        nome: '',
        email: '',
        cpf: '',
        contato: '',
        role: 'colaborador',
        permissoes: ['ordens'],
        empresa_id: '00000000-0000-0000-0000-000000000001'
      });
    }
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nome: formData.nome,
        email: formData.email.trim().toLowerCase(),
        cpf: formData.cpf || null,
        contato: formData.contato || null,
        role: formData.role,
        permissoes: formData.permissoes
      };

      if (isMasterAdmin) {
        payload.empresa_id = formData.empresa_id;
      } else if (usuario?.empresaId) {
        payload.empresa_id = usuario.empresaId;
      }

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
      
      mostrar('sucesso', 'Empresa cadastrada com sucesso.');
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
          tipo_conta: empresaEditando.tipo_conta
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

  return (
    <div className="space-y-4">
      <Notificacao {...notif} onFechar={fechar} />

      {isMasterAdmin && (
        <div className="card space-y-4">
          <button 
            type="button"
            onClick={() => setMostrarGerenciarEmpresas(!mostrarGerenciarEmpresas)}
            className="w-full flex items-center justify-between text-sm font-bold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Building size={16} className="text-brand-blue" />
              Gerenciamento de Empresas (Tenants)
            </span>
            {mostrarGerenciarEmpresas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {mostrarGerenciarEmpresas && (
            <div className="space-y-4 pt-2 border-t border-brand-dark-5">
              <form onSubmit={handleCriarEmpresa} className="flex flex-col sm:flex-row gap-2 max-w-xl">
                <input
                  type="text"
                  required
                  placeholder="Nome da Nova Empresa/Cliente"
                  value={novaEmpresaNome}
                  onChange={e => setNovaEmpresaNome(e.target.value)}
                  className="input flex-1"
                />
                <select
                  value={novaEmpresaTipo}
                  onChange={e => setNovaEmpresaTipo(e.target.value as any)}
                  className="input sm:w-48"
                >
                  <option value="empresa" className="bg-brand-dark-2 text-white">Empresa/Despachante</option>
                  <option value="cac_individual" className="bg-brand-dark-2 text-white">CAC Individual</option>
                </select>
                <button type="submit" className="btn-primary px-4 shrink-0">
                  Criar Empresa
                </button>
              </form>

              {carregandoEmpresas ? (
                <div className="text-center py-4">
                  <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : empresas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma empresa cadastrada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {empresas.map(e => (
                    <div key={e.id} className="p-3 bg-brand-dark-4 border border-brand-dark-5 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">{e.nome}</p>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            e.tipo_conta === 'cac_individual' 
                              ? 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20' 
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {e.tipo_conta === 'cac_individual' ? 'CAC' : 'B2B'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono select-all mt-1">{e.id}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEmpresaEditando({ id: e.id, nome: e.nome, tipo_conta: (e.tipo_conta || 'empresa') as any })}
                          className="p-1.5 text-gray-400 hover:text-brand-blue-light rounded-lg hover:bg-brand-dark-3 transition-colors"
                          title="Editar Empresa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => setConfirmandoDeleteEmpresa({ id: e.id, nome: e.nome })}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-brand-dark-3 transition-colors"
                          title="Excluir Empresa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Lock size={14} />
            E-mails de Liberação e Acessos
          </h2>
          <button onClick={() => handleAbrirModal()} className="btn-primary btn-sm px-3">
            <UserPlus size={14} /> Novo Usuário
          </button>
        </div>

        {carregando ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-8 bg-brand-dark-4 border border-brand-dark-5 rounded-xl">
            <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500 text-xs uppercase bg-brand-dark-3/50">
                <tr>
                  <th className="px-3 py-2 font-bold">Usuário / E-mail</th>
                  <th className="px-3 py-2 font-bold">Nível</th>
                  {isMasterAdmin && <th className="px-3 py-2 font-bold">Empresa</th>}
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-brand-dark-4 transition-colors">
                    <td className="px-3 py-3">
                      <p className="font-bold text-white text-sm">{u.nome}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                         : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                      }`}>
                        {u.role === 'admin' ? 'Administrador' : 'Colaborador'}
                      </span>
                    </td>
                    {isMasterAdmin && (
                      <td className="px-3 py-3 text-sm text-gray-300 font-medium">
                        {empresas.find(e => e.id === u.empresa_id)?.nome || 'GCAC Principal'}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <button 
                        onClick={() => toggleStatus(u)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                          u.ativo ? 'text-brand-green hover:text-brand-green-light' : 'text-red-400 hover:text-red-300'
                        }`}
                      >
                        {u.ativo ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => handleAbrirModal(u)} className="p-1.5 text-gray-400 hover:text-brand-blue-light">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                    className="input"
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
                    className="input"
                    placeholder="email@gmail.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Contato</label>
                  <input
                    type="text"
                    value={formData.contato}
                    onChange={e => setFormData({ ...formData, contato: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {isMasterAdmin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Empresa (Tenant)</label>
                  <select
                    value={formData.empresa_id}
                    onChange={e => setFormData({ ...formData, empresa_id: e.target.value })}
                    className="input w-full"
                  >
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-brand-dark-2 text-white">
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

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="btn-ghost flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center"
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
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Building size={18} className="text-brand-blue" />
                Editar Empresa (Tenant)
              </h3>
              <button onClick={() => setEmpresaEditando(null)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoEmpresa} className="p-6 space-y-4">
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

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEmpresaEditando(null)}
                  className="btn-ghost flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center"
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
        titulo="Excluir Empresa (Tenant)"
        mensagem={`Tem certeza que deseja excluir permanentemente a empresa "${confirmandoDeleteEmpresa?.nome}"? Esta ação não poderá ser desfeita.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletarEmpresa}
        onCancelar={() => setConfirmandoDeleteEmpresa(null)}
      />
    </div>
  );
}
