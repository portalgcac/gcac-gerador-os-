import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Printer, Upload, RotateCcw, AlertTriangle, FileText } from 'lucide-react';
import { ValeColaborador } from '../../types';
import { formatarMoeda } from '../../utils/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { confirmarValeEletronico, anexarReciboManual } from '../../services/valesColaboradoresService';
import { gerarReciboValePdf } from '../../utils/reciboValePdf';
import { useAuth } from '../../context/AuthContext';
import { fileToBase64 } from '../../utils/fileUtils';

interface ModalConfirmarValeProps {
  vale: ValeColaborador | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmado?: () => void;
}

export function ModalConfirmarVale({ vale, isOpen, onClose, onConfirmado }: ModalConfirmarValeProps) {
  const { usuario } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Inicializa o Canvas para assinatura
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#2563eb'; // Azul assinatura
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  if (!isOpen || !vale) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setTemAssinatura(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTemAssinatura(false);
    }
  };

  const handleConfirmarEletronico = async () => {
    if (!usuario?.empresaId) return;
    setSalvando(true);
    setErro(null);

    let assinaturaBase64: string | undefined = undefined;
    if (canvasRef.current && temAssinatura) {
      assinaturaBase64 = canvasRef.current.toDataURL('image/png');
    }

    try {
      await confirmarValeEletronico(usuario.empresaId, vale.id, {
        assinaturaBase64,
        usuarioEmail: usuario.email,
        usuarioNome: usuario.nome
      });

      setSucesso(true);
      setTimeout(() => {
        onConfirmado?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErro(err.message || 'Erro ao confirmar vale.');
    } finally {
      setSalvando(false);
    }
  };

  const handleUploadReciboManual = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.empresaId) return;

    try {
      setSalvando(true);
      const b64 = await fileToBase64(file);
      await anexarReciboManual(usuario.empresaId, vale.id, b64);
      setSucesso(true);
      setTimeout(() => {
        onConfirmado?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErro(err.message || 'Erro ao anexar recibo assinado.');
    } finally {
      setSalvando(false);
    }
  };

  const handleBaixarPdfParaAssinar = () => {
    gerarReciboValePdf(vale, {
      nome: usuario?.dadosEmpresa?.razaoSocialFantasia || usuario?.dadosEmpresa?.nome || 'Portal G CAC',
      cnpj: usuario?.dadosEmpresa?.cnpj,
      endereco: usuario?.dadosEmpresa?.endereco
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="bg-brand-dark-2 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-fade-in my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Confirmar Recebimento de Vale</h3>
              <p className="text-xs text-gray-400">Assinatura eletrônica de quitação e ciência de adiantamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </div>
        )}

        {sucesso ? (
          <div className="py-12 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/40">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-lg font-black text-white">Recebimento Confirmado com Sucesso!</h4>
            <p className="text-xs text-gray-400">
              O documento foi assinado eletronicamente e arquivado na sua ficha financeira.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Box Resumo do Vale */}
            <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Valor Repassado:</span>
                <span className="text-xl font-black text-emerald-400">{formatarMoeda(vale.valor)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-300 text-[11px] pt-1 border-t border-gray-800">
                <span>Forma: <strong>{vale.formaPagamento}</strong></span>
                <span>Data: <strong>{format(parseISO(vale.dataAdiantamento), 'dd/MM/yyyy')}</strong></span>
              </div>
              <div className="text-[11px] text-gray-400">
                <span>Motivo: <strong className="text-white">{vale.motivo}</strong></span>
              </div>
            </div>

            {/* Texto Formal de Quitação Jurídica */}
            <div className="p-3.5 bg-brand-dark-3 border border-gray-800 rounded-xl text-gray-300 leading-relaxed text-[11px] space-y-2">
              <div className="flex items-center gap-2 font-bold text-white uppercase text-[10px] tracking-wider">
                <ShieldCheck size={14} className="text-emerald-400" />
                Termo de Quitação & Autorização de Desconto
              </div>
              <p>
                "Declaro para os devidos fins de direito que recebi a quantia de <strong>{formatarMoeda(vale.valor)}</strong> a título de adiantamento/vale em <strong>{format(parseISO(vale.dataAdiantamento), 'dd/MM/yyyy')}</strong>, autorizando expressamente a dedução deste valor no próximo fechamento de remuneração / prestação de serviços."
              </p>
            </div>

            {/* Área de Rubrica / Assinatura Digital */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">
                  Desenhe sua Rubrica / Assinatura (Touch ou Mouse):
                </label>
                {temAssinatura && (
                  <button
                    type="button"
                    onClick={limparAssinatura}
                    className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="border-2 border-dashed border-gray-700 rounded-xl bg-gray-950 overflow-hidden relative">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[110px] cursor-crosshair touch-none"
                />
                {!temAssinatura && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-600 text-xs font-medium">
                    Clique e desenhe sua rubrica aqui
                  </div>
                )}
              </div>
            </div>

            {/* Botão Principal de Confirmação Eletrônica */}
            <button
              type="button"
              disabled={salvando}
              onClick={handleConfirmarEletronico}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>{salvando ? 'Autenticando...' : 'Confirmar e Assinar Eletronicamente'}</span>
            </button>

            {/* Alternativa: Assinatura Manual em Papel */}
            <div className="pt-3 border-t border-gray-800 text-center space-y-2">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">
                Prefere assinar em folha física?
              </span>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleBaixarPdfParaAssinar}
                  className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue-light font-bold hover:underline"
                >
                  <Printer size={13} />
                  <span>Baixar Recibo em PDF</span>
                </button>
                <span className="text-gray-600">•</span>
                <label className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue-light font-bold hover:underline cursor-pointer">
                  <Upload size={13} />
                  <span>Anexar Foto Assinada</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleUploadReciboManual}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
