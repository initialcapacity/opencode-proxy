import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type GitHubFetch = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

export function createGitHubFetch(token: string): GitHubFetch {
  return (path, init) =>
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github.v3+json",
        authorization: `Bearer ${token}`,
        "user-agent": "ic-github-mcp",
        ...init?.headers,
      },
    });
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function buildErrorMessage(
  response: Response,
  body: string,
  context?: string,
): string {
  const scope = context ? ` while fetching ${context}` : "";
  return `GitHub API error ${response.status}${scope}: ${body}`;
}

async function errorResult(response: Response, context?: string) {
  const body = await response.text();
  return textResult(buildErrorMessage(response, body, context));
}

async function jsonResult(response: Response, context?: string) {
  if (!response.ok) {
    return errorResult(response, context);
  }
  return textResult(JSON.stringify(await response.json(), null, 2));
}

export const toolDefs = {
  list_repos:
    (gh: GitHubFetch, org: string) =>
    async ({ page, per_page }: { page?: number; per_page?: number }) => {
      const params = new URLSearchParams();
      if (page != null) params.set("page", String(page));
      if (per_page != null) params.set("per_page", String(per_page));
      params.set("sort", "updated");
      return jsonResult(await gh(`/orgs/${org}/repos?${params}`));
    },

  search_code:
    (gh: GitHubFetch, org: string) =>
    async ({
      query,
      page,
      per_page,
    }: {
      query: string;
      page?: number;
      per_page?: number;
    }) => {
      // Prevent scope escape via caller-supplied org:/user:/repo: qualifiers.
      if (/\b(org|user|repo):/i.test(query)) {
        return textResult(
          "GitHub MCP error: query must not contain org:, user:, or repo: qualifiers",
        );
      }
      const params = new URLSearchParams();
      params.set("q", `${query} org:${org}`);
      if (page != null) params.set("page", String(page));
      if (per_page != null) params.set("per_page", String(per_page));
      return jsonResult(await gh(`/search/code?${params}`));
    },

  get_file_content:
    (gh: GitHubFetch, org: string) =>
    async ({
      repo,
      path,
      ref,
    }: {
      repo: string;
      path: string;
      ref?: string;
    }) => {
      // Encode each path segment so `#`, `?`, and spaces in filenames don't corrupt the URL;
      // preserve the `/` separators so the GitHub contents API resolves the tree correctly.
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const params = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      return jsonResult(
        await gh(`/repos/${org}/${repo}/contents/${encodedPath}${params}`),
      );
    },

  list_issues:
    (gh: GitHubFetch, org: string) =>
    async ({
      repo,
      state,
      labels,
      page,
      per_page,
    }: {
      repo: string;
      state?: string;
      labels?: string;
      page?: number;
      per_page?: number;
    }) => {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (labels) params.set("labels", labels);
      if (page != null) params.set("page", String(page));
      if (per_page != null) params.set("per_page", String(per_page));
      return jsonResult(await gh(`/repos/${org}/${repo}/issues?${params}`));
    },

  get_issue:
    (gh: GitHubFetch, org: string) =>
    async ({ repo, issue_number }: { repo: string; issue_number: number }) => {
      const [issue, comments] = await Promise.all([
        gh(`/repos/${org}/${repo}/issues/${issue_number}`),
        gh(`/repos/${org}/${repo}/issues/${issue_number}/comments`),
      ]);
      if (!issue.ok) return jsonResult(issue, `issue #${issue_number}`);
      const issueData = (await issue.json()) as Record<string, unknown>;
      if (!comments.ok) {
        const body = await comments.text();
        return textResult(
          JSON.stringify(
            {
              ...issueData,
              comments: [],
              comments_error: buildErrorMessage(
                comments,
                body,
                `comments for issue #${issue_number}`,
              ),
            },
            null,
            2,
          ),
        );
      }
      const commentsData = await comments.json();
      return textResult(
        JSON.stringify({ ...issueData, comments: commentsData }, null, 2),
      );
    },

  list_pull_requests:
    (gh: GitHubFetch, org: string) =>
    async ({
      repo,
      state,
      page,
      per_page,
    }: {
      repo: string;
      state?: string;
      page?: number;
      per_page?: number;
    }) => {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (page != null) params.set("page", String(page));
      if (per_page != null) params.set("per_page", String(per_page));
      return jsonResult(await gh(`/repos/${org}/${repo}/pulls?${params}`));
    },

  get_pull_request:
    (gh: GitHubFetch, org: string) =>
    async ({ repo, pull_number }: { repo: string; pull_number: number }) => {
      const [pr, diff] = await Promise.all([
        gh(`/repos/${org}/${repo}/pulls/${pull_number}`),
        gh(`/repos/${org}/${repo}/pulls/${pull_number}`, {
          headers: { accept: "application/vnd.github.v3.diff" },
        }),
      ]);
      if (!pr.ok) return jsonResult(pr, `pull request #${pull_number}`);
      const prData = (await pr.json()) as Record<string, unknown>;
      if (!diff.ok) {
        const body = await diff.text();
        return textResult(
          JSON.stringify(
            {
              ...prData,
              diff: "",
              diff_error: buildErrorMessage(
                diff,
                body,
                `pull request #${pull_number} diff`,
              ),
            },
            null,
            2,
          ),
        );
      }
      const diffText = await diff.text();
      return textResult(JSON.stringify({ ...prData, diff: diffText }, null, 2));
    },
};

export function createServer(
  githubToken: string,
  githubOrg: string,
): McpServer {
  const server = new McpServer({ name: "IC GitHub", version: "1.0.0" });
  const gh = createGitHubFetch(githubToken);

  server.tool(
    "list_repos",
    "List repositories in the organization, sorted by most recently updated. Paginated — use page and per_page to navigate results.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      per_page: z
        .number()
        .optional()
        .describe("Results per page, max 100 (default 30)"),
    },
    toolDefs.list_repos(gh, githubOrg),
  );

  server.tool(
    "search_code",
    "Search code across repositories in the organization",
    {
      query: z.string().describe("Search query (GitHub code search syntax)"),
      page: z.number().optional().describe("Page number (default 1)"),
      per_page: z
        .number()
        .optional()
        .describe("Results per page, max 100 (default 30)"),
    },
    toolDefs.search_code(gh, githubOrg),
  );

  server.tool(
    "get_file_content",
    "Get the content of a file from a repository",
    {
      repo: z.string().describe("Repository name (without org prefix)"),
      path: z.string().describe("File path within the repository"),
      ref: z
        .string()
        .optional()
        .describe(
          "Git ref (branch, tag, or SHA). Defaults to the default branch.",
        ),
    },
    toolDefs.get_file_content(gh, githubOrg),
  );

  server.tool(
    "list_issues",
    "List issues for a repository",
    {
      repo: z.string().describe("Repository name (without org prefix)"),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .describe("Filter by state (default open)"),
      labels: z
        .string()
        .optional()
        .describe("Comma-separated list of label names"),
      page: z.number().optional().describe("Page number (default 1)"),
      per_page: z
        .number()
        .optional()
        .describe("Results per page, max 100 (default 30)"),
    },
    toolDefs.list_issues(gh, githubOrg),
  );

  server.tool(
    "get_issue",
    "Get details of a specific issue including comments",
    {
      repo: z.string().describe("Repository name (without org prefix)"),
      issue_number: z.number().describe("Issue number"),
    },
    toolDefs.get_issue(gh, githubOrg),
  );

  server.tool(
    "list_pull_requests",
    "List pull requests for a repository",
    {
      repo: z.string().describe("Repository name (without org prefix)"),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .describe("Filter by state (default open)"),
      page: z.number().optional().describe("Page number (default 1)"),
      per_page: z
        .number()
        .optional()
        .describe("Results per page, max 100 (default 30)"),
    },
    toolDefs.list_pull_requests(gh, githubOrg),
  );

  server.tool(
    "get_pull_request",
    "Get details of a specific pull request including the diff",
    {
      repo: z.string().describe("Repository name (without org prefix)"),
      pull_number: z.number().describe("Pull request number"),
    },
    toolDefs.get_pull_request(gh, githubOrg),
  );

  return server;
}
