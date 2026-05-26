import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Plus, Settings, LogOut, Cloud, CloudOff, Loader, X, Users, Receipt, Calendar, BarChart3, ListTodo, Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrdens } from '../../context/OrdensContext';
import { useStatusConexao } from '../../hooks/useStatusConexao';
import { useLembretes } from '../../context/LembretesContext';
import { sincronizarPendentes } from '../../services/driveSync';
import { useNotificacoesSistema } from '../../context/NotificacoesSistemaContext';
import { NotificacoesDropdown } from './NotificacoesDropdown';

const links = [
  { to: '/dashboard', label: 'Painel',          icon: LayoutDashboard, slug: 'painel' },
  { to: '/rotina',    label: 'Rotina Diária',   icon: ListTodo,        slug: 'rotina' },
  { to: '/agenda',    label: 'Agenda / Lembretes', icon: ListTodo,     slug: 'agenda' },
  { to: '/financeiro', label: 'Financeiro',     icon: BarChart3,       slug: 'financeiro' },
  { to: '/orcamentos', label: 'Orçamentos',     icon: Receipt,         slug: 'orcamentos' },
  { to: '/ordens',     label: 'Ordens de Serviço', icon: FileText,      slug: 'ordens' },
  { to: '/recibos',    label: 'Recibos',           icon: Receipt,      slug: 'recibos' },
  { to: '/agendamentos', label: 'Agendamentos',   icon: Calendar,      slug: 'agendamentos' },
  { to: '/clientes',   label: 'Meus Clientes',     icon: Users,         slug: 'clientes' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings,      slug: 'config' },
].sort((a, b) => a.label.localeCompare(b.label));

export function Sidebar() {
  const { usuario, logout } = useAuth();
  const { ordens, itensFila } = useOrdens();
  const { lembretes } = useLembretes();
  const { naoLidas } = useNotificacoesSistema();
  const online = useStatusConexao();
  const navigate = useNavigate();

  // Cálculo de pendências para a Rotina Diária
  const totalRotina = ordens.reduce((acc, o) => {
    const temProtocolado = o.servicos?.some(s => s.statusExecucao === 'Protocolado — Ag. PF');
    if (temProtocolado) return acc + 1;
    return acc;
  }, 0);

  const agora = new Date();
  const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const tarefasPendentesHoje = lembretes.filter(l => l.data === hojeStr && !l.concluido).length;
  const [sincronizando, setSincronizando] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);

  const handleSyncManual = async () => {
    if (!online || sincronizando || itensFila === 0) return;
    setSincronizando(true);
    await sincronizarPendentes();
    setSincronizando(false);
  };

  const linksFiltrados = links.filter(link => 
    usuario?.permissoes?.includes(link.slug) || usuario?.role === 'admin'
  );

  const isAdmin = usuario?.role === 'admin';

  return (
    <aside className="w-64 bg-brand-dark-2 border-r border-brand-dark-5 flex flex-col h-full relative">
      {/* Logo */}
      <div className="p-5 border-b border-brand-dark-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/Logo oficial.png" alt="GCAC" className="w-10 h-10 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="font-black text-white text-base leading-tight truncate max-w-[140px]" title={usuario?.empresaNome || 'GCAC'}>
              {usuario?.empresaNome || 'GCAC'}
            </p>
            <p className="text-brand-green text-xs font-bold tracking-wider">Gerador de O.S.</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="relative">
            <button 
              onClick={() => setDropdownAberto(!dropdownAberto)}
              className={`p-2 rounded-xl transition-all h-10 w-10 flex items-center justify-center relative ${
                dropdownAberto ? 'bg-brand-blue/20 text-brand-blue-light' : 'bg-brand-dark-3 text-gray-500 hover:text-white'
              }`}
            >
              <Bell size={20} />
              {naoLidas > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-brand-blue text-white text-[9px] font-bold rounded-full border-2 border-brand-dark-2 flex items-center justify-center animate-pulse">
                  {naoLidas}
                </span>
              )}
            </button>
            <NotificacoesDropdown 
              aberto={dropdownAberto} 
              onClose={() => setDropdownAberto(false)} 
            />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {linksFiltrados.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {to === '/rotina' && totalRotina > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                {totalRotina}
              </span>
            )}
            {to === '/agenda' && tarefasPendentesHoje > 0 && (
              <span className="bg-brand-blue text-white text-[10px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                {tarefasPendentesHoje}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <div className="pt-2">
            <button
              onClick={() => navigate('/ordens/nova')}
              className="nav-link w-full text-brand-green-light hover:bg-brand-green/10 hover:text-brand-green border border-brand-green/20"
            >
              <Plus size={18} />
              Nova OS
            </button>
          </div>
        )}
      </nav>

      {/* Status Sync - Apenas para Admin */}
      {isAdmin && (
        <div className="p-3 border-t border-brand-dark-5">
          <div
            onClick={handleSyncManual}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              itensFila > 0 && online
                ? 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30 hover:bg-brand-blue/30'
                : 'bg-brand-dark-4 text-gray-500'
            }`}
            title={itensFila > 0 ? 'Clique para sincronizar' : 'Tudo sincronizado'}
          >
            {sincronizando ? (
              <Loader size={12} className="animate-spin text-brand-blue-light" />
            ) : online ? (
              <Cloud size={12} className={itensFila > 0 ? 'text-brand-blue-light' : 'text-brand-green'} />
            ) : (
              <CloudOff size={12} className="text-red-400" />
            )}
            <span>
              {sincronizando ? 'Sincronizando...'
                : !online ? 'Sem conexão'
                : itensFila > 0 ? `${itensFila} pendente${itensFila > 1 ? 's' : ''} — clique para sync`
                : 'Tudo sincronizado'}
            </span>
          </div>
        </div>
      )}

      {/* Usuário */}
      <div className="p-3 border-t border-brand-dark-5">
        {usuario ? (
          <div className="flex items-center gap-2">
            <img
              src={usuario.fotoPerfil}
              alt={usuario.nome}
              className="w-8 h-8 rounded-full border border-brand-dark-5 flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).src = ''; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{usuario.nome}</p>
              <p className="text-[10px] text-brand-green uppercase font-bold tracking-tighter opacity-70">
                {usuario.role === 'admin' ? 'Administrador' : 'Colaborador'}
              </p>
              <p className="text-[10px] text-gray-500 truncate">{usuario.email}</p>
            </div>
            <button onClick={logout} title="Sair" className="text-gray-500 hover:text-red-400 transition-colors p-1">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="btn-ghost btn-sm w-full justify-center">
            Fazer login
          </button>
        )}
      </div>
    </aside>
  );
}

export function NavegacaoInferior() {
  const { itensFila } = useOrdens();

  const { usuario } = useAuth();
  const linksFiltrados = links.filter(link => 
    usuario?.permissoes?.includes(link.slug) || usuario?.role === 'admin'
  );

  const getShortLabel = (label: string) => {
    if (label === 'Rotina Diária') return 'Rotina';
    if (label === 'Agenda / Lembretes') return 'Lembretes';
    if (label === 'Ordens de Serviço') return 'Ordens';
    if (label === 'Meus Clientes') return 'Clientes';
    if (label === 'Configurações') return 'Config';
    if (label === 'Agendamentos') return 'Agenda';
    return label;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-dark-2 border-t border-brand-dark-5 flex sm:hidden overflow-x-auto no-scrollbar scroll-smooth px-2">
      {linksFiltrados.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-shrink-0 min-w-[75px] flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
              isActive ? 'text-brand-blue-light' : 'text-gray-500 hover:text-gray-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
                {to === '/ordens' && itensFila > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-blue" />
                )}
              </div>
              <span className="leading-none whitespace-nowrap">{getShortLabel(label)}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-blue-light" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
