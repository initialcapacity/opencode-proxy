import { describe, it, expect } from 'vitest';
import { JwtVerifier } from '../src/jwt';
import { generateKeyPair, signJWT } from './helpers/jwt';

const TEAM_DOMAIN = 'test.cloudflareaccess.com';
const AUD = 'test-audience-tag';

async function createVerifier() {
	const { publicJWK, privateKey } = await generateKeyPair();
	const fetchKeys = async () => [publicJWK as any];
	return { verifier: new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys), privateKey, kid: publicJWK.kid };
}

async function validPayload(overrides?: Record<string, unknown>) {
	return {
		aud: [AUD],
		email: 'user@example.com',
		iss: `https://${TEAM_DOMAIN}`,
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000),
		sub: 'user-id',
		...overrides,
	};
}

describe('JwtVerifier', () => {
	it('verifies a valid token', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload(), privateKey, kid);

		const payload = await verifier.verify(token);

		expect(payload.email).toBe('user@example.com');
		expect(payload.aud).toEqual([AUD]);
	});

	it('rejects an invalid JWT format', async () => {
		const { verifier } = await createVerifier();

		await expect(verifier.verify('not-a-jwt')).rejects.toThrow('Invalid JWT format');
	});

	it('rejects a wrong audience', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload({ aud: ['wrong'] }), privateKey, kid);

		await expect(verifier.verify(token)).rejects.toThrow('Invalid audience');
	});

	it('rejects a wrong issuer', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload({ iss: 'https://wrong.com' }), privateKey, kid);

		await expect(verifier.verify(token)).rejects.toThrow('Invalid issuer');
	});

	it('rejects an expired token', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload({ exp: 1000 }), privateKey, kid);

		await expect(verifier.verify(token)).rejects.toThrow('Token expired — re-run: opencode auth login');
	});

	it('caches keys across calls', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		let fetchCount = 0;
		const fetchKeys = async () => {
			fetchCount++;
			return [publicJWK as any];
		};
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys);

		const token1 = await signJWT(await validPayload(), privateKey, publicJWK.kid);
		const token2 = await signJWT(await validPayload({ email: 'other@example.com' }), privateKey, publicJWK.kid);

		await verifier.verify(token1);
		await verifier.verify(token2);

		expect(fetchCount).toBe(1);
	});

	it('refetches keys after the TTL expires', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		let fetchCount = 0;
		const fetchKeys = async () => {
			fetchCount++;
			return [publicJWK as any];
		};
		let clock = 1_000_000;
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys, () => clock);
		const token = await signJWT(await validPayload(), privateKey, publicJWK.kid);

		await verifier.verify(token);
		clock += 11 * 60 * 1000;
		await verifier.verify(token);

		expect(fetchCount).toBe(2);
	});

	it('coalesces concurrent key fetches into a single request', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		let fetchCount = 0;
		const fetchKeys = async () => {
			fetchCount++;
			await new Promise((resolve) => setTimeout(resolve, 10));
			return [publicJWK as any];
		};
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys);
		const token1 = await signJWT(await validPayload(), privateKey, publicJWK.kid);
		const token2 = await signJWT(await validPayload({ email: 'other@example.com' }), privateKey, publicJWK.kid);

		await Promise.all([verifier.verify(token1), verifier.verify(token2)]);

		expect(fetchCount).toBe(1);
	});

	it('does not cache a failed key fetch', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		let fetchCount = 0;
		const fetchKeys = async () => {
			fetchCount++;
			if (fetchCount === 1) throw new Error('network down');
			return [publicJWK as any];
		};
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys);
		const token = await signJWT(await validPayload(), privateKey, publicJWK.kid);

		await expect(verifier.verify(token)).rejects.toThrow('network down');
		await verifier.verify(token);

		expect(fetchCount).toBe(2);
	});

	it('rejects a token whose payload is not valid JSON', async () => {
		const { verifier } = await createVerifier();
		// valid base64url, but decoded content is not JSON
		const token = 'eyJhbGciOiJSUzI1NiJ9.bm90LWpzb24.signature';

		await expect(verifier.verify(token)).rejects.toThrow();
	});

	it('decodes base64url payloads regardless of length (padding handling)', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		// Pad the email to force a range of payload lengths so every `length % 4` bucket is exercised.
		for (let padding = 0; padding < 4; padding++) {
			const token = await signJWT(await validPayload({ email: `u${'x'.repeat(padding)}@ex.com` }), privateKey, kid);

			const payload = await verifier.verify(token);

			expect(payload.email).toBe(`u${'x'.repeat(padding)}@ex.com`);
		}
	});

	it('rejects a token with no matching key', async () => {
		const { privateKey } = await generateKeyPair();
		const fetchKeys = async () => [{ kid: 'other-key' } as any];
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys);
		const token = await signJWT(await validPayload(), privateKey, 'test-key-1');

		await expect(verifier.verify(token)).rejects.toThrow('No matching key found');
	});

	it('rejects a token with an invalid signature', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload(), privateKey, kid);
		const tampered = token.slice(0, -5) + 'XXXXX';

		await expect(verifier.verify(tampered)).rejects.toThrow('Invalid signature');
	});

	it('rejects a token whose header alg is not RS256', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload(), privateKey, kid, { alg: 'HS256' });

		await expect(verifier.verify(token)).rejects.toThrow('Unsupported JWT algorithm');
	});

	it('rejects a token whose header is missing a kid', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload(), privateKey, kid, { kid: undefined });

		await expect(verifier.verify(token)).rejects.toThrow('Invalid JWT kid');
	});

	it('accepts a token whose aud is a string matching the expected audience', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload({ aud: AUD }), privateKey, kid);

		const payload = await verifier.verify(token);

		expect(payload.email).toBe('user@example.com');
	});

	it('rejects a token whose aud is a string not matching the expected audience', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const token = await signJWT(await validPayload({ aud: 'some-other-aud' }), privateKey, kid);

		await expect(verifier.verify(token)).rejects.toThrow('Invalid audience');
	});

	it('rejects a token whose nbf claim is in the future', async () => {
		const { verifier, privateKey, kid } = await createVerifier();
		const future = Math.floor(Date.now() / 1000) + 3600;
		const token = await signJWT(await validPayload({ nbf: future }), privateKey, kid);

		await expect(verifier.verify(token)).rejects.toThrow('Token not yet valid');
	});

	it('uses the injected clock to determine expiry', async () => {
		const { publicJWK, privateKey } = await generateKeyPair();
		const fetchKeys = async () => [publicJWK as any];
		// Token expires at t=5000. Clock at 4000 → valid; clock at 6000 → expired.
		let clock = 4_000_000;
		const verifier = new JwtVerifier(TEAM_DOMAIN, AUD, fetchKeys, () => clock);
		const token = await signJWT(
			{
				aud: [AUD],
				email: 'user@example.com',
				iss: `https://${TEAM_DOMAIN}`,
				exp: 5000,
				iat: 1000,
				sub: 'user-id',
			},
			privateKey,
			publicJWK.kid,
		);

		await expect(verifier.verify(token)).resolves.toBeDefined();

		clock = 6_000_000;
		await expect(verifier.verify(token)).rejects.toThrow('Token expired');
	});
});
