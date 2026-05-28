import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, NavegacaoInferior } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';
import { useOrdens } from '../../context/OrdensContext';
import { sincronizarPendentes } from '../../services/driveSync';
import { OnboardingCAC } from '../common/OnboardingCAC';
import { OnboardingEmpresa } from '../common/OnboardingEmpresa';
import { buscarVinculosPendentesCAC, VinculoDespachanteCac } from '../../services/vinculosService';
import { NotificacaoVinculo } from '../vinculos/NotificacaoVinculo';
import { supabase } from '../../db/supabase';
import { InstallPwaPrompt } from '../common/InstallPwaPrompt';

export function AppShell() {
  const { estaAutenticado, usuario } = useAuth();
  const { itensFila } = useOrdens();
  const online = useStatusConexao();
  const location = useLocation();
  const [jaSincronizou, setJaSincronizou] = React.useState(false);
  const [vinculoPendente, setVinculoPendente] = React.useState<VinculoDespachanteCac | null>(null);
  const [modalVinculoAberto, setModalVinculoAberto] = React.useState(false);

  // Scroll to top on route change (Default behavior)
  React.useEffect(() => {
    const main = document.getElementById('scroll-main');
    if (main) main.scrollTop = 0;
  }, [location.pathname]);

  // Auto-sync quando volta a ficar online com itens pendentes
  React.useEffect(() => {
    if (online && estaAutenticado && itensFila > 0 && !jaSincronizou) {
      setJaSincronizou(true);
      sincronizarPendentes().finally(() => {
        setTimeout(() => setJaSincronizou(false), 30000);
      });
    }
    if (!online) setJaSincronizou(false);
  }, [online, estaAutenticado, itensFila]);

  // Busca vínculos pendentes do CAC Individual
  React.useEffect(() => {
    const empresaId = usuario?.empresaId;
    if (!estaAutenticado || usuario?.tipoConta !== 'cac_individual' || !empresaId) {
      setVinculoPendente(null);
      return;
    }

    const checarVinculos = async () => {
      const pendentes = await buscarVinculosPendentesCAC(empresaId);
      if (pendentes.length > 0) {
        setVinculoPendente(pendentes[0]);
      } else {
        setVinculoPendente(null);
      }
    };

    checarVinculos();

    // Habilitar escuta Realtime para novos vínculos pendentes
    const channel = supabase
      .channel('realtime-vinculos-appshell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vinculos_despachante_cac' },
        () => {
          checarVinculos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [estaAutenticado, usuario]);

  const handleRespondido = () => {
    setModalVinculoAberto(false);
    setVinculoPendente(null);
  };

  return (
    <div className="flex h-screen bg-brand-dark overflow-hidden">
      {/* Sidebar — visível apenas em sm+ */}
      <div className="hidden sm:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <main id="scroll-main" className="flex-1 overflow-y-auto">
        {/* Banner offline */}
        {!online && (
          <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 text-center">
            <p className="text-xs text-yellow-300 font-medium">
              ⚠️ Modo offline — suas alterações serão sincronizadas ao reconectar
            </p>
          </div>
        )}

        {/* Banner Vínculo Pendente */}
        {vinculoPendente && (
          <div className="bg-brand-blue/20 border-b border-brand-blue/30 px-4 py-2.5 flex items-center justify-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-blue-light"></span>
            </span>
            <p className="text-xs text-brand-blue-light font-bold truncate">
              🔗 {vinculoPendente.despachante_nome} solicitou vínculo ao seu acervo.
            </p>
            <button
              onClick={() => setModalVinculoAberto(true)}
              className="bg-brand-blue/30 hover:bg-brand-blue/50 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-brand-blue/20 transition-all shrink-0"
            >
              Analisar
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 pb-24 sm:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Navegação inferior — apenas mobile */}
      <NavegacaoInferior />

      {/* Prompt de instalação do PWA */}
      <InstallPwaPrompt />

      {/* Tutorial de Boas-vindas para CAC Individual */}
      <OnboardingCAC />

      {/* Tutorial de Boas-vindas para Despachante / Empresa */}
      <OnboardingEmpresa />

      {/* Modal de Detalhes do Vínculo Pendente */}
      {modalVinculoAberto && vinculoPendente && (
        <NotificacaoVinculo
          vinculo={vinculoPendente}
          onClose={() => setModalVinculoAberto(false)}
          onRespondido={handleRespondido}
        />
      )}
    </div>
  );
}

