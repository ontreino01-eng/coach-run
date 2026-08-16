# CoachEndurance

App de fortalecimento para atletas de endurance (corrida, ciclismo, natação, híbridos).
Ver `DEPLOY_GUIDE.md` para o passo a passo completo de deploy e lançamento.

## Estrutura
- `index.html` — o app (front-end completo, PWA)
- `manifest.json`, `sw.js`, `icons/` — arquivos de instalação PWA
- `backend/` — schema SQL + Edge Functions do Supabase (licenciamento, IA, webhook Kiwify)
- `PROMPT_IA_FORTALECIMENTO_ENDURANCE_v2.md` — prompt de sistema usado pela IA de prescrição
