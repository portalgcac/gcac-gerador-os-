/**
 * convitesService.ts
 * ==================
 * Serviço de convites para clientes existentes do despachante
 * criarem contas CAC Individual no Portal GCAC.
 *
 * Fluxo:
 * 1. Despachante gera convite para um cliente existente
 * 2. Link único válido por 24h é gerado
 * 3. Despachante envia link via WhatsApp
 * 4. Cliente abre o link, vê landing page, faz login Google
 * 5. Sistema cria conta CAC Individual + vínculo automático com despachante
 * 6. Dados históricos ficam sob custódia do despachante (leitura via vínculo)
 */

import { supabase } from '../db/supabase';
import { solicitarVinculo } from './vinculosService';
import { dispararPushImediato } from './pushNotificationService';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ConviteCac {
  id: string;
  token: string;
  despachante_empresa_id: string;
  despachante_nome: string;
  cliente_nome: string;
  cliente_cpf?: string;
  cliente_id: string;
  status: 'pendente' | 'aceito' | 'expirado' | 'cancelado';
  criado_em: string;
  expira_em: string;
  aceito_em?: string;
  cac_empresa_id?: string;
}

// ── Funções ───────────────────────────────────────────────────────────────────

/**
 * Gera um convite de 24h para um cliente existente do despachante.
 * Se já existir um convite pendente e válido, retorna o existente.
 */
export async function gerarConvite(params: {
  despachante_empresa_id: string;
  despachante_nome: string;
  cliente_nome: string;
  cliente_cpf?: string;
  cliente_id: string;
}): Promise<{ sucesso: boolean; token?: string; conviteId?: string; erro?: string }> {
  try {
    // 1. Verifica se já existe convite ativo (pendente e não expirado)
    const { data: existente } = await supabase
      .from('convites_cac')
      .select('id, token, status, expira_em')
      .eq('cliente_id', params.cliente_id)
      .eq('despachante_empresa_id', params.despachante_empresa_id)
      .eq('status', 'pendente')
      .gt('expira_em', new Date().toISOString())
      .maybeSingle();

    if (existente) {
      return { sucesso: true, token: existente.token, conviteId: existente.id };
    }

    // 2. Cria novo convite (token gerado pelo banco via DEFAULT)
    const expira = new Date();
    expira.setHours(expira.getHours() + 24);

    const { data, error } = await supabase
      .from('convites_cac')
      .insert([{
        despachante_empresa_id: params.despachante_empresa_id,
        despachante_nome: params.despachante_nome,
        cliente_nome: params.cliente_nome,
        cliente_cpf: params.cliente_cpf || null,
        cliente_id: params.cliente_id,
        status: 'pendente',
        expira_em: expira.toISOString(),
      }])
      .select('id, token')
      .single();

    if (error || !data) {
      return { sucesso: false, erro: 'Erro ao gerar convite: ' + (error?.message || 'sem resposta') };
    }

    return { sucesso: true, token: data.token, conviteId: data.id };
  } catch (e: any) {
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Valida um token de convite.
 * Retorna os dados do convite se válido.
 */
export async function validarConvite(token: string): Promise<{
  valido: boolean;
  convite?: ConviteCac;
  erro?: string;
}> {
  const { data, error } = await supabase
    .from('convites_cac')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) {
    return { valido: false, erro: 'Convite não encontrado.' };
  }

  if (data.status === 'aceito') {
    return { valido: false, convite: data as ConviteCac, erro: 'Este convite já foi aceito.' };
  }

  if (data.status === 'cancelado') {
    return { valido: false, convite: data as ConviteCac, erro: 'Este convite foi cancelado.' };
  }

  if (new Date(data.expira_em) < new Date()) {
    // Marca como expirado no banco de forma não-bloqueante
    supabase.from('convites_cac').update({ status: 'expirado' }).eq('id', data.id).then(() => {});
    return { valido: false, convite: data as ConviteCac, erro: 'Este convite expirou. Solicite ao despachante um novo link.' };
  }

  return { valido: true, convite: data as ConviteCac };
}

/**
 * Processa o aceite do convite após o cliente fazer login.
 * 
 * O que acontece:
 * 1. Verifica que o convite é válido
 * 2. Cria o vínculo despachante ↔ CAC (já ativo, sem necessidade de aprovação)
 * 3. Marca convite como aceito
 * 4. Notifica o despachante
 */
export async function aceitarConvite(
  token: string,
  cacEmpresaId: string,
  cacEmail: string,
  cacNome: string,
): Promise<{ sucesso: boolean; vinculoId?: string; erro?: string }> {
  // 1. Valida convite
  const { valido, convite, erro: erroValidacao } = await validarConvite(token);
  if (!valido || !convite) {
    return { sucesso: false, erro: erroValidacao || 'Convite inválido.' };
  }

  // 2. Verifica se já existe vínculo ativo entre estes dois
  const { data: vinculoExistente } = await supabase
    .from('vinculos_despachante_cac')
    .select('id, status')
    .eq('despachante_empresa_id', convite.despachante_empresa_id)
    .eq('cac_empresa_id', cacEmpresaId)
    .in('status', ['ativo', 'pendente'])
    .maybeSingle();

  let vinculoId: string | undefined;

  if (vinculoExistente?.status === 'ativo') {
    // Vínculo já existe e está ativo — apenas marca convite como aceito
    vinculoId = vinculoExistente.id;
  } else if (vinculoExistente?.status === 'pendente') {
    // Converte pendente em ativo diretamente
    const { error } = await supabase
      .from('vinculos_despachante_cac')
      .update({
        status: 'ativo',
        respondido_em: new Date().toISOString(),
        cac_nome: cacNome,
        cac_email: cacEmail,
        cac_cpf: convite.cliente_cpf || null,
      })
      .eq('id', vinculoExistente.id);

    if (error) return { sucesso: false, erro: 'Erro ao ativar vínculo existente.' };
    vinculoId = vinculoExistente.id;
  } else {
    // 3. Cria novo vínculo DIRETAMENTE como 'ativo' (sem etapa de aprovação — o convite É a aprovação)
    const { data: novoVinculo, error } = await supabase
      .from('vinculos_despachante_cac')
      .insert([{
        despachante_empresa_id: convite.despachante_empresa_id,
        despachante_nome: convite.despachante_nome,
        cac_empresa_id: cacEmpresaId,
        cac_email: cacEmail,
        cac_nome: cacNome,
        cac_cpf: convite.cliente_cpf || null,
        status: 'ativo',
        mensagem_solicitacao: `Convite aceito via link de convite em ${new Date().toLocaleDateString('pt-BR')}`,
        respondido_em: new Date().toISOString(),
        permite_edicao: true,
        termo_aceito_texto: `Aceito via link de convite do Portal G CAC em ${new Date().toLocaleString('pt-BR')}. Autorizo este despachante a gerenciar, atualizar e editar os dados do meu acervo.`,
        autorizado_edicao_em: new Date().toISOString(),
      }])
      .select('id')
      .single();

    if (error || !novoVinculo) {
      return { sucesso: false, erro: 'Erro ao criar vínculo: ' + (error?.message || '') };
    }
    vinculoId = novoVinculo.id;
  }

  // 4. Marca convite como aceito
  await supabase
    .from('convites_cac')
    .update({ status: 'aceito', aceito_em: new Date().toISOString(), cac_empresa_id: cacEmpresaId })
    .eq('id', convite.id);

  // 5. Notifica o despachante (não-bloqueante)
  supabase.from('notificacoes_sistema').insert([{
    titulo: '✅ Convite aceito!',
    mensagem: `${cacNome} ativou o Portal GCAC e está vinculado à sua empresa.`,
    tipo: 'sucesso',
    empresa_id: convite.despachante_empresa_id,
    link: '/clientes-cac',
  }]).then(() => {});

  dispararPushImediato({
    empresaId: convite.despachante_empresa_id,
    titulo: '✅ Convite aceito!',
    mensagem: `${cacNome} ativou o Portal GCAC e está vinculado à sua empresa.`,
    link: '/clientes-cac',
  });

  return { sucesso: true, vinculoId };
}

/**
 * Lista todos os convites gerados para um cliente específico.
 */
export async function buscarConvitesPorCliente(
  clienteId: string,
): Promise<ConviteCac[]> {
  const { data, error } = await supabase
    .from('convites_cac')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false });

  if (error || !data) return [];
  return data as ConviteCac[];
}

/**
 * Cancela um convite pendente.
 */
export async function cancelarConvite(
  conviteId: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const { error } = await supabase
    .from('convites_cac')
    .update({ status: 'cancelado' })
    .eq('id', conviteId)
    .eq('status', 'pendente');

  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}

/**
 * Gera a URL completa do link de convite.
 */
export function gerarUrlConvite(token: string): string {
  const base = window.location.origin;
  return `${base}/convite/${token}`;
}

/**
 * Gera o link direto para WhatsApp com a mensagem de convite.
 */
export function gerarLinkWhatsApp(
  telefone: string,
  clienteNome: string,
  despachantNome: string,
  urlConvite: string,
): string {
  const primeiroNome = clienteNome.split(' ')[0];
  const mensagem = encodeURIComponent(
    `Olá ${primeiroNome}! 👋\n\n` +
    `Eu, ${despachantNome}, te convido para acessar o *Portal G CAC* — onde você pode acompanhar seu acervo de armas, documentos e autorizações de manejo.\n\n` +
    `Acesse pelo link abaixo e faça login com seu Google:\n${urlConvite}\n\n` +
    `⏰ O link é válido por 24 horas.`
  );
  // Normaliza telefone (remove não-dígitos)
  const tel = telefone.replace(/\D/g, '');
  const telBr = tel.startsWith('55') ? tel : `55${tel}`;
  return `https://wa.me/${telBr}?text=${mensagem}`;
}
