import { describe, it, expect } from 'vitest';
import { buildDiscoveryPayload, GITHUB_MCP_HOST } from '../src/discovery';

describe('buildDiscoveryPayload', () => {
	const origin = 'https://opencode.icap.dev';

	it('includes cloudflared auth command', () => {
		const payload = buildDiscoveryPayload(origin);
		expect(payload.auth.command).toEqual(['cloudflared', 'access', 'login', '--no-verbose', origin]);
		expect(payload.auth.env).toBe('CF_ACCESS_TOKEN');
	});

	it('restricts to custom-named providers', () => {
		const payload = buildDiscoveryPayload(origin);
		expect(payload.config.enabled_providers).toEqual(['ic-anthropic', 'ic-openai', 'ic-workers-ai']);
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

	it('configures ic-workers-ai with openai-compatible npm package and proxy base URL', () => {
		const payload = buildDiscoveryPayload(origin);
		const provider = payload.config.provider['ic-workers-ai'] as Record<string, unknown>;
		expect(provider.npm).toBe('@ai-sdk/openai-compatible');
		expect(provider.name).toBe('IC Workers AI');
		expect(provider.env).toEqual(['CF_ACCESS_TOKEN']);
		expect((provider.options as Record<string, string>).baseURL).toBe(`${origin}/v1/compat`);
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

	it('includes github mcp server config', () => {
		const payload = buildDiscoveryPayload(origin);
		expect(payload.config.mcp).toEqual({
			github: {
				type: 'remote',
				url: `https://${GITHUB_MCP_HOST}/mcp`,
				headers: { 'x-api-key': '{env:CF_ACCESS_TOKEN}' },
				enabled: true,
			},
		});
	});

	it('uses the configured github mcp host', () => {
		const payload = buildDiscoveryPayload(origin, {}, 'github-mcp.example.com');
		expect(payload.config.mcp.github).toEqual({
			type: 'remote',
			url: 'https://github-mcp.example.com/mcp',
			headers: { 'x-api-key': '{env:CF_ACCESS_TOKEN}' },
			enabled: true,
		});
	});

	it('includes the code-reviewer agent and /review command', () => {
		const payload = buildDiscoveryPayload(origin);
		const agent = payload.config.agent['code-reviewer'] as Record<string, unknown>;
		expect(agent.mode).toBe('subagent');
		expect(agent.prompt).toEqual(expect.stringContaining('IC Codex'));

		const command = payload.config.command.review as Record<string, unknown>;
		expect(command.agent).toBe('code-reviewer');
		expect(command.subtask).toBe(true);
	});
});
