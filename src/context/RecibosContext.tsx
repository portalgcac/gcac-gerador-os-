import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Recibo } from '../types';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

interface RecibosContextType {
  recibos: Recibo[];
  criarRecibo: (dados: Omit<Recibo, 'id' | 'numero' | 'criadoEm'>) => Promise<string>;
  deletarRecibo: (id: string) => Promise<void>;
  buscarRecibo: (id: string) => Promise<Recibo | undefined>;
}

const RecibosContext = createContext<RecibosContextType | null>(null);

const mapFromDB = (row: any): Recibo => ({
  id: row.id,
  numero: parseInt(row.numero, 10),
  clienteNome: row.cliente_nome,
  clienteCPF: row.cliente_cpf,
  clienteContato: row.cliente_contato || '',
  servicos: row.servicos || [],
  valorTotal: row.valor_total,
  ordemId: row.ordem_id || undefined,
  formaPagamento: row.forma_pagamento || 'PIX',
  observacoes: row.observacoes || '',
  emitenteNome: row.emitente_nome,
  emitenteCNPJ: row.emitente_cnpj,
  criadoPorNome: row.criado_por_nome || '',
  usuarioId: row.usuario_id || '',
  criadoEm: row.criado_em,
});

const mapToDB = (dados: any) => ({
  cliente_nome: dados.clienteNome.toUpperCase(),
  cliente_cpf: dados.clienteCPF,
  cliente_contato: dados.clienteContato || '',
  servicos: dados.servicos,
  valor_total: dados.valorTotal,
  ordem_id: dados.ordemId || null,
  forma_pagamento: dados.formaPagamento,
  observacoes: dados.observacoes,
  emitente_nome: dados.emitenteNome,
  emitente_cnpj: dados.emitenteCNPJ,
  criado_por_nome: dados.criadoPorNome,
  usuario_id: dados.usuarioId,
});

export function RecibosProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [recibos, setRecibos] = useState<Recibo[]>([]);

  const carregarRecibos = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('recibos')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('numero', { ascending: false });
    
    if (!error && data) {
      setRecibos(data.map(mapFromDB));
    }
  }, [usuario]);

  useEffect(() => {
    carregarRecibos();
  }, [carregarRecibos]);

  const criarRecibo = useCallback(async (
    dados: Omit<Recibo, 'id' | 'numero' | 'criadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const payloadNovo = {
      ...mapToDB(dados),
      criado_por_nome: usuario?.nome || 'Sistema',
      usuario_id: usuario?.id,
      empresa_id: usuario.empresaId
    };

    const { data, error } = await supabase
      .from('recibos')
      .insert([payloadNovo])
      .select()
      .single();

    if (error || !data) throw error || new Error('Falha ao criar recibo');
    
    await carregarRecibos();
    return data.id;
  }, [carregarRecibos, usuario]);

  const deletarRecibo = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('recibos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarRecibos();
  }, [carregarRecibos]);

  const buscarRecibo = useCallback(async (id: string) => {
    if (!usuario?.empresaId) return undefined;
    const { data, error } = await supabase
      .from('recibos')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, [usuario]);

  return (
    <RecibosContext.Provider value={{
      recibos,
      criarRecibo,
      deletarRecibo,
      buscarRecibo,
    }}>
      {children}
    </RecibosContext.Provider>
  );
}

export function useRecibos(): RecibosContextType {
  const ctx = useContext(RecibosContext);
  if (!ctx) throw new Error('useRecibos deve ser usado dentro de RecibosProvider');
  return ctx;
}
