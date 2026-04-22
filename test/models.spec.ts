import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { ModelCatalog, type FetchFn } from '../src/models';

const modelsDevResponse = {
	anthropic: {
		id: 'anthropic',
		npm: '@ai-sdk/anthropic',
		name: 'Anthropic',
		models: {
			'claude-sonnet-4-5': {
				id: 'claude-sonnet-4-5',
				name: 'Claude Sonnet 4.5',
				limit: { context: 200000, output: 64000 },
			},
		},
	},
	openai: {
		id: 'openai',
		npm: '@ai-sdk/openai',
		name: 'OpenAI',
		models: {
			'gpt-4o': {
				id: 'gpt-4o',
				name: 'GPT-4o',
				limit: { context: 128000, output: 16384 },
			},
		},
	},
	'cloudflare-workers-ai': {
		id: 'cloudflare-workers-ai',
		npm: '@ai-sdk/openai-compatible',
		name: 'Cloudflare Workers AI',
		models: {
			'@cf/meta/llama-3.1-8b-instruct': {
				id: '@cf/meta/llama-3.1-8b-instruct',
				name: 'Llama 3.1 8B Instruct',
			},
		},
	},
	groq: {
		id: 'groq',
		npm: '@ai-sdk/groq',
		name: 'Groq',
		models: { 'llama-3': { id: 'llama-3', name: 'Llama 3' } },
	},
};

function fakeFetch(status: number, body: unknown): FetchFn {
	return async () => new Response(JSON.stringify(body), { status });
}

describe('ModelCatalog', () => {
	beforeEach(async () => {
		await env.MODELS.delete('models:anthropic');
		await env.MODELS.delete('models:openai');
		await env.MODELS.delete('models:workers-ai');
	});

	describe('refresh', () => {
		it('fetches models from models.dev and stores them in KV', async () => {
			const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, modelsDevResponse));

			await catalog.refresh();

			const anthropicRaw = await env.MODELS.get('models:anthropic');
			const openaiRaw = await env.MODELS.get('models:openai');
			const workersAiRaw = await env.MODELS.get('models:workers-ai');
			expect(JSON.parse(anthropicRaw!)).toEqual(modelsDevResponse.anthropic.models);
			expect(JSON.parse(openaiRaw!)).toEqual(modelsDevResponse.openai.models);
			expect(JSON.parse(workersAiRaw!)).toEqual(modelsDevResponse['cloudflare-workers-ai'].models);
		});

		it('does not store models for unsupported providers', async () => {
			const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, modelsDevResponse));

			await catalog.refresh();

			const groqRaw = await env.MODELS.get('models:groq');
			expect(groqRaw).toBeNull();
		});

		it('throws on non-200 responses', async () => {
			const catalog = new ModelCatalog(env.MODELS, fakeFetch(500, { error: 'server error' }));

			await expect(catalog.refresh()).rejects.toThrow('models.dev returned 500');
		});

		it('converts non-boolean experimental fields to true', async () => {
			const response = {
				anthropic: {
					models: {
						'claude-opus-4-6': {
							id: 'claude-opus-4-6',
							name: 'Claude Opus 4.6',
							experimental: { modes: { fast: { cost: { input: 30 } } } },
						},
						'claude-sonnet-4-5': {
							id: 'claude-sonnet-4-5',
							name: 'Claude Sonnet 4.5',
							experimental: false,
						},
					},
				},
			};
			const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, response));

			await catalog.refresh();

			const models = JSON.parse((await env.MODELS.get('models:anthropic'))!);
			expect(models['claude-opus-4-6'].experimental).toBe(true);
			expect(models['claude-sonnet-4-5'].experimental).toBe(false);
		});

		it('handles a provider missing from the response', async () => {
			const partial = { anthropic: modelsDevResponse.anthropic };
			const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, partial));

			await catalog.refresh();

			const anthropicRaw = await env.MODELS.get('models:anthropic');
			const openaiRaw = await env.MODELS.get('models:openai');
			expect(JSON.parse(anthropicRaw!)).toEqual(modelsDevResponse.anthropic.models);
			expect(openaiRaw).toBeNull();
		});
	});

	describe('getModels', () => {
		it('returns models from KV', async () => {
			await env.MODELS.put('models:anthropic', JSON.stringify(modelsDevResponse.anthropic.models));
			const catalog = new ModelCatalog(env.MODELS);

			const models = await catalog.getModels('anthropic');

			expect(models).toEqual(modelsDevResponse.anthropic.models);
		});

		it('returns an empty object when KV has no data', async () => {
			const catalog = new ModelCatalog(env.MODELS);

			const models = await catalog.getModels('anthropic');

			expect(models).toEqual({});
		});
	});
});
