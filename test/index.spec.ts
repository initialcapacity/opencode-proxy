import { SELF, env, fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import { generateKeyPair, signJWT } from './helpers/jwt';

describe('integration', () => {
	beforeAll(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});

	afterEach(() => fetchMock.assertNoPendingInterceptors());

	it('returns discovery config without authentication', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/.well-known/opencode');
		expect(response.status).toBe(200);

		const body = (await response.json()) as any;
		expect(body.auth.command).toEqual([
			'cloudflared',
			'access',
			'login',
			'--no-verbose',
			'https://opencode.icap.dev',
		]);
		expect(body.auth.env).toBe('CF_ACCESS_TOKEN');
		expect(body.config.provider.anthropic.options.baseURL).toBe('https://opencode.icap.dev/v1/anthropic');
		expect(body.config.provider.openai.options.baseURL).toBe('https://opencode.icap.dev/v1/openai');
	});

	it('rejects proxy requests without authorization', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/v1/anthropic/v1/messages', {
			method: 'POST',
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Missing authorization' });
	});

	it('rejects proxy requests with invalid JWT', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/v1/anthropic/v1/messages', {
			method: 'POST',
			headers: { 'x-api-key': 'not-a-valid-jwt' },
		});

		expect(response.status).toBe(401);
	});

	it('returns landing page at root', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		const body = await response.text();
		expect(body).toContain('brew install anomalyco/tap/opencode cloudflared');
		expect(body).toContain('opencode auth login');
		expect(body).toContain('opencode.icap.dev');
	});

	it('returns 404 for unknown paths', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/unknown');

		expect(response.status).toBe(404);
	});

	it('returns 404 for unknown providers without requiring authentication', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/v1/groq/v1/messages', {
			method: 'POST',
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Unknown provider' });
	});

	it('proxies an authenticated request through the AI gateway', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		const token = await signJWT(
			{
				aud: [env.CF_ACCESS_AUD],
				email: 'user@example.com',
				iss: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
				exp: Math.floor(Date.now() / 1000) + 3600,
				iat: Math.floor(Date.now() / 1000),
				sub: 'user-id',
			},
			privateKey,
			publicJWK.kid,
		);

		fetchMock
			.get(`https://${env.CF_ACCESS_TEAM_DOMAIN}`)
			.intercept({ path: '/cdn-cgi/access/certs' })
			.reply(200, { keys: [publicJWK] });

		fetchMock
			.get('https://gateway.ai.cloudflare.com')
			.intercept({
				path: `/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_NAME}/anthropic/v1/messages`,
				method: 'POST',
				body: '{"model":"claude"}',
				headers: {
					'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
					'cf-aig-metadata': '{"userId":"user@example.com"}',
				},
			})
			.reply(200, { content: 'hello' }, { headers: { 'content-type': 'application/json' } });

		const response = await SELF.fetch('https://opencode.icap.dev/v1/anthropic/v1/messages', {
			method: 'POST',
			headers: { 'x-api-key': token, 'content-type': 'application/json' },
			body: '{"model":"claude"}',
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ content: 'hello' });
	});
});
