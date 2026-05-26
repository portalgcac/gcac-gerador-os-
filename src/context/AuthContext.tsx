import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UsuarioGoogle } from '../types';
import { supabase } from '../db/supabase';

interface AuthContextType {
  usuario: UsuarioGoogle | null;
  estaAutenticado: boolean;
  estaCarregando: boolean;
  login: (tokenResponse: { access_token: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioGoogle | null>(null);
  const [estaCarregando, setEstaCarregando] = useState(true);

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

        // --- Atualização de Permissões em Background ---
        const atualizarPermissoes = async () => {
          try {
            const emailLower = u.email.trim().toLowerCase();
            const ehMasterAdmin = emailLower === 'gui.gomesassis@gmail.com';

            const { data, error } = await supabase
              .from('usuarios_autorizados')
              .select('role, permissoes, ativo, empresa_id, cpf, contato')
              .eq('email', emailLower)
              .single();

            if (error || !data || !data.ativo) {
              if (!ehMasterAdmin) {
                // Se o usuário foi desativado ou removido, desloga ele
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
            if (rawEmpresaId) {
              const { data: empData } = await supabase
                .from('empresas')
                .select('nome, tipo_conta, modulos_ativos')
                .eq('id', rawEmpresaId)
                .single();
              if (empData) {
                rawEmpresaNome = empData.nome;
                tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
                modulosAtivos = empData.modulos_ativos || [];
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
              contato: data?.contato || undefined
            };
            
            // Só atualiza se houver mudança real para evitar loops/re-renders desnecessários
            if (
              JSON.stringify(u.permissoes) !== JSON.stringify(permissoes) || 
              u.role !== role ||
              u.empresaId !== (rawEmpresaId || undefined) ||
              u.empresaNome !== rawEmpresaNome ||
              u.tipoConta !== tipoConta ||
              JSON.stringify(u.modulosAtivos) !== JSON.stringify(modulosAtivos) ||
              u.fotoPerfil !== fotoPerfil
            ) {
              setUsuario(usuarioAtualizado);
              localStorage.setItem('gcac_usuario', JSON.stringify(usuarioAtualizado));
            }
          } catch (err) {
            console.error('Erro ao atualizar permissões em background:', err);
          }
        };

        atualizarPermissoes();
      } catch {
        localStorage.removeItem('gcac_usuario');
      }
    }
    setEstaCarregando(false);
  }, []);

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
      if (rawEmpresaId) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('nome, tipo_conta, modulos_ativos')
          .eq('id', rawEmpresaId)
          .single();
        if (empData) {
          rawEmpresaNome = empData.nome;
          tipoConta = (empData.tipo_conta || 'empresa') as 'empresa' | 'cac_individual';
          modulosAtivos = empData.modulos_ativos || [];
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
        contato: whitelistData?.contato || undefined
      };

      setUsuario(novoUsuario);
      localStorage.setItem('gcac_usuario', JSON.stringify(novoUsuario));
      sessionStorage.setItem('gcac_token', tokenResponse.access_token);
    } catch (err) {
      console.error('Erro ao buscar dados do usuário:', err);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('gcac_usuario');
    sessionStorage.removeItem('gcac_token');
  }, []);

  return (
    <AuthContext.Provider value={{
      usuario,
      estaAutenticado: !!usuario,
      estaCarregando,
      login,
      logout,
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
