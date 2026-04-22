import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createAuthMiddleware, extractToken } from '../src/auth';
import { JwtVerifier } from '../src/jwt';
import { generateKeyPair, signJWT } from './helpers/jwt';

const TEAM_DOMAIN = 'test.cloudflareaccess.com';
const AUD = 'test-audience-tag';

type TestEnv = {
	Bindings: { CF_ACCESS_TEAM_DOMAIN: string; CF_ACCESS_AUD: string };
	Variables: { userEmail: string };
};

async function createTestApp() {
	const { publicJWK, privateKey } = await generateKeyPair();
	const fetchKeys = async () => [publicJWK as any];
	const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys);

	const app = new Hono<TestEnv>();
	app.use('/*', createAuthMiddleware(verifier));
	app.get('/test', (c) => c.json({ email: c.get('userEmail') }));

	const env = { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD };

	return { app, env, privateKey, kid: publicJWK.kid };
}

async function validToken(privateKey: CryptoKey, kid: string) {
	return signJWT(
		{
			aud: [AUD],
			email: 'user@example.com',
			iss: `https://${TEAM_DOMAIN}`,
			exp: Math.floor(Date.now() / 1000) + 3600,
			iat: Math.floor(Date.now() / 1000),
			sub: 'user-id',
		},
		privateKey,
		kid,
	);
}

describe('extractToken', () => {
	it('extracts from x-api-key header', () => {
		const req = new Request('http://localhost', { headers: { 'x-api-key': 'my-token' } });
		expect(extractToken(req)).toBe('my-token');
	});

	it('extracts from Authorization Bearer header', () => {
		const req = new Request('http://localhost', { headers: { authorization: 'Bearer my-token' } });
		expect(extractToken(req)).toBe('my-token');
	});

	it('prefers x-api-key over Authorization', () => {
		const req = new Request('http://localhost', {
			headers: { 'x-api-key': 'key-token', authorization: 'Bearer bearer-token' },
		});
		expect(extractToken(req)).toBe('key-token');
	});

	it('returns undefined when no auth headers are present', () => {
		const req = new Request('http://localhost');
		expect(extractToken(req)).toBeUndefined();
	});

	it('returns undefined for non-Bearer authorization', () => {
		const req = new Request('http://localhost', { headers: { authorization: 'Basic abc123' } });
		expect(extractToken(req)).toBeUndefined();
	});

	it('handles case-insensitive Bearer prefix', () => {
		const req = new Request('http://localhost', { headers: { authorization: 'bearer my-token' } });
		expect(extractToken(req)).toBe('my-token');
	});
});

describe('auth middleware', () => {
	it('returns 401 when no token is provided', async () => {
		const { app, env } = await createTestApp();

		const res = await app.fetch(new Request('http://localhost/test'), env);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'Missing authorization' });
	});

	it('returns 401 for an invalid token', async () => {
		const { app, env } = await createTestApp();

		const res = await app.fetch(new Request('http://localhost/test', { headers: { 'x-api-key': 'bad' } }), env);

		expect(res.status).toBe(401);
	});

	it('passes with a valid x-api-key token', async () => {
		const { app, env, privateKey, kid } = await createTestApp();
		const token = await validToken(privateKey, kid);

		const res = await app.fetch(new Request('http://localhost/test', { headers: { 'x-api-key': token } }), env);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ email: 'user@example.com' });
	});

	it('passes with a valid Authorization Bearer token', async () => {
		const { app, env, privateKey, kid } = await createTestApp();
		const token = await validToken(privateKey, kid);

		const res = await app.fetch(
			new Request('http://localhost/test', { headers: { Authorization: `Bearer ${token}` } }),
			env,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ email: 'user@example.com' });
	});

	it('returns 401 for an empty Bearer token', async () => {
		const { app, env } = await createTestApp();

		const res = await app.fetch(
			new Request('http://localhost/test', { headers: { Authorization: 'Bearer ' } }),
			env,
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'Missing authorization' });
	});

	it('treats header names case-insensitively', async () => {
		const { app, env, privateKey, kid } = await createTestApp();
		const token = await validToken(privateKey, kid);

		const res = await app.fetch(
			new Request('http://localhost/test', { headers: { 'X-API-KEY': token } }),
			env,
		);

		expect(res.status).toBe(200);
	});
});
