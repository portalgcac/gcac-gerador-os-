import React, { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, FileText, CheckCircle, ArrowRight } from 'lucide-react';
import { useOrdens } from '../../context/OrdensContext';
import { useAuth } from '../../context/AuthContext';
import { formatarMoeda } from '../../utils/formatters';

export function BriefingDiario() {
  const [aberto, setAberto] = useState(false);
  const { ordens } = useOrdens();
  const { usuario } = useAuth();

  useEffect(() => {
    const hoje = new Date().toDateString();
    const visto = localStorage.getItem('gcac_last_briefing');
    
    if (visto !== hoje) {
      setAberto(true);
    }
  }, []);

  const fechar = () => {
    localStorage.setItem('gcac_last_briefing', new Date().toDateString());
    setAberto(false);
  };

  if (!aberto || ordens.length === 0) return null;

  // Cálculo de "Ontem" (Calendário)
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataOntemStr = ontem.toDateString();

  const ordensOntem = ordens.filter(o => {
    const ehMigracao = o.migrado === true || o.observacoes?.includes('[MIGRAÇÃO]');
    if (ehMigracao) return false;
    const dataCriacao = new Date(o.criadoEm).toDateString();
    return dataCriacao === dataOntemStr;
  });

  const stats = {
    total:      ordensOntem.length,
    pagas:      ordensOntem.filter(o => o.status === 'Pago').length,
    receita:    ordensOntem.filter(o => o.status === 'Pago').reduce((s, o) => s + o.valor, 0),
    taxas:      ordensOntem.filter(o => o.status === 'Pago').reduce((s, o) => s + (o.taxaPFTotal || 0), 0),
  };

  const lucroReal = stats.receita - stats.taxas;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-dark/95 backdrop-blur-md animate-fade-in" />
      
      {/* Conteúdo */}
      <div className="relative w-full max-w-2xl bg-brand-dark-2 border border-brand-dark-5 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Header Decorativo */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-blue via-brand-green-light to-brand-blue" />
        
        <div className="p-8 sm:p-12 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-brand-blue/20 blur-2xl rounded-full" />
            <img 
              src={usuario?.dadosEmpresa?.logoUrl || "/Logo oficial.png"} 
              alt="Logo GCAC" 
              className="w-20 h-20 object-contain relative z-10"
              onError={(e) => (e.currentTarget.style.display = 'none')} 
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
            Bom dia{usuario ? `, ${usuario.nome.split(' ')[0]}` : ''}! 🚀
          </h2>
          <p className="text-gray-400 text-sm mb-10 max-w-sm">
            Confira o resumo do seu desempenho de <strong>ontem</strong>, {ontem.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}.
          </p>

          {/* Grid de Stats */}
          <div className="grid grid-cols-2 gap-4 w-full mb-10">
            <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-5 rounded-2xl text-left">
              <div className="flex items-center gap-2 text-brand-green-light mb-2">
                <TrendingUp size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Lucro Real</span>
              </div>
              <p className="text-2xl font-black text-white">{formatarMoeda(lucroReal)}</p>
            </div>

            <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-5 rounded-2xl text-left">
              <div className="flex items-center gap-2 text-brand-blue-light mb-2">
                <CheckCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">OS Pagas</span>
              </div>
              <p className="text-2xl font-black text-white">{stats.pagas}</p>
            </div>

            <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-5 rounded-2xl text-left">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Faturado</span>
              </div>
              <p className="text-xl font-bold text-white/90">{formatarMoeda(stats.receita)}</p>
            </div>

            <div className="bg-brand-dark-3/50 border border-brand-dark-5 p-5 rounded-2xl text-left">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <FileText size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Emitidas</span>
              </div>
              <p className="text-xl font-bold text-white/90">{stats.total}</p>
            </div>
          </div>

          <button 
            onClick={fechar}
            className="w-full btn-primary py-4 text-lg font-bold group"
          >
            Abrir Painel Principal
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Footer */}
        <div className="bg-brand-dark-3 p-4 text-center border-t border-brand-dark-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Portal G CAC — Seu foco é sua arma
          </p>
        </div>

        {/* Close Button X (Optional, for redundancy) */}
        <button 
          onClick={fechar}
          className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
}
