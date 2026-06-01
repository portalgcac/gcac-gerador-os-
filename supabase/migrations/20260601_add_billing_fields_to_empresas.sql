-- 1. Novas colunas na tabela de empresas para controle comercial
ALTER TABLE empresas 
  ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT '.22LR',
  ADD COLUMN IF NOT EXISTS plano_status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS frequencia_pagamento TEXT DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS data_vencimento DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS taxa_implementacao_paga BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS valor_implementacao NUMERIC DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS valor_assinatura_personalizado NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_gratis BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS limite_usuarios_staff INTEGER DEFAULT 1;

-- 2. Tabela de histórico de faturas/pagamentos recebidos
CREATE TABLE IF NOT EXISTS historico_pagamentos_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valor_pago NUMERIC NOT NULL,
  plano TEXT NOT NULL,
  frequencia TEXT NOT NULL,
  referencia_vencimento DATE NOT NULL,
  meio_pagamento TEXT DEFAULT 'PIX',
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
