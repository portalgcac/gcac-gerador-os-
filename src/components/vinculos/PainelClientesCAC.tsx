import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2, UserCheck, Clock, XCircle, CheckCircle, AlertTriangle,
  Target, FileText, Award, Shield, User, ChevronRight, Plus,
  Eye, Unlink, RefreshCw, Wifi, WifiOff, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  buscarVinculosDespachante,
  revogarVinculo,
  buscarAcervoVinculado,
  VinculoDespachanteCac,
  AcervoVinculado,
} from '../../services/vinculosService';
import { ModalSolicitarVinculo } from './ModalSolicitarVinculo';
import { AcervoVinculadoReadOnly } from './AcervoVinculadoReadOnly';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataRelativa(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 30) return `Há ${dias} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function BadgeStatus({ status }: { status: VinculoDespachanteCac['status'] }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    ativo:     { label: 'Ativo',     cls: 'text-green-400 bg-green-500/10 border-green-500/20',   icon: CheckCircle },
    pendente:  { label: 'Aguardando', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    rejeitado: { label: 'Recusado',  cls: 'text-red-400 bg-red-500/10 border-red-500/20',         icon: XCircle },
    revogado:  { label: 'Revogado',  cls: 'text-gray-500 bg-gray-500/10 border-gray-500/20',      icon: Unlink },
    expirado:  { label: 'Expirado',  cls: 'text-gray-500 bg-gray-500/10 border-gray-500/20',      icon: XCircle },
  };
  const { label, cls, icon: Icon } = map[status] || map.revogado;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon size={9} /> {label}
    </span>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────

export function PainelClientesCAC() {
  const { usuario } = useAuth();
  const [vinculos, setVinculos] = useState<VinculoDespachanteCac[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [acervoAberto, setAcervoAberto] = useState<{ vinculo: VinculoDespachanteCac; acervo: AcervoVinculado } | null>(null);
  const [carregandoAcervo, setCarregandoAcervo] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'ativo' | 'pendente' | 'inativo'>('todos');

  const carregar = useCallback(async () => {
    if (!usuario?.empresaId) return;
    setCarregando(true);
    const dados = await buscarVinculosDespachante(usuario.empresaId);
    setVinculos(dados);
    setCarregando(false);
  }, [usuario]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirAcervo = async (vinculo: VinculoDespachanteCac) => {
    if (!usuario?.empresaId || vinculo.status !== 'ativo') return;
    setCarregandoAcervo(vinculo.id);
    const acervo = await buscarAcervoVinculado(vinculo.cac_empresa_id, usuario.empresaId);
    setCarregandoAcervo(null);
    if (acervo) setAcervoAberto({ vinculo, acervo });
  };

  const handleRevogar = async (vinculo: VinculoDespachanteCac) => {
    if (!usuario?.empresaId || !confirm(`Deseja encerrar o vínculo com ${vinculo.cac_nome}?`)) return;
    setRevogando(vinculo.id);
    await revogarVinculo(vinculo.id, 'despachante', usuario.empresaId);
    setRevogando(null);
    await carregar();
  };

  const vinculosFiltrados = vinculos.filter(v => {
    if (filtro === 'todos') return true;
    if (filtro === 'inativo') return ['rejeitado', 'revogado', 'expirado'].includes(v.status);
    return v.status === filtro;
  });

  const totalAtivos = vinculos.filter(v => v.status === 'ativo').length;
  const totalPendentes = vinculos.filter(v => v.status === 'pendente').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-brand-blue/10 border border-brand-blue/20 rounded-xl">
              <Link2 size={18} className="text-brand-blue-light" />
            </div>
            <h1 className="text-2xl font-black text-white">Clientes CAC Vinculados</h1>
          </div>
          <p className="text-sm text-gray-500">
            Atiradores que autorizaram seu acesso ao acervo digital deles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={carregar}
            className="btn-ghost px-3 py-2 border border-brand-dark-5 hover:border-brand-blue/30 flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setModalSolicitar(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus size={16} /> Solicitar Acesso
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total vinculados', value: totalAtivos, icon: UserCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Aguardando resposta', value: totalPendentes, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', pulse: totalPendentes > 0 },
          { label: 'Total solicitações', value: vinculos.length, icon: Link2, color: 'text-brand-blue-light', bg: 'bg-brand-blue/10 border-brand-blue/20' },
          { label: 'Encerrados', value: vinculos.filter(v => ['rejeitado','revogado','expirado'].includes(v.status)).length, icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <item.icon size={16} className={item.color} />
              {item.pulse && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
            </div>
            <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Aviso informativo */}
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-brand-blue shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 leading-relaxed">
          Os atiradores vinculados precisam <strong className="text-white">autorizar explicitamente</strong> seu acesso.
          Você terá acesso de <strong className="text-white">somente leitura</strong> ao acervo deles — não é possível editar ou excluir dados.
          O atirador pode revogar o acesso a qualquer momento.
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'ativo', label: 'Ativos' },
          { key: 'pendente', label: 'Aguardando' },
          { key: 'inativo', label: 'Encerrados' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key as any)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
              filtro === f.key
                ? 'bg-brand-blue/20 border-brand-blue/40 text-brand-blue-light'
                : 'bg-brand-dark-3 border-brand-dark-5 text-gray-500 hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de vínculos */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vinculosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 bg-brand-dark-2 rounded-2xl border border-brand-dark-5">
          <Link2 size={36} className="mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {filtro === 'todos' ? 'Nenhuma solicitação ainda' : 'Nenhum resultado para este filtro'}
          </p>
          {filtro === 'todos' && (
            <p className="text-xs mt-1 text-gray-700">
              Clique em "Solicitar Acesso" para buscar um atirador pelo CPF
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vinculosFiltrados.map(vinculo => (
            <div
              key={vinculo.id}
              className={`bg-brand-dark-2 border rounded-2xl p-4 transition-all ${
                vinculo.status === 'ativo'
                  ? 'border-brand-dark-5 hover:border-brand-blue/30 cursor-pointer'
                  : 'border-brand-dark-5 opacity-70'
              }`}
              onClick={() => vinculo.status === 'ativo' && abrirAcervo(vinculo)}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Avatar + Nome */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-dark-4 border border-brand-dark-5 flex items-center justify-center shrink-0">
                    <User size={18} className="text-gray-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{vinculo.cac_nome}</p>
                    <p className="text-[11px] text-gray-500">{vinculo.cac_email}</p>
                  </div>
                </div>

                {/* Status + Datas */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide">Solicitado</p>
                    <p className="text-xs text-gray-400">{formatarDataRelativa(vinculo.solicitado_em)}</p>
                  </div>
                  <BadgeStatus status={vinculo.status} />

                  {/* Ações */}
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {vinculo.status === 'ativo' && (
                      <>
                        <button
                          onClick={() => abrirAcervo(vinculo)}
                          disabled={carregandoAcervo === vinculo.id}
                          className="p-2 rounded-lg text-gray-500 hover:text-brand-blue-light hover:bg-brand-blue/10 transition-colors"
                          title="Ver acervo"
                        >
                          {carregandoAcervo === vinculo.id
                            ? <RefreshCw size={14} className="animate-spin" />
                            : <Eye size={14} />
                          }
                        </button>
                        <button
                          onClick={() => handleRevogar(vinculo)}
                          disabled={revogando === vinculo.id}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Encerrar vínculo"
                        >
                          <Unlink size={14} />
                        </button>
                      </>
                    )}
                    {vinculo.status === 'ativo' && (
                      <ChevronRight size={16} className="text-gray-600 ml-1 self-center" />
                    )}
                  </div>
                </div>
              </div>

              {/* Mensagem da solicitação */}
              {vinculo.mensagem_solicitacao && vinculo.status === 'pendente' && (
                <div className="mt-3 bg-brand-dark-3 rounded-lg p-3 text-xs text-gray-400 border border-brand-dark-5">
                  <span className="text-gray-600 font-bold">Mensagem enviada: </span>
                  {vinculo.mensagem_solicitacao}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Solicitar Vínculo */}
      {modalSolicitar && (
        <ModalSolicitarVinculo
          onClose={() => setModalSolicitar(false)}
          onSucesso={() => { setModalSolicitar(false); carregar(); }}
        />
      )}

      {/* Modal de Acervo Vinculado */}
      {acervoAberto && (
        <AcervoVinculadoReadOnly
          vinculo={acervoAberto.vinculo}
          acervo={acervoAberto.acervo}
          onClose={() => setAcervoAberto(null)}
        />
      )}
    </div>
  );
}
