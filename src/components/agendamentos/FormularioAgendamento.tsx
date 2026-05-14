import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, X, Users, Phone, MapPin, User, Crosshair, DollarSign, Calendar, Clock, Info, CheckCircle } from 'lucide-react';
import { Agendamento, TipoAgendamento, Cliente } from '../../types';
import { useAgendamentos } from '../../context/AgendamentosContext';
import { useClientes } from '../../context/ClientesContext';
import { useAuth } from '../../context/AuthContext';
import { Notificacao, useNotificacao } from '../common/Notificacao';
import { removerAcentos } from '../../utils/formatters';

interface FormularioAgendamentoProps {
  agendamentoExistente?: Agendamento;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DEFAULTS = {
  'Psicológico': {
    local: 'Clinica Metra (Em frente a Saneago)',
    profissional: 'Millena Queluz',
    valor: 300,
  },
  'Tiro': {
    local: 'Clube de Tiro e caça Pró tiro',
    profissional: 'Keoma',
    valor: 350,
  }
};

export function FormularioAgendamento({ agendamentoExistente, onSuccess, onCancel }: FormularioAgendamentoProps) {
  const location = useLocation();
  const { criarAgendamento, atualizarAgendamento, buscarAgendamentoPorCPF } = useAgendamentos();
  const { clientes } = useClientes();
  const { estado: notif, mostrar, fechar } = useNotificacao();
  const [salvando, setSalvando] = useState(false);
  const [focoNome, setFocoNome] = useState(false);

  const { usuario } = useAuth();
  const [foiSalvo, setFoiSalvo] = useState(false);
  const [ultimoTipoSalvo, setUltimoTipoSalvo] = useState<TipoAgendamento | null>(null);

  const [form, setForm] = useState({
    tipo:               (agendamentoExistente?.tipo               ?? 'Psicológico') as TipoAgendamento,
    clienteNome:        agendamentoExistente?.clienteNome       ?? '',
    clienteCPF:         agendamentoExistente?.clienteCPF        ?? '',
    clienteContato:     agendamentoExistente?.clienteContato    ?? '',
    clienteEndereco:    agendamentoExistente?.clienteEndereco   ?? '',
    arma:               agendamentoExistente?.arma              ?? '',
    data:               agendamentoExistente?.data              ?? '',
    horario:            agendamentoExistente?.horario           ?? '',
    local:              agendamentoExistente?.local             ?? DEFAULTS['Psicológico'].local,
    profissional:       agendamentoExistente?.profissional      ?? (usuario?.role === 'colaborador' ? usuario.nome : DEFAULTS['Psicológico'].profissional),
    valor:              agendamentoExistente?.valor             ?? DEFAULTS['Psicológico'].valor,
    despachante:        agendamentoExistente?.despachante       ?? 'GCAC / Guilherme',
    dataPsicologico:    agendamentoExistente?.dataPsicologico    ?? '',
    horarioPsicologico: agendamentoExistente?.horarioPsicologico ?? '',
  });

  // Preenchimento automático vindo do perfil do cliente
  useEffect(() => {
    const state = location.state as { clientePreDefinido?: Cliente };
    if (state?.clientePreDefinido && !agendamentoExistente) {
      const c = state.clientePreDefinido;
      setForm(f => ({
        ...f,
        clienteNome: c.nome,
        clienteCPF: c.cpf,
        clienteContato: c.contato,
        clienteEndereco: c.endereco || ''
      }));
      // Limpar o estado para não repetir o preenchimento
      window.history.replaceState({}, document.title);
    }
  }, [location, agendamentoExistente]);

  const [erros, setErros] = useState<Record<string, string>>({});

  const atualizar = (campo: string, valor: any) => {
    setForm(f => {
      const novoForm = { ...f, [campo]: valor };
      
      // Se mudar o tipo e não for edição, aplica os padrões
      if (campo === 'tipo' && !agendamentoExistente) {
        const defaults = DEFAULTS[valor as TipoAgendamento];
        novoForm.local = defaults.local;
        novoForm.profissional = defaults.profissional;
        novoForm.valor = defaults.valor;
      }

      return novoForm;
    });
    setErros(e => { const n = { ...e }; delete n[campo]; return n; });
  };

  // Lógica de "Encontro de Agendamentos"
  useEffect(() => {
    if (form.tipo === 'Tiro' && form.clienteCPF.length >= 11 && !agendamentoExistente) {
      const cpfLimpo = form.clienteCPF.replace(/\D/g, '');
      if (cpfLimpo.length === 11) {
        const agendamentoPsi = buscarAgendamentoPorCPF(form.clienteCPF, 'Psicológico');
        if (agendamentoPsi) {
          setForm(f => ({
            ...f,
            dataPsicologico: agendamentoPsi.data,
            horarioPsicologico: agendamentoPsi.horario
          }));
          mostrar('info', `Encontramos um laudo psicológico para este cliente em ${agendamentoPsi.data}. Dados preenchidos.`);
        }
      }
    }
  }, [form.tipo, form.clienteCPF, buscarAgendamentoPorCPF, agendamentoExistente]);

  const selecionarCliente = (c: Cliente) => {
    setForm(f => ({
      ...f,
      clienteNome: c.nome,
      clienteCPF: c.cpf,
      clienteContato: c.contato,
      clienteEndereco: c.endereco || '', 
    }));
    setFocoNome(false);
  };

  const clientesSugeridos = clientes.filter(c => 
    removerAcentos(c.nome.toLowerCase()).includes(removerAcentos(form.clienteNome.toLowerCase())) && 
    form.clienteNome.length > 0 && 
    removerAcentos(c.nome.toLowerCase()) !== removerAcentos(form.clienteNome.toLowerCase())
  );

  const handleCPF = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.replace(/(\d{3})(\d)/, '$1.$2')
               .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
               .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    atualizar('clienteCPF', f);
  };

  const handleTelefone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    const f = n.length <= 10
      ? n.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      : n.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    atualizar('clienteContato', f);
  };

  const handleHorario = (v: string) => {
    let n = v.replace(/\D/g, '').slice(0, 4);
    let f = n;
    if (n.length > 2) {
      f = n.slice(0, 2) + ':' + n.slice(2);
    }
    if (f.length === 5) {
      f = f + 'H';
    }
    atualizar('horario', f);
  };

  const toggleArma = (opcao: string) => {
    const armasAtuais = form.arma ? form.arma.split(', ').filter(Boolean) : [];
    const novaLista = armasAtuais.includes(opcao)
      ? armasAtuais.filter(a => a !== opcao)
      : [...armasAtuais, opcao].sort();
    
    atualizar('arma', novaLista.join(', '));
  };

  const OPCOES_ARMAS = ['CARABINA', 'ESPINGARDA', 'PISTOLA', 'REVÓLVER'];

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.clienteNome.trim()) e.clienteNome = 'Nome é obrigatório';
    if (!form.clienteCPF.trim())  e.clienteCPF = 'CPF é obrigatório';
    if (!form.clienteContato.trim()) e.clienteContato = 'Contato é obrigatório';
    if (!form.data)               e.data        = 'Data é obrigatória';
    if (!form.horario)            e.horario     = 'Horário é obrigatório';
    if (!form.arma)               e.arma        = 'Informe a arma';
    
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    
    try {
      const payload = {
        ...form,
        clienteNome: form.clienteNome.trim().toUpperCase(),
        clienteEndereco: form.clienteEndereco.trim().toUpperCase(),
        local: form.local.trim().toUpperCase(),
        despachante: form.despachante.trim().toUpperCase()
      };

      if (agendamentoExistente) {
        await atualizarAgendamento(agendamentoExistente.id, payload);
        mostrar('sucesso', 'Agendamento atualizado com sucesso!');
        setTimeout(() => onSuccess?.(), 1000);
      } else {
        await criarAgendamento(payload);
        setUltimoTipoSalvo(form.tipo);
        setFoiSalvo(true);
        mostrar('sucesso', 'Agendamento criado com sucesso!');
      }
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      const msg = err.message || 'Erro ao salvar agendamento.';
      mostrar('erro', msg);
    } finally {
      setSalvando(false);
    }
  };

  const prepararAgendamentoTiro = () => {
    const dataPsi = form.data;
    const horarioPsi = form.horario;
    const infoCliente = {
      clienteNome: form.clienteNome,
      clienteCPF: form.clienteCPF,
      clienteContato: form.clienteContato,
      clienteEndereco: form.clienteEndereco
    };
    
    setForm(f => ({
      ...f,
      ...infoCliente,
      tipo: 'Tiro',
      local: DEFAULTS['Tiro'].local,
      profissional: DEFAULTS['Tiro'].profissional,
      valor: DEFAULTS['Tiro'].valor,
      data: '',
      horario: '',
      dataPsicologico: dataPsi,
      horarioPsicologico: horarioPsi
    }));
    
    setFoiSalvo(false);
    setUltimoTipoSalvo(null);
    mostrar('info', 'Dados do cliente mantidos. Agora defina a data do laudo de tiro.');
  };

  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Overlay de Sucesso com Atalho */}
      {foiSalvo && (
        <div className="absolute inset-x-[-10px] inset-y-[-10px] z-[100] bg-brand-dark/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500 rounded-3xl border-2 border-brand-blue/20 shadow-2xl">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Agendamento Realizado!</h2>
          <p className="text-gray-400 max-w-sm mb-10">
            O laudo {ultimoTipoSalvo?.toLowerCase()} foi agendado com sucesso e já está na sua lista.
          </p>

          <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
            {ultimoTipoSalvo === 'Psicológico' && (
              <button
                type="button"
                onClick={prepararAgendamentoTiro}
                className="btn-primary py-4 flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20"
              >
                <Crosshair size={20} />
                Agendar Laudo de Tiro
              </button>
            )}
            
            <button
              type="button"
              onClick={() => onSuccess?.()}
              className="btn-ghost py-4 border border-brand-dark-5 hover:bg-brand-dark-4"
            >
              Concluir e Voltar
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Agendamento */}
        <div className="flex gap-2 p-1 bg-brand-dark-3 rounded-xl border border-brand-dark-5">
          {(['Psicológico', 'Tiro'] as TipoAgendamento[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => atualizar('tipo', t)}
              className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                form.tipo === t 
                  ? t === 'Psicológico' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${form.tipo === t ? 'bg-white animate-pulse' : 'bg-gray-700'}`} />
              Laudo {t}
            </button>
          ))}
        </div>

        {/* Dados do Cliente */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2 mb-2">
              <Users size={18} className="text-brand-blue" />
              Dados do Cliente
            </h3>
            <span className="text-[10px] text-gray-700 select-none font-bold">VER: 1.2.0</span>
          </div>
          
          <div className="relative">
            <label className="label label-required">Nome Completo</label>
            <input 
              type="text" 
              className={`input uppercase ${erros.clienteNome ? 'input-error' : ''}`}
              placeholder="NOME DO CLIENTE"
              value={form.clienteNome}
              onChange={e => atualizar('clienteNome', e.target.value)}
              onFocus={() => setFocoNome(true)}
              onBlur={() => setTimeout(() => setFocoNome(false), 200)}
            />
            {focoNome && clientesSugeridos.length > 0 && (
              <div className="absolute left-0 top-[100%] z-50 w-full bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl overflow-hidden mt-1 max-h-48 overflow-y-auto">
                {clientesSugeridos.map(c => (
                  <div
                    key={c.id}
                    onClick={() => selecionarCliente(c)}
                    className="px-4 py-3 border-b border-brand-dark-5 hover:bg-brand-blue/20 cursor-pointer transition-colors"
                  >
                    <p className="text-sm font-bold text-white">{c.nome}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">CPF: {c.cpf}</p>
                  </div>
                ))}
              </div>
            )}
            {erros.clienteNome && <p className="text-red-400 text-xs mt-1">{erros.clienteNome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label label-required">CPF</label>
              <input 
                type="text" 
                className={`input ${erros.clienteCPF ? 'input-error' : ''}`}
                placeholder="000.000.000-00"
                value={form.clienteCPF}
                onChange={e => handleCPF(e.target.value)}
              />
              {erros.clienteCPF && <p className="text-red-400 text-xs mt-1">{erros.clienteCPF}</p>}
            </div>
            <div>
              <label className="label label-required">Contato</label>
              <input 
                type="tel" 
                className={`input ${erros.clienteContato ? 'input-error' : ''}`}
                placeholder="(00) 00000-0000"
                value={form.clienteContato}
                onChange={e => handleTelefone(e.target.value)}
              />
              {erros.clienteContato && <p className="text-red-400 text-xs mt-1">{erros.clienteContato}</p>}
            </div>
          </div>

          <div>
            <label className="label">Endereço Completo</label>
            <textarea 
              className="input h-20 resize-none uppercase"
              placeholder="RUA, NÚMERO, BAIRRO, CEP, CIDADE-UF"
              value={form.clienteEndereco}
              onChange={e => atualizar('clienteEndereco', e.target.value)}
            />
          </div>
        </div>

        {/* Detalhes do Laudo */}
        <div className="card space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-brand-blue" />
            Detalhes do Laudo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="label label-required">Arma(s)</label>
              <div className="flex flex-wrap gap-2">
                {OPCOES_ARMAS.map(opcao => {
                  const selecionada = form.arma.split(', ').includes(opcao);
                  return (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => toggleArma(opcao)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        selecionada 
                          ? 'bg-brand-blue/20 border-brand-blue text-brand-blue-light' 
                          : 'bg-brand-dark-3 border-brand-dark-5 text-gray-500 hover:border-brand-metal'
                      }`}
                    >
                      {opcao}
                    </button>
                  );
                })}
              </div>
              {erros.arma && <p className="text-red-400 text-xs mt-1">{erros.arma}</p>}
            </div>
            <div>
              <label className="label label-required">Data</label>
              <input 
                type="date" 
                className={`input ${erros.data ? 'input-error' : ''}`}
                value={form.data}
                onChange={e => atualizar('data', e.target.value)}
              />
              {erros.data && <p className="text-red-400 text-xs mt-1">{erros.data}</p>}
            </div>
            <div>
              <label className="label label-required">Horário</label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  className={`input pl-10 ${erros.horario ? 'input-error' : ''}`}
                  placeholder="00:00H"
                  value={form.horario}
                  onChange={e => handleHorario(e.target.value)}
                  onBlur={() => {
                    let h = form.horario.replace(/\D/g, '');
                    if (h.length > 0 && h.length <= 2) {
                      atualizar('horario', h.padStart(2, '0') + ':00H');
                    } else if (h.length > 2 && h.length < 4) {
                      atualizar('horario', h.slice(0, 2) + ':' + h.slice(2).padStart(2, '0') + 'H');
                    } else if (h.length === 4 && !form.horario.includes('H')) {
                      atualizar('horario', h.slice(0, 2) + ':' + h.slice(2) + 'H');
                    }
                  }}
                />
              </div>
              {erros.horario && <p className="text-red-400 text-xs mt-1">{erros.horario}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="label">Local </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  className="input pl-10"
                  list="lista-clubes"
                  placeholder="EX: CLUBE PRO TIRO"
                  value={form.local}
                  onChange={e => atualizar('local', e.target.value)}
                />
                <datalist id="lista-clubes">
                  <option value="CLUBE DE TIRO E CAÇA PRÓ TIRO (JATAÍ)" />
                  <option value="CLUBE DE TIRO ARMAZÉM DO CAC" />
                  <option value="CLUBE DE TIRO E CAÇA DO PANTANAL" />
                  <option value="CLÍNICA METRA" />
                </datalist>
              </div>
            </div>
            <div>
              <label className="label">{form.tipo === 'Psicológico' ? 'Psicóloga' : 'Instrutor'}</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  className="input pl-10"
                  value={form.profissional}
                  onChange={e => atualizar('profissional', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label text-brand-blue-light font-bold">Despachante Responsável</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  className={`input pl-10 ${usuario?.role === 'colaborador' ? 'border-brand-blue/30 focus:border-brand-blue' : ''}`}
                  list="lista-despachantes"
                  placeholder="EX: GCAC / GUILHERME"
                  value={form.despachante}
                  onChange={e => atualizar('despachante', e.target.value)}
                />
                <datalist id="lista-despachantes">
                  <option value="GCAC / GUILHERME" />
                  <option value="PARTICULAR — CLIENTE DIRETO" />
                  <option value="CLUBE PRO TIRO" />
                  <option value="OUTRO DESPACHANTE" />
                </datalist>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Valor Cobrado</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="number" 
                className="input pl-10"
                value={form.valor}
                onChange={e => atualizar('valor', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Informação Adicional para Laudo de Tiro */}
        {form.tipo === 'Tiro' && (
          <div className="card space-y-4 border-l-4 border-l-brand-blue animate-in slide-in-from-left-4">
            <h3 className="text-white font-bold flex items-center gap-2 mb-2">
              <Info size={18} className="text-brand-blue" />
              Vínculo com Psicológico
            </h3>
            <p className="text-gray-500 text-xs">
              Informe a data e hora do laudo psicológico para constar no comunicado de tiro.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Data do Psicológico</label>
                <input 
                  type="date" 
                  className="input"
                  value={form.dataPsicologico}
                  onChange={e => atualizar('dataPsicologico', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Horário do Psicológico</label>
                <input 
                  type="text" 
                  className="input"
                  placeholder="Ex: 08h"
                  value={form.horarioPsicologico}
                  onChange={e => atualizar('horarioPsicologico', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost flex-1 py-4 h-auto"
          >
            <X size={18} /> Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="btn-primary flex-1 py-4 h-auto shadow-lg shadow-brand-blue/20"
          >
            <Save size={18} />
            {salvando ? 'Salvando...' : agendamentoExistente ? 'Atualizar Agendamento' : 'Salvar Agendamento'}
          </button>
        </div>
      </form>
      <Notificacao {...notif} onFechar={fechar} />
    </div>
  );
}
