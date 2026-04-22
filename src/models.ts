import { GATEWAY_PROVIDERS, type GatewayProvider } from './discovery';

export type FetchFn = typeof fetch;

type ModelsDevProvider = {
	models: Record<string, Record<string, unknown>>;
};

const MODELS_DEV_KEYS: Record<GatewayProvider, string> = {
	anthropic: 'anthropic',
	openai: 'openai',
	'workers-ai': 'cloudflare-workers-ai',
};

function sanitizeModels(
	models: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
	const result: Record<string, Record<string, unknown>> = {};
	for (const [id, model] of Object.entries(models)) {
		const sanitized = { ...model };
		if (typeof sanitized.experimental !== 'boolean' && sanitized.experimental != null) {
			sanitized.experimental = true;
		}
		result[id] = sanitized;
	}
	return result;
}

export class ModelCatalog {
	constructor(
		private readonly kv: KVNamespace,
		private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
	) {}

	async refresh(): Promise<void> {
		const response = await this.fetchFn('https://models.dev/api.json');
		if (!response.ok) {
			throw new Error(`models.dev returned ${response.status}`);
		}

		const catalog = (await response.json()) as Record<string, ModelsDevProvider>;

		await Promise.all(
			GATEWAY_PROVIDERS.map((provider) => {
				const key = MODELS_DEV_KEYS[provider];
				const entry = catalog[key];
				if (!entry?.models) return Promise.resolve();
				const sanitized = sanitizeModels(entry.models);
				return this.kv.put(`models:${provider}`, JSON.stringify(sanitized));
			}),
		);
	}

	async getModels(provider: GatewayProvider): Promise<Record<string, Record<string, unknown>>> {
		const raw = await this.kv.get(`models:${provider}`);
		if (!raw) return {};
		return JSON.parse(raw) as Record<string, Record<string, unknown>>;
	}
}
