import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crosshair, Plus, Search, Filter, LayoutGrid, Table as TableIcon,
  Sparkles, DollarSign, CheckCircle2, Clock, ShieldCheck, Tag,
  MoreVertical, Edit3, Trash2, Eye, Share2, ArrowRight, User, Phone,
  FileText, Check, AlertCircle, ShoppingBag
} from 'lucide-react';
import { ArmaVenda, StatusArmaVenda } from '../types';
import { useArmasVenda } from '../context/ArmasVendaContext';
import { ModalFormArmaVenda } from '../components/armasVenda/ModalFormArmaVenda';
import { ModalGeradorAnuncio } from '../components/armasVenda/ModalGeradorAnuncio';
import { formatarMoeda } from '../utils/formatters';

const STATUS_CONFIG: Record<StatusArmaVenda, { label: string; cor: string; bg: string; border: string }> = {
  disponivel: {
    label: 'Disponível',
    cor: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30'
  },
  reservada: {
    label: 'Em Negociação / Reservada',
    cor: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30'
  },
  em_transferencia: {
    label: 'Em Transferência (SIGMA/SINARM)',
    cor: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30'
  },
  vendida: {
    label: 'Vendida / Concluída',
    cor: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30'
  },
  devolvida: {
    label: 'Devolvida ao Dono',
    cor: 'text-gray-400',
    bg: 'bg-gray-500/15',
    border: 'border-gray-500/30'
  }
};

export function ArmasVendaPage() {
  const navigate = useNavigate();
  const {
    armasVenda,
    carregando,
    criarArmaVenda,
    atualizarArmaVenda,
    deletarArmaVenda,
    alterarStatus
  } = useArmasVenda();

  // Estados de Visualização e Filtros
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'tabela'>('cards');
  const [busca, setBusca] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Modais
  const [modalFormAberto, setModalFormAberto] = useState<boolean>(false);
  const [armaParaEditar, setArmaParaEditar] = useState<ArmaVenda | null>(null);

  const [modalAnuncioAberto, setModalAnuncioAberto] = useState<boolean>(false);
  const [armaSelecionadaAnuncio, setArmaSelecionadaAnuncio] = useState<ArmaVenda | null>(null);

  // Modal Venda / Conclusão
  const [modalVendaAberto, setModalVendaAberto] = useState<boolean>(false);
  const [armaParaVender, setArmaParaVender] = useState<ArmaVenda | null>(null);
  const [compradorNome, setCompradorNome] = useState<string>('');
  const [compradorTelefone, setCompradorTelefone] = useState<string>('');
  const [compradorCpf, setCompradorCpf] = useState<string>('');

  // Métricas / KPIs
  const metricas = useMemo(() => {
    const total = armasVenda.length;
    const disponiveis = armasVenda.filter(a => a.status === 'disponivel').length;
    const reservadas = armasVenda.filter(a => a.status === 'reservada' || a.status === 'em_transferencia').length;
    const vendidas = armasVenda.filter(a => a.status === 'vendida');

    const totalLucroRealizado = vendidas.reduce((acc, a) => acc + (a.lucroEstimado || 0), 0);
    const totalComissaoPrevista = armasVenda
      .filter(a => a.status === 'disponivel')
      .reduce((acc, a) => acc + (a.lucroEstimado || 0), 0);

    return {
      total,
      disponiveis,
      reservadas,
      totalVendidas: vendidas.length,
      totalLucroRealizado,
      totalComissaoPrevista
    };
  }, [armasVenda]);

  // Lista Filtrada
  const armasFiltradas = useMemo(() => {
    return armasVenda.filter(arma => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !busca.trim() ||
        arma.modelo.toLowerCase().includes(termo) ||
        arma.fabricante.toLowerCase().includes(termo) ||
        arma.calibre.toLowerCase().includes(termo) ||
        arma.proprietarioNome.toLowerCase().includes(termo) ||
        (arma.numeroSerie && arma.numeroSerie.toLowerCase().includes(termo));

      const matchStatus = filtroStatus === 'todos' || arma.status === filtroStatus;

      return matchBusca && matchStatus;
    });
  }, [armasVenda, busca, filtroStatus]);

  // Handlers
  const handleAbrirNovo = () => {
    setArmaParaEditar(null);
    setModalFormAberto(true);
  };

  const handleAbrirEditar = (arma: ArmaVenda) => {
    setArmaParaEditar(arma);
    setModalFormAberto(true);
  };

  const handleAbrirAnuncio = (arma: ArmaVenda) => {
    setArmaSelecionadaAnuncio(arma);
    setModalAnuncioAberto(true);
  };

  const handleSalvarArma = async (dados: any) => {
    if (armaParaEditar) {
      await atualizarArmaVenda(armaParaEditar.id, dados);
    } else {
      await criarArmaVenda(dados);
    }
  };

  const handleExcluirArma = async (arma: ArmaVenda) => {
    if (confirm(`Tem certeza que deseja remover ${arma.fabricante} ${arma.modelo} do catálogo?`)) {
      await deletarArmaVenda(arma.id);
    }
  };

  const handleMudarStatusRapido = async (arma: ArmaVenda, novoStatus: StatusArmaVenda) => {
    if (novoStatus === 'vendida') {
      setArmaParaVender(arma);
      setCompradorNome(arma.compradorNome || '');
      setCompradorTelefone(arma.compradorTelefone || '');
      setCompradorCpf(arma.compradorCpf || '');
      setModalVendaAberto(true);
    } else {
      await alterarStatus(arma.id, novoStatus);
    }
  };

  const handleConfirmarVenda = async () => {
    if (!armaParaVender) return;
    await alterarStatus(armaParaVender.id, 'vendida', {
      compradorNome,
      compradorTelefone,
      compradorCpf
    });
    setModalVendaAberto(false);
  };

  return (
    <div className="space-y-6">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Crosshair size={24} />
            </span>
            Armas à Venda
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Catálogo de armas seminovas e consignadas sob intermediação do escritório
          </p>
        </div>

        <button
          onClick={handleAbrirNovo}
          className="btn-primary flex items-center gap-2 text-xs font-bold px-4 py-2.5 shadow-lg shadow-amber-500/10"
        >
          <Plus size={16} /> Cadastrar Arma para Venda
        </button>
      </div>

      {/* CARDS DE MÉTRICAS / KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-brand-dark-2 border border-brand-dark-5 rounded-2xl">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Total no Catálogo</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white">{metricas.total}</span>
            <span className="text-xs text-gray-500 font-medium">armas</span>
          </div>
        </div>

        <div className="card p-4 bg-brand-dark-2 border border-emerald-500/20 rounded-2xl">
          <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider block">Disponíveis</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-300">{metricas.disponiveis}</span>
            <span className="text-xs text-emerald-400/80 font-medium">
              +{formatarMoeda(metricas.totalComissaoPrevista)} margem
            </span>
          </div>
        </div>

        <div className="card p-4 bg-brand-dark-2 border border-amber-500/20 rounded-2xl">
          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider block">Em Negociação / Res.</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-300">{metricas.reservadas}</span>
            <span className="text-xs text-amber-400/80 font-medium">em andamento</span>
          </div>
        </div>

        <div className="card p-4 bg-brand-dark-2 border border-purple-500/20 rounded-2xl">
          <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider block">Comissão Realizada</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-purple-300">{formatarMoeda(metricas.totalLucroRealizado)}</span>
            <span className="text-xs text-purple-400/80 font-medium">{metricas.totalVendidas} vendida(s)</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="card p-4 bg-brand-dark-2 border border-brand-dark-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Campo de Busca */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar modelo, marca, calibre, dono..."
            className="input w-full pl-9 text-xs py-2 bg-brand-dark-3"
          />
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            type="button"
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroStatus === 'todos'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-brand-dark-3 text-gray-400 hover:text-white'
            }`}
          >
            Todos ({armasVenda.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('disponivel')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroStatus === 'disponivel'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-brand-dark-3 text-gray-400 hover:text-white'
            }`}
          >
            Disponíveis ({metricas.disponiveis})
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('reservada')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroStatus === 'reservada'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-brand-dark-3 text-gray-400 hover:text-white'
            }`}
          >
            Reservadas
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('vendida')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroStatus === 'vendida'
                ? 'bg-purple-500 text-black shadow-md'
                : 'bg-brand-dark-3 text-gray-400 hover:text-white'
            }`}
          >
            Vendidas ({metricas.totalVendidas})
          </button>
        </div>

        {/* Alternância Cards / Tabela */}
        <div className="flex items-center bg-brand-dark-3 p-1 rounded-xl border border-brand-dark-5 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setModoVisualizacao('cards')}
            title="Visualização em Cards"
            className={`p-1.5 rounded-lg transition-colors ${
              modoVisualizacao === 'cards' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao('tabela')}
            title="Visualização em Tabela"
            className={`p-1.5 rounded-lg transition-colors ${
              modoVisualizacao === 'tabela' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <TableIcon size={16} />
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: CARDS OU TABELA */}
      {carregando ? (
        <div className="p-16 text-center text-gray-500 text-xs">
          Carregando catálogo de armas...
        </div>
      ) : armasFiltradas.length === 0 ? (
        <div className="card p-12 text-center bg-brand-dark-2 border border-brand-dark-5 rounded-2xl">
          <Crosshair size={40} className="mx-auto text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-300">Nenhuma arma encontrada</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {busca || filtroStatus !== 'todos'
              ? 'Nenhum resultado corresponde aos filtros aplicados.'
              : 'Você ainda não cadastrou nenhuma arma à venda. Clique no botão acima para cadastrar a primeira!'}
          </p>
          {!busca && filtroStatus === 'todos' && (
            <button
              onClick={handleAbrirNovo}
              className="mt-4 btn-primary text-xs px-4 py-2"
            >
              + Cadastrar Arma Agora
            </button>
          )}
        </div>
      ) : modoVisualizacao === 'cards' ? (
        /* MODO VITRINE (CARDS) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {armasFiltradas.map(arma => {
            const statusCfg = STATUS_CONFIG[arma.status] || STATUS_CONFIG.disponivel;
            const foto = arma.fotoPrincipal || (arma.fotos && arma.fotos[0]) || '';

            return (
              <div
                key={arma.id}
                className="bg-brand-dark-2 border border-brand-dark-5 hover:border-brand-dark-4 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col group"
              >
                {/* Imagem de Capa com Badges */}
                <div className="relative aspect-video bg-black/60 overflow-hidden">
                  {foto ? (
                    <img
                      src={foto}
                      alt={`${arma.fabricante} ${arma.modelo}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                      <Crosshair size={32} />
                      <span className="text-[11px] font-semibold">Sem Foto Cadastrada</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border backdrop-blur-md ${statusCfg.bg} ${statusCfg.cor} ${statusCfg.border}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Calibre Badge */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[11px] font-bold text-amber-400">
                    {arma.calibre}
                  </div>

                  {/* Localização da Arma */}
                  <div className="absolute bottom-2 left-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300">
                    {arma.localArma === 'loja_custodia' ? '📍 No cofre da loja' : '🏠 Com o proprietário'}
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-blue-light uppercase tracking-wider">
                        {arma.fabricante} • {arma.tipo}
                      </span>
                      {arma.capacidade && (
                        <span className="text-[10px] font-semibold text-gray-400">
                          Cap: {arma.capacidade}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-white mt-1">
                      {arma.modelo}
                    </h3>

                    {/* Tags Rápidas */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5 text-[10px]">
                      {arma.sigmaSinarm && (
                        <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-bold">
                          {arma.sigmaSinarm}
                        </span>
                      )}
                      <span className="bg-brand-dark-3 text-gray-300 px-2 py-0.5 rounded border border-brand-dark-5">
                        {arma.estadoConservacao}
                      </span>
                      {arma.acabamento && (
                        <span className="bg-brand-dark-3 text-gray-300 px-2 py-0.5 rounded border border-brand-dark-5">
                          {arma.acabamento}
                        </span>
                      )}
                      {arma.quantidadeCarregadores ? (
                        <span className="bg-brand-dark-3 text-gray-300 px-2 py-0.5 rounded border border-brand-dark-5">
                          {arma.quantidadeCarregadores} carregador(es)
                        </span>
                      ) : null}
                    </div>

                    {arma.acessorios && (
                      <p className="text-[11px] text-gray-400 mt-2 line-clamp-1 italic">
                        Incluso: {arma.acessorios}
                      </p>
                    )}
                  </div>

                  {/* Preços e Bloco Administrativo */}
                  <div className="mt-4 pt-4 border-t border-brand-dark-5/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Valor Anunciado</span>
                        <span className="text-lg font-black text-emerald-400">
                          {formatarMoeda(arma.valorAnunciado)}
                        </span>
                      </div>

                      {/* Lucro Previsto (Sigiloso / Gestor) */}
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Sua Comissão</span>
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          +{formatarMoeda(arma.lucroEstimado)} ({arma.comissaoTipo === 'percentual' ? `${arma.comissaoValor}%` : 'Fixo'})
                        </span>
                      </div>
                    </div>

                    {/* Dono Original (Sigiloso) */}
                    <div className="bg-brand-dark-3/60 p-2 rounded-xl text-[11px] flex items-center justify-between border border-brand-dark-5">
                      <div className="flex items-center gap-1.5 text-gray-300 truncate">
                        <User size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{arma.proprietarioNome}</span>
                      </div>
                      {arma.proprietarioTelefone && (
                        <a
                          href={`https://wa.me/55${arma.proprietarioTelefone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Chamar proprietário no WhatsApp"
                          className="text-emerald-400 hover:text-emerald-300 shrink-0 ml-1"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                    </div>

                    {/* Botões de Ação do Card */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Botão de Anúncio Flyer */}
                      <button
                        type="button"
                        onClick={() => handleAbrirAnuncio(arma)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 font-bold text-xs transition-colors"
                      >
                        <Sparkles size={14} /> Gerar Anúncio
                      </button>

                      {/* Dropdown de Status Rápido */}
                      <select
                        value={arma.status}
                        onChange={e => handleMudarStatusRapido(arma, e.target.value as StatusArmaVenda)}
                        className="bg-brand-dark-3 text-xs text-gray-300 rounded-xl px-2.5 py-2 border border-brand-dark-5 focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                      >
                        <option value="disponivel">Disponível</option>
                        <option value="reservada">Em Negociação</option>
                        <option value="em_transferencia">Em Transferência</option>
                        <option value="vendida">✓ Vendida</option>
                        <option value="devolvida">Devolvida ao Dono</option>
                      </select>
                    </div>

                    {/* Ações Secundárias (Editar / Excluir) */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleAbrirEditar(arma)}
                        className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Edit3 size={12} /> Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExcluirArma(arma)}
                        className="text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODO TABELA GERENCIAL */
        <div className="card bg-brand-dark-2 border border-brand-dark-5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-dark-3/70 border-b border-brand-dark-5 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Arma / Modelo</th>
                  <th className="p-3.5">Calibre</th>
                  <th className="p-3.5">Proprietário (Dono)</th>
                  <th className="p-3.5">Preço Anunciado</th>
                  <th className="p-3.5">Sua Comissão</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5/60 text-gray-300">
                {armasFiltradas.map(arma => {
                  const statusCfg = STATUS_CONFIG[arma.status] || STATUS_CONFIG.disponivel;
                  return (
                    <tr key={arma.id} className="hover:bg-brand-dark-3/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{arma.fabricante} {arma.modelo}</span>
                          {arma.fotos && arma.fotos.length > 0 && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                              {arma.fotos.length} foto(s)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">{arma.tipo} • {arma.estadoConservacao}</div>
                      </td>
                      <td className="p-3.5 font-bold text-amber-400">{arma.calibre}</td>
                      <td className="p-3.5">
                        <div className="font-medium text-gray-200">{arma.proprietarioNome}</div>
                        <div className="text-[11px] text-gray-500">{arma.proprietarioTelefone || 'Sem tel'}</div>
                      </td>
                      <td className="p-3.5 font-extrabold text-emerald-400">
                        {formatarMoeda(arma.valorAnunciado)}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-amber-300">
                          +{formatarMoeda(arma.lucroEstimado)}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          {arma.comissaoTipo === 'percentual' ? `${arma.comissaoValor}%` : 'Fixo'}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.cor} ${statusCfg.border}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleAbrirAnuncio(arma)}
                            title="Gerar Anúncio / Imagem"
                            className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                          >
                            <Sparkles size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirEditar(arma)}
                            title="Editar"
                            className="p-1.5 rounded-lg bg-brand-dark-3 text-gray-300 hover:text-white transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirArma(arma)}
                            title="Excluir"
                            className="p-1.5 rounded-lg bg-brand-dark-3 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <ModalFormArmaVenda
        armaParaEditar={armaParaEditar}
        isOpen={modalFormAberto}
        onClose={() => setModalFormAberto(false)}
        onSalvar={handleSalvarArma}
      />

      {/* MODAL DO GERADOR DE ANÚNCIO (FLYER & WHATSAPP) */}
      {armaSelecionadaAnuncio && (
        <ModalGeradorAnuncio
          arma={armaSelecionadaAnuncio}
          isOpen={modalAnuncioAberto}
          onClose={() => {
            setModalAnuncioAberto(false);
            setArmaSelecionadaAnuncio(null);
          }}
        />
      )}

      {/* MODAL DE REGISTRO DE VENDA (COM GATILHO PARA ORDEM DE SERVIÇO) */}
      {modalVendaAberto && armaParaVender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Marcar como Vendida</h3>
                <p className="text-xs text-gray-400">
                  {armaParaVender.fabricante} {armaParaVender.modelo} • Comissão: {formatarMoeda(armaParaVender.lucroEstimado)}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Nome do Comprador (Opcional)</label>
                <input
                  type="text"
                  value={compradorNome}
                  onChange={e => setCompradorNome(e.target.value)}
                  placeholder="Nome do cliente que comprou"
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">Telefone / WhatsApp do Comprador</label>
                <input
                  type="text"
                  value={compradorTelefone}
                  onChange={e => setCompradorTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="input w-full text-xs"
                />
              </div>

              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <FileText size={14} /> Deseja abrir a Ordem de Serviço de Transferência?
                </span>
                <p className="text-[11px] text-gray-300">
                  Você pode gerar agora o processo de transferência bélica para o comprador!
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark-5">
              <button
                type="button"
                onClick={() => setModalVendaAberto(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarVenda}
                className="btn-primary px-4 py-2 text-xs font-bold"
              >
                Confirmar Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
