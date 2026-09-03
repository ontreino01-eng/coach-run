import { createClient } from 'jsr:@supabase/supabase-js@2';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const token = Deno.env.get('KIWIFY_WEBHOOK_TOKEN')!;
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if ((url.searchParams.get('token') || req.headers.get('x-kiwify-token')) !== token) return new Response('Assinatura inválida', { status: 401 });
    const body = await req.json();
    const status = body.order_status || body.status;
    if (status !== 'paid' && status !== 'approved') return new Response(JSON.stringify({ ok: true, skipped: 'status não aprovado' }), { status: 200, headers: cors });
    const customer = body.Customer || body.customer || {};
    const cpf = String(customer.cpf || '').replace(/\D/g, '');
    const email = String(customer.email || '').trim().toLowerCase();
    const telefone = phone(customer.phone || customer.telephone || customer.mobile || customer.phone_number);
    const orderId = body.order_id || body.id;
    if (!cpf || !email || telefone.length < 10) return new Response(JSON.stringify({ error: 'CPF, e-mail ou telefone ausente no payload' }), { status: 400, headers: cors });
    const { data: codeRow, error: codeError } = await admin.rpc('gen_license_code');
    if (codeError) throw codeError;
    const code = String(codeRow);
    const { error } = await admin.from('licenses').upsert({ cpf, email, telefone, code, kiwify_order_id: orderId, status: 'pendente', subscription_status: 'ativa' }, { onConflict: 'cpf' });
    if (error) throw error;
    const resend = Deno.env.get('RESEND_API_KEY');
    if (resend) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'PersonalCoach <acesso@seudominio.com>', to: email, subject: 'Seu acesso ao PersonalCoach', html: `<p>Pagamento confirmado.</p><p>Telefone usado na avaliação: ${telefone}</p><p>Código de acesso: <b>${code}</b></p><p>Acesse: https://ontreino01-eng.github.io/coach-run/</p><p>Use o telefone informado na avaliação e este código para ativar seu plano.</p>` }) });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  } catch (error) { console.error(error); return new Response(JSON.stringify({ error: 'Erro interno no webhook' }), { status: 500, headers: cors }); }
});
