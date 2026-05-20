import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Agendamento, TipoAgendamento } from '../types';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';
import { useNotificacoesSistema } from './NotificacoesSistemaContext';

interface AgendamentosContextType {
  agendamentos: Agendamento[];
  estaCarregando: boolean;
  criarAgendamento: (dados: Omit<Agendamento, 'id' | 'confirmado' | 'criadoEm'>) => Promise<string>;
  atualizarAgendamento: (id: string, dados: Partial<Agendamento>) => Promise<void>;
  deletarAgendamento: (id: string) => Promise<void>;
  confirmarAgendamento: (id: string, confirmado: boolean) => Promise<void>;
  confirmarAgendamentoColaborador: (id: string, confirmado: boolean) => Promise<void>;
  finalizarLaudo: (id: string) => Promise<void>;
  buscarAgendamentoPorCPF: (cpf: string, tipo?: TipoAgendamento) => Agendamento | undefined;
}

const AgendamentosContext = createContext<AgendamentosContextType | null>(null);

const mapFromDB = (row: any): Agendamento => ({
  id: row.id,
  tipo: row.tipo as TipoAgendamento,
  clienteNome: row.cliente_nome,
  clienteCPF: row.cliente_cpf,
  clienteContato: row.cliente_contato,
  clienteEndereco: row.cliente_endereco,
  arma: row.arma,
  data: row.data,
  horario: row.horario,
  local: row.local,
  profissional: row.profissional,
  valor: parseFloat(row.valor),
  dataPsicologico: row.data_psicologico || undefined,
  horarioPsicologico: row.horario_psicologico || undefined,
  confirmado: row.confirmado,
  confirmadoColaborador: row.confirmado_instrutor,
  despachante: row.despachante || 'GCAC / Guilherme',
  usuarioId: row.usuario_id,
  status: row.status || 'pendente',
  criadoEm: row.criado_em,
});

const mapToDB = (dados: any) => {
  const payload: any = {};
  if (dados.tipo !== undefined) payload.tipo = dados.tipo;
  if (dados.clienteNome !== undefined) payload.cliente_nome = String(dados.clienteNome).toUpperCase();
  if (dados.clienteCPF !== undefined) payload.cliente_cpf = dados.clienteCPF;
  if (dados.clienteContato !== undefined) payload.cliente_contato = dados.clienteContato;
  if (dados.clienteEndereco !== undefined) payload.cliente_endereco = dados.clienteEndereco;
  if (dados.arma !== undefined) payload.arma = dados.arma;
  if (dados.data !== undefined) payload.data = dados.data;
  if (dados.horario !== undefined) payload.horario = dados.horario;
  if (dados.local !== undefined) payload.local = dados.local;
  if (dados.profissional !== undefined) payload.profissional = dados.profissional;
  if (dados.valor !== undefined) payload.valor = dados.valor;
  if (dados.dataPsicologico !== undefined) payload.data_psicologico = dados.dataPsicologico || null;
  if (dados.horarioPsicologico !== undefined) payload.horario_psicologico = dados.horarioPsicologico || null;
  if (dados.confirmado !== undefined) payload.confirmado = dados.confirmado;
  if (dados.confirmadoColaborador !== undefined) payload.confirmado_instrutor = dados.confirmadoColaborador;
  if (dados.despachante !== undefined) payload.despachante = dados.despachante;
  if (dados.usuarioId !== undefined) payload.usuario_id = dados.usuarioId;
  if (dados.status !== undefined) payload.status = dados.status;
  return payload;
};

export function AgendamentosProvider({ children }: { children: React.ReactNode }) {
  const { usuario, estaAutenticado } = useAuth();
  const { enviarNotificacao } = useNotificacoesSistema();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [estaCarregando, setEstaCarregando] = useState(true);

  const carregarAgendamentos = useCallback(async () => {
    if (!estaAutenticado || !usuario?.empresaId) return;
    
    setEstaCarregando(true);
    let query = supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('data', { ascending: false });
    
    // Se for colaborador, filtra apenas os seus próprios dados (Multi-Tenant)
    // O Administrador (Guilherme) continua vendo tudo
    if (usuario?.role === 'colaborador') {
      query = query.eq('usuario_id', usuario.id);
    }
    
    const { data, error } = await query;
    
    if (!error && data) {
      setAgendamentos(data.map(mapFromDB));
    }
    setEstaCarregando(false);
  }, [estaAutenticado, usuario]);

  useEffect(() => {
    carregarAgendamentos();
  }, [carregarAgendamentos]);

  const criarAgendamento = useCallback(async (
    dados: Omit<Agendamento, 'id' | 'confirmado' | 'criadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const payload = {
      ...mapToDB(dados),
      usuario_id: usuario?.id,
      status: 'pendente',
      confirmado: false,
      empresa_id: usuario.empresaId
    };

    const { data, error } = await supabase
      .from('agendamentos')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro Supabase ao criar agendamento:', error);
      throw error;
    }
    
    if (!data) throw new Error('Falha ao criar agendamento: nenhum dado retornado');
    
    // Notificar Admin apenas se for Colaborador E se o despacho for para GCAC
    if (usuario?.role === 'colaborador' && dados.despachante === 'GCAC / Guilherme') {
      enviarNotificacao({
        titulo: 'Novo Agendamento por Colaborador',
        mensagem: `${usuario.nome} agendou um laudo para ${dados.clienteNome} no dia ${dados.data.split('-').reverse().join('/')}.`,
        tipo: 'sucesso'
      }).then();
    }

    await carregarAgendamentos();
    return data.id;
  }, [carregarAgendamentos]);

  const atualizarAgendamento = useCallback(async (id: string, dados: Partial<Agendamento>) => {
    const { error } = await supabase
      .from('agendamentos')
      .update(mapToDB(dados))
      .eq('id', id);

    if (error) throw error;

    // Notificar Admin apenas se for Colaborador E se o despacho for para GCAC
    if (usuario?.role === 'colaborador' && dados.despachante === 'GCAC / Guilherme') {
      enviarNotificacao({
        titulo: 'Agendamento Atualizado',
        mensagem: `${usuario?.nome || 'Um colaborador'} atualizou o agendamento de ${dados.clienteNome || 'um cliente'}.`,
        tipo: 'info'
      }).then();
    }

    await carregarAgendamentos();
  }, [carregarAgendamentos, usuario?.role, enviarNotificacao]);

  const deletarAgendamento = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarAgendamentos();
  }, [carregarAgendamentos]);

  const confirmarAgendamento = useCallback(async (id: string, confirmado: boolean) => {
    const { error } = await supabase
      .from('agendamentos')
      .update({ confirmado })
      .eq('id', id);

    if (error) throw error;
    await carregarAgendamentos();
  }, [carregarAgendamentos]);

  const confirmarAgendamentoColaborador = useCallback(async (id: string, confirmado: boolean) => {
    const { error } = await supabase
      .from('agendamentos')
      .update({ confirmado_instrutor: confirmado })
      .eq('id', id);

    if (error) throw error;
    await carregarAgendamentos();
  }, [carregarAgendamentos]);

  const finalizarLaudo = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'realizado' })
      .eq('id', id);

    if (error) throw error;
    await carregarAgendamentos();
  }, [carregarAgendamentos]);

  const buscarAgendamentoPorCPF = useCallback((cpf: string, tipo?: TipoAgendamento) => {
    return agendamentos.find(a => 
      a.clienteCPF === cpf && (!tipo || a.tipo === tipo)
    );
  }, [agendamentos]);

  return (
    <AgendamentosContext.Provider value={{
      agendamentos,
      estaCarregando,
      criarAgendamento,
      atualizarAgendamento,
      deletarAgendamento,
      confirmarAgendamento,
      confirmarAgendamentoColaborador,
      finalizarLaudo,
      buscarAgendamentoPorCPF
    }}>
      {children}
    </AgendamentosContext.Provider>
  );
}

export function useAgendamentos(): AgendamentosContextType {
  const ctx = useContext(AgendamentosContext);
  if (!ctx) throw new Error('useAgendamentos deve ser usado dentro de AgendamentosProvider');
  return ctx;
}
