// Portal G CAC - Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const clientContent = document.getElementById('clientContent');
  const emptyContent = document.getElementById('emptyContent');
  const clientName = document.getElementById('clientName');
  const clientCpf = document.getElementById('clientCpf');
  const clientRg = document.getElementById('clientRg');
  const clientNasc = document.getElementById('clientNasc');
  const clientUf = document.getElementById('clientUf');
  const btnPreencher = document.getElementById('btnPreencher');

  let clienteAtual = null;

  // Carrega dados sincronizados do chrome storage
  chrome.storage.local.get(['gcac_cliente'], (result) => {
    clienteAtual = result.gcac_cliente;

    if (clienteAtual && clienteAtual.nome) {
      statusBadge.textContent = 'Ativo';
      statusBadge.classList.remove('empty');
      clientContent.style.display = 'block';
      emptyContent.style.display = 'none';

      clientName.textContent = clienteAtual.nome;
      clientCpf.textContent = clienteAtual.cpf || '-';
      clientRg.textContent = clienteAtual.rg || '-';
      clientNasc.textContent = formatarData(clienteAtual.dataNascimento) || '-';
      clientUf.textContent = clienteAtual.estado || 'GO';
    } else {
      statusBadge.textContent = 'Sem Cliente';
      statusBadge.classList.add('empty');
      clientContent.style.display = 'none';
      emptyContent.style.display = 'block';
    }
  });

  // Dispara preenchimento na aba ativa
  btnPreencher.addEventListener('click', () => {
    if (!clienteAtual) return;

    btnPreencher.innerHTML = '<span>⏳ Preenchendo...</span>';
    btnPreencher.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'preencher', cliente: clienteAtual },
          (response) => {
            btnPreencher.disabled = false;
            if (response && response.sucesso) {
              btnPreencher.innerHTML = `<span>✓ ${response.camposPreenchidos} Campos Preenchidos!</span>`;
              setTimeout(() => {
                btnPreencher.innerHTML = '<span>⚡ Preencher Tela Atual</span>';
              }, 2500);
            } else {
              btnPreencher.innerHTML = '<span>⚡ Preencher Tela Atual</span>';
              alert('Certifique-se de estar com a página do Tribunal aberta e o formulário visível.');
            }
          }
        );
      }
    });
  });

  // Configura botões de cópia rápida
  document.querySelectorAll('.btn-copy-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.getAttribute('data-field');
      if (!clienteAtual || !field) return;

      let val = clienteAtual[field] || '';
      if (field === 'dataNascimento') {
        val = formatarData(val);
      }

      if (val) {
        navigator.clipboard.writeText(val).then(() => {
          const originalText = button.innerHTML;
          button.innerHTML = 'Copiado! <span>✓</span>';
          button.style.borderColor = '#10b981';
          button.style.color = '#34d399';
          setTimeout(() => {
            button.innerHTML = originalText;
            button.style.borderColor = '';
            button.style.color = '';
          }, 1500);
        });
      }
    });
  });

  function formatarData(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('-')) {
      const parts = dataStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  }
});
