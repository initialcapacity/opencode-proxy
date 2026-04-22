import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const GITHUB_API = 'https://api.github.com';

type GitHubFetch = (path: string, init?: RequestInit) => Promise<Response>;

function createGitHubFetch(token: string): GitHubFetch {
	return (path, init) =>
		fetch(`${GITHUB_API}${path}`, {
			...init,
			headers: {
				accept: 'application/vnd.github.v3+json',
				authorization: `Bearer ${token}`,
				'user-agent': 'ic-github-mcp',
				...init?.headers,
			},
		});
}

function textResult(text: string) {
	return { content: [{ type: 'text' as const, text }] };
}

async function jsonResult(response: Response) {
	if (!response.ok) {
		const body = await response.text();
		return textResult(`GitHub API error ${response.status}: ${body}`);
	}
	return textResult(JSON.stringify(await response.json(), null, 2));
}

export function createServer(githubToken: string, githubOrg: string): McpServer {
	const server = new McpServer({ name: 'IC GitHub', version: '1.0.0' });
	const gh = createGitHubFetch(githubToken);

	server.tool(
		'list_repos',
		'List repositories in the organization',
		{
			page: z.number().optional().describe('Page number (default 1)'),
			per_page: z.number().optional().describe('Results per page, max 100 (default 30)'),
		},
		async ({ page, per_page }) => {
			const params = new URLSearchParams();
			if (page) params.set('page', String(page));
			if (per_page) params.set('per_page', String(per_page));
			params.set('sort', 'updated');
			return jsonResult(await gh(`/orgs/${githubOrg}/repos?${params}`));
		},
	);

	server.tool(
		'search_code',
		'Search code across repositories in the organization',
		{
			query: z.string().describe('Search query (GitHub code search syntax)'),
			page: z.number().optional().describe('Page number (default 1)'),
			per_page: z.number().optional().describe('Results per page, max 100 (default 30)'),
		},
		async ({ query, page, per_page }) => {
			const params = new URLSearchParams();
			params.set('q', `${query} org:${githubOrg}`);
			if (page) params.set('page', String(page));
			if (per_page) params.set('per_page', String(per_page));
			return jsonResult(await gh(`/search/code?${params}`));
		},
	);

	server.tool(
		'get_file_content',
		'Get the content of a file from a repository',
		{
			repo: z.string().describe('Repository name (without org prefix)'),
			path: z.string().describe('File path within the repository'),
			ref: z.string().optional().describe('Git ref (branch, tag, or SHA). Defaults to the default branch.'),
		},
		async ({ repo, path, ref }) => {
			const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
			return jsonResult(await gh(`/repos/${githubOrg}/${repo}/contents/${path}${params}`));
		},
	);

	server.tool(
		'list_issues',
		'List issues for a repository',
		{
			repo: z.string().describe('Repository name (without org prefix)'),
			state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open)'),
			labels: z.string().optional().describe('Comma-separated list of label names'),
			page: z.number().optional().describe('Page number (default 1)'),
			per_page: z.number().optional().describe('Results per page, max 100 (default 30)'),
		},
		async ({ repo, state, labels, page, per_page }) => {
			const params = new URLSearchParams();
			if (state) params.set('state', state);
			if (labels) params.set('labels', labels);
			if (page) params.set('page', String(page));
			if (per_page) params.set('per_page', String(per_page));
			return jsonResult(await gh(`/repos/${githubOrg}/${repo}/issues?${params}`));
		},
	);

	server.tool(
		'get_issue',
		'Get details of a specific issue including comments',
		{
			repo: z.string().describe('Repository name (without org prefix)'),
			issue_number: z.number().describe('Issue number'),
		},
		async ({ repo, issue_number }) => {
			const [issue, comments] = await Promise.all([
				gh(`/repos/${githubOrg}/${repo}/issues/${issue_number}`),
				gh(`/repos/${githubOrg}/${repo}/issues/${issue_number}/comments`),
			]);
			if (!issue.ok) return jsonResult(issue);
			const issueData = (await issue.json()) as Record<string, unknown>;
			const commentsData = comments.ok ? await comments.json() : [];
			return textResult(JSON.stringify({ ...issueData, comments: commentsData }, null, 2));
		},
	);

	server.tool(
		'list_pull_requests',
		'List pull requests for a repository',
		{
			repo: z.string().describe('Repository name (without org prefix)'),
			state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open)'),
			page: z.number().optional().describe('Page number (default 1)'),
			per_page: z.number().optional().describe('Results per page, max 100 (default 30)'),
		},
		async ({ repo, state, page, per_page }) => {
			const params = new URLSearchParams();
			if (state) params.set('state', state);
			if (page) params.set('page', String(page));
			if (per_page) params.set('per_page', String(per_page));
			return jsonResult(await gh(`/repos/${githubOrg}/${repo}/pulls?${params}`));
		},
	);

	server.tool(
		'get_pull_request',
		'Get details of a specific pull request including the diff',
		{
			repo: z.string().describe('Repository name (without org prefix)'),
			pull_number: z.number().describe('Pull request number'),
		},
		async ({ repo, pull_number }) => {
			const [pr, diff] = await Promise.all([
				gh(`/repos/${githubOrg}/${repo}/pulls/${pull_number}`),
				gh(`/repos/${githubOrg}/${repo}/pulls/${pull_number}`, {
					headers: { accept: 'application/vnd.github.v3.diff' },
				}),
			]);
			if (!pr.ok) return jsonResult(pr);
			const prData = (await pr.json()) as Record<string, unknown>;
			const diffText = diff.ok ? await diff.text() : 'Could not fetch diff';
			return textResult(JSON.stringify({ ...prData, diff: diffText }, null, 2));
		},
	);

	return server;
}
