import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Printer, Share2, Receipt, 
  Calendar, User, CheckCircle, FileText, 
  ChevronRight, Trash2, Mail, Phone, MapPin, List
} from 'lucide-react';
import { Recibo } from '../../types';
import { formatarMoeda, formatarData } from '../../utils/formatters';
import { baixarPdfRecibo } from '../../services/geradorPdfRecibo';
import { useRecibos } from '../../context/RecibosContext';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { ModalEscolhaWhatsApp } from '../common/ModalEscolhaWhatsApp';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DetalheReciboProps {
  recibo: Recibo;
}

export function DetalheRecibo({ recibo }: DetalheReciboProps) {
  const navigate = useNavigate();
  const { deletarRecibo } = useRecibos();
  const { usuario } = useAuth();
  const podeExcluir = usuario?.role === 'admin' || usuario?.permissoes?.includes('excluir_registros');
  const [gerandoPdf, setGerandoPdf] = React.useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = React.useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = React.useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = React.useState('');

  const handleBaixarPdf = async () => {
    setGerandoPdf(true);
    try {
      await baixarPdfRecibo(recibo);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar arquivo PDF. Tente imprimir pelo navegador.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleDeletar = async () => {
    try {
      await deletarRecibo(recibo.id);
      navigate('/recibos');
    } catch (err) {
      console.error('Erro ao deletar recibo:', err);
      alert('Falha ao excluir o recibo.');
    }
  };

  const handleWhatsApp = () => {
    let msg = `* GCAC | Despachante Bélico *\n_Recibo de Pagamento #${String(recibo.numero).padStart(4, '0')}_\n\n`;
    msg += `Olá, *${recibo.clienteNome}*!\n`;
    msg += `Confirmamos o recebimento do valor de *${formatarMoeda(recibo.valorTotal)}* referente aos serviços:\n\n`;
    
    recibo.servicos.forEach(s => {
      msg += `🔹 *${s.nome}*\n`;
    });
    
    msg += `\n📅 *Data:* ${formatarData(recibo.criadoEm)}\n`;
    msg += `💳 *Forma:* ${recibo.formaPagamento}\n\n`;
    msg += `Agradecemos a confiança!`;
    
    setMensagemWhatsApp(msg);
    setModalWhatsAppAberto(true);
  };

  const handleCompartilhar = () => {
    const texto = `Olá! Segue o recibo #${String(recibo.numero).padStart(4, '0')}\n` +
                 `Cliente: ${recibo.clienteNome}\n` +
                 `Valor: ${formatarMoeda(recibo.valorTotal)}\n` +
                 `Emitido em: ${formatarData(recibo.criadoEm)}\n\n` +
                 `Gerado por: Portal G CAC`;
    
    if (navigator.share) {
      navigator.share({
        title: `Recibo #${String(recibo.numero).padStart(4, '0')}`,
        text: texto,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(texto).then(() => {
        alert('Resumo do recibo copiado para a área de transferência!');
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Barra de Ações (Escondida na impressão) */}
      <div className="flex justify-between items-center print:hidden border-b border-brand-dark-5 pb-6">
        <button 
          onClick={() => navigate('/recibos')}
          className="btn-ghost"
        >
          <ArrowLeft size={18} />
          Voltar para lista
        </button>
        <div className="flex gap-2">
          <button 
            onClick={handleWhatsApp}
            className="btn-ghost bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/20"
          >
            <MessageCircle size={18} />
            WhatsApp
          </button>

          {podeExcluir && (
            <button 
              onClick={() => setConfirmandoDelete(true)}
              className="btn-ghost border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
            >
              <Trash2 size={18} />
              Excluir
            </button>
          )}
          
          <button 
            onClick={handleCompartilhar}
            className="btn-ghost"
          >
            <Share2 size={18} />
            Compartilhar
          </button>

          <button 
            onClick={handleBaixarPdf}
            disabled={gerandoPdf}
            className="btn-ghost"
          >
            {gerandoPdf ? (
              <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            {gerandoPdf ? 'Gerando...' : 'Baixar PDF'}
          </button>

          <button 
            onClick={handleImprimir}
            className="btn-primary"
          >
            <Printer size={18} />
            Imprimir Recibo
          </button>
        </div>
      </div>

      {/* Recibo para Impressão */}
      <div id="print-area" className="bg-white text-gray-900 border border-brand-dark-5 rounded-2xl shadow-2xl p-8 sm:p-12 animate-fade-in print:shadow-none print:border-none print:p-0 print:m-0">
        
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8 border-b-2 border-brand-dark-5 pb-8 mb-8">
          <div className="flex items-center gap-4">
            <img 
              src="/Logo oficial.png" 
              alt="Logo" 
              className="w-16 h-16 object-contain" 
              onError={e => (e.target as HTMLImageElement).style.display = 'none'}
            />
            <div>
              <h1 className="text-2xl font-black text-brand-dark leading-tight uppercase tracking-tighter">Gcac Despachante Bélico</h1>
              <p className="text-sm font-bold text-brand-blue uppercase">Gestão e Assessoria C.A.C.</p>
              <p className="text-[10px] text-gray-500 font-bold mt-1">CNPJ: {recibo.emitenteCNPJ}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-brand-dark text-white px-4 py-2 rounded-xl inline-block mb-3 print:bg-white print:text-gray-900 print:p-0">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Número do Recibo</p>
              <p className="text-2xl font-black"># {String(recibo.numero).padStart(4, '0')}</p>
            </div>
            <p className="text-xs font-bold text-gray-400">EMISSÃO: {formatarData(recibo.criadoEm)}</p>
          </div>
        </div>

        {/* Corpo do Recibo */}
        <div className="space-y-8">
          <div className="bg-brand-blue/5 border-l-4 border-brand-blue p-6 rounded-r-2xl print:bg-gray-100 print:rounded-none">
            <p className="text-lg leading-relaxed font-medium">
              Recebemos de <span className="font-bold border-b border-gray-400 pb-0.5">{recibo.clienteNome}</span>, 
              inscrito no CPF/CNPJ <span className="font-bold">{recibo.clienteCPF}</span>, 
              a importância de <span className="text-2xl font-black text-brand-blue-light print:text-gray-900">{formatarMoeda(recibo.valorTotal)}</span>.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
              <List size={14} /> Descrição dos Serviços e Produtos
            </h3>
            <div className="overflow-hidden rounded-xl border border-brand-dark-5 print:border-gray-200">
              <table className="w-full text-left">
                <thead className="bg-brand-dark text-white text-[10px] font-bold uppercase tracking-wider print:bg-gray-200 print:text-gray-900">
                  <tr>
                    <th className="px-6 py-4">Item / Serviço</th>
                    <th className="px-6 py-4 text-right">Valor Unitário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark-5 print:divide-gray-200">
                  {recibo.servicos.map((servico, index) => (
                    <tr key={index} className="hover:bg-brand-blue/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold uppercase">{servico.nome}</p>
                        {servico.detalhes && <p className="text-[10px] text-gray-500 font-medium italic mt-1">{servico.detalhes}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-sm">{formatarMoeda(servico.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-brand-dark-2/20 font-black text-lg print:bg-gray-50 print:text-gray-900 border-t-2 border-brand-dark-5">
                  <tr className="border-b border-brand-dark-5/30 print:border-gray-100">
                    <td className="px-6 py-3 text-right uppercase text-[10px] tracking-widest text-gray-500">Forma de Pagamento</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-700">{recibo.formaPagamento}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-right uppercase text-xs tracking-widest text-gray-500">Valor Total do Recibo</td>
                    <td className="px-6 py-5 text-right text-2xl text-brand-blue-light print:text-gray-900">{formatarMoeda(recibo.valorTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {recibo.observacoes && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Observações Adicionais</h3>
              <p className="text-sm text-gray-600 leading-relaxed italic border border-brand-dark-5 p-4 rounded-xl print:p-0 print:border-none">
                {recibo.observacoes}
              </p>
            </div>
          )}

          {/* Assinaturas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-16 mt-16 border-t border-brand-dark-5 print:mt-12 print:pt-8 print:border-gray-200">
            <div className="text-center space-y-2 relative flex flex-col items-center">
              <img 
                src="/assinatura_guilherme.png" 
                alt="Assinatura" 
                className="absolute -top-24 left-1/2 -translate-x-1/2 h-40 w-auto object-contain pointer-events-none z-0"
                onError={e => {
                  console.error('Erro ao carregar assinatura');
                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                }}
              />
              <div className="border-t border-brand-dark pt-2 mx-auto w-4/5 print:border-gray-900 relative z-10" />
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 relative z-10">Pelo Responsável / Emitente</p>
              <p className="text-sm font-bold uppercase relative z-10">Guilherme Gomes</p>
              <p className="text-[8px] text-gray-400 uppercase font-bold relative z-10">CNPJ: {recibo.emitenteCNPJ}</p>
            </div>
            <div className="text-center space-y-2">
              <div className="border-t border-brand-dark pt-2 mx-auto w-4/5 print:border-gray-900" />
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Pelo Cliente / Beneficiário</p>
              <p className="text-sm font-bold uppercase">{recibo.clienteNome}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Auditoria e Rastreio ── */}
      <div className="card bg-brand-dark-3/30 border-dashed border-brand-dark-5 print:hidden">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <CheckCircle size={12} className="text-brand-blue-light/50" />
          Informações de Auditoria
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Emissão do Recibo</p>
            <p className="text-xs text-white uppercase font-bold">{recibo.criadoPorNome || 'Sistema (Antigo)'}</p>
            <p className="text-[10px] text-gray-500">{formatarData(recibo.criadoEm)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">ID do Usuário</p>
            <p className="text-[10px] text-gray-400 font-mono truncate">{recibo.usuarioId || '—'}</p>
          </div>
        </div>
      </div>

      <DialogConfirmacao
        aberto={confirmandoDelete}
        titulo="Excluir Recibo"
        mensagem={`Tem certeza que deseja excluir o recibo #${String(recibo.numero).padStart(4, '0')}? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleDeletar}
        onCancelar={() => setConfirmandoDelete(false)}
      />

      <ModalEscolhaWhatsApp 
        aberto={modalWhatsAppAberto}
        onFechar={() => setModalWhatsAppAberto(false)}
        telefone={recibo.clienteContato || recibo.clienteCPF} 
        mensagem={mensagemWhatsApp}
      />
    </div>
  );
}
