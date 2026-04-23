import { GATEWAY_PROVIDERS, type GatewayProvider } from './discovery';

export type FetchFn = typeof fetch;

type ModelsDevProvider = {
	models: Record<string, Record<string, unknown>>;
};

type ModelsDevConfig = {
	key: string;
	transformId?: (id: string) => string;
};

const MODELS_DEV_CONFIG: Record<GatewayProvider, ModelsDevConfig> = {
	anthropic: { key: 'anthropic' },
	openai: { key: 'openai' },
	compat: { key: 'cloudflare-workers-ai', transformId: (id) => `workers-ai/${id}` },
};

function transformModelIds(
	models: Record<string, Record<string, unknown>>,
	transform: (id: string) => string,
): Record<string, Record<string, unknown>> {
	const result: Record<string, Record<string, unknown>> = {};
	for (const [id, model] of Object.entries(models)) {
		const newId = transform(id);
		result[newId] = { ...model, id: newId };
	}
	return result;
}

function sanitizeModels(
	models: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
	const result: Record<string, Record<string, unknown>> = {};
	for (const [id, model] of Object.entries(models)) {
		const sanitized = { ...model };
		// models.dev sometimes nests a feature matrix under `experimental`. OpenCode
		// expects a boolean, so coerce any object-shaped value to true.
		if (typeof sanitized.experimental === 'object' && sanitized.experimental !== null) {
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
		const nextModelsByProvider: Partial<Record<GatewayProvider, Record<string, Record<string, unknown>>>> = {};

		for (const provider of GATEWAY_PROVIDERS) {
			const config = MODELS_DEV_CONFIG[provider];
			const entry = catalog[config.key];
			if (!entry?.models) throw new Error(`models.dev response missing provider ${config.key}`);
			const sanitized = sanitizeModels(entry.models);
			nextModelsByProvider[provider] = config.transformId ? transformModelIds(sanitized, config.transformId) : sanitized;
		}

		await Promise.all(
			GATEWAY_PROVIDERS.map((provider) =>
				this.kv.put(`models:${provider}`, JSON.stringify(nextModelsByProvider[provider]!)),
			),
		);
	}

	async getModels(provider: GatewayProvider): Promise<Record<string, Record<string, unknown>>> {
		const raw = await this.kv.get(`models:${provider}`);
		if (!raw) return {};
		return JSON.parse(raw) as Record<string, Record<string, unknown>>;
	}
}
