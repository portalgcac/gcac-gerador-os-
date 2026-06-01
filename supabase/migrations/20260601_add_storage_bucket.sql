-- Criar bucket para os documentos dos clientes caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-clientes', 'documentos-clientes', true)
ON CONFLICT (id) DO NOTHING;
