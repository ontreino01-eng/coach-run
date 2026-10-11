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
const phone = (v: unknown) => String(v || '').replace(/\D/g,'');
const email = (v: unknown) => String(v || '').trim().toLowerCase().slice(0,254);

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
    if (raw.length > 70000) return new Response(JSON.stringify({error:'Avaliação muito grande'}),{status:413,headers:h});
    const body = JSON.parse(raw);
    const leadId = String(body.leadId || '');
    const leadToken = String(body.leadToken || '');
    const telefone = phone(body.telefone);
    const nome = String(body.nome || '').trim().slice(0,120);
    const cleanEmail = email(body.email);
    const assessment = body.assessment;
    if (!leadId || leadToken.length < 40 || telefone.length < 10 || !assessment || typeof assessment !== 'object') {
      return new Response(JSON.stringify({error:'Dados da avaliação incompletos'}),{status:400,headers:h});
    }

    const tokenHash = await sha256(leadToken);
    const { data: lead, error: findError } = await admin.from('leads')
      .select('id,assessment,email')
      .eq('id', leadId)
      .eq('telefone', telefone)
      .eq('lead_token_hash', tokenHash)
      .maybeSingle();
    if (findError) throw findError;
    if (!lead) return new Response(JSON.stringify({error:'Vínculo da avaliação inválido'}),{status:403,headers:h});

    const completed=lead.assessment?.tests && Object.keys(lead.assessment.tests).length>0;
    // Completion freezes answers. Idempotent retries may still attach the checkout email.
    function stable(v:any):string { return JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])):v); }
    if(completed && stable(lead.assessment)!==stable(assessment)) return new Response(JSON.stringify({error:'Avaliação inicial já concluída. Use a reavaliação ao renovar o ciclo.',code:'INITIAL_LOCKED'}),{status:409,headers:h});
    if(completed && lead.email && cleanEmail && lead.email!==cleanEmail) return new Response(JSON.stringify({error:'Use o e-mail vinculado à sua avaliação.',code:'EMAIL_LOCKED'}),{status:409,headers:h});
    const updates:any = { assessment: JSON.parse(JSON.stringify(assessment)), status:'avaliado' };
    if (nome) updates.nome = nome;
    if (cleanEmail) updates.email = cleanEmail;

    const { error } = await admin.from('leads').update(updates).eq('id', leadId).eq('lead_token_hash', tokenHash);
    if (error) throw error;
    return new Response(JSON.stringify({ok:true,leadId,emailSaved:!!cleanEmail}),{status:200,headers:h});
  } catch (e) {
    console.error('salvar-avaliacao', e);
    return new Response(JSON.stringify({error:'Não foi possível salvar a avaliação'}),{status:500,headers:h});
  }
});
