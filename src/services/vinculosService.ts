/**
 * vinculosService.ts
 * ==================
 * Service responsável por toda a lógica de vínculo entre
 * Despachante (empresa) e CAC Individual (atirador) no portal GCAC.
 *
 * Regras:
 * - Despachante busca o CAC por CPF
 * - CAC recebe notificação e Autoriza/Recusa
 * - Apenas leitura para o despachante após vínculo ativo
 * - CAC ou despachante podem revogar a qualquer momento
 */

import { supabase } from '../db/supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type StatusVinculo = 'pendente' | 'ativo' | 'rejeitado' | 'revogado' | 'expirado';

export interface VinculoDespachanteCac {
  id: string;
  despachante_empresa_id: string;
  despachante_nome: string;
  cac_empresa_id: string;
  cac_email: string;
  cac_nome: string;
  cac_cpf?: string;
  status: StatusVinculo;
  mensagem_solicitacao?: string;
  solicitado_em: string;
  respondido_em?: string;
  revogado_em?: string;
  revogado_por?: 'cac' | 'despachante' | 'admin_gcac';
  permite_edicao?: boolean;
  termo_aceito_texto?: string;
  autorizado_edicao_em?: string;
}

export interface AcervoVinculado {
  vinculo?: {
    id: string;
    permite_edicao: boolean;
    termo_aceito_texto?: string;
    autorizado_edicao_em?: string;
  };
  cliente: {
    id: string;
    nome: string;
    cpf?: string;
    contato?: string;
    numeroCr?: string;
    vencimentoCr?: string;
    numeroCrIbama?: string;
    vencimentoCrIbama?: string;
    fotoUrl?: string;
  };
  armas: Array<{
    id: string;
    modelo: string;
    calibre: string;
    fabricante: string;
    numeroSerie: string;
    numeroSigma: string;
    acervo: string;
    tipo?: string;
    vencimentoCraf?: string;
    gts: Array<{
      id: string;
      tipo: string;
      vencimento: string;
      destino: string;
    }>;
  }>;
  manejos: Array<{
    id: string;
    numeroCar: string;
    nomeFazenda: string;
    nomeProprietario: string;
    cidade: string;
    vencimento: string;
    status: string;
  }>;
}

// ── Funções de Vínculo ───────────────────────────────────────────────────────

/**
 * Despachante busca um CAC Individual pelo CPF para solicitar vínculo.
 * Retorna dados básicos do atirador (sem expor info sensível).
 */
export async function buscarCacPorCpf(cpf: string): Promise<{
  encontrado: boolean;
  cacEmpresaId?: string;
  cacEmail?: string;
  cacNome?: string;
  cacCpf?: string;
  jaVinculado?: boolean;
  vinculoStatus?: StatusVinculo;
  despachantEmpresaId?: string;
} > {
  // Normaliza CPF (remove pontuação)
  const cpfLimpo = cpf.replace(/\D/g, '');
  const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  // 1. Busca o CAC pelo CPF na tabela de clientes, filtrando para garantir que pertence a uma conta 'cac_individual'
  const { data: clienteData } = await supabase
    .from('clientes')
    .select(`
      empresa_id,
      nome,
      cpf,
      empresas!inner (
        id,
        tipo_conta
      )
    `)
    .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
    .eq('empresas.tipo_conta', 'cac_individual')
    .limit(1)
    .maybeSingle() as any;

  if (!clienteData?.empresa_id) {
    return { encontrado: false };
  }

  // 2. Busca o email do usuário dessa empresa (do atirador)
  const { data: usuarioData } = await supabase
    .from('usuarios_autorizados')
    .select('email')
    .eq('empresa_id', clienteData.empresa_id)
    .limit(1)
    .maybeSingle();

  return {
    encontrado: true,
    cacEmpresaId: clienteData.empresa_id,
    cacEmail: usuarioData?.email,
    cacNome: clienteData.nome,
    cacCpf: cpfLimpo,
  };
}

/**
 * Despachante envia solicitação de vínculo ao CAC.
 * Cria registro na tabela vinculos_despachante_cac e
 * insere notificação para o CAC.
 */
export async function solicitarVinculo(params: {
  despachante_empresa_id: string;
  despachante_nome: string;
  cac_empresa_id: string;
  cac_email: string;
  cac_nome: string;
  cac_cpf?: string;
  mensagem?: string;
  permite_edicao?: boolean;
}): Promise<{ sucesso: boolean; erro?: string; vinculoId?: string }> {
  // 1. Verifica limite de CACs vinculados para este despachante
  const { data: empresaData } = await supabase
    .from('empresas')
    .select('limite_cac_vinculados')
    .eq('id', params.despachante_empresa_id)
    .single();

  const limite = empresaData?.limite_cac_vinculados ?? 10;

  const { count: totalAtivos } = await supabase
    .from('vinculos_despachante_cac')
    .select('id', { count: 'exact', head: true })
    .eq('despachante_empresa_id', params.despachante_empresa_id)
    .in('status', ['ativo', 'pendente']);

  if ((totalAtivos ?? 0) >= limite) {
    return {
      sucesso: false,
      erro: `Limite de ${limite} clientes CAC vinculados atingido. Entre em contato com o GCAC para ampliar.`,
    };
  }

  // 2. Verifica se já existe vínculo entre esse par
  const { data: existente } = await supabase
    .from('vinculos_despachante_cac')
    .select('id, status')
    .eq('despachante_empresa_id', params.despachante_empresa_id)
    .eq('cac_empresa_id', params.cac_empresa_id)
    .maybeSingle();

  if (existente) {
    if (existente.status === 'ativo') {
      return { sucesso: false, erro: 'Este cliente já está vinculado à sua empresa.' };
    }
    if (existente.status === 'pendente') {
      return { sucesso: false, erro: 'Já existe uma solicitação pendente para este cliente.' };
    }
    // Se rejeitado/revogado, permite nova solicitação (upsert)
    const { error } = await supabase
      .from('vinculos_despachante_cac')
      .update({
        status: 'pendente',
        mensagem_solicitacao: params.mensagem,
        solicitado_em: new Date().toISOString(),
        respondido_em: null,
        revogado_em: null,
        revogado_por: null,
        permite_edicao: params.permite_edicao || false,
        termo_aceito_texto: null,
        autorizado_edicao_em: null,
      })
      .eq('id', existente.id);

    if (error) return { sucesso: false, erro: 'Erro ao reenviar solicitação: ' + error.message };

    // Insere notificação no portal do CAC
    await inserirNotificacaoCac(params.cac_empresa_id, params.despachante_nome, existente.id);
    return { sucesso: true, vinculoId: existente.id };
  }

  // 3. Cria novo vínculo
  const { data, error } = await supabase
    .from('vinculos_despachante_cac')
    .insert([{
      despachante_empresa_id: params.despachante_empresa_id,
      despachante_nome: params.despachante_nome,
      cac_empresa_id: params.cac_empresa_id,
      cac_email: params.cac_email,
      cac_nome: params.cac_nome,
      cac_cpf: params.cac_cpf,
      status: 'pendente',
      mensagem_solicitacao: params.mensagem,
      permite_edicao: params.permite_edicao || false,
    }])
    .select()
    .single();

  if (error || !data) {
    return { sucesso: false, erro: 'Erro ao criar solicitação: ' + (error?.message || 'registro não retornado') };
  }

  // 4. Insere notificação no portal do CAC
  await inserirNotificacaoCac(params.cac_empresa_id, params.despachante_nome, data.id);

  return { sucesso: true, vinculoId: data.id };
}

async function inserirNotificacaoCac(cacEmpresaId: string, despachantNome: string, vinculoId: string) {
  await supabase.from('notificacoes_sistema').insert([{
    titulo: `🔗 Solicitação de vínculo`,
    mensagem: `${despachantNome} solicitou acesso ao seu acervo como despachante autorizado.`,
    tipo: 'info',
    link: `/vinculo-pendente/${vinculoId}`,
    empresa_id: cacEmpresaId,
  }]);
}

/**
 * CAC responde à solicitação de vínculo (Autorizar ou Recusar).
 */
export async function responderVinculo(
  vinculoId: string,
  resposta: 'ativo' | 'rejeitado',
  cacEmpresaId: string,
  termoAceitoTexto?: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  // 1. Valida que o vínculo pertence ao CAC que está respondendo
  const { data: vinculo } = await supabase
    .from('vinculos_despachante_cac')
    .select('id, status, despachante_empresa_id, despachante_nome')
    .eq('id', vinculoId)
    .eq('cac_empresa_id', cacEmpresaId)
    .single();

  if (!vinculo) return { sucesso: false, erro: 'Solicitação não encontrada.' };
  if (vinculo.status !== 'pendente') return { sucesso: false, erro: 'Esta solicitação já foi respondida.' };

  const updateFields: any = {
    status: resposta,
    respondido_em: new Date().toISOString(),
  };

  if (resposta === 'ativo' && termoAceitoTexto) {
    updateFields.termo_aceito_texto = termoAceitoTexto;
    updateFields.autorizado_edicao_em = new Date().toISOString();
  }

  // 2. Atualiza status
  const { error } = await supabase
    .from('vinculos_despachante_cac')
    .update(updateFields)
    .eq('id', vinculoId);

  if (error) return { sucesso: false, erro: 'Erro ao registrar resposta.' };

  // 3. Notifica o despachante sobre a resposta
  const emoji = resposta === 'ativo' ? '✅' : '❌';
  const acao = resposta === 'ativo' ? 'autorizou seu acesso ao acervo' : 'recusou a solicitação de vínculo';
  await supabase.from('notificacoes_sistema').insert([{
    titulo: `${emoji} Resposta de vínculo`,
    mensagem: `O atirador respondeu à sua solicitação: acesso ${resposta === 'ativo' ? 'autorizado' : 'recusado'}.`,
    tipo: resposta === 'ativo' ? 'sucesso' : 'alerta',
    empresa_id: vinculo.despachante_empresa_id,
  }]);

  return { sucesso: true };
}

/**
 * Revoga um vínculo ativo. Pode ser chamado pelo CAC ou pelo despachante.
 */
export async function revogarVinculo(
  vinculoId: string,
  revogadoPor: 'cac' | 'despachante' | 'admin_gcac',
  empresaIdResponsavel: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const { data: vinculo } = await supabase
    .from('vinculos_despachante_cac')
    .select('id, status, cac_empresa_id, despachante_empresa_id, cac_nome, despachante_nome')
    .eq('id', vinculoId)
    .single();

  if (!vinculo) return { sucesso: false, erro: 'Vínculo não encontrado.' };
  if (vinculo.status !== 'ativo') return { sucesso: false, erro: 'Este vínculo não está ativo.' };

  const { error } = await supabase
    .from('vinculos_despachante_cac')
    .update({
      status: 'revogado',
      revogado_em: new Date().toISOString(),
      revogado_por: revogadoPor,
    })
    .eq('id', vinculoId);

  if (error) return { sucesso: false, erro: 'Erro ao revogar vínculo.' };

  // Notifica a outra parte
  if (revogadoPor === 'cac') {
    await supabase.from('notificacoes_sistema').insert([{
      titulo: '⚠️ Acesso revogado',
      mensagem: `O atirador ${vinculo.cac_nome} revogou seu acesso ao acervo.`,
      tipo: 'alerta',
      empresa_id: vinculo.despachante_empresa_id,
    }]);
  } else if (revogadoPor === 'despachante') {
    await supabase.from('notificacoes_sistema').insert([{
      titulo: '⚠️ Vínculo encerrado',
      mensagem: `O despachante ${vinculo.despachante_nome} encerrou o vínculo com seu acervo.`,
      tipo: 'alerta',
      empresa_id: vinculo.cac_empresa_id,
    }]);
  }

  return { sucesso: true };
}

/**
 * Lista todos os CACs vinculados a um despachante.
 */
export async function buscarVinculosDespachante(
  despachante_empresa_id: string,
): Promise<VinculoDespachanteCac[]> {
  const { data, error } = await supabase
    .from('vinculos_despachante_cac')
    .select('*')
    .eq('despachante_empresa_id', despachante_empresa_id)
    .order('solicitado_em', { ascending: false });

  if (error || !data) return [];
  return data as VinculoDespachanteCac[];
}

/**
 * Lista todos os despachantes que têm (ou tiveram) vínculo com um CAC.
 */
export async function buscarVinculosCAC(
  cac_empresa_id: string,
): Promise<VinculoDespachanteCac[]> {
  const { data, error } = await supabase
    .from('vinculos_despachante_cac')
    .select('*')
    .eq('cac_empresa_id', cac_empresa_id)
    .order('solicitado_em', { ascending: false });

  if (error || !data) return [];
  return data as VinculoDespachanteCac[];
}

/**
 * Busca os vínculos PENDENTES para o CAC (para notificações).
 */
export async function buscarVinculosPendentesCAC(
  cac_empresa_id: string,
): Promise<VinculoDespachanteCac[]> {
  const { data, error } = await supabase
    .from('vinculos_despachante_cac')
    .select('*')
    .eq('cac_empresa_id', cac_empresa_id)
    .eq('status', 'pendente')
    .order('solicitado_em', { ascending: false });

  if (error || !data) return [];
  return data as VinculoDespachanteCac[];
}

/**
 * Lê o acervo completo do CAC — apenas se existe vínculo ativo com o despachante.
 */
export async function buscarAcervoVinculado(
  cacEmpresaId: string,
  despachante_empresa_id: string,
): Promise<AcervoVinculado | null> {
  // 1. Verifica vínculo ativo
  const { data: vinculo } = await supabase
    .from('vinculos_despachante_cac')
    .select('id, status, permite_edicao, termo_aceito_texto, autorizado_edicao_em')
    .eq('despachante_empresa_id', despachante_empresa_id)
    .eq('cac_empresa_id', cacEmpresaId)
    .eq('status', 'ativo')
    .single();

  if (!vinculo) return null;

  // 2. Busca perfil do cliente
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id, nome, cpf, contato, numero_cr, vencimento_cr, numero_cr_ibama, vencimento_cr_ibama, foto_url')
    .eq('empresa_id', cacEmpresaId)
    .limit(1)
    .maybeSingle();

  if (!clienteData) return null;

  // 3. Busca armas
  const { data: armasData } = await supabase
    .from('armas')
    .select('id, modelo, calibre, fabricante, numero_serie, numero_sigma, acervo, tipo, vencimento_craf')
    .eq('empresa_id', cacEmpresaId)
    .order('modelo');

  const armas = armasData || [];

  // 4. Busca GTs para cada arma
  const armaIds = armas.map(a => a.id);
  let gtsData: any[] = [];
  if (armaIds.length > 0) {
    const { data: gts } = await supabase
      .from('guias_trafego')
      .select('id, arma_id, tipo, vencimento, destino')
      .in('arma_id', armaIds)
      .order('vencimento');
    gtsData = gts || [];
  }

  // 5. Busca manejos
  const { data: manejosData } = await supabase
    .from('autorizacoes_manejo')
    .select('id, numero_car, nome_fazenda, nome_proprietario, cidade, vencimento, status')
    .eq('empresa_id', cacEmpresaId)
    .order('vencimento');

  return {
    vinculo: {
      id: vinculo.id,
      permite_edicao: !!vinculo.permite_edicao,
      termo_aceito_texto: vinculo.termo_aceito_texto,
      autorizado_edicao_em: vinculo.autorizado_edicao_em,
    },
    cliente: {
      id: clienteData.id,
      nome: clienteData.nome,
      cpf: clienteData.cpf ? `***${clienteData.cpf.slice(-6)}` : undefined, // Mascara CPF (LGPD)
      contato: clienteData.contato,
      numeroCr: clienteData.numero_cr,
      vencimentoCr: clienteData.vencimento_cr,
      numeroCrIbama: clienteData.numero_cr_ibama,
      vencimentoCrIbama: clienteData.vencimento_cr_ibama,
      fotoUrl: clienteData.foto_url,
    },
    armas: armas.map(a => ({
      id: a.id,
      modelo: a.modelo,
      calibre: a.calibre,
      fabricante: a.fabricante,
      numeroSerie: a.numero_serie,
      numeroSigma: a.numero_sigma,
      acervo: a.acervo,
      tipo: a.tipo,
      vencimentoCraf: a.vencimento_craf,
      gts: gtsData
        .filter(g => g.arma_id === a.id)
        .map(g => ({ id: g.id, tipo: g.tipo, vencimento: g.vencimento, destino: g.destino })),
    })),
    manejos: (manejosData || []).map(m => ({
      id: m.id,
      numeroCar: m.numero_car,
      nomeFazenda: m.nome_fazenda,
      nomeProprietario: m.nome_proprietario,
      cidade: m.cidade,
      vencimento: m.vencimento,
      status: m.status,
    })),
  };
}
