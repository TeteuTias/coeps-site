import { auth0, getAuth0Client } from "./auth0";

type ApiRouteHandler = (
  request: Request,
  context?: unknown,
) => Response | Promise<Response>;

function jsonError(status: number, code: string, message: string) {
  return Response.json(
    {
      error: code,
      message,
    },
    { status },
  );
}

function isConfigurationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name.toLowerCase().includes("configuration") ||
    /missing|required|domain/i.test(error.message)
  );
}

export const getSession = (...args: any[]) => {
  return (getAuth0Client().getSession as any)(...args);
};

export function withApiAuthRequired<T extends ApiRouteHandler>(handler: T): T {
  if (!auth0) {
    return (() =>
      jsonError(
        500,
        "auth_configuration_error",
        "O serviço de autenticação não está configurado.",
      )) as unknown as T;
  }

  return (async (request: Request, context?: unknown) => {
    try {
      const session = await (getAuth0Client().getSession as any)(request);

      if (!session?.user?.sub) {
        return jsonError(
          401,
          "not_authenticated",
          "É necessário iniciar uma sessão para acessar este recurso.",
        );
      }
    } catch (error) {
      if (isConfigurationError(error)) {
        return jsonError(
          500,
          "auth_configuration_error",
          "O serviço de autenticação não está disponível.",
        );
      }

      return jsonError(
        401,
        "authentication_error",
        "Não foi possível validar a sessão.",
      );
    }

    try {
      const response = await handler(request, context);

      if (!(response instanceof Response)) {
        return jsonError(
          500,
          "invalid_api_response",
          "A API produziu uma resposta inválida.",
        );
      }

      if (response.status === 204) {
        return response;
      }

      if (response.status >= 500) {
        return jsonError(
          500,
          "internal_server_error",
          "Não foi possível concluir a solicitação.",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/\bapplication\/(?:[\w.+-]*\+)?json\b/i.test(contentType)) {
        return jsonError(
          response.ok ? 500 : response.status,
          "invalid_api_response",
          "A API produziu uma resposta em formato inesperado.",
        );
      }

      return response;
    } catch {
      return jsonError(
        500,
        "internal_server_error",
        "Não foi possível concluir a solicitação.",
      );
    }
  }) as T;
}

export const getAccessToken = async (...args: any[]) => {
  const result = await (getAuth0Client().getAccessToken as any)(...args);

  return {
    ...result,
    accessToken: result?.token,
  };
};
