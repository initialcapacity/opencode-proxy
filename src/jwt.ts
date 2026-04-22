interface JWK {
	kid: string;
	kty: string;
	n: string;
	e: string;
	alg: string;
}

export interface AccessJWTPayload {
	email: string;
	aud: string[];
	iss: string;
	exp: number;
	iat: number;
	sub: string;
}

export type KeyFetcher = (teamDomain: string) => Promise<JWK[]>;

const KEY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class JwtVerifier {
	private cachedKeys: JWK[] | undefined;
	private cachedAt = 0;

	constructor(
		private readonly teamDomain: string,
		private readonly aud: string,
		private readonly fetchKeys: KeyFetcher = JwtVerifier.fetchAccessPublicKeys,
	) {}

	async verify(token: string): Promise<AccessJWTPayload> {
		const parts = token.split('.');
		if (parts.length !== 3) throw new Error('Invalid JWT format');

		const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as { kid: string };
		const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as AccessJWTPayload;

		if (!payload.aud.includes(this.aud)) throw new Error('Invalid audience');
		if (payload.iss !== `https://${this.teamDomain}`) throw new Error('Invalid issuer');
		if (payload.exp < Math.floor(Date.now() / 1000)) {
			throw new Error('Token expired — re-run: opencode auth login');
		}

		const keys = await this.getKeys();
		const jwk = keys.find((k) => k.kid === header.kid);
		if (!jwk) throw new Error('No matching key found');

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
		if (this.cachedKeys && Date.now() - this.cachedAt < KEY_CACHE_TTL_MS) {
			return this.cachedKeys;
		}
		this.cachedKeys = await this.fetchKeys(this.teamDomain);
		this.cachedAt = Date.now();
		return this.cachedKeys;
	}

	private static async fetchAccessPublicKeys(teamDomain: string): Promise<JWK[]> {
		const resp = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
		if (!resp.ok) throw new Error(`Failed to fetch Access certs: ${resp.status}`);
		const { keys } = (await resp.json()) as { keys: JWK[] };
		return keys;
	}
}

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
