import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

// ── CORES CORPORATIVAS DO PORTAL G CAC ───────────────────────────────────────
const CORES = {
  primary: [15, 76, 129],       // Azul Royal Nobre #0F4C81
  primaryDark: [11, 19, 43],    // Dark Navy Profundo #0B132B
  accentBlue: [27, 111, 191],   // Azul Brand #1B6FBF
  accentCyan: [6, 182, 212],    // Ciano Neon #06B6D4
  success: [16, 185, 129],      // Verde Sucesso #10B981
  warning: [245, 158, 11],      // Âmbar Atenção #F59E0B
  danger: [239, 68, 68],        // Vermelho Crítico #EF4444
  textMain: [30, 41, 59],       // Slate Escuro #1E293B
  textMuted: [100, 116, 139],   // Slate Cinza #64748B
  cardBg: [248, 250, 252],      // Fundo Card #F8FAFC
  cardBorder: [226, 232, 240],  // Borda Card #E2E8F0
  white: [255, 255, 255],
  darkBg: [15, 23, 42]          // Navy Fundo Dark #0F172A
};

function criarDocumentoSeguranca() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();   // 210 mm
  const altura = doc.internal.pageSize.getHeight();    // 297 mm
  const margem = 18;
  const larguraUtil = largura - (margem * 2);          // 174 mm
  const totalPaginas = 5;

  // Carregar Logo Oficial se disponível
  let logoBase64 = null;
  try {
    const caminhoLogo = path.resolve('public/Logo oficial.png');
    if (fs.existsSync(caminhoLogo)) {
      const buffer = fs.readFileSync(caminhoLogo);
      logoBase64 = 'data:image/png;base64,' + buffer.toString('base64');
    }
  } catch (err) {
    console.warn('Logo não carregada:', err.message);
  }

  // ── CABEÇALHO PADRÃO (PÁGINAS 2 A 5) ───────────────────────────────────────
  function desenharCabecalho(numeroPagina) {
    // Linha superior decorativa
    doc.setFillColor(...CORES.primaryDark);
    doc.rect(0, 0, largura, 5, 'F');
    doc.setFillColor(...CORES.accentCyan);
    doc.rect(margem, 5, 45, 1.5, 'F');

    // Logo miniatura no cabeçalho com moldura arredondada
    if (logoBase64) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margem, 8, 12, 12, 1.5, 1.5, 'F');
      doc.setDrawColor(...CORES.cardBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(margem, 8, 12, 12, 1.5, 1.5, 'D');
      doc.addImage(logoBase64, 'PNG', margem + 1, 9, 10, 10);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...CORES.primaryDark);
    doc.text('PORTAL G CAC • GESTÃO BÉLICA & PLATAFORMA SAAS', margem + (logoBase64 ? 15 : 0), 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.textMuted);
    doc.text('RELATÓRIO DE GOVERNANÇA, CIBERSEGURANÇA & INTELIGÊNCIA ARTIFICIAL', margem + (logoBase64 ? 15 : 0), 17.5);

    // Badge de Confidencial
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(largura - margem - 32, 9, 32, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...CORES.danger);
    doc.text('CONFIDENCIAL / SÓCIOS', largura - margem - 16, 13.2, { align: 'center' });

    // Linha divisória
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margem, 22, largura - margem, 22);
  }

  // ── RODAPÉ PADRÃO (PÁGINAS 2 A 5) ──────────────────────────────────────────
  function desenharRodape(numeroPagina) {
    const yRodape = altura - 12;
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margem, yRodape - 3, largura - margem, yRodape - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.textMuted);
    doc.text('Portal G CAC Tecnologia © 2026 • Documento Estratégico Societário • Proteção sob LGPD e RLS', margem, yRodape + 1.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CORES.primary);
    doc.text(`Página ${numeroPagina} de ${totalPaginas}`, largura - margem, yRodape + 1.5, { align: 'right' });
  }

  // ===========================================================================
  // PÁGINA 1: CAPA EXECUTIVA
  // ===========================================================================
  doc.setFillColor(...CORES.primaryDark);
  doc.rect(0, 0, largura, altura, 'F');

  // Grafismo geométrico sofisticado
  doc.setFillColor(15, 28, 63);
  doc.rect(0, 0, largura, 122, 'F');
  doc.setFillColor(23, 42, 90);
  doc.rect(0, 0, largura, 5, 'F');

  // Linhas de acento tecnológicas (Cyan e Brand Blue)
  doc.setDrawColor(...CORES.accentCyan);
  doc.setLineWidth(1);
  doc.line(margem, 42, margem + 30, 42);

  doc.setDrawColor(...CORES.accentBlue);
  doc.setLineWidth(0.5);
  doc.line(margem + 33, 42, margem + 50, 42);

  // Logo Oficial no Centro com container arredondado profissional
  if (logoBase64) {
    const logoDim = 40;
    const pad = 4;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margem, 50, logoDim + (pad * 2), logoDim + (pad * 2), 3, 3, 'F');
    doc.setDrawColor(...CORES.accentCyan);
    doc.setLineWidth(0.8);
    doc.roundedRect(margem, 50, logoDim + (pad * 2), logoDim + (pad * 2), 3, 3, 'D');
    doc.addImage(logoBase64, 'PNG', margem + pad, 50 + pad, logoDim, logoDim);
  }

  // Tag de Versão
  doc.setFillColor(...CORES.accentCyan);
  doc.roundedRect(margem, 110, 42, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('PLANO DIRETOR TÉCNICO 2026', margem + 21, 114.2, { align: 'center' });

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO EXECUTIVO DE', margem, 128);
  doc.setTextColor(6, 182, 212); // Cyan Neon
  doc.text('CIBERSEGURANÇA &', margem, 137);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTINELA COM INTELIGÊNCIA ARTIFICIAL', margem, 146);

  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  const subtitulo = 'Diagnóstico do Ecossistema Portal G CAC, Arquitetura de Proteção de Dados Bélicos (SIGMA/SINARM), Blindagem LGPD e Sentinela de Monitoramento Contínuo com Google Gemini.';
  const linhasSub = doc.splitTextToSize(subtitulo, larguraUtil);
  doc.text(linhasSub, margem, 156);

  // Linha divisória
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.4);
  doc.line(margem, 172, largura - margem, 172);

  // Box de Destinatários e Metadados Societários
  doc.setFillColor(15, 23, 42);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.roundedRect(margem, 180, larguraUtil, 74, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...CORES.accentCyan);
  doc.text('METADADOS DE GOVERNANÇA SOCIETÁRIA', margem + 6, 188);

  const dadosMeta = [
    { rotulo: 'EMPRESA / ECOSSISTEMA:', valor: 'Portal G CAC Tecnologia & GCAC Despachante Bélico' },
    { rotulo: 'FUNDADOR & GESTOR PRINCIPAL:', valor: 'Guilherme Gomes de Assis (gui.gomesassis@gmail.com)' },
    { rotulo: 'SÓCIO & GESTÃO DE OPERAÇÕES:', valor: 'Hector Henrique Furtado Meira (hectoruk80@gmail.com)' },
    { rotulo: 'CLASSIFICAÇÃO DE RISCO:', valor: 'ESTRITAMENTE CONFIDENCIAL • ACERVO DE SEGURANÇA BÉLICA' },
    { rotulo: 'OBJETIVO DO DOCUMENTO:', valor: 'Alinhamento societário e expansão comercial segura das licenças' },
    { rotulo: 'DATA DE EMISSÃO & STATUS:', valor: 'Setembro de 2026 • Versão 1.0 Oficial (Aprovado)' }
  ];

  let yMeta = 196;
  dadosMeta.forEach(m => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(m.rotulo, margem + 6, yMeta);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(m.valor, margem + 60, yMeta);
    yMeta += 7.8;
  });

  // Rodapé da Capa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Desenvolvido para auditoria societária e preparação para comercialização nacional das licenças SaaS.', largura / 2, altura - 15, { align: 'center' });

  // ===========================================================================
  // PÁGINA 2: O ALICERCE INSTALADO & MATRIZ DE PROTEÇÃO
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(2);
  desenharRodape(2);

  let y = 30;

  // Título da Seção 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('1. O Cenário Bélico e o Alicerce Já Instalado', margem, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CORES.textMain);
  const textoIntro = 'A comercialização do software Portal G CAC exige o mais alto padrão de segurança do mercado de tecnologia. Nosso sistema custodia dados estratégicos de Segurança de Estado: números de série de armas, calibres, Certificados de Registro (CR Exército), CRAFs (Polícia Federal), Guias de Tráfego, endereços de acervos e credenciais de acesso governamental (Gov.br).';
  const linhasIntro = doc.splitTextToSize(textoIntro, larguraUtil);
  doc.text(linhasIntro, margem, y);
  y += (linhasIntro.length * 4) + 4;

  // Card de Diagnóstico Positivo (O que já temos)
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.4);
  doc.roundedRect(margem, y, larguraUtil, 15, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(13, 148, 136); // Teal 600
  doc.text('STATUS ATUAL: NÍVEL DE MATURIDADE MUITO ACIMA DA MÉDIA', margem + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...CORES.textMain);
  doc.text('Ao contrário dos softwares tradicionais de despachantes (que usam planilhas Excel desprotegidas ou servidores locais sem backup), o Portal G CAC já nasceu com uma arquitetura moderna em nuvem, multi-tenant e protegida por criptografia de ponta.', margem + 4, y + 10.5);
  y += 20;

  // Tabela / Cards das 7 Camadas Ativas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...CORES.primary);
  doc.text('As 7 Camadas de Segurança Atualmente em Operação no Sistema:', margem, y);
  y += 5;

  const camadas = [
    {
      num: '01',
      nome: 'PostgreSQL Row Level Security (RLS)',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Todas as tabelas de dados (Ordens, Clientes, Armas, Recibos) possuem filtros nativos no motor do banco de dados (empresa_id = get_auth_empresa_id()). Um escritório parceiro jamais visualiza os dados de outro, mesmo se tentar forçar consultas via código ou API externa.'
    },
    {
      num: '02',
      nome: 'Autenticação Criptografada JWT (Supabase + Google)',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Sessões validadas por tokens criptográficos assinados digitalmente. Rotação automática de chaves e expiração periódica previnem interceptação de login.'
    },
    {
      num: '03',
      nome: 'Whitelist Rigorosa de Usuários Autorizados',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Nenhum usuário consegue entrar na plataforma apenas criando uma conta. O e-mail precisa estar expressamente pré-aprovado na tabela usuarios_autorizados com a flag ativo = true.'
    },
    {
      num: '04',
      nome: 'Trava Inviolável de Governança Societária',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Blindagem de código que protege o Gestor Principal (Guilherme Gomes) contra exclusão acidental ou desativação. Sistema de sócios exclusivo que integra Hector Meira com credencial dupla.'
    },
    {
      num: '05',
      nome: 'Criptografia em Trânsito (TLS 1.3 / HTTPS)',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: '100% da comunicação entre os navegadores dos usuários, servidores Vercel e o banco de dados Supabase é criptografada de ponta a ponta com certificados de segurança SSL/TLS modernos.'
    },
    {
      num: '06',
      nome: 'Criptografia de Hardware em Repouso (AES-256)',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Os discos físicos e backups gerenciados na infraestrutura do Supabase (AWS) utilizam criptografia de nível bancário AES-256 para gravação em repouso dos registros.'
    },
    {
      num: '07',
      nome: 'Custódia Redundante & Backup Isolado (Google Drive)',
      status: 'ATIVO',
      corStatus: CORES.success,
      desc: 'Sincronização opcional com o Google Drive do despachante na pasta restrita G_CAC_BACKUPS via escopo estrito drive.file, garantindo redundância de dados sob custódia do próprio cliente.'
    }
  ];

  camadas.forEach(c => {
    doc.setFillColor(...CORES.cardBg);
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margem, y, larguraUtil, 16.5, 1.5, 1.5, 'FD');

    // Número
    doc.setFillColor(...CORES.primaryDark);
    doc.roundedRect(margem + 2, y + 2, 7, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(c.num, margem + 5.5, y + 6.2, { align: 'center' });

    // Nome
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...CORES.primaryDark);
    doc.text(c.nome, margem + 11, y + 6.5);

    // Badge de Status
    doc.setFillColor(...c.corStatus);
    doc.roundedRect(largura - margem - 18, y + 2.5, 15, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(c.status, largura - margem - 10.5, y + 5.7, { align: 'center' });

    // Descrição
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...CORES.textMuted);
    const descLinhas = doc.splitTextToSize(c.desc, larguraUtil - 14);
    doc.text(descLinhas, margem + 11, y + 10.8);

    y += 18.2;
  });

  // ===========================================================================
  // PÁGINA 3: PONTOS DE MELHORIA & BLINDAGEM CRÍTICA
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(3);
  desenharRodape(3);

  y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('2. O Que Precisamos Adicionar para Blindar a Operação', margem, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CORES.textMain);
  const textoP2 = 'Para comercializar com autoridade e garantir total conformidade com a LGPD e fiscalizações de órgãos oficiais, mapeamos 5 pilares estratégicos de evolução da segurança que eliminarão as brechas remanescentes:';
  const linhasP2 = doc.splitTextToSize(textoP2, larguraUtil);
  doc.text(linhasP2, margem, y);
  y += (linhasP2.length * 4) + 4;

  const melhorias = [
    {
      titulo: '1. Criptografia de Campo para Senhas Gov.br (pgcrypto)',
      prioridade: 'ALTA PRIORIDADE',
      corPrioridade: CORES.danger,
      situacao: 'Situação Atual: As senhas do portal Gov.br dos clientes ficam armazenadas em texto plano no banco.',
      proposta: 'Blindagem: Aplicar criptografia reversível AES-256 via função nativa pgcrypto no banco. A senha só se torna visível na tela quando um despachante expressamente autorizado clica em "Revelar Senha", gerando log imediato da ação.',
      beneficio: 'Impede vazamento de senhas em caso de exportação de backup ou auditoria indevida.'
    },
    {
      titulo: '2. Bucket de Documentos 100% Privado com URLs Assinadas',
      prioridade: 'ALTA PRIORIDADE',
      corPrioridade: CORES.danger,
      situacao: 'Situação Atual: O bucket de armazenamento do Supabase (documentos-clientes) foi criado com permissão pública.',
      proposta: 'Blindagem: Converter o bucket para privado e gerar URLs Pré-Assinadas (Signed URLs) com expiração temporária de 15 a 60 minutos. Ninguém sem sessão autenticada consegue abrir fotos de armas, RGs ou CRs.',
      beneficio: 'Garante que links de documentos não fiquem acessíveis publicamente na internet.'
    },
    {
      titulo: '3. Autenticação Multifator (2FA / MFA via TOTP)',
      prioridade: 'MÉDIA PRIORIDADE',
      corPrioridade: CORES.warning,
      situacao: 'Situação Atual: O login depende exclusivamente da conta Google ou e-mail cadastrado.',
      proposta: 'Blindagem: Exigir segundo fator de autenticação com código de 6 dígitos (Google Authenticator / Microsoft Authenticator) para sócios e administradores dos escritórios contratantes.',
      beneficio: 'Mesmo se a senha do e-mail do usuário for comprometida, o invasor não consegue invadir o Portal.'
    },
    {
      titulo: '4. Cabeçalhos Web de Defesa contra Ataques (Security Headers)',
      prioridade: 'IMEDIATA',
      corPrioridade: CORES.success,
      situacao: 'Situação Atual: O arquivo de deploy (vercel.json) contém apenas regras básicas de redirecionamento.',
      proposta: 'Blindagem: Adicionar cabeçalhos de proteção avançada: X-Frame-Options (evita clonagem em iframes/clickjacking), Content-Security-Policy (bloqueia injeção de scripts maliciosos/XSS) e HSTS (força SSL perpétuo).',
      beneficio: 'Blindagem instantânea do navegador sem qualquer impacto de uso para os clientes.'
    },
    {
      titulo: '5. Trilha de Auditoria Imutável de Segurança (Security Audit Log)',
      prioridade: 'MÉDIA PRIORIDADE',
      corPrioridade: CORES.warning,
      situacao: 'Situação Atual: Registramos quem criou e concluiu OSs, mas não acessos a telas de consulta.',
      proposta: 'Blindagem: Criar tabela logs_seguranca que registra: visualização de senhas Gov.br, exportação em massa de acervos, endereço IP, cidade de origem e dispositivo de quem executou.',
      beneficio: 'Rastreabilidade jurídica total para comprovar responsabilidade em caso de litígio.'
    }
  ];

  melhorias.forEach(m => {
    doc.setFillColor(...CORES.cardBg);
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margem, y, larguraUtil, 37.5, 2, 2, 'FD');

    // Cabeçalho do Card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...CORES.primaryDark);
    doc.text(m.titulo, margem + 4, y + 6);

    // Badge
    doc.setFillColor(...m.corPrioridade);
    doc.roundedRect(largura - margem - 30, y + 2.5, 26, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text(m.prioridade, largura - margem - 17, y + 5.7, { align: 'center' });

    // Situação Atual
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...CORES.danger);
    doc.text('• ' + m.situacao, margem + 4, y + 12);

    // Proposta
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.textMain);
    const linhasProp = doc.splitTextToSize('• ' + m.proposta, larguraUtil - 8);
    doc.text(linhasProp, margem + 4, y + 17);

    // Benefício (Sem caracteres especiais incompatíveis)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...CORES.primary);
    doc.text('[+] Beneficio Comercial: ' + m.beneficio, margem + 4, y + 33.5);

    y += 40.5;
  });

  // ===========================================================================
  // PÁGINA 4: O SENTINELA DE CIBERSEGURANÇA COM IA
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(4);
  desenharRodape(4);

  y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('3. Sentinela de Cibersegurança com IA (Google Gemini)', margem, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CORES.textMain);
  const textoIA = 'A grande inovação para o Portal G CAC é transformar a Inteligência Artificial (Google Gemini), já integrada à nossa plataforma, em um Sentinela Ativo 24/7. Em vez de depender de inspeção manual, a IA monitorará os padrões de uso e emitirá diagnósticos em linguagem simples e clara.';
  const linhasIA = doc.splitTextToSize(textoIA, larguraUtil);
  doc.text(linhasIA, margem, y);
  y += (linhasIA.length * 4) + 4;

  // Diagrama Visual em Card
  doc.setFillColor(15, 23, 42); // Navy Escuro
  doc.roundedRect(margem, y, larguraUtil, 55, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...CORES.accentCyan);
  doc.text('FLUXO DE FUNCIONAMENTO DO SENTINELA IA', margem + 6, y + 7);

  // 3 Colunas no Card Escuro
  const colunasFluxo = [
    {
      titulo: '1. CAPTAÇÃO DE EVENTOS',
      sub: 'Logs de acessos diários, tentativas falhas, consultas a acervos e exportações de relatórios.'
    },
    {
      titulo: '2. MOTOR IA (GEMINI)',
      sub: 'Identifica desvios de padrão, cidades conflitantes no mesmo dia e volumes suspeitos de download.'
    },
    {
      titulo: '3. AÇÃO & FEEDBACK',
      sub: 'Gera Boletim de Saúde de 0 a 100%, emite alertas no WhatsApp/Painel e recomenda ações preventivas.'
    }
  ];

  const larguraCol = (larguraUtil - 16) / 3;
  colunasFluxo.forEach((col, idx) => {
    const xCol = margem + 4 + (idx * (larguraCol + 4));
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(xCol, y + 12, larguraCol, 37, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(col.titulo, xCol + (larguraCol / 2), y + 20, { align: 'center' });

    doc.setDrawColor(...CORES.accentCyan);
    doc.setLineWidth(0.4);
    doc.line(xCol + 4, y + 23, xCol + larguraCol - 4, y + 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    const subLinhas = doc.splitTextToSize(col.sub, larguraCol - 6);
    doc.text(subLinhas, xCol + 3, y + 28);
  });

  y += 62;

  // Os 4 Pilares de Atuação do Sentinela com Badges Visuais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...CORES.primary);
  doc.text('Como a IA Protegerá Nossos Clientes no Dia a Dia:', margem, y);
  y += 5;

  const pilaresIA = [
    {
      badge: 'DETECÇÃO',
      corBadge: CORES.danger,
      titulo: 'Detecção de Logins Anômalos & Compartilhamento Indevido',
      detalhe: 'A IA avisa se um mesmo escritório parceiro fizer login simultâneo de São Paulo e Belém em um intervalo de 15 minutos, prevenindo vazamento de contas e pirataria de licenças.'
    },
    {
      badge: 'DEFESA',
      corBadge: CORES.accentBlue,
      titulo: 'Prevenção Contra Exfiltração & Cópia em Massa de Armas',
      detalhe: 'Se um funcionário ou terceiro tentar consultar ou baixar 30 cadastros de armas consecutivamente fora do expediente comercial, a IA aciona sinal vermelho imediatamente.'
    },
    {
      badge: 'SCORE',
      corBadge: CORES.success,
      titulo: 'Boletim Diário de Saúde de Segurança (Score de 0 a 100%)',
      detalhe: 'Apresenta nota visual no painel com parecer humano: "Ecossistema 98% Seguro nas últimas 24h. Nenhuma atividade suspeita detectada em nenhum dos escritórios parceiros."'
    },
    {
      badge: 'SCAN IA',
      corBadge: CORES.primary,
      titulo: 'Botão de "Diagnóstico com 1 Clique" para os Sócios',
      detalhe: 'Dentro do Painel Master Admin, uma aba dedicada onde Guilherme e Hector podem clicar em "Executar Varredura de Segurança" a qualquer momento para receber análise ao vivo.'
    }
  ];

  pilaresIA.forEach(p => {
    doc.setFillColor(...CORES.cardBg);
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margem, y, larguraUtil, 21, 1.5, 1.5, 'FD');

    // Badge Indicadora
    doc.setFillColor(...p.corBadge);
    doc.roundedRect(margem + 4, y + 4, 18, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text(p.badge, margem + 13, y + 7.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...CORES.primaryDark);
    doc.text(p.titulo, margem + 25, y + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...CORES.textMuted);
    const linhasDet = doc.splitTextToSize(p.detalhe, larguraUtil - 10);
    doc.text(linhasDet, margem + 5, y + 13.5);

    y += 24;
  });

  // ===========================================================================
  // PÁGINA 5: ROADMAP, CUSTOS & CONCLUSÃO SOCIETÁRIA
  // ===========================================================================
  doc.addPage();
  desenharCabecalho(5);
  desenharRodape(5);

  y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('4. Cronograma de Execução, Custos & Conclusão', margem, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CORES.textMain);
  const textoFases = 'Para não interromper o atendimento aos atiradores e garantir uma transição suave, dividimos o plano de implementação em 3 fases bem estruturadas:';
  doc.text(textoFases, margem, y);
  y += 8;

  // Tabela das Fases com largura ajustada para os badges
  const fases = [
    {
      fase: 'FASE 1: IMEDIATA',
      prazo: '24h a 48h',
      corBadge: CORES.success,
      larguraBadge: 32,
      acoes: '• Adição dos Security Headers no vercel.json (Anti-clickjacking e Anti-XSS).\n• Criação da tabela logs_seguranca no banco Supabase.\n• Implementação do Painel Sentinela IA no Master Admin com diagnóstico ao vivo.'
    },
    {
      fase: 'FASE 2: DADOS',
      prazo: '3 a 5 dias',
      corBadge: CORES.primary,
      larguraBadge: 30,
      acoes: '• Criptografia reversível da senha_gov no banco usando extensão pgcrypto.\n• Conversão do bucket de documentos para 100% privado com Signed URLs temporárias.\n• Alerta de exportação em massa de acervo bélico.'
    },
    {
      fase: 'FASE 3: GOVERNANÇA',
      prazo: '1 a 2 semanas',
      corBadge: CORES.primaryDark,
      larguraBadge: 36,
      acoes: '• Autenticação em dois fatores (2FA TOTP) para sócios e administradores de escritórios.\n• Varredura automatizada agendada (Cron Job) com resumo semanal por e-mail/notificação.'
    }
  ];

  fases.forEach(f => {
    doc.setFillColor(...CORES.cardBg);
    doc.setDrawColor(...CORES.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margem, y, larguraUtil, 26, 1.5, 1.5, 'FD');

    doc.setFillColor(...f.corBadge);
    doc.roundedRect(margem + 3, y + 3, f.larguraBadge, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(f.fase, margem + 3 + (f.larguraBadge / 2), y + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.primaryDark);
    doc.text(`Prazo estimado: ${f.prazo}`, margem + f.larguraBadge + 7, y + 6.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.textMain);
    const linhasAcoes = doc.splitTextToSize(f.acoes, larguraUtil - 10);
    doc.text(linhasAcoes, margem + 5, y + 13);

    y += 29;
  });

  y += 2;

  // Card de Impacto Financeiro (Custo R$ 0,00) com quebra de linha tratada
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margem, y, larguraUtil, 21, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // Verde 800
  doc.text('IMPACTO FINANCEIRO / CUSTO ADICIONAL: R$ 0,00', margem + 4, y + 5.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...CORES.textMain);
  const textoFinanceiro = 'Todas as tecnologias propostas utilizam recursos já contratados e disponíveis: o motor PostgreSQL e Storage do Supabase, o CDN da Vercel e a cota do Google Gemini que já temos ativa. Nenhum novo custo mensal de software será gerado. A segurança reforçada e o selo de IA serão nossos maiores argumentos de vendas para novos escritórios.';
  const linhasFin = doc.splitTextToSize(textoFinanceiro, larguraUtil - 8);
  doc.text(linhasFin, margem + 4, y + 10.5);

  y += 28;

  // Box de Conclusão e Assinatura dos Sócios
  doc.setFillColor(...CORES.cardBg);
  doc.setDrawColor(...CORES.cardBorder);
  doc.roundedRect(margem, y, larguraUtil, 45, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('TERMO DE ALINHAMENTO SOCIETÁRIO & CIÊNCIA', margem + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...CORES.textMuted);
  const textoTermo = 'Os sócios signatários manifestam ciência sobre o diagnóstico de segurança da informação do ecossistema Portal G CAC e aprovam o cronograma de implementação da Sentinela com Inteligência Artificial e blindagem de dados.';
  const linhasTermo = doc.splitTextToSize(textoTermo, larguraUtil - 8);
  doc.text(linhasTermo, margem + 4, y + 11);

  // Linhas de Assinatura
  const yAssinatura = y + 28;
  const larguraAss = 68;

  // Assinatura Guilherme
  doc.setDrawColor(...CORES.textMuted);
  doc.setLineWidth(0.3);
  doc.line(margem + 10, yAssinatura, margem + 10 + larguraAss, yAssinatura);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('Guilherme Gomes de Assis', margem + 10 + (larguraAss / 2), yAssinatura + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...CORES.textMuted);
  doc.text('Fundador & Gestor Principal', margem + 10 + (larguraAss / 2), yAssinatura + 7.5, { align: 'center' });

  // Assinatura Hector
  const xAssHector = largura - margem - 10 - larguraAss;
  doc.line(xAssHector, yAssinatura, xAssHector + larguraAss, yAssinatura);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...CORES.primaryDark);
  doc.text('Hector Henrique Furtado Meira', xAssHector + (larguraAss / 2), yAssinatura + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...CORES.textMuted);
  doc.text('Sócio & Gestão de Operações', xAssHector + (larguraAss / 2), yAssinatura + 7.5, { align: 'center' });

  return doc;
}

// ── EXECUÇÃO DO SCRIPT ──────────────────────────────────────────────────────
const doc = criarDocumentoSeguranca();
const buffer = Buffer.from(doc.output('arraybuffer'));

// Salvar no diretório do projeto
const caminhoProjeto = path.resolve('RELATORIO_SEGURANCA_CIBERNETICA_PORTAL_GCAC.pdf');
fs.writeFileSync(caminhoProjeto, buffer);
console.log('PDF gerado com sucesso no projeto:', caminhoProjeto);

// Salvar também no diretório de artefatos da sessão
const dirArtefatos = 'C:\\Users\\Guilherme Gomes\\.gemini\\antigravity\\brain\\6c3d1837-1aa9-4b2c-b38c-3656c9b74b1d';
if (fs.existsSync(dirArtefatos)) {
  const caminhoArtefato = path.join(dirArtefatos, 'RELATORIO_SEGURANCA_CIBERNETICA_PORTAL_GCAC.pdf');
  fs.writeFileSync(caminhoArtefato, buffer);
  console.log('PDF copiado para diretório de artefatos:', caminhoArtefato);
}
