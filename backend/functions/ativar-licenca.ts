import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Content-Type': 'application/json' };
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
const json = (value: unknown) => JSON.stringify(value);

const SYSTEM_PROMPT = `Você é o motor de prescrição do Personal Coach. Gere SOMENTE fortalecimento complementar para atletas de endurance. Nunca prescreva pace, watts, séries de natação, quilometragem ou o treino específico de endurance. O usuário já possui ou terá esse treino fora do app. Crie um ciclo de 4 semanas: semanas 1-3 de trabalho progressivo e semana 4 com redução aproximada de 30-40% do volume para recuperação e reavaliação. Considere modalidade, objetivo principal, nível, lesões, PAR-Q, sono, estresse, tempo, equipamento e dias disponíveis. Não faça diagnóstico. Se houver sinal de alerta, reduza a agressividade e inclua alerta para avaliação profissional. Use exercícios de musculação, estabilidade, core e pliometria somente quando apropriado ao nível e às condições informadas. Retorne JSON válido no formato: {"cycleNum":1,"focus":{"key":"base|forca|potencia|manutencao","name":"...","focus":"...","color":"var(--acc)","icon":"...","desc":"...","intensity":"...","load":"..."},"weeks":[{"num":1,"cycleNum":1,"focusKey":"base","focusName":"...","focusColor":"var(--acc)","name":"Semana 1","focus":"...","isDeload":false,"sessions":[{"day":"Sessão A","type":"força","emoji":"🏋️","name":"...","exercises":["Nome do exercício — séries×repetições — orientação"]}]}]}. Gere exatamente 4 semanas e 2 a 4 sessões por semana conforme disponibilidade. Cada semana deve conter sessões. Não inclua markdown.`;

function normalizeText(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// A IA pode mencionar a modalidade apenas como contexto. O plano, porém,
// nunca pode prescrever endurance. Esta validação roda no backend e não depende
// de o modelo obedecer ao prompt.
function hasForbiddenEndurancePrescription(plan: any) {
  const generated: string[] = [];
  for (const week of plan?.weeks || []) {
    for (const session of week?.sessions || []) {
      generated.push(String(session?.type || ''), String(session?.name || ''));
      for (const exercise of session?.exercises || []) {
        generated.push(typeof exercise === 'string' ? exercise : JSON.stringify(exercise));
      }
    }
  }
  const text = normalizeText(generated.join(' '));
  const forbidden = [
    /\bpace\b/, /\britmo\s+(de\s+)?\d/, /\bquilometr/, /\b\d+(?:[.,]\d+)?\s*km\b/,
    /\bwatts?\b/, /\bftp\b/, /\blongao\b/, /\bintervalad/, /\bfartlek\b/,
    /\btiros?\b/, /\bsprints?\b/, /\bseries?\s+de\s+nata/, /\btreino\s+de\s+(corrida|ciclismo|bike|natacao|triatlo)/,
    /\bcorrida\s+(de\s+)?\d/, /\bciclismo\s+(de\s+)?\d/, /\bnatacao\s+(de\s+)?\d/
  ];
  return forbidden.some(pattern => pattern.test(text));
}

function validPlan(plan: any) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length !== 4 || !plan.focus) return false;
  if (hasForbiddenEndurancePrescription(plan)) return false;
  return plan.weeks.every((w: any, i: number) => w.num === i + 1 && Array.isArray(w.sessions) && w.sessions.length >= 2 && w.sessions.length <= 4 && w.sessions.every((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0));
}

async function generatePlan(assessment: any) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`, 'Content-Type': 'application/json' },
    body: json({ model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 2200, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: json(assessment) }] }),
  });
  if (!response.ok) throw new Error(`Groq ${response.status}`);
  const data = await response.json();
  const plan = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  if (!validPlan(plan)) throw new Error('Plano da IA fora do formato esperado');
  return plan;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(auth);
    if (authError || !user) return new Response(json({ error: 'Não autenticado' }), { status: 401, headers: cors });

    const body = await req.json();
    const telefone = phone(body.telefone);
    const code = String(body.code || '').trim().toUpperCase();
    const nome = String(body.nome || '').trim().slice(0, 120);
    if (telefone.length < 10 || !code) return new Response(json({ error: 'Telefone e código são obrigatórios' }), { status: 400, headers: cors });

    const { data: license, error: licenseError } = await admin.from('licenses').select('cpf,email,code,status,subscription_status,current_period_end,telefone').eq('code', code).eq('telefone', telefone).maybeSingle();
    if (licenseError) throw licenseError;
    if (!license) return new Response(json({ error: 'Telefone ou código não conferem' }), { status: 400, headers: cors });
    if (license.status === 'ativo') return new Response(json({ error: 'Este código já foi ativado' }), { status: 409, headers: cors });

    const { data: lead, error: leadError } = await admin.from('leads').select('id,nome,telefone,assessment').eq('telefone', telefone).not('assessment', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (leadError) throw leadError;
    if (!lead?.assessment) return new Response(json({ error: 'Não encontrei uma avaliação para este telefone' }), { status: 404, headers: cors });

    const assessment = lead.assessment;
    const plan = await generatePlan(assessment);
    const state = { assessed: true, cycleNum: 1, currentWeek: 1, completedWeeks: [], profile: { ...(assessment.profile || {}), nome: nome || lead.nome, telefone }, scores: assessment.scores || {}, lesoes: assessment.lesoes || [], plan, parqAlert: !!assessment.parqAlert, logs: {}, tests: { 0: assessment.tests || {} }, history: [], lead: { nome: lead.nome, telefone }, subscriptionInfo: { status: license.subscription_status, periodEnd: license.current_period_end } };

    const { error: profileError } = await admin.from('profiles').upsert({ id: user.id, cpf: license.cpf, telefone, nome: state.profile.nome, state }, { onConflict: 'id' });
    if (profileError) throw profileError;
    const { error: licenseUpdateError } = await admin.from('licenses').update({ status: 'ativo', redeemed_at: new Date().toISOString() }).eq('cpf', license.cpf).eq('code', code).eq('status', 'pendente');
    if (licenseUpdateError) throw licenseUpdateError;
    await admin.from('leads').update({ status: 'vinculado' }).eq('id', lead.id);

    return new Response(json({ ok: true, planReady: true, state }), { status: 200, headers: cors });
  } catch (error) {
    console.error(error);
    return new Response(json({ error: 'Não foi possível ativar a licença e gerar o plano' }), { status: 500, headers: cors });
  }
});
