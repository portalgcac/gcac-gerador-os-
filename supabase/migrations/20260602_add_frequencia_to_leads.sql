-- Adicionar coluna de frequência de pagamento na tabela de pré-cadastro leads
ALTER TABLE public.leads_pre_cadastro 
ADD COLUMN IF NOT EXISTS frequencia_pagamento TEXT DEFAULT 'mensal';
