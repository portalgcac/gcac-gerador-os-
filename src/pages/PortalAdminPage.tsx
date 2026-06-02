import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { GestaoUsuarios } from '../components/config/GestaoUsuarios';
import { Shield } from 'lucide-react';

export default function PortalAdminPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') as any;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-1">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Painel de Controle Portal GCAC</h1>
          <p className="text-xs text-gray-500 mt-0.5 uppercase font-bold tracking-wider">
            Consola central de administração global • Gestão de despachantes, leads, faturamento e monitor de acervos
          </p>
        </div>
      </div>

      <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl p-5 shadow-2xl">
        <GestaoUsuarios abaInicial={tab === 'leads' ? 'leads' : undefined} />
      </div>
    </div>
  );
}
