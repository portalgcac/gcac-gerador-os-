import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Plus, X, Sparkles, Filter } from 'lucide-react';
import { Agendamento } from '../../types';

interface CalendarioAgendamentosProps {
  agendamentos: Agendamento[];
  dataSelecionada: string | null;
  onSelectData: (data: string | null) => void;
  onNovoAgendamentoNaData?: (data: string) => void;
  statusFiltro?: 'pendente' | 'realizado';
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function CalendarioAgendamentos({
  agendamentos,
  dataSelecionada,
  onSelectData,
  onNovoAgendamentoNaData,
  statusFiltro = 'pendente'
}: CalendarioAgendamentosProps) {
  // Inicializa com a data selecionada ou com a data atual
  const [dataVisualizada, setDataVisualizada] = useState(() => {
    if (dataSelecionada) {
      const [ano, mes] = dataSelecionada.split('-').map(Number);
      return new Date(ano, mes - 1, 1);
    }
    return new Date();
  });

  const hoje = useMemo(() => {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const dia = String(now.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }, []);

  const anoAtual = dataVisualizada.getFullYear();
  const mesAtual = dataVisualizada.getMonth(); // 0 a 11

  // Navegação entre meses
  const mesAnterior = () => {
    setDataVisualizada(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const proximoMes = () => {
    setDataVisualizada(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const irParaHoje = () => {
    setDataVisualizada(new Date());
    onSelectData(hoje);
  };

  // Mapeia agendamentos por data (YYYY-MM-DD)
  const mapaAgendamentos = useMemo(() => {
    const mapa = new Map<string, { tiro: number; psicologico: number; total: number; itens: Agendamento[] }>();
    
    agendamentos.forEach(a => {
      if (!a.data) return;
      const atual = mapa.get(a.data) || { tiro: 0, psicologico: 0, total: 0, itens: [] };
      if (a.tipo === 'Tiro') {
        atual.tiro += 1;
      } else if (a.tipo === 'Psicológico') {
        atual.psicologico += 1;
      }
      atual.total += 1;
      atual.itens.push(a);
      mapa.set(a.data, atual);
    });

    return mapa;
  }, [agendamentos]);

  // Dias do mês
  const diasDoMes = useMemo(() => {
    const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay(); // 0 = Domingo
    const diasMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();

    const dias: Array<{
      dia: number;
      mesOffset: number; // -1: anterior, 0: atual, 1: seguinte
      dataIso: string;
      isHoje: boolean;
      dados?: { tiro: number; psicologico: number; total: number; itens: Agendamento[] };
    }> = [];

    // Dias do mês anterior para completar a primeira semana
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const d = diasMesAnterior - i;
      const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
      const dataIso = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        mesOffset: -1,
        dataIso,
        isHoje: dataIso === hoje,
        dados: mapaAgendamentos.get(dataIso)
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDias; d++) {
      const dataIso = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        mesOffset: 0,
        dataIso,
        isHoje: dataIso === hoje,
        dados: mapaAgendamentos.get(dataIso)
      });
    }

    // Dias do próximo mês para completar as semanas (múltiplo de 7)
    const restante = 7 - (dias.length % 7);
    if (restante < 7) {
      for (let d = 1; d <= restante; d++) {
        const mesProx = mesAtual === 11 ? 0 : mesAtual + 1;
        const anoProx = mesAtual === 11 ? anoAtual + 1 : anoAtual;
        const dataIso = `${anoProx}-${String(mesProx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dias.push({
          dia: d,
          mesOffset: 1,
          dataIso,
          isHoje: dataIso === hoje,
          dados: mapaAgendamentos.get(dataIso)
        });
      }
    }

    return dias;
  }, [anoAtual, mesAtual, mapaAgendamentos, hoje]);

  // Estatísticas do mês atual
  const statsMes = useMemo(() => {
    let laudosTiro = 0;
    let laudosPsico = 0;
    let diasOcupados = 0;
    let diasLivres = 0;

    const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

    for (let d = 1; d <= totalDiasMes; d++) {
      const dataIso = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = mapaAgendamentos.get(dataIso);
      if (info && info.total > 0) {
        diasOcupados++;
        laudosTiro += info.tiro;
        laudosPsico += info.psicologico;
      } else {
        diasLivres++;
      }
    }

    return {
      laudosTiro,
      laudosPsico,
      totalLaudos: laudosTiro + laudosPsico,
      diasOcupados,
      diasLivres
    };
  }, [anoAtual, mesAtual, mapaAgendamentos]);

  const dadosDataSelecionada = dataSelecionada ? mapaAgendamentos.get(dataSelecionada) : undefined;
  const isDataSelecionadaLivre = Boolean(dataSelecionada && (!dadosDataSelecionada || dadosDataSelecionada.total === 0));

  const formatarDataAmigavel = (iso: string) => {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Cabeçalho do Calendário */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-brand-dark-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-blue/15 text-brand-blue rounded-xl border border-brand-blue/30">
            <CalendarIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white capitalize">
                {NOMES_MESES[mesAtual]} <span className="text-gray-400 font-medium">{anoAtual}</span>
              </h2>
              {dataSelecionada && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30">
                  <Filter size={10} /> Filtro Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Clique em qualquer data para filtrar laudos ou verificar dias livres para agendar
            </p>
          </div>
        </div>

        {/* Controles de Navegação e Estatísticas do Mês */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Pills de Estatísticas */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-brand-dark-3/80 p-1 rounded-xl border border-brand-dark-5 text-[11px]">
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {statsMes.diasLivres} Livres
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              {statsMes.laudosTiro} Tiro
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 font-bold border border-purple-500/30">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              {statsMes.laudosPsico} Psico
            </span>
          </div>

          {/* Botões de Navegação */}
          <div className="flex items-center gap-1 bg-brand-dark-3 p-1 rounded-xl border border-brand-dark-5">
            <button
              onClick={mesAnterior}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-brand-dark-4 rounded-lg transition-all"
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={irParaHoje}
              className="px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white hover:bg-brand-dark-4 rounded-lg transition-all"
            >
              Hoje
            </button>
            <button
              onClick={proximoMes}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-brand-dark-4 rounded-lg transition-all"
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Legenda Visual */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-400 bg-brand-dark-3/40 px-3 py-2 rounded-xl border border-brand-dark-5/60">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
            <strong className="text-emerald-400">Data Livre</strong> (Sem Laudos)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-500/30" />
            <strong className="text-orange-400">Laudo de Tiro</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30" />
            <strong className="text-purple-400">Laudo Psicológico</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-blue ring-2 ring-brand-blue/30" />
            <strong className="text-brand-blue-light">Hoje</strong>
          </span>
        </div>

        {dataSelecionada && (
          <button
            onClick={() => onSelectData(null)}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-white transition-colors ml-auto"
          >
            <X size={13} /> Limpar Seleção
          </button>
        )}
      </div>

      {/* Grade de Dias da Semana */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {DIAS_SEMANA.map((dia, idx) => (
          <div
            key={dia}
            className={`text-center py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider ${
              idx === 0 || idx === 6 ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {dia}
          </div>
        ))}

        {/* Células dos Dias */}
        {diasDoMes.map((item, index) => {
          const isMesAtual = item.mesOffset === 0;
          const temLaudos = Boolean(item.dados && item.dados.total > 0);
          const isLivre = isMesAtual && !temLaudos;
          const isSelecionado = dataSelecionada === item.dataIso;

          return (
            <button
              key={`${item.dataIso}-${index}`}
              type="button"
              onClick={() => {
                if (isSelecionado) {
                  onSelectData(null);
                } else {
                  onSelectData(item.dataIso);
                }
              }}
              className={`min-h-[64px] sm:min-h-[82px] p-1 sm:p-2 rounded-xl text-left transition-all relative flex flex-col justify-between border ${
                !isMesAtual
                  ? 'opacity-30 border-transparent bg-brand-dark-3/20 hover:opacity-50'
                  : isSelecionado
                  ? 'bg-brand-blue/20 border-brand-blue ring-2 ring-brand-blue/50 shadow-lg shadow-brand-blue/20'
                  : temLaudos
                  ? 'bg-brand-dark-3/80 border-brand-dark-5 hover:border-brand-blue/40 hover:bg-brand-dark-3'
                  : 'bg-brand-dark-3/40 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/5'
              }`}
            >
              {/* Topo da Célula: Número do Dia + Indicador de Hoje */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    !isMesAtual
                      ? 'text-gray-600'
                      : item.isHoje
                      ? 'text-brand-blue font-black bg-brand-blue/20 px-1.5 py-0.5 rounded-md'
                      : isSelecionado
                      ? 'text-white font-black'
                      : temLaudos
                      ? 'text-white'
                      : 'text-gray-300'
                  }`}
                >
                  {item.dia}
                </span>

                {item.isHoje && (
                  <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-wider text-brand-blue">
                    Hoje
                  </span>
                )}
              </div>

              {/* Conteúdo / Marcadores de Laudos ou Data Livre */}
              <div className="w-full mt-1">
                {isMesAtual && (
                  <>
                    {temLaudos ? (
                      <div className="space-y-0.5">
                        {/* Badges de Tiro e Psicológico */}
                        <div className="flex flex-wrap gap-1">
                          {item.dados!.tiro > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-black bg-orange-500/25 text-orange-400 border border-orange-500/40"
                              title={`${item.dados!.tiro} Laudo(s) de Tiro`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              <span className="hidden sm:inline">Tiro:</span> {item.dados!.tiro}
                            </span>
                          )}
                          {item.dados!.psicologico > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-black bg-purple-500/25 text-purple-400 border border-purple-500/40"
                              title={`${item.dados!.psicologico} Laudo(s) Psicológico(s)`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span className="hidden sm:inline">Psi:</span> {item.dados!.psicologico}
                            </span>
                          )}
                        </div>

                        {/* Total de laudos no dia */}
                        <p className="text-[9px] text-gray-400 font-semibold truncate hidden sm:block">
                          {item.dados!.total} {item.dados!.total === 1 ? 'laudo' : 'laudos'}
                        </p>
                      </div>
                    ) : (
                      /* Marcador de Data Livre */
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Livre
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner Informativo quando há Data Selecionada */}
      {dataSelecionada && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-brand-dark-3 rounded-xl border border-brand-dark-5 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isDataSelecionadaLivre ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-blue/20 text-brand-blue'}`}>
              {isDataSelecionadaLivre ? <Sparkles size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">Data Selecionada:</span>
                <span className="text-sm font-black text-white">{formatarDataAmigavel(dataSelecionada)}</span>
                {isDataSelecionadaLivre ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                    Data Livre
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-brand-blue/20 text-brand-blue-light border border-brand-blue/40 uppercase">
                    {dadosDataSelecionada?.total} {dadosDataSelecionada?.total === 1 ? 'Laudo' : 'Laudos'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {isDataSelecionadaLivre
                  ? 'Esta data está totalmente livre de laudos agendados. Ideal para novos agendamentos.'
                  : `Filtrando ${dadosDataSelecionada?.tiro || 0} de tiro e ${dadosDataSelecionada?.psicologico || 0} psicológico(s).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDataSelecionadaLivre && onNovoAgendamentoNaData && (
              <button
                type="button"
                onClick={() => onNovoAgendamentoNaData(dataSelecionada)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Plus size={14} /> Agendar neste dia
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectData(null)}
              className="px-3 py-1.5 bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-300 hover:text-white rounded-lg text-xs font-bold border border-brand-dark-5 transition-all flex items-center gap-1"
            >
              <X size={14} /> Ver Todas as Datas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
