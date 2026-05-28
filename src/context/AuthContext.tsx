import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UsuarioGoogle } from '../types';
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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioGoogle | null>(null);
  const [estaCarregando, setEstaCarregando] = useState(true);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('gcac_usuario');
    sessionStorage.removeItem('gcac_token');
  }, []);

  const refreshUsuario = useCallback(async () => {
    const dados = localStorage.getItem('gcac_usuario');
    if (!dados) return;
    try {
      const u = JSON.parse(dados) as UsuarioGoogle;
      const emailLower = u.email.trim().toLowerCase();
      const ehMasterAdmin = emailLower === 'gui.gomesassis@gmail.com';

      const { data, error } = await supabase
        .from('usuarios_autorizados')
        .select('role, permissoes, ativo, empresa_id, cpf, contato')
        .eq('email', emailLower)
        .single();

      if (error || !data || !data.ativo) {
        if (!ehMasterAdmin) {
          logout();
          return;
        }
      }

      const rawRole = data?.role;
      const rawEmpresaId = data?.empresa_id || (ehMasterAdmin ? '00000000-0000-0000-0000-000000000001' : null);
      const role = ((ehMasterAdmin || rawRole === 'admin') ? 'admin' : 'colaborador') as 'admin' | 'colaborador';
      const permissoes = (ehMasterAdmin 
        ? ["painel", "rotina", "agenda", "financeiro", "orcamentos", "ordens", "recibos", "agendamentos", "clientes", "config"]
        : (data?.permissoes || ["ordens"])) as string[];

      let rawEmpresaNome = u.empresaNome || 'GCAC Principal';
      let tipoConta: 'empresa' | 'cac_individual' = u.tipoConta || 'empresa';
      let modulosAtivos: string[] = u.modulosAtivos || [];
      let fotoPerfil = u.fotoPerfil;
      let dadosEmpresa: any = u.dadosEmpresa || null;
      if (rawEmpresaId) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('nome, tipo_conta, modulos_ativos, clube_parceiro_padrao, razao_social_fantasia, responsavel_nome, contato_telefone, endereco, cnpj, recursos_liberados')
          .eq('id', rawEmpresaId)
          .single();
        if (empData) {
          rawEmpresaNome = empData.nome;
          tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
          modulosAtivos = empData.modulos_ativos || [];
          dadosEmpresa = {
            id: rawEmpresaId,
            nome: empData.nome,
            tipoConta,
            clubeParceiroPadrao: empData.clube_parceiro_padrao,
            razaoSocialFantasia: empData.razao_social_fantasia,
            responsavelNome: empData.responsavel_nome,
            contatoTelefone: empData.contato_telefone,
            endereco: empData.endereco,
            cnpj: empData.cnpj,
            recursosLiberados: empData.recursos_liberados || []
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

      const usuarioAtualizado = { 
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
        dadosEmpresa
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
        JSON.stringify(u.dadosEmpresa) !== JSON.stringify(dadosEmpresa)
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
  }, [refreshUsuario]);

  const login = useCallback(async (tokenResponse: { access_token: string }) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const info = await res.json();
      const emailLower = info.email.trim().toLowerCase();

      // 1. Busca na Whitelist do Banco de Dados
      const { data: whitelistData, error: whitelistError } = await supabase
        .from('usuarios_autorizados')
        .select('*')
        .eq('email', emailLower)
        .eq('ativo', true)
        .single();

      // 2. Cadeado de segurança para Administrador Mestre (Fallback)
      const ehMasterAdmin = emailLower === 'gui.gomesassis@gmail.com';

      if (!ehMasterAdmin && (whitelistError || !whitelistData)) {
        throw new Error('ACESSO_REJEITADO');
      }

      const rawRole = whitelistData?.role;
      const rawEmpresaId = whitelistData?.empresa_id || (ehMasterAdmin ? '00000000-0000-0000-0000-000000000001' : null);
      const role = ((ehMasterAdmin || rawRole === 'admin') ? 'admin' : 'colaborador') as 'admin' | 'colaborador';
      const permissoes = (ehMasterAdmin 
        ? ["painel", "rotina", "agenda", "financeiro", "orcamentos", "ordens", "recibos", "agendamentos", "clientes", "config"]
        : (whitelistData?.permissoes || ["ordens"])) as string[];

      let rawEmpresaNome = 'GCAC Principal';
      let tipoConta: 'empresa' | 'cac_individual' = 'empresa';
      let modulosAtivos: string[] = [];
      let fotoPerfil = info.picture;
      let dadosEmpresa: any = null;
      if (rawEmpresaId) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('nome, tipo_conta, modulos_ativos, clube_parceiro_padrao, razao_social_fantasia, responsavel_nome, contato_telefone, endereco, cnpj, recursos_liberados')
          .eq('id', rawEmpresaId)
          .single();
        if (empData) {
          rawEmpresaNome = empData.nome;
          tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
          modulosAtivos = empData.modulos_ativos || [];
          dadosEmpresa = {
            id: rawEmpresaId,
            nome: empData.nome,
            tipoConta,
            clubeParceiroPadrao: empData.clube_parceiro_padrao,
            razaoSocialFantasia: empData.razao_social_fantasia,
            responsavelNome: empData.responsavel_nome,
            contatoTelefone: empData.contato_telefone,
            endereco: empData.endereco,
            cnpj: empData.cnpj,
            recursosLiberados: empData.recursos_liberados || []
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

      const novoUsuario: UsuarioGoogle = {
        id: info.sub,
        nome: info.name,
        email: info.email,
        fotoPerfil,
        accessToken: tokenResponse.access_token,
        role,
        permissoes,
        empresaId: rawEmpresaId || undefined,
        empresaNome: rawEmpresaNome,
        tipoConta,
        modulosAtivos,
        cpf: whitelistData?.cpf || undefined,
        contato: whitelistData?.contato || undefined,
        dadosEmpresa
      };

      setUsuario(novoUsuario);
      localStorage.setItem('gcac_usuario', JSON.stringify(novoUsuario));
      sessionStorage.setItem('gcac_token', tokenResponse.access_token);

      // Registra o acesso no banco (para estatísticas do painel admin)
      registrarAcesso(novoUsuario.email).catch(() => {});
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err);
      throw err;
    }
  }, []);

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
      'modulo_clientes_cac', 'acervo_anexos', 'acervo_gerenciador'
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
      temAcessoRecurso
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
