import React from 'react';
import { useNavigate } from 'react-router-dom';

export function TermosUso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-dark text-slate-100 flex items-center justify-center p-4 py-12">
      <div className="max-w-3xl w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-8 md:p-12 shadow-2xl relative">
        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="absolute top-6 left-6 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          ← Voltar para o Login
        </button>

        {/* Branding Logo Header */}
        <div className="text-center mt-6 mb-8 flex flex-col items-center">
          <div className="relative w-36 h-36 rounded-full overflow-hidden border border-slate-800/80 shadow-[0_0_15px_rgba(27,111,191,0.2)] bg-black/20 mb-3 flex items-center justify-center">
            <img 
              src="/usar no site/1.jpg" 
              alt="Portal GCAC Logo" 
              className="w-full h-full object-cover rounded-full"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Vignete de suavização de borda */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_15px_rgba(13,13,13,0.8)] pointer-events-none" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Portal GCAC</h1>
          <p className="text-slate-400 text-xs mt-1">Termos de Uso e Condições de Serviço</p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-sans max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma <strong>Portal GCAC</strong> (doravante denominada "Plataforma" ou "Sistema"), 
              você declara que leu, compreendeu e concorda em estar vinculado a estes Termos de Uso. Este software é um sistema 
              integrado de gestão voltado especificamente para a otimização de rotinas administrativas e operacionais de 
              <strong>Despachantes Bélicos</strong> e para o controle e guarda digital de acervos de <strong>CACs (Caçadores, Atiradores Desportivos e Colecionadores)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Perfis de Conta e Escopos de Uso</h2>
            <p>
              O Portal GCAC opera com duas modalidades principais de contas para atender propósitos distintos do mercado bélico:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-400">
              <li>
                <strong>Perfil Despachante Bélico (B2B):</strong> Destinado a escritórios de despachantes e assessores credenciados para a gestão e controle de Ordens de Serviço (OS), orçamentos, recibos, agendamentos presenciais ou de laudos, movimentações financeiras de caixa e controle de processos de seus clientes.
              </li>
              <li>
                <strong>Perfil CAC Individual (B2C):</strong> Destinado a Caçadores, Atiradores Desportivos e Colecionadores gerenciarem e arquivarem digitalmente seus próprios Certificados de Registro (CR Exército/IBAMA), CRAFs de suas armas de fogo, Guias de Tráfego (GT), autorizações de manejo e certidões gerais.
              </li>
              <li>
                <strong>Vínculo de Escolha Livre do CAC:</strong> O usuário do perfil **CAC Individual** tem total autonomia e liberdade para vincular (associar) sua conta a qualquer Despachante Bélico credenciado de sua livre escolha na plataforma, permitindo que este preste assessoria técnica e documental. O CAC pode, a qualquer momento e por livre vontade, revogar esse vínculo ou migrar para outro despachante diretamente pelo seu painel de controle.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Integração e Uso da API do Google Drive</h2>
            <p>
              A fim de garantir a segurança e a redundância dos dados do próprio usuário contra falhas de conexão ou perda de dados locais, 
              o Portal GCAC integra-se à API do Google Drive do usuário conectado através de login seguro da Conta Google.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>
                <strong>Finalidade Exclusiva:</strong> O sistema utiliza a permissão de acesso ao Drive única e exclusivamente 
                para criar uma pasta dedicada (denominada "G_CAC_BACKUPS") onde são armazenadas cópias das Ordens de Serviço em PDF 
                e em formato estruturado de dados JSON.
              </li>
              <li>
                <strong>Escopo de Acesso:</strong> O aplicativo não lê, não modifica e não exclui nenhum outro arquivo ou pasta 
                existente no Google Drive do usuário que não tenham sido criados pela própria aplicação.
              </li>
              <li>
                <strong>Armazenamento de Arquivos Pesados:</strong> O upload de arquivos grandes (como fotos de registros e documentos 
                cadastrais de atiradores) é armazenado na cota de espaço do Google Drive do despachante, garantindo que o controle 
                e a custódia das informações permaneçam integralmente sob posse do usuário.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Responsabilidades dos Usuários (Despachantes e CACs)</h2>
            <p>
              O usuário (seja ele Despachante Bélico, Caçador, Atirador Desportivo ou Colecionador) é inteiramente responsável pela confidencialidade de suas credenciais de login e pela autenticidade dos dados 
              inseridos na plataforma. O preenchimento de cadastros de armas de fogo, Certificados de Registro (CR), CRAF, Guias de Tráfego 
              (GT) e outras autorizações governamentais deve obedecer estritamente à legislação em vigor, em especial às normas, portarias e fiscalizações do <strong>Exército Brasileiro (COLOG)</strong> e da <strong>Polícia Federal (PF)</strong> — atualmente a principal força policial responsável pela regulação, controle e fiscalização de CACs —, bem como Instruções Normativas do IBAMA para Caçadores/Manejadores. O Portal GCAC não possui vínculo com órgãos governamentais e funciona apenas como um facilitador de organização de arquivos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Segurança Jurídica e LGPD</h2>
            <p>
              Toda a custódia de dados inseridos na plataforma é regida pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018). 
              A vinculação de dados do CAC Individual com o despachante parceiro depende de aceite explícito de convite na plataforma, respeitando integralmente o direito de consentimento, portabilidade, revogação do vínculo e exclusão de seus registros a qualquer momento pelo CAC.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Alterações nestes Termos</h2>
            <p>
              Reservamo-nos o direito de alterar estes Termos de Uso periodicamente. O uso continuado da plataforma após modificações constituirá 
              sua aceitação tácita das novas diretrizes.
            </p>
          </section>
        </div>

        <div className="text-center mt-8 text-xs text-slate-500">
          Última atualização: Junho de 2026.
        </div>
      </div>
    </div>
  );
}

export function PoliticaPrivacidade() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-dark text-slate-100 flex items-center justify-center p-4 py-12">
      <div className="max-w-3xl w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-8 md:p-12 shadow-2xl relative">
        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="absolute top-6 left-6 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          ← Voltar para o Login
        </button>

        {/* Branding Logo Header */}
        <div className="text-center mt-6 mb-8 flex flex-col items-center">
          <div className="relative w-36 h-36 rounded-full overflow-hidden border border-slate-800/80 shadow-[0_0_15px_rgba(27,111,191,0.2)] bg-black/20 mb-3 flex items-center justify-center">
            <img 
              src="/usar no site/1.jpg" 
              alt="Portal GCAC Logo" 
              className="w-full h-full object-cover rounded-full"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Vignete de suavização de borda */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_15px_rgba(13,13,13,0.8)] pointer-events-none" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Portal GCAC</h1>
          <p className="text-slate-400 text-xs mt-1">Política de Privacidade e Proteção de Dados (LGPD)</p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-sans max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Compromisso com a Privacidade</h2>
            <p>
              Nós, do <strong>Portal GCAC</strong>, levamos a sério a privacidade dos seus dados pessoais e informações corporativas. 
              Esta Política de Privacidade explica de forma clara quais dados coletamos, por que os coletamos, como os protegemos e como você 
              pode gerenciar seus direitos em conformidade com a Lei Geral de Proteção de Dados (LGPD) e as políticas de desenvolvedores do Google.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Informações que Coletamos</h2>
            <p>
              Para o funcionamento regular das ferramentas de despachante e controle bélico individual dos atiradores, o portal processa os seguintes tipos de informações:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>
                <strong>Dados Cadastrais Básicos:</strong> Nome completo, CPF, e-mail de contato, endereço residencial e telefone comercial de Despachantes e de CACs (Caçadores, Atiradores Desportivos e Colecionadores).
              </li>
              <li>
                <strong>Dados de Acervo Técnico (opcional):</strong> Número de Certificado de Registro (CR Exército ou IBAMA), número do SIGMA/SINARM, validade de CRAFs, marcas, calibres, números de série e imagens/anexos de documentos das armas de fogo cadastradas para controle pessoal do CAC ou acompanhamento documental do despachante.
              </li>
              <li>
                <strong>Metadados do Google Auth:</strong> E-mail e nome público da conta Google para fins de autenticação de login segura.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Uso da Permissão da API do Google Drive</h2>
            <p>
              Nosso sistema utiliza o escopo de autenticação do Google Drive sob a autorização explícita concedida pelo usuário na tela de consentimento:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>
                <strong>Armazenamento Redundante:</strong> Criamos uma pasta no seu próprio Google Drive chamada "G_CAC_BACKUPS". O aplicativo envia 
                as vias em PDF e dados de auditoria JSON das Ordens de Serviço finalizadas no seu navegador para esta pasta de backup.
              </li>
              <li>
                <strong>Privacidade e Limites de Acesso:</strong> O Portal GCAC não possui permissão para ler, ver, editar ou compartilhar 
                quaisquer arquivos pré-existentes na sua conta do Google Drive. O acesso é limitado exclusivamente às pastas e arquivos criados 
                por esta aplicação.
              </li>
              <li>
                <strong>Nenhum Compartilhamento de Arquivos:</strong> Os arquivos enviados ao seu Google Drive não são transmitidos para nossos 
                servidores ou terceiros; eles permanecem arquivados sob sua custódia exclusiva de armazenamento em nuvem no Google.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Armazenamento Local ("Offline-First") e Sincronização</h2>
            <p>
              Por operar com foco em alta disponibilidade e suporte offline, os dados de operação imediata do portal (clientes cadastrados, 
              agendamentos e rascunhos de O.S.) são armazenados localmente no banco de dados IndexedDB do seu navegador (encapsulado pelo Dexie.js). 
              Assim que a conexão com a internet for detectada, estes dados locais são transmitidos ao nosso servidor seguro (Supabase Cloud PostgreSQL). 
              Esta arquitetura impede a perda de dados em locais com instabilidade de rede.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Compartilhamento e Vínculo de Dados</h2>
            <p>
              <strong>Não comercializamos e não transferimos seus dados para terceiros.</strong> O compartilhamento de dados do acervo do CAC Individual com o Despachante Bélico ocorre de forma estritamente consentida através da aceitação do convite ou vinculação por escolha livre do CAC no painel. O CAC tem o direito de revogar o vínculo, migrar para outro profissional ou solicitar a exclusão definitiva de seu cadastro e de todos os dados do banco a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Contato do Suporte</h2>
            <p>
              Caso tenha dúvidas sobre esta política ou queira exercer seus direitos de privacidade sob a LGPD, envie um e-mail para o administrador do portal em <strong>gui.gomesassis@gmail.com</strong>.
            </p>
          </section>
        </div>

        <div className="text-center mt-8 text-xs text-slate-500">
          Última atualização: Junho de 2026.
        </div>
      </div>
    </div>
  );
}
