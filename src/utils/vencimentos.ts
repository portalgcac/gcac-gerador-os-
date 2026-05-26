import { 
  differenceInDays, 
  parseISO, 
  isAfter, 
  addDays 
} from 'date-fns';

export type NivelAlerta = 'OK' | 'AVISO' | 'CRITICO' | 'VENCIDO';

export interface AlertaDocumento {
  id: string;
  tipo: string;
  label: string;
  dataVencimento: string;
  nivel: NivelAlerta;
  diasRestantes: number;
  clienteNome?: string;
  clienteId?: string;
  armaModelo?: string;
  armaId?: string;
  isVinculado?: boolean;
  cacEmpresaId?: string;
}

/**
 * Calcula o alerta baseado nas regras específicas do usuário
 */
export function calcularAlerta(tipo: string, dataVenc: string): { nivel: NivelAlerta; dias: number } {
  if (!dataVenc) return { nivel: 'OK', dias: 0 };
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const venc = parseISO(dataVenc);
  venc.setHours(0, 0, 0, 0);
  
  const dias = differenceInDays(venc, hoje);

  // Regra CR IBAMA: 1 dia DEPOIS de vencido
  if (tipo === 'IBAMA_CR') {
    if (isAfter(hoje, addDays(venc, 1))) return { nivel: 'VENCIDO', dias };
    if (isAfter(hoje, venc)) return { nivel: 'CRITICO', dias };
    return { nivel: 'OK', dias };
  }

  // Regra CR (PF/EB) e CRAF: 2 meses ANTES por padrão ou customizado
  if (tipo === 'CR' || tipo === 'CRAF') {
    const configChave = `config_alerta_${tipo.toLowerCase()}`;
    const diasConfig = typeof window !== 'undefined' ? localStorage.getItem(configChave) : null;
    const limiteAviso = diasConfig ? parseInt(diasConfig, 10) : 60;
    const limiteCritico = Math.max(15, Math.floor(limiteAviso / 2));

    if (dias < 0) return { nivel: 'VENCIDO', dias };
    if (dias <= limiteCritico) return { nivel: 'CRITICO', dias };
    if (dias <= limiteAviso) return { nivel: 'AVISO', dias };
    return { nivel: 'OK', dias };
  }

  // Regra GT: 20 dias ANTES por padrão ou customizado
  if (tipo === 'GT') {
    const diasConfig = typeof window !== 'undefined' ? localStorage.getItem('config_alerta_gt') : null;
    const limiteAviso = diasConfig ? parseInt(diasConfig, 10) : 20;
    const limiteCritico = Math.max(5, Math.floor(limiteAviso / 3));

    if (dias < 0) return { nivel: 'VENCIDO', dias };
    if (dias <= limiteCritico) return { nivel: 'CRITICO', dias };
    if (dias <= limiteAviso) return { nivel: 'AVISO', dias };
    return { nivel: 'OK', dias };
  }

  // Regra Manejo: 7 dias ANTES por padrão ou customizado
  if (tipo === 'MANEJO') {
    const diasConfig = typeof window !== 'undefined' ? localStorage.getItem('config_alerta_manejo') : null;
    const limiteAviso = diasConfig ? parseInt(diasConfig, 10) : 7;
    const limiteCritico = Math.max(2, Math.floor(limiteAviso / 3));

    if (dias < 0) return { nivel: 'VENCIDO', dias };
    if (dias <= limiteCritico) return { nivel: 'CRITICO', dias };
    if (dias <= limiteAviso) return { nivel: 'AVISO', dias };
    return { nivel: 'OK', dias };
  }

  // Fallback padrão
  if (dias < 0) return { nivel: 'VENCIDO', dias };
  if (dias <= 15) return { nivel: 'CRITICO', dias };
  if (dias <= 30) return { nivel: 'AVISO', dias };
  return { nivel: 'OK', dias };
}

export function obterClasseAlerta(nivel: NivelAlerta): string {
  switch (nivel) {
    case 'VENCIDO': return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'CRITICO': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    case 'AVISO': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    default: return 'text-brand-green bg-brand-green/10 border-brand-green/20';
  }
}
