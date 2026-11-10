import React, { useState, useEffect } from 'react';
import {
  X, Camera, QrCode, Upload, DollarSign, User, Shield, Crosshair,
  PackageCheck, HelpCircle, Check, Trash2, Star, AlertTriangle, ArrowRight
} from 'lucide-react';
import { ArmaVenda, Cliente, Arma } from '../../types';
import { useClientes } from '../../context/ClientesContext';
import { CATALOGO_BASE_ARMAS } from '../../data/catalogoArmas';
import { ModalUploadCelular } from '../common/ModalUploadCelular';
import { formatarMoeda } from '../../utils/formatters';

interface ModalFormArmaVendaProps {
  armaParaEditar?: ArmaVenda | null;
  isOpen: boolean;
  onClose: () => void;
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalFormArmaVenda({
  armaParaEditar,
  isOpen,
  onClose,
  onSalvar
}: ModalFormArmaVendaProps) {
  const { clientes } = useClientes();

  // Estados do Proprietário
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');
  const [buscaCliente, setBuscaCliente] = useState<string>('');
  const [proprietarioNome, setProprietarioNome] = useState<string>('');
  const [proprietarioTelefone, setProprietarioTelefone] = useState<string>('');
  const [proprietarioCpf, setProprietarioCpf] = useState<string>('');
  const [proprietarioCr, setProprietarioCr] = useState<string>('');

  // Armas do acervo do cliente selecionado
  const [armasDoCliente, setArmasDoCliente] = useState<Arma[]>([]);

  // Características da Arma
  const [tipo, setTipo] = useState<string>('PISTOLA');
  const [fabricante, setFabricante] = useState<string>('');
  const [modelo, setModelo] = useState<string>('');
  const [calibre, setCalibre] = useState<string>('');
  const [numeroSerie, setNumeroSerie] = useState<string>('');
  const [sigmaSinarm, setSigmaSinarm] = useState<'SIGMA' | 'SINARM' | 'OUTRO'>('SIGMA');
  const [numeroCraf, setNumeroCraf] = useState<string>('');
  const [crafValidade, setCrafValidade] = useState<string>('');
  const [capacidade, setCapacidade] = useState<string>('');
  const [acabamento, setAcabamento] = useState<string>('');
  const [comprimentoCano, setComprimentoCano] = useState<string>('');
  const [estadoConservacao, setEstadoConservacao] = useState<string>('Excelente / Pouco Uso');
  const [quantidadeCarregadores, setQuantidadeCarregadores] = useState<number>(1);
  const [acessorios, setAcessorios] = useState<string>('');
  const [localArma, setLocalArma] = useState<'proprietario' | 'loja_custodia'>('proprietario');
  const [observacoesInternas, setObservacoesInternas] = useState<string>('');

  // Galeria de Fotos
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoPrincipal, setFotoPrincipal] = useState<string>('');
  const [modalQrAberto, setModalQrAberto] = useState<boolean>(false);

  // Valores & Comissão
  const [valorCliente, setValorCliente] = useState<number>(0);
  const [comissaoTipo, setComissaoTipo] = useState<'percentual' | 'fixo'>('percentual');
  const [comissaoValor, setComissaoValor] = useState<number>(10); // Padrão 10%
  const [valorAnunciado, setValorAnunciado] = useState<number>(0);
  const [lucroEstimado, setLucroEstimado] = useState<number>(0);

  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar dados para edição ou resetar
  useEffect(() => {
    if (armaParaEditar) {
      setClienteSelecionadoId(armaParaEditar.clienteId || '');
      setProprietarioNome(armaParaEditar.proprietarioNome || '');
      setProprietarioTelefone(armaParaEditar.proprietarioTelefone || '');
      setProprietarioCpf(armaParaEditar.proprietarioCpf || '');
      setProprietarioCr(armaParaEditar.proprietarioCr || '');
      setTipo(armaParaEditar.tipo || 'PISTOLA');
      setFabricante(armaParaEditar.fabricante || '');
      setModelo(armaParaEditar.modelo || '');
      setCalibre(armaParaEditar.calibre || '');
      setNumeroSerie(armaParaEditar.numeroSerie || '');
      setSigmaSinarm((armaParaEditar.sigmaSinarm as any) || 'SIGMA');
      setNumeroCraf(armaParaEditar.numeroCraf || '');
      setCrafValidade(armaParaEditar.crafValidade || '');
      setCapacidade(armaParaEditar.capacidade || '');
      setAcabamento(armaParaEditar.acabamento || '');
      setComprimentoCano(armaParaEditar.comprimentoCano || '');
      setEstadoConservacao(armaParaEditar.estadoConservacao || 'Excelente / Pouco Uso');
      setQuantidadeCarregadores(armaParaEditar.quantidadeCarregadores ?? 1);
      setAcessorios(armaParaEditar.acessorios || '');
      setLocalArma(armaParaEditar.localArma || 'proprietario');
      setObservacoesInternas(armaParaEditar.observacoesInternas || '');
      setFotos(armaParaEditar.fotos || []);
      setFotoPrincipal(armaParaEditar.fotoPrincipal || (armaParaEditar.fotos?.[0] || ''));
      setValorCliente(armaParaEditar.valorCliente || 0);
      setComissaoTipo(armaParaEditar.comissaoTipo || 'percentual');
      setComissaoValor(armaParaEditar.comissaoValor || 10);
      setValorAnunciado(armaParaEditar.valorAnunciado || 0);
      setLucroEstimado(armaParaEditar.lucroEstimado || 0);
    } else {
      // Resetar para novo cadastro
      setClienteSelecionadoId('');
      setBuscaCliente('');
      setProprietarioNome('');
      setProprietarioTelefone('');
      setProprietarioCpf('');
      setProprietarioCr('');
      setTipo('PISTOLA');
      setFabricante('');
      setModelo('');
      setCalibre('');
      setNumeroSerie('');
      setSigmaSinarm('SIGMA');
      setNumeroCraf('');
      setCrafValidade('');
      setCapacidade('');
      setAcabamento('');
      setComprimentoCano('');
      setEstadoConservacao('Excelente / Pouco Uso');
      setQuantidadeCarregadores(1);
      setAcessorios('');
      setLocalArma('proprietario');
      setObservacoesInternas('');
      setFotos([]);
      setFotoPrincipal('');
      setValorCliente(0);
      setComissaoTipo('percentual');
      setComissaoValor(10);
      setValorAnunciado(0);
      setLucroEstimado(0);
    }
  }, [armaParaEditar, isOpen]);

  // Atualizar cliente selecionado
  const selecionarCliente = (c: Cliente) => {
    setClienteSelecionadoId(c.id);
    setProprietarioNome(c.nome);
    setProprietarioTelefone(c.contato || '');
    setProprietarioCpf(c.cpf || '');
    setProprietarioCr(c.numeroCr || '');
    setBuscaCliente('');

    // Se o cliente tiver acervo (armas já cadastradas), carrega
    const armas = (c as any).armas || [];
    setArmasDoCliente(armas);
  };

  // Preencher dados da arma a partir do acervo do cliente
  const importarArmaDoAcervo = (arma: Arma) => {
    if (arma.tipo) setTipo(arma.tipo.toUpperCase());
    if (arma.fabricante) setFabricante(arma.fabricante.toUpperCase());
    if (arma.modelo) setModelo(arma.modelo.toUpperCase());
    if (arma.calibre) setCalibre(arma.calibre.toUpperCase());
    if (arma.numeroSerie) setNumeroSerie(arma.numeroSerie);
    if (arma.numeroSigma) {
      setNumeroCraf(arma.numeroSigma);
      setSigmaSinarm('SIGMA');
    }
    if (arma.vencimentoCraf) setCrafValidade(arma.vencimentoCraf);
  };

  // Autocomplete quando o usuário seleciona Modelo no Catálogo Base
  const handleSelecionarModeloCatalogo = (modeloNome: string) => {
    setModelo(modeloNome);
    const item = CATALOGO_BASE_ARMAS.find(
      i => i.modelo.toUpperCase() === modeloNome.toUpperCase()
    );
    if (item) {
      if (item.fabricante) setFabricante(item.fabricante);
      if (item.tipo) setTipo(item.tipo);
      if (item.calibrePadrao) setCalibre(item.calibrePadrao);
    }
  };

  // Recálculo dinâmico de comissão e preço anunciado
  const recalcularValores = (
    baseCliente: number,
    tipoComissao: 'percentual' | 'fixo',
    valComissao: number
  ) => {
    let final = 0;
    let lucro = 0;

    if (tipoComissao === 'percentual') {
      lucro = (baseCliente * valComissao) / 100;
      final = baseCliente + lucro;
    } else {
      lucro = valComissao;
      final = baseCliente + valComissao;
    }

    setValorAnunciado(Math.round(final));
    setLucroEstimado(Math.round(lucro));
  };

  const handleMudarValorCliente = (v: number) => {
    setValorCliente(v);
    recalcularValores(v, comissaoTipo, comissaoValor);
  };

  const handleMudarComissaoTipo = (tipoCom: 'percentual' | 'fixo') => {
    setComissaoTipo(tipoCom);
    const novoValorPadrao = tipoCom === 'percentual' ? 10 : 500;
    setComissaoValor(novoValorPadrao);
    recalcularValores(valorCliente, tipoCom, novoValorPadrao);
  };

  const handleMudarComissaoValor = (v: number) => {
    setComissaoValor(v);
    recalcularValores(valorCliente, comissaoTipo, v);
  };

  // Se o usuário editar diretamente o Valor Anunciado (Ajuste Manual Direto)
  const handleAjustarValorAnunciadoManual = (valorDigitado: number) => {
    setValorAnunciado(valorDigitado);
    const lucro = Math.max(0, valorDigitado - valorCliente);
    setLucroEstimado(lucro);

    if (valorCliente > 0) {
      const perc = (lucro / valorCliente) * 100;
      setComissaoValor(Number(perc.toFixed(1)));
    }
  };

  // Fotos Upload
  const handleUploadArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFotos(prev => {
            const novas = [...prev, reader.result as string];
            if (!fotoPrincipal) setFotoPrincipal(reader.result as string);
            return novas;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removerFoto = (index: number) => {
    const fotoRemovida = fotos[index];
    const novasFotos = fotos.filter((_, i) => i !== index);
    setFotos(novasFotos);
    if (fotoPrincipal === fotoRemovida) {
      setFotoPrincipal(novasFotos[0] || '');
    }
  };

  const definirFotoPrincipal = (url: string) => {
    setFotoPrincipal(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proprietarioNome.trim()) {
      setErro('O nome do proprietário é obrigatório.');
      return;
    }
    if (!fabricante.trim() || !modelo.trim() || !calibre.trim()) {
      setErro('Fabricante, modelo e calibre são obrigatórios.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      const dadosParaSalvar = {
        clienteId: clienteSelecionadoId || undefined,
        proprietarioNome,
        proprietarioTelefone,
        proprietarioCpf,
        proprietarioCr,
        tipo,
        fabricante,
        modelo,
        calibre,
        numeroSerie,
        sigmaSinarm,
        numeroCraf,
        crafValidade,
        capacidade,
        acabamento,
        comprimentoCano,
        estadoConservacao,
        quantidadeCarregadores,
        acessorios,
        localArma,
        fotos,
        fotoPrincipal: fotoPrincipal || (fotos[0] || ''),
        valorCliente,
        comissaoTipo,
        comissaoValor,
        valorAnunciado,
        lucroEstimado,
        status: armaParaEditar ? armaParaEditar.status : 'disponivel',
        observacoesInternas
      };

      await onSalvar(dadosParaSalvar);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar arma à venda.');
    } finally {
      setSalvando(false);
    }
  };

  // Clientes filtrados para a busca rápida
  const clientesFiltrados = buscaCliente.trim().length >= 2
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        c.cpf.includes(buscaCliente)
      ).slice(0, 5)
    : [];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
        <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-8">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-dark-5 bg-brand-dark-3/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Crosshair size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {armaParaEditar ? 'Editar Arma à Venda' : 'Cadastrar Nova Arma para Venda'}
                </h2>
                <p className="text-xs text-gray-400">
                  Insira as fotos, especificações, proprietário e margem de comissão da loja
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-brand-dark-4 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {erro && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{erro}</span>
              </div>
            )}

            {/* SEÇÃO 1: PROPRIETÁRIO DA ARMA */}
            <div className="bg-brand-dark-3/40 border border-brand-dark-5 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-amber-400" /> 1. Proprietário Atual da Arma
                </span>
                {clienteSelecionadoId && (
                  <button
                    type="button"
                    onClick={() => {
                      setClienteSelecionadoId('');
                      setProprietarioNome('');
                      setProprietarioTelefone('');
                      setProprietarioCpf('');
                      setProprietarioCr('');
                      setArmasDoCliente([]);
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Desvincular Cliente
                  </button>
                )}
              </div>

              {/* Busca rápida de cliente existente */}
              {!clienteSelecionadoId && (
                <div className="relative">
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={e => setBuscaCliente(e.target.value)}
                    placeholder="🔍 Buscar cliente já cadastrado por nome ou CPF..."
                    className="input w-full text-xs py-2 bg-brand-dark-1"
                  />
                  {clientesFiltrados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-brand-dark-1 border border-brand-dark-5 rounded-xl shadow-xl overflow-hidden divide-y divide-brand-dark-5">
                      {clientesFiltrados.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="w-full text-left p-2.5 hover:bg-brand-dark-3 text-xs text-gray-200 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold text-white block">{c.nome}</span>
                            <span className="text-[11px] text-gray-400">CPF: {c.cpf} {c.contato ? `• Tel: ${c.contato}` : ''}</span>
                          </div>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                            Selecionar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Campos do Dono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Nome do Proprietário *</label>
                  <input
                    type="text"
                    value={proprietarioNome}
                    onChange={e => setProprietarioNome(e.target.value)}
                    required
                    placeholder="Nome completo do dono"
                    className="input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={proprietarioTelefone}
                    onChange={e => setProprietarioTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">CPF do Dono</label>
                  <input
                    type="text"
                    value={proprietarioCpf}
                    onChange={e => setProprietarioCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              {/* Se o cliente selecionado tiver armas no acervo cadastrado */}
              {armasDoCliente.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 mt-2">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                    <PackageCheck size={14} /> Armas no Acervo deste Cliente (Clique para preencher automático):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {armasDoCliente.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => importarArmaDoAcervo(a)}
                        className="text-xs bg-brand-dark-3 hover:bg-brand-dark-4 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        <span>{a.fabricante} {a.modelo} ({a.calibre})</span>
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: CARACTERÍSTICAS DA ARMA */}
            <div className="bg-brand-dark-3/40 border border-brand-dark-5 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair size={14} className="text-amber-400" /> 2. Especificações da Arma
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Tipo */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Tipo de Arma</label>
                  <select
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="PISTOLA">Pistola</option>
                    <option value="REVÓLVER">Revólver</option>
                    <option value="ESPINGARDA">Espingarda</option>
                    <option value="CARABINA">Carabina</option>
                    <option value="RIFLE">Rifle</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                {/* Fabricante */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Fabricante / Marca *</label>
                  <input
                    type="text"
                    value={fabricante}
                    onChange={e => setFabricante(e.target.value.toUpperCase())}
                    required
                    placeholder="Ex: TAURUS, GLOCK, IMBEL"
                    className="input w-full text-xs"
                    list="marcas-sugestoes"
                  />
                  <datalist id="marcas-sugestoes">
                    <option value="TAURUS" />
                    <option value="GLOCK" />
                    <option value="IMBEL" />
                    <option value="CZ" />
                    <option value="CBC" />
                    <option value="BOITO" />
                    <option value="BERETTA" />
                    <option value="SMITH & WESSON" />
                    <option value="COLT" />
                    <option value="RUGER" />
                    <option value="SIG SAUER" />
                  </datalist>
                </div>

                {/* Modelo (com autocomplete do Catálogo) */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Modelo *</label>
                  <input
                    type="text"
                    value={modelo}
                    onChange={e => handleSelecionarModeloCatalogo(e.target.value.toUpperCase())}
                    required
                    placeholder="Ex: G3C, G19, MD2"
                    className="input w-full text-xs"
                    list="modelos-sugestoes"
                  />
                  <datalist id="modelos-sugestoes">
                    {CATALOGO_BASE_ARMAS.map((m, i) => (
                      <option key={i} value={m.modelo}>
                        {m.fabricante} - {m.calibrePadrao}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Calibre */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Calibre *</label>
                  <input
                    type="text"
                    value={calibre}
                    onChange={e => setCalibre(e.target.value.toUpperCase())}
                    required
                    placeholder="Ex: 9mm LUGER, .380 ACP"
                    className="input w-full text-xs"
                    list="calibres-sugestoes"
                  />
                  <datalist id="calibres-sugestoes">
                    <option value="9mm LUGER" />
                    <option value=".380 ACP" />
                    <option value=".40 S&W" />
                    <option value=".45 ACP" />
                    <option value=".38 SPL" />
                    <option value=".357 MAG" />
                    <option value=".22 LR" />
                    <option value="12 GA" />
                    <option value=".308 WIN" />
                    <option value=".223 REM" />
                  </datalist>
                </div>

                {/* Número de Série */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Nº de Série</label>
                  <input
                    type="text"
                    value={numeroSerie}
                    onChange={e => setNumeroSerie(e.target.value.toUpperCase())}
                    placeholder="Série da arma"
                    className="input w-full text-xs"
                  />
                </div>

                {/* Sistema */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Registro</label>
                  <select
                    value={sigmaSinarm}
                    onChange={e => setSigmaSinarm(e.target.value as any)}
                    className="input w-full text-xs"
                  >
                    <option value="SIGMA">SIGMA (Exército)</option>
                    <option value="SINARM">SINARM (Polícia Federal)</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                {/* Nº CRAF */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Nº do CRAF</label>
                  <input
                    type="text"
                    value={numeroCraf}
                    onChange={e => setNumeroCraf(e.target.value)}
                    placeholder="Nº registro CRAF"
                    className="input w-full text-xs"
                  />
                </div>

                {/* Capacidade */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Capacidade (Tiros)</label>
                  <input
                    type="text"
                    value={capacidade}
                    onChange={e => setCapacidade(e.target.value)}
                    placeholder="Ex: 12+1, 15+1, 6 tiros"
                    className="input w-full text-xs"
                  />
                </div>

                {/* Acabamento */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Acabamento</label>
                  <input
                    type="text"
                    value={acabamento}
                    onChange={e => setAcabamento(e.target.value)}
                    placeholder="Ex: Tênifer Fosco, Inox, Cerakote"
                    className="input w-full text-xs"
                  />
                </div>

                {/* Estado de Conservação */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Estado de Conservação</label>
                  <select
                    value={estadoConservacao}
                    onChange={e => setEstadoConservacao(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="Nova na Caixa (Sem Disparos)">Nova na Caixa (Sem Disparos)</option>
                    <option value="Excelente / Pouco Uso">Excelente / Pouco Uso</option>
                    <option value="Muito Bom">Muito Bom</option>
                    <option value="Bom (Marcas Normais de Coldre)">Bom (Marcas Normais de Coldre)</option>
                    <option value="Razoável">Razoável</option>
                  </select>
                </div>

                {/* Quantidade Carregadores */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Qtd. Carregadores</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={quantidadeCarregadores}
                    onChange={e => setQuantidadeCarregadores(Number(e.target.value))}
                    className="input w-full text-xs"
                  />
                </div>

                {/* Localização da Arma */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Onde está a arma?</label>
                  <select
                    value={localArma}
                    onChange={e => setLocalArma(e.target.value as any)}
                    className="input w-full text-xs"
                  >
                    <option value="proprietario">Na residência do proprietário</option>
                    <option value="loja_custodia">No cofre da loja / despachante</option>
                  </select>
                </div>

                {/* Acessórios Inclusos */}
                <div className="sm:col-span-2 md:col-span-4">
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Acessórios Inclusos no Pacote</label>
                  <input
                    type="text"
                    value={acessorios}
                    onChange={e => setAcessorios(e.target.value)}
                    placeholder="Ex: Maleta rígida original, 3 carregadores, mira fibra óptica, coldre kydex"
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: FOTOS DA ARMA (UPLOAD + QR CODE CELULAR) */}
            <div className="bg-brand-dark-3/40 border border-brand-dark-5 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-400" /> 3. Fotos da Arma ({fotos.length} adicionada(s))
                </span>

                <div className="flex items-center gap-2">
                  {/* Botão QR Code Celular */}
                  <button
                    type="button"
                    onClick={() => setModalQrAberto(true)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <QrCode size={14} /> Tirar Foto com o Celular (QR Code)
                  </button>

                  {/* Upload do Computador */}
                  <label className="flex items-center gap-1.5 text-xs font-bold bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-200 border border-brand-dark-5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                    <Upload size={14} /> Anexar Fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadArquivo}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Galeria de Fotos */}
              {fotos.length === 0 ? (
                <div className="border-2 border-dashed border-brand-dark-5 rounded-xl p-6 text-center text-gray-500 text-xs">
                  Nenhuma foto anexada ainda. Use o botão acima para enviar arquivos ou use o leitor de QR Code para bater fotos direto do celular!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {fotos.map((url, idx) => (
                    <div
                      key={idx}
                      className={`relative group rounded-xl overflow-hidden border-2 aspect-video bg-black/40 ${
                        fotoPrincipal === url ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-brand-dark-5'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />

                      {/* Overlay com Ações */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => definirFotoPrincipal(url)}
                          title="Definir como foto principal"
                          className="p-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                        >
                          <Star size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removerFoto(idx)}
                          title="Excluir foto"
                          className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {fotoPrincipal === url && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                          CAPA
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SEÇÃO 4: PREÇO, COMISSÃO E LUCRO (PADRÃO 10%, AJUSTÁVEL MANUALMENTE) */}
            <div className="bg-gradient-to-r from-amber-500/10 via-brand-dark-3/60 to-brand-dark-3/40 border border-amber-500/30 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} /> 4. Precificação e Comissão da Loja
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* 1. Valor que o cliente quer líquido */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                    Valor Pretendido pelo Proprietário (R$) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={valorCliente || ''}
                    onChange={e => handleMudarValorCliente(Number(e.target.value))}
                    required
                    placeholder="R$ 0,00"
                    className="input w-full text-sm font-bold text-white bg-brand-dark-1"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Valor líquido que será repassado ao dono
                  </span>
                </div>

                {/* 2. Comissão da Loja (Percentual padrão 10% ou Fixo) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-300">
                      Comissão da Loja
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleMudarComissaoTipo('percentual')}
                        className={`px-1.5 py-0.5 rounded ${comissaoTipo === 'percentual' ? 'bg-amber-500 text-black font-bold' : 'text-gray-400'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMudarComissaoTipo('fixo')}
                        className={`px-1.5 py-0.5 rounded ${comissaoTipo === 'fixo' ? 'bg-amber-500 text-black font-bold' : 'text-gray-400'}`}
                      >
                        R$
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={comissaoTipo === 'percentual' ? '0.5' : '50'}
                    value={comissaoValor || ''}
                    onChange={e => handleMudarComissaoValor(Number(e.target.value))}
                    className="input w-full text-sm font-bold text-amber-400 bg-brand-dark-1"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    {comissaoTipo === 'percentual' ? 'Padrão sugerido: 10%' : 'Valor fixo de corretagem'}
                  </span>
                </div>

                {/* 3. Valor Final de Anúncio (Editável manualmente se desejar) */}
                <div>
                  <label className="text-[11px] font-bold text-emerald-400 block mb-1">
                    Valor Anunciado de Venda (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={valorAnunciado || ''}
                    onChange={e => handleAjustarValorAnunciadoManual(Number(e.target.value))}
                    placeholder="R$ 0,00"
                    className="input w-full text-sm font-extrabold text-emerald-300 bg-brand-dark-1 border-emerald-500/40"
                  />
                  <span className="text-[10px] text-emerald-400/80 block mt-1 font-medium">
                    Lucro Previsto: +{formatarMoeda(lucroEstimado)}
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: OBSERVAÇÕES INTERNAS */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                Observações Internas (Visível somente para você e sua equipe)
              </label>
              <textarea
                value={observacoesInternas}
                onChange={e => setObservacoesInternas(e.target.value)}
                rows={2}
                placeholder="Ex: Cliente tem pressa para vender, aceita contraproposta de até R$ 3.800..."
                className="input w-full text-xs resize-none"
              />
            </div>

            {/* Footer Ações */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-dark-5">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-brand-dark-4 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2"
              >
                {salvando ? 'Salvando...' : armaParaEditar ? 'Salvar Alterações' : 'Cadastrar no Catálogo'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal QR Code Celular Integrado */}
      <ModalUploadCelular
        isOpen={modalQrAberto}
        onClose={() => setModalQrAberto(false)}
        titulo="Fotografar Arma com o Celular"
        onUploadSuccess={(url) => {
          setFotos(prev => {
            const novas = [...prev, url];
            if (!fotoPrincipal) setFotoPrincipal(url);
            return novas;
          });
          setModalQrAberto(false);
        }}
      />
    </>
  );
}
