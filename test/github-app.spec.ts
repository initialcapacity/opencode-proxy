import { describe, it, expect, beforeAll } from 'vitest';
import { GitHubAppAuth, type FetchFn } from '../github-mcp/github-app';

const APP_ID = 'test-app-id';
const INSTALLATION_ID = 'test-installation-id';

let testPrivateKeyPem: string;

beforeAll(async () => {
	const keyPair = (await crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify'],
	)) as CryptoKeyPair;
	const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
	const base64 = btoa(String.fromCharCode(...new Uint8Array(exported as ArrayBuffer)));
	testPrivateKeyPem = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
});

function fakeFetch(status: number, body: unknown): FetchFn {
	return async () => new Response(JSON.stringify(body), { status });
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function capturingFetch(status: number, body: unknown): { fetchFn: FetchFn; calls: { url: string; init?: RequestInit }[] } {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchFn: FetchFn = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		calls.push({ url, init });
		return new Response(JSON.stringify(body), { status });
	};
	return { fetchFn, calls };
}

describe('GitHubAppAuth', () => {
	it('fetches an installation token from GitHub', async () => {
		const { fetchFn, calls } = capturingFetch(201, { token: 'ghs_test123' });
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fetchFn);

		const token = await auth.getInstallationToken();

		expect(token).toBe('ghs_test123');
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`);
		expect(calls[0].init?.method).toBe('POST');
	});

	it('caches the token within the TTL', async () => {
		let now = 1000;
		const { fetchFn, calls } = capturingFetch(201, { token: 'ghs_cached' });
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fetchFn, () => now);

		await auth.getInstallationToken();
		now += 49 * 60; // 49 minutes later, within 50 minute TTL
		const token = await auth.getInstallationToken();

		expect(token).toBe('ghs_cached');
		expect(calls).toHaveLength(1);
	});

	it('refreshes the token after the TTL expires', async () => {
		let now = 1000;
		let callCount = 0;
		const fetchFn: FetchFn = async () => {
			callCount++;
			return new Response(JSON.stringify({ token: `ghs_token_${callCount}` }), { status: 201 });
		};
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fetchFn, () => now);

		const first = await auth.getInstallationToken();
		now += 51 * 60; // 51 minutes later, past 50 minute TTL
		const second = await auth.getInstallationToken();

		expect(first).toBe('ghs_token_1');
		expect(second).toBe('ghs_token_2');
		expect(callCount).toBe(2);
	});

	it('coalesces concurrent refreshes after the cached token expires', async () => {
		let now = 1000;
		let callCount = 0;
		const releaseRefresh = deferred<void>();
		const fetchFn: FetchFn = async () => {
			callCount++;
			if (callCount === 2) {
				await releaseRefresh.promise;
			}
			return new Response(JSON.stringify({ token: `ghs_token_${callCount}` }), { status: 201 });
		};
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fetchFn, () => now);

		await auth.getInstallationToken();
		now += 51 * 60;
		const firstRefresh = auth.getInstallationToken();
		const secondRefresh = auth.getInstallationToken();
		releaseRefresh.resolve();
		const [first, second] = await Promise.all([firstRefresh, secondRefresh]);

		expect(first).toBe('ghs_token_2');
		expect(second).toBe('ghs_token_2');
		expect(callCount).toBe(2);
	});

	it('throws on error responses from GitHub', async () => {
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fakeFetch(401, { message: 'Bad credentials' }));

		await expect(auth.getInstallationToken()).rejects.toThrow('Failed to get installation token: 401');
	});

	it('sends a valid JWT in the authorization header', async () => {
		const { fetchFn, calls } = capturingFetch(201, { token: 'ghs_test' });
		const auth = new GitHubAppAuth(APP_ID, testPrivateKeyPem, INSTALLATION_ID, fetchFn);

		await auth.getInstallationToken();

		const authHeader = (calls[0].init?.headers as Record<string, string>)['authorization'];
		expect(authHeader).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

		const parts = authHeader.replace('Bearer ', '').split('.');
		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
		expect(payload.iss).toBe(APP_ID);
		expect(payload.exp).toBeGreaterThan(payload.iat);
	});
});
