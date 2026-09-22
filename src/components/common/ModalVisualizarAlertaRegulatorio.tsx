import React from 'react';
import { X, ExternalLink, ShieldAlert, AlertTriangle, Info, Calendar, User, Scale, BookmarkCheck } from 'lucide-react';
import { AlertaRegulatorio } from '../../services/alertasRegulatoriosService';
import { formatarData } from '../../utils/formatters';

interface ModalVisualizarAlertaRegulatorioProps {
  alerta: AlertaRegulatorio | null;
  onClose: () => void;
}

export function ModalVisualizarAlertaRegulatorio({ alerta, onClose }: ModalVisualizarAlertaRegulatorioProps) {
  if (!alerta) return null;

  const getOrgaoBadge = (orgao: string) => {
    switch (orgao) {
      case 'Exército Brasileiro':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';
      case 'Polícia Federal':
        return 'bg-blue-950/40 text-blue-300 border-blue-500/30';
      case 'Ibama':
        return 'bg-amber-950/40 text-amber-300 border-amber-500/30';
      case 'Presidência da República':
        return 'bg-purple-950/40 text-purple-300 border-purple-500/30';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const getUrgenciaBadge = (urgencia: string) => {
    switch (urgencia) {
      case 'urgente':
        return {
          classe: 'bg-red-500/20 text-red-300 border-red-500/30',
          icone: AlertTriangle,
          texto: 'Urgente / Ação Imediata'
        };
      case 'importante':
        return {
          classe: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icone: ShieldAlert,
          texto: 'Importante'
        };
      default:
        return {
          classe: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          icone: Info,
          texto: 'Informativo'
        };
    }
  };

  const urgenciaInfo = getUrgenciaBadge(alerta.nivel_urgencia);
  const UrgenciaIcon = urgenciaInfo.icone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-brand-dark-5 flex items-start justify-between gap-4 bg-brand-dark-3/50">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getOrgaoBadge(alerta.orgao)}`}>
                {alerta.orgao}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${urgenciaInfo.classe}`}>
                <UrgenciaIcon size={11} />
                {urgenciaInfo.texto}
              </span>
              {alerta.fixado && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Fixado
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
              {alerta.titulo}
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-purple-400" />
                {formatarData(alerta.data_publicacao)}
              </span>
              <span className="flex items-center gap-1">
                <User size={12} className="text-purple-400" />
                {alerta.autor}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Alerta */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-gray-200">
          {/* Resumo em Destaque */}
          <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-purple-300 mb-1">
              <Scale size={13} />
              Resumo Executivo (Leitura Rápida)
            </div>
            <p className="text-xs text-purple-100 font-medium leading-relaxed">
              {alerta.resumo}
            </p>
          </div>

          {/* Texto Completo */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
              Conteúdo & Análise Regulamentar
            </h3>
            <div className="p-4 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
              {alerta.conteudo}
            </div>
          </div>

          {/* Impacto para Despachante & CAC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {alerta.impacto_despachante && (
              <div className="p-3.5 bg-brand-dark-3/40 border border-blue-500/20 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-400">
                  <BookmarkCheck size={13} />
                  Impacto para o Despachante
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {alerta.impacto_despachante}
                </p>
              </div>
            )}

            {alerta.impacto_cac && (
              <div className="p-3.5 bg-brand-dark-3/40 border border-emerald-500/20 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  <BookmarkCheck size={13} />
                  Impacto para o Atirador CAC
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {alerta.impacto_cac}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-brand-dark-5 bg-brand-dark-3/50 flex items-center justify-between gap-3">
          {alerta.link_oficial ? (
            <a
              href={alerta.link_oficial}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-purple-300 rounded-lg text-xs font-bold border border-white/10 transition-all"
            >
              <ExternalLink size={13} />
              Acessar Publicação Oficial (DOU / Gov)
            </a>
          ) : (
            <span className="text-[11px] text-gray-500">Publicação interna Portal G CAC</span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-dark-4 hover:bg-brand-dark-5 text-white rounded-xl text-xs font-bold transition-all border border-brand-dark-5"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
