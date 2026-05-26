/**
 * adminCacService.ts
 * ==================
 * Service responsável por consultar dados agregados de todos os usuários
 * do tipo CAC Individual para alimentar o Painel de Gestão do Admin GCAC Principal.
 *
 * Somente acessível ao Admin Mestre (gui.gomesassis@gmail.com) e admins da empresa padrão.
 */

import { supabase } from '../db/supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface EstatisticasGlobaisCAC {
  totalAtiradores: number;
  ativos30dias: number;
  ativos7dias: number;
  inativos30dias: number;
  mediaArmasPorAtirador: number;
  totalArmasCadastradas: number;
  totalAlertasCriticos: number;
  onboardingConcluidos: number;
}

export interface PerfilAtirador {
  // Dados do usuário autorizado
  id: string;
  nome: string;
  email: string;
  cpf?: string;
  contato?: string;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso?: string;
  onboardingConcluido: boolean;
  totalExportacoes: number;

  // Dados da empresa (conta CAC)
  empresaId?: string;
  empresaNome?: string;
  empresaCriadaEm?: string;

  // Dados do perfil (clientes)
  clienteId?: string;
  numeroCr?: string;
  vencimentoCr?: string;
  numeroCrIbama?: string;
  vencimentoCrIbama?: string;
  fotoUrl?: string;

  // Estatísticas do acervo
  totalArmas: number;
  totalGts: number;
  totalManejos: number;
  alertasCriticos: number; // docs vencidos ou a vencer em ≤30 dias
}

// ── Funções ──────────────────────────────────────────────────────────────────

/**
 * Busca todos os usuários CAC Individual e seus dados de uso.
 * Realiza consultas na tabela de empresas, usuários e clientes.
 */
export async function buscarTodosAtiradores(): Promise<PerfilAtirador[]> {
  // 1. Busca todas as empresas do tipo cac_individual
  const { data: empresas, error: errEmpresas } = await supabase
    .from('empresas')
    .select('id, nome, criado_em')
    .eq('tipo_conta', 'cac_individual');

  if (errEmpresas || !empresas || empresas.length === 0) return [];

  const empresaIds = empresas.map(e => e.id);

  // 2. Busca usuários autorizados vinculados a essas empresas
  const { data: usuarios, error: errUsuarios } = await supabase
    .from('usuarios_autorizados')
    .select('id, nome, email, cpf, contato, ativo, criado_em, empresa_id, ultimo_acesso, onboarding_concluido, total_exportacoes')
    .in('empresa_id', empresaIds);

  if (errUsuarios || !usuarios) return [];

  // 3. Busca perfis de clientes (CR, foto, etc.) para essas empresas
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, empresa_id, numero_cr, vencimento_cr, numero_cr_ibama, vencimento_cr_ibama, foto_url')
    .in('empresa_id', empresaIds)
    .not('cpf', 'is', null);

  // 4. Busca contagem de armas por empresa
  const { data: armasPorEmpresa } = await supabase
    .from('armas')
    .select('empresa_id, id, vencimento_craf')
    .in('empresa_id', empresaIds);

  // 5. Busca GTs
  const armaIds = (armasPorEmpresa || []).map(a => a.id);
  let gtsPorArma: Array<{ arma_id: string; vencimento: string }> = [];
  if (armaIds.length > 0) {
    const { data: gts } = await supabase
      .from('guias_trafego')
      .select('arma_id, vencimento')
      .in('arma_id', armaIds);
    gtsPorArma = gts || [];
  }

  // 6. Busca autorizações de manejo
  const { data: manejos } = await supabase
    .from('autorizacoes_manejo')
    .select('empresa_id, vencimento')
    .in('empresa_id', empresaIds);

  // ── Monta os perfis ──────────────────────────────────────────────────────

  const hoje = new Date();
  const limite30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  function isAlerta(vencimento?: string | null): boolean {
    if (!vencimento) return false;
    const v = new Date(vencimento);
    return v <= limite30dias; // vencido ou a vencer em 30 dias
  }

  const perfis: PerfilAtirador[] = usuarios.map(u => {
    const empresa = empresas.find(e => e.id === u.empresa_id);
    const cliente = clientes?.find(c => c.empresa_id === u.empresa_id);
    const armasDoUser = (armasPorEmpresa || []).filter(a => a.empresa_id === u.empresa_id);
    const armaIdsDoUser = armasDoUser.map(a => a.id);
    const gtsDoUser = gtsPorArma.filter(g => armaIdsDoUser.includes(g.arma_id));
    const manejosDoUser = (manejos || []).filter(m => m.empresa_id === u.empresa_id);

    // Conta alertas: CRAF vencido, GTs vencidos, CR vencido, Manejos vencidos
    let alertasCriticos = 0;
    if (isAlerta(cliente?.vencimento_cr)) alertasCriticos++;
    if (isAlerta(cliente?.vencimento_cr_ibama)) alertasCriticos++;
    armasDoUser.forEach(a => { if (isAlerta(a.vencimento_craf)) alertasCriticos++; });
    gtsDoUser.forEach(g => { if (isAlerta(g.vencimento)) alertasCriticos++; });
    manejosDoUser.forEach(m => { if (isAlerta(m.vencimento)) alertasCriticos++; });

    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      cpf: u.cpf || undefined,
      contato: u.contato || undefined,
      ativo: u.ativo,
      criadoEm: u.criado_em,
      ultimoAcesso: u.ultimo_acesso || undefined,
      onboardingConcluido: u.onboarding_concluido || false,
      totalExportacoes: u.total_exportacoes || 0,

      empresaId: empresa?.id,
      empresaNome: empresa?.nome,
      empresaCriadaEm: empresa?.criado_em,

      clienteId: cliente?.id,
      numeroCr: cliente?.numero_cr || undefined,
      vencimentoCr: cliente?.vencimento_cr || undefined,
      numeroCrIbama: cliente?.numero_cr_ibama || undefined,
      vencimentoCrIbama: cliente?.vencimento_cr_ibama || undefined,
      fotoUrl: cliente?.foto_url || undefined,

      totalArmas: armasDoUser.length,
      totalGts: gtsDoUser.length,
      totalManejos: manejosDoUser.length,
      alertasCriticos,
    };
  });

  return perfis.sort((a, b) => {
    // Ordena: com alertas primeiro, depois por último acesso mais recente
    if (b.alertasCriticos !== a.alertasCriticos) return b.alertasCriticos - a.alertasCriticos;
    const ta = a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0;
    const tb = b.ultimoAcesso ? new Date(b.ultimoAcesso).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Calcula as estatísticas globais a partir de uma lista de perfis já carregados.
 */
export function calcularEstatisticasGlobais(perfis: PerfilAtirador[]): EstatisticasGlobaisCAC {
  const agora = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  const ativos7dias = perfis.filter(p => {
    if (!p.ultimoAcesso) return false;
    return agora - new Date(p.ultimoAcesso).getTime() <= ms7d;
  }).length;

  const ativos30dias = perfis.filter(p => {
    if (!p.ultimoAcesso) return false;
    return agora - new Date(p.ultimoAcesso).getTime() <= ms30d;
  }).length;

  const inativos30dias = perfis.filter(p => {
    if (!p.ultimoAcesso) return true;
    return agora - new Date(p.ultimoAcesso).getTime() > ms30d;
  }).length;

  const totalArmas = perfis.reduce((s, p) => s + p.totalArmas, 0);
  const totalAlertasCriticos = perfis.reduce((s, p) => s + p.alertasCriticos, 0);
  const onboardingConcluidos = perfis.filter(p => p.onboardingConcluido).length;

  return {
    totalAtiradores: perfis.length,
    ativos30dias,
    ativos7dias,
    inativos30dias,
    mediaArmasPorAtirador: perfis.length > 0 ? +(totalArmas / perfis.length).toFixed(1) : 0,
    totalArmasCadastradas: totalArmas,
    totalAlertasCriticos,
    onboardingConcluidos,
  };
}

/**
 * Registra o acesso do usuário atual na tabela usuarios_autorizados.
 * Deve ser chamado a cada login.
 */
export async function registrarAcesso(email: string): Promise<void> {
  await supabase
    .from('usuarios_autorizados')
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq('email', email.toLowerCase());
}

/**
 * Marca o onboarding como concluído para o usuário.
 */
export async function marcarOnboardingConcluido(email: string): Promise<void> {
  await supabase
    .from('usuarios_autorizados')
    .update({ onboarding_concluido: true })
    .eq('email', email.toLowerCase());
}

/**
 * Incrementa o contador de exportações do usuário.
 */
export async function incrementarExportacao(email: string): Promise<void> {
  // Faz increment via RPC ou busca o valor atual e incrementa
  const { data } = await supabase
    .from('usuarios_autorizados')
    .select('total_exportacoes')
    .eq('email', email.toLowerCase())
    .single();

  const atual = data?.total_exportacoes || 0;
  await supabase
    .from('usuarios_autorizados')
    .update({ total_exportacoes: atual + 1 })
    .eq('email', email.toLowerCase());
}
