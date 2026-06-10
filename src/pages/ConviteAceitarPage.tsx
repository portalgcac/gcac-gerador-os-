import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Loader2, Wifi, WifiOff, UserPlus, FileText, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStatusConexao } from '../hooks/useStatusConexao';
import { validarConvite, aceitarConvite, ConviteCac } from '../services/convitesService';
import { supabase } from '../db/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Criação automática de conta CAC Individual após login Google no fluxo de convite
// ─────────────────────────────────────────────────────────────────────────────
async function criarContaCacSeNecessario(
  googleInfo: { email: string; name: string; picture: string; sub: string },
  convite: ConviteCac,
): Promise<{ sucesso: boolean; empresaId?: string; erro?: string }> {
  const emailLower = googleInfo.email.trim().toLowerCase();

  // 1. Verifica se já existe na whitelist
  const { data: usuarioExistente } = await supabase
    .from('usuarios_autorizados')
    .select('id, empresa_id, ativo')
    .eq('email', emailLower)
    .maybeSingle();

  if (usuarioExistente?.ativo) {
    // Usuário já existe — apenas retorna o empresaId
    return { sucesso: true, empresaId: usuarioExistente.empresa_id };
  }

  // 2. Cria a empresa CAC Individual
  const { data: novaEmpresa, error: erroEmpresa } = await supabase
    .from('empresas')
    .insert([{
      nome: googleInfo.name.toUpperCase(),
      tipo_conta: 'cac_individual',
      modulos_ativos: ['clientes', 'agenda', 'config'],
      limite_cac_vinculados: 0,
      recursos_liberados: [],
    }])
    .select('id')
    .single();

  if (erroEmpresa || !novaEmpresa) {
    return { sucesso: false, erro: 'Erro ao criar empresa: ' + erroEmpresa?.message };
  }

  const empresaId = novaEmpresa.id;

  // 3. Cria o usuário autorizado
  const { error: erroUsuario } = await supabase
    .from('usuarios_autorizados')
    .insert([{
      nome: googleInfo.name,
      email: emailLower,
      cpf: convite.cliente_cpf || null,
      empresa_id: empresaId,
      role: 'admin',
      ativo: true,
      permissoes: ['clientes', 'agenda', 'config'],
    }]);

  if (erroUsuario) {
    return { sucesso: false, erro: 'Erro ao criar usuário: ' + erroUsuario.message };
  }

  // 4. Cria o cliente automático do CAC (perfil próprio)
  await supabase.from('clientes').insert([{
    nome: googleInfo.name.toUpperCase(),
    cpf: convite.cliente_cpf || null,
    email: emailLower,
    empresa_id: empresaId,
    observacoes: 'PERFIL INDIVIDUAL CAC (criado via convite despachante)',
  }]);

  return { sucesso: true, empresaId };
}

// ─────────────────────────────────────────────────────────────────────────────

type Fase = 'verificando' | 'invalido' | 'expirado' | 'aceito_antes' | 'pronto' | 'logando' | 'processando' | 'sucesso' | 'erro';

export function ConviteAceitarPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { usuario, login: loginAuth } = useAuth();
  const online = useStatusConexao();

  const [fase, setFase] = useState<Fase>('verificando');
  const [convite, setConvite] = useState<ConviteCac | null>(null);
  const [mensagemErro, setMensagemErro] = useState('');
  const [minutosRestantes, setMinutosRestantes] = useState<number | null>(null);

  // ── Valida o token ao montar ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setFase('invalido');
      return;
    }
    (async () => {
      const resultado = await validarConvite(token);
      if (!resultado.valido) {
        if (resultado.convite?.status === 'aceito') {
          setFase('aceito_antes');
        } else if (resultado.erro?.includes('expirou')) {
          setFase('expirado');
        } else {
          setFase('invalido');
        }
        setMensagemErro(resultado.erro || '');
        return;
      }
      setConvite(resultado.convite!);

      // Calcula tempo restante
      const expiresAt = new Date(resultado.convite!.expira_em);
      const mins = Math.floor((expiresAt.getTime() - Date.now()) / 60000);
      setMinutosRestantes(mins);

      // Se o usuário já está logado, vai direto para o processamento
      if (usuario) {
        setFase('processando');
        processarAceite(resultado.convite!, usuario.email, usuario.nome, usuario.empresaId);
      } else {
        setFase('pronto');
      }
    })();
  }, [token]);

  // ── Processamento do aceite ────────────────────────────────────────────────
  const processarAceite = useCallback(async (
    conviteData: ConviteCac,
    email: string,
    nome: string,
    empresaIdAtual?: string,
  ) => {
    setFase('processando');
    try {
      let empresaId = empresaIdAtual;

      // Se não tem empresaId ainda (usuário novo), cria a conta CAC
      if (!empresaId) {
        // Busca dados do Google com o token salvo
        const dadosUsuario = localStorage.getItem('gcac_usuario');
        if (!dadosUsuario) throw new Error('Sessão não encontrada.');
        const u = JSON.parse(dadosUsuario);

        const resultado = await criarContaCacSeNecessario(
          { email, name: nome, picture: u.fotoPerfil, sub: u.id },
          conviteData,
        );

        if (!resultado.sucesso || !resultado.empresaId) {
          setMensagemErro(resultado.erro || 'Erro ao criar conta.');
          setFase('erro');
          return;
        }
        empresaId = resultado.empresaId;
      }

      // Aceita o convite e cria o vínculo
      const aceite = await aceitarConvite(conviteData.token, empresaId!, email, nome);

      if (!aceite.sucesso) {
        setMensagemErro(aceite.erro || 'Erro ao aceitar convite.');
        setFase('erro');
        return;
      }

      setFase('sucesso');

      // Redireciona para o app após 3s
      setTimeout(() => navigate('/agenda'), 3000);
    } catch (e: any) {
      setMensagemErro(e.message || 'Erro inesperado.');
      setFase('erro');
    }
  }, [navigate]);

  // ── Login Google ──────────────────────────────────────────────────────────
  const handleLoginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    onSuccess: async (tokenResponse) => {
      setFase('logando');
      try {
        // Busca info do Google
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();

        // Salva o token e info básica mesmo antes de checar whitelist
        const dadosTmp = { id: info.sub, nome: info.name, email: info.email, fotoPerfil: info.picture, accessToken: tokenResponse.access_token };
        localStorage.setItem('gcac_usuario', JSON.stringify(dadosTmp));

        // Tenta logar normalmente (se a conta já existe)
        try {
          await loginAuth(tokenResponse);
          // loginAuth populou o usuario — aguarda o estado atualizar
          // O processamento será disparado no useEffect abaixo
        } catch {
          // Conta ainda não existe — processarAceite cria a conta
        }

        // Processa o aceite com os dados do Google
        if (convite) {
          await processarAceite(convite, info.email, info.name, undefined);
        }
      } catch (e: any) {
        setMensagemErro('Erro durante o login: ' + e.message);
        setFase('erro');
      }
    },
    onError: () => {
      setMensagemErro('Login cancelado ou falhou. Tente novamente.');
      setFase('pronto');
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  const renderConteudo = () => {
    switch (fase) {
      case 'verificando':
        return (
          <div className="text-center space-y-4">
            <Loader2 size={40} className="text-brand-blue animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Verificando convite...</p>
          </div>
        );

      case 'invalido':
        return (
          <div className="text-center space-y-4">
            <XCircle size={48} className="text-red-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Convite inválido</h2>
            <p className="text-sm text-gray-400">{mensagemErro || 'Este link de convite não é válido.'}</p>
          </div>
        );

      case 'expirado':
        return (
          <div className="text-center space-y-4">
            <Clock size={48} className="text-yellow-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Convite expirado</h2>
            <p className="text-sm text-gray-400">
              Este link de 24h expirou. Peça ao despachante para gerar um novo link de convite.
            </p>
          </div>
        );

      case 'aceito_antes':
        return (
          <div className="text-center space-y-4">
            <CheckCircle2 size={48} className="text-brand-green mx-auto" />
            <h2 className="text-lg font-bold text-white">Convite já aceito</h2>
            <p className="text-sm text-gray-400">
              Você já ativou o Portal GCAC anteriormente. Faça login normalmente.
            </p>
            <button onClick={() => navigate('/login')} className="btn-primary mx-auto">
              Ir para o Login
            </button>
          </div>
        );

      case 'pronto':
        return (
          <div className="space-y-6">
            {/* Info do despachante */}
            <div className="bg-brand-dark-4 border border-brand-blue/20 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-brand-blue-light uppercase tracking-widest">Convite de</p>
              <p className="text-lg font-bold text-white">{convite?.despachante_nome}</p>
              <div className="border-t border-brand-dark-5 pt-3 space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Para</p>
                <p className="text-sm font-semibold text-gray-300">{convite?.cliente_nome}</p>
                {minutosRestantes !== null && (
                  <p className="text-[10px] text-yellow-400 flex items-center gap-1">
                    <Clock size={10} /> Expira em ~{minutosRestantes > 60 ? `${Math.floor(minutosRestantes / 60)}h ${minutosRestantes % 60}min` : `${minutosRestantes}min`}
                  </p>
                )}
              </div>
            </div>

            {/* O que você terá acesso */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Você terá acesso a</p>
              {[
                { icon: <Layers size={14} />, texto: 'Seu acervo de armas e documentos' },
                { icon: <FileText size={14} />, texto: 'Autorizações de manejo e GTs' },
                { icon: <ShieldCheck size={14} />, texto: 'Alertas de vencimento de documentos' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-brand-dark-4 rounded-xl p-3 border border-brand-dark-5">
                  <div className="text-brand-blue-light">{item.icon}</div>
                  <span className="text-sm text-gray-300">{item.texto}</span>
                </div>
              ))}
            </div>

            {/* Botão de login */}
            {!online ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                <WifiOff size={16} className="text-yellow-400 mx-auto mb-1" />
                <p className="text-xs text-yellow-300">Você está sem internet. O login requer conexão.</p>
              </div>
            ) : (
              <button
                id="btn-login-google-convite"
                onClick={() => handleLoginGoogle()}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Entrar com Google e aceitar convite
              </button>
            )}

            <p className="text-[10px] text-gray-600 text-center leading-relaxed">
              Seus dados serão protegidos. O despachante terá acesso de <strong className="text-gray-500">leitura</strong> ao seu acervo histórico.
              Novos dados que você inserir serão exclusivamente seus.
            </p>
          </div>
        );

      case 'logando':
        return (
          <div className="text-center space-y-4">
            <Loader2 size={40} className="text-brand-blue animate-spin mx-auto" />
            <p className="text-white font-semibold">Fazendo login com Google...</p>
          </div>
        );

      case 'processando':
        return (
          <div className="text-center space-y-4">
            <Loader2 size={40} className="text-brand-blue animate-spin mx-auto" />
            <p className="text-white font-semibold">Ativando sua conta...</p>
            <p className="text-xs text-gray-400">Criando vínculo com o despachante. Aguarde.</p>
          </div>
        );

      case 'sucesso':
        return (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-brand-green/20 border-2 border-brand-green flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} className="text-brand-green" />
            </div>
            <h2 className="text-xl font-bold text-white">Portal ativado! 🎉</h2>
            <p className="text-sm text-gray-400">
              Sua conta foi criada e o vínculo com <strong className="text-white">{convite?.despachante_nome}</strong> foi estabelecido.
            </p>
            <p className="text-xs text-gray-500">Redirecionando em 3 segundos...</p>
          </div>
        );

      case 'erro':
        return (
          <div className="text-center space-y-4">
            <XCircle size={48} className="text-red-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Algo deu errado</h2>
            <p className="text-sm text-red-400">{mensagemErro}</p>
            <button onClick={() => setFase('pronto')} className="btn-primary mx-auto">
              Tentar novamente
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Gradiente de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-brand-green/10 blur-3xl" />
      </div>

      {/* Status de conexão */}
      <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        online ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}>
        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
        {online ? 'Online' : 'Offline'}
      </div>

      <div className="w-full max-w-sm animate-slide-up space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/LOGO 1 OFICIAL.png"
            alt="GCAC Logo"
            className="w-24 h-24 object-contain mx-auto drop-shadow-2xl"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-black text-white tracking-tight mt-2">PORTAL G CAC</h1>
          <p className="text-brand-green text-xs font-bold uppercase tracking-widest">Gestão & Documentos</p>
        </div>

        {/* Card principal */}
        <div className="card border border-brand-dark-5 p-6">
          {/* Badge "Convite" */}
          {fase === 'pronto' && (
            <div className="flex items-center justify-center mb-5">
              <span className="flex items-center gap-2 bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                <UserPlus size={12} /> Você foi convidado
              </span>
            </div>
          )}

          {renderConteudo()}
        </div>

        <p className="text-center text-[10px] text-gray-600">Portal G CAC — Uso restrito</p>
      </div>
    </div>
  );
}
