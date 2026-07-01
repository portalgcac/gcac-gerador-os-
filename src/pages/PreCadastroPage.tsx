import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../db/supabase';
import { 
  User, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle2, 
  Target, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  HelpCircle,
  Check,
  Building2,
  UserCheck
} from 'lucide-react';

export function PreCadastroPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Formulário
  const [tipoUsuario, setTipoUsuario] = useState<'despachante' | 'cac_individual'>('despachante');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [contato, setContato] = useState('');
  const [plano, setPlano] = useState('.357mag');
  const [frequenciaPagamento, setFrequenciaPagamento] = useState<'mensal' | 'semestral' | 'anual'>('mensal');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao'>('pix');

  const obterValorTotal = () => {
    if (plano === '.22LR') {
      return frequenciaPagamento === 'mensal' ? 'R$ 30,00' : frequenciaPagamento === 'semestral' ? 'R$ 162,00' : 'R$ 316,80';
    }
    if (plano === '.357mag') {
      return frequenciaPagamento === 'mensal' ? 'R$ 50,00' : frequenciaPagamento === 'semestral' ? 'R$ 270,00' : 'R$ 528,00';
    }
    if (plano === '.308win') {
      return frequenciaPagamento === 'mensal' ? 'R$ 100,00' : frequenciaPagamento === 'semestral' ? 'R$ 540,00' : 'R$ 1.056,00';
    }
    return '';
  };

  // Máscaras de digitação
  const formatarCPF = (val: string) => {
    const limpo = val.replace(/\D/g, '');
    if (limpo.length <= 11) {
      if (limpo.length <= 3) return limpo;
      if (limpo.length <= 6) return `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
      if (limpo.length <= 9) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
      return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
    } else {
      // CNPJ Mask: 00.000.000/0000-00
      if (limpo.length <= 12) {
        return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8)}`;
      }
      return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
    }
  };

  const formatarTelefone = (val: string) => {
    const limpo = val.replace(/\D/g, '');
    if (limpo.length === 0) return '';
    if (limpo.length <= 2) return `(${limpo}`;
    if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7, 11)}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatarCPF(e.target.value));
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContato(formatarTelefone(e.target.value));
  };

  // Ao mudar tipo de usuário, ajustamos o plano automático
  const handleTipoUsuarioSelection = (tipo: 'despachante' | 'cac_individual') => {
    setTipoUsuario(tipo);
    if (tipo === 'cac_individual') {
      setPlano('.22LR'); // CAC individual só pode usar .22LR
    } else {
      setPlano('.357mag'); // Default para despachante
    }
  };

  // Validações por etapa
  const validarPasso = () => {
    setErro('');
    if (step === 1) {
      if (!tipoUsuario) {
        setErro('Por favor, selecione seu tipo de perfil.');
        return false;
      }
    } else if (step === 2) {
      if (!nome.trim() || nome.trim().split(' ').length < 2) {
        setErro('Por favor, insira seu nome completo (nome e sobrenome).');
        return false;
      }
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        setErro('Por favor, insira um e-mail válido.');
        return false;
      }
      if (!email.toLowerCase().trim().endsWith('@gmail.com')) {
        setErro('Atenção: O e-mail cadastrado deve ser obrigatoriamente uma conta do Gmail (@gmail.com).');
        return false;
      }
    } else if (step === 3) {
      const docLimpo = cpf.replace(/\D/g, '');
      if (tipoUsuario === 'cac_individual') {
        if (docLimpo.length !== 11) {
          setErro('Por favor, insira um CPF válido com 11 dígitos.');
          return false;
        }
      } else {
        if (docLimpo.length !== 11 && docLimpo.length !== 14) {
          setErro('Por favor, insira um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
          return false;
        }
      }
      const telefoneLimpo = contato.replace(/\D/g, '');
      if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
        setErro('Por favor, insira um número de telefone com DDD válido.');
        return false;
      }
    }
    return true;
  };

  const avancar = async () => {
    if (carregando) return;
    if (!validarPasso()) return;

    if (step === 3) {
      const docLimpo = cpf.replace(/\D/g, '');
      if (docLimpo) {
        setCarregando(true);
        setErro('');
        try {
          // 1. Verificar em leads_pre_cadastro
          const { data: leadExistente, error: errLead } = await supabase
            .from('leads_pre_cadastro')
            .select('status')
            .eq('cpf', docLimpo)
            .in('status', ['pendente', 'contatado', 'ativado'])
            .limit(1);

          if (errLead) throw errLead;
          if (leadExistente && leadExistente.length > 0) {
            setErro('Este CPF/CNPJ já possui um pré-cadastro ativo ou pendente.');
            setCarregando(false);
            return;
          }

          // 2. Verificar em usuarios_autorizados
          const { data: usuarioExistente, error: errUser } = await supabase
            .from('usuarios_autorizados')
            .select('id')
            .or(`cpf.eq.${docLimpo},cpf.eq.${cpf}`)
            .limit(1);

          if (errUser) throw errUser;
          if (usuarioExistente && usuarioExistente.length > 0) {
            setErro('Este CPF/CNPJ já está cadastrado em uma conta ativa.');
            setCarregando(false);
            return;
          }
        } catch (err) {
          console.error(err);
          setErro('Erro ao verificar CPF/CNPJ duplicado. Tente novamente.');
          setCarregando(false);
          return;
        }
        setCarregando(false);
      }
    }

    setStep(prev => prev + 1);
  };

  const voltar = () => {
    setErro('');
    setStep(prev => prev - 1);
  };

  const enviarCadastro = async () => {
    setErro('');
    setCarregando(true);

    try {
      const docLimpo = cpf.replace(/\D/g, '');

      // 1. Verificar em leads_pre_cadastro
      const { data: leadExistente, error: errLead } = await supabase
        .from('leads_pre_cadastro')
        .select('status')
        .eq('cpf', docLimpo)
        .in('status', ['pendente', 'contatado', 'ativado'])
        .limit(1);

      if (errLead) throw errLead;
      if (leadExistente && leadExistente.length > 0) {
        setErro('Este CPF/CNPJ já possui um pré-cadastro ativo ou pendente.');
        setCarregando(false);
        return;
      }

      // 2. Verificar em usuarios_autorizados
      const { data: usuarioExistente, error: errUser } = await supabase
        .from('usuarios_autorizados')
        .select('id')
        .or(`cpf.eq.${docLimpo},cpf.eq.${cpf}`)
        .limit(1);

      if (errUser) throw errUser;
      if (usuarioExistente && usuarioExistente.length > 0) {
        setErro('Este CPF/CNPJ já está cadastrado em uma conta ativa.');
        setCarregando(false);
        return;
      }

      const { error } = await supabase
        .from('leads_pre_cadastro')
        .insert([
          {
            nome: nome.toUpperCase(),
            cpf: docLimpo,
            email: email.toLowerCase().trim(),
            contato: contato.replace(/\D/g, ''),
            plano,
            tipo_usuario: tipoUsuario,
            frequencia_pagamento: frequenciaPagamento,
            status: 'pendente'
          }
        ]);

      if (error) {
        throw error;
      }

      // 1. Enviar notificação em tela no app para o Super Admin (empresa_id da Matriz)
      const nomeFormatado = nome.toUpperCase();
      const planoFormatado = plano;
      const tipoUsuarioFormatado = tipoUsuario === 'cac_individual' 
        ? 'CAC Individual' 
        : 'Despachante';

      await supabase
        .from('notificacoes_sistema')
        .insert([{
          titulo: '🎯 Novo Pré-Cadastro Recebido',
          mensagem: `O cliente ${nomeFormatado} se pré-cadastrou no plano ${planoFormatado} (${frequenciaPagamento}) como ${tipoUsuarioFormatado}.`,
          tipo: 'info',
          link: '/portal-admin?tab=leads',
          empresa_id: '00000000-0000-0000-0000-000000000001'
        }]);

      // 2. Disparar push notification imediata para o Super Admin
      try {
        await supabase.functions.invoke('enviar-push-imediato', {
          body: {
            empresa_id: '00000000-0000-0000-0000-000000000001',
            titulo: '🎯 Novo Pré-Cadastro',
            mensagem: `${nomeFormatado} se cadastrou no ${planoFormatado} (${frequenciaPagamento}) como ${tipoUsuarioFormatado}.`,
            link: '/portal-admin?tab=leads'
          }
        });
      } catch (pushErr) {
        console.warn('Erro ao disparar push imediato:', pushErr);
      }

      setStep(6); // Tela de sucesso
    } catch (err: any) {
      console.error('Erro ao salvar pré-cadastro:', err);
      setErro('Ocorreu um erro ao salvar seu cadastro. Por favor, tente novamente ou fale com o suporte.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Elementos visuais de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-brand-blue/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-brand-green/10 blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-blue/5 blur-3xl" />
      </div>

      <div className="w-full max-w-2xl z-10">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <Target className="text-brand-green w-8 h-8" />
            PORTAL G CAC
          </h1>
          <p className="text-gray-400 text-sm mt-1">Pré-Cadastro e Seleção de Plano de Licenciamento</p>
        </div>

        {/* Card Principal */}
        <div className="card border border-brand-dark-5 bg-brand-dark-3/90 backdrop-blur-md shadow-2xl relative">
          
          {/* Barra de Progresso (Passos 1 a 5) */}
          {step <= 5 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Etapa {step} de 5</span>
                <span className="text-xs text-brand-green font-bold uppercase tracking-wider">
                  {step === 1 && 'Tipo de Perfil'}
                  {step === 2 && 'Identificação'}
                  {step === 3 && 'Contato'}
                  {step === 4 && 'Escolha de Plano'}
                  {step === 5 && 'Confirmar Dados'}
                </span>
              </div>
              <div className="h-2 bg-brand-dark-4 rounded-full overflow-hidden flex gap-0.5">
                <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-brand-blue' : 'bg-brand-dark-5'} flex-1`} />
                <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-brand-blue' : 'bg-brand-dark-5'} flex-1`} />
                <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-brand-blue' : 'bg-brand-dark-5'} flex-1`} />
                <div className={`h-full transition-all duration-300 ${step >= 4 ? 'bg-brand-blue' : 'bg-brand-dark-5'} flex-1`} />
                <div className={`h-full transition-all duration-300 ${step >= 5 ? 'bg-brand-blue' : 'bg-brand-dark-5'} flex-1`} />
              </div>
            </div>
          )}

          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-4 mb-6 animate-fade-in text-center font-medium">
              {erro}
            </div>
          )}

          {/* ── ETAPA 1: Tipo de Perfil ────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Selecione o seu perfil de acesso</h2>
                <p className="text-gray-400 text-sm mt-1">Escolha a opção que melhor se enquadra na sua atividade.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Opção Despachante */}
                <div 
                  onClick={() => handleTipoUsuarioSelection('despachante')}
                  className={`border rounded-xl p-6 cursor-pointer transition-all flex flex-col justify-between items-center text-center hover:border-brand-blue/60 ${
                    tipoUsuario === 'despachante' 
                      ? 'border-brand-blue bg-brand-blue/10 shadow-glow-blue' 
                      : 'border-brand-dark-5 bg-brand-dark-4'
                  }`}
                >
                  <Building2 className={`w-12 h-12 mb-3 ${tipoUsuario === 'despachante' ? 'text-brand-blue-light' : 'text-gray-500'}`} />
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Despachante Bélico</h3>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      Gerencie múltiplos clientes, emita ordens de serviço, orçamentos, recibos e organize sua empresa.
                    </p>
                  </div>
                  {tipoUsuario === 'despachante' && (
                    <span className="mt-4 px-3 py-1 bg-brand-blue/20 text-brand-blue-light rounded-full text-xs font-bold">
                      Selecionado
                    </span>
                  )}
                </div>

                {/* Opção CAC Individual */}
                <div 
                  onClick={() => handleTipoUsuarioSelection('cac_individual')}
                  className={`border rounded-xl p-6 cursor-pointer transition-all flex flex-col justify-between items-center text-center hover:border-brand-green/60 ${
                    tipoUsuario === 'cac_individual' 
                      ? 'border-brand-green bg-brand-green/10 shadow-glow' 
                      : 'border-brand-dark-5 bg-brand-dark-4'
                  }`}
                >
                  <UserCheck className={`w-12 h-12 mb-3 ${tipoUsuario === 'cac_individual' ? 'text-brand-green-light' : 'text-gray-500'}`} />
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">CAÇADOR, ATIRADOR DESPORTIVO, COLECIONADOR (CAC INDIVIDUAL)</h3>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      Acesso individual para gerenciar seu próprio acervo de armas, guias (GTs) e alertas pessoais de vencimento.
                    </p>
                  </div>
                  {tipoUsuario === 'cac_individual' && (
                    <span className="mt-4 px-3 py-1 bg-brand-green/20 text-brand-green-light rounded-full text-xs font-bold">
                      Selecionado
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 2: Nome e E-mail ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                  <User className="text-brand-blue" /> Quem é você?
                </h2>
                <p className="text-gray-400 text-sm mt-1">Queremos te conhecer melhor. Insira seu nome completo e melhor e-mail.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label label-required text-lg md:text-sm">Nome Completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="input py-3 text-base md:text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label label-required text-lg md:text-sm">Seu melhor E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: joao@seuemail.com"
                    className="input py-3 text-base md:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: CPF e Telefone ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                  <FileText className="text-brand-blue" /> Documento & Contato
                </h2>
                <p className="text-gray-400 text-sm mt-1">Dados essenciais para seu cadastro e para podermos entrar em contato pelo WhatsApp.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label label-required text-lg md:text-sm">
                    {tipoUsuario === 'cac_individual' ? 'CPF' : 'CPF ou CNPJ'}
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={handleCpfChange}
                    maxLength={tipoUsuario === 'cac_individual' ? 14 : 18}
                    placeholder={tipoUsuario === 'cac_individual' ? "000.000.000-00" : "000.000.000-00 ou 00.000.000/0000-00"}
                    className="input py-3 text-base md:text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label label-required text-lg md:text-sm">WhatsApp de Contato</label>
                  <input
                    type="text"
                    value={contato}
                    onChange={handleTelefoneChange}
                    maxLength={15}
                    placeholder="(00) 90000-0000"
                    className="input py-3 text-base md:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: Escolha do Plano ────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">
                  {tipoUsuario === 'cac_individual' 
                    ? 'Seu plano como CAC Individual' 
                    : 'Qual plano melhor atende seu escritório?'
                  }
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {tipoUsuario === 'cac_individual'
                    ? 'Atiradores, Caçadores e Colecionadores (CAC Individual) se enquadram exclusivamente no plano .22LR.'
                    : 'Selecione uma das opções abaixo baseada no calibre comercial de sua empresa.'
                  }
                </p>
              </div>

              {/* Seletor de Frequência de Pagamento */}
              <div className="flex justify-center mb-6">
                <div className="bg-brand-dark-4 border border-brand-dark-5 p-1 rounded-2xl flex gap-1">
                  {(['mensal', 'semestral', 'anual'] as const).map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequenciaPagamento(freq)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        frequenciaPagamento === freq
                          ? 'bg-brand-blue text-white shadow-lg font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {freq === 'mensal' && 'Mensal'}
                      {freq === 'semestral' && 'Semestral (10% Desc.)'}
                      {freq === 'anual' && 'Anual (12% Desc.)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Informação visual / Alerta para CAC Individual */}
              {tipoUsuario === 'cac_individual' && (
                <div className="bg-brand-green/10 border border-brand-green/20 text-brand-green-light rounded-xl p-4 text-xs font-semibold leading-relaxed">
                  📢 <strong>Importante:</strong> Como você se cadastrou como **Caçador, Atirador Desportivo, Colecionador (CAC Individual)**, seu plano é limitado apenas ao gerenciamento do seu acervo pessoal. Os outros planos comerciais de despachante estão bloqueados para este perfil.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                
                {/* Plano .22LR */}
                <div 
                  onClick={() => tipoUsuario === 'despachante' && setPlano('.22LR')}
                  className={`border rounded-xl p-5 transition-all flex flex-col justify-between relative ${
                    tipoUsuario === 'despachante' ? 'cursor-pointer hover:border-brand-blue/60' : 'cursor-default'
                  } ${
                    plano === '.22LR' 
                      ? 'border-brand-green bg-brand-green/15 shadow-glow' 
                      : 'border-brand-dark-5 bg-brand-dark-4 opacity-40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="bg-brand-green-dark text-black font-extrabold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                      .22LR
                    </span>
                    {plano === '.22LR' && (
                      <span className="w-5 h-5 bg-brand-green rounded-full flex items-center justify-center text-brand-dark">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  
                  <div className="my-3 text-center">
                    <img src="/.22LR.png" alt="Munição .22LR" className="w-12 h-12 object-contain mx-auto mb-2" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Plano .22LR</h3>
                    <p className="text-[11px] text-gray-400 mt-2 leading-normal">
                      {tipoUsuario === 'cac_individual' 
                        ? 'cac individual, ideal para um unico usuario' 
                        : 'cac individual, ideal para um unico usuario'
                      }
                    </p>
                  </div>
                  
                  <div className="border-t border-brand-dark-5/50 pt-3">
                    <span className="text-2xl font-black text-white">
                      R$ {frequenciaPagamento === 'mensal' ? '30' : frequenciaPagamento === 'semestral' ? '27' : '26,40'}
                    </span>
                    <span className="text-xs text-gray-500"> /mês</span>
                    {frequenciaPagamento !== 'mensal' && (
                      <span className="text-[10px] text-gray-500 block leading-tight font-bold">
                        Cobrado {frequenciaPagamento === 'semestral' ? 'R$ 162/semestre' : 'R$ 316,80/ano'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Plano .357mag - Recomendado */}
                <div 
                  onClick={() => tipoUsuario === 'despachante' && setPlano('.357mag')}
                  className={`border rounded-xl p-5 transition-all flex flex-col justify-between relative ${
                    tipoUsuario === 'despachante' ? 'cursor-pointer hover:border-brand-blue/60' : 'cursor-not-allowed'
                  } ${
                    plano === '.357mag' 
                      ? 'border-brand-blue bg-brand-blue/15 shadow-glow-blue' 
                      : 'border-brand-dark-5 bg-brand-dark-4 ' + (tipoUsuario === 'cac_individual' ? 'opacity-20' : '')
                  }`}
                >
                  {tipoUsuario === 'despachante' && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                      Recomendado
                    </span>
                  )}

                  <div className="flex justify-between items-start mt-1">
                    <span className="bg-brand-blue text-white font-extrabold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                      .357mag
                    </span>
                    {plano === '.357mag' && (
                      <span className="w-5 h-5 bg-brand-blue rounded-full flex items-center justify-center text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  
                  <div className="my-3 text-center">
                    <img src="/.357 mag.png" alt="Munição .357mag" className="w-12 h-12 object-contain mx-auto mb-2" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Plano .357mag</h3>
                    <p className="text-[11px] text-gray-400 mt-2 leading-normal">
                      Até 4 usuários da equipe + financeiro completo.
                    </p>
                  </div>
                  
                  <div className="border-t border-brand-dark-5/50 pt-3">
                    <span className="text-2xl font-black text-white">
                      R$ {frequenciaPagamento === 'mensal' ? '50' : frequenciaPagamento === 'semestral' ? '45' : '44'}
                    </span>
                    <span className="text-xs text-gray-500"> /mês</span>
                    {frequenciaPagamento !== 'mensal' && (
                      <span className="text-[10px] text-gray-500 block leading-tight font-bold">
                        Cobrado {frequenciaPagamento === 'semestral' ? 'R$ 270/semestre' : 'R$ 528/ano'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Plano .308win */}
                <div 
                  onClick={() => tipoUsuario === 'despachante' && setPlano('.308win')}
                  className={`border rounded-xl p-5 transition-all flex flex-col justify-between relative ${
                    tipoUsuario === 'despachante' ? 'cursor-pointer hover:border-brand-blue/60' : 'cursor-not-allowed'
                  } ${
                    plano === '.308win' 
                      ? 'border-brand-blue bg-brand-blue/15 shadow-glow-blue' 
                      : 'border-brand-dark-5 bg-brand-dark-4 ' + (tipoUsuario === 'cac_individual' ? 'opacity-20' : '')
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="bg-brand-blue-dark text-white font-extrabold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                      .308win
                    </span>
                    {plano === '.308win' && (
                      <span className="w-5 h-5 bg-brand-blue rounded-full flex items-center justify-center text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  
                  <div className="my-3 text-center">
                    <img src="/.308win.png" alt="Munição .308win" className="w-12 h-12 object-contain mx-auto mb-2" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Plano .308win</h3>
                    <p className="text-[11px] text-gray-400 mt-2 leading-normal">
                      Acessos ilimitados + Suporte prioritário.
                    </p>
                  </div>
                  
                  <div className="border-t border-brand-dark-5/50 pt-3">
                    <span className="text-2xl font-black text-white">
                      R$ {frequenciaPagamento === 'mensal' ? '100' : frequenciaPagamento === 'semestral' ? '90' : '88'}
                    </span>
                    <span className="text-xs text-gray-500"> /mês</span>
                    {frequenciaPagamento !== 'mensal' && (
                      <span className="text-[10px] text-gray-500 block leading-tight font-bold">
                        Cobrado {frequenciaPagamento === 'semestral' ? 'R$ 540/semestre' : 'R$ 1.056/ano'}
                      </span>
                    )}
                  </div>
                </div>

              </div>
              
              <div className="bg-brand-dark-4/50 border border-brand-dark-5/50 rounded-xl p-4 flex gap-3 items-start">
                <HelpCircle className="text-brand-blue flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-normal">
                  {tipoUsuario === 'cac_individual'
                    ? 'Para o CAC Individual, pode haver cobrança para cadastro de todo o acervo e documentos do cliente.'
                    : 'Todos os planos contam com taxa única de adesão e treinamento (Setup Fee) variando de R$ 150 a R$ 300, a ser acertada diretamente com o comercial no momento da ativação da sua chave de acesso.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA 5: Resumo dos Dados ────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                  <ShieldCheck className="text-brand-green" /> Confirmar seus dados
                </h2>
                <p className="text-gray-400 text-sm mt-1">Revise as informações antes de finalizar o pré-cadastro.</p>
              </div>

              <div className="bg-brand-dark-4 border border-brand-dark-5/60 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">Tipo de Perfil</span>
                    <span className="text-brand-blue-light font-bold text-base">
                      {tipoUsuario === 'despachante' ? '📋 Despachante Bélico / Escritório' : '🎯 Atirador / CAC Individual'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">Nome Completo</span>
                    <span className="text-white font-bold text-base">{nome}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">E-mail</span>
                    <span className="text-white font-bold text-base">{email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">CPF</span>
                    <span className="text-white font-bold text-base">{cpf}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">WhatsApp / Contato</span>
                    <span className="text-white font-bold text-base">{contato}</span>
                  </div>
                </div>

                <div className="border-t border-brand-dark-5/60 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider">Plano Selecionado</span>
                    <span className="text-brand-green font-extrabold text-base md:text-lg">
                      {plano === '.22LR' && 'Plano .22LR'}
                      {plano === '.357mag' && 'Plano .357mag'}
                      {plano === '.308win' && 'Plano .308win'}
                      <span className="text-xs text-gray-400 capitalize block font-bold">
                        Frequência: {frequenciaPagamento}
                      </span>
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-gray-500 block text-xs uppercase tracking-wider">Investimento</span>
                    <span className="text-white font-black text-xl">
                      {plano === '.22LR' && (frequenciaPagamento === 'mensal' ? 'R$ 30,00' : frequenciaPagamento === 'semestral' ? 'R$ 162,00' : 'R$ 316,80')}
                      {plano === '.357mag' && (frequenciaPagamento === 'mensal' ? 'R$ 50,00' : frequenciaPagamento === 'semestral' ? 'R$ 270,00' : 'R$ 528,00')}
                      {plano === '.308win' && (frequenciaPagamento === 'mensal' ? 'R$ 100,00' : frequenciaPagamento === 'semestral' ? 'R$ 540,00' : 'R$ 1.056,00')}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {frequenciaPagamento === 'mensal' ? ' /mês' : frequenciaPagamento === 'semestral' ? ' /semestre' : ' /ano'}
                    </span>
                    {frequenciaPagamento !== 'mensal' && (
                      <span className="text-[10px] text-gray-500 block font-semibold">
                        Equivale a R$ {plano === '.22LR' ? (frequenciaPagamento === 'semestral' ? '27,00' : '26,40') : plano === '.357mag' ? (frequenciaPagamento === 'semestral' ? '45,00' : '44,00') : (frequenciaPagamento === 'semestral' ? '90,00' : '88,00')}/mês
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 6: Sucesso ────────────────────────────────────────────── */}
          {step === 6 && (
            <div className="py-8 space-y-6 text-center animate-scale-up">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center border-2 border-brand-green/30 animate-pulse">
                  <CheckCircle2 className="text-brand-green w-12 h-12" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Pré-Cadastro Enviado! 🎉</h2>
                <p className="text-gray-300 text-sm max-w-md mx-auto leading-relaxed">
                  Os dados do seu cadastro foram registrados com sucesso. Nosso comercial já recebeu sua proposta.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto mt-2">
                  <p className="text-brand-blue font-bold text-xs bg-brand-blue/10 border border-brand-blue/20 rounded-lg py-2 px-4 flex-1">
                    Perfil: {tipoUsuario === 'despachante' ? 'Despachante' : 'CAC Individual'}
                  </p>
                  <p className="text-brand-green font-bold text-xs bg-brand-green/10 border border-brand-green/20 rounded-lg py-2 px-4 flex-1">
                    Plano Selecionado: {plano}
                  </p>
                </div>
              </div>

              <div className="border-t border-brand-dark-5/50 pt-6 max-w-md mx-auto space-y-4">
                {/* Seletor de Forma de Pagamento */}
                <div className="flex justify-center max-w-sm mx-auto gap-2 bg-brand-dark-4 border border-brand-dark-5 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMetodoPagamento('pix')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${
                      metodoPagamento === 'pix'
                        ? 'bg-brand-green text-black shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-brand-dark-3'
                    }`}
                  >
                    💸 Pagar via PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPagamento('cartao')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${
                      metodoPagamento === 'cartao'
                        ? 'bg-brand-blue text-white shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-brand-dark-3'
                    }`}
                  >
                    💳 Pagar via Cartão
                  </button>
                </div>

                {metodoPagamento === 'pix' ? (
                  <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-2xl p-5 text-center mb-6 max-w-sm mx-auto relative overflow-hidden shadow-2xl">
                    {/* Decorative glow */}
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-green/10 rounded-full blur-xl pointer-events-none"></div>

                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">Chave PIX (CNPJ) para Ativação</p>
                    
                    <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
                      <div className="text-left min-w-0">
                        <span className="font-mono text-sm text-white font-black tracking-wider block select-all">
                          63.820.168/0001-63
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          Beneficiário: <strong className="text-gray-200">Guilherme Gomes</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('63820168000163');
                          setPixCopiado(true);
                          setTimeout(() => setPixCopiado(false), 2000);
                        }}
                        className={`flex items-center gap-1.5 border text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-lg transition-all duration-200 shrink-0 ${
                          pixCopiado
                            ? 'bg-brand-green/20 text-brand-green border-brand-green/40 shadow-sm'
                            : 'bg-brand-green/10 hover:bg-brand-green/20 text-brand-green border-brand-green/30 active:scale-95'
                        }`}
                      >
                        {pixCopiado ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copiado
                          </>
                        ) : (
                          <>
                            📋 Copiar
                          </>
                        )}
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 mt-3.5 leading-relaxed">
                      Pague o valor de <strong className="text-white">{obterValorTotal()}</strong> referente ao plano <strong className="text-white">{plano} ({frequenciaPagamento})</strong> e envie o comprovante no WhatsApp abaixo para ativação imediata.
                    </p>
                  </div>
                ) : (
                  <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-2xl p-5 text-center mb-6 max-w-sm mx-auto relative overflow-hidden shadow-2xl">
                    {/* Decorative glow */}
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-blue/10 rounded-full blur-xl pointer-events-none"></div>

                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">Pagamento via Cartão de Crédito</p>
                    
                    <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-300 font-semibold leading-relaxed">
                        Aceitamos cartões de crédito via link de pagamento da <strong className="text-white">InfinityPay / Banco Inter</strong>.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                        Por ser gerado sob demanda para seu plano, clique em um dos botões abaixo para solicitar o link à nossa equipe.
                      </p>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 mt-3.5 leading-relaxed">
                      Valor do plano: <strong className="text-white">{obterValorTotal()}</strong> referente a <strong className="text-white">{plano} ({frequenciaPagamento})</strong>.
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400 leading-normal">
                  {metodoPagamento === 'pix' ? (
                    tipoUsuario === 'cac_individual'
                      ? 'Clique em um dos canais abaixo para enviar seu comprovante de pagamento e liberar sua conta CAC:'
                      : 'Clique em um dos canais abaixo para enviar seu comprovante de pagamento e ativar seu painel de despachante:'
                  ) : (
                    'Clique em um dos canais abaixo para solicitar o link de pagamento do seu plano:'
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={`https://wa.me/5564999959865?text=${encodeURIComponent(
                      metodoPagamento === 'pix'
                        ? `Olá! Realizei o pagamento do pré-cadastro no Portal G CAC (${nome}, CPF: ${cpf}) como ${tipoUsuario === 'despachante' ? 'Despachante' : 'CAC Individual'} no plano ${plano} (${frequenciaPagamento}). Segue em anexo o meu comprovante para liberação.`
                        : `Olá! Realizei o pré-cadastro no Portal G CAC (${nome}, CPF: ${cpf}) como ${tipoUsuario === 'despachante' ? 'Despachante' : 'CAC Individual'} no plano ${plano} (${frequenciaPagamento}). Gostaria de solicitar o link de pagamento no cartão para liberação da conta.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-black font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-lg active:scale-95"
                  >
                    {metodoPagamento === 'pix' ? 'Enviar Comprovante 1' : 'Solicitar Link Comercial 1'}
                  </a>
                  <a
                    href={`https://wa.me/5564999681003?text=${encodeURIComponent(
                      metodoPagamento === 'pix'
                        ? `Olá! Realizei o pagamento do pré-cadastro no Portal G CAC (${nome}, CPF: ${cpf}) como ${tipoUsuario === 'despachante' ? 'Despachante' : 'CAC Individual'} no plano ${plano} (${frequenciaPagamento}). Segue em anexo o meu comprovante para liberação.`
                        : `Olá! Realizei o pré-cadastro no Portal G CAC (${nome}, CPF: ${cpf}) como ${tipoUsuario === 'despachante' ? 'Despachante' : 'CAC Individual'} no plano ${plano} (${frequenciaPagamento}). Gostaria de solicitar o link de pagamento no cartão para liberação da conta.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-black font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-lg active:scale-95"
                  >
                    {metodoPagamento === 'pix' ? 'Enviar Comprovante 2' : 'Solicitar Link Comercial 2'}
                  </a>
                </div>

                <div>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-xs text-gray-500 hover:text-white underline font-semibold transition-colors mt-2"
                  >
                    Voltar para tela de login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BOTOES DE NAVEGAÇÃO DO WIZARD (Etapas 1 a 5) */}
          {step <= 5 && (
            <div className="mt-8 pt-6 border-t border-brand-dark-5/50 flex justify-between gap-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={voltar}
                  disabled={carregando}
                  className="btn-ghost flex items-center justify-center gap-2 w-1/3 py-3 rounded-xl text-sm"
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-ghost flex items-center justify-center gap-2 w-1/3 py-3 rounded-xl text-sm"
                >
                  Cancelar
                </button>
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={avancar}
                  disabled={carregando}
                  className="btn-primary flex items-center justify-center gap-2 flex-grow py-3 rounded-xl text-sm"
                >
                  {carregando ? (
                    <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Continuar <ArrowRight size={16} /></>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enviarCadastro}
                  disabled={carregando}
                  className="btn-success flex items-center justify-center gap-2 flex-grow py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                >
                  {carregando ? (
                    <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Concluir Pré-Cadastro'
                  )}
                </button>
              )}
            </div>
          )}

        </div>

        {/* Rodapé da Página */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Portal G CAC — Sistema Seguro de Gestão de Acervos e OS
        </p>
      </div>
    </div>
  );
}
