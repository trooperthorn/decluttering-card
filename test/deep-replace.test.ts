import { describe, expect, it } from 'vitest';
import deepReplace from '../src/deep-replace';

// Characterization tests written before any behavior change (Phase 0 of the
// rework) so later phases can prove the defaults/merge fix actually changed
// what it meant to and nothing else. Two of these lock in documented bugs
// on purpose - see the comments below - and are expected to be REWRITTEN,
// not just re-passed, when Phase 2 (variable defaults + explicit merge)
// fixes them.

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

  it(
    'KNOWN BUG (fix in Phase 2): a variable is only substituted for keys the supplied ' +
      'variables array processes BEFORE template.default for the same key, because this is ' +
      'a sequence of string replaces over the same buffer, not a real merge. Supplying ' +
      "`name` while the template's own `default` also defines `name` does not deterministically " +
      "prefer the caller's value the way a real override should - it depends on which one runs " +
      'its replace first, and both are appended to the same array in that order, so the caller-' +
      'supplied one (concatenated first) wins here only because deep-replace happens to process ' +
      'variableArray in order and the first replace already consumes the token, leaving nothing ' +
      "for default's later replace to match. This test locks in that accidental behavior; Phase 2 " +
      'should replace it with an explicit object merge and a test asserting the override on purpose.',
    () => {
      const result = deepReplace([{ name: 'Caller Wins' }], {
        card: { type: 'entity', title: '[[name]]' },
        default: [{ name: 'Should Be Overridden' }],
      });
      expect(result).toEqual({ type: 'entity', title: 'Caller Wins' });
    },
  );

  it(
    'KNOWN BUG (fix in Phase 2): a variable key containing a regex metacharacter breaks ' +
      'substitution instead of matching literally, because the key is interpolated straight ' +
      'into `new RegExp()` with no escaping.',
    () => {
      // "a.b" as a key: the literal token in the template is "[[a.b]]", but the constructed
      // pattern \[\[a.b\]\] treats "." as "match any character", so it also matches (and
      // replaces) the unrelated "[[axb]]" token below - a real correctness bug, not just an
      // edge case, once a variable name ever contains ".", "*", "+", "(", etc.
      const result = deepReplace([{ 'a.b': 'REPLACED' }], {
        card: { type: 'entity', title: '[[a.b]]', subtitle: '[[axb]]' },
      });
      expect(result).toEqual({ type: 'entity', title: 'REPLACED', subtitle: 'REPLACED' });
    },
  );
});
