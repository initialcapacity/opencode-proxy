import { Hono, type MiddlewareHandler } from 'hono';
import { buildDiscoveryPayload, GATEWAY_PROVIDERS, isGatewayProvider, type GatewayProvider } from './discovery';
import { createAuthMiddleware, type AuthVariables } from './auth';
import { createLoggingMiddleware } from './logging';
import { GatewayProxy } from './gateway';
import { JwtVerifier } from './jwt';
import { ModelCatalog } from './models';
import { landingPage } from './landing';

type Bindings = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	CF_ACCOUNT_ID: string;
	CF_GATEWAY_NAME: string;
	CF_AIG_TOKEN: string;
	MODELS: KVNamespace;
};

type App = { Bindings: Bindings; Variables: AuthVariables };

const app = new Hono<App>();

// Lazily constructed on first request because env is only available in request scope.
// Workers isolates are long-lived, so this runs once per cold start.
let authMiddleware: MiddlewareHandler<App> | undefined;

app.use(createLoggingMiddleware());

app.get('/.well-known/opencode', async (c) => {
	const origin = new URL(c.req.url).origin;
	const catalog = new ModelCatalog(c.env.MODELS);
	const modelsByGateway: Record<string, Record<string, Record<string, unknown>>> = {};

	await Promise.all(
		GATEWAY_PROVIDERS.map(async (provider) => {
			modelsByGateway[provider] = await catalog.getModels(provider);
		}),
	);

	return c.json(buildDiscoveryPayload(origin, modelsByGateway));
});

app.use('/v1/*', async (c, next) => {
	const provider = c.req.path.split('/')[2];
	if (!provider || !isGatewayProvider(provider)) return c.json({ error: 'Unknown provider' }, 404);
	await next();
});

app.use('/v1/*', (c, next) => {
	if (!authMiddleware) {
		authMiddleware = createAuthMiddleware<App>(new JwtVerifier(c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD));
	}
	return authMiddleware(c, next);
});

app.all('/v1/:provider/*', (c) => {
	const proxy = new GatewayProxy(c.env.CF_ACCOUNT_ID, c.env.CF_GATEWAY_NAME, c.env.CF_AIG_TOKEN);
	return proxy.proxy(c.req.raw, c.req.param('provider') as GatewayProvider, c.get('userEmail'));
});

app.post('/admin/refresh-models', (c, next) => {
	if (!authMiddleware) {
		authMiddleware = createAuthMiddleware<App>(new JwtVerifier(c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD));
	}
	return authMiddleware(c, next);
}, async (c) => {
	const catalog = new ModelCatalog(c.env.MODELS);
	await catalog.refresh();
	return c.json({ ok: true });
});

app.get('/', (c) => c.html(landingPage(new URL(c.req.url).origin)));

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default {
	fetch: app.fetch,
	async scheduled(_controller: ScheduledController, env: Bindings, _ctx: ExecutionContext) {
		const catalog = new ModelCatalog(env.MODELS);
		await catalog.refresh();
	},
};
