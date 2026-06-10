-- Script para adicionar o campo de e-mail na tabela de clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
