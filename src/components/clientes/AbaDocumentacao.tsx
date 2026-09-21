import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Target, MapPin, Calendar, Plus, Trash2, ShieldAlert, AlertTriangle,
  ChevronDown, ChevronUp, FileText, Globe, Landmark, Upload, Loader2, Pencil, RefreshCw, Camera
} from 'lucide-react';
import { parseIbamaPdf } from '../../services/ibamaParserService';
import { parseGtPdf } from '../../services/gtParserService';
import { exportarAcervoPdf, exportarAcervoExcel } from '../../services/geradorExportacaoAcervo';
import { useClientes } from '../../context/ClientesContext';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo } from '../../types';
import { formatarData, normalizarCalibre, normalizarModelo, normalizarFabricante } from '../../utils/formatters';
import { calcularAlerta, obterClasseAlerta } from '../../utils/vencimentos';
import { fileToBase64, visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { useAuth } from '../../context/AuthContext';
import { buscarAcervoVinculado } from '../../services/vinculosService';
import { ModalUploadCelular } from '../common/ModalUploadCelular';
import { normalizarTipoArma } from '../../data/catalogoArmas';

const TIPOS_ARMA = ['Pistola', 'Revólver', 'Carabina / Fuzil', 'Espingarda'];

const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

interface Props {
  cliente: Cliente;
  armaIdInicial?: string;
  cacEmpresaId?: string;
  podeEditarVinculo?: boolean;
}

export function AbaDocumentacao({ cliente, armaIdInicial, cacEmpresaId, podeEditarVinculo }: Props) {
  const { usuario } = useAuth();
  const { 
    buscarArmas, salvarArma, deletarArma,
    buscarGts, salvarGt, deletarGt,
    buscarManejos, salvarManejo, deletarManejo,
    atualizarCliente
  } = useClientes();

  const podeEditar = !cacEmpresaId || podeEditarVinculo || usuario?.tipoConta === 'empresa';

  const [armas, setArmas] = useState<Arma[]>([]);
  const [manejos, setManejos] = useState<AutorizacaoManejo[]>([]);
  const [gtsPorArma, setGtsPorArma] = useState<Record<string, GuiaTrafego[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [expandirArma, setExpandirArma] = useState<string | null>(armaIdInicial || null);
  const [alertasCriticos, setAlertasCriticos] = useState(0);
  const [alertasItens, setAlertasItens] = useState<{ id: string; tipo: string; nome: string; data: string }[]>([]);

  const isAlerta = (venc: string | null | undefined, tipo: 'CR' | 'IBAMA_CR' | 'CRAF' | 'GT' | 'MANEJO') => {
    if (!venc) return false;
    const res = calcularAlerta(tipo, venc);
    return res.nivel !== 'OK';
  };

  useEffect(() => {
    const itens: { id: string; tipo: string; nome: string; data: string }[] = [];
    if (isAlerta(cliente.vencimentoCr, 'CR')) {
      itens.push({ id: 'cr', tipo: 'CR (PF / Exército)', nome: cliente.numeroCr || 'Não informado', data: cliente.vencimentoCr! });
    }
    if (isAlerta(cliente.vencimentoCrIbama, 'IBAMA_CR')) {
      itens.push({ id: 'cr-ibama', tipo: 'CR IBAMA', nome: cliente.numeroCrIbama || 'Não informado', data: cliente.vencimentoCrIbama! });
    }
    armas.forEach(a => {
      if (isAlerta(a.vencimentoCraf, 'CRAF')) {
        itens.push({ id: `arma-${a.id}`, tipo: 'CRAF de Arma', nome: `${a.tipo || ''} ${a.modelo} (${a.numeroSerie})`, data: a.vencimentoCraf! });
      }
      const gts = gtsPorArma[a.id] || [];
      gts.forEach(g => {
        if (isAlerta(g.vencimento, 'GT')) {
          itens.push({ id: `gt-${g.id}`, tipo: 'Guia de Tráfego (GT)', nome: `Arma ${a.modelo} (${a.numeroSerie}) -> ${g.destino}`, data: g.vencimento! });
        }
      });
    });
    manejos.forEach(m => {
      if (m.status !== 'Inerte' && isAlerta(m.vencimento, 'MANEJO')) {
        itens.push({ id: `manejo-${m.id}`, tipo: 'Autorização de Manejo', nome: `Fazenda ${m.nomeFazenda} (CAR: ${m.numeroCar})`, data: m.vencimento! });
      }
    });

    setAlertasItens(itens);
    setAlertasCriticos(itens.length);
  }, [cliente, armas, gtsPorArma, manejos]);

  const [exportando, setExportando] = useState(false);

  const handleExportarPdf = async () => {
    setExportando(true);
    try {
      const armasComGts = armas.map(arma => ({
        ...arma,
        gts: gtsPorArma[arma.id] || []
      }));

      const perfil = {
        nome: cliente.nome,
        cpf: cliente.cpf,
        contato: cliente.contato,
        cr: cliente.numeroCr,
        vencimentoCr: cliente.vencimentoCr,
        crIbama: cliente.numeroCrIbama,
        vencimentoCrIbama: cliente.vencimentoCrIbama,
        endereco: cliente.endereco,
        crTiroDesportivo: cliente.crTiroDesportivo,
        crCaca: cliente.crCaca,
        crColecionamento: cliente.crColecionamento
      };

      await exportarAcervoPdf(perfil, armasComGts, manejos);
    } catch (e) {
      console.error(e);
      alert('Falha ao exportar PDF.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarExcel = () => {
    setExportando(true);
    try {
      const armasComGts = armas.map(arma => ({
        ...arma,
        gts: gtsPorArma[arma.id] || []
      }));

      const perfil = {
        nome: cliente.nome,
        cpf: cliente.cpf,
        contato: cliente.contato,
        cr: cliente.numeroCr,
        vencimentoCr: cliente.vencimentoCr,
        crIbama: cliente.numeroCrIbama,
        vencimentoCrIbama: cliente.vencimentoCrIbama,
        endereco: cliente.endereco,
        crTiroDesportivo: cliente.crTiroDesportivo,
        crCaca: cliente.crCaca,
        crColecionamento: cliente.crColecionamento
      };

      exportarAcervoExcel(perfil, armasComGts, manejos);
    } catch (e) {
      console.error(e);
      alert('Falha ao exportar Planilha.');
    } finally {
      setExportando(false);
    }
  };

  const [modalArma, setModalArma] = useState(false);
  const [armaParaEditar, setArmaParaEditar] = useState<Arma | null>(null);
  const [modalGt, setModalGt] = useState<{armaId: string, gt?: GuiaTrafego} | null>(null);
  const [modalManejo, setModalManejo] = useState(false);
  const [manejoParaEditar, setManejoParaEditar] = useState<AutorizacaoManejo | null>(null);
  const [modalEditarCr, setModalEditarCr] = useState<{ tipo: 'CR' | 'IBAMA_CR'; label: string } | null>(null);

  const carregadoUmaVez = useRef(false);

  const carregarDados = useCallback(async () => {
    if (!carregadoUmaVez.current) {
      setCarregando(true);
    }
    try {
      if (cacEmpresaId && usuario?.empresaId) {
        const acervo = await buscarAcervoVinculado(cacEmpresaId, usuario.empresaId);
        if (acervo) {
          setArmas(acervo.armas.map(a => ({
            id: a.id,
            clienteId: acervo.cliente.id,
            tipo: a.tipo || '',
            modelo: a.modelo,
            calibre: a.calibre,
            fabricante: a.fabricante,
            numeroSerie: a.numeroSerie,
            numeroSigma: a.numeroSigma,
            acervo: a.acervo as any,
            vencimentoCraf: a.vencimentoCraf || '',
            crafUrl: a.crafUrl,
            crafEmRenovacao: !!a.crafEmRenovacao,
            criadoEm: new Date().toISOString()
          })));
          setManejos(acervo.manejos.map(m => ({
            id: m.id,
            clienteId: acervo.cliente.id,
            numeroCar: m.numeroCar,
            nomeFazenda: m.nomeFazenda,
            nomeProprietario: m.nomeProprietario,
            cidade: m.cidade,
            vencimento: m.vencimento,
            status: m.status as any,
            arquivoUrl: m.arquivoUrl,
            manejoEmRenovacao: !!m.manejoEmRenovacao,
            criadoEm: new Date().toISOString()
          })));
          
          const gtsMap: Record<string, GuiaTrafego[]> = {};
          acervo.armas.forEach(a => {
            gtsMap[a.id] = a.gts.map(g => ({
              id: g.id,
              armaId: a.id,
              tipo: g.tipo as any,
              vencimento: g.vencimento,
              destino: g.destino,
              arquivoUrl: g.arquivoUrl,
              gtEmRenovacao: !!g.gtEmRenovacao,
              criadoEm: new Date().toISOString()
            }));
          });
          setGtsPorArma(gtsMap);
          setCarregando(false);
          return;
        }
      }

      const [armasData, manejosData] = await Promise.all([
        buscarArmas(cliente.id, cacEmpresaId),
        buscarManejos(cliente.id, cacEmpresaId)
      ]);
      setArmas(armasData);
      setManejos(manejosData);

      // Carregar GTs para cada arma
      const gtsMap: Record<string, GuiaTrafego[]> = {};
      await Promise.all(armasData.map(async (a) => {
        gtsMap[a.id] = await buscarGts(a.id);
      }));
      setGtsPorArma(gtsMap);
      carregadoUmaVez.current = true;
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setCarregando(false);
    }
  }, [buscarArmas, buscarGts, buscarManejos, cacEmpresaId, cliente.id, usuario?.empresaId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  if (carregando) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Barra de Ações de Exportação ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-brand-dark-5 bg-brand-dark-3/30 backdrop-blur-sm">
        <div>
          <h4 className="text-sm font-bold text-white">Exportação de Acervo</h4>
          <p className="text-[10px] text-gray-400">Gere relatórios impressos ou planilhas dos dados consolidados de armas, guias e manejos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              carregadoUmaVez.current = false;
              carregarDados();
            }}
            disabled={exportando || carregando}
            title="Atualizar acervo"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-brand-dark-5 bg-brand-dark-3 text-gray-400 hover:text-white hover:bg-brand-dark-4 disabled:opacity-50"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button
            onClick={handleExportarPdf}
            disabled={exportando}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-brand-blue/20 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 disabled:opacity-50"
          >
            <FileText size={14} /> Exportar PDF
          </button>
          <button
            onClick={handleExportarExcel}
            disabled={exportando}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-brand-green/20 bg-brand-green/10 text-brand-green hover:bg-brand-green/20 disabled:opacity-50"
          >
            <FileText size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Banner de Alertas Críticos */}
      {alertasCriticos > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-300">{alertasCriticos} documento(s) com alerta</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                Documentos vencidos ou no período de alerta:
              </p>
            </div>
          </div>
          <div className="pl-7 space-y-1">
            {alertasItens.map(item => {
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const vDate = new Date(item.data);
              const vencido = vDate < hoje;
              return (
                <p key={item.id} className="text-xs text-red-400/90 flex flex-wrap gap-x-1.5 items-center">
                  <span className="font-bold text-white shrink-0">• [{item.tipo}]</span>
                  <span className="truncate">{item.nome}</span>
                  <span className={`font-black shrink-0 px-1.5 py-0.2 rounded text-[9px] ${vencido ? 'bg-red-500/25 text-red-300' : 'bg-amber-500/25 text-amber-300'}`}>
                    {vencido ? 'VENCIDO' : 'VENCE'} EM {formatarData(item.data)}
                  </span>
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Resumo de Vencimentos CR ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardVencimento 
          label="CR (PF / Exército)" 
          numero={cliente.numeroCr} 
          data={cliente.vencimentoCr} 
          tipo="CR"
          icon={<ShieldAlert size={20} />}
          emRenovacao={cliente.crEmRenovacao}
          podeEditar={podeEditar}
          onEditar={() => setModalEditarCr({ tipo: 'CR', label: 'CR (PF / Exército)' })}
        />
        <CardVencimento 
          label="CR IBAMA" 
          numero={cliente.numeroCrIbama}
          data={cliente.vencimentoCrIbama} 
          tipo="IBAMA_CR"
          icon={<Globe size={20} />}
          emRenovacao={cliente.crIbamaEmRenovacao}
          podeEditar={podeEditar}
          onEditar={() => setModalEditarCr({ tipo: 'IBAMA_CR', label: 'CR IBAMA' })}
        />
      </div>

      {/* ── Seção Armas & CRAFs ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-brand-blue" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              Armas & CRAFs
              <span className="bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full text-[10px]">
                {armas.length}
              </span>
            </h3>
          </div>
          {podeEditar && (
            <button onClick={() => setModalArma(true)} className="btn-primary py-1.5 px-3 text-xs">
              <Plus size={14} /> Adicionar Arma
            </button>
          )}
        </div>

        {armas.length === 0 ? (
          <EmptyState msg="Nenhuma arma cadastrada." />
        ) : (
          <div className="space-y-3">
            {armas.map(arma => (
              <div key={arma.id} className="card bg-brand-dark-3/50 border-brand-dark-5 p-0 overflow-hidden">
                <div 
                  onClick={() => setExpandirArma(expandirArma === arma.id ? null : arma.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-brand-dark-3 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                      <Target size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {arma.tipo ? `${arma.tipo} - ` : ''}{arma.modelo} • {arma.calibre}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest truncate">
                          Série: {arma.numeroSerie} • SIGMA: {arma.numeroSigma}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue-light font-black uppercase tracking-tighter shrink-0">
                          {arma.acervo}
                        </span>
                        {(() => {
                          const gts = gtsPorArma[arma.id] || [];
                          const gtsAlerta = gts.filter(g => isAlerta(g.vencimento, 'GT')).length;
                          if (gtsAlerta > 0) {
                            return (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase tracking-tighter shrink-0 flex items-center gap-1">
                                <AlertTriangle size={10} /> {gtsAlerta} GT com alerta
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-brand-dark-5/30 sm:border-0">
                    <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0 shrink-0">
                      <p className="text-[9px] text-gray-500 font-bold uppercase sm:mb-1">CRAF:</p>
                      <BadgeVencimento data={arma.vencimentoCraf} tipo="CRAF" emRenovacao={arma.crafEmRenovacao} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {arma.crafUrl && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            visualizarDocumentoBase64(arma.crafUrl!, `CRAF-${arma.numeroSerie || 'arma'}`);
                          }}
                          className="p-2 rounded-lg bg-brand-dark-2 text-brand-blue hover:text-brand-blue-light transition-colors"
                          title="Visualizar CRAF"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      {podeEditar && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setArmaParaEditar(arma);
                              setModalArma(true);
                            }}
                            className="p-2 rounded-lg bg-brand-dark-2 text-gray-400 hover:text-brand-blue transition-colors"
                            title="Editar Arma"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Deseja realmente excluir esta arma e todas as suas guias?')) {
                                deletarArma(arma.id).then(carregarDados);
                              }
                            }}
                            className="p-2 rounded-lg bg-brand-dark-2 text-gray-400 hover:text-red-400 transition-colors"
                            title="Excluir Arma"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <div className="p-1 text-gray-400">
                        {expandirArma === arma.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>
                </div>

                {expandirArma === arma.id && (
                  <div className="border-t border-brand-dark-5 p-4 bg-brand-dark-4 animate-slide-down">
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                         Guias de Tráfego (GTs)
                         <span className="bg-brand-dark-3 text-gray-400 px-1.5 py-0.5 rounded-full text-[9px]">
                           {gtsPorArma[arma.id]?.length || 0}
                         </span>
                       </h4>
                       {podeEditar && (
                         <button 
                           onClick={() => setModalGt({armaId: arma.id})} 
                           className="text-[10px] font-bold text-brand-blue-light hover:underline flex items-center gap-1"
                         >
                           <Plus size={12} /> Nova Guia
                         </button>
                       )}
                    </div>

                    <div className="space-y-2">
                      {gtsPorArma[arma.id]?.length === 0 ? (
                        <p className="text-[10px] text-gray-600 italic">Nenhuma guia cadastrada para esta arma.</p>
                      ) : (
                        gtsPorArma[arma.id]?.map(gt => (
                          <div key={gt.id} className="flex items-center justify-between p-2.5 rounded-lg bg-brand-dark-3 border border-brand-dark-5">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-brand-dark-2 text-brand-blue">
                                <MapPin size={12} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">GT {gt.tipo} - {gt.destino}</p>
                                <p className="text-[9px] text-gray-500 uppercase">Vencimento: {formatarData(gt.vencimento)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <BadgeVencimento data={gt.vencimento} tipo="GT" emRenovacao={gt.gtEmRenovacao} />
                              {gt.arquivoUrl && (
                                <button 
                                  onClick={() => visualizarDocumentoBase64(gt.arquivoUrl!, `GT-${gt.tipo}-${gt.destino}`)}
                                  className="text-brand-blue hover:text-brand-blue-light p-1"
                                  title="Visualizar Guia"
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                              {podeEditar && (
                                <>
                                  <button onClick={() => setModalGt({armaId: arma.id, gt})} className="text-gray-600 hover:text-brand-blue p-1" title="Editar Guia">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => {
                                    if(confirm('Excluir esta guia?')) {
                                      deletarGt(gt.id).then(carregarDados);
                                    }
                                  }} className="text-gray-600 hover:text-red-400 p-1" title="Excluir Guia">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {podeEditar && (
                      <div className="mt-4 pt-3 border-t border-brand-dark-5 flex justify-end">
                        <button onClick={() => {
                          if(confirm('Excluir esta arma e todas as suas guias?')) {
                            deletarArma(arma.id).then(carregarDados);
                          }
                        }} className="flex items-center gap-1.5 text-[10px] font-bold text-red-500/60 hover:text-red-500 transition-colors uppercase">
                          <Trash2 size={12} /> Remover Arma
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Seção IBAMA & Manejo ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-brand-blue" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              IBAMA: Autorizações de Manejo
              <span className="bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full text-[10px]">
                {manejos.length}
              </span>
            </h3>
          </div>
          {podeEditar && (
            <button onClick={() => setModalManejo(true)} className="btn-primary py-1.5 px-3 text-xs">
              <Plus size={14} /> Novo Manejo
            </button>
          )}
        </div>

        {manejos.length === 0 ? (
          <EmptyState msg="Nenhuma autorização de manejo cadastrada." />
        ) : (
          <div className="space-y-3">
            {manejos.map(m => (
              <div key={m.id} className="card bg-brand-dark-3/50 border-brand-dark-5 p-0 overflow-hidden group">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">
                          {m.nomeFazenda} • {m.cidade}
                        </p>
                        {m.status === 'Inerte' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 font-black uppercase tracking-tighter shrink-0">
                            Inerte
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest truncate mt-0.5">
                        CAR: {m.numeroCar} • {m.nomeProprietario}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-brand-dark-5/30 sm:border-0">
                    <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0 shrink-0">
                      <p className="text-[9px] text-gray-500 font-bold uppercase sm:mb-1">Validade:</p>
                      <BadgeVencimento data={m.vencimento} tipo="MANEJO" status={m.status} emRenovacao={m.manejoEmRenovacao} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.arquivoUrl && (
                        <button 
                          onClick={() => visualizarDocumentoBase64(m.arquivoUrl!, `Manejo-${m.nomeFazenda}`)} 
                          className="p-2 rounded-lg bg-brand-dark-2 text-brand-blue hover:text-brand-blue-light transition-colors"
                          title="Visualizar Autorização"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      {podeEditar && (
                        <>
                          <button 
                            onClick={() => {
                              setManejoParaEditar(m);
                              setModalManejo(true);
                            }} 
                            className="p-2 rounded-lg bg-brand-dark-2 text-gray-400 hover:text-brand-blue transition-colors"
                            title="Editar Manejo"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              if(confirm('Excluir esta autorização?')) {
                                deletarManejo(m.id).then(carregarDados);
                              }
                            }} 
                            className="p-2 rounded-lg bg-brand-dark-2 text-gray-400 hover:text-red-400 transition-colors"
                            title="Excluir Manejo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Modais --- */}
      {modalArma && (
        <ModalArma 
          armaParaEditar={armaParaEditar || undefined}
          onFechar={() => {
            setModalArma(false);
            setArmaParaEditar(null);
          }} 
          onSalvar={async (d) => {
            try {
              const armaFormatada = {
                ...d,
                tipo: d.tipo?.trim().toUpperCase(),
                modelo: normalizarModelo(d.modelo),
                calibre: normalizarCalibre(d.calibre),
                fabricante: normalizarFabricante(d.fabricante),
                numeroSerie: d.numeroSerie?.trim().toUpperCase(),
                numeroSigma: d.numeroSigma?.trim().toUpperCase(),
                clienteId: cliente.id,
                crafEmRenovacao: d.crafEmRenovacao
              };
              await salvarArma(armaFormatada, cacEmpresaId);
              await carregarDados();
              setModalArma(false);
            } catch (err: any) {
              console.error(err);
              alert('Erro ao salvar arma: ' + (err.message || 'Verifique se você executou o comando SQL no Supabase.'));
            }
          }} 
        />
      )}

      {modalGt && (
        <ModalGt 
          armaAcervo={armas.find(a => a.id === modalGt.armaId)?.acervo || 'Tiro Desportivo'}
          armaNumeroSerie={armas.find(a => a.id === modalGt.armaId)?.numeroSerie}
          gtParaEditar={modalGt.gt}
          onFechar={() => setModalGt(null)} 
          onSalvar={(d) => 
            salvarGt({ 
              ...d, 
              destino: d.destino?.trim().toUpperCase(),
              armaId: modalGt.armaId,
              gtEmRenovacao: d.gtEmRenovacao
            }, cacEmpresaId)
              .then(() => { 
                carregarDados(); 
                setModalGt(null); 
              })
              .catch(err => {
                console.error('Erro ao salvar GT:', err);
                alert('Erro ao salvar guia de tráfego. Verifique sua conexão ou as permissões do banco de dados.');
              })
          } 
        />
      )}

      {modalManejo && (
        <ModalManejo 
          manejoParaEditar={manejoParaEditar || undefined}
          onFechar={() => {
            setModalManejo(false);
            setManejoParaEditar(null);
          }} 
          onSalvar={(d) => salvarManejo({ 
            ...d, 
            numeroCar: d.numeroCar?.trim().toUpperCase(),
            nomeFazenda: d.nomeFazenda?.trim().toUpperCase(),
            nomeProprietario: d.nomeProprietario?.trim().toUpperCase(),
            cidade: d.cidade?.trim().toUpperCase(),
            clienteId: cliente.id,
            id: manejoParaEditar?.id,
            manejoEmRenovacao: d.manejoEmRenovacao
          }, cacEmpresaId)
            .then(() => { 
              carregarDados(); 
              setModalManejo(false);
              setManejoParaEditar(null);
            })
            .catch((err) => {
              console.error('Erro ao salvar manejo:', err);
              alert('Erro ao salvar manejo: ' + (err.message || JSON.stringify(err)));
            })
          } 
        />
      )}

      {modalEditarCr && (
        <ModalEditarCr 
          label={modalEditarCr.label}
          numeroInicial={modalEditarCr.tipo === 'CR' ? cliente.numeroCr : cliente.numeroCrIbama}
          dataInicial={modalEditarCr.tipo === 'CR' ? cliente.vencimentoCr : cliente.vencimentoCrIbama}
          urlInicial={modalEditarCr.tipo === 'CR' ? cliente.crUrl : cliente.crIbamaUrl}
          emRenovacaoInicial={modalEditarCr.tipo === 'CR' ? cliente.crEmRenovacao : cliente.crIbamaEmRenovacao}
          onFechar={() => setModalEditarCr(null)}
          onSalvar={async (d) => {
            try {
              const mudancas: any = {};
              if (modalEditarCr.tipo === 'CR') {
                mudancas.numeroCr = d.numero?.trim().toUpperCase();
                mudancas.vencimentoCr = d.vencimento;
                mudancas.crUrl = d.url;
                mudancas.crEmRenovacao = d.emRenovacao;
              } else {
                mudancas.numeroCrIbama = d.numero?.trim().toUpperCase();
                mudancas.vencimentoCrIbama = d.vencimento;
                mudancas.crIbamaUrl = d.url;
                mudancas.crIbamaEmRenovacao = d.emRenovacao;
              }

              await atualizarCliente(cliente.id, mudancas, cacEmpresaId);
              await carregarDados();
              setModalEditarCr(null);
            } catch (err: any) {
              console.error('Erro ao salvar CR:', err);
              alert('Erro ao salvar CR: ' + (err.message || JSON.stringify(err)));
            }
          }}
        />
      )}
    </div>
  );
}

export function ModalEditarCr({ 
  label,
  numeroInicial,
  dataInicial,
  urlInicial,
  emRenovacaoInicial,
  onFechar, 
  onSalvar 
}: { 
  label: string,
  numeroInicial?: string,
  dataInicial?: string,
  urlInicial?: string,
  emRenovacaoInicial?: boolean,
  onFechar: () => void, 
  onSalvar: (d: { numero: string; vencimento: string; url: string; emRenovacao: boolean }) => void 
}) {
  const [form, setForm] = useState({
    numero: numeroInicial || '',
    vencimento: dataInicial || '',
    url: urlInicial || '',
    emRenovacao: emRenovacaoInicial ?? false
  });
  const [cameraModalAberto, setCameraModalAberto] = useState(false);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-6">
          Editar {label}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Número do Documento</label>
            <input 
              type="text" 
              className="input uppercase" 
              value={form.numero} 
              onChange={e => setForm({...form, numero: e.target.value})} 
              placeholder="Ex: 000.766.870-82"
            />
          </div>

          <div>
            <label className="label">Data de Vencimento</label>
            <input 
              type="date" 
              className="input" 
              value={form.vencimento} 
              onChange={e => {
                const val = e.target.value;
                setForm(prev => ({
                  ...prev,
                  vencimento: val,
                  emRenovacao: val !== (dataInicial || '') ? false : prev.emRenovacao
                }));
              }} 
            />
          </div>

          <div className="flex items-center gap-1.5 py-1">
            <input 
              type="checkbox" 
              id="docEmRenovacao"
              checked={form.emRenovacao} 
              onChange={e => setForm({...form, emRenovacao: e.target.checked})}
              className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3 h-3" 
            />
            <label htmlFor="docEmRenovacao" className="text-[10px] text-gray-400 cursor-pointer select-none">
              Aguardando liberação / Renovação em andamento
            </label>
          </div>

          <div>
            <label className="label">Anexo do Documento (PDF ou Imagem)</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                className="hidden" 
                id="cr-attachment" 
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const base64 = await fileToBase64(file);
                      setForm(prev => ({...prev, url: base64, emRenovacao: false}));
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao carregar o arquivo.');
                    }
                  }
                }} 
              />
              <label 
                htmlFor="cr-attachment" 
                className="btn-ghost flex items-center gap-2 cursor-pointer text-xs h-10 border border-brand-dark-5 rounded-lg px-3"
              >
                <Upload size={14} /> {form.url ? 'Alterar Anexo' : 'Anexar Documento'}
              </label>
              
              <button
                type="button"
                onClick={() => setCameraModalAberto(true)}
                className="btn-ghost flex items-center gap-2 text-xs h-10 border border-brand-dark-5 rounded-lg px-3 hover:bg-brand-blue/10 hover:border-brand-blue/30"
              >
                <Camera size={14} /> Tirar Foto
              </button>

              {form.url && (
                <>
                  <button 
                    type="button"
                    onClick={() => {
                      visualizarDocumentoBase64(form.url, `DOC-${label}`);
                    }}
                    className="text-brand-blue hover:text-brand-blue-light text-xs font-semibold"
                  >
                    Visualizar
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({...form, url: ''})}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-800/60 mt-6">
          <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={() => onSalvar(form)} className="btn-primary flex-1">
            Salvar Alterações
          </button>
        </div>
      </div>

      {cameraModalAberto && (
        <ModalUploadCelular
          isOpen={cameraModalAberto}
          onClose={() => setCameraModalAberto(false)}
          onUploadSuccess={(base64) => setForm(prev => ({ ...prev, url: base64, emRenovacao: false }))}
          titulo={`Tirar Foto do ${label}`}
        />
      )}
    </div>
  );
}

// --- Componentes Internos ---

function CardVencimento({ 
  label, 
  numero, 
  data, 
  tipo, 
  icon, 
  emRenovacao,
  podeEditar,
  onEditar 
}: { 
  label: string, 
  numero?: string, 
  data?: string, 
  tipo: string, 
  icon: React.ReactNode, 
  emRenovacao?: boolean,
  podeEditar?: boolean,
  onEditar?: () => void 
}) {
  return (
    <div 
      onClick={podeEditar && onEditar ? onEditar : undefined}
      className={`card bg-brand-dark-3/50 border-brand-dark-5 flex flex-row items-center justify-between p-4 gap-3 flex-wrap xs:flex-nowrap ${
        podeEditar && onEditar ? 'cursor-pointer hover:border-brand-blue/30 hover:bg-brand-dark-3 transition-all' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-2xl bg-brand-blue/10 text-brand-blue shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 truncate">{label}</p>
          <p className={`font-bold text-sm truncate ${numero ? 'text-white' : 'text-gray-500 italic'}`} title={numero}>
            {numero || 'Nº não informado'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">Vencimento</p>
          <BadgeVencimento data={data} tipo={tipo} emRenovacao={emRenovacao} />
        </div>
        {podeEditar && onEditar && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditar();
            }}
            className="p-2 rounded-lg bg-brand-dark-2 text-gray-400 hover:text-brand-blue transition-colors"
            title={`Editar ${label}`}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function BadgeVencimento({ data, tipo, status, emRenovacao }: { data?: string, tipo: string, status?: string, emRenovacao?: boolean }) {
  if (!data) return <span className="text-[10px] text-gray-600 italic">Não informado</span>;
  if (status === 'Inerte') {
    return (
      <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-brand-dark-5 bg-brand-dark-3 text-gray-500">
        {formatarData(data)}
      </span>
    );
  }
  if (emRenovacao) {
    return (
      <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-brand-blue/30 bg-brand-blue/10 text-brand-blue-light flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-blue-light animate-pulse" />
        AG. LIBERAÇÃO ({formatarData(data)})
      </span>
    );
  }
  const alerta = calcularAlerta(tipo, data);
  const classes = obterClasseAlerta(alerta.nivel);
  
  return (
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${classes}`}>
      {formatarData(data)}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-8 text-center bg-brand-dark-3/30 border border-dashed border-brand-dark-5 rounded-2xl">
      <p className="text-xs text-gray-500 italic">{msg}</p>
    </div>
  );
}

// --- Formulários Internos (Modais) ---

export function ModalArma({ armaParaEditar, onFechar, onSalvar }: { armaParaEditar?: Arma, onFechar: () => void, onSalvar: (d: any) => void }) {
  const { 
    opcoesArmas,
    calibresRegistrados,
    obterTiposDeArma,
    obterFabricantesPorTipo,
    obterModelosPorTipoEFabricante,
    obterCalibreSugerido,
    obterCalibresCompativeis,
    obterDadosPorModelo
  } = useClientes();

  const [form, setForm] = useState({
    id: armaParaEditar?.id,
    tipo: armaParaEditar?.tipo ? normalizarTipoArma(armaParaEditar.tipo) : 'PISTOLA', 
    fabricante: armaParaEditar?.fabricante ? normalizarFabricante(armaParaEditar.fabricante) : '', 
    modelo: armaParaEditar?.modelo ? normalizarModelo(armaParaEditar.modelo) : '', 
    calibre: armaParaEditar?.calibre ? normalizarCalibre(armaParaEditar.calibre) : '', 
    numeroSerie: armaParaEditar?.numeroSerie || '', 
    numeroSigma: armaParaEditar?.numeroSigma || '', 
    acervo: (armaParaEditar?.acervo || 'Tiro Desportivo') as any, 
    vencimentoCraf: armaParaEditar?.vencimentoCraf || '',
    crafUrl: armaParaEditar?.crafUrl || '',
    crafEmRenovacao: armaParaEditar?.crafEmRenovacao ?? false
  });

  const [cameraModalAberto, setCameraModalAberto] = useState(false);
  const [modoManualModelo, setModoManualModelo] = useState(false);
  const [modoManualFabricante, setModoManualFabricante] = useState(false);
  const [modoManualCalibre, setModoManualCalibre] = useState(false);
  const [calibreAutoSugerido, setCalibreAutoSugerido] = useState<string | null>(null);

  // Tipos disponíveis (Base + Aprendidos)
  const tiposDisponiveis = obterTiposDeArma();

  // Fabricantes disponíveis filtrados pelo tipo selecionado
  const fabricantesFiltrados = obterFabricantesPorTipo(form.tipo);

  // Modelos disponíveis filtrados por tipo e fabricante
  const modelosFiltrados = obterModelosPorTipoEFabricante(form.tipo, form.fabricante);

  // Calibres compatíveis estritamente filtrados pelo tipo e modelo
  const calibresCompativeis = obterCalibresCompativeis(form.tipo, form.modelo);

  // Mudança do tipo de arma (Cascata com limpeza inteligente)
  const handleTipoChange = (novoTipo: string) => {
    const tipoNorm = normalizarTipoArma(novoTipo);
    setForm(prev => {
      const novosModelos = obterModelosPorTipoEFabricante(tipoNorm, prev.fabricante);
      const modeloAindaValido = novosModelos.includes(prev.modelo);
      const novoModelo = modeloAindaValido ? prev.modelo : '';

      const novosCalibres = obterCalibresCompativeis(tipoNorm, novoModelo);
      const calibreAindaValido = novosCalibres.includes(prev.calibre);
      const calSug = novoModelo ? obterCalibreSugerido(tipoNorm, prev.fabricante, novoModelo) : undefined;
      const novoCalibre = calSug || (calibreAindaValido ? prev.calibre : '');

      setCalibreAutoSugerido(calSug || null);

      return {
        ...prev,
        tipo: tipoNorm,
        modelo: novoModelo,
        calibre: novoCalibre
      };
    });
  };

  // Mudança do fabricante (Cascata)
  const handleFabricanteChange = (novoFab: string) => {
    if (novoFab === '__NOVO__') {
      setModoManualFabricante(true);
      return;
    }
    const fabNorm = normalizarFabricante(novoFab);
    setForm(prev => {
      const novosModelos = obterModelosPorTipoEFabricante(prev.tipo, fabNorm);
      const modeloAindaValido = novosModelos.includes(prev.modelo);
      const novoModelo = modeloAindaValido ? prev.modelo : '';
      const calSug = novoModelo ? obterCalibreSugerido(prev.tipo, fabNorm, novoModelo) : undefined;
      if (calSug) setCalibreAutoSugerido(calSug);
      return {
        ...prev,
        fabricante: fabNorm,
        modelo: novoModelo,
        calibre: calSug ? calSug : prev.calibre
      };
    });
  };

  // Mudança do modelo (Preenchimento inteligente em cascata bidirecional)
  const handleModeloChange = (novoModelo: string) => {
    if (novoModelo === '__NOVO__') {
      setModoManualModelo(true);
      return;
    }
    const modNorm = normalizarModelo(novoModelo);
    const dadosModelo = obterDadosPorModelo(modNorm);

    if (dadosModelo) {
      const tipoFinal = dadosModelo.tipo || form.tipo;
      const fabFinal = form.fabricante || dadosModelo.fabricante || '';
      const calSug = dadosModelo.calibrePadrao || obterCalibreSugerido(tipoFinal, fabFinal, modNorm);

      if (calSug) setCalibreAutoSugerido(calSug);
      else setCalibreAutoSugerido(null);

      setForm(prev => ({
        ...prev,
        tipo: tipoFinal,
        fabricante: prev.fabricante || dadosModelo.fabricante || prev.fabricante,
        modelo: modNorm,
        calibre: calSug || prev.calibre
      }));
    } else {
      const calSug = obterCalibreSugerido(form.tipo, form.fabricante, modNorm);
      if (calSug) setCalibreAutoSugerido(calSug);
      else setCalibreAutoSugerido(null);

      setForm(prev => ({
        ...prev,
        modelo: modNorm,
        calibre: calSug || prev.calibre
      }));
    }
  };

  const handleCalibreChange = (novoCal: string) => {
    if (novoCal === '__NOVO__') {
      setModoManualCalibre(true);
      return;
    }
    setForm(prev => ({ ...prev, calibre: novoCal }));
    setCalibreAutoSugerido(null);
  };

  const handleSalvar = () => {
    const formatado = {
      ...form,
      tipo: normalizarTipoArma(form.tipo),
      fabricante: normalizarFabricante(form.fabricante),
      modelo: normalizarModelo(form.modelo),
      calibre: normalizarCalibre(form.calibre),
      numeroSerie: form.numeroSerie?.trim().toUpperCase(),
      numeroSigma: form.numeroSigma?.trim().toUpperCase()
    };
    onSalvar(formatado);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {armaParaEditar ? 'Editar Arma' : 'Cadastrar Nova Arma'}
            </h3>
            <p className="text-[11px] text-gray-400">
              Seleção inteligente em cascata com aprendizado automático.
            </p>
          </div>
          <button 
            type="button" 
            onClick={onFechar} 
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-brand-dark-4"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Linha 1: Tipo de Arma e Fabricante / Marca */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">1. Tipo de Arma</label>
              <select
                className="input uppercase font-bold text-xs" 
                value={form.tipo} 
                onChange={e => handleTipoChange(e.target.value)}
              >
                <option value="" disabled>SELECIONE O TIPO...</option>
                {tiposDisponiveis.map(t => (
                  <option key={t} value={t} className="bg-brand-dark-4 text-white">
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label text-xs m-0">2. Marca / Fabricante</label>
                {modoManualFabricante && (
                  <button 
                    type="button" 
                    onClick={() => setModoManualFabricante(false)}
                    className="text-[10px] text-brand-blue hover:underline"
                  >
                    Ver Lista
                  </button>
                )}
              </div>
              {modoManualFabricante ? (
                <input 
                  type="text" 
                  className="input uppercase font-bold text-xs"
                  placeholder="Ex: CANIK, CZ..."
                  value={form.fabricante}
                  onChange={e => setForm({ ...form, fabricante: normalizarFabricante(e.target.value) })}
                  autoFocus
                />
              ) : (
                <select 
                  className="input uppercase font-bold text-xs" 
                  value={form.fabricante} 
                  onChange={e => handleFabricanteChange(e.target.value)}
                >
                  <option value="">SELECIONE A MARCA...</option>
                  {fabricantesFiltrados.map(f => (
                    <option key={f} value={f} className="bg-brand-dark-4 text-white">
                      {f.toUpperCase()}
                    </option>
                  ))}
                  {form.fabricante && !fabricantesFiltrados.includes(form.fabricante) && (
                    <option key={form.fabricante} value={form.fabricante} className="bg-brand-dark-4 text-white">
                      {form.fabricante.toUpperCase()}
                    </option>
                  )}
                  <option value="__NOVO__" className="bg-brand-blue/20 text-brand-blue-light font-bold">
                    + OUTRA MARCA (DIGITAR)...
                  </option>
                </select>
              )}
            </div>
          </div>

          {/* Linha 2: Modelo e Calibre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label text-xs m-0 flex items-center gap-1">
                  <span>3. Modelo</span>
                  {modelosFiltrados.length > 0 && !modoManualModelo && (
                    <span className="text-[10px] text-gray-500 font-normal">
                      ({modelosFiltrados.length})
                    </span>
                  )}
                </label>
                {modoManualModelo && (
                  <button 
                    type="button" 
                    onClick={() => setModoManualModelo(false)}
                    className="text-[10px] text-brand-blue hover:underline"
                  >
                    Ver Lista
                  </button>
                )}
              </div>
              {modoManualModelo ? (
                <input 
                  type="text" 
                  className="input uppercase font-bold text-xs"
                  placeholder="Digite o modelo (ex: METE MC9)"
                  value={form.modelo}
                  onChange={e => setForm({ ...form, modelo: normalizarModelo(e.target.value) })}
                  autoFocus
                />
              ) : (
                <select 
                  className="input uppercase font-bold text-xs" 
                  value={form.modelo} 
                  onChange={e => handleModeloChange(e.target.value)}
                >
                  <option value="">
                    {form.fabricante 
                      ? `MODELOS ${form.fabricante.toUpperCase()}...` 
                      : `SELECIONE O MODELO (${form.tipo || 'ARMA'})...`}
                  </option>
                  {modelosFiltrados.map(m => (
                    <option key={m} value={m} className="bg-brand-dark-4 text-white">
                      {m.toUpperCase()}
                    </option>
                  ))}
                  {form.modelo && !modelosFiltrados.includes(form.modelo) && (
                    <option value={form.modelo} className="bg-brand-dark-4 text-white">
                      {form.modelo.toUpperCase()}
                    </option>
                  )}
                  <option value="__NOVO__" className="bg-brand-blue/20 text-brand-blue-light font-bold">
                    + NOVO MODELO (DIGITAR E APRENDER)...
                  </option>
                </select>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label text-xs m-0">4. Calibre</label>
                <div className="flex items-center gap-2">
                  {calibreAutoSugerido && (
                    <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5 animate-fade-in">
                      ✓ Sugerido
                    </span>
                  )}
                  {modoManualCalibre && (
                    <button 
                      type="button" 
                      onClick={() => setModoManualCalibre(false)}
                      className="text-[10px] text-brand-blue hover:underline"
                    >
                      Ver Lista
                    </button>
                  )}
                </div>
              </div>
              {modoManualCalibre ? (
                <input 
                  type="text" 
                  className="input uppercase font-bold text-xs"
                  placeholder="Ex: 9mm LUGER, .380 ACP..."
                  value={form.calibre}
                  onChange={e => setForm({ ...form, calibre: normalizarCalibre(e.target.value) })}
                  autoFocus
                />
              ) : (
                <select 
                  className={`input uppercase font-bold text-xs ${calibreAutoSugerido ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`} 
                  value={form.calibre} 
                  onChange={e => handleCalibreChange(e.target.value)}
                >
                  <option value="">SELECIONE O CALIBRE...</option>
                  {calibresCompativeis.map(c => (
                    <option key={c} value={c} className="bg-brand-dark-4 text-white">
                      {c === calibreAutoSugerido ? `✓ ${c.toUpperCase()} (PADRÃO)` : c.toUpperCase()}
                    </option>
                  ))}
                  {form.calibre && !calibresCompativeis.includes(form.calibre) && (
                    <option key={form.calibre} value={form.calibre} className="bg-brand-dark-4 text-white">
                      {form.calibre.toUpperCase()}
                    </option>
                  )}
                  <option value="__NOVO__" className="bg-brand-blue/20 text-brand-blue-light font-bold">
                    + OUTRO CALIBRE (DIGITAR)...
                  </option>
                </select>
              )}
            </div>
          </div>

          {/* Linha 3: Nº de Série e Nº SIGMA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Nº de Série</label>
              <input 
                type="text" 
                className="input uppercase text-xs" 
                placeholder="Ex: ABC123456" 
                value={form.numeroSerie} 
                onChange={e => setForm({...form, numeroSerie: e.target.value})} 
              />
            </div>
            <div>
              <label className="label text-xs">Nº SIGMA / SINARM</label>
              <input 
                type="text" 
                className="input uppercase text-xs" 
                placeholder="Ex: 1234567" 
                value={form.numeroSigma} 
                onChange={e => setForm({...form, numeroSigma: e.target.value})} 
              />
            </div>
          </div>

          {/* Linha 4: Acervo e Vencimento CRAF */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Acervo</label>
              <select 
                className="input text-xs" 
                value={form.acervo} 
                onChange={e => setForm({...form, acervo: e.target.value as any})}
              >
                <option value="Tiro Desportivo">Tiro Desportivo</option>
                <option value="Caça">Caça</option>
                <option value="Coleção">Coleção</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Vencimento CRAF</label>
              <input 
                type="date" 
                className="input text-xs" 
                value={form.vencimentoCraf} 
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    vencimentoCraf: val,
                    crafEmRenovacao: val !== (armaParaEditar?.vencimentoCraf || '') ? false : prev.crafEmRenovacao
                  }));
                }} 
              />
            </div>
          </div>

          {/* CRAF em Renovação */}
          <div className="flex items-center gap-1.5 py-0.5">
            <input 
              type="checkbox" 
              id="crafEmRenovacao"
              checked={form.crafEmRenovacao} 
              onChange={e => setForm({...form, crafEmRenovacao: e.target.checked})}
              className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3 h-3" 
            />
            <label htmlFor="crafEmRenovacao" className="text-[11px] text-gray-400 cursor-pointer select-none">
              Aguardando liberação da Polícia Federal / Exército (CRAF em Renovação)
            </label>
          </div>

          {/* Anexo do CRAF */}
          <div>
            <label className="label text-xs">Anexo do CRAF (PDF ou Imagem)</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                className="hidden" 
                id="craf-attachment" 
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const base64 = await fileToBase64(file);
                      setForm(prev => ({...prev, crafUrl: base64, crafEmRenovacao: false}));
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao carregar o arquivo.');
                    }
                  }
                }} 
              />
              <label 
                htmlFor="craf-attachment" 
                className="btn-ghost flex items-center gap-2 cursor-pointer text-xs h-9 border border-brand-dark-5 rounded-lg px-3"
              >
                <Upload size={14} /> {form.crafUrl ? 'Alterar Anexo' : 'Anexar Documento'}
              </label>

              <button
                type="button"
                onClick={() => setCameraModalAberto(true)}
                className="btn-ghost flex items-center gap-2 text-xs h-9 border border-brand-dark-5 rounded-lg px-3 hover:bg-brand-blue/10 hover:border-brand-blue/30"
              >
                <Camera size={14} /> Tirar Foto
              </button>

              {form.crafUrl && (
                <>
                  <button 
                    type="button" 
                    onClick={() => visualizarDocumentoBase64(form.crafUrl!, `CRAF-${form.numeroSerie || 'arma'}`)}
                    className="text-brand-blue hover:text-brand-blue-light text-xs font-semibold"
                  >
                    Visualizar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setForm({...form, crafUrl: ''})}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
            {form.crafUrl && (
              <span className="text-[10px] text-brand-green font-bold block mt-1">
                ✓ Documento anexado
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800/60 mt-4">
          <button type="button" onClick={onFechar} className="btn-ghost flex-1 text-xs">Cancelar</button>
          <button type="button" onClick={handleSalvar} className="btn-primary flex-1 text-xs font-bold">
            {armaParaEditar ? 'Salvar Alterações' : 'Salvar Arma'}
          </button>
        </div>
      </div>

      {cameraModalAberto && (
        <ModalUploadCelular
          isOpen={cameraModalAberto}
          onClose={() => setCameraModalAberto(false)}
          onUploadSuccess={(base64) => setForm(prev => ({ ...prev, crafUrl: base64, crafEmRenovacao: false }))}
          titulo="Tirar Foto do CRAF"
        />
      )}
    </div>
  );
}

export function ModalGt({ armaAcervo, armaNumeroSerie, gtParaEditar, onFechar, onSalvar }: { armaAcervo: string, armaNumeroSerie?: string, gtParaEditar?: GuiaTrafego, onFechar: () => void, onSalvar: (d: any) => void }) {
  const { opcoesArmas, buscarGts } = useClientes();
  const [form, setForm] = useState({ 
    id: gtParaEditar?.id,
    tipo: (gtParaEditar?.tipo || (armaAcervo?.toUpperCase() === 'CAÇA' ? 'Caça' : 'Treino')) as string, 
    vencimento: gtParaEditar?.vencimento || '', 
    destino: gtParaEditar?.destino || '',
    arquivoUrl: gtParaEditar?.arquivoUrl || '',
    gtEmRenovacao: gtParaEditar?.gtEmRenovacao ?? false
  });
  const [cameraModalAberto, setCameraModalAberto] = useState(false);
  
  // Estados para UF e Cidade (para guias do tipo Caça)
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCidade, setSelectedCidade] = useState('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [importando, setImportando] = useState(false);
  const [pendingCidade, setPendingCidade] = useState('');

  // Parsing inicial na edição
  useEffect(() => {
    if (form.tipo === 'Caça' && form.destino) {
      const parts = form.destino.split('-');
      if (parts.length === 2) {
        setSelectedUf(parts[1].trim().toUpperCase());
        setSelectedCidade(parts[0].trim().toUpperCase());
      }
    }
  }, []);

  // Carregar cidades do estado via API do IBGE
  useEffect(() => {
    if (!selectedUf) {
      setCidades([]);
      return;
    }
    const carregarCidades = async () => {
      setCarregandoCidades(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios`);
        if (response.ok) {
          const data = await response.json();
          const nomes = data.map((m: any) => m.nome.toUpperCase()).sort();
          setCidades(nomes);
        }
      } catch (err) {
        console.error('Erro ao carregar cidades do IBGE:', err);
      } finally {
        setCarregandoCidades(false);
      }
    };
    carregarCidades();
  }, [selectedUf]);

  // Cruzamento inteligente de cidade obtida com a lista do IBGE
  useEffect(() => {
    if (pendingCidade && cidades.length > 0) {
      const normalizedPending = pendingCidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const matched = cidades.find(c => {
        const normalizedC = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        return normalizedC === normalizedPending;
      });
      
      if (matched) {
        setSelectedCidade(matched);
        setForm(prev => ({
          ...prev,
          destino: `${matched}-${selectedUf}`
        }));
      } else {
        // Se não achou na lista oficial, usa o valor original cru
        setSelectedCidade(pendingCidade);
        setForm(prev => ({
          ...prev,
          destino: `${pendingCidade}-${selectedUf}`
        }));
      }
      setPendingCidade('');
    }
  }, [cidades, pendingCidade, selectedUf]);

  const clubesConfigurados = opcoesArmas.filter(o => o.tipo === 'clube').map(o => o.nome);
  const destinosCombinados = Array.from(
    new Set([
      ...clubesConfigurados,
      ...(form.destino ? [form.destino.trim().toUpperCase()] : [])
    ])
  ).filter(Boolean).sort() as string[];

  const handleUfChange = (uf: string) => {
    setSelectedUf(uf);
    setSelectedCidade('');
    setForm(prev => ({ ...prev, destino: uf ? `-${uf}` : '' }));
  };

  const handleCidadeChange = (cidade: string) => {
    setSelectedCidade(cidade);
    setForm(prev => ({ ...prev, destino: cidade && selectedUf ? `${cidade}-${selectedUf}` : '' }));
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);
    try {
      const data = await parseGtPdf(file);

      // Validação do número de série da arma
      if (armaNumeroSerie) {
        const normalizedSerial = armaNumeroSerie.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const pdfText = data.rawText || '';
        const sectionIndex = pdfText.indexOf('PRODUTOS CONTROLADOS');
        const searchArea = sectionIndex !== -1 ? pdfText.substring(sectionIndex) : pdfText;

        if (!searchArea.includes(normalizedSerial)) {
          alert(`Divergência de segurança detectada!\n\nEste documento (PDF) não pertence à arma selecionada. O número de série '${armaNumeroSerie}' não foi localizado no documento.`);
          e.target.value = '';
          return;
        }
      }

      const base64 = await fileToBase64(file);
      
      setForm(prev => {
        const novoTipo = data.tipo || prev.tipo;
        let novoDestino = prev.destino;
        
        if (novoTipo !== prev.tipo) {
          setSelectedUf('');
          setSelectedCidade('');
        }
        
        // Se a guia importada é do tipo Caça e temos cidade e estado
        if (novoTipo === 'Caça' && data.cidade && data.uf) {
          novoDestino = `${data.cidade}-${data.uf}`;
        }
        
        return {
          ...prev,
          tipo: novoTipo,
          vencimento: data.vencimento || prev.vencimento,
          destino: novoDestino,
          arquivoUrl: base64,
          gtEmRenovacao: false
        };
      });

      if (data.tipo === 'Caça' && data.uf) {
        setSelectedUf(data.uf);
        if (data.cidade) {
          setPendingCidade(data.cidade);
        }
      }
    } catch (err: any) {
      console.error('Erro ao processar PDF da GT:', err);
      const msgErro = err.message || '';
      alert(`Erro ao ler PDF da Guia: ${msgErro}\n\nVerifique se o arquivo é uma Guia de Tráfego válida ou tente novamente.`);
    } finally {
      setImportando(false);
    }
  };

  const handleSalvar = () => {
    if (form.tipo === 'Caça') {
      const parts = form.destino.split('-');
      if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        alert('Por favor, selecione o Estado (UF) e o Município de destino.');
        return;
      }
    } else {
      if (!form.destino.trim()) {
        alert('Por favor, preencha o Campo de Destino.');
        return;
      }
    }
    onSalvar(form);
  };

  const getLabelDestino = () => {
    const acervoUpper = armaAcervo.toUpperCase();
    if (acervoUpper === 'CAÇA') {
      return form.tipo === 'Caça' ? 'Município / Estado de Destino' : 'Estande de Tiro (Treino)';
    }
    if (acervoUpper === 'TIRO DESPORTIVO') {
      return 'Clube de Tiro de Destino';
    }
    return 'Destino';
  };

  const getPlaceholderDestino = () => {
    const acervoUpper = armaAcervo.toUpperCase();
    if (acervoUpper === 'CAÇA') {
      return form.tipo === 'Caça' ? 'Ex: JATAÍ-GO' : 'Ex: ESTANDE PRO TIRO';
    }
    if (acervoUpper === 'TIRO DESPORTIVO') {
      return 'Ex: CLUBE DE TIRO JATAÍ';
    }
    return 'Ex: Clube, Cidade, Armeiro...';
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white">
            {gtParaEditar ? 'Editar Guia de Tráfego' : 'Nova Guia de Tráfego'}
          </h3>
          <div className="relative">
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              id="import-gt-pdf" 
              onChange={handleImportPdf}
              disabled={importando}
            />
            <label 
              htmlFor="import-gt-pdf" 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border ${
                importando 
                  ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' 
                  : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 hover:bg-brand-blue/20'
              }`}
            >
              {importando ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {importando ? 'Processando...' : 'Importar PDF'}
            </label>
          </div>
        </div>
        <p className="text-[10px] text-brand-blue font-black uppercase mb-6 tracking-widest">
          Arma em Acervo de: {armaAcervo}
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">Tipo de Guia</label>
            <select 
              className="input" 
              value={form.tipo} 
              onChange={e => {
                const novoTipo = e.target.value;
                setForm({...form, tipo: novoTipo as any, destino: ''});
                setSelectedUf('');
                setSelectedCidade('');
              }}
            >
              <option value="Caça">Caça</option>
              <option value="Caça Treino">Caça Treino</option>
              <option value="Treino">Treino (Tiro Desportivo)</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Transferência">Transferência</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {form.tipo === 'Caça' ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="label">UF <span className="text-red-500">*</span></label>
                <select 
                  className="input uppercase" 
                  value={selectedUf} 
                  onChange={e => handleUfChange(e.target.value)}
                >
                  <option value="">UF</option>
                  {ESTADOS_BRASIL.map(est => (
                    <option key={est.sigla} value={est.sigla}>{est.sigla}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Município de Destino <span className="text-red-500">*</span></label>
                {!selectedUf ? (
                  <select className="input" disabled>
                    <option>Selecione a UF...</option>
                  </select>
                ) : carregandoCidades ? (
                  <select className="input" disabled>
                    <option>Carregando...</option>
                  </select>
                ) : cidades.length === 0 ? (
                  <input 
                    type="text" 
                    className="input uppercase" 
                    value={selectedCidade} 
                    onChange={e => handleCidadeChange(e.target.value.toUpperCase())}
                    placeholder="Ex: JATAÍ"
                  />
                ) : (
                  <select 
                    className="input uppercase" 
                    value={selectedCidade} 
                    onChange={e => handleCidadeChange(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {cidades.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="label">{getLabelDestino()} <span className="text-red-500">*</span></label>
              <select 
                className="input uppercase font-bold" 
                value={form.destino} 
                onChange={e => setForm({...form, destino: e.target.value})}
              >
                <option value="" disabled>SELECIONE...</option>
                {destinosCombinados.map(d => (
                  <option key={d} value={d} className="bg-brand-dark-4 text-white">
                    {d.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Data de Vencimento</label>
            <input 
              type="date" 
              className="input" 
              value={form.vencimento} 
              onChange={e => {
                const val = e.target.value;
                setForm(prev => ({
                  ...prev,
                  vencimento: val,
                  gtEmRenovacao: val !== gtParaEditar?.vencimento ? false : prev.gtEmRenovacao
                }));
              }} 
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <input type="checkbox" id="gtEmRenovacao"
                checked={form.gtEmRenovacao} onChange={e => setForm({...form, gtEmRenovacao: e.target.checked})}
                className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3 h-3" />
              <label htmlFor="gtEmRenovacao" className="text-[10px] text-gray-400 cursor-pointer select-none">
                Aguardando liberação da Polícia Federal (GT em Renovação)
              </label>
            </div>
          </div>
          <div>
            <label className="label">Anexo da Guia (PDF ou Imagem)</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                className="hidden" 
                id="gt-attachment" 
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const base64 = await fileToBase64(file);
                      setForm({...form, arquivoUrl: base64, gtEmRenovacao: false});
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao carregar o arquivo.');
                    }
                  }
                }} 
              />
              <label 
                htmlFor="gt-attachment" 
                className="btn-ghost flex items-center gap-2 cursor-pointer text-xs h-10 border border-brand-dark-5 rounded-lg px-3"
              >
                <Upload size={14} /> {form.arquivoUrl ? 'Alterar Anexo' : 'Anexar Documento'}
              </label>

              <button
                type="button"
                onClick={() => setCameraModalAberto(true)}
                className="btn-ghost flex items-center gap-2 text-xs h-10 border border-brand-dark-5 rounded-lg px-3 hover:bg-brand-blue/10 hover:border-brand-blue/30"
              >
                <Camera size={14} /> Tirar Foto
              </button>

              {form.arquivoUrl && (
                <>
                  <button 
                    type="button"
                    onClick={() => visualizarDocumentoBase64(form.arquivoUrl!, `GT-${form.tipo}-${form.destino}`)}
                    className="text-brand-blue hover:text-brand-blue-light text-xs font-semibold"
                  >
                    Visualizar
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({...form, arquivoUrl: ''})}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
            {form.arquivoUrl && (
              <span className="text-[10px] text-brand-green font-bold block mt-1">
                ✓ Documento anexado
              </span>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button type="button" onClick={handleSalvar} className="btn-primary flex-1">
              {gtParaEditar ? 'Salvar Alterações' : 'Salvar Guia'}
            </button>
          </div>
        </div>
      </div>

      {cameraModalAberto && (
        <ModalUploadCelular
          isOpen={cameraModalAberto}
          onClose={() => setCameraModalAberto(false)}
          onUploadSuccess={(base64) => setForm(prev => ({ ...prev, arquivoUrl: base64, gtEmRenovacao: false }))}
          titulo="Tirar Foto da Guia de Tráfego"
        />
      )}
    </div>
  );
}

export function ModalManejo({ manejoParaEditar, onFechar, onSalvar }: { manejoParaEditar?: AutorizacaoManejo, onFechar: () => void, onSalvar: (d: any) => void }) {
  const [form, setForm] = useState({ 
    id: manejoParaEditar?.id,
    numeroCar: manejoParaEditar?.numeroCar || '', 
    nomeFazenda: manejoParaEditar?.nomeFazenda || '', 
    nomeProprietario: manejoParaEditar?.nomeProprietario || '', 
    cidade: manejoParaEditar?.cidade || '', 
    vencimento: manejoParaEditar?.vencimento || '',
    status: manejoParaEditar?.status || 'Ativo',
    arquivoUrl: manejoParaEditar?.arquivoUrl || '',
    manejoEmRenovacao: manejoParaEditar?.manejoEmRenovacao ?? false
  });
  const [importando, setImportando] = useState(false);
  const [cameraModalAberto, setCameraModalAberto] = useState(false);

  // Estados para UF e Cidade
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCidade, setSelectedCidade] = useState('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [pendingCidade, setPendingCidade] = useState('');

  // Parsing inicial na edição / carregamento
  useEffect(() => {
    if (form.cidade) {
      const separator = form.cidade.includes('/') ? '/' : (form.cidade.includes('-') ? '-' : null);
      if (separator) {
        const parts = form.cidade.split(separator);
        if (parts.length === 2) {
          const ufVal = parts[1].trim().toUpperCase();
          const cidVal = parts[0].trim().toUpperCase();
          setSelectedUf(ufVal);
          setPendingCidade(cidVal);
        }
      } else {
        setSelectedCidade(form.cidade.toUpperCase());
      }
    }
  }, []);

  // Carregar cidades do estado via API do IBGE
  useEffect(() => {
    if (!selectedUf) {
      setCidades([]);
      return;
    }
    const carregarCidades = async () => {
      setCarregandoCidades(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios`);
        if (response.ok) {
          const data = await response.json();
          const nomes = data.map((m: any) => m.nome.toUpperCase()).sort();
          setCidades(nomes);
        }
      } catch (err) {
        console.error('Erro ao carregar cidades do IBGE:', err);
      } finally {
        setCarregandoCidades(false);
      }
    };
    carregarCidades();
  }, [selectedUf]);

  // Cruzamento inteligente de cidade obtida com a lista do IBGE
  useEffect(() => {
    if (pendingCidade && cidades.length > 0) {
      const normalizedPending = pendingCidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const matched = cidades.find(c => {
        const normalizedC = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        return normalizedC === normalizedPending;
      });
      
      if (matched) {
        setSelectedCidade(matched);
        setForm(prev => ({
          ...prev,
          cidade: `${matched}/${selectedUf}`
        }));
      } else {
        setSelectedCidade(pendingCidade);
        setForm(prev => ({
          ...prev,
          cidade: `${pendingCidade}/${selectedUf}`
        }));
      }
      setPendingCidade('');
    }
  }, [cidades, pendingCidade, selectedUf]);

  const handleUfChange = (uf: string) => {
    setSelectedUf(uf);
    setSelectedCidade('');
    setForm(prev => ({ ...prev, cidade: uf ? `/${uf}` : '' }));
  };

  const handleCidadeChange = (cidade: string) => {
    setSelectedCidade(cidade);
    setForm(prev => ({ ...prev, cidade: cidade && selectedUf ? `${cidade}/${selectedUf}` : cidade || '' }));
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);
    try {
      const data = await parseIbamaPdf(file);
      const base64 = await fileToBase64(file);
      
      setForm(prev => ({
        ...prev,
        numeroCar: data.numeroCar || prev.numeroCar,
        nomeFazenda: data.nomeFazenda || prev.nomeFazenda,
        nomeProprietario: data.nomeProprietario || prev.nomeProprietario,
        vencimento: data.vencimento || prev.vencimento,
        arquivoUrl: base64,
        manejoEmRenovacao: false
      }));
    } catch (err: any) {
      console.error('Erro ao processar PDF:', err);
      const msgErro = err.message || '';
      alert(`Erro ao ler PDF: ${msgErro}\n\nVerifique se o arquivo é uma Autorização de Manejo válida ou tente novamente.`);
    } finally {
      setImportando(false);
    }
  };

  const handleSalvar = () => {
    if (!form.nomeFazenda.trim()) {
      alert('O campo Nome da Fazenda é obrigatório.');
      return;
    }
    if (!form.nomeProprietario.trim()) {
      alert('O campo Proprietário é obrigatório.');
      return;
    }
    onSalvar(form);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">
            {manejoParaEditar ? 'Editar Autorização de Manejo' : 'Autorização de Manejo (IBAMA)'}
          </h3>
          <div className="relative">
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              id="import-ibama-pdf" 
              onChange={handleImportPdf}
              disabled={importando}
            />
            <label 
              htmlFor="import-ibama-pdf" 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border ${
                importando 
                  ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' 
                  : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 hover:bg-brand-blue/20'
              }`}
            >
              {importando ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {importando ? 'Processando...' : 'Importar PDF'}
            </label>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          <div>
            <label className="label">Nº do CAR da Fazenda</label>
            <input type="text" className="input uppercase" value={form.numeroCar} onChange={e => setForm({...form, numeroCar: e.target.value})} />
          </div>
          <div>
            <label className="label">Nome da Fazenda <span className="text-red-500">*</span></label>
            <input type="text" className="input uppercase" value={form.nomeFazenda} onChange={e => setForm({...form, nomeFazenda: e.target.value})} />
          </div>
          <div>
            <label className="label">Proprietário <span className="text-red-500">*</span></label>
            <input type="text" className="input uppercase" value={form.nomeProprietario} onChange={e => setForm({...form, nomeProprietario: e.target.value})} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="label">UF</label>
              <select 
                className="input uppercase" 
                value={selectedUf} 
                onChange={e => handleUfChange(e.target.value)}
              >
                <option value="">UF</option>
                {ESTADOS_BRASIL.map(est => (
                  <option key={est.sigla} value={est.sigla}>{est.sigla}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Cidade / Município</label>
              {!selectedUf ? (
                <select className="input" disabled>
                  <option>Selecione a UF...</option>
                </select>
              ) : carregandoCidades ? (
                <select className="input" disabled>
                  <option>Carregando...</option>
                </select>
              ) : cidades.length === 0 ? (
                <input 
                  type="text" 
                  className="input uppercase" 
                  value={selectedCidade} 
                  onChange={e => handleCidadeChange(e.target.value.toUpperCase())}
                  placeholder="Ex: JATAÍ"
                />
              ) : (
                <select 
                  className="input uppercase" 
                  value={selectedCidade} 
                  onChange={e => handleCidadeChange(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {cidades.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Validade da Autorização</label>
              <input 
                type="date" 
                className="input" 
                value={form.vencimento} 
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    vencimento: val,
                    manejoEmRenovacao: val !== (manejoParaEditar?.vencimento || '') ? false : prev.manejoEmRenovacao
                  }));
                }} 
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <input type="checkbox" id="manejoEmRenovacao"
                  checked={form.manejoEmRenovacao} onChange={e => setForm({...form, manejoEmRenovacao: e.target.checked})}
                  className="rounded border-brand-dark-5 bg-brand-dark-4 text-brand-blue focus:ring-0 w-3 h-3" />
                <label htmlFor="manejoEmRenovacao" className="text-[10px] text-gray-400 cursor-pointer select-none">
                  Aguardando liberação (Em Renovação)
                </label>
              </div>
            </div>
            <div>
              <label className="label">Status da Autorização</label>
              <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value as any})}>
                <option value="Ativo">Ativo</option>
                <option value="Inerte">Inerte</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Anexo da Autorização (PDF ou Imagem)</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                className="hidden" 
                id="manejo-attachment" 
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const base64 = await fileToBase64(file);
                      setForm(prev => ({...prev, arquivoUrl: base64, manejoEmRenovacao: false}));
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao carregar o arquivo.');
                    }
                  }
                }} 
              />
              <label 
                htmlFor="manejo-attachment" 
                className="btn-ghost flex items-center gap-2 cursor-pointer text-xs h-10 border border-brand-dark-5 rounded-lg px-3"
              >
                <Upload size={14} /> {form.arquivoUrl ? 'Alterar Anexo' : 'Anexar Documento'}
              </label>

              <button
                type="button"
                onClick={() => setCameraModalAberto(true)}
                className="btn-ghost flex items-center gap-2 text-xs h-10 border border-brand-dark-5 rounded-lg px-3 hover:bg-brand-blue/10 hover:border-brand-blue/30"
              >
                <Camera size={14} /> Tirar Foto
              </button>

              {form.arquivoUrl && (
                <>
                  <button 
                    type="button"
                    onClick={() => visualizarDocumentoBase64(form.arquivoUrl!, `Manejo-${form.nomeFazenda || 'fazenda'}`)}
                    className="text-brand-blue hover:text-brand-blue-light text-xs font-semibold"
                  >
                    Visualizar
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({...form, arquivoUrl: ''})}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
            {form.arquivoUrl && (
              <span className="text-[10px] text-brand-green font-bold block mt-1">
                ✓ Documento anexado
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-800/60 mt-4">
          <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSalvar} className="btn-primary flex-1">
            {manejoParaEditar ? 'Salvar Alterações' : 'Salvar Manejo'}
          </button>
        </div>
      </div>

      {cameraModalAberto && (
        <ModalUploadCelular
          isOpen={cameraModalAberto}
          onClose={() => setCameraModalAberto(false)}
          onUploadSuccess={(base64) => setForm(prev => ({ ...prev, arquivoUrl: base64, manejoEmRenovacao: false }))}
          titulo="Tirar Foto da Autorização de Manejo"
        />
      )}
    </div>
  );
}
