import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Save, X, Receipt, CheckCircle, ChevronDown, List, 
  Trash2, User, FileText, Search, CreditCard, AlertTriangle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useRecibos } from '../../context/RecibosContext';
import { useOrdens } from '../../context/OrdensContext';
import { useClientes } from '../../context/ClientesContext';
import { useServicos } from '../../context/ServicosContext';
import { OrdemDeServico, Recibo, Cliente, ServicoConfig, FORMAS_PAGAMENTO, FormaPagamento } from '../../types';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { formatarMoeda, removerAcentos } from '../../utils/formatters';

// Configurações do Emitente
const EMITENTE = {
  nome: 'GCAC DESPACHANTE BÉLICO', // Substitua pelo nome fantasia se necessário
  cnpj: '63.820.168/0001-63'
};

export function FormularioRecibo() {
  const navigate = useNavigate();
  const location = useLocation();
  const { criarRecibo } = useRecibos();
  const { ordens, atualizarOrdem } = useOrdens();
  const { clientes } = useClientes();
  const { servicos: servicosCadastrados } = useServicos();
  const { estado: notif, mostrar, fechar } = useNotificacao();

  const [cenario, setCenario] = useState<'os' | 'manual'>('os');
  const [salvando, setSalvando] = useState(false);
  const [focoCliente, setFocoCliente] = useState(false);
  const [clientePreDefinido, setClientePreDefinido] = useState<Cliente | null>(null);

  const [form, setForm] = useState({
    clienteNome: '',
    clienteCPF: '',
    clienteContato: '',
    servicos: [] as any[],
    valorTotal: 0,
    ordemId: '',
    formaPagamento: 'PIX' as FormaPagamento,
    observacoes: ''
  });

  const clienteEncontrado = clientes.find(c => 
    (c.cpf && form.clienteCPF && c.cpf.replace(/\D/g, '') === form.clienteCPF.replace(/\D/g, '')) ||
    (c.nome && form.clienteNome && c.nome.trim().toUpperCase() === form.clienteNome.trim().toUpperCase())
  );

  // Preenchimento automático vindo do perfil do cliente
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: Cliente };
    if (state?.clientePreDefinido) {
      const c = state.clientePreDefinido;
      setClientePreDefinido(c);
      
      // Busca se o cliente tem alguma OS disponível
      const cCpfClean = c.cpf ? c.cpf.replace(/\D/g, '') : '';
      const temOs = ordens.some(o => {
        const statusValido = o.status === 'Aguardando Pagamento' || o.status === 'Pago';
        const oCpfClean = o.cpf ? o.cpf.replace(/\D/g, '') : '';
        return statusValido && oCpfClean === cCpfClean;
      });

      // Se tiver OS, deixa o cenário como 'os' (padrão do formulário), senão muda para 'manual'
      setCenario(temOs ? 'os' : 'manual');

      setForm(f => ({
        ...f,
        clienteNome: c.nome,
        clienteCPF: c.cpf,
        clienteContato: c.contato || '',
      }));
      // Limpar o estado para não repetir o preenchimento
      window.history.replaceState({}, document.title);
    }
  }, [location, ordens]);

  const [erros, setErros] = useState<Record<string, string>>({});

  const atualizar = (campo: string, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => { const novo = { ...e }; delete novo[campo]; return novo; });
  };

  // --- Cenário 1: Seleção de OS ---
  const ordensDisponiveis = ordens.filter(o => {
    const statusValido = o.status === 'Aguardando Pagamento' || o.status === 'Pago';
    if (!statusValido) return false;
    
    if (clientePreDefinido) {
      const oCpfClean = o.cpf ? o.cpf.replace(/\D/g, '') : '';
      const cCpfClean = clientePreDefinido.cpf ? clientePreDefinido.cpf.replace(/\D/g, '') : '';
      return oCpfClean === cCpfClean;
    }
    return true;
  });

  const selecionarOS = (id: string) => {
    const os = ordens.find(o => o.id === id);
    if (os) {
      setForm({
        clienteNome: os.nomeCliente,
        clienteCPF: os.cpf,
        clienteContato: os.contato || '',
        servicos: os.servicos.map(s => ({
          id: uuidv4(),
          nome: s.nome,
          valor: s.valor || 0,
          detalhes: s.detalhes
        })),
        valorTotal: os.valor,
        ordemId: os.id,
        formaPagamento: (os.formaPagamento as FormaPagamento) || 'PIX',
        observacoes: os.observacoes
      });
    }
  };

  // --- Cenário 2: Manual ---
  const handleCPF = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    if (n.length <= 11) {
      const f = n.replace(/(\d{3})(\d)/, '$1.$2')
                   .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                   .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
      atualizar('clienteCPF', f);
    } else {
      const f = n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      atualizar('clienteCPF', f);
    }
  };

  const adicionarServico = (serv: ServicoConfig) => {
    const novosServicos = [
      ...form.servicos,
      { id: uuidv4(), nome: serv.nome, valor: serv.valorPadrao, detalhes: '' }
    ];
    const novoTotal = novosServicos.reduce((acc, s) => acc + s.valor, 0);
    setForm(f => ({ ...f, servicos: novosServicos, valorTotal: novoTotal }));
  };

  const removerServico = (id: string) => {
    const novosServicos = form.servicos.filter(s => s.id !== id);
    const novoTotal = novosServicos.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    setForm(f => ({ ...f, servicos: novosServicos, valorTotal: novoTotal }));
  };

  const atualizarServico = (id: string, campo: string, valor: any) => {
    const novosServicos = form.servicos.map(s => 
      s.id === id ? { ...s, [campo]: valor } : s
    );
    const novoTotal = novosServicos.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    setForm(f => ({ ...f, servicos: novosServicos, valorTotal: novoTotal }));
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.clienteNome.trim()) e.clienteNome = 'Nome é obrigatório';
    if (!form.clienteCPF.trim()) e.clienteCPF = 'CPF/CNPJ é obrigatório';
    if (form.servicos.length === 0) e.servicos = 'Adicione pelo menos um serviço';
    if (form.valorTotal <= 0) e.valorTotal = 'O valor total deve ser maior que zero';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setSalvando(true);

    try {
      const id = await criarRecibo({
        ...form,
        clienteNome: form.clienteNome.trim().toUpperCase(),
        servicos: form.servicos.map((s: any) => ({ ...s, nome: s.nome.trim().toUpperCase() })),
        emitenteNome: EMITENTE.nome,
        emitenteCNPJ: EMITENTE.cnpj
      });

      // Se for vinculado a uma OS, perguntar e atualizar status
      if (form.ordemId) {
        const os = ordens.find(o => o.id === form.ordemId);
        if (os && os.status !== 'Pago') {
          if (confirm('Deseja marcar a Ordem de Serviço vinculada como "PAGO" automaticamente?')) {
            await atualizarOrdem(form.ordemId, { status: 'Pago' });
          }
        }
      }

      mostrar('sucesso', 'Recibo emitido com sucesso!');
      setTimeout(() => navigate(`/recibos/${id}`), 1200);
    } catch {
      mostrar('erro', 'Erro ao salvar o recibo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Seletor de Cenário */}
      <div className="flex p-1 bg-brand-dark-4 rounded-xl border border-brand-dark-5">
        <button
          onClick={() => { setCenario('os'); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
            cenario === 'os' ? 'bg-brand-blue/30 text-brand-blue-light border border-brand-blue/30' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <FileText size={16} /> Emitir de uma OS
        </button>
        <button
          onClick={() => { setCenario('manual'); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
            cenario === 'manual' ? 'bg-brand-green/30 text-brand-green-light border border-brand-green/30' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Receipt size={16} /> Emissão Livre
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

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

        {/* Dados do Cliente */}
        <div className="card">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <User size={18} className="text-brand-blue-light" />
            Dados do Cliente
          </h3>

          <div className="space-y-4">
            {cenario === 'os' ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="label label-required">Selecione a Ordem de Serviço</label>
                  {clientePreDefinido && (
                    <span className="text-[10px] bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Filtrado por: {clientePreDefinido.nome}
                    </span>
                  )}
                </div>
                <select 
                  className={`select ${erros.ordemId ? 'border-red-500' : ''}`}
                  value={form.ordemId}
                  onChange={e => selecionarOS(e.target.value)}
                >
                  <option value="">Selecione uma OS pendente ou paga...</option>
                  {ordensDisponiveis.map(o => (
                    <option key={o.id} value={o.id}>
                      OS-{String(o.numero).padStart(4, '0')} — {o.nomeCliente} ({formatarMoeda(o.valor)}) {o.status === 'Pago' ? '✅' : ''}
                    </option>
                  ))}
                </select>
                {erros.ordemId && <p className="text-red-400 text-xs mt-1">{erros.ordemId}</p>}
                {ordensDisponiveis.length === 0 && (
                  <p className="text-xs text-yellow-500 mt-2">
                    {clientePreDefinido 
                      ? `Nenhuma OS com status "Aguardando Pagamento" ou "Pago" encontrada para ${clientePreDefinido.nome}.`
                      : 'Nenhuma OS com status "Aguardando Pagamento" ou "Pago" encontrada.'}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="label label-required">Nome do Cliente</label>
                  <input
                    type="text"
                    className={`input uppercase ${erros.clienteNome ? 'input-error' : ''}`}
                    placeholder="Nome completo ou Razão Social"
                    value={form.clienteNome}
                    onChange={e => atualizar('clienteNome', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label label-required">CPF ou CNPJ</label>
                  <input
                    type="text"
                    className={`input ${erros.clienteCPF ? 'input-error' : ''}`}
                    placeholder="000.000.000-00 ou 00.000.000/00.000-00"
                    value={form.clienteCPF}
                    onChange={e => handleCPF(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Telefone de Contato</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="(00) 0.0000-0000"
                    value={form.clienteContato}
                    onChange={e => atualizar('clienteContato', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Forma de Pagamento */}
            <div className="pt-2 border-t border-brand-dark-5 mt-4">
              <label className="label label-required flex items-center gap-2">
                <CreditCard size={14} className="text-brand-blue" />
                Forma de Pagamento
              </label>
              <select 
                className="select"
                value={form.formaPagamento}
                onChange={e => atualizar('formaPagamento', e.target.value as FormaPagamento)}
              >
                {FORMAS_PAGAMENTO.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Serviços */}
        <div className="card">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <List size={18} className="text-brand-green-light" />
            Descrição dos Serviços
          </h3>

          {cenario === 'manual' && (
            <div className="mb-4">
              <SeletorServicoRapido onSelecionar={adicionarServico} servicos={servicosCadastrados} />
            </div>
          )}

          <div className="space-y-3">
            {form.servicos.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-brand-dark-5 rounded-xl text-gray-500 text-sm">
                Nenhum serviço adicionado.
              </div>
            ) : (
              form.servicos.map((s, index) => (
                <div key={s.id} className="p-3 bg-brand-dark-4 border border-brand-dark-5 rounded-lg flex items-center justify-between gap-4 animate-scale-up">
                  <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                    <div className="col-span-3">
                      <input 
                        type="text"
                        className="bg-transparent border-none text-sm font-bold text-white w-full focus:ring-0 uppercase p-0"
                        value={s.nome}
                        onChange={(e) => atualizarServico(s.id, 'nome', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-1">
                      <span className="text-[10px] text-brand-green-light font-bold">R$</span>
                      <input 
                        type="number"
                        className="bg-transparent border-none text-sm text-brand-green-light font-black w-20 text-right focus:ring-0 p-0"
                        value={s.valor}
                        step="0.01"
                        onChange={(e) => atualizarServico(s.id, 'valor', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerServico(s.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-brand-dark-5 flex justify-between items-center">
            <span className="text-sm text-gray-400">Total do Recibo:</span>
            <span className="text-xl font-black text-brand-green-light">{formatarMoeda(form.valorTotal)}</span>
          </div>
        </div>

        {/* Observações */}
        <div className="card">
          <label className="label">Observações (opcional)</label>
          <textarea
            className="input resize-none"
            placeholder="Ex: Referente a parcela 1/2, desconto aplicado, etc..."
            rows={3}
            value={form.observacoes}
            onChange={e => atualizar('observacoes', e.target.value)}
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1">
            <X size={16} /> Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn-primary flex-1">
            <Save size={16} />
            {salvando ? 'Emitindo...' : 'Emitir Recibo'}
          </button>
        </div>
      </form>

      <Notificacao {...notif} onFechar={fechar} />
    </div>
  );
}

function SeletorServicoRapido({ onSelecionar, servicos }: { onSelecionar: (s: ServicoConfig) => void, servicos: ServicoConfig[] }) {
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

  const servicosFiltrados = servicos.filter(s => 
    removerAcentos(s.nome.toLowerCase()).includes(removerAcentos(busca.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-dark-5 border border-brand-dark-5 hover:border-brand-blue/40 text-gray-300 text-xs font-bold transition-all"
      >
        <List size={14} /> Selecionar Serviço do Catálogo
        <ChevronDown size={14} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
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
                <p className="text-xs text-gray-500">
                  {busca ? 'Nenhum serviço encontrado.' : 'Nenhum serviço cadastrado.'}
                </p>
              </div>
            ) : (
              servicosFiltrados.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onSelecionar(s); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-200 hover:bg-brand-blue/20 transition-colors border-b border-brand-dark-5/50 last:border-0 flex justify-between items-center"
                >
                  <span className="truncate pr-2">{s.nome}</span>
                  <span className="text-brand-green font-bold flex-shrink-0">{formatarMoeda(s.valorPadrao)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
