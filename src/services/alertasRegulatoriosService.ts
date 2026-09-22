import { supabase } from '../db/supabase';

export interface AlertaRegulatorio {
  id: string;
  titulo: string;
  orgao: 'Exército Brasileiro' | 'Polícia Federal' | 'Ibama' | 'Presidência da República' | 'Geral';
  nivel_urgencia: 'informativo' | 'importante' | 'urgente';
  resumo: string;
  conteudo: string;
  impacto_despachante?: string;
  impacto_cac?: string;
  link_oficial?: string;
  fixado: boolean;
  data_publicacao: string;
  autor: string;
}

const CHAVE_CONTEUDO = 'alertas_regulatorios_json';

// Alertas regulatórios pré-carregados como referência oficial inicial
const ALERTAS_INICIAIS: AlertaRegulatorio[] = [
  {
    id: 'alerta-inicial-1',
    titulo: 'Decreto nº 11.615/2023 — Validade e Renovação de Certificado de Registro (CR)',
    orgao: 'Exército Brasileiro',
    nivel_urgencia: 'importante',
    resumo: 'Novos prazos de renovação de CR (3 anos) e regras para comprovação de habitualidade em clubes de tiro credenciados.',
    conteudo: 'O Decreto 11.615/2023 estabelece que a validade do Certificado de Registro (CR) passa a ser de 3 (três) anos para as atividades de Caçador, Atirador Desportivo e Colecionador. A comprovação de treinamentos e competições deve ser realizada por meio de declaração de habitualidade emitida pelo clube de tiro com registro válido no SIGMA.',
    impacto_despachante: 'Monitore os prazos de CR de sua carteira a partir de 90 dias antes do vencimento. Solicite as declarações de habitualidade aos clubes parceiros antes de protocolar no SisGCorp.',
    impacto_cac: 'Mantenha sua frequência regular de no mínimo 8 a 12 participações por calibre/ano no seu clube de tiro para não ter pendências na renovação.',
    link_oficial: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11615.htm',
    fixado: true,
    data_publicacao: '2026-01-15T10:00:00.000Z',
    autor: 'Diretoria Portal G CAC'
  },
  {
    id: 'alerta-inicial-2',
    titulo: 'Instrução Normativa PF nº 201 — Guia de Tráfego e Transferência SIGMA/SINARM',
    orgao: 'Polícia Federal',
    nivel_urgencia: 'informativo',
    resumo: 'Diretrizes sobre emissão de Guias de Trânsito para manutenção e procedimentos de transferência entre sistemas.',
    conteudo: 'A Polícia Federal atualizou o fluxo de emissão de Guia de Tráfego Eletrônica para manutenção e reparo de armamentos em armeiros credenciados. As solicitações devem ser acompanhadas de comprovante de residência atualizado e cópia do CRAF vigente.',
    impacto_despachante: 'Emita a solicitação sempre anexando o laudo prévio da oficina ou armeiro credenciado para evitar exigências de complementação documental.',
    impacto_cac: 'Nunca transporte sua arma para conserto sem a Guia de Tráfego devidamente expedida e desmuniciada.',
    link_oficial: 'https://www.gov.br/pf/pt-br/assuntos/armas',
    fixado: false,
    data_publicacao: '2026-02-10T14:30:00.000Z',
    autor: 'Guilherme Gomes (Gestor Principal)'
  },
  {
    id: 'alerta-inicial-3',
    titulo: 'Instrução Normativa Ibama nº 03 — Controle e Manejo de Javali (Fauna Exótica Invasora)',
    orgao: 'Ibama',
    nivel_urgencia: 'urgente',
    resumo: 'Exigência de relatório semestral de abate e validação do Certificado de Regularidade do Cadastro Técnico Federal (CTF).',
    conteudo: 'O Ibama reforça a obrigatoriedade da entrega tempestiva do Relatório de Atividades de Manejo no sistema SIMAF. O atraso na entrega do relatório semestral pode ocasionar o bloqueio automático da Autorização de Manejo e a suspensão da Guia de Tráfego de Caça no Exército.',
    impacto_despachante: 'Revise com seus clientes caçadores as datas de entrega dos relatórios semestrais no SIMAF. Utilize os modelos de declaração do Portal G CAC para garantir conformidade.',
    impacto_cac: 'Guarde sempre o comprovante de protocolo do SIMAF junto com a Guia de Trânsito do Exército durante deslocamentos para áreas de manejo autorizadas.',
    link_oficial: 'https://www.gov.br/ibama/pt-br/assuntos/biodiversidade/fauna-silvestre/manejo-de-fauna-exotica-invasora',
    fixado: false,
    data_publicacao: '2026-03-01T09:00:00.000Z',
    autor: 'Diretoria Portal G CAC'
  }
];

export async function buscarAlertasRegulatorios(): Promise<AlertaRegulatorio[]> {
  try {
    const { data, error } = await supabase
      .from('conteudo_site')
      .select('valor')
      .eq('chave', CHAVE_CONTEUDO)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao consultar alertas em conteudo_site, usando fallback:', error);
      const salvoLocal = localStorage.getItem('gcac_alertas_regulatorios');
      if (salvoLocal) {
        return JSON.parse(salvoLocal);
      }
      return ALERTAS_INICIAIS;
    }

    if (data?.valor) {
      const parsed = JSON.parse(data.valor);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem('gcac_alertas_regulatorios', JSON.stringify(parsed));
        return parsed;
      }
    }

    // Se ainda não existir no banco, inicializa com os dados iniciais
    await salvarTodosAlertasRegulatorios(ALERTAS_INICIAIS);
    return ALERTAS_INICIAIS;
  } catch (err) {
    console.error('Falha geral ao buscar alertas regulatórios:', err);
    const salvoLocal = localStorage.getItem('gcac_alertas_regulatorios');
    return salvoLocal ? JSON.parse(salvoLocal) : ALERTAS_INICIAIS;
  }
}

export async function salvarTodosAlertasRegulatorios(alertas: AlertaRegulatorio[]): Promise<boolean> {
  try {
    const valorJson = JSON.stringify(alertas);
    localStorage.setItem('gcac_alertas_regulatorios', valorJson);

    const { error } = await supabase
      .from('conteudo_site')
      .upsert(
        {
          chave: CHAVE_CONTEUDO,
          valor: valorJson,
          descricao: 'Central de comunicados e alertas regulatórios do Portal G CAC',
          grupo: 'regulatorio',
          atualizado_em: new Date().toISOString()
        },
        { onConflict: 'chave' }
      );

    if (error) {
      console.error('Erro ao gravar alertas regulatórios no Supabase:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Falha ao salvar alertas regulatórios:', err);
    return false;
  }
}

export async function salvarAlertaIndividual(
  alerta: Omit<AlertaRegulatorio, 'id' | 'data_publicacao'> & { id?: string },
  autorNome: string,
  notificarTodos: boolean = false
): Promise<AlertaRegulatorio> {
  const listaAtual = await buscarAlertasRegulatorios();
  let alertaSalvo: AlertaRegulatorio;

  if (alerta.id) {
    // Edição
    listaAtual.forEach((item, idx) => {
      if (item.id === alerta.id) {
        listaAtual[idx] = {
          ...item,
          ...alerta,
          id: alerta.id as string,
          autor: autorNome || item.autor
        };
        alertaSalvo = listaAtual[idx];
      }
    });
  } else {
    // Criação de novo alerta
    alertaSalvo = {
      ...alerta,
      id: `alerta-${Date.now()}`,
      data_publicacao: new Date().toISOString(),
      autor: autorNome || 'Diretoria Portal G CAC'
    };
    listaAtual.unshift(alertaSalvo);
  }

  // Se fixado, reposiciona para o topo
  listaAtual.sort((a, b) => {
    if (a.fixado === b.fixado) {
      return new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime();
    }
    return a.fixado ? -1 : 1;
  });

  await salvarTodosAlertasRegulatorios(listaAtual);

  // Se solicitado, dispara notificação de broadcast para todos os usuários
  if (notificarTodos && alertaSalvo!) {
    try {
      await supabase.from('notificacoes_sistema').insert([
        {
          titulo: `⚖️ ${alertaSalvo.orgao}: ${alertaSalvo.titulo}`,
          mensagem: alertaSalvo.resumo,
          tipo: alertaSalvo.nivel_urgencia === 'urgente' ? 'alerta' : 'info',
          link: '/dashboard'
        }
      ]);
    } catch (e) {
      console.warn('Não foi possível disparar notificação push complementar:', e);
    }
  }

  return alertaSalvo!;
}

export async function excluirAlertaRegulatorio(id: string): Promise<boolean> {
  const listaAtual = await buscarAlertasRegulatorios();
  const novaLista = listaAtual.filter(a => a.id !== id);
  return await salvarTodosAlertasRegulatorios(novaLista);
}
