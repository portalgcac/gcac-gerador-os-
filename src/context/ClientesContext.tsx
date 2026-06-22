import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo, CreditoCliente } from '../types';
import { supabase } from '../db/supabase';
import { uploadBase64File } from '../utils/fileUtils';

import { useAuth } from './AuthContext';

interface ClientesContextType {
  clientes: Cliente[];
  criarCliente: (dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<string>;
  atualizarCliente: (id: string, dados: Partial<Cliente>, overrideEmpresaId?: string) => Promise<void>;
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
  salvarArma: (arma: Partial<Arma> & { clienteId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarArma: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
  // Gestão de GTs
  buscarGts: (armaId: string) => Promise<GuiaTrafego[]>;
  salvarGt: (gt: Partial<GuiaTrafego> & { armaId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarGt: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
  // Gestão de Manejo
  buscarManejos: (clienteId: string) => Promise<AutorizacaoManejo[]>;
  salvarManejo: (manejo: Partial<AutorizacaoManejo> & { clienteId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarManejo: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
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
  email: row.email || '',
  senhaGov: row.senha_gov || '',
  filiadoProTiro: row.filiado_pro_tiro,
  clubeFiliado: row.clube_filiado || '',
  observacoes: row.observacoes || '',
  acordoComercial: row.acordo_comercial || '',
  endereco: row.endereco || '',
  numeroCr: row.numero_cr || '',
  vencimentoCr: row.vencimento_cr || '',
  numeroCrIbama: row.numero_cr_ibama || '',
  vencimentoCrIbama: row.vencimento_cr_ibama || '',
  crEmRenovacao: !!row.cr_em_renovacao,
  crIbamaEmRenovacao: !!row.cr_ibama_em_renovacao,
  fotoUrl: row.foto_url || '',
  crUrl: row.cr_url || '',
  crIbamaUrl: row.cr_ibama_url || '',
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em,
});

const mapToDB = (dados: any) => {
  const payload: any = {};
  if (dados.nome !== undefined) payload.nome = String(dados.nome).toUpperCase();
  if (dados.cpf !== undefined) payload.cpf = dados.cpf;
  if (dados.contato !== undefined) payload.contato = dados.contato;
  if (dados.email !== undefined) payload.email = dados.email;
  if (dados.senhaGov !== undefined) payload.senha_gov = dados.senhaGov;
  if (dados.filiadoProTiro !== undefined) payload.filiado_pro_tiro = dados.filiadoProTiro;
  if (dados.clubeFiliado !== undefined) payload.clube_filiado = dados.clubeFiliado;
  if (dados.observacoes !== undefined) payload.observacoes = dados.observacoes;
  if (dados.acordoComercial !== undefined) payload.acordo_comercial = dados.acordoComercial;
  if (dados.endereco !== undefined) payload.endereco = dados.endereco;
  if (dados.numeroCr !== undefined) payload.numero_cr = dados.numeroCr;
  if (dados.vencimentoCr !== undefined) payload.vencimento_cr = dados.vencimentoCr || null;
  if (dados.numeroCrIbama !== undefined) payload.numero_cr_ibama = dados.numeroCrIbama;
  if (dados.vencimentoCrIbama !== undefined) payload.vencimento_cr_ibama = dados.vencimentoCrIbama || null;
  if (dados.crEmRenovacao !== undefined) payload.cr_em_renovacao = dados.crEmRenovacao;
  if (dados.crIbamaEmRenovacao !== undefined) payload.cr_ibama_em_renovacao = dados.crIbamaEmRenovacao;
  if (dados.fotoUrl !== undefined) payload.foto_url = dados.fotoUrl || null;
  if (dados.crUrl !== undefined) payload.cr_url = dados.crUrl || null;
  if (dados.crIbamaUrl !== undefined) payload.cr_ibama_url = dados.crIbamaUrl || null;
  return payload;
};

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregado, setCarregado] = useState(false);

  const carregarClientes = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('nome', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar clientes no supabase:', error);
      return;
    }
    
    setClientes(data.map(mapFromDB));
    setCarregado(true);
  }, [usuario]);

  const [modelosRegistrados, setModelosRegistrados] = useState<string[]>([]);
  const [calibresRegistrados, setCalibresRegistrados] = useState<string[]>([]);
  const [fabricantesRegistrados, setFabricantesRegistrados] = useState<string[]>([]);

  const carregarMetadadosArmas = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('armas')
      .select('modelo, calibre, fabricante')
      .eq('empresa_id', usuario.empresaId);

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
  }, [usuario]);

  useEffect(() => {
    carregarClientes();
    carregarMetadadosArmas();
  }, [carregarClientes, carregarMetadadosArmas]);

  const criarCliente = useCallback(async (
    dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    
    const clienteId = uuidv4();
    
    let crUrl = dados.crUrl;
    let crIbamaUrl = dados.crIbamaUrl;
    
    if (crUrl && crUrl.startsWith('data:')) {
      const ext = crUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${usuario.empresaId}/clientes/${clienteId}/cr_${uuidv4()}.${ext}`;
      crUrl = await uploadBase64File(crUrl, 'documentos-clientes', path) || '';
    }
    
    if (crIbamaUrl && crIbamaUrl.startsWith('data:')) {
      const ext = crIbamaUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${usuario.empresaId}/clientes/${clienteId}/cr_ibama_${uuidv4()}.${ext}`;
      crIbamaUrl = await uploadBase64File(crIbamaUrl, 'documentos-clientes', path) || '';
    }
    
    const dadosComUrls = {
      ...dados,
      crUrl,
      crIbamaUrl
    };

    const { data, error } = await supabase
      .from('clientes')
      .insert([{ id: clienteId, ...mapToDB(dadosComUrls), empresa_id: usuario.empresaId }])
      .select()
      .single();

    if (error) throw error;
    await carregarClientes();
    return data.id;
  }, [carregarClientes, usuario]);

  const atualizarCliente = useCallback(async (id: string, dados: Partial<Cliente>, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const localEmpresaId = usuario.empresaId;
    const portalEmpresaId = overrideEmpresaId;
    
    let crUrl = dados.crUrl;
    let crIbamaUrl = dados.crIbamaUrl;
    
    if (crUrl && crUrl.startsWith('data:')) {
      const ext = crUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${localEmpresaId}/clientes/${id}/cr_${uuidv4()}.${ext}`;
      crUrl = await uploadBase64File(crUrl, 'documentos-clientes', path) || '';
    }
    
    if (crIbamaUrl && crIbamaUrl.startsWith('data:')) {
      const ext = crIbamaUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${localEmpresaId}/clientes/${id}/cr_ibama_${uuidv4()}.${ext}`;
      crIbamaUrl = await uploadBase64File(crIbamaUrl, 'documentos-clientes', path) || '';
    }
    
    const dadosComUrls = {
      ...dados
    };
    if (crUrl !== undefined) dadosComUrls.crUrl = crUrl;
    if (crIbamaUrl !== undefined) dadosComUrls.crIbamaUrl = crIbamaUrl;

    // Buscar CPF atual do cliente antes de atualizar
    const { data: clienteAtual } = await supabase
      .from('clientes')
      .select('cpf')
      .eq('id', id)
      .single();

    // 1. Atualizar na base local
    const { error } = await supabase
      .from('clientes')
      .update({ ...mapToDB(dadosComUrls), atualizado_em: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // 2. Atualizar na base do portal (se houver vínculo ativo)
    if (portalEmpresaId && portalEmpresaId !== localEmpresaId) {
      const { data: cData } = await supabase
        .from('clientes')
        .select('id')
        .eq('empresa_id', portalEmpresaId)
        .limit(1)
        .maybeSingle();

      if (cData) {
        await supabase
          .from('clientes')
          .update({ ...mapToDB(dadosComUrls), atualizado_em: new Date().toISOString() })
          .eq('id', cData.id);
      }
    }

    // Se encontramos o CPF, atualizar as ordens e orçamentos vinculados a este cliente
    if (clienteAtual?.cpf) {
      const payloadVinculados: any = {};
      if (dados.nome !== undefined) payloadVinculados.nome_cliente = String(dados.nome).toUpperCase();
      if (dados.contato !== undefined) payloadVinculados.contato = dados.contato;
      if (dados.cpf !== undefined) payloadVinculados.cpf = dados.cpf;
      if (dados.senhaGov !== undefined) payloadVinculados.senha_gov = dados.senhaGov;
      if (dados.endereco !== undefined) payloadVinculados.endereco = String(dados.endereco).toUpperCase();
      if (dados.filiadoProTiro !== undefined) payloadVinculados.filiado_pro_tiro = dados.filiadoProTiro;
      if (dados.clubeFiliado !== undefined) payloadVinculados.clube_filiado = dados.clubeFiliado;

      if (Object.keys(payloadVinculados).length > 0) {
        payloadVinculados.atualizado_em = new Date().toISOString();
        
        // Atualiza ordens
        await supabase
          .from('ordens')
          .update(payloadVinculados)
          .eq('cpf', clienteAtual.cpf)
          .eq('empresa_id', localEmpresaId);

        // Atualiza orçamentos
        await supabase
          .from('orcamentos')
          .update(payloadVinculados)
          .eq('cpf', clienteAtual.cpf)
          .eq('empresa_id', localEmpresaId);
      }
    }

    await carregarClientes();
  }, [carregarClientes, usuario]);

  const deletarCliente = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarClientes();
  }, [carregarClientes]);

  const buscarCliente = useCallback(async (id: string) => {
    if (!usuario?.empresaId) return undefined;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresaId)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, [usuario]);

  const buscarClientePorNomeExato = useCallback(async (nome: string) => {
    if (!usuario?.empresaId) return undefined;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .ilike('nome', nome)
      .eq('empresa_id', usuario.empresaId)
      .limit(1)
      .single();

    if (error || !data) return undefined;
    return mapFromDB(data);
  }, [usuario]);

  const clubesRegistrados = React.useMemo(() => {
    const todosClubes = clientes
      .map(c => c.clubeFiliado)
      .filter(c => c && c.trim().length > 0 && c.toUpperCase() !== 'NÃO RELATADO');
    
    return Array.from(new Set(todosClubes.map(c => c.toUpperCase()))).sort();
  }, [clientes]);

  // --- Gestão de Armas ---
  const buscarArmas = useCallback(async (clienteId: string) => {
    if (!usuario?.empresaId) return [];
    const { data, error } = await supabase
      .from('armas')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', usuario.empresaId)
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
      crafUrl: row.craf_url,
      crafEmRenovacao: !!row.craf_em_renovacao,
      criadoEm: row.criado_em
    }));
  }, [usuario]);

  const salvarArma = useCallback(async (dados: Partial<Arma> & { clienteId: string }, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const empresaId = overrideEmpresaId || usuario.empresaId;
    const armaId = dados.id || uuidv4();

    let crafUrl = (dados as any).crafUrl;
    if (crafUrl && crafUrl.startsWith('data:')) {
      const ext = crafUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${empresaId}/clientes/${dados.clienteId}/armas/${armaId}/craf_${uuidv4()}.${ext}`;
      crafUrl = await uploadBase64File(crafUrl, 'documentos-clientes', path) || '';
    }

    const payload = {
      cliente_id: dados.clienteId,
      tipo: dados.tipo,
      modelo: dados.modelo,
      calibre: dados.calibre,
      fabricante: dados.fabricante,
      numero_serie: dados.numeroSerie,
      numero_sigma: dados.numeroSigma,
      acervo: dados.acervo,
      vencimento_craf: dados.vencimentoCraf || null,
      craf_url: crafUrl || null,
      craf_em_renovacao: dados.crafEmRenovacao !== undefined ? dados.crafEmRenovacao : false,
      empresa_id: empresaId
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
        .insert([{ id: armaId, ...payload }]);
      if (error) throw error;
    }
    
    await carregarMetadadosArmas();
  }, [carregarMetadadosArmas, usuario]);

  const deletarArma = useCallback(async (id: string, overrideEmpresaId?: string) => {
    const { error } = await supabase.from('armas').delete().eq('id', id);
    if (error) throw error;
    await carregarMetadadosArmas();
  }, [carregarMetadadosArmas]);

  // --- Gestão de GTs ---
  const buscarGts = useCallback(async (armaId: string) => {
    if (!usuario?.empresaId) return [];
    const { data, error } = await supabase
      .from('guias_trafego')
      .select('*')
      .eq('arma_id', armaId)
      .eq('empresa_id', usuario.empresaId)
      .order('vencimento', { ascending: true });
    
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      armaId: row.arma_id,
      tipo: row.tipo,
      vencimento: row.vencimento,
      destino: row.destino,
      arquivoUrl: row.arquivo_url,
      gtEmRenovacao: !!row.gt_em_renovacao,
      criadoEm: row.criado_em
    }));
  }, [usuario]);

  const salvarGt = useCallback(async (dados: Partial<GuiaTrafego> & { armaId: string }, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const empresaId = overrideEmpresaId || usuario.empresaId;
    const gtId = dados.id || uuidv4();

    let arquivoUrl = (dados as any).arquivoUrl;
    if (arquivoUrl && arquivoUrl.startsWith('data:')) {
      const ext = arquivoUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${empresaId}/armas/${dados.armaId}/gts/${gtId}/gt_${uuidv4()}.${ext}`;
      arquivoUrl = await uploadBase64File(arquivoUrl, 'documentos-clientes', path) || '';
    }

    const payload = {
      arma_id: dados.armaId,
      tipo: dados.tipo,
      vencimento: dados.vencimento,
      destino: dados.destino,
      arquivo_url: arquivoUrl || null,
      gt_em_renovacao: dados.gtEmRenovacao !== undefined ? dados.gtEmRenovacao : false,
      empresa_id: empresaId
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
        .insert([{ id: gtId, ...payload }]);
      if (error) throw error;
    }
  }, [usuario]);

  const deletarGt = useCallback(async (id: string, overrideEmpresaId?: string) => {
    const { error } = await supabase.from('guias_trafego').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // --- Gestão de Manejo ---
  const buscarManejos = useCallback(async (clienteId: string) => {
    if (!usuario?.empresaId) return [];
    const { data, error } = await supabase
      .from('autorizacoes_manejo')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', usuario.empresaId)
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
      arquivoUrl: row.arquivo_url,
      status: row.status || 'Ativo',
      manejoEmRenovacao: !!row.manejo_em_renovacao,
      criadoEm: row.criado_em
    }));
  }, [usuario]);

  const salvarManejo = useCallback(async (dados: Partial<AutorizacaoManejo> & { clienteId: string }, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const empresaId = overrideEmpresaId || usuario.empresaId;
    const manejoId = dados.id || uuidv4();

    let arquivoUrl = (dados as any).arquivoUrl;
    if (arquivoUrl && arquivoUrl.startsWith('data:')) {
      const ext = arquivoUrl.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
      const path = `${empresaId}/clientes/${dados.clienteId}/manejos/${manejoId}/manejo_${uuidv4()}.${ext}`;
      arquivoUrl = await uploadBase64File(arquivoUrl, 'documentos-clientes', path) || '';
    }

    const payload = {
      cliente_id: dados.clienteId,
      numero_car: dados.numeroCar,
      nome_fazenda: dados.nomeFazenda,
      nome_proprietario: dados.nomeProprietario,
      cidade: dados.cidade,
      vencimento: dados.vencimento,
      status: dados.status || 'Ativo',
      arquivo_url: arquivoUrl || null,
      manejo_em_renovacao: dados.manejoEmRenovacao !== undefined ? dados.manejoEmRenovacao : false,
      empresa_id: empresaId
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
        .insert([{ id: manejoId, ...payload }]);
      if (error) throw error;
    }
  }, [usuario]);

  const deletarManejo = useCallback(async (id: string, overrideEmpresaId?: string) => {
    const { error } = await supabase.from('autorizacoes_manejo').delete().eq('id', id);
    if (error) throw error;
  }, []);

  // --- Gestão de Créditos ---
  const buscarCreditos = useCallback(async (clienteId: string) => {
    if (!usuario?.empresaId) return [];
    const { data, error } = await supabase
      .from('creditos_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', usuario.empresaId)
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
  }, [usuario]);

  const adicionarCredito = useCallback(async (dados: Omit<CreditoCliente, 'id' | 'criadoEm'>) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('creditos_cliente')
      .insert([{
        cliente_id: dados.clienteId,
        tipo: dados.tipo,
        valor: dados.valor,
        descricao: dados.descricao,
        origem_id: dados.origemId || null,
        criado_por_nome: dados.criadoPorNome || null,
        empresa_id: usuario.empresaId
      }]);
    if (error) throw error;
  }, [usuario]);

  const deletarCredito = useCallback(async (id: string) => {
    const { error } = await supabase.from('creditos_cliente').delete().eq('id', id);
    if (error) throw error;
  }, []);

  useEffect(() => {
    if (usuario?.tipoConta === 'cac_individual' && usuario?.empresaId && carregado) {
      if (clientes.length === 0) {
        const autoCreate = async () => {
          try {
            // Consulta direta no banco de dados para evitar qualquer race condition local
            const { data, error } = await supabase
              .from('clientes')
              .select('id')
              .eq('empresa_id', usuario.empresaId)
              .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) {
              await criarCliente({
                nome: usuario.nome.toUpperCase(),
                cpf: usuario.cpf || '',
                contato: usuario.contato || '',
                email: usuario.email || '',
                senhaGov: '',
                filiadoProTiro: false,
                clubeFiliado: '',
                observacoes: 'CLIENTE AUTOMÁTICO (PERFIL INDIVIDUAL CAC)',
                endereco: '',
                numeroCr: '',
                vencimentoCr: '',
                numeroCrIbama: '',
                vencimentoCrIbama: '',
              });
            } else {
              // Se já existe no banco mas não na lista local por delay, recarrega
              await carregarClientes();
            }
          } catch (e) {
            console.error('Erro ao criar cliente individual automático:', e);
          }
        };
        autoCreate();
      }
    }
  }, [clientes, usuario, criarCliente, carregado, carregarClientes]);

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
