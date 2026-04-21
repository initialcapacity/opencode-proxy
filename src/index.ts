import { Hono } from 'hono';
import { createHash } from 'node:crypto';

type Bindings = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	CF_ACCOUNT_ID: string;
	CF_GATEWAY_NAME: string;
	CF_AIG_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ── .well-known/opencode discovery endpoint ─────────────────────────

app.get('/.well-known/opencode', (c) => {
	const host = new URL(c.req.url).origin;

	return c.json({
		auth: {
			command: ['sh', '-c', `cloudflared access login ${host} | tail -n 1`],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: ['anthropic', 'openai'],
			provider: {
				anthropic: {
					env: ['CF_ACCESS_TOKEN'],
					options: {
						baseURL: `${host}/v1/anthropic`,
					},
				},
				openai: {
					env: ['CF_ACCESS_TOKEN'],
					options: {
						baseURL: `${host}/v1/openai`,
					},
				},
			},
		},
	});
});

// ── JWT validation ──────────────────────────────────────────────────

interface JWK {
	kid: string;
	kty: string;
	n: string;
	e: string;
	alg: string;
}

interface AccessJWTPayload {
	email: string;
	aud: string[];
	iss: string;
	exp: number;
	iat: number;
	sub: string;
}

async function fetchAccessPublicKeys(teamDomain: string): Promise<JWK[]> {
	const resp = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
	if (!resp.ok) throw new Error(`Failed to fetch Access certs: ${resp.status}`);
	const { keys } = (await resp.json()) as { keys: JWK[] };
	return keys;
}

async function importJWK(jwk: JWK): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify'],
	);
}

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function verifyAccessJWT(
	token: string,
	teamDomain: string,
	aud: string,
): Promise<AccessJWTPayload> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('Invalid JWT format');

	const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as { kid: string };
	const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as AccessJWTPayload;

	// Validate claims
	if (!payload.aud.includes(aud)) throw new Error('Invalid audience');
	if (payload.iss !== `https://${teamDomain}`) throw new Error('Invalid issuer');
	if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

	// Verify signature
	const keys = await fetchAccessPublicKeys(teamDomain);
	const jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) throw new Error('No matching key found');

	const key = await importJWK(jwk);
	const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
	const signature = base64UrlDecode(parts[2]);

	const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
	if (!valid) throw new Error('Invalid signature');

	return payload;
}

// ── Auth middleware for proxy routes ─────────────────────────────────

app.use('/v1/*', async (c, next) => {
	const authHeader = c.req.header('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ error: 'Missing authorization' }, 401);
	}

	const token = authHeader.slice(7);

	try {
		const payload = await verifyAccessJWT(token, c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD);
		c.set('userEmail' as never, payload.email);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Authentication failed';
		return c.json({ error: message }, 401);
	}

	await next();
});

// ── Proxy routes ────────────────────────────────────────────────────

function gatewayUrl(env: Bindings, provider: string, path: string): string {
	return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_NAME}/${provider}${path}`;
}

function hashEmail(email: string): string {
	return createHash('sha256').update(email).digest('hex').slice(0, 16);
}

async function proxyToGateway(c: any, provider: string): Promise<Response> {
	const env: Bindings = c.env;
	const email: string = c.get('userEmail' as never);

	// Strip the /v1/<provider> prefix to get the downstream path
	const url = new URL(c.req.url);
	const prefix = `/v1/${provider}`;
	const downstreamPath = url.pathname.slice(prefix.length) + url.search;

	const target = gatewayUrl(env, provider, downstreamPath);

	// Build forwarded headers, stripping auth/host
	const headers = new Headers(c.req.raw.headers);
	headers.delete('authorization');
	headers.delete('host');
	headers.set('cf-aig-authorization', `Bearer ${env.CF_AIG_TOKEN}`);
	headers.set('cf-aig-metadata', JSON.stringify({ userId: hashEmail(email) }));

	const resp = await fetch(target, {
		method: c.req.method,
		headers,
		body: c.req.raw.body,
	});

	return new Response(resp.body, {
		status: resp.status,
		headers: resp.headers,
	});
}

app.all('/v1/anthropic/*', (c) => proxyToGateway(c, 'anthropic'));
app.all('/v1/openai/*', (c) => proxyToGateway(c, 'openai'));

// ── Fallback ────────────────────────────────────────────────────────

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
