import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClientes } from '../../context/ClientesContext';
import { Users, Search, Edit2, Trash2, Eye, Shield, Copy, Check } from 'lucide-react';
import { Cliente } from '../../types';
import { formatarCPF, formatarTelefone, removerAcentos } from '../../utils/formatters';
import { FormularioCliente } from './FormularioCliente';
import { DialogConfirmacao } from '../common/DialogConfirmacao';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { DetalheCliente } from './DetalheCliente';
import { useAuth } from '../../context/AuthContext';

export function ListaClientes() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { clientes, deletarCliente } = useClientes();

  if (usuario?.tipoConta === 'cac_individual') {
    if (clientes.length > 0) {
      const clienteReal = clientes.find(c => c.cpf && c.cpf.trim() !== '') || clientes[0];
      return <DetalheCliente cliente={clienteReal} />;
    }
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Carregando acervo pessoal...</p>
      </div>
    );
  }
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [busca, setBusca] = useState('');
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteVisualizando, setClienteVisualizando] = useState<Cliente | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [copiou, setCopiou] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState<Cliente | null>(null);

  const clientesFiltrados = clientes.filter(c => {
    const termo = removerAcentos(busca.toLowerCase());
    const cpfLimpo = c.cpf.replace(/\D/g, '');
    const buscaLimpa = busca.replace(/\D/g, '');

    const matchNome = removerAcentos(c.nome.toLowerCase()).includes(termo);
    // Só filtra por CPF se o usuário digitou algum número na busca
    const matchCPF = buscaLimpa.length > 0 && cpfLimpo.includes(buscaLimpa);

    return matchNome || matchCPF;
  });

  const handleExcluir = async () => {
    if (!confirmandoDelete) return;
    try {
      await deletarCliente(confirmandoDelete.id);
      setConfirmandoDelete(null);
      mostrar('sucesso', 'Cliente excluído com sucesso.');
    } catch (error) {
      console.error(error);
      mostrar('erro', 'Falha ao excluir o cliente.');
    }
  };

  const abrirEdicao = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setModalAberto(true);
  };

  const abrirNovo = () => {
    setClienteEditando(null);
    setModalAberto(true);
  };

  const handleCopiarSenha = (senha: string) => {
    navigator.clipboard.writeText(senha);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={24} className="text-brand-blue-light" />
            Meus Clientes
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie a agenda de contatos para preenchimento rápido nas O.S.</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary">
          <Users size={16} />
          Novo Cliente
        </button>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {clientesFiltrados.length === 0 ? (
          <div className="text-center py-10">
            <Users size={48} className="text-brand-dark-5 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {busca ? 'Nenhum cliente encontrado nessa busca.' : 'Sua lista de clientes está vazia. Comece criando uma O.S. ou clique em Novo Cliente.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-dark-3 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-semibold">Nome / CPF</th>
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-4 py-3 font-semibold">Clube Filiado</th>
                  <th className="px-4 py-3 rounded-r-lg font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark-5">
                {clientesFiltrados.map(cliente => (
                  <tr key={cliente.id} className="hover:bg-brand-dark-4 transition-colors">
                    <td className="px-4 py-3 cursor-pointer group" onClick={() => navigate(`/clientes/${cliente.id}`)}>
                       <p className="font-bold text-white group-hover:text-brand-blue-light transition-colors">{cliente.nome}</p>
                      <p className="text-xs text-brand-metal">{formatarCPF(cliente.cpf)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatarTelefone(cliente.contato)}
                    </td>
                    <td className="px-4 py-3">
                      {cliente.filiadoProTiro ? (
                        <span className="bg-brand-green/20 text-brand-green border border-brand-green/30 px-2.5 py-1 rounded-full text-xs font-semibold uppercase" title={usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE DE TIRO E CAÇA PRÓ TIRO'}>
                          {usuario?.dadosEmpresa?.clubeParceiroPadrao 
                            ? (usuario.dadosEmpresa.clubeParceiroPadrao.length > 20 ? usuario.dadosEmpresa.clubeParceiroPadrao.substring(0, 17) + '...' : usuario.dadosEmpresa.clubeParceiroPadrao) 
                            : 'PRÓ TIRO'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs uppercase font-medium" title={cliente.clubeFiliado || 'Não filiado'}>
                          {cliente.clubeFiliado 
                            ? (cliente.clubeFiliado.length > 20 ? cliente.clubeFiliado.substring(0, 17) + '...' : cliente.clubeFiliado) 
                            : 'Não filiado'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/clientes/${cliente.id}`)}
                        className="p-1.5 text-gray-400 hover:text-white transition-colors"
                        title="Ver Perfil"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => abrirEdicao(cliente)}
                        className="p-1.5 text-gray-400 hover:text-brand-blue-light transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmandoDelete(cliente)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAberto && (
        <FormularioCliente
          clienteEditando={clienteEditando}
          onFechar={() => setModalAberto(false)}
        />
      )}

      {clienteVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-brand-dark-2 w-full max-w-lg rounded-2xl border border-brand-dark-5 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue" />
            
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-brand-blue/10 p-2.5 rounded-xl border border-brand-blue/20">
                  <Users size={24} className="text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight">{clienteVisualizando.nome}</h2>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-widest leading-none mt-1">Detalhes do Cliente</p>
                </div>
              </div>
              <button 
                onClick={() => setClienteVisualizando(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <Trash2 className="rotate-45" size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-brand-dark-3 p-3 rounded-xl border border-brand-dark-5">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">CPF</p>
                <p className="text-white font-medium">{formatarCPF(clienteVisualizando.cpf)}</p>
              </div>
              <div className="bg-brand-dark-3 p-3 rounded-xl border border-brand-dark-5">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Contato</p>
                <p className="text-white font-medium">{formatarTelefone(clienteVisualizando.contato)}</p>
              </div>
            </div>

            {clienteVisualizando.endereco && (
              <div className="bg-brand-dark-3 p-3 rounded-xl border border-brand-dark-5 mb-4">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Endereço</p>
                <p className="text-white font-medium text-sm mt-1 uppercase">{clienteVisualizando.endereco}</p>
              </div>
            )}

            <div className="bg-brand-dark-3 p-4 rounded-xl border border-brand-dark-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-blue" />
                  <p className="text-xs text-white font-bold uppercase tracking-wider">Acesso GOV.BR</p>
                </div>
                <button 
                  onClick={() => handleCopiarSenha(clienteVisualizando.senhaGov)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    copiou ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30'
                  }`}
                >
                  {copiou ? <Check size={12} /> : <Copy size={12} />}
                  {copiou ? 'Copiado!' : 'Copiar Senha'}
                </button>
              </div>
              <div className="bg-brand-dark-2 p-3 rounded-lg border border-brand-dark-5 font-mono text-lg text-brand-blue-light tracking-widest text-center">
                {clienteVisualizando.senhaGov}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm py-2 border-b border-brand-dark-5">
                <span className="text-gray-500">Clube Filiado:</span>
                <span className={clienteVisualizando.filiadoProTiro ? 'text-brand-green font-bold uppercase' : 'text-gray-400 uppercase'}>
                  {clienteVisualizando.filiadoProTiro 
                    ? (usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE DE TIRO E CAÇA PRÓ TIRO') 
                    : (clienteVisualizando.clubeFiliado || 'NÃO FILIADO')}
                </span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">Cadastrado em:</span>
                <span className="text-gray-300">
                  {new Date(clienteVisualizando.criadoEm).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <button 
              onClick={() => setClienteVisualizando(null)}
              className="w-full mt-8 btn-ghost border-brand-dark-5 h-11"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
      <Notificacao {...notif} onFechar={fechar} />

      <DialogConfirmacao
        aberto={!!confirmandoDelete}
        titulo="Excluir Cliente"
        mensagem={`Tem certeza que deseja excluir o cadastro de ${confirmandoDelete?.nome}? Apenas o cadastro será removido, os dados vinculados em O.S. permanecem.`}
        textoBotaoConfirmar="Sim, excluir"
        onConfirmar={handleExcluir}
        onCancelar={() => setConfirmandoDelete(null)}
      />
    </div>
  );
}
