import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { ArmaVenda, StatusArmaVenda } from '../types';
import { supabase } from '../db/supabase';
import { useAuth } from './AuthContext';

interface ArmasVendaContextType {
  armasVenda: ArmaVenda[];
  carregando: boolean;
  erro: string | null;
  carregarArmasVenda: () => Promise<void>;
  criarArmaVenda: (dados: Omit<ArmaVenda, 'id' | 'empresaId' | 'criadoEm' | 'atualizadoEm'>) => Promise<string>;
  atualizarArmaVenda: (id: string, dados: Partial<ArmaVenda>) => Promise<void>;
  deletarArmaVenda: (id: string) => Promise<void>;
  alterarStatus: (id: string, novoStatus: StatusArmaVenda, dadosVenda?: { compradorNome?: string; compradorTelefone?: string; compradorCpf?: string; ordemServicoId?: string }) => Promise<void>;
}

const ArmasVendaContext = createContext<ArmasVendaContextType | null>(null);

const mapFromDB = (row: any): ArmaVenda => ({
  id: row.id,
  empresaId: row.empresa_id,
  clienteId: row.cliente_id || undefined,
  proprietarioNome: row.proprietario_nome,
  proprietarioTelefone: row.proprietario_telefone || '',
  proprietarioCpf: row.proprietario_cpf || '',
  proprietarioCr: row.proprietario_cr || '',
  tipo: row.tipo,
  fabricante: row.fabricante,
  modelo: row.modelo,
  calibre: row.calibre,
  numeroSerie: row.numero_serie || '',
  sigmaSinarm: row.sigma_sinarm || 'SIGMA',
  numeroCraf: row.numero_craf || '',
  crafValidade: row.craf_validade || '',
  capacidade: row.capacidade || '',
  acabamento: row.acabamento || '',
  comprimentoCano: row.comprimento_cano || '',
  estadoConservacao: row.estado_conservacao || 'Excelente / Pouco Uso',
  quantidadeCarregadores: row.quantidade_carregadores ?? 1,
  acessorios: row.acessorios || '',
  localArma: row.local_arma || 'proprietario',
  fotos: Array.isArray(row.fotos) ? row.fotos : [],
  fotoPrincipal: row.foto_principal || (Array.isArray(row.fotos) && row.fotos.length > 0 ? row.fotos[0] : ''),
  valorCliente: Number(row.valor_cliente) || 0,
  comissaoTipo: row.comissao_tipo || 'percentual',
  comissaoValor: Number(row.comissao_valor) || 10,
  valorAnunciado: Number(row.valor_anunciado) || 0,
  lucroEstimado: Number(row.lucro_estimado) || 0,
  status: row.status || 'disponivel',
  observacoesInternas: row.observacoes_internas || '',
  anuncioTitulo: row.anuncio_titulo || '',
  anuncioDescricao: row.anuncio_descricao || '',
  compradorNome: row.comprador_nome || '',
  compradorTelefone: row.comprador_telefone || '',
  compradorCpf: row.comprador_cpf || '',
  dataVenda: row.data_venda || '',
  ordemServicoId: row.ordem_servico_id || undefined,
  criadoPorNome: row.criado_por_nome || '',
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em,
});

const mapToDB = (dados: Partial<ArmaVenda>) => {
  const payload: any = {};
  if (dados.clienteId !== undefined) payload.cliente_id = dados.clienteId || null;
  if (dados.proprietarioNome !== undefined) payload.proprietario_nome = dados.proprietarioNome.toUpperCase();
  if (dados.proprietarioTelefone !== undefined) payload.proprietario_telefone = dados.proprietarioTelefone;
  if (dados.proprietarioCpf !== undefined) payload.proprietario_cpf = dados.proprietarioCpf;
  if (dados.proprietarioCr !== undefined) payload.proprietario_cr = dados.proprietarioCr;
  if (dados.tipo !== undefined) payload.tipo = dados.tipo.toUpperCase();
  if (dados.fabricante !== undefined) payload.fabricante = dados.fabricante.toUpperCase();
  if (dados.modelo !== undefined) payload.modelo = dados.modelo.toUpperCase();
  if (dados.calibre !== undefined) payload.calibre = dados.calibre.toUpperCase();
  if (dados.numeroSerie !== undefined) payload.numero_serie = dados.numeroSerie;
  if (dados.sigmaSinarm !== undefined) payload.sigma_sinarm = dados.sigmaSinarm;
  if (dados.numeroCraf !== undefined) payload.numero_craf = dados.numeroCraf;
  if (dados.crafValidade !== undefined) payload.craf_validade = dados.crafValidade || null;
  if (dados.capacidade !== undefined) payload.capacidade = dados.capacidade;
  if (dados.acabamento !== undefined) payload.acabamento = dados.acabamento;
  if (dados.comprimentoCano !== undefined) payload.comprimento_cano = dados.comprimentoCano;
  if (dados.estadoConservacao !== undefined) payload.estado_conservacao = dados.estadoConservacao;
  if (dados.quantidadeCarregadores !== undefined) payload.quantidade_carregadores = dados.quantidadeCarregadores;
  if (dados.acessorios !== undefined) payload.acessorios = dados.acessorios;
  if (dados.localArma !== undefined) payload.local_arma = dados.localArma;
  if (dados.fotos !== undefined) payload.fotos = dados.fotos;
  if (dados.fotoPrincipal !== undefined) payload.foto_principal = dados.fotoPrincipal;
  if (dados.valorCliente !== undefined) payload.valor_cliente = dados.valorCliente;
  if (dados.comissaoTipo !== undefined) payload.comissao_tipo = dados.comissaoTipo;
  if (dados.comissaoValor !== undefined) payload.comissao_valor = dados.comissaoValor;
  if (dados.valorAnunciado !== undefined) payload.valor_anunciado = dados.valorAnunciado;
  if (dados.lucroEstimado !== undefined) payload.lucro_estimado = dados.lucroEstimado;
  if (dados.status !== undefined) payload.status = dados.status;
  if (dados.observacoesInternas !== undefined) payload.observacoes_internas = dados.observacoesInternas;
  if (dados.anuncioTitulo !== undefined) payload.anuncio_titulo = dados.anuncioTitulo;
  if (dados.anuncioDescricao !== undefined) payload.anuncio_descricao = dados.anuncioDescricao;
  if (dados.compradorNome !== undefined) payload.comprador_nome = dados.compradorNome;
  if (dados.compradorTelefone !== undefined) payload.comprador_telefone = dados.compradorTelefone;
  if (dados.compradorCpf !== undefined) payload.comprador_cpf = dados.compradorCpf;
  if (dados.dataVenda !== undefined) payload.data_venda = dados.dataVenda || null;
  if (dados.ordemServicoId !== undefined) payload.ordem_servico_id = dados.ordemServicoId || null;
  if (dados.criadoPorNome !== undefined) payload.criado_por_nome = dados.criadoPorNome;
  payload.atualizado_em = new Date().toISOString();
  return payload;
};

export function ArmasVendaProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [armasVenda, setArmasVenda] = useState<ArmaVenda[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarArmasVenda = useCallback(async () => {
    if (!usuario?.empresaId) {
      setArmasVenda([]);
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('armas_venda')
        .select('*')
        .eq('empresa_id', usuario.empresaId)
        .order('criado_em', { ascending: false });

      if (error) {
        // Se a tabela ainda não tiver sido criada no Supabase pelo usuário, captura amigavelmente
        if (error.code === '42P01') {
          console.warn('Tabela armas_venda ainda não criada no banco.');
          setArmasVenda([]);
          return;
        }
        throw error;
      }

      if (data) {
        setArmasVenda(data.map(mapFromDB));
      }
    } catch (e: any) {
      console.error('Erro ao carregar armas à venda:', e);
      setErro(e.message || 'Erro ao carregar catálogo de armas');
    } finally {
      setCarregando(false);
    }
  }, [usuario?.empresaId]);

  useEffect(() => {
    carregarArmasVenda();
  }, [carregarArmasVenda]);

  // Inscrição Realtime para atualizações imediatas entre operadores
  useEffect(() => {
    if (!usuario?.empresaId) return;

    const channel = supabase
      .channel('realtime:armas_venda')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'armas_venda',
          filter: `empresa_id=eq.${usuario.empresaId}`,
        },
        () => {
          carregarArmasVenda();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario?.empresaId, carregarArmasVenda]);

  const criarArmaVenda = useCallback(async (
    dados: Omit<ArmaVenda, 'id' | 'empresaId' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');

    const dbPayload = {
      ...mapToDB(dados),
      empresa_id: usuario.empresaId,
      criado_por_nome: usuario.nome || 'Operador',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('armas_venda')
      .insert([dbPayload])
      .select('id')
      .single();

    if (error) throw error;
    await carregarArmasVenda();
    return data.id;
  }, [usuario, carregarArmasVenda]);

  const atualizarArmaVenda = useCallback(async (id: string, dados: Partial<ArmaVenda>) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');

    const dbPayload = mapToDB(dados);

    const { error } = await supabase
      .from('armas_venda')
      .update(dbPayload)
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId);

    if (error) throw error;
    await carregarArmasVenda();
  }, [usuario?.empresaId, carregarArmasVenda]);

  const deletarArmaVenda = useCallback(async (id: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('armas_venda')
      .delete()
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId);

    if (error) throw error;
    setArmasVenda(prev => prev.filter(a => a.id !== id));
  }, [usuario?.empresaId]);

  const alterarStatus = useCallback(async (
    id: string,
    novoStatus: StatusArmaVenda,
    dadosVenda?: { compradorNome?: string; compradorTelefone?: string; compradorCpf?: string; ordemServicoId?: string }
  ) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');

    const payload: Partial<ArmaVenda> = { status: novoStatus };
    if (novoStatus === 'vendida') {
      payload.dataVenda = new Date().toISOString();
      if (dadosVenda?.compradorNome) payload.compradorNome = dadosVenda.compradorNome;
      if (dadosVenda?.compradorTelefone) payload.compradorTelefone = dadosVenda.compradorTelefone;
      if (dadosVenda?.compradorCpf) payload.compradorCpf = dadosVenda.compradorCpf;
      if (dadosVenda?.ordemServicoId) payload.ordemServicoId = dadosVenda.ordemServicoId;
    }

    await atualizarArmaVenda(id, payload);
  }, [usuario?.empresaId, atualizarArmaVenda]);

  return (
    <ArmasVendaContext.Provider
      value={{
        armasVenda,
        carregando,
        erro,
        carregarArmasVenda,
        criarArmaVenda,
        atualizarArmaVenda,
        deletarArmaVenda,
        alterarStatus,
      }}
    >
      {children}
    </ArmasVendaContext.Provider>
  );
}

export function useArmasVenda() {
  const context = useContext(ArmasVendaContext);
  if (!context) {
    throw new Error('useArmasVenda deve ser usado dentro de um ArmasVendaProvider');
  }
  return context;
}
