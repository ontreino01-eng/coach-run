// ══════════════════════════════════════════════════════════════
// Edge Function: validar-licenca
// Chamada pelo app na tela de cadastro: confere se o CPF + código
// batem com uma licença paga e ainda não resgatada.
// Deploy: supabase functions deploy validar-licenca --no-verify-jwt
// ══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { cpf, code } = await req.json();
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const cleanCode = (code || '').trim().toUpperCase();

    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('cpf', cleanCpf)
      .eq('code', cleanCode)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ valid: false, reason: 'CPF ou código não encontrados' }), { status: 200, headers: cors });
    }
    if (data.status === 'ativo') {
      return new Response(JSON.stringify({ valid: false, reason: 'Este código já foi usado em outro cadastro' }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ valid: true, email: data.email }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, reason: String(e) }), { status: 500, headers: cors });
  }
});
