-- ==========================================================
-- MIGRAÇÃO: CONTROLE DE PONTO ELETRÔNICO, APURAÇÃO DE HORAS E PAGAMENTO DE COLABORADORES (PJ / NF)
-- ==========================================================

-- 1. Adicionar configuração de localização da sede na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS sede_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS sede_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS sede_raio_metros INTEGER DEFAULT 150;

-- 2. Adicionar campos de Nota Fiscal na tabela de despesas PJ
ALTER TABLE public.despesas
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT,
ADD COLUMN IF NOT EXISTS numero_nf TEXT,
ADD COLUMN IF NOT EXISTS colaborador_nome TEXT;

-- 3. Tabela de Contratos / Configurações de Colaboradores (Prestadores PJ / Equipe)
CREATE TABLE IF NOT EXISTS public.colaboradores_contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_email TEXT,
    nome TEXT NOT NULL,
    cpf_cnpj TEXT,
    contato TEXT,
    chave_pix TEXT,
    cargo_funcao TEXT DEFAULT 'Colaborador / Prestador PJ',
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    modelo_calculo TEXT NOT NULL DEFAULT 'mensal_proporcional' CHECK (modelo_calculo IN ('mensal_proporcional', 'diaria', 'horista')),
    divisor_mensal TEXT NOT NULL DEFAULT 'dias_uteis' CHECK (divisor_mensal IN ('dias_uteis', '30_dias')),
    valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
    carga_horaria_diaria_min INTEGER NOT NULL DEFAULT 480,
    horario_entrada_padrao TEXT DEFAULT '08:00',
    horario_intervalo_inicio_padrao TEXT DEFAULT '12:00',
    horario_intervalo_fim_padrao TEXT DEFAULT '13:30',
    horario_saida_padrao TEXT DEFAULT '17:30',
    dias_semana_trabalho INTEGER[] DEFAULT '{1,2,3,4,5}'::integer[],
    exige_foto_ponto BOOLEAN DEFAULT TRUE,
    exige_gps_ponto BOOLEAN DEFAULT TRUE,
    ativo BOOLEAN DEFAULT TRUE,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colaboradores_contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaboradores_contratos_all_policy ON public.colaboradores_contratos;
CREATE POLICY colaboradores_contratos_all_policy ON public.colaboradores_contratos
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  )
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  );

-- 4. Tabela de Registros de Ponto / Check-in Diário (Entrada, Intervalo, Saída, Foto, GPS)
CREATE TABLE IF NOT EXISTS public.registros_ponto_colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores_contratos(id) ON DELETE CASCADE,
    colaborador_email TEXT,
    colaborador_nome TEXT,
    data DATE NOT NULL,
    status_dia TEXT NOT NULL DEFAULT 'trabalhado' CHECK (status_dia IN ('trabalhado', 'parcial', 'falta_descontada', 'falta_abonada', 'folga_feriado')),
    hora_entrada TEXT,
    hora_intervalo_ida TEXT,
    hora_intervalo_volta TEXT,
    hora_saida TEXT,
    minutos_trabalhados INTEGER DEFAULT 0,
    minutos_esperados INTEGER DEFAULT 480,
    minutos_saldo INTEGER DEFAULT 0,
    foto_entrada_url TEXT,
    foto_saida_url TEXT,
    lat_entrada DOUBLE PRECISION,
    lng_entrada DOUBLE PRECISION,
    distancia_entrada_metros INTEGER,
    lat_saida DOUBLE PRECISION,
    lng_saida DOUBLE PRECISION,
    distancia_saida_metros INTEGER,
    origem_registro TEXT DEFAULT 'eletronico' CHECK (origem_registro IN ('eletronico', 'ajuste_gestor')),
    observacao TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (colaborador_id, data)
);

ALTER TABLE public.registros_ponto_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registros_ponto_colaboradores_all_policy ON public.registros_ponto_colaboradores;
CREATE POLICY registros_ponto_colaboradores_all_policy ON public.registros_ponto_colaboradores
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  )
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  );

-- 5. Tabela de Fechamentos / Apurações de Pagamento & Notas Fiscais
CREATE TABLE IF NOT EXISTS public.fechamentos_colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores_contratos(id) ON DELETE CASCADE,
    colaborador_nome TEXT NOT NULL,
    data_inicio_periodo DATE NOT NULL,
    data_fim_periodo DATE NOT NULL,
    dias_uteis_periodo INTEGER DEFAULT 0,
    dias_trabalhados NUMERIC(6,2) DEFAULT 0,
    dias_faltas_descontadas NUMERIC(6,2) DEFAULT 0,
    dias_faltas_abonadas NUMERIC(6,2) DEFAULT 0,
    minutos_trabalhados_total INTEGER DEFAULT 0,
    minutos_esperados_total INTEGER DEFAULT 0,
    valor_base_proporcional NUMERIC(12,2) DEFAULT 0,
    valor_descontos_ausencias_horas NUMERIC(12,2) DEFAULT 0,
    valor_horas_extras NUMERIC(12,2) DEFAULT 0,
    valor_comissoes_os NUMERIC(12,2) DEFAULT 0,
    valor_ajuda_custo NUMERIC(12,2) DEFAULT 0,
    valor_adiantamentos NUMERIC(12,2) DEFAULT 0,
    valor_liquido_final NUMERIC(12,2) NOT NULL DEFAULT 0,
    numero_nf TEXT,
    data_emissao_nf DATE,
    nota_fiscal_url TEXT,
    comprovante_pagamento_url TEXT,
    despesa_id UUID,
    status TEXT NOT NULL DEFAULT 'aguardando_nf' CHECK (status IN ('rascunho', 'aguardando_nf', 'nf_enviada', 'pago')),
    observacoes TEXT,
    snapshot_ponto JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fechamentos_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fechamentos_colaboradores_all_policy ON public.fechamentos_colaboradores;
CREATE POLICY fechamentos_colaboradores_all_policy ON public.fechamentos_colaboradores
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  )
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id()
    OR LOWER(auth.jwt() ->> 'email') = 'gui.gomesassis@gmail.com'
  );
