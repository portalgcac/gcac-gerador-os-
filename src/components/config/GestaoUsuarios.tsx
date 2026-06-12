import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, User, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronUp, Lock, Building, ArrowLeft, Settings2, BadgeDollarSign, Calendar, CreditCard, Crosshair } from 'lucide-react';
import { supabase } from '../../db/supabase';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { useAuth } from '../../context/AuthContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { formatarData } from '../../utils/formatters';

interface UsuarioAutorizado {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  contato: string | null;
  role: 'admin' | 'colaborador';
  ativo: boolean;
  permissoes: string[];
  empresa_id?: string;
}

const MODULOS = [
  { slug: 'painel', label: 'Painel / Dashboard' },
  { slug: 'rotina', label: 'Rotina Diária' },
  { slug: 'agenda', label: 'Agenda / Lembretes' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'orcamentos', label: 'Orçamentos' },
  { slug: 'ordens', label: 'Ordens de Serviço' },
  { slug: 'recibos', label: 'Recibos' },
  { slug: 'agendamentos', label: 'Agendamentos' },
  { slug: 'clientes', label: 'Meus Clientes' },
  { slug: 'config', label: 'Configurações' },
];

const RECURSOS_SISTEMA = [
  { key: 'dash_atencao_diaria', label: 'Dashboard — Resumo de Atenção Diária' },
  { key: 'dash_alertas_vencimento', label: 'Dashboard — Alertas de Vencimentos' },
  { key: 'dash_lembretes', label: 'Dashboard — Lembretes da Equipe' },
  { key: 'dash_resumo_os', label: 'Dashboard — Resumo de Ordens de Serviço' },
  { key: 'dash_margem_operacional', label: 'Dashboard — Margem de Operações e Lucros' },
  { key: 'dash_resumo_operacional', label: 'Dashboard — Resumo Operacional de Serviços' },
  { key: 'dash_resumo_orcamentos', label: 'Dashboard — Resumo de Orçamentos' },
  { key: 'dash_ordens_recentes', label: 'Dashboard — Listagem de Ordens de Serviço Recentes' },
  { key: 'fin_fluxo_caixa', label: 'Financeiro — Fluxo de Caixa e Lançamentos' },
  { key: 'fin_relatorio_equipe', label: 'Financeiro — Relatório de Produtividade da Equipe' },
  { key: 'fin_exportacao', label: 'Financeiro — Exportação de Relatórios Financeiros' },
  { key: 'modulo_ordens', label: 'Módulo Ordens de Serviço — Emissão e Controle de Ordens de Serviço' },
  { key: 'modulo_orcamentos', label: 'Módulo Orçamentos — Emissão e Controle de Orçamentos' },
  { key: 'modulo_recibos', label: 'Módulo Recibos — Emissão de Recibos de Pagamento' },
  { key: 'modulo_agendamentos', label: 'Módulo Agendamentos — Controle de Agendamentos e Calendário' },
  { key: 'modulo_clientes', label: 'Módulo Clientes — Cadastro e Gestão de Clientes' },
  { key: 'modulo_clientes_cac', label: 'Módulo Clientes CAC — Vinculação e Gestão de Atiradores/Colecionadores' },
  { key: 'acervo_anexos', label: 'Acervo — Armazenamento de Arquivos e Anexos nos Documentos' },
  { key: 'acervo_gerenciador', label: 'Acervo — Gerenciador de Clientes Vinculados' },
  // ── Configurações (seções internas) ──
  { key: 'config_alertas_vencimento', label: 'Configurações — Alertas de Prazos de Vencimento (CR, CRAF, GT, Manejo)' },
  { key: 'config_notificacoes_push', label: 'Configurações — Notificações Push no Celular' },
  { key: 'config_servicos', label: 'Configurações — Gerenciar Serviços e Taxas' },
  { key: 'config_manual', label: 'Configurações — Manual de Instruções' },
];

import { PainelAtiradores } from '../admin/PainelAtiradores';

interface GestaoUsuariosProps {
  abaInicial?: 'empresas' | 'cacs' | 'equipe_interna' | 'faturamento' | 'leads' | 'monitor_cacs';
}

export function GestaoUsuarios({ abaInicial }: GestaoUsuariosProps = {}) {
  const { usuario } = useAuth();
  const isMasterAdmin = usuario?.email === 'gui.gomesassis@gmail.com';

  // Sub-painel ativo para Master Admin
  const [subPainelAtivo, setSubPainelAtivo] = useState<'empresas' | 'cacs' | 'equipe_interna' | 'faturamento' | 'leads' | 'monitor_cacs'>(abaInicial || 'empresas');

  useEffect(() => {
    if (abaInicial) {
      setSubPainelAtivo(abaInicial);
    }
  }, [abaInicial]);
  const [leads, setLeads] = useState<any[]>([]);
  const [carregandoLeads, setCarregandoLeads] = useState(false);
  
  // Empresa ativamente em edição/gestão pelo Master Admin
  const [empresaGerenciada, setEmpresaGerenciada] = useState<any | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { estado: notif, mostrar, fechar } = useNotificacao();

  // Empresas State (apenas para master admin)
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaTipo, setNovaEmpresaTipo] = useState<'empresa' | 'cac_individual'>('empresa');
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);
  
  const [empresaEditando, setEmpresaEditando] = useState<any | null>(null);
  const [confirmandoDeleteEmpresa, setConfirmandoDeleteEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [confirmandoDeleteUsuario, setConfirmandoDeleteUsuario] = useState<{ id: string; nome: string; empresa_id?: string } | null>(null);

  // Estados para Gestão de Faturamento & Mensalidades
  const [empresaFaturamentoSelecionada, setEmpresaFaturamentoSelecionada] = useState<any | null>(null);
  const [historicoPagamentos, setHistoricoPagamentos] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [modalPagamentoManualAberto, setModalPagamentoManualAberto] = useState(false);
  const [formDataPagamento, setFormDataPagamento] = useState({
    valor_pago: '',
    meio_pagamento: 'PIX',
    observacoes: ''
  });
  const [vinculosAtivos, setVinculosAtivos] = useState<any[]>([]);
  const [todosPagamentos, setTodosPagamentos] = useState<any[]>([]);
  const [buscaFaturamento, setBuscaFaturamento] = useState('');
  const [abaFaturamento, setAbaFaturamento] = useState<'empresas' | 'cacs'>('empresas');
  
  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioAutorizado | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    contato: '',
    role: 'colaborador' as 'admin' | 'colaborador',
    permissoes: ['ordens'] as string[],
    empresa_id: '00000000-0000-0000-0000-000000000001'
  });

  const getRecursosDisponiveis = () => {
    return RECURSOS_SISTEMA;
  };

  const carregarEmpresas = async () => {
    if (!isMasterAdmin) return;
    setCarregandoEmpresas(true);
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, tipo_conta, limite_cac_vinculados, recursos_liberados, plano, plano_status, frequencia_pagamento, data_vencimento, taxa_implementacao_paga, valor_implementacao, valor_assinatura_personalizado, is_gratis, limite_usuarios_staff, criado_em')
        .order('nome');
      if (error) {
        console.error('Erro ao carregar empresas:', error);
        mostrar('erro', `Erro ao carregar empresas: ${error.message}. Por favor, certifique-se de executar a migração SQL de faturamento no painel do Supabase.`);
      } else if (data) {
        setEmpresas(data);
      }

      // Buscar vínculos ativos de despachantes com CACs
      const { data: vData } = await supabase
        .from('vinculos_despachante_cac')
        .select('cac_empresa_id, despachante_nome, status')
        .eq('status', 'ativo');
      if (vData) setVinculosAtivos(vData);

      // Buscar todos os pagamentos para exibir a data de último pagamento
      const { data: pData } = await supabase
        .from('historico_pagamentos_empresa')
        .select('empresa_id, data_pagamento')
        .order('data_pagamento', { ascending: false });
      if (pData) setTodosPagamentos(pData);
    } catch (err) {
      console.error('Erro no fluxo de carregarEmpresas:', err);
    } finally {
      setCarregandoEmpresas(false);
    }
  };

  const carregarLeads = async () => {
    if (!isMasterAdmin) return;
    setCarregandoLeads(true);
    const { data, error } = await supabase
      .from('leads_pre_cadastro')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar leads:', error);
      mostrar('erro', 'Erro ao carregar leads de pré-cadastro.');
    } else if (data) {
      setLeads(data);
    }
    setCarregandoLeads(false);
  };

  const handleMarcarContatado = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads_pre_cadastro')
        .update({ status: 'contatado', atualizado_em: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
      mostrar('sucesso', 'Lead marcado como contatado.');
      carregarLeads();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao atualizar lead.');
    }
  };

  const handleExcluirLead = async (leadId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pré-cadastro?')) return;
    try {
      const { error } = await supabase
        .from('leads_pre_cadastro')
        .delete()
        .eq('id', leadId);
      if (error) throw error;
      mostrar('sucesso', 'Pré-cadastro excluído.');
      carregarLeads();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao excluir.');
    }
  };

  const handleAtivarLead = async (lead: any) => {
    setCarregando(true);
    try {
      const isCac = lead.tipo_usuario === 'cac_individual';
      const nomeEmpresa = isCac 
        ? `CAC - ${lead.nome.toUpperCase()}`
        : lead.nome.toUpperCase();

      // 1. Criar a empresa/tenant no banco
      const { data: novaEmp, error: errEmp } = await supabase
        .from('empresas')
        .insert([{
          nome: nomeEmpresa,
          tipo_conta: lead.tipo_usuario || 'despachante',
          plano: lead.plano || '.22LR',
          recursos_liberados: isCac 
            ? [
                'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes',
                'modulo_clientes', 'acervo_anexos', 'acervo_gerenciador', 'config_manual'
              ]
            : [
                'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes', 'dash_resumo_os',
                'dash_margem_operacional', 'dash_resumo_operacional', 'dash_resumo_orcamentos',
                'dash_ordens_recentes', 'fin_fluxo_caixa', 'fin_relatorio_equipe', 'fin_exportacao',
                'modulo_ordens', 'modulo_orcamentos', 'modulo_recibos', 'modulo_agendamentos',
                'modulo_clientes', 'modulo_clientes_cac', 'acervo_anexos', 'acervo_gerenciador',
                'config_alertas_vencimento', 'config_notificacoes_push', 'config_servicos', 'config_manual'
              ],
          limite_usuarios_staff: isCac 
            ? 1 
            : (lead.plano === '.22LR' ? 1 : (lead.plano === '.357mag' ? 4 : 9999)),
          limite_cac_vinculados: isCac ? 1 : 20,
          plano_status: 'ativo',
          frequencia_pagamento: lead.frequencia_pagamento || 'mensal',
          data_vencimento: new Date(
            Date.now() + 
            (lead.frequencia_pagamento === 'anual' 
              ? 365 
              : lead.frequencia_pagamento === 'semestral' 
                ? 180 
                : 30) * 24 * 60 * 60 * 1000
          ).toISOString().split('T')[0],
          taxa_implementacao_paga: false,
          is_gratis: false // Fica sujeito a cobrança e vencimento por padrão
        }])
        .select()
        .single();

      if (errEmp || !novaEmp) throw new Error(errEmp?.message || 'Erro ao criar empresa/tenant no banco.');

      // 2. Criar o usuário administrador no banco
      const { error: errUser } = await supabase
        .from('usuarios_autorizados')
        .insert([{
          nome: lead.nome,
          email: lead.email,
          cpf: lead.cpf,
          contato: lead.contato,
          role: 'admin',
          ativo: true,
          permissoes: isCac
            ? ['painel', 'agenda', 'clientes', 'config']
            : ['painel', 'rotina', 'agenda', 'financeiro', 'orcamentos', 'ordens', 'recibos', 'agendamentos', 'clientes', 'config'],
          empresa_id: novaEmp.id
        }]);

      if (errUser) throw errUser;

      // 3. Atualizar status do lead para 'ativado'
      const { error: errLead } = await supabase
        .from('leads_pre_cadastro')
        .update({ status: 'ativado', atualizado_em: new Date().toISOString() })
        .eq('id', lead.id);

      if (errLead) throw errLead;

      mostrar('sucesso', `Cadastro ativado com sucesso! Workspace "${nomeEmpresa}" criada.`);
      carregarLeads();
      carregarEmpresas();
      carregarUsuarios();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao ativar cadastro.');
    } finally {
      setCarregando(false);
    }
  };

  const formatarTelefoneExibicao = (val: string) => {
    const limpo = val.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    if (limpo.length === 10) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    }
    return val;
  };

  const formatarCpfExibicao = (val: string) => {
    const limpo = val.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
    }
    return val;
  };

  const carregarUsuarios = async () => {
    if (!usuario) return;
    setCarregando(true);
    let query = supabase
      .from('usuarios_autorizados')
      .select('*')
      .order('nome');

    if (!isMasterAdmin) {
      query = query.eq('empresa_id', usuario.empresaId);
    }

    const { data, error } = await query;
    
    if (error) {
      mostrar('erro', 'Erro ao carregar usuários.');
    } else {
      setUsuarios(data || []);
    }
    setCarregando(false);
  };

  useEffect(() => {
    if (usuario) {
      carregarUsuarios();
      if (isMasterAdmin) {
        carregarEmpresas();
        carregarLeads();
      }
    }
  }, [usuario]);

  useEffect(() => {
    if (isMasterAdmin && subPainelAtivo === 'leads') {
      carregarLeads();
    }
  }, [subPainelAtivo, isMasterAdmin]);

  // Se o master admin atualizou a lista de empresas, sincroniza o estado de empresaGerenciada
  useEffect(() => {
    if (empresaGerenciada && empresas.length > 0) {
      const atual = empresas.find(e => e.id === empresaGerenciada.id);
      if (atual) {
        setEmpresaGerenciada(atual);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas]);

  const handleAbrirModal = (user?: UsuarioAutorizado) => {
    if (user) {
      setEditando(user);
      setFormData({
        nome: user.nome,
        email: user.email,
        cpf: user.cpf || '',
        contato: user.contato || '',
        role: user.role,
        permissoes: user.permissoes,
        empresa_id: user.empresa_id || '00000000-0000-0000-0000-000000000001'
      });
    } else {
      let defaultEmpId = '00000000-0000-0000-0000-000000000001';
      if (!isMasterAdmin && usuario?.empresaId) {
        defaultEmpId = usuario.empresaId;
      } else if (empresaGerenciada) {
        defaultEmpId = empresaGerenciada.id;
      } else if (subPainelAtivo === 'equipe_interna') {
        defaultEmpId = '00000000-0000-0000-0000-000000000001';
      }

      setEditando(null);
      setFormData({
        nome: '',
        email: '',
        cpf: '',
        contato: '',
        role: 'colaborador',
        permissoes: ['ordens'],
        empresa_id: defaultEmpId
      });
    }
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let targetEmpresaId = formData.empresa_id;

      // Onboarding de CAC Individual criado manualmente pelo Master Admin
      if (isMasterAdmin && subPainelAtivo === 'cacs' && !editando) {
        const { data: novaEmp, error: errEmp } = await supabase
          .from('empresas')
          .insert([{
            nome: `CAC - ${formData.nome.toUpperCase()}`,
            tipo_conta: 'cac_individual',
            recursos_liberados: [
              'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes',
              'modulo_clientes', 'acervo_anexos', 'acervo_gerenciador'
            ]
          }])
          .select()
          .single();
        
        if (errEmp || !novaEmp) throw new Error(errEmp?.message || 'Erro ao criar tenant para CAC.');
        targetEmpresaId = novaEmp.id;
      } else if (isMasterAdmin && subPainelAtivo === 'equipe_interna') {
        targetEmpresaId = '00000000-0000-0000-0000-000000000001';
      } else if (isMasterAdmin && empresaGerenciada) {
        targetEmpresaId = empresaGerenciada.id;
      } else if (!isMasterAdmin && usuario?.empresaId) {
        targetEmpresaId = usuario.empresaId;
      }

      // Validação de Limite de Staff (Equipe)
      if (!editando && targetEmpresaId && targetEmpresaId !== '00000000-0000-0000-0000-000000000001') {
        const { data: empLimitData } = await supabase
          .from('empresas')
          .select('limite_usuarios_staff, tipo_conta')
          .eq('id', targetEmpresaId)
          .single();
        
        if (empLimitData && empLimitData.tipo_conta === 'empresa') {
          const limitStaff = empLimitData.limite_usuarios_staff ?? 1;
          const { count: currentStaffCount } = await supabase
            .from('usuarios_autorizados')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', targetEmpresaId);
            
          if (currentStaffCount != null && currentStaffCount >= limitStaff) {
            throw new Error(`Limite de membros da equipe atingido (${limitStaff} usuário(s) no plano contratado). Faça um upgrade de calibre para adicionar mais colaboradores.`);
          }
        }
      }

      const payload: any = {
        nome: formData.nome,
        email: formData.email.trim().toLowerCase(),
        cpf: formData.cpf || null,
        contato: formData.contato || null,
        role: formData.role,
        permissoes: formData.permissoes,
        empresa_id: targetEmpresaId
      };

      if (editando) {
        const { error } = await supabase
          .from('usuarios_autorizados')
          .update(payload)
          .eq('id', editando.id);
        
        if (error) throw error;
        mostrar('sucesso', 'Usuário atualizado com sucesso.');
      } else {
        payload.ativo = true;
        const { error } = await supabase
          .from('usuarios_autorizados')
          .insert([payload]);
        
        if (error) throw error;
        mostrar('sucesso', 'Usuário cadastrado com sucesso.');
      }
      setModalAberto(false);
      carregarUsuarios();
      if (isMasterAdmin) {
        carregarEmpresas();
      }
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao realizar operação.');
    }
  };

  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaEmpresaNome.trim()) return;
    try {
      const { error } = await supabase
        .from('empresas')
        .insert([{ 
          nome: novaEmpresaNome.trim(),
          tipo_conta: novaEmpresaTipo
        }]);
      
      if (error) throw error;
      
      mostrar('sucesso', 'Empresa cadastrada com sucesso (Perfil: ' + (novaEmpresaTipo === 'empresa' ? 'Empresa Limpa' : 'CAC Individual') + ').');
      setNovaEmpresaNome('');
      setNovaEmpresaTipo('empresa');
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao cadastrar empresa.');
    }
  };

  const handleSalvarEdicaoEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaEditando || !empresaEditando.nome.trim()) return;
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome: empresaEditando.nome.trim(),
          tipo_conta: empresaEditando.tipo_conta,
          limite_cac_vinculados: empresaEditando.limite_cac_vinculados,
          recursos_liberados: empresaEditando.recursos_liberados,
          plano: empresaEditando.plano || '.22LR',
          plano_status: empresaEditando.plano_status || 'ativo',
          frequencia_pagamento: empresaEditando.frequencia_pagamento || 'mensal',
          data_vencimento: empresaEditando.data_vencimento || null,
          taxa_implementacao_paga: !!empresaEditando.taxa_implementacao_paga,
          valor_implementacao: parseFloat(empresaEditando.valor_implementacao) || 150.00,
          valor_assinatura_personalizado: empresaEditando.valor_assinatura_personalizado != null ? parseFloat(empresaEditando.valor_assinatura_personalizado) : null,
          is_gratis: !!empresaEditando.is_gratis,
          limite_usuarios_staff: parseInt(empresaEditando.limite_usuarios_staff) || 1
        })
        .eq('id', empresaEditando.id);

      if (error) throw error;

      mostrar('sucesso', 'Empresa atualizada com sucesso.');
      setEmpresaEditando(null);
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao editar empresa.');
    }
  };

  const handleDeletarEmpresa = async () => {
    if (!confirmandoDeleteEmpresa) return;
    try {
      const { count, error: countError } = await supabase
        .from('usuarios_autorizados')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', confirmandoDeleteEmpresa.id);
      
      if (countError) throw countError;
      
      if (count && count > 0) {
        mostrar('erro', 'Não é possível excluir esta empresa pois existem usuários vinculados a ela.');
        setConfirmandoDeleteEmpresa(null);
        return;
      }

      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', confirmandoDeleteEmpresa.id);

      if (error) throw error;

      mostrar('sucesso', 'Empresa excluída com sucesso.');
      setConfirmandoDeleteEmpresa(null);
      carregarEmpresas();
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao excluir empresa. Verifique se existem outros registros vinculados.');
      setConfirmandoDeleteEmpresa(null);
    }
  };

  const handleDeletarUsuario = async () => {
    if (!confirmandoDeleteUsuario) return;
    try {
      const empresaId = confirmandoDeleteUsuario.empresa_id;
      let isCacIndividual = false;

      if (empresaId) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('tipo_conta')
          .eq('id', empresaId)
          .maybeSingle();

        if (emp?.tipo_conta === 'cac_individual') {
          isCacIndividual = true;
        }
      }

      if (isCacIndividual && empresaId) {
        // 1. Reseta os convites para este CAC
        await supabase
          .from('convites_cac')
          .update({ cac_empresa_id: null, status: 'pendente', aceito_em: null })
          .eq('cac_empresa_id', empresaId);

        // 2. Deleta vínculos
        await supabase
          .from('vinculos_despachante_cac')
          .delete()
          .or(`despachante_empresa_id.eq.${empresaId},cac_empresa_id.eq.${empresaId}`);

        // 3. Deleta autorizacoes_manejo
        await supabase
          .from('autorizacoes_manejo')
          .delete()
          .eq('empresa_id', empresaId);

        // 4. Deleta guias_trafego
        await supabase
          .from('guias_trafego')
          .delete()
          .eq('empresa_id', empresaId);

        // 5. Deleta armas
        await supabase
          .from('armas')
          .delete()
          .eq('empresa_id', empresaId);

        // 6. Deleta clientes (perfil do CAC)
        await supabase
          .from('clientes')
          .delete()
          .eq('empresa_id', empresaId);

        // 7. Deleta o usuário da tabela usuarios_autorizados
        const { error: errUser } = await supabase
          .from('usuarios_autorizados')
          .delete()
          .eq('id', confirmandoDeleteUsuario.id);

        if (errUser) throw errUser;

        // 8. Deleta a empresa
        const { error: errEmp } = await supabase
          .from('empresas')
          .delete()
          .eq('id', empresaId);

        if (errEmp) throw errEmp;
      } else {
        // Comportamento normal para outros usuários (colaboradores/admins de despachante)
        const { error: errUser } = await supabase
          .from('usuarios_autorizados')
          .delete()
          .eq('id', confirmandoDeleteUsuario.id);

        if (errUser) throw errUser;
      }

      mostrar('sucesso', 'Usuário excluído com sucesso.');
      setConfirmandoDeleteUsuario(null);
      carregarUsuarios();
      if (isMasterAdmin) {
        carregarEmpresas();
      }
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao excluir usuário.');
      setConfirmandoDeleteUsuario(null);
    }
  };

  const buscarHistoricoPagamentos = async (empresaId: string) => {
    setCarregandoHistorico(true);
    const { data, error } = await supabase
      .from('historico_pagamentos_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_pagamento', { ascending: false });
    
    if (!error && data) {
      setHistoricoPagamentos(data);
    } else {
      setHistoricoPagamentos([]);
    }
    setCarregandoHistorico(false);
  };

  const handleConfirmarPagamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaFaturamentoSelecionada) return;
    
    try {
      const valor = parseFloat(formDataPagamento.valor_pago);
      if (isNaN(valor) || valor <= 0) {
        throw new Error('Por favor, informe um valor de pagamento válido.');
      }

      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      
      // Calcular nova data de vencimento
      let novaData = new Date();
      if (empresaFaturamentoSelecionada.data_vencimento) {
        const vencAtual = new Date(empresaFaturamentoSelecionada.data_vencimento + 'T00:00:00');
        // Se já venceu, soma a partir de hoje. Se ainda vai vencer, soma a partir do vencimento atual
        if (vencAtual > hoje) {
          novaData = vencAtual;
        }
      }

      const freq = empresaFaturamentoSelecionada.frequencia_pagamento || 'mensal';
      if (freq === 'mensal') {
        novaData.setMonth(novaData.getMonth() + 1);
      } else if (freq === 'semestral') {
        novaData.setMonth(novaData.getMonth() + 6);
      } else if (freq === 'anual') {
        novaData.setFullYear(novaData.getFullYear() + 1);
      }

      const dataVencString = novaData.toISOString().split('T')[0];

      // 1. Inserir no histórico
      const { error: errHist } = await supabase
        .from('historico_pagamentos_empresa')
        .insert([{
          empresa_id: empresaFaturamentoSelecionada.id,
          valor_pago: valor,
          plano: empresaFaturamentoSelecionada.plano || '.22LR',
          frequencia: freq,
          referencia_vencimento: dataVencString,
          meio_pagamento: formDataPagamento.meio_pagamento,
          observacoes: formDataPagamento.observacoes || null
        }]);

      if (errHist) throw errHist;

      // 2. Atualizar empresa no banco
      const { error: errEmp } = await supabase
        .from('empresas')
        .update({
          data_vencimento: dataVencString,
          plano_status: 'ativo'
        })
        .eq('id', empresaFaturamentoSelecionada.id);

      if (errEmp) throw errEmp;

      mostrar('sucesso', 'Pagamento registrado e vencimento atualizado com sucesso!');
      setModalPagamentoManualAberto(false);
      setFormDataPagamento({ valor_pago: '', meio_pagamento: 'PIX', observacoes: '' });
      carregarEmpresas();
      
      // Recarrega o histórico visual
      buscarHistoricoPagamentos(empresaFaturamentoSelecionada.id);
    } catch (err: any) {
      mostrar('erro', err.message || 'Erro ao registrar pagamento.');
    }
  };

  const toggleStatus = async (user: UsuarioAutorizado) => {
    if (user.email === 'gui.gomesassis@gmail.com') {
      mostrar('aviso', 'O administrador mestre não pode ser desativado.');
      return;
    }

    const novoStatus = !user.ativo;
    const { error } = await supabase
      .from('usuarios_autorizados')
      .update({ ativo: novoStatus })
      .eq('id', user.id);
    
    if (error) {
      mostrar('erro', 'Erro ao alterar status.');
    } else {
      setUsuarios(usuarios.map(u => u.id === user.id ? { ...u, ativo: novoStatus } : u));
      mostrar('sucesso', `Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`);
    }
  };

  const togglePermissao = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(slug)
        ? prev.permissoes.filter(p => p !== slug)
        : [...prev.permissoes, slug]
    }));
  };

  // Filtros de dados com base na aba ou empresa ativa
  const empresasClientes = empresas.filter(e => e.tipo_conta === 'empresa' && e.id !== '00000000-0000-0000-0000-000000000001');
  const cacsClientes = empresas.filter(e => e.tipo_conta === 'cac_individual');

  const calcularMRR = () => {
    return empresasClientes
      .filter(e => e.plano_status === 'ativo' && !e.is_gratis)
      .reduce((soma, e) => {
        let preco = 30.00;
        if (e.valor_assinatura_personalizado != null) {
          preco = parseFloat(e.valor_assinatura_personalizado);
        } else if (e.plano === '.357mag') {
          preco = 50.00;
        } else if (e.plano === '.308win') {
          preco = 100.00;
        }
        
        if (e.frequencia_pagamento === 'semestral') {
          preco = preco / 6;
        } else if (e.frequencia_pagamento === 'anual') {
          preco = preco / 12;
        }
        return soma + (isNaN(preco) ? 0 : preco);
      }, 0);
  };

  const calcularMRRCac = () => {
    return cacsClientes
      .filter(e => e.plano_status === 'ativo' && !e.is_gratis)
      .reduce((soma, e) => {
        let preco = 30.00;
        if (e.valor_assinatura_personalizado != null) {
          preco = parseFloat(e.valor_assinatura_personalizado);
        } else if (e.plano === '.357mag') {
          preco = 50.00;
        } else if (e.plano === '.308win') {
          preco = 100.00;
        }
        
        if (e.frequencia_pagamento === 'semestral') {
          preco = preco / 6;
        } else if (e.frequencia_pagamento === 'anual') {
          preco = preco / 12;
        }
        return soma + (isNaN(preco) ? 0 : preco);
      }, 0);
  };

  const calcularEmpresasEmAtraso = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return empresasClientes.filter(e => {
      const dataVenc = e.data_vencimento ? new Date(e.data_vencimento + 'T00:00:00') : null;
      return dataVenc && dataVenc < hoje && !e.is_gratis && e.plano_status !== 'suspenso';
    }).length;
  };

  const calcularCacsEmAtraso = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return cacsClientes.filter(e => {
      const dataVenc = e.data_vencimento ? new Date(e.data_vencimento + 'T00:00:00') : null;
      return dataVenc && dataVenc < hoje && !e.is_gratis && e.plano_status !== 'suspenso';
    }).length;
  };

  const obterEmpresasClientesExibidos = () => {
    if (!buscaFaturamento.trim()) return empresasClientes;
    const q = buscaFaturamento.toLowerCase();
    return empresasClientes.filter(e => 
      e.nome.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q)
    );
  };

  const obterCacsClientesExibidos = () => {
    const q = buscaFaturamento.toLowerCase();
    return cacsClientes.filter(e => {
      const cacUser = usuarios.find(u => u.empresa_id === e.id);
      const vinculados = vinculosAtivos.filter(v => v.cac_empresa_id === e.id);
      const despachantesNomes = vinculados.map(v => v.despachante_nome).join(' ');
      
      const nomeMatch = e.nome.toLowerCase().includes(q);
      const userMatch = cacUser ? (
        cacUser.nome.toLowerCase().includes(q) ||
        cacUser.email.toLowerCase().includes(q) ||
        (cacUser.cpf && cacUser.cpf.includes(q))
      ) : false;
      const despachanteMatch = despachantesNomes.toLowerCase().includes(q);

      return !buscaFaturamento.trim() || nomeMatch || userMatch || despachanteMatch;
    });
  };
  
  const cacsUsuarios = usuarios.filter(u => {
    const emp = empresas.find(e => e.id === u.empresa_id);
    return emp?.tipo_conta === 'cac_individual';
  });

  const equipeInternaUsuarios = usuarios.filter(u => u.empresa_id === '00000000-0000-0000-0000-000000000001');

  const getUsuariosExibidos = () => {
    let baseLista: UsuarioAutorizado[] = [];
    if (!isMasterAdmin) {
      baseLista = usuarios;
    } else if (empresaGerenciada) {
      baseLista = usuarios.filter(u => u.empresa_id === empresaGerenciada.id);
    } else if (subPainelAtivo === 'cacs') {
      baseLista = cacsUsuarios;
    } else if (subPainelAtivo === 'equipe_interna') {
      baseLista = equipeInternaUsuarios;
    }
    
    const termo = buscaUsuario.toLowerCase().trim();
    if (!termo) return baseLista;
    return baseLista.filter(u => 
      (u.nome || '').toLowerCase().includes(termo) ||
      (u.email || '').toLowerCase().includes(termo) ||
      (u.cpf || '').toLowerCase().includes(termo)
    );
  };

  return (
    <div className="space-y-6">
      <Notificacao {...notif} onFechar={fechar} />

      {/* ──────────────── MASTER ADMIN PANEL ──────────────── */}
      {isMasterAdmin && (
        <div className="space-y-4">
          {/* Seletor de Perfis no topo (apenas se nenhuma empresa estiver sendo gerenciada no detalhe) */}
          {!empresaGerenciada && (
            <div className="flex flex-wrap gap-2 pb-4 border-b border-brand-dark-5">
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('empresas'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'empresas'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <Building size={14} />
                Usuários Empresa (B2B Tenants)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('cacs'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'cacs'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <User size={14} />
                Atiradores e Caçadores (CAC Individual)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('equipe_interna'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'equipe_interna'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <Shield size={14} />
                Equipe do Escritório (Staff)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('faturamento'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'faturamento'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <BadgeDollarSign size={14} />
                Faturamento & Licenças
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('leads'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'leads'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus size={14} />
                Pré-Cadastros (Leads)
              </button>
              <button
                type="button"
                onClick={() => { setSubPainelAtivo('monitor_cacs'); setBuscaUsuario(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  subPainelAtivo === 'monitor_cacs'
                    ? 'bg-brand-blue/15 border-brand-blue/30 text-white font-bold'
                    : 'bg-brand-dark-3 border-brand-dark-5 text-gray-400 hover:text-white'
                }`}
              >
                <Crosshair size={14} />
                Monitor de Atiradores (Acervo)
              </button>
            </div>
          )}

          {/* ABA 1: GERENCIAMENTO GERAL DE EMPRESAS (Se nenhuma empresa específica estiver aberta) */}
          {subPainelAtivo === 'empresas' && !empresaGerenciada && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building size={16} className="text-brand-blue" />
                    Empresas & Clientes Contratantes (B2B)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Crie e configure workspaces para escritórios de despachantes externos</p>
                </div>
              </div>

              {/* Form Cadastro Empresa */}
              <form onSubmit={handleCriarEmpresa} className="flex flex-col sm:flex-row gap-2 max-w-xl bg-brand-dark-3/50 p-4 rounded-xl border border-brand-dark-5">
                <input
                  type="text"
                  required
                  placeholder="Nome do Novo Despachante / Empresa"
                  value={novaEmpresaNome}
                  onChange={e => setNovaEmpresaNome(e.target.value)}
                  className="input flex-1"
                />
                <select
                  value={novaEmpresaTipo}
                  onChange={e => setNovaEmpresaTipo(e.target.value as any)}
                  className="input sm:w-56"
                >
                  <option value="empresa" className="bg-brand-dark-2 text-white">Perfil Empresa (Banco Limpo)</option>
                  <option value="cac_individual" className="bg-brand-dark-2 text-white">Perfil CAC Individual</option>
                </select>
                <button type="submit" className="btn-primary px-4 shrink-0">
                  Criar Cadastro
                </button>
              </form>

              {/* Lista Empresas */}
              {carregandoEmpresas ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : empresasClientes.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">Nenhuma empresa B2B cadastrada.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Empresa (Tenant)</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Plano / Cobrança</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Limites (Staff/CACs)</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Vencimento / Setup</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                       {empresasClientes.map(e => {
                         const hoje = new Date();
                         hoje.setHours(0, 0, 0, 0);
                         const dataVenc = e.data_vencimento ? new Date(e.data_vencimento + 'T00:00:00') : null;
                         const ehExpirado = dataVenc && dataVenc < hoje && !e.is_gratis;
                         
                         const obterPrecoEstilizado = () => {
                           if (e.is_gratis) return 'Isento';
                           if (e.valor_assinatura_personalizado != null) return `R$ ${parseFloat(e.valor_assinatura_personalizado).toFixed(2)}`;
                           if (e.plano === '.22LR') return 'R$ 30,00';
                           if (e.plano === '.357mag') return 'R$ 50,00';
                           if (e.plano === '.308win') return 'R$ 100,00';
                           return 'R$ 30,00';
                         };
                         
                         const obterFrequenciaLabel = () => {
                           if (e.frequencia_pagamento === 'semestral') return 'Semestral';
                           if (e.frequencia_pagamento === 'anual') return 'Anual';
                           return 'Mensal';
                         };

                         return (
                           <tr key={e.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                             <td className="px-3 py-3">
                               <div className="flex items-center gap-1.5">
                                 <p className="font-bold text-white text-sm truncate max-w-[150px]" title={e.nome}>{e.nome}</p>
                                 <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                   B2B
                                 </span>
                               </div>
                               <p className="text-[10px] text-gray-500 font-mono mt-0.5 select-all truncate max-w-[120px]" title={e.id}>{e.id.substring(0, 8)}...</p>
                             </td>
                             <td className="px-3 py-3">
                               <div className="flex flex-col gap-0.5">
                                 <div className="flex items-center gap-1">
                                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                     e.plano === '.308win' ? 'bg-brand-blue/15 text-brand-blue-light border-brand-blue/30' :
                                     e.plano === '.357mag' ? 'bg-brand-green/10 text-brand-green-light border-brand-green/20' :
                                     'bg-gray-600/20 text-gray-400 border-gray-500/20'
                                   }`}>
                                     {e.plano || '.22LR'}
                                   </span>
                                   {e.is_gratis && (
                                     <span className="text-[8px] font-bold uppercase bg-brand-green/15 text-brand-green px-1 py-0.5 rounded border border-brand-green/20">
                                       Isento
                                     </span>
                                   )}
                                   {e.valor_assinatura_personalizado != null && !e.is_gratis && (
                                     <span className="text-[8px] font-bold uppercase bg-yellow-500/10 text-yellow-400 px-1 py-0.5 rounded border border-yellow-500/20">
                                       Custom
                                     </span>
                                   )}
                                 </div>
                                 <span className="text-[10px] text-gray-400 font-semibold">
                                   {obterPrecoEstilizado()} • {obterFrequenciaLabel()}
                                 </span>
                               </div>
                             </td>
                             <td className="px-3 py-3">
                               <div className="text-[11px] text-gray-300 space-y-0.5">
                                 <p>Eq: <strong className="text-white">{e.limite_usuarios_staff ?? 1}</strong></p>
                                 <p>Cac: <strong className="text-white">{e.limite_cac_vinculados ?? 20}</strong></p>
                               </div>
                             </td>
                             <td className="px-3 py-3 text-xs">
                               <div className="space-y-0.5">
                                 <div className="flex items-center gap-1">
                                   <span className={`text-[10px] font-bold ${ehExpirado ? 'text-red-400' : 'text-gray-400'}`}>
                                     Venc: {e.data_vencimento ? formatarData(e.data_vencimento) : 'Sem data'}
                                   </span>
                                   {ehExpirado && (
                                     <span className="text-[8px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.5 rounded">
                                       Vencido
                                     </span>
                                   )}
                                 </div>
                                 <p className="text-[10px] flex items-center gap-1 text-gray-500">
                                   Setup: {' '}
                                   <span className={e.taxa_implementacao_paga ? 'text-brand-green font-bold' : 'text-yellow-500 font-bold'}>
                                     {e.taxa_implementacao_paga ? 'Pago' : `Pendente`}
                                   </span>
                                 </p>
                               </div>
                             </td>
                             <td className="px-3 py-3 text-right">
                               <div className="flex items-center justify-end gap-1">
                                 <button
                                   onClick={() => setEmpresaGerenciada(e)}
                                   className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-blue/10 border border-brand-blue/20 hover:bg-brand-blue/20 text-brand-blue-light text-[10px] font-bold uppercase tracking-wider transition-colors"
                                 >
                                   <Settings2 size={12} />
                                   Gerenciar
                                 </button>
                                 <button 
                                   onClick={() => setEmpresaEditando({ ...e })}
                                   className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                                   title="Editar Cadastro Básico"
                                 >
                                   <Edit2 size={14} />
                                 </button>
                                 <button 
                                   onClick={() => setConfirmandoDeleteEmpresa({ id: e.id, nome: e.nome })}
                                   className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-brand-dark-3 rounded-xl transition-all"
                                   title="Excluir Empresa"
                                 >
                                   <Trash2 size={14} />
                                 </button>
                               </div>
                             </td>
                           </tr>
                         );
                       })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DETALHE DA EMPRESA GERENCIADA (Controles da Empresa + Colaboradores dela) */}
          {subPainelAtivo === 'empresas' && empresaGerenciada && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setEmpresaGerenciada(null)}
                  className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-400 hover:text-white transition-colors bg-brand-dark-3 px-3 py-1.5 rounded-xl border border-brand-dark-5"
                >
                  <ArrowLeft size={14} />
                  Voltar para Lista de Empresas
                </button>
                <div className="text-right">
                  <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <Building className="text-brand-blue" size={18} />
                    Gerenciando: {empresaGerenciada.nome}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lado Esquerdo: Configuração da Empresa */}
                <div className="card space-y-4 h-fit border border-brand-dark-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
                  <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Parâmetros do Workspace</span>
                    <Building size={14} className="text-brand-blue" />
                  </div>
                  
                  <form onSubmit={handleSalvarEdicaoEmpresa} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase">Nome do Despachante</label>
                      <input
                        type="text"
                        required
                        value={empresaGerenciada.nome}
                        onChange={e => setEmpresaGerenciada({ ...empresaGerenciada, nome: e.target.value })}
                        className="input text-sm w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase">Limite de CACs Vinculados</label>
                      <input
                        type="number"
                        min={1} max={1000}
                        required
                        value={empresaGerenciada.limite_cac_vinculados ?? 10}
                        onChange={e => setEmpresaGerenciada({ ...empresaGerenciada, limite_cac_vinculados: parseInt(e.target.value) || 10 })}
                        className="input text-sm w-full font-bold text-brand-blue-light"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-brand-dark-5">
                      <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
                        Ferramentas / Recursos Habilitados
                      </label>
                      <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {RECURSOS_SISTEMA.map(rec => {
                          const ativo = empresaGerenciada.recursos_liberados?.includes(rec.key);
                          return (
                            <button
                              key={rec.key}
                              type="button"
                              onClick={() => {
                                const novosRecursos = ativo
                                  ? (empresaGerenciada.recursos_liberados || []).filter((r: string) => r !== rec.key)
                                  : [...(empresaGerenciada.recursos_liberados || []), rec.key];
                                setEmpresaGerenciada({
                                  ...empresaGerenciada,
                                  recursos_liberados: novosRecursos
                                });
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition-all text-left ${
                                ativo
                                  ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                                  : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-gray-700'
                              }`}
                            >
                              <span className="break-words pr-3 leading-tight">{rec.label}</span>
                              {ativo ? (
                                <CheckCircle size={13} className="text-brand-green shrink-0 ml-1" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('empresas')
                            .update({
                              nome: empresaGerenciada.nome.trim(),
                              limite_cac_vinculados: empresaGerenciada.limite_cac_vinculados,
                              recursos_liberados: empresaGerenciada.recursos_liberados
                            })
                            .eq('id', empresaGerenciada.id);
                          if (error) throw error;
                          mostrar('sucesso', 'Configurações da empresa salvas com sucesso.');
                          carregarEmpresas();
                        } catch (err: any) {
                          mostrar('erro', err.message || 'Erro ao salvar alterações.');
                        }
                      }}
                      className="btn-primary w-full py-2.5 font-bold uppercase tracking-wider text-xs"
                    >
                      Salvar Alterações
                    </button>
                  </form>
                </div>

                {/* Lado Direito: Usuários vinculados a este Despachante */}
                <div className="lg:col-span-2 card space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Colaboradores & Acessos do Despachante</span>
                      <p className="text-xs text-gray-400 mt-0.5">Gerencie os funcionários que acessam o workspace deste cliente</p>
                    </div>
                    <button 
                      onClick={() => handleAbrirModal()} 
                      className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                    >
                      <UserPlus size={13} /> Adicionar Membro
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={buscaUsuario}
                      onChange={e => setBuscaUsuario(e.target.value)}
                      placeholder="Buscar por nome, e-mail ou CPF..."
                      className="input w-full text-xs"
                    />
                  </div>

                  {getUsuariosExibidos().length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-8">Nenhum funcionário cadastrado para esta empresa.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                      <table className="w-full text-left border-collapse min-w-[850px]">
                        <thead>
                          <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Usuário</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Função</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-dark-5">
                          {getUsuariosExibidos().map(u => (
                            <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                              <td className="p-3">
                                <p className="font-bold text-white text-sm">{u.nome}</p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                              </td>
                              <td className="p-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                                  u.role === 'admin' 
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                    : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                                }`}>
                                  {u.role === 'admin' ? 'Admin' : 'Colaborador'}
                                </span>
                              </td>
                              <td className="p-3 text-xs text-gray-300">
                                {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                                {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(u)}
                                  className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                                >
                                  <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                    {u.ativo ? 'Ativo' : 'Inativo'}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleAbrirModal(u)}
                                  className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                                  title="Editar Acessos"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: ATIRADORES E CAÇADORES (CAC INDIVIDUAL - B2C) */}
          {subPainelAtivo === 'cacs' && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <User size={16} className="text-brand-blue" />
                    Atiradores e Caçadores (CAC Individual)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Gerencie os usuários finais CPF que usam o portal de forma autônoma</p>
                </div>
                <button 
                  onClick={() => handleAbrirModal()} 
                  className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  <UserPlus size={13} /> Cadastrar CAC Manual
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar atirador por nome, e-mail ou CPF..."
                  className="input w-full text-xs"
                />
              </div>

              {getUsuariosExibidos().length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-8">Nenhum atirador ou caçador individual cadastrado no sistema.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Atirador / Caçador</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Vínculo de Sistema (ID Workspace)</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Contatos / CPF</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {getUsuariosExibidos().map(u => (
                        <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-white text-sm">{u.nome}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="p-3 text-xs font-mono text-gray-400">
                            {u.empresa_id ? (
                              <span className="bg-brand-dark-3 px-2 py-1 rounded text-xs select-all hover:text-white transition-colors animate-fade-in" title={u.empresa_id}>
                                {u.empresa_id.substring(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-gray-600 italic">Não Vinculado</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-gray-300">
                            {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                            {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                            >
                              <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleAbrirModal(u)}
                                className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                                title="Editar Acessos"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmandoDeleteUsuario({ id: u.id, nome: u.nome, empresa_id: u.empresa_id })}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-brand-dark-3 rounded-xl transition-all"
                                title="Excluir Usuário"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: EQUIPE INTERNA DO ESCRITÓRIO MÃE (STAFF) */}
          {subPainelAtivo === 'equipe_interna' && (
            <div className="card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield size={16} className="text-brand-blue" />
                    Equipe do Escritório (Staff Interno)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Gerencie os colaboradores da matriz do G CAC Despachante Bélico</p>
                </div>
                <button 
                  onClick={() => handleAbrirModal()} 
                  className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  <UserPlus size={13} /> Novo Colaborador
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar colaborador por nome, e-mail ou CPF..."
                  className="input w-full text-xs"
                />
              </div>

              {getUsuariosExibidos().length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-8">Nenhum funcionário cadastrado no escritório central.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Colaborador</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Nível de Staff</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {getUsuariosExibidos().map(u => (
                        <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-white text-sm">{u.nome}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                              u.role === 'admin' 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                            }`}>
                              {u.role === 'admin' ? 'Admin Mestre' : 'Colaborador Matriz'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-300">
                            {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                            {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                            >
                              <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleAbrirModal(u)}
                              className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                              title="Editar Permissões"
                            >
                              <Edit2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* ABA 4: GESTÃO DE FATURAMENTO & LICENÇAS */}
          {subPainelAtivo === 'faturamento' && (
            <div className="space-y-6 animate-fade-in">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MRR Previsto (Recorrência)</p>
                    <p className="text-xl font-black text-brand-blue-light mt-1">
                      R$ {(abaFaturamento === 'empresas' ? calcularMRR() : calcularMRRCac()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-3 bg-brand-blue/10 rounded-xl text-brand-blue-light">
                    <BadgeDollarSign size={20} />
                  </div>
                </div>

                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      {abaFaturamento === 'empresas' ? 'Empresas em Atraso' : 'Atiradores em Atraso'}
                    </p>
                    <p className="text-xl font-black text-red-400 mt-1 font-mono">
                      {abaFaturamento === 'empresas' ? calcularEmpresasEmAtraso() : calcularCacsEmAtraso()}
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
                    <XCircle size={20} />
                  </div>
                </div>

                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      {abaFaturamento === 'empresas' ? 'Total de Empresas B2B' : 'Total de Atiradores B2C'}
                    </p>
                    <p className="text-xl font-black text-white mt-1">
                      {abaFaturamento === 'empresas' ? empresasClientes.length : cacsClientes.length}
                    </p>
                  </div>
                  <div className="p-3 bg-brand-dark-3 rounded-xl text-gray-400">
                    {abaFaturamento === 'empresas' ? <Building size={20} /> : <User size={20} />}
                  </div>
                </div>
              </div>

              {/* Lista de Empresas/Atiradores para Faturamento */}
              <div className="card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-brand-dark-5">
                  <div className="flex border-b border-transparent gap-4">
                    <button
                      type="button"
                      onClick={() => { setAbaFaturamento('empresas'); setBuscaFaturamento(''); }}
                      className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                        abaFaturamento === 'empresas' 
                          ? 'border-brand-blue text-white font-extrabold' 
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Empresas Despachantes (B2B)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAbaFaturamento('cacs'); setBuscaFaturamento(''); }}
                      className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                        abaFaturamento === 'cacs' 
                          ? 'border-brand-blue text-white font-extrabold' 
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Atiradores CAC (B2C)
                    </button>
                  </div>

                  <input
                    type="text"
                    value={buscaFaturamento}
                    onChange={e => setBuscaFaturamento(e.target.value)}
                    placeholder={abaFaturamento === 'empresas' ? "Buscar empresa..." : "Buscar atirador, email, CPF ou despachante..."}
                    className="input text-xs w-full sm:max-w-xs"
                  />
                </div>

                <div>
                  <p className="text-xs text-gray-400 mt-1">
                    {abaFaturamento === 'empresas' 
                      ? 'Registre pagamentos manuais, controle vencimentos e suspenda workspaces de despachantes.' 
                      : 'Monitore pagamentos, vencimentos e despachantes parceiros dos atiradores individuais (B2C).'}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  {abaFaturamento === 'empresas' ? (
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Empresa</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Plano</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Preço Custom / Período</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Situação</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Vencimento</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark-5">
                        {obterEmpresasClientesExibidos().map(e => {
                          const hoje = new Date();
                          hoje.setHours(0,0,0,0);
                          const dataVenc = e.data_vencimento ? new Date(e.data_vencimento + 'T00:00:00') : null;
                          const ehExpirado = dataVenc && dataVenc < hoje && !e.is_gratis;
                          const diasAteVencer = dataVenc ? Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)) : null;
                          
                          const obterPrecoEstilizado = () => {
                            if (e.is_gratis) return 'Isento';
                            if (e.valor_assinatura_personalizado != null) return `R$ ${parseFloat(e.valor_assinatura_personalizado).toFixed(2)}`;
                            if (e.plano === '.22LR') return 'R$ 30,00';
                            if (e.plano === '.357mag') return 'R$ 50,00';
                            if (e.plano === '.308win') return 'R$ 100,00';
                            return 'R$ 30,00';
                          };

                          const obterFrequenciaLabel = () => {
                            if (e.frequencia_pagamento === 'semestral') return 'Semestral';
                            if (e.frequencia_pagamento === 'anual') return 'Anual';
                            return 'Mensal';
                          };

                          const obterStatusBadge = () => {
                            if (e.is_gratis) {
                              return <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 font-bold text-[9px] uppercase tracking-wider">Isento</span>;
                            }
                            if (e.plano_status === 'suspenso') {
                              return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[9px] uppercase tracking-wider">Suspenso</span>;
                            }
                            if (ehExpirado) {
                              return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[9px] uppercase tracking-wider">Atrasado</span>;
                            }
                            if (diasAteVencer !== null && diasAteVencer <= 5) {
                              return <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold text-[9px] uppercase tracking-wider">Expira em {diasAteVencer}d</span>;
                            }
                            return <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 font-bold text-[9px] uppercase tracking-wider">Em dia</span>;
                          };

                          return (
                            <tr key={e.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                              <td className="px-3 py-3">
                                <p className="font-bold text-white text-sm truncate max-w-[150px]" title={e.nome}>{e.nome}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5 select-all truncate max-w-[120px]" title={e.id}>{e.id.substring(0, 8)}...</p>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  e.plano === '.308win' ? 'bg-brand-blue/15 text-brand-blue-light border-brand-blue/30' :
                                  e.plano === '.357mag' ? 'bg-brand-green/10 text-brand-green-light border-brand-green/20' :
                                  'bg-gray-600/20 text-gray-400 border-gray-500/20'
                                }`}>
                                  {e.plano || '.22LR'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                <p className="font-bold text-white">{obterPrecoEstilizado()}</p>
                                <p className="text-gray-500 text-[10px] uppercase font-semibold">{obterFrequenciaLabel()}</p>
                              </td>
                              <td className="px-3 py-3">
                                {obterStatusBadge()}
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                {e.data_vencimento ? formatarData(e.data_vencimento) : <span className="text-gray-500 italic">Sem vencimento</span>}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEmpresaFaturamentoSelecionada(e);
                                      let precoPadrao = '30';
                                      if (e.plano === '.357mag') precoPadrao = '50';
                                      else if (e.plano === '.308win') precoPadrao = '100';
                                      
                                      const valorAssinatura = e.valor_assinatura_personalizado != null 
                                        ? e.valor_assinatura_personalizado.toString()
                                        : precoPadrao;

                                      setFormDataPagamento({
                                        valor_pago: valorAssinatura,
                                        meio_pagamento: 'PIX',
                                        observacoes: `Renovação de plano ${e.plano || '.22LR'}`
                                      });
                                      setModalPagamentoManualAberto(true);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-green/10 border border-brand-green/20 hover:bg-brand-green/20 text-brand-green-light text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    <BadgeDollarSign size={12} />
                                    Confirmar Pago
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setEmpresaFaturamentoSelecionada(e);
                                      buscarHistoricoPagamentos(e.id);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600 text-gray-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    <Calendar size={12} />
                                    Histórico
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[950px]">
                      <thead>
                        <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Cliente (Atirador)</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Empresa Vinculada</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Plano</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Preço Custom / Período</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Situação</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Data Ativação</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Último Pagamento</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Vencimento</th>
                          <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark-5">
                        {obterCacsClientesExibidos().map(e => {
                          const hoje = new Date();
                          hoje.setHours(0,0,0,0);
                          const dataVenc = e.data_vencimento ? new Date(e.data_vencimento + 'T00:00:00') : null;
                          const ehExpirado = dataVenc && dataVenc < hoje && !e.is_gratis;
                          const diasAteVencer = dataVenc ? Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)) : null;
                          
                          const cacUser = usuarios.find(u => u.empresa_id === e.id);
                          const vinculados = vinculosAtivos.filter(v => v.cac_empresa_id === e.id);
                          const despachantesNomes = vinculados.length > 0 
                            ? vinculados.map(v => v.despachante_nome).join(', ') 
                            : 'Nenhum despachante';

                          const pagamentosCac = todosPagamentos.filter(p => p.empresa_id === e.id);
                          const ultimoPagamento = pagamentosCac.length > 0 ? pagamentosCac[0] : null;

                          const obterPrecoEstilizado = () => {
                            if (e.is_gratis) return 'Isento';
                            if (e.valor_assinatura_personalizado != null) return `R$ ${parseFloat(e.valor_assinatura_personalizado).toFixed(2)}`;
                            if (e.plano === '.22LR') return 'R$ 30,00';
                            if (e.plano === '.357mag') return 'R$ 50,00';
                            if (e.plano === '.308win') return 'R$ 100,00';
                            return 'R$ 30,00';
                          };

                          const obterFrequenciaLabel = () => {
                            if (e.frequencia_pagamento === 'semestral') return 'Semestral';
                            if (e.frequencia_pagamento === 'anual') return 'Anual';
                            return 'Mensal';
                          };

                          const obterStatusBadge = () => {
                            if (e.is_gratis) {
                              return <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 font-bold text-[9px] uppercase tracking-wider">Isento</span>;
                            }
                            if (e.plano_status === 'suspenso') {
                              return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[9px] uppercase tracking-wider">Suspenso</span>;
                            }
                            if (ehExpirado) {
                              return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[9px] uppercase tracking-wider">Atrasado</span>;
                            }
                            if (diasAteVencer !== null && diasAteVencer <= 5) {
                              return <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold text-[9px] uppercase tracking-wider">Expira em {diasAteVencer}d</span>;
                            }
                            return <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 font-bold text-[9px] uppercase tracking-wider">Em dia</span>;
                          };

                          return (
                            <tr key={e.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                              <td className="px-3 py-3">
                                <p className="font-bold text-white text-sm truncate max-w-[200px]" title={cacUser?.nome || e.nome}>
                                  {cacUser?.nome || e.nome.replace('CAC - ', '')}
                                </p>
                                {cacUser && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 select-all" title={cacUser.email}>
                                    {cacUser.email} {cacUser.cpf ? `• CPF: ${cacUser.cpf}` : ''}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                <p className="font-semibold text-brand-blue-light truncate max-w-[150px]" title={despachantesNomes}>
                                  {despachantesNomes}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  e.plano === '.308win' ? 'bg-brand-blue/15 text-brand-blue-light border-brand-blue/30' :
                                  e.plano === '.357mag' ? 'bg-brand-green/10 text-brand-green-light border-brand-green/20' :
                                  'bg-gray-600/20 text-gray-400 border-gray-500/20'
                                }`}>
                                  {e.plano || '.22LR'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                <p className="font-bold text-white">{obterPrecoEstilizado()}</p>
                                <p className="text-gray-500 text-[10px] uppercase font-semibold">{obterFrequenciaLabel()}</p>
                              </td>
                              <td className="px-3 py-3">
                                {obterStatusBadge()}
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                {e.criado_em ? formatarData(e.criado_em) : <span className="text-gray-500 italic">—</span>}
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                {ultimoPagamento ? (
                                  <div>
                                    <p className="font-bold text-white">{new Date(ultimoPagamento.data_pagamento).toLocaleDateString('pt-BR')}</p>
                                    <p className="text-[10px] text-gray-500">{new Date(ultimoPagamento.data_pagamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 italic">Nunca registrado</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-xs text-gray-300">
                                {e.data_vencimento ? formatarData(e.data_vencimento) : <span className="text-gray-500 italic">Sem vencimento</span>}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEmpresaFaturamentoSelecionada(e);
                                      let precoPadrao = '30';
                                      if (e.plano === '.357mag') precoPadrao = '50';
                                      else if (e.plano === '.308win') precoPadrao = '100';
                                      
                                      const valorAssinatura = e.valor_assinatura_personalizado != null 
                                        ? e.valor_assinatura_personalizado.toString()
                                        : precoPadrao;

                                      setFormDataPagamento({
                                        valor_pago: valorAssinatura,
                                        meio_pagamento: 'PIX',
                                        observacoes: `Renovação de plano CAC ${e.plano || '.22LR'}`
                                      });
                                      setModalPagamentoManualAberto(true);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-green/10 border border-brand-green/20 hover:bg-brand-green/20 text-brand-green-light text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    <BadgeDollarSign size={12} />
                                    Confirmar Pago
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setEmpresaFaturamentoSelecionada(e);
                                      buscarHistoricoPagamentos(e.id);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600 text-gray-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    <Calendar size={12} />
                                    Histórico
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ABA 5: SOLICITAÇÕES DE PRÉ-CADASTRO (LEADS) */}
          {subPainelAtivo === 'leads' && (
            <div className="card space-y-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserPlus size={16} className="text-brand-blue" />
                  Solicitações de Pré-Cadastro (Leads)
                </h3>
                <p className="text-xs text-gray-500 mt-1">Gerencie os novos despachantes e clientes individuais que solicitaram acesso pelo site</p>
              </div>

              {carregandoLeads ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : leads.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">Nenhuma solicitação de pré-cadastro encontrada.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Perfil Solicitante</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">E-mail / Contato</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">CPF / Documento</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Plano</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Data Cadastro</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5">
                      {leads.map(lead => {
                        const ehCac = lead.tipo_usuario === 'cac_individual';
                        return (
                          <tr key={lead.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                            <td className="px-3 py-3">
                              <p className="font-bold text-white text-sm">{lead.nome}</p>
                              <span className={`inline-block mt-0.5 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                                ehCac 
                                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' 
                                  : 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30'
                              }`}>
                                {ehCac ? 'CAC Individual' : 'Despachante'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <p className="text-white font-medium">{lead.email}</p>
                              <p className="text-gray-400 font-mono mt-0.5">{lead.contato ? formatarTelefoneExibicao(lead.contato) : 'Sem contato'}</p>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-gray-300">
                              {lead.cpf ? formatarCpfExibicao(lead.cpf) : 'Sem CPF'}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs font-bold text-white bg-brand-dark-5 px-2 py-1 rounded-md border border-brand-dark-5">
                                {lead.plano}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-400">
                              {lead.criado_em ? formatarData(lead.criado_em) : 'Sem data'}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                lead.status === 'ativado' ? 'bg-brand-green/20 text-brand-green border-brand-green/30' :
                                lead.status === 'contatado' ? 'bg-brand-blue/20 text-brand-blue-light border-brand-blue/30' :
                                lead.status === 'cancelado' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              }`}>
                                {lead.status === 'ativado' ? 'Ativado' :
                                 lead.status === 'contatado' ? 'Contatado' :
                                 lead.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {lead.status !== 'ativado' && (
                                  <button
                                    onClick={() => handleAtivarLead(lead)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-green hover:bg-brand-green-light text-black text-[10px] font-black uppercase tracking-wider transition-colors shadow-md"
                                  >
                                    <CheckCircle size={12} />
                                    Ativar
                                  </button>
                                )}
                                {lead.status === 'pendente' && (
                                  <button
                                    onClick={() => handleMarcarContatado(lead.id)}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-brand-dark-3 border border-brand-dark-5 hover:border-brand-blue text-brand-blue-light text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Contatar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleExcluirLead(lead.id)}
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-brand-dark-3 rounded-xl transition-all"
                                  title="Excluir Pré-Cadastro"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* ABA 6: MONITOR GLOBAL DE ATIRADORES CAC */}
          {subPainelAtivo === 'monitor_cacs' && (
            <div className="animate-fade-in pt-2">
              <PainelAtiradores />
            </div>
          )}
        </div>
      )}

      {/* ──────────────── CO-ADMIN (TENANT ADMIN) PANEL ──────────────── */}
      {!isMasterAdmin && (
        <div className="card space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-brand-dark-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-brand-blue" />
                Painel de Controle de Usuários
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Gerencie os colaboradores autorizados a acessar as informações da sua empresa</p>
            </div>
            <button 
              onClick={() => handleAbrirModal()} 
              className="btn-primary btn-sm px-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
            >
              <UserPlus size={13} /> Adicionar Colaborador
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={buscaUsuario}
              onChange={e => setBuscaUsuario(e.target.value)}
              placeholder="Buscar colaborador por nome, e-mail ou CPF..."
              className="input w-full text-xs"
            />
          </div>

          {getUsuariosExibidos().length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-8">Nenhum colaborador cadastrado para esta empresa.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-brand-dark-5">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Usuário</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Função</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Identificação</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {getUsuariosExibidos().map(u => (
                    <tr key={u.id} className="bg-brand-dark-4/40 hover:bg-brand-dark-4 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-white text-sm">{u.nome}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</p>
                      </td>
                      <td className="p-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                          u.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : 'Colaborador'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-300">
                        {u.cpf ? <p className="font-mono">{u.cpf}</p> : <p className="text-gray-500 italic">Sem CPF</p>}
                        {u.contato && <p className="text-gray-400 mt-0.5">{u.contato}</p>}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleStatus(u)}
                          className="flex items-center gap-1 text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-lg bg-brand-dark-3 border border-brand-dark-5 hover:border-gray-600"
                        >
                          <span className={u.ativo ? 'text-brand-green' : 'text-red-400'}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleAbrirModal(u)}
                          className="p-1.5 text-gray-400 hover:text-brand-blue-light hover:bg-brand-dark-3 rounded-xl transition-all"
                          title="Editar Acessos"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── MODAL CADASTRO/EDIÇÃO DE USUÁRIO ──────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-brand-blue" />
                {editando ? 'Editar Usuário' : 'Novo Usuário Autorizado'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">E-mail (Google)</label>
                  <input
                    type="email"
                    required
                    disabled={!!editando && editando.email === 'gui.gomesassis@gmail.com'}
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="email@gmail.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Contato</label>
                  <input
                    type="text"
                    value={formData.contato}
                    onChange={e => setFormData({ ...formData, contato: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Se for Master Admin e não houver empresa selecionada, nem for aba interna/CAC, exibe dropdown de Empresa */}
              {isMasterAdmin && !empresaGerenciada && subPainelAtivo === 'empresas' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Empresa (Tenant)</label>
                  <select
                    value={formData.empresa_id}
                    onChange={e => setFormData({ ...formData, empresa_id: e.target.value })}
                    className="input w-full text-sm"
                  >
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-brand-dark-2 text-white text-xs">
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Nível de Acesso</label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer group">
                    <input
                      type="radio"
                      className="hidden"
                      checked={formData.role === 'colaborador'}
                      onChange={() => setFormData({ ...formData, role: 'colaborador' })}
                    />
                    <div className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      formData.role === 'colaborador' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-dark-5 bg-brand-dark-4 hover:border-gray-700'
                    }`}>
                      <User size={18} className={formData.role === 'colaborador' ? 'text-brand-blue' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase ${formData.role === 'colaborador' ? 'text-white' : 'text-gray-500'}`}>Colaborador</span>
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer group">
                    <input
                      type="radio"
                      className="hidden"
                      checked={formData.role === 'admin'}
                      onChange={() => setFormData({ ...formData, role: 'admin' })}
                    />
                    <div className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      formData.role === 'admin' ? 'border-purple-500 bg-purple-500/5' : 'border-brand-dark-5 bg-brand-dark-4 hover:border-gray-700'
                    }`}>
                      <Shield size={18} className={formData.role === 'admin' ? 'text-purple-400' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase ${formData.role === 'admin' ? 'text-white' : 'text-gray-500'}`}>Administrador</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Módulos Permitidos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODULOS.map(m => (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => togglePermissao(m.slug)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes(m.slug)
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      {m.label}
                      {formData.permissoes.includes(m.slug) ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                  ))}
                </div>
              </div>

              {formData.role === 'colaborador' && (
                <div className="space-y-2 border-t border-brand-dark-5 pt-3">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Permissões Especiais</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => togglePermissao('fat_geral')}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes('fat_geral')
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      Ver Faturamento Geral
                      {formData.permissoes.includes('fat_geral') ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePermissao('excluir_registros')}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all ${
                        formData.permissoes.includes('excluir_registros')
                          ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                          : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-700'
                      }`}
                    >
                      Excluir Registros (OS/Fin/etc.)
                      {formData.permissoes.includes('excluir_registros') ? <CheckCircle size={14} className="text-brand-green" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-700" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-brand-dark-5 pt-3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Ferramentas / Recursos Liberados
                </label>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                  {getRecursosDisponiveis().map(rec => {
                    const ativo = formData.permissoes.includes(rec.key);
                    return (
                      <button
                        key={rec.key}
                        type="button"
                        onClick={() => {
                          const novasPermissoes = ativo
                            ? formData.permissoes.filter(p => p !== rec.key)
                            : [...formData.permissoes, rec.key];
                          setFormData({
                            ...formData,
                            permissoes: novasPermissoes
                          });
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all text-left ${
                          ativo
                            ? 'bg-brand-blue/10 border-brand-blue/30 text-white font-bold'
                            : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        <span className="break-words pr-4">{rec.label}</span>
                        {ativo ? (
                          <CheckCircle size={14} className="text-brand-green shrink-0 ml-1" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  {editando ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Empresa */}
      {empresaEditando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Building size={18} className="text-brand-blue" />
                Editar Informações da Empresa
              </h3>
              <button onClick={() => setEmpresaEditando(null)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoEmpresa} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={empresaEditando.nome}
                  onChange={e => setEmpresaEditando({ ...empresaEditando, nome: e.target.value })}
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Conta</label>
                <select
                  value={empresaEditando.tipo_conta}
                  onChange={e => setEmpresaEditando({ ...empresaEditando, tipo_conta: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="empresa" className="bg-brand-dark-2 text-white">Empresa/Despachante</option>
                  <option value="cac_individual" className="bg-brand-dark-2 text-white">CAC Individual</option>
                </select>
              </div>

              {(empresaEditando.tipo_conta === 'empresa' || empresaEditando.tipo_conta === 'cac_individual') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Plano</label>
                      <select
                        value={empresaEditando.plano || '.22LR'}
                        onChange={e => {
                          const val = e.target.value;
                          const isCac = empresaEditando.tipo_conta === 'cac_individual';
                          let staff = isCac ? 1 : 1;
                          let cac = isCac ? 1 : 20;
                          let recs = isCac 
                            ? [
                                'dash_atencao_diaria', 'dash_alertas_vencimento', 'dash_lembretes',
                                'modulo_clientes', 'acervo_anexos', 'acervo_gerenciador', 'config_manual'
                              ]
                            : [...(empresaEditando.recursos_liberados || [])];
                          
                          if (!isCac) {
                            if (val === '.22LR') {
                              staff = 1;
                              cac = 15;
                              recs = [
                                'dash_alertas_vencimento', 'dash_ordens_recentes', 'dash_atencao_diaria',
                                'modulo_clientes', 'modulo_ordens', 'acervo_anexos', 
                                'config_alertas_vencimento', 'config_notificacoes_push'
                              ];
                            } else if (val === '.357mag') {
                              staff = 4;
                              cac = 20;
                              recs = RECURSOS_SISTEMA.map(r => r.key);
                            } else if (val === '.308win') {
                              staff = 9999;
                              cac = 9999;
                              recs = RECURSOS_SISTEMA.map(r => r.key);
                            }
                          }
                          setEmpresaEditando({
                            ...empresaEditando,
                            plano: val,
                            limite_usuarios_staff: staff,
                            limite_cac_vinculados: cac,
                            recursos_liberados: recs,
                            valor_assinatura_personalizado: null
                          });
                        }}
                        className="input w-full"
                      >
                        <option value=".22LR" className="bg-brand-dark-2 text-white">.22LR (Starter)</option>
                        <option value=".357mag" className="bg-brand-dark-2 text-white">.357mag (Profissional)</option>
                        <option value=".308win" className="bg-brand-dark-2 text-white">.308win (Premium)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Frequência</label>
                      <select
                        value={empresaEditando.frequencia_pagamento || 'mensal'}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, frequencia_pagamento: e.target.value })}
                        className="input w-full"
                      >
                        <option value="mensal" className="bg-brand-dark-2 text-white">Mensal</option>
                        <option value="semestral" className="bg-brand-dark-2 text-white">Semestral</option>
                        <option value="anual" className="bg-brand-dark-2 text-white">Anual</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Status do Plano</label>
                      <select
                        value={empresaEditando.plano_status || 'ativo'}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, plano_status: e.target.value })}
                        className="input w-full"
                      >
                        <option value="ativo" className="bg-brand-dark-2 text-white">Ativo</option>
                        <option value="suspenso" className="bg-brand-dark-2 text-white">Suspenso</option>
                        <option value="expirado" className="bg-brand-dark-2 text-white">Expirado</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Data de Vencimento</label>
                      <input
                        type="date"
                        value={empresaEditando.data_vencimento || ''}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, data_vencimento: e.target.value || null })}
                        className="input w-full text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Mensalidade Customizada (R$)</label>
                      <input
                        type="number"
                        placeholder="Usar padrão do plano"
                        value={empresaEditando.valor_assinatura_personalizado ?? ''}
                        onChange={e => setEmpresaEditando({ 
                          ...empresaEditando, 
                          valor_assinatura_personalizado: e.target.value !== '' ? parseFloat(e.target.value) : null 
                        })}
                        className="input w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Taxa de Setup (R$)</label>
                      <input
                        type="number"
                        value={empresaEditando.valor_implementacao ?? 150.00}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, valor_implementacao: parseFloat(e.target.value) || 0 })}
                        className="input w-full font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 py-2 bg-brand-dark-4/50 px-4 rounded-xl border border-brand-dark-5">
                    <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!empresaEditando.taxa_implementacao_paga}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, taxa_implementacao_paga: e.target.checked })}
                        className="w-4 h-4 rounded border-brand-dark-5 bg-brand-dark-3 text-brand-blue focus:ring-0 cursor-pointer"
                      />
                      Implementação Paga
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-brand-green cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!empresaEditando.is_gratis}
                        onChange={e => setEmpresaEditando({ ...empresaEditando, is_gratis: e.target.checked })}
                        className="w-4 h-4 rounded border-brand-dark-5 bg-brand-dark-3 text-brand-green focus:ring-0 cursor-pointer"
                      />
                      Isento / Gratuidade
                    </label>
                  </div>

                  {empresaEditando.tipo_conta === 'empresa' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Limite Staff (Equipe)</label>
                        <input
                          type="number"
                          min={1}
                          value={empresaEditando.limite_usuarios_staff ?? 1}
                          onChange={e => setEmpresaEditando({ ...empresaEditando, limite_usuarios_staff: parseInt(e.target.value) || 1 })}
                          className="input w-full"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Limite CACs Vinculados</label>
                        <input
                          type="number"
                          min={1}
                          value={empresaEditando.limite_cac_vinculados ?? 20}
                          onChange={e => setEmpresaEditando({ ...empresaEditando, limite_cac_vinculados: parseInt(e.target.value) || 1 })}
                          className="input w-full"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="pt-4 flex gap-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setEmpresaEditando(null)}
                  className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de Deletar Empresa */}
      <DialogConfirmacao
        aberto={!!confirmandoDeleteEmpresa}
        titulo="Excluir Empresa"
        mensagem={`Tem certeza que deseja excluir permanentemente a empresa "${confirmandoDeleteEmpresa?.nome}"? Esta ação não poderá ser desfeita e exigirá que não haja usuários associados.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletarEmpresa}
        onCancelar={() => setConfirmandoDeleteEmpresa(null)}
      />

      {/* Confirmação de Deletar Usuário */}
      <DialogConfirmacao
        aberto={!!confirmandoDeleteUsuario}
        titulo="Excluir Usuário"
        mensagem={`Tem certeza que deseja excluir permanentemente o usuário "${confirmandoDeleteUsuario?.nome}"? Se este usuário for um CAC Individual, seu acervo e workspace também serão excluídos. Esta ação não poderá ser desfeita.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletarUsuario}
        onCancelar={() => setConfirmandoDeleteUsuario(null)}
      />

      {/* Modal de Registro de Pagamento Manual */}
      {modalPagamentoManualAberto && empresaFaturamentoSelecionada && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BadgeDollarSign size={18} className="text-brand-green" />
                Registrar Pagamento PIX/Boleto
              </h3>
              <button onClick={() => setModalPagamentoManualAberto(false)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmarPagamentoManual} className="p-6 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Confirmando o pagamento para <strong className="text-white">{empresaFaturamentoSelecionada.nome}</strong>. 
                Isso avançará a data de vencimento da assinatura de acordo com o plano contratado ({empresaFaturamentoSelecionada.plano || '.22LR'}).
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Valor Pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formDataPagamento.valor_pago}
                  onChange={e => setFormDataPagamento({ ...formDataPagamento, valor_pago: e.target.value })}
                  className="input font-bold text-white text-base"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Forma de Pagamento</label>
                <select
                  value={formDataPagamento.meio_pagamento}
                  onChange={e => setFormDataPagamento({ ...formDataPagamento, meio_pagamento: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="PIX" className="bg-brand-dark-2 text-white">PIX / Transferência</option>
                  <option value="BOLETO" className="bg-brand-dark-2 text-white">Boleto Bancário</option>
                  <option value="DINHEIRO" className="bg-brand-dark-2 text-white">Dinheiro</option>
                  <option value="CARTAO" className="bg-brand-dark-2 text-white">Cartão de Crédito</option>
                  <option value="OUTRO" className="bg-brand-dark-2 text-white">Outro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações / Referência</label>
                <textarea
                  value={formDataPagamento.observacoes}
                  onChange={e => setFormDataPagamento({ ...formDataPagamento, observacoes: e.target.value })}
                  className="input w-full min-h-[70px] text-xs py-2"
                  placeholder="Ex: Mensalidade ref. Junho/2026 paga via PIX"
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setModalPagamentoManualAberto(false)}
                  className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Faturas Recebidas */}
      {empresaFaturamentoSelecionada && !modalPagamentoManualAberto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-brand-dark-2 px-6 py-4 border-b border-brand-dark-5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-brand-blue" />
                Histórico de Mensalidades: {empresaFaturamentoSelecionada.nome}
              </h3>
              <button onClick={() => setEmpresaFaturamentoSelecionada(null)} className="text-gray-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {carregandoHistorico ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : historicoPagamentos.length === 0 ? (
                <div className="text-center py-8 space-y-2 text-gray-500 italic">
                  <CreditCard size={32} className="mx-auto text-gray-700" />
                  <p className="text-sm">Nenhum pagamento registrado ainda para este despachante.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-brand-dark-5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-dark-4 border-b border-brand-dark-5">
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Data do Recebimento</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Valor</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Plano/Frequência</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Referência / Venc</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Meio</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5 text-[11px] text-gray-300">
                      {historicoPagamentos.map(h => (
                        <tr key={h.id} className="hover:bg-brand-dark-4/50">
                          <td className="p-3 whitespace-nowrap">{new Date(h.data_pagamento).toLocaleString('pt-BR')}</td>
                          <td className="p-3 font-bold text-white">R$ {parseFloat(h.valor_pago).toFixed(2)}</td>
                          <td className="p-3">{h.plano} ({h.frequencia})</td>
                          <td className="p-3 font-bold text-brand-green">{formatarData(h.referencia_vencimento)}</td>
                          <td className="p-3 text-white font-bold">{h.meio_pagamento}</td>
                          <td className="p-3 text-gray-400 max-w-[150px] truncate" title={h.observacoes}>{h.observacoes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-brand-dark-2 px-6 py-3 border-t border-brand-dark-5 flex justify-end">
              <button
                onClick={() => setEmpresaFaturamentoSelecionada(null)}
                className="btn-ghost py-2 px-5 text-xs font-bold uppercase tracking-wider"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
