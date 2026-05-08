import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Search,
  Calendar,
  Filter,
  ArrowRightLeft,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RelatorioEquipe } from './RelatorioEquipe';
import { FechamentoComissoes } from './FechamentoComissoes';
import { useOrdens } from '../../context/OrdensContext';
import { useFinanceiro, CATEGORIAS_DESPESA } from '../../context/FinanceiroContext';
import { useClientes } from '../../context/ClientesContext';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { isSameMonth, parseISO, startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { ExportadorRelatorio } from './ExportadorRelatorio';

export function Financeiro() {
  const navigate = useNavigate();
  const { ordens } = useOrdens();
  const { clientes } = useClientes();
  const { despesas, criarDespesa, deletarDespesa } = useFinanceiro();
  const { usuario } = useAuth();

  const [abaAtiva, setAbaAtiva] = useState<'relatorio' | 'despesas' | 'equipe' | 'comissoes'>('relatorio');
  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [novaDespesaModal, setNovaDespesaModal] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Form de nova despesa
  const [formDespesa, setFormDespesa] = useState({
    descricao: '',
    valor: '',
    categoria: CATEGORIAS_DESPESA[0],
    data: format(new Date(), 'yyyy-MM-dd')
  });

  // Filtragem de dados
  const ordensMes = useMemo(() => {
    return ordens.filter(o => {
      const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
      return !ehMigracao && isSameMonth(parseISO(o.criadoEm), dataFiltro);
    });
  }, [ordens, dataFiltro]);

  const despesasMes = useMemo(() => {
    return despesas.filter(d => isSameMonth(parseISO(d.data), dataFiltro));
  }, [despesas, dataFiltro]);

  // Cálculos Financeiros
  const totais = useMemo(() => {
    const faturamento = ordensMes.reduce((s, o) => s + (o.valorPago || 0), 0);
    const taxas = ordensMes
      .filter(o => o.status === 'Pago' || o.status === 'Parcialmente Pago')
      .reduce((s, o) => s + (o.taxaPFTotal || 0), 0);
    
    const despesasTotal = despesasMes.reduce((s, d) => s + (d.valor || 0), 0);
    
    // Novo cálculo: A receber apenas de quem já protocolou ou concluiu
    const pendenteProtocolado = ordensMes
      .filter(o => 
        o.status !== 'Pago' && 
        o.status !== 'Gratuidade' && 
        (o.servicos || []).some(s => s.statusExecucao === 'Protocolado — Ag. PF' || s.statusExecucao === 'Concluído')
      )
      .reduce((s, o) => s + (o.valor - (o.valorPago || 0)), 0);
    
    const countPendenteProtocolado = ordensMes.filter(o => 
      o.status !== 'Pago' && 
      o.status !== 'Gratuidade' && 
      (o.servicos || []).some(s => s.statusExecucao === 'Protocolado — Ag. PF' || s.statusExecucao === 'Concluído')
    ).length;

    const margemBruta = faturamento - taxas;
    const lucroLiquido = margemBruta - despesasTotal;

    return {
      faturamento,
      taxas,
      despesas: despesasTotal,
      margemBruta,
      lucroLiquido,
      pendenteProtocolado,
      countPendenteProtocolado,
      totalOS: ordensMes.length,
      concluidas: ordensMes.filter(o => o.status === 'Pago').length
    };
  }, [ordensMes, despesasMes]);

  const handleExportarExcel = () => {
    setIsExportModalOpen(true);
  };

  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDespesa.descricao || !formDespesa.valor) return;

    try {
      await criarDespesa({
        descricao: formDespesa.descricao,
        valor: parseFloat(formDespesa.valor),
        categoria: formDespesa.categoria as any,
        data: formDespesa.data
      });
      setNovaDespesaModal(false);
      setFormDespesa({
        descricao: '',
        valor: '',
        categoria: CATEGORIAS_DESPESA[0],
        data: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      alert('Erro ao salvar despesa');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-brand-blue" />
            Gestão Financeira
          </h1>
          <p className="text-gray-400 text-sm">Controle de faturamento, taxas e despesas PJ</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-3 py-1.5 gap-2">
            <Calendar size={16} className="text-gray-500" />
            <input 
              type="month" 
              className="bg-transparent text-white border-none focus:ring-0 text-sm outline-none" 
              value={format(dataFiltro, 'yyyy-MM')}
              onChange={(e) => setDataFiltro(new Date(e.target.value + '-02'))} // +02 para evitar timezone offset
            />
          </div>
          <button 
            onClick={handleExportarExcel}
            className="btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <FileSpreadsheet size={16} className="text-brand-green" />
            Exportar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="card border-brand-green/20 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-green" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Faturamento Bruto</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(totais.faturamento)}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px]">
            <span className="text-brand-green font-bold">{totais.concluidas}</span>
            <span className="text-gray-500">serviços pagos</span>
          </div>
          <ArrowUpCircle className="absolute -right-4 -bottom-4 text-brand-green/5 group-hover:text-brand-green/10 transition-colors" size={80} />
        </div>

        <div className="card border-yellow-500/20 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">A Receber (Protocolados)</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(totais.pendenteProtocolado)}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px]">
            <span className="text-yellow-500 font-bold">{totais.countPendenteProtocolado}</span>
            <span className="text-gray-500">processos aguardando</span>
          </div>
          <Clock size={80} className="absolute -right-4 -bottom-4 text-yellow-500/5 group-hover:text-yellow-500/10 transition-colors" />
        </div>

        <div className="card border-red-500/20 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Taxas PF (GRU)</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(totais.taxas)}</p>
          <p className="text-[10px] text-gray-500 mt-2">Dedução obrigatória operacional</p>
          <TrendingDown className="absolute -right-4 -bottom-4 text-red-500/5 group-hover:text-red-500/10 transition-colors" size={80} />
        </div>

        <div className="card border-brand-blue/20 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-blue" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Margem / Lucro Bruto</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(totais.margemBruta)}</p>
          <p className="text-[10px] text-gray-500 mt-2">Faturamento - Taxas</p>
          <div className="absolute -right-4 -bottom-4 text-brand-blue/5 group-hover:text-brand-blue/10 transition-colors">
            <BarChart3 size={80} />
          </div>
        </div>

        <div className="card border-brand-blue-light/30 bg-brand-blue/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-blue-light" />
          <p className="text-[10px] font-black text-brand-blue-light uppercase tracking-widest mb-1">Lucro Líquido Real (PJ)</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(totais.lucroLiquido)}</p>
          <div className="mt-2 text-[10px]">
            <span className="text-red-400 font-bold">-{formatarMoeda(totais.despesas)}</span>
            <span className="text-gray-500 mx-1">em despesas operacionais</span>
          </div>
          <ArrowRightLeft className="absolute -right-4 -bottom-4 text-brand-blue-light/5 group-hover:text-brand-blue-light/10 transition-colors" size={80} />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 bg-brand-dark-3 border border-brand-dark-5 rounded-xl w-fit">
        <button 
          onClick={() => setAbaAtiva('relatorio')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
            abaAtiva === 'relatorio' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Relatório de Serviços
        </button>
        <button 
          onClick={() => setAbaAtiva('despesas')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
            abaAtiva === 'despesas' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Despesas PJ (Saídas)
        </button>
        {usuario?.role === 'admin' && (
          <>
            <button 
              onClick={() => setAbaAtiva('equipe')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                abaAtiva === 'equipe' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <TrendingUp size={14} />
              Desempenho Equipe
            </button>
            <button 
              onClick={() => setAbaAtiva('comissoes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                abaAtiva === 'comissoes' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <FileSpreadsheet size={14} />
              Comissões
            </button>
          </>
        )}
      </div>

      {/* Conteúdo Aba Relatório */}
      {abaAtiva === 'relatorio' && (
        <div className="card p-0 overflow-hidden border-brand-dark-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="table-header">Data</th>
                  <th className="table-header">OS</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Taxas GRU</th>
                  <th className="table-header text-brand-green">Líquido (OS)</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5/30">
                {ordensMes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-gray-500 text-sm">
                      Nenhum movimento registrado neste período.
                    </td>
                  </tr>
                ) : (
                  ordensMes.map(o => (
                    <tr key={o.id} className="hover:bg-brand-dark-4 transition-colors">
                      <td className="table-cell font-mono text-[11px]">{format(parseISO(o.criadoEm), 'dd/MM/yy')}</td>
                      <td className="table-cell font-bold text-white">
                        <button 
                          onClick={() => navigate(`/ordens/${o.id}`)}
                          className="hover:text-brand-blue hover:underline transition-all text-left"
                          title="Abrir Ordem de Serviço"
                        >
                          #{String(o.numero).padStart(4, '0')}
                        </button>
                      </td>
                      <td className="table-cell">
                        <button 
                          onClick={() => {
                            const cliente = clientes.find(c => c.cpf === o.cpf);
                            if (cliente) {
                              navigate(`/clientes/${cliente.id}`);
                            } else {
                              alert('Cadastro do cliente não encontrado.');
                            }
                          }}
                          className="flex flex-col text-left group"
                          title="Abrir Cadastro do Cliente"
                        >
                          <span className="text-white font-medium group-hover:text-brand-blue group-hover:underline transition-all">
                            {o.nomeCliente}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">{o.cpf}</span>
                        </button>
                      </td>
                      <td className="table-cell font-bold text-white">{formatarMoeda(o.valor)}</td>
                      <td className="table-cell text-red-400">-{formatarMoeda(o.taxaPFTotal || 0)}</td>
                      <td className="table-cell font-black text-brand-green">
                        {formatarMoeda((o.valorPago || 0) - (o.taxaPFTotal || 0))}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          o.status === 'Pago' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' :
                          'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo Aba Despesas */}
      {abaAtiva === 'despesas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Lançamentos de Saídas PJ</h2>
            <button 
              onClick={() => setNovaDespesaModal(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2"
            >
              <Plus size={18} />
              Lançar Despesa
            </button>
          </div>

          <div className="card p-0 overflow-hidden border-brand-dark-5">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="table-header">Data</th>
                  <th className="table-header">Descrição</th>
                  <th className="table-header">Categoria</th>
                  <th className="table-header text-right">Valor</th>
                  <th className="table-header text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5/30">
                {despesasMes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-500 text-sm">
                      Nenhuma despesa para o período selecionado.
                    </td>
                  </tr>
                ) : (
                  despesasMes.map(d => (
                    <tr key={d.id} className="hover:bg-brand-dark-4 transition-colors">
                      <td className="table-cell font-mono text-[11px]">{format(parseISO(d.data), 'dd/MM/yyyy')}</td>
                      <td className="table-cell text-white font-medium">{d.descricao}</td>
                      <td className="table-cell whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          d.categoria === 'Retirada (Pró-labore)' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          'bg-brand-dark-4 text-gray-400 border border-brand-dark-5'
                        }`}>
                          {d.categoria}
                        </span>
                      </td>
                      <td className="table-cell text-right font-bold text-red-400 whitespace-nowrap">
                        -{formatarMoeda(d.valor)}
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-center">
                          <button 
                            onClick={() => { if(confirm('Excluir esta despesa?')) deletarDespesa(d.id) }}
                            className="p-1.5 text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo Aba Equipe */}
      {abaAtiva === 'equipe' && <RelatorioEquipe dataFiltro={dataFiltro} />}

      {/* Conteúdo Aba Comissões */}
      {abaAtiva === 'comissoes' && <FechamentoComissoes dataFiltro={dataFiltro} />}

      {/* Modal Nova Despesa */}
      {novaDespesaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNovaDespesaModal(false)} />
          <div className="card w-full max-w-md relative z-10 animate-scale-up">
            <h2 className="text-xl font-bold text-white mb-6">Lançar Despesa PJ</h2>
            
            <form onSubmit={handleSalvarDespesa} className="space-y-4">
              <div>
                <label className="label">Descrição do Gasto</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Ex: Assinatura Sistema, Internet" 
                  autoFocus
                  value={formDespesa.descricao}
                  onChange={e => setFormDespesa({...formDespesa, descricao: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input" 
                    placeholder="0,00"
                    value={formDespesa.valor}
                    onChange={e => setFormDespesa({...formDespesa, valor: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">Data</label>
                  <input 
                    type="date" 
                    className="input"
                    value={formDespesa.data}
                    onChange={e => setFormDespesa({...formDespesa, data: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="label">Categoria PJ</label>
                <select 
                  className="select"
                  value={formDespesa.categoria}
                  onChange={e => setFormDespesa({...formDespesa, categoria: e.target.value as any})}
                >
                  {CATEGORIAS_DESPESA.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 font-black">
                <button 
                  type="button" 
                  onClick={() => setNovaDespesaModal(false)} 
                  className="btn-ghost flex-1 uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1 uppercase tracking-widest text-xs"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exportador Avançado */}
      <ExportadorRelatorio 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />
    </div>
  );
}

function TrendingDown({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}
