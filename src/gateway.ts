export type FetchFn = typeof fetch;

export class GatewayProxy {
	constructor(
		private readonly accountId: string,
		private readonly gatewayName: string,
		private readonly aigToken: string,
		private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
	) {}

	async proxy(request: Request, provider: string, userEmail: string): Promise<Response> {
		const url = new URL(request.url);
		const prefix = `/v1/${provider}`;
		// Normalize so `/v1/anthropic` and `/v1/anthropic/` both produce a `/` root path downstream.
		const rest = url.pathname.slice(prefix.length) || '/';
		const downstreamPath = rest + url.search;
		const target = this.buildTargetUrl(provider, downstreamPath);

		const headers = this.buildHeaders(request.headers, userEmail);

		const resp = await this.fetchFn(target, {
			method: request.method,
			headers,
			body: request.body,
			signal: request.signal,
		});

		return new Response(resp.body, {
			status: resp.status,
			headers: resp.headers,
		});
	}

	buildTargetUrl(provider: string, downstreamPath: string): string {
		return `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayName}/${provider}${downstreamPath}`;
	}

	buildHeaders(original: Headers, userEmail: string): Headers {
		const headers = new Headers(original);
		headers.delete('authorization');
		headers.delete('x-api-key');
		headers.delete('x-goog-api-key');
		headers.delete('host');
		headers.delete('content-length');
		headers.delete('transfer-encoding');
		headers.set('cf-aig-authorization', `Bearer ${this.aigToken}`);
		headers.set('cf-aig-metadata', JSON.stringify({ userId: userEmail }));
		return headers;
	}
}
