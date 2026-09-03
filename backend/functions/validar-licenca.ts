import { createClient } from 'jsr:@supabase/supabase-js@2';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json' };
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const telefone = phone(body.telefone);
    const code = String(body.code || '').trim().toUpperCase();
    if (telefone.length < 10 || !code) return new Response(JSON.stringify({ valid: false, reason: 'Telefone ou código inválido' }), { status: 200, headers: cors });
    const { data, error } = await admin.from('licenses').select('email,status,subscription_status,current_period_end').eq('telefone', telefone).eq('code', code).maybeSingle();
    if (error) throw error;
    if (!data) return new Response(JSON.stringify({ valid: false, reason: 'Telefone ou código não encontrados' }), { status: 200, headers: cors });
    if (data.status === 'ativo') return new Response(JSON.stringify({ valid: false, reason: 'Este código já foi ativado. Entre com seu e-mail e senha.' }), { status: 200, headers: cors });
    return new Response(JSON.stringify({ valid: true, email: data.email }), { status: 200, headers: cors });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ valid: false, reason: 'Não foi possível validar agora' }), { status: 500, headers: cors });
  }
});
