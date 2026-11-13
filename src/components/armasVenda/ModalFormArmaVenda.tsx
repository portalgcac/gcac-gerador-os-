import React, { useState, useEffect } from 'react';
import {
  X, Camera, QrCode, Upload, DollarSign, User, Shield, Crosshair,
  PackageCheck, HelpCircle, Check, Trash2, Star, AlertTriangle, ArrowRight,
  ChevronLeft, ChevronRight, Plus
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
  const [tipoProprietario, setTipoProprietario] = useState<'cadastrado' | 'avulso'>('cadastrado');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');
  const [clienteSelecionadoObj, setClienteSelecionadoObj] = useState<Cliente | null>(null);
  const [buscaCliente, setBuscaCliente] = useState<string>('');
  const [proprietarioNome, setProprietarioNome] = useState<string>('');
  const [proprietarioTelefone, setProprietarioTelefone] = useState<string>('');
  const [proprietarioCpf, setProprietarioCpf] = useState<string>('');
  const [proprietarioCr, setProprietarioCr] = useState<string>('');

  // Armas do acervo do cliente selecionado
  const [armasDoCliente, setArmasDoCliente] = useState<Arma[]>([]);

  // Lista base de Tipos de Arma
  const TIPOS_ARMA_PADRAO = [
    'PISTOLA',
    'REVÓLVER',
    'ESPINGARDA',
    'CARABINA',
    'RIFLE',
    'FUZIL',
    'BALESTRA',
    'ARCO E FLECHA',
    'CARABINA DE PRESSÃO / PCP',
    'PISTOLETE',
    'OUTRO'
  ];

  // Características da Arma
  const [tipo, setTipo] = useState<string>('PISTOLA');
  const [tiposCustomizados, setTiposCustomizados] = useState<string[]>(() => {
    try {
      const salvo = localStorage.getItem('gcac_tipos_armas_venda');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });
  const [digitandoNovoTipo, setDigitandoNovoTipo] = useState<boolean>(false);
  const [novoTipoTexto, setNovoTipoTexto] = useState<string>('');

  const salvarNovoTipo = () => {
    const formatado = novoTipoTexto.trim().toUpperCase();
    if (!formatado) {
      setDigitandoNovoTipo(false);
      return;
    }
    if (!TIPOS_ARMA_PADRAO.includes(formatado) && !tiposCustomizados.includes(formatado)) {
      const novaLista = [...tiposCustomizados, formatado];
      setTiposCustomizados(novaLista);
      try {
        localStorage.setItem('gcac_tipos_armas_venda', JSON.stringify(novaLista));
      } catch (err) {
        console.warn('Erro ao salvar tipo no localStorage:', err);
      }
    }
    setTipo(formatado);
    setDigitandoNovoTipo(false);
    setNovoTipoTexto('');
  };
  const [fabricante, setFabricante] = useState<string>('');
  const [modelo, setModelo] = useState<string>('');
  const [calibre, setCalibre] = useState<string>('');
  const [numeroSerie, setNumeroSerie] = useState<string>('');
  const [sigmaSinarm, setSigmaSinarm] = useState<string>('SIGMA (CAC)');
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
      const tipoCarregado = (armaParaEditar.tipo || 'PISTOLA').toUpperCase();
      setTipo(tipoCarregado);
      if (!TIPOS_ARMA_PADRAO.includes(tipoCarregado) && !tiposCustomizados.includes(tipoCarregado)) {
        setTiposCustomizados(prev => [...prev, tipoCarregado]);
      }
      setFabricante(armaParaEditar.fabricante || '');
      setModelo(armaParaEditar.modelo || '');
      setCalibre(armaParaEditar.calibre || '');
      setNumeroSerie(armaParaEditar.numeroSerie || '');
      setSigmaSinarm(armaParaEditar.sigmaSinarm || 'SIGMA (CAC)');
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
      setSigmaSinarm('SIGMA (CAC)');
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
    setClienteSelecionadoObj(c);
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
      setSigmaSinarm('SIGMA (CAC)');
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

  // Função utilitária para comprimir e otimizar fotos da arma (reduz de 15MB para ~150KB)
  const otimizarImagemParaFoto = async (fonte: string | File): Promise<string> => {
    return new Promise((resolve) => {
      // Se for PDF (caso upload celular tenha compilado PDF), avisa ou tenta tratar
      if (typeof fonte === 'string' && (fonte.startsWith('data:application/pdf') || fonte.includes('.pdf'))) {
        alert('Atenção: Foi recebido um arquivo em PDF. Para o anúncio da arma, por favor tire fotos individuais em formato de imagem (JPEG/PNG).');
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(typeof fonte === 'string' ? fonte : '');
        }
      };

      img.onerror = () => {
        resolve(typeof fonte === 'string' ? fonte : '');
      };

      if (typeof fonte === 'string') {
        img.src = fonte;
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          img.src = reader.result as string;
        };
        reader.readAsDataURL(fonte);
      }
    });
  };

  // Fotos Upload
  const handleUploadArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const imagemComprimida = await otimizarImagemParaFoto(file);
      if (imagemComprimida) {
        setFotos(prev => {
          const novas = [...prev, imagemComprimida];
          if (!fotoPrincipal) setFotoPrincipal(imagemComprimida);
          return novas;
        });
      }
    }
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
    // Colocar a foto principal como primeira da lista para ser a capa do anúncio
    setFotos(prev => [url, ...prev.filter(f => f !== url)]);
  };

  const moverFoto = (idxOrigem: number, direcao: 'esquerda' | 'direita') => {
    const idxDestino = direcao === 'esquerda' ? idxOrigem - 1 : idxOrigem + 1;
    if (idxDestino < 0 || idxDestino >= fotos.length) return;
    const novasFotos = [...fotos];
    const temp = novasFotos[idxOrigem];
    novasFotos[idxOrigem] = novasFotos[idxDestino];
    novasFotos[idxDestino] = temp;
    setFotos(novasFotos);
    if (idxDestino === 0) {
      setFotoPrincipal(novasFotos[0]);
    }
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
            <div className="bg-brand-dark-3/60 border border-brand-dark-5 rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-dark-5/80 pb-3">
                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-amber-400" /> 1. Proprietário da Arma
                </span>

                {/* Alternador de Modo: Cliente Cadastrado vs Avulso */}
                <div className="flex items-center bg-brand-dark-1 p-1 rounded-xl border border-brand-dark-5">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoProprietario('cadastrado');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      tipoProprietario === 'cadastrado'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    👥 Cliente do Sistema
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoProprietario('avulso');
                      setClienteSelecionadoId('');
                      setClienteSelecionadoObj(null);
                      setArmasDoCliente([]);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      tipoProprietario === 'avulso'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ✍️ Cliente Avulso
                  </button>
                </div>
              </div>

              {/* MODO 1: CLIENTE CADASTRADO NO SISTEMA */}
              {tipoProprietario === 'cadastrado' && (
                <div className="space-y-3">
                  {/* Se o cliente ainda NÃO foi selecionado: Campo de Busca com Lista Clara */}
                  {!clienteSelecionadoId ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-300 block">
                        Pesquisar Cliente Cadastrado por Nome ou CPF
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={buscaCliente}
                          onChange={e => setBuscaCliente(e.target.value)}
                          placeholder="Digite as primeiras letras do nome ou CPF..."
                          className="input w-full text-xs py-2.5 bg-brand-dark-1 border-brand-dark-5 focus:border-amber-500 pl-3 pr-8"
                          autoFocus
                        />
                        {buscaCliente && (
                          <button
                            type="button"
                            onClick={() => setBuscaCliente('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Lista de Sugestões: Renderizada no fluxo (sem sobreposição feia) */}
                      {buscaCliente.trim().length >= 2 && (
                        <div className="bg-[#0b0e14] border border-amber-500/40 rounded-xl p-2 shadow-2xl space-y-1.5 animate-fade-in">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2 block">
                            Clientes Encontrados ({clientesFiltrados.length})
                          </span>

                          {clientesFiltrados.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">
                              Nenhum cliente encontrado com "{buscaCliente}".
                              <button
                                type="button"
                                onClick={() => {
                                  setTipoProprietario('avulso');
                                  setProprietarioNome(buscaCliente.toUpperCase());
                                }}
                                className="block mx-auto mt-2 text-amber-400 hover:underline font-bold text-[11px]"
                              >
                                Deseja cadastrar como cliente avulso?
                              </button>
                            </div>
                          ) : (
                            clientesFiltrados.map(c => (
                              <div
                                key={c.id}
                                className="p-2.5 rounded-lg bg-brand-dark-2 hover:bg-brand-dark-3 border border-brand-dark-5 flex items-center justify-between gap-3 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                                    {c.nome.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-white truncate">{c.nome}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                      <span>CPF: {c.cpf || 'Não informado'}</span>
                                      {c.contato && <span>• Tel: {c.contato}</span>}
                                      {c.numeroCr && <span>• CR: {c.numeroCr}</span>}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => selecionarCliente(c)}
                                  className="btn-primary px-3 py-1.5 text-[11px] font-bold shrink-0 flex items-center gap-1"
                                >
                                  <Check size={13} /> Selecionar
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Cliente Já Selecionado: Card Elegante e Limpo */
                    <div className="bg-gradient-to-r from-emerald-500/15 via-brand-dark-2 to-brand-dark-2 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                            {proprietarioNome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-extrabold text-white">{proprietarioNome}</h4>
                              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                ✓ Cliente Vinculado
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-300 mt-0.5">
                              <span><strong>CPF:</strong> {proprietarioCpf || 'Não informado'}</span>
                              <span><strong>Telefone:</strong> {proprietarioTelefone || 'Não informado'}</span>
                              {proprietarioCr && <span><strong>CR:</strong> {proprietarioCr}</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setClienteSelecionadoId('');
                            setClienteSelecionadoObj(null);
                            setProprietarioNome('');
                            setProprietarioTelefone('');
                            setProprietarioCpf('');
                            setProprietarioCr('');
                            setArmasDoCliente([]);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 transition-colors"
                        >
                          Trocar Cliente
                        </button>
                      </div>

                      {/* Se o cliente selecionado tiver armas no acervo cadastrado */}
                      {armasDoCliente.length > 0 && (
                        <div className="pt-2 border-t border-brand-dark-5/60 space-y-2">
                          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                            <PackageCheck size={14} /> Armas no Acervo deste Cliente (Clique para preencher automático):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {armasDoCliente.map(a => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => importarArmaDoAcervo(a)}
                                className="text-xs bg-brand-dark-3 hover:bg-brand-dark-4 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <span>{a.fabricante} {a.modelo} ({a.calibre})</span>
                                <ArrowRight size={12} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MODO 2: CLIENTE AVULSO (PREENCHIMENTO MANUAL DIRETO) */}
              {tipoProprietario === 'avulso' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-400">
                    Insira os dados do proprietário da arma manualmente abaixo:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Nome do Proprietário *</label>
                      <input
                        type="text"
                        value={proprietarioNome}
                        onChange={e => setProprietarioNome(e.target.value.toUpperCase())}
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
                </div>
              )}
            </div>

            {/* SEÇÃO 2: CARACTERÍSTICAS DA ARMA */}
            <div className="bg-brand-dark-3/40 border border-brand-dark-5 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair size={14} className="text-amber-400" /> 2. Especificações da Arma
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Tipo de Arma com suporte a cadastrar novo tipo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-gray-400 block">Tipo de Arma</label>
                    {!digitandoNovoTipo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDigitandoNovoTipo(true);
                          setNovoTipoTexto('');
                        }}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                      >
                        <Plus size={11} /> + Cadastrar Tipo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDigitandoNovoTipo(false)}
                        className="text-[10px] text-gray-400 hover:text-gray-200"
                      >
                        Voltar à lista
                      </button>
                    )}
                  </div>

                  {!digitandoNovoTipo ? (
                    <select
                      value={tipo}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__CADASTRAR_NOVO__') {
                          setDigitandoNovoTipo(true);
                          setNovoTipoTexto('');
                        } else {
                          setTipo(val);
                        }
                      }}
                      className="input w-full text-xs font-semibold"
                    >
                      <optgroup label="Tipos de Armas">
                        {TIPOS_ARMA_PADRAO.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                      {tiposCustomizados.length > 0 && (
                        <optgroup label="Seus Tipos Cadastrados">
                          {tiposCustomizados.map(t => (
                            <option key={t} value={t}>
                              ⭐ {t}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__CADASTRAR_NOVO__" className="font-bold text-amber-400">
                        + Digitar / Cadastrar Novo Tipo...
                      </option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5 animate-scale-up">
                      <input
                        type="text"
                        value={novoTipoTexto}
                        onChange={e => setNovoTipoTexto(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            salvarNovoTipo();
                          }
                        }}
                        autoFocus
                        placeholder="Ex: BALESTRA, FUZIL, PCP..."
                        className="input flex-1 text-xs uppercase font-bold text-amber-300 border-amber-500/50"
                      />
                      <button
                        type="button"
                        onClick={salvarNovoTipo}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shrink-0"
                        title="Salvar novo tipo"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDigitandoNovoTipo(false)}
                        className="p-1.5 rounded-lg bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-400 hover:text-white transition-all shrink-0"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
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

                {/* Sistema de Registro */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 block mb-1">Registro</label>
                  <select
                    value={sigmaSinarm}
                    onChange={e => setSigmaSinarm(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="SIGMA (CAC)">SIGMA (CAC)</option>
                    <option value="SINARM DEFESA">SINARM DEFESA</option>
                    <option value="SINARM (OUTRO)">SINARM (Outro / Funcional)</option>
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
                  Nenhuma foto anexada ainda. Use o botão acima para enviar arquivos (permite selecionar vários) ou use o QR Code para fotografar pelo celular!
                </div>
              ) : (
                <div className="space-y-2">
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
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => moverFoto(idx, 'esquerda')}
                              title="Mover foto para esquerda"
                              className="p-1 rounded bg-brand-dark-4 hover:bg-brand-dark-5 text-white"
                            >
                              <ChevronLeft size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => definirFotoPrincipal(url)}
                            title="Definir como foto de capa (Posição #1)"
                            className="p-1 rounded bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                          >
                            <Star size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removerFoto(idx)}
                            title="Excluir foto"
                            className="p-1 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                          {idx < fotos.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moverFoto(idx, 'direita')}
                              title="Mover foto para direita"
                              className="p-1 rounded bg-brand-dark-4 hover:bg-brand-dark-5 text-white"
                            >
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>

                        {/* Posição da Foto */}
                        <div className="absolute top-1 left-1 flex items-center gap-1">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow ${
                            fotoPrincipal === url ? 'bg-amber-500 text-black' : 'bg-black/70 text-gray-300'
                          }`}>
                            #{idx + 1} {fotoPrincipal === url ? 'CAPA' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    💡 Dica: Você pode adicionar várias fotos da arma (Lado A, Lado B, marcações, maleta e acessórios). No gerador de anúncios, você poderá escolher exibi-las em layout único, duplo, trio ou grade 4x!
                  </p>
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
        onUploadSuccess={async (url) => {
          if (!url) return;
          const imagemOtimizada = await otimizarImagemParaFoto(url);
          if (imagemOtimizada) {
            setFotos(prev => {
              const novas = [...prev, imagemOtimizada];
              if (!fotoPrincipal) setFotoPrincipal(imagemOtimizada);
              return novas;
            });
          }
          setModalQrAberto(false);
        }}
      />
    </>
  );
}
