import React, { useState, useRef, useEffect } from 'react';
import { Building2, Shield, ChevronDown, Check, Sparkles, ArrowRightLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ContextoAtivo } from '../../types';

interface WorkspaceSwitcherProps {
  variant?: 'sidebar' | 'compact' | 'header';
  onTrocar?: () => void;
}

export function WorkspaceSwitcher({ variant = 'sidebar', onTrocar }: WorkspaceSwitcherProps) {
  const { usuario, contextoAtivo, setContextoAtivo, ehSocioPortal, ehGestorPrincipal } = useAuth();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fecha o menu se clicar fora (caso seja dropdown não-modal)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Se o usuário não for sócio/gestor do Portal G CAC, não renderiza o alternador
  if (!ehSocioPortal) {
    return null;
  }

  const handleTrocarContexto = (novoContexto: ContextoAtivo) => {
    if (novoContexto === contextoAtivo) {
      setAberto(false);
      return;
    }
    setContextoAtivo(novoContexto);
    setAberto(false);
    onTrocar?.();

    if (novoContexto === 'portal_saas') {
      navigate('/portal-admin');
    } else {
      navigate('/dashboard');
    }
  };

  const isEscritorio = contextoAtivo === 'escritorio';

  // Renderização compacta (para Topbar mobile ou cabeçalhos estreitos)
  if (variant === 'compact' || variant === 'header') {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 ${
            isEscritorio
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20'
              : 'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40 text-purple-200 shadow-purple-950/30'
          }`}
          title="Toque para alternar entre Escritório Despachante e Gestor Portal SaaS"
        >
          <div className={`p-1 rounded-lg ${isEscritorio ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/30 text-purple-300'}`}>
            {isEscritorio ? <Building2 size={13} /> : <Shield size={13} />}
          </div>
          <div className="flex flex-col text-left leading-none">
            <span className="text-[9px] text-gray-400 uppercase font-black tracking-wider">Layout</span>
            <span className="text-[11px] font-black tracking-tight truncate max-w-[85px] sm:max-w-none">
              {isEscritorio ? 'Escritório' : 'Gestor SaaS'}
            </span>
          </div>
          <div className="flex items-center gap-0.5 ml-0.5 text-gray-400">
            <ArrowRightLeft size={11} className="opacity-70" />
            <ChevronDown size={11} className={`transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Modal / Bottom Sheet de Seleção de Ambiente */}
        {aberto && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={() => setAberto(false)} />
            
            <div className="relative w-full max-w-lg bg-brand-dark-2 border border-brand-dark-5 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl z-10 animate-scale-up space-y-3 pb-8 sm:pb-5">
              <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-brand-blue/20 text-brand-blue-light">
                    <ArrowRightLeft size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Alternar Ambiente de Trabalho</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      {ehGestorPrincipal ? '👑 Gestor Principal & Fundador' : '🛡️ Sócio Administrador'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-brand-dark-3 hover:bg-brand-dark-4 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5">
                {/* Opção 1: GCAC Despachante */}
                <button
                  type="button"
                  onClick={() => handleTrocarContexto('escritorio')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between ${
                    isEscritorio
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                      : 'bg-brand-dark-3/60 hover:bg-brand-dark-3 text-gray-300 hover:text-white border-brand-dark-5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg mt-0.5 ${isEscritorio ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-dark-4 text-gray-400'}`}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-white">GCAC Despachante Bélico</span>
                        {isEscritorio && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">
                            Ativo Agora
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                        Atendimento particular de clientes, ordens de serviço, agendamentos, acervos, declarações e emissão de recibos.
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        <span>Layout Escritório Operacional</span>
                      </div>
                    </div>
                  </div>
                  {isEscritorio && <Check size={18} className="text-emerald-400 shrink-0 mt-1" />}
                </button>

                {/* Opção 2: Portal G CAC SaaS */}
                <button
                  type="button"
                  onClick={() => handleTrocarContexto('portal_saas')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between ${
                    !isEscritorio
                      ? 'bg-purple-500/20 border-purple-500/40 text-white shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/30'
                      : 'bg-brand-dark-3/60 hover:bg-brand-dark-3 text-gray-300 hover:text-white border-brand-dark-5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg mt-0.5 ${!isEscritorio ? 'bg-purple-500/30 text-purple-300' : 'bg-brand-dark-4 text-gray-400'}`}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                          Portal G CAC
                          <Sparkles size={13} className="text-purple-400" />
                        </span>
                        {!isEscritorio && (
                          <span className="text-[9px] bg-purple-500/25 text-purple-200 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold uppercase">
                            Ativo Agora
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                        Painel executivo da plataforma SaaS, despachantes assinantes, faturamento de licenças, inteligência executiva (BI) e controle societário.
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                        <span>Layout Gestor do Portal SaaS</span>
                      </div>
                    </div>
                  </div>
                  {!isEscritorio && <Check size={18} className="text-purple-400 shrink-0 mt-1" />}
                </button>
              </div>

              <div className="pt-2 border-t border-brand-dark-5/60 text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Sua sessão e privilégios são mantidos em ambos os ambientes
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Renderização padrão (para Sidebar desktop ou menu drawer lateral)
  return (
    <div className="relative px-3 pt-3 pb-1" ref={dropdownRef}>
      {/* Botão Gatilho do Workspace */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
          isEscritorio
            ? 'bg-brand-dark-3/90 hover:bg-brand-dark-4 border-brand-dark-5 hover:border-emerald-500/40 shadow-md'
            : 'bg-gradient-to-r from-purple-950/40 to-brand-dark-3 hover:from-purple-950/60 border-purple-500/30 hover:border-purple-400 shadow-purple-950/20 shadow-lg'
        }`}
        title="Alternar entre Escritório Despachante e Gestão do Portal SaaS"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
              isEscritorio
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 group-hover:scale-105'
                : 'bg-purple-500/20 border-purple-500/40 text-purple-300 group-hover:scale-105'
            }`}
          >
            {isEscritorio ? <Building2 size={16} /> : <Shield size={16} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase text-white truncate block">
                {isEscritorio ? 'GCAC Despachante' : 'Portal G CAC'}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
                isEscritorio ? 'text-emerald-400/90' : 'text-purple-300'
              }`}
            >
              {isEscritorio ? 'Escritório Operacional' : 'Gestão SaaS & Licenças'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-gray-400 group-hover:text-white shrink-0 ml-1.5">
          <ArrowRightLeft size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Menu Dropdown de Seleção de Ambiente */}
      {aberto && (
        <div className="absolute top-full left-3 right-3 mt-1.5 z-50 bg-brand-dark-2 border border-brand-dark-5 rounded-xl shadow-2xl p-1.5 space-y-1 animate-scale-up backdrop-blur-md">
          <div className="px-2 py-1 border-b border-brand-dark-5/60 flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Alternar Ambiente
            </span>
            {ehGestorPrincipal && (
              <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1 py-0.2 rounded font-bold uppercase">
                Gestor Principal
              </span>
            )}
          </div>

          {/* Opção 1: GCAC Despachante Bélico */}
          <button
            type="button"
            onClick={() => handleTrocarContexto('escritorio')}
            className={`w-full text-left p-2 rounded-lg flex items-start justify-between transition-all ${
              isEscritorio
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-white'
                : 'hover:bg-brand-dark-3 text-gray-300 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 mt-0.5">
                <Building2 size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">GCAC Despachante Bélico</p>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
                  Atendimento de clientes, OSs, acervos e rotinas de despachante.
                </p>
                <span className="inline-block mt-1 text-[9px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Escritório Particular
                </span>
              </div>
            </div>
            {isEscritorio && <Check size={14} className="text-emerald-400 shrink-0 mt-1" />}
          </button>

          {/* Opção 2: Portal G CAC (Gestão SaaS) */}
          <button
            type="button"
            onClick={() => handleTrocarContexto('portal_saas')}
            className={`w-full text-left p-2 rounded-lg flex items-start justify-between transition-all ${
              !isEscritorio
                ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                : 'hover:bg-brand-dark-3 text-gray-300 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-300 mt-0.5">
                <Shield size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                  Portal G CAC
                  <Sparkles size={11} className="text-purple-400" />
                </p>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
                  Despachantes assinantes, licenças, vendas B2B e faturamento SaaS.
                </p>
                <span className="inline-block mt-1 text-[9px] font-bold uppercase text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/20">
                  Empresa de Tecnologia (SaaS)
                </span>
              </div>
            </div>
            {!isEscritorio && <Check size={14} className="text-purple-400 shrink-0 mt-1" />}
          </button>
        </div>
      )}
    </div>
  );
}
