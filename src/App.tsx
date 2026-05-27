// v1.0.1 - Adição do campo de endereço em Clientes
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrdensProvider } from './context/OrdensContext';
import { OrcamentosProvider } from './context/OrcamentosContext';
import { AppShell } from './components/layout/AppShell';
import { PaginaLogin } from './components/auth/PaginaLogin';
import { Dashboard } from './components/dashboard/Dashboard';
import { ListaOrdens } from './components/ordens/ListaOrdens';
import { FormularioOrdem } from './components/ordens/FormularioOrdem';
import { DetalheOrdem } from './components/ordens/DetalheOrdem';
import { Configuracoes } from './components/config/Configuracoes';
import { ClientesProvider, useClientes } from './context/ClientesContext';
import { ServicosProvider } from './context/ServicosContext';
import { ListaClientes } from './components/clientes/ListaClientes';
import { DetalheCliente } from './components/clientes/DetalheCliente';
import { useOrdens } from './context/OrdensContext';
import { useOrcamentos } from './context/OrcamentosContext';

// Importações dos Orçamentos
import { ListaOrcamentos } from './components/orcamentos/ListaOrcamentos';
import { FormularioOrcamento } from './components/orcamentos/FormularioOrcamento';
import { DetalheOrcamento } from './components/orcamentos/DetalheOrcamento';

// Importações dos Recibos
import { RecibosProvider, useRecibos } from './context/RecibosContext';
import { ListaRecibos } from './components/recibos/ListaRecibos';
import { FormularioRecibo } from './components/recibos/FormularioRecibo';
import { DetalheRecibo } from './components/recibos/DetalheRecibo';

// Importações dos Agendamentos
import { AgendamentosProvider } from './context/AgendamentosContext';
import { ListaAgendamentos } from './components/agendamentos/ListaAgendamentos';
import { NotificacoesSistemaProvider } from './context/NotificacoesSistemaContext';
import { FinanceiroProvider } from './context/FinanceiroContext';
import { Financeiro } from './components/financeiro/Financeiro';
import { RotinaDiaria } from './components/operacional/RotinaDiaria';
import { LembretesProvider } from './context/LembretesContext';
import { ListaLembretes } from './components/lembretes/ListaLembretes';
import { PainelAtiradores } from './components/admin/PainelAtiradores';
import { PainelClientesCAC } from './components/vinculos/PainelClientesCAC';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// ── Páginas de Ordens ────────────────────────────────────────────────────

function PaginaDetalheOrdem() {
  const { id } = useParams<{ id: string }>();
  const { ordens } = useOrdens();
  const ordem = ordens.find(o => o.id === id);
  const navigate = useNavigate();

  if (ordem === undefined) return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  if (ordem === null || !ordem) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">OS não encontrada</p>
        <button onClick={() => navigate('/ordens')} className="btn-primary">← Voltar para lista</button>
      </div>
    );
  }
  return <DetalheOrdem ordem={ordem} />;
}

function PaginaEditarOrdem() {
  const { id } = useParams<{ id: string }>();
  const { ordens } = useOrdens();
  const ordem = ordens.find(o => o.id === id);

  if (!ordem) return <Navigate to="/ordens" replace />;
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Editar OS-{String(ordem.numero).padStart(4, '0')}</h1>
      <FormularioOrdem ordemExistente={ordem} />
    </div>
  );
}

// ── Páginas de Orçamentos ────────────────────────────────────────────────

function PaginaDetalheOrcamento() {
  const { id } = useParams<{ id: string }>();
  const { orcamentos } = useOrcamentos();
  const orcamento = orcamentos.find(o => o.id === id);
  const navigate = useNavigate();

  if (orcamento === undefined) return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  if (!orcamento) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Orçamento não encontrado</p>
        <button onClick={() => navigate('/orcamentos')} className="btn-primary">← Voltar para lista</button>
      </div>
    );
  }
  return <DetalheOrcamento orcamento={orcamento} />;
}

function PaginaEditarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const { orcamentos } = useOrcamentos();
  const orcamento = orcamentos.find(o => o.id === id);

  if (!orcamento) return <Navigate to="/orcamentos" replace />;
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Editar Orçamento #{String(orcamento.numero).padStart(4, '0')}</h1>
      <FormularioOrcamento orcamentoExistente={orcamento} />
    </div>
  );
}

// ── Páginas de Recibos ───────────────────────────────────────────────────

function PaginaDetalheRecibo() {
  const { id } = useParams<{ id: string }>();
  const { recibos } = useRecibos();
  const recibo = recibos.find(r => r.id === id);
  const navigate = useNavigate();

  if (recibo === undefined) return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  if (!recibo) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Recibo não encontrado</p>
        <button onClick={() => navigate('/recibos')} className="btn-primary">← Voltar para lista</button>
      </div>
    );
  }
  return <DetalheRecibo recibo={recibo} />;
}

// ── Páginas de Clientes ───────────────────────────────────────────────────

function PaginaDetalheCliente() {
  const { id } = useParams<{ id: string }>();
  const { clientes } = useClientes();
  const navigate = useNavigate();
  
  const cliente = clientes.find(c => c.id === id);

  if (cliente === undefined) return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Cliente não encontrado</p>
        <button onClick={() => navigate('/clientes')} className="btn-primary">← Voltar para lista</button>
      </div>
    );
  }
  return <DetalheCliente cliente={cliente} />;
}

// ── Guard de Autenticação ────────────────────────────────────────────────

function RotaProtegida({ children, modulo }: { children: React.ReactNode, modulo?: string }) {
  const { usuario, estaAutenticado, estaCarregando, temAcessoRecurso } = useAuth();

  if (estaCarregando) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!estaAutenticado || !usuario) return <Navigate to="/login" replace />;

  // Restrição estrita para CAC Individual
  if (usuario.tipoConta === 'cac_individual') {
    const modulosPermitidos = ['clientes', 'agenda', 'config'];
    if (modulo && !modulosPermitidos.includes(modulo)) {
      return <Navigate to="/agenda" replace />;
    }
    return <>{children}</>;
  }

  // Admin Mestre sempre tem acesso
  if (usuario.email === 'gui.gomesassis@gmail.com') return <>{children}</>;

  // Verificar permissão no nível de empresa (tenant) para outros usuários e admins
  if (modulo) {
    let temAcessoTenant = true;
    if (modulo === 'ordens') {
      temAcessoTenant = temAcessoRecurso('modulo_ordens');
    } else if (modulo === 'clientes') {
      const path = window.location.pathname;
      if (path.includes('clientes-cac')) {
        temAcessoTenant = temAcessoRecurso('modulo_clientes_cac');
      } else {
        temAcessoTenant = temAcessoRecurso('modulo_clientes');
      }
    } else if (modulo === 'orcamentos') {
      temAcessoTenant = temAcessoRecurso('modulo_orcamentos');
    } else if (modulo === 'recibos') {
      temAcessoTenant = temAcessoRecurso('modulo_recibos');
    } else if (modulo === 'agendamentos') {
      temAcessoTenant = temAcessoRecurso('modulo_agendamentos');
    } else if (modulo === 'financeiro') {
      temAcessoTenant = temAcessoRecurso('fin_fluxo_caixa') || temAcessoRecurso('fin_relatorio_equipe') || temAcessoRecurso('fin_exportacao');
    } else if (modulo === 'painel') {
      temAcessoTenant = temAcessoRecurso('dash_atencao_diaria') || temAcessoRecurso('dash_alertas_vencimento') || 
                        temAcessoRecurso('dash_lembretes') || temAcessoRecurso('dash_resumo_os') || 
                        temAcessoRecurso('dash_margem_operacional') || temAcessoRecurso('dash_resumo_operacional') || 
                        temAcessoRecurso('dash_resumo_orcamentos') || temAcessoRecurso('dash_ordens_recentes');
    } else if (modulo === 'rotina') {
      temAcessoTenant = temAcessoRecurso('dash_atencao_diaria');
    } else if (modulo === 'agenda') {
      temAcessoTenant = temAcessoRecurso('dash_lembretes');
    }

    if (!temAcessoTenant) {
      return <Navigate to="/" replace />;
    }
  }

  // Se for admin da empresa, tem acesso a tudo liberado para o tenant
  if (usuario.role === 'admin') return <>{children}</>;

  // Se houver um módulo específico, verifica permissão do colaborador
  if (modulo && !usuario.permissoes?.includes(modulo)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ProtecaoIndex() {
  const { usuario } = useAuth();
  if (usuario?.tipoConta === 'cac_individual') {
    return <Navigate to="/agenda" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function WildcardRedirect() {
  const { usuario } = useAuth();
  if (usuario?.tipoConta === 'cac_individual') {
    return <Navigate to="/agenda" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

// ── App Principal ────────────────────────────────────────────────────────

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AuthProvider>
        <NotificacoesSistemaProvider>
          <OrdensProvider>
            <OrcamentosProvider>
              <ClientesProvider>
                <ServicosProvider>
                  <RecibosProvider>
                    <AgendamentosProvider>
                      <FinanceiroProvider>
                        <LembretesProvider>
                          <BrowserRouter>
                          <Routes>
                            {/* Login */}
                            <Route path="/login" element={<PaginaLoginGuard />} />

                            {/* App protegido */}
                            <Route path="/" element={
                              <RotaProtegida>
                                <AppShell />
                              </RotaProtegida>
                            }>
                              <Route index element={<ProtecaoIndex />} />
                              <Route path="dashboard" element={<RotaProtegida modulo="painel"><Dashboard /></RotaProtegida>} />
                              <Route path="ordens" element={<RotaProtegida modulo="ordens"><ListaOrdens /></RotaProtegida>} />
                              <Route path="ordens/nova" element={
                                <RotaProtegida modulo="ordens">
                                  <div>
                                    <h1 className="text-2xl font-bold text-white mb-6">Nova Ordem de Serviço</h1>
                                    <FormularioOrdem />
                                  </div>
                                </RotaProtegida>
                              } />
                              <Route path="ordens/:id" element={<RotaProtegida modulo="ordens"><PaginaDetalheOrdem /></RotaProtegida>} />
                              <Route path="ordens/:id/editar" element={<RotaProtegida modulo="ordens"><PaginaEditarOrdem /></RotaProtegida>} />
                              <Route path="clientes" element={<RotaProtegida modulo="clientes"><ListaClientes /></RotaProtegida>} />
                              <Route path="clientes-cac" element={<RotaProtegida modulo="clientes"><PainelClientesCAC /></RotaProtegida>} />
                              <Route path="clientes/:id" element={<RotaProtegida modulo="clientes"><PaginaDetalheCliente /></RotaProtegida>} />
                              <Route path="agendamentos" element={<RotaProtegida modulo="agendamentos"><ListaAgendamentos /></RotaProtegida>} />
                              <Route path="financeiro" element={<RotaProtegida modulo="financeiro"><Financeiro /></RotaProtegida>} />
                              <Route path="rotina" element={<RotaProtegida modulo="rotina"><RotinaDiaria /></RotaProtegida>} />
                              <Route path="agenda" element={<RotaProtegida modulo="agenda"><ListaLembretes /></RotaProtegida>} />
                              <Route path="configuracoes" element={<RotaProtegida modulo="config"><Configuracoes /></RotaProtegida>} />
                              
                              {/* Orçamentos */}
                              <Route path="orcamentos" element={<RotaProtegida modulo="orcamentos"><ListaOrcamentos /></RotaProtegida>} />
                              <Route path="orcamentos/novo" element={
                                <RotaProtegida modulo="orcamentos">
                                  <div>
                                    <h1 className="text-2xl font-bold text-white mb-6">Novo Orçamento</h1>
                                    <FormularioOrcamento />
                                  </div>
                                </RotaProtegida>
                              } />
                              <Route path="orcamentos/:id" element={<RotaProtegida modulo="orcamentos"><PaginaDetalheOrcamento /></RotaProtegida>} />
                              <Route path="orcamentos/:id/editar" element={<RotaProtegida modulo="orcamentos"><PaginaEditarOrcamento /></RotaProtegida>} />

                              {/* Recibos */}
                              <Route path="recibos" element={<RotaProtegida modulo="recibos"><ListaRecibos /></RotaProtegida>} />
                              <Route path="recibos/novo" element={
                                <RotaProtegida modulo="recibos">
                                  <div>
                                    <h1 className="text-2xl font-bold text-white mb-6">Novo Recibo</h1>
                                    <FormularioRecibo />
                                  </div>
                                </RotaProtegida>
                              } />
                              <Route path="recibos/:id" element={<RotaProtegida modulo="recibos"><PaginaDetalheRecibo /></RotaProtegida>} />

                              {/* Admin: Gestão de Atiradores CAC Individual */}
                              <Route path="admin/atiradores" element={
                                <RotaProtegida modulo="painel">
                                  <PainelAtiradores />
                                </RotaProtegida>
                              } />
                            </Route>

                            <Route path="*" element={<WildcardRedirect />} />
                          </Routes>
                        </BrowserRouter>
                      </LembretesProvider>
                    </FinanceiroProvider>
                  </AgendamentosProvider>
                </RecibosProvider>
              </ServicosProvider>
            </ClientesProvider>
          </OrcamentosProvider>
        </OrdensProvider>
      </NotificacoesSistemaProvider>
    </AuthProvider>
  </GoogleOAuthProvider>
);
}

function PaginaLoginGuard() {
  const { estaAutenticado, estaCarregando } = useAuth();
  if (estaCarregando) return null;
  if (estaAutenticado) return <Navigate to="/dashboard" replace />;
  return <PaginaLogin />;
}
