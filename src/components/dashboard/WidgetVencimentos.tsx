import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Shield, ChevronRight, Calendar, User, Target, MapPin, ExternalLink, Info, X, Link2, FileClock, RotateCcw } from 'lucide-react';
import { buscarAlertasGlobais, buscarAlertasCacsVinculados, atualizarStatusRenovacao } from '../../services/vencimentosService';
import { AlertaDocumento, obterClasseAlerta } from '../../utils/vencimentos';
import { formatarData } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export function WidgetVencimentos() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [alertasDiretos, setAlertasDiretos] = useState<AlertaDocumento[]>([]);
  const [alertasVinculados, setAlertasVinculados] = useState<AlertaDocumento[]>([]);
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
        const [diretos, vinculados] = await Promise.all([
          buscarAlertasGlobais(usuario.empresaId),
          buscarAlertasCacsVinculados(usuario.empresaId)
        ]);
        setAlertasDiretos(diretos);
        setAlertasVinculados(vinculados);
      } catch (err) {
        console.error('Erro ao carregar alertas de vencimento:', err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [usuario?.empresaId]);

  if (carregando) return null;

  const totalAlertas = alertasDiretos.length + alertasVinculados.length;
  if (totalAlertas === 0) return null;

  const renderCardAlerta = (alerta: AlertaDocumento) => {
    const isIbamaCrVencido = alerta.tipo === 'IBAMA_CR' && alerta.diasRestantes < 0;
    const isIbamaCrHoje = alerta.tipo === 'IBAMA_CR' && alerta.diasRestantes === 0;

    const classeAlerta = alerta.emRenovacao
      ? 'text-brand-blue-light bg-brand-blue/10 border-brand-blue/20'
      : isIbamaCrVencido
      ? 'text-orange-500 bg-orange-500/10 border-orange-500/20'
      : obterClasseAlerta(alerta.nivel);

    const textoBadge = alerta.emRenovacao
      ? 'AG. LIBERAÇÃO'
      : isIbamaCrVencido
      ? 'RENOVÁVEL'
      : alerta.nivel === 'VENCIDO' ? 'VENCIDO' : alerta.nivel === 'CRITICO' ? 'URGENTE' : 'AVISO';

    const textoDescricaoVenc = alerta.emRenovacao
      ? 'Processo protocolado. Aguardando liberação da PF/Exército.'
      : isIbamaCrVencido
      ? `Liberado para Renovação (venceu há ${Math.abs(alerta.diasRestantes)} dia(s))`
      : isIbamaCrHoje
      ? `Vence hoje (Renovável a partir de amanhã)`
      : alerta.diasRestantes < 0
      ? `${Math.abs(alerta.diasRestantes)} dia(s) atrasado`
      : `Faltam ${alerta.diasRestantes} dia(s)`;

    return (
      <div 
        key={alerta.id}
        className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:brightness-110 ${classeAlerta}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-1 flex-shrink-0">
            {alerta.tipo === 'CRAF' ? <Target size={14} /> : 
             alerta.tipo === 'GT' ? <MapPin size={14} /> :
             alerta.tipo === 'MANEJO' ? <Calendar size={14} /> :
             alerta.tipo === 'CR' || alerta.tipo === 'IBAMA_CR' ? <Shield size={14} /> :
             <User size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
               <p className="text-xs font-bold truncate">{alerta.label}</p>
               <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/20 font-black uppercase tracking-tighter">
                 {textoBadge}
               </span>
            </div>
            <p className="text-[10px] opacity-70 font-bold uppercase truncate flex items-center gap-1 mt-0.5">
              {alerta.isVinculado && <Link2 size={10} className="text-green-400 shrink-0" />}
              {alerta.clienteNome}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
               <div className="flex items-center gap-1">
                 <Calendar size={10} className="opacity-50" />
                 <p className="text-[10px] font-medium">Vencimento: {formatarData(alerta.dataVencimento)}</p>
               </div>
               <span className="text-[10px] font-black opacity-30">•</span>
               <p className="text-[10px] font-black italic">
                 {textoDescricaoVenc}
               </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button 
            onClick={async (e) => {
                e.stopPropagation();
                try {
                  let dbId = '';
                  if (alerta.tipo === 'CR' || alerta.tipo === 'IBAMA_CR') {
                    dbId = alerta.clienteId || '';
                  } else if (alerta.tipo === 'CRAF') {
                    dbId = alerta.armaId || '';
                  } else {
                    dbId = alerta.id.split('-')[0];
                  }
                  
                  if (!dbId) return;
                  const novoStatus = !alerta.emRenovacao;
                  await atualizarStatusRenovacao(alerta.tipo, dbId, novoStatus);
                  
                  const updateList = (prev: AlertaDocumento[]) => 
                    prev.map(a => a.id === alerta.id ? { ...a, emRenovacao: novoStatus } : a).sort((a, b) => {
                      if (a.emRenovacao !== b.emRenovacao) return a.emRenovacao ? 1 : -1;
                      const ordem: Record<string, number> = { 'VENCIDO': 0, 'CRITICO': 1, 'AVISO': 2, 'OK': 3 };
                      if (ordem[a.nivel] !== ordem[b.nivel]) return ordem[a.nivel] - ordem[b.nivel];
                      return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
                    });

                  setAlertasDiretos(updateList);
                  setAlertasVinculados(updateList);
                } catch (err) {
                  console.error('Erro ao atualizar status do alerta:', err);
                  alert('Erro ao atualizar status do alerta.');
                }
              }}
              className={`p-1.5 hover:bg-black/10 rounded-lg transition-colors flex-shrink-0 ${
                alerta.emRenovacao 
                  ? 'text-brand-blue-light hover:text-red-400' 
                  : 'text-gray-500 hover:text-brand-blue-light'
              }`}
              title={alerta.emRenovacao ? "Marcar como Novo (Pendente)" : "Marcar como Protocolado (Aguardando PF/Exército)"}
            >
              {alerta.emRenovacao ? <RotateCcw size={14} /> : <FileClock size={14} />}
            </button>

          <button 
            onClick={() => {
              if (alerta.isVinculado) {
                navigate('/clientes-cac', { 
                  state: { 
                    autoOpenCacEmpresaId: alerta.cacEmpresaId 
                  } 
                });
              } else if (alerta.clienteId) {
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
            title={alerta.isVinculado ? "Ver Acervo Vinculado (Somente Leitura)" : "Ver Cliente"}
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card border-brand-dark-5 bg-brand-dark-3/30 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-orange-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Alertas de Documentação e Vencimentos</h2>
        </div>
        <span className="badge badge-erro">{totalAlertas} pendência{totalAlertas > 1 ? 's' : ''}</span>
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

      {/* Grid de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Carteira do Despachante */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-brand-dark-5 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
              Clientes da Carteira
            </h3>
            <span className="text-[10px] font-bold text-gray-500 bg-brand-dark-4 px-2 py-0.5 rounded-md border border-brand-dark-5">
              {alertasDiretos.length}
            </span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-dark-5 scrollbar-track-transparent">
            {alertasDiretos.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-8 text-center bg-brand-dark-2/20 rounded-2xl border border-dashed border-brand-dark-5">
                Nenhum vencimento pendente na carteira.
              </div>
            ) : (
              alertasDiretos.map((alerta) => renderCardAlerta(alerta))
            )}
          </div>
        </div>

        {/* Coluna 2: Clientes CAC Vinculados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-brand-dark-5 pb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Clientes CAC Vinculados
            </h3>
            <span className="text-[10px] font-bold text-gray-500 bg-brand-dark-4 px-2 py-0.5 rounded-md border border-brand-dark-5">
              {alertasVinculados.length}
            </span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-dark-5 scrollbar-track-transparent">
            {alertasVinculados.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-8 text-center bg-brand-dark-2/20 rounded-2xl border border-dashed border-brand-dark-5">
                Nenhum vencimento pendente em CACs vinculados.
              </div>
            ) : (
              alertasVinculados.map((alerta) => renderCardAlerta(alerta))
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-brand-dark-5 flex justify-end">
        <p className="text-[9px] text-gray-500 font-bold uppercase italic">* Baseado nas regras de alerta do SisGCorp e IBAMA</p>
      </div>
    </div>
  );
}
