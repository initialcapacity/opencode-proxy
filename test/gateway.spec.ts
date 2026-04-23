import { describe, it, expect } from 'vitest';
import { GatewayProxy, type FetchFn } from '../src/gateway';

const ACCOUNT_ID = 'test-account-id';
const GATEWAY_NAME = 'test-gateway';
const AIG_TOKEN = 'test-aig-token';

interface CapturedRequest {
	url: string;
	method: string;
	headers: Headers;
	body: string;
}

function captureFetch(response: Response): { fetchFn: FetchFn; captured: CapturedRequest[] } {
	const captured: CapturedRequest[] = [];
	const fetchFn: FetchFn = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const body = init?.body ? await new Response(init.body as BodyInit).text() : '';
		captured.push({
			url,
			method: init?.method ?? 'GET',
			headers: new Headers(init?.headers),
			body,
		});
		return response;
	};
	return { fetchFn, captured };
}

describe('GatewayProxy', () => {
	describe('buildTargetUrl', () => {
		it('builds the correct gateway URL', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);

			const url = proxy.buildTargetUrl('anthropic', '/v1/messages');

			expect(url).toBe(`https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/anthropic/v1/messages`);
		});

		it('preserves query strings', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);

			const url = proxy.buildTargetUrl('openai', '/chat/completions?stream=true');

			expect(url).toBe(
				`https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/openai/chat/completions?stream=true`,
			);
		});
	});

	describe('buildHeaders', () => {
		it('strips auth and host headers', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);
			const original = new Headers({
				'authorization': 'Bearer jwt-token',
				'x-api-key': 'some-key',
				'host': 'opencode.icap.dev',
				'content-type': 'application/json',
			});

			const headers = proxy.buildHeaders(original, 'user@example.com');

			expect(headers.get('authorization')).toBeNull();
			expect(headers.get('x-api-key')).toBeNull();
			expect(headers.get('host')).toBeNull();
			expect(headers.get('content-type')).toBe('application/json');
		});

		it('strips content-length and transfer-encoding so fetch can set them correctly', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);
			const original = new Headers({
				'content-length': '999',
				'transfer-encoding': 'chunked',
			});

			const headers = proxy.buildHeaders(original, 'user@example.com');

			expect(headers.get('content-length')).toBeNull();
			expect(headers.get('transfer-encoding')).toBeNull();
		});

		it('adds gateway authorization', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);

			const headers = proxy.buildHeaders(new Headers(), 'user@example.com');

			expect(headers.get('cf-aig-authorization')).toBe(`Bearer ${AIG_TOKEN}`);
		});

		it('adds user metadata', () => {
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN);

			const headers = proxy.buildHeaders(new Headers(), 'user@example.com');

			expect(JSON.parse(headers.get('cf-aig-metadata')!)).toEqual({ userId: 'user@example.com' });
		});
	});

	describe('proxy', () => {
		it('forwards method, body, and rewritten headers to the gateway', async () => {
			const { fetchFn, captured } = captureFetch(new Response('ok', { status: 200 }));
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const request = new Request('https://proxy.example/v1/anthropic/v1/messages', {
				method: 'POST',
				headers: { 'x-api-key': 'client-token', 'content-type': 'application/json' },
				body: JSON.stringify({ model: 'claude' }),
			});

			await proxy.proxy(request, 'anthropic', 'user@example.com');

			expect(captured).toHaveLength(1);
			expect(captured[0].url).toBe(
				`https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/anthropic/v1/messages`,
			);
			expect(captured[0].method).toBe('POST');
			expect(captured[0].headers.get('x-api-key')).toBeNull();
			expect(captured[0].headers.get('cf-aig-authorization')).toBe(`Bearer ${AIG_TOKEN}`);
			expect(captured[0].headers.get('cf-aig-metadata')).toBe('{"userId":"user@example.com"}');
			expect(captured[0].headers.get('content-type')).toBe('application/json');
			expect(captured[0].body).toBe('{"model":"claude"}');
		});

		it('forwards the request abort signal to the gateway fetch', async () => {
			let capturedSignal: AbortSignal | null = null;
			const fetchFn: FetchFn = async (_input, init) => {
				capturedSignal = init?.signal ?? null;
				return new Response('ok');
			};
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const controller = new AbortController();
			const request = new Request('https://proxy.example/v1/openai/chat/completions', {
				signal: controller.signal,
			});

			await proxy.proxy(request, 'openai', 'user@example.com');

			expect(capturedSignal).toBe(request.signal);
		});

		it('preserves query strings', async () => {
			const { fetchFn, captured } = captureFetch(new Response('ok'));
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const request = new Request('https://proxy.example/v1/openai/chat/completions?stream=true');

			await proxy.proxy(request, 'openai', 'user@example.com');

			expect(captured[0].url).toBe(
				`https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/openai/chat/completions?stream=true`,
			);
		});

		it('propagates network errors from the gateway', async () => {
			const fetchFn: FetchFn = async () => {
				throw new TypeError('network down');
			};
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const request = new Request('https://proxy.example/v1/anthropic/v1/messages', { method: 'POST' });

			await expect(proxy.proxy(request, 'anthropic', 'user@example.com')).rejects.toThrow('network down');
		});

		it('normalizes an empty downstream path to a single slash', async () => {
			const { fetchFn, captured } = captureFetch(new Response('ok'));
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const request = new Request('https://proxy.example/v1/anthropic', { method: 'GET' });

			await proxy.proxy(request, 'anthropic', 'user@example.com');

			expect(captured[0].url).toBe(
				`https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/anthropic/`,
			);
		});

		it('returns the gateway status and body unchanged', async () => {
			const { fetchFn } = captureFetch(
				new Response('{"error":"upstream"}', {
					status: 502,
					headers: { 'content-type': 'application/json', 'x-custom': 'passthrough' },
				}),
			);
			const proxy = new GatewayProxy(ACCOUNT_ID, GATEWAY_NAME, AIG_TOKEN, fetchFn);
			const request = new Request('https://proxy.example/v1/anthropic/v1/messages', { method: 'POST' });

			const response = await proxy.proxy(request, 'anthropic', 'user@example.com');

			expect(response.status).toBe(502);
			expect(response.headers.get('content-type')).toBe('application/json');
			expect(response.headers.get('x-custom')).toBe('passthrough');
			expect(await response.text()).toBe('{"error":"upstream"}');
		});
	});
});
