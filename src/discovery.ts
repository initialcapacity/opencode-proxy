export function buildDiscoveryPayload(origin: string) {
	return {
		auth: {
			command: ['cloudflared', 'access', 'login', '--no-verbose', origin],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: ['anthropic', 'openai'],
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
