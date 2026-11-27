// Portal G CAC - Content Script Inteligente para Preenchimento de Certidões
(function () {
  'use strict';

  function normalizar(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  // 1. Detecta se está no Portal G CAC
  const isGcacPortal = window.location.hostname.includes('localhost') || 
                       window.location.hostname.includes('vercel.app') ||
                       window.location.hostname.includes('gcac') ||
                       document.title.toLowerCase().includes('portal g cac');

  if (isGcacPortal) {
    document.documentElement.setAttribute('data-gcac-ext', '1.1.1');

    function sincronizarCliente(cliente) {
      if (!cliente || !cliente.nome) return;
      chrome.storage.local.set({ gcac_cliente: cliente }, () => {
        mostrarToast(`✓ Sincronizado com Portal G CAC: ${cliente.nome}`, '#10b981');
      });
      chrome.runtime.sendMessage({ action: 'salvar_cliente', cliente });
    }

    // Escuta eventos via postMessage
    window.addEventListener('message', (event) => {
      if (!event.data) return;
      if (event.data.type === 'PORTAL_GCAC_CLIENTE_ATIVO' && (event.data.payload || event.data.cliente)) {
        sincronizarCliente(event.data.payload || event.data.cliente);
      } else if (event.data.type === 'GCAC_SET_CLIENTE' && event.data.cliente) {
        sincronizarCliente(event.data.cliente);
      }
    });

    window.addEventListener('gcac_set_cliente', (event) => {
      if (event.detail) sincronizarCliente(event.detail);
    });

    setInterval(() => {
      try {
        const raw = localStorage.getItem('gcac_cliente_certidao_ativa');
        if (raw) {
          const cli = JSON.parse(raw);
          if (cli && cli.nome) {
            chrome.storage.local.get(['gcac_cliente'], (res) => {
              if (!res.gcac_cliente || res.gcac_cliente.id !== cli.id || res.gcac_cliente.timestamp !== cli.timestamp) {
                sincronizarCliente(cli);
              }
            });
          }
        }
      } catch (e) {}
    }, 1500);

    return;
  }

  // 2. Em portais externos de Tribunais e Órgãos Oficiais
  function iniciarNaPaginaExterna() {
    chrome.storage.local.get(['gcac_cliente'], (result) => {
      let cliente = result.gcac_cliente;

      if (cliente && cliente.nome) {
        criarBotaoFlutuante(cliente);
      } else {
        chrome.runtime.sendMessage({ action: 'buscar_cliente_abas' }, (resp) => {
          if (resp && resp.cliente) {
            criarBotaoFlutuante(resp.cliente);
          }
        });
      }
    });
  }

  iniciarNaPaginaExterna();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'preencher') {
      const cliente = request.cliente;
      if (cliente) {
        const total = preencherFormularioGeral(cliente);
        sendResponse({ sucesso: true, camposPreenchidos: total });
      } else {
        sendResponse({ sucesso: false, erro: 'Sem cliente ativo' });
      }
    }
  });

  function criarBotaoFlutuante(cliente) {
    if (document.getElementById('gcac-floating-btn')) return;

    const container = document.createElement('div');
    container.id = 'gcac-floating-btn';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">⚡</span>
        <div style="text-align:left;">
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Preencher com Portal G CAC</div>
          <div style="font-size:12px; font-weight:600; opacity:0.9; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${cliente.nome}
          </div>
        </div>
      </div>
    `;
    btn.style.cssText = `
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 10px 16px;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      outline: none;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 14px 28px -4px rgba(16, 185, 129, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.5)';
    });

    btn.addEventListener('click', () => {
      const total = preencherFormularioGeral(cliente);
      if (total > 0) {
        mostrarToast(`✓ ${total} campos preenchidos com sucesso! Resolva o CAPTCHA e emita a certidão.`, '#10b981');
      } else {
        mostrarToast('Verifique se o formulário do órgão está aberto na tela.', '#f59e0b');
      }
    });

    container.appendChild(btn);
    document.body.appendChild(container);
  }

  function preencherFormularioGeral(cliente) {
    if (!cliente) return 0;
    let preenchidos = 0;

    const cpfLimpo = (cliente.cpf || '').replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const rgFull = cliente.rg || '';
    const rgNumero = rgFull.replace(/[^\dXx]/g, '');

    const nomeMae = cliente.nomeMae || cliente.nome_mae || '';
    const nomePai = cliente.nomePai || cliente.nome_pai || '';

    let dataNascFormatada = cliente.dataNascimentoBr || '';
    let dataNascIso = '';
    if (!dataNascFormatada && cliente.dataNascimento) {
      if (cliente.dataNascimento.includes('-')) {
        const parts = cliente.dataNascimento.split('-');
        if (parts.length === 3) {
          dataNascFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
          dataNascIso = `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
      } else if (cliente.dataNascimento.includes('/')) {
        dataNascFormatada = cliente.dataNascimento;
        const parts = cliente.dataNascimento.split('/');
        if (parts.length === 3) {
          dataNascIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASO ESPECÍFICO 1: TSE (Angular Reactive Forms com Seletores Exatos)
    // ─────────────────────────────────────────────────────────────
    const tseNome = document.querySelector('input[formcontrolname="nomeEleitor"]');
    if (tseNome) {
      atribuirValorNativo(tseNome, cliente.nome);
      destacarCampo(tseNome);
      preenchidos++;
    }

    const tseCpf = document.querySelector('input[formcontrolname="TituloCPF"]');
    if (tseCpf) {
      atribuirValorNativo(tseCpf, cpfLimpo);
      destacarCampo(tseCpf);
      preenchidos++;
    }

    const tseNasc = document.querySelector('input[formcontrolname="dataNascimento"]') || document.getElementById('dataNascimento');
    if (tseNasc) {
      atribuirValorNativo(tseNasc, dataNascFormatada);
      destacarCampo(tseNasc);
      preenchidos++;
    }

    const tseSelectFiliacao = document.querySelector('select[formcontrolname="tipoFiliacao"]');
    if (tseSelectFiliacao) {
      let tipo = 'UMA_MAE_UM_PAI';
      if (nomeMae && nomePai) {
        tipo = 'UMA_MAE_UM_PAI';
      } else if (nomeMae && !nomePai) {
        tipo = 'UMA_MAE';
      } else if (!nomeMae && nomePai) {
        tipo = 'UM_PAI';
      } else {
        tipo = 'NAO_HA_REGISTRO';
      }
      atribuirValorSelect(tseSelectFiliacao, tipo);
      destacarCampo(tseSelectFiliacao);
      preenchidos++;
    }

    // Preenche campos de Mãe e Pai do TSE
    const tseMae = document.querySelector('input[formcontrolname="nomeMae"]') || document.getElementById('nomeMae');
    if (tseMae) {
      atribuirValorNativo(tseMae, nomeMae);
      destacarCampo(tseMae);
      preenchidos++;
    }

    const tsePai = document.querySelector('input[formcontrolname="nomePai"]') || document.getElementById('nomePai');
    if (tsePai) {
      atribuirValorNativo(tsePai, nomePai);
      destacarCampo(tsePai);
      preenchidos++;
    }

    // ─────────────────────────────────────────────────────────────
    // CASO GERAL: DEMAIS TRIBUNAIS (TRF, TJ, STM, PF, POLÍCIA CIVIL)
    // ORDEM ESTRITA: MÃE E PAI PRIMEIRO, NOME DO CLIENTE POR ÚLTIMO
    // ─────────────────────────────────────────────────────────────
    const todosInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'));

    todosInputs.forEach((input) => {
      if (input.offsetParent === null || input.disabled || input.readOnly) return;
      if (input.value && input.value.trim().length > 0) return;

      const id = normalizar(input.id);
      const name = normalizar(input.name);
      const placeholder = normalizar(input.getAttribute('placeholder'));
      const ariaLabel = normalizar(input.getAttribute('aria-label'));
      const formControlName = normalizar(input.getAttribute('formcontrolname'));

      let labelText = '';
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) labelText = normalizar(label.textContent);
      }
      if (!labelText && input.closest('label')) {
        labelText = normalizar(input.closest('label').textContent);
      }
      if (!labelText && input.parentElement) {
        labelText = normalizar(input.parentElement.textContent);
      }

      const fullText = `${id} ${name} ${placeholder} ${ariaLabel} ${formControlName} ${labelText}`;

      // 1. MÃE / FILIAÇÃO MATERNA (PRIORIDADE MÁXIMA)
      if (fullText.includes('mae') || fullText.includes('materna')) {
        if (nomeMae) {
          atribuirValorNativo(input, nomeMae);
          destacarCampo(input);
          preenchidos++;
        }
        return;
      }

      // 2. PAI / FILIAÇÃO PATERNA (PRIORIDADE MÁXIMA)
      if (fullText.includes('pai') || fullText.includes('paterna')) {
        if (nomePai) {
          atribuirValorNativo(input, nomePai);
          destacarCampo(input);
          preenchidos++;
        }
        return;
      }

      // 3. DATA DE NASCIMENTO
      if (fullText.includes('nasc') || fullText.includes('aniversario') || fullText.includes('dtnascimento')) {
        if (input.type === 'date') {
          atribuirValorNativo(input, dataNascIso || dataNascFormatada);
        } else {
          atribuirValorNativo(input, dataNascFormatada);
        }
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 4. CPF
      if (fullText.includes('cpf') || fullText.includes('cadastro de pessoa') || fullText.includes('titulocpf')) {
        const valCpf = (input.maxLength === 11 || input.getAttribute('mask') === '00000000000') ? cpfLimpo : cpfFormatado;
        atribuirValorNativo(input, valCpf);
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 5. RG
      if (fullText.includes('rg') || fullText.includes('identidade')) {
        if (!fullText.includes('orgao') && !fullText.includes('emissor') && !fullText.includes('expedidor')) {
          atribuirValorNativo(input, rgNumero || rgFull);
          destacarCampo(input);
          preenchidos++;
          return;
        }
      }

      // 6. ÓRGÃO EXPEDIDOR
      if (fullText.includes('orgao') || fullText.includes('emissor') || fullText.includes('expedidor')) {
        atribuirValorNativo(input, cliente.orgaoEmissor || 'SSP');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 7. CEP
      if (fullText.includes('cep') || fullText.includes('postal')) {
        atribuirValorNativo(input, (cliente.cep || '').replace(/\D/g, ''));
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 8. ENDEREÇO / LOGRADOURO
      if (fullText.includes('endereco') || fullText.includes('logradouro') || fullText.includes('rua')) {
        atribuirValorNativo(input, cliente.endereco || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 9. BAIRRO
      if (fullText.includes('bairro')) {
        atribuirValorNativo(input, cliente.bairro || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 10. MUNICÍPIO / CIDADE
      if (fullText.includes('municipio') || fullText.includes('cidade')) {
        atribuirValorNativo(input, cliente.cidade || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 11. UF / ESTADO
      if (fullText.includes('uf') || (fullText.includes('estado') && !fullText.includes('civil'))) {
        atribuirValorNativo(input, cliente.estado || cliente.uf || 'GO');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 12. NOME DO CLIENTE / ELEITOR / REQUERENTE
      // REGRA DE OURO: SÓ PREENCHE SE NÃO FOR MÃE, NÃO FOR PAI E NÃO FOR FILIAÇÃO
      if (fullText.includes('nome') || fullText.includes('requerente') || fullText.includes('interessado') || fullText.includes('eleitor')) {
        if (!fullText.includes('mae') && !fullText.includes('pai') && !fullText.includes('filiacao')) {
          atribuirValorNativo(input, cliente.nome);
          destacarCampo(input);
          preenchidos++;
          return;
        }
      }
    });

    return preenchidos;
  }

  function atribuirValorNativo(elemento, valor) {
    if (!elemento || !valor) return;
    elemento.focus();

    if (elemento.tagName === 'SELECT') {
      atribuirValorSelect(elemento, valor);
      return;
    }

    const prototype = elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(elemento, valor);
    } else {
      elemento.value = valor;
    }

    elemento.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    elemento.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    elemento.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  }

  function atribuirValorSelect(elemento, valor) {
    const valorNorm = normalizar(valor);
    let encontrou = false;

    for (let i = 0; i < elemento.options.length; i++) {
      const opt = elemento.options[i];
      if (normalizar(opt.value) === valorNorm || normalizar(opt.text).includes(valorNorm)) {
        elemento.selectedIndex = i;
        encontrou = true;
        break;
      }
    }

    if (!encontrou) {
      elemento.value = valor;
    }

    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
    elemento.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function destacarCampo(elemento) {
    const originalBorder = elemento.style.borderColor;
    const originalBoxShadow = elemento.style.boxShadow;

    elemento.style.borderColor = '#10b981';
    elemento.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.35)';

    setTimeout(() => {
      elemento.style.borderColor = originalBorder;
      elemento.style.boxShadow = originalBoxShadow;
    }, 3000);
  }

  function mostrarToast(mensagem, cor) {
    const antigo = document.getElementById('gcac-toast-msg');
    if (antigo) antigo.remove();

    const toast = document.createElement('div');
    toast.id = 'gcac-toast-msg';
    toast.textContent = mensagem;
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background-color: #111827;
      color: #ffffff;
      border-left: 4px solid ${cor || '#10b981'};
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      z-index: 2147483647;
      max-width: 380px;
      line-height: 1.4;
      animation: gcacFadeIn 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
})();
