export const PROVIDERS = ['anthropic', 'openai'] as const;

export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
	return (PROVIDERS as readonly string[]).includes(value);
}

export function buildDiscoveryPayload(origin: string) {
	return {
		auth: {
			command: ['cloudflared', 'access', 'login', '--no-verbose', origin],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: [...PROVIDERS],
			provider: {
				anthropic: {
					env: ['CF_ACCESS_TOKEN'],
					options: { baseURL: `${origin}/v1/anthropic` },
				},
				openai: {
					env: ['CF_ACCESS_TOKEN'],
					options: { baseURL: `${origin}/v1/openai` },
				},
			},
		},
	};
}
