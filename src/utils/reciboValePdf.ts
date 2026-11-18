import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarMoeda } from './formatters';
import { ValeColaborador } from '../types';

interface DadosEmpresaVale {
  nome: string;
  cnpj?: string;
  endereco?: string;
}

export function gerarReciboValePdf(vale: ValeColaborador, empresa: DadosEmpresaVale) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const desenharVia = (startY: number, viaNumero: number, tituloVia: string) => {
    // Borda externa da via
    doc.setDrawColor(70, 70, 70);
    doc.setLineWidth(0.3);
    doc.rect(14, startY, 182, 126);

    // Cabeçalho da Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text((empresa.nome || 'PORTAL G CAC').toUpperCase(), 18, startY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    if (empresa.cnpj) {
      doc.text(`CNPJ: ${empresa.cnpj}`, 18, startY + 13);
    }
    if (empresa.endereco) {
      doc.text(empresa.endereco, 18, startY + 17);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(tituloVia.toUpperCase(), 192, startY + 8, { align: 'right' });

    // Linha divisória do cabeçalho
    doc.setDrawColor(200, 200, 200);
    doc.line(14, startY + 20, 196, startY + 20);

    // Título do Recibo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('RECIBO DE ADIANTAMENTO / VALE', 105, startY + 28, { align: 'center' });

    // Box de Valor
    doc.setFillColor(245, 247, 250);
    doc.rect(140, startY + 22, 52, 11, 'F');
    doc.setDrawColor(180, 190, 205);
    doc.rect(140, startY + 22, 52, 11, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(16, 75, 140);
    doc.text(`VALOR: ${formatarMoeda(vale.valor)}`, 166, startY + 29.5, { align: 'center' });

    // Texto de Quitação
    let dataFormatada = '';
    try {
      dataFormatada = format(parseISO(vale.dataAdiantamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      dataFormatada = vale.dataAdiantamento;
    }

    const textoDeclaracao = `Eu, ${vale.colaboradorNome.toUpperCase()}${vale.colaboradorCpf ? `, inscrito(a) no CPF nº ${vale.colaboradorCpf}` : ''}, declaro que RECEBI nesta data da empresa ${(empresa.nome || 'Empregadora').toUpperCase()} a quantia líquida de ${formatarMoeda(vale.valor)}, paga via ${vale.formaPagamento.toUpperCase()}, a título de ADIANTAMENTO SALARIAL / VALE (${vale.motivo || 'adiantamento ordinário'}), autorizando expressamente a dedução deste valor no próximo fechamento mensal de remuneração / prestação de serviços.`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    const linhasTexto = doc.splitTextToSize(textoDeclaracao, 174);
    doc.text(linhasTexto, 18, startY + 38);

    const posFinalTexto = startY + 38 + (linhasTexto.length * 4.2);

    // Se estiver confirmado eletronicamente
    if (vale.status === 'confirmado_eletronico') {
      doc.setFillColor(236, 253, 245);
      doc.rect(18, posFinalTexto + 4, 174, 26, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.rect(18, posFinalTexto + 4, 174, 26, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(6, 95, 70);
      doc.text('DOCUMENTO CONFIRMADO ELETRONICAMENTE (LEI FEDERAL Nº 14.063/2020)', 22, posFinalTexto + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      let dataConfirmacao = '';
      try {
        dataConfirmacao = vale.confirmadoEm ? format(parseISO(vale.confirmadoEm), 'dd/MM/yyyy HH:mm:ss') : 'Confirmado no sistema';
      } catch {
        dataConfirmacao = vale.confirmadoEm || '';
      }

      doc.text(`• Assinado por: ${vale.colaboradorNome} (${vale.confirmadoPorEmail || vale.usuarioEmail || 'Login Autenticado'})`, 22, posFinalTexto + 15);
      doc.text(`• Data/Hora da Confirmação: ${dataConfirmacao} (Horário Oficial de Brasília)`, 22, posFinalTexto + 19);
      doc.text(`• Hash de Integridade Digital: ${vale.hashAutenticacao || 'GCAC-VALE-AUTENTICADO'}`, 22, posFinalTexto + 23);
      doc.text('• Autenticidade garantida por login seguro no Portal G CAC.', 22, posFinalTexto + 27);

      // Rubrica desenhada se existir
      if (vale.assinaturaBase64) {
        try {
          doc.addImage(vale.assinaturaBase64, 'PNG', 145, posFinalTexto + 5, 42, 20);
        } catch {
          // ignore
        }
      }
    } else {
      // Campos de Assinatura Manual
      const posAssinatura = startY + 98;
      doc.setDrawColor(60, 60, 60);
      doc.line(24, posAssinatura, 90, posAssinatura);
      doc.line(120, posAssinatura, 186, posAssinatura);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      doc.text((empresa.nome || 'EMPRESA CONTRATANTE').toUpperCase(), 57, posAssinatura + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text('Responsável Financeiro', 57, posAssinatura + 7.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.text(vale.colaboradorNome.toUpperCase(), 153, posAssinatura + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(vale.colaboradorCpf ? `CPF: ${vale.colaboradorCpf}` : 'Colaborador / Beneficiário', 153, posAssinatura + 7.5, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Emitido em ${dataFormatada}`, 105, startY + 120, { align: 'center' });
    }

    // Rodapé de segurança
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Portal G CAC - Módulo Financeiro & RH | Identificador: ${vale.id.substring(0, 8).toUpperCase()}`, 105, startY + 124, { align: 'center' });
  };

  // 1ª Via: Empresa
  desenharVia(14, 1, '1ª Via — Empresa');

  // Linha de Corte pontilhada entre as vias
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, 146, 200, 146);
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('✄ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✄', 105, 146.5, { align: 'center' });
  doc.setLineDashPattern([], 0);

  // 2ª Via: Colaborador
  desenharVia(154, 2, '2ª Via — Colaborador');

  const nomeSanitizado = vale.colaboradorNome.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Recibo_Vale_${nomeSanitizado}_${vale.dataAdiantamento}.pdf`);
}
