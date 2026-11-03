import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  LogIn,
  Coffee,
  RotateCcw,
  LogOut,
  FileText,
  Upload,
  Eye,
  AlertTriangle,
  ShieldCheck,
  User,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ColaboradorContrato, RegistroPontoColaborador, FechamentoColaborador } from '../../types';
import {
  listarContratosColaboradores,
  salvarContratoColaborador,
  listarRegistrosPonto,
  salvarRegistroPonto,
  listarFechamentosColaboradores,
  salvarFechamentoColaborador,
  obterConfigSedeGps,
  calcularDistanciaMetros,
  calcularMinutosTrabalhadosDia,
  formatarMinutosHoras,
  capturarFrameVideoComprimido,
  ConfigSedeGps
} from '../../services/pontoColaboradoresService';
import { fileToBase64, uploadBase64File, visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { formatarData, formatarMoeda } from '../../utils/formatters';

interface RelogioPontoColaboradorProps {
  onPontoRegistrado?: () => void;
}

export function RelogioPontoColaborador({ onPontoRegistrado }: RelogioPontoColaboradorProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const empresaId = usuario?.empresaId || '00000000-0000-0000-0000-000000000001';
  const ehGestor =
    usuario?.role === 'admin' ||
    usuario?.email === 'gui.gomesassis@gmail.com' ||
    Boolean(usuario?.permissoes?.includes('fin_gestao_colaboradores'));

  const [agora, setAgora] = useState(new Date());
  const [contratos, setContratos] = useState<ColaboradorContrato[]>([]);
  const [colaboradorSelecionadoId, setColaboradorSelecionadoId] = useState<string>('');
  const [registros, setRegistros] = useState<RegistroPontoColaborador[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoColaborador[]>([]);
  const [sedeGps, setSedeGps] = useState<ConfigSedeGps>({ latitude: null, longitude: null, raioMetros: 150 });
  const [carregando, setCarregando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [redirecionandoPainel, setRedirecionandoPainel] = useState(false);
  const [mensagemFeedback, setMensagemFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

  // Estado GPS atual
  const [coordsAtuais, setCoordsAtuais] = useState<{ lat: number; lng: number; precisao?: number } | null>(null);
  const [erroGps, setErroGps] = useState<string | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);

  // Estado Câmera / Selfie
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Observação do registro
  const [observacaoBatida, setObservacaoBatida] = useState('');

  // Upload de NF pelo colaborador
  const [enviandoNfId, setEnviandoNfId] = useState<string | null>(null);
  const [numeroNfInput, setNumeroNfInput] = useState<Record<string, string>>({});

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      let [listaContratos, cfgSede, listaFechamentos] = await Promise.all([
        listarContratosColaboradores(empresaId),
        obterConfigSedeGps(empresaId),
        listarFechamentosColaboradores(empresaId)
      ]);
      setSedeGps(cfgSede);
      setFechamentos(listaFechamentos);

      // Tenta vincular automaticamente pelo e-mail ou nome do usuário logado
      const emailUser = usuario?.email?.trim().toLowerCase();
      const nomeUser = usuario?.nome?.trim().toLowerCase();
      let meuContrato = listaContratos.find(
        c =>
          (c.usuarioEmail && c.usuarioEmail.toLowerCase() === emailUser) ||
          c.nome.trim().toLowerCase() === nomeUser
      );

      // Se o usuário logado (seja admin ou colaborador) ainda não tiver contrato, auto-cadastramos
      if (!meuContrato && usuario) {
        try {
          const novoContrato = await salvarContratoColaborador({
            empresaId,
            usuarioEmail: usuario.email,
            nome: usuario.nome || usuario.email.split('@')[0],
            cargoFuncao: usuario.role === 'admin' ? 'Administrador / Gestor' : 'Colaborador',
            dataInicio: new Date().toISOString().slice(0, 10),
            modeloCalculo: 'mensal_proporcional',
            divisorMensal: 'dias_uteis',
            valorBase: 0,
            cargaHorariaDiariaMin: 480,
            horarioEntradaPadrao: '08:00',
            horarioIntervaloInicioPadrao: '12:00',
            horarioIntervaloFimPadrao: '13:00',
            horarioSaidaPadrao: '17:00',
            diasSemanaTrabalho: [1, 2, 3, 4, 5],
            exigeFotoPonto: false,
            exigeGpsPonto: false,
            ativo: true
          });
          meuContrato = novoContrato;
          listaContratos = [novoContrato, ...listaContratos];
        } catch (e) {
          console.warn('Não foi possível auto-cadastrar contrato padrão para o usuário:', e);
        }
      }

      setContratos(listaContratos);

      const idAlvo = meuContrato?.id || (ehGestor && listaContratos[0]?.id) || '';
      setColaboradorSelecionadoId(idAlvo);

      if (idAlvo) {
        const regs = await listarRegistrosPonto(empresaId, idAlvo);
        setRegistros(regs);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do relógio de ponto:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
    capturarLocalizacaoAtual();
    return () => {
      pararCamera();
    };
  }, [empresaId]);

  useEffect(() => {
    if (colaboradorSelecionadoId) {
      listarRegistrosPonto(empresaId, colaboradorSelecionadoId).then(setRegistros);
    }
  }, [colaboradorSelecionadoId, empresaId]);

  const capturarLocalizacaoAtual = () => {
    if (!navigator.geolocation) {
      setErroGps('Geolocalização não suportada neste navegador.');
      return;
    }
    setBuscandoGps(true);
    setErroGps(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoordsAtuais({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy)
        });
        setBuscandoGps(false);
      },
      err => {
        console.warn('Aviso GPS:', err);
        setErroGps('Permissão de localização não concedida ou sinal indisponível.');
        setBuscandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const iniciarCamera = async () => {
    setErroCamera(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraAtiva(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.warn('Câmera indisponível:', err);
      setErroCamera('Câmera não encontrada ou permissão negada. O registro será feito apenas com horário e GPS.');
      setCameraAtiva(false);
    }
  };

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  const contratoAtual = useMemo(
    () => contratos.find(c => c.id === colaboradorSelecionadoId) || null,
    [contratos, colaboradorSelecionadoId]
  );

  const hojeStr = useMemo(() => {
    const yyyy = agora.getFullYear();
    const mm = String(agora.getMonth() + 1).padStart(2, '0');
    const dd = String(agora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [agora]);

  const registroHoje = useMemo(
    () => registros.find(r => r.data === hojeStr) || null,
    [registros, hojeStr]
  );

  const distanciaSedeAtual = useMemo(() => {
    if (!coordsAtuais || sedeGps.latitude === null || sedeGps.longitude === null) return undefined;
    return calcularDistanciaMetros(coordsAtuais.lat, coordsAtuais.lng, sedeGps.latitude, sedeGps.longitude);
  }, [coordsAtuais, sedeGps]);

  const handleBaterPonto = async (tipoBatida: 'entrada' | 'intervalo_ida' | 'intervalo_volta' | 'saida') => {
    if (!contratoAtual) {
      setMensagemFeedback({
        tipo: 'erro',
        texto: 'Seu cadastro de colaborador/prestador ainda não foi configurado pelo gestor.'
      });
      return;
    }

    setRegistrando(true);
    setMensagemFeedback(null);

    try {
      const horaAtualStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

      // 1. Capturar foto se câmera estiver ativa (ou tentar ativar rapidamente se exigido)
      let fotoCapturadaUrl: string | undefined;
      if (cameraAtiva && videoRef.current) {
        try {
          const base64Foto = await capturarFrameVideoComprimido(videoRef.current);
          try {
            const path = `${empresaId}/ponto/${contratoAtual.id}/${hojeStr}_${tipoBatida}.webp`;
            const uploaded = await uploadBase64File(base64Foto, 'documentos-clientes', path);
            fotoCapturadaUrl = uploaded || base64Foto;
          } catch {
            fotoCapturadaUrl = base64Foto;
          }
        } catch (e) {
          console.warn('Falha ao capturar frame da câmera:', e);
        }
      }

      // 2. Montar horários atualizados do dia
      const novaEntrada = tipoBatida === 'entrada' ? horaAtualStr : registroHoje?.horaEntrada;
      const novoIntIda = tipoBatida === 'intervalo_ida' ? horaAtualStr : registroHoje?.horaIntervaloIda;
      const novoIntVolta = tipoBatida === 'intervalo_volta' ? horaAtualStr : registroHoje?.horaIntervaloVolta;
      const novaSaida = tipoBatida === 'saida' ? horaAtualStr : registroHoje?.horaSaida;

      const minTrab = calcularMinutosTrabalhadosDia(novaEntrada, novoIntIda, novoIntVolta, novaSaida);
      const minEsp = contratoAtual.cargaHorariaDiariaMin || 480;
      const statusCalculado =
        novaSaida && minTrab < minEsp - 15 ? 'parcial' : 'trabalhado';

      const obsFinal = [registroHoje?.observacao, observacaoBatida.trim()]
        .filter(Boolean)
        .join(' | ');

      const salvo = await salvarRegistroPonto({
        id: registroHoje?.id,
        empresaId,
        colaboradorId: contratoAtual.id,
        colaboradorEmail: contratoAtual.usuarioEmail || usuario?.email,
        colaboradorNome: contratoAtual.nome,
        data: hojeStr,
        statusDia: statusCalculado,
        horaEntrada: novaEntrada,
        horaIntervaloIda: novoIntIda,
        horaIntervaloVolta: novoIntVolta,
        horaSaida: novaSaida,
        minutosTrabalhados: minTrab,
        minutosEsperados: minEsp,
        minutosSaldo: minTrab - minEsp,
        fotoEntradaUrl: tipoBatida === 'entrada' ? (fotoCapturadaUrl || registroHoje?.fotoEntradaUrl) : registroHoje?.fotoEntradaUrl,
        fotoSaidaUrl: tipoBatida === 'saida' ? (fotoCapturadaUrl || registroHoje?.fotoSaidaUrl) : registroHoje?.fotoSaidaUrl,
        latEntrada: tipoBatida === 'entrada' ? (coordsAtuais?.lat ?? registroHoje?.latEntrada) : registroHoje?.latEntrada,
        lngEntrada: tipoBatida === 'entrada' ? (coordsAtuais?.lng ?? registroHoje?.lngEntrada) : registroHoje?.lngEntrada,
        distanciaEntradaMetros: tipoBatida === 'entrada' ? (distanciaSedeAtual ?? registroHoje?.distanciaEntradaMetros) : registroHoje?.distanciaEntradaMetros,
        latSaida: tipoBatida === 'saida' ? (coordsAtuais?.lat ?? registroHoje?.latSaida) : registroHoje?.latSaida,
        lngSaida: tipoBatida === 'saida' ? (coordsAtuais?.lng ?? registroHoje?.lngSaida) : registroHoje?.lngSaida,
        distanciaSaidaMetros: tipoBatida === 'saida' ? (distanciaSedeAtual ?? registroHoje?.distanciaSaidaMetros) : registroHoje?.distanciaSaidaMetros,
        origemRegistro: 'eletronico',
        observacao: obsFinal || undefined
      });

      setObservacaoBatida('');
      const atualizados = await listarRegistrosPonto(empresaId, contratoAtual.id);
      setRegistros(atualizados);
      onPontoRegistrado?.();

      const labels: Record<typeof tipoBatida, string> = {
        entrada: 'Entrada registrada',
        intervalo_ida: 'Saída para almoço registrada',
        intervalo_volta: 'Retorno do almoço registrado',
        saida: 'Saída final registrada'
      };

      const mensagensRedirecionamento: Record<typeof tipoBatida, string> = {
        entrada: `Entrada registrada com sucesso às ${horaAtualStr}! Redirecionando para o Painel...`,
        intervalo_ida: `Saída para intervalo registrada às ${horaAtualStr}! Bom almoço! Redirecionando para o Painel...`,
        intervalo_volta: `Retorno do almoço registrado às ${horaAtualStr}! Bom trabalho! Redirecionando para o Painel...`,
        saida: `Saída final registrada às ${horaAtualStr}! Expediente encerrado, bom descanso! Redirecionando para o Painel...`
      };

      setMensagemFeedback({
        tipo: 'sucesso',
        texto: mensagensRedirecionamento[tipoBatida]
      });

      setRedirecionandoPainel(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1600);
    } catch (err: any) {
      setMensagemFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao registrar ponto.'
      });
    } finally {
      setRegistrando(false);
    }
  };

  const handleUploadNotaFiscalColaborador = async (fechamento: FechamentoColaborador, file: File) => {
    setEnviandoNfId(fechamento.id);
    try {
      const base64 = await fileToBase64(file);
      let urlFinal = base64;
      try {
        const ext = file.name.split('.').pop() || 'pdf';
        const path = `${empresaId}/notas-fiscais/${fechamento.colaboradorId}/NF_${fechamento.id}.${ext}`;
        const uploaded = await uploadBase64File(base64, 'documentos-clientes', path);
        if (uploaded) urlFinal = uploaded;
      } catch {
        // mantém base64 caso bucket não aceite
      }

      const numNf = numeroNfInput[fechamento.id] || fechamento.numeroNf || '';
      await salvarFechamentoColaborador({
        ...fechamento,
        numeroNf: numNf,
        dataEmissaoNf: new Date().toISOString().slice(0, 10),
        notaFiscalUrl: urlFinal,
        status: fechamento.status === 'pago' ? 'pago' : 'nf_enviada'
      });

      const listaAtualizada = await listarFechamentosColaboradores(empresaId);
      setFechamentos(listaAtualizada);
      setMensagemFeedback({
        tipo: 'sucesso',
        texto: 'Nota Fiscal anexada com sucesso! O gestor já pode conferir e lançar o pagamento.'
      });
    } catch (err: any) {
      setMensagemFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao anexar Nota Fiscal.'
      });
    } finally {
      setEnviandoNfId(null);
    }
  };

  const meusFechamentos = useMemo(
    () => fechamentos.filter(f => f.colaboradorId === colaboradorSelecionadoId),
    [fechamentos, colaboradorSelecionadoId]
  );

  if (carregando) {
    return (
      <div className="card p-10 text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Carregando terminal de ponto eletrônico...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Boas-vindas e Flexibilização (Primeiro Acesso do Dia) */}
      {(!registroHoje || !registroHoje.horaEntrada) && (
        <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-blue/20 rounded-xl text-brand-blue-light shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Bom dia, {usuario?.nome || 'Colaborador'}! Registre o seu ponto de entrada
              </h3>
              <p className="text-xs text-gray-300">
                Inicie suas atividades registrando seu ponto de entrada. Após a confirmação você será direcionado automaticamente ao Painel.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-all whitespace-nowrap self-start sm:self-center"
            title="Ir para o painel e registrar o ponto mais tarde"
          >
            Ir ao Painel agora (registrar depois)
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Cabeçalho do Relógio Digital + Seletor de Colaborador (se Gestor ou Terminal Compartilhado) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Principal: Relógio & Botões de Registro */}
        <div className="lg:col-span-2 card border-brand-blue/30 bg-gradient-to-br from-brand-dark-2 via-brand-dark-3 to-brand-dark-2 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-dark-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light">
                <Clock size={26} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue-light block">
                  Registro Eletrônico de Presença & Horas (PJ)
                </span>
                <h2 className="text-xl font-black text-white">
                  {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </h2>
                <p className="text-xs text-gray-400 capitalize">
                  {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Seletor de Colaborador */}
            <div className="min-w-[230px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                Colaborador / Prestador
              </label>
              {contratos.length === 0 ? (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
                  Nenhum colaborador configurado ainda.
                </div>
              ) : ehGestor ? (
                <select
                  value={colaboradorSelecionadoId}
                  onChange={e => setColaboradorSelecionadoId(e.target.value)}
                  className="select text-xs font-bold"
                >
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.cargoFuncao})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 bg-brand-dark-4 border border-brand-dark-5 rounded-xl px-3 py-2 text-xs font-bold text-white">
                  <User size={14} className="text-brand-blue-light" />
                  {contratoAtual?.nome || usuario?.nome}
                </div>
              )}
            </div>
          </div>

          {/* Feedback de batida */}
          {mensagemFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2.5 ${
                mensagemFeedback.tipo === 'sucesso'
                  ? 'bg-brand-green/15 border-brand-green/30 text-brand-green'
                  : mensagemFeedback.tipo === 'aviso'
                  ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                  : 'bg-red-500/15 border-red-500/30 text-red-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{mensagemFeedback.texto}</span>
              </div>
              {redirecionandoPainel && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-2.5 py-1 rounded bg-brand-green/20 hover:bg-brand-green/30 text-white text-[11px] font-black uppercase tracking-wider shrink-0 transition-colors"
                >
                  Ir agora →
                </button>
              )}
            </div>
          )}

          {/* Status das Batidas de Hoje */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-brand-dark-4/80 border border-brand-dark-5 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">1. Entrada</span>
              <span className="text-lg font-black text-brand-green font-mono mt-0.5 block">
                {registroHoje?.horaEntrada || '--:--'}
              </span>
            </div>
            <div className="bg-brand-dark-4/80 border border-brand-dark-5 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">2. Saída Almoço</span>
              <span className="text-lg font-black text-yellow-400 font-mono mt-0.5 block">
                {registroHoje?.horaIntervaloIda || '--:--'}
              </span>
            </div>
            <div className="bg-brand-dark-4/80 border border-brand-dark-5 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">3. Retorno</span>
              <span className="text-lg font-black text-brand-blue-light font-mono mt-0.5 block">
                {registroHoje?.horaIntervaloVolta || '--:--'}
              </span>
            </div>
            <div className="bg-brand-dark-4/80 border border-brand-dark-5 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">4. Saída Final</span>
              <span className="text-lg font-black text-purple-400 font-mono mt-0.5 block">
                {registroHoje?.horaSaida || '--:--'}
              </span>
            </div>
          </div>

          {/* Botões de Ação de Bater Ponto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              disabled={registrando || !contratoAtual}
              onClick={() => handleBaterPonto('entrada')}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-brand-green/15 hover:bg-brand-green/25 border border-brand-green/30 text-brand-green font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40"
            >
              <LogIn size={22} />
              <span>Registrar Entrada</span>
              {registroHoje?.horaEntrada && (
                <span className="text-[9px] text-gray-400 font-normal">Atualizar ({registroHoje.horaEntrada})</span>
              )}
            </button>

            <button
              type="button"
              disabled={registrando || !contratoAtual}
              onClick={() => handleBaterPonto('intervalo_ida')}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-400 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40"
            >
              <Coffee size={22} />
              <span>Saída Intervalo</span>
              {registroHoje?.horaIntervaloIda && (
                <span className="text-[9px] text-gray-400 font-normal">Atualizar ({registroHoje.horaIntervaloIda})</span>
              )}
            </button>

            <button
              type="button"
              disabled={registrando || !contratoAtual}
              onClick={() => handleBaterPonto('intervalo_volta')}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-brand-blue/15 hover:bg-brand-blue/25 border border-brand-blue/30 text-brand-blue-light font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40"
            >
              <RotateCcw size={22} />
              <span>Fim Intervalo</span>
              {registroHoje?.horaIntervaloVolta && (
                <span className="text-[9px] text-gray-400 font-normal">Atualizar ({registroHoje.horaIntervaloVolta})</span>
              )}
            </button>

            <button
              type="button"
              disabled={registrando || !contratoAtual}
              onClick={() => handleBaterPonto('saida')}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40"
            >
              <LogOut size={22} />
              <span>Registrar Saída</span>
              {registroHoje?.horaSaida && (
                <span className="text-[9px] text-gray-400 font-normal">Atualizar ({registroHoje.horaSaida})</span>
              )}
            </button>
          </div>

          {/* Campo opcional de Observação / Justificativa rápida */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
              Observação do Dia (Opcional — ex: saída antecipada, serviço externo, questão pessoal)
            </label>
            <input
              type="text"
              value={observacaoBatida}
              onChange={e => setObservacaoBatida(e.target.value)}
              placeholder="Digite aqui se precisar justificar horário ou atividade externa..."
              className="input text-xs"
            />
          </div>
        </div>

        {/* Card Lateral: Validação de Localização GPS & Selfie */}
        <div className="card border-brand-dark-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-brand-dark-5 pb-2.5">
              <ShieldCheck size={16} className="text-brand-green" />
              Autenticação: GPS & Foto
            </h3>

            {/* Bloco GPS */}
            <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1.5">
                  <MapPin size={13} className="text-brand-blue-light" />
                  Localização GPS
                </span>
                <button
                  type="button"
                  onClick={capturarLocalizacaoAtual}
                  className="text-[10px] font-bold text-brand-blue-light hover:underline"
                >
                  {buscandoGps ? 'Obtendo...' : 'Atualizar GPS'}
                </button>
              </div>

              {coordsAtuais ? (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-[11px]">
                      {coordsAtuais.lat.toFixed(5)}, {coordsAtuais.lng.toFixed(5)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${coordsAtuais.lat},${coordsAtuais.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-brand-blue-light hover:underline font-bold"
                    >
                      Ver Mapa ↗
                    </a>
                  </div>
                  {distanciaSedeAtual !== undefined && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold mt-1 ${
                        distanciaSedeAtual <= (sedeGps.raioMetros || 150)
                          ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                          : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                      }`}
                    >
                      {distanciaSedeAtual <= (sedeGps.raioMetros || 150)
                        ? `✅ Na Sede do Escritório (${distanciaSedeAtual}m)`
                        : `⚠️ Fora do Perímetro (${distanciaSedeAtual}m da sede)`}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-yellow-400 flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  {erroGps || 'Aguardando captura do GPS...'}
                </p>
              )}
            </div>

            {/* Bloco Câmera (Selfie Compactada) */}
            <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1.5">
                  <Camera size={13} className="text-brand-blue-light" />
                  Foto na Batida (Selfie - Opcional)
                </span>
                {cameraAtiva ? (
                  <button
                    type="button"
                    onClick={pararCamera}
                    className="text-[10px] font-bold text-red-400 hover:underline"
                  >
                    Desligar Câmera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={iniciarCamera}
                    className="text-[10px] font-bold text-brand-green hover:underline"
                  >
                    Ativar Câmera (Opcional)
                  </button>
                )}
              </div>

              {cameraAtiva ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-brand-dark-5">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <span className="absolute bottom-1.5 right-2 bg-black/70 text-[9px] text-brand-green px-2 py-0.5 rounded font-bold">
                    ● Câmera Pronta (Foto Opcional)
                  </span>
                </div>
              ) : (
                <div className="text-center py-4 px-2 border border-dashed border-brand-dark-5 rounded-xl space-y-2">
                  <Camera size={22} className="mx-auto text-gray-600" />
                  <p className="text-[11px] text-gray-400">
                    A foto é <strong>opcional</strong>. O ponto é registrado com horário e GPS. Caso queira anexar foto, ative a câmera abaixo.
                  </p>
                  <button
                    type="button"
                    onClick={iniciarCamera}
                    className="btn-ghost text-[10px] py-1 px-3 font-bold uppercase"
                  >
                    Ligar Câmera (Opcional)
                  </button>
                </div>
              )}

              {erroCamera && <p className="text-[10px] text-yellow-400">{erroCamera}</p>}
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-relaxed">
            Os registros de entrada, saída e localização compõem automaticamente o extrato para emissão da sua Nota Fiscal de prestação de serviços.
          </p>
        </div>
      </div>

      {/* Seção: Envio de Nota Fiscal (NFS-e) pelo Colaborador */}
      {meusFechamentos.length > 0 && (
        <div className="card border-brand-blue/25 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-brand-blue-light" />
                Minhas Apurações & Envio de Nota Fiscal (NFS-e)
              </h3>
              <p className="text-xs text-gray-400">
                Confira o valor apurado pelo escritório para o seu período e anexe a sua Nota Fiscal emitida.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meusFechamentos.map(f => (
              <div
                key={f.id}
                className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">
                      Período: {formatarData(f.dataInicioPeriodo)} a {formatarData(f.dataFimPeriodo)}
                    </span>
                    <p className="text-lg font-black text-brand-green mt-0.5">
                      Valor para Emitir NF: {formatarMoeda(f.valorLiquidoFinal)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Horas cumpridas: {formatarMinutosHoras(f.minutosTrabalhadosTotal)} • Dias trab.: {f.diasTrabalhados}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      f.status === 'pago'
                        ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                        : f.status === 'nf_enviada'
                        ? 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    {f.status === 'pago'
                      ? 'Pago'
                      : f.status === 'nf_enviada'
                      ? 'NF Anexada'
                      : 'Aguardando NF'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-dark-5">
                  <input
                    type="text"
                    placeholder="Nº da Nota Fiscal"
                    value={numeroNfInput[f.id] ?? f.numeroNf ?? ''}
                    onChange={e => setNumeroNfInput(prev => ({ ...prev, [f.id]: e.target.value }))}
                    className="input text-xs py-1.5 w-36"
                  />

                  <label className="btn-primary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5">
                    <Upload size={13} />
                    <span>{enviandoNfId === f.id ? 'Enviando...' : f.notaFiscalUrl ? 'Trocar NF' : 'Anexar Nota Fiscal'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*,.xml"
                      className="hidden"
                      onChange={e => {
                        const arq = e.target.files?.[0];
                        if (arq) handleUploadNotaFiscalColaborador(f, arq);
                      }}
                    />
                  </label>

                  {f.notaFiscalUrl && (
                    <button
                      type="button"
                      onClick={() => visualizarDocumentoBase64(f.notaFiscalUrl!, `NF_${f.colaboradorNome}.pdf`)}
                      className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1 text-brand-blue-light"
                    >
                      <Eye size={13} />
                      Ver NF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico Recente de Batidas do Colaborador */}
      <div className="card p-0 overflow-hidden border-brand-dark-5">
        <div className="p-4 border-b border-brand-dark-5 flex items-center justify-between bg-brand-dark-3/40">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar size={15} className="text-brand-blue-light" />
            Meus Registros Recentes de Entrada e Saída ({contratoAtual?.nome || 'Colaborador'})
          </h3>
          <span className="text-[11px] text-gray-400">{registros.length} dia(s) registrado(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-brand-dark-3 border-b border-brand-dark-5">
                <th className="table-header">Data</th>
                <th className="table-header">Entrada</th>
                <th className="table-header">Intervalo</th>
                <th className="table-header">Saída</th>
                <th className="table-header">Total Horas</th>
                <th className="table-header">Localização / Foto</th>
                <th className="table-header">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-dark-5/40">
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    Nenhum registro de ponto lançado ainda para este colaborador.
                  </td>
                </tr>
              ) : (
                [...registros]
                  .sort((a, b) => b.data.localeCompare(a.data))
                  .slice(0, 31)
                  .map(r => (
                    <tr key={r.id} className="hover:bg-brand-dark-4/50">
                      <td className="table-cell font-mono font-bold text-white">{formatarData(r.data)}</td>
                      <td className="table-cell font-mono text-brand-green">{r.horaEntrada || '—'}</td>
                      <td className="table-cell font-mono text-gray-400">
                        {r.horaIntervaloIda || r.horaIntervaloVolta
                          ? `${r.horaIntervaloIda || '--:--'} às ${r.horaIntervaloVolta || '--:--'}`
                          : '—'}
                      </td>
                      <td className="table-cell font-mono text-purple-300">{r.horaSaida || '—'}</td>
                      <td className="table-cell font-mono font-bold text-white">
                        {formatarMinutosHoras(r.minutosTrabalhados)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {r.latEntrada && r.lngEntrada ? (
                            <a
                              href={`https://www.google.com/maps?q=${r.latEntrada},${r.lngEntrada}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue-light text-[10px] font-bold hover:underline"
                            >
                              📍 {r.distanciaEntradaMetros !== undefined ? `${r.distanciaEntradaMetros}m` : 'Mapa'}
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-500">Manual</span>
                          )}
                          {(r.fotoEntradaUrl || r.fotoSaidaUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                visualizarDocumentoBase64(
                                  (r.fotoEntradaUrl || r.fotoSaidaUrl)!,
                                  `Foto_Ponto_${r.data}.webp`
                                )
                              }
                              className="px-2 py-0.5 rounded bg-brand-green/15 text-brand-green text-[10px] font-bold hover:underline"
                            >
                              📷 Foto
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-gray-400 max-w-[200px] truncate" title={r.observacao}>
                        {r.observacao || '—'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
