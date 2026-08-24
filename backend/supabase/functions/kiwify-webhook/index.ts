// ══════════════════════════════════════════════════════════════
// Edge Function: kiwify-webhook
// Trata TODOS os eventos de assinatura mensal:
//  - compra_aprovada        → gera código de acesso (1ª compra)
//  - subscription_renewed   → estende o período por +30 dias
//  - subscription_late      → marca como atrasada (acesso pausa)
//  - subscription_canceled  → marca como cancelada (acesso pausa)
//  - compra_reembolsada / chargeback → revoga o acesso na hora
//
// Configure no Kiwify TODOS esses eventos no mesmo webhook (Configurações >
// Webhooks > Eventos): Compra Aprovada, Assinatura Renovada, Assinatura
// Atrasada, Assinatura Cancelada, Reembolso, Chargeback.
//
// Deploy: supabase functions deploy kiwify-webhook
// ══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const KIWIFY_TOKEN = Deno.env.get('KIWIFY_WEBHOOK_TOKEN')!;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const tokenFromKiwify = url.searchParams.get('token') || req.headers.get('x-kiwify-token');
    if (tokenFromKiwify !== KIWIFY_TOKEN) {
      return new Response('Assinatura inválida', { status: 401 });
    }

    const body = await req.json();

    // O Kiwify identifica o evento por um destes campos, dependendo da
    // integração — checamos os três formatos conhecidos por segurança.
    const eventType = body.webhook_event_type || body.event || body.type || '';
    const status = body.order_status || body.subscription_status || body.status || '';
    const cpf = (body.Customer?.CPF || body.Customer?.cpf || body.customer?.CPF || body.customer?.cpf || '').replace(/\D/g, '');
    const email = body.Customer?.email || body.customer?.email;
    const orderId = body.order_id || body.id;

    if (!cpf) {
      return new Response(JSON.stringify({ error: 'CPF ausente no payload — confira o evento no Kiwify > Ver logs' }), { status: 400 });
    }

    // ── Compra aprovada (1ª vez) — gera o código de acesso ──
    if (eventType === 'compra_aprovada' || status === 'paid' || status === 'approved') {
      if (!email) return new Response(JSON.stringify({ error: 'E-mail ausente no payload' }), { status: 400 });
      const { data: codeRow } = await supabase.rpc('gen_license_code');
      const code = codeRow as unknown as string;
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('licenses').upsert({
        cpf, email, code, kiwify_order_id: orderId, status: 'pendente',
        subscription_status: 'ativa', current_period_end: periodEnd,
      }, { onConflict: 'cpf' });
      if (error) throw error;

      const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PersonalCoach <acesso@seudominio.com>',
            to: email,
            subject: 'Seu acesso ao PersonalCoach chegou 🏃',
            html: `<p>Seu pagamento foi confirmado!</p>
                   <p>Código de acesso: <b>${code}</b></p>
                   <p>Cadastre-se em: <a href="https://ontreino01-eng.github.io/coach-run/">ontreino01-eng.github.io/coach-run/</a></p>
                   <p>Use o CPF cadastrado na compra + este código para liberar o app.</p>`,
          }),
        });
      }
      return new Response(JSON.stringify({ ok: true, code }), { status: 200 });
    }

    // ── Assinatura renovada — estende +30 dias e reativa se estava atrasada ──
    if (eventType === 'subscription_renewed') {
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('licenses')
        .update({ subscription_status: 'ativa', current_period_end: periodEnd })
        .eq('cpf', cpf);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, renewed: true }), { status: 200 });
    }

    // ── Pagamento atrasado — pausa o acesso até regularizar ──
    if (eventType === 'subscription_late') {
      const { error } = await supabase.from('licenses')
        .update({ subscription_status: 'atrasada' })
        .eq('cpf', cpf);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, late: true }), { status: 200 });
    }

    // ── Cancelamento, reembolso ou chargeback — revoga o acesso ──
    if (eventType === 'subscription_canceled' || eventType === 'compra_reembolsada' || eventType === 'chargeback') {
      const { error } = await supabase.from('licenses')
        .update({ subscription_status: 'cancelada' })
        .eq('cpf', cpf);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, canceled: true }), { status: 200 });
    }

    // Evento não tratado (ex: carrinho_abandonado, boleto_gerado) — ignora sem erro.
    return new Response(JSON.stringify({ ok: true, skipped: eventType || 'evento não reconhecido' }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
