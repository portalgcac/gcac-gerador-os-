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
import { Lock, MessageCircle } from 'lucide-react';

export function AppShell() {
  const { estaAutenticado, usuario, logout } = useAuth();
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

  // Lógica de Vencimento e Bloqueio (Pricing & Planos)
  const planoStatus = usuario?.dadosEmpresa?.planoStatus;
  const dataVencimento = usuario?.dadosEmpresa?.dataVencimento;
  const isGratis = usuario?.dadosEmpresa?.isGratis;
  const isMasterAdmin = usuario?.email === 'gui.gomesassis@gmail.com';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let estaBloqueado = false;
  let diasAteVencer: number | null = null;

  if (estaAutenticado && !isMasterAdmin && !isGratis) {
    if (planoStatus === 'suspenso') {
      estaBloqueado = true;
    } else if (dataVencimento) {
      const vencDate = new Date(dataVencimento + 'T00:00:00');
      if (hoje > vencDate) {
        estaBloqueado = true;
      } else {
        const diffTime = vencDate.getTime() - hoje.getTime();
        diasAteVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
  }

  if (estaBloqueado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark overflow-hidden p-4">
        {/* Efeito de fundo decorativo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-blue/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-12 left-12 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative w-full max-w-md bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
          {/* Logo / Header icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-6 animate-pulse">
            <Lock size={28} />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">
            Acesso Restrito
          </h2>
          
          <p className="text-gray-400 text-xs sm:text-sm mb-6 leading-relaxed">
            {planoStatus === 'suspenso' ? (
              <>
                A assinatura da empresa <strong className="text-white">{usuario?.dadosEmpresa?.nome || usuario?.empresaNome}</strong> foi suspensa temporariamente.
              </>
            ) : (
              <>
                O período de licença do portal GCAC para a empresa <strong className="text-white">{usuario?.dadosEmpresa?.nome || usuario?.empresaNome}</strong> expirou em <strong className="text-white">{dataVencimento ? new Date(dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</strong>.
              </>
            )}
            <br />
            Por favor, entre em contato com o suporte do Portal GCAC para regularizar seu plano e restabelecer o acesso aos recursos.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá, gostaria de regularizar a assinatura do Portal GCAC para a empresa ${usuario?.dadosEmpresa?.nome || usuario?.empresaNome || ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue-light text-white text-xs font-black uppercase tracking-wider py-3 px-4 rounded-xl border border-brand-blue-light/20 transition-all shadow-lg shadow-brand-blue/20"
            >
              <MessageCircle size={16} />
              Falar com Suporte (WhatsApp)
            </a>
            
            <button
              onClick={() => logout()}
              className="w-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-xl border border-white/[0.05] transition-all"
            >
              Sair da Conta
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.05] text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            Portal GCAC — Solução para Atiradores, Colecionadores, Caçadores e Despachantes de Armas
          </div>
        </div>
      </div>
    );
  }

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

        {/* Banner Vencimento em Breve */}
        {diasAteVencer !== null && diasAteVencer <= 5 && (
          <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2.5 flex items-center justify-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
            </span>
            <p className="text-xs text-yellow-300 font-bold truncate">
              ⚠️ Atenção: Sua assinatura do plano {usuario?.dadosEmpresa?.plano || 'GCAC'} vence em {diasAteVencer} {diasAteVencer === 1 ? 'dia' : 'dias'} ({dataVencimento ? new Date(dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : ''}). Regularize para evitar a suspensão.
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

        <div className="p-4 sm:p-6 pb-24 sm:pb-6 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
          <div className="flex-grow">
            <Outlet />
          </div>
          <footer className="mt-8 pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
            <div>
              Portal G CAC — Solução para Atiradores, Colecionadores, Caçadores e Despachantes
            </div>
            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity duration-300">
              <span>Desenvolvido por</span>
              <img 
                src="/LOGO PORTAL G CAC 2 SEM FRASE.png" 
                alt="G CAC Logo" 
                className="h-3.5 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </footer>
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

