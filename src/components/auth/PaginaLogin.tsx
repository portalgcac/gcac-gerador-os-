import React, { useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Wifi, WifiOff, ShieldCheck, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';

const SLIDES = [
  {
    image: '/usar no site/1.jpg',
    badge: 'LOGO OFICIAL',
    title: 'Portal G CAC',
    description: 'A marca oficial do Portal G CAC, a plataforma de gestão inteligente e controle de documentos integrada para atiradores e despachantes.'
  },
  {
    image: '/usar no site/2.jpg',
    badge: 'PERFIL DO CLIENTE',
    title: 'Informações Pessoais',
    description: 'Painel de perfil do cliente, onde o usuário registra e cadastra de forma organizada todas as suas informações pessoais.'
  },
  {
    image: '/usar no site/3.jpg',
    badge: 'ACERVO E MANEJO',
    title: 'Cadastro Sem Limites',
    description: 'Painel para cadastro de suas armas, guias de tráfego e autorizações de manejo do Ibama, sem limites de cadastro de itens.'
  },
  {
    image: '/usar no site/4.jpg',
    badge: 'PAINEL DE ALERTAS',
    title: 'Controle de Vencimentos',
    description: 'Painel centralizado de alertas, onde aparecem de forma clara todos os avisos de vencimento dos seus documentos cadastrados.'
  },
  {
    image: '/usar no site/5.jpg',
    badge: 'NOTIFICAÇÕES MOBILE',
    title: 'Alertas Direto no Celular',
    description: 'Exemplo da notificação automática que você receberá na tela do seu celular quando algum documento estiver se aproximando do vencimento.'
  },
  {
    image: '/usar no site/6.jpg',
    badge: 'CONFIGURAÇÕES',
    title: 'Preferências de Alerta',
    description: 'Painel de configurações no qual você define exatamente quando e como deseja receber os avisos e sinais de alerta dos seus documentos.'
  },
  {
    image: '/usar no site/7.jpg',
    badge: 'EXPORTAÇÃO E ALERTAS',
    title: 'Ativação e Exportação',
    description: 'Configure e ative as notificações do sistema, com a facilidade de exportar todo o seu acervo e dados para formatos PDF ou Excel.'
  },
  {
    image: '/usar no site/8.jpg',
    badge: 'VÍNCULO DESPACHANTE',
    title: 'Integração com Escritório (Opcional)',
    description: 'Vincule sua conta opcionalmente ao escritório Gcac Despachante Bélico, permitindo que eles acompanhem seus prazos e ajudem no controle de vencimentos.'
  },
  {
    image: '/usar no site/9.jpg',
    badge: 'LICENÇA DO PORTAL',
    title: 'Adquira seu Acesso',
    description: 'Oferta especial do aplicativo Portal G CAC na palma da sua mão. Garanta sua licença e eleve o nível da sua organização operacional.'
  }
];

export function PaginaLogin() {
  const { login } = useAuth();
  const online = useStatusConexao();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Efeito de reprodução automática (Autoplay)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const handleLogin = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    onSuccess: async (tokenResponse) => {
      setCarregando(true);
      try {
        await login(tokenResponse);
      } catch (err: any) {
        if (err.message === 'ACESSO_REJEITADO') {
          setErro('Acesso Negado: Este aplicativo é restrito para uso oficial.');
        } else {
          setErro('Erro ao fazer login. Tente novamente.');
        }
      } finally {
        setCarregando(false);
      }
    },
    onError: () => {
      setErro('Login cancelado ou falhou. Tente novamente.');
      setCarregando(false);
    },
  });

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-y-auto overflow-x-hidden">
      {/* Gradiente de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-blue/5 blur-3xl" />
      </div>

      {/* Status de conexão */}
      <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium z-20 ${
        online ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}>
        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
        {online ? 'Online' : 'Offline'}
      </div>

      <div className="w-full max-w-sm lg:max-w-6xl xl:max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center animate-slide-up z-10 py-6">
        
        {/* Lado Esquerdo: Card de Login & Cadastro (Cols 1-5 no desktop) */}
        <div className="lg:col-span-5 w-full max-w-sm mx-auto flex flex-col justify-center">
          
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-brand-dark-5/40 shadow-glow-blue bg-brand-dark flex items-center justify-center">
                <img
                  src="/usar no site/1.jpg"
                  alt="GCAC Logo"
                  className="w-full h-full object-contain p-3 transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Vignete de suavização de borda */}
                <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(13,13,13,0.95)] pointer-events-none" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">PORTAL G CAC</h1>
            <p className="text-brand-green font-bold text-base sm:text-lg tracking-widest uppercase">Gestão & Documentos</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Sistema Integrado para CAC</p>
          </div>

          {/* Card de login */}
          <div className="card border border-brand-dark-5 space-y-5">
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-white">Bem-vindo</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Faça login com sua conta Google para sincronizar suas ordens com o Drive
              </p>
            </div>

            {!online && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <WifiOff size={18} className="text-yellow-400 mx-auto mb-1" />
                <p className="text-xs text-yellow-300">
                  Você está sem internet. O login com Google requer conexão.
                </p>
              </div>
            )}

            {erro && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-red-400">{erro}</p>
              </div>
            )}

            {/* Caixa de Termos de Uso e Política de Privacidade */}
            <div className="flex items-start gap-2.5 text-xs text-gray-400 bg-brand-dark-4/50 border border-brand-dark-5/50 p-3 rounded-xl hover:border-brand-blue/30 transition-all">
              <input 
                type="checkbox" 
                id="termos-aceite" 
                checked={aceitouTermos} 
                onChange={(e) => setAceitouTermos(e.target.checked)} 
                className="mt-0.5 rounded border-brand-dark-5 text-brand-blue bg-brand-dark-3 focus:ring-brand-blue cursor-pointer h-4 w-4"
              />
              <label htmlFor="termos-aceite" className="leading-tight select-none cursor-pointer text-gray-400 text-[11px] sm:text-xs">
                Declaro que li e concordo com os <Link to="/termos" className="text-brand-blue hover:text-brand-blue-light underline font-semibold">Termos de Uso</Link> e a <Link to="/privacidade" className="text-brand-blue hover:text-brand-blue-light underline font-semibold">Política de Privacidade</Link> do Portal GCAC.
              </label>
            </div>

            {/* Botão Google */}
            <button
              id="btn-login-google"
              onClick={() => { setErro(''); handleLogin(); }}
              disabled={carregando || !online || !aceitouTermos}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {carregando ? 'Entrando...' : 'Entrar com Google'}
            </button>

            {/* Segurança */}
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-brand-dark-4 rounded-lg p-3">
              <ShieldCheck size={14} className="text-brand-green flex-shrink-0 mt-0.5" />
              <p className="leading-snug">
                Apenas arquivos criados por este app serão acessados no seu Drive (escopo drive.file). Seus arquivos existentes permanecem intocados.
              </p>
            </div>

            {/* Divisor */}
            <div className="relative flex py-1.5 items-center">
              <div className="flex-grow border-t border-brand-dark-5"></div>
              <span className="flex-shrink mx-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ainda não tem conta?</span>
              <div className="flex-grow border-t border-brand-dark-5"></div>
            </div>

            {/* Pré-Cadastro Único */}
            <div className="space-y-3 pt-0.5">
              <Link
                to="/cadastro"
                className="w-full flex items-center justify-center gap-2 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-md hover:shadow-glow-blue active:scale-95 text-center"
              >
                Fazer Pré-Cadastro
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <a
                  href={`https://wa.me/5564999959865?text=${encodeURIComponent('Olá! Conheci o Portal G CAC e gostaria de solicitar uma demonstração comercial para meu escritório de despachante.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 font-bold py-2.5 px-2 rounded-xl text-[10px] sm:text-xs uppercase transition-all text-center"
                >
                  Comercial 1
                </a>
                <a
                  href={`https://wa.me/5564999681003?text=${encodeURIComponent('Olá! Conheci o Portal G CAC e gostaria de solicitar uma demonstração comercial para meu escritório de despachante.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 font-bold py-2.5 px-2 rounded-xl text-[10px] sm:text-xs uppercase transition-all text-center"
                >
                  Comercial 2
                </a>
              </div>

              <p className="text-[10px] text-gray-500 text-center font-bold">
                Contato: <a href="mailto:portalgcac@gmail.com" className="text-brand-blue hover:underline">portalgcac@gmail.com</a>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">
            Portal G CAC v1.0 — Uso pessoal
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
            <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
            <span>•</span>
            <Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
          </div>
        </div>

        {/* Lado Direito: Carrossel do Layout (Cols 6-12 no desktop) */}
        <div className="lg:col-span-7 w-full flex flex-col justify-center bg-brand-dark-2/40 border border-brand-dark-5/50 rounded-3xl p-5 sm:p-8 backdrop-blur-md relative overflow-hidden shadow-2xl">
          
          <div className="flex flex-col gap-1 mb-6 text-left">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-green animate-pulse" />
              Tour pelo Sistema
            </h2>
            <p className="text-gray-400 text-sm">
              Explore os recursos e veja por dentro os painéis e ferramentas criados para facilitar sua gestão.
            </p>
          </div>

          {/* Simulador de Navegador (Moldura Premium) */}
          <div className="relative border border-brand-dark-5 rounded-2xl bg-brand-dark-3 shadow-2xl overflow-hidden group">
            {/* Barra do Navegador */}
            <div className="flex items-center justify-between px-4 py-3 bg-brand-dark-2 border-b border-brand-dark-5 select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="hidden sm:block text-[10px] text-gray-500 bg-brand-dark-4 px-8 py-0.5 rounded-full border border-brand-dark-5/60 tracking-wider">
                portalgcac.com.br/dashboard
              </div>
              <div className="w-10" />
            </div>

            {/* Área da Imagem do Slide */}
            <div 
              className="relative cursor-zoom-in overflow-hidden aspect-[16/10] bg-brand-dark-2 flex items-center justify-center"
              onClick={() => setZoomImage(SLIDES[currentSlide].image)}
            >
              <img
                src={SLIDES[currentSlide].image}
                alt={SLIDES[currentSlide].title}
                className="w-full h-full object-contain p-2 transition-all duration-700 ease-in-out transform group-hover:scale-[1.02] animate-fade-in"
                key={currentSlide}
              />
              
              {/* Overlay com botão de Zoom */}
              <div className="absolute inset-0 bg-brand-dark/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="bg-brand-dark-3/95 text-white p-3.5 rounded-full shadow-2xl border border-brand-dark-5 flex items-center justify-center backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-all duration-300">
                  <Maximize2 size={20} className="text-brand-green" />
                </div>
              </div>
            </div>

            {/* Setas de navegação */}
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-brand-dark-3/90 text-gray-400 hover:text-white border border-brand-dark-5 hover:border-brand-blue/50 hover:bg-brand-blue/10 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg"
              aria-label="Slide anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-brand-dark-3/90 text-gray-400 hover:text-white border border-brand-dark-5 hover:border-brand-blue/50 hover:bg-brand-blue/10 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg"
              aria-label="Próximo slide"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Descrição do Slide Ativo */}
          <div className="mt-5 space-y-2.5 animate-fade-in min-h-[96px] sm:min-h-[88px]" key={`desc-${currentSlide}`}>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30">
                {SLIDES[currentSlide].badge}
              </span>
              <span className="text-xs text-gray-500 font-bold">
                Imagem {currentSlide + 1} de {SLIDES.length}
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight">
              {SLIDES[currentSlide].title}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              {SLIDES[currentSlide].description}
            </p>
          </div>

          {/* Indicadores (Dots) de Navegação */}
          <div className="flex justify-center items-center gap-2.5 mt-6 border-t border-brand-dark-5/40 pt-5">
            {SLIDES.map((slide, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx 
                    ? 'w-7 bg-brand-green shadow-glow' 
                    : 'w-2 bg-brand-dark-5 hover:bg-brand-metal'
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>

        </div>

      </div>

      {/* Modal Zoom em Tela Cheia */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-dark/95 backdrop-blur-xl animate-fade-in cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          {/* Botão de Fechar */}
          <button 
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-5 text-gray-400 hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all duration-200"
          >
            <X size={20} />
          </button>

          {/* Imagem Ampliada */}
          <div className="relative max-w-6xl max-h-[85vh] w-full flex items-center justify-center border border-brand-dark-5 rounded-2xl bg-brand-dark shadow-2xl overflow-hidden cursor-default" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomImage} 
              alt="Visualização ampliada do layout" 
              className="max-w-full max-h-[85vh] object-contain"
            />
            
            {/* Texto Descritivo no Modal */}
            <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent border-t border-brand-dark-5/50 flex flex-col gap-1 text-left">
              <span className="text-[10px] font-bold text-brand-green uppercase tracking-widest">{SLIDES.find(s => s.image === zoomImage)?.badge}</span>
              <h4 className="text-base font-black text-white">{SLIDES.find(s => s.image === zoomImage)?.title}</h4>
              <p className="text-xs text-gray-400 leading-snug">{SLIDES.find(s => s.image === zoomImage)?.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
