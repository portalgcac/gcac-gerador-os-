import React, { useState, useEffect } from 'react';
import { 
  Target, MapPin, Calendar, Plus, Trash2, ShieldAlert, 
  ChevronDown, ChevronUp, FileText, Globe, Landmark
} from 'lucide-react';
import { useClientes } from '../../context/ClientesContext';
import { Cliente, Arma, GuiaTrafego, AutorizacaoManejo } from '../../types';
import { formatarData } from '../../utils/formatters';
import { calcularAlerta, obterClasseAlerta } from '../../utils/vencimentos';

const TIPOS_ARMA = ['Pistola', 'Revólver', 'Carabina / Fuzil', 'Espingarda', 'Rifle'];
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

interface Props {
  cliente: Cliente;
}

export function AbaDocumentacao({ cliente }: Props) {
  const { 
    buscarArmas, salvarArma, deletarArma,
    buscarGts, salvarGt, deletarGt,
    buscarManejos, salvarManejo, deletarManejo
  } = useClientes();

  const [armas, setArmas] = useState<Arma[]>([]);
  const [manejos, setManejos] = useState<AutorizacaoManejo[]>([]);
  const [gtsPorArma, setGtsPorArma] = useState<Record<string, GuiaTrafego[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [expandirArma, setExpandirArma] = useState<string | null>(null);

  // Modais
  const [modalArma, setModalArma] = useState(false);
  const [modalGt, setModalGt] = useState<string | null>(null); // armaId
  const [modalManejo, setModalManejo] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    try {
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
  }, [cliente.id]);

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
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Armas & CRAFs</h3>
          </div>
          <button onClick={() => setModalArma(true)} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> Adicionar Arma
          </button>
        </div>

        {armas.length === 0 ? (
          <EmptyState msg="Nenhuma arma cadastrada." />
        ) : (
          <div className="space-y-3">
            {armas.map(arma => (
              <div key={arma.id} className="card bg-brand-dark-3/50 border-brand-dark-5 p-0 overflow-hidden">
                <div 
                  onClick={() => setExpandirArma(expandirArma === arma.id ? null : arma.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-brand-dark-3 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                      <Target size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {arma.tipo ? `${arma.tipo} - ` : ''}{arma.modelo} • {arma.calibre}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                        Série: {arma.numeroSerie} • SIGMA: {arma.numeroSigma}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Validade CRAF</p>
                      <BadgeVencimento data={arma.vencimentoCraf} tipo="CRAF" />
                    </div>
                    {expandirArma === arma.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {expandirArma === arma.id && (
                  <div className="border-t border-brand-dark-5 p-4 bg-brand-dark-4 animate-slide-down">
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Guias de Tráfego (GTs)</h4>
                       <button onClick={() => setModalGt(arma.id)} className="text-[10px] font-bold text-brand-blue-light hover:underline flex items-center gap-1">
                         <Plus size={12} /> Nova Guia
                       </button>
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
                              <button onClick={() => {
                                if(confirm('Excluir esta guia?')) {
                                  deletarGt(gt.id).then(carregarDados);
                                }
                              }} className="text-gray-600 hover:text-red-400 p-1">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-brand-dark-5 flex justify-end">
                      <button onClick={() => {
                        if(confirm('Excluir esta arma e todas as suas guias?')) {
                          deletarArma(arma.id).then(carregarDados);
                        }
                      }} className="flex items-center gap-1.5 text-[10px] font-bold text-red-500/60 hover:text-red-500 transition-colors uppercase">
                        <Trash2 size={12} /> Remover Arma
                      </button>
                    </div>
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
            <h3 className="text-sm font-black text-white uppercase tracking-wider">IBAMA: Autorizações de Manejo</h3>
          </div>
          <button onClick={() => setModalManejo(true)} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> Novo Manejo
          </button>
        </div>

        {manejos.length === 0 ? (
          <EmptyState msg="Nenhuma autorização de manejo cadastrada." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {manejos.map(m => (
              <div key={m.id} className="card bg-brand-dark-3/50 border-brand-dark-5 p-4 group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{m.nomeFazenda}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{m.cidade}</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    if(confirm('Excluir esta autorização?')) {
                      deletarManejo(m.id).then(carregarDados);
                    }
                  }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-600 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">CAR / Proprietário</p>
                    <p className="text-[11px] text-white font-medium">{m.numeroCar} • {m.nomeProprietario}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-brand-dark-5">
                   <span className="text-[10px] text-gray-500 font-bold uppercase">Validade</span>
                   <BadgeVencimento data={m.vencimento} tipo="MANEJO" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Modais --- */}
      {modalArma && (
        <ModalArma 
          onFechar={() => setModalArma(false)} 
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
              await salvarArma(armaFormatada);
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
          onFechar={() => setModalGt(null)} 
          onSalvar={(d) => 
            salvarGt({ 
              ...d, 
              destino: d.destino?.trim().toUpperCase(),
              armaId: modalGt 
            })
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
          onFechar={() => setModalManejo(false)} 
          onSalvar={(d) => salvarManejo({ 
            ...d, 
            numeroCar: d.numeroCar?.trim().toUpperCase(),
            nomeFazenda: d.nomeFazenda?.trim().toUpperCase(),
            nomeProprietario: d.nomeProprietario?.trim().toUpperCase(),
            cidade: d.cidade?.trim().toUpperCase(),
            clienteId: cliente.id 
          }).then(() => { carregarDados(); setModalManejo(false); })} 
        />
      )}
    </div>
  );
}

// --- Componentes Internos ---

function CardVencimento({ label, numero, data, tipo, icon }: { label: string, numero?: string, data?: string, tipo: string, icon: React.ReactNode }) {
  return (
    <div className="card bg-brand-dark-3/50 border-brand-dark-5 flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-brand-blue/10 text-brand-blue">
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-white font-bold">{numero || 'DATA DE VALIDADE'}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">Vencimento</p>
        <BadgeVencimento data={data} tipo={tipo} />
      </div>
    </div>
  );
}

function BadgeVencimento({ data, tipo }: { data?: string, tipo: string }) {
  if (!data) return <span className="text-[10px] text-gray-600 italic">Não informado</span>;
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

function ModalArma({ onFechar, onSalvar }: { onFechar: () => void, onSalvar: (d: any) => void }) {
  const { modelosRegistrados, calibresRegistrados, fabricantesRegistrados } = useClientes();
  const [form, setForm] = useState({
    tipo: '', modelo: '', calibre: '', fabricante: '', numeroSerie: '', 
    numeroSigma: '', acervo: 'Tiro Desportivo' as any, vencimentoCraf: ''
  });

  const modelosCombinados = Array.from(new Set([...MODELOS_BASE, ...modelosRegistrados])).sort();
  const calibresCombinados = Array.from(new Set([...CALIBRES, ...calibresRegistrados])).sort();
  const fabricantesCombinados = Array.from(new Set([...FABRICANTES_BASE, ...fabricantesRegistrados])).sort();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-6">Cadastrar Nova Arma</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Tipo de Arma</label>
            <input 
              list="tipos-arma"
              className="input uppercase" 
              value={form.tipo} 
              onChange={e => setForm({...form, tipo: e.target.value})} 
              placeholder="Selecione ou digite..."
            />
            <datalist id="tipos-arma">
              {TIPOS_ARMA.map(t => <option key={t} value={t} />)}
            </datalist>
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
          <div className="flex gap-3 pt-4">
            <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button onClick={() => onSalvar(form)} className="btn-primary flex-1">Salvar Arma</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalGt({ onFechar, onSalvar }: { onFechar: () => void, onSalvar: (d: any) => void }) {
  const [form, setForm] = useState({ tipo: 'Treino', vencimento: '', destino: '' });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-6">Nova Guia de Tráfego</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Tipo de Guia</label>
            <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option value="Treino">Treino</option>
              <option value="Caça">Caça</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Transferência">Transferência</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="label">Destino</label>
            <input type="text" className="input uppercase" placeholder="Clube, Cidade, Armeiro..." value={form.destino} onChange={e => setForm({...form, destino: e.target.value})} />
          </div>
          <div>
            <label className="label">Data de Vencimento</label>
            <input type="date" className="input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button onClick={() => onSalvar(form)} className="btn-primary flex-1">Salvar Guia</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalManejo({ onFechar, onSalvar }: { onFechar: () => void, onSalvar: (d: any) => void }) {
  const [form, setForm] = useState({ numeroCar: '', nomeFazenda: '', nomeProprietario: '', cidade: '', vencimento: '' });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-6">Autorização de Manejo (IBAMA)</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Nº do CAR da Fazenda</label>
            <input type="text" className="input uppercase" value={form.numeroCar} onChange={e => setForm({...form, numeroCar: e.target.value})} />
          </div>
          <div>
            <label className="label">Nome da Fazenda</label>
            <input type="text" className="input uppercase" value={form.nomeFazenda} onChange={e => setForm({...form, nomeFazenda: e.target.value})} />
          </div>
          <div>
            <label className="label">Proprietário</label>
            <input type="text" className="input uppercase" value={form.nomeProprietario} onChange={e => setForm({...form, nomeProprietario: e.target.value})} />
          </div>
          <div>
            <label className="label">Cidade / Estado</label>
            <input type="text" className="input uppercase" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} />
          </div>
          <div>
            <label className="label">Validade da Autorização</label>
            <input type="date" className="input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onFechar} className="btn-ghost flex-1">Cancelar</button>
            <button onClick={() => onSalvar(form)} className="btn-primary flex-1">Salvar Manejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
