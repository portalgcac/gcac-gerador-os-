// Portal G CAC - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Portal G CAC Extensão instalada com sucesso.');
});

// Escuta mensagens internas da extensão
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'salvar_cliente' && request.cliente) {
    chrome.storage.local.set({ gcac_cliente: request.cliente }, () => {
      sendResponse({ sucesso: true });
    });
    return true;
  }

  if (request.action === 'buscar_cliente_abas') {
    buscarClienteEmAbasAbertas().then((cliente) => {
      sendResponse({ cliente });
    });
    return true; // resposta assíncrona
  }
});

// Procura ativamente em todas as abas abertas se alguma tem o Portal G CAC com cliente ativo
async function buscarClienteEmAbasAbertas() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      // Abas com Portal G CAC
      const isCandidate = tab.url.includes('localhost') || 
                          tab.url.includes('vercel.app') || 
                          tab.url.includes('gcac') ||
                          (tab.title && tab.title.toLowerCase().includes('portal g cac'));

      if (isCandidate) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                return localStorage.getItem('gcac_cliente_certidao_ativa');
              } catch (e) {
                return null;
              }
            }
          });

          if (results && results[0] && results[0].result) {
            const cliente = JSON.parse(results[0].result);
            if (cliente && cliente.nome) {
              await chrome.storage.local.set({ gcac_cliente: cliente });
              return cliente;
            }
          }
        } catch (e) {
          // Permissão restrita ou aba de sistema
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar abas:', err);
  }
  return null;
}
