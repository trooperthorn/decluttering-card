import { describe, expect, it } from 'vitest';
import deepReplace from '../src/template-engine';

// Phase 0 wrote characterization tests here that deliberately locked in two
// known bugs (accidental variables/default precedence, an unescaped regex
// key). Phase 2 fixed both in template-engine.ts; the tests below replace
// those two, asserting the FIXED behavior on purpose instead of just
// re-passing against the old accidental one.

describe('deepReplace', () => {
  it('substitutes a bare string token', () => {
    const result = deepReplace([{ name: 'Kitchen' }], { card: { type: 'entity', title: '[[name]]' } });
    expect(result).toEqual({ type: 'entity', title: 'Kitchen' });
  });

  it('substitutes a numeric token without quoting it', () => {
    const result = deepReplace([{ count: 3 }], { card: { type: 'entity', rows: '[[count]]' } });
    expect(result).toEqual({ type: 'entity', rows: 3 });
  });

  it('substitutes a boolean token without quoting it', () => {
    const result = deepReplace([{ show: true }], { card: { type: 'entity', show_name: '[[show]]' } });
    expect(result).toEqual({ type: 'entity', show_name: true });
  });

  it('substitutes an object token as nested JSON', () => {
    const result = deepReplace([{ tap_action: { action: 'toggle' } }], {
      card: { type: 'entity', tap_action: '[[tap_action]]' },
    });
    expect(result).toEqual({ type: 'entity', tap_action: { action: 'toggle' } });
  });

  it('falls back to template.default when no variables are supplied', () => {
    const result = deepReplace(undefined, {
      card: { type: 'entity', title: '[[name]]' },
      default: [{ name: 'Fallback Name' }],
    });
    expect(result).toEqual({ type: 'entity', title: 'Fallback Name' });
  });

  it('returns the raw content untouched when neither variables nor defaults are given', () => {
    const result = deepReplace(undefined, { card: { type: 'entity', title: '[[name]]' } });
    expect(result).toEqual({ type: 'entity', title: '[[name]]' });
  });

  it('leaves a token with no matching variable and no fallback untouched', () => {
    const result = deepReplace([{ unrelated: 'x' }], { card: { type: 'entity', title: '[[name]]' } });
    expect(result).toEqual({ type: 'entity', title: '[[name]]' });
  });

  describe('variables vs. template.default precedence (Phase 2: explicit merge)', () => {
    it('prefers the caller-supplied variable over the template default for the same key', () => {
      const result = deepReplace([{ name: 'Caller Wins' }], {
        card: { type: 'entity', title: '[[name]]' },
        default: [{ name: 'Should Be Overridden' }],
      });
      expect(result).toEqual({ type: 'entity', title: 'Caller Wins' });
    });

    it('uses the template default when the caller does not supply that key at all', () => {
      const result = deepReplace([{ unrelated: 'x' }], {
        card: { type: 'entity', title: '[[name]]' },
        default: [{ name: 'Default Name' }],
      });
      expect(result).toEqual({ type: 'entity', title: 'Default Name' });
    });

    it('merges caller variables and template defaults for different keys, not just the last array processed', () => {
      const result = deepReplace([{ name: 'Kitchen' }], {
        card: { type: 'entity', title: '[[name]]', subtitle: '[[room_type]]' },
        default: [{ room_type: 'Common Area' }],
      });
      expect(result).toEqual({ type: 'entity', title: 'Kitchen', subtitle: 'Common Area' });
    });
  });

  describe('regex-safe variable keys (Phase 2: escaped before building RegExp)', () => {
    it('matches a key containing "." literally instead of treating it as "any character"', () => {
      // Before the fix, the pattern built from "a.b" also matched the unrelated
      // "[[axb]]" token below, because an unescaped "." in a RegExp means "any
      // character" - so a variable named "a.b" would silently corrupt any
      // "[[axb]]"-shaped token elsewhere in the same template.
      const result = deepReplace([{ 'a.b': 'REPLACED' }], {
        card: { type: 'entity', title: '[[a.b]]', subtitle: '[[axb]]' },
      });
      expect(result).toEqual({ type: 'entity', title: 'REPLACED', subtitle: '[[axb]]' });
    });
  });

  describe('[[key|default]] inline fallback (Phase 2: new syntax)', () => {
    it('substitutes the literal fallback when no variable was supplied for that key at all', () => {
      const result = deepReplace(undefined, { card: { type: 'entity', title: '[[name|Unnamed Zone]]' } });
      expect(result).toEqual({ type: 'entity', title: 'Unnamed Zone' });
    });

    it('prefers a real supplied variable over the inline fallback when both exist', () => {
      const result = deepReplace([{ name: 'Kitchen' }], {
        card: { type: 'entity', title: '[[name|Unnamed Zone]]' },
      });
      expect(result).toEqual({ type: 'entity', title: 'Kitchen' });
    });

    it('prefers a template default over the inline fallback too, since default is a real variable source', () => {
      const result = deepReplace(undefined, {
        card: { type: 'entity', title: '[[name|Unnamed Zone]]' },
        default: [{ name: 'Configured Name' }],
      });
      expect(result).toEqual({ type: 'entity', title: 'Configured Name' });
    });

    it('is always a bare string substitution, even for a field that is normally numeric', () => {
      // There is no type information in inline YAML/JSON text beyond the
      // characters themselves - a real supplied variable keeps its JS type
      // (see the numeric/boolean/object tests above), but a literal fallback
      // is just text.
      const result = deepReplace(undefined, { card: { type: 'entity', rows: '[[count|3]]' } });
      expect(result).toEqual({ type: 'entity', rows: '3' });
    });

    it('tolerates whitespace around the key and fallback', () => {
      const result = deepReplace(undefined, { card: { type: 'entity', title: '[[ name | Unnamed Zone ]]' } });
      expect(result).toEqual({ type: 'entity', title: ' Unnamed Zone ' });
    });
  });
});
