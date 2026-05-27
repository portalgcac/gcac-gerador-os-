import React, { useState } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Calendar, 
  Settings, User, Target, Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { marcarOnboardingConcluido } from '../../services/adminCacService';

export function OnboardingCAC() {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(() => {
    if (usuario?.tipoConta !== 'cac_individual') return false;
    return localStorage.getItem('gcac_onboarding_completed') !== 'true';
  });
  const [passo, setPasso] = useState(1);

  if (!aberto || !usuario) return null;

  const fechar = () => {
    localStorage.setItem('gcac_onboarding_completed', 'true');
    setAberto(false);
    // Persiste no banco para o painel admin
    if (usuario?.email) {
      marcarOnboardingConcluido(usuario.email).catch(() => {});
    }
  };

  const proximo = () => {
    if (passo < 4) setPasso(passo + 1);
    else fechar();
  };

  const anterior = () => {
    if (passo > 1) setPasso(passo - 1);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-brand-dark-2 w-full max-w-lg rounded-2xl border border-brand-dark-5 p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[480px]">
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
        
        {/* Botão de Fechar */}
        <button 
          onClick={fechar}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          title="Fechar tutorial"
        >
          <X size={20} />
        </button>

        {/* Conteúdo dinâmico de acordo com o passo */}
        <div className="flex-1 flex flex-col justify-between pt-4">
          <div>
            {/* Indicador de Passo */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
                Passo {passo} de 4
              </span>
              <span className="text-gray-600 font-bold">•</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                Tutorial de Orientação
              </span>
            </div>

            {passo === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 text-brand-blue-light">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Bem-vindo ao Portal G CAC!</h2>
                    <p className="text-xs text-brand-blue-light font-bold uppercase tracking-wider mt-0.5">{usuario.nome}</p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 leading-relaxed">
                  Este portal foi criado especificamente para que você gerencie o seu acervo pessoal de tiro e caça com facilidade e segurança. 
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex gap-3">
                    <Calendar size={18} className="text-brand-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide">Tela Inicial: Meus Lembretes</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Ao abrir o Portal, a primeira tela que você vê é a sua agenda de vencimentos. Aqui, os alertas automáticos avisam quando seus documentos estão perto de vencer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {passo === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 text-brand-blue-light">
                    <Target size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Seu Acervo & Documentos</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Gerenciamento Completo</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Na aba <strong className="text-white">"Meu Acervo & CR"</strong>, você tem o controle total das suas armas, guias e licenças.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">CR e CR IBAMA:</strong> Insira o número e a data de validade dos seus certificados de registro nos campos principais.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Armas & CRAF:</strong> Cadastre cada uma das suas armas de fogo, defina o acervo, anote a validade do CRAF e gerencie as Guias de Tráfego (GT) vinculadas a elas.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Importação do SIMAF (Manejo):</strong> Cadastre autorizações de caça do IBAMA manualmente ou simplesmente envie o arquivo PDF da sua autorização para que o sistema preencha todos os dados sozinho.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {passo === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 text-brand-blue-light">
                    <Settings size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Configurações & Backup</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Customize Seus Alertas</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Personalize o Portal para que ele funcione da maneira ideal para o seu perfil de atirador.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Prazos customizados:</strong> Ajuste com quantos dias de antecedência você quer ver os alertas visuais de aviso para o CR, CRAFs, GTs e autorizações de caça.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Ocultar IBAMA/SIMAF:</strong> Se você não realiza caça de controle/manejo, basta desativar o monitoramento nas configurações para esconder essa seção e os alertas correspondentes.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Backup Digital:</strong> Faça o download de um backup completo em arquivo JSON do seu acervo com apenas um clique para guardar ou auditar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {passo === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 text-brand-blue-light">
                    <User size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Foto de Perfil & Cadastro</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Deixe o Portal com a sua cara</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Para personalizar o seu perfil e o menu lateral do sistema, você pode carregar uma foto diretamente do seu computador ou celular.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-blue/30 bg-brand-dark-2 flex items-center justify-center shrink-0">
                      <User size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide">Como colocar sua foto:</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Acesse a aba <strong className="text-white">"Meu Acervo & CR"</strong> e clique sobre a moldura redonda de foto no campo de Informações Pessoais. Você poderá tirar uma foto com a câmera do celular/computador ou selecionar um arquivo de imagem.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest pt-2">
                  Tudo pronto! Vamos começar?
                </div>
              </div>
            )}
          </div>

          {/* Footer do Modal: Controles e Indicador Visual */}
          <div className="mt-8 pt-4 border-t border-brand-dark-5 flex items-center justify-between">
            {/* Bolinhas Indicadoras */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(idx => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    passo === idx ? 'w-5 bg-brand-blue' : 'w-1.5 bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Botões Voltar / Avançar */}
            <div className="flex items-center gap-2">
              {passo > 1 && (
                <button 
                  onClick={anterior}
                  className="btn-ghost btn-sm px-3 flex items-center gap-1 border border-brand-dark-5 animate-fade-in"
                >
                  <ChevronLeft size={14} /> Voltar
                </button>
              )}

              <button 
                onClick={proximo}
                className="btn-primary btn-sm px-4 flex items-center gap-1"
              >
                {passo === 4 ? 'Começar!' : <>Avançar <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
