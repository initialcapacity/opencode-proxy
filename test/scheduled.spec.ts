import { env, fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import worker from '../src/index';

describe('scheduled handler', () => {
	beforeAll(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});

	afterEach(() => {
		fetchMock.assertNoPendingInterceptors();
	});

	it('refreshes the model catalog from models.dev into KV', async () => {
		fetchMock
			.get('https://models.dev')
			.intercept({ path: '/api.json' })
			.reply(200, {
				anthropic: {
					models: { 'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' } },
				},
				google: {
					models: { 'gemini-2.5-flash': { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' } },
				},
				openai: {
					models: { 'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' } },
				},
				'cloudflare-workers-ai': {
					models: {
						'@cf/meta/llama-3.1-8b-instruct': {
							id: '@cf/meta/llama-3.1-8b-instruct',
							name: 'Llama 3.1 8B Instruct',
						},
					},
				},
			});

		await worker.scheduled(
			{ scheduledTime: Date.now(), cron: '0 * * * *', noRetry: () => {} } as ScheduledController,
			env,
			{ waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
		);

		const stored = await env.MODELS.get('models:anthropic');
		expect(JSON.parse(stored!)).toEqual({
			'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
		});

		await env.MODELS.delete('models:anthropic');
	});
});
