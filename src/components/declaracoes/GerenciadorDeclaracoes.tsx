import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Trash2, Edit3, Download, Copy, Check, AlertCircle, Sparkles, User, RefreshCw,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, Table,
  ArrowLeft, Upload, Image as ImageIcon, Eye, MapPin, X, Sliders 
} from 'lucide-react';
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

function inserirHtmlNoCursor(html: string) {
  const selecao = window.getSelection();
  if (!selecao || selecao.rangeCount === 0) return;
  const range = selecao.getRangeAt(0);
  range.deleteContents();
  
  const el = document.createElement("div");
  el.innerHTML = html;
  const frag = document.createDocumentFragment();
  let node, lastNode;
  while ((node = el.firstChild)) {
    lastNode = frag.appendChild(node);
  }
  range.insertNode(frag);
  
  if (lastNode) {
    const newRange = range.cloneRange();
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
    selecao.removeAllRanges();
    selecao.addRange(newRange);
  }
}

interface ToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInserirImagem?: (base64: string, nomeArquivo?: string) => void;
  tamanhoImagemPct?: number;
}

function Toolbar({ editorRef, onInserirImagem, tamanhoImagemPct = 45 }: ToolbarProps) {
  const [mostrarMenuTabela, setMostrarMenuTabela] = useState(false);
  const [estaNaTabela, setEstaNaTabela] = useState(false);
  const [hoveredR, setHoveredR] = useState(0);
  const [hoveredC, setHoveredC] = useState(0);
  const [manualLinhas, setManualLinhas] = useState('3');
  const [manualColunas, setManualColunas] = useState('3');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEscolherImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (editorRef.current) {
        editorRef.current.focus();
      }
      const maxH = Math.round((tamanhoImagemPct / 100) * 480);
      inserirHtmlNoCursor(`
        <div style="text-align: center; margin: 12px 0;">
          <img src="${base64}" alt="Foto / Print" style="max-width: ${tamanhoImagemPct}%; max-height: ${maxH}px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;" />
        </div>
      `);
      if (editorRef.current) {
        const inputEvent = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(inputEvent);
      }
      if (onInserirImagem) {
        onInserirImagem(base64, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!mostrarMenuTabela) return;
    const handleOutsideClick = () => {
      setMostrarMenuTabela(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [mostrarMenuTabela]);

  const obterCelulaAtiva = (): HTMLTableCellElement | null => {
    const selecao = window.getSelection();
    if (!selecao || selecao.rangeCount === 0) return null;
    let node: Node | null = selecao.getRangeAt(0).startContainer;
    while (node && node !== document.body) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const obterTabelaAtiva = (celula: HTMLTableCellElement): HTMLTableElement | null => {
    let node: Node | null = celula;
    while (node && node !== document.body) {
      if (node.nodeName === 'TABLE') {
        return node as HTMLTableElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const abrirMenuTabela = (e: React.MouseEvent) => {
    e.stopPropagation();
    const celula = obterCelulaAtiva();
    setEstaNaTabela(!!celula);
    setMostrarMenuTabela(!mostrarMenuTabela);
  };

  const executar = (comando: string, valor: string = '') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(comando, false, valor);
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
  };

  const inserirTabelaCustom = (linhas: number, colunas: number) => {
    if (linhas <= 0 || colunas <= 0) return;
    
    let tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
    `;
    
    // Header row
    for (let c = 1; c <= colunas; c++) {
      tableHtml += `
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: bold; color: #0D0D0D;">Coluna ${c}</th>
      `;
    }
    
    tableHtml += `
          </tr>
        </thead>
        <tbody>
    `;
    
    // Body rows
    for (let r = 2; r <= linhas; r++) {
      tableHtml += `
          <tr>
      `;
      for (let c = 1; c <= colunas; c++) {
        tableHtml += `
            <td style="border: 1px solid #d1d5db; padding: 8px; color: #1F2937;">Dado</td>
        `;
      }
      tableHtml += `
          </tr>
      `;
    }
    
    if (linhas === 1) {
      // no body rows
    }
    
    tableHtml += `
        </tbody>
      </table>
    `;
    
    if (editorRef.current) {
      editorRef.current.focus();
    }
    inserirHtmlNoCursor(tableHtml);
    dispararInput();
  };

  const dispararInput = () => {
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
  };

  const inserirLinha = (acima: boolean) => {
    const celula = obterCelulaAtiva();
    if (!celula) return;
    const trAtiva = celula.parentNode as HTMLTableRowElement;
    if (!trAtiva) return;
    const parent = trAtiva.parentNode as HTMLTableSectionElement;
    if (!parent) return;

    const cellCount = trAtiva.cells.length;
    const rowIndexInParent = Array.from(parent.rows).indexOf(trAtiva);
    const targetIndex = acima ? rowIndexInParent : rowIndexInParent + 1;
    
    const novaLinha = parent.insertRow(targetIndex);
    for (let i = 0; i < cellCount; i++) {
      const cellType = trAtiva.cells[i].nodeName.toLowerCase();
      const novaCelula = document.createElement(cellType);
      
      novaCelula.innerHTML = cellType === 'th' ? 'Coluna' : 'Dado';
      novaCelula.style.border = '1px solid #d1d5db';
      novaCelula.style.padding = '8px';
      
      if (cellType === 'th') {
        novaCelula.style.textAlign = 'left';
        novaCelula.style.fontWeight = 'bold';
        novaCelula.style.color = '#0D0D0D';
      } else {
        novaCelula.style.color = '#1F2937';
      }
      
      novaLinha.appendChild(novaCelula);
    }
    dispararInput();
  };

  const excluirLinha = () => {
    const celula = obterCelulaAtiva();
    if (!celula) return;
    const trAtiva = celula.parentNode as HTMLTableRowElement;
    if (!trAtiva) return;
    trAtiva.parentNode?.removeChild(trAtiva);
    dispararInput();
  };

  const inserirColuna = (esquerda: boolean) => {
    const celula = obterCelulaAtiva();
    if (!celula) return;
    const tabela = obterTabelaAtiva(celula);
    if (!tabela) return;

    const cellIndex = celula.cellIndex;
    const targetIndex = esquerda ? cellIndex : cellIndex + 1;

    for (let i = 0; i < tabela.rows.length; i++) {
      const row = tabela.rows[i];
      const isHeader = row.parentNode?.nodeName === 'THEAD' || i === 0;
      
      const novaCelula = document.createElement(isHeader ? 'th' : 'td');
      novaCelula.innerHTML = isHeader ? 'Coluna' : 'Dado';
      novaCelula.style.border = '1px solid #d1d5db';
      novaCelula.style.padding = '8px';
      
      if (isHeader) {
        novaCelula.style.textAlign = 'left';
        novaCelula.style.fontWeight = 'bold';
        novaCelula.style.color = '#0D0D0D';
      } else {
        novaCelula.style.color = '#1F2937';
      }

      const refCell = row.cells[targetIndex];
      if (refCell) {
        row.insertBefore(novaCelula, refCell);
      } else {
        row.appendChild(novaCelula);
      }
    }
    dispararInput();
  };

  const excluirColuna = () => {
    const celula = obterCelulaAtiva();
    if (!celula) return;
    const tabela = obterTabelaAtiva(celula);
    if (!tabela) return;

    const cellIndex = celula.cellIndex;
    for (let i = 0; i < tabela.rows.length; i++) {
      const row = tabela.rows[i];
      if (row.cells[cellIndex]) {
        row.deleteCell(cellIndex);
      }
    }
    dispararInput();
  };

  const excluirTabela = () => {
    const celula = obterCelulaAtiva();
    if (!celula) return;
    const tabela = obterTabelaAtiva(celula);
    if (!tabela) return;
    tabela.parentNode?.removeChild(tabela);
    dispararInput();
  };

  return (
    <div className="flex flex-wrap gap-1 p-1.5 bg-brand-dark-4 border-b border-brand-dark-5 items-center">
      <button
        type="button"
        onClick={() => executar('bold')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Negrito"
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        onClick={() => executar('italic')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Itálico"
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        onClick={() => executar('underline')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Sublinhado"
      >
        <Underline size={14} />
      </button>
      
      <div className="h-4 w-px bg-brand-dark-5 mx-1" />
      
      <button
        type="button"
        onClick={() => executar('justifyLeft')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Alinhar à Esquerda"
      >
        <AlignLeft size={14} />
      </button>
      <button
        type="button"
        onClick={() => executar('justifyCenter')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Centralizar"
      >
        <AlignCenter size={14} />
      </button>
      <button
        type="button"
        onClick={() => executar('justifyRight')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Alinhar à Direita"
      >
        <AlignRight size={14} />
      </button>
      <button
        type="button"
        onClick={() => executar('justifyFull')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Justificar"
      >
        <AlignJustify size={14} />
      </button>
      
      <div className="h-4 w-px bg-brand-dark-5 mx-1" />
      
      <button
        type="button"
        onClick={() => executar('insertHorizontalRule')}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all"
        title="Inserir Linha Horizontal"
      >
        <Minus size={14} />
      </button>

      <div className="h-4 w-px bg-brand-dark-5 mx-1" />

      {/* Table Dropdown Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={abrirMenuTabela}
          onMouseDown={(e) => e.preventDefault()}
          className={`p-1.5 hover:bg-brand-dark-5 rounded-lg transition-all flex items-center gap-1 ${
            mostrarMenuTabela ? 'bg-brand-dark-5 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Opções de Tabela"
        >
          <Table size={14} />
        </button>

        {mostrarMenuTabela && (
          <div className="absolute left-0 mt-1 bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-xl py-1.5 w-52 z-50 text-xs text-gray-300 flex flex-col">
            {estaNaTabela && (
              <div className="flex flex-col border-b border-brand-dark-5/50 pb-1.5 mb-1.5">
                <div className="px-3 py-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Ações de Célula</div>
                <button
                  type="button"
                  onClick={() => {
                    inserirLinha(true);
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-brand-blue/15 hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={12} className="text-brand-blue" />
                  <span>Inserir Linha Acima</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    inserirLinha(false);
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-brand-blue/15 hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={12} className="text-brand-blue" />
                  <span>Inserir Linha Abaixo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    excluirLinha();
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center gap-2 border-b border-brand-dark-5/50 pb-2 mb-1.5"
                >
                  <Minus size={12} className="text-red-500" />
                  <span>Excluir Linha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    inserirColuna(true);
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-brand-blue/15 hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={12} className="text-brand-blue" />
                  <span>Inserir Coluna à Esquerda</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    inserirColuna(false);
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-brand-blue/15 hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={12} className="text-brand-blue" />
                  <span>Inserir Coluna à Direita</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    excluirColuna();
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center gap-2 border-b border-brand-dark-5/50 pb-2 mb-1.5"
                >
                  <Minus size={12} className="text-red-500" />
                  <span>Excluir Coluna</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    excluirTabela();
                    setMostrarMenuTabela(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-500/15 hover:text-red-400 transition-all flex items-center gap-2 text-red-400 font-medium"
                >
                  <Trash2 size={12} className="text-red-500" />
                  <span>Excluir Tabela</span>
                </button>
              </div>
            )}

            {/* Always show custom Table Generator (Grid selector + manual size inputs) */}
            <div className="flex flex-col gap-2">
              <div className="px-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                {estaNaTabela ? 'Inserir Outra Tabela' : 'Criar Tabela'}
              </div>
              
              <div 
                className="px-3 py-2 flex flex-col items-center gap-2 bg-brand-dark-4/40"
                onMouseLeave={() => {
                  setHoveredR(0);
                  setHoveredC(0);
                }}
              >
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: 8 * 8 }).map((_, idx) => {
                    const r = Math.floor(idx / 8) + 1;
                    const c = (idx % 8) + 1;
                    const isHighlighted = r <= hoveredR && c <= hoveredC;
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => {
                          setHoveredR(r);
                          setHoveredC(c);
                        }}
                        onClick={() => {
                          inserirTabelaCustom(r, c);
                          setMostrarMenuTabela(false);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`w-3.5 h-3.5 rounded-sm border transition-all cursor-pointer ${
                          isHighlighted 
                            ? 'bg-brand-blue border-brand-blue shadow-sm shadow-brand-blue/30 scale-105' 
                            : 'bg-brand-dark-3 border-brand-dark-5 hover:border-gray-400'
                        }`}
                      />
                    );
                  })}
                </div>
                
                <div className="text-[10px] text-gray-400 font-medium text-center h-4 flex items-center justify-center">
                  {hoveredR > 0 && hoveredC > 0 ? (
                    <span className="text-white font-bold">
                      Tabela {hoveredR}x{hoveredC}
                    </span>
                  ) : (
                    <span>Arraste para definir o tamanho</span>
                  )}
                </div>
              </div>

              {/* Manual Input Form */}
              <div className="p-3 border-t border-brand-dark-5/50 flex flex-col gap-2 bg-brand-dark-4/20">
                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Ou digite o tamanho:</div>
                <div className="flex items-center gap-1.5 justify-between">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={manualLinhas}
                      onChange={(e) => setManualLinhas(e.target.value)}
                      className="w-10 bg-brand-dark-3 border border-brand-dark-5 rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none focus:border-brand-blue"
                      placeholder="Linhas"
                    />
                    <span className="text-gray-500 text-xs">x</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={manualColunas}
                      onChange={(e) => setManualColunas(e.target.value)}
                      className="w-10 bg-brand-dark-3 border border-brand-dark-5 rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none focus:border-brand-blue"
                      placeholder="Cols"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const r = parseInt(manualLinhas) || 3;
                      const c = parseInt(manualColunas) || 3;
                      inserirTabelaCustom(r, c);
                      setMostrarMenuTabela(false);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="px-2 py-0.5 bg-brand-blue hover:bg-brand-blue-hover text-white rounded text-[10px] font-bold transition-all"
                  >
                    Inserir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-brand-dark-5 mx-1" />

      {/* Botão de Inserir Imagem / Foto */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-brand-dark-5 text-gray-400 hover:text-white rounded-lg transition-all flex items-center gap-1"
        title="Inserir Foto / Print / Comprovante no Editor"
      >
        <ImageIcon size={14} className="text-brand-blue" />
        <span className="text-[11px] font-semibold hidden sm:inline">Foto / Print</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleEscolherImagem}
      />
    </div>
  );
}

export function GerenciadorDeclaracoes() {
  const navigate = useNavigate();
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

  // Anexo de Comprovante de Endereço (Foto/Print)
  const [comprovanteEndereco, setComprovanteEndereco] = useState<{
    arquivoNome: string;
    base64: string;
    tipo: string;
  } | null>(null);
  const [anexarComprovanteNoPdf, setAnexarComprovanteNoPdf] = useState(true);
  const [mostrarModalImagem, setMostrarModalImagem] = useState(false);
  // Tamanho Manual da Imagem no Corpo do Texto (% de 15 a 100)
  const [tamanhoImagemTexto, setTamanhoImagemTexto] = useState<number>(45);

  // Estado de Edição de Modelo
  const [modeloEditando, setModeloEditando] = useState<Partial<ModeloDeclaracao> | null>(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  // Refs for WYSIWYG HTML Editors
  const editorRefModel = useRef<HTMLDivElement>(null);
  const editorRefGerar = useRef<HTMLDivElement>(null);

  const handleEditorModelInput = () => {
    if (editorRefModel.current && modeloEditando) {
      setModeloEditando(prev => {
        if (!prev) return null;
        return {
          ...prev,
          texto: editorRefModel.current!.innerHTML
        };
      });
    }
  };

  const handleEditorGerarInput = () => {
    if (editorRefGerar.current) {
      setTextoEditado(editorRefGerar.current.innerHTML);
    }
  };

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

  const isDeclaracaoEndereco = useMemo(() => {
    const t = (tituloManual || modeloSelecionado?.titulo || '').toUpperCase();
    return t.includes('ENDEREÇO') || t.includes('ENDERECO') || t.includes('RESIDÊNCIA') || t.includes('RESIDENCIA');
  }, [tituloManual, modeloSelecionado]);

  const handleVoltar = () => {
    const cid = (clienteSelecionadoId && clienteSelecionadoId !== 'avulso')
      ? clienteSelecionadoId
      : searchParams.get('clienteId');
    if (cid && cid !== 'avulso') {
      navigate(`/clientes/${cid}`);
    } else {
      navigate(-1);
    }
  };

  const handleSelecionarArquivoComprovante = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setComprovanteEndereco({
        arquivoNome: file.name,
        base64,
        tipo: file.type || 'image/png'
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDropComprovante = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem (PNG, JPG, JPEG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setComprovanteEndereco({
        arquivoNome: file.name,
        base64,
        tipo: file.type || 'image/png'
      });
    };
    reader.readAsDataURL(file);
  };

  const aplicarTamanhoImagemNoTexto = (novoTamanho: number) => {
    setTamanhoImagemTexto(novoTamanho);
    if (editorRefGerar.current) {
      const imgs = editorRefGerar.current.querySelectorAll('img');
      const maxH = Math.round((novoTamanho / 100) * 480);
      imgs.forEach(img => {
        img.style.maxWidth = `${novoTamanho}%`;
        img.style.maxHeight = `${maxH}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
      });
      handleEditorGerarInput();
    }
  };

  const temImagemNoEditor = useMemo(() => {
    return textoEditado.toLowerCase().includes('<img');
  }, [textoEditado]);

  const handleInserirComprovanteNoTexto = () => {
    if (!comprovanteEndereco) return;
    if (editorRefGerar.current) {
      editorRefGerar.current.focus();
      const maxH = Math.round((tamanhoImagemTexto / 100) * 480);
      inserirHtmlNoCursor(`
        <div style="text-align: center; margin: 12px 0;">
          <img src="${comprovanteEndereco.base64}" alt="Comprovante de Endereço" style="max-width: ${tamanhoImagemTexto}%; max-height: ${maxH}px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;" />
        </div>
      `);
      handleEditorGerarInput();
    }
  };

  const handleEditorGerarPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const maxH = Math.round((tamanhoImagemTexto / 100) * 480);
            inserirHtmlNoCursor(`
              <div style="text-align: center; margin: 12px 0;">
                <img src="${base64}" alt="Print / Foto" style="max-width: ${tamanhoImagemTexto}%; max-height: ${maxH}px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;" />
              </div>
            `);
            handleEditorGerarInput();
            setComprovanteEndereco({
              arquivoNome: `print_comprovante_${Date.now()}.png`,
              base64,
              tipo: file.type || 'image/png'
            });
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };

  const handleImagemInseridaPeloToolbar = (base64: string, nomeArquivo?: string) => {
    handleEditorGerarInput();
    if (!comprovanteEndereco) {
      setComprovanteEndereco({
        arquivoNome: nomeArquivo || `imagem_${Date.now()}.png`,
        base64,
        tipo: 'image/png'
      });
    }
  };

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

  // Sync editor innerHTML when model text changes from outside
  useEffect(() => {
    if (editorRefModel.current) {
      if (modeloEditando) {
        const text = modeloEditando.texto || '';
        const htmlText = (!text.trim().startsWith('<') && !text.includes('</')) 
          ? text.replace(/\n/g, '<br>')
          : text;
        
        if (editorRefModel.current.innerHTML !== htmlText) {
          editorRefModel.current.innerHTML = htmlText;
        }
      } else {
        editorRefModel.current.innerHTML = '';
      }
    }
  }, [modeloEditando?.id, modeloEditando === null]);

  // Sync editor innerHTML when textoEditado changes from outside (e.g. template compile)
  useEffect(() => {
    if (editorRefGerar.current && editorRefGerar.current.innerHTML !== textoEditado) {
      editorRefGerar.current.innerHTML = textoEditado;
    }
  }, [textoEditado]);

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
      
      // Convert plain text newlines to <br> for HTML rendering if it's not HTML yet
      if (!textoBase.trim().startsWith('<') && !textoBase.includes('</')) {
        textoBase = textoBase.replace(/\n/g, '<br>');
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
      const blob = await gerarPdfDeclaracaoBlob(
        tituloManual, 
        textoEditado, 
        clienteSelecionado.nome,
        clienteSelecionado.cpf,
        anexarComprovanteNoPdf && comprovanteEndereco ? {
          imagemBase64: comprovanteEndereco.base64,
          tipo: 'comprovante_endereco',
          titulo: 'COMPROVANTE DE ENDEREÇO'
        } : undefined,
        {
          enderecoCliente: dadosCliente.endereco || clienteSelecionado.endereco
        }
      );
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
    
    if (editorRefModel.current) {
      editorRefModel.current.focus();
    }
    
    inserirHtmlNoCursor(`{{${tag}}}`);
    
    if (editorRefModel.current) {
      setModeloEditando({
        ...modeloEditando,
        texto: editorRefModel.current.innerHTML
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVoltar}
            className="p-2.5 bg-brand-dark-3 border border-brand-dark-5 hover:border-brand-blue/50 hover:bg-brand-dark-4 rounded-xl text-gray-300 hover:text-white transition-all flex items-center gap-2 group shadow-sm"
            title={clienteSelecionado && clienteSelecionadoId !== 'avulso' ? `Voltar para o perfil de ${clienteSelecionado.nome}` : 'Voltar'}
          >
            <ArrowLeft size={18} className="text-gray-400 group-hover:text-brand-blue group-hover:-translate-x-0.5 transition-all" />
            <span className="text-xs font-bold hidden sm:inline">
              {clienteSelecionado && clienteSelecionadoId !== 'avulso' ? 'Voltar ao Perfil' : 'Voltar'}
            </span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="text-brand-blue" /> Gerador de Declarações
            </h1>
            <p className="text-sm text-gray-400">Gere e emita declarações e termos oficiais com dados automatizados do acervo.</p>
          </div>
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

            {/* Seção de Anexar ou Inserir Comprovante de Endereço */}
            {clienteSelecionado && (
              <div className={`p-3.5 rounded-xl border transition-all ${
                isDeclaracaoEndereco 
                  ? 'bg-brand-blue/5 border-brand-blue/40 shadow-sm shadow-brand-blue/10' 
                  : 'bg-brand-dark-4 border-brand-dark-5'
              }`}>
                <div className="flex items-center justify-between border-b border-brand-dark-5/80 pb-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className={isDeclaracaoEndereco ? 'text-brand-blue' : 'text-gray-400'} />
                    <span className="text-[11px] font-black uppercase tracking-wider text-white">
                      Comprovante de Endereço
                    </span>
                  </div>
                  {isDeclaracaoEndereco ? (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
                      Exigido Anexar
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-gray-500">
                      Opcional
                    </span>
                  )}
                </div>

                {!comprovanteEndereco ? (
                  <div>
                    <label 
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDropComprovante}
                      className="border-2 border-dashed border-brand-dark-5 hover:border-brand-blue/50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-brand-dark-3/50 hover:bg-brand-dark-3 group"
                    >
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleSelecionarArquivoComprovante}
                      />
                      <div className="p-2.5 rounded-full bg-brand-dark-4 text-gray-400 group-hover:text-brand-blue group-hover:bg-brand-blue/10 transition-all mb-2">
                        <Upload size={18} />
                      </div>
                      <p className="text-xs font-bold text-gray-300 group-hover:text-white">
                        Anexar Foto ou Print
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Clique, arraste ou cole com <kbd className="px-1 py-0.5 bg-brand-dark-5 rounded text-gray-300 text-[9px] font-mono">Ctrl+V</kbd>
                      </p>
                      <p className="text-[9px] text-gray-600 mt-0.5">
                        PNG, JPG ou JPEG (Conta de Luz, Água, etc.)
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="relative rounded-lg overflow-hidden border border-brand-dark-5 bg-brand-dark-5/30 p-2 flex items-center gap-3">
                      <div 
                        onClick={() => setMostrarModalImagem(true)}
                        className="w-16 h-16 rounded border border-brand-dark-5 overflow-hidden bg-black/40 flex-shrink-0 cursor-pointer relative group"
                        title="Clique para ampliar"
                      >
                        <img 
                          src={comprovanteEndereco.base64} 
                          alt="Comprovante de Endereço" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye size={14} className="text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate" title={comprovanteEndereco.arquivoNome}>
                          {comprovanteEndereco.arquivoNome}
                        </p>
                        <p className="text-[10px] text-brand-green font-medium flex items-center gap-1 mt-0.5">
                          <Check size={11} /> Foto carregada
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setMostrarModalImagem(true)}
                            className="text-[10px] text-brand-blue hover:underline flex items-center gap-0.5"
                          >
                            <Eye size={10} /> Ver ampliado
                          </button>
                          <button
                            type="button"
                            onClick={() => setComprovanteEndereco(null)}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
                          >
                            <Trash2 size={10} /> Remover
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Botão para inserir no corpo do texto */}
                    <button
                      type="button"
                      onClick={handleInserirComprovanteNoTexto}
                      className="w-full py-1.5 px-2 bg-brand-dark-3 hover:bg-brand-dark-4 border border-brand-dark-5 hover:border-brand-blue/30 rounded-lg text-[11px] font-bold text-gray-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={13} className="text-brand-blue" />
                      Inserir foto no corpo do texto
                    </button>

                    {/* Controle Manual de Tamanho da Foto no Documento */}
                    <div className="p-2.5 bg-brand-dark-3/60 border border-brand-dark-5 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-300 uppercase flex items-center gap-1">
                          <Sliders size={12} className="text-brand-blue" />
                          Tamanho no Texto: <span className="text-white font-mono">{tamanhoImagemTexto}%</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          tamanhoImagemTexto <= 50 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {tamanhoImagemTexto <= 50 ? '✓ Cabe em 1 pág' : '⚠️ Pode gerar 2ª pág'}
                        </span>
                      </div>

                      <input
                        type="range"
                        min="15"
                        max="100"
                        step="5"
                        value={tamanhoImagemTexto}
                        onChange={e => aplicarTamanhoImagemNoTexto(Number(e.target.value))}
                        className="w-full accent-brand-blue cursor-pointer h-1.5 bg-brand-dark-5 rounded-lg"
                        title="Arraste para ajustar o tamanho da foto no texto"
                      />

                      <div className="flex gap-1">
                        {[
                          { label: '30%', val: 30 },
                          { label: '45% Ideal', val: 45 },
                          { label: '60%', val: 60 },
                          { label: '80%', val: 80 },
                          { label: '100%', val: 100 },
                        ].map(p => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => aplicarTamanhoImagemNoTexto(p.val)}
                            className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                              tamanhoImagemTexto === p.val 
                                ? 'bg-brand-blue text-white shadow-sm' 
                                : 'bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-400 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Checkbox para anexar no PDF */}
                    <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={anexarComprovanteNoPdf}
                        onChange={e => setAnexarComprovanteNoPdf(e.target.checked)}
                        className="rounded border-brand-dark-5 text-brand-blue focus:ring-brand-blue mt-0.5"
                      />
                      <span className="text-[11px] text-gray-300 leading-tight">
                        Anexar como página oficial no PDF <span className="text-brand-blue font-semibold">(Exigido p/ SisGCorp/Sinarm)</span>
                      </span>
                    </label>
                  </div>
                )}
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
                  <div className="rounded-xl border border-brand-dark-5 overflow-hidden">
                    <Toolbar editorRef={editorRefGerar} onInserirImagem={handleImagemInseridaPeloToolbar} tamanhoImagemPct={tamanhoImagemTexto} />

                    {/* Barra de Ajuste de Tamanho da Imagem quando há foto no texto */}
                    {temImagemNoEditor && (
                      <div className="bg-brand-dark-4 border-y border-brand-dark-5 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <Sliders size={14} className="text-brand-blue" />
                          <span className="text-xs font-bold text-white">
                            Ajustar Tamanho da Foto/Print:
                          </span>
                          <span className="text-xs font-mono font-bold text-brand-blue bg-brand-blue/15 px-2 py-0.5 rounded border border-brand-blue/20">
                            {tamanhoImagemTexto}%
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 min-w-[170px] max-w-xs">
                          <span className="text-[10px] text-gray-400 font-medium">15%</span>
                          <input
                            type="range"
                            min="15"
                            max="100"
                            step="5"
                            value={tamanhoImagemTexto}
                            onChange={e => aplicarTamanhoImagemNoTexto(Number(e.target.value))}
                            className="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-brand-dark-5 rounded-lg"
                            title="Arraste para redimensionar a imagem no texto"
                          />
                          <span className="text-[10px] text-gray-400 font-medium">100%</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {[
                            { label: '30%', val: 30 },
                            { label: '45% Ideal', val: 45 },
                            { label: '60%', val: 60 },
                            { label: '80%', val: 80 }
                          ].map(p => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => aplicarTamanhoImagemNoTexto(p.val)}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                                tamanhoImagemTexto === p.val 
                                  ? 'bg-brand-blue text-white shadow-sm' 
                                  : 'bg-brand-dark-3 hover:bg-brand-dark-5 text-gray-400 hover:text-white'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        <div className="text-[10px] flex items-center gap-1">
                          {tamanhoImagemTexto <= 50 ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Check size={12} /> Cabe em 1 página com assinatura
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              ⚠️ Reduza para ≤ 50% para não cortar a assinatura
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      ref={editorRefGerar}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleEditorGerarInput}
                      onPaste={handleEditorGerarPaste}
                      className="input min-h-[450px] h-[450px] overflow-y-auto font-sans text-sm py-3 px-4 leading-relaxed focus:outline-none focus:ring-0 rounded-b-xl border-t-0 bg-brand-dark-3/30"
                    />
                  </div>
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
                      <div className="rounded-xl border border-brand-dark-5 overflow-hidden">
                        <Toolbar editorRef={editorRefModel} />
                        <div
                          ref={editorRefModel}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={handleEditorModelInput}
                          className="input min-h-[380px] h-[380px] overflow-y-auto font-sans text-sm py-3 px-4 leading-relaxed focus:outline-none focus:ring-0 rounded-b-xl border-t-0 bg-brand-dark-3/30"
                        />
                      </div>
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

      {/* Modal de Visualização Ampliada da Foto / Print */}
      {mostrarModalImagem && comprovanteEndereco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-4xl max-h-[90vh] bg-brand-dark-3 border border-brand-dark-5 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-3.5 border-b border-brand-dark-5 bg-brand-dark-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-brand-blue" />
                <span className="text-sm font-bold text-white truncate max-w-md">
                  {comprovanteEndereco.arquivoNome}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalImagem(false)}
                className="p-1.5 hover:bg-brand-dark-5 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh] flex items-center justify-center bg-brand-dark-2">
              <img
                src={comprovanteEndereco.base64}
                alt="Comprovante de Endereço"
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-brand-dark-5 shadow-lg"
              />
            </div>
            <div className="p-3 border-t border-brand-dark-5 bg-brand-dark-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Esta foto/print será incluída no PDF oficial gerado.
              </span>
              <button
                type="button"
                onClick={() => setMostrarModalImagem(false)}
                className="btn-primary py-1.5 px-4 text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
