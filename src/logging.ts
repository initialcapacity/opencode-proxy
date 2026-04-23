import type { MiddlewareHandler } from "hono";
import type { AuthVariables } from "./auth";

export function createLoggingMiddleware<
  E extends { Variables: AuthVariables } = { Variables: AuthVariables },
>(): MiddlewareHandler<E> {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const email = c.get("userEmail") ?? "anonymous";
    console.log(
      JSON.stringify({
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        user: email,
        duration: Date.now() - start,
      }),
    );
  };
}
