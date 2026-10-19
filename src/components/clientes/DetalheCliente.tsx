import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, Mail, Phone, MapPin, Shield, Copy, Check, 
  FileText, Receipt, Clock, Calendar, Plus, 
  ArrowLeft, ChevronRight, ExternalLink, MessageCircle, Trash2, Pencil, AlertTriangle,
  Loader2, X
} from 'lucide-react';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';
import { FormularioCliente } from './FormularioCliente';
import { AbaDocumentacao } from './AbaDocumentacao';
import { AbaCreditos } from './AbaCreditos';
import { Cliente } from '../../types';
import { formatarCPF, formatarTelefone, formatarMoeda, formatarData, isOrdemConcluida, obterResumoExecucao, iconeStatusExecucao } from '../../utils/formatters';
import { calcularAlerta } from '../../utils/vencimentos';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useRecibos } from '../../context/RecibosContext';
import { useAgendamentos } from '../../context/AgendamentosContext';
import { useClientes } from '../../context/ClientesContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { useAuth } from '../../context/AuthContext';
import { visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { BotaoConvidarCac } from './BotaoConvidarCac';
import { supabase } from '../../db/supabase';
import { buscarAcervoVinculado } from '../../services/vinculosService';

interface DetalheClienteProps {
  cliente: Cliente;
}

export function DetalheCliente({ cliente }: DetalheClienteProps) {
  const navigate = useNavigate();
  const { usuario, temAcessoRecurso } = useAuth();
  const { ordens } = useOrdens();
  const { orcamentos } = useOrcamentos();
  const { recibos } = useRecibos();
  const { agendamentos } = useAgendamentos();
  const { deletarCliente, atualizarCliente } = useClientes();

  const temPermissao = (slug: string) => {
    return usuario?.role === 'admin' || usuario?.permissoes?.includes(slug);
  };
  
  const location = useLocation();
  const [copiou, setCopiou] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [mostrarTodasOrdens, setMostrarTodasOrdens] = useState(false);
    const [cacEmpresaId, setCacEmpresaId] = useState<string | undefined>(undefined);
  const [podeEditarVinculo, setPodeEditarVinculo] = useState<boolean>(false);
  const [portalStatus, setPortalStatus] = useState<string | undefined>(undefined);
  const [alertasCount, setAlertasCount] = useState<number>(0);
  const [isUsuarioPortal, setIsUsuarioPortal] = useState<boolean | undefined>(undefined);
  const [mostrarPromptCR, setMostrarPromptCR] = useState(false);

  useEffect(() => {
    const temCR = cliente.numeroCr && cliente.numeroCr.trim() !== '';
    const temAtividades = cliente.crTiroDesportivo || cliente.crCaca || cliente.crColecionamento;
    const isDespachante = usuario?.tipoConta === 'empresa';

    if (isDespachante && temCR && !temAtividades && !sessionStorage.getItem(`prompt-cr-ignorado-${cliente.id}`)) {
      setMostrarPromptCR(true);
    } else {
      setMostrarPromptCR(false);
    }
  }, [cliente.id, cliente.numeroCr, cliente.crTiroDesportivo, cliente.crCaca, cliente.crColecionamento, usuario?.tipoConta]);

  const [nomeResponsavel, setNomeResponsavel] = useState<string>('');

  useEffect(() => {
    const carregarNomeResponsavel = async () => {
      if (!cliente.responsavelId) {
        setNomeResponsavel('');
        return;
      }
      try {
        const { data } = await supabase
          .from('usuarios_autorizados')
          .select('nome, cpf, empresa_id')
          .eq('id', cliente.responsavelId)
          .single();
        if (data) {
          const isMainCompanyUser = data.empresa_id === '00000000-0000-0000-0000-000000000001';
          const isWilton = data.cpf === '006.089.161-02';
          
          if (usuario?.empresaId === '00000000-0000-0000-0000-000000000001') {
            setNomeResponsavel(isWilton ? 'IBAMA - RESP. DE TERCEIROS (WILTON)' : data.nome);
          } else {
            setNomeResponsavel(isMainCompanyUser ? 'G CAC DESPACHANTE BÉLICO' : data.nome);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar nome do responsável:', err);
      }
    };
    carregarNomeResponsavel();
  }, [cliente.responsavelId, usuario?.empresaId]);

  const renderBannerResponsabilidade = () => {
    if (!cliente.responsavelId) return null;
    
    const isMainCompany = usuario?.empresaId === '00000000-0000-0000-0000-000000000001';
    const isWiltonResponsavel = cliente.ignorarMensagensAlertas;
    
    if (isMainCompany) {
      if (isWiltonResponsavel) {
        return (
          <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 flex items-center gap-2 animate-fade-in mb-4">
            <AlertTriangle size={16} className="shrink-0" />
            <span><strong>Silenciado (IBAMA):</strong> Este cliente é atendido por Wilton para documentos do IBAMA. Alertas de CR IBAMA e Autorizações de Manejo estão silenciados. Guias de tráfego e outros documentos continuam ativos.</span>
          </div>
        );
      }
    } else {
      // Wilton logado
      if (isWiltonResponsavel) {
        return (
          <div className="p-3.5 rounded-2xl bg-green-500/10 border border-green-500/20 text-xs text-green-400 flex items-center gap-2 animate-fade-in mb-4">
            <AlertTriangle size={16} className="shrink-0" />
            <span><strong>Responsabilidade (IBAMA):</strong> Este cliente está sob sua responsabilidade para os documentos do IBAMA. Os alertas de CR IBAMA e Manejo serão controlados por você.</span>
          </div>
        );
      } else {
        return (
          <div className="p-3.5 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 text-xs text-brand-blue-light flex items-center gap-2 animate-fade-in mb-4">
            <AlertTriangle size={16} className="shrink-0" />
            <span><strong>Responsabilidade:</strong> Os documentos do IBAMA deste cliente são de responsabilidade da G CAC DESPACHANTE BÉLICO.</span>
          </div>
        );
      }
    }
    return null;
  };

  // Filtros de histórico
  const todasOrdensCliente = ordens.filter(o => o.cpf === cliente.cpf);
  const ordensClienteAbertas = todasOrdensCliente.filter(o => !isOrdemConcluida(o));
  const ordensExibidas = mostrarTodasOrdens ? todasOrdensCliente : ordensClienteAbertas;

  const orcamentosCliente = orcamentos.filter(o => o.cpf === cliente.cpf);
  const recibosCliente = recibos.filter(r => r.clienteCPF === cliente.cpf);
  const agendamentosCliente = agendamentos.filter(a => a.clienteCPF === cliente.cpf && a.status === 'pendente');

  const { buscarArmas, buscarManejos, buscarGts } = useClientes();

  const tabsDisponiveis = [
    { id: 'ordens', label: 'O.S.', slug: 'ordens', count: todasOrdensCliente.length },
    { id: 'orcamentos', label: 'Orçamentos', slug: 'orcamentos', count: orcamentosCliente.length },
    { id: 'recibos', label: 'Recibos', slug: 'recibos', count: recibosCliente.length },
    { id: 'agendamentos', label: 'Agendamentos', slug: 'agendamentos', count: agendamentosCliente.length },
    { id: 'documentos', label: 'Acervo & Docs', slug: null, count: alertasCount },
    { id: 'creditos', label: 'Haver', slug: null, count: 0 },
  ].filter(tab => {
    if (usuario?.tipoConta === 'cac_individual') {
      return tab.id === 'documentos';
    }
    return !tab.slug || temPermissao(tab.slug);
  });

  const [abaAtiva, setAbaAtiva] = useState<'ordens' | 'orcamentos' | 'recibos' | 'agendamentos' | 'documentos' | 'creditos'>(() => {
    const defaultAba = (location.state as any)?.aba;
    if (defaultAba && tabsDisponiveis.some(t => t.id === defaultAba)) {
      return defaultAba;
    }
    return (tabsDisponiveis[0]?.id || 'documentos') as any;
  });

  // Sincroniza dados do cliente com o perfil do Portal CAC se houver vínculo ativo
  useEffect(() => {
    const despachanteEmpresaId = usuario?.empresaId;
    if (usuario?.tipoConta === 'cac_individual' || !despachanteEmpresaId || !cliente.cpf) return;

    let cancelado = false;
    setIsUsuarioPortal(undefined);
    setCacEmpresaId(undefined);
    setPodeEditarVinculo(false);
    setPortalStatus(undefined);

    async function sincronizarComPortal() {
      try {
        const cpfLimpo = cliente.cpf.replace(/\D/g, '');
        const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        // Busca se existe cadastro de CAC Individual com esse CPF no Portal GCAC
        const { data: cacExistente } = await supabase
          .from('clientes')
          .select(`
            id,
            empresa_id,
            empresas!inner (
              id,
              tipo_conta
            )
          `)
          .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
          .eq('empresas.tipo_conta', 'cac_individual')
          .limit(1)
          .maybeSingle() as any;

        if (cancelado) return;
        setIsUsuarioPortal(!!cacExistente);

        // 1. Busca vínculo para esse cliente (qualquer status para exibirmos a situação do portal)
        const { data: vinculo } = await supabase
          .from('vinculos_despachante_cac')
          .select('cac_empresa_id, permite_edicao, status')
          .eq('despachante_empresa_id', despachanteEmpresaId)
          .or(`cac_cpf.eq.${cpfLimpo},cac_cpf.eq.${cpfFormatado}`)
          .maybeSingle();

        if (cancelado) return;

        if (!vinculo) {
          setCacEmpresaId(undefined);
          setPodeEditarVinculo(false);
          setPortalStatus(undefined);
          return;
        }

        setPortalStatus(vinculo.status);

        if (vinculo.status !== 'ativo') {
          setCacEmpresaId(undefined);
          setPodeEditarVinculo(false);
          return;
        }

        setCacEmpresaId(vinculo.cac_empresa_id);
        setPodeEditarVinculo(!!vinculo.permite_edicao);

        // 2. Busca o perfil do cliente no workspace dele
        const { data: clienteCac } = await supabase
          .from('clientes')
          .select('id, numero_cr, vencimento_cr, numero_cr_ibama, vencimento_cr_ibama, foto_url, cr_url, cr_ibama_url, endereco, contato, cr_tiro_desportivo, cr_caca, cr_colecionamento, atirador_nivel')
          .eq('empresa_id', vinculo.cac_empresa_id)
          .maybeSingle();

        if (cancelado || !clienteCac) return;

        // 3. Compara e monta as atualizações
        const mudancas: Partial<Cliente> = {};
        if (clienteCac.numero_cr && clienteCac.numero_cr !== cliente.numeroCr) mudancas.numeroCr = clienteCac.numero_cr;
        if (clienteCac.vencimento_cr && clienteCac.vencimento_cr !== cliente.vencimentoCr) mudancas.vencimentoCr = clienteCac.vencimento_cr;
        if (clienteCac.numero_cr_ibama && clienteCac.numero_cr_ibama !== cliente.numeroCrIbama) mudancas.numeroCrIbama = clienteCac.numero_cr_ibama;
        if (clienteCac.vencimento_cr_ibama && clienteCac.vencimento_cr_ibama !== cliente.vencimentoCrIbama) mudancas.vencimentoCrIbama = clienteCac.vencimento_cr_ibama;
        if (clienteCac.foto_url && clienteCac.foto_url !== cliente.fotoUrl) mudancas.fotoUrl = clienteCac.foto_url;
        if (clienteCac.cr_url && clienteCac.cr_url !== cliente.crUrl) mudancas.crUrl = clienteCac.cr_url;
        if (clienteCac.cr_ibama_url && clienteCac.cr_ibama_url !== cliente.crIbamaUrl) mudancas.crIbamaUrl = clienteCac.cr_ibama_url;
        if (clienteCac.endereco && clienteCac.endereco !== cliente.endereco) mudancas.endereco = clienteCac.endereco;
        if (clienteCac.contato && clienteCac.contato !== cliente.contato) mudancas.contato = clienteCac.contato;
        if (clienteCac.cr_tiro_desportivo !== undefined && !!clienteCac.cr_tiro_desportivo !== !!cliente.crTiroDesportivo) mudancas.crTiroDesportivo = !!clienteCac.cr_tiro_desportivo;
        if (clienteCac.cr_caca !== undefined && !!clienteCac.cr_caca !== !!cliente.crCaca) mudancas.crCaca = !!clienteCac.cr_caca;
        if (clienteCac.cr_colecionamento !== undefined && !!clienteCac.cr_colecionamento !== !!cliente.crColecionamento) mudancas.crColecionamento = !!clienteCac.cr_colecionamento;
        if (clienteCac.atirador_nivel !== undefined && clienteCac.atirador_nivel !== cliente.atiradorNivel) mudancas.atiradorNivel = clienteCac.atirador_nivel;

        if (Object.keys(mudancas).length > 0) {
          console.log('Sincronizando dados com o Portal GCAC:', mudancas);
          await atualizarCliente(cliente.id, mudancas);
        }

        // 4. Sincronização profunda de acervo (Armas, GTs e Manejos)
        try {
          // Corrigir eventuais registros locais que foram salvos com empresa_id do portal CAC
          if (cliente.id !== clienteCac.id) {
            await supabase
              .from('armas')
              .update({ empresa_id: despachanteEmpresaId })
              .eq('cliente_id', cliente.id)
              .eq('empresa_id', vinculo.cac_empresa_id);
          }

          const { data: localArmas } = await supabase.from('armas').select('*').eq('cliente_id', cliente.id);
          const { data: portalArmas } = await supabase.from('armas').select('*').eq('empresa_id', vinculo.cac_empresa_id).neq('cliente_id', cliente.id);

          const portalArmasBySerie = new Map<string, any>();
          portalArmas?.forEach(a => {
            if (a.numero_serie) portalArmasBySerie.set(a.numero_serie.trim().toUpperCase(), a);
          });

          const localArmasBySerie = new Map<string, any>();
          localArmas?.forEach(a => {
            if (a.numero_serie) localArmasBySerie.set(a.numero_serie.trim().toUpperCase(), a);
          });

          // Sincronizar Armas (sem deletar registros locais nem colidir chave primária)
          for (const localArma of (localArmas || [])) {
            const serie = localArma.numero_serie?.trim().toUpperCase();
            if (!serie) continue;
            const pArma = portalArmasBySerie.get(serie);

            if (pArma) {
              const payload = {
                tipo: pArma.tipo || localArma.tipo,
                modelo: pArma.modelo || localArma.modelo,
                calibre: pArma.calibre || localArma.calibre,
                fabricante: pArma.fabricante || localArma.fabricante,
                numero_sigma: pArma.numero_sigma || localArma.numero_sigma,
                acervo: pArma.acervo || localArma.acervo,
                vencimento_craf: pArma.vencimento_craf || localArma.vencimento_craf,
                craf_url: pArma.craf_url || localArma.craf_url,
                craf_em_renovacao: pArma.craf_em_renovacao !== undefined ? pArma.craf_em_renovacao : localArma.craf_em_renovacao,
                empresa_id: despachanteEmpresaId
              };
              await supabase.from('armas').update(payload).eq('id', localArma.id);
            } else if (clienteCac.id && clienteCac.id !== cliente.id) {
              const novaPortalArma = {
                id: uuidv4(),
                cliente_id: clienteCac.id,
                tipo: localArma.tipo,
                modelo: localArma.modelo,
                calibre: localArma.calibre,
                fabricante: localArma.fabricante,
                numero_serie: localArma.numero_serie,
                numero_sigma: localArma.numero_sigma,
                acervo: localArma.acervo,
                vencimento_craf: localArma.vencimento_craf,
                craf_url: localArma.craf_url,
                craf_em_renovacao: !!localArma.craf_em_renovacao,
                empresa_id: vinculo.cac_empresa_id
              };
              const { error: insErr } = await supabase.from('armas').insert([novaPortalArma]);
              if (!insErr) {
                portalArmasBySerie.set(serie, novaPortalArma);
              }
            }
          }

          for (const pArma of (portalArmas || [])) {
            const serie = pArma.numero_serie?.trim().toUpperCase();
            if (!serie) continue;
            if (!localArmasBySerie.has(serie)) {
              const novaLocalArma = {
                id: uuidv4(),
                cliente_id: cliente.id,
                tipo: pArma.tipo,
                modelo: pArma.modelo,
                calibre: pArma.calibre,
                fabricante: pArma.fabricante,
                numero_serie: pArma.numero_serie,
                numero_sigma: pArma.numero_sigma,
                acervo: pArma.acervo,
                vencimento_craf: pArma.vencimento_craf,
                craf_url: pArma.craf_url,
                craf_em_renovacao: !!pArma.craf_em_renovacao,
                empresa_id: despachanteEmpresaId
              };
              const { error: insErr } = await supabase.from('armas').insert([novaLocalArma]);
              if (!insErr) {
                localArmasBySerie.set(serie, novaLocalArma);
              }
            }
          }

          // Sincronizar GTs por número de série da arma
          const localArmaIdToSerie = new Map<string, string>();
          localArmasBySerie.forEach((a, serie) => localArmaIdToSerie.set(a.id, serie));

          const portalArmaIdToSerie = new Map<string, string>();
          portalArmasBySerie.forEach((a, serie) => portalArmaIdToSerie.set(a.id, serie));

          const localArmaIds = Array.from(localArmaIdToSerie.keys());
          const portalArmaIds = Array.from(portalArmaIdToSerie.keys());

          if (localArmaIds.length > 0 || portalArmaIds.length > 0) {
            const [localGtsRes, portalGtsRes] = await Promise.all([
              localArmaIds.length > 0
                ? supabase.from('guias_trafego').select('*').in('arma_id', localArmaIds)
                : Promise.resolve({ data: [] as any[] }),
              portalArmaIds.length > 0
                ? supabase.from('guias_trafego').select('*').in('arma_id', portalArmaIds)
                : Promise.resolve({ data: [] as any[] })
            ]);

            const localGts = localGtsRes.data || [];
            const portalGts = portalGtsRes.data || [];

            const matchGtKeyBySerie = (serie: string | undefined, g: any) =>
              `${serie || ''}_${(g.destino || '').trim().toUpperCase()}_${g.vencimento || ''}`;

            const portalGtsByKey = new Map<string, any>();
            portalGts.forEach(g => {
              const serie = portalArmaIdToSerie.get(g.arma_id);
              if (serie) portalGtsByKey.set(matchGtKeyBySerie(serie, g), g);
            });

            const localGtsByKey = new Map<string, any>();
            localGts.forEach(g => {
              const serie = localArmaIdToSerie.get(g.arma_id);
              if (serie) localGtsByKey.set(matchGtKeyBySerie(serie, g), g);
            });

            for (const lGt of localGts) {
              const serie = localArmaIdToSerie.get(lGt.arma_id);
              if (!serie) continue;
              const key = matchGtKeyBySerie(serie, lGt);
              const pGt = portalGtsByKey.get(key);

              if (pGt) {
                const payload = {
                  tipo: pGt.tipo || lGt.tipo,
                  vencimento: pGt.vencimento || lGt.vencimento,
                  destino: pGt.destino || lGt.destino,
                  arquivo_url: pGt.arquivo_url || lGt.arquivo_url,
                  gt_em_renovacao: pGt.gt_em_renovacao !== undefined ? pGt.gt_em_renovacao : lGt.gt_em_renovacao,
                  empresa_id: despachanteEmpresaId
                };
                await supabase.from('guias_trafego').update(payload).eq('id', lGt.id);
              } else {
                const targetPortalArma = portalArmasBySerie.get(serie);
                if (targetPortalArma && targetPortalArma.id !== lGt.arma_id) {
                  const payload = {
                    id: uuidv4(),
                    arma_id: targetPortalArma.id,
                    tipo: lGt.tipo,
                    vencimento: lGt.vencimento,
                    destino: lGt.destino,
                    arquivo_url: lGt.arquivo_url,
                    gt_em_renovacao: !!lGt.gt_em_renovacao,
                    empresa_id: vinculo.cac_empresa_id
                  };
                  await supabase.from('guias_trafego').insert([payload]);
                }
              }
            }

            for (const pGt of portalGts) {
              const serie = portalArmaIdToSerie.get(pGt.arma_id);
              if (!serie) continue;
              const key = matchGtKeyBySerie(serie, pGt);
              if (!localGtsByKey.has(key)) {
                const targetLocalArma = localArmasBySerie.get(serie);
                if (targetLocalArma) {
                  const payload = {
                    id: uuidv4(),
                    arma_id: targetLocalArma.id,
                    tipo: pGt.tipo,
                    vencimento: pGt.vencimento,
                    destino: pGt.destino,
                    arquivo_url: pGt.arquivo_url,
                    gt_em_renovacao: !!pGt.gt_em_renovacao,
                    empresa_id: despachanteEmpresaId
                  };
                  await supabase.from('guias_trafego').insert([payload]);
                }
              }
            }
          }

          // Sincronizar Manejos
          if (cliente.id !== clienteCac.id) {
            await supabase
              .from('autorizacoes_manejo')
              .update({ empresa_id: despachanteEmpresaId })
              .eq('cliente_id', cliente.id)
              .eq('empresa_id', vinculo.cac_empresa_id);
          }

          const { data: localManejos } = await supabase.from('autorizacoes_manejo').select('*').eq('cliente_id', cliente.id);
          const { data: portalManejos } = await supabase.from('autorizacoes_manejo').select('*').eq('empresa_id', vinculo.cac_empresa_id).neq('cliente_id', cliente.id);

          const matchManejoKey = (m: any) => `${m.nome_fazenda?.trim().toUpperCase()}_${m.numero_car?.trim().toUpperCase()}`;

          const portalManejosByKey = new Map<string, any>();
          portalManejos?.forEach(m => portalManejosByKey.set(matchManejoKey(m), m));

          const localManejosByKey = new Map<string, any>();
          localManejos?.forEach(m => localManejosByKey.set(matchManejoKey(m), m));

          for (const lManejo of (localManejos || [])) {
            const key = matchManejoKey(lManejo);
            const pManejo = portalManejosByKey.get(key);

            if (pManejo) {
              const payload = {
                cliente_id: cliente.id,
                numero_car: pManejo.numero_car || lManejo.numero_car,
                nome_fazenda: pManejo.nome_fazenda || lManejo.nome_fazenda,
                nome_proprietario: pManejo.nome_proprietario || lManejo.nome_proprietario,
                cidade: pManejo.cidade || lManejo.cidade,
                vencimento: pManejo.vencimento || lManejo.vencimento,
                status: pManejo.status || lManejo.status,
                arquivo_url: pManejo.arquivo_url || lManejo.arquivo_url,
                manejo_em_renovacao: pManejo.manejo_em_renovacao !== undefined ? pManejo.manejo_em_renovacao : lManejo.manejo_em_renovacao,
                empresa_id: despachanteEmpresaId
              };
              await supabase.from('autorizacoes_manejo').update(payload).eq('id', lManejo.id);
            } else if (clienteCac.id && clienteCac.id !== cliente.id) {
              const payload = {
                id: uuidv4(),
                cliente_id: clienteCac.id,
                numero_car: lManejo.numero_car,
                nome_fazenda: lManejo.nome_fazenda,
                nome_proprietario: lManejo.nome_proprietario,
                cidade: lManejo.cidade,
                vencimento: lManejo.vencimento,
                status: lManejo.status || 'Ativo',
                arquivo_url: lManejo.arquivo_url,
                manejo_em_renovacao: !!lManejo.manejo_em_renovacao,
                empresa_id: vinculo.cac_empresa_id
              };
              await supabase.from('autorizacoes_manejo').insert([payload]);
            }
          }

          for (const pManejo of (portalManejos || [])) {
            const key = matchManejoKey(pManejo);
            if (!localManejosByKey.has(key)) {
              const payload = {
                id: uuidv4(),
                cliente_id: cliente.id,
                numero_car: pManejo.numero_car,
                nome_fazenda: pManejo.nome_fazenda,
                nome_proprietario: pManejo.nome_proprietario,
                cidade: pManejo.cidade,
                vencimento: pManejo.vencimento,
                status: pManejo.status || 'Ativo',
                arquivo_url: pManejo.arquivo_url,
                manejo_em_renovacao: !!pManejo.manejo_em_renovacao,
                empresa_id: despachanteEmpresaId
              };
              await supabase.from('autorizacoes_manejo').insert([payload]);
            }
          }
        } catch (syncAcervoErr) {
          console.error('Erro ao sincronizar acervo profundo:', syncAcervoErr);
        }
      } catch (err) {
        console.error('Erro ao sincronizar dados do cliente:', err);
      }
    }

    sincronizarComPortal();

    return () => {
      cancelado = true;
    };
  }, [cliente.id, cliente.cpf, usuario?.empresaId]);

  // Sincroniza responsabilidade e alertas com outros despachantes que tenham o mesmo cliente (por CPF)
  useEffect(() => {
    const despachanteEmpresaId = usuario?.empresaId;
    if (usuario?.tipoConta === 'cac_individual' || !despachanteEmpresaId || !cliente.cpf) return;

    let cancelado = false;

    async function sincronizarResponsabilidade() {
      try {
        const cleanCpf = cliente.cpf.replace(/\D/g, '');
        const formatCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        // Busca se existe algum outro registro com o mesmo CPF no Supabase
        const { data } = await supabase
          .from('clientes')
          .select('responsavel_id, ignorar_mensagens_alertas, atualizado_em')
          .neq('id', cliente.id)
          .or(`cpf.eq.${cleanCpf},cpf.eq.${formatCpf}`)
          .order('atualizado_em', { ascending: false })
          .limit(1);

        if (cancelado) return;

        if (data && data.length > 0) {
          const maisRecente = data[0];
          
          // Compara as datas de atualização
          const dataMaisRecente = new Date(maisRecente.atualizado_em);
          const dataLocal = cliente.atualizadoEm ? new Date(cliente.atualizadoEm) : new Date(0);
          
          if (dataMaisRecente > dataLocal) {
            const responsavelDiferente = maisRecente.responsavel_id !== cliente.responsavelId;
            const alertasDiferentes = maisRecente.ignorar_mensagens_alertas !== cliente.ignorarMensagensAlertas;

            if (responsavelDiferente || alertasDiferentes) {
              console.log('Sincronizando responsabilidade do cliente via CPF com outro despachante:', maisRecente);
              await atualizarCliente(cliente.id, {
                responsavelId: maisRecente.responsavel_id,
                ignorarMensagensAlertas: maisRecente.ignorar_mensagens_alertas
              });
            }
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar responsabilidade por CPF:', err);
      }
    }

    sincronizarResponsabilidade();

    return () => {
      cancelado = true;
    };
  }, [cliente.id, cliente.cpf, cliente.responsavelId, cliente.ignorarMensagensAlertas, cliente.atualizadoEm, usuario?.empresaId, atualizarCliente]);

  // Conta os alertas de documentos em background para o badge da aba
  useEffect(() => {
    let cancelado = false;

    async function carregarEContarAlertas() {
      if (!cliente.id) return;
      try {
        let crVenc = cliente.vencimentoCr;
        let crIbamaVenc = cliente.vencimentoCrIbama;
        let armasList: any[] = [];
        let gtsList: any[] = [];
        let manejosList: any[] = [];

        if (cacEmpresaId && usuario?.empresaId) {
          const acervo = await buscarAcervoVinculado(cacEmpresaId, usuario.empresaId);
          if (cancelado) return;
          if (acervo) {
            crVenc = acervo.cliente.vencimentoCr;
            crIbamaVenc = acervo.cliente.vencimentoCrIbama;
            armasList = acervo.armas;
            acervo.armas.forEach(a => {
              gtsList.push(...(a.gts || []));
            });
            manejosList = acervo.manejos || [];
          }
        } else {
          const [armasData, manejosData] = await Promise.all([
            buscarArmas(cliente.id, cacEmpresaId),
            buscarManejos(cliente.id, cacEmpresaId)
          ]);
          if (cancelado) return;
          armasList = armasData || [];
          manejosList = manejosData || [];
          await Promise.all((armasData || []).map(async (a) => {
            const gts = await buscarGts(a.id);
            if (gts) gtsList.push(...gts);
          }));
        }

        if (cancelado) return;

        const isAlerta = (venc: string | null | undefined, tipo: 'CR' | 'IBAMA_CR' | 'CRAF' | 'GT' | 'MANEJO') => {
          if (!venc) return false;
          const res = calcularAlerta(tipo, venc);
          return res.nivel !== 'OK';
        };

        let count = 0;
        if (isAlerta(crVenc, 'CR')) count++;
        if (isAlerta(crIbamaVenc, 'IBAMA_CR')) count++;
        armasList.forEach(a => { if (isAlerta(a.vencimentoCraf || a.vencimento_craf, 'CRAF')) count++; });
        gtsList.forEach(g => { if (isAlerta(g.vencimento, 'GT')) count++; });
        manejosList.forEach(m => { if (m.status !== 'Inerte' && isAlerta(m.vencimento, 'MANEJO')) count++; });

        setAlertasCount(count);
      } catch (err) {
        console.error('Erro ao calcular contagem de alertas:', err);
      }
    }

    carregarEContarAlertas();

    return () => {
      cancelado = true;
    };
  }, [cliente.id, cliente.vencimentoCr, cliente.vencimentoCrIbama, cacEmpresaId, usuario?.empresaId]);

  const handleCopiarSenha = (senha: string) => {
    navigator.clipboard.writeText(senha);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 2000);
  };

  const acoesRapidas = [
    { 
      label: 'Gerar O.S.', 
      icon: <FileText size={20} />, 
      color: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
      path: '/ordens/nova',
      slug: 'ordens'
    },
    { 
      label: 'Gerar Orçamento', 
      icon: <Receipt size={20} />, 
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      path: '/orcamentos/novo',
      slug: 'orcamentos'
    },
    { 
      label: 'Gerar Recibo', 
      icon: <FileText size={20} />, 
      color: 'bg-brand-green/10 text-brand-green border-brand-green/20',
      path: '/recibos/novo',
      slug: 'recibos'
    },
    { 
      label: 'Agendar Laudo', 
      icon: <Calendar size={20} />, 
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      path: '/agendamentos',
      slug: 'agendamentos'
    },
    { 
      label: 'Iniciar Conversa', 
      icon: <MessageCircle size={20} />, 
      color: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/20',
      onClick: () => {
        const isMainCompany = usuario?.empresaId === '00000000-0000-0000-0000-000000000001';
        if (isMainCompany && cliente.ignorarMensagensAlertas) {
          if (!window.confirm('Atenção: Os documentos de IBAMA deste cliente são de responsabilidade do Wilton. Deseja iniciar a conversa por WhatsApp mesmo assim?')) {
            return;
          }
        }
        setModalWhatsAppAberto(true);
      },
      slug: null
    },
    { 
      label: 'Gerar Declaração', 
      icon: <FileText size={20} />, 
      color: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 hover:bg-brand-blue/20',
      onClick: () => navigate(`/declaracoes?clienteId=${cliente.id}`),
      slug: 'clientes'
    },
  ].filter(acao => {
    if (usuario?.tipoConta === 'cac_individual') {
      return false;
    }
    return !acao.slug || temPermissao(acao.slug);
  });

  const handleAcao = (acao: any) => {
    if (acao.onClick) {
      acao.onClick();
    } else {
      navigate(acao.path, { state: { clientePreDefinido: cliente } });
    }
  };

  const handleDeletar = async () => {
    try {
      await deletarCliente(cliente.id);
      navigate('/clientes');
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      alert('Falha ao excluir o cliente. Verifique se existem registros vinculados.');
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          
          atualizarCliente(cliente.id, { fotoUrl: base64 })
            .then(() => {
              if (usuario?.tipoConta === 'cac_individual') {
                const dadosUsuario = localStorage.getItem('gcac_usuario');
                if (dadosUsuario) {
                  const u = JSON.parse(dadosUsuario);
                  u.fotoPerfil = base64;
                  localStorage.setItem('gcac_usuario', JSON.stringify(u));
                }
              }
              window.location.reload();
            })
            .catch(err => {
              console.error('Erro ao atualizar foto de perfil:', err);
              alert('Erro ao salvar a foto de perfil.');
            });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {usuario?.tipoConta !== 'cac_individual' && (
            <button 
              onClick={() => navigate('/clientes')}
              className="p-2 bg-brand-dark-3 border border-brand-dark-5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
              {cliente.nome}
              {portalStatus === 'ativo' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-green/20 border border-brand-green/30 text-brand-green">
                  Portal GCAC: Ativo • {podeEditarVinculo ? 'Edição Habilitada' : 'Somente Leitura'}
                </span>
              )}
              {portalStatus === 'pendente' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                  Portal GCAC: Convite Pendente
                </span>
              )}
              {isUsuarioPortal === true && portalStatus !== 'ativo' && portalStatus !== 'pendente' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-blue/20 border border-brand-blue/30 text-brand-blue-light">
                  Usuário do Portal GCAC (Sem Vínculo)
                </span>
              )}
              {isUsuarioPortal === false && portalStatus !== 'ativo' && portalStatus !== 'pendente' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400">
                  Não cadastrado no Portal GCAC
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">
              {usuario?.tipoConta === 'cac_individual' ? 'Meu Acervo & Documentação' : 'Perfil do Cliente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setEditando(true)}
            className="btn-ghost px-3 py-1.5 text-sm font-black uppercase tracking-wider flex items-center gap-2 border border-brand-dark-5"
          >
            <Pencil size={16} />
            Editar Cadastro
          </button>

          {/* Botão de convite para Portal CAC (apenas despachantes/empresa) */}
          {usuario?.tipoConta !== 'cac_individual' && (usuario?.role === 'admin' || temAcessoRecurso('modulo_clientes_cac')) && (
            <BotaoConvidarCac cliente={cliente} isUsuarioPortal={isUsuarioPortal} portalStatus={portalStatus} />
          )}
          
          {usuario?.tipoConta !== 'cac_individual' && (
            <button 
              onClick={() => setConfirmandoDelete(true)}
              className="btn-danger-soft px-3 py-1.5 text-sm font-black uppercase tracking-wider"
            >
              <Trash2 size={16} />
              Excluir Cliente
            </button>
          )}
        </div>
      </div>

      {renderBannerResponsabilidade()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Coluna Esquerda: Cadastro ── */}
        <div className="space-y-6">
          <div className="card border-brand-blue/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Informações Pessoais</span>
              <User size={16} className="text-brand-blue" />
            </div>

            <div className="space-y-4">
              {/* Foto de Perfil (Disponível apenas para CAC Individual) */}
              {usuario?.tipoConta === 'cac_individual' && (
                <div className="flex flex-col items-center justify-center pb-4 border-b border-brand-dark-5">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-blue/30 group-hover:border-brand-blue transition-all flex items-center justify-center bg-brand-dark-2">
                      {cliente.fotoUrl ? (
                        <img src={cliente.fotoUrl} alt={cliente.nome} className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-gray-600 group-hover:text-brand-blue-light transition-colors" />
                      )}
                    </div>
                    
                    <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider transition-opacity duration-200">
                      <Pencil size={14} className="mb-1" />
                      Alterar
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">Foto de Perfil</p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Nome Completo</p>
                <p className="text-white font-semibold text-lg">{cliente.nome}</p>
              </div>
              {nomeResponsavel && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Despachante Responsável (IBAMA)</p>
                  <p className="text-white font-medium text-sm uppercase">{nomeResponsavel}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CPF</p>
                  <p className="text-white font-medium">{formatarCPF(cliente.cpf)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Telefone</p>
                  <p className="text-white font-medium">{formatarTelefone(cliente.contato)}</p>
                </div>
              </div>
              {cliente.email && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">E-mail</p>
                  <p className="text-white font-medium text-sm break-all">{cliente.email}</p>
                </div>
              )}
              {cliente.endereco && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Endereço</p>
                  <p className="text-white font-medium text-sm uppercase">{cliente.endereco}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                  Clube de Tiro e Caça Filiado
                </p>
                <p className="text-white font-medium uppercase text-sm">
                  {cliente.filiadoProTiro ? (
                    <span className="text-brand-green font-bold">
                      {usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE DE TIRO E CAÇA PRÓ TIRO'}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {cliente.clubeFiliado || 'NÃO FILIADO'}
                    </span>
                  )}
                </p>
              </div>

              {(cliente.numeroCr || cliente.vencimentoCr) && (
                <div className="pt-2 border-t border-brand-dark-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CR Exército / PF</p>
                    <p className="text-white font-medium">
                      {cliente.numeroCr || 'Não informado'} 
                      {cliente.vencimentoCr && <span className="text-gray-500 text-xs ml-2">({formatarData(cliente.vencimentoCr)})</span>}
                    </p>
                    {(cliente.crTiroDesportivo || cliente.crCaca || cliente.crColecionamento) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {cliente.crTiroDesportivo && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-brand-green/10 border border-brand-green/30 text-brand-green">
                            Atirador{cliente.atiradorNivel ? ` • Nível ${cliente.atiradorNivel}` : ''}
                          </span>
                        )}
                        {cliente.crCaca && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            Caçador
                          </span>
                        )}
                        {cliente.crColecionamento && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400">
                            Colecionador
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {cliente.crUrl && (
                    <button 
                      onClick={() => visualizarDocumentoBase64(cliente.crUrl!, `CR-${cliente.numeroCr || 'exercito'}`)}
                      className="p-1.5 rounded-lg bg-brand-dark-3 text-brand-blue hover:text-brand-blue-light border border-brand-dark-5 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                      title="Visualizar CR Exército"
                    >
                      <FileText size={14} /> Ver Doc
                    </button>
                  )}
                </div>
              )}

              {(cliente.numeroCrIbama || cliente.vencimentoCrIbama) && (
                <div className="pt-2 border-t border-brand-dark-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CR IBAMA</p>
                    <p className="text-white font-medium">
                      {cliente.numeroCrIbama || 'Não informado'} 
                      {cliente.vencimentoCrIbama && <span className="text-gray-500 text-xs ml-2">({formatarData(cliente.vencimentoCrIbama)})</span>}
                    </p>
                  </div>
                  {cliente.crIbamaUrl && (
                    <button 
                      onClick={() => visualizarDocumentoBase64(cliente.crIbamaUrl!, `CR-IBAMA-${cliente.numeroCrIbama || 'ibama'}`)}
                      className="p-1.5 rounded-lg bg-brand-dark-3 text-brand-blue hover:text-brand-blue-light border border-brand-dark-5 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                      title="Visualizar CR IBAMA"
                    >
                      <FileText size={14} /> Ver Doc
                    </button>
                  )}
                </div>
              )}
              </div>
            </div>

            {cliente.acordoComercial && (
              <div className="card bg-amber-500/5 border-amber-500/20 shadow-amber-500/5 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <p className="text-xs text-amber-400 font-black uppercase tracking-wider">Acordo Comercial / Combinado Financeiro</p>
                </div>
                <p className="text-sm text-amber-200/90 font-medium whitespace-pre-wrap leading-relaxed">
                  {cliente.acordoComercial}
                </p>
              </div>
            )}

            {cliente.observacoes && (
              <div className="card bg-brand-dark-3/50 border-brand-dark-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-brand-blue" />
                  <p className="text-xs text-white font-bold uppercase tracking-wider">Observações</p>
                </div>
                <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {cliente.observacoes}
                </p>
              </div>
            )}

            <div className="card bg-brand-dark-3/50 border-brand-dark-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-blue" />
                  <p className="text-xs text-white font-bold uppercase tracking-wider">Acesso GOV.BR</p>
                </div>
                <button 
                  onClick={() => handleCopiarSenha(cliente.senhaGov)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    copiou ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30'
                  }`}
                >
                  {copiou ? <Check size={12} /> : <Copy size={12} />}
                  {copiou ? 'Copiado!' : 'Copiar Senha'}
                </button>
              </div>
              <div className="bg-brand-dark-2 p-3 rounded-lg border border-brand-dark-5 font-mono text-xl text-brand-blue-light tracking-widest text-center">
                {cliente.senhaGov}
              </div>
            </div>
          </div>

        {/* ── Coluna Direita: Ações e Histórico ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ações Rápidas */}
          {acoesRapidas.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {acoesRapidas.map((acao) => (
                <button
                  key={acao.label}
                  onClick={() => handleAcao(acao)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg ${acao.color}`}
                >
                  <div className="mb-2">{acao.icon}</div>
                  <span className="text-[10px] font-black uppercase text-center leading-tight">{acao.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Histórico com Tabs */}
          <div className="card p-0 overflow-hidden border-brand-dark-5">
            <div className="flex bg-brand-dark-3 border-b border-brand-dark-5 overflow-x-auto">
              {tabsDisponiveis.map(tab => (
                <TabButton 
                  key={tab.id}
                  ativo={abaAtiva === tab.id} 
                  onClick={() => setAbaAtiva(tab.id as any)} 
                  count={tab.id === 'ordens' && !mostrarTodasOrdens ? ordensClienteAbertas.length : tab.count}
                  isAlert={tab.id === 'documentos' && tab.count > 0}
                >
                  {tab.label}
                </TabButton>
              ))}
            </div>

            <div className="p-4">
              {abaAtiva === 'ordens' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      {mostrarTodasOrdens ? 'Todas as Ordens' : 'Ordens em Aberto'}
                    </h3>
                    <button 
                      onClick={() => setMostrarTodasOrdens(!mostrarTodasOrdens)}
                      className="text-[10px] font-bold text-brand-blue hover:text-white transition-colors uppercase tracking-wider underline underline-offset-4"
                    >
                      {mostrarTodasOrdens ? 'Ver apenas abertas' : `Ver histórico completo (${todasOrdensCliente.length})`}
                    </button>
                  </div>
                  <HistoryList 
                    items={ordensExibidas.map(o => ({ 
                      id: o.id, 
                      title: `OS #${String(o.numero).padStart(4, '0')}`, 
                      date: o.criadoEm, 
                      value: o.valor, 
                      status: o.status,
                      path: `/ordens/${o.id}`,
                      servicos: o.servicos ? o.servicos.map(s => ({
                        nome: s.nome,
                        statusExecucao: s.statusExecucao
                      })) : [],
                      execucao: o.servicos ? obterResumoExecucao(o.servicos) : null
                    }))} 
                    emptyMsg={mostrarTodasOrdens ? "Nenhuma ordem de serviço encontrada para este cliente." : "Não há ordens de serviço em aberto para este cliente."}
                  />
                </div>
              )}
              {abaAtiva === 'orcamentos' && (
                <HistoryList 
                  items={orcamentosCliente.map(o => ({ 
                    id: o.id, 
                    title: `Orçamento #${String(o.numero).padStart(4, '0')}`, 
                    date: o.criadoEm, 
                    value: o.valorTotal, 
                    status: o.status,
                    path: `/orcamentos/${o.id}`,
                    servicos: o.servicos ? o.servicos.map(s => s.nome) : []
                  }))} 
                  emptyMsg="Nenhum orçamento encontrado para este cliente."
                />
              )}
              {abaAtiva === 'recibos' && (
                <HistoryList 
                  items={recibosCliente.map(r => ({ 
                    id: r.id, 
                    title: `Recibo #${String(r.numero).padStart(4, '0')}`, 
                    date: r.criadoEm, 
                    value: r.valorTotal, 
                    status: 'Pago',
                    path: `/recibos/${r.id}`,
                    servicos: r.servicos ? r.servicos.map(s => s.nome) : []
                  }))} 
                  emptyMsg="Nenhum recibo encontrado para este cliente."
                />
              )}
              {abaAtiva === 'agendamentos' && (
                <HistoryList 
                  items={agendamentosCliente.map(a => ({ 
                    id: a.id, 
                    title: `${a.tipo} - ${a.local}`, 
                    date: a.data, 
                    value: a.valor, 
                    status: a.confirmado ? 'Confirmado' : 'Pendente',
                    path: '/agendamentos'
                  }))} 
                  emptyMsg="Nenhum agendamento encontrado para este cliente."
                />
              )}
              {abaAtiva === 'documentos' && (
                <AbaDocumentacao 
                  cliente={cliente} 
                  armaIdInicial={(location.state as any)?.armaId}
                  cacEmpresaId={cacEmpresaId}
                  podeEditarVinculo={podeEditarVinculo}
                />
              )}
              {abaAtiva === 'creditos' && (
                <div className="pt-2">
                  <AbaCreditos cliente={cliente} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalEscolhaWhatsApp 
        aberto={modalWhatsAppAberto}
        onFechar={() => setModalWhatsAppAberto(false)}
        telefone={cliente.contato}
        mensagem={`Olá, ${cliente.nome}!`}
      />

      <DialogConfirmacao
        aberto={confirmandoDelete}
        titulo="Excluir Cliente"
        mensagem={`Tem certeza que deseja excluir o cadastro de ${cliente.nome}? Esta ação apagará permanentemente os dados do cliente.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(false)}
      />

      {editando && (
        <FormularioCliente 
          clienteEditando={cliente}
          onFechar={() => setEditando(false)}
        />
      )}

      {mostrarPromptCR && (
        <ModalPromptCr
          cliente={cliente}
          onFechar={() => {
            sessionStorage.setItem(`prompt-cr-ignorado-${cliente.id}`, 'true');
            setMostrarPromptCR(false);
          }}
          onSalvar={async (atividades) => {
            try {
              await atualizarCliente(cliente.id, atividades, cacEmpresaId);
              // Marcar como salvo no sessionStorage para evitar reexibição enquanto
              // o contexto ainda não refletiu os novos dados
              sessionStorage.setItem(`prompt-cr-ignorado-${cliente.id}`, 'true');
              setMostrarPromptCR(false);
            } catch (err: any) {
              console.error(err);
              alert('Erro ao salvar atividades do CR: ' + (err.message || err));
            }
          }}
        />
      )}
    </div>
  );
}

interface ModalPromptCrProps {
  cliente: Cliente;
  onFechar: () => void;
  onSalvar: (atividades: { crTiroDesportivo: boolean; crCaca: boolean; crColecionamento: boolean; atiradorNivel: number | null }) => Promise<void>;
}

function ModalPromptCr({ cliente, onFechar, onSalvar }: ModalPromptCrProps) {
  const [crTiroDesportivo, setCrTiroDesportivo] = useState(false);
  const [crCaca, setCrCaca] = useState(false);
  const [crColecionamento, setCrColecionamento] = useState(false);
  const [atiradorNivel, setAtiradorNivel] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar({
        crTiroDesportivo,
        crCaca,
        crColecionamento,
        atiradorNivel: crTiroDesportivo ? atiradorNivel : null
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-brand-dark-2 w-full max-w-md rounded-2xl border border-brand-dark-5 p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
        
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-blue/10 p-2.5 rounded-xl border border-brand-blue/20">
              <Shield size={24} className="text-brand-blue" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Atividades do CR</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest leading-none mt-1">Atualização Requerida</p>
            </div>
          </div>
          <button 
            onClick={onFechar}
            className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 bg-brand-dark-3 border border-brand-dark-5 rounded-xl text-xs text-gray-400 leading-relaxed">
            O cliente <strong className="text-white">{cliente.nome}</strong> possui o CR <strong className="text-white">{cliente.numeroCr}</strong> cadastrado, mas as atividades e o nível de atirador ainda não foram configurados.
          </div>

          <div className="space-y-3">
            <label className="label text-[10px] font-black uppercase tracking-wider text-gray-500">Atividades Apostiladas (CR)</label>
            <div className="grid grid-cols-3 gap-2 bg-brand-dark-3 p-3.5 rounded-xl border border-brand-dark-5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300 font-medium">
                <input type="checkbox"
                  checked={crTiroDesportivo} onChange={e => {
                    setCrTiroDesportivo(e.target.checked);
                    if (!e.target.checked) setAtiradorNivel(null);
                  }}
                  className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-4 h-4" />
                Tiro Desp.
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300 font-medium">
                <input type="checkbox"
                  checked={crCaca} onChange={e => setCrCaca(e.target.checked)}
                  className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-4 h-4" />
                Caça
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300 font-medium">
                <input type="checkbox"
                  checked={crColecionamento} onChange={e => setCrColecionamento(e.target.checked)}
                  className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-4 h-4" />
                Colecionam.
              </label>
            </div>

            {crTiroDesportivo && (
              <div className="p-3.5 bg-brand-dark-3 rounded-xl border border-brand-dark-5 space-y-2">
                <label className="label text-[11px] font-bold text-gray-400">Nível do Atirador <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                  {[1, 2, 3].map(n => (
                    <label key={n} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 font-medium">
                      <input type="radio" name="modalAtiradorNivel"
                        value={n} checked={atiradorNivel === n}
                        onChange={e => setAtiradorNivel(Number(e.target.value))}
                        className="bg-brand-dark-4 border-brand-dark-5 text-brand-blue focus:ring-0 w-4 h-4" />
                      Nível {n}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <button 
            onClick={onFechar} 
            disabled={salvando}
            className="btn-ghost flex-1 py-2 text-xs uppercase font-bold"
          >
            Depois
          </button>
          <button 
            onClick={handleSalvar}
            disabled={salvando || (!crTiroDesportivo && !crCaca && !crColecionamento) || (crTiroDesportivo && !atiradorNivel)}
            className="btn-primary flex-1 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ children, ativo, onClick, count, isAlert }: { children: React.ReactNode, ativo: boolean, onClick: () => void, count: number, isAlert?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 lg:px-4 py-4 text-[11px] lg:text-xs font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
        ativo ? 'text-brand-blue border-brand-blue bg-brand-blue/5' : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
          isAlert 
            ? 'bg-red-500 text-white font-bold animate-pulse' 
            : (ativo ? 'bg-brand-blue text-white' : 'bg-brand-dark-5 text-gray-500')
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function HistoryList({ items, emptyMsg }: { items: any[], emptyMsg: string }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-500 text-sm">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div 
          key={item.id} 
          onClick={() => navigate(item.path)}
          className="flex items-start justify-between p-3 rounded-xl bg-brand-dark-3 border border-brand-dark-5 hover:border-brand-blue/30 transition-all cursor-pointer group"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-brand-dark-2 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{item.title}</p>
              <p className="text-[10px] text-gray-500">{formatarData(item.date)}</p>
              
              {item.execucao && (
                <div className="mt-1 flex items-center gap-1.5 w-fit">
                  {item.execucao.tipo === 'unificado' ? (
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${item.execucao.classe}`}>
                      {item.execucao.icone} {item.execucao.texto}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 w-fit">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter whitespace-nowrap">
                        {item.execucao.texto}
                      </span>
                      <div className="w-12 h-1 bg-brand-dark-5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-brand-blue transition-all duration-500 shadow-[0_0_6px_rgba(45,141,224,0.4)]"
                          style={{ width: `${item.execucao.progresso}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-bold text-brand-blue-light">{item.execucao.progresso}%</span>
                    </div>
                  )}
                </div>
              )}

              {item.servicos && item.servicos.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.servicos.map((servico: any, idx: number) => {
                    const isObj = typeof servico === 'object' && servico !== null;
                    const nome = isObj ? servico.nome : servico;
                    const statusExec = isObj ? servico.statusExecucao : undefined;

                    let icon = '';
                    let badgeClass = 'bg-brand-dark-2 text-brand-blue-light border-brand-dark-5';

                    if (statusExec) {
                      icon = iconeStatusExecucao(statusExec);
                      switch (statusExec) {
                        case 'Não Iniciado':
                          badgeClass = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                          break;
                        case 'Iniciado — Montando Processo':
                          badgeClass = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
                          break;
                        case 'Aguardando Documentos':
                          badgeClass = 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
                          break;
                        case 'Protocolado — Ag. PF':
                          badgeClass = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                          break;
                        case 'Concluído':
                          badgeClass = 'bg-green-500/10 text-green-300 border-green-500/20';
                          break;
                      }
                    }

                    return (
                      <span 
                        key={idx} 
                        className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold uppercase tracking-wider flex items-center flex-wrap gap-1 whitespace-normal break-words max-w-full ${badgeClass}`}
                        title={statusExec}
                      >
                        {icon && <span>{icon}</span>}
                        <span>{nome}</span>
                        {statusExec && <span className="text-[8px] opacity-75 font-normal">({statusExec})</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 ml-4 self-center">
            <div className="text-right">
              <p className="text-sm font-bold text-white">{formatarMoeda(item.value)}</p>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${
                item.status === 'Pago' ? 'text-brand-green' :
                item.status === 'Gratuidade' ? 'text-purple-400' :
                item.status === 'Aguardando Pagamento' ? 'text-yellow-500' :
                item.status === 'Parcialmente Pago' ? 'text-orange-400' :
                'text-gray-400'
              }`}>{item.status}</p>
            </div>
            <ChevronRight size={16} className="text-gray-600 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
