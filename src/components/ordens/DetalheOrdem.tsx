import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, FileDown, Printer, Cloud, CloudOff, CheckCircle, MessageCircle, Users, Phone, Mail, HelpCircle, ChevronDown, List, ShieldCheck, History, Clock, CreditCard, FileText, RefreshCw } from 'lucide-react';
import { 
  OrdemDeServico, CanalAtendimento, STATUS_EXECUCAO_SERVICO, 
  StatusExecucaoServico, StatusOS, FormaPagamento, STATUS_OS, FORMAS_PAGAMENTO 
} from '../../types';
import { useOrdens } from '../../context/OrdensContext';
import { useAuth } from '../../context/AuthContext';
import { baixarPdf, imprimirPdf } from '../../services/geradorPdf';
import { sincronizarOrdem } from '../../services/driveSync';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { useClientes } from '../../context/ClientesContext';
import { formatarMoeda, formatarData, formatarDataHora, formatarNumeroOS, classeStatus, classeStatusExecucao, iconeStatusExecucao, calcularProgressoServicos } from '../../utils/formatters';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';

interface DetalheOrdemProps {
  ordem: OrdemDeServico;
}

export function DetalheOrdem({ ordem }: DetalheOrdemProps) {
  const navigate = useNavigate();
  const { 
    deletarOrdem, atualizarStatusServico, atualizarOrdem, 
    atualizarGruServico, registrarPagamento, removerPagamento,
    sincronizarComPerfil
  } = useOrdens();
  const { clientes, buscarCreditos, adicionarCredito } = useClientes();
  const { estaAutenticado, usuario } = useAuth();
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
  
  const clienteDaOS = clientes.find(c => c.cpf === ordem.cpf);
  const [saldoCredito, setSaldoCredito] = useState(0);

  React.useEffect(() => {
    if (clienteDaOS) {
      buscarCreditos(clienteDaOS.id).then(creds => {
        setSaldoCredito(creds.reduce((acc, c) => acc + (c.tipo === 'entrada' ? c.valor : -c.valor), 0));
      });
    }
  }, [clienteDaOS, buscarCreditos, ordem.historicoPagamentos]);

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
    let msg = `* GCAC | Despachante Bélico *\n_Ordem de Serviço ${formatarNumeroOS(ordem.numero)}_\n\n`;
    msg += `Olá, *${ordem.nomeCliente}*!\n`;
    msg += `Seguem os detalhes da sua O.S.:\n\n`;
    
    (ordem.servicos || []).forEach(s => {
      const icon = s.statusExecucao === 'Concluído' ? '✅' : '🔹';
      msg += `${icon} *${s.nome}*\n`;
      msg += `   Status: _${s.statusExecucao || 'Não Iniciado'}_\n`;
      if (s.pagoGRU) msg += `   GRU: _Paga_\n`;
      if (s.protocolo) msg += `   📑 Prot: _${s.protocolo}_\n`;
      msg += `\n`;
    });
    
    msg += `💰 *Valor Total:* ${formatarMoeda(ordem.valor)}\n`;
    if (ordem.status !== 'Pago') msg += `💳 *Status Pagamento:* ${ordem.status}\n\n`;
    
    msg += `Qualquer dúvida, estamos à disposição!`;
    
    setMensagemWhatsApp(msg);
    setModalWhatsAppAberto(true);
  };

  const handleMudarStatus = async (servicoId: string, novoStatus: StatusExecucaoServico) => {
    try {
      await atualizarStatusServico(ordem.id, servicoId, novoStatus);
      setStatusAberto(null);
    } catch {
      mostrar('erro', 'Erro ao atualizar o status do serviço.');
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
          <button 
            onClick={() => setConfirmandoDelete(true)}
            className="p-1 px-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all group"
            title="Excluir O.S."
          >
            <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
          </button>
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
        <button 
          onClick={() => setConfirmandoDelete(true)} 
          className="btn-danger-soft w-full justify-center text-sm font-black uppercase tracking-wider"
        >
          <Trash2 size={16} />
          Excluir Ordem de Serviço
        </button>
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
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 flex-shrink-0">
              {ordem.filiadoProTiro ? 'Pró-Tiro' : 'Clube Filiado'}
            </dt>
            <dd>
              {ordem.filiadoProTiro
                ? <span className="text-sm font-semibold text-brand-green-light">✓ Filiado Pró-Tiro</span>
                : <span className="text-sm text-gray-200">{ordem.clubeFiliado || 'Não informado'}</span>
              }
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
                  <div className="flex flex-col items-start gap-1">
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
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de status */}
                  <div className="relative flex-shrink-0">
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
                </div>

                <div className="flex flex-col gap-1.5 pl-4 border-l-2 border-brand-dark-5">
                  {serv.protocolo && (
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-brand-blue-light bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 uppercase tracking-widest flex items-center gap-1.5">
                         <List size={10} /> PROTOCOLO: {serv.protocolo}
                       </span>
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
          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-brand-dark-4 rounded-lg p-4 border border-brand-dark-5">
            {/* Fallback caso antiga O.S. tenha texto legado */}
            {(ordem as any).servico || 'Nenhum serviço registrado.'}
          </p>
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
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase">Total da O.S.</p>
            <p className="text-xl font-black text-white">{formatarMoeda(ordem.valor)}</p>
            <div className="mt-2 pt-2 border-t border-brand-dark-5 space-y-1">
              <p className="text-[9px] text-gray-500 uppercase flex justify-between">Honorários: <span className="text-gray-300">{formatarMoeda(ordem.servicos?.filter((s: any) => s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0) || 0)}</span></p>
              <p className="text-[9px] text-gray-500 uppercase flex justify-between">Laudos: <span className="text-gray-300">{formatarMoeda(ordem.servicos?.filter((s: any) => s.categoria === 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0) || 0)}</span></p>
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
            <p className={`text-xl font-black ${(ordem.valor - (ordem.valorPago || 0)) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {formatarMoeda(Math.max(0, ordem.valor - (ordem.valorPago || 0)))}
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
              {ordem.valor > (ordem.valorPago || 0) && (
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
                          const saldoDevedorAtual = ordem.valor - (ordem.valorPago || 0);
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
