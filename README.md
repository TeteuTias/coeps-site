# COEPS Site

Aplicação pública e painel do congressista, construída com Next.js.

## Ambiente local

Use Node.js compatível com o Next 16, instale exatamente as dependências do
lockfile e copie `.env.example` para `.env.local`. Preencha os valores locais
sem versionar credenciais. Para o Auth0 v4, `AUTH0_DOMAIN` deve conter somente
o hostname do tenant, sem `https://` ou barra final.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Os endpoints de autenticação do Auth0 v4 são `/auth/login` e `/auth/logout`.
As variáveis legadas `AUTH0_ISSUER_BASE_URL` e `AUTH0_BASE_URL` ainda são
aceitas temporariamente, mas `AUTH0_DOMAIN` e `APP_BASE_URL` têm precedência.

## Verificação

```powershell
npm run typecheck
npm run lint
npm run build
```

## Códigos de desconto e rastreio

O checkout aceita um código de desconto de uso único e um código de rastreio
reutilizável na mesma compra. Os valores são recalculados no servidor e o
desconto só é marcado como `USADO` quando o pagamento é confirmado. O documento
permanece no Mongo para auditoria e só entra na limpeza anual da edição.

Antes de habilitar o recurso em um ambiente novo:

1. Defina `PAYMENT_EDITION_ID`, `PAYMENT_SALES_ENABLED`, `PAYMENT_CODES_ENABLED`,
   `PAYMENT_RECONCILIATION_SECRET` e
   `PAYMENT_OVERDUE_GRACE_DAYS` conforme `.env.example`. O segredo raiz deve ter
   pelo menos 32 bytes aleatórios e nunca deve ser enviado ao Asaas.
2. Na primeira configuração, defina `ASAAS_API_URL` e execute
   `npm run payment:credentials -- --generate --show`; salve o
   `generatedRootSecret` como `PAYMENT_RECONCILIATION_SECRET`. Nas execuções
   seguintes, use `npm run payment:credentials -- --show`. Configure somente o valor
   `webhookAuthToken` como `authToken` do webhook no Asaas. O Asaas o envia no
   cabeçalho oficial `asaas-access-token`.
3. Execute primeiro `npm run migrate:payment-indexes -- --database <BANCO> --edition <EDICAO>`.
   Revise o dry-run e aplique exatamente o digest retornado com
   `--apply --confirm <DIGEST>`. Esse script cria apenas índices e não altera
   documentos financeiros. Se o banco já tiver eventos no ledger antigo,
   informe também `--protect-event "<EVENT_ID>"` tanto no dry-run quanto no
   apply; o script compara hashes do ledger e do pagamento protegido antes e
   depois da criação dos índices.
4. `PAYMENT_CONFIG_ID` não é uma variável do runtime: ela serve somente para a
   migração ampla `migrate:payment-codes`. Mantenha `null` como trava e execute
   esse script apenas quando a migração completa for aprovada.
5. Agende uma chamada autenticada periódica para `POST /api/payment/reconciliation`
   usando `Authorization: Bearer <reconciliationBearer>`, gerado pelo comando do
   passo 2. Nunca use o segredo raiz diretamente como bearer.
6. Rode `npm run test:payments`, `npm run test:payments:integration`,
   `npm run typecheck`, `npm run lint` e `npm run build` antes da publicação.

O script index-only `migrate:payment-indexes` é idempotente e cria somente os
índices aprovados, sem alterar documentos financeiros. Não confunda essa
garantia com `migrate:payment-codes`, que é uma migração ampla e mutante.

A conciliação procura primeiro pelo `paymentId`; para checkout PIX, usa
`checkoutSession`; e só então usa `externalReference`. Quando uma resposta de
criação de checkout PIX se perde, o desconto só volta a ficar disponível
após duas consultas conclusivas sem pagamento e depois do vencimento da sessão
mais uma margem de 15 minutos.

`PAYMENT_OVERDUE` e `PAYMENT_BANK_SLIP_CANCELLED` não liberam imediatamente a
inscrição nem o desconto: no Asaas, uma cobrança vencida ainda pode ser paga e o
cancelamento do registro do boleto não remove a cobrança. A variável
`PAYMENT_OVERDUE_GRACE_DAYS` define a carência. Depois dela, a conciliação remove
a cobrança no Asaas e somente uma resposta de exclusão confirmada encerra a
sessão local e libera o código; falhas ou respostas ambíguas mantêm a reserva.

Para desabilitar a entrada de novos códigos sem remover os históricos, use
`PAYMENT_CODES_ENABLED=false`.

Para pausar imediatamente a criação de novas sessões e cobranças sem
interromper webhooks nem conciliação, use `PAYMENT_SALES_ENABLED=false`.
Mantenha esse valor no primeiro deploy e altere para `true` somente depois dos
gates de produção descritos em `docs/PAYMENTS_ROLLOUT.md`.

## Webhook Asaas e conciliação

O endpoint de produção é `POST /api/payment/webhook/payment_notification`. O
`authToken` cadastrado no Asaas é um bearer estático derivado; ele não é uma
assinatura HMAC de cada requisição. A proteção contra replay vem do `id` único
do evento na coleção `pagamentos.webhook_eventos_v2`.

Variáveis desta versão:

- `PAYMENT_SALES_ENABLED=false` mantém novas vendas pausadas durante o rollout;
  ausente equivale a `true` apenas por compatibilidade com instalações antigas.
- `PAYMENT_EDITION_ID=CIEPS-2026` identifica a edição esperada.
- `PAYMENT_CONFIG_ID=null` é a trava da migração ampla. Ausente, `null` ou um
  ObjectId inválido impedem `migrate:payment-codes`; ela não é usada no runtime.
- `PAYMENT_RECONCILIATION_SECRET` é o segredo raiz aleatório, com pelo menos
  32 bytes. Ele gera credenciais distintas para webhook e conciliação.
- `PAYMENT_OVERDUE_GRACE_DAYS=3` mantém três dias de carência antes do
  cancelamento conciliado de cobrança vencida. A faixa aceita é 0–30; ausente
  ou inválida volta com segurança para 3.

Configuração mínima no Asaas antes de liberar a fila:

1. URL HTTPS direta, sem redirecionamento, terminando em
   `/api/payment/webhook/payment_notification`.
2. `enabled=true`, `sendType=SEQUENTIALLY` e `interrupted=true` durante o
   rollout.
3. `authToken` igual ao `webhookAuthToken` derivado e nunca igual à API key.
4. Eventos de pagamento usados pelo sistema e os eventos de checkout
   `CHECKOUT_PAID`, `CHECKOUT_CANCELED` e `CHECKOUT_EXPIRED` habilitados.
5. Depois do deploy, índice v2, testes e conciliação verificados, alterar para
   `interrupted=false` e acompanhar os Webhook Logs do Asaas.

O handler persiste o payload e devolve HTTP 200 antes do processamento
financeiro. Falhas ficam no ledger v2 com backoff e são retomadas pela rota de
conciliação. Eventos antigos que já existem em `pagamentos.webhook_eventos`
entram em quarentena sem reprocessamento automático; isso impede que as
duplicatas históricas executem novamente uma movimentação financeira.

O workflow `.github/workflows/payment-reconciliation.yml` requer dois secrets
no repositório: `PAYMENT_RECONCILIATION_URL`, com a URL completa do endpoint, e
`PAYMENT_RECONCILIATION_BEARER`, com o valor derivado `reconciliationBearer`.
Alterações em variáveis de produção só devem ser liberadas junto de um novo
deploy.
