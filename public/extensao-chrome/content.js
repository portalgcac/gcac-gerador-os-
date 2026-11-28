// Portal G CAC - Content Script Inteligente para Preenchimento de Certidões v1.2.0
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
    document.documentElement.setAttribute('data-gcac-ext', '1.2.0');

    function sincronizarCliente(cliente) {
      if (!cliente || !cliente.nome) return;
      cliente.timestamp = cliente.timestamp || Date.now();
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

  // 2. Verifica se a página atual pertence a um portal oficial de certidão ou tribunal
  function ehSiteDeCertidaoOuOrgao() {
    const host = window.location.hostname.toLowerCase();
    const href = window.location.href.toLowerCase();
    const title = (document.title || '').toLowerCase();

    return host.includes('jus.br') ||
           host.includes('gov.br') ||
           host.includes('dpf.gov.br') ||
           host.includes('policiacivil') ||
           host.includes('ssp.') ||
           host.includes('pcdf.df.gov.br') ||
           host.includes('detran.rj.gov.br') ||
           host.includes('institutodeidentificacao') ||
           href.includes('antecedente') ||
           href.includes('certidao') ||
           href.includes('ceneg') ||
           href.includes('sco/abrircadastro') ||
           title.includes('certid') ||
           title.includes('antecedente') ||
           title.includes('acesso.gov.br');
  }

  // 3. Em portais externos
  function iniciarNaPaginaExterna() {
    chrome.storage.local.get(['gcac_cliente'], (result) => {
      let cliente = result.gcac_cliente;

      if (cliente && cliente.nome) {
        processarPaginaExterna(cliente);
      } else {
        chrome.runtime.sendMessage({ action: 'buscar_cliente_abas' }, (resp) => {
          if (resp && resp.cliente) {
            processarPaginaExterna(resp.cliente);
          }
        });
      }
    });
  }

  function processarPaginaExterna(cliente) {
    const relevante = ehSiteDeCertidaoOuOrgao();

    // Se NÃO for site de certidão/órgão oficial, NÃO polui a tela com o botão flutuante
    // (Apenas responde se o usuário clicar no popup da extensão)
    if (!relevante) return;

    // Cria o botão flutuante com opção de fechar/minimizar
    criarBotaoFlutuante(cliente);

    // Executa o PREENCHIMENTO AUTOMÁTICO de imediato!
    tentarAutoPreenchimento(cliente);
  }

  function tentarAutoPreenchimento(cliente) {
    // 1º disparo imediato / rápido
    setTimeout(() => {
      const preenchidos = preencherFormularioGeral(cliente);
      if (preenchidos > 0) {
        mostrarToast(`✓ Preenchimento automático: ${preenchidos} campos preenchidos com dados de ${cliente.nome}!`, '#10b981');
      }
    }, 600);

    // 2º disparo para formulários Angular / React que demoram a carregar
    setTimeout(() => {
      preencherFormularioGeral(cliente);
    }, 1800);

    // Observa mudanças dinâmicas no DOM (ex.: modal de autenticação do TSE ou carregamento tardio do TRF)
    observarMutacoesDOM(cliente);
  }

  let observerAtivo = null;
  function observarMutacoesDOM(cliente) {
    if (observerAtivo) return;
    try {
      observerAtivo = new MutationObserver((mutations) => {
        let precisaTentar = false;
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length > 0) {
            precisaTentar = true;
            break;
          }
        }
        if (precisaTentar) {
          preencherFormularioGeral(cliente);
        }
      });

      observerAtivo.observe(document.body, { childList: true, subtree: true });

      // Desconecta o observer após 25 segundos para não consumir CPU desnecessariamente
      setTimeout(() => {
        if (observerAtivo) {
          observerAtivo.disconnect();
          observerAtivo = null;
        }
      }, 25000);
    } catch (e) {}
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
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const widget = document.createElement('div');
    widget.style.cssText = `
      display: flex;
      align-items: center;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      transition: all 0.2s ease;
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">⚡</span>
        <div style="text-align:left;">
          <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Portal G CAC • Preenchimento</div>
          <div style="font-size:12px; font-weight:700; opacity:0.95; max-width:210px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${cliente.nome}
          </div>
        </div>
      </div>
    `;
    btn.style.cssText = `
      background: transparent;
      color: #ffffff;
      border: none;
      padding: 10px 14px;
      cursor: pointer;
      outline: none;
      font-family: inherit;
    `;

    btn.addEventListener('click', () => {
      const total = preencherFormularioGeral(cliente);
      if (total > 0) {
        mostrarToast(`✓ ${total} campos preenchidos com sucesso! Resolva o CAPTCHA para emitir.`, '#10b981');
      } else {
        mostrarToast('Formulário verificado. Campos preenchidos ou não localizados na tela.', '#f59e0b');
      }
    });

    // Botão de fechar (✕) para permitir ao usuário dispensar o botão
    const btnFechar = document.createElement('button');
    btnFechar.type = 'button';
    btnFechar.innerHTML = '✕';
    btnFechar.title = 'Fechar este botão';
    btnFechar.style.cssText = `
      background: rgba(0, 0, 0, 0.15);
      color: rgba(255, 255, 255, 0.8);
      border: none;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      padding: 14px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: bold;
      transition: background 0.2s ease;
      outline: none;
    `;
    btnFechar.addEventListener('mouseenter', () => {
      btnFechar.style.background = 'rgba(239, 68, 68, 0.8)';
      btnFechar.style.color = '#fff';
    });
    btnFechar.addEventListener('mouseleave', () => {
      btnFechar.style.background = 'rgba(0, 0, 0, 0.15)';
      btnFechar.style.color = 'rgba(255, 255, 255, 0.8)';
    });
    btnFechar.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
    });

    widget.appendChild(btn);
    widget.appendChild(btnFechar);
    container.appendChild(widget);
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
    const emailCli = cliente.email || '';

    let dataNascFormatada = cliente.dataNascimentoBr || '';
    let dataNascIso = '';
    let diaNasc = '', mesNasc = '', anoNasc = '';

    if (!dataNascFormatada && cliente.dataNascimento) {
      if (cliente.dataNascimento.includes('-')) {
        const parts = cliente.dataNascimento.split('-');
        if (parts.length === 3) {
          diaNasc = parts[2];
          mesNasc = parts[1];
          anoNasc = parts[0];
          dataNascFormatada = `${diaNasc}/${mesNasc}/${anoNasc}`;
          dataNascIso = `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
      } else if (cliente.dataNascimento.includes('/')) {
        dataNascFormatada = cliente.dataNascimento;
        const parts = cliente.dataNascimento.split('/');
        if (parts.length === 3) {
          diaNasc = parts[0];
          mesNasc = parts[1];
          anoNasc = parts[2];
          dataNascIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
    } else if (dataNascFormatada) {
      const parts = dataNascFormatada.split('/');
      if (parts.length === 3) {
        diaNasc = parts[0];
        mesNasc = parts[1];
        anoNasc = parts[2];
        dataNascIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const host = window.location.hostname.toLowerCase();
    const href = window.location.href.toLowerCase();

    // ─────────────────────────────────────────────────────────────
    // CASO 0: GOV.BR LOGIN (sso.acesso.gov.br / DPF Antecedentes)
    // ─────────────────────────────────────────────────────────────
    if (host.includes('acesso.gov.br') || href.includes('acesso.gov.br')) {
      const govCpf = document.getElementById('accountId') || 
                     document.querySelector('input[name="accountId"]') ||
                     document.querySelector('input[placeholder*="CPF" i]');
      if (govCpf && (!govCpf.value || govCpf.value.replace(/\D/g, '') !== cpfLimpo)) {
        atribuirValorNativo(govCpf, cpfLimpo);
        destacarCampo(govCpf);
        preenchidos++;

        const btnContinuar = document.getElementById('enter-account-id') || document.querySelector('.button-continuar');
        if (btnContinuar) {
          btnContinuar.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.4)';
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 1: TSE (Angular Reactive Forms - Quitação e Crimes)
    // ─────────────────────────────────────────────────────────────
    const tseNome = document.querySelector('input[formcontrolname="nomeEleitor"]');
    if (tseNome && !tseNome.value) {
      atribuirValorNativo(tseNome, cliente.nome);
      destacarCampo(tseNome);
      preenchidos++;
    }

    const tseCpf = document.querySelector('input[formcontrolname="TituloCPF"]');
    if (tseCpf && !tseCpf.value) {
      atribuirValorNativo(tseCpf, cpfLimpo);
      destacarCampo(tseCpf);
      preenchidos++;
    }

    const tseNasc = document.querySelector('input[formcontrolname="dataNascimento"]') || document.getElementById('dataNascimento');
    if (tseNasc && !tseNasc.value) {
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

    const tseMae = document.querySelector('input[formcontrolname="nomeMae"]') || document.getElementById('nomeMae');
    if (tseMae && !tseMae.value && nomeMae) {
      atribuirValorNativo(tseMae, nomeMae);
      destacarCampo(tseMae);
      preenchidos++;
    }

    const tsePai = document.querySelector('input[formcontrolname="nomePai"]') || document.getElementById('nomePai');
    if (tsePai && !tsePai.value && nomePai) {
      atribuirValorNativo(tsePai, nomePai);
      destacarCampo(tsePai);
      preenchidos++;
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 2: STM (Superior Tribunal Militar & Iframe www2.stm.jus.br)
    // ─────────────────────────────────────────────────────────────
    if (host.includes('stm.jus.br') || href.includes('stm.jus.br') || href.includes('ceneg')) {
      const stmNome = document.querySelector('input[name="txt_nome"]');
      if (stmNome && !stmNome.value) {
        atribuirValorNativo(stmNome, cliente.nome);
        destacarCampo(stmNome);
        preenchidos++;
      }

      const stmCpf1 = document.querySelector('input[name="txt_cpf1"]');
      const stmCpf2 = document.querySelector('input[name="txt_cpf2"]');
      const stmCpf3 = document.querySelector('input[name="txt_cpf3"]');
      const stmDv = document.querySelector('input[name="txt_dv"]');
      if (stmCpf1 && stmCpf2 && stmCpf3 && stmDv && !stmCpf1.value && cpfLimpo.length >= 11) {
        atribuirValorNativo(stmCpf1, cpfLimpo.slice(0, 3));
        atribuirValorNativo(stmCpf2, cpfLimpo.slice(3, 6));
        atribuirValorNativo(stmCpf3, cpfLimpo.slice(6, 9));
        atribuirValorNativo(stmDv, cpfLimpo.slice(9, 11));
        destacarCampo(stmCpf1);
        destacarCampo(stmDv);
        preenchidos++;
      }

      const stmDia = document.querySelector('input[name="txt_dia"]');
      const stmMes = document.querySelector('input[name="txt_mes"]');
      const stmAno = document.querySelector('input[name="txt_ano"]');
      if (stmDia && stmMes && stmAno && !stmDia.value && diaNasc && mesNasc && anoNasc) {
        atribuirValorNativo(stmDia, diaNasc);
        atribuirValorNativo(stmMes, mesNasc);
        atribuirValorNativo(stmAno, anoNasc);
        destacarCampo(stmDia);
        destacarCampo(stmAno);
        preenchidos++;
      }

      const stmMae = document.querySelector('input[name="txt_nome_mae"]');
      if (stmMae && !stmMae.value && nomeMae) {
        atribuirValorNativo(stmMae, nomeMae);
        destacarCampo(stmMae);
        preenchidos++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 3: TJSP / e-SAJ (TJSP, TJMS, TJAC, TJAM - Softplan e-SAJ)
    // ─────────────────────────────────────────────────────────────
    if (host.includes('esaj') || href.includes('sco/abrircadastro')) {
      const cdModelo = document.getElementById('cdModelo') || document.querySelector('[name="entity.cdModelo"]');
      if (cdModelo && !cdModelo.value) {
        atribuirValorSelect(cdModelo, '6'); // 6 = Certidão de Distribuição Criminal
        destacarCampo(cdModelo);
      }

      const radioMasc = document.getElementById('flGeneroM');
      if (radioMasc && !radioMasc.checked) {
        radioMasc.checked = true;
        radioMasc.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const sajNome = document.getElementById('nmCadastroF') || document.querySelector('[name="entity.nmPesquisa"]');
      if (sajNome && !sajNome.value) {
        atribuirValorNativo(sajNome, cliente.nome);
        destacarCampo(sajNome);
        preenchidos++;
      }

      const sajCpf = document.getElementById('identity.nuCpfFormatado') || document.querySelector('[name="entity.nuCpfFormatado"]');
      if (sajCpf && !sajCpf.value) {
        atribuirValorNativo(sajCpf, cpfFormatado);
        destacarCampo(sajCpf);
        preenchidos++;
      }

      const sajRg = document.getElementById('identity.nuRgFormatado') || document.querySelector('[name="entity.nuRgFormatado"]');
      if (sajRg && !sajRg.value && rgFull) {
        atribuirValorNativo(sajRg, rgNumero || rgFull);
        destacarCampo(sajRg);
        preenchidos++;
      }

      const sajMae = document.getElementById('nmMaeCadastro') || document.querySelector('[name="entity.nmMae"]');
      if (sajMae && !sajMae.value && nomeMae) {
        atribuirValorNativo(sajMae, nomeMae);
        destacarCampo(sajMae);
        preenchidos++;
      }

      const sajPai = document.getElementById('nmPaiCadastro') || document.querySelector('[name="entity.nmPai"]');
      if (sajPai && !sajPai.value && nomePai) {
        atribuirValorNativo(sajPai, nomePai);
        destacarCampo(sajPai);
        preenchidos++;
      }

      const sajNasc = document.getElementById('dataNascimento') || document.querySelector('[name="entity.dtNascimento"]');
      if (sajNasc && !sajNasc.value && dataNascFormatada) {
        atribuirValorNativo(sajNasc, dataNascFormatada);
        destacarCampo(sajNasc);
        preenchidos++;
      }

      const sajEmail = document.getElementById('identity.solicitante.deEmail') || document.querySelector('[name="entity.solicitante.deEmail"]');
      if (sajEmail && !sajEmail.value && emailCli) {
        atribuirValorNativo(sajEmail, emailCli);
        destacarCampo(sajEmail);
        preenchidos++;
      }

      const sajCheck = document.getElementById('confirmacaoInformacoes');
      if (sajCheck && !sajCheck.checked) {
        sajCheck.checked = true;
        sajCheck.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 4: TRF1 (Angular Material MDC - sistemas.trf1.jus.br)
    // ─────────────────────────────────────────────────────────────
    if (host.includes('trf1.jus.br') || href.includes('trf1.jus.br')) {
      const trfCpf = document.querySelector('input[formcontrolname="cpf"]');
      if (trfCpf && !trfCpf.value) {
        atribuirValorNativo(trfCpf, cpfLimpo);
        destacarCampo(trfCpf);
        preenchidos++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 5: SSP-GO / PCGO (Expresso Design System no go.gov.br)
    // ─────────────────────────────────────────────────────────────
    if (host.includes('go.gov.br') || href.includes('obter-atestado-de-antecedentes-criminais')) {
      const expNome = document.querySelector('[formcontrolname="nome"] input');
      if (expNome && !expNome.value) {
        atribuirValorNativo(expNome, cliente.nome);
        destacarCampo(expNome);
        preenchidos++;
      }

      const expNasc = document.querySelector('[formcontrolname="dataNascimento"] input');
      if (expNasc && !expNasc.value && dataNascFormatada) {
        atribuirValorNativo(expNasc, dataNascFormatada);
        destacarCampo(expNasc);
        preenchidos++;
      }

      const expCpf = document.querySelector('[formcontrolname="cpf"] input');
      if (expCpf && !expCpf.value) {
        atribuirValorNativo(expCpf, cpfLimpo);
        destacarCampo(expCpf);
        preenchidos++;
      }

      const expRg = document.querySelector('[formcontrolname="rgCivil"] input');
      if (expRg && !expRg.value && rgNumero) {
        atribuirValorNativo(expRg, rgNumero);
        destacarCampo(expRg);
        preenchidos++;
      }

      const expOrgao = document.querySelector('[formcontrolname="orgaoRgCivil"] input');
      if (expOrgao && !expOrgao.value) {
        atribuirValorNativo(expOrgao, cliente.orgaoEmissor || 'SSP');
        destacarCampo(expOrgao);
        preenchidos++;
      }

      const expMae = document.querySelector('[formcontrolname="nomeMae"] input');
      if (expMae && !expMae.value && nomeMae) {
        atribuirValorNativo(expMae, nomeMae);
        destacarCampo(expMae);
        preenchidos++;
      }

      const expPai = document.querySelector('[formcontrolname="nomePai"] input');
      if (expPai && !expPai.value && nomePai) {
        atribuirValorNativo(expPai, nomePai);
        destacarCampo(expPai);
        preenchidos++;
      }

      const expEmail = document.querySelector('[formcontrolname="email"] input');
      if (expEmail && !expEmail.value && emailCli) {
        atribuirValorNativo(expEmail, emailCli);
        destacarCampo(expEmail);
        preenchidos++;
      }
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
      if (fullText.includes('cpf') || fullText.includes('cadastro de pessoa') || fullText.includes('titulocpf') || fullText.includes('accountid')) {
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

      // 7. E-MAIL
      if (fullText.includes('email') || fullText.includes('correio eletronico')) {
        if (emailCli) {
          atribuirValorNativo(input, emailCli);
          destacarCampo(input);
          preenchidos++;
          return;
        }
      }

      // 8. CEP
      if (fullText.includes('cep') || fullText.includes('postal')) {
        atribuirValorNativo(input, (cliente.cep || '').replace(/\D/g, ''));
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 9. ENDEREÇO / LOGRADOURO
      if (fullText.includes('endereco') || fullText.includes('logradouro') || fullText.includes('rua')) {
        atribuirValorNativo(input, cliente.endereco || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 10. BAIRRO
      if (fullText.includes('bairro')) {
        atribuirValorNativo(input, cliente.bairro || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 11. MUNICÍPIO / CIDADE
      if (fullText.includes('municipio') || fullText.includes('cidade')) {
        atribuirValorNativo(input, cliente.cidade || '');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 12. UF / ESTADO
      if (fullText.includes('uf') || (fullText.includes('estado') && !fullText.includes('civil'))) {
        atribuirValorNativo(input, cliente.estado || cliente.uf || 'GO');
        destacarCampo(input);
        preenchidos++;
        return;
      }

      // 13. NOME DO CLIENTE / ELEITOR / REQUERENTE
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
    if (!elemento || valor === undefined || valor === null) return;
    try {
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

      // Dispara eventos com InputEvent para compatibilidade máxima com bibliotecas de máscara e Angular/React
      try {
        elemento.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: valor }));
      } catch (err) {
        elemento.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }

      elemento.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      elemento.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      elemento.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      elemento.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    } catch (e) {
      console.warn('Erro ao atribuir valor:', e);
    }
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
    }, 4000);
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
      max-width: 400px;
      line-height: 1.4;
      animation: gcacFadeIn 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
})();
