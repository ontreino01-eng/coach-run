# CoachEndurance — Guia de Deploy e Lançamento

Ordem recomendada. Cada etapa tem o "pronto quando" pra você saber que pode seguir pra próxima.

---

## 1. Supabase (backend: login, licenças, IA) — ~15 min

1. Crie conta em supabase.com → New Project (anote a senha do banco).
2. **Dashboard → SQL Editor → New query** → cole o conteúdo de `backend/supabase_schema.sql` → Run.
   ✅ Pronto quando: aparecem as tabelas `licenses` e `profiles` em Table Editor.
3. **Authentication → Providers** → confirme que "Email" está habilitado e que "Confirm email" está ligado (é o que dispara a validação automática por e-mail).
4. **Authentication → URL Configuration** → em "Site URL" coloque a URL onde o app vai morar (você pega isso no passo 3 do Vercel — pode voltar aqui depois pra ajustar).
5. Instale a CLI do Supabase na sua máquina (não dá pra fazer isso daqui do chat):
   ```
   npm install -g supabase
   supabase login
   supabase link --project-ref SEU_PROJECT_REF   (está em Project Settings > General)
   ```
6. Configure os secrets (a chave da Groq fica SÓ aqui, nunca no app):
   ```
   supabase secrets set GROQ_API_KEY=sua_chave_groq_aqui
   supabase secrets set KIWIFY_WEBHOOK_TOKEN=crie_uma_senha_aleatoria_forte
   supabase secrets set RESEND_API_KEY=sua_chave_resend_aqui   (opcional, ver passo 2)
   ```
7. Deploy das 4 funções:
   ```
   supabase functions deploy validar-licenca --no-verify-jwt
   supabase functions deploy kiwify-webhook --no-verify-jwt
   supabase functions deploy ativar-licenca
   supabase functions deploy groq-proxy --no-verify-jwt
   ```
   ✅ Pronto quando: `supabase functions list` mostra as 4 ativas.
8. Pegue sua **URL** e **anon key**: Project Settings → API. Você vai colar isso no `CoachRunner.html` (passo 4).

---

## 2. E-mail de entrega do código (opcional mas recomendado) — ~10 min

Sem isso, o código de acesso é gerado mas ninguém recebe por e-mail automaticamente.

1. Crie conta grátis em resend.com.
2. Verifique um domínio seu (ou use o domínio de teste deles pra começar).
3. Pegue a API key → `supabase secrets set RESEND_API_KEY=...` (passo 1.6 acima).
4. Edite `backend/supabase/functions/kiwify-webhook/index.ts`, troque `acesso@seudominio.com` pelo seu remetente verificado, e o link `https://SEU-APP.vercel.app/cadastro` pela URL real (passo 3).
5. Redeploy: `supabase functions deploy kiwify-webhook --no-verify-jwt`.

Sem Resend configurado, o código ainda é gerado e fica salvo na tabela `licenses` — você consegue ver e mandar manualmente enquanto não configura o e-mail automático.

---

## 3. Hospedar o app (front-end) — ~10 min

Mais simples: **Vercel** (grátis, sem cartão).

1. Crie uma conta em vercel.com (pode logar com GitHub).
2. Suba os arquivos: `CoachRunner.html` (renomeie para `index.html`), `pwa/manifest.json`, `pwa/sw.js`, `pwa/icons/*` — na raiz do projeto, mantendo `manifest.json`, `sw.js` e a pasta `icons/` no mesmo nível do `index.html` (é assim que os caminhos `/manifest.json`, `/sw.js`, `/icons/...` no HTML esperam encontrar).
   - Forma mais rápida sem git: Vercel → Add New → Project → "Deploy" por upload direto da pasta (arraste os arquivos).
3. Deploy. Você recebe uma URL tipo `coachendurance.vercel.app`.
4. **(Recomendado)** Configure um domínio próprio em Vercel → Domains — fica mais profissional pra vender.
   ✅ Pronto quando: você abre a URL no celular e o app carrega.

---

## 4. Conectar o app ao Supabase — 2 min

Abra `index.html` (o antigo `CoachRunner.html`) num editor de texto, ache estas duas linhas perto do topo do `<script>`:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
```

Troque pelos valores reais do passo 1.8. Suba o arquivo atualizado de novo no Vercel.

⚠️ **A anon key pode ficar aqui no código — ela é pública por design, protegida pelas regras de segurança (RLS) que o `supabase_schema.sql` já criou.** A chave da Groq é a única que NUNCA deve aparecer neste arquivo.

---

## 5. Instalar como app no celular — 1 min (você já pode testar agora)

- **Android (Chrome):** abrir a URL → menu (⋮) → "Adicionar à tela inicial" / "Instalar app".
- **iPhone (Safari):** abrir a URL → botão Compartilhar → "Adicionar à Tela de Início".

Isso instala de verdade — ícone próprio, abre em tela cheia sem barra do navegador. Não é loja de app (isso exigiria conta de desenvolvedor Apple/Google + processo de revisão, um projeto à parte), mas pro seu caso de uso — vender direto pelo Kiwify e entregar acesso — o PWA cobre bem.

---

## 6. Kiwify — ~10 min

1. Configure seu produto normalmente no Kiwify.
2. **Configurações → Webhooks** → adicione a URL:
   `https://SEU-PROJETO.supabase.co/functions/v1/kiwify-webhook?token=SEU_KIWIFY_WEBHOOK_TOKEN`
   (o token é o que você definiu no passo 1.6 — protege pra ninguém forjar uma "compra aprovada" falsa).
3. Faça uma compra de teste (ou use o modo sandbox do Kiwify, se tiver) e confira em Supabase → Table Editor → `licenses` se a linha apareceu com um código gerado.
4. **Importante:** o payload exato do Kiwify pode variar. Se a linha não aparecer, veja em Kiwify → Webhooks → "Ver exemplo de payload" e ajuste os campos `Customer.cpf` / `Customer.email` em `backend/supabase/functions/kiwify-webhook/index.ts` pra bater com o formato real, depois redeploy.

---

## 7. Vídeos dos exercícios — sempre que quiser

1. Suba o vídeo no YouTube com visibilidade **"Não listado"** (Privado não funciona incorporado — só Não Listado ou Público).
2. Pegue o ID do vídeo (a parte depois de `v=` na URL, ex: `youtube.com/watch?v=ABC123XYZ` → ID é `ABC123XYZ`).
3. No `index.html`, ache o exercício em `const EXERCISES = [...]` (procure pelo nome) e preencha `video:''` → `video:'ABC123XYZ'`.
4. Suba o arquivo atualizado no Vercel.

Todos os 47 exercícios já têm o campo pronto — é só preencher aos poucos, o app já funciona sem vídeo nenhum (mostra "vídeo ainda não cadastrado").

---

## O que ficou de fora (decisão consciente, não esquecimento)

- **Recuperação de senha** ("esqueci minha senha") — o Supabase Auth já tem isso pronto (`supabase.auth.resetPasswordForEmail`), só não coloquei tela pra isso ainda. Avisa se quiser que eu adicione.
- **Painel administrativo** pra você ver/gerenciar licenças sem entrar direto no Supabase — hoje isso é feito pelo Table Editor do próprio Supabase (funciona, só não é uma tela bonita).
- **App nas lojas (App Store / Play Store)** — fora do escopo do PWA; exigiria Capacitor/Bubblewrap + contas de desenvolvedor pagas + revisão.
- **Reenvio de código** se o aluno perder o e-mail — hoje só reenvia manualmente por você (olhando a tabela `licenses`).

## Checklist rápido antes de vender

- [ ] Rodei o SQL no Supabase
- [ ] `GROQ_API_KEY` e `KIWIFY_WEBHOOK_TOKEN` configurados como secret
- [ ] As 4 funções deployadas
- [ ] `SUPABASE_URL`/`ANON_KEY` preenchidos no `index.html`
- [ ] App no ar no Vercel, testei instalar no meu celular
- [ ] Webhook do Kiwify configurado e testei uma compra
- [ ] Testei o fluxo completo: comprar → receber código → validar → cadastrar → confirmar e-mail → entrar → fazer avaliação → gerar Ciclo 1
