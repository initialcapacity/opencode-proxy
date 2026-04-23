import { SELF, env, fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, it, expect } from "vitest";
import { generateKeyPair, signJWT } from "./helpers/jwt";

describe("integration", () => {
  beforeAll(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => fetchMock.assertNoPendingInterceptors());

  it("returns discovery config without authentication", async () => {
    const response = await SELF.fetch(
      "https://opencode.icap.dev/.well-known/opencode",
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as any;
    expect(body.auth.command).toEqual([
      "cloudflared",
      "access",
      "login",
      "--no-verbose",
      "https://opencode.icap.dev",
    ]);
    expect(body.auth.env).toBe("CF_ACCESS_TOKEN");
    expect(body.config.enabled_providers).toEqual([
      "ic-anthropic",
      "ic-gemini",
      "ic-openai",
      "ic-workers-ai",
    ]);
    expect(body.config.provider["ic-anthropic"].npm).toBe("@ai-sdk/anthropic");
    expect(body.config.provider["ic-anthropic"].options.baseURL).toBe(
      "https://opencode.icap.dev/v1/anthropic",
    );
    expect(body.config.provider["ic-gemini"].npm).toBe("@ai-sdk/google");
    expect(body.config.provider["ic-gemini"].options).toEqual({
      baseURL: "https://opencode.icap.dev/v1/google-ai-studio/v1beta",
      apiKey: "{env:CF_ACCESS_TOKEN}",
    });
    expect(body.config.provider["ic-openai"].npm).toBe("@ai-sdk/openai");
    expect(body.config.provider["ic-openai"].options.baseURL).toBe(
      "https://opencode.icap.dev/v1/openai",
    );
    expect(body.config.provider["ic-workers-ai"].npm).toBe(
      "@ai-sdk/openai-compatible",
    );
    expect(body.config.provider["ic-workers-ai"].options.baseURL).toBe(
      "https://opencode.icap.dev/v1/compat",
    );
    expect(body.config.mcp.github.type).toBe("remote");
    expect(body.config.mcp.github.url).toBe("https://github-mcp.icap.dev/mcp");
    expect(body.config.mcp.github.enabled).toBe(true);
    expect(body.config.agent["code-reviewer"].mode).toBe("subagent");
    expect(body.config.agent["code-reviewer"].prompt).toContain("IC Codex");
    expect(body.config.command.review.agent).toBe("code-reviewer");
    expect(body.config.command.review.subtask).toBe(true);
  });

  it("includes models from KV in discovery config", async () => {
    const models = { "claude-sonnet-4-5": { name: "Claude Sonnet 4.5" } };
    await env.MODELS.put("models:anthropic", JSON.stringify(models));
    const geminiModels = { "gemini-2.5-flash": { name: "Gemini 2.5 Flash" } };
    await env.MODELS.put(
      "models:google-ai-studio",
      JSON.stringify(geminiModels),
    );

    const response = await SELF.fetch(
      "https://opencode.icap.dev/.well-known/opencode",
    );
    const body = (await response.json()) as any;

    expect(body.config.provider["ic-anthropic"].models).toEqual(models);
    expect(body.config.provider["ic-gemini"].models).toEqual(geminiModels);

    await env.MODELS.delete("models:anthropic");
    await env.MODELS.delete("models:google-ai-studio");
  });

  it("refreshes the model catalog on discovery when a provider is missing from KV", async () => {
    await env.MODELS.delete("models:anthropic");
    await env.MODELS.delete("models:google-ai-studio");
    await env.MODELS.delete("models:openai");
    await env.MODELS.delete("models:compat");

    fetchMock
      .get("https://models.dev")
      .intercept({ path: "/api.json" })
      .reply(200, {
        anthropic: {
          models: {
            "claude-sonnet-4-5": {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
            },
          },
        },
        google: {
          models: {
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
            },
          },
        },
        openai: {
          models: { "gpt-4o": { id: "gpt-4o", name: "GPT-4o" } },
        },
        "cloudflare-workers-ai": {
          models: {
            "@cf/meta/llama-3.1-8b-instruct": {
              id: "@cf/meta/llama-3.1-8b-instruct",
              name: "Llama 3.1 8B Instruct",
            },
          },
        },
      });

    const response = await SELF.fetch(
      "https://opencode.icap.dev/.well-known/opencode",
    );
    const body = (await response.json()) as any;

    expect(body.config.provider["ic-gemini"].models).toEqual({
      "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    });

    await env.MODELS.delete("models:anthropic");
    await env.MODELS.delete("models:google-ai-studio");
    await env.MODELS.delete("models:openai");
    await env.MODELS.delete("models:compat");
  });

  it("rejects proxy requests without authorization", async () => {
    const response = await SELF.fetch(
      "https://opencode.icap.dev/v1/anthropic/v1/messages",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Missing authorization" });
  });

  it("rejects proxy requests with invalid JWT", async () => {
    const response = await SELF.fetch(
      "https://opencode.icap.dev/v1/anthropic/v1/messages",
      {
        method: "POST",
        headers: { "x-api-key": "not-a-valid-jwt" },
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns landing page at root", async () => {
    const response = await SELF.fetch("https://opencode.icap.dev/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("brew install anomalyco/tap/opencode cloudflared");
    expect(body).toContain("opencode auth login");
    expect(body).toContain("opencode.icap.dev");
    expect(body).toContain("opencode-proxy#readme");
    expect(body).toContain(">docs<");
  });

  it("serves the IC logo as an SVG favicon", async () => {
    const response = await SELF.fetch("https://opencode.icap.dev/favicon.svg");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const body = await response.text();
    expect(body).toContain("<svg");
    expect(body).toContain('viewBox="0 0 356 168"');
  });

  it("returns 404 for unknown paths", async () => {
    const response = await SELF.fetch("https://opencode.icap.dev/unknown");

    expect(response.status).toBe(404);
  });

  it("returns codex rules without authentication", async () => {
    const response = await SELF.fetch(
      "https://opencode.icap.dev/.well-known/codex",
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      version: number;
      count: number;
      rules: Array<{
        id: string;
        title: string;
        category: string;
        severity: string;
        rationale: string;
      }>;
    };
    expect(body.version).toBe(1);
    expect(body.count).toBe(body.rules.length);
    expect(body.rules.length).toBeGreaterThan(0);
    expect(body.rules.every((r) => /^IC-[A-Z]+-\d{3}$/.test(r.id))).toBe(true);
    expect(
      body.rules.some(
        (r) => r.id === "IC-TEST-009" && r.title === "Avoid mocks",
      ),
    ).toBe(true);
  });

  it("returns 404 for unknown providers without requiring authentication", async () => {
    const response = await SELF.fetch(
      "https://opencode.icap.dev/v1/groq/v1/messages",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Unknown provider" });
  });

  it("proxies authenticated Anthropic and Google AI Studio requests through the AI gateway", async () => {
    const { publicJWK, privateKey } = await generateKeyPair();
    const token = await signJWT(
      {
        aud: [env.CF_ACCESS_AUD],
        email: "user@example.com",
        iss: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: "user-id",
      },
      privateKey,
      publicJWK.kid,
    );

    fetchMock
      .get(`https://${env.CF_ACCESS_TEAM_DOMAIN}`)
      .intercept({ path: "/cdn-cgi/access/certs" })
      .reply(200, { keys: [publicJWK] });

    fetchMock
      .get("https://gateway.ai.cloudflare.com")
      .intercept({ method: "POST", path: /\/v1\/.+/ })
      .reply(
        200,
        { ok: true },
        { headers: { "content-type": "application/json" } },
      );

    fetchMock
      .get("https://gateway.ai.cloudflare.com")
      .intercept({ method: "POST", path: /\/v1\/.+/ })
      .reply(
        200,
        { ok: true },
        { headers: { "content-type": "application/json" } },
      );

    const anthropicResponse = await SELF.fetch(
      "https://opencode.icap.dev/v1/anthropic/v1/messages",
      {
        method: "POST",
        headers: { "x-api-key": token, "content-type": "application/json" },
        body: '{"model":"claude"}',
      },
    );

    expect(anthropicResponse.status).toBe(200);
    expect(await anthropicResponse.json()).toEqual({ ok: true });

    const googleResponse = await SELF.fetch(
      "https://opencode.icap.dev/v1/google-ai-studio/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": token,
          "content-type": "application/json",
        },
        body: '{"contents":[{"parts":[{"text":"Hello"}]}]}',
      },
    );

    expect(googleResponse.status).toBe(200);
    expect(await googleResponse.json()).toEqual({ ok: true });
  });
});
