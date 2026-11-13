import React, { useState, useEffect, useRef } from 'react';
import {
  X, Download, Copy, Check, Sparkles, Image as ImageIcon,
  Share2, Shield, Eye, Smartphone, LayoutGrid, AlertCircle, RefreshCw,
  Key, ExternalLink, Camera, QrCode, Upload, Trash2,
  RotateCw, FlipHorizontal, SunMedium, Palette, Tag, Square, Type, Move, SlidersHorizontal, ZoomIn,
  ChevronLeft, ChevronRight, Star, Plus
} from 'lucide-react';
import { ArmaVenda } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useArmasVenda } from '../../context/ArmasVendaContext';
import { formatarMoeda } from '../../utils/formatters';
import { ModalUploadCelular } from '../common/ModalUploadCelular';

interface ModalGeradorAnuncioProps {
  arma: ArmaVenda;
  isOpen: boolean;
  onClose: () => void;
}

export interface AjustesSlotFoto {
  zoom: number;
  posX: number;
  posY: number;
  rotacao: number;
  espelhar: boolean;
  filtroRealce: boolean;
  modo: 'conter' | 'preencher';
}

export interface AjustesLayoutFolder {
  offsetFonteModelo: number;
  offsetFonteFabricante: number;
  offsetFonteCalibre: number;
  offsetPosicaoYTextos: number;
  offsetPosicaoXTextos: number;
  offsetFontePreco: number;
  offsetPosicaoYPreco: number;
  offsetFonteSpecs: number;
  offsetPosicaoYSpecs: number;
}

const AJUSTE_SLOT_PADRAO: AjustesSlotFoto = {
  zoom: 105,
  posX: 0,
  posY: 0,
  rotacao: 0,
  espelhar: false,
  filtroRealce: false,
  modo: 'conter'
};

const AJUSTES_LAYOUT_PADRAO: AjustesLayoutFolder = {
  offsetFonteModelo: 0,
  offsetFonteFabricante: 0,
  offsetFonteCalibre: 0,
  offsetPosicaoYTextos: 0,
  offsetPosicaoXTextos: 0,
  offsetFontePreco: 0,
  offsetPosicaoYPreco: 0,
  offsetFonteSpecs: 0,
  offsetPosicaoYSpecs: 0
};

export const OPCOES_SELOS = [
  '★ SEMINOVA REVISADA',
  '🔥 OPORTUNIDADE ÚNICA',
  '⭐ ESTADO DE ZERO',
  '💎 PEÇA DE COLECIONADOR',
  '⚡ PREÇO DE OCASIÃO',
  '🏆 COM UPGRADES & EXTRAS',
  '🎯 PRONTA ENTREGA'
];

export const OPCOES_BALOES = [
  '💳 Parcela no Cartão',
  '💰 Desconto no Pix',
  '🏷️ Aceita Proposta',
  '📦 Completa c/ Maleta',
  '⚡ Transf. Rápida',
  '🛡️ Laudo Aprovado'
];

// Utilitário para remover o fundo branco da logo oficial (JPG) e torná-la transparente
function criarImagemComFundoTransparente(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  if (!ctx || c.width === 0 || c.height === 0) return c;

  ctx.drawImage(img, 0, 0);

  try {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imgData.data;
    // Percorre pixels: se r, g, b forem muito claros (fundo branco do JPEG), deixa transparente
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 220 && g > 220 && b > 220) {
        data[i + 3] = 0; // Alpha = 0 (100% transparente)
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('Não foi possível remover fundo branco da logo por restrição de canvas:', err);
  }

  return c;
}

export function ModalGeradorAnuncio({ arma, isOpen, onClose }: ModalGeradorAnuncioProps) {
  const { usuario } = useAuth();
  const { atualizarArmaVenda } = useArmasVenda();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Opções de personalização visual de formato e tema
  const [formato, setFormato] = useState<'feed' | 'quadrado' | 'stories'>('feed');
  const [temaVisual, setTemaVisual] = useState<'azul_tatico' | 'dark_stealth' | 'gold_luxury'>('azul_tatico');
  const [mostrarPreco, setMostrarPreco] = useState(true);
  const [mostrarCalibre, setMostrarCalibre] = useState(true);
  const [mostrarAcessorios, setMostrarAcessorios] = useState(true);
  const [mostrarEstado, setMostrarEstado] = useState(true);
  const [mostrarContato, setMostrarContato] = useState(true);
  const [mostrarLogo, setMostrarLogo] = useState(true);

  // Selos e Balões Promocionais de Destaque
  const [seloPrincipal, setSeloPrincipal] = useState<string>('★ SEMINOVA REVISADA');
  const [baloesAtivos, setBaloesAtivos] = useState<string[]>(['💳 Parcela no Cartão']);

  // Controles de enquadramento independentes por slot (até 4 fotos)
  const [ajustesSlots, setAjustesSlots] = useState<AjustesSlotFoto[]>([
    { ...AJUSTE_SLOT_PADRAO },
    { ...AJUSTE_SLOT_PADRAO },
    { ...AJUSTE_SLOT_PADRAO },
    { ...AJUSTE_SLOT_PADRAO }
  ]);
  const [slotAtivoEdicao, setSlotAtivoEdicao] = useState<number>(0);

  // Controles de personalização de textos, fontes e layout do folder
  const [ajustesLayout, setAjustesLayout] = useState<AjustesLayoutFolder>({ ...AJUSTES_LAYOUT_PADRAO });
  const [abaEdicao, setAbaEdicao] = useState<'fotos' | 'textos'>('fotos');

  // Interação e arrasto no canvas
  const canvasHitAreasRef = useRef<{
    type: 'foto' | 'textos' | 'preco' | 'specs';
    slot?: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[]>([]);
  const renderRef = useRef<(() => void) | null>(null);
  const desenhandoParaDownloadRef = useRef(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragDataRef = useRef<{
    startX: number;
    startY: number;
    hasMoved: boolean;
    targetType: 'foto' | 'textos' | 'preco' | 'specs' | null;
    targetSlot: number;
    initialSlotX: number;
    initialSlotY: number;
    initialTextX: number;
    initialTextY: number;
    initialPriceY: number;
    initialSpecsY: number;
  }>({
    startX: 0,
    startY: 0,
    hasMoved: false,
    targetType: null,
    targetSlot: 0,
    initialSlotX: 0,
    initialSlotY: 0,
    initialTextX: 0,
    initialTextY: 0,
    initialPriceY: 0,
    initialSpecsY: 0
  });

  const slotAtivo = ajustesSlots[slotAtivoEdicao] || AJUSTE_SLOT_PADRAO;
  const atualizarSlotAtivo = (campo: keyof AjustesSlotFoto, valor: any) => {
    setAjustesSlots(prev => {
      const novo = [...prev];
      novo[slotAtivoEdicao] = {
        ...(novo[slotAtivoEdicao] || AJUSTE_SLOT_PADRAO),
        [campo]: valor
      };
      return novo;
    });
  };

  const redefinirSlotAtivo = () => {
    setAjustesSlots(prev => {
      const novo = [...prev];
      novo[slotAtivoEdicao] = { ...AJUSTE_SLOT_PADRAO };
      return novo;
    });
  };

  const redefinirTodosSlots = () => {
    setAjustesSlots([
      { ...AJUSTE_SLOT_PADRAO },
      { ...AJUSTE_SLOT_PADRAO },
      { ...AJUSTE_SLOT_PADRAO },
      { ...AJUSTE_SLOT_PADRAO }
    ]);
  };

  const redefinirLayoutFolder = () => {
    setAjustesLayout({ ...AJUSTES_LAYOUT_PADRAO });
  };

  // Handlers para clique e arrasto no canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Verificar se clicou em uma área interativa (prioriza fotos)
    const hits = canvasHitAreasRef.current;
    let hit = hits.find(h => h.type === 'foto' && clickX >= h.x && clickX <= h.x + h.w && clickY >= h.y && clickY <= h.y + h.h);
    if (!hit) {
      hit = hits.find(h => clickX >= h.x && clickX <= h.x + h.w && clickY >= h.y && clickY <= h.y + h.h);
    }

    if (hit) {
      if (hit.type === 'foto' && typeof hit.slot === 'number') {
        setSlotAtivoEdicao(hit.slot);
        setAbaEdicao('fotos');
      } else if (hit.type === 'textos' || hit.type === 'preco' || hit.type === 'specs') {
        setAbaEdicao('textos');
      }

      dragDataRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        hasMoved: false,
        targetType: hit.type,
        targetSlot: hit.slot ?? 0,
        initialSlotX: hit.slot !== undefined ? (ajustesSlots[hit.slot]?.posX || 0) : 0,
        initialSlotY: hit.slot !== undefined ? (ajustesSlots[hit.slot]?.posY || 0) : 0,
        initialTextX: ajustesLayout.offsetPosicaoXTextos,
        initialTextY: ajustesLayout.offsetPosicaoYTextos,
        initialPriceY: ajustesLayout.offsetPosicaoYPreco,
        initialSpecsY: ajustesLayout.offsetPosicaoYSpecs
      };
      setIsDraggingCanvas(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCanvas || !dragDataRef.current.targetType) return;
    const dx = e.clientX - dragDataRef.current.startX;
    const dy = e.clientY - dragDataRef.current.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragDataRef.current.hasMoved = true;
    }

    if (!dragDataRef.current.hasMoved) return;

    const target = dragDataRef.current.targetType;
    if (target === 'foto') {
      const slot = dragDataRef.current.targetSlot;
      const sensibilidade = 0.35;
      const novoX = Math.round(Math.min(50, Math.max(-50, dragDataRef.current.initialSlotX + dx * sensibilidade)));
      const novoY = Math.round(Math.min(50, Math.max(-50, dragDataRef.current.initialSlotY + dy * sensibilidade)));
      setAjustesSlots(prev => {
        const copy = [...prev];
        copy[slot] = { ...(copy[slot] || AJUSTE_SLOT_PADRAO), posX: novoX, posY: novoY };
        return copy;
      });
    } else if (target === 'textos') {
      const sensibilidade = 0.7;
      const novoX = Math.round(Math.min(40, Math.max(-40, dragDataRef.current.initialTextX + dx * sensibilidade)));
      const novoY = Math.round(Math.min(60, Math.max(-60, dragDataRef.current.initialTextY + dy * sensibilidade)));
      setAjustesLayout(prev => ({ ...prev, offsetPosicaoXTextos: novoX, offsetPosicaoYTextos: novoY }));
    } else if (target === 'preco') {
      const sensibilidade = 0.7;
      const novoY = Math.round(Math.min(50, Math.max(-50, dragDataRef.current.initialPriceY + dy * sensibilidade)));
      setAjustesLayout(prev => ({ ...prev, offsetPosicaoYPreco: novoY }));
    } else if (target === 'specs') {
      const sensibilidade = 0.7;
      const novoY = Math.round(Math.min(40, Math.max(-40, dragDataRef.current.initialSpecsY + dy * sensibilidade)));
      setAjustesLayout(prev => ({ ...prev, offsetPosicaoYSpecs: novoY }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
    dragDataRef.current.targetType = null;
  };

  // Fotos gerenciadas localmente (permite adicionar/trocar foto na hora sem sair do modal)
  const [fotosLocais, setFotosLocais] = useState<string[]>([]);
  const [fotoSelecionadaIdx, setFotoSelecionadaIdx] = useState(0);
  const [modalQrAberto, setModalQrAberto] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);

  // Layout de Fotos no Anúncio: 1 Foto (Destaque), 2 Fotos (Dupla/Lado A e B), 3 Fotos (Trio), 4 Fotos (Grade 4x)
  const [layoutFotos, setLayoutFotos] = useState<'1' | '2' | '3' | '4'>('1');

  // Status de cópia e downloads
  const [copiado, setCopiado] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState(false);

  // Gemini IA para copy de vendas
  const [textoAnuncio, setTextoAnuncio] = useState('');
  const [gerandoIa, setGerandoIa] = useState(false);
  const [tomIa, setTomIa] = useState<'comercial' | 'tecnico' | 'curto'>('comercial');
  const [mostrarConfigChave, setMostrarConfigChave] = useState(false);
  const [chaveGeminiInput, setChaveGeminiInput] = useState(() => localStorage.getItem('gemini_api_key') || '');

  const dadosEmpresa = usuario?.dadosEmpresa;
  const nomeLoja = dadosEmpresa?.razaoSocialFantasia || dadosEmpresa?.nome || usuario?.nome || 'GCAC DESPACHANTE BÉLICO';
  const telefoneLoja = dadosEmpresa?.contatoTelefone || '(64) 9.9995-9865';
  const cidadeLoja = dadosEmpresa?.endereco || 'Av. Goiás, nº 1802, Sala 04 - Bairro Santa Maria - Jataí-GO';

  // Sincronizar fotos da arma com estado local
  useEffect(() => {
    const lista = arma.fotos && arma.fotos.length > 0
      ? arma.fotos
      : (arma.fotoPrincipal ? [arma.fotoPrincipal] : []);
    setFotosLocais(lista);
    setFotoSelecionadaIdx(0);
  }, [arma]);

  const fotoAtual = fotosLocais[fotoSelecionadaIdx] || arma.fotoPrincipal || '';

  // Função para comprimir e otimizar foto enviada pelo usuário
  const otimizarFoto = (fonte: string | File): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof fonte === 'string' && (fonte.startsWith('data:application/pdf') || fonte.includes('.pdf'))) {
        alert('Atenção: Foi recebido um arquivo em PDF. Por favor tire uma foto da arma em formato JPEG ou PNG.');
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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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

  // Adicionar foto diretamente no gerador e atualizar no banco
  const handleAdicionarFoto = async (fonte: string | File) => {
    try {
      setSalvandoFoto(true);
      const imagemOtimizada = await otimizarFoto(fonte);
      if (!imagemOtimizada) return;

      const novasFotos = [...fotosLocais, imagemOtimizada];
      setFotosLocais(novasFotos);
      setFotoSelecionadaIdx(novasFotos.length - 1);

      // Persistir na arma no banco de dados
      await atualizarArmaVenda(arma.id, {
        fotos: novasFotos,
        fotoPrincipal: arma.fotoPrincipal || novasFotos[0]
      });
    } catch (err) {
      console.error('Erro ao salvar foto na arma:', err);
    } finally {
      setSalvandoFoto(false);
    }
  };

  // Upload múltiplo de arquivos do computador
  const handleUploadComputador = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setSalvandoFoto(true);
      const novasImagens: string[] = [];

      for (const file of Array.from(files)) {
        const imagemOtimizada = await otimizarFoto(file);
        if (imagemOtimizada) {
          novasImagens.push(imagemOtimizada);
        }
      }

      if (novasImagens.length > 0) {
        const novasFotos = [...fotosLocais, ...novasImagens];
        setFotosLocais(novasFotos);
        
        // Se já anexou mais de uma foto e ainda estava em layout 1, sugere layout duplo
        if (novasFotos.length >= 2 && layoutFotos === '1' && fotosLocais.length === 0) {
          setLayoutFotos('2');
        }

        await atualizarArmaVenda(arma.id, {
          fotos: novasFotos,
          fotoPrincipal: arma.fotoPrincipal || novasFotos[0]
        });
      }
    } catch (err) {
      console.error('Erro ao anexar fotos:', err);
    } finally {
      setSalvandoFoto(false);
      e.target.value = '';
    }
  };

  // Remover foto da arma
  const handleRemoverFoto = async (idxRemover: number) => {
    if (fotosLocais.length <= 1) {
      if (!confirm('Deseja realmente remover esta foto da arma?')) return;
    }
    const atualizadas = fotosLocais.filter((_, i) => i !== idxRemover);
    setFotosLocais(atualizadas);
    if (fotoSelecionadaIdx >= atualizadas.length) {
      setFotoSelecionadaIdx(Math.max(0, atualizadas.length - 1));
    }
    if (Number(layoutFotos) > atualizadas.length && atualizadas.length > 0) {
      setLayoutFotos(String(Math.min(4, Math.max(1, atualizadas.length))) as any);
    }
    await atualizarArmaVenda(arma.id, {
      fotos: atualizadas,
      fotoPrincipal: atualizadas[0] || ''
    });
  };

  // Reordenar foto (mover para esquerda / direita)
  const handleMoverFoto = async (idxOrigem: number, direcao: 'esquerda' | 'direita') => {
    const idxDestino = direcao === 'esquerda' ? idxOrigem - 1 : idxOrigem + 1;
    if (idxDestino < 0 || idxDestino >= fotosLocais.length) return;
    const novaLista = [...fotosLocais];
    const temp = novaLista[idxOrigem];
    novaLista[idxOrigem] = novaLista[idxDestino];
    novaLista[idxDestino] = temp;
    setFotosLocais(novaLista);
    if (fotoSelecionadaIdx === idxOrigem) {
      setFotoSelecionadaIdx(idxDestino);
    } else if (fotoSelecionadaIdx === idxDestino) {
      setFotoSelecionadaIdx(idxOrigem);
    }
    await atualizarArmaVenda(arma.id, {
      fotos: novaLista,
      fotoPrincipal: novaLista[0] || ''
    });
  };

  // Definir foto como Capa (Posição #1)
  const handleDefinirComoCapa = async (idx: number) => {
    if (idx === 0) return;
    const foto = fotosLocais[idx];
    const novaLista = [foto, ...fotosLocais.filter((_, i) => i !== idx)];
    setFotosLocais(novaLista);
    setFotoSelecionadaIdx(0);
    await atualizarArmaVenda(arma.id, {
      fotos: novaLista,
      fotoPrincipal: foto
    });
  };

  // Gerar texto padrão para WhatsApp
  const gerarTextoPadrao = (estilo: 'comercial' | 'tecnico' | 'curto') => {
    if (estilo === 'curto') {
      return [
        `🎯 *DISPONÍVEL: ${arma.fabricante} ${arma.modelo}*`,
        `💥 Calibre: ${arma.calibre}${arma.sigmaSinarm ? ` | Reg: ${arma.sigmaSinarm}` : ''}`,
        `✨ Condição: ${arma.estadoConservacao}`,
        mostrarPreco ? `💵 Valor: ${formatarMoeda(arma.valorAnunciado)}` : '💵 Valor: Sob consulta',
        `📲 Fale conosco: ${telefoneLoja || 'Chame no direct'}`
      ].join('\n');
    }

    if (estilo === 'tecnico') {
      return [
        `📋 *ESPECIFICAÇÕES TÉCNICAS | ${arma.fabricante} ${arma.modelo}*`,
        '',
        `🔹 *Fabricante:* ${arma.fabricante}`,
        `🔹 *Modelo:* ${arma.modelo}`,
        `🔹 *Tipo:* ${arma.tipo}`,
        `🔹 *Calibre:* ${arma.calibre}`,
        arma.sigmaSinarm ? `🔹 *Registro Atual:* ${arma.sigmaSinarm}` : '',
        arma.capacidade ? `🔹 *Capacidade:* ${arma.capacidade}` : '',
        arma.acabamento ? `🔹 *Acabamento:* ${arma.acabamento}` : '',
        `🔹 *Estado de Conservação:* ${arma.estadoConservacao}`,
        arma.acessorios ? `🔹 *Acessórios:* ${arma.acessorios}` : '',
        arma.quantidadeCarregadores ? `🔹 *Carregadores:* ${arma.quantidadeCarregadores} unidade(s)` : '',
        '',
        mostrarPreco ? `💰 *Investimento:* ${formatarMoeda(arma.valorAnunciado)}` : '💰 *Valor:* Consulte condições',
        '',
        '⚖️ *Aviso Legal:* Transferência de propriedade obrigatória conforme portarias do Exército e PF. Venda restrita a CACs ou autorizados.',
        mostrarContato && telefoneLoja ? `📲 *Atendimento:* ${telefoneLoja}` : '',
        mostrarContato && cidadeLoja ? `📍 *Local:* ${cidadeLoja}` : ''
      ].filter(Boolean).join('\n');
    }

    // Estilo Comercial Padrão
    return [
      `🔥 *OPORTUNIDADE DE SEMINOVO | ${arma.fabricante} ${arma.modelo}* 🔥`,
      '',
      `🔹 *Tipo:* ${arma.tipo}`,
      mostrarCalibre ? `🔹 *Calibre:* ${arma.calibre}` : '',
      arma.sigmaSinarm ? `🔹 *Registro:* ${arma.sigmaSinarm}` : '',
      arma.capacidade ? `🔹 *Capacidade:* ${arma.capacidade}` : '',
      arma.acabamento ? `🔹 *Acabamento:* ${arma.acabamento}` : '',
      mostrarEstado ? `🔹 *Condição:* ${arma.estadoConservacao}` : '',
      (mostrarAcessorios && arma.acessorios) ? `🔹 *Acessórios:* ${arma.acessorios}` : '',
      (mostrarAcessorios && arma.quantidadeCarregadores) ? `🔹 *Carregadores:* ${arma.quantidadeCarregadores} unidade(s)` : '',
      '',
      mostrarPreco
        ? `💰 *Investimento:* ${formatarMoeda(arma.valorAnunciado)}`
        : '💰 *Valor:* Consulte condições especiais conosco!',
      '',
      '⚠️ *Aviso Legal:* Venda exclusiva e transferência obrigatória conforme legislação vigente (Exército Brasileiro / Polícia Federal). Necessário possuir CR ou Autorização de Compra.',
      '',
      mostrarContato && telefoneLoja ? `📲 *Interessados entrar em contato:* ${telefoneLoja}` : '',
      mostrarContato && cidadeLoja ? `📍 *Local:* ${cidadeLoja}` : '',
    ].filter(Boolean).join('\n');
  };

  useEffect(() => {
    setTextoAnuncio(gerarTextoPadrao(tomIa));
  }, [arma, mostrarPreco, mostrarCalibre, mostrarAcessorios, mostrarEstado, mostrarContato, telefoneLoja, cidadeLoja, tomIa]);

  // Função mestre de renderização no HTML5 Canvas
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGerandoImagem(true);

    // Configurações do Formato e Dimensões da Imagem
    const largura = 1080;
    const isQuadrado = formato === 'quadrado';
    const isStories = formato === 'stories';
    const altura = isQuadrado ? 1080 : isStories ? 1920 : 1350;
    canvas.width = largura;
    canvas.height = altura;

    // Paletas de cores e estilos de acordo com o tema selecionado
    const estilosTema = {
      azul_tatico: {
        bg0: '#010915', bg1: '#031633', bg2: '#05234f', bg3: '#03142e', bg4: '#010712',
        glow0: 'rgba(30, 95, 230, 0.32)', glow1: 'rgba(14, 165, 233, 0.12)',
        moldura: '#c59b27', molduraInterna: 'rgba(56, 189, 248, 0.4)',
        cantoneira: '#f59e0b',
        vitrineBg: 'rgba(2, 14, 33, 0.75)', vitrineBorda: 'rgba(56, 189, 248, 0.35)',
        vitrineGlow: 'rgba(14, 165, 233, 0.22)',
        specBg: '#041838', specBorda: '#1d4880', specLbl: '#7dd3fc',
        accent: '#38bdf8'
      },
      dark_stealth: {
        bg0: '#07090e', bg1: '#11141c', bg2: '#1a1f2c', bg3: '#11141c', bg4: '#07090e',
        glow0: 'rgba(148, 163, 184, 0.22)', glow1: 'rgba(71, 85, 105, 0.08)',
        moldura: '#94a3b8', molduraInterna: 'rgba(245, 158, 11, 0.35)',
        cantoneira: '#e2e8f0',
        vitrineBg: 'rgba(10, 12, 18, 0.85)', vitrineBorda: 'rgba(148, 163, 184, 0.35)',
        vitrineGlow: 'rgba(255, 255, 255, 0.08)',
        specBg: '#0d1117', specBorda: '#334155', specLbl: '#cbd5e1',
        accent: '#e2e8f0'
      },
      gold_luxury: {
        bg0: '#0a0701', bg1: '#181003', bg2: '#291c06', bg3: '#181003', bg4: '#0a0701',
        glow0: 'rgba(234, 179, 8, 0.28)', glow1: 'rgba(180, 133, 18, 0.12)',
        moldura: '#fbbf24', molduraInterna: 'rgba(254, 240, 138, 0.45)',
        cantoneira: '#f59e0b',
        vitrineBg: 'rgba(18, 12, 3, 0.80)', vitrineBorda: 'rgba(234, 179, 8, 0.45)',
        vitrineGlow: 'rgba(234, 179, 8, 0.25)',
        specBg: '#161005', specBorda: '#63450c', specLbl: '#fde047',
        accent: '#fbbf24'
      }
    };
    const tema = estilosTema[temaVisual] || estilosTema.azul_tatico;

    // 1. FUNDO GRADIENTE CONFORME TEMA SELECIONADO
    const bgGrad = ctx.createLinearGradient(0, 0, 0, altura);
    bgGrad.addColorStop(0, tema.bg0);
    bgGrad.addColorStop(0.18, tema.bg1);
    bgGrad.addColorStop(0.5, tema.bg2);
    bgGrad.addColorStop(0.82, tema.bg3);
    bgGrad.addColorStop(1, tema.bg4);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, largura, altura);

    // Glow radial tático de alto contraste no centro
    const glowGrad = ctx.createRadialGradient(largura / 2, altura * 0.4, 40, largura / 2, altura * 0.4, 550);
    glowGrad.addColorStop(0, tema.glow0);
    glowGrad.addColorStop(0.55, tema.glow1);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, largura, altura);

    // 2. TEXTO SUPERIOR (Acima da moldura)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('CATÁLOGO DE ARMAS USADAS • INTERMEDIAÇÃO LEGALIZADA', largura / 2, 40);

    // 3. MOLDURA COM DESIGN TÁTICO EXPANDIDO
    const pad = 34;
    const molduraW = largura - pad * 2;
    const molduraH = altura - pad * 2 - 16;
    const molduraY = 52;

    // Moldura Principal
    ctx.strokeStyle = tema.moldura;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(pad, molduraY, molduraW, molduraH, 26);
    ctx.stroke();

    // Borda Interna Fina Luminosa
    ctx.strokeStyle = tema.molduraInterna;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(pad + 7, molduraY + 7, molduraW - 14, molduraH - 14, 20);
    ctx.stroke();

    // Cantoneiras decorativas reforçadas
    const cSize = 28;
    ctx.strokeStyle = tema.cantoneira;
    ctx.lineWidth = 4.5;
    // Canto Sup Esq
    ctx.beginPath();
    ctx.moveTo(pad, molduraY + cSize);
    ctx.lineTo(pad, molduraY);
    ctx.lineTo(pad + cSize, molduraY);
    ctx.stroke();
    // Canto Sup Dir
    ctx.beginPath();
    ctx.moveTo(pad + molduraW - cSize, molduraY);
    ctx.lineTo(pad + molduraW, molduraY);
    ctx.lineTo(pad + molduraW, molduraY + cSize);
    ctx.stroke();
    // Canto Inf Esq
    ctx.beginPath();
    ctx.moveTo(pad, molduraY + molduraH - cSize);
    ctx.lineTo(pad, molduraY + molduraH);
    ctx.lineTo(pad + cSize, molduraY + molduraH);
    ctx.stroke();
    // Canto Inf Dir
    ctx.beginPath();
    ctx.moveTo(pad + molduraW - cSize, molduraY + molduraH);
    ctx.lineTo(pad + molduraW, molduraY + molduraH);
    ctx.lineTo(pad + molduraW, molduraY + molduraH - cSize);
    ctx.stroke();

    // Carregar Imagens
    const logoImg = new Image();
    const logoSrc = usuario?.dadosEmpresa?.logoUrl || '/logo_gcac_vetor.png';

    if (logoSrc && (logoSrc.startsWith('http://') || logoSrc.startsWith('https://'))) {
      logoImg.crossOrigin = 'anonymous';
    }

    // Selecionar fotos para renderizar de acordo com o layout (1, 2, 3 ou 4 fotos)
    const qtdFotosDesejadas = Number(layoutFotos);
    const fotosParaAnuncio: string[] = [];
    for (let i = 0; i < qtdFotosDesejadas; i++) {
      if (fotosLocais[i]) {
        fotosParaAnuncio.push(fotosLocais[i]);
      } else if (fotoAtual) {
        fotosParaAnuncio.push(fotoAtual);
      }
    }

    const armaImgs: (HTMLImageElement | null)[] = fotosParaAnuncio.map(src => {
      if (!src) return null;
      const img = new Image();
      if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      return img;
    });

    const renderConteudo = () => {
      canvasHitAreasRef.current = [];
      let topY = molduraY + 14;

      // 4. LOGO OFICIAL DO ESCRITÓRIO (Alta Definição e Tamanho Destacado)
      if (mostrarLogo && logoImg.complete && logoImg.naturalWidth > 0) {
        // Logo oficial vetorizada com altura adaptada ao formato
        const logoH = isQuadrado ? 125 : isStories ? 210 : 170;
        const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
        const logoX = (largura - logoW) / 2;

        // Glow suave atrás da logo oficial
        const logoGlow = ctx.createRadialGradient(
          largura / 2, topY + logoH / 2, 20,
          largura / 2, topY + logoH / 2, logoW * 0.75
        );
        logoGlow.addColorStop(0, tema.glow0);
        logoGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = logoGlow;
        ctx.fillRect(logoX - 50, topY - 15, logoW + 100, logoH + 30);

        if (usuario?.dadosEmpresa?.logoUrl && usuario.dadosEmpresa.logoUrl.endsWith('.jpg')) {
          const logoCanvas = criarImagemComFundoTransparente(logoImg);
          ctx.drawImage(logoCanvas, logoX, topY, logoW, logoH);
        } else {
          ctx.drawImage(logoImg, logoX, topY, logoW, logoH);
        }

        topY += logoH + (isQuadrado ? 10 : 16);
      } else {
        topY += 24;
      }

      // Linha divisória luminosa
      const sepGrad = ctx.createLinearGradient(pad + 40, 0, pad + molduraW - 40, 0);
      sepGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      sepGrad.addColorStop(0.5, tema.molduraInterna);
      sepGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.strokeStyle = sepGrad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pad + 40, topY);
      ctx.lineTo(pad + molduraW - 40, topY);
      ctx.stroke();
      topY += 16;

      // 5. BADGES: [SELO PRINCIPAL CUSTOMIZÁVEL] (Esq) e [DISPONÍVEL/STATUS] (Dir)
      const badgeY = topY;
      const badgeH = isQuadrado ? 34 : isStories ? 44 : 38;

      // Badge Esquerda Dourada com Selo Principal
      const bgBadgeDourada = ctx.createLinearGradient(pad + 26, 0, pad + 285, 0);
      bgBadgeDourada.addColorStop(0, '#b8860b');
      bgBadgeDourada.addColorStop(0.5, '#f59e0b');
      bgBadgeDourada.addColorStop(1, '#eab308');
      ctx.fillStyle = bgBadgeDourada;
      ctx.beginPath();
      ctx.roundRect(pad + 26, badgeY, 255, badgeH, 10);
      ctx.fill();

      ctx.fillStyle = '#050505';
      ctx.font = '900 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seloPrincipal, pad + 26 + 127, badgeY + (badgeH / 2) + 5);

      // Badge Direita Status
      const statusTexto = arma.status === 'vendida' ? 'VENDIDA' : arma.status === 'reservada' ? 'RESERVADA' : 'DISPONÍVEL';
      const statusCor = arma.status === 'vendida' ? '#ef4444' : arma.status === 'reservada' ? '#f59e0b' : tema.accent;

      ctx.fillStyle = tema.vitrineBg;
      ctx.strokeStyle = statusCor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(pad + molduraW - 216, badgeY, 190, badgeH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.fillText(statusTexto, pad + molduraW - 216 + 95, badgeY + (badgeH / 2) + 5);

      topY += badgeH + (isQuadrado ? 10 : 16);

      // 6. BLOCO CENTRAL: TÍTULO DA ARMA (Esq) + VITRINE DA ARMA EXPANDIDA (Dir)
      const blocoMeioY = topY;
      const blocoMeioH = isQuadrado ? 370 : isStories ? 750 : 515;

      const boxFotoW = isQuadrado ? 600 : 635;
      const boxFotoH = blocoMeioH - 15;
      const boxFotoX = largura - pad - boxFotoW - 14;
      const boxFotoY = blocoMeioY + 5;

      // Largura máxima de segurança para os textos à esquerda nunca sobreporem a imagem
      const leftStartX = pad + 26 + ajustesLayout.offsetPosicaoXTextos;
      const maxTextW = Math.max(120, boxFotoX - leftStartX - 18);

      // Registrar área do bloco de textos para clique e arrasto
      canvasHitAreasRef.current.push({
        type: 'textos',
        x: pad + 16,
        y: blocoMeioY,
        w: boxFotoX - pad - 20,
        h: blocoMeioH
      });

      // Lado Esquerdo: NOME DA ARMA E INFORMAÇÕES BÉLICAS COM ENCAIXE INTELIGENTE (Auto-Fit & Wrap)
      ctx.textAlign = 'left';
      let currentLeftY = blocoMeioY + (isQuadrado ? 26 : 38) + ajustesLayout.offsetPosicaoYTextos;

      // 1. Tipo de Arma (se preenchido e não for 'OUTRO')
      if (arma.tipo && arma.tipo.toUpperCase() !== 'OUTRO') {
        ctx.fillStyle = tema.accent;
        ctx.font = `bold ${isQuadrado ? 11 : 13}px "Segoe UI", sans-serif`;
        ctx.fillText(arma.tipo.toUpperCase(), leftStartX, currentLeftY);
        currentLeftY += isQuadrado ? 16 : 22;
      }

      // 2. Fabricante com auto-fit de largura e ajuste manual
      const fabTexto = (arma.fabricante || '').toUpperCase();
      let fabFontSize = (isQuadrado ? (fabTexto.length > 14 ? 19 : 23) : (fabTexto.length > 14 ? 24 : 30)) + ajustesLayout.offsetFonteFabricante;
      fabFontSize = Math.max(12, fabFontSize);
      ctx.font = `800 ${fabFontSize}px "Segoe UI", sans-serif`;
      while (ctx.measureText(fabTexto).width > maxTextW && fabFontSize > 13) {
        fabFontSize -= 1;
        ctx.font = `800 ${fabFontSize}px "Segoe UI", sans-serif`;
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(fabTexto, leftStartX, currentLeftY);
      currentLeftY += fabFontSize + (isQuadrado ? 6 : 10);

      // 3. Modelo Grande com quebra em linhas (auto-wrap) e ajuste de fonte proporcional
      const modeloTexto = (arma.modelo || '').toUpperCase();
      const palavrasModelo = modeloTexto.split(/\s+/).filter(Boolean);
      let modeloFontSize = (isQuadrado ? 38 : 50) + ajustesLayout.offsetFonteModelo;
      modeloFontSize = Math.max(16, modeloFontSize);

      const calcularLinhasModelo = (tamFonte: number) => {
        ctx.font = `900 ${tamFonte}px "Segoe UI", sans-serif`;
        const linhas: string[] = [];
        let linhaAtual = '';
        for (const palavra of palavrasModelo) {
          const teste = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
          if (ctx.measureText(teste).width <= maxTextW) {
            linhaAtual = teste;
          } else {
            if (linhaAtual) linhas.push(linhaAtual);
            linhaAtual = palavra;
          }
        }
        if (linhaAtual) linhas.push(linhaAtual);
        return linhas;
      };

      let linhasModelo = calcularLinhasModelo(modeloFontSize);
      while (
        modeloFontSize > 18 &&
        (linhasModelo.length > (isQuadrado ? 2 : 3) || linhasModelo.some(l => {
          ctx.font = `900 ${modeloFontSize}px "Segoe UI", sans-serif`;
          return ctx.measureText(l).width > maxTextW;
        }))
      ) {
        modeloFontSize -= 2;
        linhasModelo = calcularLinhasModelo(modeloFontSize);
      }

      // Garantia para palavras individuais que excedam maxTextW
      for (const linha of linhasModelo) {
        ctx.font = `900 ${modeloFontSize}px "Segoe UI", sans-serif`;
        while (ctx.measureText(linha).width > maxTextW && modeloFontSize > 14) {
          modeloFontSize -= 1;
          ctx.font = `900 ${modeloFontSize}px "Segoe UI", sans-serif`;
        }
      }

      const modeloLineHeight = modeloFontSize * 1.1;
      const modeloGrad = ctx.createLinearGradient(leftStartX, currentLeftY, leftStartX, currentLeftY + linhasModelo.length * modeloLineHeight);
      modeloGrad.addColorStop(0, '#ffffff');
      modeloGrad.addColorStop(1, '#93c5fd');

      ctx.save();
      ctx.fillStyle = modeloGrad;
      ctx.font = `900 ${modeloFontSize}px "Segoe UI", sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 12;

      linhasModelo.forEach((linha) => {
        currentLeftY += modeloLineHeight;
        ctx.fillText(linha, leftStartX, currentLeftY);
      });
      ctx.restore();

      currentLeftY += isQuadrado ? 14 : 20;

      // 4. Calibre em destaque Neon com auto-fit e ajuste manual
      if (mostrarCalibre && arma.calibre) {
        const calTexto = `CALIBRE ${arma.calibre.toUpperCase()}`;
        let calFontSize = (isQuadrado ? 17 : 22) + ajustesLayout.offsetFonteCalibre;
        calFontSize = Math.max(11, calFontSize);
        ctx.font = `bold ${calFontSize}px "Segoe UI", sans-serif`;
        while (ctx.measureText(calTexto).width > maxTextW && calFontSize > 12) {
          calFontSize -= 1;
          ctx.font = `bold ${calFontSize}px "Segoe UI", sans-serif`;
        }
        ctx.fillStyle = tema.accent;
        ctx.fillText(calTexto, leftStartX, currentLeftY);
        currentLeftY += calFontSize + (isQuadrado ? 10 : 16);
      }

      // 5. Registro (SIGMA / SINARM / OUTRO) com auto-fit
      if (arma.sigmaSinarm) {
        const regTexto = `REGISTRO: ${arma.sigmaSinarm.toUpperCase()}`;
        let regFontSize = isQuadrado ? 13 : 16;
        ctx.font = `700 ${regFontSize}px "Segoe UI", sans-serif`;
        while (ctx.measureText(regTexto).width > maxTextW && regFontSize > 10) {
          regFontSize -= 1;
          ctx.font = `700 ${regFontSize}px "Segoe UI", sans-serif`;
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(regTexto, leftStartX, currentLeftY);
        currentLeftY += regFontSize + (isQuadrado ? 14 : 20);
      }

      // 6. Selo de Procedência & Segurança Jurídica
      const badgeSeloW = Math.min(maxTextW, isQuadrado ? 215 : 255);
      const badgeSeloH = isQuadrado ? 28 : 34;
      ctx.fillStyle = 'rgba(6, 23, 51, 0.8)';
      ctx.strokeStyle = tema.vitrineBorda;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(leftStartX, currentLeftY, badgeSeloW, badgeSeloH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = tema.accent;
      ctx.font = `bold ${isQuadrado ? 10 : 11.5}px "Segoe UI", sans-serif`;
      ctx.fillText('🛡️  PROCEDÊNCIA VERIFICADA', leftStartX + 12, currentLeftY + (badgeSeloH / 2) + 4);

      // Função para renderizar cada foto em sua área com enquadramento
      // Função para renderizar cada foto em sua área com enquadramento individual
      const renderFotoNoBox = (
        img: HTMLImageElement | null,
        subX: number,
        subY: number,
        subW: number,
        subH: number,
        rotulo?: string,
        slotIdx: number = 0
      ) => {
        // Registrar área para clique interativo e arrasto
        canvasHitAreasRef.current.push({
          type: 'foto',
          slot: slotIdx,
          x: subX,
          y: subY,
          w: subW,
          h: subH
        });

        const aj = ajustesSlots[slotIdx] || AJUSTE_SLOT_PADRAO;

        ctx.save();
        // Moldura interna Glass
        ctx.fillStyle = 'rgba(4, 9, 20, 0.65)';
        ctx.strokeStyle = tema.vitrineBorda;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(subX, subY, subW, subH, 14);
        ctx.fill();
        ctx.stroke();

        const temFoto = img && img.complete && img.naturalWidth > 0;
        if (temFoto) {
          ctx.beginPath();
          ctx.roundRect(subX + 3, subY + 3, subW - 6, subH - 6, 12);
          ctx.clip();

          if (aj.filtroRealce) {
            ctx.filter = 'brightness(1.1) contrast(1.16) saturate(1.1)';
          }

          const rot = aj.rotacao;
          const isRot90 = rot === 90 || rot === 270;
          const effectiveW = isRot90 ? img.naturalHeight : img.naturalWidth;
          const effectiveH = isRot90 ? img.naturalWidth : img.naturalHeight;

          const baseScale = (aj.modo === 'preencher')
            ? Math.max(subW / effectiveW, subH / effectiveH)
            : Math.min((subW - 14) / effectiveW, (subH - 14) / effectiveH);

          const zoom = aj.zoom / 100;
          const finalScale = baseScale * zoom;
          const drawW = img.naturalWidth * finalScale;
          const drawH = img.naturalHeight * finalScale;

          const posX = (aj.posX / 100) * subW;
          const posY = (aj.posY / 100) * subH;
          const centerX = subX + subW / 2 + posX;
          const centerY = subY + subH / 2 + posY;

          ctx.translate(centerX, centerY);

          if (rot !== 0) {
            ctx.rotate((rot * Math.PI) / 180);
          }

          if (aj.espelhar) {
            ctx.scale(-1, 1);
          }

          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 28;
          ctx.shadowOffsetY = 12;

          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          const miraX = subX + subW / 2;
          const miraY = subY + subH / 2;
          ctx.strokeStyle = tema.accent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(miraX, miraY, 22, 0, Math.PI * 2);
          ctx.moveTo(miraX - 30, miraY);
          ctx.lineTo(miraX + 30, miraY);
          ctx.stroke();

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SEM FOTO NESTE ÂNGULO', miraX, miraY + 38);
        }

        ctx.restore();

        // Rótulo discreto (ex: Lado A, Lado B)
        if (rotulo && temFoto) {
          ctx.save();
          ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(subX + 8, subY + 8, 86, 20, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = tema.accent;
          ctx.font = '900 10px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(rotulo, subX + 8 + 43, subY + 8 + 14);
          ctx.restore();
        }

        // Borda de seleção visual interativa (apenas durante preview, nunca no download final)
        if (!desenhandoParaDownloadRef.current && slotIdx === slotAtivoEdicao && Number(layoutFotos) > 1) {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.roundRect(subX + 2, subY + 2, subW - 4, subH - 4, 13);
          ctx.stroke();

          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.roundRect(subX + subW - 96, subY + 8, 88, 20, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✏️ EM EDIÇÃO', subX + subW - 52, subY + 22);
          ctx.restore();
        }
      };

      const innerPad = 6;
      const innerW = boxFotoW - innerPad * 2;
      const innerH = boxFotoH - innerPad * 2;
      const innerX = boxFotoX + innerPad;
      const innerY = boxFotoY + innerPad;

      if (layoutFotos === '1') {
        renderFotoNoBox(armaImgs[0] || null, innerX, innerY, innerW, innerH, undefined, 0);
      } else if (layoutFotos === '2') {
        const gap = 10;
        const subH = Math.floor((innerH - gap) / 2);
        renderFotoNoBox(armaImgs[0] || null, innerX, innerY, innerW, subH, '★ LADO A', 0);
        renderFotoNoBox(armaImgs[1] || armaImgs[0] || null, innerX, innerY + subH + gap, innerW, subH, '★ LADO B', 1);
      } else if (layoutFotos === '3') {
        const gap = 8;
        const topH = Math.floor(innerH * 0.58);
        const botH = innerH - topH - gap;
        const halfW = Math.floor((innerW - gap) / 2);
        renderFotoNoBox(armaImgs[0] || null, innerX, innerY, innerW, topH, '★ PRINCIPAL', 0);
        renderFotoNoBox(armaImgs[1] || armaImgs[0] || null, innerX, innerY + topH + gap, halfW, botH, 'DETALHE 1', 1);
        renderFotoNoBox(armaImgs[2] || armaImgs[0] || null, innerX + halfW + gap, innerY + topH + gap, halfW, botH, 'DETALHE 2', 2);
      } else if (layoutFotos === '4') {
        const gap = 8;
        const halfW = Math.floor((innerW - gap) / 2);
        const halfH = Math.floor((innerH - gap) / 2);
        renderFotoNoBox(armaImgs[0] || null, innerX, innerY, halfW, halfH, 'FOTO 1', 0);
        renderFotoNoBox(armaImgs[1] || armaImgs[0] || null, innerX + halfW + gap, innerY, halfW, halfH, 'FOTO 2', 1);
        renderFotoNoBox(armaImgs[2] || armaImgs[0] || null, innerX, innerY + halfH + gap, halfW, halfH, 'FOTO 3', 2);
        renderFotoNoBox(armaImgs[3] || armaImgs[0] || null, innerX + halfW + gap, innerY + halfH + gap, halfW, halfH, 'FOTO 4', 3);
      }

      ctx.restore();

      topY += blocoMeioH + (isQuadrado ? 10 : 14);

      // 6.5 BALÕES PROMOCIONAIS FLUTUANTES (Tags de Destaque)
      if (baloesAtivos.length > 0) {
        const baloesParaExibir = baloesAtivos.slice(0, 3);
        const gapBalao = 12;
        let totalW = 0;
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        const largurasBaloes = baloesParaExibir.map(b => {
          const w = ctx.measureText(b).width + 30;
          totalW += w;
          return w;
        });
        totalW += (baloesParaExibir.length - 1) * gapBalao;

        let startX = (largura - totalW) / 2;
        const balaoY = topY;
        const balaoH = isQuadrado ? 28 : 32;

        baloesParaExibir.forEach((balao, idx) => {
          const bw = largurasBaloes[idx];
          ctx.fillStyle = tema.vitrineBg;
          ctx.strokeStyle = idx === 0 ? '#f59e0b' : tema.accent;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(startX, balaoY, bw, balaoH, 16);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(balao, startX + bw / 2, balaoY + (balaoH / 2) + 5);
          startX += bw + gapBalao;
        });

        topY += balaoH + (isQuadrado ? 10 : 14);
      }

      // 7. GRADE DE 6 ESPECIFICAÇÕES TÉCNICAS (Com adaptação Pistola / Revólver)
      const gridW = molduraW - 48;
      const gridX = pad + 24;
      const boxW = (gridW - 24) / 3;
      const boxH = isQuadrado ? 66 : isStories ? 88 : 76;

      const formatarValorSeguro = (val?: string) => {
        if (!val) return 'ORIGINAL';
        return val.trim();
      };

      const isRevolver = arma.tipo?.toUpperCase().includes('REVOLV') || arma.modelo?.toUpperCase().includes('REVOLV');

      const infos = [
        { label: 'CALIBRE:', val: arma.calibre.toUpperCase() },
        { label: isRevolver ? 'TAMBOR:' : 'CAPACIDADE:', val: arma.capacidade || (isRevolver ? '06 TIROS' : '17+1 TIROS') },
        {
          label: isRevolver ? 'ACESSÓRIOS:' : 'INCLUI:',
          val: isRevolver
            ? (formatarValorSeguro(arma.acessorios) || 'MALETA / COLDRE')
            : (arma.quantidadeCarregadores
                ? `${arma.quantidadeCarregadores.toString().padStart(2, '0')} CARREGADORES`
                : formatarValorSeguro(arma.acessorios))
        },
        { label: 'ACABAMENTO:', val: formatarValorSeguro(arma.acabamento).toUpperCase() },
        { label: 'ESTADO:', val: arma.estadoConservacao.toUpperCase() },
        { label: 'SISTEMA:', val: (arma.sigmaSinarm || 'SIGMA (CAC)').toUpperCase() }
      ];

      // Registrar área de especificações para clique e arrasto
      canvasHitAreasRef.current.push({
        type: 'specs',
        x: gridX,
        y: topY + ajustesLayout.offsetPosicaoYSpecs,
        w: gridW,
        h: (boxH * 2) + (isQuadrado ? 8 : 10)
      });

      infos.forEach((info, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = gridX + col * (boxW + 12);
        const by = topY + row * (boxH + (isQuadrado ? 8 : 10)) + ajustesLayout.offsetPosicaoYSpecs;

        // Box Fundo com Borda Tática conforme Tema
        ctx.fillStyle = tema.specBg;
        ctx.strokeStyle = tema.specBorda;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        // Rótulo Superior
        ctx.textAlign = 'center';
        ctx.fillStyle = tema.specLbl;
        ctx.font = `bold ${isQuadrado ? 11 : 13}px "Segoe UI", sans-serif`;
        ctx.fillText(info.label, bx + boxW / 2, by + (isQuadrado ? 20 : 24));

        // Valor Principal Branco com Ajuste Inteligente de Tamanho de Fonte e Offset Manual
        ctx.fillStyle = '#ffffff';
        let tamanhoFonte = (isQuadrado ? (info.val.length > 15 ? 14 : 17) : (info.val.length > 15 ? 17 : 21)) + ajustesLayout.offsetFonteSpecs;
        tamanhoFonte = Math.max(10, tamanhoFonte);
        ctx.font = `900 ${tamanhoFonte}px "Segoe UI", sans-serif`;

        let valExibicao = info.val;
        if (valExibicao.length > 22) {
          valExibicao = valExibicao.slice(0, 20) + '...';
        }
        ctx.fillText(valExibicao, bx + boxW / 2, by + (isQuadrado ? 46 : 54));
      });

      topY += (boxH * 2) + (isQuadrado ? 14 : 20);

      // 8. FAIXA DOURADA DE PREÇO
      if (mostrarPreco) {
        const faixaW = gridW;
        const faixaH = isQuadrado ? 86 : isStories ? 116 : 102;
        const faixaX = gridX;
        const faixaY = topY + 6 + ajustesLayout.offsetPosicaoYPreco;

        // Registrar área do preço para clique e arrasto
        canvasHitAreasRef.current.push({
          type: 'preco',
          x: faixaX,
          y: faixaY,
          w: faixaW,
          h: faixaH
        });

        const douradoGrad = ctx.createLinearGradient(faixaX, 0, faixaX + faixaW, 0);
        douradoGrad.addColorStop(0, '#c7981b');
        douradoGrad.addColorStop(0.25, '#fbbf24');
        douradoGrad.addColorStop(0.5, '#fef08a');
        douradoGrad.addColorStop(0.75, '#fbbf24');
        douradoGrad.addColorStop(1, '#b48512');

        ctx.save();
        ctx.shadowColor = 'rgba(234, 179, 8, 0.4)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = douradoGrad;
        ctx.beginPath();
        ctx.roundRect(faixaX, faixaY, faixaW, faixaH, 16);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#361e01';
        ctx.font = `bold ${isQuadrado ? 13 : 15}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DE INVESTIMENTO', largura / 2, faixaY + (isQuadrado ? 22 : 28));

        ctx.fillStyle = '#050505';
        let tamPrecoFonte = (isQuadrado ? 44 : 56) + ajustesLayout.offsetFontePreco;
        tamPrecoFonte = Math.max(20, tamPrecoFonte);
        ctx.font = `900 ${tamPrecoFonte}px "Segoe UI", sans-serif`;
        ctx.fillText(formatarMoeda(arma.valorAnunciado), largura / 2, faixaY + (isQuadrado ? 66 : 80));

        topY += faixaH + (isQuadrado ? 14 : 24);
      } else {
        topY += 24;
      }

      // 9. RODAPÉ DE CONTATOS OFICIAL DO ESCRITÓRIO
      const rodapeY = altura - pad - (isQuadrado ? 48 : 62);

      if (mostrarContato) {
        // Texto formatado do WhatsApp
        const textoZap = `WhatsApp: ${telefoneLoja}`;
        const tamFonteZap = isQuadrado ? 24 : 28;
        ctx.font = `900 ${tamFonteZap}px "Segoe UI", sans-serif`;
        const metricsZap = ctx.measureText(textoZap);
        const zapTextW = metricsZap.width;

        const zapIconTamanho = isQuadrado ? 32 : 36;
        const gapZap = 12;
        const totalLinhaZapW = zapIconTamanho + gapZap + zapTextW;

        // Posição inicial para centralizar perfeitamente todo o bloco [Ícone Oficial + Texto]
        const startZapX = (largura - totalLinhaZapW) / 2;
        const zapIconCenterX = startZapX + (zapIconTamanho / 2);
        const zapIconCenterY = rodapeY - (tamFonteZap * 0.35);

        // 9.1 Renderiza Ícone Vetorial Oficial do WhatsApp (#25D366 com Telefone Branco)
        ctx.save();
        ctx.translate(zapIconCenterX, zapIconCenterY);
        const zapScale = zapIconTamanho / 24;
        ctx.scale(zapScale, zapScale);
        ctx.translate(-12, -12);

        // Sombra de brilho suave esmeralda
        ctx.shadowColor = 'rgba(37, 211, 102, 0.45)';
        ctx.shadowBlur = 10;

        // Balão Verde Oficial WhatsApp (#25D366)
        ctx.fillStyle = '#25D366';
        if (typeof Path2D !== 'undefined') {
          const fundoZapPath = new Path2D(
            "M12.004 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.88L2 22l5.24-1.24A9.957 9.957 0 0012.004 22C17.524 22 22 17.52 22 12s-4.476-10-9.996-10z"
          );
          ctx.fill(fundoZapPath);

          // Telefone Branco Oficial
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          const foneZapPath = new Path2D(
            "M17.472 14.382c-.301-.15-1.782-.88-2.058-.98-.276-.1-.476-.15-.677.15-.201.3-.778.98-.953 1.18-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.798-1.5-1.785-1.675-2.086-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.15-.175.201-.3.301-.501.101-.2.05-.376-.025-.526-.075-.15-.677-1.631-.928-2.233-.244-.586-.493-.506-.677-.515-.175-.009-.376-.011-.577-.011s-.527.075-.803.376c-.276.3-1.053 1.029-1.053 2.509s1.078 2.91 1.229 3.111c.15.201 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.722.23 1.38.197 1.9-.119.58-.352 1.782-.728 2.033-1.431.251-.703.251-1.305.176-1.431-.076-.126-.276-.201-.577-.351z"
          );
          ctx.fill(foneZapPath);
        } else {
          // Fallback nativo caso Path2D não esteja disponível
          ctx.beginPath();
          ctx.arc(12, 12, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // 9.2 Texto do WhatsApp perfeitamente posicionado ao lado do ícone
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${tamFonteZap}px "Segoe UI", sans-serif`;
        ctx.fillText(textoZap, startZapX + zapIconTamanho + gapZap, rodapeY);

        // 9.3 Endereço e Cidade com Pin perfeitamente centralizado
        if (cidadeLoja) {
          const enderecoY = rodapeY + (isQuadrado ? 28 : 34);
          const tamFonteEnd = isQuadrado ? 15 : 18;
          ctx.font = `600 ${tamFonteEnd}px "Segoe UI", sans-serif`;
          const endMetrics = ctx.measureText(cidadeLoja);
          const endTextW = endMetrics.width;

          const pinLargura = tamFonteEnd;
          const gapPin = 8;
          const totalEndW = pinLargura + gapPin + endTextW;
          const startEndX = (largura - totalEndW) / 2;

          ctx.textAlign = 'left';
          ctx.fillStyle = '#f87171';
          ctx.font = `bold ${tamFonteEnd}px sans-serif`;
          ctx.fillText('📍', startEndX, enderecoY);

          ctx.fillStyle = '#e2e8f0';
          ctx.font = `600 ${tamFonteEnd}px "Segoe UI", sans-serif`;
          ctx.fillText(cidadeLoja, startEndX + pinLargura + gapPin, enderecoY);
        }
      }

      // 10. TEXTO LEGAL FINAL FORA DA MOLDURA
      ctx.fillStyle = '#64748b';
      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Venda autorizada sob intermediação legal. Transferência obrigatória pelo SIGMA/SINARM.',
        largura / 2,
        altura - 14
      );

      setGerandoImagem(false);
    };

    renderRef.current = renderConteudo;

    let executou = false;
    const dispararRender = () => {
      if (executou) return;
      executou = true;
      renderConteudo();
    };

    let totalParaCarregar = (mostrarLogo && logoSrc ? 1 : 0) + armaImgs.filter(Boolean).length;
    let concluidas = 0;

    const onImagemFinalizada = () => {
      concluidas++;
      if (concluidas >= totalParaCarregar) {
        dispararRender();
      }
    };

    logoImg.onload = onImagemFinalizada;
    logoImg.onerror = onImagemFinalizada;
    armaImgs.forEach(img => {
      if (img) {
        img.onload = onImagemFinalizada;
        img.onerror = onImagemFinalizada;
      }
    });

    if (mostrarLogo && logoSrc) logoImg.src = logoSrc;
    armaImgs.forEach((img, idx) => {
      if (img && fotosParaAnuncio[idx]) {
        img.src = fotosParaAnuncio[idx];
      }
    });

    if (totalParaCarregar === 0) {
      dispararRender();
    }

    const timer = setTimeout(() => {
      dispararRender();
    }, 450);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    arma,
    formato,
    temaVisual,
    seloPrincipal,
    baloesAtivos,
    mostrarPreco,
    mostrarCalibre,
    mostrarAcessorios,
    mostrarEstado,
    mostrarContato,
    mostrarLogo,
    ajustesSlots,
    ajustesLayout,
    slotAtivoEdicao,
    fotoAtual,
    fotosLocais,
    layoutFotos,
    nomeLoja,
    telefoneLoja,
    cidadeLoja
  ]);

  // Função para baixar a imagem PNG gerada limpa (sem guias de edição)
  const baixarImagem = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    desenhandoParaDownloadRef.current = true;
    renderRef.current?.();

    const link = document.createElement('a');
    link.download = `Anuncio_${arma.fabricante}_${arma.modelo}_${formato}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    desenhandoParaDownloadRef.current = false;
    renderRef.current?.();
  };

  // Copiar legenda para o WhatsApp
  const copiarTexto = () => {
    navigator.clipboard.writeText(textoAnuncio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  // Salvar Chave do Gemini e executar
  const handleSalvarChaveGemini = () => {
    if (chaveGeminiInput.trim()) {
      localStorage.setItem('gemini_api_key', chaveGeminiInput.trim());
      setMostrarConfigChave(false);
      gerarComGemini();
    }
  };

  // Chamada ao Gemini IA para gerar copy persuasiva com fallback multi-modelos e local
  const gerarComGemini = async () => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || chaveGeminiInput.trim();

    if (!key) {
      setMostrarConfigChave(true);
      return;
    }

    try {
      setGerandoIa(true);

      const promptInstrucao = `
Você é um especialista em marketing bélico e despachante para CACs e atiradores.
Crie um anúncio persuasivo para WhatsApp / Redes Sociais da seguinte arma à venda:
- Fabricante: ${arma.fabricante}
- Modelo: ${arma.modelo}
- Tipo: ${arma.tipo}
- Calibre: ${arma.calibre}
- Registro: ${arma.sigmaSinarm || 'SIGMA'}
- Capacidade: ${arma.capacidade || 'Padrão'}
- Acabamento: ${arma.acabamento || 'Original'}
- Estado de Conservação: ${arma.estadoConservacao}
- Acessórios inclusos: ${arma.acessorios || 'Padrão'}
- Valor: ${mostrarPreco ? formatarMoeda(arma.valorAnunciado) : 'Sob Consulta'}
- Escritório / Despachante: ${nomeLoja} (${telefoneLoja} - ${cidadeLoja})

Estilo: ${tomIa === 'comercial' ? 'Altamente comercial, com gatilhos de oportunidade e exclusividade' : tomIa === 'tecnico' ? 'Foco nas especificações balísticas, precisão e confiabilidade da arma' : 'Super direto e rápido para Status do WhatsApp'}.
Mantenha emojis de armas/tiro/fogo, bullet points claros e destaque a exigência legal de transferência obrigatória (SIGMA/SINARM).
`;

      const endpoints = [
        { ver: 'v1beta', mod: 'gemini-2.5-flash' },
        { ver: 'v1beta', mod: 'gemini-1.5-flash' },
        { ver: 'v1', mod: 'gemini-1.5-flash' },
        { ver: 'v1beta', mod: 'gemini-2.0-flash' },
        { ver: 'v1', mod: 'gemini-pro' }
      ];

      let textoGerado = '';

      for (const ep of endpoints) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/${ep.ver}/models/${ep.mod}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptInstrucao }] }]
              })
            }
          );

          if (!res.ok) continue;

          const json = await res.json();
          const resposta = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resposta && resposta.trim()) {
            textoGerado = resposta.trim();
            break;
          }
        } catch {
          // tenta próximo endpoint
        }
      }

      if (textoGerado) {
        setTextoAnuncio(textoGerado);
      } else {
        setTextoAnuncio(gerarTextoPadrao(tomIa));
        setMostrarConfigChave(true);
      }
    } catch (e: any) {
      console.error('Erro na IA:', e);
      setTextoAnuncio(gerarTextoPadrao(tomIa));
    } finally {
      setGerandoIa(false);
    }
  };

  // Fechar com a tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-hidden"
      >
        <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
          {/* Top Header Fixo / Sticky que NUNCA sai da tela */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-dark-5 bg-[#0d121a] shrink-0 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Gerador de Anúncio Oficial GCAC
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {arma.fabricante} {arma.modelo}
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Arte premium oficial do escritório pronta para WhatsApp, Instagram e Redes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-dark-4 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-brand-dark-5 hover:border-red-500/30 transition-all font-semibold text-xs"
              title="Fechar janela (Esc)"
            >
              <span>Fechar</span>
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo Grid com Scroll Interno Independente */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
            {/* Coluna Esquerda: Preview do Canvas (Imagem Gerada) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-3">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Eye size={14} className="text-amber-400" /> Pré-visualização da Arte Oficial
                </span>

                {/* Seletor de Formato (Feed 4:5, Quadrado 1:1, Stories 9:16) */}
                <div className="flex items-center bg-brand-dark-3 p-1 rounded-xl border border-brand-dark-5">
                  <button
                    type="button"
                    onClick={() => setFormato('feed')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      formato === 'feed'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid size={13} /> Feed (4:5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormato('quadrado')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      formato === 'quadrado'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Square size={13} /> Quadrado (1:1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormato('stories')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      formato === 'stories'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Smartphone size={13} /> Stories (9:16)
                  </button>
                </div>
              </div>

              {/* Barra de Ações Rápidas de Foto (Caso a foto não tenha sido cadastrada ou precise trocar) */}
              <div className="flex items-center justify-between w-full mb-2 px-3 py-2 bg-brand-dark-3/70 border border-brand-dark-5 rounded-xl text-xs">
                <span className="text-gray-300 flex items-center gap-1.5 font-medium">
                  <Camera size={14} className="text-amber-400" />
                  {fotosLocais.length > 0 ? `${fotosLocais.length} foto(s) da arma` : 'Arma sem foto ainda'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQrAberto(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <QrCode size={13} /> Foto Celular
                  </button>

                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-200 bg-brand-dark-4 hover:bg-brand-dark-5 border border-brand-dark-5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors">
                    <Upload size={13} /> Anexar Fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadComputador}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Canvas Container com Zoom Adaptativo */}
              <div className="relative w-full flex items-center justify-center p-3 bg-[#0a0d14] border border-brand-dark-5 rounded-2xl overflow-hidden min-h-[500px]">
                {(gerandoImagem || salvandoFoto) && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-10 text-amber-400 gap-2 text-xs font-bold">
                    <RefreshCw size={18} className="animate-spin" />
                    {salvandoFoto ? 'Salvando foto na arma...' : 'Renderizando Flyer Oficial...'}
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  style={{
                    maxWidth: '100%',
                    maxHeight: formato === 'quadrado' ? '500px' : '560px',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    cursor: isDraggingCanvas ? 'grabbing' : 'crosshair'
                  }}
                  title="Clique na foto ou arraste para ajustar posição e textos na arte"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                <span className="flex items-center gap-1.5 text-amber-300/90 font-medium">
                  <Move size={12} className="text-amber-400" />
                  Clique em qualquer foto ou arraste elementos na arte para ajustar
                </span>
                <span className="text-gray-400">
                  Foto selecionada: <strong className="text-amber-400">#{slotAtivoEdicao + 1}</strong>
                </span>
              </div>

              {/* Gerenciador Completo de Fotos da Arma no Anúncio */}
              <div className="w-full mt-3 p-3 bg-brand-dark-3/60 border border-brand-dark-5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-400" />
                    Galeria de Fotos ({fotosLocais.length})
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {layoutFotos === '1'
                      ? 'Clique na estrela para definir a capa do anúncio'
                      : `Primeiras ${layoutFotos} fotos aparecem na arte`}
                  </span>
                </div>

                {fotosLocais.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-brand-dark-5 rounded-lg text-xs text-gray-400">
                    Nenhuma foto anexada. Clique em "Anexar Fotos" ou "Foto Celular" acima!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {fotosLocais.map((f, i) => {
                      const noLayout = i < Number(layoutFotos);
                      const ehCapa = i === 0;

                      return (
                        <div
                          key={i}
                          className={`relative rounded-xl overflow-hidden border-2 bg-black/40 group aspect-video transition-all ${
                            fotoSelecionadaIdx === i
                              ? 'ring-2 ring-amber-400'
                              : ''
                          } ${
                            noLayout
                              ? 'border-amber-400/80 shadow-md shadow-amber-500/10'
                              : 'border-brand-dark-5 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={f} alt="" className="w-full h-full object-cover" />

                          {/* Badge de Posição / Status */}
                          <div className="absolute top-1 left-1 flex items-center gap-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow ${
                              ehCapa
                                ? 'bg-amber-500 text-black'
                                : noLayout
                                ? 'bg-cyan-500 text-black'
                                : 'bg-gray-800 text-gray-300'
                            }`}>
                              #{i + 1} {ehCapa ? 'CAPA' : noLayout ? 'NO ANÚNCIO' : ''}
                            </span>
                          </div>

                          {/* Overlay com Ações */}
                          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoverFoto(i, 'esquerda')}
                                title="Mover para esquerda"
                                className="p-1 rounded bg-brand-dark-4 hover:bg-brand-dark-5 text-white"
                              >
                                <ChevronLeft size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setFotoSelecionadaIdx(i);
                                handleDefinirComoCapa(i);
                              }}
                              title="Tornar Foto Principal (Capa / Slot 1)"
                              className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-black"
                            >
                              <Star size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoverFoto(i)}
                              title="Excluir Foto"
                              className="p-1 rounded bg-red-600 hover:bg-red-500 text-white"
                            >
                              <Trash2 size={13} />
                            </button>
                            {i < fotosLocais.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoverFoto(i, 'direita')}
                                title="Mover para direita"
                                className="p-1 rounded bg-brand-dark-4 hover:bg-brand-dark-5 text-white"
                              >
                                <ChevronRight size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botão Principal de Download da Imagem */}
              <button
                type="button"
                onClick={baixarImagem}
                className="mt-4 w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.99]"
              >
                <Download size={18} /> Baixar Imagem Oficial do Anúncio (PNG)
              </button>
            </div>

            {/* Coluna Direita: Personalização e Texto WhatsApp com Gemini */}
            <div className="lg:col-span-5 flex flex-col gap-4">

              {/* Bloco 0: Layout de Fotos no Anúncio */}
              <div className="p-3.5 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutGrid size={14} className="text-amber-400" /> Fotos no Anúncio
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {fotosLocais.length} foto(s) anexada(s)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setLayoutFotos('1')}
                    className={`py-2 px-1 rounded-lg text-center border font-bold text-xs transition-all ${
                      layoutFotos === '1'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-xs scale-[1.02]'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">🖼️ 1</div>
                    <span className="text-[10px] block leading-tight">Única</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutFotos('2')}
                    className={`py-2 px-1 rounded-lg text-center border font-bold text-xs transition-all ${
                      layoutFotos === '2'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-xs scale-[1.02]'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">👥 2</div>
                    <span className="text-[10px] block leading-tight">Dupla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutFotos('3')}
                    className={`py-2 px-1 rounded-lg text-center border font-bold text-xs transition-all ${
                      layoutFotos === '3'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-xs scale-[1.02]'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">📐 3</div>
                    <span className="text-[10px] block leading-tight">Trio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutFotos('4')}
                    className={`py-2 px-1 rounded-lg text-center border font-bold text-xs transition-all ${
                      layoutFotos === '4'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-xs scale-[1.02]'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">⊞ 4</div>
                    <span className="text-[10px] block leading-tight">Grade 4x</span>
                  </button>
                </div>

                {fotosLocais.length < Number(layoutFotos) && (
                  <p className="text-[10px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    💡 Anexe mais ${Number(layoutFotos) - fotosLocais.length} foto(s) para preencher todos os ${layoutFotos} slots do anúncio!
                  </p>
                )}
              </div>

              {/* Bloco 1: Tema Visual da Arte */}
              <div className="p-3.5 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-2">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={14} className="text-amber-400" /> Tema Visual do Anúncio
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTemaVisual('azul_tatico')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      temaVisual === 'azul_tatico'
                        ? 'bg-blue-600/30 text-cyan-300 border-cyan-400 shadow-xs'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    🛡️ Azul Tático
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaVisual('dark_stealth')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      temaVisual === 'dark_stealth'
                        ? 'bg-gray-700/50 text-white border-gray-400 shadow-xs'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    ⚔️ Dark Stealth
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaVisual('gold_luxury')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      temaVisual === 'gold_luxury'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-xs'
                        : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                    }`}
                  >
                    👑 Gold Luxury
                  </button>
                </div>
              </div>

              {/* Bloco 2: Edição & Customização Avançada (Fotos & Layout do Folder) */}
              <div className="p-4 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-3.5">
                {/* Abas Superiores de Alternância de Edição */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-brand-dark-4/90 rounded-xl border border-brand-dark-5">
                  <button
                    type="button"
                    onClick={() => setAbaEdicao('fotos')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      abaEdicao === 'fotos'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-brand-dark-5'
                    }`}
                  >
                    <Sparkles size={14} className={abaEdicao === 'fotos' ? 'text-black' : 'text-amber-400'} />
                    Enquadrar Fotos ({layoutFotos})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbaEdicao('textos')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      abaEdicao === 'textos'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-brand-dark-5'
                    }`}
                  >
                    <Type size={14} className={abaEdicao === 'textos' ? 'text-black' : 'text-cyan-400'} />
                    Textos & Layout
                  </button>
                </div>

                {/* CONTEÚDO DA ABA 1: ENQUADRAMENTO DE FOTOS */}
                {abaEdicao === 'fotos' && (
                  <div className="space-y-3">
                    {/* Seletor de Foto do Layout quando houver mais de 1 foto */}
                    {Number(layoutFotos) > 1 && (
                      <div className="space-y-1.5 pb-1 border-b border-brand-dark-5">
                        <div className="flex items-center justify-between text-[11px] text-gray-300">
                          <span className="font-semibold flex items-center gap-1">
                            <ImageIcon size={12} className="text-amber-400" />
                            Foto em Edição:
                          </span>
                          <span className="text-cyan-400 font-semibold text-[10px]">
                            Clique na imagem na arte para selecionar
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {Array.from({ length: Number(layoutFotos) }).map((_, idx) => {
                            const isAtivo = slotAtivoEdicao === idx;
                            const rotuloSlot = layoutFotos === '2'
                              ? (idx === 0 ? 'Foto 1 (Lado A)' : 'Foto 2 (Lado B)')
                              : layoutFotos === '3'
                              ? (idx === 0 ? 'Foto 1 (Principal)' : idx === 1 ? 'Foto 2 (Det. 1)' : 'Foto 3 (Det. 2)')
                              : `Foto ${idx + 1}`;
                            const fotoThumb = fotosLocais[idx] || fotosLocais[0];
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSlotAtivoEdicao(idx)}
                                className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                  isAtivo
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400/50 shadow-xs'
                                    : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white hover:bg-brand-dark-5'
                                }`}
                              >
                                {fotoThumb ? (
                                  <img src={fotoThumb} alt="" className="w-5 h-5 rounded object-cover border border-white/20 shrink-0" />
                                ) : (
                                  <ImageIcon size={14} className="shrink-0" />
                                )}
                                <span className="truncate">{rotuloSlot}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cabeçalho de Ações da Foto Selecionada */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-400" />
                        Ajustes da Foto #{slotAtivoEdicao + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {(slotAtivo.zoom !== 105 || slotAtivo.modo !== 'conter' || slotAtivo.posY !== 0 || slotAtivo.posX !== 0 || slotAtivo.rotacao !== 0 || slotAtivo.espelhar || slotAtivo.filtroRealce) && (
                          <button
                            type="button"
                            onClick={redefinirSlotAtivo}
                            className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                          >
                            Redefinir Esta
                          </button>
                        )}
                        {Number(layoutFotos) > 1 && (
                          <button
                            type="button"
                            onClick={redefinirTodosSlots}
                            className="text-[10px] text-gray-400 hover:text-gray-300 font-medium"
                            title="Redefinir ajustes de todas as fotos para o padrão"
                          >
                            Redefinir Todas
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas: Girar, Espelhar e Realce HD */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => atualizarSlotAtivo('rotacao', (slotAtivo.rotacao + 90) % 360)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-200 border border-brand-dark-5 font-semibold transition-all active:scale-95"
                        title="Girar imagem 90 graus"
                      >
                        <RotateCw size={13} className="text-cyan-400" />
                        <span>Girar {slotAtivo.rotacao > 0 ? `${slotAtivo.rotacao}°` : '90°'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => atualizarSlotAtivo('espelhar', !slotAtivo.espelhar)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-semibold transition-all active:scale-95 ${
                          slotAtivo.espelhar
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                            : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-200 border-brand-dark-5'
                        }`}
                        title="Inverter direção da arma horizontalmente"
                      >
                        <FlipHorizontal size={13} className="text-amber-400" />
                        <span>Espelhar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => atualizarSlotAtivo('filtroRealce', !slotAtivo.filtroRealce)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-semibold transition-all active:scale-95 ${
                          slotAtivo.filtroRealce
                            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                            : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-200 border-brand-dark-5'
                        }`}
                        title="Realçar iluminação, nitidez e contraste HD"
                      >
                        <SunMedium size={13} className="text-emerald-400" />
                        <span>Realce HD</span>
                      </button>
                    </div>

                    {/* Modo de Ajuste: Conter vs Preencher */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => atualizarSlotAtivo('modo', 'conter')}
                        className={`py-1.5 px-3 rounded-lg border font-semibold transition-all ${
                          slotAtivo.modo === 'conter'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                            : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                        }`}
                      >
                        Foto Inteira (Conter)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          atualizarSlotAtivo('modo', 'preencher');
                          if (slotAtivo.zoom < 110) atualizarSlotAtivo('zoom', 115);
                        }}
                        className={`py-1.5 px-3 rounded-lg border font-semibold transition-all ${
                          slotAtivo.modo === 'preencher'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                            : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                        }`}
                      >
                        Preencher Vitrine (Zoom)
                      </button>
                    </div>

                    {/* Sliders da Foto Selecionada: Zoom, Vertical e Horizontal */}
                    <div className="space-y-2 pt-1 text-xs">
                      <div>
                        <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                          <span className="flex items-center gap-1">
                            <ZoomIn size={12} className="text-amber-400" />
                            Zoom da Foto #{slotAtivoEdicao + 1}:
                          </span>
                          <span className="font-bold text-amber-400">{slotAtivo.zoom}%</span>
                        </div>
                        <input
                          type="range"
                          min={80}
                          max={200}
                          step={5}
                          value={slotAtivo.zoom}
                          onChange={e => atualizarSlotAtivo('zoom', Number(e.target.value))}
                          className="w-full h-1.5 bg-brand-dark-4 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                            <span>Ajuste Vertical:</span>
                            <span className="font-bold text-cyan-400">
                              {slotAtivo.posY > 0 ? `+${slotAtivo.posY}%` : `${slotAtivo.posY}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            step={2}
                            value={slotAtivo.posY}
                            onChange={e => atualizarSlotAtivo('posY', Number(e.target.value))}
                            className="w-full h-1.5 bg-brand-dark-4 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                            <span>Ajuste Horizontal:</span>
                            <span className="font-bold text-cyan-400">
                              {slotAtivo.posX > 0 ? `+${slotAtivo.posX}%` : `${slotAtivo.posX}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            step={2}
                            value={slotAtivo.posX}
                            onChange={e => atualizarSlotAtivo('posX', Number(e.target.value))}
                            className="w-full h-1.5 bg-brand-dark-4 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTEÚDO DA ABA 2: AJUSTES DE TEXTOS & LAYOUT DO FOLDER */}
                {abaEdicao === 'textos' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-cyan-400" />
                        Fontes & Posicionamento
                      </span>
                      {(ajustesLayout.offsetFonteModelo !== 0 ||
                        ajustesLayout.offsetPosicaoYTextos !== 0 ||
                        ajustesLayout.offsetPosicaoXTextos !== 0 ||
                        ajustesLayout.offsetFonteFabricante !== 0 ||
                        ajustesLayout.offsetFonteCalibre !== 0 ||
                        ajustesLayout.offsetFontePreco !== 0 ||
                        ajustesLayout.offsetPosicaoYPreco !== 0 ||
                        ajustesLayout.offsetFonteSpecs !== 0 ||
                        ajustesLayout.offsetPosicaoYSpecs !== 0) && (
                        <button
                          type="button"
                          onClick={redefinirLayoutFolder}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                        >
                          Redefinir Padrão
                        </button>
                      )}
                    </div>

                    {/* Bloco 1: Nome e Modelo da Arma */}
                    <div className="p-2.5 rounded-lg bg-brand-dark-4/70 border border-brand-dark-5 space-y-2">
                      <div className="flex items-center justify-between text-gray-200 font-bold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Type size={12} className="text-amber-400" />
                          Nome / Modelo da Arma:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setAjustesLayout(prev => ({ ...prev, offsetFonteModelo: Math.max(-14, prev.offsetFonteModelo - 2) }))}
                            className="px-1.5 py-0.5 rounded bg-brand-dark-3 hover:bg-brand-dark-5 text-gray-300 text-[10px]"
                            title="Diminuir fonte do modelo"
                          >
                            A-
                          </button>
                          <span className="text-amber-400 font-bold min-w-[32px] text-center">
                            {ajustesLayout.offsetFonteModelo > 0 ? `+${ajustesLayout.offsetFonteModelo}px` : `${ajustesLayout.offsetFonteModelo}px`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAjustesLayout(prev => ({ ...prev, offsetFonteModelo: Math.min(20, prev.offsetFonteModelo + 2) }))}
                            className="px-1.5 py-0.5 rounded bg-brand-dark-3 hover:bg-brand-dark-5 text-gray-300 text-[10px]"
                            title="Aumentar fonte do modelo"
                          >
                            A+
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-14}
                        max={20}
                        step={1}
                        value={ajustesLayout.offsetFonteModelo}
                        onChange={e => setAjustesLayout(prev => ({ ...prev, offsetFonteModelo: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />

                      {/* Posição Vertical e Horizontal dos Textos */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                            <span>Subir / Descer Texto:</span>
                            <span className="text-cyan-400 font-bold">
                              {ajustesLayout.offsetPosicaoYTextos > 0 ? `+${ajustesLayout.offsetPosicaoYTextos}px` : `${ajustesLayout.offsetPosicaoYTextos}px`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-60}
                            max={60}
                            step={2}
                            value={ajustesLayout.offsetPosicaoYTextos}
                            onChange={e => setAjustesLayout(prev => ({ ...prev, offsetPosicaoYTextos: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                            <span>Mover Esq / Dir:</span>
                            <span className="text-cyan-400 font-bold">
                              {ajustesLayout.offsetPosicaoXTextos > 0 ? `+${ajustesLayout.offsetPosicaoXTextos}px` : `${ajustesLayout.offsetPosicaoXTextos}px`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            step={2}
                            value={ajustesLayout.offsetPosicaoXTextos}
                            onChange={e => setAjustesLayout(prev => ({ ...prev, offsetPosicaoXTextos: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Faixa de Preço */}
                    {mostrarPreco && (
                      <div className="p-2.5 rounded-lg bg-brand-dark-4/70 border border-brand-dark-5 space-y-2">
                        <div className="flex items-center justify-between text-gray-200 font-bold text-[11px]">
                          <span>Faixa de Preço Dourada:</span>
                          <span className="text-amber-400 font-bold">
                            {ajustesLayout.offsetFontePreco > 0 ? `+${ajustesLayout.offsetFontePreco}px` : `${ajustesLayout.offsetFontePreco}px`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                              <span>Tamanho Fonte Preço:</span>
                            </div>
                            <input
                              type="range"
                              min={-14}
                              max={20}
                              step={2}
                              value={ajustesLayout.offsetFontePreco}
                              onChange={e => setAjustesLayout(prev => ({ ...prev, offsetFontePreco: Number(e.target.value) }))}
                              className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                              <span>Posição Vertical:</span>
                              <span className="text-cyan-400 font-bold">
                                {ajustesLayout.offsetPosicaoYPreco > 0 ? `+${ajustesLayout.offsetPosicaoYPreco}px` : `${ajustesLayout.offsetPosicaoYPreco}px`}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-50}
                              max={50}
                              step={2}
                              value={ajustesLayout.offsetPosicaoYPreco}
                              onChange={e => setAjustesLayout(prev => ({ ...prev, offsetPosicaoYPreco: Number(e.target.value) }))}
                              className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bloco 3: Cards de Especificações Técnicas */}
                    <div className="p-2.5 rounded-lg bg-brand-dark-4/70 border border-brand-dark-5 space-y-2">
                      <div className="flex items-center justify-between text-gray-200 font-bold text-[11px]">
                        <span>Cards de Especificações Técnicas:</span>
                        <span className="text-cyan-400 font-bold">
                          {ajustesLayout.offsetPosicaoYSpecs > 0 ? `+${ajustesLayout.offsetPosicaoYSpecs}px` : `${ajustesLayout.offsetPosicaoYSpecs}px`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                            <span>Tamanho dos Dados:</span>
                            <span className="text-gray-300 font-bold">
                              {ajustesLayout.offsetFonteSpecs > 0 ? `+${ajustesLayout.offsetFonteSpecs}px` : `${ajustesLayout.offsetFonteSpecs}px`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-6}
                            max={8}
                            step={1}
                            value={ajustesLayout.offsetFonteSpecs}
                            onChange={e => setAjustesLayout(prev => ({ ...prev, offsetFonteSpecs: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-gray-300 text-[10px] mb-1">
                            <span>Posição Vertical:</span>
                          </div>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            step={2}
                            value={ajustesLayout.offsetPosicaoYSpecs}
                            onChange={e => setAjustesLayout(prev => ({ ...prev, offsetPosicaoYSpecs: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-brand-dark-5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bloco 3: Selos e Balões Promocionais (Gatilhos de Venda) */}
              <div className="p-4 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} className="text-amber-400" /> Selos & Balões de Destaque
                  </span>
                  <span className="text-[10px] text-gray-400">Até 3 balões ativos</span>
                </div>

                {/* Selo Principal Dourado */}
                <div>
                  <label className="text-[11px] text-gray-300 font-medium block mb-1.5">
                    Selo de Cabeçalho Superior:
                  </label>
                  <select
                    value={seloPrincipal}
                    onChange={e => setSeloPrincipal(e.target.value)}
                    className="w-full bg-brand-dark-4 text-xs text-amber-300 font-bold rounded-lg px-2.5 py-1.5 border border-brand-dark-5 focus:border-amber-500 focus:outline-none"
                  >
                    {OPCOES_SELOS.map(selo => (
                      <option key={selo} value={selo}>
                        {selo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chips de Balões Promocionais Flutuantes */}
                <div>
                  <label className="text-[11px] text-gray-300 font-medium block mb-1.5">
                    Balões Promocionais (Clique para ativar/desativar):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {OPCOES_BALOES.map(balao => {
                      const ativo = baloesAtivos.includes(balao);
                      return (
                        <button
                          key={balao}
                          type="button"
                          onClick={() => {
                            if (ativo) {
                              setBaloesAtivos(baloesAtivos.filter(b => b !== balao));
                            } else {
                              if (baloesAtivos.length >= 3) {
                                setBaloesAtivos([...baloesAtivos.slice(1), balao]);
                              } else {
                                setBaloesAtivos([...baloesAtivos, balao]);
                              }
                            }
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                            ativo
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                              : 'bg-brand-dark-4 text-gray-400 border-brand-dark-5 hover:text-white'
                          }`}
                        >
                          {ativo ? `✓ ${balao}` : `+ ${balao}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bloco 4: Opções de Elementos Visíveis */}
              <div className="p-3.5 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-2.5">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                  Elementos Visíveis na Imagem
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarPreco}
                      onChange={e => setMostrarPreco(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Preço de Venda
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarCalibre}
                      onChange={e => setMostrarCalibre(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Calibre da Arma
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarAcessorios}
                      onChange={e => setMostrarAcessorios(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Acessórios Inclusos
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarEstado}
                      onChange={e => setMostrarEstado(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Estado / Condição
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarContato}
                      onChange={e => setMostrarContato(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Contato / WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mostrarLogo}
                      onChange={e => setMostrarLogo(e.target.checked)}
                      className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    Logo Oficial GCAC
                  </label>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 mt-2">
                  <Shield size={13} className="shrink-0" />
                  <span>Sigilo Ativo: Nome do antigo dono e Nº de Série ficam sempre ocultos do público.</span>
                </div>
              </div>

              {/* Bloco de Texto / WhatsApp com Gemini IA */}
              <div className="p-4 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 size={14} className="text-amber-400" /> Legenda para WhatsApp / Redes
                  </span>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={tomIa}
                      onChange={e => setTomIa(e.target.value as any)}
                      className="bg-brand-dark-4 text-[11px] text-gray-300 rounded-lg px-2 py-1 border border-brand-dark-5"
                    >
                      <option value="comercial">Comercial</option>
                      <option value="tecnico">Técnico</option>
                      <option value="curto">Rápido / Status</option>
                    </select>

                    <button
                      type="button"
                      onClick={gerarComGemini}
                      disabled={gerandoIa}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 transition-colors"
                    >
                      <Sparkles size={12} className={gerandoIa ? 'animate-spin' : ''} />
                      {gerandoIa ? 'Gerando...' : 'Gemini IA'}
                    </button>
                  </div>
                </div>

                {/* Painel Amigável para Inserir Chave Gemini caso ainda não configurada */}
                {mostrarConfigChave && (
                  <div className="mb-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-2 text-xs animate-fade-in">
                    <div className="flex items-center justify-between text-indigo-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Key size={13} /> Ativar Assistente Gemini IA
                      </span>
                      <button
                        type="button"
                        onClick={() => setMostrarConfigChave(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      Cole sua chave da API do Google Gemini (gratuita) para gerar copies persuasivas:
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        value={chaveGeminiInput}
                        onChange={e => setChaveGeminiInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="input flex-1 text-xs py-1.5 bg-[#0a0d14]"
                      />
                      <button
                        type="button"
                        onClick={handleSalvarChaveGemini}
                        disabled={!chaveGeminiInput.trim()}
                        className="btn-primary text-xs px-3 py-1.5 font-bold shrink-0"
                      >
                        Salvar & Gerar
                      </button>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      Obter chave gratuita no Google AI Studio <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {/* Textarea 100% legível com fundo escuro sólido e texto claro */}
                <textarea
                  value={textoAnuncio}
                  onChange={e => setTextoAnuncio(e.target.value)}
                  rows={11}
                  style={{ backgroundColor: '#0c1017', color: '#f3f4f6' }}
                  className="w-full flex-1 bg-[#0c1017] text-gray-100 border border-gray-700/80 rounded-xl p-3 text-xs font-sans leading-relaxed resize-none focus:border-amber-500 focus:outline-none shadow-inner"
                  placeholder="Texto do anúncio..."
                />

                <button
                  type="button"
                  onClick={copiarTexto}
                  className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
                    copiado
                      ? 'bg-emerald-600 text-white'
                      : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-200 border border-brand-dark-5'
                  }`}
                >
                  {copiado ? (
                    <>
                      <Check size={16} /> Texto Copiado para a Área de Transferência!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Copiar Texto para o WhatsApp
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal QR Code para fotografar direto pelo celular sem sair do gerador */}
      <ModalUploadCelular
        isOpen={modalQrAberto}
        onClose={() => setModalQrAberto(false)}
        titulo="Fotografar Arma com o Celular"
        onUploadSuccess={async (url) => {
          if (!url) return;
          await handleAdicionarFoto(url);
          setModalQrAberto(false);
        }}
      />
    </>
  );
}
