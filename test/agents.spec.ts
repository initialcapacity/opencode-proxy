import { describe, it, expect } from 'vitest';
import { AGENTS, COMMANDS } from '../src/agents';

describe('agents.generated', () => {
	it('defines a code-reviewer subagent', () => {
		const reviewer = AGENTS['code-reviewer'];
		expect(reviewer).toBeDefined();
		expect(reviewer.mode).toBe('subagent');
		expect(reviewer.description).toEqual(expect.stringContaining('IC Codex'));
	});

	it("locks the reviewer's permissions to read-only plus webfetch", () => {
		const permission = AGENTS['code-reviewer'].permission as Record<string, unknown>;
		expect(permission.edit).toBe('deny');
		expect(permission.webfetch).toBe('allow');
	});

	it("inlines the full IC Codex into the reviewer's system prompt", () => {
		const prompt = AGENTS['code-reviewer'].prompt as string;
		expect(prompt).toContain('## The IC Codex');
		expect(prompt).toContain('IC-TEST-009 — Avoid mocks');
		expect(prompt).toContain('IC-CODE-006 — Favor immutable objects');
		expect(prompt).toContain('IC-ARCH-011 — Avoid circular dependencies');
	});

	it("spells out the reviewer's output format with severity tags and rule IDs", () => {
		const prompt = AGENTS['code-reviewer'].prompt as string;
		expect(prompt).toContain('[<severity>]');
		expect(prompt).toContain('[<IC-rule-id>]');
		expect(prompt).toContain('critical');
		expect(prompt).toContain('important');
		expect(prompt).toContain('suggestion');
		expect(prompt).toContain('nit');
	});

	it('restricts the reviewer to IC Codex findings only', () => {
		const prompt = AGENTS['code-reviewer'].prompt as string;
		expect(prompt).toContain('Only raise findings that map to a specific IC Codex rule');
		expect(prompt).toContain('No IC Codex violations found.');
	});

	it('defines a /review command that delegates to code-reviewer as a subtask', () => {
		const review = COMMANDS.review;
		expect(review).toBeDefined();
		expect(review.agent).toBe('code-reviewer');
		expect(review.subtask).toBe(true);
		expect(review.template).toEqual(expect.stringContaining('git diff'));
		expect(review.template).toEqual(expect.stringContaining('@AGENTS.md'));
	});
});
