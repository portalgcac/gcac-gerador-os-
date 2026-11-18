import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { ValeColaborador, StatusVale } from '../types';

const STORAGE_KEY_VALES = (empresaId: string) => `gcac_vales_${empresaId}`;

function mapValeFromDb(row: any): ValeColaborador {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    colaboradorId: row.colaborador_id || undefined,
    colaboradorNome: row.colaborador_nome,
    colaboradorCpf: row.colaborador_cpf || undefined,
    usuarioEmail: row.usuario_email || undefined,
    valor: Number(row.valor) || 0,
    dataAdiantamento: row.data_adiantamento,
    formaPagamento: row.forma_pagamento || 'PIX',
    motivo: row.motivo || '',
    comprovanteGestorUrl: row.comprovante_gestor_url || undefined,
    status: (row.status as StatusVale) || 'pendente',
    confirmadoEm: row.confirmado_em || undefined,
    confirmadoPorEmail: row.confirmado_por_email || undefined,
    hashAutenticacao: row.hash_autenticacao || undefined,
    assinaturaBase64: row.assinatura_base64 || undefined,
    reciboAssinadoUrl: row.recibo_assinado_url || undefined,
    observacoes: row.observacoes || undefined,
    criadoPorNome: row.criado_por_nome || undefined,
    criadoEm: row.criado_em || new Date().toISOString(),
    atualizadoEm: row.atualizado_em || undefined
  };
}

export async function listarVales(
  empresaId: string, 
  colaboradorEmail?: string,
  colaboradorNome?: string
): Promise<ValeColaborador[]> {
  const localRaw = localStorage.getItem(STORAGE_KEY_VALES(empresaId));
  let locais: ValeColaborador[] = [];
  try {
    if (localRaw) locais = JSON.parse(localRaw);
  } catch {
    locais = [];
  }

  const bateFiltro = (v: ValeColaborador) => {
    if (!colaboradorEmail && !colaboradorNome) return true;
    if (colaboradorEmail && v.usuarioEmail && v.usuarioEmail.trim().toLowerCase() === colaboradorEmail.trim().toLowerCase()) {
      return true;
    }
    if (colaboradorNome && v.colaboradorNome && v.colaboradorNome.trim().toLowerCase() === colaboradorNome.trim().toLowerCase()) {
      return true;
    }
    if (colaboradorNome && v.colaboradorNome) {
      const p1 = colaboradorNome.trim().toLowerCase().split(' ')[0];
      const p2 = v.colaboradorNome.trim().toLowerCase().split(' ')[0];
      if (p1 && p2 && p1.length >= 3 && p1 === p2) return true;
    }
    return false;
  };

  try {
    const { data, error } = await supabase
      .from('vales_colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_adiantamento', { ascending: false });

    if (!error && data) {
      const remotos = data.map(mapValeFromDb);
      const mapa = new Map<string, ValeColaborador>();
      locais.forEach(l => mapa.set(l.id, l));
      remotos.forEach(r => mapa.set(r.id, r));
      const unificados = Array.from(mapa.values()).sort(
        (a, b) => new Date(b.dataAdiantamento).getTime() - new Date(a.dataAdiantamento).getTime()
      );
      localStorage.setItem(STORAGE_KEY_VALES(empresaId), JSON.stringify(unificados));
      return (colaboradorEmail || colaboradorNome) ? unificados.filter(bateFiltro) : unificados;
    }
  } catch (err) {
    console.warn('Fallback para cache local de vales:', err);
  }

  return (colaboradorEmail || colaboradorNome) ? locais.filter(bateFiltro) : locais;
}

export async function criarVale(
  empresaId: string,
  dados: {
    colaboradorId?: string;
    colaboradorNome: string;
    colaboradorCpf?: string;
    usuarioEmail?: string;
    valor: number;
    dataAdiantamento: string;
    formaPagamento: 'PIX' | 'Dinheiro' | 'Transferência' | 'Outro';
    motivo: string;
    comprovanteGestorUrl?: string;
    observacoes?: string;
    criadoPorNome?: string;
  }
): Promise<ValeColaborador> {
  const novoVale: ValeColaborador = {
    id: uuidv4(),
    empresaId,
    colaboradorId: dados.colaboradorId,
    colaboradorNome: dados.colaboradorNome,
    colaboradorCpf: dados.colaboradorCpf,
    usuarioEmail: dados.usuarioEmail?.trim().toLowerCase(),
    valor: dados.valor,
    dataAdiantamento: dados.dataAdiantamento,
    formaPagamento: dados.formaPagamento,
    motivo: dados.motivo,
    comprovanteGestorUrl: dados.comprovanteGestorUrl,
    status: 'pendente',
    observacoes: dados.observacoes,
    criadoPorNome: dados.criadoPorNome,
    criadoEm: new Date().toISOString()
  };

  // 1. Salva no cache local
  const locais = await listarVales(empresaId);
  const atualizados = [novoVale, ...locais.filter(v => v.id !== novoVale.id)];
  localStorage.setItem(STORAGE_KEY_VALES(empresaId), JSON.stringify(atualizados));

  // 2. Salva no Supabase
  try {
    await supabase.from('vales_colaboradores').insert([{
      id: novoVale.id,
      empresa_id: empresaId,
      colaborador_id: novoVale.colaboradorId || null,
      colaborador_nome: novoVale.colaboradorNome,
      colaborador_cpf: novoVale.colaboradorCpf || null,
      usuario_email: novoVale.usuarioEmail || null,
      valor: novoVale.valor,
      data_adiantamento: novoVale.dataAdiantamento,
      forma_pagamento: novoVale.formaPagamento,
      motivo: novoVale.motivo,
      comprovante_gestor_url: novoVale.comprovanteGestorUrl || null,
      status: 'pendente',
      observacoes: novoVale.observacoes || null,
      criado_por_nome: novoVale.criadoPorNome || null,
      criado_em: novoVale.criadoEm
    }]);
  } catch (err) {
    console.warn('Erro ao salvar vale no Supabase (mantido local):', err);
  }

  // 3. Dispara Notificação no Sistema para a Equipe / Colaborador
  try {
    const valorFmt = novoVale.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await supabase.from('notificacoes_sistema').insert([{
      titulo: 'Novo Adiantamento / Vale Emitido',
      mensagem: `Foi emitido um adiantamento no valor de ${valorFmt} para ${novoVale.colaboradorNome}. Acesse para confirmar o recebimento.`,
      tipo: 'info',
      link: '/ponto?aba=meus_vales',
      empresa_id: empresaId
    }]);
  } catch {
    // ignore
  }

  return novoVale;
}

export async function confirmarValeEletronico(
  empresaId: string,
  valeId: string,
  dados: {
    assinaturaBase64?: string;
    usuarioEmail: string;
    usuarioNome: string;
  }
): Promise<ValeColaborador | null> {
  const agora = new Date().toISOString();
  const hash = `GCAC-VALE-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // 1. Atualiza no cache local
  const locais = await listarVales(empresaId);
  let valeAtualizado: ValeColaborador | null = null;
  const listaAtualizada = locais.map(v => {
    if (v.id === valeId) {
      valeAtualizado = {
        ...v,
        status: 'confirmado_eletronico',
        confirmadoEm: agora,
        confirmadoPorEmail: dados.usuarioEmail,
        hashAutenticacao: hash,
        assinaturaBase64: dados.assinaturaBase64 || v.assinaturaBase64,
        atualizadoEm: agora
      };
      return valeAtualizado;
    }
    return v;
  });

  if (valeAtualizado) {
    localStorage.setItem(STORAGE_KEY_VALES(empresaId), JSON.stringify(listaAtualizada));
  }

  // 2. Atualiza no Supabase
  try {
    await supabase
      .from('vales_colaboradores')
      .update({
        status: 'confirmado_eletronico',
        confirmado_em: agora,
        confirmado_por_email: dados.usuarioEmail,
        hash_autenticacao: hash,
        assinatura_base64: dados.assinaturaBase64 || null,
        atualizado_em: agora
      })
      .eq('id', valeId);
  } catch (err) {
    console.warn('Erro ao atualizar vale no Supabase:', err);
  }

  return valeAtualizado;
}

export async function anexarReciboManual(
  empresaId: string,
  valeId: string,
  reciboAssinadoUrl: string
): Promise<ValeColaborador | null> {
  const agora = new Date().toISOString();

  // 1. Cache local
  const locais = await listarVales(empresaId);
  let valeAtualizado: ValeColaborador | null = null;
  const listaAtualizada = locais.map(v => {
    if (v.id === valeId) {
      valeAtualizado = {
        ...v,
        status: 'assinado_manual',
        reciboAssinadoUrl,
        atualizadoEm: agora
      };
      return valeAtualizado;
    }
    return v;
  });

  if (valeAtualizado) {
    localStorage.setItem(STORAGE_KEY_VALES(empresaId), JSON.stringify(listaAtualizada));
  }

  // 2. Supabase
  try {
    await supabase
      .from('vales_colaboradores')
      .update({
        status: 'assinado_manual',
        recibo_assinado_url: reciboAssinadoUrl,
        atualizado_em: agora
      })
      .eq('id', valeId);
  } catch (err) {
    console.warn('Erro ao atualizar comprovante manual no Supabase:', err);
  }

  return valeAtualizado;
}

export async function excluirVale(empresaId: string, valeId: string): Promise<void> {
  // 1. Cache local
  const locais = await listarVales(empresaId);
  const filtrados = locais.filter(v => v.id !== valeId);
  localStorage.setItem(STORAGE_KEY_VALES(empresaId), JSON.stringify(filtrados));

  // 2. Supabase
  try {
    await supabase.from('vales_colaboradores').delete().eq('id', valeId);
  } catch (err) {
    console.warn('Erro ao deletar vale no Supabase:', err);
  }
}
