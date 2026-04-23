import type { MiddlewareHandler } from 'hono';
import { JwtVerifier } from './jwt';

export type AuthVariables = {
	userEmail: string;
};

export type AuthResult = { email: string } | Response;

// Framework-agnostic authentication. Both the Hono middleware below and the
// plain Workers handler in github-mcp/index.ts call through to this.
export async function authenticate(request: Request, verifier: JwtVerifier): Promise<AuthResult> {
	const token = extractToken(request);
	if (!token) {
		return Response.json({ error: 'Missing authorization' }, { status: 401 });
	}
	try {
		const payload = await verifier.verify(token);
		return { email: payload.email };
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Authentication failed';
		return Response.json({ error: message }, { status: 401 });
	}
}

// Anthropic SDK sends x-api-key, OpenAI SDK sends Authorization: Bearer
export function extractToken(request: Request): string | undefined {
	const apiKey = request.headers.get('x-api-key');
	if (apiKey) return apiKey;

	const auth = request.headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) {
		const token = auth.slice(7).trim();
		if (token) return token;
	}

	return undefined;
}

export function createAuthMiddleware<E extends { Variables: AuthVariables } = { Variables: AuthVariables }>(
	verifier: JwtVerifier,
): MiddlewareHandler<E> {
	return async (c, next) => {
		const result = await authenticate(c.req.raw, verifier);
		if (result instanceof Response) return result;
		c.set('userEmail', result.email);
		await next();
	};
}
