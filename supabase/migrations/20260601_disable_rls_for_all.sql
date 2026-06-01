-- ==========================================================
-- MIGRAÇÃO: DESATIVAR RLS PARA TABELAS OPERACIONAIS
-- ==========================================================
-- Como o portal utiliza login do Google no frontend e realiza 
-- as consultas via chave anônima (sem autenticação nativa do Supabase Auth),
-- as tabelas precisam ter o RLS desativado para permitir escrita/leitura.

ALTER TABLE public.armas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guias_trafego DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.autorizacoes_manejo DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos_despachante_cac DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
