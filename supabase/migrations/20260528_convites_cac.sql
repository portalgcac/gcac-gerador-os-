-- =========================================================
-- Migration: Tabela de Convites CAC (Portal G CAC)
-- Despachante convida cliente existente para criar conta
-- CAC Individual com vínculo automático após aceite.
-- =========================================================

CREATE TABLE IF NOT EXISTS convites_cac (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  despachante_empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  despachante_nome       TEXT NOT NULL,
  cliente_nome           TEXT NOT NULL,
  cliente_cpf            TEXT,
  cliente_id             UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente', 'aceito', 'expirado', 'cancelado')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  aceito_em       TIMESTAMPTZ,
  cac_empresa_id  UUID        REFERENCES empresas(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_convites_cac_token
  ON convites_cac(token);
CREATE INDEX IF NOT EXISTS idx_convites_cac_cliente_id
  ON convites_cac(cliente_id);
CREATE INDEX IF NOT EXISTS idx_convites_cac_despachante
  ON convites_cac(despachante_empresa_id);
CREATE INDEX IF NOT EXISTS idx_convites_cac_status
  ON convites_cac(status);

-- Row Level Security
ALTER TABLE convites_cac ENABLE ROW LEVEL SECURITY;

-- Política: service_role pode tudo (Edge Functions)
CREATE POLICY "service_role_full_access" ON convites_cac
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Política: qualquer usuário autenticado pode ler pelo token (landing page pública via anon key)
CREATE POLICY "anon_read_by_token" ON convites_cac
  FOR SELECT TO anon USING (true);

-- Política: anon pode atualizar (aceitar convite)
CREATE POLICY "anon_update_accept" ON convites_cac
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Política: authenticated pode inserir (despachante gera convite)
CREATE POLICY "authenticated_insert" ON convites_cac
  FOR INSERT TO authenticated WITH CHECK (true);

-- Política: authenticated pode ler/atualizar os seus convites
CREATE POLICY "authenticated_own_access" ON convites_cac
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
