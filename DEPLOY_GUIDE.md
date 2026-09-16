# Base do Corre — Guia de Deploy e Operação

Este guia descreve o fluxo atual do produto: **Supabase + InfinitePay + Resend + Groq**, com assinatura recorrente e ativação por e-mail, telefone/CPF e código.

## 1. Banco de dados

1. Abra **Supabase → SQL Editor → New query**.
2. Cole o conteúdo de `backend/supabase_schema.sql`.
3. Execute a consulta.
4. Confirme que existem as tabelas `licenses`, `profiles`, `leads` e `payment_orders`.
5. Não exponha dados de licença, CPF ou pedidos no frontend. O acesso administrativo é feito pelas Edge Functions com `service_role`.

O schema é idempotente para as estruturas principais e deve ser mantido sincronizado com as colunas existentes no projeto de produção.

## 2. Autenticação e URLs

Em **Authentication → Providers → Email**:

- deixe o provedor de e-mail habilitado;
- mantenha a confirmação de e-mail ativada;
- habilite a proteção contra senhas vazadas.

Em **Authentication → URL Configuration**:

- **Site URL:** `https://ontreino01-eng.github.io/coach-run/`
- **Redirect URL:** `https://ontreino01-eng.github.io/coach-run/`

A barra final `/coach-run/` é necessária para que o retorno de confirmação funcione corretamente no GitHub Pages.

## 3. Secrets das Edge Functions

Em **Edge Functions → Secrets**, configure os nomes abaixo:

| Secret | Finalidade |
|---|---|
| `INFINITEPAY_WEBHOOK_TOKEN` | Protege a URL pública que recebe o webhook da InfinitePay. |
| `RESEND_API_KEY` | Autoriza o envio do e-mail de ativação. |
| `EMAIL_FROM` | Remetente verificado para o e-mail de ativação, quando suportado pela implementação implantada. |
| `GROQ_API_KEY` | Chave privada usada pelo backend para gerar os ciclos e responder ao chat. |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados automaticamente pelo Supabase nas Edge Functions. Nunca coloque `GROQ_API_KEY`, `RESEND_API_KEY`, `INFINITEPAY_WEBHOOK_TOKEN` ou a service role key no `index.html`.

### Remetente do Resend

O domínio/remetente usado no campo `from` precisa estar autorizado no Resend. Se a função implantada ainda utilizar um remetente fixo, como `Base do Corre <onboarding@resend.dev>`, faça um teste inicial com ele e depois atualize a função para usar `EMAIL_FROM` com um domínio verificado.

## 4. Edge Functions implantadas

| Função | Verify JWT | Responsabilidade |
|---|---:|---|
| `registrar-lead` | Desligado | Registra nome, telefone e lead inicial antes do pagamento. |
| `salvar-avaliacao` | Desligado | Salva a avaliação no lead, exigindo o mesmo `leadId` e telefone. |
| `criar-checkout-infinitepay` | Desligado | Valida o lead, cria `payment_orders` e gera o checkout individualizado. |
| `webhook-infinitepay` | Desligado | Confirma o pedido, cria a licença, registra os dados da transação e dispara o e-mail via Resend. |
| `validar-licenca` | Desligado | Valida credenciais de licença quando necessário pelo fluxo do frontend. |
| `ativar-licenca` | Ligado | Exige usuário autenticado, valida telefone/código, vincula a avaliação e gera o ciclo de quatro semanas. |
| `verificar-assinatura` | Ligado | Confere se a assinatura e o período de acesso continuam válidos. |
| `groq-proxy` | Ligado | Encaminha operações autorizadas de geração de plano para a IA. |
| `chat-duvidas` | Ligado | Responde dúvidas do aluno autenticado sem expor a chave da Groq. |

## 5. InfinitePay

A função `criar-checkout-infinitepay` usa o handle configurado no backend, gera um `order_nsu` único e envia à InfinitePay:

- o valor do plano fundador;
- a descrição do ciclo de fortalecimento de quatro semanas;
- o nome, e-mail e telefone do cliente;
- a URL de retorno do app;
- a URL do webhook protegida por token.

A URL pública do webhook é:

```text
https://ywfiartxnsviosqjfhkp.supabase.co/functions/v1/webhook-infinitepay?token=SEU_INFINITEPAY_WEBHOOK_TOKEN
```

Use no painel da InfinitePay a URL com o token real configurado no Secret. Não publique o token em repositórios, posts, screenshots ou no frontend.

O vínculo do pagamento é feito por `order_nsu`, que conecta o checkout a `payment_orders`, ao lead e, após a confirmação, à licença.

## 6. Resend e e-mail de ativação

Quando o webhook recebe uma confirmação válida:

1. localiza o `payment_orders.order_nsu`;
2. impede processamento duplicado de pedidos já pagos;
3. valida o valor recebido;
4. cria ou atualiza a licença;
5. salva a transação na tabela de pedidos;
6. envia ao e-mail do pedido o código de ativação e o link do app.

O e-mail deve orientar o aluno a:

1. abrir o app;
2. confirmar o e-mail e fazer login;
3. informar telefone/CPF e código de ativação;
4. concluir a ativação;
5. acessar o ciclo personalizado de quatro semanas.

Antes de vender em escala, confirme nos logs do Resend e do Supabase que o envio foi aceito. A geração da licença não deve ser considerada prova de entrega do e-mail: valide também a caixa de entrada e spam.

## 7. Fluxo do aluno

O fluxo operacional esperado é:

```text
Avaliação
  → registrar lead
  → salvar avaliação
  → gerar checkout individualizado
  → pagamento InfinitePay
  → webhook confirmado
  → licença criada
  → e-mail Resend com código
  → confirmação de e-mail/login
  → ativação por telefone/CPF + código
  → plano IA de 4 semanas
```

O telefone usado na ativação deve ser o mesmo telefone normalizado que foi usado na avaliação e associado à licença. O código é de uso único para a primeira ativação.

## 8. Frontend e publicação

No `index.html`, confirme apenas os valores públicos do projeto:

```js
const SUPABASE_URL = 'https://ywfiartxnsviosqjfhkp.supabase.co';
const SUPABASE_ANON_KEY = 'sua_chave_publica_do_projeto';
```

A aplicação está publicada em:

`https://ontreino01-eng.github.io/coach-run/`

Todo push para `main` atualiza o GitHub Pages. O service worker deve ser versionado quando houver alteração importante no fluxo de checkout ou autenticação.

## 9. Checklist antes das vendas

- [ ] Projeto Supabase está ativo e saudável.
- [ ] Tabelas `licenses`, `profiles`, `leads` e `payment_orders` existem.
- [ ] RLS está habilitado e não há leitura pública de licenças ou pedidos.
- [ ] E-mail do Supabase está habilitado e a URL de redirecionamento termina em `/coach-run/`.
- [ ] `INFINITEPAY_WEBHOOK_TOKEN` está configurado.
- [ ] `RESEND_API_KEY` está configurada.
- [ ] Remetente do Resend está autorizado.
- [ ] `GROQ_API_KEY` está configurada.
- [ ] `criar-checkout-infinitepay` está ativa.
- [ ] `webhook-infinitepay` está ativa e sem Verify JWT.
- [ ] A URL do webhook está cadastrada na InfinitePay com o token correto.
- [ ] `ativar-licenca`, `verificar-assinatura`, `groq-proxy` e `chat-duvidas` exigem JWT.
- [ ] O checkout individualizado é criado com `order_nsu` único.
- [ ] O webhook é idempotente para pedidos já pagos.
- [ ] O e-mail chega com código e instruções de ativação.
- [ ] O telefone vincula corretamente avaliação, licença e perfil.
- [ ] O plano gerado tem exatamente quatro semanas.
- [ ] O plano não prescreve corrida, pace, quilometragem, tiros ou longão.
- [ ] O chat responde somente para usuário autorizado.
- [ ] Foi realizado um teste completo do início ao fim antes de anunciar o produto.

## 10. Vídeos dos exercícios

Use vídeos do YouTube como **Não listado**, nunca como Privado, caso sejam incorporados no app. Preencha o ID do vídeo no campo `video` do exercício correspondente em `index.html`. Os vídeos devem demonstrar execução, pontos de controle, erros comuns e regressões sem transformar o produto em uma planilha de corrida.
