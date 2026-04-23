import { describe, it, expect } from "vitest";
import { CodexCatalog, type CodexRule } from "../src/codex";

const sampleRules: CodexRule[] = [
  {
    id: "IC-TEST-001",
    title: "Write fast tests",
    category: "testing",
    severity: "important",
    source: "https://kt.dev",
    rationale: "Slow tests get skipped.",
  },
  {
    id: "IC-CODE-006",
    title: "Favor immutable objects",
    category: "code",
    severity: "important",
    rationale: "Mutable state is a liability.",
  },
];

describe("CodexCatalog", () => {
  it("returns all injected rules", () => {
    const catalog = new CodexCatalog(sampleRules);
    expect(catalog.all()).toEqual(sampleRules);
  });

  it("wraps rules in a versioned payload", () => {
    const catalog = new CodexCatalog(sampleRules);
    expect(catalog.payload()).toEqual({
      version: 1,
      count: 2,
      rules: sampleRules,
    });
  });

  it("defaults to the generated corpus when no rules are injected", () => {
    const catalog = new CodexCatalog();
    const rules = catalog.all();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.id).toMatch(/^IC-[A-Z]+-\d{3}$/);
      expect(["architecture", "code", "testing"]).toContain(rule.category);
      expect(["critical", "important", "suggestion", "nit"]).toContain(
        rule.severity,
      );
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.rationale.length).toBeGreaterThan(0);
    }
  });

  it("generated corpus has unique ids", () => {
    const ids = new CodexCatalog().all().map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
