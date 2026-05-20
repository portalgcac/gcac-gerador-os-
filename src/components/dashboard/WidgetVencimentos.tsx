import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ChevronRight, Calendar, User, Target, MapPin, ExternalLink, Info, X } from 'lucide-react';
import { buscarAlertasGlobais } from '../../services/vencimentosService';
import { AlertaDocumento, obterClasseAlerta } from '../../utils/vencimentos';
import { formatarData } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export function WidgetVencimentos() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [alertas, setAlertas] = useState<AlertaDocumento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [exibirBanner, setExibirBanner] = useState(() => {
    return localStorage.getItem('visualizou_alerta_inerte_v2') !== 'true';
  });

  const fecharBanner = () => {
    localStorage.setItem('visualizou_alerta_inerte_v2', 'true');
    setExibirBanner(false);
  };

  useEffect(() => {
    async function carregar() {
      if (!usuario?.empresaId) return;
      try {
        const data = await buscarAlertasGlobais(usuario.empresaId);
        setAlertas(data);
      } catch (err) {
        console.error('Erro ao carregar alertas de vencimento:', err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [usuario?.empresaId]);

  if (carregando) return null;
  if (alertas.length === 0) return null;

  return (
    <div className="card border-brand-dark-5 bg-brand-dark-3/30 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-orange-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Alertas de Documentação e Vencimentos</h2>
        </div>
        <span className="badge badge-erro">{alertas.length} pendência{alertas.length > 1 ? 's' : ''}</span>
      </div>

      {exibirBanner && (
        <div className="mb-4 p-3 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex gap-3 text-xs text-gray-300 relative animate-fade-in">
          <div className="mt-0.5 text-brand-blue flex-shrink-0">
            <Info size={16} />
          </div>
          <div className="flex-1 pr-6">
            <p className="font-bold text-white mb-0.5">Nova função: Autorizações Inertes</p>
            <p className="text-[11px] opacity-80 leading-relaxed">
              Agora, se o cliente não quiser renovar uma autorização de manejo (por não estar caçando), você pode editá-la e alterar o status para <strong>"Inerte"</strong>. O registro permanecerá salvo no histórico dele, mas deixará de aparecer aqui neste painel de alertas.
            </p>
          </div>
          <button 
            onClick={fecharBanner} 
            className="absolute top-2.5 right-2.5 text-gray-500 hover:text-white transition-colors"
            title="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-dark-5 scrollbar-track-transparent">
        {alertas.map((alerta) => (
          <div 
            key={alerta.id}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:brightness-110 ${obterClasseAlerta(alerta.nivel)}`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-1">
                {alerta.tipo === 'CRAF' ? <Target size={14} /> : 
                 alerta.tipo === 'GT' ? <MapPin size={14} /> :
                 alerta.tipo === 'MANEJO' ? <Calendar size={14} /> :
                 <User size={14} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                   <p className="text-xs font-bold truncate">{alerta.label}</p>
                   <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/20 font-black uppercase tracking-tighter">
                     {alerta.nivel === 'VENCIDO' ? 'VENCIDO' : 
                      alerta.nivel === 'CRITICO' ? 'URGENTE' : 'AVISO'}
                   </span>
                </div>
                <p className="text-[10px] opacity-70 font-bold uppercase truncate">{alerta.clienteNome}</p>
                <div className="flex items-center gap-2 mt-1">
                   <Calendar size={10} className="opacity-50" />
                   <p className="text-[10px] font-medium">Vencimento: {formatarData(alerta.dataVencimento)}</p>
                   <span className="text-[10px] font-black">•</span>
                   <p className="text-[10px] font-black italic">
                    {alerta.diasRestantes < 0 
                      ? `${Math.abs(alerta.diasRestantes)} dia(s) atrasado` 
                      : `Faltam ${alerta.diasRestantes} dia(s)`}
                   </p>
                </div>
              </div>
            </div>

            <button 
            onClick={() => {
                if (alerta.clienteId) {
                  navigate(`/clientes/${alerta.clienteId}`, { 
                    state: { 
                      aba: 'documentos',
                      armaId: alerta.armaId 
                    } 
                  });
                } else {
                  // Fallback
                  const clienteId = alerta.id.split('-')[0];
                  navigate(`/clientes/${clienteId}`, { state: { aba: 'documentos' } });
                }
              }}
              className="p-1.5 hover:bg-black/10 rounded-lg transition-colors flex-shrink-0"
              title="Ver Cliente"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-brand-dark-5 flex justify-end">
        <p className="text-[9px] text-gray-500 font-bold uppercase italic">* Baseado nas regras de alerta do SisGCorp e IBAMA</p>
      </div>
    </div>
  );
}
