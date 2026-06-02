-- ==========================================================
-- MIGRAÇÃO: DESATIVAR RLS PARA EMPRESAS E USUÁRIOS AUTORIZADOS
-- ==========================================================
-- Como o portal conecta ao Supabase usando a chave anônima no frontend,
-- a leitura das tabelas de configuração da empresa e validação de permissões
-- falha se o RLS estiver ativado nessas tabelas sem políticas públicas.
-- Desativar o RLS garante que o frontend consiga ler os dados corretamente.

ALTER TABLE public.empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_autorizados DISABLE ROW LEVEL SECURITY;
