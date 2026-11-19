import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, Clock, Info, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNotificacoesSistema } from '../../context/NotificacoesSistemaContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificacoesDropdownProps {
  aberto: boolean;
  onClose: () => void;
}

export function NotificacoesDropdown({ aberto, onClose }: NotificacoesDropdownProps) {
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas } = useNotificacoesSistema();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (aberto) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [aberto, onClose]);

  if (!aberto) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute left-64 top-4 w-80 bg-brand-dark-2 border border-brand-dark-5 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-200"
    >
      <div className="p-4 border-b border-brand-dark-5 flex justify-between items-center">
        <div>
          <h3 className="text-white font-bold text-sm">Notificações</h3>
          <p className="text-[10px] text-gray-500 font-medium">{naoLidas} novas mensagens</p>
        </div>
        {naoLidas > 0 && (
          <button 
            onClick={marcarTodasComoLidas}
            className="text-[10px] text-brand-blue hover:text-brand-blue-light font-bold uppercase tracking-wider"
          >
            Ler tudo
          </button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {notificacoes.length === 0 ? (
          <div className="p-10 text-center">
            <Bell size={32} className="text-brand-dark-4 mx-auto mb-3" />
            <p className="text-xs text-gray-500">Nenhuma notificação por enquanto.</p>
          </div>
        ) : (
          notificacoes.map(n => {
            const mensagemLimpa = n.mensagem?.replace(/<!--.*?-->/g, '').trim();
            return (
              <div 
                key={n.id}
                onClick={() => {
                  if (!n.lida) marcarComoLida(n.id);
                  if (n.link) {
                    navigate(n.link);
                    onClose();
                  }
                }}
                className={`p-4 border-b border-brand-dark-5 last:border-0 hover:bg-white/5 cursor-pointer transition-colors relative ${!n.lida ? 'bg-brand-blue/5' : ''}`}
              >
                {!n.lida && <div className="absolute right-4 top-4 w-2 h-2 bg-brand-blue rounded-full" />}
                
                <div className="flex gap-3">
                  <div className={`p-2 rounded-lg h-fit ${
                    n.tipo === 'sucesso' ? 'bg-green-500/10 text-green-400' :
                    n.tipo === 'alerta' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-brand-blue/10 text-brand-blue-light'
                  }`}>
                    {n.tipo === 'sucesso' ? <CheckCircle size={16} /> :
                     n.tipo === 'alerta' ? <AlertTriangle size={16} /> : <Info size={16} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-bold text-white">{n.titulo}</p>
                      {n.link && <ExternalLink size={12} className="text-gray-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{mensagemLimpa}</p>
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase font-bold">
                      <Clock size={10} />
                      {formatDistanceToNow(new Date(n.criadoEm), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-brand-dark-5 text-center">
        <button 
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-widest"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
