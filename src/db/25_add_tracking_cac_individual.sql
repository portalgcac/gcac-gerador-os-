-- ==========================================================
-- SCRIPT DE MIGRAÇÃO: TRACKING DE USUÁRIOS CAC INDIVIDUAL
-- ==========================================================
-- Adiciona campos de monitoramento de atividade na tabela de usuários autorizados.
-- Esses dados alimentam o Painel de Gestão de Atiradores do Admin GCAC Principal.

-- 1. Data e hora do último acesso ao portal
ALTER TABLE public.usuarios_autorizados
ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ DEFAULT NULL;

-- 2. Indica se o usuário concluiu (ou pulou) o tutorial de onboarding
ALTER TABLE public.usuarios_autorizados
ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN DEFAULT FALSE;

-- 3. Contagem total de exportações (PDF, Excel, JSON) realizadas pelo usuário
ALTER TABLE public.usuarios_autorizados
ADD COLUMN IF NOT EXISTS total_exportacoes INTEGER DEFAULT 0;

-- 4. Indexar ultimo_acesso para consultas de usuários inativos serem mais rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acesso
ON public.usuarios_autorizados (ultimo_acesso DESC);
