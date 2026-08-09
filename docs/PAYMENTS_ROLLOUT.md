# Runbook de produção — pagamentos COEPS/CIEPS

Este documento descreve como preparar, homologar, liberar, monitorar e, se
necessário, interromper o fluxo de pagamentos. Ele se aplica ao site público
(`coeps-site`) e às telas financeiras do administrativo (`coeps-site-admin`).

> **Não existe garantia absoluta de zero falhas.** O objetivo deste runbook é
> transformar a liberação em uma decisão baseada em evidências. A venda só pode
> ser aberta quando os gates de código, dados, infraestrutura e configuração do
> Asaas estiverem todos aprovados. Um teste isolado, inclusive o teste de
> capacidade com 700 inscrições, não substitui os demais gates.

## 1. Decisão de go/no-go

O responsável pelo rollout deve registrar o resultado de cada gate, o horário,
o ambiente e quem aprovou. Um único item vermelho significa **NO-GO**.

### Gate A — código

- [ ] O deploy contém o ledger idempotente
  `pagamentos.webhook_eventos_v2`, processamento FIFO e conciliação.
- [ ] `PAYMENT_SALES_ENABLED=false` foi comprovado antes da criação da sessão
  automática e em todas as rotas que criam cobranças de inscrição. Nenhuma nova
  sessão `OPEN`, reserva de vaga/código ou cobrança é criada; webhook e conciliação
  continuam funcionando para o que já existia.
- [ ] PIX só libera inscrição em `PAYMENT_RECEIVED`; `PAYMENT_CONFIRMED` de PIX
  fica aguardando recebimento/revisão.
- [ ] `CHECKOUT_CREATED` recupera `checkout.id`/`orderId` pela
  `externalReference` quando o Asaas aceitou o POST, mas a resposta se perdeu.
- [ ] HTTP 429/5xx na criação mantém a sessão em `CREATING_PAYMENT` para
  conciliação; não reabre `OPEN` nem libera código para uma segunda tentativa
  potencialmente duplicada.
- [ ] O cadastro de Customer consulta primeiro
  `GET /v3/customers?externalReference=<userId>&limit=2`; um lock local permite
  no máximo um POST concorrente. Resposta perdida fica em reconciliação e o
  retry repete o GET. Mais de um Customer exige revisão manual.
- [ ] Cartão à vista e parcelado foram testados. No parcelamento, cada cobrança
  tem seu próprio `payment.id` e todas são correlacionadas pelo mesmo
  `payment.installment`.
- [ ] Estorno parcial, total, em andamento, negado e chargeback foram testados
  sem consumo ou devolução duplicada de vaga/código.
- [ ] Os testes unitários, de integração, concorrência, typecheck, lint e build
  terminaram sem erro.
- [ ] O teste de capacidade terminou com exatamente 700 vagas, nenhuma 701ª
  reserva e nenhuma sobrevenda nas tentativas concorrentes pelas vagas finais.

### Gate B — dados e MongoDB

- [ ] Há exatamente um `ingressos_config` ativo e seu `edicaoId` é exatamente
  `CIEPS-2026`.
- [ ] Datas, preços, meios aceitos, parcelamentos e soma dos lotes foram
  conferidos por duas pessoas. A capacidade total esperada é 700.
- [ ] Site e administrativo apontam para o mesmo `MONGODB_URI` e exatamente
  `MONGODB_DB=coeps2026` no deploy CIEPS-2026; os dois valores foram conferidos
  diretamente no Vercel antes do GO.
- [ ] O MongoDB é replica set ou cluster fragmentado; transações não funcionam
  em servidor standalone. A documentação do MongoDB confirma essa exigência:
  [Transactions](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/).
- [ ] Existe snapshot/backup imediatamente anterior à mudança e o procedimento
  de restauração foi validado.
- [ ] O dry-run da migração somente de índices não encontrou duplicidades nem
  divergência da edição ativa.
- [ ] Os índices foram aplicados com o mesmo digest aprovado e o script
  confirmou que o ledger legado e o evento financeiro protegido não mudaram.
- [ ] Todo pagante legado sem `pagamento.edicaoId` foi classificado manualmente
  na edição correta; não se atribui CIEPS-2026 por suposição.

### Gate C — infraestrutura

- [ ] As credenciais que existiam em scripts antigos versionados foram
  revogadas/rotacionadas no MongoDB e no provedor correspondente. Remover o
  arquivo do branch atual não invalida um segredo que continua no histórico Git.
- [ ] A URL pública do webhook é HTTPS, responde diretamente e não redireciona.
- [ ] WAF, CDN e firewall permitem o POST do Asaas; Sandbox e Produção foram
  testados separadamente. Se houver allowlist, ela foi conferida na lista
  dinâmica de [IPs oficiais do Asaas](https://docs.asaas.com/docs/official-asaas-ips).
- [ ] O endpoint persiste e devolve HTTP 200 em menos de 10 segundos. O alvo
  operacional recomendado é máximo de 8 segundos para manter margem.
- [ ] O workflow de conciliação está ativo a cada cinco minutos e uma execução
  manual autenticada terminou com HTTP 200.
- [ ] Os secrets `PAYMENT_RECONCILIATION_URL` e
  `PAYMENT_RECONCILIATION_BEARER` existem no repositório que executa o workflow.
- [ ] Alertas existem para HTTP 5xx, 401, 429, fila interrompida, backlog antigo,
  `FAILED` e `REVIEW_REQUIRED`.

### Gate D — Asaas

- [ ] A API key e a URL base pertencem ao mesmo ambiente.
- [ ] Todas as chamadas à API enviam `Content-Type`, `access_token` e um
  `User-Agent` que identifica COEPS, versão e ambiente.
- [ ] O webhook usa o `authToken` derivado correto, `enabled=true`,
  `sendType=SEQUENTIALLY`, `apiVersion=3` e a lista de eventos deste runbook.
- [ ] O e-mail de alerta do webhook pertence a uma caixa monitorada.
- [ ] Os Webhook Logs mostram HTTP 200 e a fila não está interrompida.
- [ ] Todos os cenários obrigatórios passaram primeiro no Sandbox.

## 2. Arquitetura antiga e arquitetura nova

### Três eras que não devem ser confundidas

O código que operou no evento anterior, a primeira refatoração de descontos e a
branch `plano` não são o mesmo handler. A regressão de `$elemMatch` não existia
no código de 2025; ela foi introduzida na refatoração `6290bd4`.

| Aspecto | Antigo `4a4ef95` (evento anterior) | Refatoração `6290bd4` e estado de `origin/main` `93f0b25` | Branch `plano` |
| --- | --- | --- | --- |
| Fonte principal | Histórico e correlação em `usuarios.pagamento.lista_pagamentos`; acesso em `usuarios.pagamento.situacao`. | Mistura do array legado com sessões, atribuições, códigos, conciliação e primeiro ledger de eventos. | Sessões, atribuições e ledger v2 são a trilha moderna; o array do usuário é espelho de compatibilidade. |
| Autenticação do webhook | Não validava token. | `6290bd4` introduziu token pronto em `ASAAS_WEBHOOK_TOKEN`/`PAYMENT_WEBHOOK_TOKEN`; em `origin/main` `93f0b25`, esse bloco estava comentado. | Exige somente o token de webhook derivado e recebido em `asaas-access-token`. |
| Idempotência | Não havia ledger/chave única de evento. | Introduziu claim/ledger pelo `event.id`, mas processava a regra financeira dentro da própria requisição. | Persiste payload em ledger v2 com índice único, quarentena eventos já vistos no ledger legado e processa por worker FIFO. |
| Erros e resposta | Exceções eram capturadas e, em vários caminhos, devolvidas como HTTP 200; o Asaas podia considerar entregue mesmo sem a alteração local ter sido concluída. | Passou a retornar 500 em falha e 202 em revisão. O 202 também é incompatível com a regra atual do Asaas, que considera somente 200 sucesso. | Só devolve 200 depois de persistir; falha de autenticação/persistência devolve erro para retry; resultado financeiro ocorre depois, com backoff ou revisão. |
| Busca no array legado | Não continha a projection `$elemMatch` que gerou o incidente. | `6290bd4` introduziu `$elemMatch` como projection no caminho aninhado `pagamento.lista_pagamentos`, mantido em `93f0b25`, causando `Location31275`. | Usa `$elemMatch` apenas no filtro, inclui `pagamento.lista_pagamentos: 1` como projection normal e seleciona o item em memória. |
| Logs | Tinha baixa observabilidade estruturada e não guardava fila durável de falhas. | Em `origin/main` `93f0b25`, imprimia o payload bruto recebido. | Persiste o payload para auditoria, mas registra no console somente identificadores, tipo e estado, sem despejar o objeto financeiro completo. |
| Cobertura | Tratava um conjunto menor de confirmação, vencimento e estorno. | Acrescentou códigos, PIX Checkout, conciliação e mais estados, mas deixou lacunas/regressões. | Trata criação/resultado de Checkout, PIX cautelar, parcelamento, reembolso detalhado, chargeback, falhas e recuperação. |

A documentação do MongoDB define `$elemMatch` de projection como operador que
limita o próprio campo array retornado:
[$elemMatch (projection)](https://www.mongodb.com/docs/manual/reference/operator/projection/elemmatch/).
O erro observado não prova que a lista legada era impossível de consultar; ele
prova que a projection adicionada em `6290bd4` foi escrita de forma inválida.

O fato de 2025 não ter mostrado esse erro é coerente: aquela versão não continha
a query regressiva. Ao mesmo tempo, “nenhum erro visível” não equivale a “toda
falha foi detectada”, porque o handler antigo engolia exceções e devolvia 200. A
decisão segura não é voltar cegamente nem confiar cegamente na refatoração: é
reexecutar os cenários antigos e acrescentar Checkout PIX, parcelamento,
reentrega, resposta perdida, estorno e chargeback com observabilidade.

A compatibilidade legada continua existindo para preservar o histórico do ano
anterior. Ela não deve ser usada sozinha para contar novas vendas, correlacionar
webhooks ou montar a visão financeira atual, porque os fluxos modernos podem não
gravar uma entrada idêntica nesse array.

### Núcleo atual

O modelo atual separa responsabilidades:

| Estrutura | Responsabilidade |
| --- | --- |
| `ingressos_config` | Edição ativa, datas, meios de pagamento, preços, parcelas e capacidade por lote. |
| `pagamentos.sessoes` | Ciclo da compra, reserva de vaga, método, IDs do Asaas e estado da sessão. |
| `pagamentos.atribuicoes` | Vínculo auditável entre compra, usuário, edição, código, valores e pagamento. |
| `pagamentos.webhook_eventos_v2` | Payload integral recebido, `event.id`, hash, tentativas, lease e estado de processamento. Eventos processados recebem `expiresAt` de 90 dias via [índice TTL](https://www.mongodb.com/docs/manual/core/index-ttl/); casos de revisão não devem sumir antes da resolução. |
| `pagamentos.comprovantes` | Comprovante associado à compra confirmada. |
| `pagamentos.customer_provisioning` | Lock e trilha sem PII para impedir Customer duplicado e recuperar resposta perdida da API Asaas. |
| `usuarios.pagamento.lista_pagamentos` | Espelho/histórico legado para compatibilidade, não fonte exclusiva da verdade. |

O fluxo nominal é:

1. no primeiro cadastro, o site procura Customer no Asaas pelo `externalReference`
   do usuário. Um lock local permite um único criador; somente zero resultados
   autoriza POST. Timeout não repete o POST: o retry consulta novamente;
2. o site autentica o usuário, lê somente a configuração ativa da edição de
   `PAYMENT_EDITION_ID` e cria/reserva uma sessão local;
3. capacidade e valores são calculados no servidor; a sessão e a atribuição
   guardam snapshots em centavos;
4. o site cria a cobrança/Checkout no Asaas com `externalReference` igual ao ID
   interno da compra e guarda os identificadores retornados; se a resposta da
   criação do Checkout se perder, `CHECKOUT_CREATED` recupera o ID externo;
5. o Asaas envia o evento para o webhook;
6. o endpoint valida `asaas-access-token`, persiste o payload completo com
   índice único em `(provider, eventId)` e só então devolve HTTP 200;
7. o worker com lease global busca eventos em ordem de recebimento, correlaciona
   por compra, Checkout, parcelamento, payment ID ou invoice e aplica a mudança
   em transação MongoDB;
8. uma falha temporária recebe backoff de 5 s e depois 30 s; o lease global fica
   retido até o retry para nenhum evento posterior ultrapassá-la. Na terceira
   tentativa malsucedida o evento vai para `REVIEW_REQUIRED`; a conciliação
   recupera eventos e sessões pendentes;
9. o site combina histórico legado e moderno; o administrativo lê sessões,
   atribuições e ledger modernos para mostrar pagamento, estorno, chargeback e
   saúde da fila sem expor o payload financeiro bruto ao navegador.

As leases de evento e do worker duram cinco minutos para permitir recuperação
após queda de processo. Os 5 s e 30 s são tempos mínimos de elegibilidade, não
timers garantidos: o retry acontece quando uma nova execução do worker é
disparada pelo pós-webhook ou pelo workflow periódico.

### Responsabilidade de cada repositório

| Repositório | Responsabilidade no fluxo atual |
| --- | --- |
| `coeps-site` | Autenticação do congressista, configuração ativa, cálculo de lote/valor, reserva de sessão, criação da cobrança no Asaas, ingestão e processamento de webhook, conciliação e histórico público combinado. |
| `coeps-site-admin` | Configuração e operação financeira autorizada, leitura das atribuições/sessões modernas, histórico por usuário, métricas de estorno/chargeback e visibilidade do ledger/backlog. Não substitui o site como receptor do webhook. |

No `coeps-site` antigo, confirmação e histórico dependiam principalmente de
`usuarios.pagamento.lista_pagamentos`; o webhook procurava o item e alterava o
próprio usuário. Na branch `plano`, a criação grava sessão e atribuição antes do
gateway, o webhook entra por um inbox idempotente, o worker valida cliente,
referência, método e valor, e a transação atualiza sessão, atribuição, usuário,
comprovante e código como uma unidade. A lista antiga continua apenas para
compatibilidade com telas e inscrições anteriores.

No `coeps-site-admin` antigo, o perfil e as métricas dependiam do array legado e
podiam não enxergar PIX/parcelamento modernos, estorno parcial ou chargeback. Na
branch `plano`, APIs financeiras autorizadas unem `pagamentos.atribuicoes` e
`pagamentos.sessoes`, mostram órfãos de qualquer lado como revisão, calculam
bruto, refund `DONE`, valor em risco e líquido, e consultam o ledger somente por
campos raiz sanitizados. O payload bruto e dados do pagador não são enviados ao
navegador administrativo.

O deploy dos dois repositórios deve ser versionado no registro final. Uma tela
administrativa antiga não pode ser usada para concluir que o webhook falhou se
ela estiver consultando apenas `usuarios.pagamento.lista_pagamentos`.

O índice único rejeita duplicidade de `event.id`, alinhado à recomendação do
Asaas de usar uma chave única e persistir antes do HTTP 200. Índices únicos e
parciais também impedem duas compras ativas ou dois vínculos para o mesmo ID do
gateway; veja [Index Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/).

### Regras financeiras importantes

- **PIX:** a documentação do Asaas informa que, para pessoa física, o estado
  `CONFIRMED` pode ser um bloqueio cautelar de até 72 horas e depois virar
  `RECEIVED` ou `REFUNDED`. Portanto a inscrição só é liberada em
  `PAYMENT_RECEIVED`: [Create new payment](https://docs.asaas.com/reference/create-new-payment).
- **Cartão à vista:** `PAYMENT_CONFIRMED` pode liberar a inscrição após validar
  usuário, cliente, valor, método e identificadores.
- **Parcelado:** cada parcela tem seu próprio payment ID e compartilha o ID do
  parcelamento; isso é comportamento oficial do Asaas:
  [Installments](https://docs.asaas.com/docs/installments). O sistema deve
  guardar cada cobrança e jamais exigir que todas tenham o ID da primeira.
- **Estorno:** a existência de `payment.refunds` não significa estorno concluído.
  Somente itens com `status=DONE` entram no total devolvido; `PENDING` aguarda e
  `CANCELLED` não conta. Deve-se iterar o array inteiro:
  [Refunds](https://docs.asaas.com/docs/refunds).
- **Chargeback:** pedido, disputa, espera de reversão e resultado são estados
  distintos. A sequência oficial pode terminar em novo
  `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` ou em `PAYMENT_REFUNDED`:
  [Events for Payments](https://docs.asaas.com/docs/payment-events).
- **Vencido:** `PAYMENT_OVERDUE` não é pagamento recebido e não deve liberar
  acesso. A carência local é controlada por `PAYMENT_OVERDUE_GRACE_DAYS`; a
  conciliação confirma a situação no gateway antes de encerrar a sessão.
- **Checkout:** criar o Checkout só inicia a jornada. O resultado é assíncrono e
  deve ser acompanhado por Webhook/API, não pela resposta de criação:
  [Create new Checkout](https://docs.asaas.com/reference/create-new-checkout).

## 3. Variáveis de ambiente

### Aplicação de produção

Os valores secretos devem ficar no cofre de secrets da plataforma, nunca no
Git. `null` abaixo é literal e deliberado quando indicado.

| Variável | Onde configurar | Valor/formato de produção | Função e regra |
| --- | --- | --- | --- |
| `MONGODB_URI` | site e admin | segredo da conexão de produção | Deve apontar para replica set/cluster com transações. |
| `MONGODB_DB` | site e admin | `coeps2026` | Confirmar no Vercel antes do GO e manter idêntico nos dois projetos. |
| `maxPoolSizeValue` | site e admin | valor dimensionado; referência `100` | Limite do pool MongoDB; não aumentar sem medir conexões. |
| `ASAAS_API_URL` | site | `https://api.asaas.com/v3` | URL oficial de produção. |
| `ASAAS_API_KEY` | site | chave com prefixo de produção | Segredo da API; nunca enviar ao frontend. |
| `ASAAS_URL_CALLBACK` | site | `https://<dominio>/pagamentos` | Retorno visual; não confirma financeiramente a compra. |
| `ASAAS_URL_REDIRECT` | site | `https://<dominio>/pagamentos` | Retorno de cancelamento/expiração. |
| `PAYMENT_SALES_ENABLED` | site | `false` inicialmente; `true` só após GO | Kill switch de novas compras; ausente equivale a `true` por compatibilidade. |
| `PAYMENT_CODES_ENABLED` | site | `false` inicialmente | Bloqueia entrada/uso de novos códigos sem apagar históricos. |
| `PAYMENT_EDITION_ID` | site e admin | `CIEPS-2026` | Exige exatamente a configuração ativa dessa edição; divergência falha fechada. |
| `PAYMENT_CONFIG_ID` | somente migração ampla | `null` até aprovação | Ausente, `null` ou inválido bloqueiam `migrate:payment-codes`; não é runtime. |
| `PAYMENT_RECONCILIATION_SECRET` | site | raiz aleatória de pelo menos 32 bytes | Deriva duas credenciais; a raiz nunca é enviada ao Asaas ou workflow. |
| `PAYMENT_OVERDUE_GRACE_DAYS` | site | `3` | Aceita 0–30; ausente ou inválida usa 3. |

A API key do Asaas é enviada pela aplicação no header `access_token`, não em
`Authorization: Bearer`. Sandbox e Produção têm chaves e URLs diferentes; a
documentação oficial também pede `Content-Type: application/json` e um
`User-Agent` identificável em todas as chamadas (obrigatório para novas contas
raiz). Ela traz URLs, prefixos e o procedimento de geração:
[Authentication](https://docs.asaas.com/docs/authentication).

A divergência visual já observada entre ambientes é compatível com bancos
diferentes: o ambiente local antigo estava em `MONGODB_DB=coeps2025` e, por isso,
mostrava COEPS-2025; Produção em `coeps2026` mostrava CIEPS-2026. Compartilhar o
mesmo cluster/URI não basta: o nome selecionado depois da conexão também precisa
ser exatamente o mesmo nos dois repositórios.

### Variáveis que não existem neste desenho

- Não configurar `ASAAS_WEBHOOK_TOKEN` nem `PAYMENT_WEBHOOK_TOKEN`.
- Não depender de `COEPS_ACTIVE_EDITION_ID`: ele é apenas fallback legado;
  produção deve sempre definir `PAYMENT_EDITION_ID` explicitamente.
- `webhookAuthToken` e `reconciliationBearer` são saídas derivadas, não variáveis
  de entrada da aplicação.
- O bearer da conciliação é uma credencial interna do COEPS. Ele não é o token
  da API do Asaas e não autentica o webhook.

### Secrets do workflow de conciliação

No repositório que executa `.github/workflows/payment-reconciliation.yml`:

| Secret | Valor |
| --- | --- |
| `PAYMENT_RECONCILIATION_URL` | `https://<dominio>/api/payment/reconciliation` |
| `PAYMENT_RECONCILIATION_BEARER` | saída `reconciliationBearer` do comando de derivação |

## 4. Gerar e instalar as credenciais derivadas

O Asaas não cria o `authToken` por nós. Ele aceita um valor de 32 a 255
caracteres, armazena-o na configuração do webhook e o devolve em
`asaas-access-token`. Veja [Create new Webhook](https://docs.asaas.com/reference/create-new-webhook)
e [Webhooks](https://docs.asaas.com/docs/webhooks-3).

O script local usa HMAC-SHA-256 com três componentes: segredo raiz, finalidade
(`webhook` ou `reconciliation`) e host do ambiente Asaas. Isso é derivação
criptográfica determinística, **não criptografia reversível**. A mesma raiz no
mesmo host gera o mesmo resultado; mudar a raiz ou o host muda os tokens.
O valor derivado do webhook é estático: ele não é uma assinatura HMAC diferente
para cada payload. Por isso, a segurança também depende de HTTPS, armazenamento
do token, validação dos identificadores/valores e idempotência por `event.id`.

Use uma raiz diferente em Sandbox e Produção. Execute em terminal seguro e não
copie a saída para chat, ticket, log de CI ou documento:

```powershell
$env:ASAAS_API_URL = 'https://api.asaas.com/v3'
npm run payment:credentials -- --generate --show
```

1. salve `generatedRootSecret` como `PAYMENT_RECONCILIATION_SECRET` da aplicação;
2. salve `webhookAuthToken` como `authToken` do webhook no Asaas;
3. salve `reconciliationBearer` como `PAYMENT_RECONCILIATION_BEARER` do workflow;
4. apague a saída do terminal compartilhado e não guarde os derivados no banco.

Para regenerar as saídas a partir da raiz já armazenada:

```powershell
$env:ASAAS_API_URL = 'https://api.asaas.com/v3'
$env:PAYMENT_RECONCILIATION_SECRET = '<raiz-do-cofre>'
npm run payment:credentials -- --show
```

Na rotação, primeiro feche vendas, instale a nova raiz no deploy, atualize
coordenadamente `authToken` e o bearer do workflow, teste os dois endpoints e só
então reabra. Trocar apenas um dos três valores causa 401 e backlog.

## 5. Migração do MongoDB

### Caminho recomendado: somente índices

O script `setup-payment-indexes.mjs` lê dados no dry-run, exige uma única edição
ativa, procura duplicidades e calcula um digest. No apply, cria somente índices;
não reclassifica usuários nem altera documentos financeiros.

Antes de rodar:

1. mantenha `PAYMENT_SALES_ENABLED=false`;
2. faça snapshot/backup;
3. confirme `MONGODB_URI`, `MONGODB_DB` e `PAYMENT_EDITION_ID` em voz alta com
   outro responsável;
4. escolha um `eventId` real e conhecido do ledger legado para proteger, se o
   ledger legado não estiver vazio.

Dry-run sem ledger legado:

```powershell
npm run migrate:payment-indexes -- --database "$env:MONGODB_DB" --edition CIEPS-2026
```

Dry-run com ledger legado:

```powershell
npm run migrate:payment-indexes -- --database "$env:MONGODB_DB" --edition CIEPS-2026 --protect-event '<EVENT_ID>'
```

Revise `activeConfigId`, `legacySnapshot`, `protectedFinancial`, `blockers` e
cada item de `planned`. Se houver blocker, pare e corrija a causa; não remova
dados para “fazer o índice passar”.

Aplicação, usando exatamente o digest recém-revisado e os mesmos argumentos:

```powershell
npm run migrate:payment-indexes -- --database "$env:MONGODB_DB" --edition CIEPS-2026 --protect-event '<EVENT_ID>' --apply --confirm '<DIGEST>'
```

Depois, arquive a saída que contém `legacyPreserved=true` e
`protectedFinancialPreserved=true`, sem secrets. Índices únicos fazem o MongoDB
rejeitar valores duplicados; índices parciais limitam a restrição aos documentos
que satisfazem o filtro, conforme
[Index Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/).

### Migração ampla: bloqueada por padrão

`npm run migrate:payment-codes` não é requisito automático do rollout e não tem
o mesmo perfil de risco do script de índices. Ele pode:

- desativar outras configurações ativas e ativar o documento de
  `PAYMENT_CONFIG_ID` como a edição informada;
- gravar a contagem de pagantes legados na configuração;
- normalizar estados de sessões legadas;
- criar atribuições para sessões antigas;
- criar índices adicionais.

O script agora bloqueia a execução quando encontra pagante legado sem
`pagamento.edicaoId`; essa proteção evita classificar inscrições antigas como
CIEPS-2026 por suposição. Mesmo assim, a operação é ampla e exige change request,
snapshot e revisão específica.

`PAYMENT_CONFIG_ID=null` é proposital: ausente, `null` ou um valor que não seja
ObjectId fazem o script parar antes de escrever. Não existe fallback de ID
legado. Só substitua `null` durante a janela aprovada, depois de confirmar no
banco que o ObjectId é exatamente o `ingressos_config` de CIEPS-2026. O caminho
preferencial é não executar a migração ampla enquanto o index-only for suficiente.

## 6. Configuração oficial do webhook Asaas

Cadastre ou atualize um webhook dedicado com:

```json
{
  "name": "COEPS pagamentos producao",
  "url": "https://<dominio>/api/payment/webhook/payment_notification",
  "email": "<caixa-monitorada>",
  "enabled": true,
  "interrupted": true,
  "apiVersion": 3,
  "authToken": "<webhookAuthToken>",
  "sendType": "SEQUENTIALLY",
  "events": [
    "PAYMENT_CREATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_BANK_SLIP_CANCELLED",
    "PAYMENT_DELETED",
    "PAYMENT_REFUNDED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_REFUND_DENIED",
    "PAYMENT_RECEIVED_IN_CASH_UNDONE",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
    "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    "PAYMENT_RESTORED",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
    "CHECKOUT_CREATED",
    "CHECKOUT_PAID",
    "CHECKOUT_CANCELED",
    "CHECKOUT_EXPIRED"
  ]
}
```

Use `interrupted=true` somente durante a preparação. Depois do deploy, dos
índices, do teste de token e da validação dos logs, altere para
`interrupted=false`. Os parâmetros oficiais estão em
[Create new Webhook](https://docs.asaas.com/reference/create-new-webhook), os
eventos de pagamento em [Events for Payments](https://docs.asaas.com/docs/payment-events)
e os de Checkout em [Events for Checkout](https://docs.asaas.com/docs/checkout-events).

Regras obrigatórias:

- a URL deve responder diretamente; o Asaas não segue 301, 302, 307 ou 308;
- somente HTTP 200 é considerado sucesso pelo comportamento atual do Asaas;
- o Asaas espera no máximo 10 segundos;
- entrega é “at least once”; o mesmo `event.id` pode chegar novamente;
- após 15 falhas consecutivas a fila pode ser interrompida;
- eventos em fila interrompida ficam disponíveis por até 14 dias;
- `SEQUENTIALLY` preserva a ordem de envio, e o worker local também deve
  processar em ordem crescente;
- só devolver 200 depois de persistir o evento; processamento financeiro ocorre
  em segundo plano;
- payloads podem ganhar novos campos; o parser não pode falhar por campos
  desconhecidos.

Esses comportamentos estão documentados em
[Webhooks FAQ](https://docs.asaas.com/docs/webhooks-faq) e
[How to implement idempotency in Webhooks](https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks).

### Teste mínimo do endpoint antes de liberar a fila

- token ausente ou incorreto: 401 e nenhum documento novo;
- ledger/índice indisponível: 503, para que o Asaas tente novamente;
- JSON inválido: 400 e nenhum efeito financeiro;
- evento válido novo: persistência concluída e HTTP 200;
- mesmo `event.id` novamente: HTTP 200, uma única entrada e um único efeito;
- evento já existente no ledger legado: quarentena, HTTP 200 e nenhum replay
  financeiro.

## 7. Homologação obrigatória no Sandbox

Sandbox e Produção são ambientes independentes. Use banco, raiz derivadora,
API key e webhook exclusivos de Sandbox. O Asaas recomenda homologar o fluxo
completo antes de produção:
[Sandbox](https://docs.asaas.com/docs/sandbox).

Para cada caso, guarde `compraId`, `event.id`, `payment.id`, `checkout.id` ou
`installment`, estados antes/depois, resposta HTTP e resultado no admin.

### Autenticação, replay e ordem

- [ ] API key de Sandbox com `https://api-sandbox.asaas.com/v3` funciona; chave
  cruzada com Produção falha.
- [ ] `webhookAuthToken` de Sandbox é aceito; token de Produção é rejeitado.
- [ ] Reenvio do mesmo evento não duplica inscrição, comprovante, consumo de
  código ou contagem de lote.
- [ ] Dois eventos distintos da mesma cobrança são processados na ordem do
  ledger, mesmo quando os callbacks assíncronos são disparados juntos.
- [ ] Falha temporária sai de `FAILED` pelo retry/conciliação e não pula um
  evento financeiro anterior.
- [ ] Resposta 429/5xx simulada na criação deixa a compra em conciliação e uma
  nova tentativa do usuário não cria outra cobrança.

### Cadastro de Customer

- [ ] Duas requisições concorrentes para o mesmo usuário produzem um único POST.
- [ ] A consulta usa `externalReference` do usuário e reutiliza exatamente um
  Customer existente.
- [ ] Timeout após o Asaas aceitar a criação retorna 503; o retry faz novo GET,
  recupera o ID e não executa segundo POST.
- [ ] Dois Customers para o mesmo `externalReference` ficam em
  `REVIEW_REQUIRED`, sem escolher um silenciosamente.
- [ ] O `externalReference` do Customer é o ID do usuário; o da cobrança e do
  Checkout é o `compraId`. Esses domínios não podem ser misturados.

O Asaas permite Customers duplicados e atribui à integração a prevenção por
consulta, `externalReference` ou reutilização do ID armazenado:
[Create new customer](https://docs.asaas.com/reference/create-new-customer) e
[List customers](https://docs.asaas.com/reference/list-customers).

### PIX

- [ ] Criar Checkout PIX e conferir `externalReference`, URL e expiração.
- [ ] Simular resposta perdida na criação: `CHECKOUT_CREATED` correlaciona pela
  `externalReference`, grava `checkout.id`/`orderId` e permite a conciliação.
- [ ] `CHECKOUT_PAID` é correlacionado ao pagamento correto.
- [ ] Fixture/evento `PAYMENT_CONFIRMED` de PIX não libera inscrição e registra
  `PIX_CONFIRMED_AWAITING_RECEIPT`.
- [ ] `PAYMENT_RECEIVED` libera exatamente uma inscrição e consome o desconto
  exatamente uma vez.
- [ ] `CHECKOUT_EXPIRED`/`CHECKOUT_CANCELED` não libera inscrição e só libera a
  reserva de código conforme a regra de sessão.
- [ ] Resposta perdida na criação é recuperada pela conciliação sem criar uma
  segunda cobrança.

### Cartão à vista

- [ ] Cartão de sucesso cria a cobrança, recebe webhook e confirma a inscrição.
- [ ] Cartões de recusa não confirmam e não consomem código/vaga
  definitivamente.
- [ ] Evento de captura recusada e reprovação de risco são tratados.
- [ ] Duplicata de `PAYMENT_CONFIRMED` não duplica efeitos.

O Asaas publica cartão de sucesso `4444 4444 4444 4444`, CCV `123` e validade
futura, além dos cartões de falha, em
[Testing Credit Card Payment](https://docs.asaas.com/docs/testing-credit-card-payment).

### Cartão parcelado

- [ ] Testar 2x e o maior parcelamento oferecido pela configuração.
- [ ] A requisição usa `installmentCount` e `totalValue` somente quando há duas
  ou mais parcelas; 1x usa `value`.
- [ ] O ID do parcelamento é guardado e cada `payment.id` recebido é registrado.
- [ ] O valor esperado do evento é o valor da parcela, não o total inteiro.
- [ ] A segunda parcela, com payment ID diferente, não vira
  `PAYMENT_ID_MISMATCH`.
- [ ] Estorno de uma única parcela não é confundido automaticamente com estorno
  integral da inscrição; o caso vai para revisão conforme a política financeira.
- [ ] A política de acesso após a primeira confirmação e a política para parcela
  futura inadimplente foram aprovadas por escrito pelo financeiro.

A API diferencia `value` de cobrança única e
`installmentCount` + `installmentValue`/`totalValue` para duas ou mais parcelas:
[Create new payment](https://docs.asaas.com/reference/create-new-payment).

### Estorno e chargeback

- [ ] `PAYMENT_REFUND_IN_PROGRESS` mantém o caso aguardando.
- [ ] `PAYMENT_PARTIALLY_REFUNDED` soma somente itens `DONE` e não trata o total
  como devolvido.
- [ ] `PAYMENT_REFUND_DENIED` fica visível para revisão.
- [ ] `PAYMENT_REFUNDED` integral atualiza sessão, atribuição, usuário,
  comprovante, vaga e código uma única vez.
- [ ] Chargeback solicitado/disputado remove o caso da receita limpa e exige
  ação financeira.
- [ ] Disputa ganha + `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` + nova confirmação
  não cria segunda inscrição.
- [ ] Disputa perdida + `PAYMENT_REFUNDED` não aplica estorno duas vezes.
- [ ] O admin mostra valores devolvidos, status e comprovante sem expor o
  payload bruto do webhook.

O Sandbox possui limitações em alguns testes de disputa de chargeback; registre
o que foi simulado por evento/fixture e o que foi executado pela interface. A
documentação mantém a lista de restrições em
[FAQ - Sandbox](https://docs.asaas.com/docs/faq-sandbox).

## 8. Ensaio de capacidade e plano para 700 inscrições

“Suporta 700 vagas” envolve três testes diferentes:

1. **Regra de capacidade:** popular 690 reservas, disputar as 10 últimas com
   concorrência e provar exatamente 10 sucessos; depois provar que a 701ª falha.
2. **Consistência financeira:** repetir e reordenar webhooks, forçar erros e
   provar que não há inscrição/código/vaga duplicados.
3. **Vazão operacional:** medir criação de cobrança, persistência do webhook,
   backlog, conciliação, MongoDB e telas administrativas sob carga crescente.

Não crie 700 cobranças reais para “testar carga”. Faça 700 sessões/reservas com
adaptador de gateway ou fixtures no ambiente de teste e um conjunto
representativo ponta a ponta no Sandbox. O Asaas limita a conta a 25.000
requisições a cada 12 horas, pode aplicar limites específicos e retorna 429; há
também limite de 50 GETs concorrentes:
[API limits](https://docs.asaas.com/reference/api-limits).

### Rampa de carga

- [ ] 1 compra de cada método e estado crítico.
- [ ] 10 compras concorrentes.
- [ ] 50 compras, incluindo duplicatas e falhas temporárias.
- [ ] 100 compras com medição de p50/p95/p99 e backlog.
- [ ] 700 sessões internas, com disputa concorrente nas vagas 691–700.
- [ ] Provisionamento concorrente de Customers com gateway simulado confirma
  zero duplicata, recuperação de resposta perdida e nenhum POST real em massa.
- [ ] Teste de recuperação com backlog artificial equivalente ao pior caso
  acordado, sem chamar a API real 700 vezes.

Critérios mínimos:

- zero sobrevenda e zero consumo duplicado;
- zero evento financeiro perdido;
- zero `FAILED` ao fim da janela de recuperação;
- todo `REVIEW_REQUIRED` explicado por cenário deliberado;
- webhook ingress abaixo de 10 s em 100% das amostras, alvo interno abaixo de
  8 s;
- nenhum 429; se ocorrer, teste reprovado até implementar/validar backoff;
- backlog volta a zero dentro do SLO definido antes do go-live;
- contagem de vendas, inscrições, atribuições e comprovantes reconcilia.

### Capacidade atual de recuperação

O worker disparado após a ingestão tenta drenar até 1.000 eventos, respeitando
um orçamento de 50 segundos. O workflow chama a conciliação a cada cinco
minutos; cada chamada tenta drenar até 1.000 eventos por no máximo 45 segundos e
depois inspeciona até 25 sessões. Esses números são **tetos**, não promessa de
vazão: um evento que exige consulta ao Asaas, contenção MongoDB, retry ou revisão
consome parte relevante do orçamento.

Cada claim usa lease de cinco minutos. O backoff de 5 s/30 s apenas torna o
evento elegível; sem uma nova invocação do worker ele não é executado naquele
instante. Por isso o workflow de cinco minutos é recuperação, não um cronômetro
exato nem substituto para monitorar a idade do backlog.

Portanto não se deve calcular recuperação como `700 / 1000 = uma execução`. A
estimativa operacional correta é medir quantos eventos reais representativos o
worker conclui em 45 segundos e calcular
`ceil(backlog / eventos_medidos_por_execucao) * 5 minutos`, adicionando margem
para falhas e limites da API. O gate exige um ensaio de backlog antes do GO; se o
SLO não for atendido, é necessário dimensionar worker/frequência antes de abrir
as 700 vendas.

## 9. Canário de produção

### Preparação

1. deploy com `PAYMENT_SALES_ENABLED=false` e `PAYMENT_CODES_ENABLED=false`;
2. aplique somente os índices aprovados;
3. instale credenciais, workflow e webhook ainda `interrupted=true`;
4. teste autenticação, persistência, duplicata e conciliação;
5. altere o webhook para `interrupted=false` e confirme HTTP 200 nos logs;
6. mantenha vendas fechadas até backlog zero.

### Abertura controlada

1. defina `PAYMENT_SALES_ENABLED=true` e faça o deploy controlado;
2. execute uma compra real autorizada de baixo risco e confira Asaas, site,
   MongoDB e admin;
3. execute um segundo método e, se aplicável, um parcelamento;
4. observe pelo menos duas execuções da conciliação;
5. avance para uma janela pequena com limite operacional de inscrições;
6. só aumente após backlog zero, nenhuma divergência e aprovação conjunta de
   engenharia e financeiro.

Se não existe mecanismo de coorte/percentual no código, não chame uma abertura
global de “10%”. Use janela curta, acompanhe a contagem e esteja pronto para
redefinir `PAYMENT_SALES_ENABLED=false` com novo deploy.

## 10. Monitoramento e alarmes

### Asaas

- Webhook Logs: HTTP retornado, duração, mensagem e payload do evento.
- Fila: ativa/interrompida, falhas consecutivas e idade do item mais antigo.
- API: 401, 429 e headers `RateLimit-Limit`, `RateLimit-Remaining` e
  `RateLimit-Reset`.

### Aplicação e MongoDB

Monitorar por edição e por intervalo:

- `pagamentos.webhook_eventos_v2` por `status`;
- `pagamentos.customer_provisioning` por `PROCESSING`,
  `RECONCILIATION_REQUIRED`, `REVIEW_REQUIRED`, `FAILED` e idade da lease;
- idade do `PENDING`/`FAILED` mais antigo;
- maior `attempts`, `lastError` e quantidade de `REVIEW_REQUIRED` por motivo;
- sessões por `OPEN`, `CREATING_PAYMENT`, `PAYMENT_PENDING`,
  `PAYMENT_REVIEW_REQUIRED`, `CONFIRMED`, `REFUNDED`, `CANCELLED` e `EXPIRED`;
- atribuições `CONFIRMADA` versus sessões `CONFIRMED`;
- `paymentId`, `checkoutId` e `eventId` duplicados — esperado zero;
- estornos concluídos em centavos e chargebacks abertos;
- vagas reservadas + confirmadas + legado classificado, nunca acima de 700;
- duração/resultado do workflow de conciliação;
- conexões MongoDB, latência e abortos de transação;
- HTTP 5xx/401/429 das rotas de pagamento.

Limiares iniciais de incidente:

- qualquer sobrevenda, duplicidade financeira ou divergência de valor;
- qualquer evento financeiro sem correlação;
- `FAILED` persistente após duas execuções da conciliação;
- `PENDING` mais antigo acima de 10 minutos durante rollout;
- crescimento contínuo do backlog por três coletas;
- fila do Asaas interrompida;
- qualquer 429 em produção durante o canário;
- mais de um `ingressos_config` ativo ou edição diferente de `CIEPS-2026`.

## 11. Kill switch, contenção e rollback

### Contenção imediata

1. defina `PAYMENT_SALES_ENABLED=false` e faça o deploy; isso bloqueia novas
   sessões automáticas, reservas e cobranças, mas mantém webhook e conciliação
   para pagamentos já iniciados;
2. não desligue webhook/conciliação como primeira ação;
3. registre horário, último `compraId`, último `event.id` e tamanho do backlog;
4. preserve logs e payloads do ledger; não apague nem edite eventos manualmente;
5. classifique o incidente: criação, autenticação, fila, correlação, valor,
   capacidade, estorno ou visualização administrativa.

### Quando interromper a fila no Asaas

Use `interrupted=true` somente se o endpoint estiver causando efeito financeiro
incorreto e nem o kill switch nem a correção de processamento contiverem o
problema. A fila interrompida acumula eventos, mas o Asaas os conserva por no
máximo 14 dias. Mantenha alerta diário e reative apenas com endpoint idempotente,
backlog dimensionado e operador acompanhando.

### Rollback de aplicação

- mantenha `PAYMENT_SALES_ENABLED=false`;
- faça rollback somente para uma versão que ainda entenda o ledger v2, o token
  derivado e a conciliação;
- não volte para o handler que processava diretamente o array legado com a
  projection `$elemMatch` problemática;
- não volte ao `4a4ef95` como rollback automático: ele não tinha autenticação ou
  idempotência e podia transformar exceção interna em HTTP 200;
- não troque API key, raiz, authToken e bearer simultaneamente com rollback de
  código, salvo se o incidente for de credencial;
- após rollback, processe primeiro duplicatas controladas e um evento pendente,
  depois drene em lotes observados.

### Rollback de dados

- índices do caminho index-only são aditivos e protegem idempotência; não os
  remova no meio do incidente sem análise específica;
- não tente “desfazer” migração ampla com updates manuais improvisados;
- se a migração ampla corrompeu classificação/configuração, mantenha vendas
  fechadas, interrompa writers e restaure o snapshot segundo o plano aprovado;
- depois de restaurar, reconcilie eventos que chegaram após o snapshot antes de
  reabrir vendas.

## 12. Registro final de aprovação

Preencher antes do GO:

| Campo | Valor |
| --- | --- |
| Commit/deploy do site | |
| Commit/deploy do admin | |
| Banco e edição | |
| Snapshot | |
| Digest da migração index-only | |
| ID do webhook Asaas | |
| Fingerprint do token, sem revelar o token | |
| Resultado Sandbox | |
| Resultado carga/capacidade | |
| Resultado canário | |
| Backlog no momento do GO | |
| Aprovação engenharia | |
| Aprovação financeiro | |
| Horário do GO | |
| Responsável pelo kill switch | |

## Referências oficiais

- Asaas — [Authentication](https://docs.asaas.com/docs/authentication)
- Asaas — [Create new Webhook](https://docs.asaas.com/reference/create-new-webhook)
- Asaas — [Webhooks FAQ](https://docs.asaas.com/docs/webhooks-faq)
- Asaas — [How to implement idempotency in Webhooks](https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks)
- Asaas — [Events for Payments](https://docs.asaas.com/docs/payment-events)
- Asaas — [Events for Checkout](https://docs.asaas.com/docs/checkout-events)
- Asaas — [Create new payment](https://docs.asaas.com/reference/create-new-payment)
- Asaas — [Create new customer](https://docs.asaas.com/reference/create-new-customer)
- Asaas — [List customers](https://docs.asaas.com/reference/list-customers)
- Asaas — [Create new Checkout](https://docs.asaas.com/reference/create-new-checkout)
- Asaas — [Installments](https://docs.asaas.com/docs/installments)
- Asaas — [Refunds](https://docs.asaas.com/docs/refunds)
- Asaas — [Sandbox](https://docs.asaas.com/docs/sandbox)
- Asaas — [Testing Credit Card Payment](https://docs.asaas.com/docs/testing-credit-card-payment)
- Asaas — [API limits](https://docs.asaas.com/reference/api-limits)
- Asaas — [Official Asaas IP Addresses](https://docs.asaas.com/docs/official-asaas-ips)
- MongoDB — [Enforce Data Consistency with Transactions](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/)
- MongoDB — [Index Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)
- MongoDB — [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
- MongoDB — [$elemMatch projection](https://www.mongodb.com/docs/manual/reference/operator/projection/elemmatch/)
