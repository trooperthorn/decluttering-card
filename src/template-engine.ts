import { VariablesConfig, TemplateConfig, LovelaceThingConfig } from './types';

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toEntries(variableArray: VariablesConfig[]): [string, unknown][] {
  return variableArray.map((variable) => {
    const key = Object.keys(variable)[0];
    return [key, variable[key]] as [string, unknown];
  });
}

// Matches every `[[key]]` or `[[key|literal default]]` token in the raw JSON,
// so every token gets exactly one resolution pass whether or not a matching
// variable was supplied - this is what makes `[[key|default]]` possible: a
// key with no variable at all still resolves, to its inline fallback.
const TOKEN_PATTERN = /\[\[\s*([a-zA-Z0-9_.]+)\s*(?:\|([^[\]]*))?\s*\]\]/g;

export default (variables: VariablesConfig[] | undefined, templateConfig: TemplateConfig): LovelaceThingConfig => {
  const content = templateConfig.card ?? templateConfig.element ?? templateConfig.row;
  // Unlike before Phase 2, "no variables and no template.default" is NOT a
  // valid fast-path exit: a template can carry `[[key|default]]` inline
  // fallback tokens that still need resolving even when nothing was supplied
  // for them at all. Only a template with no tokens whatsoever is a no-op.
  const rawJson = JSON.stringify(content);
  if (!variables && !templateConfig.default && !rawJson.includes('[[')) {
    return content;
  }

  // Explicit merge, lowest to highest precedence: the template's own
  // `default`s, then whatever the caller actually supplied. (This used to
  // concatenate both arrays and replay them as a sequence of string replaces
  // over the same buffer - whichever ran first "won" by consuming the token
  // first, which happened to match caller-overrides-default only by accident
  // of array order, not by design. A real Map makes the override explicit and
  // order-independent.)
  const merged = new Map<string, unknown>();
  if (templateConfig.default) for (const [k, v] of toEntries(templateConfig.default)) merged.set(k, v);
  if (variables) for (const [k, v] of toEntries(variables)) merged.set(k, v);

  let jsonConfig = rawJson;

  // Collect every distinct token first (matched by its exact source text, so
  // whitespace like `[[ name | default ]]` round-trips correctly) before
  // doing any replacing, since replacing while iterating would shift what a
  // second exec() call sees.
  const seen = new Set<string>();
  const tokens: { fullMatch: string; key: string; fallback?: string }[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_PATTERN.exec(jsonConfig);
  while (match !== null) {
    const [fullMatch, key, fallback] = match;
    if (!seen.has(fullMatch)) {
      seen.add(fullMatch);
      tokens.push({ fullMatch, key, fallback });
    }
    match = TOKEN_PATTERN.exec(jsonConfig);
  }

  tokens.forEach(({ fullMatch, key, fallback }) => {
    // The key is user-authored (a YAML/JSON field name), not a regex - it
    // must be escaped before going into `new RegExp()`, or a key containing
    // ".", "*", "+", etc. matches more than the literal token it names. This
    // is the fix for "[[a.b]]" also matching "[[axb]]": "." used to mean
    // "any character" instead of a literal dot.
    const escapedToken = escapeRegExp(fullMatch);

    if (merged.has(key)) {
      const value = merged.get(key);
      if (typeof value === 'number' || typeof value === 'boolean') {
        const rxp2 = new RegExp(`"${escapedToken}"`, 'gm');
        jsonConfig = jsonConfig.replace(rxp2, String(value));
      } else if (typeof value === 'object' && value !== null) {
        const rxp2 = new RegExp(`"${escapedToken}"`, 'gm');
        jsonConfig = jsonConfig.replace(rxp2, JSON.stringify(value));
      } else {
        const rxp = new RegExp(escapedToken, 'gm');
        jsonConfig = jsonConfig.replace(rxp, String(value));
      }
    } else if (fallback !== undefined) {
      // No variable was supplied for this key at all - use the literal
      // fallback text from the token itself. This is always a bare string
      // substitution (there's no type information in inline YAML/JSON text
      // beyond the characters themselves), unlike a real supplied variable,
      // which keeps its actual JS type via the quoted-token branch above.
      const rxp = new RegExp(escapedToken, 'gm');
      jsonConfig = jsonConfig.replace(rxp, fallback);
    }
    // else: no variable and no fallback - leave the token untouched, matching
    // the original leniency for a key nobody ever supplied.
  });

  return JSON.parse(jsonConfig);
};
