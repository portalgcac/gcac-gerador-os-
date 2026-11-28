import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Scale, FileText, CheckCircle2, AlertCircle, ExternalLink, 
  Copy, Check, Download, Upload, Trash2, RefreshCw, Sparkles, User, 
  MapPin, Calendar, Clock, Globe, FileDown, Eye, AlertTriangle, ArrowRight
} from 'lucide-react';
import { Cliente } from '../../types';
import { formatarCPF, formatarData } from '../../utils/formatters';

interface CertidaoConfig {
  id: string;
  orgao: string;
  esfera: 'Federal' | 'Estadual' | 'Militar' | 'Eleitoral' | 'Policial';
  titulo: string;
  descricao: string;
  obrigatóriaPara: string;
  validadeDias: number;
  obterUrl: (uf: string) => string;
}

// Mapeamento oficial de URLs por Tribunal e Órgão
const CERTIDOES_CATALOGO: CertidaoConfig[] = [
  {
    id: 'trf',
    orgao: 'Justiça Federal',
    esfera: 'Federal',
    titulo: 'Certidão Negativa da Justiça Federal (TRF)',
    descricao: 'Ações e Execuções Cíveis e Criminais da Justiça Federal de 1º e 2º Grau.',
    obrigatóriaPara: 'Exigido p/ CR, Renovação e Aquisição de PCE (SisGCorp e Sinarm)',
    validadeDias: 90,
    obterUrl: (uf: string) => {
      const u = uf.toUpperCase().trim();
      // TRF1: AC, AM, AP, BA, DF, GO, MA, MT, PA, PI, RO, RR, TO
      if (['GO', 'DF', 'MT', 'TO', 'BA', 'MA', 'PI', 'PA', 'AP', 'AM', 'AC', 'RO', 'RR'].includes(u)) {
        return 'https://sistemas.trf1.jus.br/certidao/#/solicitacao';
      }
      // TRF2: RJ, ES
      if (['RJ', 'ES'].includes(u)) return 'https://certidoes.trf2.jus.br/';
      // TRF3: SP, MS
      if (['SP', 'MS'].includes(u)) return 'https://web.trf3.jus.br/certidao-regional/Certidao/Solicitar';
      // TRF4: PR, RS, SC
      if (['PR', 'RS', 'SC'].includes(u)) return 'https://certidoes.trf4.jus.br/trf4/processos/certidao/index.php';
      // TRF5: AL, CE, PB, PE, RN, SE
      if (['AL', 'CE', 'PB', 'PE', 'RN', 'SE'].includes(u)) return 'https://certidoes.trf5.jus.br/certidoes/';
      // TRF6: MG
      if (u === 'MG') return 'https://portal.trf6.jus.br/servicos-judiciais/certidao-judicial/';
      return 'https://sistemas.trf1.jus.br/certidao/#/solicitacao';
    }
  },
  {
    id: 'tj',
    orgao: 'Justiça Estadual',
    esfera: 'Estadual',
    titulo: 'Certidão Negativa da Justiça Estadual (TJ)',
    descricao: 'Distribuição e Execuções Criminais de 1º e 2º Grau do Tribunal de Justiça local.',
    obrigatóriaPara: 'Exigido p/ Todos os Processos de CAC (SisGCorp e Sinarm)',
    validadeDias: 90,
    obterUrl: (uf: string) => {
      const u = uf.toUpperCase().trim();
      switch (u) {
        case 'AC': return 'https://esaj.tjac.jus.br/sco/abrirCadastro.do';
        case 'AL': return 'https://www.tjal.jus.br/servicos/certidoes';
        case 'AP': return 'https://www.tjap.jus.br/portal/servicos/certidao-negativa.html';
        case 'AM': return 'https://consultasaj.tjam.jus.br/sco/abrirCadastro.do';
        case 'BA': return 'https://www.tjba.jus.br/portal/certidao-judicial/';
        case 'CE': return 'https://sirece.tjce.jus.br/sirece-web/';
        case 'DF': return 'https://cnc.tjdft.jus.br/';
        case 'ES': return 'https://sistemas.tjes.jus.br/certidaonegativa/';
        case 'GO': return 'https://www.tjgo.jus.br/index.php/certidao-negativa';
        case 'MA': return 'https://jurisconsult.tjma.jus.br/#/certidao-solicitacao';
        case 'MT': return 'https://cidadao.tjmt.jus.br/certidaonegativa/';
        case 'MS': return 'https://esaj.tjms.jus.br/sco/abrirCadastro.do';
        case 'MG': return 'https://rupe.tjmg.jus.br/rupe/justica/publico/certidoes/guiaAcompanhamentoCertidao.rupe';
        case 'PA': return 'https://www.tjpa.jus.br/PortalExterno/servicos/certidoes.xhtml';
        case 'PB': return 'https://app.tjpb.jus.br/certidao/paginas/solicitarCertidao.jsf';
        case 'PR': return 'https://www.tjpr.jus.br/certidoes';
        case 'PE': return 'https://www.tjpe.jus.br/antecedentes-criminais/';
        case 'PI': return 'https://www.tjpi.jus.br/certidoes/';
        case 'RJ': return 'https://www.tjrj.jus.br/servicos/certidoes';
        case 'RN': return 'https://certidoes.tjrn.jus.br/';
        case 'RS': return 'https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/emissao-de-certidoes/';
        case 'RO': return 'https://certidao.tjro.jus.br/';
        case 'RR': return 'https://www.tjrr.jus.br/index.php/certidoes';
        case 'SC': return 'https://certeproc1g.tjsc.jus.br/';
        case 'SP': return 'https://esaj.tjsp.jus.br/sco/abrirCadastro.do';
        case 'SE': return 'https://www.tjse.jus.br/portal/consultas/certidoes';
        case 'TO': return 'https://certidoes.tjto.jus.br/';
        default: return 'https://www.tjgo.jus.br/index.php/certidao-negativa';
      }
    }
  },
  {
    id: 'stm',
    orgao: 'Justiça Militar da União',
    esfera: 'Militar',
    titulo: 'Certidão Negativa Militar (STM)',
    descricao: 'Certidão Negativa de Ações Criminais junto ao Superior Tribunal Militar.',
    obrigatóriaPara: 'Exigido p/ Aquisição, Concessão de CR e Renovação',
    validadeDias: 90,
    obterUrl: () => 'https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa'
  },
  {
    id: 'tse_quitacao',
    orgao: 'Justiça Eleitoral (TSE)',
    esfera: 'Eleitoral',
    titulo: 'Certidão de Quitação Eleitoral (TSE)',
    descricao: 'Comprova a regularidade do cidadão perante a Justiça Eleitoral brasileira.',
    obrigatóriaPara: 'Exigência legal para processos junto ao Exército e Polícia Federal',
    validadeDias: 90,
    obterUrl: () => 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/certidoes-eleitor/certidao-quitacao-eleitoral'
  },
  {
    id: 'tse_crimes',
    orgao: 'Justiça Eleitoral (TSE)',
    esfera: 'Eleitoral',
    titulo: 'Certidão de Crimes Eleitorais (TSE)',
    descricao: 'Certidão negativa de condenações por ilícitos ou crimes eleitorais.',
    obrigatóriaPara: 'Exigência de idoneidade em processos SisGCorp e Sinarm',
    validadeDias: 90,
    obterUrl: () => 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/certidoes-eleitor/certidao-crimes-eleitorais'
  },
  {
    id: 'dpf',
    orgao: 'Polícia Federal',
    esfera: 'Policial',
    titulo: 'Certidão de Antecedentes Criminais (DPF)',
    descricao: 'Certidão de antecedentes criminais emitida pelo Departamento de Polícia Federal.',
    obrigatóriaPara: 'Exigido p/ Aquisição de Armas, Transferência e Concessão de CR',
    validadeDias: 90,
    obterUrl: () => 'https://servicos.dpf.gov.br/antecedentes-criminais/certidao'
  },
  {
    id: 'pc',
    orgao: 'Polícia Civil / SSP Estadual',
    esfera: 'Policial',
    titulo: 'Atestado de Antecedentes Criminais Estadual',
    descricao: 'Emitido pela Secretaria de Segurança Pública ou Instituto de Identificação da UF.',
    obrigatóriaPara: 'Exigido em algumas RM e delegacias especializadas',
    validadeDias: 90,
    obterUrl: (uf: string) => {
      const u = uf.toUpperCase().trim();
      switch (u) {
        case 'GO': return 'https://www.go.gov.br/servicos-digitais/dgpc/obter-atestado-de-antecedentes-criminais/app-obter-antecedente-criminal;brasileiro=S';
        case 'DF': return 'https://www.pcdf.df.gov.br/servicos/antecedentes-criminais';
        case 'MG': return 'https://www.policiacivil.mg.gov.br/site/servico/antecedente-criminal';
        case 'SP': return 'https://www.institutodeidentificacao.sp.gov.br/';
        case 'RJ': return 'https://atestado.detran.rj.gov.br/';
        case 'PR': return 'https://www.policiacivil.pr.gov.br/Servicos/Seguranca-Publica/Solicitar-Atestado-de-Antecedentes-Criminais-8V5g4zvr';
        case 'SC': return 'https://sistemas.pc.sc.gov.br/atestado/';
        case 'RS': return 'https://www.pc.rs.gov.br/emitir-certidao-de-antecedentes-policiais';
        case 'BA': return 'https://www.ba.gov.br/servico/103/emitir-atestado-de-antecedentes-criminais';
        default: return 'https://www.go.gov.br/servicos-digitais/dgpc/obter-atestado-de-antecedentes-criminais/app-obter-antecedente-criminal;brasileiro=S';
      }
    }
  }
];

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface CentralCertidoesClienteProps {
  cliente: Cliente;
}

interface RegistroCertidao {
  certidaoId: string;
  arquivoNome: string;
  base64?: string;
  dataEmissao: string;
  dataValidade: string;
}

export function CentralCertidoesCliente({ cliente }: CentralCertidoesClienteProps) {
  // Detectar estado inicial pelo endereço do cliente
  const ufInicial = useMemo(() => {
    if (!cliente.endereco) return 'GO';
    const clean = cliente.endereco.toUpperCase();
    for (const est of ESTADOS_BRASIL) {
      if (clean.includes(`- ${est}`) || clean.includes(`-${est}`) || clean.includes(` ${est} `) || clean.endsWith(` ${est}`)) {
        return est;
      }
    }
    return 'GO';
  }, [cliente.endereco]);

  const [ufSelecionada, setUfSelecionada] = useState<string>(ufInicial);
  const [copiadoCampo, setCopiadoCampo] = useState<string | null>(null);
  const [modalInstalacaoExtensao, setModalInstalacaoExtensao] = useState(false);
  const [certidoesSalvas, setCertidoesSalvas] = useState<Record<string, RegistroCertidao>>({});

  // Carregar certidões salvas deste cliente no localStorage
  useEffect(() => {
    try {
      const storageKey = `gcac_certidoes_${cliente.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCertidoesSalvas(JSON.parse(saved));
      } else {
        setCertidoesSalvas({});
      }
    } catch (e) {
      console.warn('Erro ao carregar certidões salvas:', e);
    }
  }, [cliente.id]);

  // Atualizar cliente ativo para preenchimento na extensão do Chrome
  const ativarClienteNaExtensao = () => {
    const dadosCliente = {
      id: cliente.id,
      nome: (cliente.nome || '').toUpperCase().trim(),
      cpf: (cliente.cpf || '').replace(/\D/g, ''),
      cpfFormatado: cliente.cpf || '',
      rg: cliente.rg || '',
      orgaoEmissor: (cliente as any).orgaoEmissor || (cliente as any).orgao_emissor || 'SSP',
      email: cliente.email || '',
      dataNascimento: cliente.dataNascimento || '',
      dataNascimentoBr: cliente.dataNascimento ? cliente.dataNascimento.split('-').reverse().join('/') : '',
      nomeMae: (cliente.nomeMae || (cliente as any).nome_mae || '').toUpperCase().trim(),
      nomePai: (cliente.nomePai || (cliente as any).nome_pai || '').toUpperCase().trim(),
      endereco: cliente.endereco || '',
      cidade: (cliente as any).cidade || '',
      bairro: (cliente as any).bairro || '',
      cep: (cliente as any).cep || '',
      uf: ufSelecionada,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('gcac_cliente_certidao_ativa', JSON.stringify(dadosCliente));
      sessionStorage.setItem('gcac_cliente_certidao_ativa', JSON.stringify(dadosCliente));
      window.postMessage({ type: 'PORTAL_GCAC_CLIENTE_ATIVO', payload: dadosCliente, cliente: dadosCliente }, '*');
      window.postMessage({ type: 'GCAC_SET_CLIENTE', cliente: dadosCliente, payload: dadosCliente }, '*');
      window.dispatchEvent(new CustomEvent('gcac_set_cliente', { detail: dadosCliente }));
    } catch (e) {
      console.warn(e);
    }
    return dadosCliente;
  };

  const copiarTexto = (texto: string, campo: string) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCopiadoCampo(campo);
    setTimeout(() => setCopiadoCampo(null), 2000);
  };

  const copiarTodosDados = () => {
    const texto = `DADOS DO REQUERENTE PARA CERTIDÕES:
Nome: ${cliente.nome || ''}
CPF: ${cliente.cpf || ''}
RG: ${cliente.rg || ''}
Data de Nascimento: ${cliente.dataNascimento ? cliente.dataNascimento.split('-').reverse().join('/') : ''}
Nome da Mãe: ${cliente.nomeMae || ''}
Nome do Pai: ${cliente.nomePai || ''}
E-mail: ${cliente.email || ''}
Endereço: ${cliente.endereco || ''}
Estado (UF): ${ufSelecionada}`;
    copiarTexto(texto, 'todos');
  };

  const handleAbrirOrgao = (certidao: CertidaoConfig) => {
    ativarClienteNaExtensao();
    const url = certidao.obterUrl(ufSelecionada);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSalvarCertidaoPdf = (certidaoId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const hoje = new Date();
      const validade = new Date();
      validade.setDate(validade.getDate() + 90);

      const novoRegistro: RegistroCertidao = {
        certidaoId,
        arquivoNome: file.name,
        base64,
        dataEmissao: hoje.toISOString().split('T')[0],
        dataValidade: validade.toISOString().split('T')[0]
      };

      const atualizado = {
        ...certidoesSalvas,
        [certidaoId]: novoRegistro
      };

      setCertidoesSalvas(atualizado);
      try {
        localStorage.setItem(`gcac_certidoes_${cliente.id}`, JSON.stringify(atualizado));
      } catch (err) {
        console.warn('Erro ao salvar no storage:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverCertidao = (certidaoId: string) => {
    if (!window.confirm('Remover o arquivo salvo desta certidão?')) return;
    const atualizado = { ...certidoesSalvas };
    delete atualizado[certidaoId];
    setCertidoesSalvas(atualizado);
    try {
      localStorage.setItem(`gcac_certidoes_${cliente.id}`, JSON.stringify(atualizado));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDownloadExtensao = () => {
    const link = document.createElement('a');
    link.href = '/extensao-gcac.zip';
    link.download = 'extensao-portal-gcac.zip';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner de Instruções e Integração */}
      <div className="card bg-gradient-to-r from-brand-dark-3 via-brand-dark-4 to-brand-dark-3 border border-brand-dark-5 p-5 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-brand-blue/10 border border-brand-blue/30 rounded-2xl text-brand-blue shrink-0">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  Central de Emissão de Certidões Criminais e Negativas
                </h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green border border-brand-green/30">
                  SisGCorp & Sinarm
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Emita e organize as 6 certidões oficiais obrigatórias para os processos de CR, Aquisição e Renovação de Armas.
                Utilize o preenchimento automático com a <strong className="text-brand-blue">Extensão Oficial do Portal G CAC</strong> ou os atalhos de cópia rápida.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setModalInstalacaoExtensao(true)}
              className="flex-1 sm:flex-initial py-2.5 px-4 bg-gradient-to-r from-amber-500/20 to-brand-blue/20 hover:from-amber-500/30 hover:to-brand-blue/30 text-amber-300 hover:text-white border border-amber-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm group"
            >
              <Globe size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Extensão Google Chrome</span>
            </button>
            <button
              type="button"
              onClick={copiarTodosDados}
              className="py-2.5 px-3 bg-brand-dark-3 hover:bg-brand-dark-4 border border-brand-dark-5 hover:border-gray-400 rounded-xl text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Copiar bloco com todos os dados do cliente"
            >
              {copiadoCampo === 'todos' ? <Check size={14} className="text-brand-green" /> : <Copy size={14} />}
              <span>{copiadoCampo === 'todos' ? 'Copiado!' : 'Copiar Tudo'}</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtro de UF e Resumo do Cliente */}
        <div className="mt-5 pt-4 border-t border-brand-dark-5/80 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Tribunal Estadual / UF</span>
              <span className="font-bold text-white text-sm">Estado Selecionado: {ufSelecionada}</span>
            </div>
            <select
              value={ufSelecionada}
              onChange={e => setUfSelecionada(e.target.value)}
              className="input py-1 px-2 text-xs font-bold w-20 bg-brand-dark-4 border-brand-dark-5"
            >
              {ESTADOS_BRASIL.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div className="p-2.5 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">CPF do Cliente</span>
              <span className="font-mono font-bold text-gray-200 truncate block">{cliente.cpf || 'Não cadastrado'}</span>
            </div>
            <button
              type="button"
              onClick={() => copiarTexto(cliente.cpf || '', 'cpf')}
              className="p-1.5 hover:bg-brand-dark-4 text-gray-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Copiar CPF"
            >
              {copiadoCampo === 'cpf' ? <Check size={13} className="text-brand-green" /> : <Copy size={13} />}
            </button>
          </div>

          <div className="p-2.5 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Nome da Mãe</span>
              <span className="font-semibold text-gray-200 truncate block text-[11px]">{cliente.nomeMae || 'Não informada'}</span>
            </div>
            <button
              type="button"
              onClick={() => copiarTexto(cliente.nomeMae || '', 'mae')}
              className="p-1.5 hover:bg-brand-dark-4 text-gray-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Copiar Nome da Mãe"
            >
              {copiadoCampo === 'mae' ? <Check size={13} className="text-brand-green" /> : <Copy size={13} />}
            </button>
          </div>

          <div className="p-2.5 bg-brand-dark-3/60 rounded-xl border border-brand-dark-5 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Nascimento</span>
              <span className="font-mono font-semibold text-gray-200 block text-[11px]">
                {cliente.dataNascimento ? cliente.dataNascimento.split('-').reverse().join('/') : 'Não informada'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copiarTexto(cliente.dataNascimento ? cliente.dataNascimento.split('-').reverse().join('/') : '', 'nasc')}
              className="p-1.5 hover:bg-brand-dark-4 text-gray-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Copiar Data de Nascimento"
            >
              {copiadoCampo === 'nasc' ? <Check size={13} className="text-brand-green" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Grade com as 6 Certidões Oficiais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CERTIDOES_CATALOGO.map((cert) => {
          const salva = certidoesSalvas[cert.id];
          const urlOrgao = cert.obterUrl(ufSelecionada);

          return (
            <div
              key={cert.id}
              className={`card border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                salva 
                  ? 'bg-brand-dark-3/80 border-brand-green/30' 
                  : 'bg-brand-dark-3/40 border-brand-dark-5 hover:border-brand-dark-5/80'
              }`}
            >
              <div>
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-brand-dark-4 border border-brand-dark-5 text-gray-400">
                      {cert.esfera}
                    </span>
                    <span className="text-xs font-bold text-brand-blue truncate">
                      {cert.orgao}
                    </span>
                  </div>

                  {salva ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle2 size={11} /> Emitida / Anexada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
                      <Clock size={11} /> Pendente
                    </span>
                  )}
                </div>

                {/* Título e Descrição */}
                <h3 className="text-sm font-bold text-white mt-2 leading-tight">
                  {cert.titulo}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {cert.descricao}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  {cert.obrigatóriaPara}
                </p>
              </div>

              {/* Arquivo Salvo ou Ações */}
              <div className="mt-4 pt-3 border-t border-brand-dark-5/60 space-y-2.5">
                {salva ? (
                  <div className="p-2.5 bg-brand-dark-4/70 rounded-xl border border-brand-dark-5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={18} className="text-brand-green shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate" title={salva.arquivoNome}>
                          {salva.arquivoNome}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Validade de {cert.validadeDias} dias (até {formatarData(salva.dataValidade)})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {salva.base64 && (
                        <a
                          href={salva.base64}
                          download={salva.arquivoNome}
                          className="p-1.5 hover:bg-brand-dark-5 text-gray-300 hover:text-white rounded-lg transition-colors"
                          title="Baixar Certidão Salva"
                        >
                          <Download size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoverCertidao(cert.id)}
                        className="p-1.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                        title="Remover certidão"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Botões de Ação */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAbrirOrgao(cert)}
                    className="flex-1 py-2 px-3 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                  >
                    <span>Abrir Portal do Órgão</span>
                    <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>

                  {/* Upload / Anexar PDF da certidão emitida */}
                  <label
                    className="py-2 px-3 bg-brand-dark-4 hover:bg-brand-dark-5 text-gray-300 hover:text-white border border-brand-dark-5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0"
                    title="Anexar o PDF emitido desta certidão"
                  >
                    <Upload size={13} />
                    <span className="hidden sm:inline">{salva ? 'Substituir' : 'Anexar PDF'}</span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSalvarCertidaoPdf(cert.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Instrução de Instalação da Extensão */}
      {modalInstalacaoExtensao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full bg-brand-dark-3 border border-brand-dark-5 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-brand-dark-5 bg-brand-dark-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Extensão Portal G CAC para Google Chrome
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Preenchimento automático com 1 clique em portais de tribunais e órgãos oficiais
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalInstalacaoExtensao(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-brand-dark-5"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-gray-300 max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-brand-blue/10 border border-brand-blue/20 rounded-xl text-gray-200 space-y-1">
                <p className="font-bold text-brand-blue flex items-center gap-1.5">
                  <Sparkles size={14} /> Como a extensão funciona:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Quando você clica em <strong>"Abrir Portal do Órgão"</strong> aqui no Portal G CAC, a extensão reconhece o formulário do tribunal (TRF, TJ, STM, TSE ou PF) e preenche automaticamente o Nome, CPF, RG, Filiação e Nascimento em menos de 1 segundo! Você apenas confere, resolve o CAPTCHA e emite.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white uppercase text-xs mb-2">
                  Passo a Passo de Instalação (Fácil em 30 segundos):
                </h4>
                <ol className="space-y-2.5 list-decimal list-inside text-[11px] leading-relaxed text-gray-300">
                  <li className="p-2 bg-brand-dark-4/60 rounded-lg border border-brand-dark-5">
                    <strong>Baixe a extensão:</strong> Clique no botão azul abaixo para baixar a pasta da extensão.
                  </li>
                  <li className="p-2 bg-brand-dark-4/60 rounded-lg border border-brand-dark-5">
                    <strong>Abra as Extensões do Google Chrome:</strong> Digite <code className="bg-brand-dark-5 px-1 py-0.5 rounded text-amber-300 font-mono">chrome://extensions</code> na barra do seu navegador.
                  </li>
                  <li className="p-2 bg-brand-dark-4/60 rounded-lg border border-brand-dark-5">
                    <strong>Ative o Modo do Desenvolvedor:</strong> No canto superior direito da página do Chrome, ative a chave <em>"Modo do desenvolvedor"</em>.
                  </li>
                  <li className="p-2 bg-brand-dark-4/60 rounded-lg border border-brand-dark-5">
                    <strong>Carregar Extensão:</strong> Clique no botão <em>"Carregar sem compactação"</em> e selecione a pasta da extensão que você extraiu.
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-brand-dark-4 rounded-xl border border-brand-dark-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Pacote da Extensão Portal G CAC</p>
                  <p className="text-[10px] text-gray-500">Versão 1.0.0 • Compatível com Chrome, Brave, Edge e Opera</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExtensao}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Download size={14} />
                  <span>Baixar Extensão (.ZIP)</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 border-t border-brand-dark-5 bg-brand-dark-4 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Após instalar uma vez, ela funciona para todos os clientes do seu sistema.
              </span>
              <button
                type="button"
                onClick={() => setModalInstalacaoExtensao(false)}
                className="btn-ghost py-1.5 px-4 text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
