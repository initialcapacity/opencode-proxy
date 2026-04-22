import { describe, it, expect } from 'vitest';
import { GatewayProxy } from '../src/gateway';

const ACCOUNT_ID = 'test-account-id';
const GATEWAY_NAME = 'test-gateway';
const AIG_TOKEN = 'test-aig-token';

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
});
