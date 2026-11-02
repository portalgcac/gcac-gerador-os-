import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

export type CategoriaDespesa =
  | 'Pagamento Colaboradores (NF)'
  | 'Sistemas'
  | 'Internet'
  | 'Mensalidades'
  | 'Insumos'
  | 'Impostos da PJ'
  | 'Retirada (Pró-labore)';

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: CategoriaDespesa;
  data: string;
  notaFiscalUrl?: string;
  numeroNf?: string;
  colaboradorNome?: string;
  criadoEm: string;
}

interface FinanceiroContextType {
  despesas: Despesa[];
  carregarDespesas: () => Promise<void>;
  criarDespesa: (dados: Omit<Despesa, 'id' | 'criadoEm'>) => Promise<string | undefined>;
  deletarDespesa: (id: string) => Promise<void>;
  carregando: boolean;
}

const FinanceiroContext = createContext<FinanceiroContextType | null>(null);

export const CATEGORIAS_DESPESA: readonly CategoriaDespesa[] = [
  'Pagamento Colaboradores (NF)',
  'Sistemas',
  'Internet',
  'Mensalidades',
  'Insumos',
  'Impostos da PJ',
  'Retirada (Pró-labore)'
] as const;

const STORAGE_META_NF_DESPESAS = (empresaId: string) => `gcac_despesas_nf_meta_${empresaId}`;

interface MetaNfDespesa {
  notaFiscalUrl?: string;
  numeroNf?: string;
  colaboradorNome?: string;
}

function obterMapaMetaNfLocal(empresaId?: string): Record<string, MetaNfDespesa> {
  if (!empresaId) return {};
  try {
    const raw = localStorage.getItem(STORAGE_META_NF_DESPESAS(empresaId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function salvarMetaNfLocal(empresaId: string, despesaId: string, meta: MetaNfDespesa) {
  try {
    const atual = obterMapaMetaNfLocal(empresaId);
    atual[despesaId] = meta;
    localStorage.setItem(STORAGE_META_NF_DESPESAS(empresaId), JSON.stringify(atual));
  } catch { /* ignore */ }
}

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
        const metaLocal = obterMapaMetaNfLocal(usuario.empresaId);
        setDespesas(data.map(d => {
          const extra = metaLocal[d.id] || {};
          return {
            id: d.id,
            descricao: d.descricao,
            valor: Number(d.valor) || 0,
            categoria: d.categoria,
            data: d.data,
            notaFiscalUrl: d.nota_fiscal_url || extra.notaFiscalUrl || undefined,
            numeroNf: d.numero_nf || extra.numeroNf || undefined,
            colaboradorNome: d.colaborador_nome || extra.colaboradorNome || undefined,
            criadoEm: d.criado_em
          };
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    } finally {
      setCarregando(false);
    }
  }, [usuario]);

  const criarDespesa = useCallback(async (dados: Omit<Despesa, 'id' | 'criadoEm'>): Promise<string | undefined> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    try {
      let idCriado: string | undefined;

      // Tenta inserir já com as colunas de Nota Fiscal
      const { data, error } = await supabase
        .from('despesas')
        .insert([{
          descricao: dados.descricao,
          valor: dados.valor,
          categoria: dados.categoria,
          data: dados.data,
          nota_fiscal_url: dados.notaFiscalUrl || null,
          numero_nf: dados.numeroNf || null,
          colaborador_nome: dados.colaboradorNome || null,
          empresa_id: usuario.empresaId
        }])
        .select('id')
        .single();

      if (error) {
        // Fallback se as colunas nota_fiscal_url/numero_nf ainda não existirem no banco
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('despesas')
          .insert([{
            descricao: dados.descricao,
            valor: dados.valor,
            categoria: dados.categoria,
            data: dados.data,
            empresa_id: usuario.empresaId
          }])
          .select('id')
          .single();

        if (fallbackError) throw fallbackError;
        idCriado = fallbackData?.id;
      } else {
        idCriado = data?.id;
      }

      if (idCriado && (dados.notaFiscalUrl || dados.numeroNf || dados.colaboradorNome)) {
        salvarMetaNfLocal(usuario.empresaId, idCriado, {
          notaFiscalUrl: dados.notaFiscalUrl,
          numeroNf: dados.numeroNf,
          colaboradorNome: dados.colaboradorNome
        });
      }

      await carregarDespesas();
      return idCriado;
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
