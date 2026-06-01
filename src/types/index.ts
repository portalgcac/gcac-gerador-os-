// ─── Tipos Principais ──────────────────────────────────────────────────────

export type StatusOS =
  | 'Aguardando Pagamento'
  | 'Parcialmente Pago'
  | 'Gratuidade'
  | 'Pago';

export type StatusOrcamento =
  | 'Pendente'
  | 'Aprovado'
  | 'Recusado';

export type FormaPagamento =
  | 'PIX'
  | 'Dinheiro'
  | 'Cartão de Crédito (Stone)'
  | 'Cartão de Débito (Stone)'
  | 'Cartão de Crédito (Infinity)'
  | 'Cartão de Débito (Infinity)'
  | 'Transferência'
  | 'A Combinar'
  | 'Pendente'
  | 'Cartão de Crédito'
  | 'Cartão de Débito'
  | 'Crédito de Cliente';

export type CanalAtendimento =
  | 'WhatsApp'
  | 'Presencial'
  | 'Ligação'
  | 'E-mail'
  | 'Outro';

export type StatusExecucaoServico =
  | 'Não Iniciado'
  | 'Iniciado — Montando Processo'
  | 'Aguardando Documentos'
  | 'Protocolado — Ag. PF'
  | 'Concluído';

export interface ServicoConfig {
  id: string;
  nome: string;
  valorPadrao: number;
  valorFiliado: number;
  taxaPF: number;
  exigeGRU?: boolean;
  categoria: 'Honorário' | 'Laudo';
  pagoDiretoDefault?: boolean;
  criadoEm: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  contato: string;
  senhaGov: string;
  filiadoProTiro: boolean;
  clubeFiliado: string;
  observacoes: string;
  endereco: string;
  numeroCr?: string;
  vencimentoCr?: string;
  numeroCrIbama?: string;
  vencimentoCrIbama?: string;
  fotoUrl?: string;
  crUrl?: string;
  crIbamaUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Arma {
  id: string;
  clienteId: string;
  tipo: string;
  modelo: string;
  calibre: string;
  fabricante: string;
  numeroSerie: string;
  numeroSigma: string;
  acervo: 'Caça' | 'Tiro Desportivo' | 'Coleção';
  vencimentoCraf: string;
  crafUrl?: string;
  criadoEm: string;
}

export interface GuiaTrafego {
  id: string;
  armaId: string;
  tipo: 'Treino' | 'Caça' | 'Manutenção' | 'Transferência' | 'Outro';
  vencimento: string;
  destino: string;
  arquivoUrl?: string;
  criadoEm: string;
}

export interface AutorizacaoManejo {
  id: string;
  clienteId: string;
  numeroCar: string;
  nomeFazenda: string;
  nomeProprietario: string;
  cidade: string;
  vencimento: string;
  arquivoUrl?: string;
  criadoEm: string;
  status: 'Ativo' | 'Inerte';
}

export interface OrdemDeServico {
  id: string;
  numero: number;

  // Dados do Cliente
  nomeCliente: string;
  contato: string;
  cpf: string;
  senhaGov: string;
  filiadoProTiro: boolean;
  clubeFiliado: string;  // preenchido se filiadoProTiro === false
  endereco: string;

  // Serviço
  servicos: {
    id: string;
    nome: string;
    detalhes: string;
    taxaPF?: number; // Armazenamos o snapshot da taxa no momento da criação
    exigeGRU?: boolean; // Se este serviço exige controle de GRU
    valor?: number;  // Valor individual editável do serviço
    statusExecucao?: StatusExecucaoServico;
    pagoGRU?: boolean;
    categoria?: 'Honorário' | 'Laudo';
    pagoDireto?: boolean; // Se o pagamento vai direto ao terceiro (instrutor/psicóloga)
    protocolo?: string;
    responsavelNome?: string;
    valorRepasse?: number;
  }[];
  valor: number;
  valorPago: number;
  historicoPagamentos: PagamentoItem[];
  taxaPFTotal?: number; // Total de taxas para esta OS
  formaPagamento: FormaPagamento;

  // Controle
  status: StatusOS;
  canalAtendimento: CanalAtendimento | null;
  observacaoContato: string;
  observacoes: string;
  migrado?: boolean;

  // Sincronização
  driveArquivoJsonId: string | null;
  drivePdfId: string | null;
  ultimaSincronizacao: string | null;
  pendenteSincronizacao: boolean;
  criadoPorNome?: string;
  concluidoPorNome?: string;
  usuarioId?: string;
  historicoStatus?: EventoHistorico[];

  // Datas
  criadoEm: string;
  atualizadoEm: string;
}

export interface EventoHistorico {
  id: string;
  data: string;
  usuario: string;
  tipo: 'status_os' | 'status_execucao' | 'pagamento' | 'criacao' | 'protocolo' | 'sistema';
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
}

export interface ServicoOrcamento {
  id: string;
  nome: string;
  detalhes: string;
  valor: number;
  taxaPF?: number; // Armazenamos o snapshot da taxa no momento da criação
  exigeGRU?: boolean;
  categoria?: 'Honorário' | 'Laudo';
  pagoDireto?: boolean;
}

export interface Orcamento {
  id: string;
  numero: number;
  
  // Dados do Cliente
  nomeCliente: string;
  contato: string;
  cpf: string;
  senhaGov?: string;
  filiadoProTiro: boolean;
  clubeFiliado: string;
  endereco: string;
  
  // Serviço
  servicos: ServicoOrcamento[];
  valorTotal: number;
  
  // Controle
  status: StatusOrcamento;
  observacoes: string;
  convertidoOsId?: string;
  taxaPFTotal?: number;
  criadoPorNome?: string;
  usuarioId?: string;
  
  // Datas
  criadoEm: string;
  atualizadoEm: string;
}

export interface Recibo {
  id: string;
  numero: number;
  
  // Dados do Cliente
  clienteNome: string;
  clienteCPF: string;
  clienteContato?: string;
  
  // Valores e Serviços
  servicos: {
    id: string;
    nome: string;
    valor: number;
    detalhes?: string;
  }[];
  valorTotal: number;
  
  // Referência Opcional
  ordemId?: string;
  formaPagamento: FormaPagamento;
  observacoes: string;
  criadoPorNome?: string;
  usuarioId?: string;
  
  // Emitente (Dados Fixos)
  emitenteNome: string;
  emitenteCNPJ: string;
  
  // Datas
  criadoEm: string;
}

export interface FilaSincronizacao {
  id?: number;
  ordemId: string;
  operacao: 'criar' | 'atualizar' | 'deletar';
  tentativas: number;
  criadoEm: string;
}

export interface DadosEmpresa {
  id: string;
  nome: string;
  tipoConta: 'empresa' | 'cac_individual';
  clubeParceiroPadrao?: string;
  razaoSocialFantasia?: string;
  responsavelNome?: string;
  contatoTelefone?: string;
  endereco?: string;
  cnpj?: string;
  recursosLiberados?: string[];
  logoUrl?: string;
}

export interface UsuarioGoogle {
  id: string;
  nome: string;
  email: string;
  fotoPerfil: string;
  accessToken: string;
  role: 'admin' | 'colaborador';
  permissoes?: string[];
  empresaId?: string;
  empresaNome?: string;
  tipoConta?: 'empresa' | 'cac_individual';
  modulosAtivos?: string[];
  cpf?: string;
  contato?: string;
  dadosEmpresa?: DadosEmpresa;
}

export interface Empresa {
  id: string;
  nome: string;
  criadoEm: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────

export const ATALHOS_SERVICO = [
  'Atualização de atividades',
  'Atualização de dados pessoais',
  'Atualização de endereço',
  'Autorização de aquisição de arma de fogo (pedido de compra)',
  'Cancelamento de CR',
  'Concessão de CR para pessoa física - Atirador',
  'Concessão de CR para pessoa física - Caçador',
  'Guia de Tráfego',
  'IBAMA - Emissão de CR',
  'IBAMA - Emissão de Autorização de manejo',
  'IBAMA - Declaração de acesso a propriedade',
  'Inclusão de 2º endereço',
  'Renovação de CR',
  'Renovação de CRAF',
  'Solicitação de CRAF (apostilamento de arma)',
  'Transferência entre acervos (mudança de acervo)',
  'Progressão de nível',
  'Transferência CAC x CAC',
  'Pasta de documentos personalizada',
  'Outros',
] as const;

export const CANAIS_ATENDIMENTO: CanalAtendimento[] = [
  'WhatsApp',
  'Presencial',
  'Ligação',
  'E-mail',
  'Outro',
];

export const FORMAS_PAGAMENTO: FormaPagamento[] = [
  'PIX',
  'Dinheiro',
  'Cartão de Crédito (Stone)',
  'Cartão de Débito (Stone)',
  'Cartão de Crédito (Infinity)',
  'Cartão de Débito (Infinity)',
  'Transferência',
  'A Combinar',
  'Pendente',
  'Crédito de Cliente',
];

export const STATUS_OS: StatusOS[] = [
  'Aguardando Pagamento',
  'Parcialmente Pago',
  'Gratuidade',
  'Pago',
];

export const STATUS_ORCAMENTO: StatusOrcamento[] = [
  'Pendente',
  'Aprovado',
  'Recusado',
];

export const STATUS_EXECUCAO_SERVICO: StatusExecucaoServico[] = [
  'Não Iniciado',
  'Iniciado — Montando Processo',
  'Aguardando Documentos',
  'Protocolado — Ag. PF',
  'Concluído',
];

export interface PagamentoItem {
  id: string;
  valor: number;
  metodo: FormaPagamento;
  data: string;
}

export type TipoAgendamento = 'Psicológico' | 'Tiro';

export interface Agendamento {
  id: string;
  tipo: TipoAgendamento;
  clienteNome: string;
  clienteCPF: string;
  clienteContato: string;
  clienteEndereco: string;
  arma: string;
  data: string; // YYYY-MM-DD
  horario: string;
  local: string;
  profissional: string;
  valor: number;
  dataPsicologico?: string;
  horarioPsicologico?: string;
  confirmado: boolean;
  confirmadoColaborador?: boolean;
  despachante?: string;
  usuarioId?: string;
  status?: 'pendente' | 'realizado';
  criadoEm: string;
}

export interface Perfil {
  id: string; // Google sub
  nome: string;
  email: string;
  cpf?: string;
  contato?: string;
  role: 'admin' | 'colaborador';
  ativo: boolean;
  statusPagamento: 'em_dia' | 'atrasado' | 'pendente';
  criadoEm: string;
}
export interface NotificacaoSistema {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  tipo: 'info' | 'sucesso' | 'alerta';
  link?: string;
  criadoEm: string;
}

export interface Lembrete {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;     // YYYY-MM-DD
  horario?: string; // HH:mm
  concluido: boolean;
  prioridade: 'baixa' | 'media' | 'alta';
  clienteId?: string;
  clienteNome?: string;
  usuarioId: string;
  criadoEm: string;
}

export interface CreditoCliente {
  id: string;
  clienteId: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  origemId?: string;
  criadoPorNome?: string;
  criadoEm: string;
}
