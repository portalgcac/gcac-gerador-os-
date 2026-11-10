import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Camera, X, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../db/supabase';

interface ModalUploadCelularProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (base64Data: string) => void;
  titulo?: string;
}

export function ModalUploadCelular({
  isOpen,
  onClose,
  onUploadSuccess,
  titulo = 'Tirar Foto com o Celular'
}: ModalUploadCelularProps) {
  const [sessionId] = useState(() => uuidv4());
  const [status, setStatus] = useState<'gerando' | 'aguardando' | 'processando' | 'erro'>('gerando');
  const [erroMsg, setErroMsg] = useState('');
  const processadoRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let channel: any = null;
    let interval: any = null;

    async function iniciarSessao() {
      try {
        // 1. Criar o registro da sessão no Supabase
        const { error } = await supabase
          .from('upload_sessoes')
          .insert([{ id: sessionId, status: 'pendente' }]);

        if (error) throw error;

        if (!active) return;
        setStatus('aguardando');

        // 2. Inscrever-se via Realtime para ouvir o UPDATE
        channel = supabase
          .channel(`upload-${sessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'upload_sessoes',
              filter: `id=eq.${sessionId}`
            },
            async (payload: any) => {
              if (payload.new.status === 'concluido' && payload.new.url) {
                await processarUpload(payload.new.url);
              }
            }
          )
          .subscribe();

        // 3. Fallback de Polling (a cada 2 segundos) para garantir funcionamento caso o Realtime falhe
        interval = setInterval(async () => {
          if (!active || processadoRef.current) return;
          const { data, error: pollError } = await supabase
            .from('upload_sessoes')
            .select('status, url')
            .eq('id', sessionId)
            .maybeSingle();

          if (!pollError && data && data.status === 'concluido' && data.url) {
            clearInterval(interval);
            await processarUpload(data.url);
          }
        }, 2000);

      } catch (err: any) {
        console.error('Erro ao iniciar sessão de upload:', err);
        if (active) {
          setStatus('erro');
          setErroMsg(err.message || 'Não foi possível conectar ao banco de dados.');
        }
      }
    }

    iniciarSessao();

    // Cleanup ao desmontar ou fechar
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
      // Apaga o registro temporário de sessão
      supabase.from('upload_sessoes').delete().eq('id', sessionId).then();
    };
  }, [isOpen, sessionId]);

  async function processarUpload(imageUrl: string) {
    if (processadoRef.current) return;
    processadoRef.current = true;
    setStatus('processando');

    try {
      let blob: Blob | null = null;

      // 1. Baixar diretamente via SDK do Supabase Storage (suporta buckets privados sem erro 404)
      const matchPath = imageUrl.match(/documentos-clientes\/(.+)$/);
      const storagePath = matchPath ? decodeURIComponent(matchPath[1]) : `temp-uploads/${sessionId}.jpg`;

      const { data: storageBlob, error: downloadError } = await supabase.storage
        .from('documentos-clientes')
        .download(storagePath);

      if (!downloadError && storageBlob) {
        blob = storageBlob;
      } else {
        // 2. Fallback: URL assinada temporária (Signed URL)
        const { data: signedData } = await supabase.storage
          .from('documentos-clientes')
          .createSignedUrl(storagePath, 60);

        if (signedData?.signedUrl) {
          const response = await fetch(signedData.signedUrl);
          if (response.ok) {
            blob = await response.blob();
          }
        }

        // 3. Fallback: Fetch direto
        if (!blob) {
          const response = await fetch(imageUrl);
          if (response.ok) {
            blob = await response.blob();
          }
        }
      }

      if (!blob) {
        throw new Error('Não foi possível transferir o arquivo baixado do cofre de uploads.');
      }

      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onUploadSuccess(base64);
        onClose();
      };
      
      reader.onerror = () => {
        throw new Error('Falha ao ler o arquivo baixado.');
      };
      
      reader.readAsDataURL(blob);

    } catch (err: any) {
      console.error('Erro ao processar imagem baixada:', err);
      setStatus('erro');
      setErroMsg('Erro ao transferir a imagem para o formulário.');
      processadoRef.current = false; // Permite tentar novamente se houver falha
    }
  }

  if (!isOpen) return null;

  const uploadUrl = `${window.location.origin}/upload-celular/${sessionId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uploadUrl)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="card w-full max-w-sm flex flex-col p-6 animate-scale-up text-center relative border border-brand-dark-5 bg-brand-dark-2" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex justify-center mb-3">
          <div className="p-3 bg-brand-blue/10 text-brand-blue rounded-full">
            <Camera size={24} />
          </div>
        </div>

        <h3 className="text-base font-bold text-white mb-2">{titulo}</h3>
        
        {status === 'gerando' && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="text-brand-blue animate-spin" />
            <p className="text-xs text-gray-400">Gerando sessão segura...</p>
          </div>
        )}

        {status === 'aguardando' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed px-2">
              Aponte a câmera do seu celular para o QR Code abaixo para tirar a foto do documento:
            </p>

            <div className="bg-white p-2.5 rounded-xl inline-block mx-auto border-2 border-brand-blue/20">
              <img src={qrCodeUrl} alt="QR Code para tirar foto" className="w-[180px] h-[180px] block" />
            </div>

            <div className="flex items-center justify-center gap-2 text-brand-blue-light font-bold text-[11px] animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              AGUARDANDO ENVIO DO CELULAR...
            </div>
          </div>
        )}

        {status === 'processando' && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="text-brand-green animate-spin" />
            <p className="text-xs text-brand-green font-bold">FOTO RECEBIDA!</p>
            <p className="text-[11px] text-gray-400">Processando e anexando no formulário...</p>
          </div>
        )}

        {status === 'erro' && (
          <div className="py-6 space-y-4">
            <p className="text-xs text-red-400 font-semibold">{erroMsg}</p>
            <button 
              onClick={onClose} 
              className="btn-ghost text-xs w-full py-2 border border-brand-dark-5 rounded-lg"
            >
              Fechar e Tentar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
