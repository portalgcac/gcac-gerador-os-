-- Alterar o valor padrão da coluna recursos_liberados para incluir os novos módulos
ALTER TABLE public.empresas
ALTER COLUMN recursos_liberados SET DEFAULT ARRAY[
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
  'modulo_ordens',
  'modulo_orcamentos',
  'modulo_recibos',
  'modulo_agendamentos',
  'modulo_clientes',
  'modulo_clientes_cac',
  'acervo_anexos', 
  'acervo_gerenciador'
];

-- Atualizar todas as empresas existentes para habilitar os novos módulos por padrão
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
  'modulo_ordens',
  'modulo_orcamentos',
  'modulo_recibos',
  'modulo_agendamentos',
  'modulo_clientes',
  'modulo_clientes_cac',
  'acervo_anexos', 
  'acervo_gerenciador'
];
