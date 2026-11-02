import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Clock,
  Calendar,
  MapPin,
  FileText,
  Upload,
  CheckCircle2,
  Trash2,
  Edit2,
  Download,
  Sparkles,
  BadgeDollarSign,
  Eye,
  Wand2,
  ShieldCheck,
  AlertCircle,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useOrdens } from '../../context/OrdensContext';
import { useFinanceiro } from '../../context/FinanceiroContext';
import { supabase } from '../../db/supabase';
import {
  ColaboradorContrato,
  RegistroPontoColaborador,
  FechamentoColaborador,
  StatusDiaPonto,
  ModeloCalculoColaborador,
  DivisorMensalColaborador
} from '../../types';
import {
  listarContratosColaboradores,
  salvarContratoColaborador,
  excluirContratoColaborador,
  listarRegistrosPonto,
  salvarRegistroPonto,
  listarFechamentosColaboradores,
  salvarFechamentoColaborador,
  excluirFechamentoColaborador,
  obterConfigSedeGps,
  salvarConfigSedeGps,
  calcularApuracaoPeriodo,
  calcularMinutosTrabalhadosDia,
  formatarMinutosHoras,
  ConfigSedeGps
} from '../../services/pontoColaboradoresService';
import { baixarPdfApuracaoColaborador } from '../../services/geradorPdfApuracaoColaborador';
import { fileToBase64, uploadBase64File, visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { RelogioPontoColaborador } from './RelogioPontoColaborador';

interface GestaoPontoPagamentosProps {
  dataInicio: Date;
  dataFim: Date;
}

export function GestaoPontoPagamentos({ dataInicio, dataFim }: GestaoPontoPagamentosProps) {
  const { usuario } = useAuth();
  const { ordens } = useOrdens();
  const { criarDespesa } = useFinanceiro();

  const empresaId = usuario?.empresaId || '00000000-0000-0000-0000-000000000001';

  const [subModo, setSubModo] = useState<'apuracao' | 'relogio' | 'historico_nf'>('apuracao');
  const [contratos, setContratos] = useState<ColaboradorContrato[]>([]);
  const [colaboradorAtivoId, setColaboradorAtivoId] = useState<string>('');
  const [registros, setRegistros] = useState<RegistroPontoColaborador[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoColaborador[]>([]);
  const [usuariosEquipe, setUsuariosEquipe] = useState<{ nome: string; email: string; cpf?: string; contato?: string }[]>([]);
  const [sedeGps, setSedeGps] = useState<ConfigSedeGps>({ latitude: null, longitude: null, raioMetros: 150 });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);

  // Opções de cálculo na tela de apuração
  const [assumirPresencaSemBatida, setAssumirPresencaSemBatida] = useState(false);
  const [incluirComissoesOs, setIncluirComissoesOs] = useState(true);
  const [valorAjudaCustoInput, setValorAjudaCustoInput] = useState('0');
  const [valorAdiantamentosInput, setValorAdiantamentosInput] = useState('0');
  const [numeroNfInput, setNumeroNfInput] = useState('');
  const [dataEmissaoNfInput, setDataEmissaoNfInput] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notaFiscalUrlInput, setNotaFiscalUrlInput] = useState<string>('');
  const [observacoesFechamento, setObservacoesFechamento] = useState('');
  const [lancarDespesaAutomatica, setLancarDespesaAutomatica] = useState(true);

  // Modal Cadastro/Edição de Contrato do Colaborador
  const [modalContratoAberto, setModalContratoAberto] = useState(false);
  const [editandoContratoId, setEditandoContratoId] = useState<string | undefined>(undefined);
  const [formContrato, setFormContrato] = useState({
    nome: '',
    usuarioEmail: '',
    cpfCnpj: '',
    contato: '',
    chavePix: '',
    cargoFuncao: 'Colaborador / Prestador PJ',
    dataInicio: '2026-10-19',
    modeloCalculo: 'mensal_proporcional' as ModeloCalculoColaborador,
    divisorMensal: 'dias_uteis' as DivisorMensalColaborador,
    valorBase: '1800',
    cargaHorariaHoras: '8',
    horarioEntradaPadrao: '08:00',
    horarioIntervaloInicioPadrao: '12:00',
    horarioIntervaloFimPadrao: '13:30',
    horarioSaidaPadrao: '17:30',
    diasSemanaTrabalho: [1, 2, 3, 4, 5] as number[],
    exigeFotoPonto: true,
    exigeGpsPonto: true
  });

  // Modal Edição Rápida de Dia de Ponto
  const [diaEditando, setDiaEditando] = useState<{
    data: string;
    statusDia: StatusDiaPonto;
    horaEntrada: string;
    horaIntervaloIda: string;
    horaIntervaloVolta: string;
    horaSaida: string;
    observacao: string;
  } | null>(null);

  const dataInicioStr = useMemo(() => format(dataInicio, 'yyyy-MM-dd'), [dataInicio]);
  const dataFimStr = useMemo(() => format(dataFim, 'yyyy-MM-dd'), [dataFim]);

  const carregarTudo = async () => {
    setCarregando(true);
    try {
      const [listaContratos, listaFechamentos, cfgSede] = await Promise.all([
        listarContratosColaboradores(empresaId),
        listarFechamentosColaboradores(empresaId),
        obterConfigSedeGps(empresaId)
      ]);

      setContratos(listaContratos);
      setFechamentos(listaFechamentos);
      setSedeGps(cfgSede);

      const idAlvo = colaboradorAtivoId && listaContratos.some(c => c.id === colaboradorAtivoId)
        ? colaboradorAtivoId
        : listaContratos[0]?.id || '';
      setColaboradorAtivoId(idAlvo);

      if (idAlvo) {
        const regs = await listarRegistrosPonto(empresaId, idAlvo);
        setRegistros(regs);
      }

      // Buscar usuários da equipe no banco para facilitar importação
      const { data: usersData } = await supabase
        .from('usuarios_autorizados')
        .select('nome, email, cpf, contato')
        .eq('empresa_id', empresaId)
        .eq('ativo', true);
      if (usersData) {
        setUsuariosEquipe(usersData);
      }
    } catch (err) {
      console.error('Erro ao carregar gestão de ponto:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, [empresaId]);

  useEffect(() => {
    if (colaboradorAtivoId) {
      listarRegistrosPonto(empresaId, colaboradorAtivoId).then(setRegistros);
    } else {
      setRegistros([]);
    }
  }, [colaboradorAtivoId, empresaId]);

  const contratoAtivo = useMemo(
    () => contratos.find(c => c.id === colaboradorAtivoId) || null,
    [contratos, colaboradorAtivoId]
  );

  // Comissões de O.S. concluídas e pagas do colaborador ativo no período
  const comissoesColaboradorPeriodo = useMemo(() => {
    if (!contratoAtivo) return 0;
    const nomeAlvo = contratoAtivo.nome.trim().toLowerCase();
    let total = 0;

    ordens
      .filter(o => o.status === 'Pago')
      .forEach(o => {
        const dataRef = (o.atualizadoEm || o.criadoEm || '').slice(0, 10);
        if (dataRef >= dataInicioStr && dataRef <= dataFimStr) {
          (o.servicos || []).forEach(s => {
            if (
              s.statusExecucao === 'Concluído' &&
              s.responsavelNome &&
              s.responsavelNome.trim().toLowerCase() === nomeAlvo &&
              s.valorRepasse
            ) {
              total += Number(s.valorRepasse) || 0;
            }
          });
        }
      });

    return total;
  }, [ordens, contratoAtivo, dataInicioStr, dataFimStr]);

  // Resultado da apuração matemática
  const apuracao = useMemo(() => {
    if (!contratoAtivo) return null;
    return calcularApuracaoPeriodo(
      contratoAtivo,
      dataInicioStr,
      dataFimStr,
      registros,
      assumirPresencaSemBatida
    );
  }, [contratoAtivo, dataInicioStr, dataFimStr, registros, assumirPresencaSemBatida]);

  const resumoFinal = useMemo(() => {
    if (!apuracao) return null;
    const comissoes = incluirComissoesOs ? comissoesColaboradorPeriodo : 0;
    const ajudaCusto = parseFloat(valorAjudaCustoInput) || 0;
    const adiantamentos = parseFloat(valorAdiantamentosInput) || 0;
    const liquidoFinal = Math.max(
      0,
      apuracao.valorLiquidoHorasEDias + comissoes + ajudaCusto - adiantamentos
    );
    return {
      comissoes,
      ajudaCusto,
      adiantamentos,
      liquidoFinal
    };
  }, [apuracao, incluirComissoesOs, comissoesColaboradorPeriodo, valorAjudaCustoInput, valorAdiantamentosInput]);

  const abrirModalNovoContrato = () => {
    setEditandoContratoId(undefined);
    setFormContrato({
      nome: '',
      usuarioEmail: '',
      cpfCnpj: '',
      contato: '',
      chavePix: '',
      cargoFuncao: 'Colaborador / Prestador PJ',
      dataInicio: format(new Date(), 'yyyy-MM-dd'),
      modeloCalculo: 'mensal_proporcional',
      divisorMensal: 'dias_uteis',
      valorBase: '1800',
      cargaHorariaHoras: '8',
      horarioEntradaPadrao: '08:00',
      horarioIntervaloInicioPadrao: '12:00',
      horarioIntervaloFimPadrao: '13:30',
      horarioSaidaPadrao: '17:30',
      diasSemanaTrabalho: [1, 2, 3, 4, 5],
      exigeFotoPonto: true,
      exigeGpsPonto: true
    });
    setModalContratoAberto(true);
  };

  const abrirModalEditarContrato = (c: ColaboradorContrato) => {
    setEditandoContratoId(c.id);
    setFormContrato({
      nome: c.nome,
      usuarioEmail: c.usuarioEmail || '',
      cpfCnpj: c.cpfCnpj || '',
      contato: c.contato || '',
      chavePix: c.chavePix || '',
      cargoFuncao: c.cargoFuncao || 'Colaborador / Prestador PJ',
      dataInicio: c.dataInicio,
      modeloCalculo: c.modeloCalculo,
      divisorMensal: c.divisorMensal,
      valorBase: String(c.valorBase),
      cargaHorariaHoras: String((c.cargaHorariaDiariaMin || 480) / 60),
      horarioEntradaPadrao: c.horarioEntradaPadrao || '08:00',
      horarioIntervaloInicioPadrao: c.horarioIntervaloInicioPadrao || '12:00',
      horarioIntervaloFimPadrao: c.horarioIntervaloFimPadrao || '13:30',
      horarioSaidaPadrao: c.horarioSaidaPadrao || '17:30',
      diasSemanaTrabalho: c.diasSemanaTrabalho || [1, 2, 3, 4, 5],
      exigeFotoPonto: c.exigeFotoPonto,
      exigeGpsPonto: c.exigeGpsPonto
    });
    setModalContratoAberto(true);
  };

  const handleSalvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContrato.nome.trim()) return;
    setSalvando(true);
    try {
      const salvo = await salvarContratoColaborador({
        id: editandoContratoId,
        empresaId,
        nome: formContrato.nome.trim(),
        usuarioEmail: formContrato.usuarioEmail.trim() || undefined,
        cpfCnpj: formContrato.cpfCnpj.trim() || undefined,
        contato: formContrato.contato.trim() || undefined,
        chavePix: formContrato.chavePix.trim() || undefined,
        cargoFuncao: formContrato.cargoFuncao.trim() || 'Colaborador / Prestador PJ',
        dataInicio: formContrato.dataInicio,
        modeloCalculo: formContrato.modeloCalculo,
        divisorMensal: formContrato.divisorMensal,
        valorBase: parseFloat(formContrato.valorBase) || 0,
        cargaHorariaDiariaMin: Math.round((parseFloat(formContrato.cargaHorariaHoras) || 8) * 60),
        horarioEntradaPadrao: formContrato.horarioEntradaPadrao,
        horarioIntervaloInicioPadrao: formContrato.horarioIntervaloInicioPadrao,
        horarioIntervaloFimPadrao: formContrato.horarioIntervaloFimPadrao,
        horarioSaidaPadrao: formContrato.horarioSaidaPadrao,
        diasSemanaTrabalho: formContrato.diasSemanaTrabalho,
        exigeFotoPonto: formContrato.exigeFotoPonto,
        exigeGpsPonto: formContrato.exigeGpsPonto,
        ativo: true
      });

      const lista = await listarContratosColaboradores(empresaId);
      setContratos(lista);
      setColaboradorAtivoId(salvo.id);
      setModalContratoAberto(false);
      setFeedback({ tipo: 'sucesso', texto: `Colaborador "${salvo.nome}" salvo com sucesso!` });
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro ao salvar colaborador.' });
    } finally {
      setSalvando(false);
    }
  };

  // Botão rápido para criar/simular o caso do Hector (início 19/10/2026)
  const handleCriarExemploHector = async () => {
    setSalvando(true);
    try {
      const hectorUser = usuariosEquipe.find(u => u.nome.toLowerCase().includes('hector'));
      const existente = contratos.find(c => c.nome.toLowerCase().includes('hector'));

      const contratoHector = await salvarContratoColaborador({
        id: existente?.id,
        empresaId,
        nome: hectorUser?.nome || 'Hector',
        usuarioEmail: hectorUser?.email || 'hectoruk80@gmail.com',
        cpfCnpj: hectorUser?.cpf || '',
        contato: hectorUser?.contato || '',
        chavePix: '',
        cargoFuncao: 'Colaborador / Prestador PJ',
        dataInicio: '2026-10-19',
        modeloCalculo: 'mensal_proporcional',
        divisorMensal: 'dias_uteis',
        valorBase: 1800,
        cargaHorariaDiariaMin: 480,
        horarioEntradaPadrao: '08:00',
        horarioIntervaloInicioPadrao: '12:00',
        horarioIntervaloFimPadrao: '13:30',
        horarioSaidaPadrao: '17:30',
        diasSemanaTrabalho: [1, 2, 3, 4, 5],
        exigeFotoPonto: true,
        exigeGpsPonto: true,
        ativo: true
      });

      const lista = await listarContratosColaboradores(empresaId);
      setContratos(lista);
      setColaboradorAtivoId(contratoHector.id);
      setFeedback({
        tipo: 'sucesso',
        texto: 'Cadastro do Hector (Início 19/10/2026) carregado! Você pode ajustar o valor base e clicar nos dias abaixo para marcar faltas ou horários parciais.'
      });
    } finally {
      setSalvando(false);
    }
  };

  const handlePreencherDiasUteisPadrao = async () => {
    if (!contratoAtivo || !apuracao) return;
    setSalvando(true);
    try {
      const hojeStr = new Date().toISOString().slice(0, 10);
      for (const dia of apuracao.diasCalendario) {
        if (
          !dia.antesDaAdmissao &&
          dia.ehDiaTrabalhoContrato &&
          !dia.registro &&
          dia.data <= (dataFimStr > hojeStr ? dataFimStr : hojeStr)
        ) {
          const minTrab = calcularMinutosTrabalhadosDia(
            contratoAtivo.horarioEntradaPadrao,
            contratoAtivo.horarioIntervaloInicioPadrao,
            contratoAtivo.horarioIntervaloFimPadrao,
            contratoAtivo.horarioSaidaPadrao
          );
          await salvarRegistroPonto({
            empresaId,
            colaboradorId: contratoAtivo.id,
            colaboradorEmail: contratoAtivo.usuarioEmail,
            colaboradorNome: contratoAtivo.nome,
            data: dia.data,
            statusDia: 'trabalhado',
            horaEntrada: contratoAtivo.horarioEntradaPadrao,
            horaIntervaloIda: contratoAtivo.horarioIntervaloInicioPadrao,
            horaIntervaloVolta: contratoAtivo.horarioIntervaloFimPadrao,
            horaSaida: contratoAtivo.horarioSaidaPadrao,
            minutosTrabalhados: minTrab || contratoAtivo.cargaHorariaDiariaMin,
            minutosEsperados: contratoAtivo.cargaHorariaDiariaMin,
            minutosSaldo: 0,
            origemRegistro: 'ajuste_gestor',
            observacao: 'Expediente padrão'
          });
        }
      }
      const regs = await listarRegistrosPonto(empresaId, contratoAtivo.id);
      setRegistros(regs);
      setFeedback({
        tipo: 'sucesso',
        texto: 'Horários padrão preenchidos para os dias úteis desde a data de início! Agora basta clicar nos dias em que houve falta ou horário diferente.'
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleAlterarStatusDiaRapido = async (dataStr: string, novoStatus: StatusDiaPonto) => {
    if (!contratoAtivo) return;
    const regAtual = registros.find(r => r.data === dataStr);

    let horaEntrada = regAtual?.horaEntrada || contratoAtivo.horarioEntradaPadrao;
    let horaIntervaloIda = regAtual?.horaIntervaloIda || contratoAtivo.horarioIntervaloInicioPadrao;
    let horaIntervaloVolta = regAtual?.horaIntervaloVolta || contratoAtivo.horarioIntervaloFimPadrao;
    let horaSaida = regAtual?.horaSaida || contratoAtivo.horarioSaidaPadrao;
    let minTrab = contratoAtivo.cargaHorariaDiariaMin;

    if (novoStatus === 'falta_descontada' || novoStatus === 'folga_feriado') {
      horaEntrada = '';
      horaIntervaloIda = '';
      horaIntervaloVolta = '';
      horaSaida = '';
      minTrab = 0;
    } else if (novoStatus === 'falta_abonada') {
      horaEntrada = '';
      horaIntervaloIda = '';
      horaIntervaloVolta = '';
      horaSaida = '';
      minTrab = contratoAtivo.cargaHorariaDiariaMin;
    } else {
      minTrab = calcularMinutosTrabalhadosDia(horaEntrada, horaIntervaloIda, horaIntervaloVolta, horaSaida);
    }

    await salvarRegistroPonto({
      id: regAtual?.id,
      empresaId,
      colaboradorId: contratoAtivo.id,
      colaboradorEmail: contratoAtivo.usuarioEmail,
      colaboradorNome: contratoAtivo.nome,
      data: dataStr,
      statusDia: novoStatus,
      horaEntrada: horaEntrada || undefined,
      horaIntervaloIda: horaIntervaloIda || undefined,
      horaIntervaloVolta: horaIntervaloVolta || undefined,
      horaSaida: horaSaida || undefined,
      minutosTrabalhados: minTrab,
      minutosEsperados: contratoAtivo.cargaHorariaDiariaMin,
      minutosSaldo: minTrab - contratoAtivo.cargaHorariaDiariaMin,
      fotoEntradaUrl: regAtual?.fotoEntradaUrl,
      fotoSaidaUrl: regAtual?.fotoSaidaUrl,
      latEntrada: regAtual?.latEntrada,
      lngEntrada: regAtual?.lngEntrada,
      distanciaEntradaMetros: regAtual?.distanciaEntradaMetros,
      origemRegistro: 'ajuste_gestor',
      observacao:
        novoStatus === 'falta_descontada'
          ? regAtual?.observacao || 'Ausência por motivos pessoais'
          : regAtual?.observacao
    });

    const atualizados = await listarRegistrosPonto(empresaId, contratoAtivo.id);
    setRegistros(atualizados);
  };

  const handleSalvarEdicaoDiaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaEditando || !contratoAtivo) return;
    const regAtual = registros.find(r => r.data === diaEditando.data);

    let minTrab = calcularMinutosTrabalhadosDia(
      diaEditando.horaEntrada,
      diaEditando.horaIntervaloIda,
      diaEditando.horaIntervaloVolta,
      diaEditando.horaSaida
    );

    if (diaEditando.statusDia === 'falta_descontada' || diaEditando.statusDia === 'folga_feriado') {
      minTrab = 0;
    } else if (diaEditando.statusDia === 'falta_abonada') {
      minTrab = contratoAtivo.cargaHorariaDiariaMin;
    }

    await salvarRegistroPonto({
      id: regAtual?.id,
      empresaId,
      colaboradorId: contratoAtivo.id,
      colaboradorEmail: contratoAtivo.usuarioEmail,
      colaboradorNome: contratoAtivo.nome,
      data: diaEditando.data,
      statusDia: diaEditando.statusDia,
      horaEntrada: diaEditando.horaEntrada || undefined,
      horaIntervaloIda: diaEditando.horaIntervaloIda || undefined,
      horaIntervaloVolta: diaEditando.horaIntervaloVolta || undefined,
      horaSaida: diaEditando.horaSaida || undefined,
      minutosTrabalhados: minTrab,
      minutosEsperados: contratoAtivo.cargaHorariaDiariaMin,
      minutosSaldo: minTrab - contratoAtivo.cargaHorariaDiariaMin,
      fotoEntradaUrl: regAtual?.fotoEntradaUrl,
      fotoSaidaUrl: regAtual?.fotoSaidaUrl,
      latEntrada: regAtual?.latEntrada,
      lngEntrada: regAtual?.lngEntrada,
      distanciaEntradaMetros: regAtual?.distanciaEntradaMetros,
      origemRegistro: 'ajuste_gestor',
      observacao: diaEditando.observacao.trim() || undefined
    });

    const atualizados = await listarRegistrosPonto(empresaId, contratoAtivo.id);
    setRegistros(atualizados);
    setDiaEditando(null);
  };

  const handleCapturarSedeGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não disponível neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const novaCfg: ConfigSedeGps = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          raioMetros: sedeGps.raioMetros || 150
        };
        await salvarConfigSedeGps(empresaId, novaCfg);
        setSedeGps(novaCfg);
        setFeedback({
          tipo: 'sucesso',
          texto: `Localização da sede do escritório salva! (${novaCfg.latitude?.toFixed(5)}, ${novaCfg.longitude?.toFixed(5)} - Raio ${novaCfg.raioMetros}m)`
        });
      },
      () => {
        alert('Não foi possível obter a localização atual. Verifique a permissão de GPS do navegador.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleUploadNotaFiscalGestor = async (file: File) => {
    if (!contratoAtivo) return;
    setSalvando(true);
    try {
      const base64 = await fileToBase64(file);
      let urlFinal = base64;
      try {
        const ext = file.name.split('.').pop() || 'pdf';
        const path = `${empresaId}/notas-fiscais/${contratoAtivo.id}/NF_${Date.now()}.${ext}`;
        const uploaded = await uploadBase64File(base64, 'documentos-clientes', path);
        if (uploaded) urlFinal = uploaded;
      } catch {
        // usa base64 diretamente
      }
      setNotaFiscalUrlInput(urlFinal);
      setFeedback({
        tipo: 'sucesso',
        texto: `Nota Fiscal "${file.name}" anexada! Clique em "Confirmar Pagamento & Lançar nas Despesas PJ" para contabilizar.`
      });
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro ao carregar arquivo da Nota Fiscal.' });
    } finally {
      setSalvando(false);
    }
  };

  const handleExportarPdfApuracao = async () => {
    if (!contratoAtivo || !apuracao || !resumoFinal) return;
    await baixarPdfApuracaoColaborador({
      empresaNome: usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.empresaNome || 'GCAC ASSESSORIA',
      empresaCnpj: usuario?.dadosEmpresa?.cnpj,
      responsavelEmpresa: usuario?.dadosEmpresa?.responsavelNome || usuario?.nome,
      contrato: contratoAtivo,
      diasCalendario: apuracao.diasCalendario,
      fechamento: {
        empresaId,
        colaboradorId: contratoAtivo.id,
        colaboradorNome: contratoAtivo.nome,
        dataInicioPeriodo: apuracao.dataInicioEfetiva,
        dataFimPeriodo: apuracao.dataFimEfetiva,
        diasUteisPeriodo: apuracao.diasUteisDesdeAdmissao,
        diasTrabalhados: apuracao.diasTrabalhadosCount + apuracao.diasParciaisCount + apuracao.diasFaltasAbonadasCount,
        diasFaltasDescontadas: apuracao.diasFaltasDescontadasCount,
        diasFaltasAbonadas: apuracao.diasFaltasAbonadasCount,
        minutosTrabalhadosTotal: apuracao.minutosTrabalhadosPeriodo,
        minutosEsperadosTotal: apuracao.minutosEsperadosPeriodo,
        valorBaseProporcional: apuracao.valorBaseProporcionalBruto,
        valorDescontosAusenciasHoras: apuracao.valorDescontosTotal,
        valorHorasExtras: apuracao.valorHorasExtras,
        valorComissoesOs: resumoFinal.comissoes,
        valorAjudaCusto: resumoFinal.ajudaCusto,
        valorAdiantamentos: resumoFinal.adiantamentos,
        valorLiquidoFinal: resumoFinal.liquidoFinal,
        numeroNf: numeroNfInput || undefined,
        dataEmissaoNf: dataEmissaoNfInput || undefined,
        notaFiscalUrl: notaFiscalUrlInput || undefined,
        status: notaFiscalUrlInput ? 'pago' : 'aguardando_nf',
        observacoes: observacoesFechamento || undefined
      }
    });
  };

  const handleConfirmarFechamentoEPagamento = async (comoPago: boolean) => {
    if (!contratoAtivo || !apuracao || !resumoFinal) return;
    setSalvando(true);
    try {
      let despesaCriadaId: string | undefined;

      if (comoPago && lancarDespesaAutomatica && resumoFinal.liquidoFinal > 0) {
        const descNf = numeroNfInput ? ` (NF #${numeroNfInput})` : ' (Prestação PJ)';
        const descricaoDespesa = `Pgto Colaborador: ${contratoAtivo.nome.toUpperCase()}${descNf} — Período ${formatarData(apuracao.dataInicioEfetiva)} a ${formatarData(apuracao.dataFimEfetiva)}`;

        despesaCriadaId = await criarDespesa({
          descricao: descricaoDespesa,
          valor: Number(resumoFinal.liquidoFinal.toFixed(2)),
          categoria: 'Pagamento Colaboradores (NF)',
          data: dataEmissaoNfInput || format(new Date(), 'yyyy-MM-dd'),
          notaFiscalUrl: notaFiscalUrlInput || undefined,
          numeroNf: numeroNfInput || undefined,
          colaboradorNome: contratoAtivo.nome
        });
      }

      await salvarFechamentoColaborador({
        empresaId,
        colaboradorId: contratoAtivo.id,
        colaboradorNome: contratoAtivo.nome,
        dataInicioPeriodo: apuracao.dataInicioEfetiva,
        dataFimPeriodo: apuracao.dataFimEfetiva,
        diasUteisPeriodo: apuracao.diasUteisDesdeAdmissao,
        diasTrabalhados: apuracao.diasTrabalhadosCount + apuracao.diasParciaisCount + apuracao.diasFaltasAbonadasCount,
        diasFaltasDescontadas: apuracao.diasFaltasDescontadasCount,
        diasFaltasAbonadas: apuracao.diasFaltasAbonadasCount,
        minutosTrabalhadosTotal: apuracao.minutosTrabalhadosPeriodo,
        minutosEsperadosTotal: apuracao.minutosEsperadosPeriodo,
        valorBaseProporcional: Number(apuracao.valorBaseProporcionalBruto.toFixed(2)),
        valorDescontosAusenciasHoras: Number(apuracao.valorDescontosTotal.toFixed(2)),
        valorHorasExtras: Number(apuracao.valorHorasExtras.toFixed(2)),
        valorComissoesOs: Number(resumoFinal.comissoes.toFixed(2)),
        valorAjudaCusto: Number(resumoFinal.ajudaCusto.toFixed(2)),
        valorAdiantamentos: Number(resumoFinal.adiantamentos.toFixed(2)),
        valorLiquidoFinal: Number(resumoFinal.liquidoFinal.toFixed(2)),
        numeroNf: numeroNfInput || undefined,
        dataEmissaoNf: dataEmissaoNfInput || undefined,
        notaFiscalUrl: notaFiscalUrlInput || undefined,
        despesaId: despesaCriadaId,
        status: comoPago ? 'pago' : notaFiscalUrlInput ? 'nf_enviada' : 'aguardando_nf',
        observacoes: observacoesFechamento || undefined,
        snapshotPonto: registros.filter(r => r.data >= apuracao.dataInicioEfetiva && r.data <= apuracao.dataFimEfetiva)
      });

      const listaF = await listarFechamentosColaboradores(empresaId);
      setFechamentos(listaF);

      setFeedback({
        tipo: 'sucesso',
        texto: comoPago
          ? `Pagamento de ${formatarMoeda(resumoFinal.liquidoFinal)} para ${contratoAtivo.nome} registrado e lançado automaticamente na aba Despesas PJ do mês!`
          : `Apuração de ${contratoAtivo.nome} (${formatarMoeda(resumoFinal.liquidoFinal)}) salva! O colaborador já pode emitir e anexar a Nota Fiscal.`
      });
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro ao fechar pagamento.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navegação do Módulo de Ponto & Pagamento de Colaboradores */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-dark-3 border border-brand-dark-5 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubModo('apuracao')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all ${
              subModo === 'apuracao' ? 'bg-brand-blue text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BadgeDollarSign size={15} />
            Apuração de Horas & Pagamento (NF)
          </button>

          <button
            type="button"
            onClick={() => setSubModo('relogio')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all ${
              subModo === 'relogio' ? 'bg-brand-blue text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock size={15} />
            Terminal Ponto Eletrônico (Check-in)
          </button>

          <button
            type="button"
            onClick={() => setSubModo('historico_nf')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all ${
              subModo === 'historico_nf' ? 'bg-brand-blue text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText size={15} />
            Notas Fiscais & Fechamentos ({fechamentos.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCapturarSedeGps}
            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 border border-brand-dark-5"
            title="Define a sua localização GPS atual como a sede do escritório para validar batidas de ponto"
          >
            <MapPin size={14} className={sedeGps.latitude ? 'text-brand-green' : 'text-gray-400'} />
            {sedeGps.latitude ? `Sede GPS Ativa (${sedeGps.raioMetros}m)` : 'Definir Sede GPS'}
          </button>

          {!contratos.some(c => c.nome.toLowerCase().includes('hector')) && (
            <button
              type="button"
              onClick={handleCriarExemploHector}
              className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Sparkles size={14} />
              Carregar Caso Hector (19/10/26)
            </button>
          )}

          <button
            type="button"
            onClick={abrirModalNovoContrato}
            className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            Novo Colaborador (PJ)
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            feedback.tipo === 'sucesso'
              ? 'bg-brand-green/15 border-brand-green/30 text-brand-green'
              : 'bg-red-500/15 border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{feedback.texto}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            Fechar
          </button>
        </div>
      )}

      {/* MODO 2: Terminal de Relógio de Ponto */}
      {subModo === 'relogio' && (
        <RelogioPontoColaborador
          onPontoRegistrado={() => {
            if (colaboradorAtivoId) {
              listarRegistrosPonto(empresaId, colaboradorAtivoId).then(setRegistros);
            }
          }}
        />
      )}

      {/* MODO 3: Histórico de Fechamentos e Notas Fiscais */}
      {subModo === 'historico_nf' && (
        <div className="card p-0 overflow-hidden border-brand-dark-5">
          <div className="p-4 border-b border-brand-dark-5 bg-brand-dark-3/40 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase">
                Histórico de Apurações, Pagamentos e Notas Fiscais Recebidas
              </h3>
              <p className="text-xs text-gray-400">
                Todas as Notas Fiscais anexadas e lançadas nas Despesas Mensais PJ do escritório.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                  <th className="table-header">Colaborador / Prestador</th>
                  <th className="table-header">Período Apurado</th>
                  <th className="table-header">Dias / Horas</th>
                  <th className="table-header">Nota Fiscal</th>
                  <th className="table-header text-right">Valor Líquido (NF)</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5/40">
                {fechamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      Nenhum fechamento de pagamento registrado ainda.
                    </td>
                  </tr>
                ) : (
                  fechamentos.map(f => (
                    <tr key={f.id} className="hover:bg-brand-dark-4/40">
                      <td className="table-cell font-bold text-white uppercase">{f.colaboradorNome}</td>
                      <td className="table-cell font-mono text-gray-300">
                        {formatarData(f.dataInicioPeriodo)} a {formatarData(f.dataFimPeriodo)}
                      </td>
                      <td className="table-cell text-gray-400">
                        {f.diasTrabalhados}d • {formatarMinutosHoras(f.minutosTrabalhadosTotal)}
                      </td>
                      <td className="table-cell">
                        {f.notaFiscalUrl ? (
                          <button
                            type="button"
                            onClick={() => visualizarDocumentoBase64(f.notaFiscalUrl!, `NF_${f.colaboradorNome}.pdf`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-blue/15 text-brand-blue-light border border-brand-blue/30 text-[10px] font-bold hover:underline"
                          >
                            <Eye size={12} />
                            Ver NF {f.numeroNf ? `#${f.numeroNf}` : ''}
                          </button>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Sem anexo</span>
                        )}
                      </td>
                      <td className="table-cell text-right font-black text-brand-green">
                        {formatarMoeda(f.valorLiquidoFinal)}
                      </td>
                      <td className="table-cell">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            f.status === 'pago'
                              ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                              : f.status === 'nf_enviada'
                              ? 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {f.status === 'pago' ? 'Pago & Lançado' : f.status === 'nf_enviada' ? 'NF Recebida' : 'Aguardando NF'}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('Excluir este registro de fechamento?')) {
                              await excluirFechamentoColaborador(empresaId, f.id);
                              setFechamentos(await listarFechamentosColaboradores(empresaId));
                            }
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"
                          title="Excluir fechamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODO 1: Painel Principal de Apuração & Cálculo de Pagamento */}
      {subModo === 'apuracao' && (
        <>
          {contratos.length === 0 ? (
            <div className="card p-10 text-center space-y-4 border-dashed border-brand-dark-5">
              <BadgeDollarSign size={40} className="mx-auto text-brand-blue-light" />
              <div className="max-w-lg mx-auto space-y-1">
                <h3 className="text-base font-bold text-white">
                  Configure seu primeiro Colaborador / Prestador PJ
                </h3>
                <p className="text-xs text-gray-400">
                  Cadastre a data de início (ex: Hector em 19/10/2026), carga horária e valor acordado para calcular automaticamente quanto pagar, registrar entradas/saídas e anexar a Nota Fiscal.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCriarExemploHector}
                  className="btn-primary text-xs px-4 py-2.5 flex items-center gap-2"
                >
                  <Sparkles size={15} />
                  Carregar Exemplo do Hector (Início 19/10/2026)
                </button>
                <button
                  type="button"
                  onClick={abrirModalNovoContrato}
                  className="btn-ghost border border-brand-dark-5 text-xs px-4 py-2.5 flex items-center gap-2"
                >
                  <UserPlus size={15} />
                  Cadastrar Manualmente
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Barra de Seleção do Colaborador e Resumo do Contrato */}
              <div className="card border-brand-dark-5 bg-brand-dark-3/40 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Selecionar Colaborador / Prestador
                    </label>
                    <select
                      value={colaboradorAtivoId}
                      onChange={e => setColaboradorAtivoId(e.target.value)}
                      className="select text-sm font-black min-w-[240px]"
                    >
                      {contratos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} — Início: {formatarData(c.dataInicio)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {contratoAtivo && (
                    <div className="flex flex-wrap items-center gap-2 pt-4">
                      <span className="px-2.5 py-1 rounded-lg bg-brand-dark-4 border border-brand-dark-5 text-xs text-gray-300">
                        <strong className="text-white">Início:</strong> {formatarData(contratoAtivo.dataInicio)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-brand-dark-4 border border-brand-dark-5 text-xs text-gray-300">
                        <strong className="text-white">Base:</strong> {formatarMoeda(contratoAtivo.valorBase)}{' '}
                        ({contratoAtivo.modeloCalculo === 'mensal_proporcional'
                          ? `Mensal / ${contratoAtivo.divisorMensal === '30_dias' ? '30 dias' : 'Dias Úteis'}`
                          : contratoAtivo.modeloCalculo === 'diaria'
                          ? 'Por Diária'
                          : 'Por Hora'})
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-brand-dark-4 border border-brand-dark-5 text-xs text-gray-300">
                        <strong className="text-white">Jornada:</strong>{' '}
                        {formatarMinutosHoras(contratoAtivo.cargaHorariaDiariaMin)}/dia ({contratoAtivo.horarioEntradaPadrao} às {contratoAtivo.horarioSaidaPadrao})
                      </span>
                    </div>
                  )}
                </div>

                {contratoAtivo && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => abrirModalEditarContrato(contratoAtivo)}
                      className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 border border-brand-dark-5"
                    >
                      <Edit2 size={13} />
                      Editar Contrato / Valor
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Excluir o cadastro de ${contratoAtivo.nome}?`)) {
                          await excluirContratoColaborador(empresaId, contratoAtivo.id);
                          const rest = await listarContratosColaboradores(empresaId);
                          setContratos(rest);
                          setColaboradorAtivoId(rest[0]?.id || '');
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-red-400 rounded-lg border border-brand-dark-5"
                      title="Excluir colaborador"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Principal: Calculadora de Pagamento & Anexo NF + Resumo de Carga Horária */}
              {contratoAtivo && apuracao && resumoFinal && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Coluna Esquerda + Centro: Demonstrativo Passo a Passo ("Como saberei o valor que devo pagar a ele?") */}
                  <div className="lg:col-span-2 card border-brand-blue/30 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-dark-5 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue-light block">
                          Cálculo Automático Proporcional & Carga Horária
                        </span>
                        <h3 className="text-lg font-black text-white">
                          Apuração de {contratoAtivo.nome}: {formatarData(apuracao.dataInicioEfetiva)} a {formatarData(apuracao.dataFimEfetiva)}
                        </h3>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">
                          Referência Unitária
                        </span>
                        <span className="text-xs font-mono font-bold text-brand-green">
                          Dia: {formatarMoeda(apuracao.valorDiaRef)} • Hora: {formatarMoeda(apuracao.valorHoraRef)}
                        </span>
                      </div>
                    </div>

                    {/* 4 Mini Cards de Frequência e Carga Horária */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">
                          Dias Úteis (Desde Início)
                        </span>
                        <p className="text-lg font-black text-white mt-0.5">
                          {apuracao.diasUteisDesdeAdmissao} <span className="text-xs font-normal text-gray-400">de {apuracao.totalDiasUteisMesInteiro} no mês</span>
                        </p>
                      </div>

                      <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">
                          Dias Comparecidos
                        </span>
                        <p className="text-lg font-black text-brand-green mt-0.5">
                          {apuracao.diasTrabalhadosCount + apuracao.diasParciaisCount}{' '}
                          <span className="text-xs font-normal text-gray-400">
                            ({apuracao.diasParciaisCount} parciais)
                          </span>
                        </p>
                      </div>

                      <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">
                          Faltas / Ausências
                        </span>
                        <p className="text-lg font-black text-red-400 mt-0.5">
                          {apuracao.diasFaltasDescontadasCount}{' '}
                          <span className="text-xs font-normal text-gray-400">
                            ({apuracao.diasFaltasAbonadasCount} abonadas)
                          </span>
                        </p>
                      </div>

                      <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">
                          Carga Horária Cumprida
                        </span>
                        <p className="text-lg font-black text-brand-blue-light font-mono mt-0.5">
                          {formatarMinutosHoras(apuracao.minutosTrabalhadosPeriodo)}{' '}
                          <span className="text-[11px] font-normal text-gray-400">
                            / {formatarMinutosHoras(apuracao.minutosEsperadosPeriodo)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Tabela de Composição do Valor a Pagar */}
                    <div className="bg-brand-dark-4/70 border border-brand-dark-5 rounded-2xl p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-brand-dark-5/60">
                        <span className="text-gray-300">
                          <strong>1. Base Proporcional do Período</strong> (Início em {formatarData(contratoAtivo.dataInicio)})
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatarMoeda(apuracao.valorBaseProporcionalBruto)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-brand-dark-5/60">
                        <span className="text-gray-300">
                          <strong>2. (-) Ausências Não Trabalhadas</strong> ({apuracao.diasFaltasDescontadasCount} dia(s) × {formatarMoeda(apuracao.valorDiaRef)})
                        </span>
                        <span className="font-mono font-bold text-red-400">
                          - {formatarMoeda(apuracao.valorDescontoFaltasInteiras)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-brand-dark-5/60">
                        <span className="text-gray-300">
                          <strong>3. (-) Horas Parciais / Atrasos / Saídas Antecipadas</strong> ({formatarMinutosHoras(apuracao.minutosFaltantesForaFaltasInteiras)} × {formatarMoeda(apuracao.valorHoraRef)}/h)
                        </span>
                        <span className="font-mono font-bold text-red-400">
                          - {formatarMoeda(apuracao.valorDescontoHorasParciais)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-brand-dark-5/60">
                        <span className="text-gray-300">
                          <strong>4. (+) Horas Extras / Adicionais</strong> ({formatarMinutosHoras(apuracao.minutosExtrasPeriodo)})
                        </span>
                        <span className="font-mono font-bold text-brand-green">
                          + {formatarMoeda(apuracao.valorHorasExtras)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-brand-dark-5/60">
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={incluirComissoesOs}
                            onChange={e => setIncluirComissoesOs(e.target.checked)}
                            className="rounded bg-brand-dark-3 border-brand-dark-5 text-brand-blue"
                          />
                          <span>
                            <strong>5. (+) Comissões de O.S. Pagas e Concluídas no Período</strong>
                          </span>
                        </label>
                        <span className="font-mono font-bold text-brand-green">
                          + {formatarMoeda(resumoFinal.comissoes)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                            (+) Ajuda de Custo / Bônus (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorAjudaCustoInput}
                            onChange={e => setValorAjudaCustoInput(e.target.value)}
                            className="input text-xs py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                            (-) Adiantamentos / Vales (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={valorAdiantamentosInput}
                            onChange={e => setValorAdiantamentosInput(e.target.value)}
                            className="input text-xs py-1.5 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Opção rápida: considerar dias sem batida como presença ou exigir lançamento */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assumirPresencaSemBatida}
                          onChange={e => setAssumirPresencaSemBatida(e.target.checked)}
                          className="rounded bg-brand-dark-3 border-brand-dark-5 text-brand-blue"
                        />
                        <span>
                          Considerar dias úteis passados sem batida como <strong>Presença Normal</strong> automaticamente
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handlePreencherDiasUteisPadrao}
                        disabled={salvando}
                        className="btn-ghost text-xs py-1.5 px-3 border border-brand-blue/30 text-brand-blue-light flex items-center gap-1.5"
                      >
                        <Wand2 size={13} />
                        Preencher Dias Úteis desde {formatarData(contratoAtivo.dataInicio)}
                      </button>
                    </div>
                  </div>

                  {/* Coluna Direita: Valor Final para Nota Fiscal + Anexo da NF + Lançar na Despesa Mensal */}
                  <div className="card border-brand-green/30 bg-brand-green/5 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="bg-brand-dark-3 border border-brand-green/30 rounded-2xl p-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                          Valor Líquido Apurado (Valor para Emissão da NF)
                        </span>
                        <p className="text-3xl font-black text-brand-green mt-1">
                          {formatarMoeda(resumoFinal.liquidoFinal)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Informe este valor a <strong>{contratoAtivo.nome}</strong> para emissão da Nota Fiscal.
                        </p>
                      </div>

                      {/* Dados e Anexo da Nota Fiscal */}
                      <div className="space-y-3 bg-brand-dark-3/80 border border-brand-dark-5 rounded-xl p-3.5">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={14} className="text-brand-blue-light" />
                          Dados da Nota Fiscal (NFS-e)
                        </h4>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                              Nº da Nota Fiscal
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 2026015"
                              value={numeroNfInput}
                              onChange={e => setNumeroNfInput(e.target.value)}
                              className="input text-xs py-1.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                              Data Pagamento/NF
                            </label>
                            <input
                              type="date"
                              value={dataEmissaoNfInput}
                              onChange={e => setDataEmissaoNfInput(e.target.value)}
                              className="input text-xs py-1.5"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex-1 btn-ghost border border-dashed border-brand-blue/40 text-brand-blue-light text-xs py-2 px-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 hover:bg-brand-blue/10">
                            <Upload size={14} />
                            <span>{notaFiscalUrlInput ? 'Substituir Nota Fiscal' : 'Anexar Nota Fiscal (PDF/Foto)'}</span>
                            <input
                              type="file"
                              accept=".pdf,image/*,.xml"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadNotaFiscalGestor(file);
                              }}
                            />
                          </label>

                          {notaFiscalUrlInput && (
                            <button
                              type="button"
                              onClick={() => visualizarDocumentoBase64(notaFiscalUrlInput, `NF_${contratoAtivo.nome}.pdf`)}
                              className="p-2 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/30"
                              title="Visualizar Nota Fiscal anexada"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                        </div>

                        <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={lancarDespesaAutomatica}
                            onChange={e => setLancarDespesaAutomatica(e.target.checked)}
                            className="rounded bg-brand-dark-3 border-brand-dark-5 text-brand-green"
                          />
                          <span>
                            Lançar automaticamente na demanda de <strong>Despesas Mensais PJ</strong> ao pagar
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Botões de Ação Final */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleExportarPdfApuracao}
                        className="w-full btn-ghost border border-brand-dark-5 py-2.5 text-xs font-bold uppercase flex items-center justify-center gap-2"
                      >
                        <Download size={15} className="text-brand-blue-light" />
                        Baixar PDF (Extrato + Entradas e Saídas)
                      </button>

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => handleConfirmarFechamentoEPagamento(false)}
                        className="w-full py-2.5 rounded-xl bg-brand-blue/20 hover:bg-brand-blue/30 border border-brand-blue/30 text-brand-blue-light text-xs font-bold uppercase transition-all"
                      >
                        Salvar Apuração (Aguardar NF do Colaborador)
                      </button>

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => handleConfirmarFechamentoEPagamento(true)}
                        className="w-full py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        Confirmar Pagamento & Lançar Despesa PJ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela Diária Completa: Espelho de Ponto (Entradas, Saídas, Faltas e Horários) */}
              {contratoAtivo && apuracao && (
                <div className="card p-0 overflow-hidden border-brand-dark-5">
                  <div className="p-4 border-b border-brand-dark-5 bg-brand-dark-3/50 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                        <Calendar size={16} className="text-brand-blue-light" />
                        Espelho Diário de Ponto: Entradas, Saídas e Ocorrências ({contratoAtivo.nome})
                      </h3>
                      <p className="text-xs text-gray-400">
                        Clique no status de qualquer dia para marcar <strong>Falta</strong>, <strong>Abono</strong> ou <strong>Editar Horários</strong> (ex: quando saiu mais cedo ou faltou por questões pessoais).
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                          <th className="table-header">Data</th>
                          <th className="table-header">Dia</th>
                          <th className="table-header">Situação do Dia</th>
                          <th className="table-header">Entrada</th>
                          <th className="table-header">Intervalo</th>
                          <th className="table-header">Saída</th>
                          <th className="table-header">Horas Cumpridas</th>
                          <th className="table-header">Saldo Dia</th>
                          <th className="table-header">GPS / Foto</th>
                          <th className="table-header">Observação</th>
                          <th className="table-header text-center">Ajustar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark-5/30">
                        {apuracao.diasCalendario.map(dia => {
                          if (dia.antesDaAdmissao) {
                            return (
                              <tr key={dia.data} className="bg-brand-dark-4/20 opacity-45">
                                <td className="table-cell font-mono">{formatarData(dia.data)}</td>
                                <td className="table-cell">{dia.diaSemanaLabel}</td>
                                <td colSpan={9} className="table-cell italic text-gray-500">
                                  Anterior à data de início do colaborador ({formatarData(contratoAtivo.dataInicio)}) — Não contabilizado
                                </td>
                              </tr>
                            );
                          }

                          const reg = dia.registro;

                          return (
                            <tr
                              key={dia.data}
                              className={`hover:bg-brand-dark-4/50 transition-colors ${
                                dia.statusEfetivo === 'falta_descontada'
                                  ? 'bg-red-500/5'
                                  : dia.statusEfetivo === 'descanso_semanal'
                                  ? 'bg-brand-dark-4/25 opacity-60'
                                  : ''
                              }`}
                            >
                              <td className="table-cell font-mono font-bold text-white whitespace-nowrap">
                                {formatarData(dia.data)}
                              </td>
                              <td className="table-cell font-bold text-gray-400">{dia.diaSemanaLabel}</td>
                              <td className="table-cell">
                                {dia.statusEfetivo === 'descanso_semanal' ? (
                                  <span className="text-[10px] text-gray-500 uppercase font-bold">
                                    Descanso Semanal
                                  </span>
                                ) : (
                                  <select
                                    value={reg?.statusDia || (dia.statusEfetivo === 'trabalhado' ? 'trabalhado' : 'falta_descontada')}
                                    onChange={e => handleAlterarStatusDiaRapido(dia.data, e.target.value as StatusDiaPonto)}
                                    className={`text-[11px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                                      dia.statusEfetivo === 'trabalhado'
                                        ? 'bg-brand-green/15 text-brand-green border-brand-green/30'
                                        : dia.statusEfetivo === 'parcial'
                                        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                        : dia.statusEfetivo === 'falta_descontada'
                                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                        : dia.statusEfetivo === 'falta_abonada'
                                        ? 'bg-brand-blue/15 text-brand-blue-light border-brand-blue/30'
                                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5'
                                    }`}
                                  >
                                    <option value="trabalhado" className="bg-brand-dark-2 text-white">✅ Presença Normal</option>
                                    <option value="parcial" className="bg-brand-dark-2 text-white">⏱️ Horário Parcial / Atraso</option>
                                    <option value="falta_descontada" className="bg-brand-dark-2 text-white">❌ Ausência (Não Faturar)</option>
                                    <option value="falta_abonada" className="bg-brand-dark-2 text-white">🤝 Ausência Abonada</option>
                                    <option value="folga_feriado" className="bg-brand-dark-2 text-white">🏖️ Folga / Feriado</option>
                                  </select>
                                )}
                              </td>
                              <td className="table-cell font-mono text-brand-green">
                                {reg?.horaEntrada || (dia.statusEfetivo === 'trabalhado' && assumirPresencaSemBatida ? contratoAtivo.horarioEntradaPadrao : '—')}
                              </td>
                              <td className="table-cell font-mono text-gray-400 whitespace-nowrap">
                                {reg?.horaIntervaloIda || reg?.horaIntervaloVolta
                                  ? `${reg?.horaIntervaloIda || '--:--'} - ${reg?.horaIntervaloVolta || '--:--'}`
                                  : dia.statusEfetivo === 'trabalhado' && assumirPresencaSemBatida
                                  ? `${contratoAtivo.horarioIntervaloInicioPadrao} - ${contratoAtivo.horarioIntervaloFimPadrao}`
                                  : '—'}
                              </td>
                              <td className="table-cell font-mono text-purple-300">
                                {reg?.horaSaida || (dia.statusEfetivo === 'trabalhado' && assumirPresencaSemBatida ? contratoAtivo.horarioSaidaPadrao : '—')}
                              </td>
                              <td className="table-cell font-mono font-bold text-white">
                                {dia.minutosTrabalhados > 0 ? formatarMinutosHoras(dia.minutosTrabalhados) : '00h00'}
                              </td>
                              <td className="table-cell font-mono font-bold">
                                {dia.ehDiaTrabalhoContrato ? (
                                  <span
                                    className={
                                      dia.minutosDiferenca < 0
                                        ? 'text-red-400'
                                        : dia.minutosDiferenca > 0
                                        ? 'text-brand-green'
                                        : 'text-gray-400'
                                    }
                                  >
                                    {formatarMinutosHoras(dia.minutosDiferenca, true)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="table-cell">
                                <div className="flex items-center gap-1.5">
                                  {reg?.latEntrada && reg?.lngEntrada && (
                                    <a
                                      href={`https://www.google.com/maps?q=${reg.latEntrada},${reg.lngEntrada}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        (reg.distanciaEntradaMetros ?? 0) <= (sedeGps.raioMetros || 150)
                                          ? 'bg-brand-green/15 text-brand-green'
                                          : 'bg-yellow-500/15 text-yellow-400'
                                      }`}
                                      title="Abrir localização da batida no Google Maps"
                                    >
                                      📍 {reg.distanciaEntradaMetros !== undefined ? `${reg.distanciaEntradaMetros}m` : 'GPS'}
                                    </a>
                                  )}
                                  {(reg?.fotoEntradaUrl || reg?.fotoSaidaUrl) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        visualizarDocumentoBase64(
                                          (reg.fotoEntradaUrl || reg.fotoSaidaUrl)!,
                                          `Ponto_${contratoAtivo.nome}_${dia.data}.webp`
                                        )
                                      }
                                      className="px-1.5 py-0.5 rounded bg-brand-blue/15 text-brand-blue-light text-[10px] font-bold"
                                      title="Ver foto da batida"
                                    >
                                      📷
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="table-cell text-gray-400 max-w-[160px] truncate" title={reg?.observacao}>
                                {reg?.observacao || '—'}
                              </td>
                              <td className="table-cell text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDiaEditando({
                                      data: dia.data,
                                      statusDia: reg?.statusDia || 'trabalhado',
                                      horaEntrada: reg?.horaEntrada || contratoAtivo.horarioEntradaPadrao,
                                      horaIntervaloIda: reg?.horaIntervaloIda || contratoAtivo.horarioIntervaloInicioPadrao,
                                      horaIntervaloVolta: reg?.horaIntervaloVolta || contratoAtivo.horarioIntervaloFimPadrao,
                                      horaSaida: reg?.horaSaida || contratoAtivo.horarioSaidaPadrao,
                                      observacao: reg?.observacao || ''
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-brand-dark-4 hover:bg-brand-blue/20 text-gray-300 hover:text-brand-blue-light transition-colors"
                                  title="Editar horários de Entrada/Saída ou lançar justificativa"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Configurar / Editar Colaborador */}
      {modalContratoAberto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl border-brand-dark-5 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
              <h3 className="text-base font-black text-white uppercase">
                {editandoContratoId ? 'Editar Contrato / Carga Horária' : 'Configurar Colaborador / Prestador PJ'}
              </h3>
              <button
                type="button"
                onClick={() => setModalContratoAberto(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Importar rápido de usuário cadastrado na equipe */}
            {!editandoContratoId && usuariosEquipe.length > 0 && (
              <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                <label className="text-[10px] font-bold text-brand-blue-light uppercase block mb-1">
                  Preencher a partir de membro da Equipe já cadastrado (Opcional)
                </label>
                <select
                  onChange={e => {
                    const u = usuariosEquipe.find(x => x.email === e.target.value);
                    if (u) {
                      setFormContrato(prev => ({
                        ...prev,
                        nome: u.nome,
                        usuarioEmail: u.email,
                        cpfCnpj: u.cpf || prev.cpfCnpj,
                        contato: u.contato || prev.contato
                      }));
                    }
                  }}
                  defaultValue=""
                  className="select text-xs"
                >
                  <option value="">-- Selecionar colaborador da equipe --</option>
                  {usuariosEquipe.map(u => (
                    <option key={u.email} value={u.email}>
                      {u.nome} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleSalvarContrato} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nome do Colaborador *</label>
                  <input
                    type="text"
                    required
                    value={formContrato.nome}
                    onChange={e => setFormContrato({ ...formContrato, nome: e.target.value })}
                    placeholder="Ex: Hector"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">E-mail de Login no Sistema</label>
                  <input
                    type="email"
                    value={formContrato.usuarioEmail}
                    onChange={e => setFormContrato({ ...formContrato, usuarioEmail: e.target.value })}
                    placeholder="Para vincular o relógio de ponto dele"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={formContrato.dataInicio}
                    onChange={e => setFormContrato({ ...formContrato, dataInicio: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">CNPJ / MEI / CPF</label>
                  <input
                    type="text"
                    value={formContrato.cpfCnpj}
                    onChange={e => setFormContrato({ ...formContrato, cpfCnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Chave PIX</label>
                  <input
                    type="text"
                    value={formContrato.chavePix}
                    onChange={e => setFormContrato({ ...formContrato, chavePix: e.target.value })}
                    placeholder="CPF, E-mail, Celular..."
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-brand-dark-4 p-3.5 rounded-xl border border-brand-dark-5">
                <div>
                  <label className="label">Formato de Cálculo</label>
                  <select
                    value={formContrato.modeloCalculo}
                    onChange={e => setFormContrato({ ...formContrato, modeloCalculo: e.target.value as ModeloCalculoColaborador })}
                    className="select text-xs"
                  >
                    <option value="mensal_proporcional">Mensal Proporcional</option>
                    <option value="diaria">Valor por Diária</option>
                    <option value="horista">Valor por Hora</option>
                  </select>
                </div>

                {formContrato.modeloCalculo === 'mensal_proporcional' && (
                  <div>
                    <label className="label">Divisor do Mês</label>
                    <select
                      value={formContrato.divisorMensal}
                      onChange={e => setFormContrato({ ...formContrato, divisorMensal: e.target.value as DivisorMensalColaborador })}
                      className="select text-xs"
                    >
                      <option value="dias_uteis">Pelos Dias Úteis do Mês</option>
                      <option value="30_dias">Comercial (30 Dias)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">
                    {formContrato.modeloCalculo === 'mensal_proporcional'
                      ? 'Valor Base Mensal (R$)'
                      : formContrato.modeloCalculo === 'diaria'
                      ? 'Valor da Diária (R$)'
                      : 'Valor da Hora (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formContrato.valorBase}
                    onChange={e => setFormContrato({ ...formContrato, valorBase: e.target.value })}
                    className="input font-mono font-bold text-brand-green"
                  />
                </div>
              </div>

              {/* Carga Horária Padrão */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="label">Horas/Dia</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formContrato.cargaHorariaHoras}
                    onChange={e => setFormContrato({ ...formContrato, cargaHorariaHoras: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">Entrada</label>
                  <input
                    type="time"
                    value={formContrato.horarioEntradaPadrao}
                    onChange={e => setFormContrato({ ...formContrato, horarioEntradaPadrao: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">Ida Almoço</label>
                  <input
                    type="time"
                    value={formContrato.horarioIntervaloInicioPadrao}
                    onChange={e => setFormContrato({ ...formContrato, horarioIntervaloInicioPadrao: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">Volta Almoço</label>
                  <input
                    type="time"
                    value={formContrato.horarioIntervaloFimPadrao}
                    onChange={e => setFormContrato({ ...formContrato, horarioIntervaloFimPadrao: e.target.value })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">Saída</label>
                  <input
                    type="time"
                    value={formContrato.horarioSaidaPadrao}
                    onChange={e => setFormContrato({ ...formContrato, horarioSaidaPadrao: e.target.value })}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setModalContratoAberto(false)}
                  className="btn-ghost px-4 py-2 text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn-primary px-5 py-2 text-xs font-bold uppercase"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Horários / Ocorrência de um Dia Específico */}
      {diaEditando && contratoAtivo && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-md border-brand-dark-5 space-y-4">
            <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
              <h3 className="text-sm font-black text-white uppercase">
                Ajustar Dia {formatarData(diaEditando.data)} — {contratoAtivo.nome}
              </h3>
              <button
                type="button"
                onClick={() => setDiaEditando(null)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoDiaModal} className="space-y-4 text-xs">
              <div>
                <label className="label">Situação do Dia</label>
                <select
                  value={diaEditando.statusDia}
                  onChange={e => setDiaEditando({ ...diaEditando, statusDia: e.target.value as StatusDiaPonto })}
                  className="select"
                >
                  <option value="trabalhado">✅ Presença Normal</option>
                  <option value="parcial">⏱️ Horário Parcial / Saída Antecipada / Atraso</option>
                  <option value="falta_descontada">❌ Ausência / Falta (Não Faturar este dia)</option>
                  <option value="falta_abonada">🤝 Ausência Abonada (Pagar normalmente)</option>
                  <option value="folga_feriado">🏖️ Folga / Feriado</option>
                </select>
              </div>

              {(diaEditando.statusDia === 'trabalhado' || diaEditando.statusDia === 'parcial') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hora Entrada</label>
                    <input
                      type="time"
                      value={diaEditando.horaEntrada}
                      onChange={e => setDiaEditando({ ...diaEditando, horaEntrada: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Saída Intervalo</label>
                    <input
                      type="time"
                      value={diaEditando.horaIntervaloIda}
                      onChange={e => setDiaEditando({ ...diaEditando, horaIntervaloIda: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Retorno Intervalo</label>
                    <input
                      type="time"
                      value={diaEditando.horaIntervaloVolta}
                      onChange={e => setDiaEditando({ ...diaEditando, horaIntervaloVolta: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Hora Saída</label>
                    <input
                      type="time"
                      value={diaEditando.horaSaida}
                      onChange={e => setDiaEditando({ ...diaEditando, horaSaida: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Motivo / Observação (Ex: Questão pessoal, saída médica)</label>
                <input
                  type="text"
                  value={diaEditando.observacao}
                  onChange={e => setDiaEditando({ ...diaEditando, observacao: e.target.value })}
                  placeholder="Ex: Saiu às 14h para resolver assunto pessoal"
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setDiaEditando(null)}
                  className="btn-ghost px-4 py-2 text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary px-5 py-2 text-xs font-bold uppercase">
                  Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
