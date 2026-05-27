import React, { useState } from 'react';
import {
  X, Target, FileText, Award, Shield, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Calendar, User,
  Plus, Pencil, Trash2, ShieldCheck, Loader2, Info, Upload
} from 'lucide-react';
import { VinculoDespachanteCac, AcervoVinculado, buscarAcervoVinculado } from '../../services/vinculosService';
import { useClientes } from '../../context/ClientesContext';
import { Arma, GuiaTrafego, AutorizacaoManejo } from '../../types';
import { ModalArma, ModalGt, ModalManejo } from '../clientes/AbaDocumentacao';
import { fileToBase64, visualizarDocumentoBase64 } from '../../utils/fileUtils';

interface Props {
  vinculo: VinculoDespachanteCac;
  acervo: AcervoVinculado;
  onClose: () => void;
}

function formatarData(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function diasParaVencer(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function BadgeVencimento({ data }: { data?: string }) {
  if (!data) return <span className="text-xs text-gray-600">—</span>;
  const dias = diasParaVencer(data);
  if (dias === null) return <span className="text-xs text-gray-400 font-mono">{formatarData(data)}</span>;
  if (dias < 0) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
      VENCIDO há {Math.abs(dias)}d
    </span>
  );
  if (dias <= 30) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
      {formatarData(data)} ⚠️ {dias}d
    </span>
  );
  return <span className="text-xs text-gray-400 font-mono">{formatarData(data)}</span>;
}

function Secao({ 
  titulo, 
  icon: Icon, 
  children, 
  actionButton 
}: { 
  titulo: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  actionButton?: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(true);
  return (
    <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 overflow-hidden transition-all duration-300">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-brand-dark-3/60 border-b border-brand-dark-5">
        <button
          onClick={() => setAberta(!aberta)}
          className="flex-1 flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider text-left transition-colors"
        >
          <Icon size={13} className="text-brand-blue-light" />
          <span>{titulo}</span>
          {aberta ? <ChevronUp size={14} className="text-gray-600 ml-1" /> : <ChevronDown size={14} className="text-gray-600 ml-1" />}
        </button>
        {actionButton && <div className="shrink-0 pl-2">{actionButton}</div>}
      </div>
      {aberta && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

export function AcervoVinculadoGerenciador({ vinculo, acervo, onClose }: Props) {
  const { 
    atualizarCliente, 
    salvarArma, deletarArma, 
    salvarGt, deletarGt, 
    salvarManejo, deletarManejo 
  } = useClientes();

  const [dadosAcervo, setDadosAcervo] = useState<AcervoVinculado>(acervo);
  const [carregandoInterno, setCarregandoInterno] = useState(false);
  const [armaExpandida, setArmaExpandida] = useState<string | null>(null);

  // States de Edição
  const [editandoCr, setEditandoCr] = useState(false);
  const [formCr, setFormCr] = useState({
    numeroCr: dadosAcervo.cliente.numeroCr || '',
    vencimentoCr: dadosAcervo.cliente.vencimentoCr || '',
    numeroCrIbama: dadosAcervo.cliente.numeroCrIbama || '',
    vencimentoCrIbama: dadosAcervo.cliente.vencimentoCrIbama || '',
    contato: dadosAcervo.cliente.contato || '',
    crUrl: dadosAcervo.cliente.crUrl || '',
    crIbamaUrl: dadosAcervo.cliente.crIbamaUrl || ''
  });

  // Modais
  const [modalArmaAberto, setModalArmaAberto] = useState(false);
  const [armaParaEditar, setArmaParaEditar] = useState<Arma | null>(null);
  const [modalGtAberto, setModalGtAberto] = useState<{ armaId: string; gt?: GuiaTrafego } | null>(null);
  const [modalManejoAberto, setModalManejoAberto] = useState(false);
  const [manejoParaEditar, setManejoParaEditar] = useState<AutorizacaoManejo | null>(null);

  const { cliente, armas, manejos } = dadosAcervo;
  const podeEditar = !!dadosAcervo.vinculo?.permite_edicao;
  const cacEmpresaId = vinculo.cac_empresa_id;

  const atualizarDados = async () => {
    setCarregandoInterno(true);
    try {
      const res = await buscarAcervoVinculado(cacEmpresaId, vinculo.despachante_empresa_id);
      if (res) {
        setDadosAcervo(res);
        setFormCr({
          numeroCr: res.cliente.numeroCr || '',
          vencimentoCr: res.cliente.vencimentoCr || '',
          numeroCrIbama: res.cliente.numeroCrIbama || '',
          vencimentoCrIbama: res.cliente.vencimentoCrIbama || '',
          contato: res.cliente.contato || '',
          crUrl: res.cliente.crUrl || '',
          crIbamaUrl: res.cliente.crIbamaUrl || ''
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar acervo:', err);
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Salvar CR
  const handleSalvarCr = async () => {
    try {
      setCarregandoInterno(true);
      await atualizarCliente(cliente.id, {
        numeroCr: formCr.numeroCr.trim().toUpperCase(),
        vencimentoCr: formCr.vencimentoCr,
        numeroCrIbama: formCr.numeroCrIbama.trim().toUpperCase(),
        vencimentoCrIbama: formCr.vencimentoCrIbama,
        contato: formCr.contato.trim(),
        crUrl: formCr.crUrl,
        crIbamaUrl: formCr.crIbamaUrl
      });
      setEditandoCr(false);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar Certificados de Registro.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Salvar Arma
  const handleSalvarArma = async (dadosForm: any) => {
    try {
      setCarregandoInterno(true);
      await salvarArma({
        id: dadosForm.id,
        clienteId: cliente.id,
        tipo: dadosForm.tipo,
        modelo: dadosForm.modelo,
        calibre: dadosForm.calibre,
        fabricante: dadosForm.fabricante,
        numeroSerie: dadosForm.numeroSerie,
        numeroSigma: dadosForm.numeroSigma,
        acervo: dadosForm.acervo,
        vencimentoCraf: dadosForm.vencimentoCraf
      }, cacEmpresaId);
      setModalArmaAberto(false);
      setArmaParaEditar(null);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar Arma.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Deletar Arma
  const handleDeletarArma = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta arma? Esta ação também removerá as Guias de Tráfego vinculadas.')) return;
    try {
      setCarregandoInterno(true);
      await deletarArma(id);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir Arma.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Salvar GT
  const handleSalvarGt = async (dadosForm: any) => {
    if (!modalGtAberto) return;
    try {
      setCarregandoInterno(true);
      await salvarGt({
        id: dadosForm.id,
        armaId: modalGtAberto.armaId,
        tipo: dadosForm.tipo,
        vencimento: dadosForm.vencimento,
        destino: dadosForm.destino
      }, cacEmpresaId);
      setModalGtAberto(null);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar Guia de Tráfego.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Deletar GT
  const handleDeletarGt = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta Guia de Tráfego?')) return;
    try {
      setCarregandoInterno(true);
      await deletarGt(id);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir Guia.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Salvar Manejo
  const handleSalvarManejo = async (dadosForm: any) => {
    try {
      setCarregandoInterno(true);
      await salvarManejo({
        id: dadosForm.id,
        clienteId: cliente.id,
        numeroCar: dadosForm.numeroCar,
        nomeFazenda: dadosForm.nomeFazenda,
        nomeProprietario: dadosForm.nomeProprietario,
        cidade: dadosForm.cidade,
        vencimento: dadosForm.vencimento,
        status: dadosForm.status
      }, cacEmpresaId);
      setModalManejoAberto(false);
      setManejoParaEditar(null);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar autorização de Manejo.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Deletar Manejo
  const handleDeletarManejo = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta autorização de manejo?')) return;
    try {
      setCarregandoInterno(true);
      await deletarManejo(id);
      await atualizarDados();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir Manejo.');
    } finally {
      setCarregandoInterno(false);
    }
  };

  // Calcula alertas totais
  let alertas = 0;
  const hoje = Date.now();
  const limite = hoje + 30 * 86400000;
  const isAlerta = (d?: string) => d && new Date(d).getTime() <= limite;
  if (isAlerta(cliente.vencimentoCr)) alertas++;
  if (isAlerta(cliente.vencimentoCrIbama)) alertas++;
  armas.forEach(a => {
    if (isAlerta(a.vencimentoCraf)) alertas++;
    a.gts.forEach(g => { if (isAlerta(g.vencimento)) alertas++; });
  });
  manejos.forEach(m => { if (isAlerta(m.vencimento)) alertas++; });

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-brand-dark-2 w-full max-w-2xl rounded-2xl border border-brand-dark-5 shadow-2xl flex flex-col max-h-[92vh] relative">
        {carregandoInterno && (
          <div className="absolute inset-0 bg-brand-dark/50 backdrop-blur-[2px] z-[180] flex items-center justify-center rounded-2xl">
            <div className="bg-brand-dark-3 border border-brand-dark-5 rounded-2xl p-6 shadow-2xl flex items-center gap-3">
              <Loader2 className="animate-spin text-brand-blue-light" size={20} />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Processando...</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-dark-3 to-brand-dark-2 border-b border-brand-dark-5 px-6 py-4 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            {cliente.fotoUrl ? (
              <img src={cliente.fotoUrl} alt={cliente.nome} className="w-12 h-12 rounded-xl object-cover border border-brand-blue/20" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-brand-dark-4 border border-brand-dark-5 flex items-center justify-center">
                <User size={22} className="text-gray-600" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-white">{cliente.nome}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {podeEditar ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-green/10 border border-brand-green/30 text-brand-green-light flex items-center gap-1 uppercase tracking-widest">
                    <ShieldCheck size={10} /> Escrita Liberada
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/30 text-brand-blue-light flex items-center gap-1 uppercase tracking-widest">
                    <Info size={10} /> Somente Leitura
                  </span>
                )}
                {alertas > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-1">
                    <AlertTriangle size={9} /> {alertas} alerta{alertas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corpo scrollável */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Termo e Consentimento Banner */}
          {podeEditar && dadosAcervo.vinculo?.termo_aceito_texto && (
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-3 flex items-start gap-3">
              <ShieldCheck size={16} className="text-brand-green shrink-0 mt-0.5" />
              <div className="text-[10px] text-gray-400">
                <p className="font-bold text-white uppercase tracking-wider mb-1 text-[9px]">Consentimento LGPD Ativo</p>
                <p className="italic">"{dadosAcervo.vinculo.termo_aceito_texto}"</p>
                <p className="mt-1 text-[9px] text-gray-500">Autorizado em: {formatarData(dadosAcervo.vinculo.autorizado_edicao_em)}</p>
              </div>
            </div>
          )}

          {/* Alertas */}
          {alertas > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                <strong>{alertas} documento(s)</strong> vencidos ou a vencer em menos de 30 dias. Considere atualizar ou notificar o cliente.
              </p>
            </div>
          )}

          {/* Perfil / CR */}
          <Secao 
            titulo="Certificados de Registro" 
            icon={Shield}
            actionButton={podeEditar && !editandoCr && (
              <button 
                onClick={() => setEditandoCr(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase text-brand-blue-light hover:text-white bg-brand-blue/10 border border-brand-blue/20 rounded-lg transition-all"
              >
                <Pencil size={11} /> Editar CRs
              </button>
            )}
          >
            {editandoCr ? (
              <div className="space-y-4 animate-scale-up">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nº CR Exército</label>
                    <input 
                      type="text" 
                      className="input uppercase" 
                      value={formCr.numeroCr} 
                      onChange={e => setFormCr({...formCr, numeroCr: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="label">Validade CR Exército</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={formCr.vencimentoCr} 
                      onChange={e => setFormCr({...formCr, vencimentoCr: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nº CR IBAMA</label>
                    <input 
                      type="text" 
                      className="input uppercase" 
                      value={formCr.numeroCrIbama} 
                      onChange={e => setFormCr({...formCr, numeroCrIbama: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="label">Validade CR IBAMA</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={formCr.vencimentoCrIbama} 
                      onChange={e => setFormCr({...formCr, vencimentoCrIbama: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Contato / Telefone</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formCr.contato} 
                    onChange={e => setFormCr({...formCr, contato: e.target.value})} 
                  />
                </div>

                {/* Anexo CR Exército */}
                <div>
                  <label className="label text-[10px]">Anexo CR Exército (PDF/Imagem)</label>
                  <div className="flex items-center gap-2">
                    <input type="file" accept="application/pdf,image/*" className="hidden" id="avg-cr-attachment"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try { const b = await fileToBase64(file); setFormCr({...formCr, crUrl: b}); }
                          catch { alert('Erro ao carregar arquivo.'); }
                        }
                      }} />
                    <label htmlFor="avg-cr-attachment" className="btn-ghost flex items-center gap-1 cursor-pointer text-[10px] h-8 border border-brand-dark-5 rounded-lg px-2">
                      <Upload size={12} /> {formCr.crUrl ? 'Alterar' : 'Anexar'}
                    </label>
                    {formCr.crUrl && (
                      <>
                        <button type="button" onClick={() => visualizarDocumentoBase64(formCr.crUrl, `CR-${formCr.numeroCr || 'exercito'}`)} className="text-brand-blue hover:text-brand-blue-light text-[10px] font-semibold">Visualizar</button>
                        <button type="button" onClick={() => setFormCr({...formCr, crUrl: ''})} className="text-red-400 hover:text-red-300 text-[10px] font-semibold">Remover</button>
                      </>
                    )}
                  </div>
                  {formCr.crUrl && <span className="text-[9px] text-brand-green font-bold block mt-0.5">✓ Documento anexado</span>}
                </div>

                {/* Anexo CR IBAMA */}
                <div>
                  <label className="label text-[10px]">Anexo CR IBAMA (PDF/Imagem)</label>
                  <div className="flex items-center gap-2">
                    <input type="file" accept="application/pdf,image/*" className="hidden" id="avg-cr-ibama-attachment"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try { const b = await fileToBase64(file); setFormCr({...formCr, crIbamaUrl: b}); }
                          catch { alert('Erro ao carregar arquivo.'); }
                        }
                      }} />
                    <label htmlFor="avg-cr-ibama-attachment" className="btn-ghost flex items-center gap-1 cursor-pointer text-[10px] h-8 border border-brand-dark-5 rounded-lg px-2">
                      <Upload size={12} /> {formCr.crIbamaUrl ? 'Alterar' : 'Anexar'}
                    </label>
                    {formCr.crIbamaUrl && (
                      <>
                        <button type="button" onClick={() => visualizarDocumentoBase64(formCr.crIbamaUrl, `CR-IBAMA-${formCr.numeroCrIbama || 'ibama'}`)} className="text-brand-blue hover:text-brand-blue-light text-[10px] font-semibold">Visualizar</button>
                        <button type="button" onClick={() => setFormCr({...formCr, crIbamaUrl: ''})} className="text-red-400 hover:text-red-300 text-[10px] font-semibold">Remover</button>
                      </>
                    )}
                  </div>
                  {formCr.crIbamaUrl && <span className="text-[9px] text-brand-green font-bold block mt-0.5">✓ Documento anexado</span>}
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-brand-dark-5">
                  <button onClick={() => setEditandoCr(false)} className="btn-ghost py-1 px-3 text-xs">Cancelar</button>
                  <button onClick={handleSalvarCr} className="btn-primary py-1 px-3 text-xs">Salvar Alterações</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">Nº CR Exército</p>
                  <p className="text-sm text-white font-mono">{cliente.numeroCr || 'Não cadastrado'}</p>
                  {cliente.crUrl && (
                    <button onClick={() => visualizarDocumentoBase64(cliente.crUrl!, `CR-${cliente.numeroCr || 'exercito'}`)} className="mt-1 flex items-center gap-1 text-[9px] font-black text-brand-blue hover:text-brand-blue-light uppercase tracking-wider">
                      <FileText size={10} /> Ver Doc
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Validade CR</p>
                  <BadgeVencimento data={cliente.vencimentoCr} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">Nº CR IBAMA</p>
                  <p className="text-sm text-white font-mono">{cliente.numeroCrIbama || '—'}</p>
                  {cliente.crIbamaUrl && (
                    <button onClick={() => visualizarDocumentoBase64(cliente.crIbamaUrl!, `CR-IBAMA-${cliente.numeroCrIbama || 'ibama'}`)} className="mt-1 flex items-center gap-1 text-[9px] font-black text-brand-blue hover:text-brand-blue-light uppercase tracking-wider">
                      <FileText size={10} /> Ver Doc
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Validade CR IBAMA</p>
                  <BadgeVencimento data={cliente.vencimentoCrIbama} />
                </div>
                {cliente.contato && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Contato</p>
                    <p className="text-sm text-gray-300">{cliente.contato}</p>
                  </div>
                )}
              </div>
            )}
          </Secao>

          {/* Armas */}
          <Secao 
            titulo={`Acervo de Armas (${armas.length})`} 
            icon={Target}
            actionButton={podeEditar && (
              <button 
                onClick={() => {
                  setArmaParaEditar(null);
                  setModalArmaAberto(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase text-brand-green-light hover:text-white bg-brand-green/10 border border-brand-green/20 rounded-lg transition-all"
              >
                <Plus size={11} /> Adicionar Arma
              </button>
            )}
          >
            {armas.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-2">Nenhuma arma cadastrada</p>
            ) : (
              <div className="space-y-3">
                {armas.map(arma => (
                  <div key={arma.id} className="bg-brand-dark-2 rounded-xl border border-brand-dark-5 overflow-hidden transition-all duration-300">
                    <div
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-dark-3/50 transition-colors text-left"
                    >
                      <button
                        onClick={() => setArmaExpandida(armaExpandida === arma.id ? null : arma.id)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{arma.modelo}</p>
                            {isAlerta(arma.vencimentoCraf) && (
                              <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500">{arma.fabricante} · {arma.calibre} · {arma.acervo}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-gray-600 bg-brand-dark-4 px-2 py-0.5 rounded-md">
                          {arma.gts.length} GT{arma.gts.length !== 1 ? 's' : ''}
                        </span>
                        {podeEditar && (
                          <div className="flex gap-1.5 border-l border-brand-dark-5 pl-2">
                            <button 
                              onClick={() => {
                                setArmaParaEditar(arma as any);
                                setModalArmaAberto(true);
                              }}
                              className="p-1 hover:text-brand-blue-light transition-colors"
                              title="Editar arma"
                            >
                              <Pencil size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeletarArma(arma.id)}
                              className="p-1 hover:text-red-400 transition-colors"
                              title="Excluir arma"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                        <button 
                          onClick={() => setArmaExpandida(armaExpandida === arma.id ? null : arma.id)}
                          className="p-1 hover:text-white transition-colors"
                        >
                          {armaExpandida === arma.id ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                        </button>
                      </div>
                    </div>

                    {armaExpandida === arma.id && (
                      <div className="border-t border-brand-dark-5 px-4 py-3 space-y-4 bg-brand-dark-3/20">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-gray-600">Série: </span><span className="text-white font-mono">{arma.numeroSerie}</span></div>
                          <div><span className="text-gray-600">Sigma: </span><span className="text-white font-mono">{arma.numeroSigma}</span></div>
                          <div className="col-span-2 flex items-center gap-3">
                            <div>
                              <span className="text-gray-600">CRAF válido até: </span>
                              <BadgeVencimento data={arma.vencimentoCraf} />
                            </div>
                            {(arma as any).crafUrl && (
                              <button
                                onClick={() => visualizarDocumentoBase64((arma as any).crafUrl, `CRAF-${arma.numeroSerie || arma.modelo}`)}
                                className="flex items-center gap-1 text-[9px] font-black text-brand-blue hover:text-brand-blue-light uppercase tracking-wider"
                                title="Visualizar CRAF"
                              >
                                <FileText size={10} /> Ver CRAF
                              </button>
                            )}
                          </div>
                        </div>

                        {/* GTs */}
                        <div className="pt-3 border-t border-brand-dark-5/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-black flex items-center gap-1">
                              <FileText size={10} /> Guias de Tráfego
                            </p>
                            {podeEditar && (
                              <button 
                                onClick={() => setModalGtAberto({ armaId: arma.id })}
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded border border-brand-blue/20 bg-brand-blue/10 text-[9px] font-black text-brand-blue-light hover:text-white hover:bg-brand-blue/20 transition-all uppercase tracking-wider"
                              >
                                <Plus size={10} /> Adicionar GT
                              </button>
                            )}
                          </div>
                          {arma.gts.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic">Nenhuma Guia de Tráfego cadastrada para esta arma.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {arma.gts.map(gt => (
                                <div key={gt.id} className="flex items-center justify-between bg-brand-dark-3/40 hover:bg-brand-dark-3/60 rounded-xl px-3 py-2 border border-brand-dark-5/50 transition-colors">
                                  <div className="text-xs">
                                    <span className="text-white font-medium">{gt.tipo}</span>
                                    <span className="text-gray-500"> · {gt.destino}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <BadgeVencimento data={gt.vencimento} />
                                    {(gt as any).arquivoUrl && (
                                      <button
                                        onClick={() => visualizarDocumentoBase64((gt as any).arquivoUrl, `GT-${gt.tipo}-${gt.destino}`)}
                                        className="p-0.5 text-brand-blue hover:text-brand-blue-light transition-colors"
                                        title="Visualizar Guia"
                                      >
                                        <FileText size={11} />
                                      </button>
                                    )}
                                    {podeEditar && (
                                      <div className="flex gap-1 border-l border-brand-dark-5 pl-1.5">
                                        <button 
                                          onClick={() => setModalGtAberto({ armaId: arma.id, gt: gt as any })}
                                          className="p-0.5 text-gray-500 hover:text-brand-blue-light transition-colors"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeletarGt(gt.id)}
                                          className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* Manejos */}
          <Secao 
            titulo={`Autorizações de Manejo IBAMA (${manejos.length})`} 
            icon={Award}
            actionButton={podeEditar && (
              <button 
                onClick={() => {
                  setManejoParaEditar(null);
                  setModalManejoAberto(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase text-brand-green-light hover:text-white bg-brand-green/10 border border-brand-green/20 rounded-lg transition-all"
              >
                <Plus size={11} /> Adicionar Manejo
              </button>
            )}
          >
            {manejos.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-2">Nenhuma autorização de manejo cadastrada</p>
            ) : (
              <div className="space-y-2">
                {manejos.map(m => (
                  <div key={m.id} className="bg-brand-dark-2 rounded-xl border border-brand-dark-5 px-4 py-3 hover:border-brand-dark-4 transition-all duration-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{m.nomeFazenda}</p>
                          {podeEditar && (
                            <div className="flex gap-1.5 pl-1.5 border-l border-brand-dark-5">
                              <button 
                                onClick={() => {
                                  setManejoParaEditar(m as any);
                                  setModalManejoAberto(true);
                                }}
                                className="text-gray-500 hover:text-brand-blue-light transition-colors"
                              >
                                <Pencil size={11} />
                              </button>
                              <button 
                                onClick={() => handleDeletarManejo(m.id)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{m.nomeProprietario} · {m.cidade}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5 font-mono">CAR: {m.numeroCar}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <BadgeVencimento data={m.vencimento} />
                        <p className={`text-[10px] font-bold ${m.status === 'Ativo' ? 'text-green-400' : 'text-gray-500'}`}>
                          {m.status}
                        </p>
                        {(m as any).arquivoUrl && (
                          <button
                            onClick={() => visualizarDocumentoBase64((m as any).arquivoUrl, `Manejo-${m.nomeFazenda}`)}
                            className="flex items-center gap-1 text-[9px] font-black text-brand-blue hover:text-brand-blue-light uppercase tracking-wider"
                            title="Visualizar Autorização"
                          >
                            <FileText size={10} /> Ver Doc
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* Rodapé LGPD */}
          <div className="text-center text-[10px] text-gray-700 py-2 border-t border-brand-dark-5/40">
            Dados exibidos com autorização do atirador · {podeEditar ? 'Modo de Edição / Escrita Habilitado' : 'Somente Leitura'} · Vinculado a {vinculo.despachante_nome}
          </div>
        </div>
      </div>

      {/* MODAIS DE EDICAO DO ACERVO */}
      {modalArmaAberto && (
        <ModalArma 
          armaParaEditar={armaParaEditar || undefined}
          onFechar={() => {
            setModalArmaAberto(false);
            setArmaParaEditar(null);
          }}
          onSalvar={handleSalvarArma}
        />
      )}

      {modalGtAberto && (
        <ModalGt 
          armaAcervo={armas.find(a => a.id === modalGtAberto.armaId)?.acervo || 'Tiro Desportivo'}
          gtParaEditar={modalGtAberto.gt}
          onFechar={() => setModalGtAberto(null)}
          onSalvar={handleSalvarGt}
        />
      )}

      {modalManejoAberto && (
        <ModalManejo 
          manejoParaEditar={manejoParaEditar || undefined}
          onFechar={() => {
            setModalManejoAberto(false);
            setManejoParaEditar(null);
          }}
          onSalvar={handleSalvarManejo}
        />
      )}
    </div>
  );
}
