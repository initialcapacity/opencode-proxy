// Minimal YAML-frontmatter parser shared by build-codex.mjs and build-agents.mjs.
// Handles the strict subset we author: scalar strings, quoted strings, booleans,
// numbers, flat maps, and single-level inline maps (`{ "git *": "allow" }`).

export function parseFrontmatter(source, file) {
	if (!source.startsWith('---\n')) {
		throw new Error(`${file}: missing opening frontmatter delimiter`);
	}
	const end = source.indexOf('\n---\n', 4);
	if (end === -1) throw new Error(`${file}: missing closing frontmatter delimiter`);

	const header = source.slice(4, end);
	const body = source.slice(end + 5).replace(/^\n+/, '').replace(/\s+$/, '');

	const data = {};
	const lines = header.split('\n');

	let currentMap = null;

	for (const raw of lines) {
		if (!raw.trim()) {
			currentMap = null;
			continue;
		}

		const indent = raw.match(/^\s*/)?.[0].length ?? 0;
		const line = raw.trim();

		if (indent > 0 && currentMap) {
			const colon = line.indexOf(':');
			if (colon === -1) throw new Error(`${file}: malformed nested line: ${raw}`);
			const k = unquote(line.slice(0, colon).trim());
			const v = parseScalar(line.slice(colon + 1).trim());
			currentMap[k] = v;
			continue;
		}

		const colon = line.indexOf(':');
		if (colon === -1) throw new Error(`${file}: malformed frontmatter line: ${raw}`);
		const key = line.slice(0, colon).trim();
		const rest = line.slice(colon + 1).trim();

		if (rest === '') {
			// Begin a nested map
			currentMap = {};
			data[key] = currentMap;
		} else {
			data[key] = parseScalar(rest);
			currentMap = null;
		}
	}

	return { data, body };
}

function unquote(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

function parseScalar(value) {
	const trimmed = unquote(value);
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	return trimmed;
}
