-- Script para adicionar o campo de acordo comercial na tabela de clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS acordo_comercial TEXT DEFAULT '';
