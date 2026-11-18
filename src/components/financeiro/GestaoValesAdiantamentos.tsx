import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Printer, 
  Plus, 
  Trash2, 
  FileText, 
  ExternalLink, 
  Search, 
  ShieldCheck, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';
import { ValeColaborador } from '../../types';
import { listarVales, excluirVale } from '../../services/valesColaboradoresService';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarReciboValePdf } from '../../utils/reciboValePdf';
import { useAuth } from '../../context/AuthContext';
import { ModalEmitirVale } from './ModalEmitirVale';
import { ModalConfirmarVale } from './ModalConfirmarVale';

interface GestaoValesAdiantamentosProps {
  modo?: 'gestor' | 'colaborador';
  colaboradorFiltroEmail?: string;
  listaColaboradores?: Array<{
    id?: string;
    nome: string;
    cpf?: string;
    email?: string;
  }>;
}

export function GestaoValesAdiantamentos({
  modo = 'gestor',
  colaboradorFiltroEmail,
  listaColaboradores = []
}: GestaoValesAdiantamentosProps) {
  const { usuario } = useAuth();
  const [vales, setVales] = useState<ValeColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'confirmado'>('todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [valeParaConfirmar, setValeParaConfirmar] = useState<ValeColaborador | null>(null);

  const carregarDados = async () => {
    if (!usuario?.empresaId) return;
    setCarregando(true);
    try {
      const email = modo === 'colaborador' ? (colaboradorFiltroEmail || usuario.email) : undefined;
      const dados = await listarVales(usuario.empresaId, email);
      setVales(dados);
    } catch (err) {
      console.error('Erro ao listar vales:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [usuario?.empresaId, modo, colaboradorFiltroEmail]);

  const valesFiltrados = useMemo(() => {
    return vales.filter(v => {
      if (filtroStatus === 'pendente' && v.status !== 'pendente') return false;
      if (filtroStatus === 'confirmado' && v.status === 'pendente') return false;

      if (busca) {
        const termo = busca.toLowerCase();
        const bateNome = v.colaboradorNome.toLowerCase().includes(termo);
        const bateMotivo = v.motivo?.toLowerCase().includes(termo);
        const bateCpf = v.colaboradorCpf?.includes(termo);
        if (!bateNome && !bateMotivo && !bateCpf) return false;
      }
      return true;
    });
  }, [vales, filtroStatus, busca]);

  const totais = useMemo(() => {
    let totalEmitido = 0;
    let totalPendente = 0;
    let totalConfirmado = 0;

    vales.forEach(v => {
      totalEmitido += v.valor;
      if (v.status === 'pendente') {
        totalPendente += v.valor;
      } else {
        totalConfirmado += v.valor;
      }
    });

    return { totalEmitido, totalPendente, totalConfirmado };
  }, [vales]);

  const handleImprimir = (vale: ValeColaborador) => {
    gerarReciboValePdf(vale, {
      nome: usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.dadosEmpresa?.nome || 'Portal G CAC',
      cnpj: usuario?.dadosEmpresa?.cnpj,
      endereco: usuario?.dadosEmpresa?.endereco
    });
  };

  const handleExcluir = async (valeId: string) => {
    if (!usuario?.empresaId) return;
    if (window.confirm('Tem certeza que deseja cancelar e excluir este registro de vale?')) {
      await excluirVale(usuario.empresaId, valeId);
      carregarDados();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-brand-dark-3/70 border border-gray-800 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Total em Vales Emitidos
          </span>
          <div className="text-xl font-black text-white mt-1">
            {formatarMoeda(totais.totalEmitido)}
          </div>
          <span className="text-[11px] text-gray-500">{vales.length} adiantamentos registrados</span>
        </div>

        <div className="bg-brand-dark-3/70 border border-amber-900/30 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
            Aguardando Confirmação
          </span>
          <div className="text-xl font-black text-amber-300 mt-1">
            {formatarMoeda(totais.totalPendente)}
          </div>
          <span className="text-[11px] text-amber-400/80">
            {vales.filter(v => v.status === 'pendente').length} pendentes do colaborador
          </span>
        </div>

        <div className="bg-brand-dark-3/70 border border-emerald-900/30 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
            Confirmados / Quitados
          </span>
          <div className="text-xl font-black text-emerald-300 mt-1">
            {formatarMoeda(totais.totalConfirmado)}
          </div>
          <span className="text-[11px] text-emerald-400/80">
            {vales.filter(v => v.status !== 'pendente').length} comprovantes com validade legal
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-dark-3/50 p-3 rounded-xl border border-gray-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por colaborador ou motivo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input w-full pl-8 py-1.5 text-xs bg-gray-900 border-gray-800 text-white rounded-xl"
            />
          </div>

          <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filtroStatus === 'todos' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroStatus('pendente')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filtroStatus === 'pendente' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setFiltroStatus('confirmado')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filtroStatus === 'confirmado' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Confirmados
            </button>
          </div>
        </div>

        {modo === 'gestor' && (
          <button
            onClick={() => setModalNovoAberto(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-blue/30"
          >
            <Plus size={16} />
            <span>Emitir Novo Vale</span>
          </button>
        )}
      </div>

      {/* Tabela de Vales */}
      <div className="bg-brand-dark-3/60 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        {carregando ? (
          <div className="p-8 text-center text-gray-400 text-xs">Carregando vales...</div>
        ) : valesFiltrados.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileText size={32} className="mx-auto text-gray-600" />
            <p className="text-gray-400 text-xs font-medium">Nenhum vale ou adiantamento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Motivo / Descrição</th>
                  <th className="p-3">Forma</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-center">Status Confirmação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {valesFiltrados.map(vale => {
                  const ehMeuPendente = modo === 'colaborador' && vale.status === 'pendente';

                  return (
                    <tr key={vale.id} className="hover:bg-gray-900/40 transition-colors">
                      <td className="p-3 font-mono text-gray-300">
                        {format(parseISO(vale.dataAdiantamento), 'dd/MM/yyyy')}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-white block">{vale.colaboradorNome}</span>
                        {vale.colaboradorCpf && (
                          <span className="text-[10px] text-gray-500 font-mono">CPF: {vale.colaboradorCpf}</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-300 max-w-xs truncate" title={vale.motivo}>
                        {vale.motivo || 'Adiantamento salarial'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-900 text-gray-300 border border-gray-800">
                          {vale.formaPagamento}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-emerald-400">
                        {formatarMoeda(vale.valor)}
                      </td>
                      <td className="p-3 text-center">
                        {vale.status === 'confirmado_eletronico' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                            <ShieldCheck size={12} /> Assinado Digitalmente
                          </span>
                        ) : vale.status === 'assinado_manual' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1">
                            <FileCheck2 size={12} /> Assinado em Papel
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                            <Clock size={12} /> Aguardando Confirmação
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {/* Se o colaborador logado precisa confirmar */}
                        {vale.status === 'pendente' && (
                          <button
                            type="button"
                            onClick={() => setValeParaConfirmar(vale)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-sm inline-flex items-center gap-1"
                            title="Confirmar e assinar recebimento"
                          >
                            <CheckCircle2 size={12} />
                            <span>Confirmar Recebimento</span>
                          </button>
                        )}

                        {/* Botão de Imprimir Recibo em PDF */}
                        <button
                          type="button"
                          onClick={() => handleImprimir(vale)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors inline-block"
                          title="Imprimir / Baixar Recibo em PDF"
                        >
                          <Printer size={15} />
                        </button>

                        {/* Botão Excluir (Gestor) */}
                        {modo === 'gestor' && (
                          <button
                            type="button"
                            onClick={() => handleExcluir(vale.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
                            title="Excluir vale"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Emitir Vale (Gestor) */}
      <ModalEmitirVale
        isOpen={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        onSucesso={carregarDados}
        listaColaboradores={listaColaboradores}
      />

      {/* Modal Confirmar Vale (Colaborador) */}
      <ModalConfirmarVale
        vale={valeParaConfirmar}
        isOpen={Boolean(valeParaConfirmar)}
        onClose={() => setValeParaConfirmar(null)}
        onConfirmado={carregarDados}
      />
    </div>
  );
}
