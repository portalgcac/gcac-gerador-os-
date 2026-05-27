import React, { useState, useEffect } from 'react';
import { Smartphone, X, Download, ArrowDown } from 'lucide-react';

// Evento nativo do Chrome/Android para prompt de instalação
let deferredPromptGlobal: any = null;

// Capturar o evento antes que o browser o descarte
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPromptGlobal = e;
});

/**
 * Detecta se é iOS
 */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detecta se está rodando como PWA instalado
 */
function isPWAInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

const STORAGE_KEY = 'gcac_install_prompt_dismissed';

export function InstallPwaPrompt() {
  const [visivel, setVisivel] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);
  const [podeMostrarNativo, setPodeMostrarNativo] = useState(false);

  useEffect(() => {
    // Não mostrar se já está instalado ou se o usuário já fechou antes
    if (isPWAInstalado()) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    const ios = isIOS();
    setEhIOS(ios);

    if (ios) {
      // iOS: mostrar instrução manual após 3 segundos
      const timer = setTimeout(() => setVisivel(true), 3000);
      return () => clearTimeout(timer);
    } else {
      // Android/Desktop: aguardar o evento beforeinstallprompt
      const verificar = () => {
        if (deferredPromptGlobal) {
          setPodeMostrarNativo(true);
          setVisivel(true);
        }
      };

      // Verificar imediatamente (caso já tenha sido capturado)
      verificar();

      // E também em evento futuro
      const handler = () => { verificar(); };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const fechar = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisivel(false);
  };

  const instalar = async () => {
    if (deferredPromptGlobal) {
      deferredPromptGlobal.prompt();
      const { outcome } = await deferredPromptGlobal.userChoice;
      deferredPromptGlobal = null;
      if (outcome === 'accepted') {
        fechar();
      }
    }
  };

  if (!visivel) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] animate-slide-up">
      <div className="bg-brand-dark-2 border border-brand-blue/30 rounded-2xl shadow-2xl p-4 max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <Smartphone size={18} className="text-brand-blue" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Instalar o Portal G CAC</p>
              <p className="text-[10px] text-gray-500">Acesso rápido + notificações</p>
            </div>
          </div>
          <button
            onClick={fechar}
            className="p-1 text-gray-600 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo por plataforma */}
        {ehIOS ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-300 leading-relaxed">
              Para receber alertas de vencimento no celular, adicione o app à sua tela inicial:
            </p>
            <div className="bg-brand-dark-3 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-200">
                <span className="w-5 h-5 rounded-full bg-brand-blue/20 text-brand-blue-light flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                Toque no ícone <strong className="text-white px-1">Compartilhar</strong> do Safari (quadrado com seta ↑)
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-200">
                <span className="w-5 h-5 rounded-full bg-brand-blue/20 text-brand-blue-light flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                Selecione <strong className="text-white px-1">"Adicionar à Tela de Início"</strong>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-200">
                <span className="w-5 h-5 rounded-full bg-brand-blue/20 text-brand-blue-light flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                Confirme tocando em <strong className="text-white px-1">"Adicionar"</strong>
              </div>
            </div>
            <button
              onClick={fechar}
              className="w-full py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
            >
              Fazer depois
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              Instale o app na sua tela inicial para acesso rápido e receber notificações de vencimentos diretamente no celular.
            </p>
            <div className="flex gap-2">
              <button
                onClick={fechar}
                className="flex-1 py-2 text-xs font-bold text-gray-500 hover:text-white border border-brand-dark-5 rounded-xl transition-colors"
              >
                Agora não
              </button>
              {podeMostrarNativo ? (
                <button
                  onClick={instalar}
                  className="flex-1 py-2 text-xs font-black text-white bg-brand-blue hover:bg-brand-blue/90 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download size={13} /> Instalar
                </button>
              ) : (
                <button
                  onClick={fechar}
                  className="flex-1 py-2 text-xs font-bold text-brand-blue-light border border-brand-blue/30 rounded-xl transition-colors"
                >
                  Entendi
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
