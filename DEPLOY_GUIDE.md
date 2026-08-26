# PersonalCoach — Guia de Deploy e Lançamento

Atualizado para o fluxo real: tudo pelo painel do Supabase (sem CLI/terminal),
com assinatura mensal via Kiwify.

---

## 1. Banco de dados (uma vez só, ou sempre que atualizar o schema)

1. Supabase → **SQL Editor** → **New query**
2. Cole o conteúdo de `backend/supabase_schema.sql` (arquivo único, atualizado —
   substitui qualquer versão anterior que você tenha rodado)
3. **Run**
4. ✅ Pronto quando: a consulta devolve uma linha com `tabela_licenses`,
   `tabela_profiles`, `tabela_leads` todos = 1

Esse arquivo é **idempotente** — pode rodar de novo a qualquer momento sem
quebrar nada, é a única fonte da verdade do schema.

---

## 2. Autenticação

1. **Authentication → Providers** → confirme "Email" habilitado e
   "Confirm email" ligado.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://ontreino01-eng.github.io/coach-run/` (com a barra
     `/coach-run/` no final — sem isso o link de confirmação de e-mail quebra)
   - **Redirect URLs**: mesma URL
3. **Authentication → Providers → Email → Leaked Password Protection** →
   liga essa opção (impede senha já vazada em outros vazamentos de dados —
   recomendação de segurança, sem custo).

---

## 3. Secrets (Edge Functions → Secrets)

Adicione exatamente estes dois (nomes em maiúsculo, com underline):

| Nome | Valor |
|---|---|
| `GROQ_API_KEY` | sua chave da Groq (começa com `gsk_...`) |
| `KIWIFY_WEBHOOK_TOKEN` | uma senha aleatória forte, inventada por você |

A `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` já vêm automáticas em toda
Edge Function — não precisa configurar.

---

## 4. As 6 Edge Functions

Pra cada uma: **Edge Functions → Deploy a new function → Via Editor** →
nome exato → cola o código de `backend/supabase/functions/<nome>/index.ts` →
confere o **Verify JWT** → **Deploy**.

| Nome exato | Verify JWT | O que faz |
|---|---|---|
| `validar-licenca` | **Desligado** | Confere CPF+código no cadastro |
| `ativar-licenca` | **Ligado** | Trava o código depois do 1º uso |
| `kiwify-webhook` | **Desligado** | Recebe eventos do Kiwify (compra, renovação, atraso, cancelamento) |
| `verificar-assinatura` | **Ligado** | Confere se a assinatura está em dia a cada login |
| `groq-proxy` | **Ligado** | Decide o próximo ciclo via IA (só pra quem já pagou) |
| `chat-duvidas` | **Ligado** | Chat de dúvidas com IA (só pra quem já pagou) |

⚠️ `groq-proxy` e `chat-duvidas` mudaram de "Desligado" para **"Ligado"** —
se você já tinha essas duas deployadas de antes com Verify JWT desligado,
precisa reconfigurar isso (normalmente não dá pra mudar só o toggle depois
do deploy — redeploye a função e confirme a opção na hora).

---

## 5. Conectar o app ao Supabase

No `index.html`, confirme estas duas linhas com os valores do SEU projeto
(Project Settings → API):

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'sua_anon_key_aqui';
```

A anon key é pública por design (protegida pelas regras RLS do schema) —
pode ficar no código. A `GROQ_API_KEY` é a única que NUNCA vai aqui.

---

## 6. Hospedar (GitHub Pages — já configurado)

O app já está publicado automaticamente em
**https://ontreino01-eng.github.io/coach-run/** — todo push no branch
`main` do repositório atualiza o site sozinho em ~1 minuto.

---

## 7. Kiwify

1. Configure seu produto como **assinatura mensal**.
2. **Configurações → Webhooks** → adiciona a URL:
   ```
   https://SEU-PROJETO.supabase.co/functions/v1/kiwify-webhook?token=SEU_KIWIFY_WEBHOOK_TOKEN
   ```
3. Marca **todos** estes eventos: Compra Aprovada, Assinatura Renovada,
   Assinatura Atrasada, Assinatura Cancelada, Reembolso, Chargeback.
4. Use o botão **"Testar Webhook"** e confira em **Ver logs** se o payload
   bate com o que a função espera (campo `Customer.CPF` maiúsculo).
5. Confirme que o link de checkout do produto está funcionando (teste
   abrindo ele — "Produto Indisponível" significa que o produto não está
   publicado/ativo no Kiwify).

---

## 8. Vídeos dos exercícios

YouTube com visibilidade **"Não listado"** (Privado não funciona
incorporado). Pega o ID do vídeo e preenche o campo `video:''` do
exercício correspondente em `const EXERCISES = [...]` no `index.html`.

---

## Checklist antes de vender de verdade

- [ ] `backend/supabase_schema.sql` rodado (schema consolidado)
- [ ] Site URL / Redirect URLs configurados com `/coach-run/` no final
- [ ] Leaked Password Protection ligado
- [ ] `GROQ_API_KEY` e `KIWIFY_WEBHOOK_TOKEN` nos secrets
- [ ] As 6 funções deployadas com o Verify JWT certo (tabela acima)
- [ ] `SUPABASE_URL`/`ANON_KEY` corretos no `index.html`
- [ ] Webhook do Kiwify configurado com TODOS os 6 eventos de assinatura
- [ ] Link de checkout do Kiwify testado e funcionando (sem "Produto Indisponível")
- [ ] Testei o fluxo completo: lead → avaliação → teste → paywall → Kiwify →
      código por e-mail → cadastro → confirmação → login → Ciclo 1 gerado →
      chat responde → assinatura aparece certa no Perfil
