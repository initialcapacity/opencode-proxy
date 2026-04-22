import { PROVIDERS } from './providers';

export function buildDiscoveryPayload(origin: string) {
	return {
		auth: {
			command: ['cloudflared', 'access', 'login', '--no-verbose', origin],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: [...PROVIDERS],
			provider: Object.fromEntries(
				PROVIDERS.map((p) => [p, { env: ['CF_ACCESS_TOKEN'], options: { baseURL: `${origin}/v1/${p}` } }]),
			),
		},
	};
}
