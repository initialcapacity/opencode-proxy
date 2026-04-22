import { describe, it, expect } from 'vitest';
import { buildDiscoveryPayload } from '../src/discovery';

describe('buildDiscoveryPayload', () => {
	const origin = 'https://opencode.icap.dev';

	it('includes cloudflared auth command', () => {
		const payload = buildDiscoveryPayload(origin);
		expect(payload.auth.command).toEqual(['cloudflared', 'access', 'login', '--no-verbose', origin]);
		expect(payload.auth.env).toBe('CF_ACCESS_TOKEN');
	});

	it('restricts to custom-named providers', () => {
		const payload = buildDiscoveryPayload(origin);
		expect(payload.config.enabled_providers).toEqual(['ic-anthropic', 'ic-openai']);
	});

	it('configures ic-anthropic with npm package and proxy base URL', () => {
		const payload = buildDiscoveryPayload(origin);
		const provider = payload.config.provider['ic-anthropic'] as Record<string, unknown>;
		expect(provider.npm).toBe('@ai-sdk/anthropic');
		expect(provider.name).toBe('IC Anthropic');
		expect(provider.env).toEqual(['CF_ACCESS_TOKEN']);
		expect((provider.options as Record<string, string>).baseURL).toBe(`${origin}/v1/anthropic`);
	});

	it('configures ic-openai with npm package and proxy base URL', () => {
		const payload = buildDiscoveryPayload(origin);
		const provider = payload.config.provider['ic-openai'] as Record<string, unknown>;
		expect(provider.npm).toBe('@ai-sdk/openai');
		expect(provider.name).toBe('IC OpenAI');
		expect(provider.env).toEqual(['CF_ACCESS_TOKEN']);
		expect((provider.options as Record<string, string>).baseURL).toBe(`${origin}/v1/openai`);
	});

	it('omits models when none are provided', () => {
		const payload = buildDiscoveryPayload(origin);
		const provider = payload.config.provider['ic-anthropic'] as Record<string, unknown>;
		expect(provider).not.toHaveProperty('models');
	});

	it('includes models when provided', () => {
		const models = {
			anthropic: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } },
			openai: { 'gpt-4o': { name: 'GPT-4o' } },
		};
		const payload = buildDiscoveryPayload(origin, models);
		const anthropic = payload.config.provider['ic-anthropic'] as Record<string, unknown>;
		const openai = payload.config.provider['ic-openai'] as Record<string, unknown>;
		expect(anthropic.models).toEqual(models.anthropic);
		expect(openai.models).toEqual(models.openai);
	});
});
