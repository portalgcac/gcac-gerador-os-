-- Adicionar coluna de recursos liberados na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS recursos_liberados TEXT[] 
DEFAULT ARRAY[
  'dash_atencao_diaria', 
  'dash_alertas_vencimento', 
  'dash_lembretes', 
  'dash_resumo_os', 
  'dash_margem_operacional', 
  'dash_resumo_operacional', 
  'dash_resumo_orcamentos', 
  'dash_ordens_recentes', 
  'fin_fluxo_caixa', 
  'fin_relatorio_equipe', 
  'fin_exportacao', 
  'acervo_anexos', 
  'acervo_gerenciador'
];

-- Garantir que todas as empresas existentes tenham todos os recursos habilitados por padrão
UPDATE public.empresas 
SET recursos_liberados = ARRAY[
  'dash_atencao_diaria', 
  'dash_alertas_vencimento', 
  'dash_lembretes', 
  'dash_resumo_os', 
  'dash_margem_operacional', 
  'dash_resumo_operacional', 
  'dash_resumo_orcamentos', 
  'dash_ordens_recentes', 
  'fin_fluxo_caixa', 
  'fin_relatorio_equipe', 
  'fin_exportacao', 
  'acervo_anexos', 
  'acervo_gerenciador'
]
WHERE recursos_liberados IS NULL;
