import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Trash2, Edit3, Download, Copy, Check, AlertCircle, Sparkles, User, RefreshCw } from 'lucide-react';
import { useClientes } from '../../context/ClientesContext';
import { Cliente, ModeloDeclaracao } from '../../types';
import { gerarPdfDeclaracaoBlob } from '../../services/geradorPdfDeclaracao';

function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return '';
  const parts = dataStr.split('-');
  if (parts.length !== 3) return dataStr;
  const [ano, mes, dia] = parts;
  return `${dia}/${mes}/${ano}`;
}

export function GerenciadorDeclaracoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clientes, buscarModelosDeclaracao, salvarModeloDeclaracao, deletarModeloDeclaracao, atualizarCliente } = useClientes();
  
  const [abaAtiva, setAbaAtiva] = useState<'gerar' | 'modelos'>('gerar');
  const [carregandoModelos, setCarregandoModelos] = useState(true);
  const [modelos, setModelos] = useState<ModeloDeclaracao[]>([]);
  
  // Estado de Geração
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('');
  const [textoEditado, setTextoEditado] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [tituloManual, setTituloManual] = useState('');

  // Estado de Edição de Modelo
  const [modeloEditando, setModeloEditando] = useState<Partial<ModeloDeclaracao> | null>(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  // Novos Estados
  const [salvandoDadosCliente, setSalvandoDadosCliente] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({
    nome: '',
    rg: '',
    cpf: '',
    dataNascimento: '',
    nomePai: '',
    nomeMae: '',
    endereco: '',
    numeroCr: '',
    vencimentoCr: '',
    clubeFiliado: ''
  });
  
  const [dadosClube, setDadosClube] = useState({
    nome: '',
    cnpj: '',
    cr: '',
    crValidade: '',
    endereco: '',
    filiacaoNum: '',
    filiacaoData: ''
  });

  const lastSelectedIdRef = React.useRef<string>('');

  const clienteSelecionado = useMemo(() => {
    if (!clienteSelecionadoId) return undefined;
    if (clienteSelecionadoId === 'avulso') {
      return {
        id: 'avulso',
        nome: dadosCliente.nome || 'Pessoa Não Cadastrada',
        rg: dadosCliente.rg,
        cpf: dadosCliente.cpf,
        dataNascimento: dadosCliente.dataNascimento,
        nomePai: dadosCliente.nomePai,
        nomeMae: dadosCliente.nomeMae,
        endereco: dadosCliente.endereco,
        numeroCr: dadosCliente.numeroCr,
        vencimentoCr: dadosCliente.vencimentoCr,
        clubeFiliado: dadosCliente.clubeFiliado,
      } as Cliente;
    }
    const dbClient = clientes.find(c => c.id === clienteSelecionadoId);
    if (!dbClient) return undefined;
    return {
      ...dbClient,
      nome: dadosCliente.nome,
      rg: dadosCliente.rg,
      cpf: dadosCliente.cpf,
      dataNascimento: dadosCliente.dataNascimento,
      nomePai: dadosCliente.nomePai,
      nomeMae: dadosCliente.nomeMae,
      endereco: dadosCliente.endereco,
      numeroCr: dadosCliente.numeroCr,
      vencimentoCr: dadosCliente.vencimentoCr,
      clubeFiliado: dadosCliente.clubeFiliado,
    } as Cliente;
  }, [clientes, clienteSelecionadoId, dadosCliente]);

  const modeloSelecionado = useMemo(() => {
    return modelos.find(m => m.id === modeloSelecionadoId);
  }, [modelos, modeloSelecionadoId]);

  const exigeDadosClube = useMemo(() => {
    if (!modeloSelecionado) return false;
    const text = modeloSelecionado.texto;
    return (
      modeloSelecionado.titulo.includes('COMPROMISSO DE PARTICIPAÇÃO') ||
      text.includes('{{clube_')
    );
  }, [modeloSelecionado]);

  // Carregar Modelos do DB
  const carregarModelos = async () => {
    setCarregandoModelos(true);
    try {
      const data = await buscarModelosDeclaracao();
      setModelos(data);
    } catch (err) {
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setCarregandoModelos(false);
    }
  };

  useEffect(() => {
    carregarModelos();
  }, []);

  // Pre-selecionar cliente se vier por parâmetro da URL
  useEffect(() => {
    const cid = searchParams.get('clienteId');
    if (cid && clientes.some(c => c.id === cid)) {
      setClienteSelecionadoId(cid);
    }
  }, [searchParams, clientes]);

  // Placeholder Replacement Logic
  const dataAtualPorExtenso = useMemo(() => {
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const hoje = new Date();
    return `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  }, []);

  // Synchronize local input state with selected client
  useEffect(() => {
    const shouldLoad = 
      clienteSelecionadoId !== lastSelectedIdRef.current || 
      (clienteSelecionadoId && !dadosCliente.nome && clientes.some(c => c.id === clienteSelecionadoId));

    if (shouldLoad) {
      lastSelectedIdRef.current = clienteSelecionadoId;
      if (clienteSelecionadoId === 'avulso') {
        setDadosCliente({
          nome: '',
          rg: '',
          cpf: '',
          dataNascimento: '',
          nomePai: '',
          nomeMae: '',
          endereco: '',
          numeroCr: '',
          vencimentoCr: '',
          clubeFiliado: ''
        });
      } else if (clienteSelecionadoId) {
        const client = clientes.find(c => c.id === clienteSelecionadoId);
        if (client) {
          setDadosCliente({
            nome: client.nome || '',
            rg: client.rg || '',
            cpf: client.cpf || '',
            dataNascimento: client.dataNascimento || '',
            nomePai: client.nomePai || '',
            nomeMae: client.nomeMae || '',
            endereco: client.endereco || '',
            numeroCr: client.numeroCr || '',
            vencimentoCr: client.vencimentoCr || '',
            clubeFiliado: client.clubeFiliado || ''
          });
        }
      } else {
        setDadosCliente({
          nome: '',
          rg: '',
          cpf: '',
          dataNascimento: '',
          nomePai: '',
          nomeMae: '',
          endereco: '',
          numeroCr: '',
          vencimentoCr: '',
          clubeFiliado: ''
        });
      }
    }
  }, [clienteSelecionadoId, clientes, dadosCliente.nome]);

  // Synchronize club data with club selection/defaults
  useEffect(() => {
    const nomeClube = dadosCliente.clubeFiliado || 'CLUBE DE TIRO E CACA PRO TIRO';
    const isProTiro = nomeClube.toUpperCase().includes('PRO TIRO') || nomeClube.toUpperCase().includes('PRO-TIRO');
    
    setDadosClube(prev => ({
      ...prev,
      nome: nomeClube,
      cnpj: isProTiro ? '34.222.235/0001-40' : prev.cnpj || '',
      cr: isProTiro ? '409494' : prev.cr || '',
      endereco: isProTiro 
        ? 'Avenida Goiás, 1802, SALA 03 QUADRA05 LOTE 03, Vila Santa Maria, CEP 75800-133, Jataí - GO' 
        : prev.endereco || '',
    }));
  }, [dadosCliente.clubeFiliado]);

  const obterValorPlaceholder = (chave: string, client?: typeof dadosCliente, club?: typeof dadosClube): string => {
    if (!client) return `{{${chave}}}`;
    switch (chave) {
      case 'nome': return client.nome || '';
      case 'rg': return client.rg || '___________';
      case 'cpf': return client.cpf || '';
      case 'endereco': return client.endereco || '___________';
      case 'nome_pai': return client.nomePai || '___________';
      case 'nome_mae': return client.nomeMae || '___________';
      case 'data_nascimento': return formatarDataBr(client.dataNascimento) || '___/___/_____';
      case 'data_atual': return dataAtualPorExtenso;
      case 'numero_cr': return client.numeroCr || '___________';
      case 'vencimento_cr': return formatarDataBr(client.vencimentoCr) || '___/___/_____';
      // Club fields
      case 'clube_nome': return club?.nome || '___________';
      case 'clube_cnpj': return club?.cnpj || '___________';
      case 'clube_cr': return club?.cr || '___________';
      case 'clube_cr_validade': return formatarDataBr(club?.crValidade) || '___/___/_____';
      case 'clube_endereco': return club?.endereco || '___________';
      case 'clube_filiacao_num': return club?.filiacaoNum || '___________';
      case 'clube_filiacao_data': return formatarDataBr(club?.filiacaoData) || '___/___/_____';
      default: return `{{${chave}}}`;
    }
  };

  const processarPlaceholders = (texto: string, client?: typeof dadosCliente, club?: typeof dadosClube) => {
    if (!texto) return '';
    return texto
      .replace(/{{nome}}/g, obterValorPlaceholder('nome', client, club))
      .replace(/{{rg}}/g, obterValorPlaceholder('rg', client, club))
      .replace(/{{cpf}}/g, obterValorPlaceholder('cpf', client, club))
      .replace(/{{endereco}}/g, obterValorPlaceholder('endereco', client, club))
      .replace(/{{nome_pai}}/g, obterValorPlaceholder('nome_pai', client, club))
      .replace(/{{nome_mae}}/g, obterValorPlaceholder('nome_mae', client, club))
      .replace(/{{data_nascimento}}/g, obterValorPlaceholder('data_nascimento', client, club))
      .replace(/{{data_atual}}/g, obterValorPlaceholder('data_atual', client, club))
      .replace(/{{numero_cr}}/g, obterValorPlaceholder('numero_cr', client, club))
      .replace(/{{vencimento_cr}}/g, obterValorPlaceholder('vencimento_cr', client, club))
      .replace(/{{clube_nome}}/g, obterValorPlaceholder('clube_nome', client, club))
      .replace(/{{clube_cnpj}}/g, obterValorPlaceholder('clube_cnpj', client, club))
      .replace(/{{clube_cr}}/g, obterValorPlaceholder('clube_cr', client, club))
      .replace(/{{clube_cr_validade}}/g, obterValorPlaceholder('clube_cr_validade', client, club))
      .replace(/{{clube_endereco}}/g, obterValorPlaceholder('clube_endereco', client, club))
      .replace(/{{clube_filiacao_num}}/g, obterValorPlaceholder('clube_filiacao_num', client, club))
      .replace(/{{clube_filiacao_data}}/g, obterValorPlaceholder('clube_filiacao_data', client, club));
  };

  // Atualizar texto editado quando mudar o modelo ou dados do cliente/clube
  useEffect(() => {
    if (modeloSelecionado) {
      setTituloManual(modeloSelecionado.titulo);
      
      let textoBase = modeloSelecionado.texto;
      // Auto-upgrade old seeded template if it doesn't have the new placeholders
      if (
        modeloSelecionado.titulo === 'DECLARAÇÃO DE COMPROMISSO DE PARTICIPAÇÃO EM TREINAMENTOS E COMPETIÇÕES' &&
        !textoBase.includes('{{clube_cnpj}}')
      ) {
        textoBase = `DADOS DA ENTIDADE DE TIRO DECLARANTE
Nome: {{clube_nome}}
CNPJ: {{clube_cnpj}}
Certificado de Registro: {{clube_cr}} (Vencimento: {{clube_cr_validade}})
Endereço: {{clube_endereco}}

DADOS DO ATIRADOR DESPORTIVO
Nome: {{nome}}
CPF: {{cpf}}
Certificado de Registro: {{numero_cr}} (Vencimento: {{vencimento_cr}})
Endereço: {{endereco}}

FILIAÇÃO À ENTIDADE DE TIRO
Número: {{clube_filiacao_num}}
Data: {{clube_filiacao_data}}

COMPROMISSO
Eu, {{nome}}, portador do CPF nº {{cpf}}, residente no endereço {{endereco}}, portador do RG nº {{rg}}, filiado à Entidade de Tiro acima nomeada, ME COMPROMETO a comprovar, no mínimo, a habitualidade e a participação em treinamentos e competições na forma prevista na legislação vigente (Art. 35 do Decreto nº 11.615/2023).

Por ser expressão da verdade, firmo o presente compromisso.`;
      }
      
      setTextoEditado(processarPlaceholders(textoBase, dadosCliente, dadosClube));
    } else {
      setTituloManual('');
      setTextoEditado('');
    }
  }, [modeloSelecionadoId, clienteSelecionadoId, dadosCliente, dadosClube, modelos]);

  // Verificar campos faltantes no cliente
  const camposFaltantes = useMemo(() => {
    if (!clienteSelecionado) return [];
    const faltantes = [];
    if (!clienteSelecionado.rg) faltantes.push('RG');
    if (!clienteSelecionado.dataNascimento) faltantes.push('Data de Nascimento');
    if (!clienteSelecionado.nomePai) faltantes.push('Nome do Pai');
    if (!clienteSelecionado.nomeMae) faltantes.push('Nome da Mãe');
    if (!clienteSelecionado.endereco) faltantes.push('Endereço');
    return faltantes;
  }, [clienteSelecionado]);

  const handleCopiarTexto = () => {
    if (!textoEditado) return;
    navigator.clipboard.writeText(`${tituloManual.toUpperCase()}\n\n${textoEditado}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleGerarPdf = async () => {
    if (!textoEditado || !tituloManual || !clienteSelecionado) return;
    setGerandoPdf(true);
    try {
      const blob = await gerarPdfDeclaracaoBlob(tituloManual, textoEditado, clienteSelecionado.nome);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tituloManual.replace(/\s+/g, '_')}_${clienteSelecionado.nome.replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar arquivo PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleSalvarDadosNoCadastro = async () => {
    if (!clienteSelecionadoId || clienteSelecionadoId === 'avulso') return;
    setSalvandoDadosCliente(true);
    try {
      await atualizarCliente(clienteSelecionadoId, {
        nome: dadosCliente.nome.trim(),
        cpf: dadosCliente.cpf.trim(),
        rg: dadosCliente.rg.trim(),
        dataNascimento: dadosCliente.dataNascimento,
        nomePai: dadosCliente.nomePai.trim(),
        nomeMae: dadosCliente.nomeMae.trim(),
        endereco: dadosCliente.endereco.trim(),
        numeroCr: dadosCliente.numeroCr.trim(),
        vencimentoCr: dadosCliente.vencimentoCr,
        clubeFiliado: dadosCliente.clubeFiliado.trim(),
      });
      alert('Dados do cliente salvos com sucesso no cadastro!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar os dados do cliente no cadastro.');
    } finally {
      setSalvandoDadosCliente(false);
    }
  };

  const handleSalvarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeloEditando?.titulo || !modeloEditando?.texto) {
      alert('Preencha título e texto do modelo.');
      return;
    }
    setSalvandoModelo(true);
    try {
      await salvarModeloDeclaracao({
        id: modeloEditando.id,
        titulo: modeloEditando.titulo.trim().toUpperCase(),
        texto: modeloEditando.texto.trim()
      });
      setModeloEditando(null);
      await carregarModelos();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar modelo.');
    } finally {
      setSalvandoModelo(false);
    }
  };

  const handleDeletarModelo = async (id: string) => {
    if (confirm('Excluir este modelo de declaração permanentemente?')) {
      try {
        await deletarModeloDeclaracao(id);
        if (modeloSelecionadoId === id) {
          setModeloSelecionadoId('');
        }
        await carregarModelos();
      } catch (err) {
        console.error(err);
        alert('Erro ao deletar modelo.');
      }
    }
  };

  const inserirPlaceholderNoModelo = (tag: string) => {
    if (!modeloEditando) return;
    const text = modeloEditando.texto || '';
    setModeloEditando({
      ...modeloEditando,
      texto: text + ` {{${tag}}}`
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-brand-blue" /> Gerador de Declarações
          </h1>
          <p className="text-sm text-gray-400">Gere e emita declarações e termos oficiais com dados automatizados do acervo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-brand-dark-3 border border-brand-dark-5 rounded-xl w-fit">
        <button
          onClick={() => setAbaAtiva('gerar')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
            abaAtiva === 'gerar' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Sparkles size={14} />
          Gerar Declaração
        </button>
        <button
          onClick={() => setAbaAtiva('modelos')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
            abaAtiva === 'modelos' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Edit3 size={14} />
          Modelos Disponíveis
        </button>
      </div>

      {/* Content */}
      {abaAtiva === 'gerar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Parâmetros do Documento */}
          <div className="card space-y-4 lg:col-span-1">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Parâmetros</h3>
            
            {/* Selecionar Cliente */}
            <div>
              <label className="label">1. Selecione o Cliente</label>
              <select
                className="input font-medium"
                value={clienteSelecionadoId}
                onChange={e => setClienteSelecionadoId(e.target.value)}
              >
                <option value="">Selecione um cliente...</option>
                <option value="avulso" className="text-brand-blue font-semibold">
                  [Pessoa não cadastrada / Avulsa]
                </option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Selecionar Modelo */}
            <div>
              <label className="label">2. Selecione o Modelo de Declaração</label>
              <select
                className="input"
                value={modeloSelecionadoId}
                disabled={carregandoModelos}
                onChange={e => setModeloSelecionadoId(e.target.value)}
              >
                <option value="">
                  {carregandoModelos ? 'Carregando modelos...' : 'Selecione um modelo...'}
                </option>
                {modelos.map(m => (
                  <option key={m.id} value={m.id}>{m.titulo}</option>
                ))}
              </select>
            </div>

            {/* Alerta de dados em falta */}
            {clienteSelecionado && camposFaltantes.length > 0 && (
              <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl space-y-2">
                <div className="flex items-start gap-2.5 text-yellow-400">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Atenção! Faltam dados no cadastro:</p>
                    <p className="text-gray-400 mt-1">
                      Os seguintes campos estão vazios no perfil do cliente e aparecerão em branco no documento:
                      <span className="font-semibold text-yellow-300 block mt-0.5">• {camposFaltantes.join(', ')}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Formulário de Dados para Declaração (Editável na hora) */}
            {clienteSelecionado && (
              <div className="p-3.5 bg-brand-dark-4 border border-brand-dark-5 rounded-xl space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-brand-dark-5 pb-2">
                  <User size={12} className="text-brand-blue" />
                  {clienteSelecionadoId === 'avulso' ? 'Dados da Pessoa (Avulsa)' : 'Dados do Cliente (Editável)'}
                </p>
                
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="NOME COMPLETO"
                      className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                      value={dadosCliente.nome}
                      onChange={e => setDadosCliente(prev => ({ ...prev, nome: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">CPF</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                        value={dadosCliente.cpf}
                        onChange={e => setDadosCliente(prev => ({ ...prev, cpf: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">RG</label>
                      <input
                        type="text"
                        placeholder="RG / Órgão Expedidor"
                        className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                        value={dadosCliente.rg}
                        onChange={e => setDadosCliente(prev => ({ ...prev, rg: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Data de Nascimento</label>
                    <input
                      type="date"
                      className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                      value={dadosCliente.dataNascimento}
                      onChange={e => setDadosCliente(prev => ({ ...prev, dataNascimento: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nº do CR</label>
                      <input
                        type="text"
                        placeholder="Nº DO CR"
                        className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                        value={dadosCliente.numeroCr}
                        onChange={e => setDadosCliente(prev => ({ ...prev, numeroCr: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Vencimento do CR</label>
                      <input
                        type="date"
                        className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                        value={dadosCliente.vencimentoCr}
                        onChange={e => setDadosCliente(prev => ({ ...prev, vencimentoCr: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Clube de Tiro Filiado</label>
                    <input
                      type="text"
                      placeholder="NOME DO CLUBE"
                      className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                      value={dadosCliente.clubeFiliado}
                      onChange={e => setDadosCliente(prev => ({ ...prev, clubeFiliado: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome do Pai</label>
                    <input
                      type="text"
                      placeholder="NOME DO PAI (OPCIONAL)"
                      className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                      value={dadosCliente.nomePai}
                      onChange={e => setDadosCliente(prev => ({ ...prev, nomePai: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome da Mãe</label>
                    <input
                      type="text"
                      placeholder="NOME DA MÃE"
                      className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                      value={dadosCliente.nomeMae}
                      onChange={e => setDadosCliente(prev => ({ ...prev, nomeMae: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Endereço Completo</label>
                    <textarea
                      placeholder="RUA, NÚMERO, BAIRRO, CIDADE - UF"
                      className="input py-1.5 px-2.5 text-xs font-semibold mt-1 h-16 resize-none leading-normal"
                      value={dadosCliente.endereco}
                      onChange={e => setDadosCliente(prev => ({ ...prev, endereco: e.target.value }))}
                    />
                  </div>
                </div>

                {clienteSelecionadoId && clienteSelecionadoId !== 'avulso' && (
                  <button
                    type="button"
                    disabled={salvandoDadosCliente}
                    onClick={handleSalvarDadosNoCadastro}
                    className="w-full mt-2 btn-primary py-2 text-xs flex items-center justify-center gap-1.5 bg-brand-blue/80 hover:bg-brand-blue transition-all"
                  >
                    {salvandoDadosCliente ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Salvando dados...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Salvar no Cadastro
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Formulário de Dados do Clube de Tiro de Vinculação */}
            {clienteSelecionado && exigeDadosClube && (
              <div className="p-3.5 bg-brand-dark-4 border border-brand-dark-5 rounded-xl space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-brand-dark-5 pb-2">
                  <Sparkles size={12} className="text-brand-blue" />
                  Dados da Entidade de Tiro (Clube)
                </p>
                
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome do Clube de Tiro</label>
                    <input
                      type="text"
                      placeholder="CLUBE DE TIRO"
                      className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                      value={dadosClube.nome}
                      onChange={e => setDadosClube(prev => ({ ...prev, nome: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">CNPJ</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0000-00"
                        className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                        value={dadosClube.cnpj}
                        onChange={e => setDadosClube(prev => ({ ...prev, cnpj: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">CR da Entidade</label>
                      <input
                        type="text"
                        placeholder="CR ENTIDADE"
                        className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                        value={dadosClube.cr}
                        onChange={e => setDadosClube(prev => ({ ...prev, cr: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Vencimento do CR do Clube</label>
                      <input
                        type="date"
                        className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                        value={dadosClube.crValidade}
                        onChange={e => setDadosClube(prev => ({ ...prev, crValidade: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Endereço do Clube</label>
                    <textarea
                      placeholder="ENDEREÇO DO CLUBE"
                      className="input py-1.5 px-2.5 text-xs font-semibold mt-1 h-14 resize-none leading-normal"
                      value={dadosClube.endereco}
                      onChange={e => setDadosClube(prev => ({ ...prev, endereco: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nº de Filiação</label>
                      <input
                        type="text"
                        placeholder="FILIAÇÃO Nº"
                        className="input py-1.5 px-2.5 text-xs font-semibold uppercase mt-1"
                        value={dadosClube.filiacaoNum}
                        onChange={e => setDadosClube(prev => ({ ...prev, filiacaoNum: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Data de Filiação</label>
                      <input
                        type="date"
                        className="input py-1.5 px-2.5 text-xs font-semibold mt-1"
                        value={dadosClube.filiacaoData}
                        onChange={e => setDadosClube(prev => ({ ...prev, filiacaoData: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Editor e Preview de Texto */}
          <div className="card space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Editor do Documento</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopiarTexto}
                  disabled={!textoEditado}
                  className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5"
                  title="Copiar Texto Formatado"
                >
                  {copiado ? <Check size={14} className="text-brand-green" /> : <Copy size={14} />}
                  {copiado ? 'Copiado!' : 'Copiar Texto'}
                </button>
                <button
                  onClick={handleGerarPdf}
                  disabled={!textoEditado || !clienteSelecionado || gerandoPdf}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <Download size={14} />
                  {gerandoPdf ? 'Gerando...' : 'Gerar PDF'}
                </button>
              </div>
            </div>

            {modeloSelecionado ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Título da Declaração (Editável)</label>
                  <input
                    type="text"
                    className="input uppercase font-bold"
                    value={tituloManual}
                    onChange={e => setTituloManual(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Corpo do Texto (Edite livremente antes de gerar o PDF)</label>
                  <textarea
                    className="input h-[450px] font-mono text-xs py-3 leading-relaxed focus:ring-0 resize-y"
                    value={textoEditado}
                    onChange={e => setTextoEditado(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
                <FileText size={48} className="text-brand-dark-5 mb-3" />
                <p className="font-semibold text-gray-400">Selecione um cliente e um modelo de declaração</p>
                <p className="text-xs text-gray-600 mt-1 max-w-sm">
                  Escolha as opções no painel esquerdo para carregar o modelo e autocompletar com os dados cadastrados.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tela de Modelos */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Lista de Modelos Cadastrados */}
          <div className="card space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Modelos</h3>
              <button
                onClick={() => setModeloEditando({ titulo: '', texto: '' })}
                className="btn-primary py-1 px-2.5 text-[10px] uppercase font-bold flex items-center gap-1"
              >
                <Plus size={12} /> Novo Modelo
              </button>
            </div>

            {carregandoModelos ? (
              <div className="flex justify-center py-6">
                <RefreshCw size={20} className="animate-spin text-brand-blue" />
              </div>
            ) : modelos.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Nenhum modelo cadastrado.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {modelos.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setModeloEditando(m)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      modeloEditando?.id === m.id
                        ? 'bg-brand-blue/10 border-brand-blue text-white'
                        : 'bg-brand-dark-3/50 border-brand-dark-5 text-gray-400 hover:bg-brand-dark-3 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{m.titulo}</p>
                    <p className="text-[10px] text-gray-500 mt-1 truncate">{m.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor/Form de Modelo */}
          <div className="card space-y-4 lg:col-span-2">
            {modeloEditando ? (
              <form onSubmit={handleSalvarModelo} className="space-y-4">
                <div className="flex items-center justify-between border-b border-brand-dark-5 pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {modeloEditando.id ? 'Editar Modelo' : 'Cadastrar Novo Modelo'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModeloEditando(null)}
                      className="btn-ghost py-1 px-3 text-xs"
                    >
                      Cancelar
                    </button>
                    {modeloEditando.id && (
                      <button
                        type="button"
                        onClick={() => handleDeletarModelo(modeloEditando.id!)}
                        className="btn-ghost border-red-500/30 text-red-400 hover:bg-red-500/10 py-1 px-3 text-xs flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={salvandoModelo}
                      className="btn-primary py-1 px-3 text-xs"
                    >
                      {salvandoModelo ? 'Salvando...' : 'Salvar Modelo'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Form fields */}
                  <div className="md:col-span-3 space-y-4">
                    <div>
                      <label className="label label-required">Título do Modelo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: DECLARAÇÃO DE IDONEIDADE"
                        className="input uppercase font-bold"
                        value={modeloEditando.titulo || ''}
                        onChange={e => setModeloEditando({ ...modeloEditando, titulo: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="label label-required">Corpo do Texto</label>
                      <textarea
                        required
                        placeholder="Redija o texto utilizando os placeholders para autocompletar com dados dos clientes..."
                        className="input h-[380px] font-mono text-xs py-3 leading-relaxed"
                        value={modeloEditando.texto || ''}
                        onChange={e => setModeloEditando({ ...modeloEditando, texto: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Variables Helper Panel */}
                  <div className="md:col-span-1 p-4 bg-brand-dark-4 border border-brand-dark-5 rounded-xl h-fit space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-brand-dark-5 pb-2">
                      Variáveis Dinâmicas
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Clique em uma variável para inseri-la no final do texto do modelo:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { key: 'nome', label: 'Nome Completo' },
                        { key: 'rg', label: 'RG do Cliente' },
                        { key: 'cpf', label: 'CPF do Cliente' },
                        { key: 'endereco', label: 'Endereço Completo' },
                        { key: 'nome_pai', label: 'Nome do Pai' },
                        { key: 'nome_mae', label: 'Nome da Mãe' },
                        { key: 'data_nascimento', label: 'Data de Nascimento' },
                        { key: 'data_atual', label: 'Data Atual (por extenso)' },
                        { key: 'numero_cr', label: 'CR do Cliente' },
                        { key: 'vencimento_cr', label: 'Vencimento do CR do Cliente' },
                        { key: 'clube_nome', label: 'Nome do Clube' },
                        { key: 'clube_cnpj', label: 'CNPJ do Clube' },
                        { key: 'clube_cr', label: 'CR do Clube' },
                        { key: 'clube_cr_validade', label: 'Vencimento CR do Clube' },
                        { key: 'clube_endereco', label: 'Endereço do Clube' },
                        { key: 'clube_filiacao_num', label: 'Nº Filiação Clube' },
                        { key: 'clube_filiacao_data', label: 'Data Filiação Clube' }
                      ].map(v => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => inserirPlaceholderNoModelo(v.key)}
                          className="px-2.5 py-1.5 bg-brand-dark-3 hover:bg-brand-blue/20 border border-brand-dark-5 hover:border-brand-blue/40 text-gray-300 hover:text-white rounded-lg text-left text-xs transition-all flex items-center gap-1.5 font-medium shadow-sm cursor-pointer"
                        >
                          <Plus size={12} className="text-brand-blue" />
                          <span>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500">
                <Edit3 size={48} className="text-brand-dark-5 mb-3" />
                <p className="font-semibold text-gray-400">Selecione um modelo para editar</p>
                <p className="text-xs text-gray-600 mt-1">
                  Ou clique em "Novo Modelo" para redigir uma nova declaração personalizada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
