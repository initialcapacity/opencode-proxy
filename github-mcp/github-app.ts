const GITHUB_API = 'https://api.github.com';
const TOKEN_CACHE_DURATION_MS = 50 * 60 * 1000; // 50 minutes

let cachedToken: string | undefined;
let cachedTokenExpiry = 0;

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = { iss: appId, iat: now - 60, exp: now + 600 };

	const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
	const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	const keyData = privateKeyPem
		.replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
		.replace(/-----END RSA PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		binaryKey.buffer as ArrayBuffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(signingInput) as unknown as ArrayBuffer,
	);

	return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function getInstallationToken(appId: string, privateKey: string, installationId: string): Promise<string> {
	if (cachedToken && Date.now() < cachedTokenExpiry) {
		return cachedToken;
	}

	const appJwt = await signAppJwt(appId, privateKey);

	const response = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
		method: 'POST',
		headers: {
			accept: 'application/vnd.github.v3+json',
			authorization: `Bearer ${appJwt}`,
			'user-agent': 'ic-github-mcp',
		},
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Failed to get installation token: ${response.status} ${body}`);
	}

	const data = (await response.json()) as { token: string };
	cachedToken = data.token;
	cachedTokenExpiry = Date.now() + TOKEN_CACHE_DURATION_MS;

	return cachedToken;
}
