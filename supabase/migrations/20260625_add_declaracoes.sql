-- ==========================================================
-- MIGRAÇÃO: ADICIONAR CAMPOS DE DECLARAÇÕES E TABELA DE MODELOS
-- ==========================================================

-- 1. Alterar tabela public.clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS rg TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS nome_pai TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS nome_mae TEXT DEFAULT '';

-- 2. Criar tabela public.modelos_declaracao
CREATE TABLE IF NOT EXISTS public.modelos_declaracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL,
    empresa_id UUID NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Desativar RLS para modelos_declaracao
ALTER TABLE public.modelos_declaracao DISABLE ROW LEVEL SECURITY;
