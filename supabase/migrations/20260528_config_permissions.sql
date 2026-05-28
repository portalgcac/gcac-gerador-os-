-- =========================================================
-- Migration: Adicionar permissões de configuração e atualizar tenants
-- =========================================================

-- 1. Alterar o valor padrão da coluna recursos_liberados para incluir TODOS os 23 recursos do sistema
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
  'acervo_gerenciador',
  'config_alertas_vencimento',
  'config_notificacoes_push',
  'config_servicos',
  'config_manual'
];

-- 2. Atualizar todas as empresas existentes do tipo 'empresa' (despachantes)
-- para que tenham todos os 23 recursos liberados por padrão
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
  'acervo_gerenciador',
  'config_alertas_vencimento',
  'config_notificacoes_push',
  'config_servicos',
  'config_manual'
]
WHERE tipo_conta = 'empresa';
