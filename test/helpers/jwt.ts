interface JWKPair {
	publicJWK: JsonWebKey & { kid: string };
	privateKey: CryptoKey;
}

let cached: JWKPair | undefined;

export async function generateKeyPair(): Promise<JWKPair> {
	if (cached) return cached;

	const keyPair = await crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify'],
	);

	const publicJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
	cached = {
		publicJWK: { ...publicJWK, kid: 'test-key-1' } as JsonWebKey & { kid: string },
		privateKey: keyPair.privateKey,
	};
	return cached;
}

function base64UrlEncode(data: Uint8Array): string {
	const binary = Array.from(data, (b) => String.fromCharCode(b)).join('');
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signJWT(
	payload: Record<string, unknown>,
	privateKey: CryptoKey,
	kid: string,
): Promise<string> {
	const header = { alg: 'RS256', typ: 'JWT', kid };
	const enc = new TextEncoder();

	const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
	const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));

	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(`${headerB64}.${payloadB64}`));

	return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}
