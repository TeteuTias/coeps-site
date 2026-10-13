# Submissão excepcional individual

Uma conta pode fazer sua primeira submissão após o prazo geral, durante 24 horas.
Não há tela administrativa, nova coleção, migração ou liberação pública do prazo.

## Ativação

Depois de publicar o código, configure **no servidor do ambiente pretendido** a variável
`WORK_SUBMISSION_EXCEPTION` com um único objeto JSON:

```json
{"userId":"ID_MONGODB_DA_CONTA","editionId":"CIEPS-2026","activatedAt":"HORARIO_ISO_COM_FUSO"}
```

- `userId`: ID de 24 caracteres da conta (sem `auth0|`).
- `editionId`: identificador da edição ativa, o mesmo utilizado nos pagamentos.
- `activatedAt`: início escolhido para a liberação, em ISO 8601 com fuso, por exemplo
  `2026-10-13T18:00:00-03:00`. Neste exemplo o vencimento é `2026-10-14T18:00:00-03:00`.
  Este é apenas um exemplo, não um horário configurado pela implementação.

A versão configurada deve estar disponível **antes do início escolhido**. Em hospedagens
que aplicam variáveis somente no deploy, publique um novo deploy após configurar a variável.
O prazo conta desse horário fixo, não do primeiro login, início do processo ou redeploy.
Não use prefixo `NEXT_PUBLIC_`. Vazio, JSON inválido, horário sem fuso, outra conta,
outra edição e período fora das 24 horas não liberam a submissão.

Remova a variável e aplique a configuração para revogar a exceção. Mudar `activatedAt`
não recupera uma autorização já utilizada. A configuração não altera `trabalhos_config`.

## Garantias e limites

- O servidor identifica o usuário pela sessão. Dados enviados pelo navegador não concedem acesso.
- Somente após o encerramento do prazo geral; exige zero trabalhos na edição (incluindo legados sem edição).
- Mantém as validações de pagamento, autores, modalidade, limites e arquivos.
- O endpoint autenticado de configuração retorna apenas o vencimento da autorização daquela conta,
  com cache privado/desativado. A página pública continua exibindo o prazo geral.
- O servidor revalida a janela a cada tentativa da transação. Uma página aberta não prolonga o prazo.
- O envio usa a transação e o bloqueio por usuário/edição existentes em `trabalhos_submission_locks`.
  Dentro dela, grava o marcador `submissionException` no bloqueio e as datas da exceção em
  `Dados_do_trabalho`. O consumo ocorre junto com o trabalho e o vínculo dos anexos.
- Falha/rollback não consome a permissão; requisições concorrentes não podem consumi-la duas vezes.
  Excluir o trabalho não apaga o marcador de uso.
- Depende da infraestrutura transacional e do índice único `work_submission_lock_user_edition_unique`
  já exigidos pelo fluxo atual; não cria nem altera índices.

Os testes locais usam dependências simuladas, sem conexão a banco, Auth0, Blob ou envio de e-mail.
Não substituem homologação em ambiente real. Qualquer operação real de banco exige aprovação prévia;
operações de escrita também exigem confirmação de backup recuperável.
