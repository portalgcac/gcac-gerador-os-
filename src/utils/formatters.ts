import { StatusOS, FormaPagamento, StatusOrcamento, StatusExecucaoServico } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export function formatarData(dataISO: string): string {
  try {
    return format(parseISO(dataISO), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dataISO;
  }
}

export function formatarDataHora(dataISO: string): string {
  try {
    return format(parseISO(dataISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dataISO;
  }
}

export function formatarCPF(cpf: string): string {
  const numeros = cpf.replace(/\D/g, '');
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatarCNPJ(cnpj: string): string {
  const numeros = cnpj.replace(/\D/g, '');
  if (numeros.length <= 11) return formatarCPF(cnpj);
  return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatarTelefone(tel: string): string {
  const numeros = tel.replace(/\D/g, '');
  if (numeros.length === 11) {
    return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

export function formatarNumeroOS(numero: number): string {
  return `OS-${String(numero).padStart(4, '0')}`;
}

export function classeStatus(status: StatusOS): string {
  switch (status) {
    case 'Aguardando Pagamento': return 'badge-pendente';
    case 'Parcialmente Pago':    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Gratuidade':           return 'badge-andamento';
    case 'Pago':                 return 'badge-concluido';
    default:                     return 'badge';
  }
}

export function corStatus(status: StatusOS): string {
  switch (status) {
    case 'Aguardando Pagamento': return '#eab308';
    case 'Parcialmente Pago':    return '#f97316';
    case 'Gratuidade':           return '#2d8de0';
    case 'Pago':                 return '#6DBE45';
    default:                     return '#8A8A8A';
  }
}

export function classeStatusOrcamento(status: StatusOrcamento): string {
  switch (status) {
    case 'Pendente': return 'badge-pendente';
    case 'Aprovado': return 'badge-concluido';
    case 'Recusado': return 'badge-cancelado text-red-400 bg-red-500/10 border-red-500/20'; // Custom if badge-cancelado is not enough
    default:         return 'badge';
  }
}

export function corStatusOrcamento(status: StatusOrcamento): string {
  switch (status) {
    case 'Pendente': return '#eab308'; // amarelo
    case 'Aprovado': return '#6DBE45'; // verde
    case 'Recusado': return '#f87171'; // vermelho
    default:         return '#8A8A8A';
  }
}

export function classeStatusExecucao(status?: StatusExecucaoServico): string {
  switch (status) {
    case 'Não Iniciado':                  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'Iniciado — Montando Processo':   return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Aguardando Documentos':         return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'Protocolado — Ag. PF':          return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'Concluído':                    return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'Cancelado / Não Executado':    return 'bg-red-500/20 text-red-300 border-red-500/30';
    default:                              return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function iconeStatusExecucao(status?: StatusExecucaoServico): string {
  switch (status) {
    case 'Não Iniciado':                  return '⏳';
    case 'Iniciado — Montando Processo':   return '🔧';
    case 'Aguardando Documentos':         return '📄';
    case 'Protocolado — Ag. PF':          return '📤';
    case 'Concluído':                    return '✅';
    case 'Cancelado / Não Executado':    return '❌';
    default:                              return '⏳';
  }
}

export function parsearMoeda(valor: string): number {
  const limpo = valor.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

export function hoje(): string {
  return new Date().toISOString().split('T')[0];
}

export function calcularProgressoServicos(servicos: { statusExecucao?: StatusExecucaoServico }[]): number {
  if (!servicos || servicos.length === 0) return 0;
  
  const servicosAtivos = servicos.filter(s => s.statusExecucao !== 'Cancelado / Não Executado');
  if (servicosAtivos.length === 0) return 100;

  const pesos: Record<string, number> = {
    'Não Iniciado': 0,
    'Iniciado — Montando Processo': 25,
    'Aguardando Documentos': 50,
    'Protocolado — Ag. PF': 75,
    'Concluído': 100,
  };

  const soma = servicosAtivos.reduce((acc, s) => acc + (pesos[s.statusExecucao || 'Não Iniciado'] || 0), 0);
  return Math.round(soma / servicosAtivos.length);
}

export function obterResumoExecucao(servicos: { statusExecucao?: StatusExecucaoServico }[]) {
  if (!servicos || servicos.length === 0) return null;

  const total = servicos.length;
  const statuses = servicos.map(s => s.statusExecucao || 'Não Iniciado');
  const todosIguais = statuses.every(s => s === statuses[0]);
  const statusUnico = statuses[0] as StatusExecucaoServico;

  if (todosIguais) {
    return {
      texto: total === 1 ? statusUnico : `${total} Serviços: ${statusUnico}`,
      classe: classeStatusExecucao(statusUnico),
      icone: iconeStatusExecucao(statusUnico),
      tipo: 'unificado' as const,
      progresso: calcularProgressoServicos(servicos)
    };
  }

  const concluidos = servicos.filter(s => s.statusExecucao === 'Concluído').length;
  const cancelados = servicos.filter(s => s.statusExecucao === 'Cancelado / Não Executado').length;
  const pendentes = total - concluidos - cancelados;
  const progresso = calcularProgressoServicos(servicos);

  // Caso todos estejam finalizados (mistura de Concluídos e Cancelados)
  if (pendentes === 0 && concluidos > 0 && cancelados > 0) {
    return {
      texto: `${concluidos} Concluído${concluidos > 1 ? 's' : ''}, ${cancelados} Cancelado${cancelados > 1 ? 's' : ''}`,
      classe: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icone: '⚠️',
      progresso: 100,
      tipo: 'parcial' as const
    };
  }

  return {
    texto: cancelados > 0 
      ? `${concluidos}/${total - cancelados} Concluídos (${cancelados} cancelado${cancelados > 1 ? 's' : ''})`
      : `${concluidos}/${total} Concluídos`,
    progresso,
    tipo: 'misto' as const
  };
}

export function isOrdemConcluida(o: { status: StatusOS, servicos?: { statusExecucao?: StatusExecucaoServico }[] }): boolean {
  const financeiraConcluida = o.status === 'Pago' || o.status === 'Gratuidade';
  const servicos = o.servicos || [];
  if (servicos.length === 0) return financeiraConcluida;
  
  const execucaoConcluida = servicos.every((s: any) => 
    s.statusExecucao === 'Concluído' || s.statusExecucao === 'Cancelado / Não Executado'
  );
  return financeiraConcluida && execucaoConcluida;
}

export function removerAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizarCalibre(calibre: string | undefined | null): string {
  if (!calibre) return '';
  let c = calibre.trim().toUpperCase();
  
  c = c.replace(/\s+/g, ' ');
  
  // .17 HMR
  if (c.includes('17 HMR') || c.includes('17HMR') || c.includes('17 HORNADY') || c.includes('17HORNADY') || c.includes('17 ')) {
    return '.17 HMR';
  }
  // .22 WMR
  if (c.includes('22 WMR') || c.includes('22WMR') || c.includes('22 WINCHESTER') || c.includes('22WINCHESTER') || c.includes('22 W.M.R.')) {
    return '.22 WMR';
  }
  // .22 LR
  if (c.includes('22 LR') || c.includes('22LR') || c.includes('22 LONG RIFLE') || c.includes('22 L.R.') || c.includes('22 ') || c === '22' || c === '.22') {
    return '.22 LR';
  }
  // .357 MAG
  if (c.includes('357 MAG') || c.includes('357MAG') || c.includes('357 MAGNUM') || c.includes('357')) {
    return '.357 MAG';
  }
  // .38 SPL
  if (c.includes('38 SPL') || c.includes('38SPL') || c.includes('38 SPECIAL') || c.includes('38SPECIAL') || c.includes('38 ')) {
    return '.38 SPL';
  }
  // .380 ACP
  if (c.includes('380 ACP') || c.includes('380ACP') || c.includes('380 AUTO') || c.includes('380 AUTOMATIC') || c.includes('380')) {
    return '.380 ACP';
  }
  // 9mm LUGER
  if (c.includes('9MM') || c.includes('9 MM') || c.includes('9X19') || c.includes('9 X 19') || c.includes('9X19MM') || c.includes('PARABELLUM') || c.includes('LUGER') || c === '9') {
    return '9mm LUGER';
  }
  // .40 S&W
  if (c.includes('40 S&W') || c.includes('40S&W') || c.includes('40 SW') || c.includes('40SW') || c.includes('40 ')) {
    return '.40 S&W';
  }
  // .44 MAG
  if (c.includes('44 MAG') || c.includes('44MAG') || c.includes('44 MAGNUM') || c.includes('44 ')) {
    return '.44 MAG';
  }
  // .45 ACP
  if (c.includes('45 ACP') || c.includes('45ACP') || c.includes('45 AUTO') || c.includes('45 AUTOMATIC') || c.includes('45 ')) {
    return '.45 ACP';
  }
  // .454 CASULL
  if (c.includes('454 CASULL') || c.includes('454CASULL') || c.includes('454 ')) {
    return '.454 CASULL';
  }
  // 12 GA
  if (c.includes('12 GA') || c.includes('12GA') || c.includes('12 GAUGE') || c.includes('12 ')) {
    return c.includes('.') ? '.12 GA' : '12 GA';
  }
  // 20 GA
  if (c.includes('20 GA') || c.includes('20GA') || c.includes('20 GAUGE') || c.includes('20 ')) {
    return c.includes('.') ? '.20 GA' : '20 GA';
  }
  // 28 GA
  if (c.includes('28 GA') || c.includes('28GA') || c.includes('28 GAUGE') || c.includes('28 ')) {
    return c.includes('.') ? '.28 GA' : '28 GA';
  }
  // 36 GA
  if (c.includes('36 GA') || c.includes('36GA') || c.includes('36 GAUGE') || c.includes('36 ')) {
    return c.includes('.') ? '.36 GA' : '36 GA';
  }
  // .308 WIN / 7.62 NATO
  if (c.includes('308') || c.includes('7.62') || c.includes('7.62X51') || c.includes('7.62 NATO')) {
    return '.308 WIN / 7.62 NATO';
  }
  // .223 REM / 5.56 NATO
  if (c.includes('223') || c.includes('5.56') || c.includes('5.56X45') || c.includes('5.56 NATO')) {
    return '.223 REM / 5.56 NATO';
  }
  // .30-06 SPRG
  if (c.includes('30-06') || c.includes('3006') || c.includes('30-06 SPRG')) {
    return '.30-06 SPRG';
  }

  if (/^\d/.test(c) && !c.endsWith('GA')) {
    return '.' + c;
  }
  
  return c;
}

export function normalizarModelo(modelo: string | undefined | null): string {
  if (!modelo) return '';
  let m = modelo.trim().toUpperCase();
  
  m = m.replace(/\s+/g, ' ');
  
  if (m === 'CBC 7022' || m === 'CBC7022' || m === '7022') {
    return '7022';
  }
  if (m === 'CBC 7022 WAY' || m === '7022 WAY' || m === '7022WAY') {
    return '7022 WAY';
  }
  if (m === 'CBC 8122' || m === 'CBC8122' || m === '8122') {
    return '8122';
  }
  if (m === 'CBC 7122' || m === 'CBC7122' || m === '7122' || m === '7122 M' || m === '7122M' || m === 'CBC 7122 M') {
    return '7122';
  }
  
  if (m.startsWith('GLOCK ')) {
    m = m.replace('GLOCK ', 'G');
  }
  if (m.startsWith('G-')) {
    m = 'G' + m.substring(2);
  }
  
  if (m.startsWith('TAURUS ')) {
    m = m.replace('TAURUS ', '');
  }
  
  return m;
}

export function normalizarFabricante(fabricante: string | undefined | null): string {
  if (!fabricante) return '';
  let f = fabricante.trim().toUpperCase();
  
  if (f === 'ROSSI' || f === 'AMADEO ROSSI' || f.includes('ROSSI')) {
    return 'ROSSI';
  }
  if (f === 'TAURUS' || f === 'FORJA TAURUS' || f === 'FORJAS TAURUS' || f.includes('TAURUS')) {
    return 'TAURUS';
  }
  if (f === 'IMBEL' || f.includes('IMBEL')) {
    return 'IMBEL';
  }
  if (f === 'GLOCK' || f.includes('GLOCK')) {
    return 'GLOCK';
  }
  if (f === 'CBC' || f.includes('COMPANHIA BRASILEIRA DE CARTUCHOS')) {
    return 'CBC';
  }
  if (f === 'CZ' || f.includes('CESKA') || f.includes('ČESKÁ')) {
    return 'CZ';
  }
  
  return f;
}
