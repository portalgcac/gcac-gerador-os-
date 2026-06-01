-- Adiciona a coluna logo_url na tabela empresas para armazenar o logotipo base64 comprimido de cada despachante
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
