interface JWK {
	kid: string;
	kty: string;
	alg?: string;
	n: string;
	e: string;
}

export interface AccessJWTPayload {
	email: string;
	aud: string[] | string;
	iss: string;
	exp: number;
	iat: number;
	nbf?: number;
	sub: string;
}

export type KeyFetcher = (teamDomain: string) => Promise<JWK[]>;

const KEY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class JwtVerifier {
	private cachedKeysPromise: Promise<JWK[]> | undefined;
	private cachedAt = 0;

	constructor(
		private readonly teamDomain: string,
		private readonly aud: string,
		private readonly fetchKeys: KeyFetcher = JwtVerifier.fetchAccessPublicKeys,
		private readonly now: () => number = Date.now,
	) {}

	async verify(token: string): Promise<AccessJWTPayload> {
		const parts = token.split('.');
		if (parts.length !== 3) throw new Error('Invalid JWT format');

		const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as {
			alg?: unknown;
			kid?: unknown;
			typ?: unknown;
		};
		const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as AccessJWTPayload;

		// Reject tokens that claim an algorithm other than RS256. Cloudflare Access only ever issues
		// RS256 tokens; accepting anything else invites algorithm-confusion attacks.
		if (header.alg !== 'RS256') throw new Error('Unsupported JWT algorithm');
		if (typeof header.kid !== 'string' || header.kid === '') throw new Error('Invalid JWT kid');

		const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		if (!auds.includes(this.aud)) throw new Error('Invalid audience');
		if (payload.iss !== `https://${this.teamDomain}`) throw new Error('Invalid issuer');

		const nowSeconds = Math.floor(this.now() / 1000);
		if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
			throw new Error('Token expired — re-run: opencode auth login');
		}
		if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds) {
			throw new Error('Token not yet valid');
		}

		const keys = await this.getKeys();
		const jwk = keys.find((k) => k.kid === header.kid);
		if (!jwk) throw new Error('No matching key found');
		if (jwk.kty !== 'RSA' || (jwk.alg !== undefined && jwk.alg !== 'RS256')) {
			throw new Error('Unsupported JWK type');
		}

		const key = await crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify'],
		);
		const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
		const signature = base64UrlDecode(parts[2]);

		const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
		if (!valid) throw new Error('Invalid signature');

		return payload;
	}

	private async getKeys(): Promise<JWK[]> {
		if (this.cachedKeysPromise && this.now() - this.cachedAt < KEY_CACHE_TTL_MS) {
			return this.cachedKeysPromise;
		}
		this.cachedAt = this.now();
		this.cachedKeysPromise = this.fetchKeys(this.teamDomain);
		try {
			return await this.cachedKeysPromise;
		} catch (e) {
			this.cachedKeysPromise = undefined;
			throw e;
		}
	}

	private static async fetchAccessPublicKeys(teamDomain: string): Promise<JWK[]> {
		const resp = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
		if (!resp.ok) throw new Error(`Failed to fetch Access certs: ${resp.status}`);
		const { keys } = (await resp.json()) as { keys: JWK[] };
		return keys;
	}
}

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
