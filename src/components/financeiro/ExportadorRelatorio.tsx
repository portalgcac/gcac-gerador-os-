import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Calendar, 
  CheckSquare, 
  Square,
  Filter,
  Download,
  Settings,
  ChevronRight,
  Database
} from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useRecibos } from '../../context/RecibosContext';
import { useFinanceiro } from '../../context/FinanceiroContext';
import { useClientes } from '../../context/ClientesContext';
import { STATUS_OS, FORMAS_PAGAMENTO, STATUS_ORCAMENTO } from '../../types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from '../../db/supabase';

interface ExportadorRelatorioProps {
  isOpen: boolean;
  onClose: () => void;
}

type FonteDados = 'os' | 'orcamentos' | 'recibos' | 'despesas' | 'clientes' | 'atividades';

interface ColunaConfig {
  key: string;
  label: string;
  selected: boolean;
}

export function ExportadorRelatorio({ isOpen, onClose }: ExportadorRelatorioProps) {
  const { ordens } = useOrdens();
  const { orcamentos } = useOrcamentos();
  const { recibos } = useRecibos();
  const { despesas } = useFinanceiro();
  const { clientes } = useClientes();

  const [passo, setPasso] = useState(1);
  const [fonte, setFonte] = useState<FonteDados>('os');
  
  // Filtros
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-01'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFiltro, setStatusFiltro] = useState<string[]>([]);
  const [execucaoFiltro, setExecucaoFiltro] = useState<string[]>([]);
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('Todos');
  const [usuarios, setUsuarios] = useState<{id: string, nome: string}[]>([]);

  // Colunas
  const [colunas, setColunas] = useState<ColunaConfig[]>([]);

  useEffect(() => {
    const carregarUsuarios = async () => {
      const { data } = await supabase.from('usuarios_autorizados').select('id, nome').eq('ativo', true);
      if (data) setUsuarios(data);
    };
    carregarUsuarios();
  }, []);

  const configColunas: Record<FonteDados, ColunaConfig[]> = {
    os: [
      { key: 'numero', label: 'Nº OS', selected: true },
      { key: 'criadoEm', label: 'Data Criação', selected: true },
      { key: 'nomeCliente', label: 'Cliente', selected: true },
      { key: 'cpf', label: 'CPF', selected: true },
      { key: 'contato', label: 'Contato', selected: true },
      { key: 'endereco', label: 'Endereço', selected: false },
      { key: 'servicos', label: 'Serviços', selected: true },
      { key: 'valor', label: 'Valor Total', selected: true },
      { key: 'valorPago', label: 'Valor Pago', selected: true },
      { key: 'taxaPFTotal', label: 'Taxas PF', selected: true },
      { key: 'status', label: 'Status OS', selected: true },
      { key: 'formaPagamento', label: 'Forma Pagamento', selected: true },
      { key: 'canalAtendimento', label: 'Canal Atendimento', selected: false },
      { key: 'criadoPorNome', label: 'Colaborador', selected: true },
      { key: 'observacoes', label: 'Observações', selected: false },
    ],
    orcamentos: [
      { key: 'numero', label: 'Nº Orçamento', selected: true },
      { key: 'criadoEm', label: 'Data', selected: true },
      { key: 'nomeCliente', label: 'Cliente', selected: true },
      { key: 'cpf', label: 'CPF', selected: true },
      { key: 'valorTotal', label: 'Valor Total', selected: true },
      { key: 'status', label: 'Status', selected: true },
      { key: 'criadoPorNome', label: 'Colaborador', selected: true },
    ],
    recibos: [
      { key: 'numero', label: 'Nº Recibo', selected: true },
      { key: 'criadoEm', label: 'Data', selected: true },
      { key: 'clienteNome', label: 'Cliente', selected: true },
      { key: 'clienteCPF', label: 'CPF', selected: true },
      { key: 'valorTotal', label: 'Valor Total', selected: true },
      { key: 'formaPagamento', label: 'Forma Pagamento', selected: true },
      { key: 'criadoPorNome', label: 'Colaborador', selected: true },
    ],
    despesas: [
      { key: 'data', label: 'Data', selected: true },
      { key: 'descricao', label: 'Descrição', selected: true },
      { key: 'categoria', label: 'Categoria', selected: true },
      { key: 'valor', label: 'Valor', selected: true },
      { key: 'criadoEm', label: 'Registrado em', selected: false },
    ],
    clientes: [
      { key: 'nome', label: 'Nome', selected: true },
      { key: 'cpf', label: 'CPF', selected: true },
      { key: 'contato', label: 'Contato', selected: true },
      { key: 'endereco', label: 'Endereço', selected: true },
      { key: 'observacoes', label: 'Observações', selected: false },
      { key: 'criadoEm', label: 'Data Cadastro', selected: true },
    ],
    atividades: [
      { key: 'data', label: 'Data/Hora', selected: true },
      { key: 'usuario', label: 'Colaborador', selected: true },
      { key: 'acao', label: 'Ação', selected: true },
      { key: 'ordemNumero', label: 'Nº OS', selected: true },
      { key: 'clienteNome', label: 'Cliente', selected: true },
    ]
  };

  useEffect(() => {
    setColunas(configColunas[fonte]);
  }, [fonte]);

  const toggleColuna = (key: string) => {
    setColunas(prev => prev.map(c => c.key === key ? { ...c, selected: !c.selected } : c));
  };

  const handleExportar = () => {
    let dadosParaFiltrar: any[] = [];
    
    if (fonte === 'atividades') {
      // Lógica especial para construir a lista de atividades a partir das ordens
      const atividadesGeradas: any[] = [];
      ordens.forEach(o => {
        // Criação de O.S.
        if (colaboradorFiltro === 'Todos' || o.criadoPorNome === colaboradorFiltro) {
          const dataCriacao = parseISO(o.criadoEm);
          if (isWithinInterval(dataCriacao, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
            atividadesGeradas.push({
              id: `criacao-${o.id}`,
              data: o.criadoEm,
              usuario: o.criadoPorNome || 'Sistema',
              acao: 'Criou OS',
              ordemNumero: o.numero,
              clienteNome: o.nomeCliente
            });
          }
        }

        // Histórico Operacional
        if (o.historicoStatus) {
          o.historicoStatus.forEach(evento => {
            const dataEvento = parseISO(evento.data);
            if (isWithinInterval(dataEvento, { start: startOfDay(parseISO(dataInicio)), end: endOfDay(parseISO(dataFim)) })) {
              if (evento.tipo === 'status_execucao') {
                if (colaboradorFiltro === 'Todos' || evento.usuario === colaboradorFiltro) {
                  if (evento.valorNovo === 'Protocolado — Ag. PF') {
                    atividadesGeradas.push({
                      id: evento.id,
                      data: evento.data,
                      usuario: evento.usuario,
                      acao: 'Protocolou Serviço',
                      ordemNumero: o.numero,
                      clienteNome: o.nomeCliente
                    });
                  } else if (evento.valorNovo === 'Concluído') {
                    atividadesGeradas.push({
                      id: evento.id,
                      data: evento.data,
                      usuario: evento.usuario,
                      acao: 'Concluiu Serviço',
                      ordemNumero: o.numero,
                      clienteNome: o.nomeCliente
                    });
                  }
                }
              }
            }
          });
        }
      });
      dadosParaFiltrar = atividadesGeradas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    } else {
      if (fonte === 'os') dadosParaFiltrar = ordens;
      else if (fonte === 'orcamentos') dadosParaFiltrar = orcamentos;
      else if (fonte === 'recibos') dadosParaFiltrar = recibos;
      else if (fonte === 'despesas') dadosParaFiltrar = despesas;
      else if (fonte === 'clientes') dadosParaFiltrar = clientes;

      dadosParaFiltrar = dadosParaFiltrar.filter(item => {
        const dataItem = parseISO(item.criadoEm || item.data);
        const noIntervalo = isWithinInterval(dataItem, {
          start: startOfDay(parseISO(dataInicio)),
          end: endOfDay(parseISO(dataFim))
        });

        if (!noIntervalo) return false;

        // Filtros específicos de OS
        if (fonte === 'os') {
          if (statusFiltro.length > 0 && !statusFiltro.includes(item.status)) return false;
          if (execucaoFiltro.length > 0) {
            const temStatusExecucao = item.servicos?.some((s: any) => execucaoFiltro.includes(s.statusExecucao));
            if (!temStatusExecucao) return false;
          }
          if (colaboradorFiltro !== 'Todos' && item.criadoPorNome !== colaboradorFiltro) return false;
        }

        return true;
      });
    }

    const colunasSelecionadas = colunas.filter(c => c.selected);
    const dadosFormatados = dadosParaFiltrar.map(item => {
      const obj: any = {};
      colunasSelecionadas.forEach(col => {
        let valor = item[col.key];
        
        // Formatações especiais
        if (col.key === 'criadoEm' || col.key === 'data') {
          valor = format(parseISO(valor), 'dd/MM/yyyy HH:mm');
        } else if (col.key === 'servicos' && Array.isArray(valor)) {
          valor = valor.map((s: any) => s.nome).join(', ');
        } else if (col.key === 'numero' || col.key === 'ordemNumero') {
          valor = `#${String(valor).padStart(4, '0')}`;
        }
        
        obj[col.label] = valor;
      });
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `Relatorio_${fonte}_${dataInicio}_a_${dataFim}.xlsx`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="card w-full max-w-2xl relative z-10 animate-scale-up overflow-hidden p-0 border-brand-dark-5">
        {/* Header */}
        <div className="bg-brand-dark-3 p-6 border-b border-brand-dark-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="text-brand-green" />
              Gerador de Relatórios Avançado
            </h2>
            <p className="text-gray-400 text-sm">Configure os filtros e colunas para exportação</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {[1, 2, 3].map(step => (
              <React.Fragment key={step}>
                <div className={`flex items-center gap-2 whitespace-nowrap ${passo === step ? 'text-brand-blue' : passo > step ? 'text-brand-green' : 'text-gray-500'}`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    passo === step ? 'border-brand-blue bg-brand-blue/10' : 
                    passo > step ? 'border-brand-green bg-brand-green text-white' : 'border-gray-600'
                  }`}>
                    {passo > step ? '✓' : step}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {step === 1 ? 'Fonte' : step === 2 ? 'Filtros' : 'Colunas'}
                  </span>
                </div>
                {step < 3 && <div className="h-px w-8 bg-brand-dark-5" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Fonte de Dados */}
          {passo === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'os', label: 'Ordens de Serviço', icon: <Database size={24} />, desc: 'Relatório detalhado de atendimentos e pagamentos' },
                { id: 'atividades', label: 'Atividades da Equipe', icon: <CheckSquare size={24} />, desc: 'Métricas e histórico de ações operacionais' },
                { id: 'recibos', label: 'Recibos', icon: <Download size={24} />, desc: 'Listagem de todos os recibos emitidos' },
                { id: 'orcamentos', label: 'Orçamentos', icon: <Settings size={24} />, desc: 'Status de orçamentos e conversão' },
                { id: 'despesas', label: 'Despesas PJ', icon: <Download size={24} />, desc: 'Controle de saídas e categorias' },
                { id: 'clientes', label: 'Base de Clientes', icon: <Settings size={24} />, desc: 'Dados cadastrais e contatos' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { setFonte(item.id as FonteDados); setPasso(2); }}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    fonte === item.id ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-dark-5 hover:border-gray-600'
                  }`}
                >
                  <div className={`${fonte === item.id ? 'text-brand-blue' : 'text-gray-500'}`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.label}</h3>
                    <p className="text-[11px] text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Filtros */}
          {passo === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Data Início</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type="date" 
                      className="input pl-10" 
                      value={dataInicio} 
                      onChange={e => setDataInicio(e.target.value)} 
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Data Fim</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type="date" 
                      className="input pl-10" 
                      value={dataFim} 
                      onChange={e => setDataFim(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {fonte === 'os' && (
                <>
                  <div>
                    <label className="label">Status da OS</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OS.map(status => (
                        <button
                          key={status}
                          onClick={() => setStatusFiltro(prev => 
                            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                          )}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            statusFiltro.includes(status) 
                              ? 'bg-brand-blue border-brand-blue text-white shadow-lg' 
                              : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-600'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Status de Execução (Qualquer Serviço)</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Não Iniciado',
                        'Iniciado — Montando Processo',
                        'Aguardando Documentos',
                        'Protocolado — Ag. PF',
                        'Concluído'
                      ].map(status => (
                        <button
                          key={status}
                          onClick={() => setExecucaoFiltro(prev => 
                            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                          )}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            execucaoFiltro.includes(status) 
                              ? 'bg-purple-600 border-purple-600 text-white shadow-lg' 
                              : 'bg-brand-dark-4 border-brand-dark-5 text-gray-500 hover:border-gray-600'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Colaborador Responsável</label>
                    <select 
                      className="select" 
                      value={colaboradorFiltro}
                      onChange={e => setColaboradorFiltro(e.target.value)}
                    >
                      <option value="Todos">Todos os Colaboradores</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.nome}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {fonte === 'atividades' && (
                <div>
                  <label className="label">Filtrar por Colaborador</label>
                  <select 
                    className="select" 
                    value={colaboradorFiltro}
                    onChange={e => setColaboradorFiltro(e.target.value)}
                  >
                    <option value="Todos">Todos os Colaboradores</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.nome}>{u.nome}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500 mt-2">
                    A exportação retornará o log de operações (Criação de O.S., Protocolos e Deferimentos) do período.
                  </p>
                </div>
              )}
              
              {/* Adicionar mais filtros específicos conforme necessário */}
            </div>
          )}

          {/* Step 3: Colunas */}
          {passo === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">Selecione as colunas que deseja incluir no arquivo Excel</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setColunas(prev => prev.map(c => ({...c, selected: true})))}
                    className="text-[10px] text-brand-blue font-bold uppercase hover:underline"
                  >
                    Marcar Todas
                  </button>
                  <button 
                    onClick={() => setColunas(prev => prev.map(c => ({...c, selected: false})))}
                    className="text-[10px] text-gray-500 font-bold uppercase hover:underline"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {colunas.map(col => (
                  <button
                    key={col.key}
                    onClick={() => toggleColuna(col.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      col.selected ? 'border-brand-blue/50 bg-brand-blue/5 text-white' : 'border-brand-dark-5 text-gray-500'
                    }`}
                  >
                    {col.selected ? (
                      <CheckSquare size={18} className="text-brand-blue" />
                    ) : (
                      <Square size={18} />
                    )}
                    <span className="text-xs font-medium">{col.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-brand-dark-3 p-6 border-t border-brand-dark-5 flex items-center justify-between gap-4">
          <button 
            onClick={() => passo === 1 ? onClose() : setPasso(passo - 1)}
            className="btn-ghost flex-1 font-black text-xs uppercase tracking-widest"
          >
            {passo === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          
          {passo < 3 ? (
            <button 
              onClick={() => setPasso(passo + 1)}
              className="btn-primary flex-1 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              Próximo Passo
              <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleExportar}
              className="btn-primary flex-1 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-brand-green border-brand-green hover:bg-brand-green/90"
            >
              <Download size={16} />
              Gerar Planilha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
