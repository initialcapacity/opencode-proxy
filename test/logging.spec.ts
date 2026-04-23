import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createLoggingMiddleware } from '../src/logging';
import type { AuthVariables } from '../src/auth';

type TestEnv = { Variables: AuthVariables };

function appWithLogging(setEmail?: string) {
	const app = new Hono<TestEnv>();
	app.use(createLoggingMiddleware<TestEnv>());
	if (setEmail) {
		app.use('*', async (c, next) => {
			c.set('userEmail', setEmail);
			await next();
		});
	}
	app.get('/ok', (c) => c.text('ok'));
	app.get('/boom', () => {
		throw new Error('kaboom');
	});
	return app;
}

describe('logging middleware', () => {
	afterEach(() => vi.restoreAllMocks());

	it('logs method, path, status, and duration as a single JSON line', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const app = appWithLogging();

		await app.fetch(new Request('http://localhost/ok'));

		expect(logSpy).toHaveBeenCalledTimes(1);
		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.method).toBe('GET');
		expect(entry.path).toBe('/ok');
		expect(entry.status).toBe(200);
		expect(typeof entry.duration).toBe('number');
	});

	it('defaults the user field to "anonymous" when auth did not set it', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const app = appWithLogging();

		await app.fetch(new Request('http://localhost/ok'));

		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.user).toBe('anonymous');
	});

	it('uses the userEmail set by upstream middleware', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const app = appWithLogging('user@example.com');

		await app.fetch(new Request('http://localhost/ok'));

		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.user).toBe('user@example.com');
	});
});
