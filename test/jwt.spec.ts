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
});
