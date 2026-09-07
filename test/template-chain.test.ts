import { describe, expect, it } from 'vitest';
import { assertNoRecursion, threadChainIntoNestedReference, extractInheritedChain } from '../src/template-chain';

describe('assertNoRecursion', () => {
  it('does not throw for a template not already in the chain', () => {
    expect(() => assertNoRecursion(['room_status'], 'safety_badge')).not.toThrow();
  });

  it('does not throw for an empty chain (the root template)', () => {
    expect(() => assertNoRecursion([], 'room_status')).not.toThrow();
  });

  it('throws when a template directly references itself', () => {
    expect(() => assertNoRecursion(['room_status'], 'room_status')).toThrow(/references itself/);
  });

  it('throws when a template references itself transitively through another template', () => {
    // room_status -> safety_badge -> room_status would recurse forever
    expect(() => assertNoRecursion(['room_status', 'safety_badge'], 'room_status')).toThrow(/references itself/);
  });

  it('includes the full chain in the error message', () => {
    expect(() => assertNoRecursion(['a', 'b'], 'a')).toThrow('a -> b -> a');
  });
});

describe('threadChainIntoNestedReference', () => {
  it('sets __declutteringChain when the thing is a nested decluttering-card reference', () => {
    const thingConfig: Record<string, unknown> = { type: 'custom:decluttering-card', template: 'safety_badge' };
    threadChainIntoNestedReference(thingConfig, ['room_status']);
    expect(thingConfig.__declutteringChain).toEqual(['room_status']);
  });

  it('does nothing for a thing that is not a nested decluttering-card reference', () => {
    const thingConfig: Record<string, unknown> = { type: 'entity', entity: 'sun.sun' };
    threadChainIntoNestedReference(thingConfig, ['room_status']);
    expect(thingConfig.__declutteringChain).toBeUndefined();
  });

  it('does nothing for a nullish or non-object thing', () => {
    expect(() => threadChainIntoNestedReference(null, ['x'])).not.toThrow();
    expect(() => threadChainIntoNestedReference(undefined, ['x'])).not.toThrow();
  });
});

describe('extractInheritedChain', () => {
  it('returns the chain when present on the config', () => {
    expect(extractInheritedChain({ __declutteringChain: ['room_status'] })).toEqual(['room_status']);
  });

  it('returns an empty array when absent', () => {
    expect(extractInheritedChain({ template: 'safety_badge' })).toEqual([]);
  });

  it('returns an empty array for a nullish or non-object config', () => {
    expect(extractInheritedChain(null)).toEqual([]);
    expect(extractInheritedChain(undefined)).toEqual([]);
  });
});
