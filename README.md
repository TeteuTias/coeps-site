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

1. Defina `PAYMENT_EDITION_ID`, `PAYMENT_CONFIG_ID`,
   `PAYMENT_CODES_ENABLED` e `ASAAS_WEBHOOK_TOKEN` conforme `.env.example`.
2. Configure o mesmo token no cabeçalho `asaas-access-token` do webhook Asaas.
3. Execute `npm run migrate:payment-codes` uma vez por banco de dados.
4. Agende uma chamada autenticada periódica para `POST /api/payment/reconciliation`
   usando `Authorization: Bearer <PAYMENT_RECONCILIATION_SECRET>`.
5. Rode `npm run test:payments`, `npm run typecheck`, `npm run lint` e
   `npm run build` antes da publicação.

O script de migração é idempotente: identifica a edição ativa e cria os índices
de códigos, atribuições, sessões, webhooks e comprovantes. Ele não apaga dados
existentes e não cria códigos retroativos.

A conciliação procura pagamentos pela `externalReference`. Quando uma resposta
de criação de checkout PIX se perde, o desconto só volta a ficar disponível
após duas consultas conclusivas sem pagamento e depois do vencimento da sessão
mais uma margem de 15 minutos; ela não depende de consulta não documentada de
checkout no Asaas.

`PAYMENT_OVERDUE` e `PAYMENT_BANK_SLIP_CANCELLED` não liberam imediatamente a
inscrição nem o desconto: no Asaas, uma cobrança vencida ainda pode ser paga e o
cancelamento do registro do boleto não remove a cobrança. A variável
`PAYMENT_OVERDUE_GRACE_DAYS` define a carência. Depois dela, a conciliação remove
a cobrança no Asaas e somente uma resposta de exclusão confirmada encerra a
sessão local e libera o código; falhas ou respostas ambíguas mantêm a reserva.

Para desabilitar a entrada de novos códigos sem remover os históricos, use
`PAYMENT_CODES_ENABLED=false`.
