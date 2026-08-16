// ══════════════════════════════════════════════════════════════
// Edge Function: ativar-licenca
// Chamada pelo app depois que o aluno confirma o cadastro (login
// bem-sucedido pela primeira vez). Marca a licença como "ativo" e
// liga o CPF ao usuário autenticado — depois disso, aquele código
// não pode mais ser usado em outro cadastro.
// Deploy: supabase functions deploy ativar-licenca
// (SEM --no-verify-jwt — só usuário autenticado pode chamar)
// ══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: cors });

    const { cpf, nome } = await req.json();
    const cleanCpf = (cpf || '').replace(/\D/g, '');

    const { data: lic } = await supabaseAdmin.from('licenses').select('*').eq('cpf', cleanCpf).maybeSingle();
    if (!lic || lic.status === 'ativo') {
      return new Response(JSON.stringify({ error: 'Licença inválida ou já ativada' }), { status: 400, headers: cors });
    }

    await supabaseAdmin.from('licenses').update({ status: 'ativo', redeemed_at: new Date().toISOString() }).eq('cpf', cleanCpf);
    await supabaseAdmin.from('profiles').upsert({ id: user.id, cpf: cleanCpf, nome, state: {} });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
