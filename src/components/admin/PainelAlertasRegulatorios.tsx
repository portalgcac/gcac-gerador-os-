import React, { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Info,
  Calendar,
  Search,
  Bell,
  Check,
  X,
  FileText,
  BookmarkCheck,
  Send,
  Eye
} from 'lucide-react';
import {
  AlertaRegulatorio,
  buscarAlertasRegulatorios,
  salvarAlertaIndividual,
  excluirAlertaRegulatorio
} from '../../services/alertasRegulatoriosService';
import { useAuth } from '../../context/AuthContext';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { ModalVisualizarAlertaRegulatorio } from '../common/ModalVisualizarAlertaRegulatorio';
import { formatarData } from '../../utils/formatters';

export function PainelAlertasRegulatorios() {
  const { usuario } = useAuth();
  const { estado: notif, mostrar, fechar } = useNotificacao();

  const [alertas, setAlertas] = useState<AlertaRegulatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroOrgao, setFiltroOrgao] = useState('todos');

  // Modais
  const [modalFormAberto, setModalFormAberto] = useState(false);
  const [alertaParaExcluir, setAlertaParaExcluir] = useState<AlertaRegulatorio | null>(null);
  const [alertaParaVisualizar, setAlertaParaVisualizar] = useState<AlertaRegulatorio | null>(null);
  const [editandoAlerta, setEditandoAlerta] = useState<AlertaRegulatorio | null>(null);

  // Form State
  const [form, setForm] = useState({
    titulo: '',
    orgao: 'Exército Brasileiro' as AlertaRegulatorio['orgao'],
    nivel_urgencia: 'informativo' as AlertaRegulatorio['nivel_urgencia'],
    resumo: '',
    conteudo: '',
    impacto_despachante: '',
    impacto_cac: '',
    link_oficial: '',
    fixado: false,
    notificarTodos: false
  });

  const carregar = async () => {
    setCarregando(true);
    try {
      const dados = await buscarAlertasRegulatorios();
      setAlertas(dados);
    } catch (err) {
      console.error('Erro ao carregar comunicados:', err);
      mostrar('erro', 'Falha ao carregar lista de alertas regulatórios.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleAbrirNovo = () => {
    setEditandoAlerta(null);
    setForm({
      titulo: '',
      orgao: 'Exército Brasileiro',
      nivel_urgencia: 'informativo',
      resumo: '',
      conteudo: '',
      impacto_despachante: '',
      impacto_cac: '',
      link_oficial: '',
      fixado: false,
      notificarTodos: true
    });
    setModalFormAberto(true);
  };

  const handleAbrirEdicao = (alerta: AlertaRegulatorio) => {
    setEditandoAlerta(alerta);
    setForm({
      titulo: alerta.titulo,
      orgao: alerta.orgao,
      nivel_urgencia: alerta.nivel_urgencia,
      resumo: alerta.resumo,
      conteudo: alerta.conteudo,
      impacto_despachante: alerta.impacto_despachante || '',
      impacto_cac: alerta.impacto_cac || '',
      link_oficial: alerta.link_oficial || '',
      fixado: alerta.fixado,
      notificarTodos: false
    });
    setModalFormAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.resumo.trim() || !form.conteudo.trim()) {
      mostrar('aviso', 'Por favor, preencha o título, resumo e conteúdo do comunicado.');
      return;
    }

    setSalvando(true);
    try {
      await salvarAlertaIndividual(
        {
          id: editandoAlerta ? editandoAlerta.id : undefined,
          titulo: form.titulo.trim(),
          orgao: form.orgao,
          nivel_urgencia: form.nivel_urgencia,
          resumo: form.resumo.trim(),
          conteudo: form.conteudo.trim(),
          impacto_despachante: form.impacto_despachante.trim() || undefined,
          impacto_cac: form.impacto_cac.trim() || undefined,
          link_oficial: form.link_oficial.trim() || undefined,
          fixado: form.fixado,
          autor: usuario?.nome || 'Diretoria Portal G CAC'
        },
        usuario?.nome || 'Diretoria Portal G CAC',
        form.notificarTodos
      );

      mostrar('sucesso', editandoAlerta ? 'Comunicado regulatório atualizado com sucesso!' : 'Novo comunicado publicado com sucesso!');
      setModalFormAberto(false);
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar comunicado:', err);
      mostrar('erro', 'Erro ao salvar comunicado regulatório.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!alertaParaExcluir) return;
    try {
      await excluirAlertaRegulatorio(alertaParaExcluir.id);
      mostrar('sucesso', 'Comunicado removido com sucesso.');
      setAlertaParaExcluir(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao excluir comunicado:', err);
      mostrar('erro', 'Falha ao remover comunicado regulatório.');
    }
  };

  const alertasFiltrados = alertas.filter(a => {
    const matchBusca =
      busca.trim() === '' ||
      a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      a.resumo.toLowerCase().includes(busca.toLowerCase()) ||
      a.orgao.toLowerCase().includes(busca.toLowerCase());

    const matchOrgao = filtroOrgao === 'todos' || a.orgao === filtroOrgao;
    return matchBusca && matchOrgao;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <Notificacao {...notif} onFechar={fechar} />

      {/* Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-dark-3/60 border border-brand-dark-5 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl shrink-0">
            <Scale size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                Central de Inteligência Regulatória & Decretos
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Publicação Oficial
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Publique comunicados oficiais do Exército Brasileiro, Polícia Federal, Ibama e decretos para manter todos os escritórios e atiradores CAC atualizados.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAbrirNovo}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20 self-start md:self-auto shrink-0"
        >
          <Plus size={16} />
          <span>Publicar Comunicado</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-brand-dark-2 border border-brand-dark-5 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-lg">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar comunicados, portarias ou decretos..."
            className="input-field pl-9 w-full text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={filtroOrgao}
            onChange={e => setFiltroOrgao(e.target.value)}
            className="input-field text-xs py-2 px-3 bg-brand-dark-3 w-full md:w-auto"
          >
            <option value="todos">Todos os Órgãos</option>
            <option value="Exército Brasileiro">Exército Brasileiro</option>
            <option value="Polícia Federal">Polícia Federal</option>
            <option value="Ibama">Ibama</option>
            <option value="Presidência da República">Presidência da República</option>
            <option value="Geral">Geral</option>
          </select>
        </div>
      </div>

      {/* Grid de Comunicados Publicados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertasFiltrados.map((alerta) => {
          const isUrgente = alerta.nivel_urgencia === 'urgente';
          const isImportante = alerta.nivel_urgencia === 'importante';

          return (
            <div
              key={alerta.id}
              className={`bg-brand-dark-2 border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all hover:scale-[1.01] ${
                alerta.fixado
                  ? 'border-purple-500/40 shadow-purple-500/5'
                  : 'border-brand-dark-5'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {alerta.orgao}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {alerta.fixado && (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Fixado
                      </span>
                    )}
                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase border ${
                      isUrgente
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : isImportante
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    }`}>
                      {alerta.nivel_urgencia}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-black text-white leading-snug line-clamp-2">
                  {alerta.titulo}
                </h3>

                <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                  {alerta.resumo}
                </p>

                <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-brand-dark-5/60 pt-2.5">
                  <span>{formatarData(alerta.data_publicacao)}</span>
                  <span className="truncate max-w-[150px]">{alerta.autor}</span>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setAlertaParaVisualizar(alerta)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-dark-3 hover:bg-brand-dark-4 text-purple-300 rounded-lg text-xs font-bold transition-all border border-brand-dark-5"
                >
                  <Eye size={13} />
                  <span>Ver Detalhes</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAbrirEdicao(alerta)}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    title="Editar comunicado"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertaParaExcluir(alerta)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                    title="Excluir comunicado"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação / Edição de Comunicado */}
      {modalFormAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-brand-dark-5 flex items-center justify-between bg-brand-dark-3/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Scale size={18} />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {editandoAlerta ? 'Editar Comunicado Regulatório' : 'Novo Comunicado Regulatório'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFormAberto(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                    Órgão Regulador *
                  </label>
                  <select
                    value={form.orgao}
                    onChange={e => setForm({ ...form, orgao: e.target.value as any })}
                    className="input-field w-full py-2 bg-brand-dark-3"
                    required
                  >
                    <option value="Exército Brasileiro">Exército Brasileiro (COLOG / DFPC)</option>
                    <option value="Polícia Federal">Polícia Federal (SINARM)</option>
                    <option value="Ibama">Ibama (SIMAF / Manejo)</option>
                    <option value="Presidência da República">Presidência da República / Decretos</option>
                    <option value="Geral">Geral / STF / Legislação Ampla</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                    Nível de Urgência *
                  </label>
                  <select
                    value={form.nivel_urgencia}
                    onChange={e => setForm({ ...form, nivel_urgencia: e.target.value as any })}
                    className="input-field w-full py-2 bg-brand-dark-3"
                    required
                  >
                    <option value="informativo">Informativo (Leitura Recomendada)</option>
                    <option value="importante">Importante (Atenção a novos prazos)</option>
                    <option value="urgente">Urgente (Ação Imediata necessária)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                  Título do Comunicado *
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Portaria COLOG nº 166 — Validade de CRAF e Guia de Tráfego"
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                  Resumo Executivo (Leitura rápida de 1 minuto) *
                </label>
                <textarea
                  value={form.resumo}
                  onChange={e => setForm({ ...form, resumo: e.target.value })}
                  rows={2}
                  placeholder="Explicação direta do que mudou e o que os escritórios e CACs devem prestar atenção..."
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                  Conteúdo e Análise Jurídico-Operacional Completa *
                </label>
                <textarea
                  value={form.conteudo}
                  onChange={e => setForm({ ...form, conteudo: e.target.value })}
                  rows={4}
                  placeholder="Detalhes completos sobre o decreto, portaria ou instrução normativa..."
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                    Impacto Prático para o Despachante
                  </label>
                  <textarea
                    value={form.impacto_despachante}
                    onChange={e => setForm({ ...form, impacto_despachante: e.target.value })}
                    rows={2}
                    placeholder="Instruções de como o escritório deve protocolar ou orientar clientes..."
                    className="input-field w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                    Impacto Prático para o Atirador CAC
                  </label>
                  <textarea
                    value={form.impacto_cac}
                    onChange={e => setForm({ ...form, impacto_cac: e.target.value })}
                    rows={2}
                    placeholder="Cuidados no transporte de armas, prazos de renovação e documentação..."
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">
                  Link Oficial do Diário Oficial (DOU / Gov) (Opcional)
                </label>
                <input
                  type="url"
                  value={form.link_oficial}
                  onChange={e => setForm({ ...form, link_oficial: e.target.value })}
                  placeholder="https://www.planalto.gov.br/..."
                  className="input-field w-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-brand-dark-5">
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 font-medium">
                  <input
                    type="checkbox"
                    checked={form.fixado}
                    onChange={e => setForm({ ...form, fixado: e.target.checked })}
                    className="checkbox-custom"
                  />
                  <span>Fixar este comunicado no topo da lista</span>
                </label>

                {!editandoAlerta && (
                  <label className="flex items-center gap-2 cursor-pointer text-purple-300 font-medium">
                    <input
                      type="checkbox"
                      checked={form.notificarTodos}
                      onChange={e => setForm({ ...form, notificarTodos: e.target.checked })}
                      className="checkbox-custom"
                    />
                    <span>Disparar alerta no sininho de notificações de todos os clientes</span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setModalFormAberto(false)}
                  className="btn-ghost btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  {salvando ? 'Salvando...' : editandoAlerta ? 'Salvar Alterações' : 'Publicar Comunicado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {alertaParaExcluir && (
        <DialogConfirmacao
          aberto={Boolean(alertaParaExcluir)}
          titulo="Excluir Comunicado Regulatório"
          mensagem={`Deseja realmente remover o comunicado "${alertaParaExcluir.titulo}"? Esta ação removerá a publicação para todos os clientes.`}
          textoBotaoConfirmar="Excluir Comunicado"
          tipo="perigo"
          onConfirmar={handleConfirmarExclusao}
          onCancelar={() => setAlertaParaExcluir(null)}
        />
      )}

      {/* Modal de Visualização */}
      {alertaParaVisualizar && (
        <ModalVisualizarAlertaRegulatorio
          alerta={alertaParaVisualizar}
          onClose={() => setAlertaParaVisualizar(null)}
        />
      )}
    </div>
  );
}
