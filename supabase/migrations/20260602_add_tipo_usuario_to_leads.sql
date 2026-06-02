-- ==========================================================
-- MIGRAÇÃO: ADICIONAR COLUNA TIPO_USUARIO EM LEADS
-- ==========================================================

ALTER TABLE public.leads_pre_cadastro 
ADD COLUMN IF NOT EXISTS tipo_usuario TEXT DEFAULT 'despachante';
