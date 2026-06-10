import jsPDF from 'jspdf';
import { Agendamento } from '../types';
import { formatarDataParaWhatsApp } from '../utils/agendamentoFormatador';

// Cores GCAC
const AZUL_BRAND    = '#1B6FBF';
const AZUL_FUNDO    = '#F0F7FF';
const ESCURO_BRAND  = '#0D0D0D';
const CINZA_TEXTO  = '#666666';

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPdfAgendamentoBlob(agendamento: Agendamento): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura  = doc.internal.pageSize.getHeight();
  let y = 0;

  // 1. Header
  let nomeEmpresa = 'GCAC DESPACHANTE BÉLICO';
  try {
    let logoBase64 = '';
    const dadosUsuario = localStorage.getItem('gcac_usuario');
    if (dadosUsuario) {
      const u = JSON.parse(dadosUsuario);
      if (u.dadosEmpresa?.logoUrl) {
        logoBase64 = u.dadosEmpresa.logoUrl;
      }
      if (u.dadosEmpresa?.razaoSocialFantasia) {
        nomeEmpresa = u.dadosEmpresa.razaoSocialFantasia.toUpperCase();
      }
    }

    if (!logoBase64) {
      const logoRes = await fetch('/LOGO PORTAL G CAC 2 SEM FRASE.png');
      if (logoRes.ok) {
        const logoBlob = await logoRes.blob();
        logoBase64 = await blobParaBase64(logoBlob);
      }
    }

    if (logoBase64) {
      let format = 'PNG';
      if (logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg')) {
        format = 'JPEG';
      } else if (logoBase64.startsWith('data:image/webp')) {
        format = 'WEBP';
      }
      doc.addImage(logoBase64, format, 12, 12, 22, 22);
    }
  } catch { /* erro no logo */ }

  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, 38, 20);
  
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(11);
  doc.text('CONFIRMAÇÃO DE AGENDAMENTO', 38, 26);

  doc.setDrawColor('#000000');
  doc.setLineWidth(0.8);
  doc.line(12, 45, largura - 12, 45);
  doc.setLineWidth(0.1);

  y = 60;

  // 2. Dados do Cliente
  doc.setFillColor(AZUL_FUNDO);
  doc.roundedRect(12, y, largura - 24, 45, 3, 3, 'F');
  
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 18, y + 8);

  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(12);
  doc.text(agendamento.clienteNome.toUpperCase(), 18, y + 16);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${agendamento.clienteCPF}`, 18, y + 23);
  doc.text(`Contato: ${agendamento.clienteContato}`, 18, y + 28);
  
  const enderecoArr = doc.splitTextToSize(`Endereço: ${agendamento.clienteEndereco}`, largura - 40);
  doc.text(enderecoArr, 18, y + 33);

  y += 55;

  // 3. Detalhes do Agendamento
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHES DO LAUDO', 12, y);
  y += 5;

  doc.setFillColor('#FFFFFF');
  doc.setDrawColor('#EEEEEE');
  doc.roundedRect(12, y, largura - 24, 75, 2, 2, 'S');

  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`TIPO: LAUDO ${agendamento.tipo.toUpperCase()}`, 18, y + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`ARMA: ${agendamento.arma.toUpperCase()}`, 18, y + 20);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(14);
  doc.text(`DIA: ${formatarDataParaWhatsApp(agendamento.data)}`, 18, y + 30);
  doc.text(`HORÁRIO: ${agendamento.horario}`, 18, y + 38);

  doc.setTextColor(ESCURO_BRAND);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const linhasLocal = doc.splitTextToSize(`LOCAL: ${agendamento.local}`, largura - 30);
  doc.text(linhasLocal, 18, y + 48);
  
  const yProf = y + 48 + (linhasLocal.length * 5);
  const labelProf = agendamento.tipo === 'Psicológico' ? 'PSICÓLOGA' : 'INSTRUTOR';
  const linhasProf = doc.splitTextToSize(`${labelProf}: ${agendamento.profissional}`, largura - 30);
  doc.text(linhasProf, 18, yProf);

  if (agendamento.tipo === 'Tiro' && agendamento.dataPsicologico) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(CINZA_TEXTO);
    doc.text(`* Laudo psicológico agendado para: ${formatarDataParaWhatsApp(agendamento.dataPsicologico).split(' ')[0]} ${agendamento.horarioPsicologico || ''}`, 18, y + 66);
  }

  y += 85;

  // 4. Valor
  doc.setFillColor(AZUL_FUNDO);
  doc.roundedRect(largura - 80, y, 68, 15, 2, 2, 'F');
  doc.setTextColor(AZUL_BRAND);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR: ${agendamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, largura - 75, y + 10);

  // 5. Rodapé
  doc.setTextColor(CINZA_TEXTO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const msg = 'Favor comparecer com 15 minutos de antecedência munido de documento com foto.';
  doc.text(msg, largura / 2, altura - 20, { align: 'center' });

  return doc.output('blob');
}

export async function baixarPdfAgendamento(agendamento: Agendamento): Promise<void> {
  const blob = await gerarPdfAgendamentoBlob(agendamento);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AGENDAMENTO_${agendamento.tipo.toUpperCase()}_${agendamento.clienteNome.replace(/\s/g, '_')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
