// ══════════════════════════════════════════════════════════════
// Edge Function: kiwify-webhook
// Recebe o evento de compra aprovada do Kiwify, gera um código de
// acesso ligado ao CPF do comprador e devolve pro Kiwify confirmar.
//
// Deploy: supabase functions deploy kiwify-webhook
// Configurar no Kiwify: Configurações > Webhooks > URL =
//   https://SEU-PROJETO.supabase.co/functions/v1/kiwify-webhook
//
// IMPORTANTE: o Kiwify manda um "token" de assinatura no payload
// (campo varia conforme a integração — confira na documentação do
// Kiwify em Configurações > Webhooks). Guarde esse token como
// secret KIWIFY_WEBHOOK_TOKEN e valide abaixo antes de confiar no
// payload — sem isso, qualquer um pode forjar uma "compra aprovada".
// ══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role: ignora RLS, só existe no servidor
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

    // Ajuste estes caminhos conforme o payload real do Kiwify
    // (confira em Kiwify > Webhooks > "Ver exemplo de payload").
    const status = body.order_status || body.status;
    const cpf = (body.Customer?.cpf || body.customer?.cpf || '').replace(/\D/g, '');
    const email = body.Customer?.email || body.customer?.email;
    const orderId = body.order_id || body.id;

    if (status !== 'paid' && status !== 'approved') {
      return new Response(JSON.stringify({ ok: true, skipped: 'status não aprovado' }), { status: 200 });
    }
    if (!cpf || !email) {
      return new Response(JSON.stringify({ error: 'CPF ou e-mail ausente no payload' }), { status: 400 });
    }

    // Gera o código (a função gen_license_code() está no banco — ver supabase_schema.sql)
    const { data: codeRow } = await supabase.rpc('gen_license_code');
    const code = codeRow as unknown as string;

    const { error } = await supabase.from('licenses').upsert({
      cpf, email, code, kiwify_order_id: orderId, status: 'pendente',
    }, { onConflict: 'cpf' });

    if (error) throw error;

    // Envio do e-mail com o link de cadastro + código.
    // Recomendado: Resend (resend.com) — free tier cobre a maioria dos lançamentos.
    // Troque RESEND_API_KEY nos secrets e o domínio remetente abaixo.
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CoachEndurance <acesso@seudominio.com>',
          to: email,
          subject: 'Seu acesso ao CoachEndurance chegou 🏃',
          html: `<p>Seu pagamento foi confirmado!</p>
                 <p>Código de acesso: <b>${code}</b></p>
                 <p>Cadastre-se em: <a href="https://SEU-APP.vercel.app/cadastro">https://SEU-APP.vercel.app/cadastro</a></p>
                 <p>Use o CPF cadastrado na compra + este código para liberar o app.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, code }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
