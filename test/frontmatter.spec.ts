import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

describe('parseFrontmatter', () => {
	it('parses scalar string fields', () => {
		const { data, body } = parseFrontmatter('---\nid: IC-CODE-001\ntitle: Some title\n---\nHello world', 'x.md');
		expect(data).toEqual({ id: 'IC-CODE-001', title: 'Some title' });
		expect(body).toBe('Hello world');
	});

	it('strips surrounding double and single quotes from scalar values', () => {
		const { data } = parseFrontmatter(`---\na: "quoted value"\nb: 'apostrophed'\n---\nbody`, 'x.md');
		expect(data).toEqual({ a: 'quoted value', b: 'apostrophed' });
	});

	it('coerces booleans and numbers', () => {
		const { data } = parseFrontmatter(`---\nenabled: true\ndisabled: false\ncount: 42\nrate: 0.5\nneg: -3\n---\nbody`, 'x.md');
		expect(data).toEqual({ enabled: true, disabled: false, count: 42, rate: 0.5, neg: -3 });
	});

	it('parses a single-level nested map', () => {
		const source = '---\npermission:\n  edit: deny\n  webfetch: allow\n---\nbody';
		const { data } = parseFrontmatter(source, 'x.md');
		expect(data).toEqual({ permission: { edit: 'deny', webfetch: 'allow' } });
	});

	it('returns to the top level after a blank line in the header', () => {
		const source = '---\nmap:\n  k: v\n\ntop: value\n---\nbody';
		const { data } = parseFrontmatter(source, 'x.md');
		expect(data).toEqual({ map: { k: 'v' }, top: 'value' });
	});

	it('unquotes keys in nested maps', () => {
		const source = `---\nrules:\n  "git *": allow\n---\nbody`;
		const { data } = parseFrontmatter(source, 'x.md');
		expect(data).toEqual({ rules: { 'git *': 'allow' } });
	});

	it('trims trailing whitespace and leading blank lines from the body', () => {
		const source = '---\na: 1\n---\n\n\nparagraph\n\n';
		const { body } = parseFrontmatter(source, 'x.md');
		expect(body).toBe('paragraph');
	});

	it('throws when the opening delimiter is missing', () => {
		expect(() => parseFrontmatter('a: 1\n---\nbody', 'x.md')).toThrow(/missing opening frontmatter delimiter/);
	});

	it('throws when the closing delimiter is missing', () => {
		expect(() => parseFrontmatter('---\na: 1\nno-end-delim\n', 'x.md')).toThrow(/missing closing frontmatter delimiter/);
	});

	it('throws on a malformed top-level line with no colon', () => {
		expect(() => parseFrontmatter('---\nnotakeyvaluepair\n---\nbody', 'x.md')).toThrow(/malformed frontmatter line/);
	});

	it('throws on a malformed nested line with no colon', () => {
		expect(() => parseFrontmatter('---\nmap:\n  notakeyvaluepair\n---\nbody', 'x.md')).toThrow(/malformed nested line/);
	});

	it('includes the filename in error messages', () => {
		expect(() => parseFrontmatter('no-frontmatter', 'IC-BAD-001.md')).toThrow(/IC-BAD-001\.md/);
	});
});
