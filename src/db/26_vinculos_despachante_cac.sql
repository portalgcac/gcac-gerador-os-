-- ==========================================================
-- MIGRAÇÃO: SISTEMA DE VÍNCULO DESPACHANTE ↔ CAC INDIVIDUAL
-- ==========================================================

-- 1. Tabela principal de vínculos
CREATE TABLE IF NOT EXISTS public.vinculos_despachante_cac (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Despachante que solicita o vínculo
    despachante_empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    despachante_nome TEXT NOT NULL,

    -- CAC Individual que é vinculado
    cac_empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cac_email TEXT NOT NULL,
    cac_nome TEXT NOT NULL,
    cac_cpf TEXT,  -- cache do CPF para facilitar busca

    -- Status do vínculo
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'ativo', 'rejeitado', 'revogado', 'expirado')),

    -- Mensagem do despachante ao solicitar (opcional)
    mensagem_solicitacao TEXT,

    -- Rastreamento temporal
    solicitado_em TIMESTAMPTZ DEFAULT NOW(),
    respondido_em TIMESTAMPTZ,
    revogado_em TIMESTAMPTZ,

    -- Auditoria de quem revogou
    revogado_por TEXT CHECK (revogado_por IN ('cac', 'despachante', 'admin_gcac')),

    -- Log de consentimento (LGPD)
    ip_consentimento TEXT,

    -- Unicidade: um par despachante+cac só pode ter um registro
    UNIQUE(despachante_empresa_id, cac_empresa_id)
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_vinculos_por_cac
    ON public.vinculos_despachante_cac (cac_empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_vinculos_por_despachante
    ON public.vinculos_despachante_cac (despachante_empresa_id, status);

-- 3. Controle de limite de CACs por despachante (gerenciado pelo Admin GCAC)
ALTER TABLE public.empresas
    ADD COLUMN IF NOT EXISTS limite_cac_vinculados INTEGER DEFAULT 10;

-- 4. Habilitar RLS
ALTER TABLE public.vinculos_despachante_cac ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acesso (permissivas para protótipo — autenticados podem ler/escrever)
DROP POLICY IF EXISTS "vinculos_select" ON public.vinculos_despachante_cac;
DROP POLICY IF EXISTS "vinculos_insert" ON public.vinculos_despachante_cac;
DROP POLICY IF EXISTS "vinculos_update" ON public.vinculos_despachante_cac;

CREATE POLICY "vinculos_select" ON public.vinculos_despachante_cac
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "vinculos_insert" ON public.vinculos_despachante_cac
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vinculos_update" ON public.vinculos_despachante_cac
    FOR UPDATE TO authenticated USING (true);

-- 6. Realtime para notificações em tempo real
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'vinculos_despachante_cac'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vinculos_despachante_cac;
    END IF;
END $$;
