import { createMcpHandler } from 'agents/mcp';
import { authenticate } from '../src/auth';
import { JwtVerifier } from '../src/jwt';
import { GitHubAppAuth } from './github-app';
import { createServer } from './tools';

type Env = {
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	GITHUB_APP_ID: string;
	GITHUB_APP_PRIVATE_KEY: string;
	GITHUB_APP_INSTALLATION_ID: string;
	GITHUB_ORG: string;
};

// Lazily constructed on first request because env is only available in request scope.
// Workers isolates are long-lived, so these run once per cold start.
let verifier: JwtVerifier | undefined;
let githubAuth: GitHubAppAuth | undefined;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (!verifier) {
			verifier = new JwtVerifier(env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
		}
		const auth = await authenticate(request, verifier);
		if (auth instanceof Response) return auth;

		if (!githubAuth) {
			githubAuth = new GitHubAppAuth(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, env.GITHUB_APP_INSTALLATION_ID);
		}

		const githubToken = await githubAuth.getInstallationToken();
		const server = createServer(githubToken, env.GITHUB_ORG);
		return createMcpHandler(server)(request, env, ctx);
	},
};
