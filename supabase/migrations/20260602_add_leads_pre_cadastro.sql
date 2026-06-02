-- ==========================================================
-- MIGRAÇÃO: TABELA DE LEADS DE PRÉ-CADASTRO E PLANOS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.leads_pre_cadastro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    email TEXT NOT NULL,
    contato TEXT NOT NULL,
    plano TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'contatado', 'ativado', 'cancelado')),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para esta tabela se necessário
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'leads_pre_cadastro'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_pre_cadastro;
    END IF;
END $$;

-- Como o frontend conecta ao Supabase usando a chave anônima,
-- o RLS deve estar desativado para permitir a escrita (insert) pelo cliente público
ALTER TABLE public.leads_pre_cadastro DISABLE ROW LEVEL SECURITY;
