import React, { useState, useEffect } from 'react';
import { Scale, ChevronRight, AlertTriangle, ShieldAlert, Info, Sparkles, ExternalLink } from 'lucide-react';
import { AlertaRegulatorio, buscarAlertasRegulatorios } from '../../services/alertasRegulatoriosService';
import { ModalVisualizarAlertaRegulatorio } from '../common/ModalVisualizarAlertaRegulatorio';
import { formatarData } from '../../utils/formatters';

export function WidgetAlertasRegulatorios() {
  const [alertas, setAlertas] = useState<AlertaRegulatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alertaSelecionado, setAlertaSelecionado] = useState<AlertaRegulatorio | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const dados = await buscarAlertasRegulatorios();
        setAlertas(dados);
      } catch (err) {
        console.error('Erro ao carregar alertas regulatórios no widget:', err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-brand-dark-3 rounded w-1/3 mb-3"></div>
        <div className="h-12 bg-brand-dark-3 rounded w-full"></div>
      </div>
    );
  }

  if (alertas.length === 0) {
    return null;
  }

  const alertasExibir = alertas.slice(0, 3);

  const getOrgaoCor = (orgao: string) => {
    switch (orgao) {
      case 'Exército Brasileiro':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Polícia Federal':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'Ibama':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    }
  };

  return (
    <>
      <div className="bg-brand-dark-2/90 border border-brand-dark-5 rounded-2xl p-5 shadow-xl space-y-3.5">
        {/* Header do Widget */}
        <div className="flex items-center justify-between border-b border-brand-dark-5/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <Scale size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Inteligência Regulatória & Legislação
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-gray-400">
                Comunicados oficiais, portarias do Exército e orientações da PF
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
            {alertas.length} avisos
          </span>
        </div>

        {/* Lista de Alertas Recentes */}
        <div className="space-y-2">
          {alertasExibir.map((alerta) => {
            const isUrgente = alerta.nivel_urgencia === 'urgente';

            return (
              <div
                key={alerta.id}
                onClick={() => setAlertaSelecionado(alerta)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                  isUrgente
                    ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/40'
                    : 'bg-brand-dark-3/50 hover:bg-brand-dark-3 border-brand-dark-5 hover:border-purple-500/40'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase border ${getOrgaoCor(alerta.orgao)}`}>
                      {alerta.orgao}
                    </span>
                    {isUrgente && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
                        <AlertTriangle size={10} /> Urgente
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500">
                      {formatarData(alerta.data_publicacao)}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-200 group-hover:text-purple-300 transition-colors truncate">
                    {alerta.titulo}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">
                    {alerta.resumo}
                  </p>
                </div>

                <div className="text-gray-500 group-hover:text-white transition-colors shrink-0">
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {alertaSelecionado && (
        <ModalVisualizarAlertaRegulatorio
          alerta={alertaSelecionado}
          onClose={() => setAlertaSelecionado(null)}
        />
      )}
    </>
  );
}
