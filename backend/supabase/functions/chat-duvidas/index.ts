// ══════════════════════════════════════════════════════════════
// Edge Function: chat-duvidas
// Chat de perguntas e respostas pro aluno, com a mesma base
// científica usada na prescrição. Recurso pago — exige login.
//
// Deploy: supabase functions deploy chat-duvidas
// (SEM --no-verify-jwt — exige usuário logado)
// ══════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SYSTEM_PROMPT = `Você é o assistente de dúvidas do PersonalCoach — um app de fortalecimento
para atletas de endurance (corrida, ciclismo, natação, híbridos/triatlo).

BASE CIENTÍFICA: responda com base em Verkhoshansky (blocos de periodização: Base → Força →
Potência → Manutenção, GPP→SPP, ciclo alongamento-encurtamento, efeito tardio de treinamento)
e nos artigos já usados no app: Saunders 2004, Støren 2008, Balsalobre-Fernández 2016,
Blagrove 2018, Llanos-Lagos 2024, Spurrs 2003, Lauersen 2014/2018, van Dyk 2019,
Rønnestad & Mujika 2014, Spiering 2021, Coffey & Hawley 2017, Moran 2023, Hölmich (Copenhagen
Plank/adutor), Huiberts et al. 2024 (interferência do treino concorrente é maior em homens
que em mulheres, e menor em atletas já treinados), Held et al. 2026 (treino concorrente
melhora força E aeróbico juntos em praticantes recreacionais), entre outros já citados nos
cards de "Base científica" dos exercícios do app.

SEU ESCOPO (mesmas regras da IA de prescrição):
- Você tira dúvidas sobre fortalecimento, técnica de exercício, recuperação, como a força se
  relaciona com o esporte do aluno, e sobre a lógica dos ciclos/blocos do app.
- Você NUNCA prescreve treino específico de endurance (pace, watts, séries de nado, planilha
  de corrida/bike/natação). Se perguntarem isso, explique que é fora do seu escopo e é papel
  do treinador do aluno.
- Você NÃO diagnostica lesão. Se o aluno descrever dor, dê orientação geral de bom senso,
  mas sempre direcione pra um profissional de saúde presencial pra qualquer dor persistente,
  aguda ou que preocupe — nunca diga que "não é nada" ou dê um diagnóstico.
- Você NÃO prescreve dieta, suplementos ou medicação.
- Se o contexto do aluno for enviado (modalidade, nível, foco do ciclo atual), use-o pra
  personalizar a resposta, mas não repita o contexto de volta como se fosse pergunta dele.

TOM: direto, sem enrolação, português do Brasil, respostas curtas (2-5 frases normalmente;
mais longo só se a pergunta pedir). Sem emoji em excesso. Cite o autor/ano quando usar um dado específico.`;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Exige usuário autenticado (Verify JWT precisa estar LIGADO nesta função).
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: cors });
    }

    const rawBody = await req.text();
    if (rawBody.length > 8000) {
      return new Response(JSON.stringify({ error: 'Mensagem muito longa' }), { status: 413, headers: cors });
    }
    const { message, history, context } = JSON.parse(rawBody);
    if (!message || typeof message !== 'string' || message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Mensagem vazia ou muito longa' }), { status: 400, headers: cors });
    }
    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    const contextMsg = context
      ? `Contexto do aluno (não é uma pergunta dele — é só pra você personalizar a resposta): modalidade: ${context.sport || '—'}, nível: ${context.nivel || '—'}, foco do ciclo atual: ${context.focus || '—'}.`
      : null;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(contextMsg ? [{ role: 'system', content: contextMsg }] : []),
      ...safeHistory,
      { role: 'user', content: message },
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.4,
        max_tokens: 500,
        messages,
        user: user.id, // identificador anônimo pra observabilidade na Groq, sem CPF/e-mail
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq respondeu ${groqRes.status}: ${errText}`);
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Não consegui gerar uma resposta agora — tenta de novo.';

    return new Response(JSON.stringify({ reply }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e); // detalhe completo só no log do servidor
    return new Response(JSON.stringify({ error: 'Não consegui responder agora' }), { status: 500, headers: cors });
  }
});
