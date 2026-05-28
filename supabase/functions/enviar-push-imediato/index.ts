// Supabase Edge Function — Envio imediato de push notifications
// Executada sob demanda via requisição HTTP (invocação direta do client app)
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  empresa_id: string;
  endpoint: string;
  auth: string;
  p256dh: string;
}

// Configurar detalhes do VAPID para o envio de push
webpush.setVapidDetails(
  'mailto:contato@gcac.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ─── Enviar Push Criptografado ──────────────────────────────────────────────

async function enviarPush(sub: PushSubscription, titulo: string, corpo: string, url: string): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    };

    const payload = JSON.stringify({
      title: titulo,
      body: corpo,
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      data: { url },
      tag: `gcac-${Date.now()}`,
    });

    // Envia usando a biblioteca web-push (criptografia RFC 8291 automática)
    await webpush.sendNotification(pushSubscription, payload);
    return true;
  } catch (err: any) {
    console.error('Erro ao enviar push via web-push:', err);

    // Se o dispositivo foi desregistrado (Gone 404/410), remover do banco
    if (err.statusCode === 404 || err.statusCode === 410) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', sub.endpoint);
    }
    return false;
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { empresa_id, titulo, mensagem, link } = await req.json();

    if (!empresa_id || !titulo || !mensagem) {
      return new Response(
        JSON.stringify({ ok: false, erro: 'Parâmetros ausentes (empresa_id, titulo, mensagem são obrigatórios)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todas as subscriptions ativas para esta empresa
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('empresa_id, endpoint, auth, p256dh')
      .eq('empresa_id', empresa_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, enviados: 0, msg: 'Nenhuma assinatura de push ativa para esta empresa.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalEnviados = 0;
    for (const sub of subscriptions) {
      const sucesso = await enviarPush(sub, titulo, mensagem, link || '/');
      if (sucesso) totalEnviados++;
    }

    return new Response(
      JSON.stringify({ ok: true, enviados: totalEnviados, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Erro na Edge Function:', err);
    return new Response(
      JSON.stringify({ ok: false, erro: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
