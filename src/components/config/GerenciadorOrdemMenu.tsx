import React, { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronDown,
  GripVertical,
  ListOrdered,
  Sparkles,
  ArrowDownAZ,
} from 'lucide-react';
import {
  LINKS_MENU_BASE,
  ORDEM_MENU_OPERACIONAL_PADRAO,
  ORDEM_MENU_ALFABETICA,
  obterOrdemMenuSalva,
  salvarOrdemMenu,
  temAcessoLink,
} from '../layout/Sidebar';

interface GerenciadorOrdemMenuProps {
  usuario: any;
  temAcessoRecurso: (r: string) => boolean;
  onNotificar: (tipo: 'sucesso' | 'erro' | 'aviso' | 'info', msg: string) => void;
}

export function GerenciadorOrdemMenu({
  usuario,
  temAcessoRecurso,
  onNotificar,
}: GerenciadorOrdemMenuProps) {
  const [expandido, setExpandido] = useState(false);
  const [slugsOrdenados, setSlugsOrdenados] = useState<string[]>(() =>
    obterOrdemMenuSalva(usuario?.empresaId)
  );
  const [slugArrastado, setSlugArrastado] = useState<string | null>(null);
  const [slugAlvoHover, setSlugAlvoHover] = useState<string | null>(null);

  useEffect(() => {
    setSlugsOrdenados(obterOrdemMenuSalva(usuario?.empresaId));
  }, [usuario?.empresaId]);

  // Filtra apenas os itens de menu aos quais o usuário/escritório tem acesso
  const itensVisiveis = slugsOrdenados
    .map(slug => LINKS_MENU_BASE.find(l => l.slug === slug))
    .filter((l): l is typeof LINKS_MENU_BASE[0] => !!l && temAcessoLink(l, usuario, temAcessoRecurso));

  const aplicarNovaOrdemVisivel = (novosVisiveisSlugs: string[], mensagem?: string) => {
    // Mantém também no array completo quaisquer slugs que estejam ocultos por permissão
    const ocultos = slugsOrdenados.filter(s => !novosVisiveisSlugs.includes(s));
    const novaLista = [...novosVisiveisSlugs, ...ocultos];
    setSlugsOrdenados(novaLista);
    salvarOrdemMenu(novaLista, usuario?.empresaId);
    if (mensagem) {
      onNotificar('sucesso', mensagem);
    }
  };

  const moverItem = (index: number, direcao: -1 | 1) => {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= itensVisiveis.length) return;
    const copia = itensVisiveis.map(i => i.slug);
    const [removido] = copia.splice(index, 1);
    copia.splice(novoIndex, 0, removido);
    aplicarNovaOrdemVisivel(copia);
  };

  const moverParaTopo = (index: number) => {
    if (index <= 0) return;
    const copia = itensVisiveis.map(i => i.slug);
    const [removido] = copia.splice(index, 1);
    copia.unshift(removido);
    aplicarNovaOrdemVisivel(copia, 'Opção movida para o topo do menu!');
  };

  const handleDrop = (slugDestino: string) => {
    if (!slugArrastado || slugArrastado === slugDestino) {
      setSlugArrastado(null);
      setSlugAlvoHover(null);
      return;
    }
    const copia = itensVisiveis.map(i => i.slug);
    const idxOrigem = copia.indexOf(slugArrastado);
    const idxDestino = copia.indexOf(slugDestino);
    if (idxOrigem === -1 || idxDestino === -1) {
      setSlugArrastado(null);
      setSlugAlvoHover(null);
      return;
    }
    copia.splice(idxOrigem, 1);
    copia.splice(idxDestino, 0, slugArrastado);
    setSlugArrastado(null);
    setSlugAlvoHover(null);
    aplicarNovaOrdemVisivel(copia, 'Ordem do menu atualizada!');
  };

  const restaurarPadraoOperacional = () => {
    setSlugsOrdenados(ORDEM_MENU_OPERACIONAL_PADRAO);
    salvarOrdemMenu(ORDEM_MENU_OPERACIONAL_PADRAO, usuario?.empresaId);
    onNotificar('sucesso', 'Ordem operacional recomendada aplicada ao menu lateral!');
  };

  const aplicarOrdemAlfabetica = () => {
    setSlugsOrdenados(ORDEM_MENU_ALFABETICA);
    salvarOrdemMenu(ORDEM_MENU_ALFABETICA, usuario?.empresaId);
    onNotificar('sucesso', 'Ordem alfabética (A–Z) aplicada ao menu lateral!');
  };

  return (
    <div className="card space-y-4">
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              expandido
                ? 'bg-brand-blue/20 text-brand-blue-light'
                : 'bg-brand-dark-4 text-gray-500 group-hover:text-white'
            }`}
          >
            <ListOrdered size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
              Ordem das Opções do Menu Lateral
              <span className="text-[9px] bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                Novo
              </span>
            </h2>
            {!expandido && (
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Personalize a posição de Painel, Rotina Diária, Ordens de Serviço e demais abas • Clique para organizar
              </p>
            )}
          </div>
        </div>
        <div
          className={`text-gray-500 transition-transform duration-300 ${
            expandido ? 'rotate-180' : ''
          }`}
        >
          <ChevronDown size={20} />
        </div>
      </div>

      {expandido && (
        <div className="animate-slide-down space-y-4 pt-3 border-t border-brand-dark-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-dark-4 p-3 rounded-xl border border-brand-dark-5">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-white">
                Arraste os itens ou use as setas para definir a ordem do menu lateral e da barra inferior
              </p>
              <p className="text-[10px] text-gray-400">
                As alterações são salvas automaticamente e aplicadas em tempo real no menu à esquerda.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={restaurarPadraoOperacional}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-brand-blue/15 text-brand-blue-light hover:bg-brand-blue/25 border border-brand-blue/30 flex items-center gap-1.5 transition-all"
                title="Coloca Painel, Rotina Diária, Ordens de Serviço, Orçamentos e Clientes no topo"
              >
                <Sparkles size={13} />
                Padrão Operacional
              </button>
              <button
                type="button"
                onClick={aplicarOrdemAlfabetica}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-brand-dark-3 text-gray-300 hover:text-white border border-brand-dark-5 flex items-center gap-1.5 transition-all"
                title="Ordenar de A a Z"
              >
                <ArrowDownAZ size={13} />
                Ordem A–Z
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {itensVisiveis.map((item, idx) => {
              const Icon = item.icon;
              const isArrastando = slugArrastado === item.slug;
              const isHover = slugAlvoHover === item.slug && slugArrastado !== item.slug;

              return (
                <div
                  key={item.slug}
                  draggable
                  onDragStart={() => setSlugArrastado(item.slug)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (slugAlvoHover !== item.slug) setSlugAlvoHover(item.slug);
                  }}
                  onDragLeave={() => {
                    if (slugAlvoHover === item.slug) setSlugAlvoHover(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(item.slug);
                  }}
                  onDragEnd={() => {
                    setSlugArrastado(null);
                    setSlugAlvoHover(null);
                  }}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all select-none ${
                    isArrastando
                      ? 'opacity-40 bg-brand-dark-3 border-brand-blue'
                      : isHover
                      ? 'bg-brand-blue/15 border-brand-blue shadow-md'
                      : 'bg-brand-dark-3/70 hover:bg-brand-dark-3 border-brand-dark-5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 p-1"
                      title="Arraste para reordenar"
                    >
                      <GripVertical size={16} />
                    </div>
                    <span className="w-6 h-6 rounded-lg bg-brand-dark-4 border border-brand-dark-5 text-[11px] font-black text-gray-400 flex items-center justify-center shrink-0">
                      {idx + 1}º
                    </span>
                    <div className="p-1.5 rounded-lg bg-brand-dark-4 text-brand-blue-light shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.label}</p>
                      <p className="text-[10px] text-gray-500 truncate">{item.to}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moverParaTopo(idx)}
                        className="p-1.5 rounded-lg bg-brand-dark-4 hover:bg-brand-blue/20 text-gray-400 hover:text-brand-blue-light border border-brand-dark-5 transition-colors"
                        title="Mover para o 1º lugar (Topo)"
                      >
                        <ChevronsUp size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moverItem(idx, -1)}
                      className="p-1.5 rounded-lg bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-300 hover:text-white border border-brand-dark-5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Subir uma posição"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === itensVisiveis.length - 1}
                      onClick={() => moverItem(idx, 1)}
                      className="p-1.5 rounded-lg bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-300 hover:text-white border border-brand-dark-5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Descer uma posição"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
