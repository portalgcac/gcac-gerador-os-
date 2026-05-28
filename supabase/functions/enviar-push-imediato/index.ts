// Supabase Edge Function — Envio imediato de push notifications
// Executada sob demanda via requisição HTTP (invocação direta do client app)
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:contato@gcac.com.br';

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

// ─── Helpers VAPID ────────────────────────────────────────────────────────────

function base64UrlToUint8Array(base64String: string): Uint8Array {
  // Limpar cabeçalhos PEM, rodapés, quebras de linha e espaços em branco
  const cleanBase64 = base64String
    .replace(/-----BEGIN[^-]*-----/, '')
    .replace(/-----END[^-]*-----/, '')
    .replace(/\s/g, '');

  const padding = '='.repeat((4 - (cleanBase64.length % 4)) % 4);
  const base64 = (cleanBase64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function criarJwtVapid(audience: string): Promise<string> {
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(async () => {
    // Se falhar como pkcs8 direta (geralmente chave bruta de 32 bytes),
    // envolvemos a chave bruta de 32 bytes no cabeçalho ASN.1 PKCS#8 apropriado para EC P-256.
    if (privateKeyBytes.length === 32) {
      const pkcs8Header = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 
        0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 
        0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
      ]);
      const pkcs8Bytes = new Uint8Array(pkcs8Header.length + privateKeyBytes.length);
      pkcs8Bytes.set(pkcs8Header, 0);
      pkcs8Bytes.set(privateKeyBytes, pkcs8Header.length);

      return await crypto.subtle.importKey(
        'pkcs8',
        pkcs8Bytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
    }

    // Fallback genérico caso não seja de 32 bytes (levantará erro apropriado)
    return await crypto.subtle.importKey(
      'raw',
      privateKeyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  });


  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encodedHeader = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = uint8ArrayToBase64Url(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

// ─── Enviar Push ──────────────────────────────────────────────────────────────

async function enviarPush(sub: PushSubscription, titulo: string, corpo: string, url: string): Promise<boolean> {
  try {
    const endpoint = sub.endpoint;
    const urlObj = new URL(endpoint);
    const audience = `${urlObj.protocol}//${urlObj.host}`;

    const jwt = await criarJwtVapid(audience);

    const payload = JSON.stringify({
      title: titulo,
      body: corpo,
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      data: { url },
      tag: `gcac-${Date.now()}`,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        'TTL': '86400',
      },
      body: payload,
    });

    if (!response.ok && response.status !== 201 && response.status !== 202) {
      console.warn(`Push failed for endpoint (status ${response.status}):`, endpoint.substring(0, 50));

      // Se retornar 404/410, o dispositivo foi desregistrado → remover do banco
      if (response.status === 404 || response.status === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao enviar push:', err);
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
