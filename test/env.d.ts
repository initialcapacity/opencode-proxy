declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
		CF_ACCESS_AUD: string;
		CF_AIG_TOKEN: string;
	}
}
