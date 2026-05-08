import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Save, X, Users, CheckCircle, ChevronDown, List, Trash2, Eye, EyeOff, Search
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Orcamento, StatusOrcamento, ServicoConfig } from '../../types';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useClientes } from '../../context/ClientesContext';
import { useServicos } from '../../context/ServicosContext';
import { useOrdens } from '../../context/OrdensContext';
import { Cliente } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { formatarMoeda, removerAcentos } from '../../utils/formatters';
import { supabase } from '../../db/supabase';

interface FormularioOrcamentoProps {
  orcamentoExistente?: Orcamento;
}

// ── Dropdown de serviços (Simplificado) ──────────────────────────────────────────────────
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
        onClick={() => setAberto(a => !a)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-dark-5 border border-brand-dark-5 hover:border-brand-blue/40 hover:bg-brand-blue/10 text-gray-300 hover:text-brand-blue-light text-sm font-medium transition-all"
      >
        <List size={14} />
        Adicionar serviço
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
export function FormularioOrcamento({ orcamentoExistente }: FormularioOrcamentoProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { criarOrcamento, atualizarOrcamento } = useOrcamentos();
  const { clientes, criarCliente, clubesRegistrados } = useClientes();
  const { criarOrdem } = useOrdens();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [salvando, setSalvando] = useState(false);
  const [focoNome, setFocoNome] = useState(false);
  const [focoClube, setFocoClube] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    const carregarUsuarios = async () => {
      const { data } = await supabase.from('usuarios_autorizados').select('id, nome').eq('ativo', true).order('nome');
      if (data) setUsuarios(data);
    };
    carregarUsuarios();
  }, []);

  const [form, setForm] = useState({
    nomeCliente:       orcamentoExistente?.nomeCliente       ?? '',
    contato:           orcamentoExistente?.contato           ?? '',
    cpf:               orcamentoExistente?.cpf               ?? '',
    senhaGov:          orcamentoExistente?.senhaGov          ?? '',
    filiadoProTiro:    orcamentoExistente?.filiadoProTiro    ?? true,
    clubeFiliado:      orcamentoExistente?.clubeFiliado      ?? '',
    endereco:          orcamentoExistente?.endereco          ?? '',
    servicos:          orcamentoExistente?.servicos          ?? [],
    valorTotal:        orcamentoExistente 
                         ? orcamentoExistente.servicos.filter(s => !s.pagoDireto && s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0)
                         : 0,
    formaPagamento:    (orcamentoExistente as any)?.formaPagamento ?? 'Pendente',
    status:            (orcamentoExistente?.status           ?? 'Pendente') as StatusOrcamento,
    observacoes:       orcamentoExistente?.observacoes       ?? '',
  });

  // Preenchimento automático vindo do perfil do cliente
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: Cliente };
    if (state?.clientePreDefinido && !orcamentoExistente) {
      const c = state.clientePreDefinido;
      setForm(f => ({
        ...f,
        nomeCliente: c.nome,
        cpf: c.cpf,
        contato: c.contato,
        senhaGov: c.senhaGov,
        filiadoProTiro: c.filiadoProTiro,
        clubeFiliado: c.clubeFiliado || '',
        endereco: c.endereco || ''
      }));
      // Limpar o estado para não repetir o preenchimento se o usuário recarregar
      window.history.replaceState({}, document.title);
    }
  }, [location, orcamentoExistente]);

  const [erros, setErros] = useState<Record<string, string>>({});

  const atualizar = (campo: keyof typeof form, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => { const novo = { ...e }; delete novo[campo]; return novo; });
  };

  const selecionarCliente = (c: Cliente) => {
    setForm(f => ({
      ...f,
      nomeCliente: c.nome,
      cpf: c.cpf,
      contato: c.contato,
      senhaGov: c.senhaGov || f.senhaGov,
      filiadoProTiro: c.filiadoProTiro,
      clubeFiliado: c.clubeFiliado || '',
      endereco: c.endereco || ''
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

  const adicionarServico = (serv: ServicoConfig) => {
    // Escolhe o valor baseado no status de filiado
    const valorAplicado = form.filiadoProTiro ? (serv.valorFiliado || serv.valorPadrao) : serv.valorPadrao;
    const isLaudo = serv.categoria === 'Laudo';

    setForm(f => {
      const novosServicos = [
        ...f.servicos,
        { 
          id: uuidv4(), 
          nome: serv.nome, 
          detalhes: '', 
          valor: valorAplicado,
          taxaPF: serv.taxaPF,
          exigeGRU: serv.exigeGRU,
          categoria: serv.categoria || 'Honorário',
          pagoDireto: isLaudo
        }
      ];
      const novoTotal = novosServicos.filter(s => !s.pagoDireto).reduce((acc, s) => acc + s.valor, 0);
      return { ...f, servicos: novosServicos, valorTotal: novoTotal };
    });
    setErros(e => { const n = { ...e }; delete n['servicos']; return n; });
  };

  const atualizarPagoDireto = (id: string, pago: boolean) => {
    setForm(f => {
      const novosServicos = f.servicos.map(s => s.id === id ? { ...s, pagoDireto: pago } : s);
      const novoTotal = novosServicos.filter(s => !s.pagoDireto).reduce((acc, s) => acc + s.valor, 0);
      return { ...f, servicos: novosServicos, valorTotal: novoTotal };
    });
  };

  const atualizarValorServico = (id: string, textoValor: string) => {
    const limpo = textoValor.replace(/[^\d,]/g, '').replace(',', '.');
    const valorNumerico = parseFloat(limpo) || 0;
    
    setForm(f => {
      const novosServicos = f.servicos.map(s => s.id === id ? { ...s, valor: valorNumerico } : s);
      const novoTotal = novosServicos.filter(s => !s.pagoDireto).reduce((acc, s) => acc + s.valor, 0);
      return { ...f, servicos: novosServicos, valorTotal: novoTotal };
    });
  };

  const atualizarDetalhesServico = (id: string, texto: string) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.map(s => s.id === id ? { ...s, detalhes: texto } : s)
    }));
  };

  const atualizarResponsavelServico = (id: string, responsavelNome: string) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.map(s => s.id === id ? { ...s, responsavelNome } : s)
    }));
  };

  const atualizarRepasseServico = (id: string, valorRepasse: number) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.map(s => s.id === id ? { ...s, valorRepasse } : s)
    }));
  };

  const removerServico = (id: string) => {
    setForm(f => {
      const novosServicos = f.servicos.filter(s => s.id !== id);
      const novoTotal = novosServicos.filter(s => !s.pagoDireto).reduce((acc, s) => acc + s.valor, 0);
      return { ...f, servicos: novosServicos, valorTotal: novoTotal };
    });
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.nomeCliente.trim()) e.nomeCliente = 'Nome é obrigatório';
    if (!form.contato.trim())     e.contato     = 'Contato é obrigatório';
    if (!form.cpf.trim())         e.cpf         = 'CPF é obrigatório';
    if (form.servicos.length === 0) e.servicos  = 'Adicione pelo menos um serviço';
    
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const realizarConversao = async (orcId: string, dados: any) => {
    try {
      setSalvando(true);
      
      // 1. Garantir que o cliente existe
      const nomeClienteFormatado = dados.nomeCliente.toUpperCase();
      const clienteExistente = clientes.find(c => 
        (dados.cpf && c.cpf === dados.cpf) || 
        c.nome.toUpperCase() === nomeClienteFormatado
      );

      if (!clienteExistente) {
        await criarCliente({
          nome: nomeClienteFormatado,
          cpf: dados.cpf,
          contato: dados.contato,
          senhaGov: dados.senhaGov || '',
          filiadoProTiro: dados.filiadoProTiro || false,
          clubeFiliado: dados.clubeFiliado || 'NÃO RELATADO',
          endereco: dados.endereco || '',
          observacoes: ''
        });
      }

      // 2. Criar a O.S. priorizando dados do cadastro se o cliente já existir
      const osId = await criarOrdem({
        nomeCliente: nomeClienteFormatado,
        contato: dados.contato,
        cpf: dados.cpf,
        senhaGov: (clienteExistente?.senhaGov) || dados.senhaGov || '',
        clubeFiliado: (clienteExistente?.clubeFiliado) || dados.clubeFiliado || '',
        endereco: (clienteExistente?.endereco) || dados.endereco || '',
        filiadoProTiro: (clienteExistente?.filiadoProTiro) ?? dados.filiadoProTiro ?? false,
        servicos: dados.servicos.map((s: any) => ({
          id: s.id,
          nome: s.nome,
          detalhes: s.detalhes,
          valor: s.valor,
          categoria: s.categoria || 'Honorário',
          pagoDireto: s.pagoDireto || s.categoria === 'Laudo',
          taxaPF: s.taxaPF,
          exigeGRU: s.exigeGRU,
          responsavelNome: s.responsavelNome,
          valorRepasse: s.valorRepasse,
          statusExecucao: 'Não Iniciado',
          pagoGRU: false
        })),
        valor: dados.servicos.filter((s: any) => !s.pagoDireto && s.categoria !== 'Laudo').reduce((acc: number, s: any) => acc + (s.valor || 0), 0),
        valorPago: 0,
        historicoPagamentos: [],
        formaPagamento: 'PIX',
        status: 'Aguardando Pagamento',
        canalAtendimento: 'WhatsApp',
        observacaoContato: 'Convertido automaticamente no salvamento',
        observacoes: dados.observacoes || '',
        taxaPFTotal: dados.servicos.reduce((acc: number, s: any) => acc + (s.taxaPF || 0), 0)
      });

      // 3. Vincular O.S. ao orçamento
      await atualizarOrcamento(orcId, { 
        status: 'Aprovado',
        convertidoOsId: osId 
      });

      mostrar('sucesso', 'Sucesso! Orçamento convertido em O.S.');
      setTimeout(() => navigate(`/ordens/${osId}/editar`), 1500);
    } catch (err) {
      console.error(err);
      mostrar('erro', 'Orçamento salvo, mas houve erro ao converter em O.S.');
      setTimeout(() => navigate(`/orcamentos/${orcId}`), 1500);
    } finally {
      setSalvando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) { mostrar('erro', 'Corrija os campos destacados antes de salvar.'); return; }
    setSalvando(true);
    
    try {
      const dados = {
        nomeCliente:       form.nomeCliente.trim(),
        contato:           form.contato.trim(),
        cpf:               form.cpf.trim(),
        senhaGov:          form.senhaGov.trim(),
        filiadoProTiro:    form.filiadoProTiro,
        clubeFiliado:      form.filiadoProTiro ? '' : form.clubeFiliado.trim(),
        endereco:          form.endereco.trim(),
        servicos:          form.servicos.map(s => ({ ...s, detalhes: s.detalhes.trim() })),
        valorTotal:        form.valorTotal,
        taxaPFTotal:       form.servicos.reduce((acc, s) => acc + (s.taxaPF || 0), 0),
        status:            form.status,
        observacoes:       form.observacoes.trim(),
      };

      if (orcamentoExistente) {
        await atualizarOrcamento(orcamentoExistente.id, dados);
        mostrar('sucesso', 'Orçamento atualizado com sucesso!');
        
        // Verifica se deve converter em O.S. (apenas se for aprovado agora e não foi antes)
        if (dados.status === 'Aprovado' && !orcamentoExistente.convertidoOsId) {
          if (window.confirm('Este orçamento está APROVADO. Deseja gerar a Ordem de Serviço agora?')) {
             await realizarConversao(orcamentoExistente.id, dados);
             return; 
          }
        }

        setTimeout(() => navigate(`/orcamentos/${orcamentoExistente.id}`, { replace: true }), 1200);
      } else {
        const id = await criarOrcamento(dados);
        mostrar('sucesso', 'Orçamento criado com sucesso!');
        
        // Verifica se deve converter em O.S.
        if (dados.status === 'Aprovado') {
          if (window.confirm('Este orçamento está APROVADO. Deseja gerar a Ordem de Serviço agora?')) {
             await realizarConversao(id, dados);
             return; // O realizarConversao já vai navegar
          }
        }

        setTimeout(() => navigate(`/orcamentos/${id}`, { replace: true }), 1200);
      }
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err);
      const msg = err?.message || 'Erro ao salvar o orçamento. Tente novamente.';
      mostrar('erro', msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto pb-20">
      {/* ── 1. Dados do Cliente ── */}
      <div className="card">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-blue/30 text-brand-blue-light text-xs flex items-center justify-center font-bold">1</span>
          Dados do Cliente
        </h3>
        <div className="space-y-4">
          <div className="relative">
            <label className="label label-required">Nome Completo</label>
            <input type="text" className={`input uppercase ${erros.nomeCliente ? 'input-error' : ''}`}
              placeholder="Nome completo do cliente" value={form.nomeCliente}
              onChange={e => atualizar('nomeCliente', e.target.value.toUpperCase())}
              onFocus={() => setFocoNome(true)}
              onBlur={() => setTimeout(() => setFocoNome(false), 200)}
            />
            {erros.nomeCliente && <p className="text-red-400 text-xs mt-1">{erros.nomeCliente}</p>}
            
            {focoNome && clientesSugeridos.length > 0 && (
              <div className="absolute left-0 top-[70px] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-2 border-b border-brand-dark-5 bg-brand-dark-4">
                  <p className="text-xs text-brand-blue-light px-1 font-semibold flex items-center gap-1.5"><Users size={12}/> Sugestões de clientes cadastrados</p>
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
              <input type="tel" className={`input ${erros.contato ? 'input-error' : ''}`}
                placeholder="(00) 00000-0000" value={form.contato}
                onChange={e => handleTelefone(e.target.value)} />
              {erros.contato && <p className="text-red-400 text-xs mt-1">{erros.contato}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label label-required">CPF</label>
                <input type="text" className={`input ${erros.cpf ? 'input-error' : ''}`}
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
                    placeholder="Sua senha gov.br"
                    value={form.senhaGov}
                    onChange={e => atualizar('senhaGov', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Endereço Completo</label>
            <textarea 
              className="input uppercase h-20 py-2 resize-none" 
              placeholder="Rua, número, bairro, CEP, cidade-UF..." 
              value={form.endereco}
              onChange={e => atualizar('endereco', e.target.value.toUpperCase())}
            />
          </div>

          {/* Filiado Pró-Tiro */}
          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Filiado Pró-Tiro?</p>
                <p className="text-xs text-gray-500 mt-0.5">Clube de Tiro e Caça Pró-Tiro, Jataí-GO</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => atualizar('filiadoProTiro', true)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    form.filiadoProTiro
                      ? 'bg-brand-green/30 border-brand-green/60 text-brand-green-light'
                      : 'bg-brand-dark-5 border-brand-dark-5 text-gray-400 hover:border-brand-metal'
                  }`}
                >
                  {form.filiadoProTiro && <CheckCircle size={13} />}
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => atualizar('filiadoProTiro', false)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    !form.filiadoProTiro
                      ? 'bg-red-500/30 border-red-500/60 text-red-300'
                      : 'bg-brand-dark-5 border-brand-dark-5 text-gray-400 hover:border-brand-metal'
                  }`}
                >
                  {!form.filiadoProTiro && <X size={13} />}
                  Não
                </button>
              </div>
            </div>

            {!form.filiadoProTiro && (
              <div className="mt-3 pt-3 border-t border-brand-dark-5 animate-fade-in relative">
                <label className="label label-required">Qual clube é filiado?</label>
                <input
                  type="text"
                  className={`input uppercase ${erros.clubeFiliado ? 'input-error' : ''}`}
                  placeholder="Nome do clube de tiro onde é filiado..."
                  value={form.clubeFiliado}
                  onChange={e => atualizar('clubeFiliado', e.target.value.toUpperCase())}
                  onFocus={() => setFocoClube(true)}
                  onBlur={() => setTimeout(() => setFocoClube(false), 200)}
                />
                {erros.clubeFiliado && <p className="text-red-400 text-xs mt-1">{erros.clubeFiliado}</p>}

                {focoClube && clubesRegistrados.length > 0 && (
                  <div className="absolute left-0 top-[75px] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="max-h-40 overflow-y-auto">
                      {clubesRegistrados
                        .filter(c => c.includes(form.clubeFiliado.toUpperCase()) || form.clubeFiliado === '')
                        .map(clube => (
                          <div
                            key={clube}
                            onClick={() => atualizar('clubeFiliado', clube)}
                            className="px-4 py-2.5 border-b border-brand-dark-5 hover:bg-brand-blue/20 cursor-pointer transition-colors text-sm text-white font-medium"
                          >
                            {clube}
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Serviços e Valores ── */}
      <div className="card border-l-4 border-l-brand-green">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-green/30 text-brand-green-light text-xs flex items-center justify-center font-bold">2</span>
            Serviços do Orçamento
          </h3>
          <SeletorServico onSelecionar={adicionarServico} />
        </div>
        {erros.servicos && <p className="text-red-400 text-xs mt-1 mb-3">{erros.servicos}</p>}

        {form.servicos.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-brand-dark-5 rounded-xl">
            <List size={24} className="text-brand-dark-5 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Adicione os serviços para compor o orçamento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {form.servicos.map((serv) => (
              <div 
                key={serv.id} 
                className="relative bg-brand-dark-4 border border-brand-dark-5 p-4 rounded-xl animate-scale-up grid grid-cols-1 md:grid-cols-[1fr,150px] gap-4"
              >
                <button
                  type="button"
                  onClick={() => removerServico(serv.id)}
                  className="absolute top-3 right-3 text-gray-500 hover:text-red-400 p-1"
                >
                  <Trash2 size={16} />
                </button>
                
                <div className="pr-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-bold text-brand-blue-light">
                      {serv.nome}
                    </h4>
                    {serv.categoria === 'Laudo' && (
                      <button
                        type="button"
                        onClick={() => atualizarPagoDireto(serv.id, !serv.pagoDireto)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-all ${
                          serv.pagoDireto 
                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                            : 'bg-brand-dark-5 text-gray-500 border border-transparent'
                        }`}
                        title={serv.pagoDireto ? "Pago diretamente ao instrutor/psicóloga" : "Alterar para pagamento direto"}
                      >
                        {serv.pagoDireto ? 'Pago Direto' : 'Pago p/ GCAC'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                        <Users size={11} className="text-gray-400" />
                        Colaborador Responsável
                      </label>
                      <select
                        className="w-full bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none transition-colors"
                        value={(serv as any).responsavelNome || ''}
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
                        Comissão (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full pl-9 bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none transition-colors"
                          placeholder="0,00"
                          value={(serv as any).valorRepasse ?? ''}
                          onChange={e => atualizarRepasseServico(serv.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                  <textarea
                    className="input text-sm resize-none bg-brand-dark-3 border-transparent focus:border-brand-blue/30 h-10 py-2.5"
                    placeholder="Detalhes adicionais do serviço..."
                    value={serv.detalhes}
                    onChange={e => atualizarDetalhesServico(serv.id, e.target.value)}
                  />
                </div>
                
                <div className="flex flex-col justify-end">
                  <label className="text-xs font-semibold text-gray-400 mb-1">Valor Unitário</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-green/70 text-sm font-medium">R$</span>
                    <input type="text" inputMode="decimal"
                      className="input pl-9 border-brand-green/20 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 font-bold"
                      placeholder="0,00" 
                      value={serv.valor === 0 ? '' : String(serv.valor).replace('.', ',')}
                      onChange={e => atualizarValorServico(serv.id, e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Resumo e Status ── */}
      <div className="card bg-gradient-to-br from-brand-dark-3 to-brand-dark-4 border-t-4 border-t-yellow-500">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-yellow-500/30 text-yellow-400 text-xs flex items-center justify-center font-bold">3</span>
          Resumo e Status
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center p-4 bg-brand-dark-2 rounded-xl border border-brand-dark-5 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="space-y-1 text-left sm:text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Honorários (Caixa): <span className="text-white ml-1">{formatarMoeda(form.servicos.filter(s => !s.pagoDireto).reduce((acc, s) => acc + (s.valor || 0), 0))}</span></p>
              <p className="text-[10px] font-bold text-amber-500 uppercase">Laudos (Terceiros): <span className="text-white ml-1">{formatarMoeda(form.servicos.filter(s => s.pagoDireto).reduce((acc, s) => acc + (s.valor || 0), 0))}</span></p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total faturado no Caixa</p>
              <p className="text-3xl font-black text-brand-green">{formatarMoeda(form.valorTotal)}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">
                Total Geral (Investimento Cliente): {formatarMoeda(form.servicos.reduce((acc, s) => acc + (s.valor || 0), 0))}
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-auto">
            <label className="text-sm font-medium text-gray-400 block mb-2 text-left md:text-right">Status Atual</label>
            <div className="flex gap-2">
              {['Pendente', 'Aprovado', 'Recusado'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => atualizar('status', s)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${
                    form.status === s 
                    ? s === 'Aprovado' ? 'bg-brand-green/20 text-brand-green border-brand-green/50'
                      : s === 'Recusado' ? 'bg-red-500/20 text-red-400 border-red-500/50'
                      : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                    : 'bg-brand-dark-5 text-gray-400 border-transparent hover:bg-brand-dark-4'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="label">Observações extras (Inclusas no orçamento final)</label>
          <textarea className="input resize-none h-24" placeholder="Ex: Prazo de validade 15 dias. Pagamento em até 3x no cartão..."
            value={form.observacoes}
            onChange={e => atualizar('observacoes', e.target.value)} />
        </div>
      </div>

      {/* ── Botões Abaixo ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark-2 border-t border-brand-dark-5 z-40 sm:static sm:bg-transparent sm:border-0 sm:p-0">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1 py-3 text-base">
            <X size={18} />Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn-primary flex-1 py-3 text-base bg-brand-green border-brand-green/60 hover:bg-brand-green/90 text-white shadow-[0_0_15px_rgba(109,190,69,0.3)]">
            <Save size={18} />
            {salvando ? 'Salvando...' : orcamentoExistente ? 'Atualizar Orçamento' : 'Salvar Orçamento'}
          </button>
        </div>
      </div>

      <Notificacao {...notif} onFechar={fechar} />
    </form>
  );
}
