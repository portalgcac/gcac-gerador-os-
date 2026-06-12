-- Desativar RLS para permitir inserção/leitura via chave anônima pública no frontend
ALTER TABLE public.historico_pagamentos_empresa DISABLE ROW LEVEL SECURITY;
