import React, { useState, useEffect } from 'react';
import { 
  Target, MapPin, Calendar, Plus, Trash2, ShieldAlert, 
  ChevronDown, ChevronUp, FileText, Globe, Landmark, Upload, Loader2, Pencil
} from 'lucide-react';
import { parseIbamaPdf } from '../../services/ibamaParserService';
import { parseGtPdf } from '../../services/gtParserService';
import { useClientes } from '../../context/ClientesContext';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo } from '../../types';
import { formatarData } from '../../utils/formatters';
import { calcularAlerta, obterClasseAlerta } from '../../utils/vencimentos';
import { fileToBase64, visualizarDocumentoBase64 } from '../../utils/fileUtils';
import { useAuth } from '../../context/AuthContext';
import { buscarAcervoVinculado } from '../../services/vinculosService';

const TIPOS_ARMA = ['Pistola', 'Revólver', 'Carabina / Fuzil', 'Espingarda'];
const CALIBRES = [
  '.22 LR', '.223 REM / 5.56 NATO', '.30-06 SPRG', '.308 WIN / 7.62 NATO', 
  '.357 MAG', '.38 SPL', '.380 ACP', '9mm Luger', '.40 S&W', '.44 MAG', 
  '.45 ACP', '.454 CASULL', '12 GA', '20 GA', '28 GA', '36 GA'
];
const FABRICANTES_BASE = [
  'Benelli', 'Beretta', 'Boito', 'Browning', 'Canik', 'CBC', 'Colt', 'CZ', 
  'Glock', 'Imbel', 'Remington', 'Rossi', 'Ruger', 'Sig Sauer', 
  'Smith & Wesson', 'Springfield Armory', 'Stoeger', 'Tanfoglio', 
  'Taurus', 'Walther', 'Winchester'
];
const MODELOS_BASE = [
  // Taurus
  'G2C', 'G3', 'G3C', 'G3 TORO', 'GX4', 'TH9', 'TH380', 'TH40', 'TS9',
  'PT 92', 'PT 100', 'PT 838', 'PT 1911', 'RT 85', 'RT 88', 'RT 856', 'RT 608', 'RT 817', 'T4', 'CTT40',
  // Glock
  'G17', 'G19', 'G19X', 'G20', 'G21', 'G22', 'G25', 'G43', 'G43X', 'G44', 'G45',
  // Outros Nacionais
  'MD1', 'MD2', 'MD6', 'MD7', 'M1911 A1', 'PUMP MILITARY 3.0', 'CBC 7022', 'CBC 8122', 'PUMP', 'ERA 2001', 'MIURA I', 'MIURA II', 'PUMA', 'RT 718',
  // Internacionais Populares
  'APX', '92FS', 'M9', 'P-10 C', 'P-10 F', 'CZ 75', 'SHADOW 2', 'TS 2', 'SCORPION',
  'P320', 'P365', 'M17', 'M18', 'P226', 'M&P 9', 'M&P 15', 'SHIELD', 'MODEL 686',
  'TP9', 'TP9SF', 'TP9 ELITE', 'RIVAL', '1911', 'M4', 'PYTHON', 'HELLCAT', 'XD', 'M1A',
  'PPQ', 'PDP', 'P22', '10/22', 'MARK IV', 'LCP', 'SECURITY-9', '870', '700', 'STR-9', 'M3000',
  'SUPERNOVA', 'STOCK II', 'STOCK III', 'DEFORCE', 'HI-POWER', 'BUCK MARK', 'SXP', 'MODEL 70'
];

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
    buscarManejos, salvarManejo, deletarManejo
  } = useClientes();

  const podeEditar = !cacEmpresaId || podeEditarVinculo;

  const [armas, setArmas] = useState<Arma[]>([]);
  const [manejos, setManejos] = useState<AutorizacaoManejo[]>([]);
  const [gtsPorArma, setGtsPorArma] = useState<Record<string, GuiaTrafego[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [expandirArma, setExpandirArma] = useState<string | null>(armaIdInicial || null);

  const [modalArma, setModalArma] = useState(false);
  const [armaParaEditar, setArmaParaEditar] = useState<Arma | null>(null);
  const [modalGt, setModalGt] = useState<{armaId: string, gt?: GuiaTrafego} | null>(null);
  const [modalManejo, setModalManejo] = useState(false);
  const [manejoParaEditar, setManejoParaEditar] = useState<AutorizacaoManejo | null>(null);

  const carregarDados = async () => {
    setCarregando(true);
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
              criadoEm: new Date().toISOString()
            }));
          });
          setGtsPorArma(gtsMap);
          setCarregando(false);
          return;
        }
      }

      const [armasData, manejosData] = await Promise.all([
        buscarArmas(cliente.id),
        buscarManejos(cliente.id)
      ]);
      setArmas(armasData);
      setManejos(manejosData);

      // Carregar GTs para cada arma
      const gtsMap: Record<string, GuiaTrafego[]> = {};
      await Promise.all(armasData.map(async (a) => {
        gtsMap[a.id] = await buscarGts(a.id);
      }));
      setGtsPorArma(gtsMap);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [cliente.id, cacEmpresaId]);

  if (carregando) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Resumo de Vencimentos CR ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardVencimento 
          label="CR (PF / Exército)" 
          numero={cliente.numeroCr} 
          data={cliente.vencimentoCr} 
          tipo="CR"
          icon={<ShieldAlert size={20} />}
        />
        <CardVencimento 
          label="CR IBAMA" 
          data={cliente.vencimentoCrIbama} 
          tipo="IBAMA_CR"
          icon={<Globe size={20} />}
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-brand-dark-5/30 sm:border-0">
                    <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0 shrink-0">
                      <p className="text-[9px] text-gray-500 font-bold uppercase sm:mb-1">CRAF:</p>
                      <BadgeVencimento data={arma.vencimentoCraf} tipo="CRAF" />
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
                              <BadgeVencimento data={gt.vencimento} tipo="GT" />
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
                      <BadgeVencimento data={m.vencimento} tipo="MANEJO" status={m.status} />
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
                modelo: d.modelo?.trim().toUpperCase(),
                calibre: d.calibre?.trim().toUpperCase(),
                fabricante: d.fabricante?.trim().toUpperCase(),
                numeroSerie: d.numeroSerie?.trim().toUpperCase(),
                numeroSigma: d.numeroSigma?.trim().toUpperCase(),
                clienteId: cliente.id
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
              armaId: modalGt.armaId 
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
            id: manejoParaEditar?.id
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
    </div>
  );
}

// --- Componentes Internos ---

function CardVencimento({ label, numero, data, tipo, icon }: { label: string, numero?: string, data?: string, tipo: string, icon: React.ReactNode }) {
  return (
    <div className="card bg-brand-dark-3/50 border-brand-dark-5 flex flex-row items-center justify-between p-4 gap-3 flex-wrap xs:flex-nowrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-2xl bg-brand-blue/10 text-brand-blue shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 truncate">{label}</p>
          <p className="text-white font-bold text-sm truncate" title={numero}>{numero || 'DATA DE VALIDADE'}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">Vencimento</p>
        <BadgeVencimento data={data} tipo={tipo} />
      </div>
    </div>
  );
}

function BadgeVencimento({ data, tipo, status }: { data?: string, tipo: string, status?: string }) {
  if (!data) return <span className="text-[10px] text-gray-600 italic">Não informado</span>;
  if (status === 'Inerte') {
    return (
      <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-brand-dark-5 bg-brand-dark-3 text-gray-500">
        {formatarData(data)}
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
  const { modelosRegistrados, calibresRegistrados, fabricantesRegistrados } = useClientes();
  const [form, setForm] = useState({
    id: armaParaEditar?.id,
    tipo: armaParaEditar?.tipo || '', 
    modelo: armaParaEditar?.modelo || '', 
    calibre: armaParaEditar?.calibre || '', 
    fabricante: armaParaEditar?.fabricante || '', 
    numeroSerie: armaParaEditar?.numeroSerie || '', 
    numeroSigma: armaParaEditar?.numeroSigma || '', 
    acervo: (armaParaEditar?.acervo || 'Tiro Desportivo') as any, 
    vencimentoCraf: armaParaEditar?.vencimentoCraf || '',
    crafUrl: armaParaEditar?.crafUrl || ''
  });

  const modelosCombinados = Array.from(new Set([...MODELOS_BASE, ...modelosRegistrados])).sort();
  const calibresCombinados = Array.from(new Set([...CALIBRES, ...calibresRegistrados])).sort();
  const fabricantesCombinados = Array.from(new Set([...FABRICANTES_BASE, ...fabricantesRegistrados])).sort();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-6">
          {armaParaEditar ? 'Editar Arma' : 'Cadastrar Nova Arma'}
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          <div>
            <label className="label">Tipo de Arma</label>
            <select
              className="input uppercase font-bold" 
              value={form.tipo} 
              onChange={e => setForm({...form, tipo: e.target.value})}
            >
              <option value="" disabled>SELECIONE...</option>
              {TIPOS_ARMA.map(t => (
                <option key={t} value={t} className="bg-brand-dark-4 text-white">
                  {t.toUpperCase()}
                </option>
              ))}
              {form.tipo && !TIPOS_ARMA.includes(form.tipo) && (
                <option value={form.tipo} className="bg-brand-dark-4 text-white">
                  {form.tipo.toUpperCase()}
                </option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Modelo</label>
              <input 
                list="modelos-arma"
                type="text" 
                className="input uppercase" 
                value={form.modelo} 
                onChange={e => setForm({...form, modelo: e.target.value})} 
                placeholder="Ex: G2C"
              />
              <datalist id="modelos-arma">
                {modelosCombinados.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Calibre</label>
              <input 
                list="calibres-arma"
                className="input uppercase" 
                value={form.calibre} 
                onChange={e => setForm({...form, calibre: e.target.value})} 
                placeholder="Ex: 9mm"
              />
              <datalist id="calibres-arma">
                {calibresCombinados.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fabricante</label>
              <input 
                list="fabricantes-arma"
                className="input uppercase" 
                value={form.fabricante} 
                onChange={e => setForm({...form, fabricante: e.target.value})} 
                placeholder="Ex: Taurus"
              />
              <datalist id="fabricantes-arma">
                {fabricantesCombinados.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Nº de Série</label>
              <input type="text" className="input uppercase" value={form.numeroSerie} onChange={e => setForm({...form, numeroSerie: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nº SIGMA</label>
              <input type="text" className="input uppercase" value={form.numeroSigma} onChange={e => setForm({...form, numeroSigma: e.target.value})} />
            </div>
            <div>
              <label className="label">Acervo</label>
              <select className="input" value={form.acervo} onChange={e => setForm({...form, acervo: e.target.value as any})}>
                <option value="Caça">Caça</option>
                <option value="Tiro Desportivo">Tiro Desportivo</option>
                <option value="Coleção">Coleção</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Vencimento CRAF</label>
            <input type="date" className="input" value={form.vencimentoCraf} onChange={e => setForm({...form, vencimentoCraf: e.target.value})} />
          </div>
          <div>
            <label className="label">Anexo do CRAF (PDF ou Imagem)</label>
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
                      setForm({...form, crafUrl: base64});
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao carregar o arquivo.');
                    }
                  }
                }} 
              />
              <label 
                htmlFor="craf-attachment" 
                className="btn-ghost flex items-center gap-2 cursor-pointer text-xs h-10 border border-brand-dark-5 rounded-lg px-3"
              >
                <Upload size={14} /> {form.crafUrl ? 'Alterar Anexo' : 'Anexar Documento'}
              </label>
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

        <div className="flex gap-3 pt-6 border-t border-slate-800/60 mt-4">
          <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={() => onSalvar(form)} className="btn-primary flex-1">
            {armaParaEditar ? 'Salvar Alterações' : 'Salvar Arma'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalGt({ armaAcervo, armaNumeroSerie, gtParaEditar, onFechar, onSalvar }: { armaAcervo: string, armaNumeroSerie?: string, gtParaEditar?: GuiaTrafego, onFechar: () => void, onSalvar: (d: any) => void }) {
  const [form, setForm] = useState({ 
    id: gtParaEditar?.id,
    tipo: (gtParaEditar?.tipo || 'Caça') as string, 
    vencimento: gtParaEditar?.vencimento || '', 
    destino: gtParaEditar?.destino || '',
    arquivoUrl: gtParaEditar?.arquivoUrl || ''
  });
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  
  // Estados para UF e Cidade (para guias do tipo Caça)
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCidade, setSelectedCidade] = useState('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [importando, setImportando] = useState(false);
  const [pendingCidade, setPendingCidade] = useState('');

  const { buscarGts } = useClientes();

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

  // Carregar sugestões do banco de dados baseadas em guias existentes
  useEffect(() => {
    const carregarSugestoes = async () => {
      try {
        const { supabase } = await import('../../db/supabase');
        // Buscamos destinos únicos de todas as guias do sistema para popular o autocomplete
        const { data, error } = await supabase
          .from('guias_trafego')
          .select('destino, tipo');
        
        if (!error && data) {
          const uniqueDestinos = new Set<string>();
          data.forEach(gt => {
            if (gt.destino) {
              // Normaliza para evitar duplicatas
              const normalizado = gt.destino
                .toUpperCase()
                .replace(/\s+/g, ' ')
                .replace(/\s?-\s?/g, '-')
                .trim();
              
              // Verifica se o destino tem formato de cidade/UF (ex: JATAÍ-GO)
              const isCityUf = /^[A-ZÀ-ÿ\s.-]+-[A-Z]{2}$/.test(normalizado);

              if (form.tipo === 'Caça') {
                if (isCityUf) uniqueDestinos.add(normalizado);
              } else {
                if (!isCityUf) uniqueDestinos.add(normalizado);
              }
            }
          });
          setSugestoes(Array.from(uniqueDestinos).sort());
        }
      } catch (err) {
        console.error('Erro ao carregar sugestões:', err);
      }
    };
    carregarSugestoes();
  }, [form.tipo]);

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
          arquivoUrl: base64
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
              <input 
                list="sugestoes-destino"
                type="text" 
                className="input uppercase" 
                placeholder={getPlaceholderDestino()} 
                value={form.destino} 
                onChange={e => setForm({...form, destino: e.target.value})} 
              />
              <datalist id="sugestoes-destino">
                {sugestoes.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          )}

          <div>
            <label className="label">Data de Vencimento</label>
            <input type="date" className="input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
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
                      setForm({...form, arquivoUrl: base64});
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
            <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button onClick={handleSalvar} className="btn-primary flex-1">
              {gtParaEditar ? 'Salvar Alterações' : 'Salvar Guia'}
            </button>
          </div>
        </div>
      </div>
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
    arquivoUrl: manejoParaEditar?.arquivoUrl || ''
  });
  const [importando, setImportando] = useState(false);

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
        cidade: data.cidade || prev.cidade,
        vencimento: data.vencimento || prev.vencimento,
        arquivoUrl: base64
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
          <div>
            <label className="label">Cidade / Estado</label>
            <input type="text" className="input uppercase" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Validade da Autorização</label>
              <input type="date" className="input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
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
                      setForm({...form, arquivoUrl: base64});
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
    </div>
  );
}
