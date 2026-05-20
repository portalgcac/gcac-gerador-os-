-- ==========================================================
-- SCRIPT DE MIGRAÇÃO: MULTI-TENANCY (OPÇÃO 1)
-- ==========================================================

-- 1. Criar a tabela de empresas (se não existir)
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inserir a empresa padrão "GCAC Principal" com UUID fixo
INSERT INTO public.empresas (id, nome)
VALUES ('00000000-0000-0000-0000-000000000001', 'GCAC Principal')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 3. Função auxiliar para adicionar coluna empresa_id se não existir
CREATE OR REPLACE FUNCTION adicionar_empresa_id_se_nao_existe(nome_tabela text)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = nome_tabela 
        AND column_name = 'empresa_id'
    ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) DEFAULT ''00000000-0000-0000-0000-000000000001''', nome_tabela);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Adicionar empresa_id em todas as tabelas
SELECT adicionar_empresa_id_se_nao_existe('usuarios_autorizados');
SELECT adicionar_empresa_id_se_nao_existe('clientes');
SELECT adicionar_empresa_id_se_nao_existe('armas');
SELECT adicionar_empresa_id_se_nao_existe('guias_trafego');
SELECT adicionar_empresa_id_se_nao_existe('autorizacoes_manejo');
SELECT adicionar_empresa_id_se_nao_existe('ordens');
SELECT adicionar_empresa_id_se_nao_existe('orcamentos');
SELECT adicionar_empresa_id_se_nao_existe('recibos');
SELECT adicionar_empresa_id_se_nao_existe('agendamentos');
SELECT adicionar_empresa_id_se_nao_existe('lembretes');
SELECT adicionar_empresa_id_se_nao_existe('despesas');
SELECT adicionar_empresa_id_se_nao_existe('creditos_cliente');
SELECT adicionar_empresa_id_se_nao_existe('servicos_config');
SELECT adicionar_empresa_id_se_nao_existe('notificacoes_sistema');

-- Limpar a função auxiliar
DROP FUNCTION adicionar_empresa_id_se_nao_existe(text);

-- 5. Garantir que os registros existentes apontem para a empresa padrão
UPDATE public.usuarios_autorizados SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.clientes SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.armas SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.guias_trafego SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.autorizacoes_manejo SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.ordens SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.orcamentos SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.recibos SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.agendamentos SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.lembretes SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.despesas SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.creditos_cliente SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.servicos_config SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;
UPDATE public.notificacoes_sistema SET empresa_id = '00000000-0000-0000-0000-000000000001' WHERE empresa_id IS NULL;

-- 6. Garantir que as tabelas tenham RLS ativo e habilitado
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;

-- 7. Criar política de leitura pública de empresas para usuários autenticados
DROP POLICY IF EXISTS "Leitura de empresas para autenticados" ON public.empresas;
CREATE POLICY "Leitura de empresas para autenticados" 
ON public.empresas FOR SELECT 
TO authenticated 
USING (true);

-- Criar política de leitura/escrita geral de empresas para o master admin
DROP POLICY IF EXISTS "Acesso total empresas para master admin" ON public.empresas;
CREATE POLICY "Acesso total empresas para master admin" 
ON public.empresas FOR ALL 
TO authenticated 
USING (LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com')
WITH CHECK (LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com');
