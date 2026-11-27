// Portal G CAC - Popup Script Avançado
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
  const btnBuscarAbas = document.getElementById('btnBuscarAbas');

  let clienteAtual = null;

  function renderizarCliente(cli) {
    if (cli && cli.nome) {
      clienteAtual = cli;
      statusBadge.textContent = 'Ativo';
      statusBadge.classList.remove('empty');
      clientContent.style.display = 'block';
      emptyContent.style.display = 'none';

      clientName.textContent = cli.nome;
      clientCpf.textContent = cli.cpf || cli.cpfFormatado || '-';
      clientRg.textContent = cli.rg || '-';
      clientNasc.textContent = formatarData(cli.dataNascimento) || '-';
      clientUf.textContent = cli.uf || cli.estado || 'GO';
    } else {
      statusBadge.textContent = 'Sem Cliente';
      statusBadge.classList.add('empty');
      clientContent.style.display = 'none';
      emptyContent.style.display = 'block';
    }
  }

  // 1. Tenta carregar do storage local
  chrome.storage.local.get(['gcac_cliente'], (result) => {
    if (result.gcac_cliente && result.gcac_cliente.nome) {
      renderizarCliente(result.gcac_cliente);
    } else {
      // 2. Tenta buscar automaticamente em qualquer aba aberta do Portal G CAC
      tentarBuscarAbas();
    }
  });

  function tentarBuscarAbas() {
    statusBadge.textContent = 'Buscando...';
    chrome.runtime.sendMessage({ action: 'buscar_cliente_abas' }, (resp) => {
      if (resp && resp.cliente) {
        renderizarCliente(resp.cliente);
      } else {
        renderizarCliente(null);
      }
    });
  }

  if (btnBuscarAbas) {
    btnBuscarAbas.addEventListener('click', () => {
      btnBuscarAbas.innerHTML = '<span>⏳ Procurando aba aberta...</span>';
      tentarBuscarAbas();
      setTimeout(() => {
        btnBuscarAbas.innerHTML = '<span>🔄 Puxar Dados do Portal G CAC</span>';
      }, 1500);
    });
  }

  // Dispara preenchimento na aba ativa
  btnPreencher.addEventListener('click', async () => {
    if (!clienteAtual) return;

    btnPreencher.innerHTML = '<span>⏳ Preenchendo...</span>';
    btnPreencher.disabled = true;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0] || !tabs[0].id) {
        throw new Error('Nenhuma aba ativa identificada');
      }

      const tabId = tabs[0].id;

      // Primeiro tenta via mensagem para o content_script
      chrome.tabs.sendMessage(tabId, { action: 'preencher', cliente: clienteAtual }, (response) => {
        if (!chrome.runtime.lastError && response && response.sucesso) {
          concluirPreenchimento(response.camposPreenchidos);
        } else {
          // Se o content script não estiver injetado (ex: aba aberta antes da extensão), injeta via scripting
          injetarEPreencherDiretamente(tabId, clienteAtual);
        }
      });
    } catch (err) {
      console.error(err);
      btnPreencher.disabled = false;
      btnPreencher.innerHTML = '<span>⚡ Preencher Tela Atual</span>';
    }
  });

  // Fallback de injeção direta usando chrome.scripting
  async function injetarEPreencherDiretamente(tabId, cliente) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (cli) => {
          let preenchidos = 0;
          function norm(str) {
            if (!str) return '';
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          }

          const cpfLimpo = (cli.cpf || '').replace(/\D/g, '');
          const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
          const nomeMae = cli.nomeMae || cli.nome_mae || '';
          const nomePai = cli.nomePai || cli.nome_pai || '';
          
          let dataNascBr = cli.dataNascimentoBr || '';
          if (!dataNascBr && cli.dataNascimento) {
            const p = cli.dataNascimento.split('-');
            if (p.length === 3) dataNascBr = `${p[2]}/${p[1]}/${p[0]}`;
          }

          function setVal(el, val) {
            if (!el || !val) return;
            el.focus();
            const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && desc.set) {
              desc.set.call(el, val);
            } else {
              el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            el.style.borderColor = '#10b981';
            el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.35)';
            preenchidos++;
          }

          // 1. TSE Específico (Angular Reactive Forms)
          const tseNome = document.querySelector('input[formcontrolname="nomeEleitor"]');
          if (tseNome) setVal(tseNome, cli.nome);

          const tseCpf = document.querySelector('input[formcontrolname="TituloCPF"]');
          if (tseCpf) setVal(tseCpf, cpfLimpo);

          const tseNasc = document.querySelector('input[formcontrolname="dataNascimento"]') || document.getElementById('dataNascimento');
          if (tseNasc) setVal(tseNasc, dataNascBr);

          const tseFiliacao = document.querySelector('select[formcontrolname="tipoFiliacao"]');
          if (tseFiliacao) {
            tseFiliacao.value = (nomeMae && nomePai) ? 'UMA_MAE_UM_PAI' : (nomeMae ? 'UMA_MAE' : 'UM_PAI');
            tseFiliacao.dispatchEvent(new Event('change', { bubbles: true }));
            preenchidos++;
          }

          const tseMae = document.querySelector('input[formcontrolname="nomeMae"]') || document.getElementById('nomeMae');
          if (tseMae && nomeMae) setVal(tseMae, nomeMae);

          const tsePai = document.querySelector('input[formcontrolname="nomePai"]') || document.getElementById('nomePai');
          if (tsePai && nomePai) setVal(tsePai, nomePai);

          // 2. Busca geral com prioridade estrita
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea'));
          inputs.forEach(inp => {
            if (inp.value) return;
            const text = norm((inp.id || '') + ' ' + (inp.name || '') + ' ' + (inp.placeholder || '') + ' ' + (inp.getAttribute('aria-label') || '') + ' ' + (inp.getAttribute('formcontrolname') || ''));
            
            // Mãe primeiro
            if (text.includes('mae') || text.includes('materna')) {
              if (nomeMae) setVal(inp, nomeMae);
              return;
            }
            // Pai segundo
            if (text.includes('pai') || text.includes('paterna')) {
              if (nomePai) setVal(inp, nomePai);
              return;
            }
            // Nascimento
            if (text.includes('nasc')) {
              setVal(inp, dataNascBr);
              return;
            }
            // CPF
            if (text.includes('cpf') || text.includes('titulocpf')) {
              setVal(inp, cpfFormatado);
              return;
            }
            // RG
            if (text.includes('rg') || text.includes('identidade')) {
              setVal(inp, cli.rg);
              return;
            }
            // Nome do Requerente/Cliente (por último, nunca se for mãe ou pai)
            if (text.includes('nome') || text.includes('eleitor') || text.includes('requerente')) {
              if (!text.includes('mae') && !text.includes('pai') && !text.includes('filiacao')) {
                setVal(inp, cli.nome);
                return;
              }
            }
          });

          return preenchidos;
        },
        args: [cliente]
      });

      const count = results && results[0] ? results[0].result : 0;
      concluirPreenchimento(count);
    } catch (e) {
      console.error('Falha na injeção direta:', e);
      btnPreencher.disabled = false;
      btnPreencher.innerHTML = '<span>⚡ Preencher Tela Atual</span>';
      alert('Certifique-se de que a aba do tribunal está selecionada e visível.');
    }
  }

  function concluirPreenchimento(count) {
    btnPreencher.disabled = false;
    if (count > 0) {
      btnPreencher.innerHTML = `<span>✓ ${count} Campos Preenchidos!</span>`;
    } else {
      btnPreencher.innerHTML = `<span>✓ Formulário Processado!</span>`;
    }
    setTimeout(() => {
      btnPreencher.innerHTML = '<span>⚡ Preencher Tela Atual</span>';
    }, 2500);
  }

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
