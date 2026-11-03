import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import {
  ColaboradorContrato,
  RegistroPontoColaborador,
  FechamentoColaborador,
  StatusDiaPonto,
  ModeloCalculoColaborador,
  DivisorMensalColaborador
} from '../types';

const STORAGE_KEY_CONTRATOS = (empresaId: string) => `gcac_colab_contratos_${empresaId}`;
const STORAGE_KEY_PONTOS = (empresaId: string) => `gcac_colab_pontos_${empresaId}`;
const STORAGE_KEY_FECHAMENTOS = (empresaId: string) => `gcac_colab_fechamentos_${empresaId}`;
const STORAGE_KEY_SEDE = (empresaId: string) => `gcac_sede_gps_${empresaId}`;

export interface ConfigSedeGps {
  latitude: number | null;
  longitude: number | null;
  raioMetros: number;
}

/**
 * Calcula a distância em metros entre duas coordenadas GPS (Fórmula de Haversine)
 */
export function calcularDistanciaMetros(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | undefined {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return undefined;
  }
  const R = 6371e3; // raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Converte horário "HH:mm" em minutos desde 00:00
 */
export function horaParaMinutos(hora?: string | null): number | null {
  if (!hora || !hora.includes(':')) return null;
  const [h, m] = hora.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Formata minutos totais em "HHhMMm" ou "+HH:MM"
 */
export function formatarMinutosHoras(minutos: number, comSinal = false): string {
  const negativo = minutos < 0;
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sinal = negativo ? '-' : comSinal && minutos > 0 ? '+' : '';
  return `${sinal}${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

/**
 * Converte minutos totais para string "HH:mm" (ex: 510 -> "08:30")
 */
export function minutosParaHoraInput(minutos: number): string {
  const abs = Math.max(0, Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calcula qual deve ser o horário de Saída ("HH:mm") para atingir exatamente a carga horária desejada
 */
export function calcularHoraSaidaParaCarga(
  horaEntrada: string,
  horaIntervaloIda: string,
  horaIntervaloVolta: string,
  cargaMinutosDesejada: number
): string {
  const ent = horaParaMinutos(horaEntrada) ?? 480; // 08:00
  const intIda = horaParaMinutos(horaIntervaloIda);
  const intVolta = horaParaMinutos(horaIntervaloVolta);

  let duracaoIntervalo = 0;
  if (intIda !== null && intVolta !== null && intVolta > intIda) {
    duracaoIntervalo = intVolta - intIda;
  }

  const saidaMin = (ent + duracaoIntervalo + Math.max(0, cargaMinutosDesejada)) % (24 * 60);
  return minutosParaHoraInput(saidaMin);
}

/**
 * Calcula minutos trabalhados no dia com base em Entrada, Intervalo e Saída
 */
export function calcularMinutosTrabalhadosDia(
  horaEntrada?: string,
  horaIntervaloIda?: string,
  horaIntervaloVolta?: string,
  horaSaida?: string
): number {
  const ent = horaParaMinutos(horaEntrada);
  const sai = horaParaMinutos(horaSaida);
  const intIda = horaParaMinutos(horaIntervaloIda);
  const intVolta = horaParaMinutos(horaIntervaloVolta);

  if (ent === null) return 0;

  // Se bateu entrada e saída para almoço mas ainda não voltou
  if (sai === null && intIda !== null && intVolta === null) {
    return Math.max(0, intIda - ent);
  }

  if (sai === null) return 0;

  let total = Math.max(0, sai - ent);
  if (intIda !== null && intVolta !== null && intVolta > intIda) {
    const intervalo = intVolta - intIda;
    total = Math.max(0, total - intervalo);
  }
  return total;
}

/**
 * Captura foto da câmera e comprime em WebP/JPEG leve (~20KB)
 */
export async function capturarFrameVideoComprimido(videoEl: HTMLVideoElement): Promise<string> {
  const canvas = document.createElement('canvas');
  const maxDim = 320;
  const vw = videoEl.videoWidth || 320;
  const vh = videoEl.videoHeight || 240;
  let width = vw;
  let height = vh;

  if (width > height) {
    if (width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    }
  } else {
    if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto de imagem indisponível');
  ctx.drawImage(videoEl, 0, 0, width, height);

  // Tenta WebP super leve (qualidade 0.65 -> ~15-22KB), fallback JPEG
  const webp = canvas.toDataURL('image/webp', 0.65);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.65);
}

// ── Mapeadores DB <-> App ────────────────────────────────────────────────

function mapContratoFromDb(row: any): ColaboradorContrato {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    usuarioEmail: row.usuario_email || undefined,
    nome: row.nome,
    cpfCnpj: row.cpf_cnpj || undefined,
    contato: row.contato || undefined,
    chavePix: row.chave_pix || undefined,
    cargoFuncao: row.cargo_funcao || 'Colaborador / Prestador PJ',
    dataInicio: row.data_inicio,
    modeloCalculo: row.modelo_calculo || 'mensal_proporcional',
    divisorMensal: row.divisor_mensal || 'dias_uteis',
    valorBase: Number(row.valor_base) || 0,
    cargaHorariaDiariaMin: Number(row.carga_horaria_diaria_min) || 480,
    horarioEntradaPadrao: row.horario_entrada_padrao || '08:00',
    horarioIntervaloInicioPadrao: row.horario_intervalo_inicio_padrao || '12:00',
    horarioIntervaloFimPadrao: row.horario_intervalo_fim_padrao || '13:30',
    horarioSaidaPadrao: row.horario_saida_padrao || '17:30',
    diasSemanaTrabalho: Array.isArray(row.dias_semana_trabalho) ? row.dias_semana_trabalho : [1, 2, 3, 4, 5],
    exigeFotoPonto: row.exige_foto_ponto !== false,
    exigeGpsPonto: row.exige_gps_ponto !== false,
    ativo: row.ativo !== false,
    observacoes: row.observacoes || undefined,
    criadoEm: row.criado_em || new Date().toISOString(),
    atualizadoEm: row.atualizado_em || undefined
  };
}

function mapPontoFromDb(row: any): RegistroPontoColaborador {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    colaboradorId: row.colaborador_id,
    colaboradorEmail: row.colaborador_email || undefined,
    colaboradorNome: row.colaborador_nome || '',
    data: row.data,
    statusDia: row.status_dia || 'trabalhado',
    horaEntrada: row.hora_entrada || undefined,
    horaIntervaloIda: row.hora_intervalo_ida || undefined,
    horaIntervaloVolta: row.hora_intervalo_volta || undefined,
    horaSaida: row.hora_saida || undefined,
    minutosTrabalhados: Number(row.minutos_trabalhados) || 0,
    minutosEsperados: Number(row.minutos_esperados) || 480,
    minutosSaldo: Number(row.minutos_saldo) || 0,
    fotoEntradaUrl: row.foto_entrada_url || undefined,
    fotoSaidaUrl: row.foto_saida_url || undefined,
    latEntrada: row.lat_entrada !== null && row.lat_entrada !== undefined ? Number(row.lat_entrada) : undefined,
    lngEntrada: row.lng_entrada !== null && row.lng_entrada !== undefined ? Number(row.lng_entrada) : undefined,
    distanciaEntradaMetros: row.distancia_entrada_metros !== null && row.distancia_entrada_metros !== undefined ? Number(row.distancia_entrada_metros) : undefined,
    latSaida: row.lat_saida !== null && row.lat_saida !== undefined ? Number(row.lat_saida) : undefined,
    lngSaida: row.lng_saida !== null && row.lng_saida !== undefined ? Number(row.lng_saida) : undefined,
    distanciaSaidaMetros: row.distancia_saida_metros !== null && row.distancia_saida_metros !== undefined ? Number(row.distancia_saida_metros) : undefined,
    origemRegistro: row.origem_registro || 'eletronico',
    observacao: row.observacao || undefined,
    criadoEm: row.criado_em || new Date().toISOString(),
    atualizadoEm: row.atualizado_em || undefined
  };
}

function mapFechamentoFromDb(row: any): FechamentoColaborador {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    colaboradorId: row.colaborador_id,
    colaboradorNome: row.colaborador_nome,
    dataInicioPeriodo: row.data_inicio_periodo,
    dataFimPeriodo: row.data_fim_periodo,
    diasUteisPeriodo: Number(row.dias_uteis_periodo) || 0,
    diasTrabalhados: Number(row.dias_trabalhados) || 0,
    diasFaltasDescontadas: Number(row.dias_faltas_descontadas) || 0,
    diasFaltasAbonadas: Number(row.dias_faltas_abonadas) || 0,
    minutosTrabalhadosTotal: Number(row.minutos_trabalhados_total) || 0,
    minutosEsperadosTotal: Number(row.minutos_esperados_total) || 0,
    valorBaseProporcional: Number(row.valor_base_proporcional) || 0,
    valorDescontosAusenciasHoras: Number(row.valor_descontos_ausencias_horas) || 0,
    valorHorasExtras: Number(row.valor_horas_extras) || 0,
    valorComissoesOs: Number(row.valor_comissoes_os) || 0,
    valorAjudaCusto: Number(row.valor_ajuda_custo) || 0,
    valorAdiantamentos: Number(row.valor_adiantamentos) || 0,
    valorAjusteManual: Number(row.valor_ajuste_manual) || 0,
    motivoAjusteManual: row.motivo_ajuste_manual || undefined,
    valorLiquidoFinal: Number(row.valor_liquido_final) || 0,
    numeroNf: row.numero_nf || undefined,
    dataEmissaoNf: row.data_emissao_nf || undefined,
    notaFiscalUrl: row.nota_fiscal_url || undefined,
    comprovantePagamentoUrl: row.comprovante_pagamento_url || undefined,
    despesaId: row.despesa_id || undefined,
    status: row.status || 'aguardando_nf',
    observacoes: row.observacoes || undefined,
    snapshotPonto: Array.isArray(row.snapshot_ponto) ? row.snapshot_ponto : [],
    criadoEm: row.criado_em || new Date().toISOString(),
    atualizadoEm: row.atualizado_em || undefined
  };
}

// ── Sede GPS Config ──────────────────────────────────────────────────────

export async function obterConfigSedeGps(empresaId: string): Promise<ConfigSedeGps> {
  const localRaw = localStorage.getItem(STORAGE_KEY_SEDE(empresaId));
  let fallback: ConfigSedeGps = { latitude: null, longitude: null, raioMetros: 150 };
  if (localRaw) {
    try {
      fallback = JSON.parse(localRaw);
    } catch { /* ignore */ }
  }

  try {
    const { data, error } = await supabase
      .from('empresas')
      .select('sede_latitude, sede_longitude, sede_raio_metros')
      .eq('id', empresaId)
      .maybeSingle();

    if (!error && data) {
      const cfg: ConfigSedeGps = {
        latitude: data.sede_latitude ?? fallback.latitude,
        longitude: data.sede_longitude ?? fallback.longitude,
        raioMetros: data.sede_raio_metros ?? fallback.raioMetros ?? 150
      };
      localStorage.setItem(STORAGE_KEY_SEDE(empresaId), JSON.stringify(cfg));
      return cfg;
    }
  } catch { /* fallback local */ }

  return fallback;
}

export async function salvarConfigSedeGps(empresaId: string, config: ConfigSedeGps): Promise<void> {
  localStorage.setItem(STORAGE_KEY_SEDE(empresaId), JSON.stringify(config));
  try {
    await supabase
      .from('empresas')
      .update({
        sede_latitude: config.latitude,
        sede_longitude: config.longitude,
        sede_raio_metros: config.raioMetros
      })
      .eq('id', empresaId);
  } catch { /* salvo em localStorage */ }
}

// ── CRUD Contratos de Colaboradores ──────────────────────────────────────

export async function listarContratosColaboradores(empresaId: string): Promise<ColaboradorContrato[]> {
  const localRaw = localStorage.getItem(STORAGE_KEY_CONTRATOS(empresaId));
  let locais: ColaboradorContrato[] = [];
  if (localRaw) {
    try {
      locais = JSON.parse(localRaw);
    } catch { /* ignore */ }
  }

  try {
    const { data, error } = await supabase
      .from('colaboradores_contratos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });

    if (!error && data) {
      const remotos = data.map(mapContratoFromDb);
      // Merge mantendo registros locais que eventualmente não subiram ainda
      const idsRemotos = new Set(remotos.map(r => r.id));
      const pendentesLocais = locais.filter(l => !idsRemotos.has(l.id));
      const unificados = [...remotos, ...pendentesLocais];
      localStorage.setItem(STORAGE_KEY_CONTRATOS(empresaId), JSON.stringify(unificados));
      return unificados;
    }
  } catch { /* usa cache local */ }

  return locais;
}

export async function salvarContratoColaborador(
  contrato: Omit<ColaboradorContrato, 'id' | 'criadoEm'> & { id?: string }
): Promise<ColaboradorContrato> {
  const id = contrato.id || uuidv4();
  const agora = new Date().toISOString();
  const completo: ColaboradorContrato = {
    ...contrato,
    id,
    criadoEm: agora,
    atualizadoEm: agora
  };

  // Salva imediatamente no cache local
  const atuais = await listarContratosColaboradores(contrato.empresaId);
  const idx = atuais.findIndex(c => c.id === id);
  const novaLista = idx >= 0
    ? atuais.map(c => (c.id === id ? completo : c))
    : [...atuais, completo];
  localStorage.setItem(STORAGE_KEY_CONTRATOS(contrato.empresaId), JSON.stringify(novaLista));

  // Tenta persistir no Supabase
  try {
    const payload = {
      id,
      empresa_id: contrato.empresaId,
      usuario_email: contrato.usuarioEmail?.trim().toLowerCase() || null,
      nome: contrato.nome.trim(),
      cpf_cnpj: contrato.cpfCnpj || null,
      contato: contrato.contato || null,
      chave_pix: contrato.chavePix || null,
      cargo_funcao: contrato.cargoFuncao || 'Colaborador / Prestador PJ',
      data_inicio: contrato.dataInicio,
      modelo_calculo: contrato.modeloCalculo,
      divisor_mensal: contrato.divisorMensal,
      valor_base: contrato.valorBase,
      carga_horaria_diaria_min: contrato.cargaHorariaDiariaMin,
      horario_entrada_padrao: contrato.horarioEntradaPadrao,
      horario_intervalo_inicio_padrao: contrato.horarioIntervaloInicioPadrao,
      horario_intervalo_fim_padrao: contrato.horarioIntervaloFimPadrao,
      horario_saida_padrao: contrato.horarioSaidaPadrao,
      dias_semana_trabalho: contrato.diasSemanaTrabalho,
      exige_foto_ponto: contrato.exigeFotoPonto,
      exige_gps_ponto: contrato.exigeGpsPonto,
      ativo: contrato.ativo,
      observacoes: contrato.observacoes || null,
      atualizado_em: agora
    };

    const { data, error } = await supabase
      .from('colaboradores_contratos')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .single();

    if (!error && data) {
      return mapContratoFromDb(data);
    }
  } catch (err) {
    console.warn('Tabela colaboradores_contratos ainda não migrada no Supabase, usando persistência híbrida:', err);
  }

  return completo;
}

export async function excluirContratoColaborador(empresaId: string, id: string): Promise<void> {
  const atuais = await listarContratosColaboradores(empresaId);
  const filtrados = atuais.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY_CONTRATOS(empresaId), JSON.stringify(filtrados));

  try {
    await supabase.from('colaboradores_contratos').delete().eq('id', id);
  } catch { /* ignore */ }
}

// ── CRUD Registros de Ponto ──────────────────────────────────────────────

export async function listarRegistrosPonto(
  empresaId: string,
  colaboradorId?: string
): Promise<RegistroPontoColaborador[]> {
  const localRaw = localStorage.getItem(STORAGE_KEY_PONTOS(empresaId));
  let locais: RegistroPontoColaborador[] = [];
  if (localRaw) {
    try {
      locais = JSON.parse(localRaw);
    } catch { /* ignore */ }
  }

  try {
    let query = supabase
      .from('registros_ponto_colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data', { ascending: true });

    if (colaboradorId) {
      query = query.eq('colaborador_id', colaboradorId);
    }

    const { data, error } = await query;
    if (!error && data) {
      const remotos = data.map(mapPontoFromDb);
      if (!colaboradorId) {
        const chavesRemotas = new Set(remotos.map(r => `${r.colaboradorId}_${r.data}`));
        const pendentesLocais = locais.filter(l => !chavesRemotas.has(`${l.colaboradorId}_${l.data}`));
        const unificados = [...remotos, ...pendentesLocais];
        localStorage.setItem(STORAGE_KEY_PONTOS(empresaId), JSON.stringify(unificados));
        return unificados;
      } else {
        const chavesRemotas = new Set(remotos.map(r => `${r.colaboradorId}_${r.data}`));
        const pendentesLocais = locais.filter(
          l => l.colaboradorId === colaboradorId && !chavesRemotas.has(`${l.colaboradorId}_${l.data}`)
        );
        return [...remotos, ...pendentesLocais];
      }
    }
  } catch { /* fallback local */ }

  return colaboradorId ? locais.filter(l => l.colaboradorId === colaboradorId) : locais;
}

export async function salvarRegistroPonto(
  registro: Omit<RegistroPontoColaborador, 'id' | 'criadoEm'> & { id?: string }
): Promise<RegistroPontoColaborador> {
  const localRaw = localStorage.getItem(STORAGE_KEY_PONTOS(registro.empresaId));
  let locais: RegistroPontoColaborador[] = [];
  if (localRaw) {
    try {
      locais = JSON.parse(localRaw);
    } catch { /* ignore */ }
  }

  const existente = locais.find(
    r => r.id === registro.id || (r.colaboradorId === registro.colaboradorId && r.data === registro.data)
  );
  const id = existente?.id || registro.id || uuidv4();
  const agora = new Date().toISOString();

  const completo: RegistroPontoColaborador = {
    ...registro,
    id,
    criadoEm: existente?.criadoEm || agora,
    atualizadoEm: agora
  };

  const novaLista = existente
    ? locais.map(r => (r.id === existente.id ? completo : r))
    : [...locais, completo];
  localStorage.setItem(STORAGE_KEY_PONTOS(registro.empresaId), JSON.stringify(novaLista));

  try {
    const payload = {
      id,
      empresa_id: completo.empresaId,
      colaborador_id: completo.colaboradorId,
      colaborador_email: completo.colaboradorEmail || null,
      colaborador_nome: completo.colaboradorNome,
      data: completo.data,
      status_dia: completo.statusDia,
      hora_entrada: completo.horaEntrada || null,
      hora_intervalo_ida: completo.horaIntervaloIda || null,
      hora_intervalo_volta: completo.horaIntervaloVolta || null,
      hora_saida: completo.horaSaida || null,
      minutos_trabalhados: completo.minutosTrabalhados,
      minutos_esperados: completo.minutosEsperados,
      minutos_saldo: completo.minutosSaldo,
      foto_entrada_url: completo.fotoEntradaUrl || null,
      foto_saida_url: completo.fotoSaidaUrl || null,
      lat_entrada: completo.latEntrada ?? null,
      lng_entrada: completo.lngEntrada ?? null,
      distancia_entrada_metros: completo.distanciaEntradaMetros ?? null,
      lat_saida: completo.latSaida ?? null,
      lng_saida: completo.lngSaida ?? null,
      distancia_saida_metros: completo.distanciaSaidaMetros ?? null,
      origem_registro: completo.origemRegistro,
      observacao: completo.observacao || null,
      atualizado_em: agora
    };

    const { data, error } = await supabase
      .from('registros_ponto_colaboradores')
      .upsert([payload], { onConflict: 'colaborador_id,data' })
      .select()
      .single();

    if (!error && data) {
      return mapPontoFromDb(data);
    }
  } catch (err) {
    console.warn('Fallback local em salvarRegistroPonto:', err);
  }

  return completo;
}

export async function excluirRegistroPonto(empresaId: string, id: string): Promise<void> {
  const localRaw = localStorage.getItem(STORAGE_KEY_PONTOS(empresaId));
  if (localRaw) {
    try {
      const locais: RegistroPontoColaborador[] = JSON.parse(localRaw);
      localStorage.setItem(
        STORAGE_KEY_PONTOS(empresaId),
        JSON.stringify(locais.filter(r => r.id !== id))
      );
    } catch { /* ignore */ }
  }

  try {
    await supabase.from('registros_ponto_colaboradores').delete().eq('id', id);
  } catch { /* ignore */ }
}

// ── CRUD Fechamentos & Notas Fiscais ─────────────────────────────────────

export async function listarFechamentosColaboradores(empresaId: string): Promise<FechamentoColaborador[]> {
  const localRaw = localStorage.getItem(STORAGE_KEY_FECHAMENTOS(empresaId));
  let locais: FechamentoColaborador[] = [];
  if (localRaw) {
    try {
      locais = JSON.parse(localRaw);
    } catch { /* ignore */ }
  }

  try {
    const { data, error } = await supabase
      .from('fechamentos_colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (!error && data) {
      const remotos = data.map(mapFechamentoFromDb);
      const idsRemotos = new Set(remotos.map(r => r.id));
      const pendentesLocais = locais.filter(l => !idsRemotos.has(l.id));
      const unificados = [...remotos, ...pendentesLocais];
      localStorage.setItem(STORAGE_KEY_FECHAMENTOS(empresaId), JSON.stringify(unificados));
      return unificados;
    }
  } catch { /* fallback local */ }

  return locais;
}

export async function salvarFechamentoColaborador(
  fechamento: Omit<FechamentoColaborador, 'id' | 'criadoEm'> & { id?: string }
): Promise<FechamentoColaborador> {
  const id = fechamento.id || uuidv4();
  const agora = new Date().toISOString();
  const completo: FechamentoColaborador = {
    ...fechamento,
    id,
    criadoEm: agora,
    atualizadoEm: agora
  };

  const atuais = await listarFechamentosColaboradores(fechamento.empresaId);
  const idx = atuais.findIndex(f => f.id === id);
  const novaLista = idx >= 0
    ? atuais.map(f => (f.id === id ? completo : f))
    : [completo, ...atuais];
  localStorage.setItem(STORAGE_KEY_FECHAMENTOS(fechamento.empresaId), JSON.stringify(novaLista));

  try {
    const payload = {
      id,
      empresa_id: completo.empresaId,
      colaborador_id: completo.colaboradorId,
      colaborador_nome: completo.colaboradorNome,
      data_inicio_periodo: completo.dataInicioPeriodo,
      data_fim_periodo: completo.dataFimPeriodo,
      dias_uteis_periodo: completo.diasUteisPeriodo,
      dias_trabalhados: completo.diasTrabalhados,
      dias_faltas_descontadas: completo.diasFaltasDescontadas,
      dias_faltas_abonadas: completo.diasFaltasAbonadas,
      minutos_trabalhados_total: completo.minutosTrabalhadosTotal,
      minutos_esperados_total: completo.minutosEsperadosTotal,
      valor_base_proporcional: completo.valorBaseProporcional,
      valor_descontos_ausencias_horas: completo.valorDescontosAusenciasHoras,
      valor_horas_extras: completo.valorHorasExtras,
      valor_comissoes_os: completo.valorComissoesOs,
      valor_ajuda_custo: completo.valorAjudaCusto,
      valor_adiantamentos: completo.valorAdiantamentos,
      valor_ajuste_manual: completo.valorAjusteManual || 0,
      motivo_ajuste_manual: completo.motivoAjusteManual || null,
      valor_liquido_final: completo.valorLiquidoFinal,
      numero_nf: completo.numeroNf || null,
      data_emissao_nf: completo.dataEmissaoNf || null,
      nota_fiscal_url: completo.notaFiscalUrl || null,
      comprovante_pagamento_url: completo.comprovantePagamentoUrl || null,
      despesa_id: completo.despesaId || null,
      status: completo.status,
      observacoes: completo.observacoes || null,
      snapshot_ponto: completo.snapshotPonto || [],
      atualizado_em: agora
    };

    let { data, error } = await supabase
      .from('fechamentos_colaboradores')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .single();

    if (error && (error.message?.includes('ajuste_manual') || error.code === '42703')) {
      // Fallback caso a coluna ainda não tenha sido criada no Supabase
      const payloadFallback: Record<string, any> = { ...payload };
      delete payloadFallback.valor_ajuste_manual;
      delete payloadFallback.motivo_ajuste_manual;
      if (completo.valorAjusteManual) {
        payloadFallback.observacoes = `${payloadFallback.observacoes ? payloadFallback.observacoes + ' | ' : ''}[Ajuste Manual: R$ ${completo.valorAjusteManual.toFixed(2)} - Motivo: ${completo.motivoAjusteManual || 'N/A'}]`;
      }
      const resFallback = await supabase
        .from('fechamentos_colaboradores')
        .upsert([payloadFallback], { onConflict: 'id' })
        .select()
        .single();
      data = resFallback.data;
      error = resFallback.error;
    }

    if (!error && data) {
      return mapFechamentoFromDb(data);
    }
  } catch (err) {
    console.warn('Fallback local em salvarFechamentoColaborador:', err);
  }

  return completo;
}

export async function excluirFechamentoColaborador(empresaId: string, id: string): Promise<void> {
  const atuais = await listarFechamentosColaboradores(empresaId);
  localStorage.setItem(
    STORAGE_KEY_FECHAMENTOS(empresaId),
    JSON.stringify(atuais.filter(f => f.id !== id))
  );

  try {
    await supabase.from('fechamentos_colaboradores').delete().eq('id', id);
  } catch { /* ignore */ }
}

// ── Motor de Cálculo de Apuração do Colaborador (Ex: Hector 19/10/2026) ──

export interface DiaCalendarioApuracao {
  data: string; // YYYY-MM-DD
  diaSemanaNumero: number; // 0=Dom ... 6=Sáb
  diaSemanaLabel: string;
  ehDiaTrabalhoContrato: boolean;
  antesDaAdmissao: boolean;
  registro?: RegistroPontoColaborador;
  statusEfetivo: StatusDiaPonto | 'nao_iniciado_contrato' | 'descanso_semanal' | 'sem_lancamento';
  minutosEsperados: number;
  minutosTrabalhados: number;
  minutosDiferenca: number; // negativo = horas a menos/falta, positivo = horas a mais
}

export interface ResultadoApuracaoColaborador {
  diasCalendario: DiaCalendarioApuracao[];
  dataInicioEfetiva: string;
  dataFimEfetiva: string;
  totalDiasUteisMesInteiro: number;
  diasUteisDesdeAdmissao: number;
  diasCorridosDesdeAdmissao: number;
  diasTrabalhadosCount: number;
  diasParciaisCount: number;
  diasFaltasDescontadasCount: number;
  diasFaltasAbonadasCount: number;
  diasSemLancamentoCount: number;
  minutosEsperadosPeriodo: number;
  minutosTrabalhadosPeriodo: number;
  minutosFaltantesForaFaltasInteiras: number;
  minutosExtrasPeriodo: number;
  valorDiaRef: number;
  valorHoraRef: number;
  valorBaseProporcionalBruto: number;
  valorDescontoFaltasInteiras: number;
  valorDescontoHorasParciais: number;
  valorDescontosTotal: number;
  valorHorasExtras: number;
  valorLiquidoHorasEDias: number;
}

const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function calcularApuracaoPeriodo(
  contrato: ColaboradorContrato,
  dataInicioFiltro: string, // YYYY-MM-DD
  dataFimFiltro: string, // YYYY-MM-DD
  registros: RegistroPontoColaborador[],
  considerarDiasSemRegistroComoPresenca = false
): ResultadoApuracaoColaborador {
  const mapaRegistros = new Map<string, RegistroPontoColaborador>();
  registros.forEach(r => {
    if (r.colaboradorId === contrato.id) {
      mapaRegistros.set(r.data, r);
    }
  });

  // 1. Calcular total de dias úteis do mês de referência para o divisor por dias úteis
  const [anoRef, mesRef] = dataFimFiltro.split('-').map(Number);
  const ultimoDiaMesRef = new Date(anoRef, mesRef, 0).getDate();
  let totalDiasUteisMesInteiro = 0;
  for (let d = 1; d <= ultimoDiaMesRef; d++) {
    const dt = new Date(anoRef, mesRef - 1, d, 12, 0, 0);
    if (contrato.diasSemanaTrabalho.includes(dt.getDay())) {
      totalDiasUteisMesInteiro++;
    }
  }
  if (totalDiasUteisMesInteiro === 0) totalDiasUteisMesInteiro = 22;

  // 2. Valor de referência por dia e por hora
  const horasDiarias = (contrato.cargaHorariaDiariaMin || 480) / 60;
  let valorDiaRef = 0;
  let valorHoraRef = 0;

  if (contrato.modeloCalculo === 'mensal_proporcional') {
    const divisorDias = contrato.divisorMensal === '30_dias' ? 30 : totalDiasUteisMesInteiro;
    valorDiaRef = contrato.valorBase / divisorDias;
    valorHoraRef = valorDiaRef / (horasDiarias || 8);
  } else if (contrato.modeloCalculo === 'diaria') {
    valorDiaRef = contrato.valorBase;
    valorHoraRef = valorDiaRef / (horasDiarias || 8);
  } else {
    // horista
    valorHoraRef = contrato.valorBase;
    valorDiaRef = valorHoraRef * (horasDiarias || 8);
  }

  // 3. Percorrer todos os dias do intervalo filtrado
  const dtCursor = new Date(dataInicioFiltro + 'T12:00:00');
  const dtFim = new Date(dataFimFiltro + 'T12:00:00');
  const diasCalendario: DiaCalendarioApuracao[] = [];

  let diasUteisDesdeAdmissao = 0;
  let diasCorridosDesdeAdmissao = 0;
  let diasTrabalhadosCount = 0;
  let diasParciaisCount = 0;
  let diasFaltasDescontadasCount = 0;
  let diasFaltasAbonadasCount = 0;
  let diasSemLancamentoCount = 0;

  let minutosEsperadosPeriodo = 0;
  let minutosTrabalhadosPeriodo = 0;
  let minutosFaltantesForaFaltasInteiras = 0;
  let minutosExtrasPeriodo = 0;

  const hojeStr = new Date().toISOString().slice(0, 10);

  while (dtCursor <= dtFim) {
    const yyyy = dtCursor.getFullYear();
    const mm = String(dtCursor.getMonth() + 1).padStart(2, '0');
    const dd = String(dtCursor.getDate()).padStart(2, '0');
    const dataStr = `${yyyy}-${mm}-${dd}`;
    const diaSemanaNumero = dtCursor.getDay();
    const diaSemanaLabel = DIAS_SEMANA_CURTO[diaSemanaNumero];

    const antesDaAdmissao = Boolean(contrato.dataInicio && dataStr < contrato.dataInicio);
    const ehDiaTrabalhoContrato = contrato.diasSemanaTrabalho.includes(diaSemanaNumero);
    const reg = mapaRegistros.get(dataStr);

    if (antesDaAdmissao) {
      diasCalendario.push({
        data: dataStr,
        diaSemanaNumero,
        diaSemanaLabel,
        ehDiaTrabalhoContrato,
        antesDaAdmissao: true,
        registro: reg,
        statusEfetivo: 'nao_iniciado_contrato',
        minutosEsperados: 0,
        minutosTrabalhados: 0,
        minutosDiferenca: 0
      });
      dtCursor.setDate(dtCursor.getDate() + 1);
      continue;
    }

    diasCorridosDesdeAdmissao++;

    if (!ehDiaTrabalhoContrato && !reg) {
      diasCalendario.push({
        data: dataStr,
        diaSemanaNumero,
        diaSemanaLabel,
        ehDiaTrabalhoContrato: false,
        antesDaAdmissao: false,
        statusEfetivo: 'descanso_semanal',
        minutosEsperados: 0,
        minutosTrabalhados: 0,
        minutosDiferenca: 0
      });
      dtCursor.setDate(dtCursor.getDate() + 1);
      continue;
    }

    if (ehDiaTrabalhoContrato) {
      diasUteisDesdeAdmissao++;
    }

    const minEsp = ehDiaTrabalhoContrato ? contrato.cargaHorariaDiariaMin : 0;

    if (reg) {
      let minTrab = reg.minutosTrabalhados;
      if (reg.statusDia === 'falta_descontada') {
        minTrab = 0;
        diasFaltasDescontadasCount++;
        minutosEsperadosPeriodo += minEsp;
      } else if (reg.statusDia === 'falta_abonada') {
        minTrab = minEsp;
        diasFaltasAbonadasCount++;
        minutosEsperadosPeriodo += minEsp;
        minutosTrabalhadosPeriodo += minTrab;
      } else if (reg.statusDia === 'folga_feriado') {
        minTrab = 0;
      } else {
        // trabalhado ou parcial
        minutosEsperadosPeriodo += minEsp;
        minutosTrabalhadosPeriodo += minTrab;

        if (minTrab < minEsp) {
          diasParciaisCount++;
          minutosFaltantesForaFaltasInteiras += minEsp - minTrab;
        } else {
          diasTrabalhadosCount++;
          if (minTrab > minEsp) {
            minutosExtrasPeriodo += minTrab - minEsp;
          }
        }
      }

      diasCalendario.push({
        data: dataStr,
        diaSemanaNumero,
        diaSemanaLabel,
        ehDiaTrabalhoContrato,
        antesDaAdmissao: false,
        registro: reg,
        statusEfetivo: reg.statusDia,
        minutosEsperados: minEsp,
        minutosTrabalhados: minTrab,
        minutosDiferenca: reg.statusDia === 'folga_feriado' ? 0 : minTrab - minEsp
      });
    } else {
      // Sem registro lançado no banco para este dia útil
      if (considerarDiasSemRegistroComoPresenca && dataStr <= hojeStr) {
        diasTrabalhadosCount++;
        minutosEsperadosPeriodo += minEsp;
        minutosTrabalhadosPeriodo += minEsp;
        diasCalendario.push({
          data: dataStr,
          diaSemanaNumero,
          diaSemanaLabel,
          ehDiaTrabalhoContrato,
          antesDaAdmissao: false,
          statusEfetivo: 'trabalhado',
          minutosEsperados: minEsp,
          minutosTrabalhados: minEsp,
          minutosDiferenca: 0
        });
      } else {
        diasSemLancamentoCount++;
        minutosEsperadosPeriodo += minEsp;
        diasCalendario.push({
          data: dataStr,
          diaSemanaNumero,
          diaSemanaLabel,
          ehDiaTrabalhoContrato,
          antesDaAdmissao: false,
          statusEfetivo: 'sem_lancamento',
          minutosEsperados: minEsp,
          minutosTrabalhados: 0,
          minutosDiferenca: -minEsp
        });
      }
    }

    dtCursor.setDate(dtCursor.getDate() + 1);
  }

  // 4. Cálculo Financeiro conforme a modalidade
  let valorBaseProporcionalBruto = 0;
  let valorDescontoFaltasInteiras = 0;
  let valorDescontoHorasParciais = 0;
  let valorHorasExtras = (minutosExtrasPeriodo / 60) * valorHoraRef;

  if (contrato.modeloCalculo === 'mensal_proporcional') {
    if (contrato.divisorMensal === '30_dias') {
      // Base pelos dias corridos desde admissão (ex: Hector 19/10 a 31/10 = 13 dias corridos)
      const diasBase = Math.min(30, diasCorridosDesdeAdmissao);
      valorBaseProporcionalBruto = diasBase * valorDiaRef;
    } else {
      // Base pelos dias úteis desde admissão (ex: Hector 19/10 a 31/10 = 10 dias úteis)
      valorBaseProporcionalBruto = diasUteisDesdeAdmissao * valorDiaRef;
    }
    valorDescontoFaltasInteiras = diasFaltasDescontadasCount * valorDiaRef;
    valorDescontoHorasParciais = (minutosFaltantesForaFaltasInteiras / 60) * valorHoraRef;
  } else if (contrato.modeloCalculo === 'diaria') {
    // Recebe pelas diárias comparecidas (integrais + parciais + abonadas) e desconta horas faltantes das parciais
    const totalDiasComparecidos = diasTrabalhadosCount + diasParciaisCount + diasFaltasAbonadasCount;
    valorBaseProporcionalBruto = totalDiasComparecidos * valorDiaRef;
    valorDescontoFaltasInteiras = 0;
    valorDescontoHorasParciais = (minutosFaltantesForaFaltasInteiras / 60) * valorHoraRef;
  } else {
    // Horista: recebe exatamente pelas horas trabalhadas
    valorBaseProporcionalBruto = (minutosTrabalhadosPeriodo / 60) * valorHoraRef;
    valorDescontoFaltasInteiras = 0;
    valorDescontoHorasParciais = 0;
    valorHorasExtras = 0; // já incluídas em minutosTrabalhadosPeriodo
  }

  const valorDescontosTotal = valorDescontoFaltasInteiras + valorDescontoHorasParciais;
  const valorLiquidoHorasEDias = Math.max(
    0,
    valorBaseProporcionalBruto - valorDescontosTotal + valorHorasExtras
  );

  const dataInicioEfetiva =
    contrato.dataInicio && contrato.dataInicio > dataInicioFiltro
      ? contrato.dataInicio
      : dataInicioFiltro;

  return {
    diasCalendario,
    dataInicioEfetiva,
    dataFimEfetiva: dataFimFiltro,
    totalDiasUteisMesInteiro,
    diasUteisDesdeAdmissao,
    diasCorridosDesdeAdmissao,
    diasTrabalhadosCount,
    diasParciaisCount,
    diasFaltasDescontadasCount,
    diasFaltasAbonadasCount,
    diasSemLancamentoCount,
    minutosEsperadosPeriodo,
    minutosTrabalhadosPeriodo,
    minutosFaltantesForaFaltasInteiras,
    minutosExtrasPeriodo,
    valorDiaRef,
    valorHoraRef,
    valorBaseProporcionalBruto,
    valorDescontoFaltasInteiras,
    valorDescontoHorasParciais,
    valorDescontosTotal,
    valorHorasExtras,
    valorLiquidoHorasEDias
  };
}

/**
 * Parâmetros para simulação rápida de fechamento e proporcionalidade
 */
export interface ParametrosSimulacaoProporcional {
  nomeColaborador?: string;
  valorBase: number;
  modeloCalculo: ModeloCalculoColaborador;
  divisorMensal: DivisorMensalColaborador;
  dataInicioContrato: string; // YYYY-MM-DD (ex: 2026-10-19)
  mesAnoReferencia: string; // YYYY-MM (ex: 2026-10)
  cargaDiariaMinutos: number; // ex: 480 ou 510 (8h30)
  diasSemanaTrabalho?: number[];
  diasTrabalhadosManuais?: number;
  diasFaltasManuais?: number;
  minutosExtrasManuais?: number;
  adiantamentos?: number;
  ajudaCusto?: number;
  valorAjusteManual?: number; // Ajuste manual discricionário (+ ou - R$)
  motivoAjusteManual?: string; // Justificativa obrigatória do ajuste
}

export interface ResultadoSimulacaoProporcional {
  totalDiasUteisMesInteiro: number;
  diasUteisPeriodoContrato: number;
  diasCorridosPeriodoContrato: number;
  valorDiaRef: number;
  valorHoraRef: number;
  diasTrabalhados: number;
  diasFaltas: number;
  valorBrutoProporcional: number;
  valorDescontoFaltas: number;
  valorHorasExtras: number;
  valorAdiantamentos: number;
  valorAjudaCusto: number;
  valorAjusteManual: number;
  motivoAjusteManual?: string;
  justificativaPendente: boolean;
  valorLiquidoFinal: number;
  memoriaCalculoLinhas: string[];
  textoWhatsApp: string;
}

/**
 * Simula proporcionalidade e valores para qualquer colaborador ou cenário hipotético
 */
export function calcularSimulacaoProporcional(params: ParametrosSimulacaoProporcional): ResultadoSimulacaoProporcional {
  const diasSemana = params.diasSemanaTrabalho || [1, 2, 3, 4, 5];
  const [ano, mes] = params.mesAnoReferencia.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();

  // 1. Total de dias úteis no mês completo
  let totalDiasUteisMesInteiro = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(ano, mes - 1, d, 12, 0, 0);
    if (diasSemana.includes(dt.getDay())) {
      totalDiasUteisMesInteiro++;
    }
  }
  if (totalDiasUteisMesInteiro === 0) totalDiasUteisMesInteiro = 22;

  // 2. Dias a partir da data de início
  const dtInicio = new Date(params.dataInicioContrato + 'T12:00:00');
  let diasUteisPeriodoContrato = 0;
  let diasCorridosPeriodoContrato = 0;

  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(ano, mes - 1, d, 12, 0, 0);
    if (dt >= dtInicio) {
      diasCorridosPeriodoContrato++;
      if (diasSemana.includes(dt.getDay())) {
        diasUteisPeriodoContrato++;
      }
    }
  }

  // 3. Taxa por dia e por hora
  const horasDiarias = (params.cargaDiariaMinutos || 480) / 60;
  let valorDiaRef = 0;
  let valorHoraRef = 0;

  if (params.modeloCalculo === 'mensal_proporcional') {
    const divisor = params.divisorMensal === '30_dias' ? 30 : totalDiasUteisMesInteiro;
    valorDiaRef = params.valorBase / divisor;
    valorHoraRef = valorDiaRef / (horasDiarias || 8);
  } else if (params.modeloCalculo === 'diaria') {
    valorDiaRef = params.valorBase;
    valorHoraRef = valorDiaRef / (horasDiarias || 8);
  } else {
    valorHoraRef = params.valorBase;
    valorDiaRef = valorHoraRef * (horasDiarias || 8);
  }

  // 4. Dias trabalhados e faltas simuladas
  const diasTrabalhados = params.diasTrabalhadosManuais !== undefined
    ? Math.max(0, params.diasTrabalhadosManuais)
    : diasUteisPeriodoContrato;

  const diasFaltas = params.diasFaltasManuais !== undefined
    ? Math.max(0, params.diasFaltasManuais)
    : Math.max(0, diasUteisPeriodoContrato - diasTrabalhados);

  let valorBrutoProporcional = 0;
  let valorDescontoFaltas = 0;

  if (params.modeloCalculo === 'mensal_proporcional') {
    if (params.divisorMensal === '30_dias') {
      valorBrutoProporcional = valorDiaRef * diasCorridosPeriodoContrato;
    } else {
      valorBrutoProporcional = valorDiaRef * diasUteisPeriodoContrato;
    }
    valorDescontoFaltas = diasFaltas * valorDiaRef;
  } else if (params.modeloCalculo === 'diaria') {
    valorBrutoProporcional = diasTrabalhados * valorDiaRef;
    valorDescontoFaltas = 0;
  } else {
    // Horista
    const totalMinutos = diasTrabalhados * (params.cargaDiariaMinutos || 480);
    valorBrutoProporcional = (totalMinutos / 60) * valorHoraRef;
    valorDescontoFaltas = 0;
  }

  const minutosExtras = params.minutosExtrasManuais || 0;
  const valorHorasExtras = (minutosExtras / 60) * valorHoraRef;
  const adiantamentos = params.adiantamentos || 0;
  const ajudaCusto = params.ajudaCusto || 0;
  const ajusteManual = params.valorAjusteManual || 0;
  const motivoAjuste = params.motivoAjusteManual?.trim() || '';
  const justificativaPendente = ajusteManual !== 0 && !motivoAjuste;

  const valorLiquidoFinal = Math.max(
    0,
    valorBrutoProporcional - valorDescontoFaltas + valorHorasExtras + ajudaCusto - adiantamentos + ajusteManual
  );

  // Formatação da memória de cálculo
  const nomeColab = params.nomeColaborador || 'Colaborador';
  const fmtMoeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const memoriaCalculoLinhas = [
    `Colaborador: ${nomeColab}`,
    `Mês de Competência: ${params.mesAnoReferencia} | Início das Atividades: ${params.dataInicioContrato.split('-').reverse().join('/')}`,
    `Carga Horária Contratada: ${formatarMinutosHoras(params.cargaDiariaMinutos)} por dia`,
    `Valor Contratual Base: ${fmtMoeda(params.valorBase)} (${params.modeloCalculo === 'mensal_proporcional' ? 'Mensal' : params.modeloCalculo === 'diaria' ? 'Diária' : 'Horista'})`,
    `Critério: ${params.divisorMensal === '30_dias' ? 'Comercial (30 dias)' : `Dias Úteis (${totalDiasUteisMesInteiro} dias úteis no mês)`}`,
    `Valor da Diária de Referência: ${fmtMoeda(valorDiaRef)} (ou ${fmtMoeda(valorHoraRef)}/hora)`,
    `Dias úteis elegíveis no período contratado: ${diasUteisPeriodoContrato} dias (${diasCorridosPeriodoContrato} dias corridos)`,
    `Subtotal Proporcional do Período: ${fmtMoeda(valorBrutoProporcional)}`,
    diasFaltas > 0 ? `(-) Desconto de Faltas/Ausências (${diasFaltas} dias): -${fmtMoeda(valorDescontoFaltas)}` : `(✓) Sem descontos de faltas`,
    minutosExtras > 0 ? `(+) Horas Extras / Adicionais (${formatarMinutosHoras(minutosExtras)}): +${fmtMoeda(valorHorasExtras)}` : null,
    ajudaCusto > 0 ? `(+) Ajuda de Custo / Bônus: +${fmtMoeda(ajudaCusto)}` : null,
    adiantamentos > 0 ? `(-) Adiantamentos Já Repassados: -${fmtMoeda(adiantamentos)}` : null,
    ajusteManual !== 0
      ? `(${ajusteManual > 0 ? '+' : '-'}) Ajuste Manual do Gestor: ${ajusteManual > 0 ? '+' : ''}${fmtMoeda(ajusteManual)} (Justificativa: ${motivoAjuste || '⚠️ PENDENTE'})`
      : null,
    `-------------------------------------------------------`,
    `VALOR LÍQUIDO A PAGAR (NFS-E): ${fmtMoeda(valorLiquidoFinal)}`
  ].filter(Boolean) as string[];

  const textoWhatsApp = [
    `*DEMONSTRATIVO DE APURAÇÃO DE HORAS & PAGAMENTO*`,
    `*Colaborador:* ${nomeColab}`,
    `*Mês:* ${params.mesAnoReferencia} (Início em ${params.dataInicioContrato.split('-').reverse().join('/')})`,
    `*Carga Diária:* ${formatarMinutosHoras(params.cargaDiariaMinutos)}`,
    ``,
    `*Memória de Cálculo:*`,
    `• Dias úteis no período: ${diasUteisPeriodoContrato} dias`,
    `• Dias trabalhados: ${diasTrabalhados} dias`,
    diasFaltas > 0 ? `• Ausências / faltas: ${diasFaltas} dias (-${fmtMoeda(valorDescontoFaltas)})` : `• Faltas: 0`,
    `• Diária proporcional: ${fmtMoeda(valorDiaRef)}`,
    adiantamentos > 0 ? `• Adiantamentos: -${fmtMoeda(adiantamentos)}` : null,
    ajudaCusto > 0 ? `• Ajuda de custo: +${fmtMoeda(ajudaCusto)}` : null,
    ajusteManual !== 0 ? `• Ajuste acordado: ${ajusteManual > 0 ? '+' : ''}${fmtMoeda(ajusteManual)} (Motivo: ${motivoAjuste || 'Acordo de gestão'})` : null,
    ``,
    `💰 *Valor Líquido da NFS-e a Emitir: ${fmtMoeda(valorLiquidoFinal)}*`
  ].filter(Boolean).join('\n');

  return {
    totalDiasUteisMesInteiro,
    diasUteisPeriodoContrato,
    diasCorridosPeriodoContrato,
    valorDiaRef,
    valorHoraRef,
    diasTrabalhados,
    diasFaltas,
    valorBrutoProporcional,
    valorDescontoFaltas,
    valorHorasExtras,
    valorAdiantamentos: adiantamentos,
    valorAjudaCusto: ajudaCusto,
    valorAjusteManual: ajusteManual,
    motivoAjusteManual: motivoAjuste,
    justificativaPendente,
    valorLiquidoFinal,
    memoriaCalculoLinhas,
    textoWhatsApp
  };
}

/**
 * Verifica se o usuário atual (administrador ou colaborador) possui pendência de registro de entrada hoje
 */
export async function verificarPontoEntradaPendenteHoje(
  empresaId: string,
  usuarioEmail?: string,
  usuarioNome?: string
): Promise<boolean> {
  try {
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const contratos = await listarContratosColaboradores(empresaId);
    const emailUser = usuarioEmail?.trim().toLowerCase();
    const nomeUser = usuarioNome?.trim().toLowerCase();

    const contrato = contratos.find(
      c =>
        (c.usuarioEmail && c.usuarioEmail.trim().toLowerCase() === emailUser) ||
        (nomeUser && c.nome.trim().toLowerCase() === nomeUser)
    );

    // Se ainda não existir contrato registrado no banco ou local, o colaborador/admin ainda precisa registrar sua primeira entrada
    if (!contrato) {
      return true;
    }

    const registros = await listarRegistrosPonto(empresaId, contrato.id);
    const registroHoje = registros.find(r => r.data === hojeStr);

    // Se já bateu a entrada hoje, não está mais pendente
    if (registroHoje && registroHoje.horaEntrada) {
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Erro ao verificar pendência de ponto do dia:', err);
    return false;
  }
}

