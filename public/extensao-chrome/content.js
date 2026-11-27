// Portal G CAC - Content Script para Preenchimento Automático de Certidões
(function () {
  'use strict';

  // 1. Detecta e sincroniza com o Portal G CAC
  const isGcacPortal = window.location.hostname.includes('localhost') || 
                       window.location.hostname.includes('vercel.app') ||
                       document.title.toLowerCase().includes('portal g cac');

  if (isGcacPortal) {
    document.documentElement.setAttribute('data-gcac-ext', '1.0.0');
    
    // Anuncia que a extensão está instalada para a aplicação web
    window.postMessage({ type: 'GCAC_EXTENSION_INSTALLED', version: '1.0.0' }, '*');

    // Escuta atualizações enviadas pelo Portal G CAC
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'GCAC_SET_CLIENTE' && event.data.cliente) {
        chrome.storage.local.set({ gcac_cliente: event.data.cliente }, () => {
          mostrarToast(`✓ Extensão sincronizada com: ${event.data.cliente.nome}`, '#10b981');
        });
      }
    });

    // Sincroniza dados salvos no localStorage do portal
    try {
      const localData = localStorage.getItem('gcac_cliente_certidao_ativa');
      if (localData) {
        const cliente = JSON.parse(localData);
        chrome.storage.local.set({ gcac_cliente: cliente });
      }
    } catch (e) {}
    return;
  }

  // 2. Em portais externos (Tribunais, Portais Oficiais)
  chrome.storage.local.get(['gcac_cliente'], (result) => {
    const cliente = result.gcac_cliente;
    if (!cliente || !cliente.nome) return;

    criarBotaoFlutuante(cliente);
  });

  // Escuta comandos vindos do popup da extensão
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'preencher') {
      const total = preencherFormulario(request.cliente);
      sendResponse({ sucesso: true, camposPreenchidos: total });
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
      const total = preencherFormulario(cliente);
      if (total > 0) {
        mostrarToast(`✓ ${total} campos preenchidos com sucesso! Resolva o CAPTCHA e emita a certidão.`, '#10b981');
      } else {
        mostrarToast('Nenhum campo compatível identificado nesta tela. Verifique se o formulário está visível.', '#f59e0b');
      }
    });

    container.appendChild(btn);
    document.body.appendChild(container);
  }

  // Lógica inteligente de preenchimento de campos
  function preencherFormulario(cliente) {
    if (!cliente) return 0;

    const cpfLimpo = (cliente.cpf || '').replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    // Tratamento de RG
    const rgFull = cliente.rg || '';
    const rgNumero = rgFull.replace(/[^\dXx]/g, '');

    // Tratamento de Data
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

    const mapCampos = [
      {
        alvos: ['cpf', 'num_cpf', 'nr_cpf', 'numcpf', 'documentocpf', 'nu_cpf', 'cpf_solicitante'],
        textosLabel: ['cpf', 'cadastro de pessoa'],
        valores: [cpfFormatado, cpfLimpo]
      },
      {
        alvos: ['nome', 'nome_completo', 'nomerequerente', 'requerente', 'nome_pessoa', 'interessado', 'no_pessoa', 'nm_pessoa'],
        textosLabel: ['nome', 'nome completo', 'requerente', 'interessado'],
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
        textosLabel: ['nascimento', 'data de nascimento', 'dt. nascimento'],
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

    let preenchidos = 0;
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'));

    inputs.forEach((input) => {
      // Ignora campos invisíveis ou já preenchidos
      if (input.offsetParent === null || input.disabled || input.readOnly) return;

      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

      // Busca texto de label correspondente
      let labelText = '';
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) labelText = (label.textContent || '').toLowerCase();
      }
      if (!labelText && input.closest('label')) {
        labelText = (input.closest('label').textContent || '').toLowerCase();
      }

      for (const item of mapCampos) {
        const matchIdentificador = item.alvos.some(alvo => id.includes(alvo) || name.includes(alvo) || placeholder.includes(alvo) || ariaLabel.includes(alvo));
        const matchLabel = item.textosLabel.some(termo => labelText.includes(termo));

        if (matchIdentificador || matchLabel) {
          const valorParaInserir = item.valores.find(v => !!v);
          if (valorParaInserir) {
            atribuirValor(input, valorParaInserir);
            destacarCampo(input);
            preenchidos++;
            break;
          }
        }
      }
    });

    return preenchidos;
  }

  // Atribui valor simulando digitação real e eventos nativos do navegador
  function atribuirValor(elemento, valor) {
    elemento.focus();
    
    // Tratamento especial para tag SELECT
    if (elemento.tagName === 'SELECT') {
      const valorNorm = valor.trim().toLowerCase();
      for (let i = 0; i < elemento.options.length; i++) {
        const opt = elemento.options[i];
        if (opt.text.toLowerCase().includes(valorNorm) || opt.value.toLowerCase().includes(valorNorm)) {
          elemento.selectedIndex = i;
          break;
        }
      }
    } else {
      // Usa property descriptor para disparar listeners de frameworks reativos
      const nativeSetter = Object.getOwnPropertyDescriptor(
        elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(elemento, valor);
      } else {
        elemento.value = valor;
      }
    }

    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
    elemento.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Efeito visual sutil de sucesso no campo preenchido
  function destacarCampo(elemento) {
    const originalBorder = elemento.style.borderColor;
    const originalBoxShadow = elemento.style.boxShadow;

    elemento.style.borderColor = '#10b981';
    elemento.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';

    setTimeout(() => {
      elemento.style.borderColor = originalBorder;
      elemento.style.boxShadow = originalBoxShadow;
    }, 2500);
  }

  // Mostra notificação flutuante temporária
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
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
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
