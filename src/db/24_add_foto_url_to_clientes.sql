-- ==========================================================
-- SCRIPT DE MIGRAÇÃO: ADIÇÃO DE FOTO DE PERFIL PARA CLIENTES
-- ==========================================================

-- 1. Adicionar coluna foto_url na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS foto_url TEXT;
