import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Save, X, Eye, EyeOff, MessageCircle, Users, Phone, Search,
  Mail, HelpCircle, ChevronDown, List, Trash2, DollarSign, Copy, Check,
  AlertTriangle, Wallet, Sparkles, CalendarClock, Layers, Plus
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  OrdemDeServico, STATUS_OS, FORMAS_PAGAMENTO, CANAIS_ATENDIMENTO,
  FormaPagamento, StatusOS, CanalAtendimento, ServicoConfig, StatusExecucaoServico,
  STATUS_EXECUCAO_SERVICO, PagamentoItem, Arma
} from '../../types';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { useServicos } from '../../context/ServicosContext';
import { Cliente } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import {
  classeStatusExecucao,
  iconeStatusExecucao,
  formatarMoeda,
  formatarNumeroOS,
  removerAcentos,
  gerarItensComboServico,
  buscarServicoNoCatalogo,
  ehServicoTransferenciaAcervo,
  extrairDataYMD,
  formatarParaISO
} from '../../utils/formatters';
import { supabase } from '../../db/supabase';
import { useAuth } from '../../context/AuthContext';
import { isLaudoExame } from '../../utils/categoriaHelper';
import { ModalArma } from '../clientes/AbaDocumentacao';
import { fileToBase64, uploadBase64File, visualizarDocumentoBase64 } from '../../utils/fileUtils';

interface FormularioOrdemProps {
  ordemExistente?: OrdemDeServico;
}

const ICONES_CANAL: Record<CanalAtendimento, React.ReactNode> = {
  'WhatsApp':   <MessageCircle size={14} />,
  'Presencial': <Users size={14} />,
  'Ligação':    <Phone size={14} />,
  'E-mail':     <Mail size={14} />,
  'Outro':      <HelpCircle size={14} />,
};

// Cores dos botões de status de pagamento
const ESTILO_STATUS: Record<StatusOS, string> = {
  'Aguardando Pagamento': 'bg-yellow-500/30 border-yellow-500/60 text-yellow-300',
  'Parcialmente Pago':    'bg-orange-500/30 border-orange-500/60 text-orange-300',
  'Gratuidade':           'bg-brand-blue/30 border-brand-blue/60 text-brand-blue-light',
  'Pago':                 'bg-brand-green/30 border-brand-green/60 text-brand-green-light',
};

// ── Dropdown de serviços ──────────────────────────────────────────────────
// ── Dropdown de serviços com Multiplicador de Quantidade e Multi-Seleção ──
function SeletorServico({
  onSelecionar,
  onSelecionarComboAquisicao
}: {
  onSelecionar: (s: ServicoConfig, quantidade?: number) => void;
  onSelecionarComboAquisicao: () => void;
}) {
  const navigate = useNavigate();
  const { servicos } = useServicos();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [manterAberto, setManterAberto] = useState<boolean>(true);
  const [ultimoAdicionado, setUltimoAdicionado] = useState<{ id: string; nome: string; qtd: number } | null>(null);
  const [totalAdicionados, setTotalAdicionados] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setBusca('');
      setUltimoAdicionado(null);
      setTotalAdicionados(0);
    }
  }, [aberto]);

  const handleSelecionar = (servico: ServicoConfig, qtdPersonalizada?: number) => {
    const qtdParaAdicionar = qtdPersonalizada ?? quantidade;
    onSelecionar(servico, qtdParaAdicionar);
    setTotalAdicionados(prev => prev + qtdParaAdicionar);
    setUltimoAdicionado({ id: servico.id, nome: servico.nome, qtd: qtdParaAdicionar });

    if (!manterAberto) {
      setAberto(false);
    }
  };

  const servicosFiltrados = servicos.filter(s => 
    removerAcentos(s.nome.toLowerCase()).includes(removerAcentos(busca.toLowerCase()))
  );

  const exibirAtalhoAquisicao =
    !busca.trim() ||
    removerAcentos('aquisicao de arma de fogo compra craf gt').includes(removerAcentos(busca.toLowerCase()));

  const presetsQtd = [1, 2, 3, 5, 10, 13];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="btn-selecionar-servico"
        onClick={() => setAberto(a => !a)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-dark-5 border border-brand-dark-5 hover:border-brand-blue/40 hover:bg-brand-blue/10 text-gray-300 hover:text-brand-blue-light text-xs sm:text-sm font-medium transition-all"
      >
        <List size={14} />
        Selecionar serviço
        <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <>
          {/* Backdrop mobile */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 sm:hidden"
            onClick={() => setAberto(false)}
          />

          {/* Menu Dropdown com auto-ajuste inteligente e largura expandida */}
          <div className="
            fixed inset-x-3 top-20 z-50 max-h-[82vh] flex flex-col bg-brand-dark-2 border border-brand-dark-5 rounded-2xl shadow-2xl overflow-hidden animate-scale-up
            sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-1 sm:w-[440px] sm:rounded-xl sm:max-h-[500px]
          ">
            {/* Cabeçalho de Busca */}
            <div className="p-2.5 sm:p-2 border-b border-brand-dark-5 bg-brand-dark-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    ref={inputRef}
                    type="text"
                    className="w-full bg-brand-dark-4 border border-brand-dark-5 rounded-lg pl-8 pr-7 py-2 sm:py-1.5 text-sm sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                    placeholder="Pesquisar serviço ou pacote..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-brand-dark-4 shrink-0"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Barra de Quantidade / Multiplicador de Serviços */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-brand-dark-5/50">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Qtd:
                  </span>
                  <div className="flex items-center bg-brand-dark-4 rounded-md border border-brand-dark-5">
                    <button
                      type="button"
                      onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                      className="px-2 py-0.5 text-gray-400 hover:text-white hover:bg-brand-dark-5 font-bold text-xs transition-colors rounded-l-md"
                      title="Diminuir quantidade"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={quantidade}
                      onChange={e => setQuantidade(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-10 text-center bg-transparent text-xs font-black text-amber-400 outline-none py-0.5"
                      title="Digitar quantidade de vezes que o serviço será inserido"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantidade(q => Math.min(50, q + 1))}
                      className="px-2 py-0.5 text-gray-400 hover:text-white hover:bg-brand-dark-5 font-bold text-xs transition-colors rounded-r-md"
                      title="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>

                  {/* Chips rápidos de quantidade (1x, 2x, 3x, 5x, 10x, 13x) */}
                  <div className="flex items-center gap-1">
                    {presetsQtd.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuantidade(p)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
                          quantidade === p
                            ? 'bg-amber-500 text-black shadow-xs font-black'
                            : 'bg-brand-dark-4 text-gray-400 hover:text-white hover:bg-brand-dark-5'
                        }`}
                        title={`Definir quantidade como ${p}`}
                      >
                        {p}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opção Manter Aberto */}
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-300 cursor-pointer select-none shrink-0" title="Mantém o menu aberto para você ir adicionando os outros serviços da O.S. sem precisar clicar novamente">
                  <input
                    type="checkbox"
                    checked={manterAberto}
                    onChange={e => setManterAberto(e.target.checked)}
                    className="rounded border-gray-600 text-brand-blue focus:ring-0 w-3 h-3"
                  />
                  <span>Manter aberto</span>
                </label>
              </div>
            </div>

            {/* Aviso visual de último serviço adicionado */}
            {ultimoAdicionado && (
              <div className="px-3 py-1.5 bg-emerald-500/15 border-b border-emerald-500/30 flex items-center justify-between animate-fade-in text-emerald-300 text-xs">
                <span className="font-semibold truncate">
                  ✓ Adicionado {ultimoAdicionado.qtd > 1 ? `${ultimoAdicionado.qtd}x` : '1x'}: {ultimoAdicionado.nome}
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-black text-emerald-200 shrink-0 ml-2">
                  Total: {totalAdicionados}
                </span>
              </div>
            )}

            {/* Lista com Rolagem */}
            <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto divide-y divide-brand-dark-5/40">
              {exibirAtalhoAquisicao && (
                <button
                  type="button"
                  onClick={() => {
                    onSelecionarComboAquisicao();
                    setTotalAdicionados(t => t + 3);
                    setUltimoAdicionado({ id: 'combo', nome: 'PACOTE AQUISIÇÃO', qtd: 3 });
                    if (!manterAberto) setAberto(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-400 shrink-0" />
                      AQUISIÇÃO DE ARMA DE FOGO (PACOTE)
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      + 3 Etapas
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-200/70 mt-0.5">
                    Abre Autorização de Compra + CRAF (Em Espera) + Guia de Tráfego (Em Espera)
                  </p>
                </button>
              )}

              {servicosFiltrados.length === 0 && !exibirAtalhoAquisicao ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">
                    {busca ? 'Nenhum serviço encontrado.' : 'Nenhum serviço cadastrado.'}
                  </p>
                  {!busca && (
                    <button
                      type="button"
                      onClick={() => {
                        setAberto(false);
                        navigate('/configuracoes');
                      }}
                      className="text-xs text-brand-blue-light hover:underline"
                    >
                      Cadastrar em Configurações
                    </button>
                  )}
                </div>
              ) : (
                servicosFiltrados.map((servico) => {
                  const valorTotalPreview = servico.valorPadrao * quantidade;
                  return (
                    <div
                      key={servico.id}
                      className="w-full px-3 py-2 text-xs text-gray-200 hover:bg-brand-blue/15 hover:text-white transition-colors flex items-center justify-between gap-2 group"
                    >
                      {/* Clique no nome seleciona com a quantidade atual */}
                      <button
                        type="button"
                        onClick={() => handleSelecionar(servico)}
                        className="text-left flex-1 min-w-0 pr-1 py-1"
                        title={`Clique para adicionar ${quantidade}x este serviço`}
                      >
                        <div className="font-bold text-gray-100 group-hover:text-cyan-300 transition-colors leading-snug break-words">
                          {servico.nome}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="text-brand-green font-bold">
                            R$ {servico.valorPadrao.toFixed(2).replace('.', ',')} unid.
                          </span>
                          {quantidade > 1 && (
                            <span className="text-amber-400 font-extrabold bg-amber-500/15 px-1 rounded">
                              {quantidade}x = R$ {valorTotalPreview.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Botão de Adição com a Quantidade */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelecionar(servico)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-dark-5 group-hover:bg-brand-blue text-gray-200 group-hover:text-white font-bold text-xs transition-all active:scale-95"
                          title={`Adicionar ${quantidade}x este serviço`}
                        >
                          <Plus size={12} />
                          <span>Adicionar {quantidade > 1 ? `${quantidade}x` : ''}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé com Concluir / Resumo */}
            <div className="p-2 border-t border-brand-dark-5 bg-brand-dark-3 flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">
                {totalAdicionados > 0 ? (
                  <strong className="text-emerald-400 font-bold">{totalAdicionados} serviço(s) adicionados</strong>
                ) : (
                  <span>Selecione quantos desejar</span>
                )}
              </span>

              <button
                type="button"
                onClick={() => setAberto(false)}
                className="px-3 py-1 rounded-lg bg-brand-dark-5 hover:bg-brand-dark-4 text-gray-200 hover:text-white font-bold text-xs transition-all"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


export function FormularioOrdem({ ordemExistente }: FormularioOrdemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { criarOrdem, atualizarOrdem, buscarOrdem } = useOrdens();
  const { servicos } = useServicos();
  const { 
    clientes, criarCliente, atualizarCliente, buscarClientePorNomeExato, 
    clubesRegistrados, buscarArmas, salvarArma, criarOpcaoArma,
    buscarCreditos, adicionarCredito
  } = useClientes();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const { usuario } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [focoNome, setFocoNome] = useState(false);
  const [focoClube, setFocoClube] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  
  const [armasCliente, setArmasCliente] = useState<Arma[]>([]);
  const [saldoCredito, setSaldoCredito] = useState(0);
  const [creditoJaAbatidoNestaOS, setCreditoJaAbatidoNestaOS] = useState(0);
  const [novasArmas, setNovasArmas] = useState<any[]>([]);
  const [modalArmaAberto, setModalArmaAberto] = useState(false);
  const [servicoIndexParaArma, setServicoIndexParaArma] = useState<number | null>(null);
  const [outroClubeTexto, setOutroClubeTexto] = useState<Record<string, string>>({});
  const [salvandoClube, setSalvandoClube] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const carregarUsuarios = async () => {
      if (!usuario?.empresaId) return;
      const { data } = await supabase
        .from('usuarios_autorizados')
        .select('id, nome')
        .eq('ativo', true)
        .eq('empresa_id', usuario.empresaId)
        .order('nome');
      if (data) setUsuarios(data);
    };
    carregarUsuarios();
  }, [usuario?.empresaId]);

  const exigeVinculoArma = (servNome: string) => {
    const servConfig = servicos.find((s: any) => s.nome.toUpperCase() === servNome.toUpperCase());
    if (servConfig) return !!servConfig.vinculaArma;
    
    // Fallback names
    const nomeNorm = removerAcentos(servNome.toLowerCase());
    return nomeNorm.includes('guia') || nomeNorm.includes('gt') || nomeNorm.includes('craf') || nomeNorm.includes('transferencia');
  };

  const clubeParceiroNome = usuario?.dadosEmpresa?.clubeParceiroPadrao || '';
  const temClubeParceiro = !!clubeParceiroNome;

  const [form, setForm] = useState({
    nomeCliente:       ordemExistente?.nomeCliente       ?? '',
    contato:           ordemExistente?.contato           ?? '',
    cpf:               ordemExistente?.cpf               ?? '',
    senhaGov:          ordemExistente?.senhaGov          ?? '',
    filiadoProTiro:    ordemExistente 
                         ? ordemExistente.filiadoProTiro 
                         : (temClubeParceiro ? true : false),
    clubeFiliado:      ordemExistente?.clubeFiliado       ?? '',
    clubeFiliadoText:  ordemExistente 
                         ? (ordemExistente.filiadoProTiro ? (clubeParceiroNome || 'CLUBE DE TIRO E CAÇA PRÓ TIRO') : (ordemExistente.clubeFiliado ?? ''))
                         : (temClubeParceiro ? clubeParceiroNome : ''),
    endereco:          ordemExistente?.endereco           ?? '',
    servicos:          ordemExistente?.servicos          ?? [],
    valor:             ordemExistente 
                         ? (ordemExistente.servicos || []).filter(s => !s.pagoDireto && !isLaudoExame(s.categoria || '', usuario?.dadosEmpresa?.categoriasServico)).reduce((acc: number, s: any) => acc + (s.valor || 0), 0)
                         : 0,
    valorTexto:        ordemExistente 
                         ? String((ordemExistente.servicos || []).filter(s => !s.pagoDireto && !isLaudoExame(s.categoria || '', usuario?.dadosEmpresa?.categoriasServico)).reduce((acc: number, s: any) => acc + (s.valor || 0), 0)).replace('.', ',') 
                         : '',
    formaPagamento:    (ordemExistente?.formaPagamento   ?? 'Pendente') as FormaPagamento,
    status:            (ordemExistente?.status           ?? 'Aguardando Pagamento') as StatusOS,
    canalAtendimento:  (ordemExistente?.canalAtendimento ?? null) as CanalAtendimento | null,
    observacaoContato: ordemExistente?.observacaoContato ?? '',
    observacoes:       ordemExistente?.observacoes       ?? '',
    valorPago:         ordemExistente?.valorPago ?? 0,
    historicoPagamentos: ordemExistente?.historicoPagamentos ?? [] as PagamentoItem[],
    desconto:          ordemExistente?.desconto ?? 0,
    descontoTexto:     ordemExistente?.desconto ? String(ordemExistente.desconto).replace('.', ',') : '',
  });

  const [dataPagamentoInput, setDataPagamentoInput] = useState(() => new Date().toISOString().split('T')[0]);

  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(() => {
    const state = location.state as { clientePreDefinido?: Cliente } | null;
    return state?.clientePreDefinido?.id || null;
  });

  const cpfFormLimpo = (form.cpf || '').replace(/\D/g, '');
  const nomeFormNorm = removerAcentos((form.nomeCliente || '').trim().toUpperCase().replace(/\s+/g, ' '));

  const clienteEncontrado = React.useMemo(() => {
    if (clienteSelecionadoId) {
      const porId = clientes.find(c => c.id === clienteSelecionadoId);
      if (porId) {
        const porIdCpf = (porId.cpf || '').replace(/\D/g, '');
        const porIdNome = removerAcentos((porId.nome || '').trim().toUpperCase().replace(/\s+/g, ' '));
        if (
          (cpfFormLimpo.length >= 11 && porIdCpf === cpfFormLimpo) ||
          (nomeFormNorm.length > 0 && porIdNome === nomeFormNorm)
        ) {
          return porId;
        }
      }
    }

    return clientes.find(c => {
      const cCpf = (c.cpf || '').replace(/\D/g, '');
      const cNome = removerAcentos((c.nome || '').trim().toUpperCase().replace(/\s+/g, ' '));
      return (
        (cpfFormLimpo.length >= 11 && cCpf === cpfFormLimpo) ||
        (nomeFormNorm.length > 0 && cNome === nomeFormNorm)
      );
    });
  }, [clientes, clienteSelecionadoId, cpfFormLimpo, nomeFormNorm]);

  useEffect(() => {
    let cancelado = false;
    const carregarArmas = async () => {
      if (clienteEncontrado?.id) {
        try {
          const list = await buscarArmas(clienteEncontrado.id, clienteEncontrado.empresaId);
          if (!cancelado) setArmasCliente(list);
        } catch (err) {
          console.error('[FormularioOrdem] Erro ao buscar armas do cliente:', err);
        }
      } else {
        setArmasCliente([]);
      }
    };
    carregarArmas();
    return () => {
      cancelado = true;
    };
  }, [clienteEncontrado?.id, clienteEncontrado?.empresaId, buscarArmas]);

  useEffect(() => {
    let cancelado = false;
    const carregarSaldoHaver = async () => {
      if (clienteEncontrado?.id) {
        try {
          const creds = await buscarCreditos(clienteEncontrado.id);
          if (cancelado) return;
          const saldoAtual = creds.reduce((acc, c) => acc + (c.tipo === 'entrada' ? c.valor : -c.valor), 0);
          setSaldoCredito(saldoAtual);

          if (ordemExistente?.id) {
            const numFormatado = formatarNumeroOS(ordemExistente.numero);
            const movsOS = creds.filter(
              c => c.origemId === ordemExistente.id || (c.descricao && c.descricao.includes(numFormatado))
            );
            const saidas = movsOS.filter(c => c.tipo === 'saida').reduce((acc, c) => acc + c.valor, 0);
            const estornos = movsOS
              .filter(c => c.tipo === 'entrada' && c.descricao.toLowerCase().includes('estorno'))
              .reduce((acc, c) => acc + c.valor, 0);
            setCreditoJaAbatidoNestaOS(Math.max(0, saidas - estornos));
          } else {
            setCreditoJaAbatidoNestaOS(0);
          }
        } catch (err) {
          console.error('[FormularioOrdem] Erro ao buscar créditos do cliente:', err);
        }
      } else {
        setSaldoCredito(0);
        setCreditoJaAbatidoNestaOS(0);
      }
    };
    carregarSaldoHaver();
    return () => {
      cancelado = true;
    };
  }, [clienteEncontrado?.id, buscarCreditos, ordemExistente?.id, ordemExistente?.numero]);

  // Preenchimento automático vindo do perfil do cliente
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: Cliente };
    if (state?.clientePreDefinido && !ordemExistente) {
      const c = state.clientePreDefinido;
      if (c.id) setClienteSelecionadoId(c.id);
      setForm(f => ({
        ...f,
        nomeCliente: c.nome,
        cpf: c.cpf,
        contato: c.contato,
        senhaGov: c.senhaGov,
        filiadoProTiro: c.filiadoProTiro,
        clubeFiliado: c.clubeFiliado || '',
        clubeFiliadoText: c.filiadoProTiro ? (clubeParceiroNome || 'CLUBE DE TIRO E CAÇA PRÓ TIRO') : (c.clubeFiliado || ''),
        endereco: c.endereco || ''
      }));
      window.history.replaceState({}, document.title);
    }
  }, [location, ordemExistente, clubeParceiroNome]);

  // Se estiver editando uma ordem existente, garantir que os dados do cliente reflitam o perfil atual do cadastro
  useEffect(() => {
    if (ordemExistente && clientes.length > 0) {
      const ordemCpfLimpo = (ordemExistente.cpf || '').replace(/\D/g, '');
      const ordemNomeNorm = removerAcentos((ordemExistente.nomeCliente || '').trim().toUpperCase().replace(/\s+/g, ' '));
      const c = clientes.find(cli => {
        const cliCpf = (cli.cpf || '').replace(/\D/g, '');
        const cliNome = removerAcentos((cli.nome || '').trim().toUpperCase().replace(/\s+/g, ' '));
        return (ordemCpfLimpo.length >= 11 && cliCpf === ordemCpfLimpo) || (ordemNomeNorm.length > 0 && cliNome === ordemNomeNorm);
      });
      if (c) {
        setClienteSelecionadoId(c.id);
        setForm(f => ({
          ...f,
          nomeCliente: c.nome,
          contato: c.contato,
          senhaGov: c.senhaGov,
          filiadoProTiro: c.filiadoProTiro,
          clubeFiliado: c.clubeFiliado || '',
          clubeFiliadoText: c.filiadoProTiro ? (clubeParceiroNome || 'CLUBE DE TIRO E CAÇA PRÓ TIRO') : (c.clubeFiliado || ''),
          endereco: c.endereco || ''
        }));
      }
    }
  }, [ordemExistente, clientes, clubeParceiroNome]);

  const [erros, setErros] = useState<Record<string, string>>({});

  const atualizar = (campo: string, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => { const novo = { ...e }; delete novo[campo]; return novo; });
  };

  const atualizarClube = (texto: string) => {
    const isParceiro = texto.trim().toUpperCase() === clubeParceiroNome.trim().toUpperCase();
    setForm(f => ({
      ...f,
      clubeFiliadoText: texto,
      filiadoProTiro: isParceiro,
      clubeFiliado: isParceiro ? '' : texto
    }));
    setErros(e => { const novo = { ...e }; delete novo.clubeFiliado; return novo; });
  };

  const selecionarCliente = (c: Cliente) => {
    setClienteSelecionadoId(c.id);
    setForm(f => ({
      ...f,
      nomeCliente: c.nome,
      cpf: c.cpf,
      contato: c.contato,
      senhaGov: c.senhaGov,
      filiadoProTiro: c.filiadoProTiro,
      clubeFiliado: c.clubeFiliado || '',
      clubeFiliadoText: c.filiadoProTiro ? (clubeParceiroNome || 'CLUBE DE TIRO E CAÇA PRÓ TIRO') : (c.clubeFiliado || ''),
      endereco: c.endereco
    }));
    setFocoNome(false);
  };

  const clientesSugeridos = clientes.filter(c => 
    removerAcentos(c.nome.toLowerCase()).includes(removerAcentos(form.nomeCliente.toLowerCase())) && 
    form.nomeCliente.length > 0 && 
    removerAcentos(c.nome.toLowerCase()) !== removerAcentos(form.nomeCliente.toLowerCase())
  );

  const handleCPF = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.replace(/(\d{3})(\d)/, '$1.$2')
               .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
               .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    atualizar('cpf', f);
  };

  const handleTelefone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.length <= 10
      ? n.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      : n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    atualizar('contato', f);
  };

  const handleValor = (v: string) => {
    const limpo = v.replace(',', '.');
    atualizar('valorTexto', v.replace(/[^\d,]/g, ''));
    atualizar('valor', parseFloat(limpo) || 0);
  };

  const handleDesconto = (v: string) => {
    const limpo = v.replace(',', '.');
    const valor = parseFloat(limpo) || 0;
    setForm(f => ({
      ...f,
      descontoTexto: v.replace(/[^\d,]/g, ''),
      desconto: valor
    }));
  };

  const adicionarItensAoFormulario = (itensGerados: ReturnType<typeof gerarItensComboServico>, mensagemToast?: string) => {
    const armaJaSelecionada = (form.servicos as any[]).find(s => s.armaId);

    const novosBlocos = itensGerados.map(item => {
      const valorAplicado = form.filiadoProTiro ? (item.valorFiliado || item.valorPadrao) : item.valorPadrao;
      const isLaudo = isLaudoExame(item.categoria || '', usuario?.dadosEmpresa?.categoriasServico);
      const isTransfAcervo = ehServicoTransferenciaAcervo(item.nome);

      return {
        id: uuidv4(),
        nome: item.nome,
        detalhes: '',
        taxaPF: item.taxaPF,
        exigeGRU: item.exigeGRU,
        valor: valorAplicado,
        statusExecucao: item.statusInicial,
        etapaOrigemNome: item.etapaOrigemNome,
        acervoDestino: isTransfAcervo ? ('Caça' as const) : undefined,
        armaId: armaJaSelecionada && exigeVinculoArma(item.nome) ? armaJaSelecionada.armaId : undefined,
        armaModelo: armaJaSelecionada && exigeVinculoArma(item.nome) ? armaJaSelecionada.armaModelo : undefined,
        categoria: item.categoria || 'Honorário',
        pagoDireto: isLaudo
      };
    });

    const novosServicos = [...form.servicos, ...novosBlocos];
    const novoValor = novosServicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);

    setForm(f => ({
      ...f,
      servicos: novosServicos,
      valor: novoValor,
      valorTexto: novoValor.toFixed(2).replace('.', ',')
    }));
    setErros(e => { const n = { ...e }; delete n['servicos']; delete n['valor']; return n; });

    if (mensagemToast) {
      mostrar('sucesso', mensagemToast);
    } else if (novosBlocos.length > 1) {
      mostrar(
        'sucesso',
        `✨ Combo Inteligente: ${novosBlocos.length} etapas adicionadas (${novosBlocos.map(b => b.nome).join(' ➔ ')}).`
      );
    }
  };

  const adicionarServico = (serv: ServicoConfig, quantidade: number = 1) => {
    const qtd = Math.max(1, Math.min(50, quantidade || 1));
    const itensBase = gerarItensComboServico(serv, servicos);
    const todosItens: typeof itensBase = [];
    for (let i = 0; i < qtd; i++) {
      todosItens.push(...itensBase);
    }
    const msg = qtd > 1 ? `✨ ${qtd}x "${serv.nome}" adicionados à Ordem de Serviço!` : undefined;
    adicionarItensAoFormulario(todosItens, msg);
  };

  const duplicarServico = (servicoId: string) => {
    const original = (form.servicos as any[]).find((s: any) => s.id === servicoId);
    if (!original) return;

    const novoBloco = {
      ...original,
      id: uuidv4(),
      protocolo: '',
      numeroControlePF: '',
      armaId: undefined,
      armaModelo: undefined,
      arquivoUrl: undefined,
      historicoLogs: []
    };

    const novosServicos = [...form.servicos, novoBloco];
    const novoValor = novosServicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);

    setForm(f => ({
      ...f,
      servicos: novosServicos,
      valor: novoValor,
      valorTexto: novoValor.toFixed(2).replace('.', ',')
    }));

    mostrar('sucesso', `✨ Serviço "${original.nome}" duplicado! Vincule a arma correspondente.`);
  };

  const adicionarComboAquisicaoArma = () => {
    const servAut = buscarServicoNoCatalogo(servicos, ['autorizacao de compra', 'aquisicao de arma']) || {
      id: 'combo-aquisicao',
      nome: 'SOLICITAÇÃO DE AUTORIZAÇÃO DE COMPRA',
      valorPadrao: 200,
      valorFiliado: 150,
      taxaPF: 88,
      exigeGRU: true,
      categoria: 'Honorário',
      vinculaArma: false,
      criadoEm: ''
    };
    const itens = gerarItensComboServico(servAut, servicos);
    adicionarItensAoFormulario(
      itens,
      '📦 Pacote Aquisição de Arma adicionado: Autorização de Compra (Fila de Protocolo) + CRAF e Guia de Tráfego (Em Espera da PF)!'
    );
  };

  const adicionarEtapaSugerida = (nomeBusca: string[], nomeFallback: string, servicoOrigem: any) => {
    const encontrado = buscarServicoNoCatalogo(servicos, nomeBusca);
    const itemGerado = encontrado
      ? {
          nome: encontrado.nome,
          valorPadrao: encontrado.valorPadrao,
          valorFiliado: encontrado.valorFiliado,
          taxaPF: encontrado.taxaPF,
          exigeGRU: encontrado.exigeGRU,
          categoria: encontrado.categoria || 'Honorário',
          vinculaArma: !!encontrado.vinculaArma,
          statusInicial: 'Aguardando Etapa / Programado' as StatusExecucaoServico,
          etapaOrigemNome: servicoOrigem.nome,
        }
      : {
          nome: nomeFallback,
          valorPadrao: 100,
          valorFiliado: 70,
          taxaPF: 0,
          exigeGRU: false,
          categoria: 'Honorário',
          vinculaArma: true,
          statusInicial: 'Aguardando Etapa / Programado' as StatusExecucaoServico,
          etapaOrigemNome: servicoOrigem.nome,
        };

    adicionarItensAoFormulario(
      [itemGerado],
      `✨ Etapa "${itemGerado.nome}" adicionada em espera vinculada a "${servicoOrigem.nome}"!`
    );
  };

  const atualizarPagoDireto = (id: string, pago: boolean) => {
    const novosServicos = (form.servicos as any[]).map((s: any) => s.id === id ? { ...s, pagoDireto: pago } : s);
    const totalNovo = novosServicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);
    setForm(f => ({
      ...f,
      servicos: novosServicos,
      valor: totalNovo,
      valorTexto: totalNovo.toFixed(2).replace('.', ',')
    }));
    setErros(e => { const n = { ...e }; delete n['valor']; return n; });
  };

  const atualizarDetalhesServico = (id: string, texto: string) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.map((s: any) => s.id === id ? { ...s, detalhes: texto } : s)
    }));
  };

  const atualizarValorServico = (id: string, novoValor: number) => {
    const novosServicosResource = (form.servicos as any[]).map((s: any) => s.id === id ? { ...s, valor: novoValor } : s);
    const totalNovo = novosServicosResource.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);
    setForm(f => ({
      ...f,
      servicos: novosServicosResource,
      valor: totalNovo,
      valorTexto: totalNovo.toFixed(2).replace('.', ',')
    }));
    setErros(e => { const n = { ...e }; delete n['valor']; return n; });
  };

  const atualizarStatusServicoExec = (id: string, novoStatus: StatusExecucaoServico) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) =>
        s.id === id
          ? {
              ...s,
              statusExecucao: novoStatus,
              ...(novoStatus !== 'Aguardando Etapa / Programado' ? { dataProgramada: undefined } : {})
            }
          : s
      )
    }));
  };

  const atualizarDataProgramadaServico = (id: string, dataProgramada?: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) =>
        s.id === id ? { ...s, dataProgramada } : s
      )
    }));
  };

  const definirDiasProgramados = (id: string, dias: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + dias);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    atualizarDataProgramadaServico(id, iso);
  };

  const atualizarAcervoDestinoServico = (id: string, acervoDestino: 'Caça' | 'Tiro Desportivo' | 'Coleção') => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) =>
        s.id === id ? { ...s, acervoDestino } : s
      )
    }));
  };

  const atualizarProtocoloServicoLocal = (id: string, protocolo: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => s.id === id ? { ...s, protocolo } : s)
    }));
  };

  const atualizarArmaServico = (id: string, armaId: string, armaModelo: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => {
        if (s.id === id) {
          return { ...s, armaId, armaModelo, gtTipo: '', gtDestino: '' };
        }
        // Herança inteligente: apenas para etapas filhas explicitamente geradas do mesmo processo/combo (ex: CRAF e GT de uma Autorização de Compra)
        const servicoOrigem = (f.servicos as any[]).find((item: any) => item.id === id);
        if (armaId && !s.armaId && s.etapaOrigemNome && servicoOrigem && s.etapaOrigemNome === servicoOrigem.nome) {
          return { ...s, armaId, armaModelo };
        }
        return s;
      })
    }));
  };

  const atualizarArquivoServico = (id: string, arquivoUrl: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => 
        s.id === id ? { ...s, arquivoUrl } : s
      )
    }));
  };

  const atualizarGtCamposServico = (id: string, gtTipo: string, gtDestino: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => {
        if (s.id === id) {
          const detalhesPre = `FINALIDADE: ${gtTipo.toUpperCase()} | DESTINO: ${gtDestino.toUpperCase()}`;
          return { ...s, gtTipo, gtDestino, detalhes: detalhesPre };
        }
        return s;
      })
    }));
  };

  const abrirModalCadastroArma = (idx: number) => {
    setServicoIndexParaArma(idx);
    setModalArmaAberto(true);
  };

  const atualizarResponsavelServico = (id: string, responsavelNome: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => s.id === id ? { ...s, responsavelNome } : s)
    }));
  };

  const atualizarRepasseServico = (id: string, valorRepasse: number) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => s.id === id ? { ...s, valorRepasse } : s)
    }));
  };

  const removerServico = (id: string) => {
    const novosServicos = (form.servicos as any[]).filter((s: any) => s.id !== id);
    const totalNovo = novosServicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);
    setForm(f => ({
      ...f,
      servicos: novosServicos,
      valor: totalNovo,
      valorTexto: totalNovo > 0 ? totalNovo.toFixed(2).replace('.', ',') : ''
    }));
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.nomeCliente.trim()) e.nomeCliente = 'Nome é obrigatório';
    if (!form.contato.trim())     e.contato     = 'Contato é obrigatório';
    if (!form.cpf.trim())         e.cpf         = 'CPF é obrigatório';
    if (form.servicos.length === 0) e.servicos  = 'Adicione pelo menos um serviço';
    if (form.valor <= 0 && form.status !== 'Gratuidade')
                                  e.valor       = 'Informe o valor ou selecione "Gratuidade"';
    if (!form.filiadoProTiro && !form.clubeFiliado.trim())
                                  e.clubeFiliado = 'Informe o clube ao qual é filiado';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoRef.current) return;
    if (!validar()) { mostrar('erro', 'Corrija os campos destacados antes de salvar.'); return; }
    
    salvandoRef.current = true;
    setSalvando(true);
    try {
      // 1. Salvamento silencioso do Cliente na agenda
      let realClienteId = '';
      try {
        const cleanCpf = form.cpf.trim().replace(/\D/g, '');
        let clienteExistente = null;
        if (cleanCpf) {
          clienteExistente = clientes.find(c => c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf);
        }
        if (!clienteExistente) {
          clienteExistente = await buscarClientePorNomeExato(form.nomeCliente.trim().toUpperCase());
        }

        const payloadCli = {
          nome: form.nomeCliente.trim().toUpperCase(),
          cpf: form.cpf.trim(),
          contato: form.contato.trim(),
          senhaGov: form.senhaGov.trim(),
          filiadoProTiro: form.filiadoProTiro,
          clubeFiliado: form.filiadoProTiro ? '' : form.clubeFiliado.trim().toUpperCase(),
          endereco: form.endereco.trim().toUpperCase(),
          observacoes: ''
        };
        if (clienteExistente) {
          realClienteId = clienteExistente.id;
          await atualizarCliente(realClienteId, payloadCli);
        } else {
          realClienteId = await criarCliente(payloadCli);
        }
      } catch (err) {
        console.error('Erro silencioso ao salvar/atualizar cliente na agenda', err);
      }

      // 2. Salvar as novasArmas associadas a este cliente
      if (realClienteId) {
        const clienteObj = clientes.find(c => c.id === realClienteId);
        const clientEmpresaId = clienteObj?.empresaId || usuario?.empresaId;

        for (const arma of novasArmas) {
          try {
            const { tempId, ...armaSemTempId } = arma;
            await salvarArma({
              ...armaSemTempId,
              clienteId: realClienteId
            }, clientEmpresaId);
          } catch (err) {
            console.error('Erro ao salvar arma do cliente na finalização da OS:', err);
          }
        }
      }

      // 3. Processar arquivos dos serviços em base64 (upload para o Storage)
      const servicosProcessados = [];
      for (const s of form.servicos as any[]) {
        let arquivoUrl = s.arquivoUrl || '';
        if (arquivoUrl && arquivoUrl.startsWith('data:')) {
          try {
            const ext = arquivoUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
            const path = `${usuario?.empresaId}/ordens/servicos/${s.id}/conclusao_${uuidv4()}.${ext}`;
            const publicUrl = await uploadBase64File(arquivoUrl, 'documentos-clientes', path);
            arquivoUrl = publicUrl || '';
          } catch (err) {
            console.error('Erro ao enviar anexo de conclusão de serviço para o storage:', err);
          }
        }
        servicosProcessados.push({
          ...s,
          detalhes: (s.detalhes || '').trim(),
          protocolo: (s.protocolo || '').trim().toUpperCase(),
          arquivoUrl
        });
      }

      const ultimaFormaPagamento: FormaPagamento =
        form.historicoPagamentos.length > 0
          ? form.historicoPagamentos[form.historicoPagamentos.length - 1].metodo
          : form.formaPagamento;

      const dados = {
        nomeCliente:       form.nomeCliente.trim().toUpperCase(),
        contato:           form.contato.trim(),
        cpf:               form.cpf.trim(),
        senhaGov:          form.senhaGov.trim(),
        filiadoProTiro:    form.filiadoProTiro,
        clubeFiliado:      form.filiadoProTiro ? '' : form.clubeFiliado.trim().toUpperCase(),
        endereco:          form.endereco.trim().toUpperCase(),
        servicos:          servicosProcessados,
        valor:             form.valor,
        desconto:          form.desconto,
        taxaPFTotal:       (form.servicos as any[]).reduce((acc: number, s: any) => acc + (s.taxaPF || 0), 0),
        formaPagamento:    ultimaFormaPagamento,
        status:            form.status,
        canalAtendimento:  form.canalAtendimento,
        observacaoContato: form.observacaoContato.trim(),
        observacoes:       form.observacoes.trim(),
        valorPago:         form.valorPago,
        historicoPagamentos: form.historicoPagamentos,
      };

      let osId = '';
      if (ordemExistente) {
        await atualizarOrdem(ordemExistente.id, dados);
        osId = ordemExistente.id;
      } else {
        osId = await criarOrdem(dados);
      }

      // 4. Sincronizar baixa/estorno no Saldo em Haver (Crédito de Cliente)
      const targetClienteId = realClienteId || clienteEncontrado?.id;
      if (targetClienteId && osId) {
        try {
          const totalCreditoNaOS =
            (dados.historicoPagamentos || [])
              .filter(p => p.metodo === 'Crédito de Cliente')
              .reduce((acc, p) => acc + (Number(p.valor) || 0), 0) ||
            (dados.status === 'Pago' && dados.formaPagamento === 'Crédito de Cliente'
              ? Math.max(0, dados.valor - (dados.desconto || 0))
              : 0);

          const credsAtuais = await buscarCreditos(targetClienteId);
          const osSalva = ordemExistente || (await buscarOrdem(osId));
          const numFormatado = osSalva?.numero ? formatarNumeroOS(osSalva.numero) : 'O.S.';
          const nomesServicos = servicosProcessados.map((s: any) => s.nome).join(', ');

          const movsDaOS = credsAtuais.filter(
            c => c.origemId === osId || (osSalva?.numero && c.descricao?.includes(formatarNumeroOS(osSalva.numero)))
          );
          const totalSaidas = movsDaOS.filter(c => c.tipo === 'saida').reduce((acc, c) => acc + c.valor, 0);
          const totalEstornos = movsDaOS
            .filter(c => c.tipo === 'entrada' && c.descricao.toLowerCase().includes('estorno'))
            .reduce((acc, c) => acc + c.valor, 0);
          const jaAbatido = Math.max(0, totalSaidas - totalEstornos);
          const diferenca = Number((totalCreditoNaOS - jaAbatido).toFixed(2));

          if (diferenca > 0) {
            await adicionarCredito({
              clienteId: targetClienteId,
              tipo: 'saida',
              valor: diferenca,
              descricao: `Baixa referente à ${numFormatado}${nomesServicos ? ` — ${nomesServicos}` : ''}`,
              origemId: osId,
              criadoPorNome: usuario?.nome
            });
          } else if (diferenca < 0) {
            await adicionarCredito({
              clienteId: targetClienteId,
              tipo: 'entrada',
              valor: Math.abs(diferenca),
              descricao: `Estorno de pagamento ${numFormatado}`,
              origemId: osId,
              criadoPorNome: usuario?.nome
            });
          }
        } catch (err) {
          console.error('Erro ao sincronizar saldo em haver da OS:', err);
        }
      }

      if (ordemExistente) {
        mostrar('sucesso', 'Ordem de Serviço atualizada com sucesso!');
        setTimeout(() => navigate(`/ordens/${ordemExistente.id}`, { replace: true }), 1200);
      } else {
        mostrar('sucesso', 'Ordem de Serviço criada com sucesso!');
        setTimeout(() => navigate(`/ordens/${osId}`, { replace: true }), 1200);
      }
    } catch {
      mostrar('erro', 'Erro ao salvar a OS. Tente novamente.');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const temGuiaNaOS = (form.servicos as any[]).some(s => {
    const n = removerAcentos(s.nome.toLowerCase());
    return n.includes('guia') || n.includes('trafego');
  });

  const temIbamaNaOS = (form.servicos as any[]).some(s =>
    removerAcentos(s.nome.toLowerCase()).includes('ibama')
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">

      {clienteEncontrado?.acordoComercial && (
        <div className="card bg-amber-500/10 border-amber-500/30 p-4 rounded-xl flex gap-3 items-start animate-pulse-subtle">
          <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">Combinado Comercial Ativo</h4>
            <p className="text-sm text-amber-100/90 font-bold mt-1 whitespace-pre-wrap leading-relaxed">
              {clienteEncontrado.acordoComercial}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Dados do Cliente ── */}
      <div className="card">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-blue/30 text-brand-blue-light text-xs flex items-center justify-center font-bold">1</span>
          Dados do Cliente
        </h3>
        <div className="space-y-4">

          {/* Nome */}
          <div className="relative">
            <label className="label label-required">Nome Completo</label>
            <input id="campo-nome" type="text" className={`input uppercase ${erros.nomeCliente ? 'input-error' : ''}`}
              placeholder="Nome completo do cliente" value={form.nomeCliente}
              onChange={e => atualizar('nomeCliente', e.target.value)}
              onFocus={() => setFocoNome(true)}
              onBlur={() => setTimeout(() => setFocoNome(false), 200)}
            />
            {erros.nomeCliente && <p className="text-red-400 text-xs mt-1">{erros.nomeCliente}</p>}
            
            {/* Dropdown de Autocomplete */}
            {focoNome && clientesSugeridos.length > 0 && (
              <div className="absolute left-0 top-[70px] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-2 border-b border-brand-dark-5 bg-brand-dark-4">
                  <p className="text-xs text-brand-blue-light px-1 font-semibold flex items-center gap-1.5"><Users size={12}/> Sugestões da sua lista</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {clientesSugeridos.map(c => (
                    <div
                      key={c.id}
                      onClick={() => selecionarCliente(c)}
                      className="px-3 py-2 border-b border-brand-dark-5 hover:bg-brand-blue/20 cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-bold text-white">{c.nome}</p>
                      <p className="text-xs text-gray-400">CPF: {c.cpf} | Tel: {c.contato}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label label-required">Contato (Telefone / WhatsApp)</label>
              <input id="campo-contato" type="tel" className={`input ${erros.contato ? 'input-error' : ''}`}
                placeholder="(00) 00000-0000" value={form.contato}
                onChange={e => handleTelefone(e.target.value)} />
              {erros.contato && <p className="text-red-400 text-xs mt-1">{erros.contato}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label label-required">CPF</label>
                <input id="campo-cpf" type="text" className={`input ${erros.cpf ? 'input-error' : ''}`}
                  placeholder="000.000.000-00" value={form.cpf}
                  onChange={e => handleCPF(e.target.value)} />
                {erros.cpf && <p className="text-red-400 text-xs mt-1">{erros.cpf}</p>}
              </div>
              
              <div>
                <label className="label">Senha GOV.br</label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Senha"
                    value={form.senhaGov}
                    onChange={e => atualizar('senhaGov', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="label">Endereço Completo</label>
            <textarea 
              className="input uppercase h-20 py-2 resize-none" 
              placeholder="Rua, número, bairro, CEP, cidade-UF..." 
              value={form.endereco}
              onChange={e => atualizar('endereco', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Clube de Tiro e Caça Filiado</label>
            <div className="relative">
              <input type="text" className={`input uppercase ${erros.clubeFiliado ? 'input-error' : ''}`}
                value={form.clubeFiliadoText}
                onChange={e => atualizarClube(e.target.value)}
                placeholder={clubeParceiroNome ? `Ex: ${clubeParceiroNome}` : "Digite o clube de tiro (opcional)"}
                onFocus={() => setFocoClube(true)}
                onBlur={() => setTimeout(() => setFocoClube(false), 200)}
              />
              {erros.clubeFiliado && <p className="text-red-400 text-xs mt-1">{erros.clubeFiliado}</p>}

              {focoClube && (
                <div className="absolute left-0 top-[50px] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  <div className="max-h-40 overflow-y-auto">
                    {[
                      ...(clubeParceiroNome ? [clubeParceiroNome] : []),
                      ...clubesRegistrados.filter(c => !clubeParceiroNome || c.toUpperCase() !== clubeParceiroNome.toUpperCase())
                    ]
                      .filter(c => c.toUpperCase().includes(form.clubeFiliadoText.toUpperCase()) || form.clubeFiliadoText === '')
                      .map(clube => (
                        <div
                          key={clube}
                          onClick={() => atualizarClube(clube)}
                          className="px-4 py-2.5 border-b border-brand-dark-5 hover:bg-brand-blue/20 cursor-pointer transition-colors text-sm text-white font-medium"
                        >
                          {clube}
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Descrição do Serviço ── */}
      <div className="card">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-green/30 text-brand-green-light text-xs flex items-center justify-center font-bold">2</span>
          Descrição do Serviço
        </h3>

        {/* Dropdown de serviços + Atalho de Pacote */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeletorServico
              onSelecionar={adicionarServico}
              onSelecionarComboAquisicao={adicionarComboAquisicaoArma}
            />
            <button
              type="button"
              onClick={adicionarComboAquisicaoArma}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all"
              title="Adiciona automaticamente: 1. Autorização de Compra + 2. Solicitação de CRAF (Em Espera) + 3. Guia de Tráfego (Em Espera)"
            >
              <Sparkles size={13} className="text-indigo-400" />
              + Pacote Aquisição de Arma (Compra + CRAF + GT)
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
            💡 Ao selecionar <strong>Autorização de Compra</strong> ou o <strong>Pacote Aquisição</strong>, o sistema já abre as 3 etapas (Compra + CRAF + GT) automaticamente!
          </p>
          {erros.servicos && <p className="text-red-400 text-xs mt-1">{erros.servicos}</p>}
        </div>

        {/* Lista de Blocos de Serviço */}
        <div className="space-y-4">
            {form.servicos.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-brand-dark-5 rounded-xl">
                <List size={24} className="text-brand-dark-5 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhum serviço adicionado ainda.</p>
              </div>
            ) : (
              (form.servicos as any[]).map((serv: any, index: number) => {
                const nomeNorm = removerAcentos(serv.nome.toLowerCase());
                const sugereGuiaSecundaria =
                  !temGuiaNaOS &&
                  (nomeNorm.includes('transferencia') ||
                    nomeNorm.includes('endereco') ||
                    nomeNorm.includes('apostilamento'));
                const sugereComboIbama =
                  !temIbamaNaOS &&
                  (nomeNorm.includes('concessao') || nomeNorm.includes('cacador'));
                const isTransfAcervo = ehServicoTransferenciaAcervo(serv.nome);

                return (
                <div key={serv.id} className="relative bg-brand-dark-4 border border-brand-dark-5 p-4 rounded-xl animate-scale-up">
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => duplicarServico(serv.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-dark-5 hover:bg-brand-dark-3 text-gray-300 hover:text-cyan-300 border border-brand-dark-5 text-[11px] font-bold transition-all"
                      title="Duplicar este serviço (+1 arma/item)"
                    >
                      <Copy size={13} />
                      <span className="hidden sm:inline">Duplicar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removerServico(serv.id)}
                      className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-brand-dark-5 transition-colors"
                      title="Remover Serviço"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                {/* Cabeçalho do card: nome + valor + status */}
                <div className="flex flex-col gap-3 mb-3 pr-8">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="w-5 h-5 rounded-md bg-brand-dark-5 text-gray-400 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5 sm:mt-0">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white break-words leading-snug">{serv.nome}</h4>
                        {serv.etapaOrigemNome && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                            🔗 Etapa de: {serv.etapaOrigemNome}
                          </span>
                        )}
                        {isLaudoExame(serv.categoria || '', usuario?.dadosEmpresa?.categoriasServico) && (
                          <button
                            type="button"
                            onClick={() => atualizarPagoDireto(serv.id, !serv.pagoDireto)}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-all shrink-0 ${
                              serv.pagoDireto 
                                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                                : 'bg-brand-dark-5 text-gray-500 border border-transparent'
                            }`}
                            title={serv.pagoDireto ? "Pago diretamente ao colaborador/psicóloga" : "Alterar para pagamento direto"}
                          >
                            {serv.pagoDireto ? 'Pago Direto' : 'Pago p/ GCAC'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
                      <span className="text-xs text-gray-500 font-medium">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-20 text-right bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2 py-1 text-sm font-bold text-brand-green-light outline-none transition-colors"
                        value={serv.valor ?? 0}
                        onChange={e => atualizarValorServico(serv.id, parseFloat(e.target.value) || 0)}
                        title="Editar valor deste serviço"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0">Status Operacional:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_EXECUCAO_SERVICO.map((status: StatusExecucaoServico) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => atualizarStatusServicoExec(serv.id, status)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            serv.statusExecucao === status
                              ? classeStatusExecucao(status)
                              : 'bg-brand-dark-3 border-brand-dark-5 text-gray-500 hover:border-brand-metal'
                          }`}
                          title={status}
                        >
                          <span>{iconeStatusExecucao(status)}</span>
                          <span className={serv.statusExecucao === status ? 'inline' : 'hidden sm:inline'}>
                            {status === 'Iniciado — Montando Processo' ? 'Iniciado' : 
                             status === 'Aguardando Documentos' ? 'Ag. Docs' :
                             status === 'Protocolado — Ag. PF' ? 'Protocolado' :
                             status === 'Aguardando Etapa / Programado' ? 'Em Espera / Programado' :
                             status === 'Não Iniciado' ? 'Não Iniciado' : status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ⏸️ Configuração de Espera / Agendamento Futuro */}
                {serv.statusExecucao === 'Aguardando Etapa / Programado' && (
                  <div className="mb-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/25 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                        <CalendarClock size={14} className="text-indigo-400" />
                        Configuração de Espera / Execução Futura
                      </span>
                      <span className="text-[10px] text-indigo-200/80">
                        {serv.dataProgramada
                          ? `📅 Liberar na fila em: ${serv.dataProgramada.split('-').reverse().join('/')}`
                          : '🔗 Aguardando liberação da etapa anterior na PF'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        className="bg-brand-dark-3 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-400"
                        value={serv.dataProgramada || ''}
                        onChange={e => atualizarDataProgramadaServico(serv.id, e.target.value || undefined)}
                        title="Data programada para executar este serviço (opcional)"
                      />
                      <button
                        type="button"
                        onClick={() => atualizarDataProgramadaServico(serv.id, undefined)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          !serv.dataProgramada
                            ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50'
                            : 'bg-brand-dark-3 text-gray-400 border-brand-dark-5 hover:text-white'
                        }`}
                      >
                        Aguardar Etapa PF
                      </button>
                      <button
                        type="button"
                        onClick={() => definirDiasProgramados(serv.id, 15)}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all"
                      >
                        +15 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => definirDiasProgramados(serv.id, 30)}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all"
                      >
                        +30 dias (1 mês)
                      </button>
                      <button
                        type="button"
                        onClick={() => definirDiasProgramados(serv.id, 60)}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-brand-dark-3 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all"
                      >
                        +60 dias (2 meses)
                      </button>
                    </div>
                  </div>
                )}

                {/* ✨ Sugestões Contextuais de 2ª Etapa */}
                {(sugereGuiaSecundaria || sugereComboIbama) && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {sugereGuiaSecundaria && (
                      <button
                        type="button"
                        onClick={() => adicionarEtapaSugerida(['guia de trafego', 'emissao de gt'], 'GUIA DE TRÁFEGO', serv)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold transition-all"
                      >
                        <Plus size={12} />
                        Sugestão IA: Adicionar Guia de Tráfego (2ª Etapa em Espera)
                      </button>
                    )}
                    {sugereComboIbama && (
                      <button
                        type="button"
                        onClick={() => {
                          adicionarEtapaSugerida(['cr ibama', 'cadastro tecnico federal'], 'CADASTRO TÉCNICO FEDERAL - CR IBAMA', serv);
                          adicionarEtapaSugerida(['manejo de fauna', 'manejo'], 'MANEJO DE FAUNA (IBAMA)', serv);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-all"
                      >
                        <Layers size={12} />
                        Sugestão IA: Adicionar Combo IBAMA (CR + Manejo em Espera)
                      </button>
                    )}
                  </div>
                )}

                {/* Controle de GRU */}
                {(serv.exigeGRU === true || (serv.exigeGRU === undefined && (serv.taxaPF || 0) > 0)) && (
                  <>
                    {/* Protocolo Individual do Serviço */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      <label className="text-[10px] font-bold text-brand-blue-light uppercase tracking-widest flex items-center gap-1.5">
                        <List size={11} className="text-brand-blue" />
                        Nº do Protocolo (Opcional)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className="input bg-brand-dark-3 border-transparent focus:border-brand-blue/30 text-xs py-2 uppercase font-mono"
                          placeholder="Ex: 08795.000385/2026-65"
                          value={serv.protocolo || ''}
                          onChange={e => atualizarProtocoloServicoLocal(serv.id, e.target.value)}
                        />
                        <p className="text-[9px] text-gray-500 mt-1 italic">
                          Caso já possua o número do protocolo da PF ou Exército, preencha aqui para facilitar a consulta futura.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* ⚔️ Seção de Arma / Guia */}
                {exigeVinculoArma(serv.nome) && (
                  <div className="bg-brand-dark-3 p-3 rounded-lg border border-brand-dark-5 mb-3 space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                        ⚔️ Vincular Armamento
                      </label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none transition-colors"
                          value={serv.armaId || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const arma = [...armasCliente, ...novasArmas].find(a => a.id === val || a.tempId === val);
                            if (arma) {
                              atualizarArmaServico(serv.id, val, `${arma.fabricante} ${arma.modelo} (${arma.calibre})`);
                            } else {
                              atualizarArmaServico(serv.id, '', '');
                            }
                          }}
                        >
                          <option value="">Selecione uma arma...</option>
                          {armasCliente.map(a => (
                            <option key={a.id} value={a.id}>{a.fabricante} {a.modelo} - {a.calibre} (Série: {a.numeroSerie})</option>
                          ))}
                          {novasArmas.map(a => (
                            <option key={a.tempId} value={a.tempId}>*NOVA* {a.fabricante} {a.modelo} - {a.calibre} (Série: {a.numeroSerie})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => abrirModalCadastroArma(index)}
                          className="px-3 py-2 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue-light border border-brand-blue/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                        >
                          + Cadastrar
                        </button>
                      </div>
                    </div>

                    {/* Automação de Transferência entre Acervos */}
                    {isTransfAcervo && (
                      <div className="pt-2 border-t border-brand-dark-5/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          🎯 Novo Acervo de Destino (atualiza a arma ao concluir):
                        </label>
                        <div className="flex gap-1.5">
                          {(['Caça', 'Tiro Desportivo', 'Coleção'] as const).map(ac => (
                            <button
                              key={ac}
                              type="button"
                              onClick={() => atualizarAcervoDestinoServico(serv.id, ac)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                                (serv.acervoDestino || 'Caça') === ac
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                              }`}
                            >
                              {ac}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Automação de Guias / GT baseada no Acervo da Arma */}
                    {(() => {
                      const selectedArma = [...armasCliente, ...novasArmas].find(a => a.id === serv.armaId || a.tempId === serv.armaId);
                      const isGuia = serv.nome.toUpperCase().includes('GUIA') || serv.nome.toUpperCase().includes('GT');
                      if (!selectedArma || !isGuia) return null;

                      const acervo = selectedArma.acervo || 'Tiro Desportivo';
                      let opcoesTipos: string[] = [];
                      if (acervo === 'Caça') {
                        opcoesTipos = ['Guia de Caça', 'Guia de Treinamento de Caça', 'Guia de Manutenção'];
                      } else if (acervo === 'Tiro Desportivo') {
                        opcoesTipos = ['Guia de Treinamento', 'Guia de Competição', 'Guia de Manutenção'];
                      } else {
                        opcoesTipos = ['Guia de Exposição', 'Guia de Manutenção'];
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-brand-dark-5/50">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              Finalidade / Tipo da Guia
                            </label>
                            <select
                              className="w-full bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none"
                              value={serv.gtTipo || ''}
                              onChange={e => atualizarGtCamposServico(serv.id, e.target.value, serv.gtDestino || '')}
                            >
                              <option value="">Selecione...</option>
                              {opcoesTipos.map(o => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>

                          {serv.gtTipo && (
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                {serv.gtTipo.includes('Caça') && !serv.gtTipo.includes('Treinamento') 
                                  ? 'Município / Fazenda de Destino' 
                                  : serv.gtTipo.includes('Manutenção') 
                                    ? 'Armaria de Destino' 
                                    : 'Clube de Tiro de Destino'}
                              </label>

                              {((serv.gtTipo.includes('Caça') && !serv.gtTipo.includes('Treinamento')) || serv.gtTipo.includes('Manutenção')) ? (
                                <input
                                  type="text"
                                  className="w-full bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase"
                                  placeholder={serv.gtTipo.includes('Manutenção') ? "Ex: ARMARIA PRO GUNS" : "Ex: JATAÍ - GO"}
                                  value={serv.gtDestino || ''}
                                  onChange={e => atualizarGtCamposServico(serv.id, serv.gtTipo, e.target.value)}
                                />
                              ) : (
                                <>
                                  <select
                                    className="w-full bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none"
                                    value={serv.gtDestino || ''}
                                    onChange={e => atualizarGtCamposServico(serv.id, serv.gtTipo, e.target.value)}
                                  >
                                    <option value="">Selecione o clube...</option>
                                    {clubesRegistrados.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value="OUTRO">OUTRO CLUBE (DIGITAR...)</option>
                                  </select>

                                  {serv.gtDestino === 'OUTRO' && (
                                    <div className="flex gap-2 mt-2">
                                      <input
                                        type="text"
                                        className="flex-1 bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase outline-none"
                                        placeholder="Digite o nome do clube..."
                                        value={outroClubeTexto[serv.id] || ''}
                                        onChange={e => setOutroClubeTexto(prev => ({ ...prev, [serv.id]: e.target.value }))}
                                      />
                                      <button
                                        type="button"
                                        disabled={salvandoClube[serv.id]}
                                        onClick={async () => {
                                          const val = (outroClubeTexto[serv.id] || '').trim().toUpperCase();
                                          if (!val) {
                                            mostrar('erro', 'Por favor, digite o nome do clube.');
                                            return;
                                          }
                                          setSalvandoClube(prev => ({ ...prev, [serv.id]: true }));
                                          try {
                                            await criarOpcaoArma('clube', val);
                                            atualizarGtCamposServico(serv.id, serv.gtTipo, val);
                                            mostrar('sucesso', 'Novo clube salvo e selecionado com sucesso!');
                                            setOutroClubeTexto(prev => {
                                              const copy = { ...prev };
                                              delete copy[serv.id];
                                              return copy;
                                            });
                                          } catch (err: any) {
                                            if (err.message && err.message.includes('já está cadastrado')) {
                                              atualizarGtCamposServico(serv.id, serv.gtTipo, val);
                                              mostrar('sucesso', 'Clube já cadastrado, selecionado com sucesso!');
                                              setOutroClubeTexto(prev => {
                                                const copy = { ...prev };
                                                delete copy[serv.id];
                                                return copy;
                                              });
                                            } else {
                                              console.error('Erro ao salvar clube:', err);
                                              mostrar('erro', err.message || 'Erro ao salvar o clube.');
                                            }
                                          } finally {
                                            setSalvandoClube(prev => ({ ...prev, [serv.id]: false }));
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-brand-green hover:bg-brand-green/80 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 flex-shrink-0"
                                      >
                                        <Save size={12} />
                                        {salvandoClube[serv.id] ? 'Salvando...' : 'Salvar'}
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 📄 Anexo de Conclusão no Formulário */}
                {serv.statusExecucao === 'Concluído' && (
                  <div className="mt-2 p-3 bg-brand-dark-3 rounded-lg border border-brand-dark-5 space-y-2 mb-3">
                    <label className="text-[10px] font-bold text-brand-green uppercase tracking-wider block">
                      Anexar Documento de Conclusão (PDF ou Imagem)
                    </label>
                    {serv.arquivoUrl ? (
                      <div className="flex items-center justify-between text-xs bg-brand-dark-4 p-2 rounded border border-brand-dark-5">
                        <span className="text-gray-300 truncate">✓ Documento anexado</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              visualizarDocumentoBase64(serv.arquivoUrl!, `Documento-${serv.nome}`);
                            }}
                            className="text-brand-blue-light hover:underline font-bold"
                          >
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => atualizarArquivoServico(serv.id, '')}
                            className="text-red-400 hover:underline font-bold"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const base64 = await fileToBase64(file);
                              atualizarArquivoServico(serv.id, base64);
                            } catch (err) {
                              alert('Erro ao processar arquivo.');
                            }
                          }
                        }}
                        className="text-xs text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-brand-blue/20 file:text-brand-blue-light hover:file:bg-brand-blue/30 cursor-pointer"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <Users size={11} className="text-gray-400" />
                      Colaborador Responsável
                    </label>
                    <select
                      className="w-full bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none transition-colors"
                      value={serv.responsavelNome || ''}
                      onChange={e => atualizarResponsavelServico(serv.id, e.target.value)}
                    >
                      <option value="">Selecione o responsável</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.nome}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <DollarSign size={11} className="text-brand-green" />
                      Repasse / Comissão (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full pl-9 bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none transition-colors"
                        placeholder="0,00"
                        value={serv.valorRepasse ?? ''}
                        onChange={e => atualizarRepasseServico(serv.id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <textarea
                  className="input resize-none bg-brand-dark-3 border-transparent focus:border-brand-blue/30"
                  placeholder="Detalhes adicionais (opcional)... ex: num. de série, endereço..."
                  rows={2}
                  value={serv.detalhes}
                  onChange={e => atualizarDetalhesServico(serv.id, e.target.value)}
                />
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 3. Valor e Pagamento ── */}
      <div className="card">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-yellow-500/30 text-yellow-400 text-xs flex items-center justify-center font-bold">3</span>
          Valor e Pagamento
        </h3>
        {/* Resumo de Custos Informacional */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="p-2 bg-brand-dark-3 rounded border border-brand-dark-5">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Honorários (Caixa)</p>
            <p className="text-sm font-bold text-white">{formatarMoeda(form.servicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0))}</p>
          </div>
          <div className="p-2 bg-brand-dark-3 rounded border border-brand-dark-5">
            <p className="text-[10px] font-bold text-amber-500 uppercase">Laudos (Terceiros)</p>
            <p className="text-sm font-bold text-white">{formatarMoeda(form.servicos.filter((s: any) => s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0))}</p>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase text-center py-1 bg-brand-dark-4 rounded mb-2">
            Total Geral (O que o cliente paga no total): {formatarMoeda(form.servicos.reduce((acc: number, s: any) => acc + (s.valor || 0), 0))}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Valor Bruto (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
              <input id="campo-valor" type="text" inputMode="decimal"
                className={`input pl-9 ${erros.valor ? 'input-error' : ''}`}
                placeholder="0,00" value={form.valorTexto}
                onChange={e => handleValor(e.target.value)}
                disabled={form.status === 'Gratuidade'} />
            </div>
            {erros.valor && <p className="text-red-400 text-xs mt-1">{erros.valor}</p>}
          </div>
          <div>
            <label className="label">Desconto (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
              <input id="campo-desconto" type="text" inputMode="decimal"
                className="input pl-9"
                placeholder="0,00" value={form.descontoTexto}
                onChange={e => handleDesconto(e.target.value)}
                disabled={form.status === 'Gratuidade'} />
            </div>
          </div>
          <div>
            <label className="label">Valor Pago (Saldo: {formatarMoeda(form.valor - (form.desconto || 0) - form.valorPago)})</label>
            <div className="bg-brand-dark-3 p-3 rounded-lg border border-brand-dark-5 flex justify-between items-center">
              <span className="text-brand-green font-bold text-lg">{formatarMoeda(form.valorPago)}</span>
              {(form.valor - (form.desconto || 0)) > form.valorPago && form.status !== 'Gratuidade' && (
                <span className="text-red-400 text-xs font-bold animate-pulse">PENDENTE: {formatarMoeda(form.valor - (form.desconto || 0) - form.valorPago)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Gerenciamento de Pagamentos (Apenas na Edição ou se já tiver valor) */}
        {form.valor > 0 && form.status !== 'Gratuidade' && (
          <div className="space-y-3 mb-6 p-4 bg-brand-dark-3 rounded-xl border border-brand-dark-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={14} className="text-brand-green" />
                Histórico de Pagamentos
              </h4>
              {clienteEncontrado && (saldoCredito + creditoJaAbatidoNestaOS) > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <Wallet size={12} />
                    Saldo em Haver: {formatarMoeda(Math.max(0, (saldoCredito + creditoJaAbatidoNestaOS) - form.historicoPagamentos.filter(p => p.metodo === 'Crédito de Cliente').reduce((acc, p) => acc + p.valor, 0)))}
                  </span>
                  {Math.max(0, (form.valor - (form.desconto || 0)) - form.valorPago) > 0 &&
                    Math.max(0, (saldoCredito + creditoJaAbatidoNestaOS) - form.historicoPagamentos.filter(p => p.metodo === 'Crédito de Cliente').reduce((acc, p) => acc + p.valor, 0)) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const valorLiquidoOS = Math.max(0, form.valor - (form.desconto || 0));
                        const pendenteOS = Math.max(0, valorLiquidoOS - form.valorPago);
                        const creditoUsadoNoForm = form.historicoPagamentos
                          .filter(p => p.metodo === 'Crédito de Cliente')
                          .reduce((acc, p) => acc + p.valor, 0);
                        const haverDisponivel = Math.max(0, (saldoCredito + creditoJaAbatidoNestaOS) - creditoUsadoNoForm);
                        const valorAbater = Math.min(pendenteOS, haverDisponivel);
                        if (valorAbater <= 0) return;

                        const novoP = {
                          id: crypto.randomUUID(),
                          valor: valorAbater,
                          metodo: 'Crédito de Cliente' as FormaPagamento,
                          data: dataPagamentoInput ? formatarParaISO(dataPagamentoInput) : new Date().toISOString()
                        };
                        const novoHist = [...form.historicoPagamentos, novoP];
                        const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                        atualizar('historicoPagamentos', novoHist);
                        atualizar('valorPago', novoTotal);
                        atualizar('formaPagamento', 'Crédito de Cliente');
                        if (novoTotal >= valorLiquidoOS) atualizar('status', 'Pago');
                        else atualizar('status', 'Parcialmente Pago');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-brand-green text-white hover:bg-brand-green-light transition-colors"
                    >
                      Usar Saldo em Haver
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {form.historicoPagamentos.length > 0 ? (
              <div className="space-y-2">
                {form.historicoPagamentos.map((p, idx) => (
                  <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2 bg-brand-dark-2 rounded border border-brand-dark-5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={extrairDataYMD(p.data)}
                        onChange={e => {
                          const novaData = e.target.value;
                          if (!novaData) return;
                          const novoIso = formatarParaISO(novaData);
                          const novoHist = form.historicoPagamentos.map((item, i) =>
                            i === idx ? { ...item, data: novoIso } : item
                          );
                          atualizar('historicoPagamentos', novoHist);
                        }}
                        className="bg-brand-dark-3 border border-brand-dark-5 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-brand-blue"
                        title="Alterar data do pagamento"
                      />
                      <select
                        value={p.metodo}
                        onChange={e => {
                          const novoMetodo = e.target.value as FormaPagamento;
                          if (novoMetodo === 'Crédito de Cliente') {
                            const outrosCreditos = form.historicoPagamentos
                              .filter((item, i) => i !== idx && item.metodo === 'Crédito de Cliente')
                              .reduce((acc, item) => acc + item.valor, 0);
                            const disponivel = (saldoCredito + creditoJaAbatidoNestaOS) - outrosCreditos;
                            if (p.valor > disponivel) {
                              mostrar('erro', `Saldo em Haver insuficiente (${formatarMoeda(Math.max(0, disponivel))} disponível).`);
                              return;
                            }
                          }
                          const novoHist = form.historicoPagamentos.map((item, i) =>
                            i === idx ? { ...item, metodo: novoMetodo } : item
                          );
                          atualizar('historicoPagamentos', novoHist);
                          atualizar('formaPagamento', novoMetodo);
                        }}
                        className="bg-brand-dark-3 border border-brand-dark-5 rounded px-2 py-1 text-xs font-bold text-white outline-none focus:border-brand-blue"
                      >
                        {FORMAS_PAGAMENTO.filter(f => f !== 'Pendente').map(f => (
                          <option key={f} value={f}>
                            {f === 'Crédito de Cliente' ? 'Crédito de Cliente (Saldo em Haver)' : f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-brand-green">{formatarMoeda(p.valor)}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const novoHist = form.historicoPagamentos.filter((_, i) => i !== idx);
                          const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                          const valorLiquidoOS = Math.max(0, form.valor - (form.desconto || 0));
                          atualizar('historicoPagamentos', novoHist);
                          atualizar('valorPago', novoTotal);
                          atualizar('formaPagamento', novoHist.length > 0 ? novoHist[novoHist.length - 1].metodo : 'Pendente');
                          if (novoTotal >= valorLiquidoOS && valorLiquidoOS > 0) atualizar('status', 'Pago');
                          else if (novoTotal > 0) atualizar('status', 'Parcialmente Pago');
                          else atualizar('status', 'Aguardando Pagamento');
                        }}
                        className="text-red-400 hover:text-red-300"
                        title="Remover pagamento"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 italic">Nenhum pagamento registrado ainda.</p>
            )}

            <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-2 border-t border-brand-dark-5 items-center">
              <div className="flex-1 min-w-[120px]">
                <input 
                  type="number" 
                  id="add-pag-valor"
                  className="input py-2 text-sm w-full" 
                  placeholder="Valor R$" 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const metodo = (document.getElementById('add-pag-metodo') as HTMLSelectElement).value as FormaPagamento;
                      const valorLiquidoOS = Math.max(0, form.valor - (form.desconto || 0));
                      const pendenteOS = Math.max(0, valorLiquidoOS - form.valorPago);
                      const val = (input && input.value !== '') ? parseFloat(input.value) : pendenteOS;
                      if (val > 0) {
                        if (metodo === 'Crédito de Cliente') {
                          const creditoUsadoNoForm = form.historicoPagamentos
                            .filter(p => p.metodo === 'Crédito de Cliente')
                            .reduce((acc, p) => acc + p.valor, 0);
                          const disponivel = (saldoCredito + creditoJaAbatidoNestaOS) - creditoUsadoNoForm;
                          if (val > disponivel) {
                            mostrar('erro', `Saldo em Haver insuficiente (${formatarMoeda(Math.max(0, disponivel))} disponível).`);
                            return;
                          }
                        }
                        const dataFinal = dataPagamentoInput ? formatarParaISO(dataPagamentoInput) : new Date().toISOString();
                        const novoP = { id: crypto.randomUUID(), valor: val, metodo, data: dataFinal };
                        const novoHist = [...form.historicoPagamentos, novoP];
                        const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                        atualizar('historicoPagamentos', novoHist);
                        atualizar('valorPago', novoTotal);
                        atualizar('formaPagamento', metodo);
                        if (novoTotal >= valorLiquidoOS) atualizar('status', 'Pago');
                        else atualizar('status', 'Parcialmente Pago');
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>
              <div className="w-full sm:w-44">
                <select id="add-pag-metodo" className="select py-2 text-sm w-full">
                  {FORMAS_PAGAMENTO.filter(f => f !== 'Pendente').map(f => (
                    <option key={f} value={f}>
                      {f === 'Crédito de Cliente' ? 'Crédito de Cliente (Saldo em Haver)' : f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-40">
                <input
                  type="date"
                  id="add-pag-data"
                  value={dataPagamentoInput}
                  onChange={e => setDataPagamentoInput(e.target.value)}
                  className="input py-2 text-sm w-full text-white cursor-pointer"
                  title="Data do Pagamento"
                />
              </div>
              <button 
                type="button"
                onClick={() => {
                  const input = document.getElementById('add-pag-valor') as HTMLInputElement;
                  const metodo = (document.getElementById('add-pag-metodo') as HTMLSelectElement).value as FormaPagamento;
                  const valorLiquidoOS = Math.max(0, form.valor - (form.desconto || 0));
                  const pendenteOS = Math.max(0, valorLiquidoOS - form.valorPago);
                  const val = (input && input.value !== '') ? parseFloat(input.value) : pendenteOS;
                  if (val > 0) {
                    if (metodo === 'Crédito de Cliente') {
                      const creditoUsadoNoForm = form.historicoPagamentos
                        .filter(p => p.metodo === 'Crédito de Cliente')
                        .reduce((acc, p) => acc + p.valor, 0);
                      const disponivel = (saldoCredito + creditoJaAbatidoNestaOS) - creditoUsadoNoForm;
                      if (val > disponivel) {
                        mostrar('erro', `Saldo em Haver insuficiente (${formatarMoeda(Math.max(0, disponivel))} disponível).`);
                        return;
                      }
                    }
                    const dataFinal = dataPagamentoInput ? formatarParaISO(dataPagamentoInput) : new Date().toISOString();
                    const novoP = { id: crypto.randomUUID(), valor: val, metodo, data: dataFinal };
                    const novoHist = [...form.historicoPagamentos, novoP];
                    const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                    atualizar('historicoPagamentos', novoHist);
                    atualizar('valorPago', novoTotal);
                    atualizar('formaPagamento', metodo);
                    if (novoTotal >= valorLiquidoOS) atualizar('status', 'Pago');
                    else atualizar('status', 'Parcialmente Pago');
                    input.value = '';
                  }
                }}
                className="btn-primary px-3 py-0 h-10 shrink-0 font-bold"
                title="Adicionar Pagamento"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Status de pagamento */}
        <div>
          <label className="label">Status do Pagamento</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUS_OS.map((s: any) => (
              <button key={s} type="button"
                onClick={() => {
                  if (s === 'Aguardando Pagamento') {
                    atualizar('status', s);
                    atualizar('valorPago', 0);
                    atualizar('historicoPagamentos', []);
                    atualizar('formaPagamento', 'Pendente');
                    return;
                  }
                  if (s === 'Pago') {
                    const valorLiquidoOS = Math.max(0, form.valor - (form.desconto || 0));
                    const selectEl = document.getElementById('add-pag-metodo') as HTMLSelectElement | null;
                    const metodoSelecionado = (selectEl?.value as FormaPagamento) || (form.formaPagamento !== 'Pendente' ? form.formaPagamento : 'PIX');

                    if (form.historicoPagamentos.length === 0 && valorLiquidoOS > 0) {
                      if (metodoSelecionado === 'Crédito de Cliente') {
                        const disponivel = saldoCredito + creditoJaAbatidoNestaOS;
                        if (valorLiquidoOS > disponivel) {
                          mostrar('erro', `Saldo em Haver insuficiente (${formatarMoeda(Math.max(0, disponivel))} disponível).`);
                          return;
                        }
                      }
                      const dataFinal = dataPagamentoInput ? formatarParaISO(dataPagamentoInput) : new Date().toISOString();
                      atualizar('historicoPagamentos', [{ 
                        id: crypto.randomUUID(), 
                        valor: valorLiquidoOS, 
                        metodo: metodoSelecionado, 
                        data: dataFinal 
                      }]);
                      atualizar('formaPagamento', metodoSelecionado);
                    }
                    atualizar('valorPago', valorLiquidoOS);
                    atualizar('status', s);
                    return;
                  }
                  if (s === 'Gratuidade') {
                    atualizar('status', s);
                    atualizar('valor', 0);
                    atualizar('valorTexto', '');
                    atualizar('valorPago', 0);
                    atualizar('historicoPagamentos', []);
                    atualizar('formaPagamento', 'A Combinar');
                    return;
                  }
                  atualizar('status', s);
                }}
                className={`py-2.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                  form.status === s
                    ? ESTILO_STATUS[s as StatusOS]
                    : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-brand-metal'
                }`}>
                {s}
              </button>
            ))}
          </div>
          {form.status === 'Gratuidade' && (
            <p className="text-xs text-brand-blue-light mt-2">
              💡 Gratuidade selecionada — valor zerado automaticamente
            </p>
          )}
        </div>
      </div>

      {/* ── 4. Canal de Atendimento ── */}
      <div className="card">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-metal/30 text-brand-metal-light text-xs flex items-center justify-center font-bold">4</span>
          Canal de Atendimento
          <span className="text-xs text-gray-500 font-normal ml-1">— como o cliente entrou em contato?</span>
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {CANAIS_ATENDIMENTO.map((canal: string) => (
            <button key={canal} type="button"
              onClick={() => atualizar('canalAtendimento', form.canalAtendimento === canal ? null : canal as CanalAtendimento)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                form.canalAtendimento === canal
                  ? canal === 'WhatsApp'   ? 'bg-green-500/30 border-green-500/60 text-green-300'
                  : canal === 'Presencial' ? 'bg-brand-blue/30 border-brand-blue/60 text-brand-blue-light'
                  : canal === 'Ligação'    ? 'bg-purple-500/30 border-purple-500/60 text-purple-300'
                  : canal === 'E-mail'     ? 'bg-orange-500/30 border-orange-500/60 text-orange-300'
                  :                         'bg-brand-metal/30 border-brand-metal/60 text-gray-300'
                  : 'bg-brand-dark-4 border-brand-dark-5 text-gray-400 hover:border-brand-metal hover:text-gray-200'
              }`}>
              {ICONES_CANAL[canal as CanalAtendimento]}
              {canal}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Observação do contato <span className="text-gray-500 font-normal text-xs">(opcional)</span></label>
          <input type="text" className="input"
            placeholder={
              form.canalAtendimento === 'WhatsApp'   ? 'Ex: confirmou via grupo, às 14h...'
            : form.canalAtendimento === 'Presencial' ? 'Ex: veio ao escritório, assinou contrato...'
            : form.canalAtendimento === 'Ligação'    ? 'Ex: ligou às 10h, confirmou o serviço...'
            : form.canalAtendimento === 'E-mail'     ? 'Ex: enviou documentos por e-mail...'
            : 'Detalhes sobre como o contato foi realizado...'
            }
            value={form.observacaoContato}
            onChange={e => atualizar('observacaoContato', e.target.value)} />
        </div>

        <div className="mt-4">
          <label className="label">Observações gerais <span className="text-gray-500 font-normal text-xs">(opcional)</span></label>
          <textarea className="input resize-none" placeholder="Outras anotações relevantes para esta OS..."
            rows={3} value={form.observacoes}
            onChange={e => atualizar('observacoes', e.target.value)} />
        </div>
      </div>

      {/* ── Botões ── */}
      <div className="flex gap-3 pb-4">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1">
          <X size={16} />Cancelar
        </button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1">
          <Save size={16} />
          {salvando ? 'Salvando...' : ordemExistente ? 'Atualizar OS' : 'Criar OS'}
        </button>
      </div>

      <Notificacao {...notif} onFechar={fechar} />

      {modalArmaAberto && (
        <ModalArma
          onFechar={() => {
            setModalArmaAberto(false);
            setServicoIndexParaArma(null);
          }}
          onSalvar={async (armaData) => {
            try {
              const armaId = armaData.id || uuidv4();
              const novaArmaObj = {
                ...armaData,
                id: armaId,
                tipo: armaData.tipo?.trim(),
                modelo: armaData.modelo?.trim().toUpperCase(),
                calibre: armaData.calibre?.trim().toUpperCase(),
                fabricante: armaData.fabricante?.trim().toUpperCase(),
                numeroSerie: armaData.numeroSerie?.trim().toUpperCase(),
                numeroSigma: armaData.numeroSigma?.trim().toUpperCase(),
                acervo: armaData.acervo,
                vencimentoCraf: armaData.vencimentoCraf,
                crafEmRenovacao: armaData.crafEmRenovacao
              };

              const tempArma = { ...novaArmaObj, tempId: armaId };

              if (clienteEncontrado?.id) {
                await salvarArma({
                  ...novaArmaObj,
                  clienteId: clienteEncontrado.id
                }, clienteEncontrado.empresaId);
                
                const lista = await buscarArmas(clienteEncontrado.id, clienteEncontrado.empresaId);
                setArmasCliente(lista);
              } else {
                setNovasArmas(prev => [...prev, tempArma]);
              }

              if (servicoIndexParaArma !== null) {
                const serv = form.servicos[servicoIndexParaArma];
                atualizarArmaServico(serv.id, armaId, `${novaArmaObj.fabricante} ${novaArmaObj.modelo} (${novaArmaObj.calibre})`);
              }

              setModalArmaAberto(false);
              setServicoIndexParaArma(null);
              mostrar('sucesso', 'Armamento registrado com sucesso!');
            } catch (err: any) {
              console.error(err);
              mostrar('erro', 'Erro ao registrar arma: ' + (err.message || 'Verifique os dados informados.'));
            }
          }}
        />
      )}
    </form>
  );
}
