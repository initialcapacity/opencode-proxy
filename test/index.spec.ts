import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('integration', () => {
	it('returns discovery config from well-known endpoint', async () => {
		const response = await SELF.fetch('https://opencode.icap.dev/.well-known/opencode');
		expect(response.status).toBe(200);

		const body = await response.json();
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
});
