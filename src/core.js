const SECTION_RE = /^\s*\[\s*([^\]:]+?)\s*(?::\s*([^\]]+?)\s*)?\]\s*$/;
const KEY_VALUE_RE = /^\s*([^=]+?)\s*=\s*(.*?)\s*$/;

/**
 * Parses INI text into a flat list of sections with their raw key/value pairs.
 * Inheritance directives are preserved as a `parent` field on each section.
 *
 * WHY: Keeping parsing and resolution separate lets callers inspect the raw
 * structure (e.g. for tooling) without paying the cost of merging, and makes
 * the merge algorithm easier to test in isolation.
 *
 * @param {string} text
 * @returns {{ sections: Array<{name: string, parent: string|null, entries: Array<[string, string]>}> }}
 */
export function parseIni(text) {
  const sections = [];
  let current = null;

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      const parent = sectionMatch[2] ? sectionMatch[2].trim() : null;
      current = { name, parent, entries: [] };
      sections.push(current);
      continue;
    }

    const kvMatch = line.match(KEY_VALUE_RE);
    if (kvMatch) {
      if (current === null) {
        throw new Error(`Key/value pair outside of any section on line ${i + 1}`);
      }
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      current.entries.push([key, value]);
      continue;
    }

    throw new Error(`Unrecognized line ${i + 1}: ${JSON.stringify(line)}`);
  }

  return { sections };
}

/**
 * Merges section inheritance chains into plain configuration objects.
 *
 * The result is an object keyed by section name. Each value is an object of
 * the merged key/value pairs. Child sections override parent keys; deeper
 * ancestors are applied first so that the nearest ancestor wins.
 *
 * WHY: A cycle in the inheritance graph would otherwise cause infinite
 * recursion. We detect it and throw a descriptive error instead of hanging.
 *
 * @param {{ sections: Array<{name: string, parent: string|null, entries: Array<[string, string]>}> }} parsed
 * @returns {Record<string, Record<string, string>>}
 */
export function resolveInheritance(parsed) {
  const byName = new Map();
  for (const section of parsed.sections) {
    byName.set(section.name, section);
  }

  const resolved = new Map();
  const visiting = new Set();

  function resolveSection(name) {
    if (resolved.has(name)) {
      return resolved.get(name);
    }
    if (visiting.has(name)) {
      throw new Error(`Circular inheritance detected involving section "${name}"`);
    }

    const section = byName.get(name);
    if (!section) {
      throw new Error(`Inheritance references unknown section "${name}"`);
    }

    visiting.add(name);

    let merged = {};
    if (section.parent) {
      const parentObj = resolveSection(section.parent);
      merged = { ...parentObj };
    }

    for (const [key, value] of section.entries) {
      merged[key] = value;
    }

    visiting.delete(name);
    resolved.set(name, merged);
    return merged;
  }

  const result = {};
  for (const section of parsed.sections) {
    result[section.name] = resolveSection(section.name);
  }

  return result;
}
