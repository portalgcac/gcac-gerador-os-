import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Orcamento, StatusOrcamento } from '../types';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

interface OrcamentosContextType {
  orcamentos: Orcamento[];
  criarOrcamento: (dados: Omit<Orcamento, 'id' | 'numero' | 'criadoEm' | 'atualizadoEm'>) => Promise<string>;
  atualizarOrcamento: (id: string, dados: Partial<Orcamento>) => Promise<void>;
  deletarOrcamento: (id: string) => Promise<void>;
  buscarOrcamento: (id: string) => Promise<Orcamento | undefined>;
}

const OrcamentosContext = createContext<OrcamentosContextType | null>(null);

const mapFromDB = (row: any): Orcamento => ({
  id: row.id,
  numero: parseInt(row.numero, 10),
  nomeCliente: row.nome_cliente,
  contato: row.contato,
  cpf: row.cpf || '',
  senhaGov: row.senha_gov || '',
  servicos: row.servicos || [],
  valorTotal: row.valor_total,
  observacoes: row.observacoes || '',
  status: row.status as StatusOrcamento,
  convertidoOsId: row.convertido_os_id || undefined,
  taxaPFTotal: row.taxa_pf_total || 0,
  filiadoProTiro: row.filiado_pro_tiro || false,
  clubeFiliado: row.clube_filiado || '',
  endereco: row.endereco || '',
  criadoPorNome: row.criado_por_nome || '',
  usuarioId: row.usuario_id || '',
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em,
});

const mapToDB = (dados: any) => {
  const payload: any = {};
  if (dados.nomeCliente !== undefined) payload.nome_cliente = String(dados.nomeCliente).toUpperCase();
  if (dados.contato !== undefined) payload.contato = dados.contato;
  if (dados.cpf !== undefined) payload.cpf = dados.cpf;
  if (dados.senhaGov !== undefined) payload.senha_gov = dados.senhaGov;
  if (dados.servicos !== undefined) payload.servicos = dados.servicos;
  if (dados.valorTotal !== undefined) payload.valor_total = dados.valorTotal;
  if (dados.observacoes !== undefined) payload.observacoes = dados.observacoes;
  if (dados.status !== undefined) payload.status = dados.status;
  if (dados.convertidoOsId !== undefined) payload.convertido_os_id = dados.convertidoOsId;
  // taxa_pf_total calculada dinamicamente no frontend (evita conflito de schema cache)
  if (dados.filiadoProTiro !== undefined) payload.filiado_pro_tiro = dados.filiadoProTiro;
  if (dados.clubeFiliado !== undefined) payload.clube_filiado = dados.clubeFiliado;
  if (dados.endereco !== undefined) payload.endereco = dados.endereco;
  if (dados.criadoPorNome !== undefined) payload.criado_por_nome = dados.criadoPorNome;
  if (dados.usuarioId !== undefined) payload.usuario_id = dados.usuarioId;
  
  return payload;
};

export function OrcamentosProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  const carregarOrcamentos = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('numero', { ascending: false });
    
    if (!error && data) {
      setOrcamentos(data.map(mapFromDB));
    }
  }, [usuario]);

  useEffect(() => {
    carregarOrcamentos();
  }, [carregarOrcamentos]);

  const criarOrcamento = useCallback(async (
    dados: Omit<Orcamento, 'id' | 'numero' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const payloadNovo = {
      ...mapToDB(dados),
      criado_por_nome: usuario?.nome || 'Sistema',
      usuario_id: usuario?.id,
      empresa_id: usuario.empresaId
    };

    const { data, error } = await supabase
      .from('orcamentos')
      .insert([payloadNovo])
      .select()
      .single();

    if (error || !data) throw error || new Error('Falha ao criar orçamento');
    const orcamentoCriado = mapFromDB(data);

    await carregarOrcamentos();

    return orcamentoCriado.id;
  }, [usuario, carregarOrcamentos]);

  const atualizarOrcamento = useCallback(async (id: string, dados: Partial<Orcamento>) => {
    const { error } = await supabase
      .from('orcamentos')
      .update({
        ...mapToDB(dados),
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    await carregarOrcamentos();
  }, [carregarOrcamentos]);

  const deletarOrcamento = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('orcamentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarOrcamentos();
  }, [carregarOrcamentos]);

  const buscarOrcamento = useCallback(async (id: string) => {
    if (!usuario?.empresaId) return undefined;
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, [usuario]);

  return (
    <OrcamentosContext.Provider value={{
      orcamentos,
      criarOrcamento,
      atualizarOrcamento,
      deletarOrcamento,
      buscarOrcamento,
    }}>
      {children}
    </OrcamentosContext.Provider>
  );
}

export function useOrcamentos(): OrcamentosContextType {
  const ctx = useContext(OrcamentosContext);
  if (!ctx) throw new Error('useOrcamentos deve ser usado dentro de OrcamentosProvider');
  return ctx;
}
