import { Hono, type MiddlewareHandler } from 'hono';
import { buildDiscoveryPayload, GATEWAY_PROVIDERS, isGatewayProvider, type GatewayProvider } from './discovery';
import { createAuthMiddleware, type AuthVariables } from './auth';
import { createLoggingMiddleware } from './logging';
import { GatewayProxy } from './gateway';
import { JwtVerifier } from './jwt';
import { ModelCatalog } from './models';
import { CodexCatalog } from './codex';
import { icLogoFaviconSvg, landingPage } from './landing';

type Bindings = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	CF_ACCOUNT_ID: string;
	CF_GATEWAY_NAME: string;
	CF_AIG_TOKEN: string;
	GITHUB_MCP_HOST: string;
	MODELS: KVNamespace;
};

type App = { Bindings: Bindings; Variables: AuthVariables };

const app = new Hono<App>();

// Lazily constructed on first request because env is only available in request scope.
// Workers isolates are long-lived, so these run once per cold start and are shared
// across all requests served by the isolate.
let authMiddleware: MiddlewareHandler<App> | undefined;
let gatewayProxy: GatewayProxy | undefined;
let modelCatalog: ModelCatalog | undefined;

function getAuthMiddleware(env: Bindings): MiddlewareHandler<App> {
	if (!authMiddleware) {
		authMiddleware = createAuthMiddleware<App>(new JwtVerifier(env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD));
	}
	return authMiddleware;
}

function getGatewayProxy(env: Bindings): GatewayProxy {
	if (!gatewayProxy) {
		gatewayProxy = new GatewayProxy(env.CF_ACCOUNT_ID, env.CF_GATEWAY_NAME, env.CF_AIG_TOKEN);
	}
	return gatewayProxy;
}

function getModelCatalog(env: Bindings): ModelCatalog {
	if (!modelCatalog) {
		modelCatalog = new ModelCatalog(env.MODELS);
	}
	return modelCatalog;
}

app.use(createLoggingMiddleware());

app.onError((err, c) => {
	console.error(JSON.stringify({ error: err.message, stack: err.stack, path: c.req.path }));
	return c.json({ error: 'Internal server error' }, 500);
});

app.get('/.well-known/opencode', async (c) => {
	const origin = new URL(c.req.url).origin;
	const catalog = getModelCatalog(c.env);
	const modelsByGateway: Record<string, Record<string, Record<string, unknown>>> = {};

	await Promise.all(
		GATEWAY_PROVIDERS.map(async (provider) => {
			modelsByGateway[provider] = await catalog.getModels(provider);
		}),
	);

	return c.json(buildDiscoveryPayload(origin, modelsByGateway, c.env.GITHUB_MCP_HOST));
});

app.get('/.well-known/codex', (c) => c.json(new CodexCatalog().payload()));

app.use('/v1/*', async (c, next) => {
	// Path is `/v1/<provider>/...`. Reject unknown providers before the auth check so that
	// misrouted requests fail fast with a clear error instead of a 401.
	const provider = c.req.path.split('/')[2];
	if (!provider || !isGatewayProvider(provider)) return c.json({ error: 'Unknown provider' }, 404);
	await next();
});

app.use('/v1/*', (c, next) => getAuthMiddleware(c.env)(c, next));

app.all('/v1/:provider/*', (c) =>
	getGatewayProxy(c.env).proxy(c.req.raw, c.req.param('provider') as GatewayProvider, c.get('userEmail')),
);

app.get('/', (c) => c.html(landingPage(new URL(c.req.url).origin)));

app.get('/favicon.svg', (c) => {
	c.header('Content-Type', 'image/svg+xml');
	c.header('Cache-Control', 'public, max-age=86400');
	return c.body(icLogoFaviconSvg);
});

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default {
	fetch: app.fetch,
	async scheduled(_controller: ScheduledController, env: Bindings, _ctx: ExecutionContext) {
		await getModelCatalog(env).refresh();
	},
};
