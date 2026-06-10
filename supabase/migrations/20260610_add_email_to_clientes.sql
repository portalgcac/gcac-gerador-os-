-- ==========================================================
-- MIGRAÇÃO: ADICIONAR COLUNA EMAIL EM CLIENTES
-- ==========================================================

ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
