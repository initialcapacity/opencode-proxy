import type { MiddlewareHandler } from 'hono';
import { JwtVerifier } from '../jwt';

type AuthEnv = {
	Bindings: {
		CF_ACCESS_TEAM_DOMAIN: string;
		CF_ACCESS_AUD: string;
	};
	Variables: {
		userEmail: string;
	};
};

export function createAuthMiddleware(
	verifierFactory?: (teamDomain: string, aud: string) => JwtVerifier,
): MiddlewareHandler<AuthEnv> {
	let verifier: JwtVerifier | undefined;

	return async (c, next) => {
		// Anthropic SDK sends x-api-key, OpenAI SDK sends Authorization: Bearer
		const authHeader = c.req.header('Authorization');
		const apiKeyHeader = c.req.header('x-api-key');

		const token = apiKeyHeader ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
		if (!token) {
			return c.json({ error: 'Missing authorization' }, 401);
		}

		verifier ??= verifierFactory
			? verifierFactory(c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD)
			: new JwtVerifier(c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD);

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
