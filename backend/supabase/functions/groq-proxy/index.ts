// ══════════════════════════════════════════════════════════════
// Edge Function: groq-proxy
// O app NUNCA fala direto com a Groq. Ele chama esta função, que
// segura a GROQ_API_KEY como secret (nunca aparece no front-end),
// chama a Groq, e devolve só a decisão de prescrição.
//
// Configurar o secret (uma vez só, no terminal, NUNCA no código):
//   supabase secrets set GROQ_API_KEY=sua_chave_aqui
//
// Deploy: supabase functions deploy groq-proxy --no-verify-jwt
// (tire o --no-verify-jwt se quiser exigir usuário logado — recomendado
// depois que o cadastro com Supabase Auth estiver funcionando)
// ══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Você é o NÚCLEO 8 — Preparador de Força, agente de IA especialista
em fortalecimento para atletas de endurance (corrida, ciclismo, natação, híbridos/triatlo).

ESCOPO FIXO: você decide apenas o foco do PRÓXIMO CICLO DE FORTALECIMENTO (4 semanas) e
ajustes de volume/carga. Você NUNCA prescreve treino específico de endurance (pace, watts,
séries de nado). Baseie-se em: Verkhoshansky (blocos: Base → Força → Potência → Manutenção,
GPP→SPP, efeito tardio de treinamento) e nos 40 artigos científicos já usados no app
(Saunders 2004, Støren 2008, Rønnestad & Mujika 2014, Spiering 2021, Lauersen 2014/2018,
Moran 2023, entre outros).

Você recebe: foco do ciclo anterior, variação percentual de cada teste físico (antes/depois),
reavaliação subjetiva (força/equilíbrio/mobilidade/controle excêntrico/dor, escala 0-10),
feedback do aluno (esforço percebido, aderência aos treinos, dor nova, se quer mais/menos
volume) e um resumo da aderência real aos exercícios logados (dificuldade média reportada,
quantos exercícios não foram completados como prescrito).

Responda SOMENTE em JSON válido, sem markdown, neste formato exato:
{
  "nextFocus": "base" | "forca" | "potencia" | "manutencao",
  "loadAdjustPct": <número entre -15 e 15, ajuste de carga sugerido para o próximo ciclo>,
  "reasoning": "<1-2 frases em português explicando a decisão, citando o dado que mais pesou>",
  "alertaSaude": <true se PAR-Q, dor nova relevante ou piora de teste indicar necessidade de avaliação médica/fisioterapêutica antes de prosseguir, senão false>
}`;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const payload = await req.json();
    // payload esperado (montado pelo front-end em closeTheCycle):
    // { prevFocus, sport, nivel, testDeltas, overallPct, reassess, feedback, logsSummary }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq respondeu ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content || '{}';
    const decision = JSON.parse(content);

    return new Response(JSON.stringify(decision), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    // Front-end deve cair para a lógica local (decideNextFocus) se isto falhar.
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
