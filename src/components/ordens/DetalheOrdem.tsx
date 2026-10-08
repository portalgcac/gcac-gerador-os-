import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, FileDown, Printer, Cloud, CloudOff, CheckCircle, MessageCircle, Users, Phone, Mail, HelpCircle, ChevronDown, List, ShieldCheck, History, Clock, CreditCard, FileText, RefreshCw } from 'lucide-react';
import { 
  OrdemDeServico, CanalAtendimento, STATUS_EXECUCAO_SERVICO, 
  StatusExecucaoServico, StatusOS, FormaPagamento, STATUS_OS, FORMAS_PAGAMENTO, Arma 
} from '../../types';
import { useOrdens } from '../../context/OrdensContext';
import { useAuth } from '../../context/AuthContext';
import { isLaudoExame } from '../../utils/categoriaHelper';
import { baixarPdf, imprimirPdf } from '../../services/geradorPdf';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { useClientes } from '../../context/ClientesContext';
import { ModalArma } from '../clientes/AbaDocumentacao';
import { formatarMoeda, formatarData, formatarDataHora, formatarNumeroOS, classeStatus, classeStatusExecucao, iconeStatusExecucao, calcularProgressoServicos } from '../../utils/formatters';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';
import { Modal } from '../common/Modal';
import { visualizarDocumentoBase64, fileToBase64, uploadBase64File } from '../../utils/fileUtils';
import { parseGtPdf, parseCrafPdf } from '../../services/gtParserService';

interface DetalheOrdemProps {
  ordem: OrdemDeServico;
}

export function DetalheOrdem({ ordem }: DetalheOrdemProps) {
  const navigate = useNavigate();
  const { 
    deletarOrdem, atualizarStatusServico, atualizarOrdem, 
    atualizarGruServico, registrarPagamento, removerPagamento,
    sincronizarComPerfil, sincronizarOrdem
  } = useOrdens();
  const { clientes, buscarCreditos, adicionarCredito, salvarGt, buscarArmas, salvarArma } = useClientes();
  const { estaAutenticado, usuario } = useAuth();
  const podeExcluir = usuario?.role === 'admin' || usuario?.permissoes?.includes('excluir_registros');
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [sincronizandoPerfil, setSincronizandoPerfil] = useState(false);
  const [statusAberto, setStatusAberto] = useState<string | null>(null);
  const [dropdownPagoAberto, setDropdownPagoAberto] = useState(false);
  const [dropdownFormaAberto, setDropdownFormaAberto] = useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState('');
  const [editandoDesconto, setEditandoDesconto] = useState(false);
  const [valorDescontoInput, setValorDescontoInput] = useState(String(ordem.desconto || 0));
  const [modalProtocoloAberto, setModalProtocoloAberto] = useState(false);
  const [servicoParaProtocolo, setServicoParaProtocolo] = useState<{ id: string; nome: string; protocoloExistente: string } | null>(null);
  const [novoProtocolo, setNovoProtocolo] = useState('');

  const [modalConclusaoAberto, setModalConclusaoAberto] = useState(false);
  const [servicoConclusao, setServicoConclusao] = useState<{ id: string; nome: string; exigeGt: boolean; exigeCraf: boolean } | null>(null);
  const [conclusaoArquivo, setConclusaoArquivo] = useState<string | null>(null);
  const [salvarNoPerfilCac, setSalvarNoPerfilCac] = useState(false);
  const [vencimentoGt, setVencimentoGt] = useState('');
  const [vencimentoCraf, setVencimentoCraf] = useState('');
  const [destinoGt, setDestinoGt] = useState('');
  const [tipoGt, setTipoGt] = useState<'Treino' | 'Caça' | 'Manutenção' | 'Transferência' | 'Outro'>('Treino');
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);
  const [armasCliente, setArmasCliente] = useState<Arma[]>([]);
  const [armaSelecionadaId, setArmaSelecionadaId] = useState<string>('');
  const [modalArmaAberto, setModalArmaAberto] = useState(false);

  React.useEffect(() => {
    setValorDescontoInput(String(ordem.desconto || 0));
  }, [ordem.desconto]);

  const handleSalvarDesconto = async () => {
    try {
      const valor = parseFloat(valorDescontoInput.replace(',', '.'));
      if (isNaN(valor) || valor < 0) {
        mostrar('erro', 'Por favor, informe um valor de desconto válido.');
        return;
      }
      if (valor > ordem.valor) {
        mostrar('erro', 'O desconto não pode ser maior que o valor total da O.S.');
        return;
      }
      await atualizarOrdem(ordem.id, { desconto: valor });
      setEditandoDesconto(false);
      mostrar('sucesso', 'Desconto atualizado com sucesso!');
    } catch {
      mostrar('erro', 'Erro ao atualizar o desconto.');
    }
  };
  
  const clienteDaOS = clientes.find(c => c.cpf === ordem.cpf);
  const [saldoCredito, setSaldoCredito] = useState(0);

  React.useEffect(() => {
    if (clienteDaOS) {
      buscarCreditos(clienteDaOS.id).then(creds => {
        setSaldoCredito(creds.reduce((acc, c) => acc + (c.tipo === 'entrada' ? c.valor : -c.valor), 0));
      });
    }
  }, [clienteDaOS, buscarCreditos, ordem.historicoPagamentos]);

  React.useEffect(() => {
    if (clienteDaOS && (
      clienteDaOS.senhaGov !== (ordem.senhaGov || '') ||
      clienteDaOS.nome !== ordem.nomeCliente ||
      clienteDaOS.contato !== ordem.contato ||
      clienteDaOS.endereco !== (ordem.endereco || '') ||
      clienteDaOS.filiadoProTiro !== ordem.filiadoProTiro ||
      (clienteDaOS.clubeFiliado || '') !== (ordem.clubeFiliado || '')
    )) {
      sincronizarComPerfil(ordem.id).catch(console.error);
    }
  }, [clienteDaOS, ordem.id, ordem.senhaGov, ordem.nomeCliente, ordem.contato, ordem.endereco, ordem.filiadoProTiro, ordem.clubeFiliado, sincronizarComPerfil]);

  React.useEffect(() => {
    if (clienteDaOS) {
      buscarArmas(clienteDaOS.id, clienteDaOS.empresaId)
        .then(setArmasCliente)
        .catch(err => console.error('[DetalheOrdem] Erro ao buscar armas:', err));
    }
  }, [clienteDaOS, buscarArmas]);

  React.useEffect(() => {
    if (modalConclusaoAberto && servicoConclusao) {
      const serv = ordem.servicos.find(s => s.id === servicoConclusao.id);
      setArmaSelecionadaId(serv?.armaId || '');
    }
  }, [modalConclusaoAberto, servicoConclusao, ordem.servicos]);

  const servicos = ordem.servicos || [];
  const totalServicos = servicos.length;
  const servicosConcluidos = servicos.filter(s => s.statusExecucao === 'Concluído').length;
  const progresso = calcularProgressoServicos(servicos);

  const handleBaixarPdf = async () => {
    setGerandoPdf(true);
    try {
      await baixarPdf(ordem);
      mostrar('sucesso', 'PDF gerado e baixado com sucesso!');
    } catch {
      mostrar('erro', 'Erro ao gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleImprimir = async () => {
    setImprimindo(true);
    try {
      await imprimirPdf(ordem);
    } catch {
      mostrar('erro', 'Erro ao abrir a impressão.');
    } finally {
      setImprimindo(false);
    }
  };

  const handleSincronizar = async () => {
    if (!estaAutenticado) {
      mostrar('aviso', 'Faça login com o Google para sincronizar com o Drive.');
      return;
    }
    setSincronizando(true);
    try {
      const ok = await sincronizarOrdem(ordem);
      if (ok) {
        mostrar('sucesso', 'OS sincronizada com o Google Drive com sucesso!');
      } else {
        mostrar('erro', 'Falha na sincronização. Verifique sua conexão ou o login Google.');
      }
    } finally {
      setSincronizando(false);
    }
  };
 
  const handleSincronizarPerfil = async () => {
    setSincronizandoPerfil(true);
    try {
      const ok = await sincronizarComPerfil(ordem.id);
      if (ok) {
        mostrar('sucesso', 'Dados do cliente atualizados com base no perfil do cadastro!');
      } else {
        mostrar('erro', 'Não foi possível encontrar o perfil do cliente ou houve um erro.');
      }
    } finally {
      setSincronizandoPerfil(false);
    }
  };

  const handleDeletar = async () => {
    await deletarOrdem(ordem.id);
    navigate('/ordens');
  };

  const handleWhatsApp = () => {
    const servicos = ordem.servicos || [];
    const concluidos = servicos.filter(s => s.statusExecucao === 'Concluído');
    const cancelados = servicos.filter(s => s.statusExecucao === 'Cancelado / Não Executado');
    const emAndamento = servicos.filter(s => s.statusExecucao !== 'Concluído' && s.statusExecucao !== 'Cancelado / Não Executado');

    let msg = `* GCAC | Despachante Bélico *\n_Ordem de Serviço ${formatarNumeroOS(ordem.numero)}_\n\n`;
    msg += `Olá, *${ordem.nomeCliente}*! Tudo bem?\n\n`;

    if (cancelados.length > 0 && emAndamento.length === 0) {
      msg += `Como não conseguimos retorno para finalizar as últimas pendências, informamos que a sua Ordem de Serviço (${formatarNumeroOS(ordem.numero)}) foi finalizada no nosso sistema.\n\n`;
      msg += `Segue o resumo do seu processo:\n\n`;

      if (concluidos.length > 0) {
        msg += `✅ *SERVIÇOS EXECUTADOS COM SUCESSO:*\n`;
        concluidos.forEach(s => {
          let armaInfo = '';
          if (s.armaId) {
            const arma = armasCliente.find(a => a.id === s.armaId);
            if (arma) armaInfo = ` (${arma.fabricante} ${arma.modelo})`;
          } else if (s.armaModelo) {
            armaInfo = ` (${s.armaModelo})`;
          }
          const obs = s.detalhes?.trim() ? ` - _${s.detalhes.trim()}_` : '';
          msg += `• ${s.nome}${armaInfo}${obs}\n`;
        });
        msg += `\n`;
      }

      msg += `❌ *SERVIÇOS NÃO EXECUTADOS (Falta de retorno / Cancelado):*\n`;
      cancelados.forEach(s => {
        const obs = s.detalhes?.trim() ? ` - _${s.detalhes.trim()}_` : '';
        msg += `• ${s.nome}${obs}\n`;
      });
      msg += `\n`;

      msg += `Agradecemos imensamente a confiança no nosso trabalho e continuamos à disposição caso decida retomar os serviços no futuro. Qualquer dúvida, é só chamar!\n`;
    } else {
      msg += `Seguem os detalhes da sua O.S.:\n\n`;
      
      servicos.forEach(s => {
        const icon = s.statusExecucao === 'Concluído' ? '✅' : s.statusExecucao === 'Cancelado / Não Executado' ? '❌' : '🔹';
        msg += `${icon} *${s.nome}*\n`;
        msg += `   Valor: _${formatarMoeda(s.valor || 0)}_\n`;
        
        const nomeUpper = (s.nome || '').toUpperCase();
        const isGuiaTrafego = nomeUpper.includes('GUIA DE TRÁFEGO') || nomeUpper.includes('GUIA DE TRAFEGO') || nomeUpper.includes('GT');
        
        if (isGuiaTrafego) {
          let armaInfo = '';
          if (s.armaId) {
            const arma = armasCliente.find(a => a.id === s.armaId);
            if (arma) {
              armaInfo = `${arma.fabricante} ${arma.modelo} (${arma.calibre}) - Série: ${arma.numeroSerie}`;
            }
          }
          if (!armaInfo && s.armaModelo) {
            armaInfo = s.armaModelo;
          }
          if (armaInfo) {
            msg += `   Arma: _${armaInfo}_\n`;
          }
        }

        if (s.detalhes && s.detalhes.trim()) {
          msg += `   Obs: _${s.detalhes.trim()}_\n`;
        }
        if (s.pagoGRU) msg += `   GRU: _Paga_\n`;
        if (s.protocolo) msg += `   📑 Prot: _${s.protocolo}_\n`;
        msg += `\n`;
      });
      
      msg += `💰 *Valor Total:* ${formatarMoeda(ordem.valor)}\n\n`;
      msg += `Qualquer dúvida, estamos à disposição!`;
    }
    
    setMensagemWhatsApp(msg);
    setModalWhatsAppAberto(true);
  };

  const handleMudarStatus = async (servicoId: string, novoStatus: StatusExecucaoServico) => {
    if (novoStatus === 'Protocolado — Ag. PF') {
      const serv = ordem.servicos.find(s => s.id === servicoId);
      setServicoParaProtocolo({
        id: servicoId,
        nome: serv?.nome || '',
        protocoloExistente: serv?.protocolo || ''
      });
      setNovoProtocolo(serv?.protocolo || '');
      setModalProtocoloAberto(true);
      setStatusAberto(null);
      return;
    }

    if (novoStatus === 'Concluído') {
      const serv = ordem.servicos.find(s => s.id === servicoId);
      const isGuia = serv?.nome.toUpperCase().includes('GUIA') || serv?.nome.toUpperCase().includes('GT');
      const isCraf = serv?.nome.toUpperCase().includes('CRAF') || serv?.nome.toUpperCase().includes('REGISTRO');
      
      let defaultTipo: 'Treino' | 'Caça' | 'Manutenção' | 'Transferência' | 'Outro' = 'Treino';
      if (serv?.gtTipo) {
        const t = serv.gtTipo.toLowerCase();
        if (t.includes('caça') && !t.includes('treinamento')) defaultTipo = 'Caça';
        else if (t.includes('manutenção') || t.includes('manutencao')) defaultTipo = 'Manutenção';
        else if (t.includes('transferência') || t.includes('transferencia')) defaultTipo = 'Transferência';
        else if (t.includes('treinamento') || t.includes('treino') || t.includes('competição') || t.includes('competicao')) defaultTipo = 'Treino';
        else defaultTipo = 'Outro';
      }

      setServicoConclusao({
        id: servicoId,
        nome: serv?.nome || '',
        exigeGt: !!isGuia,
        exigeCraf: !!isCraf
      });
      setConclusaoArquivo(null);
      setSalvarNoPerfilCac(false);
      setVencimentoGt('');
      setVencimentoCraf('');
      setDestinoGt('');
      setTipoGt(defaultTipo);
      setModalConclusaoAberto(true);
      setStatusAberto(null);
      return;
    }

    try {
      await atualizarStatusServico(ordem.id, servicoId, novoStatus);
      setStatusAberto(null);
    } catch {
      mostrar('erro', 'Erro ao atualizar o status do serviço.');
    }
  };

  const confirmarProtocolo = async () => {
    if (!servicoParaProtocolo) return;
    try {
      await atualizarStatusServico(ordem.id, servicoParaProtocolo.id, 'Protocolado — Ag. PF', novoProtocolo);
      setModalProtocoloAberto(false);
      setServicoParaProtocolo(null);
      mostrar('sucesso', 'Status e protocolo atualizados com sucesso!');
    } catch {
      mostrar('erro', 'Erro ao salvar o protocolo.');
    }
  };

  const handleConclusaoArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setConclusaoArquivo(base64);

      if (file.type === 'application/pdf' && servicoConclusao?.exigeGt) {
        mostrar('info', 'Analisando arquivo PDF da Guia de Tráfego...');
        try {
          const parsed = await parseGtPdf(file);
          if (parsed) {
            if (parsed.vencimento) {
              setVencimentoGt(parsed.vencimento);
            }
            if (parsed.cidade && parsed.uf) {
              setDestinoGt(`${parsed.cidade} - ${parsed.uf}`);
            }
            setSalvarNoPerfilCac(true);
            mostrar('sucesso', 'Dados da Guia extraídos com sucesso do PDF!');
          }
        } catch (parseErr) {
          console.warn('Erro ao ler PDF de Guia:', parseErr);
        }
      }

      if (file.type === 'application/pdf' && servicoConclusao?.exigeCraf) {
        mostrar('info', 'Analisando arquivo PDF do CRAF...');
        try {
          const parsed = await parseCrafPdf(file);
          if (parsed) {
            if (parsed.vencimento) {
              setVencimentoCraf(parsed.vencimento);
            }
            setSalvarNoPerfilCac(true);
            mostrar('sucesso', 'Data de vencimento extraída com sucesso do PDF do CRAF!');
          }
        } catch (parseErr) {
          console.warn('Erro ao ler PDF de CRAF:', parseErr);
        }
      }
    } catch (err) {
      console.error(err);
      mostrar('erro', 'Erro ao ler arquivo.');
    }
  };

  const confirmarConclusao = async () => {
    if (!servicoConclusao) return;
    setSalvandoConclusao(true);
    try {
      let finalFileUrl = '';
      
      if (conclusaoArquivo) {
        const { v4: uuidv4 } = await import('uuid');
        const ext = conclusaoArquivo.split(';base64,')[0].split(':')[1].split('/')[1] || 'pdf';
        const path = `${usuario?.empresaId}/ordens/servicos/${servicoConclusao.id}/conclusao_${uuidv4()}.${ext}`;
        const publicUrl = await uploadBase64File(conclusaoArquivo, 'documentos-clientes', path);
        finalFileUrl = publicUrl || '';
      }

      const serv = ordem.servicos.find(s => s.id === servicoConclusao.id);
      
      // Obter armaId e armaModelo a serem associados ao serviço
      let targetArmaId = serv?.armaId;
      let targetArmaModelo = serv?.armaModelo;
      
      if ((servicoConclusao.exigeGt || servicoConclusao.exigeCraf) && salvarNoPerfilCac && armaSelecionadaId) {
        targetArmaId = armaSelecionadaId;
        const arma = armasCliente.find(a => a.id === armaSelecionadaId);
        if (arma) {
          targetArmaModelo = `${arma.fabricante} ${arma.modelo} (${arma.calibre})`;
        }
      }

      await atualizarStatusServico(
        ordem.id, 
        servicoConclusao.id, 
        'Concluído', 
        undefined, 
        finalFileUrl,
        (servicoConclusao.exigeGt || servicoConclusao.exigeCraf) && salvarNoPerfilCac ? targetArmaId : undefined,
        (servicoConclusao.exigeGt || servicoConclusao.exigeCraf) && salvarNoPerfilCac ? targetArmaModelo : undefined
      );

      if (servicoConclusao.exigeGt && salvarNoPerfilCac && targetArmaId) {
        await salvarGt({
          armaId: targetArmaId,
          tipo: tipoGt,
          vencimento: vencimentoGt,
          destino: destinoGt.toUpperCase(),
          arquivoUrl: finalFileUrl || undefined
        });
      }

      if (servicoConclusao.exigeCraf && salvarNoPerfilCac && targetArmaId && clienteDaOS) {
        const arma = armasCliente.find(a => a.id === targetArmaId);
        if (arma) {
          await salvarArma({
            ...arma,
            vencimentoCraf: vencimentoCraf || undefined,
            crafUrl: finalFileUrl || arma.crafUrl || undefined
          }, clienteDaOS.empresaId);
        }
      }

      setModalConclusaoAberto(false);
      setServicoConclusao(null);
      mostrar('sucesso', 'Serviço concluído com sucesso!');
    } catch (err: any) {
      console.error(err);
      mostrar('erro', 'Erro ao concluir o serviço: ' + (err.message || ''));
    } finally {
      setSalvandoConclusao(false);
    }
  };

  const handleMudarStatusOS = async (novoStatus: StatusOS) => {
    try {
      const dados: Partial<OrdemDeServico> = { status: novoStatus };
      if (novoStatus === 'Aguardando Pagamento') dados.formaPagamento = 'Pendente';
      if (novoStatus === 'Gratuidade') dados.formaPagamento = 'A Combinar';
      
      await atualizarOrdem(ordem.id, dados);
      setDropdownPagoAberto(false);
      mostrar('sucesso', 'Status da OS atualizado!');
    } catch {
      mostrar('erro', 'Erro ao atualizar o status da OS.');
    }
  };

  const handleMudarFormaPagamento = async (novaForma: FormaPagamento) => {
    try {
      await atualizarOrdem(ordem.id, { formaPagamento: novaForma });
      setDropdownFormaAberto(false);
      mostrar('sucesso', 'Forma de pagamento atualizada!');
    } catch {
      mostrar('erro', 'Erro ao atualizar a forma de pagamento.');
    }
  };

  const handleToggleGru = async (servicoId: string, pagoAtual: boolean) => {
    try {
      await atualizarGruServico(ordem.id, servicoId, !pagoAtual);
      mostrar('sucesso', `Status da GRU atualizado para ${!pagoAtual ? 'Paga' : 'Pendente'}`);
    } catch {
      mostrar('erro', 'Erro ao atualizar o status da GRU.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </button>
          {podeExcluir && (
            <button 
              onClick={() => setConfirmandoDelete(true)}
              className="p-1 px-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all group"
              title="Excluir O.S."
            >
              <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{formatarNumeroOS(ordem.numero)}</h1>
              {ordem.migrado && (
                <span className="text-[10px] font-black text-brand-blue-light border border-brand-blue/30 px-2 py-0.5 rounded-md uppercase tracking-wider bg-brand-blue/5">Histórico</span>
              )}
            </div>
            <p className="text-sm text-gray-400">Criado em {formatarData(ordem.criadoEm)}</p>
          </div>
        </div>
        
        {/* Dropdown Status de Pagamento */}
        <div className="relative">
          <button 
            onClick={() => setDropdownPagoAberto(!dropdownPagoAberto)}
            className={`${classeStatus(ordem.status)} cursor-pointer flex items-center gap-2 hover:brightness-110 transition-all`}
          >
            {ordem.status}
            <ChevronDown size={14} className={`transition-transform ${dropdownPagoAberto ? 'rotate-180' : ''}`} />
          </button>

          {dropdownPagoAberto && (
            <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-brand-dark-2 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden py-1 animate-scale-up">
              {STATUS_OS.map(s => (
                <button
                  key={s}
                  onClick={() => handleMudarStatusOS(s)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                    ordem.status === s 
                      ? 'bg-brand-blue/20 text-brand-blue-light' 
                      : 'text-gray-400 hover:bg-brand-dark-5 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ações ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={handleWhatsApp} className="btn-ghost btn-sm justify-center bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/20">
          <MessageCircle size={15} />
          WhatsApp
        </button>
        <button onClick={handleBaixarPdf} disabled={gerandoPdf} className="btn-ghost btn-sm justify-center">
          <FileDown size={15} />
          {gerandoPdf ? 'Gerando...' : 'Baixar PDF'}
        </button>
        <button onClick={handleImprimir} disabled={imprimindo} className="btn-ghost btn-sm justify-center">
          <Printer size={15} />
          {imprimindo ? 'Abrindo...' : 'Imprimir'}
        </button>
        <button onClick={() => navigate(`/ordens/${ordem.id}/editar`)} className="btn-ghost btn-sm justify-center">
          <Edit size={15} />
          Editar
        </button>
        {podeExcluir && (
          <button 
            onClick={() => setConfirmandoDelete(true)} 
            className="btn-danger-soft w-full justify-center text-sm font-black uppercase tracking-wider"
          >
            <Trash2 size={16} />
            Excluir Ordem de Serviço
          </button>
        )}
      </div>

      {/* ── Status de Sync ── */}
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {ordem.ultimaSincronizacao ? (
            <>
              <CheckCircle size={18} className="text-brand-green" />
              <div>
                <p className="text-sm font-medium text-white">Sincronizado com o Google Drive</p>
                <p className="text-xs text-gray-400">Último sync: {formatarDataHora(ordem.ultimaSincronizacao)}</p>
              </div>
            </>
          ) : (
            <>
              <CloudOff size={18} className="text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-300">Aguardando sincronização</p>
                <p className="text-xs text-gray-400">Sincronize manualmente ou aguarde conexão</p>
              </div>
            </>
          )}
        </div>
        <button onClick={handleSincronizar} disabled={sincronizando} className="btn-ghost btn-sm">
          <Cloud size={14} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {/* ── Dados do Cliente ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-brand-blue-light uppercase tracking-wider">Dados do Cliente</h3>
          <button 
            onClick={handleSincronizarPerfil}
            disabled={sincronizandoPerfil}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-brand-blue/10 text-brand-blue-light border border-brand-blue/20 hover:bg-brand-blue/20 transition-all uppercase tracking-widest disabled:opacity-50"
            title="Atualizar dados desta OS com o que está cadastrado no perfil do cliente"
          >
            <RefreshCw size={10} className={sincronizandoPerfil ? 'animate-spin' : ''} />
            {sincronizandoPerfil ? 'Sincronizando...' : 'Sincronizar Perfil'}
          </button>
        </div>
        <dl className="space-y-3">
          <CampoDetalhe rotulo="Nome" valor={ordem.nomeCliente} />
          <CampoDetalhe rotulo="CPF" valor={ordem.cpf} />
          <CampoDetalhe rotulo="Contato" valor={ordem.contato} />
          <CampoDetalhe rotulo="Senha GOV.br" valor={ordem.senhaGov} />
          <CampoDetalhe rotulo="Endereço" valor={ordem.endereco} />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 flex-shrink-0 text-ellipsis overflow-hidden whitespace-nowrap" title="Clube de Tiro e Caça Filiado">
              Clube Filiado
            </dt>
            <dd className="uppercase text-sm">
              {ordem.filiadoProTiro ? (
                <span className="font-semibold text-brand-green-light">
                  {usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE DE TIRO E CAÇA PRÓ TIRO'}
                </span>
              ) : (
                <span className="text-gray-400 font-medium">
                  {ordem.clubeFiliado || 'NÃO FILIADO'}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Serviço ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-brand-green-light uppercase tracking-wider">Descrição do Serviço</h3>
          <span className="text-xs font-bold text-gray-400 bg-brand-dark-4 px-2 py-1 rounded">
            {servicosConcluidos} / {totalServicos} Concluídos
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-2.5 bg-brand-dark-4 rounded-full overflow-hidden border border-brand-dark-5 shadow-inner">
            <div 
              className={`h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(109,190,69,0.3)] ${
                progresso === 100 ? 'bg-brand-green' : 'bg-brand-blue'
              }`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className={`text-xs font-black min-w-[32px] text-right ${progresso === 100 ? 'text-brand-green' : 'text-brand-blue-light'}`}>
            {progresso}%
          </span>
        </div>
        
        {servicos && servicos.length > 0 ? (
          <div className="space-y-3">
            {servicos.map((serv) => (
              <div key={serv.id} className="bg-brand-dark-4 rounded-lg p-4 border border-brand-dark-5 relative">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                    <p className="font-bold text-white text-base leading-tight">• {serv.nome}</p>
                    
                    {/* Selo de GRU */}
                    {(serv.exigeGRU === true || (serv.exigeGRU === undefined && (serv.taxaPF || 0) > 0)) && (
                      <button
                        onClick={() => handleToggleGru(serv.id, !!serv.pagoGRU)}
                        className={`text-[9px] font-black px-2 py-0.5 rounded border transition-all uppercase tracking-widest flex items-center gap-1 ${
                          serv.pagoGRU 
                            ? 'bg-brand-green/10 text-brand-green border-brand-green/20 hover:bg-brand-green/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                        }`}
                        title={serv.pagoGRU ? 'Clique para marcar como Pendente' : 'Clique para marcar como Paga'}
                      >
                        {serv.pagoGRU ? (
                          <><span>✅</span> GRU PAGA</>
                        ) : (
                          <><span>❌</span> GRU PENDENTE</>
                        )}
                        {(serv.taxaPF || 0) > 0 && (
                          <span className="opacity-80">({formatarMoeda(serv.taxaPF || 0)})</span>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Bloco à Direita: Botão de Status + Valor Abaixo */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {/* Dropdown de status */}
                    <div className="relative">
                      <button 
                        onClick={() => setStatusAberto(statusAberto === serv.id ? null : serv.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider ${classeStatusExecucao(serv.statusExecucao)}`}
                      >
                        <span>{iconeStatusExecucao(serv.statusExecucao)}</span>
                        <span>{serv.statusExecucao || 'Não Iniciado'}</span>
                        <ChevronDown size={12} className={`transition-transform ${statusAberto === serv.id ? 'rotate-180' : ''}`} />
                      </button>

                      {statusAberto === serv.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-brand-dark-2 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden py-1 animate-scale-up">
                          {STATUS_EXECUCAO_SERVICO.map(s => (
                            <button
                              key={s}
                              onClick={() => handleMudarStatus(serv.id, s)}
                              className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors flex items-center gap-2 ${
                                serv.statusExecucao === s 
                                  ? 'bg-brand-blue/20 text-brand-blue-light' 
                                  : 'text-gray-400 hover:bg-brand-dark-5 hover:text-white'
                              }`}
                            >
                              <span className="text-sm">{iconeStatusExecucao(s)}</span>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Valor Individual do Serviço (Abaixo do botão de status da OS) */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1">
                      {serv.pagoDireto && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider" title="Valor pago diretamente ao parceiro / terceiro">
                          Pago Direto
                        </span>
                      )}
                      <span className="text-xs sm:text-sm font-black text-brand-green-light bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 font-semibold uppercase">Valor:</span>
                        <span>{formatarMoeda(serv.valor || 0)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pl-4 border-l-2 border-brand-dark-5">
                  {serv.protocolo && (
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-brand-blue-light bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 uppercase tracking-widest flex items-center gap-1.5">
                         <List size={10} /> PROTOCOLO: {serv.protocolo}
                       </span>
                    </div>
                  )}

                  {serv.armaModelo && (
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest flex items-center gap-1.5" title="Armamento Vinculado">
                         ⚔️ ARMA: {serv.armaModelo}
                       </span>
                    </div>
                  )}

                  {serv.arquivoUrl && (
                    <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => {
                           if (serv.arquivoUrl!.startsWith('data:')) {
                             visualizarDocumentoBase64(serv.arquivoUrl!, `Documento-${serv.nome}`);
                           } else {
                             window.open(serv.arquivoUrl, '_blank');
                           }
                         }}
                         className="text-[10px] font-black text-brand-green-light bg-brand-green/10 px-2 py-0.5 rounded border border-brand-green/20 uppercase tracking-widest flex items-center gap-1.5 hover:bg-brand-green/20 transition-all text-left"
                       >
                         📄 VISUALIZAR DOCUMENTO ANEXADO
                       </button>
                    </div>
                  )}

                  {(serv.responsavelNome || serv.valorRepasse) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {serv.responsavelNome && (
                        <span className="text-[10px] font-black text-gray-400 bg-brand-dark-5 px-2 py-0.5 rounded border border-brand-dark-5 uppercase tracking-widest flex items-center gap-1.5">
                          <Users size={10} /> {serv.responsavelNome}
                        </span>
                      )}
                      {serv.valorRepasse ? (
                        <span className="text-[10px] font-black text-brand-green-light bg-brand-green/10 px-2 py-0.5 rounded border border-brand-green/20 uppercase tracking-widest flex items-center gap-1.5">
                          <CreditCard size={10} /> COMISSÃO: {formatarMoeda(serv.valorRepasse)}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {serv.detalhes.trim() && (
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {serv.detalhes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-brand-dark-4 rounded-lg p-4 border border-brand-dark-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
              {/* Fallback caso antiga O.S. tenha texto legado */}
              {(ordem as any).servico || 'Nenhum serviço registrado.'}
            </p>
            <span className="text-xs sm:text-sm font-black text-brand-green-light bg-brand-green/10 border border-brand-green/20 px-2.5 py-0.5 rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Valor:</span>
              <span>{formatarMoeda(ordem.valor || 0)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wider mb-4 flex justify-between items-center">
          Valores e Pagamento
          {ordem.status !== 'Gratuidade' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              ordem.status === 'Pago' ? 'bg-brand-green/20 text-brand-green border-brand-green/30' :
              ordem.status === 'Parcialmente Pago' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {ordem.status}
            </span>
          )}
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase">Total Bruto</p>
            <p className="text-xl font-black text-white">{formatarMoeda(ordem.valor)}</p>
            <div className="mt-2 pt-2 border-t border-brand-dark-5 space-y-1">
              <p className="text-[9px] text-gray-500 uppercase flex justify-between">Honorários: <span className="text-gray-300">{formatarMoeda(ordem.servicos?.filter((s: any) => !isLaudoExame(s.categoria || '', usuario?.dadosEmpresa?.categoriasServico)).reduce((acc, s) => acc + (s.valor || 0), 0) || 0)}</span></p>
              <p className="text-[9px] text-gray-500 uppercase flex justify-between">Laudos: <span className="text-gray-300">{formatarMoeda(ordem.servicos?.filter((s: any) => isLaudoExame(s.categoria || '', usuario?.dadosEmpresa?.categoriasServico)).reduce((acc, s) => acc + (s.valor || 0), 0) || 0)}</span></p>
            </div>
          </div>

          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5 relative group">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Desconto</p>
              {!editandoDesconto && (
                <button 
                  onClick={() => setEditandoDesconto(true)} 
                  className="text-gray-400 hover:text-white transition-colors p-0.5"
                  title="Editar Desconto"
                >
                  <Edit size={10} />
                </button>
              )}
            </div>
            {editandoDesconto ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs font-bold text-gray-400">R$</span>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={valorDescontoInput}
                  onChange={(e) => setValorDescontoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSalvarDesconto();
                    if (e.key === 'Escape') {
                      setEditandoDesconto(false);
                      setValorDescontoInput(String(ordem.desconto || 0));
                    }
                  }}
                  className="bg-brand-dark-3 border border-brand-dark-5 rounded px-1 py-0.5 text-xs text-white w-14 outline-none focus:border-brand-blue"
                  autoFocus
                />
                <button 
                  onClick={handleSalvarDesconto}
                  className="bg-brand-green hover:bg-brand-green-light text-white text-[9px] font-black px-1 py-0.5 rounded transition-colors"
                >
                  OK
                </button>
              </div>
            ) : (
              <p className="text-xl font-black text-amber-500">
                {ordem.desconto && ordem.desconto > 0 ? `-${formatarMoeda(ordem.desconto)}` : formatarMoeda(0)}
              </p>
            )}
            <div className="mt-2 pt-2 border-t border-brand-dark-5">
              <p className="text-[9px] text-gray-500 uppercase">Líquido: <span className="text-gray-300 font-bold">{formatarMoeda(ordem.valor - (ordem.desconto || 0))}</span></p>
            </div>
          </div>
          
          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase">Valor Recebido</p>
            <p className="text-xl font-black text-brand-green">{formatarMoeda(ordem.valorPago || 0)}</p>
            <div className="mt-2 pt-2 border-t border-brand-dark-5">
               <p className="text-[9px] text-gray-500 uppercase">Última forma: <span className="text-gray-300 font-bold">{ordem.formaPagamento}</span></p>
            </div>
          </div>

          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase">Saldo Devedor</p>
            <p className={`text-xl font-black ${(ordem.valor - (ordem.desconto || 0) - (ordem.valorPago || 0)) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {formatarMoeda(Math.max(0, (ordem.valor - (ordem.desconto || 0)) - (ordem.valorPago || 0)))}
            </p>
            <div className="mt-2 pt-2 border-t border-brand-dark-5">
              <p className="text-[9px] text-gray-500 uppercase">Status: <span className="text-gray-300 font-bold">{ordem.status}</span></p>
            </div>
          </div>
        </div>

        {/* Histórico de Pagamentos */}
        {ordem.status !== 'Gratuidade' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <List size={14} className="text-brand-blue" />
                Histórico de Recebimentos
              </h4>
              
              <div className="flex gap-2 items-center flex-wrap justify-end">
                {clienteDaOS && saldoCredito > 0 && (
                  <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-1 rounded">
                    SALDO: {formatarMoeda(saldoCredito)}
                  </span>
                )}
              {(ordem.valor - (ordem.desconto || 0)) > (ordem.valorPago || 0) && (
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    id="quick-pag-valor"
                    className="bg-brand-dark-3 border border-brand-dark-5 rounded px-2 py-1 text-xs text-white w-24 focus:border-brand-blue outline-none transition-colors"
                    placeholder="Valor"
                  />
                  <select 
                    id="quick-pag-metodo"
                    className="bg-brand-dark-3 border border-brand-dark-5 rounded px-2 py-1 text-xs text-white focus:border-brand-blue outline-none transition-colors"
                  >
                    {FORMAS_PAGAMENTO.filter(f => f !== 'Pendente').map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                    <button 
                      onClick={() => {
                        const input = document.getElementById('quick-pag-valor') as HTMLInputElement;
                        const metodo = (document.getElementById('quick-pag-metodo') as HTMLSelectElement).value as FormaPagamento;
                        const valor = parseFloat(input.value);
                        if (valor > 0) {
                          if (metodo === 'Crédito de Cliente' && valor > saldoCredito) {
                            mostrar('erro', 'Saldo insuficiente para este pagamento.');
                            return;
                          }
                          
                          if (metodo === 'Crédito de Cliente' && clienteDaOS) {
                            adicionarCredito({
                              clienteId: clienteDaOS.id,
                              tipo: 'saida',
                              valor: valor,
                              descricao: `Pagamento da O.S. #${formatarNumeroOS(ordem.numero)}`,
                              origemId: ordem.id,
                              criadoPorNome: usuario?.nome
                            });
                          }

                          registrarPagamento(ordem.id, valor, metodo);
                          
                          // Verifica se sobrou troco para gerar crédito
                          const saldoDevedorAtual = (ordem.valor - (ordem.desconto || 0)) - (ordem.valorPago || 0);
                          if (valor > saldoDevedorAtual && clienteDaOS && metodo !== 'Crédito de Cliente') {
                            const troco = valor - saldoDevedorAtual;
                            if (window.confirm(`Este pagamento gera um troco de ${formatarMoeda(troco)}. Deseja adicionar este troco como crédito (Haver) para o cliente?`)) {
                              adicionarCredito({
                                clienteId: clienteDaOS.id,
                                tipo: 'entrada',
                                valor: troco,
                                descricao: `Troco O.S. #${formatarNumeroOS(ordem.numero)}`,
                                origemId: ordem.id,
                                criadoPorNome: usuario?.nome
                              });
                            }
                          }
                          
                          input.value = '';
                        }
                      }}
                      className="bg-brand-blue hover:bg-brand-blue-light text-white text-[10px] font-bold px-3 py-1 rounded transition-colors"
                    >
                      REGISTRAR
                    </button>
                  </div>
              )}
            </div>
            </div>

            <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-brand-dark-2 border-b border-brand-dark-5">
                    <th className="px-4 py-2 font-bold text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-2 font-bold text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-2 font-bold text-gray-500 uppercase text-right">Valor</th>
                    <th className="px-4 py-2 font-bold text-gray-500 uppercase text-right w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5">
                  {(ordem.historicoPagamentos && ordem.historicoPagamentos.length > 0) ? (
                    ordem.historicoPagamentos.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 font-bold text-white uppercase">{p.metodo}</td>
                        <td className="px-4 py-3 font-black text-brand-green text-right">{formatarMoeda(p.valor)}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja excluir o pagamento de ${formatarMoeda(p.valor)}?`)) {
                                if (p.metodo === 'Crédito de Cliente' && clienteDaOS) {
                                  if (window.confirm('Este pagamento usou créditos do cliente. Deseja estornar esse valor de volta para a carteira do cliente?')) {
                                    adicionarCredito({
                                      clienteId: clienteDaOS.id,
                                      tipo: 'entrada',
                                      valor: p.valor,
                                      descricao: `Estorno de pagamento O.S. #${formatarNumeroOS(ordem.numero)}`,
                                      origemId: ordem.id,
                                      criadoPorNome: usuario?.nome
                                    });
                                  }
                                }
                                removerPagamento(ordem.id, p.id);
                              }
                            }}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="Remover Pagamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500 italic">Nenhum pagamento registrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Observações ── */}
      {ordem.observacoes && (
        <div className="card">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Observações</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{ordem.observacoes}</p>
        </div>
      )}

      {/* ── Canal de Atendimento ── */}
      {(ordem.canalAtendimento || ordem.observacaoContato) && (
        <div className="card">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Canal de Atendimento</h3>
          <div className="flex flex-col gap-2">
            {ordem.canalAtendimento && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold w-fit ${
                ordem.canalAtendimento === 'WhatsApp'   ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : ordem.canalAtendimento === 'Presencial' ? 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30'
              : ordem.canalAtendimento === 'Ligação'    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : ordem.canalAtendimento === 'E-mail'     ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              :                                           'bg-brand-metal/20 text-gray-300 border border-brand-metal/30'
              }`}>
                <CanalIcone canal={ordem.canalAtendimento} />
                {ordem.canalAtendimento}
              </div>
            )}
            {ordem.observacaoContato && (
              <p className="text-sm text-gray-300">{ordem.observacaoContato}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Linha do Tempo / Histórico ── */}
      <div className="card border-l-4 border-brand-blue">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
          <History size={18} className="text-brand-blue-light" />
          Linha do Tempo / Histórico
        </h3>
        
        <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-dark-5">
          {ordem.historicoStatus && ordem.historicoStatus.length > 0 ? (
            [...ordem.historicoStatus].reverse().map((evento, idx) => (
              <div key={evento.id} className="relative pl-8 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                {/* Marcador do ponto na linha */}
                <div className={`absolute left-0 top-1.5 w-4.5 h-4.5 rounded-full border-4 border-brand-dark-2 flex items-center justify-center z-10 ${
                  evento.tipo === 'criacao' ? 'bg-brand-blue shadow-[0_0_8px_rgba(0,123,255,0.4)]' :
                  evento.tipo === 'status_os' ? 'bg-brand-green shadow-[0_0_8px_rgba(109,190,69,0.4)]' :
                  evento.tipo === 'pagamento' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]' :
                  evento.tipo === 'protocolo' ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]' :
                  evento.tipo === 'gru' ? 'bg-brand-green shadow-[0_0_8px_rgba(109,190,69,0.4)]' :
                  'bg-brand-metal'
                }`}>
                   <span className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-bold text-white leading-tight">
                      {evento.descricao}
                    </p>
                    <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap bg-brand-dark-4 px-2 py-0.5 rounded flex items-center gap-1.5">
                      <Clock size={10} />
                      {formatarDataHora(evento.data)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <span>Responsável:</span>
                    <span className="text-brand-blue-light/80">{evento.usuario}</span>
                  </div>

                  {(evento.valorAnterior || evento.valorNovo) && (
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 bg-brand-dark-4 px-1.5 py-0.5 rounded line-through">{evento.valorAnterior}</span>
                      <span className="text-brand-blue-light">→</span>
                      <span className="text-white bg-brand-blue/20 px-1.5 py-0.5 rounded border border-brand-blue/30 font-bold">{evento.valorNovo}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-500 italic">Nenhum evento registrado nesta O.S.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Auditoria e Rastreio ── */}
      <div className="card bg-brand-dark-3/30 border-dashed border-brand-dark-5">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <ShieldCheck size={12} className="text-brand-blue-light/50" />
          Informações de Auditoria
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Emissão do Documento</p>
            <p className="text-xs text-white uppercase font-bold">{ordem.criadoPorNome || 'Sistema (Antigo)'}</p>
            <p className="text-[10px] text-gray-500">{formatarDataHora(ordem.criadoEm)}</p>
          </div>
          {ordem.status === 'Pago' && (
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Conclusão / Baixa</p>
              <p className="text-xs text-brand-green uppercase font-bold">{ordem.concluidoPorNome || 'Automático'}</p>
              <p className="text-[10px] text-gray-500">{formatarDataHora(ordem.atualizadoEm)}</p>
            </div>
          )}
        </div>
      </div>

      <Notificacao {...notif} onFechar={fechar} />
      <DialogConfirmacao
        aberto={confirmandoDelete}
        titulo="Excluir Ordem de Serviço"
        mensagem={`Tem certeza que deseja excluir a ${formatarNumeroOS(ordem.numero)}? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(false)}
      />

      <ModalEscolhaWhatsApp 
        aberto={modalWhatsAppAberto}
        onFechar={() => setModalWhatsAppAberto(false)}
        telefone={ordem.contato}
        mensagem={mensagemWhatsApp}
      />

      {modalProtocoloAberto && servicoParaProtocolo && (
        <Modal
          aberto={modalProtocoloAberto}
          onFechar={() => {
            setModalProtocoloAberto(false);
            setServicoParaProtocolo(null);
          }}
          titulo="Inserir Número de Protocolo"
          tamanho="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Serviço</label>
              <p className="text-sm text-gray-300 font-medium">{servicoParaProtocolo.nome}</p>
            </div>
            <div>
              <label className="label">Número de Protocolo</label>
              <input
                type="text"
                className="w-full bg-brand-dark-3 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none transition-colors uppercase"
                placeholder="Digite o número de protocolo"
                value={novoProtocolo}
                onChange={e => setNovoProtocolo(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 w-full pt-4 border-t border-brand-dark-5">
              <button
                onClick={() => {
                  setModalProtocoloAberto(false);
                  setServicoParaProtocolo(null);
                }}
                className="btn-ghost flex-1 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarProtocolo}
                className="btn-primary flex-1 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalConclusaoAberto && servicoConclusao && (
        <Modal
          aberto={modalConclusaoAberto}
          onFechar={() => {
            setModalConclusaoAberto(false);
            setServicoConclusao(null);
          }}
          titulo={`Concluir Serviço: ${servicoConclusao.nome}`}
          tamanho="md"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Anexar Documento Comprobatório (PDF/Imagem)</label>
              {conclusaoArquivo ? (
                <div className="flex items-center justify-between text-xs bg-brand-dark-3 p-3 rounded-xl border border-brand-dark-5">
                  <span className="text-gray-300 truncate font-semibold">✓ Documento carregado</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => visualizarDocumentoBase64(conclusaoArquivo, 'Documento')}
                      className="text-brand-blue-light hover:underline font-bold"
                    >
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConclusaoArquivo(null)}
                      className="text-red-400 hover:underline font-bold"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleConclusaoArquivoChange}
                  className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-brand-dark-5 file:text-xs file:font-bold file:bg-brand-dark-3 file:text-white hover:file:bg-brand-dark-2 cursor-pointer bg-brand-dark-4 border border-brand-dark-5 p-2 rounded-xl"
                />
              )}
            </div>

            {servicoConclusao.exigeGt && (
              <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salvarNoPerfilCac}
                    onChange={e => setSalvarNoPerfilCac(e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <div>
                    <span className="font-bold text-white text-xs">Registrar como Guia de Tráfego ativa no perfil do CAC</span>
                    <p className="text-[10px] text-gray-500">Isso fará o sistema gerenciar o vencimento desta guia automaticamente.</p>
                  </div>
                </label>

                {salvarNoPerfilCac && (
                  <div className="space-y-3 pt-2 border-t border-brand-dark-5/50 animate-scale-up">
                    <div>
                      <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Armamento da Guia</label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none transition-colors"
                          value={armaSelecionadaId}
                          onChange={e => setArmaSelecionadaId(e.target.value)}
                          required={salvarNoPerfilCac}
                        >
                          <option value="">Selecione uma arma...</option>
                          {armasCliente.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.fabricante} {a.modelo} ({a.calibre}) - SÉRIE: {a.numeroSerie}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setModalArmaAberto(true)}
                          className="px-3 py-2 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue-light border border-brand-blue/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                        >
                          + Cadastrar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo da Guia</label>
                        <select
                          className="w-full bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none"
                          value={tipoGt}
                          onChange={e => setTipoGt(e.target.value as any)}
                          required={salvarNoPerfilCac}
                        >
                          <option value="Treino">Treino</option>
                          <option value="Caça">Caça</option>
                          <option value="Manutenção">Manutenção</option>
                          <option value="Transferência">Transferência</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Data de Vencimento</label>
                        <input
                          type="date"
                          className="input text-xs"
                          value={vencimentoGt}
                          onChange={e => setVencimentoGt(e.target.value)}
                          required={salvarNoPerfilCac}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Clube / Destino</label>
                        <input
                          type="text"
                          className="input text-xs uppercase"
                          placeholder="Ex: JATAI-GO"
                          value={destinoGt}
                          onChange={e => setDestinoGt(e.target.value)}
                          required={salvarNoPerfilCac}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {servicoConclusao.exigeCraf && (
              <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salvarNoPerfilCac}
                    onChange={e => setSalvarNoPerfilCac(e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <div>
                    <span className="font-bold text-white text-xs">Registrar/Atualizar CRAF no perfil do cliente</span>
                    <p className="text-[10px] text-gray-500">Isso salvará esta arma e seu documento CRAF diretamente no perfil do cliente.</p>
                  </div>
                </label>

                {salvarNoPerfilCac && (
                  <div className="space-y-3 pt-2 border-t border-brand-dark-5/50 animate-scale-up">
                    <div>
                      <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Armamento do CRAF</label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-brand-dark-4 border border-brand-dark-5 focus:border-brand-blue/50 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none transition-colors"
                          value={armaSelecionadaId}
                          onChange={e => setArmaSelecionadaId(e.target.value)}
                          required={salvarNoPerfilCac}
                        >
                          <option value="">Selecione uma arma...</option>
                          {armasCliente.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.fabricante} {a.modelo} ({a.calibre}) - SÉRIE: {a.numeroSerie}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setModalArmaAberto(true)}
                          className="px-3 py-2 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue-light border border-brand-blue/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                        >
                          + Cadastrar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="label text-[10px] font-bold uppercase tracking-wider text-gray-400">Data de Vencimento do CRAF</label>
                      <input
                        type="date"
                        className="input text-xs"
                        value={vencimentoCraf}
                        onChange={e => setVencimentoCraf(e.target.value)}
                        required={salvarNoPerfilCac}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 w-full pt-4 border-t border-brand-dark-5">
              <button
                type="button"
                onClick={() => {
                  setModalConclusaoAberto(false);
                  setServicoConclusao(null);
                }}
                className="btn-ghost flex-1 py-2.5 rounded-lg text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarConclusao}
                disabled={
                  salvandoConclusao ||
                  (salvarNoPerfilCac && (
                    (servicoConclusao.exigeGt && (!vencimentoGt || !destinoGt || !armaSelecionadaId)) ||
                    (servicoConclusao.exigeCraf && (!vencimentoCraf || !armaSelecionadaId))
                  ))
                }
                className="btn-primary flex-1 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2"
              >
                {salvandoConclusao ? 'Processando...' : 'Confirmar Conclusão'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalArmaAberto && (
        <ModalArma
          onFechar={() => setModalArmaAberto(false)}
          onSalvar={async (armaData) => {
            try {
              if (!clienteDaOS) {
                mostrar('erro', 'Cliente não encontrado para esta ordem de serviço.');
                return;
              }
              const { v4: uuidv4 } = await import('uuid');
              const armaId = armaData.id || uuidv4();
              const novaArmaObj = {
                ...armaData,
                id: armaId,
                tipo: armaData.tipo?.trim(),
                modelo: armaData.modelo?.trim().toUpperCase(),
                calibre: armaData.calibre?.trim().toUpperCase(),
                fabricante: armaData.fabricante?.trim().toUpperCase(),
                numeroSerie: armaData.numeroSerie?.trim().toUpperCase(),
                numeroSigma: armaData.numeroSigma?.trim().toUpperCase(),
                acervo: armaData.acervo,
                vencimentoCraf: armaData.vencimentoCraf,
                crafEmRenovacao: armaData.crafEmRenovacao
              };

              await salvarArma({
                ...novaArmaObj,
                clienteId: clienteDaOS.id
              }, clienteDaOS.empresaId);

              const lista = await buscarArmas(clienteDaOS.id, clienteDaOS.empresaId);
              setArmasCliente(lista);
              setArmaSelecionadaId(armaId);
              setModalArmaAberto(false);
              mostrar('sucesso', 'Armamento cadastrado com sucesso!');
            } catch (err: any) {
              mostrar('erro', 'Erro ao registrar arma: ' + (err.message || 'Verifique os dados informados.'));
            }
          }}
        />
      )}
    </div>
  );
}

function CanalIcone({ canal }: { canal: CanalAtendimento }) {
  switch (canal) {
    case 'WhatsApp':   return <MessageCircle size={14} />;
    case 'Presencial': return <Users size={14} />;
    case 'Ligação':    return <Phone size={14} />;
    case 'E-mail':     return <Mail size={14} />;
    default:           return <HelpCircle size={14} />;
  }
}

function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 flex-shrink-0">{rotulo}</dt>
      <dd className="text-sm text-gray-200 font-medium">{valor || '—'}</dd>
    </div>
  );
}
