// Ouvinte de eventos de push para receber notificações em segundo plano
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Alerta — Portal G CAC',
        body: event.data.text()
      };
    }
  }

  const title = data.title || 'Portal G CAC';
  const options = {
    body: data.body || 'Você tem uma nova notificação no sistema.',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    tag: data.tag || 'notificacao-sistema',
    data: data.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ação ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma aba aberta com a mesma URL, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const clientUrl = new URL(client.url, self.location.origin).pathname;
        const targetUrl = new URL(urlToOpen, self.location.origin).pathname;
        if (clientUrl === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova aba
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
