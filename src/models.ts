import { GATEWAY_PROVIDERS, type GatewayProvider } from './discovery';

export type FetchFn = typeof fetch;

type ModelsDevProvider = {
	models: Record<string, Record<string, unknown>>;
};

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
				const entry = catalog[provider];
				if (!entry?.models) return Promise.resolve();
				return this.kv.put(`models:${provider}`, JSON.stringify(entry.models));
			}),
		);
	}

	async getModels(provider: GatewayProvider): Promise<Record<string, Record<string, unknown>>> {
		const raw = await this.kv.get(`models:${provider}`);
		if (!raw) return {};
		return JSON.parse(raw) as Record<string, Record<string, unknown>>;
	}
}
