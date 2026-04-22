import { describe, it, expect } from 'vitest';
import { buildDiscoveryPayload } from '../src/discovery';

describe('buildDiscoveryPayload', () => {
	const origin = 'https://opencode.icap.dev';
	const payload = buildDiscoveryPayload(origin);

	it('includes cloudflared auth command', () => {
		expect(payload.auth.command).toEqual(['cloudflared', 'access', 'login', '--no-verbose', origin]);
		expect(payload.auth.env).toBe('CF_ACCESS_TOKEN');
	});

	it('restricts to proxied providers', () => {
		expect(payload.config.enabled_providers).toEqual(['anthropic', 'openai']);
	});

	it('configures anthropic provider with proxy base URL', () => {
		expect(payload.config.provider.anthropic.env).toEqual(['CF_ACCESS_TOKEN']);
		expect(payload.config.provider.anthropic.options.baseURL).toBe(`${origin}/v1/anthropic`);
	});

	it('configures openai provider with proxy base URL', () => {
		expect(payload.config.provider.openai.env).toEqual(['CF_ACCESS_TOKEN']);
		expect(payload.config.provider.openai.options.baseURL).toBe(`${origin}/v1/openai`);
	});
});
