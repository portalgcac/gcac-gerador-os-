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
  const nomeLoja = dadosEmpresa?.razaoSocialFantasia || dadosEmpresa?.nome || usuario?.nome || 'Despachante & Clube de Tiro';
  const telefoneLoja = dadosEmpresa?.contatoTelefone || '';
  const cidadeLoja = dadosEmpresa?.endereco || '';

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

  // Função para desenhar no Canvas
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGerandoImagem(true);

    const largura = 1080;
    const altura = formato === 'quadrado' ? 1080 : 1920;
    canvas.width = largura;
    canvas.height = altura;

    // Fundo Degradê Tático Premium
    const bgGrad = ctx.createLinearGradient(0, 0, 0, altura);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(0.35, '#111827');
    bgGrad.addColorStop(0.7, '#0f172a');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, largura, altura);

    // Efeito de malha/glow sutil dourado / azul
    const glowGrad = ctx.createRadialGradient(largura / 2, altura * 0.45, 80, largura / 2, altura * 0.45, 500);
    glowGrad.addColorStop(0, 'rgba(30, 58, 138, 0.25)');
    glowGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.08)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, largura, altura);

    // Borda tática sutil
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, largura - 48, altura - 48);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, largura - 64, altura - 64);

    // Carregar Imagens auxiliares (Logo e Arma)
    const logoImg = new Image();
    const armaImg = new Image();

    const logoSrc = dadosEmpresa?.logoUrl || '/logo_oficial_documentos.png';

    // Apenas define crossOrigin se for URL remota (NUNCA em data:image base64)
    if (logoSrc && (logoSrc.startsWith('http://') || logoSrc.startsWith('https://'))) {
      logoImg.crossOrigin = 'anonymous';
    }
    if (fotoAtual && (fotoAtual.startsWith('http://') || fotoAtual.startsWith('https://'))) {
      armaImg.crossOrigin = 'anonymous';
    }

    const renderConteudo = () => {
      // 1. TOPO: Header com Logo e Nome
      let topY = 70;

      if (mostrarLogo) {
        try {
          if (logoImg.complete && logoImg.naturalWidth > 0) {
            const logoH = 75;
            const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
            ctx.drawImage(logoImg, (largura - logoW) / 2, topY, logoW, logoH);
            topY += logoH + 20;
          }
        } catch {
          // Fallback caso imagem da logo falhe
        }
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.fillText('CATÁLOGO DE ARMAS USADAS • INTERMEDIAÇÃO LEGALIZADA', largura / 2, topY + 10);
      topY += 35;

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px "Segoe UI", sans-serif';
      ctx.fillText(nomeLoja.toUpperCase(), largura / 2, topY + 10);
      topY += 40;

      // Linha divisória
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, topY);
      ctx.lineTo(largura - 120, topY);
      ctx.stroke();
      topY += 30;

      // 2. FOTO CENTRAL DA ARMA
      const boxFotoW = largura - 160;
      const boxFotoH = formato === 'quadrado' ? 380 : 620;
      const boxFotoX = 80;
      const boxFotoY = topY;

      // Moldura da foto com fundo escuro e cantos arredondados
      ctx.save();
      ctx.fillStyle = '#05070b';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxFotoX, boxFotoY, boxFotoW, boxFotoH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.clip();

      const temFotoValida = armaImg.complete && armaImg.naturalWidth > 0 && !fotoAtual.includes('application/pdf');

      if (temFotoValida) {
        // Ajuste proporcional (contain)
        const scale = Math.min((boxFotoW - 20) / armaImg.naturalWidth, (boxFotoH - 20) / armaImg.naturalHeight);
        const w = armaImg.naturalWidth * scale;
        const h = armaImg.naturalHeight * scale;
        const x = boxFotoX + (boxFotoW - w) / 2;
        const y = boxFotoY + (boxFotoH - h) / 2;
        ctx.drawImage(armaImg, x, y, w, h);
      } else {
        // Placeholder caso não tenha foto
        ctx.fillStyle = '#4b5563';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FOTO NÃO DISPONÍVEL', boxFotoX + boxFotoW / 2, boxFotoY + boxFotoH / 2 - 10);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('(Adicione fotos na edição da arma)', boxFotoX + boxFotoW / 2, boxFotoY + boxFotoH / 2 + 20);
      }
      ctx.restore();

      // Badge de "SEMINOVO SELECIONADO" sobre a foto
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.roundRect(boxFotoX + 20, boxFotoY + 20, 220, 38, 8);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ SEMINOVO REVISADO', boxFotoX + 130, boxFotoY + 44);

      topY += boxFotoH + 35;

      // 3. TÍTULO E MODELO DA ARMA
      ctx.textAlign = 'center';
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(arma.fabricante.toUpperCase(), largura / 2, topY);
      topY += 38;

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 42px "Segoe UI", sans-serif';
      ctx.fillText(arma.modelo.toUpperCase(), largura / 2, topY);
      topY += 45;

      // 4. BADGES TÉCNICAS (Calibre, Capacidade, Acabamento, Estado)
      const badges: string[] = [];
      if (mostrarCalibre) badges.push(`CAL: ${arma.calibre}`);
      if (arma.sigmaSinarm) badges.push(arma.sigmaSinarm);
      if (arma.capacidade) badges.push(`CAP: ${arma.capacidade}`);
      if (arma.acabamento) badges.push(arma.acabamento);
      if (mostrarEstado) badges.push(arma.estadoConservacao);

      if (badges.length > 0) {
        ctx.font = 'bold 16px sans-serif';
        const totalW = badges.reduce((acc, b) => acc + ctx.measureText(b).width + 36, 0);
        let startX = (largura - totalW) / 2;

        badges.forEach(b => {
          const textW = ctx.measureText(b).width;
          const badgeW = textW + 28;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(startX, topY - 24, badgeW, 34, 17);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#e5e7eb';
          ctx.textAlign = 'center';
          ctx.fillText(b, startX + badgeW / 2, topY);

          startX += badgeW + 8;
        });

        topY += 45;
      }

      // 5. ACESSÓRIOS
      if (mostrarAcessorios && (arma.acessorios || arma.quantidadeCarregadores)) {
        const itens = [];
        if (arma.quantidadeCarregadores) itens.push(`${arma.quantidadeCarregadores} Carregador(es)`);
        if (arma.acessorios) itens.push(arma.acessorios);
        const txtAcessorios = `INCLUSO: ${itens.join(' • ')}`;

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'italic 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(txtAcessorios.slice(0, 95), largura / 2, topY);
        topY += 35;
      }

      // 6. BLOCO DE PREÇO
      if (formato === 'stories') {
        topY += 30;
      }

      if (mostrarPreco) {
        // Box Dourado de Preço
        const boxPrecoW = 460;
        const boxPrecoH = 75;
        const boxPrecoX = (largura - boxPrecoW) / 2;
        const boxPrecoY = topY;

        const precoGrad = ctx.createLinearGradient(boxPrecoX, 0, boxPrecoX + boxPrecoW, 0);
        precoGrad.addColorStop(0, '#d97706');
        precoGrad.addColorStop(1, '#f59e0b');

        ctx.fillStyle = precoGrad;
        ctx.beginPath();
        ctx.roundRect(boxPrecoX, boxPrecoY, boxPrecoW, boxPrecoH, 12);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DE INVESTIMENTO', largura / 2, boxPrecoY + 24);

        ctx.font = '900 36px "Segoe UI", sans-serif';
        ctx.fillText(formatarMoeda(arma.valorAnunciado), largura / 2, boxPrecoY + 60);

        topY += boxPrecoH + 35;
      } else {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CONSULTE VALOR E CONDIÇÕES', largura / 2, topY + 20);
        topY += 50;
      }

      // 7. RODAPÉ DE CONTATO E SEGURANÇA
      const rodapeY = altura - (formato === 'quadrado' ? 85 : 120);

      if (mostrarContato) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📲 WhatsApp: ${telefoneLoja || 'Consulte nosso escritório'}`, largura / 2, rodapeY);

        if (cidadeLoja) {
          ctx.fillStyle = '#9ca3af';
          ctx.font = '16px sans-serif';
          ctx.fillText(`📍 ${cidadeLoja}`, largura / 2, rodapeY + 25);
        }
      }

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Venda autorizada sob intermediação legal. Transferência obrigatória pelo SIGMA/SINARM.',
        largura / 2,
        altura - 24
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

    // Timeout de segurança: se as imagens demorarem mais de 500ms, renderiza de qualquer forma!
    const timer = setTimeout(() => {
      dispararRender();
    }, 500);

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
                Gerador de Anúncio e Flyer
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {arma.fabricante} {arma.modelo}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Gere a imagem oficial pronta com a sua logo para WhatsApp, Instagram e Redes
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
                <Eye size={14} className="text-amber-400" /> Pré-visualização da Arte
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
                  <LayoutGrid size={13} /> Feed (1:1)
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
            <div className="relative w-full flex items-center justify-center p-3 bg-[#0a0d14] border border-brand-dark-5 rounded-2xl overflow-hidden min-h-[460px]">
              {gerandoImagem && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10 text-amber-400 gap-2 text-xs font-bold">
                  <RefreshCw size={18} className="animate-spin" /> Renderizando Flyer...
                </div>
              )}
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: formato === 'quadrado' ? '460px' : '520px',
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
                  Logo do Escritório
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
