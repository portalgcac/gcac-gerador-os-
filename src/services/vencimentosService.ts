import { supabase } from '../db/supabase';
import { calcularAlerta, AlertaDocumento } from '../utils/vencimentos';

export async function buscarAlertasGlobais(empresaId?: string): Promise<AlertaDocumento[]> {
  if (!empresaId) return [];
  return buscarAlertasParaEmpresas([empresaId]);
}

export async function buscarAlertasCacsVinculados(despachanteEmpresaId: string): Promise<AlertaDocumento[]> {
  if (!despachanteEmpresaId) return [];

  // Buscar os vínculos ativos
  const { data: vinculos, error } = await supabase
    .from('vinculos_despachante_cac')
    .select('cac_empresa_id')
    .eq('despachante_empresa_id', despachanteEmpresaId)
    .eq('status', 'ativo');

  if (error || !vinculos || vinculos.length === 0) {
    return [];
  }

  const cacEmpresaIds = vinculos.map(v => v.cac_empresa_id);
  return buscarAlertasParaEmpresas(cacEmpresaIds, { isVinculado: true });
}

export async function buscarAlertasParaEmpresas(empresaIds: string[], options?: { isVinculado?: boolean }): Promise<AlertaDocumento[]> {
  if (!empresaIds || empresaIds.length === 0) return [];
  const alertas: AlertaDocumento[] = [];
  const ocultarIbama = typeof window !== 'undefined' && localStorage.getItem('config_ocultar_ibama') === 'true';

  // 1. Buscar Clientes (CR e IBAMA CR)
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, numero_cr, vencimento_cr, vencimento_cr_ibama, empresa_id, cr_em_renovacao, cr_ibama_em_renovacao')
    .in('empresa_id', empresaIds);

  if (clientes) {
    clientes.forEach(c => {
      if (c.vencimento_cr) {
        const result = calcularAlerta('CR', c.vencimento_cr);
        if (result.nivel !== 'OK') {
          alertas.push({
            id: `${c.id}-cr`,
            tipo: 'CR',
            label: `CR Exército/PF: ${c.numero_cr || 'N/I'}`,
            dataVencimento: c.vencimento_cr,
            nivel: result.nivel,
            diasRestantes: result.dias,
            clienteNome: c.nome,
            clienteId: c.id,
            isVinculado: options?.isVinculado,
            cacEmpresaId: options?.isVinculado ? c.empresa_id : undefined,
            emRenovacao: !!c.cr_em_renovacao
          });
        }
      }
      if (!ocultarIbama && c.vencimento_cr_ibama) {
        const result = calcularAlerta('IBAMA_CR', c.vencimento_cr_ibama);
        if (result.nivel !== 'OK') {
          alertas.push({
            id: `${c.id}-ibama`,
            tipo: 'IBAMA_CR',
            label: 'CR IBAMA',
            dataVencimento: c.vencimento_cr_ibama,
            nivel: result.nivel,
            diasRestantes: result.dias,
            clienteNome: c.nome,
            clienteId: c.id,
            isVinculado: options?.isVinculado,
            cacEmpresaId: options?.isVinculado ? c.empresa_id : undefined,
            emRenovacao: !!c.cr_ibama_em_renovacao
          });
        }
      }
    });
  }

  // 2. Buscar Armas (CRAF)
  const { data: armas } = await supabase
    .from('armas')
    .select(`
      id, 
      modelo, 
      vencimento_craf, 
      cliente_id,
      empresa_id,
      craf_em_renovacao,
      clientes:cliente_id (nome)
    `)
    .in('empresa_id', empresaIds);

  if (armas) {
    (armas as any[]).forEach((a) => {
      if (a.vencimento_craf) {
        const result = calcularAlerta('CRAF', a.vencimento_craf);
        if (result.nivel !== 'OK') {
          const cliente = Array.isArray(a.clientes) ? a.clientes[0] : a.clientes;
          alertas.push({
            id: `${a.id}-craf`,
            tipo: 'CRAF',
            label: `CRAF: ${a.modelo}`,
            dataVencimento: a.vencimento_craf,
            nivel: result.nivel,
            diasRestantes: result.dias,
            clienteNome: cliente?.nome,
            clienteId: a.cliente_id,
            armaModelo: a.modelo,
            armaId: a.id,
            isVinculado: options?.isVinculado,
            cacEmpresaId: options?.isVinculado ? a.empresa_id : undefined,
            emRenovacao: !!a.craf_em_renovacao
          });
        }
      }
    });
  }

  // 3. Buscar GTs
  const { data: gts } = await supabase
    .from('guias_trafego')
    .select(`
      id, 
      tipo, 
      vencimento, 
      empresa_id,
      gt_em_renovacao,
      armas:arma_id (
        modelo, 
        cliente_id,
        clientes:cliente_id (nome)
      )
    `)
    .in('empresa_id', empresaIds);

  if (gts) {
    (gts as any[]).forEach((g) => {
      if (g.vencimento) {
        const result = calcularAlerta('GT', g.vencimento);
        if (result.nivel !== 'OK') {
          const arma = Array.isArray(g.armas) ? g.armas[0] : g.armas;
          const cliente = Array.isArray(arma?.clientes) ? arma.clientes[0] : arma?.clientes;
          alertas.push({
            id: `${g.id}-gt`,
            tipo: 'GT',
            label: `GT ${g.tipo}: ${arma?.modelo}`,
            dataVencimento: g.vencimento,
            nivel: result.nivel,
            diasRestantes: result.dias,
            clienteNome: cliente?.nome,
            clienteId: arma?.cliente_id,
            armaModelo: arma?.modelo,
            armaId: arma?.id,
            isVinculado: options?.isVinculado,
            cacEmpresaId: options?.isVinculado ? g.empresa_id : undefined,
            emRenovacao: !!g.gt_em_renovacao
          });
        }
      }
    });
  }

  // 4. Buscar Manejos
  if (!ocultarIbama) {
    const { data: manejos } = await supabase
      .from('autorizacoes_manejo')
      .select(`
        id, 
        nome_fazenda, 
        vencimento, 
        cliente_id,
        status,
        empresa_id,
        manejo_em_renovacao,
        clientes:cliente_id (nome)
      `)
      .in('empresa_id', empresaIds);

    if (manejos) {
      (manejos as any[]).forEach((m) => {
        // Pular alertas para autorizações inertes
        if (m.status === 'Inerte') return;

        if (m.vencimento) {
          const result = calcularAlerta('MANEJO', m.vencimento);
          if (result.nivel !== 'OK') {
            const cliente = Array.isArray(m.clientes) ? m.clientes[0] : m.clientes;
            alertas.push({
              id: `${m.id}-manejo`,
              tipo: 'MANEJO',
              label: `Manejo: ${m.nome_fazenda}`,
              dataVencimento: m.vencimento,
              nivel: result.nivel,
              diasRestantes: result.dias,
              clienteNome: cliente?.nome,
              clienteId: m.cliente_id,
              isVinculado: options?.isVinculado,
              cacEmpresaId: options?.isVinculado ? m.empresa_id : undefined,
              emRenovacao: !!m.manejo_em_renovacao
            });
          }
        }
      });
    }
  }

  // Ordenar por: em renovação por último, depois por gravidade, depois por data
  return alertas.sort((a, b) => {
    if (a.emRenovacao !== b.emRenovacao) {
      return a.emRenovacao ? 1 : -1;
    }
    const ordem: Record<string, number> = { 'VENCIDO': 0, 'CRITICO': 1, 'AVISO': 2, 'OK': 3 };
    if (ordem[a.nivel] !== ordem[b.nivel]) return ordem[a.nivel] - ordem[b.nivel];
    return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
  });
}

export async function atualizarStatusRenovacao(tipo: string, id: string, emRenovacao: boolean): Promise<void> {
  switch (tipo) {
    case 'CR':
      const { error: errCr } = await supabase
        .from('clientes')
        .update({ cr_em_renovacao: emRenovacao })
        .eq('id', id);
      if (errCr) throw errCr;
      break;
    case 'IBAMA_CR':
      const { error: errIbama } = await supabase
        .from('clientes')
        .update({ cr_ibama_em_renovacao: emRenovacao })
        .eq('id', id);
      if (errIbama) throw errIbama;
      break;
    case 'CRAF':
      const { error: errCraf } = await supabase
        .from('armas')
        .update({ craf_em_renovacao: emRenovacao })
        .eq('id', id);
      if (errCraf) throw errCraf;
      break;
    case 'GT':
      const { error: errGt } = await supabase
        .from('guias_trafego')
        .update({ gt_em_renovacao: emRenovacao })
        .eq('id', id);
      if (errGt) throw errGt;
      break;
    case 'MANEJO':
      const { error: errManejo } = await supabase
        .from('autorizacoes_manejo')
        .update({ manejo_em_renovacao: emRenovacao })
        .eq('id', id);
      if (errManejo) throw errManejo;
      break;
    default:
      throw new Error(`Tipo de alerta desconhecido: ${tipo}`);
  }
}

