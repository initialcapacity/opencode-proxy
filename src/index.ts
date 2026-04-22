import { Hono } from 'hono';
import { PROVIDERS } from './providers';
import { buildDiscoveryPayload } from './discovery';
import { createAuthMiddleware } from './middleware/auth';
import { createLoggingMiddleware } from './middleware/logging';
import { GatewayProxy } from './gateway';

type Bindings = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	CF_ACCOUNT_ID: string;
	CF_GATEWAY_NAME: string;
	CF_AIG_TOKEN: string;
};

type Variables = {
	userEmail: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(createLoggingMiddleware());

app.get('/.well-known/opencode', (c) => {
	return c.json(buildDiscoveryPayload(new URL(c.req.url).origin));
});

app.use('/v1/*', createAuthMiddleware());

for (const provider of PROVIDERS) {
	app.all(`/v1/${provider}/*`, (c) => {
		const proxy = new GatewayProxy(c.env.CF_ACCOUNT_ID, c.env.CF_GATEWAY_NAME, c.env.CF_AIG_TOKEN);
		return proxy.proxy(c.req.raw, provider, c.get('userEmail'));
	});
}

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
