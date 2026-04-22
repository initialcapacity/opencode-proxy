import { describe, it, expect } from 'vitest';
import { toolDefs, type GitHubFetch } from '../github-mcp/tools';

const ORG = 'test-org';

type CapturedRequest = { path: string; init?: RequestInit };

function capturingGitHubFetch(status: number, body: unknown): { gh: GitHubFetch; captured: CapturedRequest[] } {
	const captured: CapturedRequest[] = [];
	const gh: GitHubFetch = async (path, init) => {
		captured.push({ path, init });
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	};
	return { gh, captured };
}

describe('GitHub MCP tools', () => {
	describe('list_repos', () => {
		it('calls the correct endpoint with sort=updated', async () => {
			const { gh, captured } = capturingGitHubFetch(200, [{ name: 'repo-1' }]);
			const handler = toolDefs.list_repos(gh, ORG);

			await handler({});

			expect(captured).toHaveLength(1);
			expect(captured[0].path).toContain(`/orgs/${ORG}/repos`);
			expect(captured[0].path).toContain('sort=updated');
		});

		it('passes pagination parameters', async () => {
			const { gh, captured } = capturingGitHubFetch(200, []);
			const handler = toolDefs.list_repos(gh, ORG);

			await handler({ page: 2, per_page: 10 });

			expect(captured[0].path).toContain('page=2');
			expect(captured[0].path).toContain('per_page=10');
		});
	});

	describe('search_code', () => {
		it('scopes the query to the org', async () => {
			const { gh, captured } = capturingGitHubFetch(200, { items: [] });
			const handler = toolDefs.search_code(gh, ORG);

			await handler({ query: 'createServer' });

			expect(captured[0].path).toContain('/search/code');
			expect(captured[0].path).toContain('q=createServer+org%3A' + ORG);
		});
	});

	describe('get_file_content', () => {
		it('fetches from the correct path', async () => {
			const { gh, captured } = capturingGitHubFetch(200, { content: 'base64data' });
			const handler = toolDefs.get_file_content(gh, ORG);

			await handler({ repo: 'my-repo', path: 'src/index.ts' });

			expect(captured[0].path).toBe(`/repos/${ORG}/my-repo/contents/src/index.ts`);
		});

		it('passes the ref parameter', async () => {
			const { gh, captured } = capturingGitHubFetch(200, { content: 'base64data' });
			const handler = toolDefs.get_file_content(gh, ORG);

			await handler({ repo: 'my-repo', path: 'README.md', ref: 'feature-branch' });

			expect(captured[0].path).toContain('?ref=feature-branch');
		});
	});

	describe('list_issues', () => {
		it('filters by state and labels', async () => {
			const { gh, captured } = capturingGitHubFetch(200, []);
			const handler = toolDefs.list_issues(gh, ORG);

			await handler({ repo: 'my-repo', state: 'closed', labels: 'bug,urgent' });

			expect(captured[0].path).toContain(`/repos/${ORG}/my-repo/issues`);
			expect(captured[0].path).toContain('state=closed');
			expect(captured[0].path).toContain('labels=bug%2Curgent');
		});
	});

	describe('get_issue', () => {
		it('fetches issue details and comments in parallel', async () => {
			const { gh, captured } = capturingGitHubFetch(200, { title: 'Test issue' });
			const handler = toolDefs.get_issue(gh, ORG);

			const result = await handler({ repo: 'my-repo', issue_number: 42 });

			expect(captured).toHaveLength(2);
			expect(captured[0].path).toBe(`/repos/${ORG}/my-repo/issues/42`);
			expect(captured[1].path).toBe(`/repos/${ORG}/my-repo/issues/42/comments`);

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.comments).toBeDefined();
		});
	});

	describe('list_pull_requests', () => {
		it('calls the correct endpoint with state filter', async () => {
			const { gh, captured } = capturingGitHubFetch(200, []);
			const handler = toolDefs.list_pull_requests(gh, ORG);

			await handler({ repo: 'my-repo', state: 'all' });

			expect(captured[0].path).toContain(`/repos/${ORG}/my-repo/pulls`);
			expect(captured[0].path).toContain('state=all');
		});
	});

	describe('get_pull_request', () => {
		it('fetches PR details and diff in parallel', async () => {
			const { gh, captured } = capturingGitHubFetch(200, { title: 'Test PR' });
			const handler = toolDefs.get_pull_request(gh, ORG);

			const result = await handler({ repo: 'my-repo', pull_number: 7 });

			expect(captured).toHaveLength(2);
			expect(captured[0].path).toBe(`/repos/${ORG}/my-repo/pulls/7`);
			expect(captured[1].path).toBe(`/repos/${ORG}/my-repo/pulls/7`);
			expect(captured[1].init?.headers).toHaveProperty('accept', 'application/vnd.github.v3.diff');

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.diff).toBeDefined();
		});
	});

	describe('error handling', () => {
		it('returns GitHub API errors as text content', async () => {
			const { gh } = capturingGitHubFetch(404, { message: 'Not Found' });
			const handler = toolDefs.list_repos(gh, ORG);

			const result = await handler({});

			expect(result.content[0].text).toContain('GitHub API error 404');
		});
	});
});
