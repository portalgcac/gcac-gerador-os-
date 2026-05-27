-- Desativar RLS na tabela de creditos_cliente para permitir inserção/leitura
-- já que o frontend se conecta utilizando chave anônima (sem autenticação pelo Supabase Auth)
ALTER TABLE public.creditos_cliente DISABLE ROW LEVEL SECURITY;
