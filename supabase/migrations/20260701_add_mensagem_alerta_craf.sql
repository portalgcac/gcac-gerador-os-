-- ==========================================================
-- MIGRAÇÃO: ADICIONAR COLUNA MENSAGEM_ALERTA_CRAF NA TABELA EMPRESAS
-- ==========================================================

-- 1. Alterar tabela public.empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS mensagem_alerta_craf TEXT;
