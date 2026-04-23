import { CODEX_RULES, type CodexRule } from './codex.generated';

export type { CodexCategory, CodexSeverity, CodexRule } from './codex.generated';

export class CodexCatalog {
	constructor(private readonly rules: readonly CodexRule[] = CODEX_RULES) {}

	all(): readonly CodexRule[] {
		return this.rules;
	}

	get(id: string): CodexRule | undefined {
		return this.rules.find((rule) => rule.id === id);
	}

	payload() {
		return {
			version: 1,
			count: this.rules.length,
			rules: this.rules,
		};
	}
}
