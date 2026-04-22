import { createMcpHandler } from 'agents/mcp';
import { JwtVerifier } from '../src/jwt';
import { getInstallationToken } from './github-app';
import { createServer } from './tools';

type Env = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	GITHUB_APP_ID: string;
	GITHUB_APP_PRIVATE_KEY: string;
	GITHUB_APP_INSTALLATION_ID: string;
	GITHUB_ORG: string;
};

let verifier: JwtVerifier | undefined;

function getVerifier(env: Env): JwtVerifier {
	if (!verifier) {
		verifier = new JwtVerifier(env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
	}
	return verifier;
}

function extractToken(request: Request): string | undefined {
	const apiKey = request.headers.get('x-api-key');
	if (apiKey) return apiKey;

	const auth = request.headers.get('authorization');
	if (auth?.startsWith('Bearer ')) return auth.slice(7);

	return undefined;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const token = extractToken(request);
		if (!token) {
			return new Response(JSON.stringify({ error: 'Missing authorization' }), {
				status: 401,
				headers: { 'content-type': 'application/json' },
			});
		}

		try {
			await getVerifier(env).verify(token);
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
				status: 401,
				headers: { 'content-type': 'application/json' },
			});
		}

		const githubToken = await getInstallationToken(
			env.GITHUB_APP_ID,
			env.GITHUB_APP_PRIVATE_KEY,
			env.GITHUB_APP_INSTALLATION_ID,
		);
		const server = createServer(githubToken, env.GITHUB_ORG);
		return createMcpHandler(server)(request, env, ctx);
	},
};
