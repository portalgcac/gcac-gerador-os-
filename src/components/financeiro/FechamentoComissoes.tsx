import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrdens } from '../../context/OrdensContext';
import { isSameMonth, parseISO } from 'date-fns';
import { DollarSign, CheckCircle, List, User } from 'lucide-react';
import { formatarMoeda, formatarData, formatarNumeroOS } from '../../utils/formatters';

interface FechamentoComissoesProps {
  dataFiltro: Date;
}

interface ServicoComissao {
  id: string;
  ordemId: string;
  ordemNumero: number;
  clienteNome: string;
  servicoNome: string;
  dataConclusaoOS: string;
  responsavelNome: string;
  valorRepasse: number;
}

export function FechamentoComissoes({ dataFiltro }: FechamentoComissoesProps) {
  const navigate = useNavigate();
  const { ordens } = useOrdens();

  const dadosAgrupados = useMemo(() => {
    const comissoes: ServicoComissao[] = [];

    // Filtra ordens que foram pagas e tiveram alguma atividade (criadas ou atualizadas)
    // Para ser mais preciso, vamos pegar as ordens que o "status" atual é Pago
    // E que a última atualização ou conclusão caiu no mês selecionado.
    // Mas uma abordagem mais simples é pegar ordens atualizadas no mês selecionado
    // e que estejam com status Pago. Se a pessoa pagou mês passado e concluiu serviço este mês?
    // Geralmente a comissão é paga quando a O.S. está 'Paga' E o serviço está 'Concluído'.
    // Vamos filtrar as O.S. que estão Pagas:
    const ordensPagas = ordens.filter(o => o.status === 'Pago');

    ordensPagas.forEach(o => {
      // Verifica os serviços
      (o.servicos || []).forEach(s => {
        if (s.statusExecucao === 'Concluído' && s.responsavelNome && s.valorRepasse) {
          // Precisamos saber se a comissão pertence ao mês atual do filtro.
          // Como não temos uma "data de conclusão do serviço" exata por serviço de forma fácil,
          // vamos usar a data de atualização da O.S. (`atualizadoEm`) como referência,
          // que é quando a O.S. possivelmente foi finalizada ou o serviço foi marcado como concluído.
          
          if (isSameMonth(parseISO(o.atualizadoEm), dataFiltro)) {
            comissoes.push({
              id: `${o.id}-${s.id}`,
              ordemId: o.id,
              ordemNumero: o.numero,
              clienteNome: o.nomeCliente,
              servicoNome: s.nome,
              dataConclusaoOS: o.atualizadoEm,
              responsavelNome: s.responsavelNome,
              valorRepasse: s.valorRepasse
            });
          }
        }
      });
    });

    comissoes.sort((a, b) => new Date(b.dataConclusaoOS).getTime() - new Date(a.dataConclusaoOS).getTime());

    // Agrupa por colaborador
    const porColaborador: Record<string, { total: number, servicos: ServicoComissao[] }> = {};
    
    comissoes.forEach(c => {
      if (!porColaborador[c.responsavelNome]) {
        porColaborador[c.responsavelNome] = { total: 0, servicos: [] };
      }
      porColaborador[c.responsavelNome].servicos.push(c);
      porColaborador[c.responsavelNome].total += c.valorRepasse;
    });

    return {
      comissoes,
      porColaborador,
      totalGeral: comissoes.reduce((acc, c) => acc + c.valorRepasse, 0)
    };
  }, [ordens, dataFiltro]);

  const colaboradores = Object.keys(dadosAgrupados.porColaborador).sort();

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card border-brand-green/20 bg-brand-green/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-green" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total de Repasses (Mês)</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(dadosAgrupados.totalGeral)}</p>
          <div className="mt-2 text-[10px] text-gray-500 font-bold uppercase">
            Valor devido à equipe por serviços concluídos em OS Pagas
          </div>
          <DollarSign size={80} className="absolute -right-4 -bottom-4 text-brand-green/5" />
        </div>
        
        <div className="card border-brand-blue/20 bg-brand-blue/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-blue" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Serviços Comissionados</p>
          <p className="text-2xl font-black text-white">{dadosAgrupados.comissoes.length}</p>
          <div className="mt-2 text-[10px] text-gray-500 font-bold uppercase">
            Quantidade de serviços executados e pagos
          </div>
          <CheckCircle size={80} className="absolute -right-4 -bottom-4 text-brand-blue/5" />
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="card p-10 text-center border-dashed border-brand-dark-5">
          <DollarSign size={32} className="mx-auto text-brand-dark-5 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Nenhum repasse registrado neste mês.</h3>
          <p className="text-xs text-gray-500 mt-1">
            Certifique-se de que os serviços possuem um <b>Responsável</b> e <b>Repasse</b>, estão <b>Concluídos</b> e a O.S. está <b>Paga</b>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {colaboradores.map(nome => {
            const dados = dadosAgrupados.porColaborador[nome];
            return (
              <div key={nome} className="card p-0 overflow-hidden border-brand-dark-5">
                <div className="p-4 border-b border-brand-dark-5 flex items-center justify-between bg-brand-dark-3/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-blue/20 text-brand-blue-light flex items-center justify-center font-bold">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">{nome}</h3>
                      <p className="text-xs text-gray-500">{dados.servicos.length} serviço(s) faturado(s)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Total a Pagar</p>
                    <p className="text-lg font-black text-brand-green">{formatarMoeda(dados.total)}</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-brand-dark-3 border-b border-brand-dark-5">
                      <tr>
                        <th className="table-header">Data (OS)</th>
                        <th className="table-header">O.S.</th>
                        <th className="table-header">Cliente</th>
                        <th className="table-header">Serviço Executado</th>
                        <th className="table-header text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark-5/30">
                      {dados.servicos.map(s => (
                        <tr key={s.id} className="hover:bg-brand-dark-4 transition-colors">
                          <td className="table-cell font-mono text-[11px] whitespace-nowrap">
                            {formatarData(s.dataConclusaoOS)}
                          </td>
                          <td className="table-cell">
                            <button 
                              onClick={() => navigate(`/ordens/${s.ordemId}`)}
                              className="font-bold text-white hover:text-brand-blue hover:underline transition-all"
                            >
                              #{String(s.ordemNumero).padStart(4, '0')}
                            </button>
                          </td>
                          <td className="table-cell text-gray-300">
                            {s.clienteNome}
                          </td>
                          <td className="table-cell">
                            <span className="text-xs font-semibold text-brand-blue-light">
                              {s.servicoNome}
                            </span>
                          </td>
                          <td className="table-cell font-black text-brand-green text-right">
                            {formatarMoeda(s.valorRepasse)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
