// ══════════════════════════════════════════════════════════════
// Edge Function: verificar-assinatura
// Chamada toda vez que o app abre (usuário logado). Confere se a
// assinatura mensal ainda está em dia — se não, bloqueia o acesso
// ao plano/exercícios até renovar.
// Deploy: supabase functions deploy verificar-assinatura
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
    if (userErr || !user) return new Response(JSON.stringify({ active: false, reason: 'Não autenticado' }), { status: 401, headers: cors });

    const { data: profile } = await supabaseAdmin.from('profiles').select('cpf').eq('id', user.id).maybeSingle();
    if (!profile || !profile.cpf) {
      return new Response(JSON.stringify({ active: false, reason: 'Perfil sem CPF vinculado' }), { status: 200, headers: cors });
    }

    const { data: lic } = await supabaseAdmin.from('licenses').select('subscription_status, current_period_end').eq('cpf', profile.cpf).maybeSingle();
    if (!lic) return new Response(JSON.stringify({ active: false, reason: 'Licença não encontrada' }), { status: 200, headers: cors });

    const periodOk = !lic.current_period_end || new Date(lic.current_period_end) > new Date();
    const active = lic.subscription_status === 'ativa' && periodOk;

    return new Response(JSON.stringify({
      active, status: lic.subscription_status, periodEnd: lic.current_period_end,
    }), { status: 200, headers: cors });
  } catch (e) {
    // Em caso de erro técnico, NÃO bloqueia o aluno — melhor deixar passar
    // do que travar acesso por uma falha temporária do servidor.
    return new Response(JSON.stringify({ active: true, reason: 'erro ao verificar, liberando por precaução: ' + String(e) }), { status: 200, headers: cors });
  }
});
