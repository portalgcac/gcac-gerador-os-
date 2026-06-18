-- Script de migração para controle interno de alertas em renovação (aguardando liberação da PF/Exército)

-- 1. Tabela de Clientes: adiciona status para CR e CR IBAMA
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cr_em_renovacao BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cr_ibama_em_renovacao BOOLEAN DEFAULT FALSE;

-- 2. Tabela de Armas: adiciona status para CRAF
ALTER TABLE armas ADD COLUMN IF NOT EXISTS craf_em_renovacao BOOLEAN DEFAULT FALSE;

-- 3. Tabela de Guias de Tráfego: adiciona status para GT
ALTER TABLE guias_trafego ADD COLUMN IF NOT EXISTS gt_em_renovacao BOOLEAN DEFAULT FALSE;

-- 4. Tabela de Autorizações de Manejo (IBAMA): adiciona status para Manejo
ALTER TABLE autorizacoes_manejo ADD COLUMN IF NOT EXISTS manejo_em_renovacao BOOLEAN DEFAULT FALSE;
