import jsPDF from 'jspdf';
import { ColaboradorContrato, FechamentoColaborador } from '../types';
import { formatarMoeda, formatarData } from '../utils/formatters';
import { DiaCalendarioApuracao, formatarMinutosHoras } from './pontoColaboradoresService';

const AZUL_BRAND = '#1B6FBF';
const AZUL_FUNDO = '#F0F7FF';
const ESCURO_BRAND = '#0D0D0D';
const CINZA_TEXTO = '#555555';
const VERDE_BRAND = '#15803D';
const VERMELHO_BRAND = '#B91C1C';

export interface DadosGeracaoPdfApuracao {
  empresaNome: string;
  empresaCnpj?: string;
  responsavelEmpresa?: string;
  contrato: ColaboradorContrato;
  fechamento: Omit<FechamentoColaborador, 'id' | 'criadoEm'> & { id?: string; criadoEm?: string };
  diasCalendario: DiaCalendarioApuracao[];
}

export async function baixarPdfApuracaoColaborador(dados: DadosGeracaoPdfApuracao): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  let y = 14;

  // 1. Cabeçalho Corporativo
  doc.setFillColor(ESCURO_BRAND);
  doc.rect(12, y, largura - 24, 22, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((dados.empresaNome || 'ESCRITÓRIO / ASSESSORIA').toUpperCase(), 17, y + 8);

  doc.setFontSize(8.5);
  doc.setTextColor('#93C5FD');
  doc.text('EXTRATO DE APURAÇÃO DE PRESTAÇÃO DE SERVIÇOS E REGISTRO DE PRESENÇA (PJ / NF)', 17, y + 14);

  doc.setTextColor('#CCCCCC');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `CNPJ Contratante: ${dados.empresaCnpj || 'Não informado'}  |  Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    17,
    y + 19
  );

  y += 27;

  // 2. Quadro de Identificação do Colaborador / Prestador e Período
  doc.setFillColor(AZUL_FUNDO);
  doc.roundedRect(12, y, largura - 24, 26, 2, 2, 'F');
  doc.setDrawColor(AZUL_BRAND);
  doc.setLineWidth(0.5);
  doc.roundedRect(12, y, largura - 24, 26, 2, 2, 'S');

  doc.setTextColor(ESCURO_BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`COLABORADOR / PRESTADOR: ${dados.contrato.nome.toUpperCase()}`, 16, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(CINZA_TEXTO);
  doc.text(
    `CPF/CNPJ: ${dados.contrato.cpfCnpj || 'Não informado'}   |   PIX: ${dados.contrato.chavePix || 'Não informado'}   |   Início das Atividades: ${formatarData(dados.contrato.dataInicio)}`,
    16,
    y + 12
  );

  const labelModelo =
    dados.contrato.modeloCalculo === 'mensal_proporcional'
      ? `Mensal Proporcional (Base ${formatarMoeda(dados.contrato.valorBase)} / ${dados.contrato.divisorMensal === '30_dias' ? '30 dias' : 'Dias Úteis'})`
      : dados.contrato.modeloCalculo === 'diaria'
      ? `Por Diária Efetiva (${formatarMoeda(dados.contrato.valorBase)}/dia)`
      : `Por Hora Efetiva (${formatarMoeda(dados.contrato.valorBase)}/hora)`;

  doc.text(
    `Modalidade de Apuração: ${labelModelo}   |   Jornada Ref.: ${formatarMinutosHoras(dados.contrato.cargaHorariaDiariaMin)}/dia`,
    16,
    y + 17.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(AZUL_BRAND);
  doc.text(
    `PERÍODO APURADO: ${formatarData(dados.fechamento.dataInicioPeriodo)} a ${formatarData(dados.fechamento.dataFimPeriodo)}   |   NF: ${dados.fechamento.numeroNf ? `#${dados.fechamento.numeroNf}` : 'Aguardando Emissão'}`,
    16,
    y + 23
  );

  y += 31;

  // 3. Resumo Financeiro da Apuração (Quanto pagar / emitir na Nota Fiscal)
  doc.setFillColor('#F9FAFB');
  doc.roundedRect(12, y, largura - 24, 34, 2, 2, 'F');
  doc.setDrawColor('#D1D5DB');
  doc.setLineWidth(0.3);
  doc.roundedRect(12, y, largura - 24, 34, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(ESCURO_BRAND);
  doc.text('DEMONSTRATIVO DO CÁLCULO FINANCEIRO (BASE PARA EMISSÃO DE NOTA FISCAL)', 16, y + 6);

  doc.setFontSize(8);
  const col1X = 16;
  const col2X = 78;
  const col3X = 140;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text(`(+) Base Proporcional (${dados.fechamento.diasTrabalhados}d):`, col1X, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ESCURO_BRAND);
  doc.text(formatarMoeda(dados.fechamento.valorBaseProporcional), col1X + 44, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text('(-) Ausências / Horas Não Trab.:', col1X, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(VERMELHO_BRAND);
  doc.text(`- ${formatarMoeda(dados.fechamento.valorDescontosAusenciasHoras)}`, col1X + 44, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text('(+) Horas Adicionais / Extras:', col1X, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(VERDE_BRAND);
  doc.text(`+ ${formatarMoeda(dados.fechamento.valorHorasExtras)}`, col1X + 44, y + 25);

  // Coluna 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text('(+) Comissões O.S. Concluídas:', col2X, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(VERDE_BRAND);
  doc.text(`+ ${formatarMoeda(dados.fechamento.valorComissoesOs)}`, col2X + 43, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text('(+) Ajuda de Custo / Bônus:', col2X, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(VERDE_BRAND);
  doc.text(`+ ${formatarMoeda(dados.fechamento.valorAjudaCusto)}`, col2X + 43, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CINZA_TEXTO);
  doc.text('(-) Adiantamentos / Vales:', col2X, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(VERMELHO_BRAND);
  doc.text(`- ${formatarMoeda(dados.fechamento.valorAdiantamentos)}`, col2X + 43, y + 25);

  // Ajuste Manual do Gestor (se houver)
  if (dados.fechamento.valorAjusteManual) {
    const aj = dados.fechamento.valorAjusteManual;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(aj > 0 ? VERDE_BRAND : VERMELHO_BRAND);
    doc.setFontSize(6.5);
    doc.text(
      `Ajuste Gestor: ${aj > 0 ? '+' : ''}${formatarMoeda(aj)} (${dados.fechamento.motivoAjusteManual || 'Acordo'})`,
      col2X,
      y + 30
    );
  }

  // Coluna 3 (Destaque Valor Final)
  doc.setFillColor(ESCURO_BRAND);
  doc.roundedRect(col3X, y + 7, largura - 15 - col3X, 23, 2, 2, 'F');
  doc.setTextColor('#93C5FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR LÍQUIDO A PAGAR / NF', col3X + (largura - 15 - col3X) / 2, y + 13, { align: 'center' });
  doc.setTextColor('#4ADE80');
  doc.setFontSize(13);
  doc.text(formatarMoeda(dados.fechamento.valorLiquidoFinal), col3X + (largura - 15 - col3X) / 2, y + 22, { align: 'center' });
  doc.setTextColor('#D1D5DB');
  doc.setFontSize(6.5);
  doc.text(
    `Horas cumpridas: ${formatarMinutosHoras(dados.fechamento.minutosTrabalhadosTotal)} / ${formatarMinutosHoras(dados.fechamento.minutosEsperadosTotal)}`,
    col3X + (largura - 15 - col3X) / 2,
    y + 27.5,
    { align: 'center' }
  );

  y += 40;

  // 4. Tabela de Registros de Ponto (Entrada, Intervalo, Saída, Localização)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(ESCURO_BRAND);
  doc.text('ESPELHO DE REGISTROS DE PONTO (ENTRADAS E SAÍDAS DA EMPRESA)', 12, y);
  y += 3;

  const desenharCabecalhoTabela = (posY: number) => {
    doc.setFillColor(ESCURO_BRAND);
    doc.rect(12, posY, largura - 24, 7, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('DATA', 14, posY + 4.8);
    doc.text('DIA', 33, posY + 4.8);
    doc.text('STATUS / OCORRÊNCIA', 45, posY + 4.8);
    doc.text('ENTRADA', 86, posY + 4.8);
    doc.text('INTERVALO', 104, posY + 4.8);
    doc.text('SAÍDA', 129, posY + 4.8);
    doc.text('TRABALHADO', 145, posY + 4.8);
    doc.text('LOCAL / GPS', 168, posY + 4.8);
    return posY + 7;
  };

  y = desenharCabecalhoTabela(y);

  const diasExibidos = dados.diasCalendario.filter(d => !d.antesDaAdmissao);

  diasExibidos.forEach((dia, idx) => {
    if (y > altura - 42) {
      doc.addPage();
      y = 16;
      y = desenharCabecalhoTabela(y);
    }

    if (idx % 2 === 0) {
      doc.setFillColor('#F8FAFC');
      doc.rect(12, y, largura - 24, 6.2, 'F');
    }

    const reg = dia.registro;
    const statusMap: Record<string, string> = {
      trabalhado: 'Presença Normal',
      parcial: 'Horário Parcial',
      falta_descontada: 'Ausência (Não Faturada)',
      falta_abonada: 'Ausência Abonada',
      folga_feriado: 'Folga / Feriado',
      descanso_semanal: 'Descanso Semanal',
      sem_lancamento: 'Sem Registro'
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(ESCURO_BRAND);
    doc.text(formatarData(dia.data), 14, y + 4.3);
    doc.text(dia.diaSemanaLabel, 33, y + 4.3);

    // Cor por status
    if (dia.statusEfetivo === 'falta_descontada') {
      doc.setTextColor(VERMELHO_BRAND);
      doc.setFont('helvetica', 'bold');
    } else if (dia.statusEfetivo === 'trabalhado') {
      doc.setTextColor(VERDE_BRAND);
    } else {
      doc.setTextColor(CINZA_TEXTO);
    }
    doc.text(statusMap[dia.statusEfetivo] || dia.statusEfetivo, 45, y + 4.3);

    doc.setTextColor(ESCURO_BRAND);
    doc.setFont('helvetica', 'normal');
    doc.text(reg?.horaEntrada || '—', 86, y + 4.3);
    const intervaloStr =
      reg?.horaIntervaloIda || reg?.horaIntervaloVolta
        ? `${reg?.horaIntervaloIda || '--:--'} às ${reg?.horaIntervaloVolta || '--:--'}`
        : '—';
    doc.text(intervaloStr, 104, y + 4.3);
    doc.text(reg?.horaSaida || '—', 129, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.text(dia.minutosTrabalhados > 0 ? formatarMinutosHoras(dia.minutosTrabalhados) : '00h00', 145, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    let gpsTexto = '—';
    if (reg?.distanciaEntradaMetros !== undefined) {
      gpsTexto = reg.distanciaEntradaMetros <= 200 ? `Sede (${reg.distanciaEntradaMetros}m)` : `Ext. (${reg.distanciaEntradaMetros}m)`;
    } else if (reg?.latEntrada) {
      gpsTexto = 'GPS Registrado';
    } else if (reg?.origemRegistro === 'ajuste_gestor') {
      gpsTexto = 'Lanç. Gestor';
    }
    doc.text(gpsTexto, 168, y + 4.3);

    y += 6.2;
  });

  // 5. Assinaturas no rodapé
  if (y > altura - 45) {
    doc.addPage();
    y = 30;
  } else {
    y = Math.max(y + 12, altura - 40);
  }

  doc.setDrawColor(ESCURO_BRAND);
  doc.setLineWidth(0.4);
  doc.line(18, y + 12, 92, y + 12);
  doc.line(118, y + 12, largura - 18, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(ESCURO_BRAND);
  doc.text((dados.empresaNome || 'CONTRATANTE').toUpperCase(), 55, y + 16.5, { align: 'center' });
  doc.text(dados.contrato.nome.toUpperCase(), 155, y + 16.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(CINZA_TEXTO);
  doc.text('CONTRATANTE / GESTOR', 55, y + 20.5, { align: 'center' });
  doc.text('PRESTADOR DE SERVIÇOS (CONFERÊNCIA E QUITAÇÃO)', 155, y + 20.5, { align: 'center' });

  const nomeArq = `APURACAO_PONTO_${dados.contrato.nome.replace(/\s+/g, '_').toUpperCase()}_${dados.fechamento.dataInicioPeriodo}_A_${dados.fechamento.dataFimPeriodo}.pdf`;
  doc.save(nomeArq);
}
