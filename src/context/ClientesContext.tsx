import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo, CreditoCliente } from '../types';
import { supabase } from '../db/supabase';

interface ClientesContextType {
  clientes: Cliente[];
  criarCliente: (dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<string>;
  atualizarCliente: (id: string, dados: Partial<Cliente>) => Promise<void>;
  deletarCliente: (id: string) => Promise<void>;
  buscarCliente: (id: string) => Promise<Cliente | undefined>;
  buscarClientePorNomeExato: (nome: string) => Promise<Cliente | undefined>;
  clubesRegistrados: string[];
  
  // Metadados de Armas (Listas Dinâmicas)
  modelosRegistrados: string[];
  calibresRegistrados: string[];
  fabricantesRegistrados: string[];
  
  // Gestão de Armas
  buscarArmas: (clienteId: string) => Promise<Arma[]>;
  salvarArma: (arma: Partial<Arma> & { clienteId: string }) => Promise<void>;
  deletarArma: (id: string) => Promise<void>;
  
  // Gestão de GTs
  buscarGts: (armaId: string) => Promise<GuiaTrafego[]>;
  salvarGt: (gt: Partial<GuiaTrafego> & { armaId: string }) => Promise<void>;
  deletarGt: (id: string) => Promise<void>;
  
  // Gestão de Manejo
  buscarManejos: (clienteId: string) => Promise<AutorizacaoManejo[]>;
  salvarManejo: (manejo: Partial<AutorizacaoManejo> & { clienteId: string }) => Promise<void>;
  deletarManejo: (id: string) => Promise<void>;
  
  // Gestão de Créditos
  buscarCreditos: (clienteId: string) => Promise<CreditoCliente[]>;
  adicionarCredito: (credito: Omit<CreditoCliente, 'id' | 'criadoEm'>) => Promise<void>;
  deletarCredito: (id: string) => Promise<void>;
}

const ClientesContext = createContext<ClientesContextType | null>(null);

const mapFromDB = (row: any): Cliente => ({
  id: row.id,
  nome: row.nome,
  cpf: row.cpf,
  contato: row.contato,
  senhaGov: row.senha_gov || '',
  filiadoProTiro: row.filiado_pro_tiro,
  clubeFiliado: row.clube_filiado || '',
  observacoes: row.observacoes || '',
  endereco: row.endereco || '',
  numeroCr: row.numero_cr || '',
  vencimentoCr: row.vencimento_cr || '',
  numeroCrIbama: row.numero_cr_ibama || '',
  vencimentoCrIbama: row.vencimento_cr_ibama || '',
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em,
});

const mapToDB = (dados: any) => {
  const payload: any = {};
  if (dados.nome !== undefined) payload.nome = String(dados.nome).toUpperCase();
  if (dados.cpf !== undefined) payload.cpf = dados.cpf;
  if (dados.contato !== undefined) payload.contato = dados.contato;
  if (dados.senhaGov !== undefined) payload.senha_gov = dados.senhaGov;
  if (dados.filiadoProTiro !== undefined) payload.filiado_pro_tiro = dados.filiadoProTiro;
  if (dados.clubeFiliado !== undefined) payload.clube_filiado = dados.clubeFiliado;
  if (dados.observacoes !== undefined) payload.observacoes = dados.observacoes;
  if (dados.endereco !== undefined) payload.endereco = dados.endereco;
  if (dados.numeroCr !== undefined) payload.numero_cr = dados.numeroCr;
  if (dados.vencimentoCr !== undefined) payload.vencimento_cr = dados.vencimentoCr || null;
  if (dados.numeroCrIbama !== undefined) payload.numero_cr_ibama = dados.numeroCrIbama;
  if (dados.vencimentoCrIbama !== undefined) payload.vencimento_cr_ibama = dados.vencimentoCrIbama || null;
  return payload;
};

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const carregarClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar clientes no supabase:', error);
      return;
    }
    
    
    setClientes(data.map(mapFromDB));
  }, []);

  const [modelosRegistrados, setModelosRegistrados] = useState<string[]>([]);
  const [calibresRegistrados, setCalibresRegistrados] = useState<string[]>([]);
  const [fabricantesRegistrados, setFabricantesRegistrados] = useState<string[]>([]);

  const carregarMetadadosArmas = useCallback(async () => {
    const { data, error } = await supabase
      .from('armas')
      .select('modelo, calibre, fabricante');

    if (error) {
      console.error('Erro ao buscar metadados de armas:', error);
      return;
    }

    if (data) {
      const modelos = new Set<string>();
      const calibres = new Set<string>();
      const fabricantes = new Set<string>();

      data.forEach(arma => {
        if (arma.modelo && arma.modelo.trim() !== '') modelos.add(arma.modelo.trim().toUpperCase());
        if (arma.calibre && arma.calibre.trim() !== '') calibres.add(arma.calibre.trim().toUpperCase());
        if (arma.fabricante && arma.fabricante.trim() !== '') fabricantes.add(arma.fabricante.trim().toUpperCase());
      });

      setModelosRegistrados(Array.from(modelos).sort());
      setCalibresRegistrados(Array.from(calibres).sort());
      setFabricantesRegistrados(Array.from(fabricantes).sort());
    }
  }, []);

  useEffect(() => {
    carregarClientes();
    carregarMetadadosArmas();
  }, [carregarClientes, carregarMetadadosArmas]);

  const criarCliente = useCallback(async (
    dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<string> => {
    const { data, error } = await supabase
      .from('clientes')
      .insert([mapToDB(dados)])
      .select()
      .single();

    if (error) throw error;
    await carregarClientes();
    return data.id;
  }, [carregarClientes]);

  const atualizarCliente = useCallback(async (id: string, dados: Partial<Cliente>) => {
    const { error } = await supabase
      .from('clientes')
      .update({ ...mapToDB(dados), atualizado_em: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    await carregarClientes();
  }, [carregarClientes]);

  const deletarCliente = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarClientes();
  }, [carregarClientes]);

  const buscarCliente = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, []);

  const buscarClientePorNomeExato = useCallback(async (nome: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .ilike('nome', nome)
      .limit(1)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, []);

  const clubesRegistrados = React.useMemo(() => {
    const todosClubes = clientes
      .map(c => c.clubeFiliado)
      .filter(c => c && c.trim().length > 0 && c.toUpperCase() !== 'NÃO RELATADO');
    
    return Array.from(new Set(todosClubes.map(c => c.toUpperCase()))).sort();
  }, [clientes]);

  // --- Gestão de Armas ---
  const buscarArmas = useCallback(async (clienteId: string) => {
    const { data, error } = await supabase
      .from('armas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('modelo', { ascending: true });
    
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      clienteId: row.cliente_id,
      tipo: row.tipo || '',
      modelo: row.modelo,
      calibre: row.calibre,
      fabricante: row.fabricante,
      numeroSerie: row.numero_serie,
      numeroSigma: row.numero_sigma,
      acervo: row.acervo,
      vencimentoCraf: row.vencimento_craf,
      criadoEm: row.criado_em
    }));
  }, []);

  const salvarArma = useCallback(async (dados: Partial<Arma> & { clienteId: string }) => {
    const payload = {
      cliente_id: dados.clienteId,
      tipo: dados.tipo,
      modelo: dados.modelo,
      calibre: dados.calibre,
      fabricante: dados.fabricante,
      numero_serie: dados.numeroSerie,
      numero_sigma: dados.numeroSigma,
      acervo: dados.acervo,
      vencimento_craf: dados.vencimentoCraf || null
    };

    if (dados.id) {
      const { error } = await supabase
        .from('armas')
        .update(payload)
        .eq('id', dados.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('armas')
        .insert([payload]);
      if (error) throw error;
    }
    
    await carregarMetadadosArmas();
  }, [carregarMetadadosArmas]);

  const deletarArma = useCallback(async (id: string) => {
    const { error } = await supabase.from('armas').delete().eq('id', id);
    if (error) throw error;
    await carregarMetadadosArmas();
  }, [carregarMetadadosArmas]);

  // --- Gestão de GTs ---
  const buscarGts = useCallback(async (armaId: string) => {
    const { data, error } = await supabase
      .from('guias_trafego')
      .select('*')
      .eq('arma_id', armaId)
      .order('vencimento', { ascending: true });
    
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      armaId: row.arma_id,
      tipo: row.tipo,
      vencimento: row.vencimento,
      destino: row.destino,
      criadoEm: row.criado_em
    }));
  }, []);

  const salvarGt = useCallback(async (dados: Partial<GuiaTrafego> & { armaId: string }) => {
    const payload = {
      arma_id: dados.armaId,
      tipo: dados.tipo,
      vencimento: dados.vencimento,
      destino: dados.destino
    };

    if (dados.id) {
      const { error } = await supabase
        .from('guias_trafego')
        .update(payload)
        .eq('id', dados.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('guias_trafego')
        .insert([payload]);
      if (error) throw error;
    }
  }, []);

  const deletarGt = useCallback(async (id: string) => {
    const { error } = await supabase.from('guias_trafego').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // --- Gestão de Manejo ---
  const buscarManejos = useCallback(async (clienteId: string) => {
    const { data, error } = await supabase
      .from('autorizacoes_manejo')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('vencimento', { ascending: true });
    
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      clienteId: row.cliente_id,
      numeroCar: row.numero_car,
      nomeFazenda: row.nome_fazenda,
      nomeProprietario: row.nome_proprietario,
      cidade: row.cidade,
      vencimento: row.vencimento,
      criadoEm: row.criado_em
    }));
  }, []);

  const salvarManejo = useCallback(async (dados: Partial<AutorizacaoManejo> & { clienteId: string }) => {
    const payload = {
      cliente_id: dados.clienteId,
      numero_car: dados.numeroCar,
      nome_fazenda: dados.nomeFazenda,
      nome_proprietario: dados.nomeProprietario,
      cidade: dados.cidade,
      vencimento: dados.vencimento
    };

    if (dados.id) {
      const { error } = await supabase
        .from('autorizacoes_manejo')
        .update(payload)
        .eq('id', dados.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('autorizacoes_manejo')
        .insert([payload]);
      if (error) throw error;
    }
  }, []);

  const deletarManejo = useCallback(async (id: string) => {
    const { error } = await supabase.from('autorizacoes_manejo').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // --- Gestão de Créditos ---
  const buscarCreditos = useCallback(async (clienteId: string) => {
    const { data, error } = await supabase
      .from('creditos_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false });
    
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      clienteId: row.cliente_id,
      tipo: row.tipo,
      valor: Number(row.valor),
      descricao: row.descricao,
      origemId: row.origem_id,
      criadoPorNome: row.criado_por_nome,
      criadoEm: row.criado_em
    }));
  }, []);

  const adicionarCredito = useCallback(async (dados: Omit<CreditoCliente, 'id' | 'criadoEm'>) => {
    const { error } = await supabase
      .from('creditos_cliente')
      .insert([{
        cliente_id: dados.clienteId,
        tipo: dados.tipo,
        valor: dados.valor,
        descricao: dados.descricao,
        origem_id: dados.origemId || null,
        criado_por_nome: dados.criadoPorNome || null
      }]);
    if (error) throw error;
  }, []);

  const deletarCredito = useCallback(async (id: string) => {
    const { error } = await supabase.from('creditos_cliente').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return (
    <ClientesContext.Provider value={{
      clientes,
      criarCliente,
      atualizarCliente,
      deletarCliente,
      buscarCliente,
      buscarClientePorNomeExato,
      clubesRegistrados,
      modelosRegistrados,
      calibresRegistrados,
      fabricantesRegistrados,
      buscarArmas,
      salvarArma,
      deletarArma,
      buscarGts,
      salvarGt,
      deletarGt,
      buscarManejos,
      salvarManejo,
      deletarManejo,
      buscarCreditos,
      adicionarCredito,
      deletarCredito
    }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes(): ClientesContextType {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error('useClientes deve ser usado dentro de ClientesProvider');
  return ctx;
}
