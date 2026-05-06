import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, MessageCircle, FileDown, ArrowLeft, Edit2, CheckCircle, Smartphone, User, DollarSign, Calendar, ChevronRight, Printer, ExternalLink, Trash2, Shield
} from 'lucide-react';
import { Orcamento } from '../../types';
import { formatarMoeda, formatarDataHora, classeStatusOrcamento } from '../../utils/formatters';
import { baixarPdfOrcamento, imprimirPdfOrcamento } from '../../services/geradorPdfOrcamento';
import { useOrdens } from '../../context/OrdensContext';
import { useOrcamentos } from '../../context/OrcamentosContext';
import { useClientes } from '../../context/ClientesContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';

interface DetalheOrcamentoProps {
  orcamento: Orcamento;
}

export function DetalheOrcamento({ orcamento }: DetalheOrcamentoProps) {
  const navigate = useNavigate();
  const { criarOrdem, ordens } = useOrdens();
  const { atualizarOrcamento, deletarOrcamento } = useOrcamentos();
  const { clientes, criarCliente } = useClientes();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'servicos'>('dados');
  const [convertendo, setConvertendo] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState('');

  const osVinculada = orcamento.convertidoOsId ? ordens.find(o => o.id === orcamento.convertidoOsId) : null;
  const temRenovacaoCRAF = orcamento.servicos.some(s => s.nome.toUpperCase().includes('RENOVAÇÃO DE CRAF'));

  const handleDeletar = async () => {
    try {
      await deletarOrcamento(orcamento.id);
      navigate('/orcamentos');
    } catch (error) {
      console.error('Erro ao deletar orçamento:', error);
      mostrar('erro', 'Falha ao excluir o orçamento.');
    }
  };

  const enviarParaWhatsApp = () => {
    let msg = `* GCAC | Despachante Bélico *\n_Orçamento ORC-${String(orcamento.numero).padStart(4, '0')}_\n\n`;
    msg += `Olá, *${orcamento.nomeCliente}*!\n`;
    msg += `Segue o resumo do seu orçamento:\n\n`;
    
    orcamento.servicos.forEach(s => {
      msg += `🔹 *${s.nome}*\n`;
      if (s.detalhes) msg += `   ${s.detalhes}\n`;
      msg += `   _Valor: ${formatarMoeda(s.valor)}_\n\n`;
    });
    
    msg += `🧾 *Valor Total Previsto:* ${formatarMoeda(orcamento.valorTotal)}\n\n`;
    
    if (orcamento.observacoes) {
      msg += `⚠️ *Observações:*\n${orcamento.observacoes}\n\n`;
    }
    
    msg += `Qualquer dúvida, estou à disposição!`;
    
    setMensagemWhatsApp(msg);
    setModalWhatsAppAberto(true);
  };

  const converterEmOS = async () => {
    if (!window.confirm('Tem certeza que deseja converter este orçamento em uma Ordem de Serviço?')) return;
    
    setConvertendo(true);
    try {
      // Verifica se o cliente já existe na base (pelo CPF ou Nome)
      const nomeClienteFormatado = String(orcamento.nomeCliente).toUpperCase();
      const clienteExistente = clientes.find(c => 
        (orcamento.cpf && c.cpf === orcamento.cpf) || 
        c.nome.toUpperCase() === nomeClienteFormatado
      );

      // Se o cliente não existir, cria-lo de forma transparente
      if (!clienteExistente) {
        await criarCliente({
          nome: nomeClienteFormatado,
          cpf: orcamento.cpf,
          contato: orcamento.contato,
          senhaGov: orcamento.senhaGov || '',
          filiadoProTiro: orcamento.filiadoProTiro || false,
          clubeFiliado: orcamento.clubeFiliado || 'NÃO RELATADO',
          endereco: orcamento.endereco || '',
          observacoes: ''
        });
      }

      // Cria a O.S. priorizando dados do cadastro se o cliente já existir
      const osId = await criarOrdem({
        nomeCliente: nomeClienteFormatado,
        contato: orcamento.contato,
        cpf: orcamento.cpf,
        senhaGov: (clienteExistente?.senhaGov) || orcamento.senhaGov || '',
        filiadoProTiro: (clienteExistente?.filiadoProTiro) ?? orcamento.filiadoProTiro ?? false,
        clubeFiliado: (clienteExistente?.clubeFiliado) || orcamento.clubeFiliado || '',
        servicos: orcamento.servicos.map(s => ({
          id: s.id,
          nome: s.nome,
          detalhes: s.detalhes,
          valor: s.valor,
          categoria: s.categoria || 'Honorário',
          pagoDireto: s.pagoDireto || s.categoria === 'Laudo',
          taxaPF: s.taxaPF,
          exigeGRU: s.exigeGRU,
          statusExecucao: 'Não Iniciado',
          pagoGRU: false
        })),
        valor: orcamento.servicos.filter(s => !s.pagoDireto && s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0),
        valorPago: 0,
        historicoPagamentos: [],
        formaPagamento: 'PIX', // Padrão
        status: 'Aguardando Pagamento',
        canalAtendimento: 'WhatsApp',
        observacaoContato: 'Convertido do ORC-' + String(orcamento.numero).padStart(4, '0'),
        observacoes: orcamento.observacoes || '',
        endereco: orcamento.endereco || '',
        taxaPFTotal: orcamento.servicos.reduce((acc, s) => acc + (s.taxaPF || 0), 0)
      });

      // Atualiza o status do orçamento para "Aprovado" e vincula a O.S.
      await atualizarOrcamento(orcamento.id, { 
        status: 'Aprovado',
        convertidoOsId: osId 
      });

      mostrar('sucesso', 'Sucesso! Orçamento convertido em O.S.');
      
      // Manda para a página de edição/detalhe da nova O.S
      setTimeout(() => {
        navigate(`/ordens/${osId}/editar`);
      }, 1500);

    } catch (err) {
      console.error(err);
      mostrar('erro', 'Erro ao tentar converter. Tente novamente.');
      setConvertendo(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-6">
      <Notificacao {...notif} onFechar={fechar} />

      {/* ── Navbar Topo ── */}
      <div className="flex items-center justify-between sticky top-0 z-30 bg-brand-dark pb-4 border-b border-brand-dark-5">
        <button onClick={() => navigate('/orcamentos')} className="btn-ghost px-2 gap-1 text-sm">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/orcamentos/${orcamento.id}/editar`)} className="btn-primary py-1.5 px-3 text-sm">
            <Edit2 size={14} /> Editar Orçamento
          </button>
          <button 
            onClick={() => setConfirmandoDelete(true)}
            className="btn-danger-soft px-3 py-1.5 text-sm font-black uppercase tracking-wider"
          >
            <Trash2 size={16} /> Excluir Orçamento
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* ── Coluna Esquerda: Dados Principais ── */}
        <div className="flex-1 space-y-6">
          
          {/* Header OS / Status */}
          <div className="card text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-dark-3 to-brand-dark-4 border-t-4 border-t-yellow-500">
            <div>
              <p className="text-gray-400 font-medium text-sm flex items-center justify-center sm:justify-start gap-1">
                <FileText size={14} />
                Orçamento de Serviço
              </p>
              <h1 className="text-3xl font-black text-white mt-1">
                #{String(orcamento.numero).padStart(4, '0')}
              </h1>
            </div>

            <div className="space-y-2">
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold block sm:inline-block ${classeStatusOrcamento(orcamento.status)}`}>
                {orcamento.status.toUpperCase()}
              </span>
              <p className="text-xs text-gray-500 font-medium flex items-center justify-center sm:justify-start gap-1">
                <Calendar size={12} /> Exibido em: {formatarDataHora(orcamento.criadoEm)}
              </p>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="card space-y-4">
            <h3 className="text-sm font-bold text-brand-blue-light border-b border-brand-dark-5 pb-2 flex items-center gap-2">
              <User size={16} /> Informações do Cliente
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-0.5">Nome Completo</p>
                <p className="text-sm font-medium text-white break-words">{orcamento.nomeCliente}</p>
              </div>
              {orcamento.cpf && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">CPF</p>
                  <p className="text-sm font-medium text-white">{orcamento.cpf}</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-gray-500 mb-0.5">Contato / WhatsApp</p>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Smartphone size={14} className="text-green-500" />
                  {orcamento.contato}
                </p>
              </div>
              {orcamento.endereco && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Endereço Completo</p>
                  <p className="text-sm font-medium text-white uppercase">{orcamento.endereco}</p>
                </div>
              )}
            </div>
          </div>

          {/* Serviços e Valores */}
          <div className="card space-y-4 border-l-4 border-l-brand-green">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <FileDown size={18} className="text-brand-green" /> 
              Serviços Previstos
            </h3>
            
            <div className="divide-y divide-brand-dark-5 border border-brand-dark-5 rounded-lg overflow-hidden">
              {orcamento.servicos.map((serv, i) => (
                <div key={i} className="p-4 bg-brand-dark-3/50 flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{serv.nome}</p>
                    {serv.detalhes && (
                      <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{serv.detalhes}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-xs font-bold text-gray-500 uppercase">Valor</p>
                    <p className="text-brand-green font-bold bg-brand-green/10 px-2 py-0.5 rounded text-sm mt-0.5 inline-block sm:block">
                      {formatarMoeda(serv.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-2">
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Honorários: <span className="text-white ml-1">{formatarMoeda(orcamento.servicos.filter(s => s.categoria !== 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0))}</span></p>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Laudos: <span className="text-white ml-1">{formatarMoeda(orcamento.servicos.filter(s => s.categoria === 'Laudo').reduce((acc, s) => acc + (s.valor || 0), 0))}</span></p>
              </div>

              <div className="text-right p-4 bg-brand-dark-3 border border-brand-dark-5 rounded-xl w-full sm:w-auto min-w-[180px]">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total do Orçamento</p>
                <p className="text-2xl font-black text-brand-green">{formatarMoeda(orcamento.valorTotal)}</p>
              </div>
            </div>
            
            {temRenovacaoCRAF && (
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-500 font-black uppercase tracking-widest text-[10px]">
                  <Shield size={16} />
                  Aviso de exigências para Renovação de CRAF
                </div>
                <div className="space-y-1.5 text-xs text-amber-200/80 leading-relaxed">
                  <p>• <strong>Tiro Desportivo (Nível 1):</strong> 8 habitualidades/tipo de arma nos ciclos 27/12/23 a 27/12/24 e 8 habitualidades de 27/12/24 a 27/12/25.</p>
                  <p>• <strong>Caça:</strong> Comprovar 18 meses de SIMAF/IBAMA ativos.</p>
                  <p className="text-[9px] text-amber-500/60 font-medium italic mt-1">
                    (Base Legal: Decreto 11.615/23, arts. 35 e 37; Portaria 166-COLOG/23, arts. 12, 16 e 17).
                  </p>
                </div>
              </div>
            )}
            
            {orcamento.observacoes && (
              <div className="pt-2">
                <div className="bg-brand-dark-4/50 border border-brand-dark-5 p-3 rounded-lg flex gap-3">
                  <MessageCircle size={16} className="text-brand-blue-light flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-300 uppercase underline decoration-brand-dark-5 underline-offset-4 mb-2">Observações GERAIS</p>
                    <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{orcamento.observacoes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna Direita: Ações ── */}
        <div className="md:w-80 flex-shrink-0 space-y-4">
          <div className="card sticky top-20 shadow-xl shadow-black/40">
            <h3 className="text-sm font-bold text-white border-b border-brand-dark-5 pb-3 mb-4 flex items-center gap-2">
              <ChevronRight size={16} className="text-brand-blue" />
              Ações Rápidas
            </h3>
            
            <div className="space-y-2">
              {/* WhatsApp Button */}
              <button onClick={enviarParaWhatsApp} className="btn w-full bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366] hover:text-white transition-all justify-start relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <MessageCircle size={18} className="relative z-10" />
                <span className="relative z-10 font-bold">Enviar por WhatsApp</span>
              </button>

              {/* Botão PDF */}
              <button 
                onClick={() => baixarPdfOrcamento(orcamento)}
                className="btn-ghost w-full justify-start border-gray-700 hover:border-brand-blue hover:text-brand-blue-light"
              >
                <FileDown size={18} />
                Baixar PDF
              </button>

              <button 
                onClick={() => imprimirPdfOrcamento(orcamento)}
                className="btn-ghost w-full justify-start border-gray-700 hover:border-brand-blue hover:text-brand-blue-light"
              >
                <Printer size={18} />
                Imprimir Orçamento
              </button>

              <hr className="border-brand-dark-5 my-4" />

              {/* Botão Converter OS */}
              <div className="pt-2">
                {osVinculada ? (
                  <>
                    <p className="text-xs text-center text-brand-green mb-2">Este orçamento já possui uma O.S.</p>
                    <button 
                      onClick={() => navigate(`/ordens/${osVinculada.id}`)}
                      className="btn w-full justify-center bg-brand-green/20 text-brand-green border-brand-green/30 hover:bg-brand-green hover:text-white transition-all shadow-[0_0_10px_rgba(109,190,69,0.1)]"
                    >
                      <ExternalLink size={16} />
                      Ver O.S. Vinculada
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-center text-gray-400 mb-2">
                      {orcamento.status === 'Aprovado' ? 'Gere a nova O.S. agora!' : 'Cliente aprovou o serviço?'}
                    </p>
                    <button 
                      onClick={converterEmOS}
                      disabled={convertendo}
                      className="btn w-full justify-center transition-all bg-brand-blue text-white hover:bg-brand-blue-light shadow-[0_0_15px_rgba(45,141,224,0.3)]"
                    >
                      {convertendo ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                          Convertendo...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Converter em Ordem de Serviço
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Notificacao {...notif} onFechar={fechar} />
      
      <DialogConfirmacao
        aberto={confirmandoDelete}
        titulo="Excluir Orçamento"
        mensagem={`Tem certeza que deseja excluir o orçamento ORC-${String(orcamento.numero).padStart(4, '0')}? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(false)}
      />

      {/* ── Auditoria e Rastreio ── */}
      <div className="card bg-brand-dark-3/30 border-dashed border-brand-dark-5 max-w-4xl mx-auto">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Shield size={12} className="text-brand-blue-light/50" />
          Informações de Auditoria
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Emissão do Orçamento</p>
            <p className="text-xs text-white uppercase font-bold">{orcamento.criadoPorNome || 'Sistema (Antigo)'}</p>
            <p className="text-[10px] text-gray-500">{formatarDataHora(orcamento.criadoEm)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">ID do Usuário</p>
            <p className="text-[10px] text-gray-400 font-mono truncate">{orcamento.usuarioId || '—'}</p>
          </div>
        </div>
      </div>

      <ModalEscolhaWhatsApp 
        aberto={modalWhatsAppAberto}
        onFechar={() => setModalWhatsAppAberto(false)}
        telefone={orcamento.contato}
        mensagem={mensagemWhatsApp}
      />
    </div>
  );
}


