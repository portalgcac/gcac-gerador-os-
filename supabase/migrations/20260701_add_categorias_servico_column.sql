-- ==========================================================
-- MIGRAÇÃO: ADICIONAR COLUNA CATEGORIAS_SERVICO NA TABELA EMPRESAS
-- ==========================================================

-- 1. Alterar tabela public.empresas para adicionar a coluna categorias_servico com os padrões
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS categorias_servico JSONB DEFAULT '[{"id": "honorario", "nome": "Honorário", "calculaComoServico": true}, {"id": "laudo", "nome": "Laudo", "calculaComoServico": false}]'::jsonb;

-- 2. Atualizar as empresas existentes que estão com valor nulo para o padrão
UPDATE public.empresas 
SET categorias_servico = '[{"id": "honorario", "nome": "Honorário", "calculaComoServico": true}, {"id": "laudo", "nome": "Laudo", "calculaComoServico": false}]'::jsonb
WHERE categorias_servico IS NULL;
