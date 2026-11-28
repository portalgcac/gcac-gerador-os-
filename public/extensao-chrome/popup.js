// Portal G CAC - Popup Script Avançado v1.2.0
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
  const btnLimparCliente = document.getElementById('btnLimparCliente');

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
      clientNasc.textContent = formatarData(cli.dataNascimento || cli.dataNascimentoBr) || '-';
      clientUf.textContent = cli.uf || cli.estado || 'GO';
    } else {
      clienteAtual = null;
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

  if (btnLimparCliente) {
    btnLimparCliente.addEventListener('click', () => {
      chrome.storage.local.remove(['gcac_cliente'], () => {
        renderizarCliente(null);
      });
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
          // Se o content script não responder, injeta via scripting
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
          const rgFull = cli.rg || '';
          const rgNumero = rgFull.replace(/[^\dXx]/g, '');
          const nomeMae = cli.nomeMae || cli.nome_mae || '';
          const nomePai = cli.nomePai || cli.nome_pai || '';
          const emailCli = cli.email || '';
          
          let dataNascBr = cli.dataNascimentoBr || '';
          let diaNasc = '', mesNasc = '', anoNasc = '';
          if (!dataNascBr && cli.dataNascimento) {
            const p = cli.dataNascimento.split('-');
            if (p.length === 3) {
              diaNasc = p[2]; mesNasc = p[1]; anoNasc = p[0];
              dataNascBr = `${diaNasc}/${mesNasc}/${anoNasc}`;
            }
          } else if (dataNascBr) {
            const p = dataNascBr.split('/');
            if (p.length === 3) {
              diaNasc = p[0]; mesNasc = p[1]; anoNasc = p[2];
            }
          }

          function setVal(el, val) {
            if (!el || val === undefined || val === null) return;
            try {
              el.focus();
              if (el.tagName === 'SELECT') {
                for (let i = 0; i < el.options.length; i++) {
                  if (norm(el.options[i].value) === norm(val) || norm(el.options[i].text).includes(norm(val))) {
                    el.selectedIndex = i;
                    break;
                  }
                }
              } else {
                const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) {
                  desc.set.call(el, val);
                } else {
                  el.value = val;
                }
              }

              try {
                el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
              } catch (e) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              el.style.borderColor = '#10b981';
              el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.35)';
              preenchidos++;
            } catch (err) {}
          }

          const host = window.location.hostname.toLowerCase();
          const href = window.location.href.toLowerCase();

          // 0. Gov.br Login
          if (host.includes('acesso.gov.br') || href.includes('acesso.gov.br')) {
            const govCpf = document.getElementById('accountId') || document.querySelector('input[name="accountId"]');
            if (govCpf && !govCpf.value) setVal(govCpf, cpfLimpo);
          }

          // 1. TSE Específico (Angular)
          const tseNome = document.querySelector('input[formcontrolname="nomeEleitor"]');
          if (tseNome && !tseNome.value) setVal(tseNome, cli.nome);

          const tseCpf = document.querySelector('input[formcontrolname="TituloCPF"]');
          if (tseCpf && !tseCpf.value) setVal(tseCpf, cpfLimpo);

          const tseNasc = document.querySelector('input[formcontrolname="dataNascimento"]') || document.getElementById('dataNascimento');
          if (tseNasc && !tseNasc.value) setVal(tseNasc, dataNascBr);

          const tseFiliacao = document.querySelector('select[formcontrolname="tipoFiliacao"]');
          if (tseFiliacao) {
            setVal(tseFiliacao, (nomeMae && nomePai) ? 'UMA_MAE_UM_PAI' : (nomeMae ? 'UMA_MAE' : 'UM_PAI'));
          }

          const tseMae = document.querySelector('input[formcontrolname="nomeMae"]') || document.getElementById('nomeMae');
          if (tseMae && !tseMae.value && nomeMae) setVal(tseMae, nomeMae);

          const tsePai = document.querySelector('input[formcontrolname="nomePai"]') || document.getElementById('nomePai');
          if (tsePai && !tsePai.value && nomePai) setVal(tsePai, nomePai);

          // 2. STM Sliced Inputs
          if (host.includes('stm.jus.br') || href.includes('stm.jus.br') || href.includes('ceneg')) {
            const stmNome = document.querySelector('input[name="txt_nome"]');
            if (stmNome && !stmNome.value) setVal(stmNome, cli.nome);

            const stmCpf1 = document.querySelector('input[name="txt_cpf1"]');
            const stmCpf2 = document.querySelector('input[name="txt_cpf2"]');
            const stmCpf3 = document.querySelector('input[name="txt_cpf3"]');
            const stmDv = document.querySelector('input[name="txt_dv"]');
            if (stmCpf1 && stmCpf2 && stmCpf3 && stmDv && !stmCpf1.value && cpfLimpo.length >= 11) {
              setVal(stmCpf1, cpfLimpo.slice(0, 3));
              setVal(stmCpf2, cpfLimpo.slice(3, 6));
              setVal(stmCpf3, cpfLimpo.slice(6, 9));
              setVal(stmDv, cpfLimpo.slice(9, 11));
            }

            const stmDia = document.querySelector('input[name="txt_dia"]');
            const stmMes = document.querySelector('input[name="txt_mes"]');
            const stmAno = document.querySelector('input[name="txt_ano"]');
            if (stmDia && stmMes && stmAno && !stmDia.value && diaNasc && mesNasc && anoNasc) {
              setVal(stmDia, diaNasc);
              setVal(stmMes, mesNasc);
              setVal(stmAno, anoNasc);
            }

            const stmMae = document.querySelector('input[name="txt_nome_mae"]');
            if (stmMae && !stmMae.value && nomeMae) setVal(stmMae, nomeMae);
          }

          // 3. TJSP / e-SAJ
          if (host.includes('esaj') || href.includes('sco/abrircadastro')) {
            const cdModelo = document.getElementById('cdModelo') || document.querySelector('[name="entity.cdModelo"]');
            if (cdModelo && !cdModelo.value) setVal(cdModelo, '6');

            const radioMasc = document.getElementById('flGeneroM');
            if (radioMasc && !radioMasc.checked) {
              radioMasc.checked = true;
              radioMasc.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const sajNome = document.getElementById('nmCadastroF') || document.querySelector('[name="entity.nmPesquisa"]');
            if (sajNome && !sajNome.value) setVal(sajNome, cli.nome);

            const sajCpf = document.getElementById('identity.nuCpfFormatado') || document.querySelector('[name="entity.nuCpfFormatado"]');
            if (sajCpf && !sajCpf.value) setVal(sajCpf, cpfFormatado);

            const sajRg = document.getElementById('identity.nuRgFormatado') || document.querySelector('[name="entity.nuRgFormatado"]');
            if (sajRg && !sajRg.value && rgFull) setVal(sajRg, rgNumero || rgFull);

            const sajMae = document.getElementById('nmMaeCadastro') || document.querySelector('[name="entity.nmMae"]');
            if (sajMae && !sajMae.value && nomeMae) setVal(sajMae, nomeMae);

            const sajPai = document.getElementById('nmPaiCadastro') || document.querySelector('[name="entity.nmPai"]');
            if (sajPai && !sajPai.value && nomePai) setVal(sajPai, nomePai);

            const sajNasc = document.getElementById('dataNascimento') || document.querySelector('[name="entity.dtNascimento"]');
            if (sajNasc && !sajNasc.value && dataNascBr) setVal(sajNasc, dataNascBr);

            const sajCheck = document.getElementById('confirmacaoInformacoes');
            if (sajCheck && !sajCheck.checked) {
              sajCheck.checked = true;
              sajCheck.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }

          // 4. SSP-GO Expresso
          if (host.includes('go.gov.br') || href.includes('antecedentes-criminais')) {
            const expNome = document.querySelector('[formcontrolname="nome"] input');
            if (expNome && !expNome.value) setVal(expNome, cli.nome);

            const expNasc = document.querySelector('[formcontrolname="dataNascimento"] input');
            if (expNasc && !expNasc.value && dataNascBr) setVal(expNasc, dataNascBr);

            const expCpf = document.querySelector('[formcontrolname="cpf"] input');
            if (expCpf && !expCpf.value) setVal(expCpf, cpfLimpo);

            const expMae = document.querySelector('[formcontrolname="nomeMae"] input');
            if (expMae && !expMae.value && nomeMae) setVal(expMae, nomeMae);

            const expPai = document.querySelector('[formcontrolname="nomePai"] input');
            if (expPai && !expPai.value && nomePai) setVal(expPai, nomePai);
          }

          // 5. Busca geral com prioridade estrita
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
            if (text.includes('cpf') || text.includes('titulocpf') || text.includes('accountid')) {
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
