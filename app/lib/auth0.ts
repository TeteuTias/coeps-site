import { Auth0Client } from "@auth0/nextjs-auth0/server";

function normalizeDomain(value?: string) {
  return value
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function normalizeAppBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "");
}

const auth0Domain =
  normalizeDomain(process.env.AUTH0_DOMAIN) ||
  normalizeDomain(process.env.AUTH0_ISSUER_BASE_URL);

const appBaseUrl =
  normalizeAppBaseUrl(process.env.APP_BASE_URL) ||
  normalizeAppBaseUrl(process.env.AUTH0_BASE_URL);

export const isAuth0Configured = Boolean(auth0Domain);

export const auth0 = isAuth0Configured
  ? new Auth0Client({
      domain: auth0Domain,
      appBaseUrl,
      signInReturnToPath: "/painel",
    })
  : null;

export function getAuth0Client() {
  if (!auth0) {
    throw new Error("Auth0 is not configured.");
  }

  return auth0;
}
