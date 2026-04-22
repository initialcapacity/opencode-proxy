export const GATEWAY_PROVIDERS = ['anthropic', 'openai', 'compat'] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export function isGatewayProvider(value: string): value is GatewayProvider {
	return (GATEWAY_PROVIDERS as readonly string[]).includes(value);
}

type ProviderConfig = {
	gateway: GatewayProvider;
	npm: string;
	name: string;
};

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
	'ic-anthropic': { gateway: 'anthropic', npm: '@ai-sdk/anthropic', name: 'IC Anthropic' },
	'ic-openai': { gateway: 'openai', npm: '@ai-sdk/openai', name: 'IC OpenAI' },
	'ic-workers-ai': { gateway: 'compat', npm: '@ai-sdk/openai-compatible', name: 'IC Workers AI' },
};

export const OPENCODE_PROVIDERS = Object.keys(PROVIDER_CONFIG);

type Models = Record<string, Record<string, unknown>>;

export function buildDiscoveryPayload(origin: string, modelsByGateway: Record<string, Models> = {}) {
	const provider: Record<string, unknown> = {};

	for (const [name, config] of Object.entries(PROVIDER_CONFIG)) {
		const models = modelsByGateway[config.gateway] ?? {};
		provider[name] = {
			npm: config.npm,
			name: config.name,
			env: ['CF_ACCESS_TOKEN'],
			options: { baseURL: `${origin}/v1/${config.gateway}` },
			...(Object.keys(models).length > 0 ? { models } : {}),
		};
	}

	return {
		auth: {
			command: ['cloudflared', 'access', 'login', '--no-verbose', origin],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: [...OPENCODE_PROVIDERS],
			provider,
		},
	};
}
