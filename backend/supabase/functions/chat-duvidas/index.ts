// ══════════════════════════════════════════════════════════════
// Edge Function: chat-duvidas
// Chat de perguntas e respostas pro aluno, com a mesma base
// científica usada na prescrição (40 artigos + Verkhoshansky).
// Mesma regra de segurança do groq-proxy: a GROQ_API_KEY nunca
// aparece no front-end, fica só aqui como secret.
//
// Deploy: supabase functions deploy chat-duvidas --no-verify-jwt
// ══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Você é o assistente de dúvidas do CoachEndurance — um app de fortalecimento
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
- Você NÃO diagnostica lesão. Se o aluno descrever dor, dê orientação geral de bom senso
  (ex.: "dor aguda que piora durante o exercício é sinal pra parar e procurar avaliação"),
  mas sempre direcione pra um profissional de saúde presencial pra qualquer dor persistente,
  aguda ou que preocupe — nunca diga que "não é nada" ou dê um diagnóstico.
- Você NÃO prescreve dieta, suplementos ou medicação.
- Se o contexto do aluno for enviado (modalidade, nível, foco do ciclo atual), use-o pra
  personalizar a resposta, mas não repita o contexto de volta como se fosse pergunta dele.

TOM: direto, sem enrolação, português do Brasil, respostas curtas (2-5 frases normalmente;
mais longo só se a pergunta pedir). Sem emoji em excesso. Sem linguagem de personal trainer
de internet ("bora treino!", "sem desculpa"). Cite o autor/ano quando usar um dado específico.`;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { message, history, context } = await req.json();
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Mensagem vazia' }), { status: 400, headers: cors });
    }

    const contextMsg = context
      ? `Contexto do aluno (não é uma pergunta dele — é só pra você personalizar a resposta): modalidade: ${context.sport || '—'}, nível: ${context.nivel || '—'}, foco do ciclo atual: ${context.focus || '—'}.`
      : null;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(contextMsg ? [{ role: 'system', content: contextMsg }] : []),
      ...((history || []).slice(-8)), // últimas 8 mensagens da conversa, pra manter contexto sem estourar tokens
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
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
