import React, { useState, useRef, useEffect } from 'react';
import { Building2, Shield, ChevronDown, Check, Sparkles, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ContextoAtivo } from '../../types';

export function WorkspaceSwitcher() {
  const { usuario, contextoAtivo, setContextoAtivo, ehSocioPortal, ehGestorPrincipal } = useAuth();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fecha o menu se clicar fora
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

    if (novoContexto === 'portal_saas') {
      navigate('/portal-admin');
    } else {
      navigate('/dashboard');
    }
  };

  const isEscritorio = contextoAtivo === 'escritorio';

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
