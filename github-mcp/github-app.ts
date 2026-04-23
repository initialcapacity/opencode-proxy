export type FetchFn = typeof fetch;
export type Clock = () => number;

const TOKEN_CACHE_DURATION_MS = 50 * 60 * 1000; // 50 minutes

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  // Loop rather than `String.fromCharCode(...bytes)` so buffers larger than the argument-length
  // limit (~100KB on V8) still encode correctly.
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stripPemMarkers(pem: string): string {
  return pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
}

async function signAppJwt(
  appId: string,
  privateKeyPem: string,
  now: number,
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: appId, iat: now - 60, exp: now + 600 };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = stripPemMarkers(privateKeyPem);
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signingData = new TextEncoder().encode(signingInput);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    signingData,
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export class GitHubAppAuth {
  private cachedToken: string | undefined;
  private cachedTokenExpiry = 0;
  private cachedTokenPromise: Promise<string> | undefined;

  constructor(
    private readonly appId: string,
    private readonly privateKey: string,
    private readonly installationId: string,
    private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
    private readonly clock: Clock = () => Math.floor(Date.now() / 1000),
  ) {}

  async getInstallationToken(): Promise<string> {
    const now = this.clock();
    if (this.cachedToken && now < this.cachedTokenExpiry) {
      return this.cachedToken;
    }
    if (this.cachedTokenPromise) {
      return this.cachedTokenPromise;
    }

    const refreshPromise = this.fetchInstallationToken(now);
    this.cachedTokenPromise = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      if (this.cachedTokenPromise === refreshPromise) {
        this.cachedTokenPromise = undefined;
      }
    }
  }

  private async fetchInstallationToken(now: number): Promise<string> {
    const appJwt = await signAppJwt(this.appId, this.privateKey, now);

    const response = await this.fetchFn(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github.v3+json",
          authorization: `Bearer ${appJwt}`,
          "user-agent": "ic-github-mcp",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to get installation token: ${response.status} ${body}`,
      );
    }

    const data = (await response.json()) as { token: string };
    this.cachedToken = data.token;
    this.cachedTokenExpiry = now + TOKEN_CACHE_DURATION_MS / 1000;

    return this.cachedToken;
  }
}
