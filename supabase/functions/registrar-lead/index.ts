import { createClient } from 'jsr:@supabase/supabase-js@2';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const ALLOWED_ORIGINS = new Set(['https://basedocorre.com.br','https://www.basedocorre.com.br','http://localhost:3000','http://127.0.0.1:3000']);
function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://basedocorre.com.br',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}
async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function consumeRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  const { data, error } = await admin.from('security_rate_limits').select('key,window_start,attempts').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data) {
    const r = await admin.from('security_rate_limits').insert({ key, window_start: new Date(now).toISOString(), attempts: 1, updated_at: new Date(now).toISOString() });
    if (r.error) throw r.error;
    return true;
  }
  const start = new Date(data.window_start).getTime();
  if (!Number.isFinite(start) || now - start >= windowMs) {
    const r = await admin.from('security_rate_limits').update({ window_start: new Date(now).toISOString(), attempts: 1, updated_at: new Date(now).toISOString() }).eq('key', key);
    if (r.error) throw r.error;
    return true;
  }
  if (Number(data.attempts) >= maxAttempts) return false;
  const r = await admin.from('security_rate_limits').update({ attempts: Number(data.attempts)+1, updated_at: new Date(now).toISOString() }).eq('key', key);
  if (r.error) throw r.error;
  return true;
}
const phone = (v: unknown) => String(v || '').replace(/\D/g,'');
Deno.serve(async (req) => {
  const h = cors(req);
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response('forbidden',{status:403,headers:h});
    return new Response('ok',{status:200,headers:h});
  }
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Método não permitido'}),{status:405,headers:h});
  if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(JSON.stringify({error:'Origem não permitida'}),{status:403,headers:h});
  try {
    const raw = await req.text();
    if (raw.length > 10000) return new Response(JSON.stringify({error:'Requisição muito grande'}),{status:413,headers:h});
    const body = JSON.parse(raw);
    const nome = String(body.nome || '').trim().slice(0,120);
    const telefone = phone(body.telefone);
    if (!nome || telefone.length < 10 || telefone.length > 15) return new Response(JSON.stringify({error:'Nome ou telefone inválido'}),{status:400,headers:h});
    const {data: prior,error: priorError}=await admin.from('leads').select('id,assessment').eq('telefone',telefone).not('assessment','is',null);
    if(priorError)throw priorError;
    if((prior||[]).some((l:any)=>l.assessment?.tests && Object.keys(l.assessment.tests).length)) return new Response(JSON.stringify({error:'Sua avaliação inicial já foi concluída. Entre na sua conta; a próxima será a reavaliação após renovar e concluir o ciclo.',code:'INITIAL_LOCKED'}),{status:409,headers:h});
    const phoneOk = await consumeRateLimit('lead:phone:' + await sha256(telefone), 5, 10*60*1000);
    if (!phoneOk) return new Response(JSON.stringify({error:'Muitas tentativas. Aguarde alguns minutos.'}),{status:429,headers:h});
    const leadToken = crypto.randomUUID() + crypto.randomUUID().replaceAll('-','');
    const { data, error } = await admin.from('leads').insert({ nome, telefone, status:'novo', lead_token_hash: await sha256(leadToken) }).select('id').single();
    if (error) throw error;
    return new Response(JSON.stringify({ok:true,leadId:data.id,leadToken}),{status:200,headers:h});
  } catch (e) {
    console.error('registrar-lead', e);
    return new Response(JSON.stringify({error:'Não foi possível registrar o contato'}),{status:500,headers:h});
  }
});
