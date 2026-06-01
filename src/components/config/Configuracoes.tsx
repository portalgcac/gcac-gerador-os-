import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';
import { useOrdens } from '../../context/OrdensContext';
import { useServicos } from '../../context/ServicosContext';
import { useClientes } from '../../context/ClientesContext';
import { sincronizarPendentes } from '../../services/driveSync';
import { 
  LogOut, Cloud, RefreshCw, User, Wifi, WifiOff, ShieldCheck, 
  Plus, Settings2, Edit2, Trash2, BadgeDollarSign, ChevronDown,
  HelpCircle, FileText, CheckSquare, Square, DownloadCloud,
  ShieldAlert, Shield, Target, MapPin, Calendar, Download,
  Link2, Unlink, Landmark, Loader2, Bell, BellOff, Smartphone, CheckCircle2,
  Upload, Database
} from 'lucide-react';
import { supabase } from '../../db/supabase';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { ModalServico } from './ModalServico';
import { GestaoUsuarios } from './GestaoUsuarios';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { compressImage, uploadBase64File } from '../../utils/fileUtils';
import { ServicoConfig } from '../../types';
import { CONTEUDO_MANUAL } from '../../services/manualService';
import { baixarManualPdf } from '../../services/geradorPdfManual';
import { exportarAcervoPdf, exportarAcervoExcel } from '../../services/geradorExportacaoAcervo';
import { incrementarExportacao } from '../../services/adminCacService';
import { buscarVinculosCAC, revogarVinculo } from '../../services/vinculosService';
import {
  ativarNotificacoesPush,
  desativarNotificacoesPush,
  verificarSubscriptionAtiva,
  verificarStatusPermissao,
  suportaPushNotification,
  enviarNotificacaoTeste,
  isIOS,
  isPWAInstalado
} from '../../services/pushNotificationService';

export function Configuracoes() {
  const { usuario, logout, refreshUsuario, temAcessoRecurso } = useAuth();
  const isCac = usuario?.tipoConta === 'cac_individual';
  const { ordens } = useOrdens();
  const { servicos, deletarServico } = useServicos();
  const { clientes, buscarArmas, buscarGts, buscarManejos } = useClientes();
  const itensFila = ordens.filter(o => o.pendenteSincronizacao).length;
  
  const online = useStatusConexao();
  const navigate = useNavigate();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [sincronizando, setSincronizando] = useState(false);
  
  // Controle de Modal de Serviços
  const [modalAberto, setModalAberto] = useState(false);
  const [servicoEditando, setServicoEditando] = useState<ServicoConfig | null>(null);
  // Controle de Seções Retráteis
  const [servicosExpandido, setServicosExpandido] = useState(false);
  const [usuariosExpandido, setUsuariosExpandido] = useState(false);
  const [manualExpandido, setManualExpandido] = useState(false);
  const [empresaExpandido, setEmpresaExpandido] = useState(false);
  const [alertasExpandido, setAlertasExpandido] = useState(false);
  const [otimizacaoExpandido, setOtimizacaoExpandido] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [progressoMigracao, setProgressoMigracao] = useState('');

  const salvarAlertaEmpresa = (chave: string, valor: string) => {
    localStorage.setItem(chave, valor);
    mostrar('sucesso', 'Prazo de alerta atualizado!');
  };

  const handleMigrarArquivosParaStorage = async () => {
    if (!usuario?.empresaId) return;
    if (!window.confirm('Deseja iniciar a migração de documentos antigos para o Supabase Storage? Isso removerá as imagens/PDFs pesados de dentro do banco de dados e os converterá em links rápidos. Esse processo pode demorar alguns minutos dependendo do volume de dados.')) {
      return;
    }

    setMigrando(true);
    setProgressoMigracao('Iniciando migração...');

    try {
      let totalMigrados = 0;

      // 1. Clientes
      setProgressoMigracao('Buscando clientes para migração...');
      const { data: dbClientes, error: errC } = await supabase
        .from('clientes')
        .select('id, nome, cr_url, cr_ibama_url')
        .eq('empresa_id', usuario.empresaId);
      
      if (errC) throw errC;

      if (dbClientes) {
        const clientesParaMigrar = dbClientes.filter(c => 
          (c.cr_url && c.cr_url.startsWith('data:')) || 
          (c.cr_ibama_url && c.cr_ibama_url.startsWith('data:'))
        );

        for (let i = 0; i < clientesParaMigrar.length; i++) {
          const c = clientesParaMigrar[i];
          setProgressoMigracao(`Migrando documentos do cliente (${i + 1}/${clientesParaMigrar.length}): ${c.nome}...`);

          let crUrl = c.cr_url;
          let crIbamaUrl = c.cr_ibama_url;

          if (crUrl && crUrl.startsWith('data:')) {
            const ext = crUrl.split(';base64,')[0]?.split(':')[1]?.split('/')[1] || 'pdf';
            const path = `${usuario.empresaId}/clientes/${c.id}/cr_${uuidv4()}.${ext}`;
            crUrl = await uploadBase64File(crUrl, 'documentos-clientes', path) || '';
          }

          if (crIbamaUrl && crIbamaUrl.startsWith('data:')) {
            const ext = crIbamaUrl.split(';base64,')[0]?.split(':')[1]?.split('/')[1] || 'pdf';
            const path = `${usuario.empresaId}/clientes/${c.id}/cr_ibama_${uuidv4()}.${ext}`;
            crIbamaUrl = await uploadBase64File(crIbamaUrl, 'documentos-clientes', path) || '';
          }

          const { error: errUpdate } = await supabase
            .from('clientes')
            .update({ cr_url: crUrl || null, cr_ibama_url: crIbamaUrl || null })
            .eq('id', c.id);

          if (errUpdate) console.error(`Erro ao atualizar cr do cliente ${c.nome}:`, errUpdate);
          else totalMigrados++;
        }
      }

      // 2. Armas
      setProgressoMigracao('Buscando armas para migração...');
      const { data: dbArmas, error: errA } = await supabase
        .from('armas')
        .select('id, cliente_id, craf_url, numero_serie')
        .eq('empresa_id', usuario.empresaId);

      if (errA) throw errA;

      if (dbArmas) {
        const armasParaMigrar = dbArmas.filter(a => a.craf_url && a.craf_url.startsWith('data:'));

        for (let i = 0; i < armasParaMigrar.length; i++) {
          const a = armasParaMigrar[i];
          setProgressoMigracao(`Migrando CRAF da arma (${i + 1}/${armasParaMigrar.length}) Série ${a.numero_serie}...`);

          let crafUrl = a.craf_url;
          const ext = crafUrl.split(';base64,')[0]?.split(':')[1]?.split('/')[1] || 'pdf';
          const path = `${usuario.empresaId}/clientes/${a.cliente_id}/armas/${a.id}/craf_${uuidv4()}.${ext}`;
          crafUrl = await uploadBase64File(crafUrl, 'documentos-clientes', path) || '';

          const { error: errUpdate } = await supabase
            .from('armas')
            .update({ craf_url: crafUrl || null })
            .eq('id', a.id);

          if (errUpdate) console.error(`Erro ao atualizar craf da arma ${a.id}:`, errUpdate);
          else totalMigrados++;
        }
      }

      // 3. Guias de Tráfego
      setProgressoMigracao('Buscando guias de tráfego para migração...');
      const { data: dbGts, error: errG } = await supabase
        .from('guias_trafego')
        .select('id, arma_id, arquivo_url')
        .eq('empresa_id', usuario.empresaId);

      if (errG) throw errG;

      if (dbGts) {
        const gtsParaMigrar = dbGts.filter(g => g.arquivo_url && g.arquivo_url.startsWith('data:'));

        for (let i = 0; i < gtsParaMigrar.length; i++) {
          const g = gtsParaMigrar[i];
          setProgressoMigracao(`Migrando Guia de Tráfego (${i + 1}/${gtsParaMigrar.length})...`);

          let arquivoUrl = g.arquivo_url;
          const ext = arquivoUrl.split(';base64,')[0]?.split(':')[1]?.split('/')[1] || 'pdf';
          const path = `${usuario.empresaId}/armas/${g.arma_id}/gts/${g.id}/gt_${uuidv4()}.${ext}`;
          arquivoUrl = await uploadBase64File(arquivoUrl, 'documentos-clientes', path) || '';

          const { error: errUpdate } = await supabase
            .from('guias_trafego')
            .update({ arquivo_url: arquivoUrl || null })
            .eq('id', g.id);

          if (errUpdate) console.error(`Erro ao atualizar gt ${g.id}:`, errUpdate);
          else totalMigrados++;
        }
      }

      // 4. Autorizações de Manejo
      setProgressoMigracao('Buscando autorizações de manejo para migração...');
      const { data: dbManejos, error: errM } = await supabase
        .from('autorizacoes_manejo')
        .select('id, cliente_id, nome_fazenda, arquivo_url')
        .eq('empresa_id', usuario.empresaId);

      if (errM) throw errM;

      if (dbManejos) {
        const manejosParaMigrar = dbManejos.filter(m => m.arquivo_url && m.arquivo_url.startsWith('data:'));

        for (let i = 0; i < manejosParaMigrar.length; i++) {
          const m = manejosParaMigrar[i];
          setProgressoMigracao(`Migrando Autorização de Manejo (${i + 1}/${manejosParaMigrar.length}): ${m.nome_fazenda}...`);

          let arquivoUrl = m.arquivo_url;
          const ext = arquivoUrl.split(';base64,')[0]?.split(':')[1]?.split('/')[1] || 'pdf';
          const path = `${usuario.empresaId}/clientes/${m.cliente_id}/manejos/${m.id}/manejo_${uuidv4()}.${ext}`;
          arquivoUrl = await uploadBase64File(arquivoUrl, 'documentos-clientes', path) || '';

          const { error: errUpdate } = await supabase
            .from('autorizacoes_manejo')
            .update({ arquivo_url: arquivoUrl || null })
            .eq('id', m.id);

          if (errUpdate) console.error(`Erro ao atualizar manejo ${m.id}:`, errUpdate);
          else totalMigrados++;
        }
      }

      setProgressoMigracao(`Concluído! Total de arquivos migrados com sucesso: ${totalMigrados}`);
      mostrar('sucesso', 'Migração concluída com sucesso! Recarregando a página...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e: any) {
      console.error('Erro na migração:', e);
      setProgressoMigracao(`Falha na migração: ${e.message}`);
      mostrar('erro', 'Falha ao migrar arquivos: ' + e.message);
    } finally {
      setMigrando(false);
    }
  };
  
  const [formEmpresa, setFormEmpresa] = useState({
    razaoSocial: usuario?.dadosEmpresa?.razaoSocialFantasia || '',
    cnpj: usuario?.dadosEmpresa?.cnpj || '',
    endereco: usuario?.dadosEmpresa?.endereco || '',
    telefone: usuario?.dadosEmpresa?.contatoTelefone || '',
    responsavel: usuario?.dadosEmpresa?.responsavelNome || '',
    clubeParceiro: usuario?.dadosEmpresa?.clubeParceiroPadrao || '',
    logoUrl: usuario?.dadosEmpresa?.logoUrl || ''
  });
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

  useEffect(() => {
    if (usuario?.dadosEmpresa) {
      setFormEmpresa({
        razaoSocial: usuario.dadosEmpresa.razaoSocialFantasia || '',
        cnpj: usuario.dadosEmpresa.cnpj || '',
        endereco: usuario.dadosEmpresa.endereco || '',
        telefone: usuario.dadosEmpresa.contatoTelefone || '',
        responsavel: usuario.dadosEmpresa.responsavelNome || '',
        clubeParceiro: usuario.dadosEmpresa.clubeParceiroPadrao || '',
        logoUrl: usuario.dadosEmpresa.logoUrl || ''
      });
    }
  }, [usuario?.dadosEmpresa]);

  const handleSalvarEmpresa = async () => {
    if (!usuario?.empresaId) return;
    setSalvandoEmpresa(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          clube_parceiro_padrao: formEmpresa.clubeParceiro.trim().toUpperCase(),
          razao_social_fantasia: formEmpresa.razaoSocial.trim(),
          responsavel_nome: formEmpresa.responsavel.trim(),
          contato_telefone: formEmpresa.telefone.trim(),
          endereco: formEmpresa.endereco.trim(),
          cnpj: formEmpresa.cnpj.trim(),
          logo_url: formEmpresa.logoUrl || null
        })
        .eq('id', usuario.empresaId);

      if (error) throw error;

      mostrar('sucesso', 'Dados da empresa e clube parceiro atualizados com sucesso!');
      await refreshUsuario();
      setEmpresaExpandido(false);
    } catch (e: any) {
      console.error(e);
      mostrar('erro', 'Falha ao salvar dados da empresa: ' + e.message);
    } finally {
      setSalvandoEmpresa(false);
    }
  };
  
  // Controle de Seleção do Manual
  const [secoesSelecionadas, setSecoesSelecionadas] = useState<string[]>(CONTEUDO_MANUAL.map(s => s.id));
  const [gerandoManual, setGerandoManual] = useState(false);

  // Configurações do CAC Individual
  const [alertaCr, setAlertaCr] = useState(() => localStorage.getItem('config_alerta_cr') || '60');
  const [alertaCraf, setAlertaCraf] = useState(() => localStorage.getItem('config_alerta_craf') || '60');
  const [alertaGt, setAlertaGt] = useState(() => localStorage.getItem('config_alerta_gt') || '20');
  const [alertaManejo, setAlertaManejo] = useState(() => localStorage.getItem('config_alerta_manejo') || '7');
  const [ocultarIbama, setOcultarIbama] = useState(() => localStorage.getItem('config_ocultar_ibama') === 'true');
  const [exportando, setExportando] = useState(false);

  // Push Notifications
  const [pushAtivo, setPushAtivo] = useState(false);
  const [pushCarregando, setPushCarregando] = useState(false);
  const [pushPermissao, setPushPermissao] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushInstalado, setPushInstalado] = useState(false);

  useEffect(() => {
    // Verificar estado atual das notificações ao carregar
    if (suportaPushNotification()) {
      setPushPermissao(verificarStatusPermissao());
      verificarSubscriptionAtiva().then(setPushAtivo);
    } else {
      setPushPermissao('unsupported');
    }
    setPushInstalado(isPWAInstalado());
  }, []);

  // Vínculos do CAC
  const [vinculosCac, setVinculosCac] = useState<any[]>([]);
  const [carregandoVinculos, setCarregandoVinculos] = useState(false);

  const carregarVinculosCac = useCallback(async () => {
    if (!usuario?.empresaId || !isCac) return;
    setCarregandoVinculos(true);
    const dados = await buscarVinculosCAC(usuario.empresaId);
    setVinculosCac(dados.filter(d => d.status === 'ativo'));
    setCarregandoVinculos(false);
  }, [usuario, isCac]);

  useEffect(() => {
    if (isCac) {
      carregarVinculosCac();
    }
  }, [isCac, carregarVinculosCac]);

  const handleRevogarVinculoCac = async (vinculoId: string, despachanteNome: string) => {
    if (!usuario?.empresaId || !confirm(`Deseja revogar o acesso do despachante "${despachanteNome}" ao seu acervo?`)) return;
    const res = await revogarVinculo(vinculoId, 'cac', usuario.empresaId);
    if (res.sucesso) {
      mostrar('sucesso', 'Acesso revogado com sucesso!');
      carregarVinculosCac();
    } else {
      mostrar('erro', res.erro || 'Falha ao revogar acesso.');
    }
  };

  const salvarConfiguracoesCac = (chave: string, valor: string) => {
    localStorage.setItem(chave, valor);
    mostrar('sucesso', 'Configuração de prazo atualizada!');
  };

  const handleToggleIbama = (checked: boolean) => {
    setOcultarIbama(checked);
    localStorage.setItem('config_ocultar_ibama', String(checked));
    mostrar('sucesso', checked ? 'Monitoramento IBAMA/SIMAF desativado.' : 'Monitoramento IBAMA/SIMAF ativado.');
  };

  const handleExportarPdf = async () => {
    const cliente = clientes.find(c => c.cpf && c.cpf.trim() !== '') || clientes[0];
    if (!cliente) {
      mostrar('erro', 'Perfil de acervo não encontrado.');
      return;
    }
    setExportando(true);
    try {
      const armas = await buscarArmas(cliente.id);
      const armasComGts = await Promise.all(armas.map(async (arma) => {
        const gts = await buscarGts(arma.id);
        return { ...arma, gts };
      }));
      const manejos = await buscarManejos(cliente.id);

      const perfil = {
        nome: cliente.nome,
        cpf: cliente.cpf,
        contato: cliente.contato,
        cr: cliente.numeroCr,
        vencimentoCr: cliente.vencimentoCr,
        crIbama: cliente.numeroCrIbama,
        vencimentoCrIbama: cliente.vencimentoCrIbama,
        endereco: cliente.endereco
      };

      await exportarAcervoPdf(perfil, armasComGts, manejos);
      mostrar('sucesso', 'PDF do acervo gerado com sucesso!');
      // Rastreia exportação para o painel admin
      if (usuario?.email) incrementarExportacao(usuario.email).catch(() => {});
    } catch (e) {
      console.error(e);
      mostrar('erro', 'Falha ao exportar PDF.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarExcel = async () => {
    const cliente = clientes.find(c => c.cpf && c.cpf.trim() !== '') || clientes[0];
    if (!cliente) {
      mostrar('erro', 'Perfil de acervo não encontrado.');
      return;
    }
    setExportando(true);
    try {
      const armas = await buscarArmas(cliente.id);
      const armasComGts = await Promise.all(armas.map(async (arma) => {
        const gts = await buscarGts(arma.id);
        return { ...arma, gts };
      }));
      const manejos = await buscarManejos(cliente.id);

      const perfil = {
        nome: cliente.nome,
        cpf: cliente.cpf,
        contato: cliente.contato,
        cr: cliente.numeroCr,
        vencimentoCr: cliente.vencimentoCr,
        crIbama: cliente.numeroCrIbama,
        vencimentoCrIbama: cliente.vencimentoCrIbama,
        endereco: cliente.endereco
      };

      await exportarAcervoExcel(perfil, armasComGts, manejos);
      mostrar('sucesso', 'Planilha Excel gerada com sucesso!');
      // Rastreia exportação para o painel admin
      if (usuario?.email) incrementarExportacao(usuario.email).catch(() => {});
    } catch (e) {
      console.error(e);
      mostrar('erro', 'Falha ao exportar Excel.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarAcervo = async () => {
    const cliente = clientes.find(c => c.cpf && c.cpf.trim() !== '') || clientes[0];
    if (!cliente) {
      mostrar('erro', 'Perfil de acervo não encontrado.');
      return;
    }
    setExportando(true);
    try {
      const armas = await buscarArmas(cliente.id);
      const armasComGts = await Promise.all(armas.map(async (arma) => {
        const gts = await buscarGts(arma.id);
        return { ...arma, gts };
      }));
      const manejos = await buscarManejos(cliente.id);

      const backup = {
        exportadoEm: new Date().toISOString(),
        perfil: {
          nome: cliente.nome,
          cpf: cliente.cpf,
          contato: cliente.contato,
          cr: cliente.numeroCr,
          vencimentoCr: cliente.vencimentoCr,
          crIbama: cliente.numeroCrIbama,
          vencimentoCrIbama: cliente.vencimentoCrIbama,
          endereco: cliente.endereco
        },
        armas: armasComGts.map(a => ({
          tipo: a.tipo,
          modelo: a.modelo,
          calibre: a.calibre,
          fabricante: a.fabricante,
          numeroSerie: a.numeroSerie,
          numeroSigma: a.numeroSigma,
          acervo: a.acervo,
          vencimentoCraf: a.vencimentoCraf,
          gts: a.gts.map(g => ({
            tipo: g.tipo,
            vencimento: g.vencimento,
            destino: g.destino
          }))
        })),
        manejos: manejos.map(m => ({
          fazenda: m.nomeFazenda,
          proprietario: m.nomeProprietario,
          car: m.numeroCar,
          cidade: m.cidade,
          vencimento: m.vencimento,
          status: m.status
        }))
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_acervo_gcac_${cliente.nome.toLowerCase().replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      mostrar('sucesso', 'Backup baixado com sucesso!');
      // Rastreia exportação para o painel admin
      if (usuario?.email) incrementarExportacao(usuario.email).catch(() => {});
    } catch (e) {
      console.error(e);
      mostrar('erro', 'Falha ao exportar acervo.');
    } finally {
      setExportando(false);
    }
  };

  const toggleSecao = (id: string) => {
    setSecoesSelecionadas(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selecionarTodas = () => setSecoesSelecionadas(CONTEUDO_MANUAL.map(s => s.id));
  const limparTodas = () => setSecoesSelecionadas([]);

  const handleGerarManual = async () => {
    if (secoesSelecionadas.length === 0) {
      mostrar('aviso', 'Selecione ao menos uma seção para o manual.');
      return;
    }
    setGerandoManual(true);
    try {
      await baixarManualPdf(secoesSelecionadas);
      mostrar('sucesso', 'Manual gerado com sucesso!');
    } catch (e) {
      mostrar('erro', 'Erro ao gerar o manual.');
    } finally {
      setGerandoManual(false);
    }
  };

  const handleSincronizarTudo = async () => {
    if (!online || !usuario) {
      mostrar('aviso', 'Você precisa estar online e logado para sincronizar.');
      return;
    }
    setSincronizando(true);
    try {
      const { ok, erro } = await sincronizarPendentes();
      if (erro === 0) {
        mostrar('sucesso', `${ok} OS enviadas pro Google Drive com sucesso!`);
      } else {
        mostrar('aviso', `${ok} sincronizadas, ${erro} com falha.`);
      }
    } finally {
      setSincronizando(false);
    }
  };

  const handleExcluirServico = async (s: ServicoConfig) => {
    if (window.confirm(`Tem certeza que deseja excluir o serviço "${s.nome}"?`)) {
      try {
        await deletarServico(s.id);
        mostrar('sucesso', 'Serviço excluído com sucesso.');
      } catch {
        mostrar('erro', 'Erro ao excluir serviço.');
      }
    }
  };

  const abrirNovoServico = () => {
    setServicoEditando(null);
    setModalAberto(true);
  };

  const abrirEditarServico = (s: ServicoConfig) => {
    setServicoEditando(s);
    setModalAberto(true);
  };

  if (isCac) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="text-brand-blue" />
          Configurações do Atirador
        </h1>
        <p className="text-gray-400 text-sm">Personalize os alertas de prazos, monitoramento de documentos e faça backup do seu acervo.</p>

        {/* ── Painel de Alertas ── */}
        <div className="card space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
            <ShieldAlert className="text-brand-blue-light" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Prazos de Alerta e Antecedência</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Alerta CR */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">CR (Exército/PF)</label>
              <select 
                className="select" 
                value={alertaCr}
                onChange={e => {
                  setAlertaCr(e.target.value);
                  salvarConfiguracoesCac('config_alerta_cr', e.target.value);
                }}
              >
                <option value="30">Alertar com 30 dias de antecedência</option>
                <option value="60">Alertar com 60 dias de antecedência</option>
                <option value="90">Alertar com 90 dias de antecedência</option>
                <option value="120">Alertar com 120 dias de antecedência</option>
              </select>
            </div>

            {/* Alerta CRAF */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">CRAF (Armas)</label>
              <select 
                className="select" 
                value={alertaCraf}
                onChange={e => {
                  setAlertaCraf(e.target.value);
                  salvarConfiguracoesCac('config_alerta_craf', e.target.value);
                }}
              >
                <option value="30">Alertar com 30 dias de antecedência</option>
                <option value="60">Alertar com 60 dias de antecedência</option>
                <option value="90">Alertar com 90 dias de antecedência</option>
                <option value="120">Alertar com 120 dias de antecedência</option>
              </select>
            </div>

            {/* Alerta GT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">Guia de Tráfego (GT)</label>
              <select 
                className="select" 
                value={alertaGt}
                onChange={e => {
                  setAlertaGt(e.target.value);
                  salvarConfiguracoesCac('config_alerta_gt', e.target.value);
                }}
              >
                <option value="10">Alertar com 10 dias de antecedência</option>
                <option value="20">Alertar com 20 dias de antecedência</option>
                <option value="30">Alertar com 30 dias de antecedência</option>
                <option value="45">Alertar com 45 dias de antecedência</option>
              </select>
            </div>

            {/* Alerta Manejo */}
            {!ocultarIbama && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-gray-400 uppercase">SIMAF / Manejo</label>
                <select 
                  className="select" 
                  value={alertaManejo}
                  onChange={e => {
                    setAlertaManejo(e.target.value);
                    salvarConfiguracoesCac('config_alerta_manejo', e.target.value);
                  }}
                >
                  <option value="5">Alertar com 5 dias de antecedência</option>
                  <option value="7">Alertar com 7 dias de antecedência</option>
                  <option value="15">Alertar com 15 dias de antecedência</option>
                  <option value="30">Alertar com 30 dias de antecedência</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Monitoramento IBAMA / SIMAF ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-brand-blue-light" size={18} />
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider">Monitoramento IBAMA / SIMAF</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                  Desative caso você não utilize autorizações de caça/manejo
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => handleToggleIbama(!ocultarIbama)}
              className={`w-12 h-6 rounded-full flex items-center transition-all p-1 ${
                ocultarIbama ? 'bg-brand-dark-5 justify-start' : 'bg-brand-green justify-end'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* ── Notificações Push ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
            <Bell className="text-brand-blue" size={18} />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Notificações no Celular</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                Alertas de vencimento direto na sua tela
              </p>
            </div>
          </div>

          {/* Status atual */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pushAtivo ? (
                <div className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
              )}
              <p className="text-sm font-bold text-white">
                {pushPermissao === 'unsupported'
                  ? 'Não suportado neste navegador'
                  : pushPermissao === 'denied'
                  ? 'Notificações bloqueadas'
                  : pushAtivo
                  ? 'Notificações ativadas neste dispositivo'
                  : 'Notificações desativadas'}
              </p>
            </div>
          </div>

          {/* Aviso de bloqueio */}
          {pushPermissao === 'denied' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
              <strong>Permissão bloqueada.</strong> Vá nas configurações do navegador/celular,
              encontre este site e ative as notificações manualmente. Depois volte aqui e ative.
            </div>
          )}

          {/* Aviso iOS sem instalar */}
          {isIOS() && !pushInstalado && pushPermissao !== 'denied' && (
            <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <Smartphone size={14} className="text-brand-blue" />
                iPhone detectado — instale o app primeiro
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                No Safari, toque no ícone <strong className="text-white">Compartilhar ↑</strong> e escolha
                <strong className="text-white"> "Adicionar à Tela de Início"</strong>.
                Depois abra o app pela tela inicial e ative as notificações aqui.
              </p>
            </div>
          )}

          {/* Botões de ação */}
          {pushPermissao !== 'denied' && pushPermissao !== 'unsupported' && (
            <div className="flex flex-wrap gap-2">
              {!pushAtivo ? (
                <button
                  onClick={async () => {
                    if (!usuario?.empresaId) return;
                    setPushCarregando(true);
                    const resultado = await ativarNotificacoesPush(usuario.empresaId);
                    if (resultado.sucesso) {
                      setPushAtivo(true);
                      setPushPermissao('granted');
                      await enviarNotificacaoTeste();
                      mostrar('sucesso', 'Notificações ativadas! Você receberá alertas de vencimentos.');
                    } else {
                      mostrar('erro', resultado.erro || 'Erro ao ativar notificações.');
                    }
                    setPushCarregando(false);
                  }}
                  disabled={pushCarregando || (isIOS() && !pushInstalado)}
                  className="btn-primary flex items-center gap-2 text-xs py-2.5"
                >
                  {pushCarregando ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  {pushCarregando ? 'Ativando...' : 'Ativar Notificações neste Celular'}
                </button>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      await enviarNotificacaoTeste();
                      mostrar('sucesso', 'Notificação de teste enviada!');
                    }}
                    className="btn-ghost flex items-center gap-2 text-xs py-2.5 border border-brand-dark-5"
                  >
                    <CheckCircle2 size={14} className="text-brand-green" /> Testar Notificação
                  </button>
                  <button
                    onClick={async () => {
                      if (!usuario?.empresaId) return;
                      setPushCarregando(true);
                      await desativarNotificacoesPush(usuario.empresaId);
                      setPushAtivo(false);
                      mostrar('info', 'Notificações desativadas neste dispositivo.');
                      setPushCarregando(false);
                    }}
                    disabled={pushCarregando}
                    className="btn-ghost flex items-center gap-2 text-xs py-2.5 text-red-400 border border-red-500/20 hover:bg-red-500/10"
                  >
                    <BellOff size={14} /> Desativar
                  </button>
                </>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-600 leading-relaxed">
            As notificações são enviadas todo dia às <strong className="text-gray-400">09:00h</strong> somente quando
            há documentos com prazo a vencer naquele dia, de acordo com as suas configurações de alerta acima.
          </p>
        </div>

        {/* ── Exportar & Backup do Acervo ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
            <Download className="text-brand-green" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Exportar & Backup do Acervo</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Faça o download imediato das informações do seu acervo para arquivamento, controle ou impressão.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button 
              onClick={handleExportarPdf}
              disabled={exportando}
              className="btn-primary justify-center py-3 text-xs"
            >
              Exportar em PDF (Imprimir)
            </button>
            <button 
              onClick={handleExportarExcel}
              disabled={exportando}
              className="btn-primary justify-center py-3 text-xs bg-brand-green/20 hover:bg-brand-green/30 border-brand-green/30 text-brand-green"
            >
              Exportar em Excel
            </button>
            <button 
              onClick={handleExportarAcervo}
              disabled={exportando}
              className="btn-ghost justify-center py-3 text-xs border-brand-dark-5 text-gray-400 hover:text-white"
            >
              Backup Digital (JSON)
            </button>
          </div>
        </div>

        {/* ── Despachantes Autorizados (Apenas CAC) ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
            <Link2 className="text-brand-blue-light" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Despachantes Autorizados</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Profissionais autorizados por você a visualizar os dados do seu acervo para gestão de documentos e controle de vencimentos.
          </p>

          {carregandoVinculos ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vinculosCac.length === 0 ? (
            <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500">Nenhum despachante autorizado no momento.</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Quando um despachante solicitar acesso usando seu CPF, um aviso aparecerá na parte superior da sua tela para você autorizar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {vinculosCac.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{v.despachante_nome}</p>
                    <p className="text-[10px] text-gray-500">Autorizado em {formatarData(v.respondido_em || v.solicitado_em)}</p>
                  </div>
                  <button
                    onClick={() => handleRevogarVinculoCac(v.id, v.despachante_nome)}
                    className="btn-ghost py-1 px-2.5 text-[10px] border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold hover:bg-red-500/10 flex items-center gap-1"
                  >
                    <Unlink size={10} /> Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Perfil da Conta ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
            <User className="text-gray-400" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Perfil da Conta</h2>
          </div>
          {usuario && (
            <div className="flex items-center gap-3">
              <img src={usuario.fotoPerfil} alt={usuario.nome} className="w-12 h-12 rounded-full border border-brand-blue/30" />
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-white truncate">{usuario.nome}</p>
                <p className="text-xs text-gray-400 truncate">{usuario.email}</p>
                <span className="text-[10px] text-brand-blue-light bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 font-bold uppercase tracking-wider inline-block mt-1">
                  Perfil Individual CAC
                </span>
              </div>
              
              <button onClick={logout} className="btn-danger btn-sm">
                Sair da Conta
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-gray-600 uppercase tracking-widest pt-4">
          Portal G CAC Atirador v3.0
        </div>
        <Notificacao {...notif} onFechar={fechar} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Configurações e Serviços</h1>

      {/* ── Dados da Empresa & Clube Parceiro ── */}
      {usuario?.role === 'admin' && usuario?.tipoConta === 'empresa' && (
        <div className="card space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setEmpresaExpandido(!empresaExpandido)}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${empresaExpandido ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
                <Landmark size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  Dados da Empresa & Clube Parceiro
                </h2>
                {!empresaExpandido && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Razão Social, Contato, Endereço e Clube Parceiro Padrão • Clique para editar
                  </p>
                )}
              </div>
            </div>
            <div className={`text-gray-500 transition-transform duration-300 ${empresaExpandido ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>

          {empresaExpandido && (
            <div className="animate-slide-down space-y-4 pt-3 border-t border-brand-dark-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Razão Social / Nome Fantasia</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formEmpresa.razaoSocial} 
                    onChange={e => setFormEmpresa({...formEmpresa, razaoSocial: e.target.value})} 
                    placeholder="Ex: GCAC Despachante Bélico"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label">CNPJ</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formEmpresa.cnpj} 
                    onChange={e => setFormEmpresa({...formEmpresa, cnpj: e.target.value})} 
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label">Nome do Responsável</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formEmpresa.responsavel} 
                    onChange={e => setFormEmpresa({...formEmpresa, responsavel: e.target.value})} 
                    placeholder="Ex: Guilherme Gomes"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label">Telefone / Whatsapp</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formEmpresa.telefone} 
                    onChange={e => setFormEmpresa({...formEmpresa, telefone: e.target.value})} 
                    placeholder="(64) 9.9995-9865"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="label">Endereço Comercial</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formEmpresa.endereco} 
                    onChange={e => setFormEmpresa({...formEmpresa, endereco: e.target.value})} 
                    placeholder="Endereço exato impresso no cabeçalho dos PDFs"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1 border-t border-brand-dark-5 pt-3">
                  <label className="label text-brand-blue-light font-bold">Clube de Tiro Parceiro Padrão</label>
                  <input 
                    type="text" 
                    className="input uppercase font-bold text-white bg-brand-dark-3" 
                    value={formEmpresa.clubeParceiro} 
                    onChange={e => setFormEmpresa({...formEmpresa, clubeParceiro: e.target.value})} 
                    placeholder="Ex: CLUBE DE TIRO E CAÇA PRÓ TIRO"
                  />
                  <p className="text-[10px] text-gray-500 italic mt-1">
                    Este clube será o selecionado por padrão quando você marcar o switch "Filiado" nas Ordens de Serviço, Orçamentos e Clientes. Ele também aparecerá no cabeçalho das impressões em PDF.
                  </p>
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-2 border-t border-brand-dark-5 pt-3">
                  <label className="label text-brand-blue-light font-bold">Logotipo Personalizado da Empresa</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-brand-dark-3/55 p-3 rounded-lg border border-brand-dark-5">
                    <div className="w-24 h-24 rounded-lg bg-brand-dark-4 border border-brand-dark-5 flex items-center justify-center overflow-hidden relative group">
                      {formEmpresa.logoUrl ? (
                        <>
                          <img src={formEmpresa.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                          <button
                            type="button"
                            onClick={() => setFormEmpresa({ ...formEmpresa, logoUrl: '' })}
                            className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold"
                          >
                            Remover
                          </button>
                        </>
                      ) : (
                        <div className="text-gray-600 flex flex-col items-center justify-center gap-1">
                          <Landmark size={24} />
                          <span className="text-[8px] uppercase font-bold tracking-wider">Sem Logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 w-full">
                      <label className="btn-secondary py-2 px-3 cursor-pointer inline-flex items-center gap-2 text-xs w-full sm:w-auto justify-center bg-brand-dark-4 hover:bg-brand-dark-5 border border-brand-dark-5 text-white rounded">
                        <Upload size={14} />
                        Escolher Logotipo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressedBase64 = await compressImage(file, 350, 350, 0.85);
                                setFormEmpresa({ ...formEmpresa, logoUrl: compressedBase64 });
                              } catch (err) {
                                console.error('Erro ao processar imagem:', err);
                                mostrar('erro', 'Falha ao processar imagem.');
                              }
                            }
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-gray-500 leading-normal">
                        PNG, JPG ou WEBP. Dimensão máxima recomendada de 350x350px. Imagens grandes serão redimensionadas e comprimidas localmente de forma automática.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEmpresaExpandido(false)} 
                  className="btn-ghost flex-1 py-2.5"
                  disabled={salvandoEmpresa}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSalvarEmpresa} 
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                  disabled={salvandoEmpresa || !formEmpresa.razaoSocial.trim() || !formEmpresa.clubeParceiro.trim()}
                >
                  {salvandoEmpresa && <Loader2 size={16} className="animate-spin text-white" />}
                  {salvandoEmpresa ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Alertas de Vencimento (empresa/colaborador) ── */}
      {temAcessoRecurso('config_alertas_vencimento') && (
        <div className="card space-y-4">
          <div
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setAlertasExpandido(!alertasExpandido)}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${alertasExpandido ? 'bg-yellow-500/20 text-yellow-400' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
                <ShieldAlert size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  Alertas de Prazos de Vencimento
                </h2>
                {!alertasExpandido && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Configure antecedência dos alertas de CR, CRAF, GT e Manejo • Clique para editar
                  </p>
                )}
              </div>
            </div>
            <div className={`text-gray-500 transition-transform duration-300 ${alertasExpandido ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>

          {alertasExpandido && (
            <div className="animate-slide-down space-y-4 pt-3 border-t border-brand-dark-5">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Defina com quantos dias de antecedência o sistema deve alertar sobre o vencimento de cada documento.
                Estas configurações são <strong className="text-white">pessoais</strong> e ficam salvas neste dispositivo.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CR */}
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-brand-blue-light" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">CR / CRAF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={7} max={365}
                      value={alertaCr}
                      onChange={e => setAlertaCr(e.target.value)}
                      className="input text-center font-bold w-20 text-sm"
                    />
                    <span className="text-xs text-gray-400">dias antes</span>
                    <button
                      onClick={() => salvarAlertaEmpresa('config_alerta_cr', alertaCr)}
                      className="btn-primary btn-sm ml-auto px-3"
                    >Salvar</button>
                  </div>
                </div>
                {/* CRAF */}
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-brand-blue-light" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Renovação CRAF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={7} max={365}
                      value={alertaCraf}
                      onChange={e => setAlertaCraf(e.target.value)}
                      className="input text-center font-bold w-20 text-sm"
                    />
                    <span className="text-xs text-gray-400">dias antes</span>
                    <button
                      onClick={() => salvarAlertaEmpresa('config_alerta_craf', alertaCraf)}
                      className="btn-primary btn-sm ml-auto px-3"
                    >Salvar</button>
                  </div>
                </div>
                {/* GT */}
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Guia de Tráfego (GT)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={90}
                      value={alertaGt}
                      onChange={e => setAlertaGt(e.target.value)}
                      className="input text-center font-bold w-20 text-sm"
                    />
                    <span className="text-xs text-gray-400">dias antes</span>
                    <button
                      onClick={() => salvarAlertaEmpresa('config_alerta_gt', alertaGt)}
                      className="btn-primary btn-sm ml-auto px-3"
                    >Salvar</button>
                  </div>
                </div>
                {/* Manejo */}
                <div className="bg-brand-dark-4 border border-brand-dark-5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-brand-green" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Aut. de Manejo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={60}
                      value={alertaManejo}
                      onChange={e => setAlertaManejo(e.target.value)}
                      className="input text-center font-bold w-20 text-sm"
                    />
                    <span className="text-xs text-gray-400">dias antes</span>
                    <button
                      onClick={() => salvarAlertaEmpresa('config_alerta_manejo', alertaManejo)}
                      className="btn-primary btn-sm ml-auto px-3"
                    >Salvar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual de Instruções ── */}
      {temAcessoRecurso('config_manual') && (
      <div className="card space-y-4">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setManualExpandido(!manualExpandido)}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${manualExpandido ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
              <HelpCircle size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider">
                Manual de Instruções Update
              </h2>
              {!manualExpandido && (
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  Gere um guia em PDF modular para treinamento • Clique para ver opções
                </p>
              )}
            </div>
          </div>
          <div className={`text-gray-500 transition-transform duration-300 ${manualExpandido ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </div>

        {manualExpandido && (
          <div className="animate-slide-down space-y-5 pt-3 border-t border-brand-dark-5">
            <div className="flex items-center justify-between gap-4 bg-brand-dark-4 p-3 rounded-lg border border-brand-dark-5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Seleção de Módulos</span>
                <span className="text-[10px] text-gray-500">Escolha quais capítulos incluir no seu manual personalizado.</span>
              </div>
              <div className="flex gap-2">
                <button onClick={selecionarTodas} className="text-[10px] font-bold text-brand-blue-light hover:underline">Selecionar Tudo</button>
                <span className="text-gray-700">|</span>
                <button onClick={limparTodas} className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors">Limpar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTEUDO_MANUAL.map(secao => {
                const ativa = secoesSelecionadas.includes(secao.id);
                return (
                  <button 
                    key={secao.id}
                    onClick={() => toggleSecao(secao.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      ativa 
                        ? 'bg-brand-blue/10 border-brand-blue/30 text-white' 
                        : 'bg-brand-dark-4/40 border-brand-dark-5 text-gray-500 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:border-gray-700'
                    }`}
                  >
                    {ativa ? <CheckSquare size={16} className="text-brand-blue-light" /> : <Square size={16} />}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold truncate">{secao.titulo.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleGerarManual}
              disabled={gerandoManual}
              className="btn-primary w-full py-3.5 shadow-lg shadow-brand-blue/20"
            >
              <DownloadCloud size={18} className={gerandoManual ? 'animate-bounce' : ''} />
              {gerandoManual ? 'Gerando PDF...' : 'Gerar Manual Personalizado'}
            </button>
          </div>
        )}
      </div>
      )}

      {/* ── Painel de Controle de Usuários (Apenas Admin) ── */}
      {usuario?.role === 'admin' && (
        <div className="card space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setUsuariosExpandido(!usuariosExpandido)}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${usuariosExpandido ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  Painel de Controle de Usuários
                </h2>
                {!usuariosExpandido && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Gerencie as empresas despachantes, atiradores e caçadores individuais CAC e a equipe do seu escritório central • Clique para expandir
                  </p>
                )}
              </div>
            </div>
            <div className={`text-gray-500 transition-transform duration-300 ${usuariosExpandido ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>
          {usuariosExpandido && (
            <div className="animate-slide-down pt-2 border-t border-brand-dark-5">
              <GestaoUsuarios />
            </div>
          )}
        </div>
      )}

      {/* ── Gerenciador de Serviços ── */}
      {(usuario?.role === 'admin' || temAcessoRecurso('config_servicos')) && (
      <div className="card space-y-4">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setServicosExpandido(!servicosExpandido)}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${servicosExpandido ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
              <Settings2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                Gerenciar Serviços e Taxas
              </h2>
              {!servicosExpandido && (
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  {servicos.length} serviços cadastrados • Clique para gerenciar
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {servicosExpandido && (
              <button 
                onClick={(e) => { e.stopPropagation(); abrirNovoServico(); }} 
                className="btn-primary btn-sm px-3 animate-fade-in"
              >
                <Plus size={14} /> Novo Serviço
              </button>
            )}
            <div className={`text-gray-500 transition-transform duration-300 ${servicosExpandido ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>
        </div>

        {servicosExpandido && (
          <div className="animate-slide-down space-y-4 pt-2 border-t border-brand-dark-5">
            {servicos.length === 0 ? (
              <div className="text-center py-8 bg-brand-dark-4 border border-brand-dark-5 rounded-xl">
                <p className="text-sm text-gray-500">Nenhum serviço cadastrado ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-500 text-xs uppercase bg-brand-dark-3/50">
                    <tr>
                      <th className="px-3 py-2 font-bold">Serviço</th>
                      <th className="px-3 py-2 font-bold whitespace-nowrap">Preço Padrão</th>
                      <th className="px-3 py-2 font-bold text-brand-blue-light">Filiado</th>
                      <th className="px-3 py-2 font-bold text-yellow-500/80">Taxa PF</th>
                      <th className="px-3 py-2 font-bold text-brand-blue-light/80">Lucro Real</th>
                      <th className="px-3 py-2 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark-5">
                    {servicos.map(s => (
                      <tr key={s.id} className="hover:bg-brand-dark-4 transition-colors">
                        <td className="px-3 py-3 font-medium text-white min-w-[180px] leading-tight py-4">{s.nome}</td>
                        <td className="px-3 py-3 text-brand-green font-bold">{formatarMoeda(s.valorPadrao)}</td>
                        <td className="px-3 py-3 text-brand-blue-light font-bold">{formatarMoeda(s.valorFiliado || 0)}</td>
                        <td className="px-3 py-3 text-yellow-400/80">{formatarMoeda(s.taxaPF)}</td>
                        <td className="px-3 py-3 text-brand-blue-light/90 font-semibold">{formatarMoeda(s.valorPadrao - s.taxaPF)}</td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => abrirEditarServico(s)} className="p-1.5 text-gray-400 hover:text-brand-blue-light">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleExcluirServico(s)} className="p-1.5 text-gray-400 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="bg-brand-dark-4 rounded-lg p-3 flex gap-2 border border-brand-dark-5">
              <BadgeDollarSign size={16} className="text-brand-green/70 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Configure o **Valor de Venda** sugerido e a **Taxa PF** interna. O valor da taxa será subtraído do bruto no Painel para mostrar seu **Lucro Real**.
              </p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Notificações Push ── */}
      {temAcessoRecurso('config_notificacoes_push') && (
      <div className="card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-brand-dark-5">
          <Bell className="text-brand-blue" size={18} />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Notificações no Celular</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              Alertas de vencimento direto na sua tela
            </p>
          </div>
        </div>

        {/* Status atual */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pushAtivo ? (
              <div className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
            )}
            <p className="text-sm font-bold text-white">
              {pushPermissao === 'unsupported'
                ? 'Não suportado neste navegador'
                : pushPermissao === 'denied'
                ? 'Notificações bloqueadas'
                : pushAtivo
                ? 'Notificações ativadas neste dispositivo'
                : 'Notificações desativadas'}
            </p>
          </div>
        </div>

        {/* Aviso de bloqueio */}
        {pushPermissao === 'denied' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
            <strong>Permissão bloqueada.</strong> Vá nas configurações do navegador/celular,
            encontre este site e ative as notificações manualmente. Depois volte aqui e ative.
          </div>
        )}

        {/* Aviso iOS sem instalar */}
        {isIOS() && !pushInstalado && pushPermissao !== 'denied' && (
          <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <Smartphone size={14} className="text-brand-blue" />
              iPhone detectado — instale o app primeiro
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              No Safari, toque no ícone <strong className="text-white">Compartilhar ↑</strong> e escolha
              <strong className="text-white"> "Adicionar à Tela de Início"</strong>.
              Depois abra o app pela tela inicial e ative as notificações aqui.
            </p>
          </div>
        )}

        {/* Botões de ação */}
        {pushPermissao !== 'denied' && pushPermissao !== 'unsupported' && (
          <div className="flex flex-wrap gap-2">
            {!pushAtivo ? (
              <button
                onClick={async () => {
                  if (!usuario?.empresaId) return;
                  setPushCarregando(true);
                  const resultado = await ativarNotificacoesPush(usuario.empresaId);
                  if (resultado.sucesso) {
                    setPushAtivo(true);
                    setPushPermissao('granted');
                    await enviarNotificacaoTeste();
                    mostrar('sucesso', 'Notificações ativadas! Você receberá alertas de vencimentos.');
                  } else {
                    mostrar('erro', resultado.erro || 'Erro ao ativar notificações.');
                  }
                  setPushCarregando(false);
                }}
                disabled={pushCarregando || (isIOS() && !pushInstalado)}
                className="btn-primary flex items-center gap-2 text-xs py-2.5"
              >
                {pushCarregando ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                {pushCarregando ? 'Ativando...' : 'Ativar Notificações neste Celular'}
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    await enviarNotificacaoTeste();
                    mostrar('sucesso', 'Notificação de teste enviada!');
                  }}
                  className="btn-ghost flex items-center gap-2 text-xs py-2.5 border border-brand-dark-5"
                >
                  <CheckCircle2 size={14} className="text-brand-green" /> Testar Notificação
                </button>
                <button
                  onClick={async () => {
                    if (!usuario?.empresaId) return;
                    setPushCarregando(true);
                    await desativarNotificacoesPush(usuario.empresaId);
                    setPushAtivo(false);
                    mostrar('info', 'Notificações desativadas neste dispositivo.');
                    setPushCarregando(false);
                  }}
                  disabled={pushCarregando}
                  className="btn-ghost flex items-center gap-2 text-xs py-2.5 text-red-400 border border-red-500/20 hover:bg-red-500/10"
                >
                  <BellOff size={14} /> Desativar
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-600 leading-relaxed">
          As notificações são enviadas todo dia às <strong className="text-gray-400">09:00h</strong> somente quando
          há documentos com prazo a vencer naquele dia, de acordo com as suas configurações de alerta acima.
        </p>
      </div>
      )}

      {/* ── Otimização de Armazenamento (Banco -> Storage) ── */}
      {!isCac && (
        <div className="card space-y-4 mb-5">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setOtimizacaoExpandido(!otimizacaoExpandido)}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${otimizacaoExpandido ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'}`}>
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider">
                  Otimização de Banco de Dados (Storage)
                </h2>
                {!otimizacaoExpandido && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Migre documentos antigos do banco de dados para o Storage para acelerar o sistema
                  </p>
                )}
              </div>
            </div>
            <div className={`text-gray-500 transition-transform duration-300 ${otimizacaoExpandido ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>

          {otimizacaoExpandido && (
            <div className="animate-slide-down space-y-4 pt-3 border-t border-brand-dark-5">
              <p className="text-xs text-gray-400 leading-relaxed">
                Transfere arquivos pesados salvos antigamente no banco de dados para a nuvem do Supabase Storage. Isso reduzirá drasticamente o consumo de banda e tornará o carregamento de "Meus Clientes" instantâneo.
              </p>
              
              {progressoMigracao && (
                <div className="bg-brand-dark-4 p-3 rounded-lg border border-brand-dark-5 font-mono text-[10px] text-brand-blue-light whitespace-pre-wrap">
                  {progressoMigracao}
                </div>
              )}

              <button
                onClick={handleMigrarArquivosParaStorage}
                disabled={migrando}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {migrando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {migrando ? 'Migrando Arquivos...' : 'Iniciar Otimização'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* ── Conta Google ── */}
        <div className="card space-y-4 h-fit">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <User size={14} />
            Conta Google
          </h2>

          {usuario ? (
            <div className="flex items-center gap-3">
              <img src={usuario.fotoPerfil} alt={usuario.nome} className="w-10 h-10 rounded-full border border-brand-blue/30" />
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-white truncate">{usuario.nome}</p>
                <p className="text-xs text-gray-400 truncate">{usuario.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Nenhuma conta conectada</p>
          )}

          <div className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg ${
            online ? 'bg-brand-green/10 text-brand-green border border-brand-green/20'
                   : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {online ? <Wifi size={10} /> : <WifiOff size={10} />}
            {online ? 'Online' : 'Offline'}
          </div>

          {usuario && (
            <button onClick={logout} className="btn-danger btn-sm w-full justify-center">
              <LogOut size={14} /> Sair
            </button>
          )}
        </div>

        {/* ── Sincronização ── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Cloud size={14} />
            Backup Drive
          </h2>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-brand-dark-4 rounded-lg p-2.5">
              <p className="text-xl font-black text-white">{ordens.length}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase">Total OS</p>
            </div>
            <div className="bg-brand-dark-4 rounded-lg p-2.5">
              <p className="text-xl font-black text-yellow-400">{itensFila}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase">Pendentes</p>
            </div>
          </div>

          <button
            onClick={handleSincronizarTudo}
            disabled={sincronizando || !online || !usuario || itensFila === 0}
            className="btn-primary w-full justify-center btn-sm"
          >
            <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Fazer Backup'}
          </button>

          <p className="text-[10px] text-gray-600 flex items-start gap-1.5">
            <ShieldCheck size={10} className="text-brand-green shrink-0 mt-0.5" />
            Backup automático ativo via GCAC_OS_Sync/
          </p>
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-600 pb-2 uppercase tracking-widest">
        v3.0 — Gestão Financeira Completa
      </div>

      <ModalServico 
        aberto={modalAberto} 
        fechar={() => setModalAberto(false)} 
        servicoParaEditar={servicoEditando} 
      />
      <Notificacao {...notif} onFechar={fechar} />
    </div>
  );
}
