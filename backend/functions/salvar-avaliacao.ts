import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json' };
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const leadId = String(body.leadId || '');
    const telefone = phone(body.telefone);
    const assessment = body.assessment;
    if (!leadId || telefone.length < 10 || !assessment || typeof assessment !== 'object') {
      return new Response(JSON.stringify({ error: 'Dados da avaliação incompletos' }), { status: 400, headers: cors });
    }
    const { data: lead, error: leadError } = await admin.from('leads').select('id, telefone').eq('id', leadId).eq('telefone', telefone).maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return new Response(JSON.stringify({ error: 'Lead não encontrado' }), { status: 404, headers: cors });
    const safeAssessment = JSON.parse(JSON.stringify(assessment));
    const { error } = await admin.from('leads').update({ assessment: safeAssessment, status: 'avaliado' }).eq('id', leadId).eq('telefone', telefone);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Não foi possível salvar a avaliação' }), { status: 500, headers: cors });
  }
});
