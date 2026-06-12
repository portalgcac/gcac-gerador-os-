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

  // Determinar os padrões e chaves de configuração do localStorage
  let configChave = '';
  let padraoAviso = 30; // fallback padrão
  if (tipo === 'CR') { configChave = 'config_alerta_cr'; padraoAviso = 60; }
  else if (tipo === 'CRAF') { configChave = 'config_alerta_craf'; padraoAviso = 60; }
  else if (tipo === 'GT') { configChave = 'config_alerta_gt'; padraoAviso = 20; }
  else if (tipo === 'MANEJO') { configChave = 'config_alerta_manejo'; padraoAviso = 7; }
  else if (tipo === 'IBAMA_CR') { configChave = 'config_alerta_ibama_cr'; padraoAviso = -1; }

  const diasConfig = (configChave && typeof window !== 'undefined') ? localStorage.getItem(configChave) : null;
  const limiteAviso = diasConfig ? parseInt(diasConfig, 10) : padraoAviso;

  if (dias < 0) {
    // Se o vencimento passou do limite de aviso negativo (ex: limite -1, dias -2)
    if (dias <= limiteAviso) return { nivel: 'VENCIDO', dias };
    return { nivel: 'CRITICO', dias };
  }

  if (limiteAviso < 0) {
    return { nivel: 'OK', dias };
  }

  const limiteCritico = Math.max(1, Math.floor(limiteAviso / 2));
  if (dias <= limiteCritico) return { nivel: 'CRITICO', dias };
  if (dias <= limiteAviso) return { nivel: 'AVISO', dias };
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
