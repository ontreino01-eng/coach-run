import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json' };
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const nome = String(body.nome || '').trim().slice(0, 120);
    const telefone = phone(body.telefone);
    if (!nome || telefone.length < 10 || telefone.length > 15) {
      return new Response(JSON.stringify({ error: 'Nome ou telefone inválido' }), { status: 400, headers: cors });
    }
    const { data, error } = await admin.from('leads').insert({ nome, telefone, status: 'novo' }).select('id').single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, leadId: data.id }), { status: 200, headers: cors });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Não foi possível registrar o contato' }), { status: 500, headers: cors });
  }
});
