-- ==========================================================
-- SCRIPT DE MIGRAÇÃO: ADIÇÃO DE TIPO DE CONTA PARA EMPRESAS
-- ==========================================================

-- 1. Adicionar coluna tipo_conta na tabela empresas com check constraint
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tipo_conta TEXT DEFAULT 'empresa' CHECK (tipo_conta IN ('empresa', 'cac_individual'));

-- 2. Adicionar coluna modulos_ativos para controle detalhado de features
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS modulos_ativos JSONB DEFAULT '["painel", "agenda", "clientes", "ordens", "config"]'::jsonb;

-- 3. Garantir que os registros existentes com tipo_conta nulo sejam definidos como 'empresa'
UPDATE public.empresas SET tipo_conta = 'empresa' WHERE tipo_conta IS NULL;
UPDATE public.empresas SET modulos_ativos = '["painel", "agenda", "clientes", "ordens", "config"]'::jsonb WHERE modulos_ativos IS NULL;
