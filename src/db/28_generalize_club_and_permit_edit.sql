-- ============================================================================
-- SCRIPT DE MIGRAÇÃO: GENERALIZAÇÃO DO CLUBE PARCEIRO E PERMISSÃO DE ESCRITA CAC
-- ============================================================================

-- 1. Adicionar colunas de perfil e configuração na tabela de empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS clube_parceiro_padrao TEXT DEFAULT 'CLUBE DE TIRO E CAÇA PRÓ TIRO',
ADD COLUMN IF NOT EXISTS razao_social_fantasia TEXT DEFAULT 'GCAC Despachante Bélico',
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT DEFAULT 'Guilherme Gomes',
ADD COLUMN IF NOT EXISTS contato_telefone TEXT DEFAULT '(64) 9.9995-9865',
ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT 'Av. Goias, n 1802, Sala 04 - Bairro Santa Maria - Jatai-GO',
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Adicionar colunas de permissão de escrita e consentimento na tabela de vínculos
ALTER TABLE public.vinculos_despachante_cac
ADD COLUMN IF NOT EXISTS permite_edicao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS termo_aceito_texto TEXT,
ADD COLUMN IF NOT EXISTS autorizado_edicao_em TIMESTAMPTZ;

-- 3. Atualizar a empresa padrão (GCAC) para manter os dados existentes consistentes
UPDATE public.empresas
SET 
  clube_parceiro_padrao = 'CLUBE DE TIRO E CAÇA PRÓ TIRO (JATAÍ)',
  razao_social_fantasia = 'GCAC Despachante Bélico',
  responsavel_nome = 'Guilherme Gomes',
  contato_telefone = '(64) 9.9995-9865',
  endereco = 'Av. Goias, n 1802, Sala 04 - Bairro Santa Maria - Jatai-GO'
WHERE id = '00000000-0000-0000-0000-000000000001';
