import { AGENTS, COMMANDS } from './agents.generated';

export const GATEWAY_PROVIDERS = ['anthropic', 'openai', 'compat', 'google-ai-studio'] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export function isGatewayProvider(value: string): value is GatewayProvider {
	return (GATEWAY_PROVIDERS as readonly string[]).includes(value);
}

type ProviderConfig = {
	gateway: GatewayProvider;
	npm: string;
	name: string;
	apiKeyEnv?: string;
	path?: string;
};

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
	'ic-anthropic': { gateway: 'anthropic', npm: '@ai-sdk/anthropic', name: 'IC Anthropic' },
	'ic-gemini': {
		gateway: 'google-ai-studio',
		npm: '@ai-sdk/google',
		name: 'IC Gemini',
		apiKeyEnv: 'CF_ACCESS_TOKEN',
		path: '/v1beta',
	},
	'ic-openai': { gateway: 'openai', npm: '@ai-sdk/openai', name: 'IC OpenAI' },
	'ic-workers-ai': { gateway: 'compat', npm: '@ai-sdk/openai-compatible', name: 'IC Workers AI' },
};

export const OPENCODE_PROVIDERS = Object.keys(PROVIDER_CONFIG);

type Models = Record<string, Record<string, unknown>>;

export const GITHUB_MCP_HOST = 'github-mcp.icap.dev';

export function buildDiscoveryPayload(
	origin: string,
	modelsByGateway: Record<string, Models> = {},
	githubMcpHost = GITHUB_MCP_HOST,
) {
	const provider: Record<string, unknown> = {};

	for (const [name, config] of Object.entries(PROVIDER_CONFIG)) {
		const models = modelsByGateway[config.gateway] ?? {};
		const options = {
			baseURL: `${origin}/v1/${config.gateway}${config.path ?? ''}`,
			...(config.apiKeyEnv ? { apiKey: `{env:${config.apiKeyEnv}}` } : {}),
		};
		provider[name] = {
			npm: config.npm,
			name: config.name,
			env: ['CF_ACCESS_TOKEN'],
			options,
			...(Object.keys(models).length > 0 ? { models } : {}),
		};
	}

	return {
		auth: {
			command: ['cloudflared', 'access', 'login', '--no-verbose', origin],
			env: 'CF_ACCESS_TOKEN',
		},
		config: {
			enabled_providers: OPENCODE_PROVIDERS,
			provider,
			mcp: {
				github: {
					type: 'remote',
					url: `https://${githubMcpHost}/mcp`,
					headers: {
						'x-api-key': '{env:CF_ACCESS_TOKEN}',
					},
					enabled: true,
				},
			},
			agent: AGENTS,
			command: COMMANDS,
		},
	};
}
