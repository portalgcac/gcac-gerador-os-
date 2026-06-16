import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Save, X, Eye, EyeOff, MessageCircle, Users, Phone, Search,
  Mail, HelpCircle, CheckCircle, ChevronDown, List, Trash2, DollarSign,
  AlertTriangle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  OrdemDeServico, STATUS_OS, FORMAS_PAGAMENTO, CANAIS_ATENDIMENTO,
  FormaPagamento, StatusOS, CanalAtendimento, ServicoConfig, StatusExecucaoServico,
  STATUS_EXECUCAO_SERVICO, PagamentoItem
} from '../../types';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { useServicos } from '../../context/ServicosContext';
import { Cliente } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { classeStatusExecucao, iconeStatusExecucao, formatarMoeda, removerAcentos } from '../../utils/formatters';
import { supabase } from '../../db/supabase';
import { useAuth } from '../../context/AuthContext';

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
function SeletorServico({ onSelecionar }: { onSelecionar: (s: ServicoConfig) => void }) {
  const navigate = useNavigate();
  const { servicos } = useServicos();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setBusca('');
    }
  }, [aberto]);

  const handleSelecionar = (servico: ServicoConfig) => {
    onSelecionar(servico);
  };

  const servicosFiltrados = servicos.filter(s => 
    removerAcentos(s.nome.toLowerCase()).includes(removerAcentos(busca.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="btn-selecionar-servico"
        onClick={() => setAberto(a => !a)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-dark-5 border border-brand-dark-5 hover:border-brand-blue/40 hover:bg-brand-blue/10 text-gray-300 hover:text-brand-blue-light text-sm font-medium transition-all"
      >
        <List size={14} />
        Selecionar serviço
        <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-brand-dark-2 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-brand-dark-5 bg-brand-dark-3">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                ref={inputRef}
                type="text"
                className="w-full bg-brand-dark-4 border border-brand-dark-5 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                placeholder="Pesquisar serviço..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {servicosFiltrados.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  {busca ? 'Nenhum serviço encontrado.' : 'Nenhum serviço cadastrado.'}
                </p>
                {!busca && (
                  <button
                    type="button"
                    onClick={() => navigate('/configuracoes')}
                    className="text-xs text-brand-blue-light hover:underline"
                  >
                    Cadastrar em Configurações
                  </button>
                )}
              </div>
            ) : (
              servicosFiltrados.map((servico) => (
                <button
                  key={servico.id}
                  type="button"
                  onClick={() => handleSelecionar(servico)}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-brand-blue/20 hover:text-white transition-colors border-b border-brand-dark-5/50 last:border-0"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="pr-2 leading-relaxed">{servico.nome}</span>
                    <span className="text-[10px] bg-brand-dark-4 px-1.5 py-0.5 rounded text-brand-green flex-shrink-0 mt-0.5">
                      R$ {servico.valorPadrao.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulário Principal ─────────────────────────────────────────────────
export function FormularioOrdem({ ordemExistente }: FormularioOrdemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { criarOrdem, atualizarOrdem } = useOrdens();
  const { clientes, criarCliente, atualizarCliente, buscarClientePorNomeExato, clubesRegistrados } = useClientes();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const { usuario } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [focoNome, setFocoNome] = useState(false);
  const [focoClube, setFocoClube] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

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
                         ? (ordemExistente.servicos || []).filter(s => !s.pagoDireto && s.categoria !== 'Laudo').reduce((acc: number, s: any) => acc + (s.valor || 0), 0)
                         : 0,
    valorTexto:        ordemExistente 
                         ? String((ordemExistente.servicos || []).filter(s => !s.pagoDireto && s.categoria !== 'Laudo').reduce((acc: number, s: any) => acc + (s.valor || 0), 0)).replace('.', ',') 
                         : '',
    formaPagamento:    (ordemExistente?.formaPagamento   ?? 'Pendente') as FormaPagamento,
    status:            (ordemExistente?.status           ?? 'Aguardando Pagamento') as StatusOS,
    canalAtendimento:  (ordemExistente?.canalAtendimento ?? null) as CanalAtendimento | null,
    observacaoContato: ordemExistente?.observacaoContato ?? '',
    observacoes:       ordemExistente?.observacoes       ?? '',
    valorPago:         ordemExistente?.valorPago ?? 0,
    historicoPagamentos: ordemExistente?.historicoPagamentos ?? [] as PagamentoItem[],
  });

  const clienteEncontrado = clientes.find(c => 
    (c.cpf && form.cpf && c.cpf.replace(/\D/g, '') === form.cpf.replace(/\D/g, '')) ||
    (c.nome && form.nomeCliente && c.nome.trim().toUpperCase() === form.nomeCliente.trim().toUpperCase())
  );

  // Preenchimento automático vindo do perfil do cliente
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: Cliente };
    if (state?.clientePreDefinido && !ordemExistente) {
      const c = state.clientePreDefinido;
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
      // Limpar o estado para não repetir o preenchimento se o usuário recarregar
      window.history.replaceState({}, document.title);
    }
  }, [location, ordemExistente, clubeParceiroNome]);

  // Se estiver editando uma ordem existente, garantir que os dados do cliente reflitam o perfil atual do cadastro
  useEffect(() => {
    if (ordemExistente && clientes.length > 0) {
      const c = clientes.find(cli => cli.cpf === ordemExistente.cpf);
      if (c) {
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
    const limpo = v.replace(/[^\d,]/g, '').replace(',', '.');
    atualizar('valorTexto', v.replace(/[^\d,]/g, ''));
    atualizar('valor', parseFloat(limpo) || 0);
  };

  const adicionarServico = (serv: ServicoConfig) => {
    // Escolhe o valor baseado no status de filiado
    const valorAplicado = form.filiadoProTiro ? (serv.valorFiliado || serv.valorPadrao) : serv.valorPadrao;
    const isLaudo = serv.categoria === 'Laudo';

    const novosServicos = [
      ...form.servicos,
      { 
        id: uuidv4(), 
        nome: serv.nome, 
        detalhes: '', 
        taxaPF: serv.taxaPF, 
        exigeGRU: serv.exigeGRU,
        valor: valorAplicado, 
        statusExecucao: 'Não Iniciado' as StatusExecucaoServico, 
        categoria: serv.categoria || 'Honorário',
        pagoDireto: isLaudo
      }
    ];
    
    // Auto-preenchimento: recalcula o total somando apenas serviços que NÃO são pagos direto
    const novoValor = novosServicos.filter((s: any) => !s.pagoDireto).reduce((acc: number, s: any) => acc + (s.valor || 0), 0);
    
    setForm(f => ({
      ...f,
      servicos: novosServicos,
      valor: novoValor,
      valorTexto: novoValor.toFixed(2).replace('.', ',')
    }));
    setErros(e => { const n = { ...e }; delete n['servicos']; delete n['valor']; return n; });
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
      servicos: (f.servicos as any[]).map((s: any) => s.id === id ? { ...s, statusExecucao: novoStatus } : s)
    }));
  };

  const atualizarProtocoloServicoLocal = (id: string, protocolo: string) => {
    setForm(f => ({
      ...f,
      servicos: (f.servicos as any[]).map((s: any) => s.id === id ? { ...s, protocolo } : s)
    }));
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
      const dados = {
        nomeCliente:       form.nomeCliente.trim().toUpperCase(),
        contato:           form.contato.trim(),
        cpf:               form.cpf.trim(),
        senhaGov:          form.senhaGov.trim(),
        filiadoProTiro:    form.filiadoProTiro,
        clubeFiliado:      form.filiadoProTiro ? '' : form.clubeFiliado.trim().toUpperCase(),
        endereco:          form.endereco.trim().toUpperCase(),
        servicos:          (form.servicos as any[]).map((s: any) => ({ 
          ...s, 
          detalhes: (s.detalhes || '').trim(),
          protocolo: (s.protocolo || '').trim().toUpperCase()
        })),
        valor:             form.valor,
        taxaPFTotal:       (form.servicos as any[]).reduce((acc: number, s: any) => acc + (s.taxaPF || 0), 0),
        formaPagamento:    form.formaPagamento,
        status:            form.status,
        canalAtendimento:  form.canalAtendimento,
        observacaoContato: form.observacaoContato.trim(),
        observacoes:       form.observacoes.trim(),
        valorPago:         form.valorPago,
        historicoPagamentos: form.historicoPagamentos,
      };

      // Salvamento silencioso do Cliente na agenda
      try {
        const clienteExistente = await buscarClientePorNomeExato(dados.nomeCliente);
        const payloadCli = {
          nome: dados.nomeCliente,
          cpf: dados.cpf,
          contato: dados.contato,
          senhaGov: dados.senhaGov,
          filiadoProTiro: dados.filiadoProTiro,
          clubeFiliado: dados.clubeFiliado,
          endereco: dados.endereco,
          observacoes: ''
        };
        if (clienteExistente) {
          await atualizarCliente(clienteExistente.id, payloadCli);
        } else {
          await criarCliente(payloadCli);
        }
      } catch (err) {
        console.error('Erro silencioso ao salvar/atualizar cliente na agenda', err);
      }

      if (ordemExistente) {
        await atualizarOrdem(ordemExistente.id, dados);
        mostrar('sucesso', 'Ordem de Serviço atualizada com sucesso!');
        setTimeout(() => navigate(`/ordens/${ordemExistente.id}`, { replace: true }), 1200);
      } else {
        const id = await criarOrdem(dados);
        mostrar('sucesso', 'Ordem de Serviço criada com sucesso!');
        setTimeout(() => navigate(`/ordens/${id}`, { replace: true }), 1200);
      }
    } catch {
      mostrar('erro', 'Erro ao salvar a OS. Tente novamente.');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

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



        {/* Dropdown de serviços */}
        <div className="mb-4">
          <SeletorServico onSelecionar={adicionarServico} />
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">💡 Clique para puxar o bloquinho (aceita múltiplos cliques seguidos)</p>
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
              (form.servicos as any[]).map((serv: any, index: number) => (
                <div key={serv.id} className="relative bg-brand-dark-4 border border-brand-dark-5 p-4 rounded-xl animate-scale-up">
                  <button
                    type="button"
                    onClick={() => removerServico(serv.id)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors"
                  title="Remover Serviço"
                >
                  <Trash2 size={16} />
                </button>

                {/* Cabeçalho do card: nome + valor + status */}
                <div className="flex flex-col gap-3 mb-3 pr-8">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-md bg-brand-dark-5 text-gray-400 text-xs flex items-center justify-center font-bold flex-shrink-0">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{serv.nome}</h4>
                        {serv.categoria === 'Laudo' && (
                          <button
                            type="button"
                            onClick={() => atualizarPagoDireto(serv.id, !serv.pagoDireto)}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-all ${
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
                    <div className="flex items-center gap-1.5 flex-shrink-0">
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

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Status Operacional:</label>
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
                             status === 'Não Iniciado' ? 'Não Iniciado' : status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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
            ))
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Valor Final (R$)</label>
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
            <label className="label">Valor Pago (Saldo: {formatarMoeda(form.valor - form.valorPago)})</label>
            <div className="bg-brand-dark-3 p-3 rounded-lg border border-brand-dark-5 flex justify-between items-center">
              <span className="text-brand-green font-bold text-lg">{formatarMoeda(form.valorPago)}</span>
              {form.valor > form.valorPago && form.status !== 'Gratuidade' && (
                <span className="text-red-400 text-xs font-bold animate-pulse">PENDENTE: {formatarMoeda(form.valor - form.valorPago)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Gerenciamento de Pagamentos (Apenas na Edição ou se já tiver valor) */}
        {form.valor > 0 && form.status !== 'Gratuidade' && (
          <div className="space-y-3 mb-6 p-4 bg-brand-dark-3 rounded-xl border border-brand-dark-5">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <DollarSign size={14} className="text-brand-green" />
              Histórico de Pagamentos
            </h4>
            
            {form.historicoPagamentos.length > 0 ? (
              <div className="space-y-2">
                {form.historicoPagamentos.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-brand-dark-2 rounded border border-brand-dark-5 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                      <span className="font-bold text-white">{p.metodo}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-brand-green">{formatarMoeda(p.valor)}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const novoHist = form.historicoPagamentos.filter((_, i) => i !== idx);
                          const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                          atualizar('historicoPagamentos', novoHist);
                          atualizar('valorPago', novoTotal);
                          // Atualiza status se necessário
                          if (novoTotal >= form.valor) atualizar('status', 'Pago');
                          else if (novoTotal > 0) atualizar('status', 'Parcialmente Pago');
                          else atualizar('status', 'Aguardando Pagamento');
                        }}
                        className="text-red-400 hover:text-red-300"
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

            <div className="flex gap-2 pt-2 border-t border-brand-dark-5">
              <div className="flex-1">
                <input 
                  type="number" 
                  id="add-pag-valor"
                  className="input py-2 text-sm" 
                  placeholder="Valor R$" 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const val = parseFloat(input.value);
                      const metodo = (document.getElementById('add-pag-metodo') as HTMLSelectElement).value as FormaPagamento;
                      if (val > 0) {
                        const novoP = { id: crypto.randomUUID(), valor: val, metodo, data: new Date().toISOString() };
                        const novoHist = [...form.historicoPagamentos, novoP];
                        const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                        atualizar('historicoPagamentos', novoHist);
                        atualizar('valorPago', novoTotal);
                        if (novoTotal >= form.valor) atualizar('status', 'Pago');
                        else atualizar('status', 'Parcialmente Pago');
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>
              <select id="add-pag-metodo" className="select py-2 text-sm w-32">
                {FORMAS_PAGAMENTO.filter(f => f !== 'Pendente').map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button 
                type="button"
                onClick={() => {
                  const input = document.getElementById('add-pag-valor') as HTMLInputElement;
                  const val = parseFloat(input.value);
                  const metodo = (document.getElementById('add-pag-metodo') as HTMLSelectElement).value as FormaPagamento;
                  if (val > 0) {
                    const novoP = { id: crypto.randomUUID(), valor: val, metodo, data: new Date().toISOString() };
                    const novoHist = [...form.historicoPagamentos, novoP];
                    const novoTotal = novoHist.reduce((acc, curr) => acc + curr.valor, 0);
                    atualizar('historicoPagamentos', novoHist);
                    atualizar('valorPago', novoTotal);
                    if (novoTotal >= form.valor) atualizar('status', 'Pago');
                    else atualizar('status', 'Parcialmente Pago');
                    input.value = '';
                  }
                }}
                className="btn-primary px-3 py-0 h-10"
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
                  atualizar('status', s);
                  if (s === 'Aguardando Pagamento') {
                    atualizar('valorPago', 0);
                    atualizar('historicoPagamentos', []);
                  }
                  if (s === 'Pago') {
                    atualizar('valorPago', form.valor);
                    // Se não tiver histórico, cria um único
                    if (form.historicoPagamentos.length === 0 && form.valor > 0) {
                      atualizar('historicoPagamentos', [{ 
                        id: crypto.randomUUID(), 
                        valor: form.valor, 
                        metodo: 'PIX', 
                        data: new Date().toISOString() 
                      }]);
                    }
                  }
                  if (s === 'Gratuidade') {
                    atualizar('valor', 0);
                    atualizar('valorTexto', '');
                    atualizar('valorPago', 0);
                    atualizar('historicoPagamentos', []);
                  }
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
    </form>
  );
}
