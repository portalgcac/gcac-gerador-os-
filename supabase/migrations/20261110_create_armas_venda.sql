-- ==========================================================
-- MIGRAÇÃO: MÓDULO DE ARMAS À VENDA (CONSIGNADOS / VITRINE)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.armas_venda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    proprietario_nome TEXT NOT NULL,
    proprietario_telefone TEXT,
    proprietario_cpf TEXT,
    proprietario_cr TEXT,
    
    -- Especificações Técnicas da Arma
    tipo TEXT NOT NULL DEFAULT 'PISTOLA',
    fabricante TEXT NOT NULL,
    modelo TEXT NOT NULL,
    calibre TEXT NOT NULL,
    numero_serie TEXT,
    sigma_sinarm TEXT DEFAULT 'SIGMA',
    numero_craf TEXT,
    craf_validade DATE,
    capacidade TEXT,
    acabamento TEXT,
    comprimento_cano TEXT,
    estado_conservacao TEXT DEFAULT 'Excelente / Pouco Uso',
    quantidade_carregadores INTEGER DEFAULT 1,
    acessorios TEXT,
    local_arma TEXT DEFAULT 'proprietario', -- 'proprietario' ou 'loja_custodia'
    
    -- Fotos
    fotos TEXT[] DEFAULT '{}'::text[],
    foto_principal TEXT,
    
    -- Valores & Comissões
    valor_cliente NUMERIC(12,2) NOT NULL DEFAULT 0,
    comissao_tipo TEXT NOT NULL DEFAULT 'percentual', -- 'percentual' ou 'fixo'
    comissao_valor NUMERIC(12,2) NOT NULL DEFAULT 10,
    valor_anunciado NUMERIC(12,2) NOT NULL DEFAULT 0,
    lucro_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Status & Negociação
    status TEXT NOT NULL DEFAULT 'disponivel', -- 'disponivel', 'reservada', 'em_transferencia', 'vendida', 'devolvida'
    observacoes_internas TEXT,
    anuncio_titulo TEXT,
    anuncio_descricao TEXT,
    
    -- Dados da Venda
    comprador_nome TEXT,
    comprador_telefone TEXT,
    comprador_cpf TEXT,
    data_venda TIMESTAMPTZ,
    ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    
    criado_por_nome TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_armas_venda_empresa_id ON public.armas_venda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_armas_venda_status ON public.armas_venda(status);
CREATE INDEX IF NOT EXISTS idx_armas_venda_cliente_id ON public.armas_venda(cliente_id);

-- Ativar RLS
ALTER TABLE public.armas_venda ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS armas_venda_all_policy ON public.armas_venda;
CREATE POLICY armas_venda_all_policy ON public.armas_venda
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  )
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  );
