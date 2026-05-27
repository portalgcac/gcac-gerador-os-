// Supabase Edge Function — Envio diário de push notifications de vencimentos
// Executada via GitHub Actions todo dia às 09:00 (horário de Brasília)
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:contato@gcac.com.br';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PushSubscription {
  empresa_id: string;
  endpoint: string;
  auth: string;
  p256dh: string;
}

interface AlertaItem {
  tipo: string;
  label: string;
  diasRestantes: number;
  nivel: 'CRITICO' | 'AVISO' | 'VENCIDO';
}

// ─── Helpers VAPID ────────────────────────────────────────────────────────────

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
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
    // Tentar como raw se pkcs8 falhar
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

    // Criptografar o payload usando Web Push Encryption (RFC 8291)
    // Por simplicidade no Deno, enviamos sem encryption body (apenas headers VAPID)
    // Para produção completa, usar biblioteca web-push-deno
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

// ─── Verificar alertas de uma empresa ─────────────────────────────────────────

function calcularDias(dataVenc: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVenc);
  venc.setHours(0, 0, 0, 0);
  return Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
}

function nivelAlerta(tipo: string, dias: number): 'CRITICO' | 'AVISO' | 'VENCIDO' | null {
  if (dias < 0) return 'VENCIDO';

  const limites: Record<string, { aviso: number; critico: number }> = {
    CR:     { aviso: 60, critico: 30 },
    CRAF:   { aviso: 60, critico: 30 },
    GT:     { aviso: 20, critico: 7  },
    MANEJO: { aviso: 30, critico: 10 },
  };

  const l = limites[tipo] || { aviso: 30, critico: 15 };

  // Só notificar no DIA EXATO do limiar (evitar spam de repetição)
  if (dias === l.aviso) return 'AVISO';
  if (dias === l.critico) return 'CRITICO';
  if (dias === 1) return 'CRITICO'; // 1 dia antes sempre notifica
  if (dias === 0) return 'VENCIDO'; // Dia do vencimento

  return null;
}

async function buscarAlertasDaEmpresa(empresaId: string): Promise<AlertaItem[]> {
  const alertas: AlertaItem[] = [];

  // CR Exército
  const { data: clientes } = await supabase
    .from('clientes')
    .select('nome, vencimento_cr, vencimento_cr_ibama')
    .eq('empresa_id', empresaId);

  (clientes || []).forEach(c => {
    if (c.vencimento_cr) {
      const dias = calcularDias(c.vencimento_cr);
      const nivel = nivelAlerta('CR', dias);
      if (nivel) alertas.push({ tipo: 'CR', label: `CR Exército — ${c.nome}`, diasRestantes: dias, nivel });
    }
    if (c.vencimento_cr_ibama) {
      const dias = calcularDias(c.vencimento_cr_ibama);
      const nivel = nivelAlerta('CR', dias);
      if (nivel) alertas.push({ tipo: 'CR_IBAMA', label: `CR IBAMA — ${c.nome}`, diasRestantes: dias, nivel });
    }
  });

  // CRAFs
  const { data: armas } = await supabase
    .from('armas')
    .select('modelo, vencimento_craf')
    .eq('empresa_id', empresaId);

  (armas || []).forEach(a => {
    if (a.vencimento_craf) {
      const dias = calcularDias(a.vencimento_craf);
      const nivel = nivelAlerta('CRAF', dias);
      if (nivel) alertas.push({ tipo: 'CRAF', label: `CRAF — ${a.modelo}`, diasRestantes: dias, nivel });
    }
  });

  // Guias de Tráfego
  const { data: gts } = await supabase
    .from('guias_trafego')
    .select('tipo, vencimento, armas(modelo)')
    .eq('empresa_id', empresaId);

  (gts || []).forEach((g: any) => {
    if (g.vencimento) {
      const dias = calcularDias(g.vencimento);
      const nivel = nivelAlerta('GT', dias);
      const modelo = Array.isArray(g.armas) ? g.armas[0]?.modelo : g.armas?.modelo;
      if (nivel) alertas.push({ tipo: 'GT', label: `Guia de Tráfego ${g.tipo} — ${modelo || ''}`, diasRestantes: dias, nivel });
    }
  });

  // Manejos
  const { data: manejos } = await supabase
    .from('autorizacoes_manejo')
    .select('nome_fazenda, vencimento, status')
    .eq('empresa_id', empresaId)
    .neq('status', 'Inerte');

  (manejos || []).forEach(m => {
    if (m.vencimento) {
      const dias = calcularDias(m.vencimento);
      const nivel = nivelAlerta('MANEJO', dias);
      if (nivel) alertas.push({ tipo: 'MANEJO', label: `Manejo — ${m.nome_fazenda}`, diasRestantes: dias, nivel });
    }
  });

  return alertas;
}

function montarMensagem(alertas: AlertaItem[]): { titulo: string; corpo: string } {
  const vencidos = alertas.filter(a => a.nivel === 'VENCIDO');
  const criticos = alertas.filter(a => a.nivel === 'CRITICO');
  const avisos   = alertas.filter(a => a.nivel === 'AVISO');

  if (vencidos.length > 0) {
    return {
      titulo: `🚨 ${vencidos.length} documento(s) VENCIDO(S) — Portal G CAC`,
      corpo: vencidos.map(a => `• ${a.label}`).join('\n'),
    };
  }
  if (criticos.length > 0) {
    const a = criticos[0];
    const extra = criticos.length > 1 ? ` e mais ${criticos.length - 1}` : '';
    return {
      titulo: `⚠️ Vencimento urgente — Portal G CAC`,
      corpo: `${a.label} vence em ${a.diasRestantes} dia(s)${extra}`,
    };
  }
  const a = avisos[0];
  const extra = avisos.length > 1 ? ` (+${avisos.length - 1} aviso(s))` : '';
  return {
    titulo: `🔔 Alerta de vencimento — Portal G CAC`,
    corpo: `${a.label} vence em ${a.diasRestantes} dias${extra}`,
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    console.log('🔔 Iniciando envio de push notifications diárias...');

    // Buscar todas as subscriptions ativas
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('empresa_id, endpoint, auth, p256dh');

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, msg: 'Nenhuma subscription ativa.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Agrupar por empresa_id
    const porEmpresa = subscriptions.reduce((acc: Record<string, PushSubscription[]>, sub) => {
      if (!acc[sub.empresa_id]) acc[sub.empresa_id] = [];
      acc[sub.empresa_id].push(sub);
      return acc;
    }, {});

    let totalEnviados = 0;
    let totalEmpresas = 0;

    for (const [empresaId, subs] of Object.entries(porEmpresa)) {
      const alertas = await buscarAlertasDaEmpresa(empresaId);

      if (alertas.length === 0) {
        console.log(`✅ Empresa ${empresaId.substring(0, 8)}: sem alertas hoje.`);
        continue;
      }

      const { titulo, corpo } = montarMensagem(alertas);
      totalEmpresas++;

      for (const sub of subs) {
        const sucesso = await enviarPush(sub, titulo, corpo, '/');
        if (sucesso) totalEnviados++;
      }
    }

    console.log(`✅ Push enviados: ${totalEnviados} para ${totalEmpresas} empresa(s)`);

    return new Response(
      JSON.stringify({ ok: true, enviados: totalEnviados, empresas: totalEmpresas }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Erro na Edge Function:', err);
    return new Response(
      JSON.stringify({ ok: false, erro: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
