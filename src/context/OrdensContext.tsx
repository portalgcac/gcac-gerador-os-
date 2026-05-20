import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { OrdemDeServico, StatusOS, FormaPagamento, CanalAtendimento } from '../types';
import { supabase } from '../db/supabase';
import { sincronizarOrdem } from '../services/driveSync';
import { useAuth } from './AuthContext';
import { useStatusConexao } from '../hooks/useStatusConexao';

interface OrdensContextType {
  ordens: OrdemDeServico[];
  totalPendentes: number;
  criarOrdem: (dados: Omit<OrdemDeServico, 'id' | 'numero' | 'criadoEm' | 'atualizadoEm' | 'driveArquivoJsonId' | 'drivePdfId' | 'ultimaSincronizacao' | 'pendenteSincronizacao'>) => Promise<string>;
  atualizarOrdem: (id: string, dados: Partial<OrdemDeServico>) => Promise<void>;
  atualizarStatusServico: (ordemId: string, servicoId: string, novoStatus: any) => Promise<void>;
  atualizarGruServico: (ordemId: string, servicoId: string, pago: boolean) => Promise<void>;
  atualizarProtocoloServico: (ordemId: string, servicoId: string, protocolo: string) => Promise<void>;
  deletarOrdem: (id: string) => Promise<void>;
  buscarOrdem: (id: string) => Promise<OrdemDeServico | undefined>;
  registrarPagamento: (ordemId: string, valor: number, metodo: FormaPagamento) => Promise<void>;
  removerPagamento: (ordemId: string, pagamentoId: string) => Promise<void>;
  sincronizarComPerfil: (ordemId: string) => Promise<boolean>;
  itensFila: number; 
}

const OrdensContext = createContext<OrdensContextType | null>(null);

const mapFromDB = (row: any): OrdemDeServico => {
  const servicos = row.servicos || [];
  
  // Lógica de Migração: Se houver um protocolo na raiz (antigo) e nenhum serviço tiver protocolo, 
  // movemos o protocolo da raiz para o primeiro serviço da lista.
  if (row.protocolo && servicos.length > 0 && !servicos.some((s: any) => s.protocolo)) {
    servicos[0] = { ...servicos[0], protocolo: row.protocolo };
  }

  return {
    id: row.id,
    numero: parseInt(row.numero, 10),
    nomeCliente: row.nome_cliente,
    contato: row.contato,
    cpf: row.cpf,
    senhaGov: row.senha_gov || '',
    filiadoProTiro: row.filiado_pro_tiro,
    clubeFiliado: row.clube_filiado || '',
    endereco: row.endereco || '',
    servicos: servicos,
    valor: row.valor,
    valorPago: row.valor_pago || 0,
    historicoPagamentos: row.historico_pagamentos || [],
    formaPagamento: row.forma_pagamento as FormaPagamento,
    status: row.status as StatusOS,
    taxaPFTotal: row.taxa_pf_total || 0,
    canalAtendimento: row.canal_atendimento as CanalAtendimento | null,
    observacaoContato: row.observacao_contato || '',
    observacoes: row.observacoes || '',
    migrado: row.migrado || false,
    driveArquivoJsonId: row.drive_arquivo_json_id || null,
    drivePdfId: row.drive_pdf_id || null,
    ultimaSincronizacao: row.ultima_sincronizacao || null,
    pendenteSincronizacao: row.pendente_sincronizacao,
    criadoPorNome: row.criado_por_nome || '',
    concluidoPorNome: row.concluido_por_nome || '',
    usuarioId: row.usuario_id || '',
    historicoStatus: row.historico_status || [],
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
};

const mapToDB = (dados: any) => {
  const payload: any = {};
  if (dados.nomeCliente !== undefined) payload.nome_cliente = String(dados.nomeCliente).toUpperCase();
  if (dados.contato !== undefined) payload.contato = dados.contato;
  if (dados.cpf !== undefined) payload.cpf = dados.cpf;
  if (dados.senhaGov !== undefined) payload.senha_gov = dados.senhaGov;
  if (dados.filiadoProTiro !== undefined) payload.filiado_pro_tiro = dados.filiadoProTiro;
  if (dados.clubeFiliado !== undefined) payload.clube_filiado = dados.clubeFiliado;
  if (dados.endereco !== undefined) payload.endereco = dados.endereco;
  if (dados.servicos !== undefined) payload.servicos = dados.servicos;
  if (dados.valor !== undefined) payload.valor = dados.valor;
  if (dados.valorPago !== undefined) payload.valor_pago = dados.valorPago;
  if (dados.historicoPagamentos !== undefined) payload.historico_pagamentos = dados.historicoPagamentos;
  if (dados.formaPagamento !== undefined) payload.forma_pagamento = dados.formaPagamento;
  if (dados.status !== undefined) payload.status = dados.status;
  if (dados.canalAtendimento !== undefined) payload.canal_atendimento = dados.canalAtendimento;
  if (dados.observacaoContato !== undefined) payload.observacao_contato = dados.observacaoContato;
  if (dados.observacoes !== undefined) payload.observacoes = dados.observacoes;
  if (dados.migrado !== undefined) payload.migrado = dados.migrado;
  if (dados.taxaPFTotal !== undefined) payload.taxa_pf_total = dados.taxaPFTotal;
  if (dados.criadoPorNome !== undefined) payload.criado_por_nome = dados.criadoPorNome;
  if (dados.concluidoPorNome !== undefined) payload.concluido_por_nome = dados.concluidoPorNome;
  if (dados.usuarioId !== undefined) payload.usuario_id = dados.usuarioId;
  if (dados.historicoStatus !== undefined) payload.historico_status = dados.historicoStatus;
  
  if (dados.driveArquivoJsonId !== undefined) payload.drive_arquivo_json_id = dados.driveArquivoJsonId;
  if (dados.drivePdfId !== undefined) payload.drive_pdf_id = dados.drivePdfId;
  if (dados.ultimaSincronizacao !== undefined) payload.ultima_sincronizacao = dados.ultimaSincronizacao;
  if (dados.pendenteSincronizacao !== undefined) payload.pendente_sincronizacao = dados.pendenteSincronizacao;
  
  return payload;
};

export function OrdensProvider({ children }: { children: React.ReactNode }) {
  const { estaAutenticado } = useAuth();
  const online = useStatusConexao();
  const { usuario } = useAuth();
  const [ordens, setOrdens] = useState<OrdemDeServico[]>([]);

  const adicionarEvento = useCallback((historico: any[] = [], tipo: any, descricao: string, valorAnterior?: string, valorNovo?: string) => {
    const novoEvento = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      usuario: usuario?.nome || 'Sistema',
      tipo,
      descricao,
      valorAnterior,
      valorNovo
    };
    return [...historico, novoEvento];
  }, [usuario]);

  const carregarOrdens = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('ordens')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('numero', { ascending: false });
    
    if (!error && data) {
      setOrdens(data.map(mapFromDB));
    }
  }, [usuario]);

  useEffect(() => {
    carregarOrdens();
  }, [carregarOrdens]);

  const totalPendentes = ordens.filter(o => o.status === 'Aguardando Pagamento').length;

  const criarOrdem = useCallback(async (
    dados: Omit<OrdemDeServico, 'id' | 'numero' | 'criadoEm' | 'atualizadoEm' | 'driveArquivoJsonId' | 'drivePdfId' | 'ultimaSincronizacao' | 'pendenteSincronizacao'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const payloadNovo = {
      ...mapToDB(dados),
      pendente_sincronizacao: true,
      criado_por_nome: usuario?.nome || 'Sistema',
      usuario_id: usuario?.id,
      historico_status: adicionarEvento([], 'criacao', 'Ordem de serviço aberta'),
      empresa_id: usuario.empresaId
    };

    const { data, error } = await supabase
      .from('ordens')
      .insert([payloadNovo])
      .select()
      .single();

    if (error || !data) throw error || new Error('Falha ao criar OS');
    const ordemCriada = mapFromDB(data);

    await carregarOrdens();

    if (online && estaAutenticado) {
      // Dispara backup do Drive silenciosamente no background (assincrono sem travar)
      sincronizarOrdem(ordemCriada).catch(console.error);
    }

    return ordemCriada.id;
  }, [online, estaAutenticado, carregarOrdens, usuario]);

  const atualizarOrdem = useCallback(async (id: string, dados: Partial<OrdemDeServico>) => {
    // Se estiver marcando como concluída (Pago), registra quem fez a ação
    const dadosAtualizados = { ...dados };
    const ordemOriginal = ordens.find(o => o.id === id);
    
    if (dados.status && ordemOriginal && dados.status !== ordemOriginal.status) {
      dadosAtualizados.historicoStatus = adicionarEvento(
        ordemOriginal.historicoStatus, 
        'status_os', 
        `Status da OS alterado para ${dados.status}`,
        ordemOriginal.status,
        dados.status
      );
    }

    if (dados.status === 'Pago') {
      dadosAtualizados.concluidoPorNome = usuario?.nome || 'Sistema';
    }

    const { data, error } = await supabase
      .from('ordens')
      .update({
        ...mapToDB(dadosAtualizados),
        pendente_sincronizacao: true,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    await carregarOrdens();

    if (online && estaAutenticado && data) {
      sincronizarOrdem(mapFromDB(data)).catch(console.error);
    }
  }, [online, estaAutenticado, carregarOrdens]);

  const atualizarStatusServico = useCallback(async (ordemId: string, servicoId: string, novoStatus: any) => {
    const ordem = ordens.find(o => o.id === ordemId);
    if (!ordem) return;

    const novosServicos = ordem.servicos.map(s => 
      s.id === servicoId ? { ...s, statusExecucao: novoStatus } : s
    );

    const servico = ordem.servicos.find(s => s.id === servicoId);
    const novoHistorico = adicionarEvento(
      ordem.historicoStatus,
      'status_execucao',
      `Status do serviço "${servico?.nome}" alterado para ${novoStatus}`,
      servico?.statusExecucao,
      novoStatus
    );

    await atualizarOrdem(ordemId, { 
      servicos: novosServicos,
      historicoStatus: novoHistorico
    });
  }, [ordens, atualizarOrdem]);
  const atualizarGruServico = useCallback(async (ordemId: string, servicoId: string, pago: boolean) => {
    const ordem = ordens.find(o => o.id === ordemId);
    if (!ordem) return;

    const novosServicos = ordem.servicos.map(s => 
      s.id === servicoId ? { ...s, pagoGRU: pago } : s
    );

    await atualizarOrdem(ordemId, { servicos: novosServicos });
  }, [ordens, atualizarOrdem]);

  const atualizarProtocoloServico = useCallback(async (ordemId: string, servicoId: string, protocolo: string) => {
    const ordem = ordens.find(o => o.id === ordemId);
    if (!ordem) return;

    const novosServicos = ordem.servicos.map(s => 
      s.id === servicoId ? { ...s, protocolo } : s
    );

    const servico = ordem.servicos.find(s => s.id === servicoId);
    const novoHistorico = adicionarEvento(
      ordem.historicoStatus,
      'protocolo',
      `Protocolo do serviço "${servico?.nome}" atualizado: ${protocolo}`,
      servico?.protocolo,
      protocolo
    );

    await atualizarOrdem(ordemId, { 
      servicos: novosServicos,
      historicoStatus: novoHistorico
    });
  }, [ordens, atualizarOrdem]);

  const deletarOrdem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('ordens')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarOrdens();
  }, [carregarOrdens]);
  const buscarOrdem = useCallback(async (id: string) => {
    if (!usuario?.empresaId) return undefined;
    const { data, error } = await supabase
      .from('ordens')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, [usuario]);

  const registrarPagamento = useCallback(async (ordemId: string, valor: number, metodo: FormaPagamento) => {
    const ordem = ordens.find(o => o.id === ordemId);
    if (!ordem) return;
    
    // ... (rest of registrarPagamento is fine, but I'll add removerPagamento below)

    const novoPagamento = {
      id: crypto.randomUUID(),
      valor,
      metodo,
      data: new Date().toISOString()
    };

    const novoHistorico = [...(ordem.historicoPagamentos || []), novoPagamento];
    const novoValorPago = novoHistorico.reduce((acc, p) => acc + p.valor, 0);
    
    
    let novoStatus: StatusOS = ordem.status;
    let concluidoPorNome = ordem.concluidoPorNome;

    if (novoValorPago >= ordem.valor) {
      novoStatus = 'Pago';
      concluidoPorNome = usuario?.nome || 'Sistema';
    } else if (novoValorPago > 0) {
      novoStatus = 'Parcialmente Pago';
    } else {
      novoStatus = 'Aguardando Pagamento';
    }

    await atualizarOrdem(ordemId, {
      valorPago: novoValorPago,
      historicoPagamentos: novoHistorico,
      status: novoStatus,
      concluidoPorNome: concluidoPorNome,
      formaPagamento: metodo, // Atualiza forma principal com o último método
      historicoStatus: adicionarEvento(
        ordem.historicoStatus,
        'pagamento',
        `Pagamento de R$ ${valor.toFixed(2)} registrado via ${metodo}`
      )
    });
  }, [ordens, atualizarOrdem]);

  const removerPagamento = useCallback(async (ordemId: string, pagamentoId: string) => {
    const ordem = ordens.find(o => o.id === ordemId);
    if (!ordem) return;

    const novoHistorico = (ordem.historicoPagamentos || []).filter(p => p.id !== pagamentoId);
    const novoValorPago = novoHistorico.reduce((acc, p) => acc + p.valor, 0);
    
    let novoStatus: StatusOS = 'Aguardando Pagamento';
    if (novoValorPago >= ordem.valor) {
      novoStatus = 'Pago';
    } else if (novoValorPago > 0) {
      novoStatus = 'Parcialmente Pago';
    }

    await atualizarOrdem(ordemId, {
      valorPago: novoValorPago,
      historicoPagamentos: novoHistorico,
      status: novoStatus
    });
  }, [ordens, atualizarOrdem]);
 
  const sincronizarComPerfil = useCallback(async (ordemId: string): Promise<boolean> => {
    try {
      const ordem = ordens.find(o => o.id === ordemId);
      if (!ordem) return false;
      if (!usuario?.empresaId) return false;

      // Buscar cliente pelo CPF (que é único e confiável)
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('cpf', ordem.cpf)
        .eq('empresa_id', usuario.empresaId)
        .maybeSingle();

      if (error || !cliente) return false;

      // Atualizar a ordem com os dados mais recentes do cliente
      await atualizarOrdem(ordemId, {
        nomeCliente: cliente.nome,
        contato: cliente.contato,
        senhaGov: cliente.senha_gov || '',
        endereco: cliente.endereco || '',
        filiadoProTiro: cliente.filiado_pro_tiro,
        clubeFiliado: cliente.clube_filiado || '',
        historicoStatus: adicionarEvento(
          ordem.historicoStatus,
          'sistema',
          'Dados do cliente sincronizados com o perfil do cadastro'
        )
      });

      return true;
    } catch (err) {
      console.error('Erro ao sincronizar com perfil:', err);
      return false;
    }
  }, [ordens, atualizarOrdem, adicionarEvento]);

  return (
    <OrdensContext.Provider value={{
      ordens,
      totalPendentes,
      criarOrdem,
      atualizarOrdem,
      atualizarStatusServico,
      atualizarGruServico,
      atualizarProtocoloServico,
      deletarOrdem,
      buscarOrdem,
      registrarPagamento,
      removerPagamento,
      sincronizarComPerfil,
      itensFila: ordens.filter(o => o.pendenteSincronizacao).length,
    }}>
      {children}
    </OrdensContext.Provider>
  );
}

export function useOrdens(): OrdensContextType {
  const ctx = useContext(OrdensContext);
  if (!ctx) throw new Error('useOrdens deve ser usado dentro de OrdensProvider');
  return ctx;
}
