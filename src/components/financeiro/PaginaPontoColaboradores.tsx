import React, { useState } from 'react';
import { Clock, BadgeDollarSign, ShieldCheck } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { RelogioPontoColaborador } from './RelogioPontoColaborador';
import { GestaoPontoPagamentos } from './GestaoPontoPagamentos';

export function PaginaPontoColaboradores() {
  const { usuario } = useAuth();
  const temAcessoGestao =
    usuario?.role === 'admin' ||
    usuario?.email === 'gui.gomesassis@gmail.com' ||
    Boolean(usuario?.permissoes?.includes('fin_gestao_colaboradores'));

  const [aba, setAba] = useState<'meu_ponto' | 'gestao'>(temAcessoGestao ? 'gestao' : 'meu_ponto');
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  const dataRef = new Date(`${mesFiltro}-02T12:00:00`);
  const dataInicio = startOfMonth(dataRef);
  const dataFim = endOfMonth(dataRef);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="text-brand-blue-light" />
            Ponto Eletrônico & Prestação PJ (Nota Fiscal)
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {temAcessoGestao
              ? 'Controle de entradas, saídas, geolocalização, cálculo de apuração proporcional e notas fiscais da equipe.'
              : 'Registre seu horário de entrada/saída com localização e envie sua Nota Fiscal do período.'}
          </p>
        </div>

        {temAcessoGestao && (
          <div className="flex flex-wrap items-center gap-3">
            {aba === 'gestao' && (
              <div className="flex items-center bg-brand-dark-3 border border-brand-dark-5 rounded-xl px-3 py-1.5 gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Mês Ref.:</span>
                <input
                  type="month"
                  value={mesFiltro}
                  onChange={e => e.target.value && setMesFiltro(e.target.value)}
                  className="bg-transparent text-white border-none focus:ring-0 text-xs outline-none p-0"
                />
              </div>
            )}

            <div className="flex gap-1 p-1 bg-brand-dark-3 border border-brand-dark-5 rounded-xl">
              <button
                type="button"
                onClick={() => setAba('meu_ponto')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${
                  aba === 'meu_ponto' ? 'bg-brand-blue text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock size={14} />
                Bater Ponto
              </button>
              <button
                type="button"
                onClick={() => setAba('gestao')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${
                  aba === 'gestao' ? 'bg-brand-blue text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <BadgeDollarSign size={14} />
                Gestão & Pagamentos (Gestor)
              </button>
            </div>
          </div>
        )}
      </div>

      {aba === 'meu_ponto' || !temAcessoGestao ? (
        <RelogioPontoColaborador />
      ) : (
        <GestaoPontoPagamentos dataInicio={dataInicio} dataFim={dataFim} />
      )}
    </div>
  );
}
