import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Trash2, Edit2, CheckCircle, Crown, Lock, Mail, Phone, FileText, AlertTriangle, UserCheck } from 'lucide-react';
import { supabase } from '../../db/supabase';
import { useAuth } from '../../context/AuthContext';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { formatarCPF } from '../../utils/formatters';

interface SocioItem {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  contato: string | null;
  cargo: string;
  ativo: boolean;
  ehGestorPrincipal: boolean;
  criadoEm?: string;
}

export function GestaoSociosPortal() {
  const { usuario, ehGestorPrincipal } = useAuth();
  const [socios, setSocios] = useState<SocioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [socioParaExcluir, setSocioParaExcluir] = useState<SocioItem | null>(null);
  const [editandoSocio, setEditandoSocio] = useState<SocioItem | null>(null);
  const { estado: notif, mostrar, fechar } = useNotificacao();

  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    contato: '',
    cargo: 'Sócio do App / Gestão de Operações'
  });

  const carregarSocios = async () => {
    setCarregando(true);
    try {
      // Busca usuários que tenham a flag/permissão de socio_portal ou e-mails específicos
      const { data, error } = await supabase
        .from('usuarios_autorizados')
        .select('*');

      if (error) throw error;

      const lista: SocioItem[] = [];

      // 1. Garante a inclusão do Gestor Principal (Guilherme)
      const guilhermeDb = data?.find(u => u.email?.trim().toLowerCase() === 'gui.gomesassis@gmail.com');
      lista.push({
        id: guilhermeDb?.id || 'master-guilherme',
        nome: guilhermeDb?.nome || 'Guilherme Gomes',
        email: 'gui.gomesassis@gmail.com',
        cpf: guilhermeDb?.cpf || '006.089.161-02',
        contato: guilhermeDb?.contato || '',
        cargo: 'Fundador & Gestor Principal',
        ativo: true,
        ehGestorPrincipal: true,
        criadoEm: guilhermeDb?.criado_em
      });

      // 2. Busca outros sócios cadastrados
      if (data) {
        data.forEach(u => {
          const emailLower = (u.email || '').trim().toLowerCase();
          if (emailLower === 'gui.gomesassis@gmail.com') return;

          const isSocio = 
            emailLower === 'hectoruk80@gmail.com' ||
            (u.permissoes && Array.isArray(u.permissoes) && u.permissoes.includes('socio_portal')) ||
            u.role === 'socio_portal';

          if (isSocio) {
            lista.push({
              id: u.id,
              nome: u.nome,
              email: u.email,
              cpf: u.cpf,
              contato: u.contato,
              cargo: emailLower === 'hectoruk80@gmail.com' ? 'Sócio do App / Gestão de Operações' : 'Sócio do App / Co-Administrador',
              ativo: !!u.ativo,
              ehGestorPrincipal: false,
              criadoEm: u.criado_em
            });
          }
        });
      }

      setSocios(lista);
    } catch (err: any) {
      console.error('Erro ao carregar sócios:', err);
      mostrar('erro', 'Erro ao buscar lista de sócios do Portal.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarSocios();
  }, []);

  const handleAbrirNovo = () => {
    setEditandoSocio(null);
    setForm({
      nome: '',
      email: '',
      cpf: '',
      contato: '',
      cargo: 'Sócio do App / Gestão de Operações'
    });
    setModalAberto(true);
  };

  const handlePreencherHector = () => {
    setForm({
      nome: 'Hector Henrique Furtado Meira',
      email: 'hectoruk80@gmail.com',
      cpf: '043.751.381-57',
      contato: '',
      cargo: 'Sócio do App / Gestão de Operações'
    });
  };

  const handleSalvarSocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ehGestorPrincipal) {
      mostrar('erro', 'Apenas o Gestor Principal pode adicionar ou editar sócios.');
      return;
    }

    const emailNorm = form.email.trim().toLowerCase();
    if (!emailNorm || !form.nome.trim()) {
      mostrar('erro', 'Nome e E-mail são obrigatórios.');
      return;
    }

    try {
      // 1. Verifica se o usuário já existe na base
      const { data: usuarioExistente } = await supabase
        .from('usuarios_autorizados')
        .select('*')
        .eq('email', emailNorm)
        .maybeSingle();

      const permsAtuais = (usuarioExistente?.permissoes as string[]) || ["ordens", "clientes", "painel"];
      const novasPermissoes = Array.from(new Set([...permsAtuais, 'socio_portal']));

      if (usuarioExistente) {
        // Atualiza para incluir socio_portal
        const { error: updErr } = await supabase
          .from('usuarios_autorizados')
          .update({
            nome: form.nome.trim(),
            cpf: form.cpf.trim() || usuarioExistente.cpf,
            contato: form.contato.trim() || usuarioExistente.contato,
            role: 'admin',
            ativo: true,
            permissoes: novasPermissoes,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', usuarioExistente.id);

        if (updErr) throw updErr;
      } else {
        // Cria novo registro de usuário autorizado
        const { error: insErr } = await supabase
          .from('usuarios_autorizados')
          .insert([{
            nome: form.nome.trim(),
            email: emailNorm,
            cpf: form.cpf.trim() || null,
            contato: form.contato.trim() || null,
            role: 'admin',
            ativo: true,
            permissoes: novasPermissoes,
            empresa_id: '00000000-0000-0000-0000-000000000001'
          }]);

        if (insErr) throw insErr;
      }

      mostrar('sucesso', `Sócio ${form.nome} salvo com sucesso no Portal G CAC!`);
      setModalAberto(false);
      carregarSocios();
    } catch (err: any) {
      console.error('Erro ao salvar sócio:', err);
      mostrar('erro', err.message || 'Erro ao registrar sócio.');
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!socioParaExcluir || !ehGestorPrincipal) return;

    if (socioParaExcluir.ehGestorPrincipal) {
      mostrar('erro', 'O Gestor Principal não pode ser removido do sistema.');
      setSocioParaExcluir(null);
      return;
    }

    try {
      // Remove a permissão socio_portal do usuário no banco
      const { data: user } = await supabase
        .from('usuarios_autorizados')
        .select('permissoes')
        .eq('id', socioParaExcluir.id)
        .single();

      if (user) {
        const permsFiltradas = (user.permissoes || []).filter((p: string) => p !== 'socio_portal');
        const { error } = await supabase
          .from('usuarios_autorizados')
          .update({
            permissoes: permsFiltradas,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', socioParaExcluir.id);

        if (error) throw error;
      }

      mostrar('sucesso', `Acesso de sócio removido para ${socioParaExcluir.nome}.`);
      setSocioParaExcluir(null);
      carregarSocios();
    } catch (err: any) {
      console.error('Erro ao excluir sócio:', err);
      mostrar('erro', err.message || 'Erro ao remover sócio.');
    }
  };

  return (
    <div className="space-y-6">
      <Notificacao {...notif} onFechar={fechar} />

      {/* Header do Módulo de Sócios */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-dark-3 p-5 rounded-2xl border border-brand-dark-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Shield size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Quadro Societário & Gestores do Portal G CAC
              </h2>
              <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Software House
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Gestão de sócios e co-administradores da plataforma SaaS. Controle exclusivo do Gestor Principal.
            </p>
          </div>
        </div>

        {ehGestorPrincipal && (
          <button
            type="button"
            onClick={handleAbrirNovo}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shrink-0 bg-purple-600 hover:bg-purple-500 shadow-purple-900/30 shadow-lg border-purple-400/30"
          >
            <UserPlus size={16} />
            + Adicionar Sócio do App
          </button>
        )}
      </div>

      {/* Card Informativo de Governança */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-3">
        <Crown size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 space-y-1">
          <p className="font-bold text-white">Regra de Governança & Segurança:</p>
          <p className="text-gray-400 leading-relaxed">
            Os sócios cadastrados nesta área têm acesso à gestão de licenças, assinaturas de despachantes do Brasil, faturamento SaaS e suporte da plataforma. 
            A inclusão ou revogação de acessos de sócios é uma prerrogativa exclusiva e irrevogável do <strong>Gestor Principal (Guilherme Gomes)</strong>.
          </p>
        </div>
      </div>

      {/* Listagem de Sócios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {carregando ? (
          <div className="col-span-2 text-center py-12 text-gray-400">
            Carregando quadro societário...
          </div>
        ) : (
          socios.map(s => (
            <div
              key={s.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                s.ehGestorPrincipal
                  ? 'bg-gradient-to-br from-brand-dark-3 to-purple-950/30 border-amber-500/30 shadow-lg'
                  : 'bg-brand-dark-3 border-brand-dark-5 hover:border-brand-dark-4'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                        s.ehGestorPrincipal
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                      }`}
                    >
                      {s.ehGestorPrincipal ? <Crown size={18} /> : <UserCheck size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-sm">{s.nome}</h3>
                        {s.ehGestorPrincipal && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Gestor Principal
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-purple-300/80 font-semibold">{s.cargo}</p>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                    <CheckCircle size={10} /> Ativo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-300 pt-2 border-t border-brand-dark-5/60">
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-gray-500 shrink-0" />
                    <span className="text-gray-400 font-mono text-[11px]">{s.email}</span>
                  </div>
                  {s.cpf && (
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-gray-500 shrink-0" />
                      <span className="text-gray-400 font-mono text-[11px]">{formatarCPF(s.cpf)}</span>
                    </div>
                  )}
                  {s.contato && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-gray-500 shrink-0" />
                      <span className="text-gray-400 text-[11px]">{s.contato}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-brand-dark-5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">
                  {s.ehGestorPrincipal ? 'Titular Vitalício da Plataforma' : 'Acesso de Gestão do App'}
                </span>

                {ehGestorPrincipal && !s.ehGestorPrincipal && (
                  <button
                    type="button"
                    onClick={() => setSocioParaExcluir(s)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs flex items-center gap-1 font-semibold"
                    title="Remover acesso de sócio"
                  >
                    <Trash2 size={14} />
                    <span>Remover</span>
                  </button>
                )}

                {s.ehGestorPrincipal && (
                  <span className="text-[10px] text-amber-400/80 font-bold flex items-center gap-1">
                    <Lock size={11} /> Protegido
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Adicionar / Convidar Sócio */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md bg-brand-dark-2 border border-brand-dark-5 p-6 rounded-2xl shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-brand-dark-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Adicionar Sócio do Portal G CAC</h3>
                  <p className="text-[11px] text-gray-400">Liberar permissões de sócio na gestão do SaaS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Atalho Rápido Hector */}
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
              <span className="text-xs text-purple-300 font-semibold">Atalho rápido para novo sócio:</span>
              <button
                type="button"
                onClick={handlePreencherHector}
                className="text-xs bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 font-bold px-2.5 py-1 rounded-lg transition-all"
              >
                Preencher Dados Hector
              </button>
            </div>

            <form onSubmit={handleSalvarSocio} className="space-y-3">
              <div>
                <label className="label text-xs">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hector Henrique Furtado Meira"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">E-mail Google (Acesso)</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: hectoruk80@gmail.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={e => setForm({ ...form, cpf: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label text-xs">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={form.contato}
                    onChange={e => setForm({ ...form, contato: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Função / Cargo no Portal</label>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={e => setForm({ ...form, cargo: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="btn-ghost flex-1 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 text-xs font-bold bg-purple-600 hover:bg-purple-500"
                >
                  Salvar Sócio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de Exclusão de Sócio */}
      {socioParaExcluir && (
        <DialogConfirmacao
          aberto={!!socioParaExcluir}
          titulo="Revogar Acesso de Sócio"
          mensagem={`Tem certeza que deseja revogar o acesso de sócio do Portal G CAC de ${socioParaExcluir.nome}? Ele deixará de acessar o ambiente de gestão do aplicativo.`}
          textoBotaoConfirmar="Sim, Revogar Acesso"
          textoBotaoCancelar="Cancelar"
          onConfirmar={handleConfirmarExclusao}
          onCancelar={() => setSocioParaExcluir(null)}
          tipo="perigo"
        />
      )}
    </div>
  );
}
