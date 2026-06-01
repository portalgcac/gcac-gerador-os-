-- Criar bucket para os documentos dos clientes caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-clientes', 'documentos-clientes', true)
ON CONFLICT (id) DO NOTHING;

-- Configurar RLS no storage.objects se ainda não estiver habilitada
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar duplicidade
DROP POLICY IF EXISTS "Leitura Pública" ON storage.objects;
DROP POLICY IF EXISTS "Upload Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Update Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Delete Autenticado" ON storage.objects;

-- Criar novas políticas de acesso
CREATE POLICY "Leitura Pública" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos-clientes');

CREATE POLICY "Upload Autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-clientes');

CREATE POLICY "Update Autenticado" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-clientes');

CREATE POLICY "Delete Autenticado" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-clientes');
