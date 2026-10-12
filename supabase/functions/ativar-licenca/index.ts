import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
const phone = (value: unknown) => String(value || '').replace(/\D/g, '');
const json = (value: unknown) => JSON.stringify(value);

const SYSTEM_PROMPT = "Você é o motor de fortalecimento complementar para corredores do Base do Corre. Prescreva SOMENTE fortalecimento, nunca corrida, pace, km, tiros, longão, ciclismo ou natação.\nBase científica: Llanos-Lagos 2024; Eihara 2022; Blagrove 2018; Støren 2008; Paavolainen 1999; Hickson 1980; Wilson 2012; Fyfe 2014; Petré 2021; Rønnestad & Mujika 2014. Força pode favorecer economia/desempenho conforme contexto, sem promessa individual. Christopher 2019: testes não diagnosticam nem predizem lesão individual. Lauersen 2018 e Wu 2024 não autorizam prometer prevenção por exercício isolado. Ciclo de 4 semanas é decisão prática do produto.\nConsidere toda assessment: nível, experiência de força/corrida, objetivo, frequência, dias específicos av-dias-fortalecimento, av-dias, tempo, equipamentos, sono, estresse, PAR-Q, dor, limitações, testes e scores. Justifique as decisões pelos dados. Não diagnostique. Dor/alertas exigem cautela e orientação profissional. Sono ruim, fadiga e baixa experiência exigem dose conservadora.\nPriorize força de pernas, unilateral, cadeia posterior, panturrilha/tornozelo-pé e core; membros superiores complementares. Equipamento deve ser disponível. Não invente kg nem %1RM sem medida. Use séries/reps ou tempo, RPE/RIR e descanso. Potência/pliometria opcional, antes da força, baixa dose e controle, omitir se iniciante sem base/dor/instabilidade.\nSemana1 referência; semanas2-3 progridem apenas com técnica, esforço e recuperação adequados; semana4 consolida/reduz volume aproximadamente30-40% se apropriado e retesta. Mantenha exercícios principais consistentes.\nCada semana tem 2-4 sessões conforme av-dias, usando os dias escolhidos, não SessãoA/B se há dias. Cada sessão tem 4-8 exercícios reais; 30min normalmente4-5;45min5-7;60min6-8. Use séries tradicionais como padrão, outros métodos só justificados. Não crie dias sem corrida para quem corre6-7dias; força no mesmo dia pode ser adequada conforme carga/recuperação. Evite dias seguidos pesados de pernas quando não apropriado. Encaixe relativo, sem prescrever corrida.\nexerciseCatalog contém SOMENTE exercícios com vídeo cadastrado e é a ÚNICA biblioteca. Nunca use exercícios de planos antigos que não estejam nela. Copie literalmente name antes de \" — \". Nunca traduza, abrevie, invente ou combine nomes.\nJSON apenas:\n{\"cycleNum\":1,\"focus\":{\"key\":\"base|forca|potencia|manutencao\",\"name\":\"...\",\"focus\":\"...\",\"color\":\"var(--acc)\",\"icon\":\"🏋️\",\"desc\":\"justificativa individual\",\"intensity\":\"...\",\"load\":\"RPE/RIR\"},\"weeks\":[{\"num\":1,\"cycleNum\":1,\"focusKey\":\"base\",\"focusName\":\"...\",\"focusColor\":\"var(--acc)\",\"name\":\"Semana 1\",\"focus\":\"objetivo\",\"isDeload\":false,\"sessions\":[{\"day\":\"Terça\",\"type\":\"força\",\"emoji\":\"🏋️\",\"name\":\"...\",\"objective\":\"objetivo individual\",\"method\":\"método\",\"durationMin\":30,\"progressionRule\":\"como progredir\",\"exercises\":[\"§ PREPARAÇÃO\",\"NOME EXATO — dose · intensidade · descanso · orientação\",\"§ PARTE PRINCIPAL\",\"NOME EXATO — dose · intensidade · descanso · orientação\",\"§ COMPLEMENTARES\",\"NOME EXATO — dose · intensidade · descanso · orientação\",\"NOME EXATO — dose · intensidade · descanso · orientação\",\"§ FINALIZAÇÃO\",\"Orientação: retorno à calma/registro\",\"Encaixe: orientação relativa à corrida\"]}]}]}\nExatamente4semanas num1,2,3,4. Marcadores obrigatórios exatamente \"§ PREPARAÇÃO\",\"§ PARTE PRINCIPAL\",\"§ COMPLEMENTARES\",\"§ FINALIZAÇÃO\". \"§ POTÊNCIA\" opcional. Linhas Orientação:/Encaixe: não contam como exercício. Finalização pode ser só orientação. Nenhum campo obrigatório pode faltar. Seja conciso nas doses e textos para entregar JSON completo.";
const ALLOWED_EXERCISES = new Set(["Isometria de Patela (Wall Sit)", "Bulgarian Split Squat", "Back Squat", "Romanian Deadlift (RDL)", "Eccentric Leg Press", "McGill Big 3: Modified Curl-up", "McGill Big 3: Bird-Dog", "McGill Big 3: Side Plank", "Pallof Press (Anti-Rotação)", "Deadbug", "Pogo Jumps", "Box Jumps", "Broad Jumps", "Drop Jumps", "Deep Squat Hold", "90/90 Hip Switch", "World's Greatest Stretch", "Couch Stretch", "Hamstring Flossing Dinâmico", "Tibialis Raises", "Clamshells com Banda", "Single Leg RDL", "Copenhagen Plank (Adutor)", "Leg Press Unilateral", "Remada Curvada", "Desenvolvimento de Ombro (Shoulder Press)", "Walking Lunge", "Good Morning", "Suitcase Carry (Carry Unilateral)", "Hollow Body Hold", "Y-T-W em Prono", "Scapular Pull-up", "Single Leg Pogo Hops", "Lateral Bounds (Saltos Laterais)", "Dorsiflexão de Tornozelo (Knee-to-Wall)", "Rotação Torácica (Open Book)", "Abdução de Quadril em Pé (Banda)", "Wall Sit Isométrico", "Hip Thrust com Barra", "Depth Jump (Salto em Profundidade)", "Russian Twist com Peso", "Ab Wheel Rollout", "Alongamento de Panturrilha na Parede", "Isometria de Tibial Anterior", "Front Squat", "Step-Down Excêntrico", "Mesa Flexora (Leg Curl)", "Dead Bug com Carga", "Skater Jumps (Salto do Patinador)", "Monster Walk com Banda", "Prancha Lateral com Elevação de Perna", "Elevação de Panturrilha Unilateral", "Isometria de Agachamento na Parede (Wall Sit Alto)", "Goblet Squat", "Romanian Deadlift com Halteres", "Afundo Búlgaro sem Peso", "Elevação Pélvica Unilateral", "Remada Unilateral com Halter", "Flexão de Braço (Push-up)", "Elevação de Panturrilha em Pé (Bilateral)", "Agachamento Sumô", "Prancha com Toque de Ombro", "Bicycle Crunch", "Superman", "V-Up", "Bird-Dog com Carga", "Tuck Jump", "Broad Jump Duplo (Salto Horizontal Repetido)", "Jump Squat", "Split Jump (Afundo com Salto)", "Alongamento de Isquiotibiais em Pé", "Mobilidade de Quadril (Pombo)", "Cat-Cow (Mobilidade de Coluna)", "Alongamento de Piriforme Deitado", "Ponte de Glúteo com Marcha", "Caminhada Lateral com Banda (variação baixa)", "Wall Angels (Anjo na Parede)", "Isometria de Glúteo Médio Deitado", "Rotação Externa Deitado de Lado", "Face Pull com Ponto Alto"]);
const EXERCISE_CATALOG = [{"id": "t4", "name": "Isometria de Patela (Wall Sit)", "cat": "tendão", "level": "Iniciante", "equipment": "Parede", "video": "_EQLQqcvIHQ", "hasVideo": true}, {"id": "m1", "name": "Bulgarian Split Squat", "cat": "músculo", "level": "Intermediário", "equipment": "Halteres", "video": "DxwboLph9cM", "hasVideo": true}, {"id": "m2", "name": "Back Squat", "cat": "músculo", "level": "Intermediário", "equipment": "Barra", "video": "ab0MefHMes8", "hasVideo": true}, {"id": "m4", "name": "Romanian Deadlift (RDL)", "cat": "músculo", "level": "Intermediário", "equipment": "Barra/halteres", "video": "_yoatCpTPNc", "hasVideo": true}, {"id": "m5", "name": "Eccentric Leg Press", "cat": "músculo", "level": "Intermediário", "equipment": "Leg Press", "video": "ZbS_DHTBThE", "hasVideo": true}, {"id": "c1", "name": "McGill Big 3: Modified Curl-up", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "rgMg8jRsWGI", "hasVideo": true}, {"id": "c2", "name": "McGill Big 3: Bird-Dog", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "D6QnX54rrK0", "hasVideo": true}, {"id": "c3", "name": "McGill Big 3: Side Plank", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "RlZqNdeyBE4", "hasVideo": true}, {"id": "c4", "name": "Pallof Press (Anti-Rotação)", "cat": "core", "level": "Intermediário", "equipment": "Elástico", "video": "vT8M11Pj0IU", "hasVideo": true}, {"id": "c5", "name": "Deadbug", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "leKfjg-O3I4", "hasVideo": true}, {"id": "p1", "name": "Pogo Jumps", "cat": "pliometria", "level": "Iniciante", "equipment": "Solo", "video": "lgcoX9izyTY", "hasVideo": true}, {"id": "p2", "name": "Box Jumps", "cat": "pliometria", "level": "Intermediário", "equipment": "Box/step", "video": "yK8IZQdCVTk", "hasVideo": true}, {"id": "p3", "name": "Broad Jumps", "cat": "pliometria", "level": "Intermediário", "equipment": "Solo", "video": "ptpQsAZIZD8", "hasVideo": true}, {"id": "p4", "name": "Drop Jumps", "cat": "pliometria", "level": "Avançado", "equipment": "Box 30-50cm", "video": "oJE3aQc8_sU", "hasVideo": true}, {"id": "mob1", "name": "Deep Squat Hold", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "ut2JlxyG7oY", "hasVideo": true}, {"id": "mob2", "name": "90/90 Hip Switch", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "4BkO40fUdu4", "hasVideo": true}, {"id": "mob3", "name": "World's Greatest Stretch", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "idsQDTPPcno", "hasVideo": true}, {"id": "mob4", "name": "Couch Stretch", "cat": "mobilidade", "level": "Iniciante", "equipment": "Parede", "video": "HXd4JRRbWlU", "hasVideo": true}, {"id": "mob5", "name": "Hamstring Flossing Dinâmico", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "ZN8b9JvCWPw", "hasVideo": true}, {"id": "kit1", "name": "Tibialis Raises", "cat": "kit", "level": "Iniciante", "equipment": "Parede", "video": "ivxZtvnX37I", "hasVideo": true}, {"id": "kit4", "name": "Clamshells com Banda", "cat": "kit", "level": "Iniciante", "equipment": "Elástico", "video": "jJcKWZEWbHQ", "hasVideo": true}, {"id": "kit5", "name": "Single Leg RDL", "cat": "kit", "level": "Intermediário", "equipment": "Solo/haltere", "video": "t_5tZfRaUGU", "hasVideo": true}, {"id": "t5", "name": "Copenhagen Plank (Adutor)", "cat": "tendão", "level": "Intermediário", "equipment": "Banco", "video": "SEvaDrA--EU", "hasVideo": true}, {"id": "m6", "name": "Leg Press Unilateral", "cat": "músculo", "level": "Intermediário", "equipment": "Leg Press", "video": "nOELu_oaq9Y", "hasVideo": true}, {"id": "m7", "name": "Remada Curvada", "cat": "músculo", "level": "Intermediário", "equipment": "Barra/anilha", "video": "TfT0n05Bd0g", "hasVideo": true}, {"id": "m8", "name": "Desenvolvimento de Ombro (Shoulder Press)", "cat": "músculo", "level": "Intermediário", "equipment": "Halteres", "video": "brjhX32d8Ts", "hasVideo": true}, {"id": "m9", "name": "Walking Lunge", "cat": "músculo", "level": "Intermediário", "equipment": "Halteres", "video": "6Tnv_WDAMME", "hasVideo": true}, {"id": "m10", "name": "Good Morning", "cat": "músculo", "level": "Avançado", "equipment": "Barra", "video": "VsM5lgFTHk0", "hasVideo": true}, {"id": "c6", "name": "Suitcase Carry (Carry Unilateral)", "cat": "core", "level": "Iniciante", "equipment": "Haltere/kettlebell", "video": "8UYp81nCyIY", "hasVideo": true}, {"id": "c7", "name": "Hollow Body Hold", "cat": "core", "level": "Intermediário", "equipment": "Solo", "video": "CfyCxX1gvy0", "hasVideo": true}, {"id": "o4", "name": "Y-T-W em Prono", "cat": "ombro", "level": "Iniciante", "equipment": "Halteres leves/solo", "video": "V78-QwEOXRs", "hasVideo": true}, {"id": "o5", "name": "Scapular Pull-up", "cat": "ombro", "level": "Intermediário", "equipment": "Barra", "video": "eBV-oXnPJAA", "hasVideo": true}, {"id": "p5", "name": "Single Leg Pogo Hops", "cat": "pliometria", "level": "Intermediário", "equipment": "Solo", "video": "yxW3pk4S7Xc", "hasVideo": true}, {"id": "p6", "name": "Lateral Bounds (Saltos Laterais)", "cat": "pliometria", "level": "Intermediário", "equipment": "Solo", "video": "s_T6DbWwcxw", "hasVideo": true}, {"id": "mob6", "name": "Dorsiflexão de Tornozelo (Knee-to-Wall)", "cat": "mobilidade", "level": "Iniciante", "equipment": "Parede", "video": "TIuFvoIc9Xs", "hasVideo": true}, {"id": "mob7", "name": "Rotação Torácica (Open Book)", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "AWo4DtjDkBw", "hasVideo": true}, {"id": "kit6", "name": "Abdução de Quadril em Pé (Banda)", "cat": "kit", "level": "Iniciante", "equipment": "Elástico", "video": "EBeQipiBUys", "hasVideo": true}, {"id": "kit7", "name": "Wall Sit Isométrico", "cat": "kit", "level": "Iniciante", "equipment": "Parede", "video": "oDQk2Ewo2rw", "hasVideo": true}, {"id": "m11", "name": "Hip Thrust com Barra", "cat": "músculo", "level": "Intermediário", "equipment": "Barra/banco", "video": "pXKuXiqf0UQ", "hasVideo": true}, {"id": "p7", "name": "Depth Jump (Salto em Profundidade)", "cat": "pliometria", "level": "Avançado", "equipment": "Caixa", "video": "GD2fI65_rJk", "hasVideo": true}, {"id": "c8", "name": "Russian Twist com Peso", "cat": "core", "level": "Intermediário", "equipment": "Halter/anilha", "video": "KRldIFo-P50", "hasVideo": true}, {"id": "c9", "name": "Ab Wheel Rollout", "cat": "core", "level": "Avançado", "equipment": "Roda abdominal", "video": "d5yRE_XSlb0", "hasVideo": true}, {"id": "mob8", "name": "Alongamento de Panturrilha na Parede", "cat": "mobilidade", "level": "Iniciante", "equipment": "Parede", "video": "abWZccImKBM", "hasVideo": true}, {"id": "t6", "name": "Isometria de Tibial Anterior", "cat": "tendão", "level": "Iniciante", "equipment": "Elástico/parede", "video": "0Z1wKo0jsxo", "hasVideo": true}, {"id": "m13", "name": "Front Squat", "cat": "músculo", "level": "Avançado", "equipment": "Barra", "video": "ijgp_0MlbZQ", "hasVideo": true}, {"id": "m14", "name": "Step-Down Excêntrico", "cat": "músculo", "level": "Intermediário", "equipment": "Step/degrau", "video": "tPHUKIbReis", "hasVideo": true}, {"id": "m16", "name": "Mesa Flexora (Leg Curl)", "cat": "músculo", "level": "Iniciante", "equipment": "Máquina", "video": "85ur-TGkqlI", "hasVideo": true}, {"id": "c11", "name": "Dead Bug com Carga", "cat": "core", "level": "Intermediário", "equipment": "Halter leve", "video": "pENYZ4HQpno", "hasVideo": true}, {"id": "p10", "name": "Skater Jumps (Salto do Patinador)", "cat": "pliometria", "level": "Intermediário", "equipment": "Solo", "video": "1XX6HEvdhNw", "hasVideo": true}, {"id": "kit10", "name": "Monster Walk com Banda", "cat": "kit", "level": "Iniciante", "equipment": "Elástico", "video": "hwNdFV5Aj4g", "hasVideo": true}, {"id": "kit11", "name": "Prancha Lateral com Elevação de Perna", "cat": "kit", "level": "Intermediário", "equipment": "Solo", "video": "zhm4fegfdRI", "hasVideo": true}, {"id": "t8", "name": "Elevação de Panturrilha Unilateral", "cat": "tendão", "level": "Iniciante", "equipment": "Degrau/solo", "video": "8Rvf990L-BA", "hasVideo": true}, {"id": "t9", "name": "Isometria de Agachamento na Parede (Wall Sit Alto)", "cat": "tendão", "level": "Iniciante", "equipment": "Parede", "video": "9NNs5XfYn8I", "hasVideo": true}, {"id": "m17b", "name": "Goblet Squat", "cat": "músculo", "level": "Iniciante", "equipment": "Haltere/kettlebell", "video": "7JV8Rj6uwA8", "hasVideo": true}, {"id": "m18b", "name": "Romanian Deadlift com Halteres", "cat": "músculo", "level": "Iniciante", "equipment": "Halteres", "video": "JqQQCYF2cTA", "hasVideo": true}, {"id": "m19", "name": "Afundo Búlgaro sem Peso", "cat": "músculo", "level": "Iniciante", "equipment": "Banco/cadeira", "video": "DxwboLph9cM", "hasVideo": true}, {"id": "m20", "name": "Elevação Pélvica Unilateral", "cat": "músculo", "level": "Intermediário", "equipment": "Solo", "video": "KaPbsBsl43o", "hasVideo": true}, {"id": "m21", "name": "Remada Unilateral com Halter", "cat": "músculo", "level": "Iniciante", "equipment": "Halter/banco", "video": "GETwGuE18Dw", "hasVideo": true}, {"id": "m22", "name": "Flexão de Braço (Push-up)", "cat": "músculo", "level": "Iniciante", "equipment": "Solo", "video": "WMBg3NVkAgg", "hasVideo": true}, {"id": "m23", "name": "Elevação de Panturrilha em Pé (Bilateral)", "cat": "músculo", "level": "Iniciante", "equipment": "Degrau/solo", "video": "hAmvmPIeM3w", "hasVideo": true}, {"id": "m24", "name": "Agachamento Sumô", "cat": "músculo", "level": "Iniciante", "equipment": "Haltere/kettlebell", "video": "15QiOqZ6z6s", "hasVideo": true}, {"id": "c12", "name": "Prancha com Toque de Ombro", "cat": "core", "level": "Intermediário", "equipment": "Solo", "video": "qS0KEoxFjn8", "hasVideo": true}, {"id": "c13", "name": "Bicycle Crunch", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "yZ7KPJOf0is", "hasVideo": true}, {"id": "c14", "name": "Superman", "cat": "core", "level": "Iniciante", "equipment": "Solo", "video": "6L4QQYWfM5I", "hasVideo": true}, {"id": "c15", "name": "V-Up", "cat": "core", "level": "Avançado", "equipment": "Solo", "video": "9XeqFPzYRow", "hasVideo": true}, {"id": "c16", "name": "Bird-Dog com Carga", "cat": "core", "level": "Intermediário", "equipment": "Halter leve/caneleira", "video": "e7aHGPiiaGE", "hasVideo": true}, {"id": "p11b", "name": "Tuck Jump", "cat": "pliometria", "level": "Avançado", "equipment": "Solo", "video": "qKXcQGBh6bg", "hasVideo": true}, {"id": "p12", "name": "Broad Jump Duplo (Salto Horizontal Repetido)", "cat": "pliometria", "level": "Avançado", "equipment": "Solo", "video": "heonljoxXlQ", "hasVideo": true}, {"id": "p13", "name": "Jump Squat", "cat": "pliometria", "level": "Intermediário", "equipment": "Solo/halteres leves", "video": "lht-MMdPaFA", "hasVideo": true}, {"id": "p14", "name": "Split Jump (Afundo com Salto)", "cat": "pliometria", "level": "Avançado", "equipment": "Solo", "video": "1c8-bWhqwVI", "hasVideo": true}, {"id": "mob10b", "name": "Alongamento de Isquiotibiais em Pé", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "U7oa_yl1928", "hasVideo": true}, {"id": "mob11", "name": "Mobilidade de Quadril (Pombo)", "cat": "mobilidade", "level": "Intermediário", "equipment": "Solo", "video": "gJ0OrnRkWe8", "hasVideo": true}, {"id": "mob12", "name": "Cat-Cow (Mobilidade de Coluna)", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "2hE_Ejdm86E", "hasVideo": true}, {"id": "mob13", "name": "Alongamento de Piriforme Deitado", "cat": "mobilidade", "level": "Iniciante", "equipment": "Solo", "video": "hX80sGshVrk", "hasVideo": true}, {"id": "kit13", "name": "Ponte de Glúteo com Marcha", "cat": "kit", "level": "Intermediário", "equipment": "Solo", "video": "ZHeGmPB67HQ", "hasVideo": true}, {"id": "kit14", "name": "Caminhada Lateral com Banda (variação baixa)", "cat": "kit", "level": "Iniciante", "equipment": "Elástico", "video": "M_uOsa7mv1s", "hasVideo": true}, {"id": "kit15", "name": "Wall Angels (Anjo na Parede)", "cat": "kit", "level": "Iniciante", "equipment": "Parede", "video": "uBNnZke9I7s", "hasVideo": true}, {"id": "kit16", "name": "Isometria de Glúteo Médio Deitado", "cat": "kit", "level": "Iniciante", "equipment": "Elástico", "video": "GYA4fH2HilA", "hasVideo": true}, {"id": "o7", "name": "Rotação Externa Deitado de Lado", "cat": "ombro", "level": "Iniciante", "equipment": "Haltere leve", "video": "3rVLSXPWLdU", "hasVideo": true}, {"id": "o8", "name": "Face Pull com Ponto Alto", "cat": "ombro", "level": "Iniciante", "equipment": "Cabo/elástico", "video": "7z9ZFDkinK8", "hasVideo": true}];

function sanitizeForAI(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeForAI);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k,v] of Object.entries(value)) {
      const key = String(k).toLowerCase();
      if (['nome','name','email','telefone','phone','cpf','lead','leadid','leadtoken','id'].includes(key)) continue;
      out[k] = sanitizeForAI(v);
    }
    return out;
  }
  return value;
}

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
  for (const week of plan?.weeks || []) for (const session of week?.sessions || []) {
    if (/\btreino\s+de\s+(corrida|ciclismo|bike|natacao|triatlo)/.test(normalizeText(String(session.type || '') + ' ' + String(session.name || '')))) return true;
  }
  const text = normalizeText(generated.join(' '));
  const forbidden = [
    /\bpace\b/, /\britmo\s+(de\s+)?\d/, /\bquilometr/, /\b\d+(?:[.,]\d+)?\s*km\b/,
    /\bwatts?\b/, /\bftp\b/, /\blongao\b/, /\bintervalad/, /\bfartlek\b/,
    /\btiros?\b/, /\bsprints?\b/, /\bseries?\s+de\s+nata/, 
    /\bcorrida\s+(de\s+)?\d/, /\bciclismo\s+(de\s+)?\d/, /\bnatacao\s+(de\s+)?\d/
  ];
  return forbidden.some(pattern => pattern.test(text));
}

function validPlan(plan: any) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length !== 4 || !plan.focus) return false;
  if (hasForbiddenEndurancePrescription(plan)) return false;

  const allowedMarker = (item: string) =>
    ['§ PREPARAÇÃO','§ POTÊNCIA','§ PARTE PRINCIPAL','§ COMPLEMENTARES','§ FINALIZAÇÃO'].includes(item);

  return plan.weeks.every((w: any, i: number) =>
    w.num === i + 1 &&
    Array.isArray(w.sessions) &&
    w.sessions.length >= 2 &&
    w.sessions.length <= 4 &&
    w.sessions.every((sess: any) => {
      if (!sess || typeof sess.objective !== 'string' || !sess.objective.trim()) return false;
      if (typeof sess.method !== 'string' || !sess.method.trim()) return false;
      if (!Number.isFinite(Number(sess.durationMin)) || Number(sess.durationMin) < 20 || Number(sess.durationMin) > 90) return false;
      if (typeof sess.progressionRule !== 'string' || !sess.progressionRule.trim()) return false;
      if (!Array.isArray(sess.exercises) || !sess.exercises.length) return false;

      const hasPrep = sess.exercises.includes('§ PREPARAÇÃO');
      const hasMain = sess.exercises.includes('§ PARTE PRINCIPAL');
      const hasComp = sess.exercises.includes('§ COMPLEMENTARES');
      const hasFinish = sess.exercises.includes('§ FINALIZAÇÃO');
      if (!hasPrep || !hasMain || !hasComp || !hasFinish) return false;

      let realExerciseCount = 0;
      for (const item of sess.exercises) {
        if (typeof item !== 'string') return false;
        if (allowedMarker(item) || item.startsWith('Encaixe:') || item.startsWith('Orientação:')) continue;
        const exerciseName = item.split(' — ')[0].trim();
        if (!ALLOWED_EXERCISES.has(exerciseName)) return false;
        if (!item.includes(' — ')) return false;
        realExerciseCount++;
      }
      return realExerciseCount >= 4 && realExerciseCount <= 8;
    })
  );
}

function catalogueKey(value: string) {
  return value.normalize('NFKC').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}
function normalizePlanNames(plan: any) {
  // Resolve IDs and typographic variants only. Never use fuzzy matching.
  const names = new Map<string, string>();
  for (const entry of EXERCISE_CATALOG) {
    names.set(entry.id, entry.name);
    names.set(catalogueKey(entry.name), entry.name);
  }
  const aliases: Record<string, string> = {
    'side plank': 'McGill Big 3: Side Plank',
    'wall angels': 'Wall Angels (Anjo na Parede)',
  };
  if (!Array.isArray(plan?.weeks)) return plan;
  for (const week of plan.weeks) {
    if (!Array.isArray(week?.sessions)) continue;
    for (const session of week.sessions) {
      if (!Array.isArray(session?.exercises)) continue;
      session.exercises = session.exercises.map((item: any) => {
        if (typeof item !== 'string') return item;
        const match = item.match(/^(.+?)\s+[—–-]\s+(.+)$/);
        if (!match) return item;
        const key = catalogueKey(match[1]);
        const canonical = names.get(key) || aliases[key];
        return canonical ? canonical + ' — ' + match[2].trim() : item;
      });
    }
  }
  return plan;
}
function planValidationIssues(plan: any): string[] {
  const issues: string[] = [];
  if (!Array.isArray(plan?.weeks) || plan.weeks.length !== 4) return ['estrutura: quatro semanas obrigatórias'];
  for (const [wi, week] of plan.weeks.entries()) {
    if (!Array.isArray(week?.sessions)) { issues.push(`estrutura: semana ${wi+1} sem sessões`); continue; }
    for (const [si, session] of week.sessions.entries()) {
      if (!Array.isArray(session?.exercises)) { issues.push(`estrutura: semana ${wi+1}, sessão ${si+1} sem exercícios`); continue; }
      for (const item of session.exercises) {
        if (typeof item !== 'string') { issues.push('estrutura: item não textual'); continue; }
        if (item.startsWith('§ ') || item.startsWith('Orientação:') || item.startsWith('Encaixe:')) continue;
        const name = item.split(' — ')[0].trim();
        if (!ALLOWED_EXERCISES.has(name)) issues.push(`catálogo: ${name}`);
        else if (!item.includes(' — ') || !item.split(' — ').slice(1).join(' — ').trim()) issues.push(`dose ausente: ${name}`);
      }
    }
  }
  return issues.length ? [...new Set(issues)] : ['estrutura ou regra de segurança: plano rejeitado'];
}

async function generatePlan(assessment: any) {
  async function requestPlan(extraInstruction = '') {
    const requestBody = json({
        model: 'openai/gpt-oss-120b', temperature: 0.1, reasoning_effort: 'low', max_tokens: 6500,
        response_format: {"type":"json_schema","json_schema":{"name":"strength_cycle","strict":true,"schema":{"type":"object","properties":{"cycleNum":{"type":"integer"},"focus":{"type":"object","properties":{"key":{"type":"string","enum":["base","forca","potencia","manutencao"]},"name":{"type":"string"},"focus":{"type":"string"},"color":{"type":"string"},"icon":{"type":"string"},"desc":{"type":"string"},"intensity":{"type":"string"},"load":{"type":"string"}},"required":["key","name","focus","color","icon","desc","intensity","load"],"additionalProperties":false},"weeks":{"type":"array","items":{"type":"object","properties":{"num":{"type":"integer"},"cycleNum":{"type":"integer"},"focusKey":{"type":"string"},"focusName":{"type":"string"},"focusColor":{"type":"string"},"name":{"type":"string"},"focus":{"type":"string"},"isDeload":{"type":"boolean"},"sessions":{"type":"array","items":{"type":"object","properties":{"day":{"type":"string"},"type":{"type":"string"},"emoji":{"type":"string"},"name":{"type":"string"},"objective":{"type":"string"},"method":{"type":"string"},"durationMin":{"type":"integer"},"progressionRule":{"type":"string"},"exercises":{"type":"array","items":{"type":"string"}}},"required":["day","type","emoji","name","objective","method","durationMin","progressionRule","exercises"],"additionalProperties":false}}},"required":["num","cycleNum","focusKey","focusName","focusColor","name","focus","isDeload","sessions"],"additionalProperties":false}}},"required":["cycleNum","focus","weeks"],"additionalProperties":false}}},
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: json({ assessment, exerciseCatalog: EXERCISE_CATALOG.map(({id,name,equipment,level}) => ({id,name,equipment,level})), instruction: extraInstruction || 'Use o id exato do exerciseCatalog antes de " — " em cada exercício, seguido de dose, esforço e descanso concisos. O servidor resolve o nome oficial. Marcadores e Orientação:/Encaixe: permanecem como definidos. Não invente IDs.' }) }]
      });
    async function send() { return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`, 'Content-Type': 'application/json' },
      body: requestBody,
    }); }
    let response = await send();
    if (response.status === 429) {
      const rateError = await response.json().catch(() => ({}));
      const suggested = Number(String(rateError.error?.message || '').match(/try again in ([\d.]+)s/i)?.[1]);
      const waitSeconds = Math.min(45, Math.max(5, Number(response.headers.get('retry-after')) || 0, Number.isFinite(suggested) && suggested > 0 ? suggested + 2 : 15));
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      response = await send();
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      console.error('Groq request failed', response.status, detail.error?.message || '');
      throw new Error(`Groq ${response.status}`);
    }
    const data = await response.json();
    if (data.choices?.[0]?.finish_reason === 'length') throw new Error('Plano excedeu o limite de saída da IA');
    return normalizePlanNames(JSON.parse(data.choices?.[0]?.message?.content || '{}'));
  }

  let plan = await requestPlan();
  if (validPlan(plan)) return plan;

  const issues = planValidationIssues(plan);
  console.warn('Plano inválido', JSON.stringify({issues}));
  plan = await requestPlan('Corrija o plano completo. Falhas: ' + issues.join('; ') + '. Use IDs exatos do catálogo antes do separador, doses concisas e todos os campos e marcadores obrigatórios.');
  if (!validPlan(plan)) {
    const remaining = planValidationIssues(plan);
    console.warn('Plano rejeitado após correção', JSON.stringify({issues: remaining}));
    throw new Error('Plano inválido: ' + remaining.join('; '));
  }
  return plan;
}

async function getCycleAccess(user: any) {
 const {data: profile,error: pe}=await admin.from('profiles').select('id,cpf,state').eq('id',user.id).maybeSingle();
 if(pe)throw pe;
 if(!profile?.state?.assessed || !profile.state.plan) return {allowed:false,error:'Ative sua avaliação inicial primeiro.',code:'INITIAL_REQUIRED'};
 const {data: licenses,error: le}=await admin.from('licenses').select('id,current_period_end,subscription_status,status').eq('email',String(user.email||'').toLowerCase()).order('created_at',{ascending:false}).limit(1);
 if(le)throw le;
 const license=licenses?.[0];
 if(!license || license.subscription_status!=='ativa' || !['ativo','pendente'].includes(license.status) || !license.current_period_end || Date.parse(license.current_period_end)<=Date.now()) return {allowed:false,error:'Renove sua assinatura para liberar a reavaliação.',code:'RENEWAL_REQUIRED'};
 const {data: latest,error: ce}=await admin.from('assessment_cycles').select('*').eq('user_id',user.id).eq('status','ready').order('cycle_num',{ascending:false}).limit(1);
 if(ce)throw ce;
 const cycle=latest?.[0];
 if(!cycle || Number(profile.state.cycleNum)!==cycle.cycle_num) return {allowed:false,error:'Não foi possível confirmar seu ciclo. Entre novamente.',code:'CYCLE_MISMATCH'};
 const completed=new Set(profile.state.completedWeeks||[]);
 if(![1,2,3,4].every(n=>completed.has(n))) return {allowed:false,error:'Conclua as quatro semanas antes da reavaliação.',code:'CYCLE_INCOMPLETE'};
 if(!cycle.period_end || Date.parse(license.current_period_end)<=Date.parse(cycle.period_end)) return {allowed:false,error:'Seu ciclo terminou. A reavaliação será liberada após a confirmação da renovação mensal.',code:'RENEWAL_REQUIRED'};
 return {allowed:true,profile,license,cycle,nextCycle:cycle.cycle_num+1};
}
async function releaseCycle(userId: string,cycle: number,token: string,status='pending') {
 const {error}=await admin.from('assessment_cycles').update({lease_until:null,lease_token:null,status}).eq('user_id',userId).eq('cycle_num',cycle).eq('lease_token',token);
 if(error)throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
  let claim: any = null;
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(auth);
    if (authError || !user) return new Response(json({ error: 'Não autenticado' }), { status: 401, headers: cors });

    const body = await req.json();
    const telefoneInput = phone(body.telefone);
    const code = String(body.code || '').trim().toUpperCase();
    const nome = String(body.nome || '').trim().slice(0, 120);
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) return new Response(json({ error: 'Entre com o e-mail da compra' }), { status: 401, headers: cors });

    // A licença pertence ao e-mail autenticado. Telefone/código são filtros extras,
    // nunca substituem a verificação de quem está logado.
    let query = admin.from('licenses')
      .select('id,cpf,email,code,status,subscription_status,current_period_end,telefone')
      .eq('email', email).eq('subscription_status', 'ativa')
      .in('status', ['pendente', 'ativo']);
    if (code) query = query.eq('code', code);
    if (telefoneInput) query = query.eq('telefone', telefoneInput);
    const { data: licenses, error: licenseError } = await query.order('created_at', { ascending: false }).limit(1);
    if (licenseError) throw licenseError;
    const license = licenses?.[0];
    if (!license) return new Response(json({ error: 'Não encontrei uma compra ativa para este e-mail. Entre com o e-mail usado no pagamento.' }), { status: 403, headers: cors });
    if (license.current_period_end && new Date(license.current_period_end).getTime() <= Date.now()) {
      return new Response(json({ error: 'Sua assinatura precisa ser renovada para liberar o plano' }), { status: 403, headers: cors });
    }
    const telefone = phone(license.telefone);
    if (telefone.length < 10) return new Response(json({ error: 'A compra está sem telefone. Entre em contato com o suporte.' }), { status: 400, headers: cors });

    // Retentativas reaproveitam o plano salvo e nunca zeram o progresso.
    const { data: saved, error: savedError } = await admin.from('profiles').select('cpf,state').eq('id', user.id).maybeSingle();
    if (savedError) throw savedError;
    if (saved?.cpf === license.cpf && saved.state?.assessed && validPlan(saved.state.plan)) {
      const { error: markError } = await admin.from('licenses').update({ status: 'ativo', redeemed_at: new Date().toISOString() }).eq('id', license.id);
      if (markError) throw markError;
      return new Response(json({ ok: true, planReady: true, state: saved.state }), { status: 200, headers: cors });
    }

    const { data: lead, error: leadError } = await admin.from('leads').select('id,nome,telefone,assessment').eq('telefone', telefone).eq('email', email).not('assessment', 'is', null).not('assessment->>tests', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (leadError) throw leadError;
    if (!lead?.assessment?.tests || !Object.keys(lead.assessment.tests).length) return new Response(json({ error: 'Não encontrei uma avaliação para este telefone' }), { status: 404, headers: cors });

    if(saved?.state?.assessed) return new Response(json({error:'Sua avaliação inicial já foi ativada. Não é permitido gerar outra inicial.',code:'INITIAL_LOCKED'}),{status:409,headers:cors});
    const {data: existingCycle,error: cycleError}=await admin.from('assessment_cycles').select('plan,status,inputs').eq('user_id',user.id).eq('cycle_num',1).maybeSingle();
    if(cycleError)throw cycleError;
    let assessment=existingCycle?.inputs || lead.assessment;
    let plan=existingCycle?.status==='ready' ? existingCycle.plan : null;
    if(plan&&!validPlan(plan))return new Response(json({error:'O plano salvo precisa ser atualizado para a biblioteca com vídeos.',code:'VIDEO_CATALOG_REQUIRED'}),{status:409,headers:cors});
    if(!plan) {
      const {data: token,error: claimError}=await admin.rpc('claim_assessment_cycle',{p_user:user.id,p_cycle:1,p_period:license.current_period_end,p_inputs:assessment});
      if(claimError)throw claimError;
      if(!token)return new Response(json({error:'Seu treinamento já está sendo preparado. Aguarde e entre novamente.',code:'GENERATION_BUSY'}),{status:409,headers:cors});
      claim={userId:user.id,cycle:1,token};
      plan=await generatePlan(sanitizeForAI(assessment));
      const {error: readyError}=await admin.from('assessment_cycles').update({status:'ready',plan,lease_token:null,lease_until:null}).eq('user_id',user.id).eq('cycle_num',1).eq('lease_token',token);
      if(readyError)throw readyError;
      claim=null;
    }
    const state = { assessed: true, cycleNum: 1, currentWeek: 1, completedWeeks: [], profile: { ...(assessment.profile || {}), nome: nome || lead.nome, telefone }, scores: assessment.scores || {}, lesoes: assessment.lesoes || [], plan, parqAlert: !!assessment.parqAlert, logs: {}, tests: { 0: assessment.tests || {} }, history: [], lead: { nome: lead.nome, telefone }, subscriptionInfo: { status: license.subscription_status, periodEnd: license.current_period_end } };

    const { error: profileError } = await admin.from('profiles').upsert({ id: user.id, cpf: license.cpf, telefone, nome: state.profile.nome, state }, { onConflict: 'id' });
    if (profileError) throw profileError;
    const { error: licenseUpdateError } = await admin.from('licenses').update({ status: 'ativo', redeemed_at: new Date().toISOString() }).eq('id', license.id);
    if (licenseUpdateError) throw licenseUpdateError;
    await admin.from('leads').update({ status: 'vinculado' }).eq('id', lead.id);

    return new Response(json({ ok: true, planReady: true, state }), { status: 200, headers: cors });
  } catch (error) {
    if(claim)await releaseCycle(claim.userId,claim.cycle,claim.token,'failed').catch(console.error);
    console.error(error);
    return new Response(json({ error: 'Não foi possível ativar a licença e gerar o plano' }), { status: 500, headers: cors });
  }
});


