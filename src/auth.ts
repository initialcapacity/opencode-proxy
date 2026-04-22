import type { MiddlewareHandler } from 'hono';
import { JwtVerifier } from './jwt';

export type AuthVariables = {
	userEmail: string;
};

export function createAuthMiddleware<E extends { Variables: AuthVariables } = { Variables: AuthVariables }>(
	verifier: JwtVerifier,
): MiddlewareHandler<E> {
	return async (c, next) => {
		// Anthropic SDK sends x-api-key, OpenAI SDK sends Authorization: Bearer
		const apiKeyHeader = c.req.header('x-api-key');
		const authHeader = c.req.header('Authorization');
		const token = apiKeyHeader ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

		if (!token) {
			return c.json({ error: 'Missing authorization' }, 401);
		}

		try {
			const payload = await verifier.verify(token);
			c.set('userEmail', payload.email);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Authentication failed';
			return c.json({ error: message }, 401);
		}

		await next();
	};
}
