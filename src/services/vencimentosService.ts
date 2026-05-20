import { supabase } from '../db/supabase';
import { calcularAlerta, AlertaDocumento } from '../utils/vencimentos';

export async function buscarAlertasGlobais(empresaId?: string): Promise<AlertaDocumento[]> {
  if (!empresaId) return [];
  const alertas: AlertaDocumento[] = [];

  // 1. Buscar Clientes (CR e IBAMA CR)
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, numero_cr, vencimento_cr, vencimento_cr_ibama')
    .eq('empresa_id', empresaId);

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
            clienteId: c.id
          });
        }
      }
      if (c.vencimento_cr_ibama) {
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
            clienteId: c.id
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
      clientes:cliente_id (nome)
    `)
    .eq('empresa_id', empresaId);

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
            armaId: a.id
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
      armas:arma_id (
        modelo, 
        cliente_id,
        clientes:cliente_id (nome)
      )
    `)
    .eq('empresa_id', empresaId);

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
            armaId: arma?.id
          });
        }
      }
    });
  }

  // 4. Buscar Manejos
  const { data: manejos } = await supabase
    .from('autorizacoes_manejo')
    .select(`
      id, 
      nome_fazenda, 
      vencimento, 
      cliente_id,
      clientes:cliente_id (nome)
    `)
    .eq('empresa_id', empresaId);

  if (manejos) {
    (manejos as any[]).forEach((m) => {
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
            clienteId: m.cliente_id
          });
        }
      }
    });
  }

  // Ordenar por gravidade e depois por data
  return alertas.sort((a, b) => {
    const ordem: Record<string, number> = { 'VENCIDO': 0, 'CRITICO': 1, 'AVISO': 2, 'OK': 3 };
    if (ordem[a.nivel] !== ordem[b.nivel]) return ordem[a.nivel] - ordem[b.nivel];
    return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
  });
}
