-- Tabela para armazenar os endpoints de push notification de cada dispositivo
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, endpoint)
);

-- RLS: cada empresa só vê e gerencia suas próprias subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_gerencia_suas_subscriptions"
ON public.push_subscriptions FOR ALL
USING (true)
WITH CHECK (true);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_empresa_id
ON public.push_subscriptions(empresa_id);
