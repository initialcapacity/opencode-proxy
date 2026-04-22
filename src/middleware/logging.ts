import type { MiddlewareHandler } from 'hono';

export function createLoggingMiddleware(): MiddlewareHandler<{ Variables: { userEmail: string } }> {
	return async (c, next) => {
		const start = Date.now();
		await next();
		const email = c.get('userEmail') ?? 'anonymous';
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
