import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					bindings: {
						CF_ACCESS_AUD: "test-access-aud",
						CF_AIG_TOKEN: "test-aig-token",
					},
				},
			},
		},
	},
});
