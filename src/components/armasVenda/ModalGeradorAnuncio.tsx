import React, { useState, useEffect, useRef } from 'react';
import {
  X, Download, Copy, Check, Sparkles, Image as ImageIcon,
  Share2, Shield, Eye, Smartphone, LayoutGrid, AlertCircle, RefreshCw,
  Key, ExternalLink
} from 'lucide-react';
import { ArmaVenda } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatarMoeda } from '../../utils/formatters';

interface ModalGeradorAnuncioProps {
  arma: ArmaVenda;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalGeradorAnuncio({ arma, isOpen, onClose }: ModalGeradorAnuncioProps) {
  const { usuario } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Opções de personalização visual
  const [formato, setFormato] = useState<'quadrado' | 'stories'>('quadrado');
  const [mostrarPreco, setMostrarPreco] = useState(true);
  const [mostrarCalibre, setMostrarCalibre] = useState(true);
  const [mostrarAcessorios, setMostrarAcessorios] = useState(true);
  const [mostrarEstado, setMostrarEstado] = useState(true);
  const [mostrarContato, setMostrarContato] = useState(true);
  const [mostrarLogo, setMostrarLogo] = useState(true);
  const [fotoSelecionadaIdx, setFotoSelecionadaIdx] = useState(0);

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

  const listaFotos = arma.fotos && arma.fotos.length > 0
    ? arma.fotos
    : (arma.fotoPrincipal ? [arma.fotoPrincipal] : []);

  const fotoAtual = listaFotos[fotoSelecionadaIdx] || arma.fotoPrincipal || '';

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

  // Função para desenhar no Canvas baseado no modelo oficial GCAC
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGerandoImagem(true);

    // Formato Feed 1080x1350 (proporção 4:5 oficial) ou Stories 1080x1920
    const largura = 1080;
    const altura = formato === 'quadrado' ? 1350 : 1920;
    canvas.width = largura;
    canvas.height = altura;

    // 1. FUNDO AZUL MEIA-NOITE GRADIENTE PROFUNDO
    const bgGrad = ctx.createLinearGradient(0, 0, 0, altura);
    bgGrad.addColorStop(0, '#010814');
    bgGrad.addColorStop(0.2, '#03142e');
    bgGrad.addColorStop(0.5, '#051f47');
    bgGrad.addColorStop(0.8, '#03142e');
    bgGrad.addColorStop(1, '#01060f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, largura, altura);

    // Glow azul marinho central
    const glowGrad = ctx.createRadialGradient(largura / 2, altura * 0.42, 50, largura / 2, altura * 0.42, 520);
    glowGrad.addColorStop(0, 'rgba(29, 78, 216, 0.28)');
    glowGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.08)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, largura, altura);

    // 2. TEXTO NO TOPO (Acima da moldura)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('CATÁLOGO DE ARMAS USADAS • INTERMEDIAÇÃO LEGALIZADA', largura / 2, 42);

    // 3. MOLDURA DOURADA COM DETALHES TÁTICOS
    const pad = 46;
    const molduraW = largura - pad * 2;
    const molduraH = altura - pad * 2 - 20;
    const molduraY = 56;

    // Borda Dourada Externa
    ctx.strokeStyle = '#c59b27';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(pad, molduraY, molduraW, molduraH, 24);
    ctx.stroke();

    // Borda Interna Ciano Fina Luminosa
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pad + 6, molduraY + 6, molduraW - 12, molduraH - 12, 18);
    ctx.stroke();

    // Cantoneiras decorativas douradas
    const cSize = 24;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
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

    // Carregar Imagens (Logo Oficial e Arma)
    const logoImg = new Image();
    const armaImg = new Image();

    // Logo oficial anexada salva em /logo_oficial_gcac.png
    const logoSrc = '/logo_oficial_gcac.png';

    if (fotoAtual && (fotoAtual.startsWith('http://') || fotoAtual.startsWith('https://'))) {
      armaImg.crossOrigin = 'anonymous';
    }

    const renderConteudo = () => {
      let topY = molduraY + 20;

      // 4. LOGO OFICIAL CENTRALIZADA
      if (mostrarLogo && logoImg.complete && logoImg.naturalWidth > 0) {
        const logoH = 115;
        const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
        ctx.drawImage(logoImg, (largura - logoW) / 2, topY, logoW, logoH);
        topY += logoH + 20;
      } else {
        topY += 40;
      }

      // Linha separadora luminosa
      const sepGrad = ctx.createLinearGradient(pad + 60, 0, pad + molduraW - 60, 0);
      sepGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      sepGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
      sepGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.strokeStyle = sepGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad + 60, topY);
      ctx.lineTo(pad + molduraW - 60, topY);
      ctx.stroke();
      topY += 28;

      // 5. BADGES: [★ SEMINOVA REVISADA] (Esq) e [DISPONÍVEL] (Dir)
      const badgeY = topY;
      // Badge Esquerda Dourada
      const bgBadgeDourada = ctx.createLinearGradient(pad + 40, 0, pad + 240, 0);
      bgBadgeDourada.addColorStop(0, '#c69519');
      bgBadgeDourada.addColorStop(1, '#eab308');
      ctx.fillStyle = bgBadgeDourada;
      ctx.beginPath();
      ctx.roundRect(pad + 35, badgeY, 210, 36, 10);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.font = '900 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ SEMINOVA REVISADA', pad + 35 + 105, badgeY + 23);

      // Badge Direita Azul Neon
      ctx.fillStyle = '#061733';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(pad + molduraW - 200, badgeY, 165, 36, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.fillText(arma.status === 'vendida' ? 'VENDIDA' : arma.status === 'reservada' ? 'RESERVADA' : 'DISPONÍVEL', pad + molduraW - 200 + 82, badgeY + 23);

      topY += 45;

      // 6. BLOCO CENTRAL: TÍTULO DA ARMA (Esq) + FOTO DA ARMA (Dir)
      const blocoMeioY = topY;
      const blocoMeioH = formato === 'quadrado' ? 380 : 540;

      // Lado Esquerdo: NOME DA ARMA
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 30px "Segoe UI", sans-serif';
      ctx.fillText(arma.fabricante.toUpperCase(), pad + 40, blocoMeioY + 85);

      // Modelo Grande com Efeito Gradiente e Sombra
      const modeloGrad = ctx.createLinearGradient(pad + 40, blocoMeioY + 110, pad + 40, blocoMeioY + 190);
      modeloGrad.addColorStop(0, '#ffffff');
      modeloGrad.addColorStop(1, '#93c5fd');
      ctx.fillStyle = modeloGrad;
      ctx.font = '900 60px "Segoe UI", sans-serif';
      ctx.fillText(arma.modelo.toUpperCase(), pad + 40, blocoMeioY + 160);

      // Calibre em destaque azul celeste
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillText(`CALIBRE ${arma.calibre.toUpperCase()}`, pad + 40, blocoMeioY + 205);

      if (arma.sigmaSinarm) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 16px "Segoe UI", sans-serif';
        ctx.fillText(`REGISTRO: ${arma.sigmaSinarm}`, pad + 40, blocoMeioY + 238);
      }

      // Lado Direito: FOTO DA ARMA COM MOLDURA ELEGANTE E SOMBRA
      const boxFotoW = 540;
      const boxFotoH = blocoMeioH - 40;
      const boxFotoX = largura - pad - boxFotoW - 20;
      const boxFotoY = blocoMeioY + 10;

      ctx.save();
      // Glow suave de fundo para destacar a arma
      const fotoGlow = ctx.createRadialGradient(boxFotoX + boxFotoW / 2, boxFotoY + boxFotoH / 2, 40, boxFotoX + boxFotoW / 2, boxFotoY + boxFotoH / 2, boxFotoW / 2);
      fotoGlow.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      fotoGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fotoGlow;
      ctx.fillRect(boxFotoX, boxFotoY, boxFotoW, boxFotoH);

      const temFotoValida = armaImg.complete && armaImg.naturalWidth > 0 && !fotoAtual.includes('application/pdf');

      if (temFotoValida) {
        // Redimensionar proporcional com contain
        const scale = Math.min((boxFotoW - 20) / armaImg.naturalWidth, (boxFotoH - 20) / armaImg.naturalHeight);
        const w = armaImg.naturalWidth * scale;
        const h = armaImg.naturalHeight * scale;
        const x = boxFotoX + (boxFotoW - w) / 2;
        const y = boxFotoY + (boxFotoH - h) / 2;

        // Sombra realista abaixo da arma
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 12;

        ctx.drawImage(armaImg, x, y, w, h);
      } else {
        // Placeholder estilizado
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(boxFotoX + 20, boxFotoY + 20, boxFotoW - 40, boxFotoH - 40, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FOTO NÃO DISPONÍVEL', boxFotoX + boxFotoW / 2, boxFotoY + boxFotoH / 2);
      }
      ctx.restore();

      topY += blocoMeioH + 5;

      // 7. GRADE DE 6 CAIXAS DE INFORMAÇÕES (2 Linhas x 3 Colunas)
      const gridW = molduraW - 70;
      const gridX = pad + 35;
      const boxW = (gridW - 30) / 3;
      const boxH = 58;

      const infos = [
        { label: 'CALIBRE:', val: arma.calibre },
        { label: 'CAPACIDADE:', val: arma.capacidade || '17+1' },
        { label: 'INCLUI:', val: arma.quantidadeCarregadores ? `0${arma.quantidadeCarregadores} CARREGADORES` : (arma.acessorios ? arma.acessorios.slice(0, 16) : 'ORIGINAL') },
        { label: 'ACABAMENTO:', val: arma.acabamento || 'OXIDADO' },
        { label: 'ESTADO:', val: arma.estadoConservacao.split(' ')[0].toUpperCase() },
        { label: 'SISTEMA:', val: arma.sigmaSinarm || 'SIGMA (CAC)' }
      ];

      infos.forEach((info, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = gridX + col * (boxW + 15);
        const by = topY + row * (boxH + 12);

        // Box Fundo Azul Meia-Noite
        ctx.fillStyle = '#041733';
        ctx.strokeStyle = '#1e4b85';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        // Rótulo
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillText(info.label, bx + boxW / 2, by + 20);

        // Valor
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 15px "Segoe UI", sans-serif';
        ctx.fillText(info.val.toUpperCase(), bx + boxW / 2, by + 43);
      });

      topY += (boxH * 2) + 26;

      // 8. FAIXA DOURADA DE PREÇO
      if (mostrarPreco) {
        const faixaW = gridW;
        const faixaH = 82;
        const faixaX = gridX;
        const faixaY = topY + 12;

        const douradoGrad = ctx.createLinearGradient(faixaX, 0, faixaX + faixaW, 0);
        douradoGrad.addColorStop(0, '#c7981b');
        douradoGrad.addColorStop(0.3, '#f5c842');
        douradoGrad.addColorStop(0.7, '#eab308');
        douradoGrad.addColorStop(1, '#b48512');

        ctx.fillStyle = douradoGrad;
        ctx.beginPath();
        ctx.roundRect(faixaX, faixaY, faixaW, faixaH, 16);
        ctx.fill();

        ctx.fillStyle = '#261601';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DE INVESTIMENTO', largura / 2, faixaY + 24);

        ctx.fillStyle = '#0a0a0a';
        ctx.font = '900 44px "Segoe UI", sans-serif';
        ctx.fillText(formatarMoeda(arma.valorAnunciado), largura / 2, faixaY + 65);

        topY += faixaH + 26;
      } else {
        topY += 35;
      }

      // 9. RODAPÉ DE CONTATOS DO ESCRITÓRIO
      const rodapeY = altura - pad - 60;

      if (mostrarContato) {
        // Ícone verde e WhatsApp
        ctx.textAlign = 'center';
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('💬', largura / 2 - 180, rodapeY);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px "Segoe UI", sans-serif';
        ctx.fillText(`WhatsApp: ${telefoneLoja}`, largura / 2, rodapeY);

        // Endereço e Cidade
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('📍', largura / 2 - 240, rodapeY + 28);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 15px "Segoe UI", sans-serif';
        ctx.fillText(cidadeLoja, largura / 2, rodapeY + 28);
      }

      // 10. TEXTO LEGAL FINAL FORA DA MOLDURA
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Venda autorizada sob intermediação legal. Transferência obrigatória pelo SIGMA/SINARM.',
        largura / 2,
        altura - 16
      );

      setGerandoImagem(false);
    };

    let executou = false;
    const dispararRender = () => {
      if (executou) return;
      executou = true;
      renderConteudo();
    };

    let totalParaCarregar = (mostrarLogo && logoSrc ? 1 : 0) + (fotoAtual ? 1 : 0);
    let concluidas = 0;

    const onImagemFinalizada = () => {
      concluidas++;
      if (concluidas >= totalParaCarregar) {
        dispararRender();
      }
    };

    logoImg.onload = onImagemFinalizada;
    logoImg.onerror = onImagemFinalizada;
    armaImg.onload = onImagemFinalizada;
    armaImg.onerror = onImagemFinalizada;

    if (mostrarLogo && logoSrc) logoImg.src = logoSrc;
    if (fotoAtual) armaImg.src = fotoAtual;

    if (totalParaCarregar === 0) {
      dispararRender();
    }

    // Timeout de segurança
    const timer = setTimeout(() => {
      dispararRender();
    }, 450);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    arma,
    formato,
    mostrarPreco,
    mostrarCalibre,
    mostrarAcessorios,
    mostrarEstado,
    mostrarContato,
    mostrarLogo,
    fotoAtual,
    nomeLoja,
    telefoneLoja,
    cidadeLoja
  ]);

  // Função para baixar a imagem PNG gerada
  const baixarImagem = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `Anuncio_${arma.fabricante}_${arma.modelo}_${formato}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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

  // Chamada ao Gemini IA para gerar copy persuasiva com fallback multi-modelos e fallback local
  const gerarComGemini = async () => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || chaveGeminiInput.trim();

    if (!key) {
      // Abre o mini formulário para inserir a chave facilmente sem travar
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
        // Se a chave for inválida ou todos os endpoints falharem, gera localmente com altíssima qualidade
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-brand-dark-2 border border-brand-dark-5 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-dark-5 bg-brand-dark-3/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Gerador de Anúncio Oficial GCAC
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {arma.fabricante} {arma.modelo}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Arte premium oficial do escritório pronta para WhatsApp, Instagram e Redes
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

        {/* Conteúdo Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Coluna Esquerda: Preview do Canvas (Imagem Gerada) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Eye size={14} className="text-amber-400" /> Pré-visualização da Arte Oficial
              </span>

              {/* Seletor de Formato */}
              <div className="flex items-center bg-brand-dark-3 p-1 rounded-xl border border-brand-dark-5">
                <button
                  type="button"
                  onClick={() => setFormato('quadrado')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    formato === 'quadrado'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid size={13} /> Feed (4:5)
                </button>
                <button
                  type="button"
                  onClick={() => setFormato('stories')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    formato === 'stories'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Smartphone size={13} /> Stories (9:16)
                </button>
              </div>
            </div>

            {/* Canvas Container com Zoom Adaptativo */}
            <div className="relative w-full flex items-center justify-center p-3 bg-[#0a0d14] border border-brand-dark-5 rounded-2xl overflow-hidden min-h-[500px]">
              {gerandoImagem && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10 text-amber-400 gap-2 text-xs font-bold">
                  <RefreshCw size={18} className="animate-spin" /> Renderizando Flyer Oficial...
                </div>
              )}
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: formato === 'quadrado' ? '500px' : '560px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                }}
              />
            </div>

            {/* Miniaturas de fotos da arma para escolher */}
            {listaFotos.length > 1 && (
              <div className="flex items-center gap-2 mt-3 w-full overflow-x-auto pb-2">
                <span className="text-[11px] text-gray-400 font-medium shrink-0">Foto no Card:</span>
                {listaFotos.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFotoSelecionadaIdx(i)}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      fotoSelecionadaIdx === i ? 'border-amber-400 scale-105' : 'border-brand-dark-5 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={f} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

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
            {/* Bloco de Opções Visuais */}
            <div className="p-4 rounded-xl bg-brand-dark-3/60 border border-brand-dark-5 space-y-2.5">
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
  );
}
