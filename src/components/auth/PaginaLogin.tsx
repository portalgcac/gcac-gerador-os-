import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';

export function PaginaLogin() {
  const { login } = useAuth();
  const online = useStatusConexao();
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aceitouTermos, setAceitouTermos] = React.useState(false);

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
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Gradiente de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-blue/5 blur-3xl" />
      </div>

      {/* Status de conexão */}
      <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        online ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}>
        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
        {online ? 'Online' : 'Offline'}
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/LOGO CORRETA.png"
              alt="GCAC Logo"
              className="w-32 h-32 object-contain drop-shadow-2xl"
              style={{ mixBlendMode: 'screen' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">PORTAL G CAC</h1>
          <p className="text-brand-green font-bold text-lg tracking-widest uppercase">Gestão & Documentos</p>
          <p className="text-gray-500 text-sm mt-2">Sistema Integrado para CAC</p>
        </div>

        {/* Card de login */}
        <div className="card border border-brand-dark-5 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">Bem-vindo</h2>
            <p className="text-sm text-gray-400 mt-1">
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
            <p>
              Apenas arquivos criados por este app serão acessados no seu Drive (escopo drive.file). Seus arquivos existentes permanecem intocados.
            </p>
          </div>

          {/* Divisor */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-brand-dark-5"></div>
            <span className="flex-shrink mx-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ainda não tem conta?</span>
            <div className="flex-grow border-t border-brand-dark-5"></div>
          </div>

          {/* Pré-Cadastro Único */}
          <div className="space-y-3 pt-1">
            <Link
              to="/cadastro"
              className="w-full flex items-center justify-center gap-2 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-md hover:shadow-glow-blue active:scale-95 text-center"
            >
              Fazer Pré-Cadastro
            </Link>

            <div className="grid grid-cols-2 gap-2 pt-1">
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
    </div>
  );
}
