-- 1. Adicionar colunas de anexo (Base64) na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cr_url TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cr_ibama_url TEXT;

-- 2. Adicionar coluna de anexo (Base64) na tabela armas (para o CRAF)
ALTER TABLE armas ADD COLUMN IF NOT EXISTS craf_url TEXT;

-- 3. Adicionar coluna de anexo (Base64) na tabela guias_trafego (para a GT)
ALTER TABLE guias_trafego ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

-- 4. Adicionar coluna de anexo (Base64) na tabela autorizacoes_manejo (para o Manejo)
ALTER TABLE autorizacoes_manejo ADD COLUMN IF NOT EXISTS arquivo_url TEXT;
