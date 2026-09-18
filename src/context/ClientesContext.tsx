import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo, CreditoCliente, ModeloDeclaracao, OpcaoArma, ItemCatalogoArma } from '../types';
import { supabase } from '../db/supabase';
import { uploadBase64File } from '../utils/fileUtils';
import { normalizarCalibre, normalizarModelo, normalizarFabricante } from '../utils/formatters';
import { CATALOGO_BASE_ARMAS, normalizarTipoArma } from '../data/catalogoArmas';

import { useAuth } from './AuthContext';

// Padrões de Armas para Importação / Inicialização
export const CALIBRES_BASE = [
  '.22 LR', '.22 WMR', '.223 REM / 5.56 NATO', '.30-06 SPRG', '.308 WIN / 7.62 NATO', 
  '.357 MAG', '.38 SPL', '.380 ACP', '9mm LUGER', '.40 S&W', '.44 MAG', 
  '.45 ACP', '.454 CASULL', '12 GA', '20 GA', '28 GA', '36 GA'
];
export const FABRICANTES_BASE = [
  'BENELLI', 'BERETTA', 'BOITO', 'BROWNING', 'CANIK', 'CBC', 'COLT', 'CZ', 
  'GLOCK', 'IMBEL', 'REMINGTON', 'ROSSI', 'RUGER', 'SIG SAUER', 
  'SMITH & WESSON', 'SPRINGFIELD ARMORY', 'STOEGER', 'TANFOGLIO', 
  'TAURUS', 'WALTHER', 'WINCHESTER'
];
export const MODELOS_BASE = [
  // Taurus
  'G2C', 'G3', 'G3C', 'G3 TORO', 'GX4', 'TH9', 'TH380', 'TH40', 'TS9',
  'PT 92', 'PT 100', 'PT 838', 'PT 1911', 'RT 85', 'RT 88', 'RT 856', 'RT 608', 'RT 817', 'T4', 'CTT40',
  // Glock
  'G17', 'G19', 'G19X', 'G20', 'G21', 'G22', 'G25', 'G43', 'G43X', 'G44', 'G45',
  // Outros Nacionais
  'MD1', 'MD2', 'MD6', 'MD7', 'M1911 A1', 'PUMP MILITARY 3.0', '7022', '8122', 'PUMP', 'ERA 2001', 'MIURA I', 'MIURA II', 'PUMA', 'RT 718',
  // Internacionais Populares
  'APX', '92FS', 'M9', 'P-10 C', 'P-10 F', 'CZ 75', 'SHADOW 2', 'TS 2', 'SCORPION',
  'P320', 'P365', 'M17', 'M18', 'P226', 'M&P 9', 'M&P 15', 'SHIELD', 'MODEL 686',
  'TP9', 'TP9SF', 'TP9 ELITE', 'RIVAL', '1911', 'M4', 'PYTHON', 'HELLCAT', 'XD', 'M1A',
  'PPQ', 'PDP', 'P22', '10/22', 'MARK IV', 'LCP', 'SECURITY-9', '870', '700', 'STR-9', 'M3000',
  'SUPERNOVA', 'STOCK II', 'STOCK III', 'DEFORCE', 'HI-POWER', 'BUCK MARK', 'SXP', 'MODEL 70'
];


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

  // Inteligência de Armas e Seleção em Cascata (Self-Learning)
  catalogoArmas: ItemCatalogoArma[];
  obterTiposDeArma: () => string[];
  obterFabricantesPorTipo: (tipo?: string) => string[];
  obterModelosPorTipoEFabricante: (tipo?: string, fabricante?: string) => string[];
  obterCalibreSugerido: (tipo?: string, fabricante?: string, modelo?: string) => string | undefined;
  aprenderItemArma: (tipo: string, fabricante: string, modelo: string, calibre?: string) => Promise<void>;
  
  // Opções Cadastradas (Modo Trancado)
  opcoesArmas: OpcaoArma[];
  carregandoOpcoes: boolean;
  inicializarOpcoesArmasPadrao: () => Promise<void>;
  criarOpcaoArma: (tipo: 'modelo' | 'calibre' | 'fabricante' | 'clube', nome: string) => Promise<void>;
  atualizarOpcaoArma: (id: string, novoNome: string) => Promise<void>;
  deletarOpcaoArma: (id: string) => Promise<void>;
  
  // Gestão de Armas
  buscarArmas: (clienteId: string, overrideEmpresaId?: string) => Promise<Arma[]>;
  salvarArma: (arma: Partial<Arma> & { clienteId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarArma: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
  // Gestão de GTs
  buscarGts: (armaId: string, overrideEmpresaId?: string) => Promise<GuiaTrafego[]>;
  salvarGt: (gt: Partial<GuiaTrafego> & { armaId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarGt: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
  // Gestão de Manejo
  buscarManejos: (clienteId: string, overrideEmpresaId?: string) => Promise<AutorizacaoManejo[]>;
  salvarManejo: (manejo: Partial<AutorizacaoManejo> & { clienteId: string }, overrideEmpresaId?: string) => Promise<void>;
  deletarManejo: (id: string, overrideEmpresaId?: string) => Promise<void>;
  
  // Gestão de Créditos
  buscarCreditos: (clienteId: string) => Promise<CreditoCliente[]>;
  adicionarCredito: (credito: Omit<CreditoCliente, 'id' | 'criadoEm'>) => Promise<void>;
  deletarCredito: (id: string) => Promise<void>;

  // Gestão de Modelos de Declaração
  buscarModelosDeclaracao: () => Promise<ModeloDeclaracao[]>;
  salvarModeloDeclaracao: (modelo: Partial<ModeloDeclaracao>) => Promise<void>;
  deletarModeloDeclaracao: (id: string) => Promise<void>;
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
  rg: row.rg || '',
  dataNascimento: row.data_nascimento || '',
  nomePai: row.nome_pai || '',
  nomeMae: row.nome_mae || '',
  crTiroDesportivo: !!row.cr_tiro_desportivo,
  crCaca: !!row.cr_caca,
  crColecionamento: !!row.cr_colecionamento,
  atiradorNivel: row.atirador_nivel,
  responsavelId: row.responsavel_id || '',
  ignorarMensagensAlertas: !!row.ignorar_mensagens_alertas,
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em,
  empresaId: row.empresa_id || undefined,
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
  if (dados.rg !== undefined) payload.rg = dados.rg;
  if (dados.dataNascimento !== undefined) payload.data_nascimento = dados.dataNascimento || null;
  if (dados.nomePai !== undefined) payload.nome_pai = dados.nomePai;
  if (dados.nomeMae !== undefined) payload.nome_mae = dados.nomeMae;
  if (dados.crTiroDesportivo !== undefined) payload.cr_tiro_desportivo = dados.crTiroDesportivo;
  if (dados.crCaca !== undefined) payload.cr_caca = dados.crCaca;
  if (dados.crColecionamento !== undefined) payload.cr_colecionamento = dados.crColecionamento;
  if (dados.atiradorNivel !== undefined) payload.atirador_nivel = dados.atiradorNivel;
  if (dados.responsavelId !== undefined) payload.responsavel_id = dados.responsavelId || null;
  if (dados.ignorarMensagensAlertas !== undefined) payload.ignorar_mensagens_alertas = dados.ignorarMensagensAlertas;
  return payload;
};

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const { usuario, estaAutenticado } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregado, setCarregado] = useState(false);

  const carregarClientes = useCallback(async () => {
    if (!usuario?.empresaId || !estaAutenticado) return;
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
  const [catalogoArmas, setCatalogoArmas] = useState<ItemCatalogoArma[]>(CATALOGO_BASE_ARMAS);

  const carregarMetadadosArmas = useCallback(async () => {
    if (!usuario?.empresaId) return;
    const { data, error } = await supabase
      .from('armas')
      .select('tipo, modelo, calibre, fabricante')
      .eq('empresa_id', usuario.empresaId);

    if (error) {
      console.error('Erro ao buscar metadados de armas:', error);
      return;
    }

    const mapaCatalogo = new Map<string, ItemCatalogoArma>();
    // 1. Carregar catálogo mestre de fábrica
    CATALOGO_BASE_ARMAS.forEach(item => {
      const chave = `${normalizarTipoArma(item.tipo)}||${normalizarFabricante(item.fabricante)}||${normalizarModelo(item.modelo)}`;
      mapaCatalogo.set(chave, {
        tipo: normalizarTipoArma(item.tipo),
        fabricante: normalizarFabricante(item.fabricante),
        modelo: normalizarModelo(item.modelo),
        calibrePadrao: item.calibrePadrao ? normalizarCalibre(item.calibrePadrao) : undefined
      });
    });

    if (data) {
      const modelos = new Set<string>();
      const calibres = new Set<string>();
      const fabricantes = new Set<string>();

      data.forEach(arma => {
        const mod = normalizarModelo(arma.modelo);
        const cal = normalizarCalibre(arma.calibre);
        const fab = normalizarFabricante(arma.fabricante);
        const tip = normalizarTipoArma(arma.tipo) || 'PISTOLA';

        if (mod) modelos.add(mod);
        if (cal) calibres.add(cal);
        if (fab) fabricantes.add(fab);

        // 2. Aprender cada combinação já registrada no acervo de clientes
        if (mod && fab) {
          const chave = `${tip}||${fab}||${mod}`;
          if (!mapaCatalogo.has(chave)) {
            mapaCatalogo.set(chave, {
              tipo: tip,
              fabricante: fab,
              modelo: mod,
              calibrePadrao: cal || undefined
            });
          }
        }
      });

      setModelosRegistrados(Array.from(modelos).sort());
      setCalibresRegistrados(Array.from(calibres).sort());
      setFabricantesRegistrados(Array.from(fabricantes).sort());
    }

    setCatalogoArmas(Array.from(mapaCatalogo.values()));
  }, [usuario]);

  const obterTiposDeArma = useCallback((): string[] => {
    const tipos = new Set<string>(['PISTOLA', 'REVÓLVER', 'CARABINA / FUZIL', 'ESPINGARDA']);
    catalogoArmas.forEach(item => {
      if (item.tipo) tipos.add(normalizarTipoArma(item.tipo));
    });
    return Array.from(tipos).filter(Boolean).sort();
  }, [catalogoArmas]);

  const obterFabricantesPorTipo = useCallback((tipo?: string): string[] => {
    const fabricantes = new Set<string>();
    const tipoNorm = normalizarTipoArma(tipo);

    catalogoArmas.forEach(item => {
      if (!tipoNorm || normalizarTipoArma(item.tipo) === tipoNorm) {
        if (item.fabricante) fabricantes.add(normalizarFabricante(item.fabricante));
      }
    });

    if (fabricantes.size === 0) {
      FABRICANTES_BASE.forEach(f => fabricantes.add(f));
      fabricantesRegistrados.forEach(f => fabricantes.add(f));
    }

    return Array.from(fabricantes).filter(Boolean).sort();
  }, [catalogoArmas, fabricantesRegistrados]);

  const obterModelosPorTipoEFabricante = useCallback((tipo?: string, fabricante?: string): string[] => {
    const modelos = new Set<string>();
    const tipoNorm = normalizarTipoArma(tipo);
    const fabNorm = normalizarFabricante(fabricante);

    catalogoArmas.forEach(item => {
      const matchTipo = !tipoNorm || normalizarTipoArma(item.tipo) === tipoNorm;
      const matchFab = !fabNorm || normalizarFabricante(item.fabricante) === fabNorm;
      if (matchTipo && matchFab && item.modelo) {
        modelos.add(normalizarModelo(item.modelo));
      }
    });

    if (modelos.size === 0 && !fabNorm && !tipoNorm) {
      modelosRegistrados.forEach(m => modelos.add(m));
    }

    return Array.from(modelos).filter(Boolean).sort();
  }, [catalogoArmas, modelosRegistrados]);

  const obterCalibreSugerido = useCallback((tipo?: string, fabricante?: string, modelo?: string): string | undefined => {
    if (!modelo) return undefined;
    const modNorm = normalizarModelo(modelo);
    const fabNorm = normalizarFabricante(fabricante);
    const tipoNorm = normalizarTipoArma(tipo);

    const exato = catalogoArmas.find(item => 
      normalizarModelo(item.modelo) === modNorm &&
      (!fabNorm || normalizarFabricante(item.fabricante) === fabNorm) &&
      (!tipoNorm || normalizarTipoArma(item.tipo) === tipoNorm) &&
      item.calibrePadrao
    );
    if (exato?.calibrePadrao) return normalizarCalibre(exato.calibrePadrao);

    const porModelo = catalogoArmas.find(item => normalizarModelo(item.modelo) === modNorm && item.calibrePadrao);
    if (porModelo?.calibrePadrao) return normalizarCalibre(porModelo.calibrePadrao);

    return undefined;
  }, [catalogoArmas]);

  const aprenderItemArma = useCallback(async (tipo: string, fabricante: string, modelo: string, calibre?: string) => {
    if (!modelo || !fabricante) return;
    const tipNorm = normalizarTipoArma(tipo) || 'PISTOLA';
    const fabNorm = normalizarFabricante(fabricante);
    const modNorm = normalizarModelo(modelo);
    const calNorm = calibre ? normalizarCalibre(calibre) : undefined;

    // Atualiza catálogo em memória imediatamente
    setCatalogoArmas(prev => {
      const existe = prev.some(i => 
        normalizarTipoArma(i.tipo) === tipNorm &&
        normalizarFabricante(i.fabricante) === fabNorm &&
        normalizarModelo(i.modelo) === modNorm
      );
      if (existe) return prev;
      return [...prev, {
        tipo: tipNorm,
        fabricante: fabNorm,
        modelo: modNorm,
        calibrePadrao: calNorm
      }];
    });

    // Se a empresa estiver conectada, registra também nas opções da empresa
    if (usuario?.empresaId) {
      try {
        const { error: insModErr } = await supabase.from('opcoes_armas').insert([{
          empresa_id: usuario.empresaId,
          tipo: 'modelo',
          nome: modNorm
        }]);
        if (insModErr && insModErr.code !== '23505') console.warn('Erro aprendendo modelo:', insModErr.message);

        const { error: insFabErr } = await supabase.from('opcoes_armas').insert([{
          empresa_id: usuario.empresaId,
          tipo: 'fabricante',
          nome: fabNorm
        }]);
        if (insFabErr && insFabErr.code !== '23505') console.warn('Erro aprendendo fabricante:', insFabErr.message);

        if (calNorm) {
          const { error: insCalErr } = await supabase.from('opcoes_armas').insert([{
            empresa_id: usuario.empresaId,
            tipo: 'calibre',
            nome: calNorm
          }]);
          if (insCalErr && insCalErr.code !== '23505') console.warn('Erro aprendendo calibre:', insCalErr.message);
        }
      } catch (e) {
        console.error('Aprendizado silencioso opcoes_armas:', e);
      }
    }
  }, [usuario]);

  const [opcoesArmas, setOpcoesArmas] = useState<OpcaoArma[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);

  const carregarOpcoesArmas = useCallback(async () => {
    if (!usuario?.empresaId) return;
    setCarregandoOpcoes(true);
    try {
      const { data, error } = await supabase
        .from('opcoes_armas')
        .select('*')
        .eq('empresa_id', usuario.empresaId)
        .order('nome', { ascending: true });

      if (error) throw error;
      if (data) {
        setOpcoesArmas(data.map(row => ({
          id: row.id,
          empresaId: row.empresa_id,
          tipo: row.tipo,
          nome: row.nome,
          criadoEm: row.criado_em
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar opções de armas:', err);
    } finally {
      setCarregandoOpcoes(false);
    }
  }, [usuario]);

  const inicializarOpcoesArmasPadrao = useCallback(async () => {
    if (!usuario?.empresaId || !estaAutenticado) return;
    setCarregandoOpcoes(true);
    try {
      // 1. Verificar o que já existe cadastrado no banco
      const { data: opcoesExistentes, error: findErr } = await supabase
        .from('opcoes_armas')
        .select('tipo')
        .eq('empresa_id', usuario.empresaId);

      if (findErr) throw findErr;

      const hasWeapons = opcoesExistentes && opcoesExistentes.some(row => row.tipo !== 'clube');
      const hasClubs = opcoesExistentes && opcoesExistentes.some(row => row.tipo === 'clube');

      const rowsToInsert: any[] = [];

      // 2. Se não tem opções de armas (modelo, calibre, fabricante), faz a carga delas
      if (!hasWeapons) {
        const modelos = new Set<string>(MODELOS_BASE.map(normalizarModelo));
        const calibres = new Set<string>(CALIBRES_BASE.map(normalizarCalibre));
        const fabricantes = new Set<string>(FABRICANTES_BASE.map(normalizarFabricante));

        const { data: armasExistentes } = await supabase
          .from('armas')
          .select('modelo, calibre, fabricante')
          .eq('empresa_id', usuario.empresaId);

        if (armasExistentes) {
          armasExistentes.forEach(a => {
            if (a.modelo) {
              const m = normalizarModelo(a.modelo);
              if (m) modelos.add(m);
            }
            if (a.calibre) {
              const c = normalizarCalibre(a.calibre);
              if (c) calibres.add(c);
            }
            if (a.fabricante) {
              const f = normalizarFabricante(a.fabricante);
              if (f) fabricantes.add(f);
            }
          });
        }

        modelos.forEach(m => {
          if (m) rowsToInsert.push({ empresa_id: usuario.empresaId, tipo: 'modelo', nome: m });
        });
        calibres.forEach(c => {
          if (c) rowsToInsert.push({ empresa_id: usuario.empresaId, tipo: 'calibre', nome: c });
        });
        fabricantes.forEach(f => {
          if (f) rowsToInsert.push({ empresa_id: usuario.empresaId, tipo: 'fabricante', nome: f });
        });
      }

      // 3. Se não tem opções de clubes de tiro, faz a carga deles
      if (!hasClubs) {
        const clubes = new Set<string>();

        // a) Clube Parceiro Padrão
        const clubeParceiro = usuario?.dadosEmpresa?.clubeParceiroPadrao;
        if (clubeParceiro && clubeParceiro.trim() !== '') {
          clubes.add(clubeParceiro.trim().toUpperCase());
        }

        // b) Clubes filiados de clientes existentes
        clientes.forEach(c => {
          if (c.clubeFiliado && c.clubeFiliado.trim() !== '' && c.clubeFiliado.toUpperCase() !== 'NÃO RELATADO' && c.clubeFiliado.toUpperCase() !== 'NÃO FILIADO') {
            clubes.add(c.clubeFiliado.trim().toUpperCase());
          }
        });

        // c) Destinos de GTs anteriores (que não sejam em formato Cidade-UF)
        const { data: gtsExistentes } = await supabase
          .from('guias_trafego')
          .select('destino')
          .eq('empresa_id', usuario.empresaId);

        if (gtsExistentes) {
          gtsExistentes.forEach(gt => {
            if (gt.destino && gt.destino.trim() !== '') {
              const normalizado = gt.destino.trim().toUpperCase();
              const isCityUf = /^[A-ZÀ-ÿ\s.-]+-[A-Z]{2}$/.test(normalizado);
              if (!isCityUf) {
                clubes.add(normalizado);
              }
            }
          });
        }

        clubes.forEach(clube => {
          if (clube) rowsToInsert.push({ empresa_id: usuario.empresaId, tipo: 'clube', nome: clube });
        });
      }

      if (rowsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('opcoes_armas')
          .insert(rowsToInsert);

        if (insertErr) throw insertErr;
      }

      await carregarOpcoesArmas();
    } catch (err) {
      console.error('Erro ao inicializar opções padrão:', err);
    } finally {
      setCarregandoOpcoes(false);
    }
  }, [usuario, carregarOpcoesArmas, clientes]);

  const criarOpcaoArma = async (tipo: 'modelo' | 'calibre' | 'fabricante' | 'clube', nome: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const nomeFormatado = nome.trim().toUpperCase();
    if (!nomeFormatado) throw new Error('Nome inválido');

    // Evitar duplicidade local antes de tentar salvar
    const duplicado = opcoesArmas.some(o => o.tipo === tipo && o.nome.toUpperCase() === nomeFormatado.toUpperCase());
    if (duplicado) throw new Error('Este item já está cadastrado.');

    const { error } = await supabase
      .from('opcoes_armas')
      .insert([{
        empresa_id: usuario.empresaId,
        tipo,
        nome: nomeFormatado
      }]);

    if (error) throw error;
    await carregarOpcoesArmas();
  };

  const atualizarOpcaoArma = async (id: string, novoNome: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');

    const item = opcoesArmas.find(o => o.id === id);
    if (!item) throw new Error('Item não encontrado');

    const nomeFormatado = novoNome.trim().toUpperCase();
    if (!nomeFormatado) throw new Error('Nome inválido');

    const duplicado = opcoesArmas.some(o => o.id !== id && o.tipo === item.tipo && o.nome.toUpperCase() === nomeFormatado.toUpperCase());
    if (duplicado) throw new Error('Outro item com este nome já está cadastrado.');

    const { error } = await supabase
      .from('opcoes_armas')
      .update({ nome: nomeFormatado })
      .eq('id', id);

    if (error) throw error;
    await carregarOpcoesArmas();
  };

  const deletarOpcaoArma = async (id: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('opcoes_armas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await carregarOpcoesArmas();
  };

  useEffect(() => {
    if (usuario?.empresaId && estaAutenticado) {
      carregarClientes();
      carregarMetadadosArmas();
      inicializarOpcoesArmasPadrao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, estaAutenticado]);

  const criarCliente = useCallback(async (
    dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<string> => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    
    if (dados.cpf) {
      const cleanCpf = dados.cpf.replace(/\D/g, '');
      if (cleanCpf) {
        const existe = clientes.some(c => c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf);
        if (existe) {
          throw new Error('Já existe um cliente cadastrado com este CPF.');
        }
      }
    }
    
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

    // Tenta herdar a responsabilidade caso o cliente já exista cadastrado por outro despachante (Wilton / GCAC)
    let responsavelId = dados.responsavelId;
    let ignorarMensagensAlertas = dados.ignorarMensagensAlertas;

    if (dados.cpf) {
      const cleanCpf = dados.cpf.replace(/\D/g, '');
      const formatCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      if (cleanCpf) {
        try {
          const { data: existenteGlobal } = await supabase
            .from('clientes')
            .select('responsavel_id, ignorar_mensagens_alertas')
            .or(`cpf.eq.${cleanCpf},cpf.eq.${formatCpf}`)
            .order('atualizado_em', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existenteGlobal) {
            if (existenteGlobal.responsavel_id !== undefined) {
              responsavelId = existenteGlobal.responsavel_id;
            }
            if (existenteGlobal.ignorar_mensagens_alertas !== undefined && existenteGlobal.ignorar_mensagens_alertas !== null) {
              ignorarMensagensAlertas = existenteGlobal.ignorar_mensagens_alertas;
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados globais para herança de responsabilidade:', err);
        }
      }
    }
    
    const dadosComUrls = {
      ...dados,
      crUrl,
      crIbamaUrl,
      responsavelId,
      ignorarMensagensAlertas
    };

    const { data, error } = await supabase
      .from('clientes')
      .insert([{ id: clienteId, ...mapToDB(dadosComUrls), empresa_id: usuario.empresaId }])
      .select()
      .single();

    if (error) throw error;
    await carregarClientes();
    return data.id;
  }, [carregarClientes, usuario, clientes]);

  const atualizarCliente = useCallback(async (id: string, dados: Partial<Cliente>, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    const localEmpresaId = usuario.empresaId;
    const portalEmpresaId = overrideEmpresaId;
    
    if (dados.cpf !== undefined) {
      const cleanCpf = dados.cpf.replace(/\D/g, '');
      if (cleanCpf) {
        const existe = clientes.some(c => c.id !== id && c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf);
        if (existe) {
          throw new Error('Já existe outro cliente cadastrado com este CPF.');
        }
      }
    }
    
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

    // 3. Sincronizar responsavel_id e ignorar_mensagens_alertas em outras empresas caso tenham o mesmo CPF
    const targetCpf = dados.cpf || clienteAtual?.cpf;
    if (targetCpf) {
      const cleanCpf = targetCpf.replace(/\D/g, '');
      const formatCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      
      const payloadSync: any = {};
      if (dados.responsavelId !== undefined) payloadSync.responsavel_id = dados.responsavelId || null;
      if (dados.ignorarMensagensAlertas !== undefined) payloadSync.ignorar_mensagens_alertas = dados.ignorarMensagensAlertas;
      
      if (Object.keys(payloadSync).length > 0) {
        payloadSync.atualizado_em = new Date().toISOString();
        try {
          await supabase
            .from('clientes')
            .update(payloadSync)
            .neq('id', id)
            .or(`cpf.eq.${cleanCpf},cpf.eq.${formatCpf}`);
        } catch (err) {
          console.error('Erro ao sincronizar responsabilidade entre clientes por CPF:', err);
        }
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
  }, [carregarClientes, usuario, clientes]);

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
    
    const clubesOpcoes = opcoesArmas
      .filter(o => o.tipo === 'clube')
      .map(o => o.nome);
    
    return Array.from(new Set([...todosClubes, ...clubesOpcoes].map(c => c.toUpperCase()))).sort();
  }, [clientes, opcoesArmas]);

  // --- Gestão de Armas ---
  const buscarArmas = useCallback(async (clienteId: string, overrideEmpresaId?: string) => {
    if (!usuario?.empresaId) return [];
    const empresaId = overrideEmpresaId || usuario.empresaId;
    const { data, error } = await supabase
      .from('armas')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', empresaId)
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

    const { error } = await supabase
      .from('armas')
      .upsert({ id: armaId, ...payload });
    if (error) throw error;
    
    if (dados.modelo && dados.fabricante) {
      await aprenderItemArma(
        dados.tipo || '',
        dados.fabricante,
        dados.modelo,
        dados.calibre || undefined
      );
    }

    await carregarMetadadosArmas();
  }, [carregarMetadadosArmas, aprenderItemArma, usuario]);

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

  const buscarModelosDeclaracao = useCallback(async (): Promise<ModeloDeclaracao[]> => {
    if (!usuario?.empresaId) return [];
    const { data, error } = await supabase
      .from('modelos_declaracao')
      .select('*')
      .eq('empresa_id', usuario.empresaId)
      .order('titulo', { ascending: true });

    if (error) throw error;

    if (data.length === 0) {
      const modelosPadrao = [
        {
          titulo: 'DECLARAÇÃO DE INEXISTÊNCIA DE ARMA DE FOGO VINCULADA À ATIVIDADE',
          texto: 'Eu, {{nome}}, portador(a) do RG nº {{rg}} e do CPF nº {{cpf}} nascido(a) na data de {{data_nascimento}}, residente no endereço {{endereco}}, filho(a) de {{nome_pai}} e {{nome_mae}}, venho através desta declarar que:\n\nDECLARO, sob as penas da lei, em especial o art. 299 do Código Penal Brasileiro (Falsidade Ideológica), para fins de instrução de processo de Exclusão da Atividade de Tiro Desportivo do meu Certificado de Registro junto a Polícia Federal do Brasil, que NÃO POSSUO nenhuma arma de fogo registrada, acervada ou de qualquer forma vinculada à atividade de Tiro Desportivo em meu nome.\n\nDeclaro ainda estar ciente de que a inveracidade das informações aqui prestadas poderá acarretar sanções penais, civis e administrativas cabíveis.\n\nPor ser expressão da verdade, assino a presente declaração.',
          empresa_id: usuario.empresaId
        },
        {
          titulo: 'DECLARAÇÃO DE COMPROMISSO DE PARTICIPAÇÃO EM TREINAMENTOS E COMPETIÇÕES',
          texto: 'DADOS DA ENTIDADE DE TIRO DECLARANTE\nNome: {{clube_nome}}\nCNPJ: {{clube_cnpj}}\nCertificado de Registro: {{clube_cr}} (Vencimento: {{clube_cr_validade}})\nEndereço: {{clube_endereco}}\n\nDADOS DO ATIRADOR DESPORTIVO\nNome: {{nome}}\nCPF: {{cpf}}\nCertificado de Registro: {{numero_cr}} (Vencimento: {{vencimento_cr}})\nEndereço: {{endereco}}\n\nFILIAÇÃO À ENTIDADE DE TIRO\nNúmero: {{clube_filiacao_num}}\nData: {{clube_filiacao_data}}\n\nCOMPROMISSO\nEu, {{nome}}, portador do CPF nº {{cpf}}, residente no endereço {{endereco}}, portador do RG nº {{rg}}, filiado à Entidade de Tiro acima nomeada, ME COMPROMETO a comprovar, no mínimo, a habitualidade e a participação em treinamentos e competições na forma prevista na legislação vigente (Art. 35 do Decreto nº 11.615/2023).\n\nPor ser expressão da verdade, firmo o presente compromisso.',
          empresa_id: usuario.empresaId
        },
        {
          titulo: 'DECLARAÇÃO DE IDONEIDADE',
          texto: 'Eu, {{nome}}, nascido(a) em {{data_nascimento}}, filho(a) de {{nome_pai}} e {{nome_mae}}, portador do CPF nº {{cpf}} e RG nº {{rg}}, residente no endereço {{endereco}}, declaro, sob as penas da lei, que não respondo a inquéritos policiais nem a processos criminais, e estou ciente de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal (Art. 299) e às demais cominações legais aplicáveis.\n\nPor ser verdade, firmo a presente.',
          empresa_id: usuario.empresaId
        },
        {
          titulo: 'DECLARAÇÃO DE SEGURANÇA DO ACERVO (DSA)',
          texto: 'Eu, {{nome}}, nascido(a) em {{data_nascimento}}, residente no endereço {{endereco}}, portador do CPF nº {{cpf}} e RG nº {{rg}}, DECLARO, para fim de Concessão, Revalidação ou Apostilamento de Registro de Colecionador, Atirador Desportivo e Caçador (CAC) junto ao Comando do Exército e Polícia Federal, que o local de guarda do meu acervo de armas de fogo e munições possui cofre ou local seguro com trancas apropriadas para a devida custódia dos equipamentos, conforme as normas de segurança vigentes.\n\nPor ser a expressão da verdade, firmo a presente declaração.',
          empresa_id: usuario.empresaId
        },
        {
          titulo: 'DECLARAÇÃO DE ENDEREÇO DE 5 ANOS',
          texto: 'Eu, {{nome}}, portador(a) do RG nº {{rg}} e do CPF nº {{cpf}}, nascido(a) na data de {{data_nascimento}}, declaro para os devidos fins de comprovação que resido no endereço {{endereco}}.\n\nDeclaro também, sob as penas da lei, que nos últimos 5 (cinco) anos residi nos endereços supracitados e declarei idoneidade de residência para fins de registro e aquisição de produtos controlados.\n\nEstando ciente de que a falsidade da presente declaração implica em sanções penais previstas no Art. 299 do Código Penal Brasileiro.',
          empresa_id: usuario.empresaId
        }
      ];

      const { data: insertedData, error: insertError } = await supabase
        .from('modelos_declaracao')
        .insert(modelosPadrao)
        .select('*');

      if (insertError) throw insertError;
      return (insertedData || []).map(row => ({
        id: row.id,
        titulo: row.titulo,
        texto: row.texto,
        empresaId: row.empresa_id,
        criadoEm: row.criado_em
      }));
    }

    return data.map(row => ({
      id: row.id,
      titulo: row.titulo,
      texto: row.texto,
      empresaId: row.empresa_id,
      criadoEm: row.criado_em
    }));
  }, [usuario]);

  const salvarModeloDeclaracao = useCallback(async (dados: Partial<ModeloDeclaracao>) => {
    if (!usuario?.empresaId) throw new Error('Usuário não autenticado');
    
    const payload = {
      titulo: dados.titulo || '',
      texto: dados.texto || '',
      empresa_id: usuario.empresaId
    };

    if (dados.id) {
      const { error } = await supabase
        .from('modelos_declaracao')
        .update(payload)
        .eq('id', dados.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('modelos_declaracao')
        .insert([payload]);
      if (error) throw error;
    }
  }, [usuario]);

  const deletarModeloDeclaracao = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('modelos_declaracao')
      .delete()
      .eq('id', id);
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
      catalogoArmas,
      obterTiposDeArma,
      obterFabricantesPorTipo,
      obterModelosPorTipoEFabricante,
      obterCalibreSugerido,
      aprenderItemArma,
      opcoesArmas,
      carregandoOpcoes,
      inicializarOpcoesArmasPadrao,
      criarOpcaoArma,
      atualizarOpcaoArma,
      deletarOpcaoArma,
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
      deletarCredito,
      buscarModelosDeclaracao,
      salvarModeloDeclaracao,
      deletarModeloDeclaracao
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
