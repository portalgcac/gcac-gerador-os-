import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UsuarioGoogle, ContextoAtivo } from '../types';
import { supabase } from '../db/supabase';
import { registrarAcesso } from '../services/adminCacService';

interface AuthContextType {
  usuario: UsuarioGoogle | null;
  estaAutenticado: boolean;
  estaCarregando: boolean;
  login: (tokenResponse: { access_token: string }) => Promise<void>;
  logout: () => void;
  refreshUsuario: () => Promise<void>;
  temAcessoRecurso: (recurso: string) => boolean;
  contextoAtivo: ContextoAtivo;
  setContextoAtivo: (ctx: ContextoAtivo) => void;
  ehGestorPrincipal: boolean;
  ehSocioPortal: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioGoogle | null>(null);
  const [estaCarregando, setEstaCarregando] = useState(true);
  const [contextoAtivo, setContextoAtivoState] = useState<ContextoAtivo>(() => {
    const salvo = localStorage.getItem('gcac_contexto_ativo') as ContextoAtivo | null;
    return salvo === 'portal_saas' ? 'portal_saas' : 'escritorio';
  });

  const setContextoAtivo = useCallback((ctx: ContextoAtivo) => {
    setContextoAtivoState(ctx);
    localStorage.setItem('gcac_contexto_ativo', ctx);
    setUsuario(prev => prev ? { ...prev, contextoAtivo: ctx } : null);
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('gcac_usuario');
    sessionStorage.removeItem('gcac_token');
    supabase.auth.signOut().catch(() => {});
  }, []);

  const refreshUsuario = useCallback(async () => {
    const dados = localStorage.getItem('gcac_usuario');
    if (!dados) return;
    try {
      const u = JSON.parse(dados) as UsuarioGoogle;
      const emailLower = u.email.trim().toLowerCase();
      const ehMasterAdmin = emailLower === 'gui.gomesassis@gmail.com';

      console.log('[DEBUG Auth] refreshUsuario starting for:', emailLower);
      const { data, error } = await supabase
        .from('usuarios_autorizados')
        .select('role, permissoes, ativo, empresa_id, cpf, contato')
        .eq('email', emailLower)
        .single();

      if (error) {
        console.error('[DEBUG Auth] refreshUsuario error fetching user auth:', error);
        // Não desloga o usuário em caso de erros transitórios de rede ou banco de dados
        return;
      } else {
        console.log('[DEBUG Auth] refreshUsuario user auth success:', data);
      }

      if (!data || !data.ativo) {
        if (!ehMasterAdmin) {
          logout();
          return;
        }
      }

      const rawRole = data?.role;
      const rawEmpresaId = data?.empresa_id || (ehMasterAdmin ? '00000000-0000-0000-0000-000000000001' : null);
      const role = ((ehMasterAdmin || rawRole === 'admin') ? 'admin' : 'colaborador') as 'admin' | 'colaborador';
      const permissoes = (ehMasterAdmin 
        ? ["painel", "rotina", "agenda", "financeiro", "orcamentos", "ordens", "recibos", "agendamentos", "clientes", "relatorios", "config"]
        : (data?.permissoes || ["ordens"])) as string[];

      let rawEmpresaNome = u.empresaNome || 'GCAC Principal';
      let tipoConta: 'empresa' | 'cac_individual' = u.tipoConta || 'empresa';
      let modulosAtivos: string[] = u.modulosAtivos || [];
      let fotoPerfil = u.fotoPerfil;
      let dadosEmpresa: any = u.dadosEmpresa || null;
      if (rawEmpresaId) {
        console.log('[DEBUG Auth] refreshUsuario fetching company for ID:', rawEmpresaId);
        const { data: empData, error: empError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', rawEmpresaId)
          .single();
        if (empError) {
          console.error('[DEBUG Auth] refreshUsuario error fetching company:', empError);
        } else {
          console.log('[DEBUG Auth] refreshUsuario company success:', empData);
        }
        if (empData) {
          rawEmpresaNome = empData.nome;
          tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
          modulosAtivos = empData.modulos_ativos || [];

          const dbAlertaCr = empData.alerta_cr !== null && empData.alerta_cr !== undefined ? Number(empData.alerta_cr) : 60;
          const dbAlertaCraf = empData.alerta_craf !== null && empData.alerta_craf !== undefined ? Number(empData.alerta_craf) : 60;
          const dbAlertaGt = empData.alerta_gt !== null && empData.alerta_gt !== undefined ? Number(empData.alerta_gt) : 20;
          const dbAlertaManejo = empData.alerta_manejo !== null && empData.alerta_manejo !== undefined ? Number(empData.alerta_manejo) : 7;
          const dbAlertaCrIbama = empData.alerta_ibama_cr !== null && empData.alerta_ibama_cr !== undefined ? Number(empData.alerta_ibama_cr) : 30;
          const dbOcultarIbama = empData.ocultar_ibama !== null && empData.ocultar_ibama !== undefined ? Boolean(empData.ocultar_ibama) : false;

          // Autocorreção de migração: Se no dispositivo atual o usuário já tinha valores diferentes configurados localmente
          // e no banco de dados os valores ainda forem os padrões de fábrica (ou seja, primeira migração deste tenant),
          // fazemos o upload automático das configurações locais do dispositivo para o banco para sincronizar.
          let needsDbUpdate = false;
          const updates: any = {};

          const localCr = localStorage.getItem('config_alerta_cr');
          if (localCr && Number(localCr) !== dbAlertaCr && dbAlertaCr === 60) {
            updates.alerta_cr = Number(localCr);
            needsDbUpdate = true;
          }
          const localCraf = localStorage.getItem('config_alerta_craf');
          if (localCraf && Number(localCraf) !== dbAlertaCraf && dbAlertaCraf === 60) {
            updates.alerta_craf = Number(localCraf);
            needsDbUpdate = true;
          }
          const localGt = localStorage.getItem('config_alerta_gt');
          if (localGt && Number(localGt) !== dbAlertaGt && dbAlertaGt === 20) {
            updates.alerta_gt = Number(localGt);
            needsDbUpdate = true;
          }
          const localManejo = localStorage.getItem('config_alerta_manejo');
          if (localManejo && Number(localManejo) !== dbAlertaManejo && dbAlertaManejo === 7) {
            updates.alerta_manejo = Number(localManejo);
            needsDbUpdate = true;
          }
          const localCrIbama = localStorage.getItem('config_alerta_ibama_cr');
          if (localCrIbama && Number(localCrIbama) !== dbAlertaCrIbama && dbAlertaCrIbama === 30) {
            updates.alerta_ibama_cr = Number(localCrIbama);
            needsDbUpdate = true;
          }
          const localOcultar = localStorage.getItem('config_ocultar_ibama');
          if (localOcultar && (localOcultar === 'true') !== dbOcultarIbama && dbOcultarIbama === false) {
            updates.ocultar_ibama = localOcultar === 'true';
            needsDbUpdate = true;
          }

          if (needsDbUpdate && rawEmpresaId) {
            console.log('[DEBUG Auth] Sincronizando valores customizados do localStorage com o banco de dados:', updates);
            supabase
              .from('empresas')
              .update(updates)
              .eq('id', rawEmpresaId)
              .then(({ error }) => {
                if (error) console.error('[DEBUG Auth] Erro ao sincronizar configurações locais com o banco:', error);
              });

            dadosEmpresa = {
              id: rawEmpresaId,
              nome: empData.nome,
              tipoConta,
              clubeParceiroPadrao: empData.clube_parceiro_padrao,
              categoriasServico: empData.categorias_servico || undefined,
              razaoSocialFantasia: empData.razao_social_fantasia,
              responsavelNome: empData.responsavel_nome,
              contatoTelefone: empData.contato_telefone,
              endereco: empData.endereco,
              cnpj: empData.cnpj,
              recursosLiberados: empData.recursos_liberados || [],
              logoUrl: empData.logo_url || undefined,
              mensagemAlertaCraf: empData.mensagem_alerta_craf,
              plano: empData.plano,
              planoStatus: empData.plano_status,
              frequenciaPagamento: empData.frequencia_pagamento,
              dataVencimento: empData.data_vencimento,
              taxaImplementacaoPaga: empData.taxa_implementacao_paga,
              valorImplementacao: empData.valor_implementacao ? Number(empData.valor_implementacao) : undefined,
              valorAssinaturaPersonalizado: empData.valor_assinatura_personalizado ? Number(empData.valor_assinatura_personalizado) : undefined,
              isGratis: empData.is_gratis,
              limiteUsuariosStaff: empData.limite_usuarios_staff,
              alertaCr: updates.alerta_cr !== undefined ? updates.alerta_cr : dbAlertaCr,
              alertaCraf: updates.alerta_craf !== undefined ? updates.alerta_craf : dbAlertaCraf,
              alertaGt: updates.alerta_gt !== undefined ? updates.alerta_gt : dbAlertaGt,
              alertaManejo: updates.alerta_manejo !== undefined ? updates.alerta_manejo : dbAlertaManejo,
              alertaCrIbama: updates.alerta_ibama_cr !== undefined ? updates.alerta_ibama_cr : dbAlertaCrIbama,
              ocultarIbama: updates.ocultar_ibama !== undefined ? updates.ocultar_ibama : dbOcultarIbama
            };
          } else {
            dadosEmpresa = {
              id: rawEmpresaId,
              nome: empData.nome,
              tipoConta,
              clubeParceiroPadrao: empData.clube_parceiro_padrao,
              categoriasServico: empData.categorias_servico || undefined,
              razaoSocialFantasia: empData.razao_social_fantasia,
              responsavelNome: empData.responsavel_nome,
              contatoTelefone: empData.contato_telefone,
              endereco: empData.endereco,
              cnpj: empData.cnpj,
              recursosLiberados: empData.recursos_liberados || [],
              logoUrl: empData.logo_url || undefined,
              mensagemAlertaCraf: empData.mensagem_alerta_craf,
              plano: empData.plano,
              planoStatus: empData.plano_status,
              frequenciaPagamento: empData.frequencia_pagamento,
              dataVencimento: empData.data_vencimento,
              taxaImplementacaoPaga: empData.taxa_implementacao_paga,
              valorImplementacao: empData.valor_implementacao ? Number(empData.valor_implementacao) : undefined,
              valorAssinaturaPersonalizado: empData.valor_assinatura_personalizado ? Number(empData.valor_assinatura_personalizado) : undefined,
              isGratis: empData.is_gratis,
              limiteUsuariosStaff: empData.limite_usuarios_staff,
              alertaCr: dbAlertaCr,
              alertaCraf: dbAlertaCraf,
              alertaGt: dbAlertaGt,
              alertaManejo: dbAlertaManejo,
              alertaCrIbama: dbAlertaCrIbama,
              ocultarIbama: dbOcultarIbama
            };
          }

          // Sincroniza com o localStorage para que utilitários de vencimentos consumam instantaneamente
          localStorage.setItem('config_alerta_cr', String(dadosEmpresa.alertaCr));
          localStorage.setItem('config_alerta_craf', String(dadosEmpresa.alertaCraf));
          localStorage.setItem('config_alerta_gt', String(dadosEmpresa.alertaGt));
          localStorage.setItem('config_alerta_manejo', String(dadosEmpresa.alertaManejo));
          localStorage.setItem('config_alerta_ibama_cr', String(dadosEmpresa.alertaCrIbama));
          localStorage.setItem('config_ocultar_ibama', String(dadosEmpresa.ocultarIbama));
        }

        if (tipoConta === 'cac_individual') {
          const { data: clientData } = await supabase
            .from('clientes')
            .select('foto_url')
            .eq('empresa_id', rawEmpresaId)
            .limit(1)
            .maybeSingle();
          if (clientData?.foto_url) {
            fotoPerfil = clientData.foto_url;
          }
        }
      }

      const ehSocio = ehMasterAdmin || 
        (data?.permissoes?.includes('socio_portal') ?? false) || 
        data?.role === 'socio_portal' || 
        emailLower === 'hectoruk80@gmail.com';

      const usuarioAtualizado: UsuarioGoogle = { 
        ...u, 
        role, 
        permissoes, 
        empresaId: rawEmpresaId || undefined,
        empresaNome: rawEmpresaNome,
        tipoConta,
        modulosAtivos,
        fotoPerfil,
        cpf: data?.cpf || undefined,
        contato: data?.contato || undefined,
        dadosEmpresa,
        ehGestorPrincipal: ehMasterAdmin,
        ehSocioPortal: ehSocio,
        contextoAtivo: ehSocio ? contextoAtivo : 'escritorio'
      };
      
      // Só atualiza se houver mudança real para evitar loops/re-renders desnecessários
      if (
        JSON.stringify(u.permissoes) !== JSON.stringify(permissoes) || 
        u.role !== role ||
        u.empresaId !== (rawEmpresaId || undefined) ||
        u.empresaNome !== rawEmpresaNome ||
        u.tipoConta !== tipoConta ||
        JSON.stringify(u.modulosAtivos) !== JSON.stringify(modulosAtivos) ||
        u.fotoPerfil !== fotoPerfil ||
        JSON.stringify(u.dadosEmpresa) !== JSON.stringify(dadosEmpresa) ||
        u.ehGestorPrincipal !== ehMasterAdmin ||
        u.ehSocioPortal !== ehSocio ||
        u.contextoAtivo !== (ehSocio ? contextoAtivo : 'escritorio')
      ) {
        setUsuario(usuarioAtualizado);
        localStorage.setItem('gcac_usuario', JSON.stringify(usuarioAtualizado));
      }
      // Registra o último acesso (não-bloqueante)
      registrarAcesso(u.email).catch(() => {});
    } catch (err) {
      console.error('Erro ao atualizar permissões em background:', err);
    }
  }, [logout]);

  useEffect(() => {
    // 1. Carrega dados do usuário do localStorage se existirem
    const dados = localStorage.getItem('gcac_usuario');
    if (dados) {
      try {
        const u = JSON.parse(dados) as UsuarioGoogle;
        setUsuario(u);
        
        // Recupera o token para o sessionStorage
        if (u.accessToken) {
          sessionStorage.setItem('gcac_token', u.accessToken);
        }

        refreshUsuario();
      } catch {
        localStorage.removeItem('gcac_usuario');
      }
    }
    setEstaCarregando(false);

    // 2. Escuta mudanças de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DEBUG Auth] onAuthStateChange event:', event, 'session:', session);
      if (session) {
        const emailLower = session.user.email?.trim().toLowerCase();
        if (!emailLower) {
          setEstaCarregando(false);
          return;
        }

        // Processa login/recarga se for login inicial, recarga de token, sessão inicial ou se não tiver dados salvos
        if (
          event === 'SIGNED_IN' || 
          event === 'TOKEN_REFRESHED' || 
          event === 'INITIAL_SESSION' || 
          !localStorage.getItem('gcac_usuario')
        ) {
          setTimeout(() => {
            loginComSessaoSupabase(session).catch((err: any) => {
              console.error('[DEBUG Auth] Erro no processamento de sessão do Supabase:', err);
            });
          }, 0);
        }
      } else {
        if (event === 'SIGNED_OUT') {
          setUsuario(null);
          localStorage.removeItem('gcac_usuario');
          sessionStorage.removeItem('gcac_token');
        }
      }
      setEstaCarregando(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUsuario]);

  const loginComSessaoSupabase = useCallback(async (session: any) => {
    try {
      const emailLower = session.user.email.trim().toLowerCase();
      const meta = session.user.user_metadata;

      // 1. Busca na Whitelist do Banco de Dados
      console.log('[DEBUG Auth] loginComSessaoSupabase starting for:', emailLower);
      const { data: whitelistData, error: whitelistError } = await supabase
        .from('usuarios_autorizados')
        .select('*')
        .eq('email', emailLower)
        .eq('ativo', true)
        .single();

      if (whitelistError) {
        console.error('[DEBUG Auth] loginComSessaoSupabase whitelistError:', whitelistError);
      } else {
        console.log('[DEBUG Auth] loginComSessaoSupabase whitelist success:', whitelistData);
      }

      // 2. Cadeado de segurança para Administrador Mestre (Fallback)
      const ehMasterAdmin = emailLower === 'gui.gomesassis@gmail.com';

      if (!ehMasterAdmin && (whitelistError || !whitelistData)) {
        await supabase.auth.signOut();
        throw new Error('ACESSO_REJEITADO');
      }

      const rawRole = whitelistData?.role;
      const rawEmpresaId = whitelistData?.empresa_id || (ehMasterAdmin ? '00000000-0000-0000-0000-000000000001' : null);
      const role = ((ehMasterAdmin || rawRole === 'admin') ? 'admin' : 'colaborador') as 'admin' | 'colaborador';
      const permissoes = (ehMasterAdmin 
        ? ["painel", "rotina", "agenda", "financeiro", "orcamentos", "ordens", "recibos", "agendamentos", "clientes", "relatorios", "config"]
        : (whitelistData?.permissoes || ["ordens"])) as string[];

      let rawEmpresaNome = 'GCAC Principal';
      let tipoConta: 'empresa' | 'cac_individual' = 'empresa';
      let modulosAtivos: string[] = [];
      let fotoPerfil = meta.avatar_url || meta.picture || '';
      let dadosEmpresa: any = null;

      if (rawEmpresaId) {
        console.log('[DEBUG Auth] loginComSessaoSupabase fetching company for ID:', rawEmpresaId);
        const { data: empData, error: empError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', rawEmpresaId)
          .single();
        if (empError) {
          console.error('[DEBUG Auth] loginComSessaoSupabase empError:', empError);
        } else {
          console.log('[DEBUG Auth] loginComSessaoSupabase company success:', empData);
        }
        if (empData) {
          rawEmpresaNome = empData.nome;
          tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
          modulosAtivos = empData.modulos_ativos || [];
          dadosEmpresa = {
            id: rawEmpresaId,
            nome: empData.nome,
            tipoConta,
            clubeParceiroPadrao: empData.clube_parceiro_padrao,
            categoriasServico: empData.categorias_servico || undefined,
            razaoSocialFantasia: empData.razao_social_fantasia,
            responsavelNome: empData.responsavel_nome,
            contatoTelefone: empData.contato_telefone,
            endereco: empData.endereco,
            cnpj: empData.cnpj,
            recursosLiberados: empData.recursos_liberados || [],
            logoUrl: empData.logo_url || undefined,
            mensagemAlertaCraf: empData.mensagem_alerta_craf,
            plano: empData.plano,
            planoStatus: empData.plano_status,
            frequenciaPagamento: empData.frequencia_pagamento,
            dataVencimento: empData.data_vencimento,
            taxaImplementacaoPaga: empData.taxa_implementacao_paga,
            valorImplementacao: empData.valor_implementacao ? Number(empData.valor_implementacao) : undefined,
            valorAssinaturaPersonalizado: empData.valor_assinatura_personalizado ? Number(empData.valor_assinatura_personalizado) : undefined,
            isGratis: empData.is_gratis,
            limiteUsuariosStaff: empData.limite_usuarios_staff
          };
        }

        if (tipoConta === 'cac_individual') {
          const { data: clientData } = await supabase
            .from('clientes')
            .select('foto_url')
            .eq('empresa_id', rawEmpresaId)
            .limit(1)
            .maybeSingle();
          if (clientData?.foto_url) {
            fotoPerfil = clientData.foto_url;
          }
        }
      }

      // Google OAuth access token is in session.provider_token
      const googleAccessToken = session.provider_token || sessionStorage.getItem('gcac_token') || '';

      const ehSocio = ehMasterAdmin || 
        (whitelistData?.permissoes?.includes('socio_portal') ?? false) || 
        whitelistData?.role === 'socio_portal' || 
        emailLower === 'hectoruk80@gmail.com';

      const novoUsuario: UsuarioGoogle = {
        id: meta.sub || session.user.id,
        nome: meta.name || meta.full_name || '',
        email: emailLower,
        fotoPerfil,
        accessToken: googleAccessToken,
        role,
        permissoes,
        empresaId: rawEmpresaId || undefined,
        empresaNome: rawEmpresaNome,
        tipoConta,
        modulosAtivos,
        cpf: whitelistData?.cpf || undefined,
        contato: whitelistData?.contato || undefined,
        dadosEmpresa,
        ehGestorPrincipal: ehMasterAdmin,
        ehSocioPortal: ehSocio,
        contextoAtivo: ehSocio ? contextoAtivo : 'escritorio'
      };

      setUsuario(novoUsuario);
      localStorage.setItem('gcac_usuario', JSON.stringify(novoUsuario));
      if (googleAccessToken) {
        sessionStorage.setItem('gcac_token', googleAccessToken);
      }

      // Registra o acesso no banco (para estatísticas do painel admin)
      registrarAcesso(novoUsuario.email).catch(() => {});
    } catch (err) {
      console.error('Erro no loginComSessaoSupabase:', err);
      throw err;
    }
  }, []);

  const login = useCallback(async (session: any) => {
    await loginComSessaoSupabase(session);
  }, [loginComSessaoSupabase]);

  // We can delete the duplicate logout declaration at the end since we moved it to the top.

  const temAcessoRecurso = useCallback((recurso: string): boolean => {
    if (!usuario) return false;
    // Administrador mestre tem acesso total a tudo
    if (usuario.email === 'gui.gomesassis@gmail.com') return true;

    // CAC Individual tem acesso total aos recursos do acervo
    if (usuario.tipoConta === 'cac_individual') return true;

    // Contas de empresa dependem das permissões do tenant (recursosLiberados)
    const recursosTenant = usuario.dadosEmpresa?.recursosLiberados || [];
    if (!recursosTenant.includes(recurso)) return false;

    const userPerms = usuario.permissoes || [];

    // Se o usuário tem alguma das chaves de recursos do sistema em seu array de permissões,
    // significa que ele foi personalizado de forma granular. Portanto, validamos estritamente.
    const chavesRecursosSistema = [
      'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes', 'dash_resumo_os',
      'dash_margem_operacional', 'dash_resumo_operacional', 'dash_resumo_orcamentos', 'dash_ordens_recentes',
      'fin_fluxo_caixa', 'fin_relatorio_equipe', 'fin_exportacao',
      'modulo_ordens', 'modulo_orcamentos', 'modulo_recibos', 'modulo_agendamentos', 'modulo_clientes',
      'modulo_clientes_cac', 'acervo_anexos', 'acervo_gerenciador',
      'config_alertas_vencimento', 'config_notificacoes_push', 'config_servicos', 'config_manual'
    ];
    
    const temCustomizacaoGranular = userPerms.some(p => chavesRecursosSistema.includes(p));

    if (temCustomizacaoGranular) {
      return userPerms.includes(recurso);
    }

    // Caso contrário, usamos a regra de retrocompatibilidade baseada no papel ou nos módulos padrão
    if (usuario.role === 'admin') return true;

    // Mapeamento de retrocompatibilidade para colaboradores legados
    if (recurso.startsWith('fin_') && userPerms.includes('financeiro')) return true;
    if (recurso.startsWith('dash_') && userPerms.includes('painel')) return true;
    if (recurso === 'modulo_ordens' && userPerms.includes('ordens')) return true;
    if (recurso === 'modulo_orcamentos' && userPerms.includes('orcamentos')) return true;
    if (recurso === 'modulo_recibos' && userPerms.includes('recibos')) return true;
    if (recurso === 'modulo_agendamentos' && userPerms.includes('agendamentos')) return true;
    if (recurso === 'modulo_clientes' && userPerms.includes('clientes')) return true;
    if (recurso === 'modulo_clientes_cac' && userPerms.includes('clientes')) return true;
    if (recurso.startsWith('acervo_') && userPerms.includes('clientes')) return true;
    // Retrocompatibilidade: colaboradores com módulo 'config' legado veem todas as seções
    if (recurso.startsWith('config_') && userPerms.includes('config')) return true;

    return false;
  }, [usuario]);

  return (
    <AuthContext.Provider value={{
      usuario,
      estaAutenticado: !!usuario,
      estaCarregando,
      login,
      logout,
      refreshUsuario,
      temAcessoRecurso,
      contextoAtivo: usuario?.ehSocioPortal ? contextoAtivo : 'escritorio',
      setContextoAtivo,
      ehGestorPrincipal: !!usuario?.ehGestorPrincipal,
      ehSocioPortal: !!usuario?.ehSocioPortal
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem('gcac_token');
}
