// Portal G CAC - Content Script Inteligente para Preenchimento de Certidões
(function () {
  'use strict';

  // 1. Detecta se está no Portal G CAC
  const isGcacPortal = window.location.hostname.includes('localhost') || 
                       window.location.hostname.includes('vercel.app') ||
                       window.location.hostname.includes('gcac') ||
                       document.title.toLowerCase().includes('portal g cac');

  if (isGcacPortal) {
    document.documentElement.setAttribute('data-gcac-ext', '1.1.0');

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

    // Escuta evento customizado do DOM
    window.addEventListener('gcac_set_cliente', (event) => {
      if (event.detail) sincronizarCliente(event.detail);
    });

    // Polling sutil para sincronizar do localStorage
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
        // Se ainda não estiver no storage, tenta consultar as outras abas abertas via background
        chrome.runtime.sendMessage({ action: 'buscar_cliente_abas' }, (resp) => {
          if (resp && resp.cliente) {
            criarBotaoFlutuante(resp.cliente);
          }
        });
      }
    });
  }

  iniciarNaPaginaExterna();

  // Escuta comandos vindos do popup da extensão
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

  // Cria botão flutuante discreto no canto inferior direito
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

  // Preenchimento de campos com suporte especial para TSE (Angular) e demais tribunais
  function preencherFormularioGeral(cliente) {
    if (!cliente) return 0;
    let preenchidos = 0;

    const cpfLimpo = (cliente.cpf || '').replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const rgFull = cliente.rg || '';
    const rgNumero = rgFull.replace(/[^\dXx]/g, '');

    let dataNascFormatada = '';
    let dataNascIso = '';
    if (cliente.dataNascimento) {
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
    // CASO ESPECÍFICO 1: TSE (Justiça Eleitoral - Angular Reactive Forms)
    // ─────────────────────────────────────────────────────────────
    const tseNome = document.querySelector('input[formcontrolname="nomeEleitor"]');
    if (tseNome) {
      atribuirValorNativo(tseNome, cliente.nome);
      destacarCampo(tseNome);
      preenchidos++;
    }

    const tseCpf = document.querySelector('input[formcontrolname="TituloCPF"]');
    if (tseCpf) {
      // TSE aceita tanto CPF formatado quanto unformatted
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
      if (cliente.nomeMae && cliente.nomePai) {
        tipo = 'UMA_MAE_UM_PAI';
      } else if (cliente.nomeMae && !cliente.nomePai) {
        tipo = 'UMA_MAE';
      } else if (!cliente.nomeMae && cliente.nomePai) {
        tipo = 'UM_PAI';
      } else {
        tipo = 'NAO_HA_REGISTRO';
      }
      atribuirValorSelect(tseSelectFiliacao, tipo);
      destacarCampo(tseSelectFiliacao);
      preenchidos++;

      // Aguarda o Angular renderizar os inputs dinâmicos
      setTimeout(() => {
        const tseMae = document.querySelector('input[formcontrolname="nomeMae"]') || document.getElementById('nomeMae');
        if (tseMae && cliente.nomeMae) {
          atribuirValorNativo(tseMae, cliente.nomeMae);
          destacarCampo(tseMae);
        }
        const tsePai = document.querySelector('input[formcontrolname="nomePai"]') || document.getElementById('nomePai');
        if (tsePai && cliente.nomePai) {
          atribuirValorNativo(tsePai, cliente.nomePai);
          destacarCampo(tsePai);
        }
      }, 100);
    }

    // ─────────────────────────────────────────────────────────────
    // CASO GERAL: DEMAIS TRIBUNAIS (TRF, TJ, STM, PF, POLÍCIA CIVIL)
    // ─────────────────────────────────────────────────────────────
    const mapCampos = [
      {
        alvos: ['cpf', 'num_cpf', 'nr_cpf', 'numcpf', 'documentocpf', 'nu_cpf', 'cpf_solicitante', 'titulocpf'],
        textosLabel: ['cpf', 'cadastro de pessoa', 'título eleitoral ou cpf'],
        valores: [cpfFormatado, cpfLimpo]
      },
      {
        alvos: ['nome', 'nome_completo', 'nomerequerente', 'requerente', 'nome_pessoa', 'interessado', 'no_pessoa', 'nm_pessoa', 'nomeeleitor'],
        textosLabel: ['nome', 'nome completo', 'requerente', 'interessado', 'nome do eleitor'],
        valores: [cliente.nome]
      },
      {
        alvos: ['rg', 'num_rg', 'nr_rg', 'identidade', 'doc_identidade', 'numero_rg'],
        textosLabel: ['rg', 'identidade', 'documento de identidade'],
        valores: [rgNumero, rgFull]
      },
      {
        alvos: ['orgao', 'orgao_emissor', 'orgao_expedidor', 'emissor_rg', 'ds_orgao_emissor'],
        textosLabel: ['órgão', 'orgao expedidor', 'emissor'],
        valores: [cliente.orgaoEmissor || 'SSP']
      },
      {
        alvos: ['data_nasc', 'nascimento', 'dtnascimento', 'dt_nasc', 'data_nascimento', 'dt_nascimento'],
        textosLabel: ['nascimento', 'data de nascimento', 'dt. nascimento', 'dia/mês/ano'],
        valores: [dataNascFormatada, dataNascIso]
      },
      {
        alvos: ['mae', 'nome_mae', 'nomemae', 'filiacao_mae', 'filiacao_materna', 'no_mae'],
        textosLabel: ['mãe', 'nome da mãe', 'filiação materna'],
        valores: [cliente.nomeMae || '']
      },
      {
        alvos: ['pai', 'nome_pai', 'nomepai', 'filiacao_pai', 'filiacao_paterna', 'no_pai'],
        textosLabel: ['pai', 'nome do pai', 'filiação paterna'],
        valores: [cliente.nomePai || '']
      },
      {
        alvos: ['cep', 'nu_cep', 'nr_cep', 'codigo_postal'],
        textosLabel: ['cep', 'código postal'],
        valores: [(cliente.cep || '').replace(/\D/g, ''), cliente.cep || '']
      },
      {
        alvos: ['endereco', 'logradouro', 'rua', 'ds_logradouro', 'ds_endereco'],
        textosLabel: ['endereço', 'endereco', 'logradouro', 'rua'],
        valores: [cliente.endereco || '']
      },
      {
        alvos: ['bairro', 'no_bairro', 'ds_bairro'],
        textosLabel: ['bairro'],
        valores: [cliente.bairro || '']
      },
      {
        alvos: ['municipio', 'cidade', 'no_municipio', 'no_cidade'],
        textosLabel: ['município', 'municipio', 'cidade'],
        valores: [cliente.cidade || '']
      },
      {
        alvos: ['uf', 'estado', 'sg_uf', 'uf_naturalidade'],
        textosLabel: ['uf', 'estado'],
        valores: [cliente.estado || 'GO']
      },
      {
        alvos: ['email', 'ds_email', 'correio_eletronico'],
        textosLabel: ['e-mail', 'email'],
        valores: [cliente.email || '']
      },
      {
        alvos: ['telefone', 'celular', 'contato', 'fone', 'nu_telefone'],
        textosLabel: ['telefone', 'celular', 'fone', 'whatsapp'],
        valores: [cliente.contato || '']
      }
    ];

    const todosInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'));

    todosInputs.forEach((input) => {
      if (input.offsetParent === null || input.disabled || input.readOnly) return;
      if (input.value && input.value.trim().length > 0) return; // Não sobrescreve se já tiver valor

      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const formControlName = (input.getAttribute('formcontrolname') || '').toLowerCase();

      let labelText = '';
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) labelText = (label.textContent || '').toLowerCase();
      }
      if (!labelText && input.closest('label')) {
        labelText = (input.closest('label').textContent || '').toLowerCase();
      }
      if (!labelText && input.parentElement) {
        labelText = (input.parentElement.textContent || '').toLowerCase();
      }

      for (const item of mapCampos) {
        const matchIdentificador = item.alvos.some(alvo => 
          id.includes(alvo) || 
          name.includes(alvo) || 
          placeholder.includes(alvo) || 
          ariaLabel.includes(alvo) ||
          formControlName.includes(alvo)
        );
        const matchLabel = item.textosLabel.some(termo => labelText.includes(termo));

        if (matchIdentificador || matchLabel) {
          const valorParaInserir = item.valores.find(v => !!v);
          if (valorParaInserir) {
            atribuirValorNativo(input, valorParaInserir);
            destacarCampo(input);
            preenchidos++;
            break;
          }
        }
      }
    });

    return preenchidos;
  }

  // Define valor com disparos de eventos para Angular, React, Vue e JS Puro
  function atribuirValorNativo(elemento, valor) {
    if (!elemento) return;
    elemento.focus();

    if (elemento.tagName === 'SELECT') {
      atribuirValorSelect(elemento, valor);
      return;
    }

    // Setter nativo para furar wrappers de framework reativo
    const prototype = elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(elemento, valor);
    } else {
      elemento.value = valor;
    }

    // Dispara cadeia completa de eventos nativos
    elemento.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    elemento.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    elemento.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    elemento.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  }

  function atribuirValorSelect(elemento, valor) {
    const valorNorm = valor.trim().toLowerCase();
    let encontrou = false;

    for (let i = 0; i < elemento.options.length; i++) {
      const opt = elemento.options[i];
      if (opt.value.toLowerCase() === valorNorm || opt.text.toLowerCase().includes(valorNorm)) {
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
