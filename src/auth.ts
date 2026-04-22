import type { MiddlewareHandler } from 'hono';
import { JwtVerifier } from './jwt';

export type AuthVariables = {
	userEmail: string;
};

// Anthropic SDK sends x-api-key, OpenAI SDK sends Authorization: Bearer
export function extractToken(request: Request): string | undefined {
	const apiKey = request.headers.get('x-api-key');
	if (apiKey) return apiKey;

	const auth = request.headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7);

	return undefined;
}

export function createAuthMiddleware<E extends { Variables: AuthVariables } = { Variables: AuthVariables }>(
	verifier: JwtVerifier,
): MiddlewareHandler<E> {
	return async (c, next) => {
		const token = extractToken(c.req.raw);

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
