import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('opencode-proxy', () => {
	describe('GET /.well-known/opencode', () => {
		it('returns discovery config', async () => {
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
			expect(body.config.provider.anthropic.options.baseURL).toBe(
				'https://opencode.icap.dev/v1/anthropic',
			);
			expect(body.config.provider.openai.options.baseURL).toBe(
				'https://opencode.icap.dev/v1/openai',
			);
		});
	});

	describe('proxy routes', () => {
		it('rejects requests without authorization', async () => {
			const response = await SELF.fetch('https://opencode.icap.dev/v1/anthropic/v1/messages', {
				method: 'POST',
			});
			expect(response.status).toBe(401);
			const body = (await response.json()) as { error: string };
			expect(body.error).toBe('Missing authorization');
		});

		it('rejects requests with invalid JWT', async () => {
			const response = await SELF.fetch('https://opencode.icap.dev/v1/anthropic/v1/messages', {
				method: 'POST',
				headers: { Authorization: 'Bearer not-a-valid-jwt' },
			});
			expect(response.status).toBe(401);
		});
	});

	describe('fallback', () => {
		it('returns 404 for unknown paths', async () => {
			const response = await SELF.fetch('https://opencode.icap.dev/unknown');
			expect(response.status).toBe(404);
		});
	});
});
