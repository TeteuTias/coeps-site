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
