import React, { useState, useRef } from 'react';
import { Cliente } from '../../types';
import { useClientes } from '../../context/ClientesContext';
import { useAuth } from '../../context/AuthContext';
import { X, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface Props {
  clienteEditando: Cliente | null;
  onFechar: () => void;
}

export function FormularioCliente({ clienteEditando, onFechar }: Props) {
  const { usuario } = useAuth();
  const { criarCliente, atualizarCliente, clubesRegistrados } = useClientes();
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [focoClube, setFocoClube] = useState(false);

  const [form, setForm] = useState({
    nome: clienteEditando?.nome ?? '',
    cpf: clienteEditando?.cpf ?? '',
    contato: clienteEditando?.contato ?? '',
    senhaGov: clienteEditando?.senhaGov ?? '',
    filiadoProTiro: clienteEditando?.filiadoProTiro ?? true,
    clubeFiliado: clienteEditando?.clubeFiliado ?? '',
    observacoes: clienteEditando?.observacoes ?? '',
    endereco: clienteEditando?.endereco ?? '',
    numeroCr: clienteEditando?.numeroCr ?? '',
    vencimentoCr: clienteEditando?.vencimentoCr ?? '',
    numeroCrIbama: clienteEditando?.numeroCrIbama ?? '',
    vencimentoCrIbama: clienteEditando?.vencimentoCrIbama ?? '',
  });

  const atualizar = (campo: string, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }));
  };

  const handleCPF = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.replace(/(\d{3})(\d)/, '$1.$2')
               .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
               .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    atualizar('cpf', f);
  };

  const handleTelefone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.length <= 10
      ? n.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      : n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    atualizar('contato', f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoRef.current) return;
    if (!form.nome.trim() || !form.cpf.trim() || !form.contato.trim()) {
      alert('Nome, CPF e Contato são obrigatórios.');
      return;
    }
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim().toUpperCase(),
        cpf: form.cpf.trim(),
        contato: form.contato.trim(),
        senhaGov: form.senhaGov.trim(),
        filiadoProTiro: form.filiadoProTiro,
        clubeFiliado: form.filiadoProTiro ? '' : form.clubeFiliado.trim().toUpperCase(),
        observacoes: form.observacoes.trim(),
        endereco: form.endereco.trim().toUpperCase(),
        numeroCr: form.numeroCr.trim().toUpperCase(),
        vencimentoCr: form.vencimentoCr,
        numeroCrIbama: form.numeroCrIbama.trim().toUpperCase(),
        vencimentoCrIbama: form.vencimentoCrIbama,
      };

      if (clienteEditando) {
        await atualizarCliente(clienteEditando.id, payload);
      } else {
        await criarCliente(payload);
      }
      onFechar();
    } catch (err) {
      alert('Erro ao salvar o cliente');
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      
      <div className="card w-full max-w-lg shadow-2xl relative z-10 animate-scale-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onFechar}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {clienteEditando ? 'Editar Cliente' : 'Novo Cliente'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label label-required">Nome Completo</label>
            <input type="text" className="input uppercase" autoFocus
              value={form.nome} onChange={e => atualizar('nome', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label label-required">CPF</label>
              <input type="text" className="input"
                value={form.cpf} onChange={e => handleCPF(e.target.value)} />
            </div>
            <div>
              <label className="label label-required">Contato (WhatsApp)</label>
              <input type="tel" className="input"
                value={form.contato} onChange={e => handleTelefone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Senha GOV.br</label>
            <div className="relative">
              <input type={mostrarSenha ? 'text' : 'password'} className="input pr-10"
                value={form.senhaGov} onChange={e => atualizar('senhaGov', e.target.value)} />
              <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nº CR (Exército/PF)</label>
              <input type="text" className="input uppercase"
                value={form.numeroCr} onChange={e => atualizar('numeroCr', e.target.value)} />
            </div>
            <div>
              <label className="label">Vencimento CR</label>
              <input type="date" className="input"
                value={form.vencimentoCr} onChange={e => atualizar('vencimentoCr', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nº CR IBAMA</label>
              <input type="text" className="input uppercase"
                value={form.numeroCrIbama} onChange={e => atualizar('numeroCrIbama', e.target.value)} />
            </div>
            <div>
              <label className="label">Vencimento CR IBAMA</label>
              <input type="date" className="input"
                value={form.vencimentoCrIbama} onChange={e => atualizar('vencimentoCrIbama', e.target.value)} />
            </div>
          </div>

          <div className="bg-brand-dark-4 rounded-xl p-4 border border-brand-dark-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-semibold text-white">Filiado ao {usuario?.dadosEmpresa?.clubeParceiroPadrao || 'CLUBE PARCEIRO'}?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => atualizar('filiadoProTiro', true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    form.filiadoProTiro ? 'bg-brand-green/30 border-brand-green/60 text-brand-green-light' : 'bg-brand-dark-5 text-gray-400'
                  }`}>
                  {form.filiadoProTiro && <CheckCircle size={12} />} Sim
                </button>
                <button type="button" onClick={() => atualizar('filiadoProTiro', false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    !form.filiadoProTiro ? 'bg-red-500/30 border-red-500/60 text-red-300' : 'bg-brand-dark-5 text-gray-400'
                  }`}>
                  {!form.filiadoProTiro && <X size={12} />} Não
                </button>
              </div>
            </div>

            {!form.filiadoProTiro && (
              <div className="mt-3 animate-fade-in relative">
                <label className="label label-required">Qual clube é filiado?</label>
                <input type="text" className="input uppercase"
                  value={form.clubeFiliado}
                  onChange={e => atualizar('clubeFiliado', e.target.value)}
                  onFocus={() => setFocoClube(true)}
                  onBlur={() => setTimeout(() => setFocoClube(false), 200)}
                />

                {focoClube && clubesRegistrados.length > 0 && (
                  <div className="absolute left-0 top-[70px] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="max-h-40 overflow-y-auto">
                      {clubesRegistrados
                        .filter(c => c.includes(form.clubeFiliado.toUpperCase()) || form.clubeFiliado === '')
                        .map(clube => (
                          <div
                            key={clube}
                            onClick={() => atualizar('clubeFiliado', clube)}
                            className="px-4 py-2.5 border-b border-brand-dark-5 hover:bg-brand-blue/20 cursor-pointer transition-colors text-sm text-white font-medium"
                          >
                            {clube}
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div>
            <label className="label">Endereço Completo</label>
            <textarea 
              className="input h-20 py-3 resize-none uppercase"
              placeholder="Rua, número, bairro, CEP, cidade-UF..."
              value={form.endereco}
              onChange={e => atualizar('endereco', e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">Observações</label>
            <textarea 
              className="input min-h-[100px] py-3 resize-none"
              placeholder="Informações adicionais sobre o cliente..."
              value={form.observacoes}
              onChange={e => atualizar('observacoes', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1">
              <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
