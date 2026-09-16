# Base do Corre

Aplicativo PWA especialista em **fortalecimento complementar para corredores**. O app não prescreve corrida, pace, quilometragem, tiros ou planilhas de endurance. Ele organiza a parte de força, estabilidade, mobilidade, controle e progressão que complementa a rotina de corrida.

## Proposta do produto

O aluno preenche uma avaliação, informa seus dados de contato e recebe um checkout individualizado. Depois da confirmação do pagamento, o sistema cria uma licença mensal, envia o código de ativação por e-mail e vincula o acesso à avaliação feita pelo mesmo telefone. Após o login e a ativação com telefone/CPF e código, o backend gera um ciclo personalizado de quatro semanas por IA.

## Fluxo atual

1. O aluno inicia a avaliação no app.
2. O frontend registra o lead e salva a avaliação no Supabase.
3. O botão de acesso ao plano chama `criar-checkout-infinitepay`.
4. A função cria um pedido em `payment_orders` e gera um checkout individualizado na InfinitePay.
5. A InfinitePay chama `webhook-infinitepay` após a confirmação do pagamento.
6. O webhook cria ou atualiza a licença e envia o código de ativação via Resend.
7. O aluno confirma o e-mail, entra no app e informa telefone/CPF e código.
8. `ativar-licenca` valida o vínculo com a avaliação e gera o ciclo de quatro semanas via IA.
9. `verificar-assinatura` controla a validade do acesso recorrente.

## Estrutura

- `index.html` — frontend completo do PWA, avaliação, autenticação, checkout, plano e chat.
- `manifest.json`, `sw.js`, `icons/` — instalação e funcionamento PWA.
- `backend/supabase_schema.sql` — schema consolidado do banco.
- `backend/functions/` — código versionado das Edge Functions do Supabase.
- `BASE_CIENTIFICA_BASE_DO_CORRE.md` — referências e princípios científicos do produto.
- `PROMPT_IA_FORTALECIMENTO_ENDURANCE_v2.md` — prompt e regras da IA de prescrição.
- `DEPLOY_GUIDE.md` — configuração operacional atualizada para Supabase, InfinitePay e Resend.

## Serviços externos

- **Supabase:** autenticação, banco de dados e Edge Functions.
- **InfinitePay:** checkout individualizado e confirmação de pagamento recorrente.
- **Resend:** envio do e-mail de ativação após o pagamento.
- **Groq:** geração do ciclo de fortalecimento e respostas do chat por meio de Edge Functions protegidas.
- **GitHub Pages:** hospedagem do frontend publicado em `https://ontreino01-eng.github.io/coach-run/`.

## Regra de segurança

Chaves privadas, token do webhook, chave da Groq e chave do Resend ficam exclusivamente nos Secrets das Edge Functions. A chave pública do Supabase pode aparecer no frontend, protegida pelas políticas RLS e pelas funções de backend.

## Publicação

O branch `main` é publicado automaticamente pelo GitHub Pages. Após um push, aguarde a atualização do site e, se necessário, faça uma atualização forçada do PWA para invalidar o cache.
