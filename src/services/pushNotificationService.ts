import { supabase } from '../db/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/**
 * Converte a chave VAPID Base64 para Uint8Array (necessário para o browser)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/**
 * Verifica o status atual da permissão de notificação do browser
 */
export function verificarStatusPermissao(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Verifica se o browser suporta Push Notifications
 */
export function suportaPushNotification(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Detecta se é iOS (para exibir instrução de "Adicionar à Tela Inicial")
 */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detecta se está rodando como PWA instalado (standalone)
 */
export function isPWAInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

/**
 * Solicita permissão ao usuário e registra a subscription no Supabase.
 * Retorna true em caso de sucesso.
 */
export async function ativarNotificacoesPush(empresaId: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    if (!suportaPushNotification()) {
      return { sucesso: false, erro: 'Seu navegador não suporta notificações push.' };
    }

    // Solicitar permissão
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      return { sucesso: false, erro: 'Permissão negada pelo usuário.' };
    }

    // Obter service worker registrado
    const registration = await navigator.serviceWorker.ready;

    // Inscrever no Push Manager com a chave VAPID
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
    });

    const sub = subscription.toJSON();
    if (!sub.endpoint || !sub.keys?.auth || !sub.keys?.p256dh) {
      return { sucesso: false, erro: 'Falha ao gerar assinatura push.' };
    }

    // Salvar no Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        empresa_id: empresaId,
        endpoint: sub.endpoint,
        auth: sub.keys.auth,
        p256dh: sub.keys.p256dh,
        user_agent: navigator.userAgent,
      }, { onConflict: 'empresa_id,endpoint' });

    if (error) {
      console.error('Erro ao salvar subscription:', error);
      return { sucesso: false, erro: 'Erro ao salvar no servidor. Tente novamente.' };
    }

    return { sucesso: true };
  } catch (err: any) {
    console.error('Erro ao ativar push:', err);
    return { sucesso: false, erro: err.message || 'Erro desconhecido.' };
  }
}

/**
 * Cancela a subscription de push deste dispositivo
 */
export async function desativarNotificacoesPush(empresaId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('endpoint', endpoint);
    }
  } catch (err) {
    console.error('Erro ao desativar push:', err);
  }
}

/**
 * Verifica se este dispositivo já está inscrito no push
 */
export async function verificarSubscriptionAtiva(): Promise<boolean> {
  try {
    if (!suportaPushNotification()) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Envia uma notificação de TESTE local (sem servidor) para verificar que está funcionando
 */
export async function enviarNotificacaoTeste(): Promise<void> {
  const permissao = verificarStatusPermissao();
  if (permissao !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('🔔 Portal G CAC — Teste', {
    body: 'Notificações push ativadas com sucesso! Você receberá alertas de vencimentos aqui.',
    icon: '/LOGO CORRETA.png',
    badge: '/LOGO CORRETA.png',
    tag: 'teste-push',
    data: { url: '/' },
  });
}

/**
 * Dispara o envio imediato de uma push notification via Supabase Edge Function
 */
export async function dispararPushImediato(params: {
  empresaId: string;
  titulo: string;
  mensagem: string;
  link?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('enviar-push-imediato', {
      body: {
        empresa_id: params.empresaId,
        titulo: params.titulo,
        mensagem: params.mensagem,
        link: params.link || '/',
      },
    });
    if (error) {
      console.warn('Erro ao disparar push imediato via Edge Function:', error);
    }
  } catch (err) {
    console.error('Erro ao chamar a Edge Function de push:', err);
  }
}

