import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: 'Sistemas' | 'Internet' | 'Mensalidades' | 'Insumos' | 'Impostos da PJ' | 'Retirada (Pró-labore)';
  data: string;
  criadoEm: string;
}

interface FinanceiroContextType {
  despesas: Despesa[];
  carregarDespesas: () => Promise<void>;
  criarDespesa: (dados: Omit<Despesa, 'id' | 'criadoEm'>) => Promise<void>;
  deletarDespesa: (id: string) => Promise<void>;
  carregando: boolean;
}

const FinanceiroContext = createContext<FinanceiroContextType | null>(null);

export const CATEGORIAS_DESPESA = [
  'Sistemas',
  'Internet',
  'Mensalidades',
  'Insumos',
  'Impostos da PJ',
  'Retirada (Pró-labore)'
] as const;

export function FinanceiroProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarDespesas = useCallback(async () => {
    if (!usuario?.empresaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .eq('empresa_id', usuario.empresaId)
        .order('data', { ascending: false });

      if (error) throw error;
      if (data) {
        setDespesas(data.map(d => ({
          id: d.id,
          descricao: d.descricao,
          valor: d.valor,
          categoria: d.categoria,
          data: d.data,
          criadoEm: d.criado_em
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    } finally {
      setCarregando(false);
    }
  }, [usuario]);

  const criarDespesa = useCallback(async (dados: Omit<Despesa, 'id' | 'criadoEm'>) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('despesas')
        .insert([{
          descricao: dados.descricao,
          valor: dados.valor,
          categoria: dados.categoria,
          data: dados.data,
          empresa_id: usuario.empresaId
        }]);

      if (error) throw error;
      await carregarDespesas();
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      throw error;
    }
  }, [carregarDespesas, usuario]);

  const deletarDespesa = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('despesas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await carregarDespesas();
    } catch (error) {
      console.error('Erro ao deletar despesa:', error);
      throw error;
    }
  }, [carregarDespesas]);

  useEffect(() => {
    carregarDespesas();
  }, [carregarDespesas]);

  return (
    <FinanceiroContext.Provider value={{
      despesas,
      carregarDespesas,
      criarDespesa,
      deletarDespesa,
      carregando
    }}>
      {children}
    </FinanceiroContext.Provider>
  );
}

export function useFinanceiro() {
  const context = useContext(FinanceiroContext);
  if (!context) throw new Error('useFinanceiro deve ser usado dentro de FinanceiroProvider');
  return context;
}
