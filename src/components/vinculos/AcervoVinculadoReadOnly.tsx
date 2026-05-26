import React, { useState } from 'react';
import {
  X, Target, FileText, Award, Shield, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Calendar, User
} from 'lucide-react';
import { VinculoDespachanteCac, AcervoVinculado } from '../../services/vinculosService';

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

function Secao({ titulo, icon: Icon, children }: { titulo: string; icon: React.ElementType; children: React.ReactNode }) {
  const [aberta, setAberta] = useState(true);
  return (
    <div className="bg-brand-dark-3 rounded-xl border border-brand-dark-5 overflow-hidden">
      <button
        onClick={() => setAberta(!aberta)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-dark-4 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <Icon size={13} />
          {titulo}
        </div>
        {aberta ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
      </button>
      {aberta && <div className="border-t border-brand-dark-5 p-4">{children}</div>}
    </div>
  );
}

export function AcervoVinculadoReadOnly({ vinculo, acervo, onClose }: Props) {
  const { cliente, armas, manejos } = acervo;
  const [armaExpandida, setArmaExpandida] = useState<string | null>(null);

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
      <div className="bg-brand-dark-2 w-full max-w-2xl rounded-2xl border border-brand-dark-5 shadow-2xl flex flex-col max-h-[92vh]">
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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  Acervo Read-Only
                </span>
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
          {/* Alertas */}
          {alertas > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                <strong>{alertas} documento(s)</strong> vencidos ou a vencer em menos de 30 dias. Considere entrar em contato com o atirador.
              </p>
            </div>
          )}

          {/* Perfil */}
          <Secao titulo="Certificados de Registro" icon={Shield}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Nº CR Exército</p>
                <p className="text-sm text-white font-mono">{cliente.numeroCr || 'Não cadastrado'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Validade CR</p>
                <BadgeVencimento data={cliente.vencimentoCr} />
              </div>
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Nº CR IBAMA</p>
                <p className="text-sm text-white font-mono">{cliente.numeroCrIbama || '—'}</p>
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
          </Secao>

          {/* Armas */}
          <Secao titulo={`Acervo de Armas (${armas.length})`} icon={Target}>
            {armas.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-2">Nenhuma arma cadastrada</p>
            ) : (
              <div className="space-y-3">
                {armas.map(arma => (
                  <div key={arma.id} className="bg-brand-dark-2 rounded-xl border border-brand-dark-5 overflow-hidden">
                    <button
                      onClick={() => setArmaExpandida(armaExpandida === arma.id ? null : arma.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-dark-3 transition-colors text-left"
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
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-gray-600 bg-brand-dark-4 px-2 py-0.5 rounded-md">
                          {arma.gts.length} GT{arma.gts.length !== 1 ? 's' : ''}
                        </span>
                        {armaExpandida === arma.id ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                      </div>
                    </button>

                    {armaExpandida === arma.id && (
                      <div className="border-t border-brand-dark-5 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-gray-600">Série: </span><span className="text-white font-mono">{arma.numeroSerie}</span></div>
                          <div><span className="text-gray-600">Sigma: </span><span className="text-white font-mono">{arma.numeroSigma}</span></div>
                          <div>
                            <span className="text-gray-600">CRAF válido até: </span>
                            <BadgeVencimento data={arma.vencimentoCraf} />
                          </div>
                        </div>

                        {arma.gts.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-2 flex items-center gap-1">
                              <FileText size={10} /> Guias de Tráfego
                            </p>
                            <div className="space-y-1.5">
                              {arma.gts.map(gt => (
                                <div key={gt.id} className="flex items-center justify-between bg-brand-dark-3 rounded-lg px-3 py-2">
                                  <div className="text-xs">
                                    <span className="text-white font-medium">{gt.tipo}</span>
                                    <span className="text-gray-500"> · {gt.destino}</span>
                                  </div>
                                  <BadgeVencimento data={gt.vencimento} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* Manejos */}
          {manejos.length > 0 && (
            <Secao titulo={`Autorizações de Manejo IBAMA (${manejos.length})`} icon={Award}>
              <div className="space-y-2">
                {manejos.map(m => (
                  <div key={m.id} className="bg-brand-dark-2 rounded-xl border border-brand-dark-5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{m.nomeFazenda}</p>
                        <p className="text-xs text-gray-500">{m.nomeProprietario} · {m.cidade}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">CAR: {m.numeroCar}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <BadgeVencimento data={m.vencimento} />
                        <p className={`text-[10px] mt-1 font-bold ${m.status === 'Ativo' ? 'text-green-400' : 'text-gray-500'}`}>
                          {m.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Secao>
          )}

          {/* Rodapé LGPD */}
          <div className="text-center text-[10px] text-gray-700 py-2">
            Dados exibidos com autorização do atirador · Somente leitura · Vinculado a {vinculo.despachante_nome}
          </div>
        </div>
      </div>
    </div>
  );
}
