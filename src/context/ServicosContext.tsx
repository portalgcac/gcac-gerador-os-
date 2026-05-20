import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { ServicoConfig } from '../types';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

interface ServicosContextType {
  servicos: ServicoConfig[];
  carregando: boolean;
  criarServico: (dados: Omit<ServicoConfig, 'id' | 'criadoEm'>) => Promise<void>;
  atualizarServico: (id: string, dados: Partial<ServicoConfig>) => Promise<void>;
  deletarServico: (id: string) => Promise<void>;
}

const ServicosContext = createContext<ServicosContextType | null>(null);

export function ServicosProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [servicos, setServicos] = useState<ServicoConfig[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarServicos = useCallback(async () => {
    if (!usuario?.empresaId) {
      setCarregando(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('servicos_config')
        .select('*')
        .eq('empresa_id', usuario.empresaId)
        .order('nome', { ascending: true });

      if (error) throw error;
      if (data) {
        setServicos(data.map(row => ({
          id: row.id,
          nome: row.nome,
          valorPadrao: row.valor_padrao,
          valorFiliado: row.valor_filiado,
          taxaPF: row.taxa_pf,
          exigeGRU: row.exige_gru !== false, // Default para true se for null ou undefined no BD legados
          categoria: row.categoria || 'Honorário',
          criadoEm: row.criado_em
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar serviços:', err);
    } finally {
      setCarregando(false);
    }
  }, [usuario]);

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  const criarServico = async (dados: Omit<ServicoConfig, 'id' | 'criadoEm'>) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('servicos_config')
      .insert([{
        nome: dados.nome,
        valor_padrao: dados.valorPadrao,
        valor_filiado: dados.valorFiliado,
        taxa_pf: dados.taxaPF,
        exige_gru: dados.exigeGRU,
        categoria: dados.categoria,
        empresa_id: usuario.empresaId
      }]);

    if (error) throw error;
    await carregarServicos();
  };

  const atualizarServico = async (id: string, dados: Partial<ServicoConfig>) => {
    const payload: any = {};
    if (dados.nome !== undefined) payload.nome = dados.nome;
    if (dados.valorPadrao !== undefined) payload.valor_padrao = dados.valorPadrao;
    if (dados.valorFiliado !== undefined) payload.valor_filiado = dados.valorFiliado;
    if (dados.taxaPF !== undefined) payload.taxa_pf = dados.taxaPF;
    if (dados.exigeGRU !== undefined) payload.exige_gru = dados.exigeGRU;
    if (dados.categoria !== undefined) payload.categoria = dados.categoria;

    const { error } = await supabase
      .from('servicos_config')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    await carregarServicos();
  };

  const deletarServico = async (id: string) => {
    const { error } = await supabase
      .from('servicos_config')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarServicos();
  };

  return (
    <ServicosContext.Provider value={{ servicos, carregando, criarServico, atualizarServico, deletarServico }}>
      {children}
    </ServicosContext.Provider>
  );
}

export function useServicos() {
  const context = useContext(ServicosContext);
  if (!context) throw new Error('useServicos deve ser usado dentro de um ServicosProvider');
  return context;
}
