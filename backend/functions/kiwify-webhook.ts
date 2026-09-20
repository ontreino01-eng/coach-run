import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (value: unknown) => JSON.stringify(value);
const headers = { 'Content-Type': 'application/json' };
const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
const cpf = (value: unknown) => String(value || '').replace(/\D/g, '');

async function hmacSha1Hex(secret: string, rawBody: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function equalHex(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function sendActivationEmail(email: string, name: string, code: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { sent: false, error: 'RESEND_API_KEY não configurada' };
  const from = Deno.env.get('EMAIL_FROM') || 'Base do Corre <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: json({
      from,
      to: email,
      subject: 'Seu acesso ao Base do Corre',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>Pagamento confirmado, ${String(name || 'aluno').split(' ')[0]}!</h2><p>Seu código de ativação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:2px;text-align:center;background:#f2f2f2;padding:16px;border-radius:8px">${code}</p><p>Abra o app, escolha “Já comprei — Ativar meu acesso” e informe o telefone usado na avaliação junto com este código.</p><p><a href="https://ontreino01-eng.github.io/coach-run/">Abrir o Base do Corre</a></p></div>`,
    }),
  });
  if (!response.ok) return { sent: false, error: await response.text() };
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === 'HEAD') return new Response('ok', { status: 200 });
  if (req.method !== 'POST') return new Response(json({ error: 'Método não permitido' }), { status: 405, headers });

  try {
    const secret = Deno.env.get('KIWIFY_WEBHOOK_SECRET');
    if (!secret) return new Response(json({ error: 'Secret KIWIFY_WEBHOOK_SECRET não configurado' }), { status: 500, headers });

    const rawBody = await req.text();
    const signature = new URL(req.url).searchParams.get('signature') || '';
    const expected = await hmacSha1Hex(secret, rawBody);
    if (!equalHex(signature, expected)) return new Response(json({ error: 'Assinatura inválida' }), { status: 401, headers });

    const body = JSON.parse(rawBody);
    const event = String(body.webhook_event_type || '');
    const orderStatus = String(body.order_status || '');
    const orderId = String(body.order_id || '');
    const customer = body.Customer || body.customer || {};
    const email = normalize(customer.email);
    const telefone = phone(customer.mobile || customer.phone || customer.telephone);
    const buyerCpf = cpf(customer.CPF || customer.cpf);
    const productId = String(body.Product?.product_id || '');
    const allowedProductId = Deno.env.get('KIWIFY_PRODUCT_ID') || '';

    if (!orderId || !email) return new Response(json({ error: 'order_id ou Customer.email ausente' }), { status: 400, headers });
    if (allowedProductId && productId !== allowedProductId) return new Response(json({ ok: true, ignored: 'produto não autorizado' }), { status: 200, headers });

    const isPaid = orderStatus === 'paid' || event === 'order_approved' || event === 'subscription_renewed';
    const isRevoked = ['order_refunded', 'chargeback', 'subscription_canceled', 'subscription_late'].includes(event);

    if (!isPaid && !isRevoked) return new Response(json({ ok: true, ignored: event || orderStatus || 'evento sem ação' }), { status: 200, headers });

    const { data: existingOrder, error: existingError } = await admin
      .from('payment_orders')
      .select('id,lead_id,email,telefone,cpf,license_id,status,provider')
      .eq('provider', 'kiwify')
      .eq('order_nsu', orderId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (isRevoked) {
      if (existingOrder?.license_id) {
        await admin.from('licenses').update({ status: 'bloqueado', subscription_status: event === 'subscription_canceled' ? 'cancelada' : 'cancelada' }).eq('id', existingOrder.license_id);
      }
      return new Response(json({ ok: true, action: 'access_revoked', event }), { status: 200, headers });
    }

    if (existingOrder?.status === 'paid' && existingOrder.license_id) {
      await admin.from('licenses').update({ subscription_status: 'ativa', current_period_end: body.Subscription?.next_payment || body.Subscription?.customer_access?.access_until || null }).eq('id', existingOrder.license_id);
      return new Response(json({ ok: true, already_processed: true }), { status: 200, headers });
    }

    // O vínculo é feito pelo e-mail/telefone do aluno usado na avaliação.
    // O CPF do checkout é tratado apenas como dado do pedido/pagador.
    const leadQuery = admin.from('leads').select('id,nome,email,telefone').not('assessment', 'is', null).order('created_at', { ascending: false }).limit(1);
    const { data: leads, error: leadError } = await leadQuery;
    if (leadError) throw leadError;
    const lead = (leads || []).find((item: any) => normalize(item.email) === email || (telefone && phone(item.telefone) === telefone));
    if (!lead) return new Response(json({ error: 'Compra recebida, mas não encontrei avaliação correspondente para este e-mail/telefone' }), { status: 409, headers });

    const { data: codeRow, error: codeError } = await admin.rpc('gen_license_code');
    if (codeError) throw codeError;
    const code = String(codeRow);
    const end = body.Subscription?.next_payment || body.Subscription?.customer_access?.access_until || new Date(Date.now() + 30 * 86400000).toISOString();
    const orderAmount = Number(body.Commissions?.charge_amount || body.Commissions?.product_base_price || 0);

    const { data: license, error: licenseError } = await admin.from('licenses').insert({
      cpf: buyerCpf || `KIWIFY-${orderId}`,
      email,
      telefone: phone(lead.telefone) || telefone,
      code,
      status: 'pendente',
      subscription_status: 'ativa',
      current_period_end: end,
      payment_provider: 'kiwify',
      payment_order_id: orderId,
    }).select('id').single();
    if (licenseError) throw licenseError;

    const { error: orderError } = await admin.from('payment_orders').insert({
      lead_id: lead.id,
      provider: 'kiwify',
      order_nsu: orderId,
      email,
      telefone: phone(lead.telefone) || telefone,
      cpf: buyerCpf || `KIWIFY-${orderId}`,
      nome: lead.nome || customer.full_name || '',
      amount: orderAmount,
      status: 'paid',
      transaction_nsu: orderId,
      paid_at: new Date().toISOString(),
      license_id: license.id,
    });
    if (orderError) throw orderError;

    const emailResult = await sendActivationEmail(email, lead.nome || customer.full_name || 'aluno', code);
    await admin.from('payment_orders').update(emailResult.sent ? { activation_email_sent_at: new Date().toISOString() } : { activation_email_error: emailResult.error }).eq('order_nsu', orderId).eq('provider', 'kiwify');

    return new Response(json({ ok: true, action: 'license_created', email_sent: emailResult.sent }), { status: 200, headers });
  } catch (error) {
    console.error(error);
    return new Response(json({ error: 'Erro interno ao processar webhook Kiwify' }), { status: 500, headers });
  }
});
