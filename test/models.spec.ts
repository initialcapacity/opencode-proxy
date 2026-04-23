import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { ModelCatalog, type FetchFn } from "../src/models";

const modelsDevResponse = {
  anthropic: {
    id: "anthropic",
    npm: "@ai-sdk/anthropic",
    name: "Anthropic",
    models: {
      "claude-sonnet-4-5": {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        limit: { context: 200000, output: 64000 },
      },
    },
  },
  openai: {
    id: "openai",
    npm: "@ai-sdk/openai",
    name: "OpenAI",
    models: {
      "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        limit: { context: 128000, output: 16384 },
      },
    },
  },
  "cloudflare-workers-ai": {
    id: "cloudflare-workers-ai",
    npm: "@ai-sdk/openai-compatible",
    name: "Cloudflare Workers AI",
    models: {
      "@cf/meta/llama-3.1-8b-instruct": {
        id: "@cf/meta/llama-3.1-8b-instruct",
        name: "Llama 3.1 8B Instruct",
      },
    },
  },
  google: {
    id: "google",
    npm: "@ai-sdk/google",
    name: "Google AI Studio",
    models: {
      "gemini-2.5-flash": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        limit: { context: 1048576, output: 65536 },
      },
    },
  },
  groq: {
    id: "groq",
    npm: "@ai-sdk/groq",
    name: "Groq",
    models: { "llama-3": { id: "llama-3", name: "Llama 3" } },
  },
};

function fakeFetch(status: number, body: unknown): FetchFn {
  return async () => new Response(JSON.stringify(body), { status });
}

describe("ModelCatalog", () => {
  beforeEach(async () => {
    await env.MODELS.delete("models:anthropic");
    await env.MODELS.delete("models:google-ai-studio");
    await env.MODELS.delete("models:openai");
    await env.MODELS.delete("models:compat");
  });

  describe("refresh", () => {
    it("fetches models from models.dev and stores them in KV", async () => {
      const catalog = new ModelCatalog(
        env.MODELS,
        fakeFetch(200, modelsDevResponse),
      );

      await catalog.refresh();

      const anthropicRaw = await env.MODELS.get("models:anthropic");
      const googleRaw = await env.MODELS.get("models:google-ai-studio");
      const openaiRaw = await env.MODELS.get("models:openai");
      const compatRaw = await env.MODELS.get("models:compat");
      expect(JSON.parse(anthropicRaw!)).toEqual(
        modelsDevResponse.anthropic.models,
      );
      expect(JSON.parse(googleRaw!)).toEqual(modelsDevResponse.google.models);
      expect(JSON.parse(openaiRaw!)).toEqual(modelsDevResponse.openai.models);
      expect(JSON.parse(compatRaw!)).toEqual({
        "workers-ai/@cf/meta/llama-3.1-8b-instruct": {
          id: "workers-ai/@cf/meta/llama-3.1-8b-instruct",
          name: "Llama 3.1 8B Instruct",
        },
      });
    });

    it("does not store models for unsupported providers", async () => {
      const catalog = new ModelCatalog(
        env.MODELS,
        fakeFetch(200, modelsDevResponse),
      );

      await catalog.refresh();

      const groqRaw = await env.MODELS.get("models:groq");
      expect(groqRaw).toBeNull();
    });

    it("throws on non-200 responses", async () => {
      const catalog = new ModelCatalog(
        env.MODELS,
        fakeFetch(500, { error: "server error" }),
      );

      await expect(catalog.refresh()).rejects.toThrow(
        "models.dev returned 500",
      );
    });

    it("converts non-boolean experimental fields to true", async () => {
      const response = {
        anthropic: {
          models: {
            "claude-opus-4-6": {
              id: "claude-opus-4-6",
              name: "Claude Opus 4.6",
              experimental: { modes: { fast: { cost: { input: 30 } } } },
            },
            "claude-sonnet-4-5": {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
              experimental: false,
            },
          },
        },
        google: modelsDevResponse.google,
        openai: modelsDevResponse.openai,
        "cloudflare-workers-ai": modelsDevResponse["cloudflare-workers-ai"],
      };
      const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, response));

      await catalog.refresh();

      const models = JSON.parse((await env.MODELS.get("models:anthropic"))!);
      expect(models["claude-opus-4-6"].experimental).toBe(true);
      expect(models["claude-sonnet-4-5"].experimental).toBe(false);
    });

    it("keeps the last successful catalog when a provider is missing from the response", async () => {
      await env.MODELS.put(
        "models:anthropic",
        JSON.stringify(modelsDevResponse.anthropic.models),
      );
      await env.MODELS.put(
        "models:google-ai-studio",
        JSON.stringify(modelsDevResponse.google.models),
      );
      await env.MODELS.put(
        "models:openai",
        JSON.stringify(modelsDevResponse.openai.models),
      );
      const partial = { anthropic: modelsDevResponse.anthropic };
      const catalog = new ModelCatalog(env.MODELS, fakeFetch(200, partial));

      await expect(catalog.refresh()).rejects.toThrow(
        "models.dev response missing provider openai",
      );

      const anthropicRaw = await env.MODELS.get("models:anthropic");
      const googleRaw = await env.MODELS.get("models:google-ai-studio");
      const openaiRaw = await env.MODELS.get("models:openai");
      expect(JSON.parse(anthropicRaw!)).toEqual(
        modelsDevResponse.anthropic.models,
      );
      expect(JSON.parse(googleRaw!)).toEqual(modelsDevResponse.google.models);
      expect(JSON.parse(openaiRaw!)).toEqual(modelsDevResponse.openai.models);
    });
  });

  describe("getModels", () => {
    it("returns models from KV", async () => {
      await env.MODELS.put(
        "models:anthropic",
        JSON.stringify(modelsDevResponse.anthropic.models),
      );
      const catalog = new ModelCatalog(env.MODELS);

      const models = await catalog.getModels("anthropic");

      expect(models).toEqual(modelsDevResponse.anthropic.models);
    });

    it("returns an empty object when KV has no data", async () => {
      const catalog = new ModelCatalog(env.MODELS);

      const models = await catalog.getModels("anthropic");

      expect(models).toEqual({});
    });
  });
});
