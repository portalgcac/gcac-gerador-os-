import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAgendamentos } from '../../context/AgendamentosContext';
import { useAuth } from '../../context/AuthContext';
import { CardAgendamento } from './CardAgendamento';
import { FormularioAgendamento } from './FormularioAgendamento';
import { ModalConfirmacaoAgendamento } from './ModalConfirmacaoAgendamento';
import { CalendarioAgendamentos } from './CalendarioAgendamentos';
import { Plus, Search, Calendar, ArrowLeft, CalendarDays, Filter, X } from 'lucide-react';
import { Agendamento, TipoAgendamento } from '../../types';
import { removerAcentos } from '../../utils/formatters';

export function ListaAgendamentos() {
  const { usuario } = useAuth();
  const location = useLocation();
  const { agendamentos, estaCarregando } = useAgendamentos();
  
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'pendente' | 'realizado'>('pendente');
  const [filtroTipo, setFiltroTipo] = useState<TipoAgendamento | 'Todos'>('Todos');
  const [modo, setModo] = useState<'lista' | 'novo' | 'editar'>('lista');
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [agendamentoVisualizando, setAgendamentoVisualizando] = useState<Agendamento | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [dataInicialForm, setDataInicialForm] = useState<string | undefined>(undefined);
  const [mostrarCalendario, setMostrarCalendario] = useState<boolean>(true);
  
  // Se vier do perfil do cliente, abre o formulário automático
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: any };
    if (state?.clientePreDefinido) {
      setDataInicialForm(undefined);
      setModo('novo');
    }
  }, [location]);

  const abrirNovoAgendamento = (dataPreDefinida?: string) => {
    setAgendamentoEditando(null);
    setDataInicialForm(dataPreDefinida);
    setModo('novo');
  };

  const agendamentosFiltrados = (agendamentos || []).filter(a => {
    const matchBusca = removerAcentos(a.clienteNome.toLowerCase()).includes(removerAcentos(busca.toLowerCase())) || 
                       a.clienteCPF.includes(busca);
    
    if (a.status !== statusFiltro) return false;

    const matchTipo = filtroTipo === 'Todos' || a.tipo === filtroTipo;
    if (!matchTipo) return false;

    if (dataSelecionada && a.data !== dataSelecionada) {
      return false;
    }

    return matchBusca;
  });

  const formatarDataBr = (iso: string) => {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  if (modo === 'novo' || modo === 'editar') {
    return (
      <div className="max-w-2xl mx-auto py-2">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => { setModo('lista'); setDataInicialForm(undefined); }}
            className="p-3 bg-brand-dark-3 text-gray-400 hover:text-white hover:bg-brand-dark-4 rounded-xl transition-all border border-brand-dark-5"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {modo === 'novo' ? 'Novo Agendamento de Laudo' : 'Editar Agendamento de Laudo'}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5 font-medium uppercase tracking-wider">
              {modo === 'novo' ? 'Preencha os detalhes do laudo' : 'Atualize as informações do agendamento'}
            </p>
          </div>
        </div>
        <FormularioAgendamento 
          agendamentoExistente={agendamentoEditando || undefined}
          dataInicial={dataInicialForm}
          onSuccess={() => { setModo('lista'); setDataInicialForm(undefined); }}
          onCancel={() => { setModo('lista'); setDataInicialForm(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-brand-blue" size={28} />
            Agendamentos de Laudos
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie seus laudos e facilite a comunicação com clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarCalendario(prev => !prev)}
            className={`px-4 py-3 h-12 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
              mostrarCalendario
                ? 'bg-brand-blue/20 text-brand-blue-light border-brand-blue/40 shadow-lg shadow-brand-blue/10'
                : 'bg-brand-dark-2 text-gray-300 border-brand-dark-5 hover:text-white hover:bg-brand-dark-3'
            }`}
          >
            <CalendarDays size={18} />
            {mostrarCalendario ? 'Ocultar Calendário' : 'Exibir Calendário'}
          </button>
          <button 
            onClick={() => abrirNovoAgendamento()}
            className="btn-primary shadow-lg shadow-brand-blue/20 px-6 py-3 h-12 flex items-center gap-2"
          >
            <Plus size={20} /> Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex bg-brand-dark-2 p-1 rounded-2xl border border-brand-dark-5 w-fit">
          <button 
            onClick={() => setStatusFiltro('pendente')}
            className={`py-2 px-6 rounded-xl text-sm font-bold transition-all ${
              statusFiltro === 'pendente' 
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20' 
                : 'text-gray-500 hover:text-white'
            }`}
          >
            Agendamentos de Laudos
          </button>
          <button 
            onClick={() => setStatusFiltro('realizado')}
            className={`py-2 px-6 rounded-xl text-sm font-bold transition-all ${
              statusFiltro === 'realizado' 
                ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20' 
                : 'text-gray-500 hover:text-white'
            }`}
          >
            Histórico
          </button>
        </div>
        
        <div className="relative flex-1 w-full flex items-center bg-brand-dark-2 p-1 rounded-2xl border border-brand-dark-5 shadow-lg">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CPF..."
              className="input pl-10 h-11 bg-transparent border-none"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 pr-2">
            <div className="w-[1px] h-6 bg-brand-dark-5 mx-2" />
            {(['Todos', 'Psicológico', 'Tiro'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${
                  filtroTipo === t 
                    ? 'bg-brand-dark-4 text-brand-blue-light border border-brand-blue/20' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendário Interativo de Laudos */}
      {mostrarCalendario && (
        <CalendarioAgendamentos
          agendamentos={(agendamentos || []).filter(a => a.status === statusFiltro)}
          dataSelecionada={dataSelecionada}
          onSelectData={setDataSelecionada}
          onNovoAgendamentoNaData={abrirNovoAgendamento}
          statusFiltro={statusFiltro}
        />
      )}

      {/* Barra de Filtro Ativo de Data */}
      {dataSelecionada && (
        <div className="flex items-center justify-between bg-brand-dark-2 px-4 py-2.5 rounded-xl border border-brand-blue/30 text-xs">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-brand-blue" />
            <span className="text-gray-400">Filtrando laudos para a data:</span>
            <strong className="text-white font-mono bg-brand-dark-3 px-2 py-0.5 rounded border border-brand-dark-5">
              {formatarDataBr(dataSelecionada)}
            </strong>
            <span className="text-gray-500">
              ({agendamentosFiltrados.length} {agendamentosFiltrados.length === 1 ? 'resultado encontrado' : 'resultados encontrados'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDataSelecionada(null)}
            className="text-gray-400 hover:text-white flex items-center gap-1 font-bold transition-colors"
          >
            <X size={14} /> Mostrar todas as datas
          </button>
        </div>
      )}

      {estaCarregando ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium animate-pulse">Carregando agendamentos...</p>
        </div>
      ) : agendamentosFiltrados.length === 0 ? (
        <div className="bg-brand-dark-2 border-2 border-brand-dark-5 border-dashed rounded-3xl py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-brand-dark-3 rounded-full flex items-center justify-center mb-6 border border-brand-dark-5">
            <Calendar size={32} className="text-gray-600" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">
            {dataSelecionada
              ? `Nenhum agendamento em ${formatarDataBr(dataSelecionada)} (Data Livre)`
              : 'Nenhum agendamento encontrado'}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-4">
            {dataSelecionada
              ? 'Esta data está livre! Você pode agendar novos laudos de tiro ou psicológicos para este dia.'
              : busca || filtroTipo !== 'Todos' 
              ? 'Não encontramos nenhum registro para os filtros aplicados.' 
              : 'Você ainda não registrou nenhum agendamento de laudo. Comece agora para manter o controle total.'}
          </p>
          {dataSelecionada && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => abrirNovoAgendamento(dataSelecionada)}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
              >
                <Plus size={16} /> Agendar Laudo nesta Data
              </button>
              <button
                type="button"
                onClick={() => setDataSelecionada(null)}
                className="px-4 py-2 bg-brand-dark-3 hover:bg-brand-dark-4 text-gray-300 rounded-xl text-xs font-bold border border-brand-dark-5 transition-all"
              >
                Ver Todas as Datas
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Coluna: Laudos de Tiro */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-6 bg-orange-500 rounded-full" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Laudo de Tiro</h2>
              <span className="ml-auto bg-brand-dark-3 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-brand-dark-5">
                {agendamentosFiltrados.filter(a => a.tipo === 'Tiro').length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agendamentosFiltrados.filter(a => a.tipo === 'Tiro').map(a => (
                <CardAgendamento 
                  key={a.id} 
                  agendamento={a} 
                  onEdit={a => { setAgendamentoEditando(a); setModo('editar'); }}
                  onView={a => setAgendamentoVisualizando(a)}
                />
              ))}
              {agendamentosFiltrados.filter(a => a.tipo === 'Tiro').length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center bg-brand-dark-2/50 border border-dashed border-brand-dark-5 rounded-2xl">
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-tighter">
                    {dataSelecionada ? `Sem agendamentos de tiro em ${formatarDataBr(dataSelecionada)}` : 'Sem agendamentos de tiro'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna: Laudos Psicológicos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-6 bg-purple-500 rounded-full" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Laudo Psicológico</h2>
              <span className="ml-auto bg-brand-dark-3 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-brand-dark-5">
                {agendamentosFiltrados.filter(a => a.tipo === 'Psicológico').length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agendamentosFiltrados.filter(a => a.tipo === 'Psicológico').map(a => (
                <CardAgendamento 
                  key={a.id} 
                  agendamento={a} 
                  onEdit={a => { setAgendamentoEditando(a); setModo('editar'); }}
                  onView={a => setAgendamentoVisualizando(a)}
                />
              ))}
              {agendamentosFiltrados.filter(a => a.tipo === 'Psicológico').length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center bg-brand-dark-2/50 border border-dashed border-brand-dark-5 rounded-2xl">
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-tighter">
                    {dataSelecionada ? `Sem agendamentos psicológicos em ${formatarDataBr(dataSelecionada)}` : 'Sem agendamentos psicológicos'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {agendamentoVisualizando && (
        <ModalConfirmacaoAgendamento 
          agendamento={agendamentoVisualizando} 
          onClose={() => setAgendamentoVisualizando(null)} 
        />
      )}
    </div>
  );
}
