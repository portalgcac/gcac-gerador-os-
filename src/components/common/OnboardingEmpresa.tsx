import React, { useState } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Settings, 
  Users, Sparkles, Building, Landmark 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { marcarOnboardingConcluido } from '../../services/adminCacService';

export function OnboardingEmpresa() {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(() => {
    if (usuario?.tipoConta !== 'empresa') return false;
    // Só exibe para o administrador principal ou se não concluiu ainda
    return localStorage.getItem('gcac_onboarding_empresa_completed') !== 'true';
  });
  const [passo, setPasso] = useState(1);

  if (!aberto || !usuario) return null;

  const fechar = () => {
    localStorage.setItem('gcac_onboarding_empresa_completed', 'true');
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
                Tutorial do Escritório
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
                  Esta plataforma foi desenhada para otimizar a rotina operacional do seu escritório de despachante ou clube de tiro. Vamos guiar você em 3 etapas simples para deixar o sistema pronto para o uso diário.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex gap-3">
                    <Building size={18} className="text-brand-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide">Operacional Completo</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Gerencie ordens de serviço, gere orçamentos em PDF com um clique, emita recibos de pagamento, acompanhe o caixa da empresa e controle a validade dos documentos de todos os seus clientes em um único painel.
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
                    <Landmark size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Configurações da Empresa</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Identidade & White-Label</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Personalize o sistema com as informações do seu negócio.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Dados Comerciais:</strong> Acesse a aba <strong className="text-white">"Configurações"</strong> e preencha a Razão Social, CNPJ, Endereço e Contato. Esses dados serão exibidos nos recibos e orçamentos emitidos para os seus clientes.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Clube Parceiro Padrão:</strong> Defina o nome do seu clube de tiro parceiro. Ao fazer isso, o formulário de cadastro de clientes, orçamentos e ordens de serviço exibirá opções customizadas para indicar se o cliente é filiado e aplicar os descontos correspondentes automaticamente.
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
                    <h2 className="text-xl font-black text-white leading-tight">Tabela de Serviços</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Precificação Padronizada</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Evite erros de digitação e padronize os honorários cobrados pela sua equipe.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Cadastro de Serviços:</strong> Em <strong className="text-white">"Configurações" → "Serviços"</strong>, defina os serviços locais que você oferece (ex: Concessão de CR, Guia de Tráfego, Renovação de CRAF).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Diferenciação de Valores:</strong> Você pode definir o valor padrão (não-filiados) e o valor com desconto (para filiados do seu clube parceiro). Ao criar orçamentos e O.S., basta selecionar o serviço para que os valores sejam auto-preenchidos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {passo === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 text-brand-blue-light">
                    <Users size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">Colaboradores & Permissões</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Controle Granular de Equipe</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed">
                  Trabalhe em equipe mantendo as informações críticas seguras.
                </p>

                <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Convite de Colaboradores:</strong> Acesse <strong className="text-white">"Configurações" → "Usuários"</strong> para cadastrar e autorizar contas adicionais de funcionários da sua empresa.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Restrições Especiais:</strong> Defina quem pode visualizar os cards de faturamento no Dashboard geral e quem tem autorização para excluir registros críticos de ordens de serviço ou lançamentos financeiros.
                    </p>
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
