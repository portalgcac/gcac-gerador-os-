-- =========================================================
-- MIGRAÇÃO 43: Vales e Adiantamentos com Confirmação Eletrônica
-- =========================================================

CREATE TABLE IF NOT EXISTS public.vales_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  colaborador_id UUID,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  usuario_email TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_adiantamento DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT NOT NULL DEFAULT 'PIX',
  motivo TEXT NOT NULL,
  comprovante_gestor_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'confirmado_eletronico', 'assinado_manual', 'recusado'
  confirmado_em TIMESTAMPTZ,
  confirmado_por_email TEXT,
  hash_autenticacao TEXT,
  assinatura_base64 TEXT,
  recibo_assinado_url TEXT,
  observacoes TEXT,
  criado_por_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_vales_empresa_id ON public.vales_colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vales_usuario_email ON public.vales_colaboradores(usuario_email);
CREATE INDEX IF NOT EXISTS idx_vales_data ON public.vales_colaboradores(data_adiantamento);

-- Habilitar RLS simples
ALTER TABLE public.vales_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vales_colaboradores_all_policy" ON public.vales_colaboradores;
CREATE POLICY "vales_colaboradores_all_policy" 
ON public.vales_colaboradores
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Adicionar na publicação realtime para sincronização instantânea
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'vales_colaboradores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vales_colaboradores;
  END IF;
END $$;
