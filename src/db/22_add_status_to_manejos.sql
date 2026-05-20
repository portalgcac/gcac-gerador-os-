-- Adiciona a coluna status com valor padrão 'Ativo'
ALTER TABLE public.autorizacoes_manejo ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Ativo';
