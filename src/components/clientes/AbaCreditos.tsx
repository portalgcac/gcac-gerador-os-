import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, FileText, ArrowUpRight, CheckCircle2, History } from 'lucide-react';
import { Cliente, CreditoCliente } from '../../types';
import { useClientes } from '../../context/ClientesContext';
import { useOrdens } from '../../context/OrdensContext';
import { useAuth } from '../../context/AuthContext';
import { formatarMoeda, formatarDataHora, formatarNumeroOS, removerAcentos } from '../../utils/formatters';

export function AbaCreditos({ cliente, onSaldoChange }: { cliente: Cliente; onSaldoChange?: (saldo: number) => void }) {
  const navigate = useNavigate();
  const { buscarCreditos, adicionarCredito, deletarCredito } = useClientes();
  const { ordens, atualizarOrdem, registrarPagamento } = useOrdens();
  const { usuario } = useAuth();
  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');

  // Form Lançamento Manual
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  // Form Abater em O.S.
  const [showBaixaOS, setShowBaixaOS] = useState(false);
  const [osSelecionadaId, setOsSelecionadaId] = useState('');
  const [salvandoBaixaOS, setSalvandoBaixaOS] = useState(false);

  const ordensDoCliente = useMemo(() => {
    const cliCpf = (cliente.cpf || '').replace(/\D/g, '');
    const cliNome = removerAcentos((cliente.nome || '').trim().toUpperCase().replace(/\s+/g, ' '));
    return ordens.filter(o => {
      const oCpf = (o.cpf || '').replace(/\D/g, '');
      const oNome = removerAcentos((o.nomeCliente || '').trim().toUpperCase().replace(/\s+/g, ' '));
      return (cliCpf.length >= 11 && oCpf === cliCpf) || (cliNome.length > 0 && oNome === cliNome);
    });
  }, [ordens, cliente.cpf, cliente.nome]);

  const carregar = async () => {
    setCarregando(true);
    try {
      let data = await buscarCreditos(cliente.id);

      // Reconciliação automática: verifica se alguma O.S. do cliente foi paga com "Crédito de Cliente"
      // mas ainda não gerou o lançamento de saída no extrato de Haver
      let houveReconciliacao = false;
      for (const os of ordensDoCliente) {
        const pagsCredito = (os.historicoPagamentos || []).filter(p => p.metodo === 'Crédito de Cliente');
        let totalPagoComCreditoNaOS = pagsCredito.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        if (totalPagoComCreditoNaOS === 0 && os.formaPagamento === 'Crédito de Cliente' && os.status === 'Pago') {
          totalPagoComCreditoNaOS = os.valorPago || Math.max(0, os.valor - (os.desconto || 0));
        }

        if (totalPagoComCreditoNaOS > 0) {
          const numFormatado = formatarNumeroOS(os.numero);
          const movsDaOS = data.filter(
            c => c.origemId === os.id || (c.descricao && c.descricao.includes(numFormatado))
          );
          const totalSaidasRegistradas = movsDaOS
            .filter(c => c.tipo === 'saida')
            .reduce((acc, c) => acc + c.valor, 0);
          const totalEstornosRegistrados = movsDaOS
            .filter(c => c.tipo === 'entrada' && c.descricao.toLowerCase().includes('estorno'))
            .reduce((acc, c) => acc + c.valor, 0);

          const liquidoJaAbatido = Math.max(0, totalSaidasRegistradas - totalEstornosRegistrados);
          const diferencaPendente = Number((totalPagoComCreditoNaOS - liquidoJaAbatido).toFixed(2));

          if (diferencaPendente > 0) {
            const nomesServicos = (os.servicos || []).map(s => s.nome).join(', ');
            await adicionarCredito({
              clienteId: cliente.id,
              tipo: 'saida',
              valor: diferencaPendente,
              descricao: `Baixa referente à ${numFormatado}${nomesServicos ? ` — ${nomesServicos}` : ''}`,
              origemId: os.id,
              criadoPorNome: os.concluidoPorNome || os.criadoPorNome || usuario?.nome
            });
            houveReconciliacao = true;
          }
        }
      }

      if (houveReconciliacao) {
        data = await buscarCreditos(cliente.id);
      }

      setCreditos(data);
      const novoSaldo = data.reduce((acc, c) => acc + (c.tipo === 'entrada' ? c.valor : -c.valor), 0);
      onSaldoChange?.(novoSaldo);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [cliente.id, ordensDoCliente.length]);

  const totalEntradas = useMemo(
    () => creditos.filter(c => c.tipo === 'entrada').reduce((acc, c) => acc + c.valor, 0),
    [creditos]
  );
  const totalSaidas = useMemo(
    () => creditos.filter(c => c.tipo === 'saida').reduce((acc, c) => acc + c.valor, 0),
    [creditos]
  );
  const qtdBaixas = useMemo(
    () => creditos.filter(c => c.tipo === 'saida').length,
    [creditos]
  );
  const saldo = totalEntradas - totalSaidas;

  // Calcula o saldo acumulado (saldo restante após cada movimentação)
  const creditosComSaldoProgressivo = useMemo(() => {
    const ordenadosCronologicamente = [...creditos].sort(
      (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
    );
    let acumulado = 0;
    const mapaSaldoApos = new Map<string, number>();
    for (const c of ordenadosCronologicamente) {
      acumulado += c.tipo === 'entrada' ? c.valor : -c.valor;
      mapaSaldoApos.set(c.id, acumulado);
    }
    return creditos
      .filter(c => filtroTipo === 'todos' || c.tipo === filtroTipo)
      .map(c => ({
        ...c,
        saldoApos: mapaSaldoApos.get(c.id) ?? 0
      }));
  }, [creditos, filtroTipo]);

  // O.S. elegíveis para vincular/abater saldo em Haver (abertas ou pagas com outra forma sem baixa no Haver)
  const ordensElegiveisParaBaixa = useMemo(() => {
    return ordensDoCliente.filter(os => {
      if (os.status === 'Gratuidade') return false;
      const valorLiquido = Math.max(0, os.valor - (os.desconto || 0));
      if (valorLiquido <= 0) return false;
      const numFormatado = formatarNumeroOS(os.numero);
      const jaTemBaixaNoHaver = creditos.some(
        c => c.tipo === 'saida' && (c.origemId === os.id || (c.descricao && c.descricao.includes(numFormatado)))
      );
      return !jaTemBaixaNoHaver;
    });
  }, [ordensDoCliente, creditos]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valor.replace(/\D/g, '')) / 100;
    if (val <= 0 || !descricao.trim()) return;

    try {
      await adicionarCredito({
        clienteId: cliente.id,
        tipo,
        valor: val,
        descricao: descricao.trim(),
        criadoPorNome: usuario?.nome
      });
      setValor('');
      setDescricao('');
      setShowForm(false);
      carregar();
    } catch (error: any) {
      console.error('Erro ao salvar crédito:', error);
      alert(`Erro ao salvar crédito: ${error?.message || JSON.stringify(error) || 'Erro desconhecido'}`);
    }
  };

  const handleConfirmarBaixaOS = async (e: React.FormEvent) => {
    e.preventDefault();
    const os = ordensDoCliente.find(o => o.id === osSelecionadaId);
    if (!os) return;

    const valorLiquidoOS = Math.max(0, os.valor - (os.desconto || 0));
    const saldoDevedorOS = Math.max(0, valorLiquidoOS - (os.valorPago || 0));
    // Se a O.S. já estava marcada como Paga (ex: fechada como PIX por engano), converte o valor líquido da O.S. para Saldo em Haver
    const valorParaAbater = saldoDevedorOS > 0 ? Math.min(saldoDevedorOS, saldo) : Math.min(valorLiquidoOS, saldo);

    if (valorParaAbater <= 0) {
      alert('O cliente não possui saldo em Haver disponível para abater esta O.S.');
      return;
    }

    setSalvandoBaixaOS(true);
    try {
      const numFormatado = formatarNumeroOS(os.numero);
      const nomesServicos = (os.servicos || []).map(s => s.nome).join(', ');

      await adicionarCredito({
        clienteId: cliente.id,
        tipo: 'saida',
        valor: valorParaAbater,
        descricao: `Baixa referente à ${numFormatado}${nomesServicos ? ` — ${nomesServicos}` : ''}`,
        origemId: os.id,
        criadoPorNome: usuario?.nome
      });

      if (saldoDevedorOS > 0) {
        await registrarPagamento(os.id, valorParaAbater, 'Crédito de Cliente');
      } else {
        // Caso a O.S. já estivesse como Pago (ex: PIX), atualiza a forma de pagamento e o histórico para Crédito de Cliente
        const novoHistorico = (os.historicoPagamentos && os.historicoPagamentos.length > 0)
          ? os.historicoPagamentos.map((p, idx) => idx === 0 ? { ...p, metodo: 'Crédito de Cliente' as const } : p)
          : [{
              id: crypto.randomUUID(),
              valor: valorParaAbater,
              metodo: 'Crédito de Cliente' as const,
              data: new Date().toISOString()
            }];

        await atualizarOrdem(os.id, {
          formaPagamento: 'Crédito de Cliente',
          historicoPagamentos: novoHistorico,
          valorPago: valorLiquidoOS,
          status: 'Pago'
        });
      }

      setShowBaixaOS(false);
      setOsSelecionadaId('');
      await carregar();
    } catch (error: any) {
      console.error('Erro ao dar baixa na O.S. com saldo em Haver:', error);
      alert(`Erro ao dar baixa na O.S.: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSalvandoBaixaOS(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta movimentação? Isso afetará o saldo atual.')) {
      try {
        await deletarCredito(id);
        carregar();
      } catch (error: any) {
        console.error('Erro ao excluir crédito:', error);
        alert(`Erro ao excluir: ${error?.message || JSON.stringify(error) || 'Erro desconhecido'}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Painel de Controle de Saldo em Haver */}
      <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue shrink-0">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Saldo Atual Disponível em Haver</p>
              <p className={`text-2xl font-black ${saldo > 0 ? 'text-brand-green' : saldo < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                {formatarMoeda(saldo)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saldo > 0 && ordensElegiveisParaBaixa.length > 0 && !showBaixaOS && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setOsSelecionadaId(ordensElegiveisParaBaixa[0]?.id || '');
                  setShowBaixaOS(true);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-brand-green/15 text-brand-green-light border border-brand-green/30 hover:bg-brand-green/25 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} /> Dar Baixa em O.S.
              </button>
            )}
            {!showForm && (
              <button 
                type="button"
                onClick={() => {
                  setShowBaixaOS(false);
                  setShowForm(true);
                }}
                className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2"
              >
                <Plus size={15} /> Lançamento Manual
              </button>
            )}
          </div>
        </div>

        {/* Cards de Resumo: Créditos x Consumo (Baixas) x Saldo Atual */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-brand-dark-5">
          <div className="bg-brand-dark-2/70 rounded-lg p-3 border border-brand-dark-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Creditado (Entradas)</p>
              <p className="text-base font-black text-brand-green mt-0.5">+{formatarMoeda(totalEntradas)}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>

          <div className="bg-brand-dark-2/70 rounded-lg p-3 border border-brand-dark-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Consumido ({qtdBaixas} {qtdBaixas === 1 ? 'baixa' : 'baixas'})
              </p>
              <p className="text-base font-black text-red-400 mt-0.5">-{formatarMoeda(totalSaidas)}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
          </div>

          <div className="bg-brand-dark-2/70 rounded-lg p-3 border border-brand-dark-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Saldo Atual Restante</p>
              <p className={`text-base font-black mt-0.5 ${saldo > 0 ? 'text-brand-green' : saldo < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {formatarMoeda(saldo)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue-light flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal/Form para Dar Baixa do Saldo em uma O.S. do Cliente */}
      {showBaixaOS && (
        <form onSubmit={handleConfirmarBaixaOS} className="card bg-brand-dark-3 border-brand-green/30 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-brand-green" />
              Consumir Saldo em Haver em Ordem de Serviço
            </h4>
            <span className="text-xs font-bold text-brand-green bg-brand-green/10 px-2.5 py-1 rounded-full border border-brand-green/20">
              Disponível: {formatarMoeda(saldo)}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Selecione a Ordem de Serviço para registrar a baixa no Saldo em Haver e vincular a forma de pagamento da O.S. como <strong>Crédito de Cliente (Saldo em Haver)</strong>:
          </p>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Ordem de Serviço</label>
            <select
              value={osSelecionadaId}
              onChange={e => setOsSelecionadaId(e.target.value)}
              className="select w-full"
              required
            >
              {ordensElegiveisParaBaixa.map(os => {
                const valorLiq = Math.max(0, os.valor - (os.desconto || 0));
                const servs = (os.servicos || []).map(s => s.nome).join(', ');
                return (
                  <option key={os.id} value={os.id}>
                    {formatarNumeroOS(os.numero)} — {formatarMoeda(valorLiq)} ({os.status} • {os.formaPagamento}) {servs ? `— ${servs}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowBaixaOS(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvandoBaixaOS} className="btn-primary">
              {salvandoBaixaOS ? 'Registrando Baixa...' : 'Confirmar Baixa no Saldo'}
            </button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSalvar} className="card bg-brand-dark-3 border-brand-dark-5 space-y-4">
          <h4 className="text-sm font-bold text-white mb-2">Novo Lançamento Manual</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Tipo</label>
              <select 
                value={tipo} 
                onChange={(e) => setTipo(e.target.value as any)}
                className="select w-full"
              >
                <option value="entrada">Entrada (Adicionar Saldo)</option>
                <option value="saida">Saída / Baixa (Consumir Saldo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Valor</label>
              <input 
                type="text" 
                value={valor}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (!v) v = '0';
                  setValor((Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                className="input w-full"
                placeholder="0,00"
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-400 mb-1">Descrição</label>
              <input 
                type="text" 
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="input w-full"
                placeholder="Ex: Crédito referente a serviço, Baixa manual..."
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      )}

      <div className="card p-0 border-brand-dark-5 overflow-hidden">
        <div className="px-4 py-3 bg-brand-dark-3 border-b border-brand-dark-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History size={14} className="text-brand-blue-light" />
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Histórico de Movimentações e Baixas ({creditosComSaldoProgressivo.length})
            </h4>
          </div>
          <div className="flex items-center gap-1">
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'entrada', label: 'Entradas' },
              { id: 'saida', label: 'Baixas' },
            ] as const).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroTipo(f.id)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                  filtroTipo === f.id
                    ? 'bg-brand-blue text-white'
                    : 'bg-brand-dark-2 text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {carregando ? (
          <div className="p-8 text-center text-gray-500 text-sm">Carregando...</div>
        ) : creditosComSaldoProgressivo.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhuma movimentação encontrada para este filtro.</div>
        ) : (
          <div className="divide-y divide-brand-dark-5">
            {creditosComSaldoProgressivo.map(c => {
              const osVinculada = c.origemId
                ? ordensDoCliente.find(o => o.id === c.origemId)
                : ordensDoCliente.find(o => c.descricao?.includes(formatarNumeroOS(o.numero)));

              return (
                <div key={c.id} className="p-4 hover:bg-brand-dark-3/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      c.tipo === 'entrada' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {c.tipo === 'entrada' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                          c.tipo === 'entrada'
                            ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {c.tipo === 'entrada' ? 'Crédito / Entrada' : 'Baixa de Saldo'}
                        </span>
                        {osVinculada && (
                          <button
                            type="button"
                            onClick={() => navigate(`/ordens/${osVinculada.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-brand-blue/15 text-brand-blue-light border border-brand-blue/30 hover:bg-brand-blue/25 transition-colors"
                            title="Abrir Ordem de Serviço vinculada"
                          >
                            <FileText size={11} />
                            {formatarNumeroOS(osVinculada.numero)}
                            <ArrowUpRight size={11} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-bold text-white break-words">{c.descricao}</p>
                      {osVinculada && osVinculada.servicos && osVinculada.servicos.length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Serviço(s): <span className="text-gray-300 font-semibold">{osVinculada.servicos.map(s => s.nome).join(', ')}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-gray-500 mt-1">
                        {formatarDataHora(c.criadoEm)} {c.criadoPorNome ? `• Lançado por ${c.criadoPorNome}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <p className={`text-sm font-black ${c.tipo === 'entrada' ? 'text-brand-green' : 'text-red-400'}`}>
                        {c.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(c.valor)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        Saldo após: <span className="text-white font-bold">{formatarMoeda(c.saldoApos)}</span>
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleExcluir(c.id)}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir Lançamento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
