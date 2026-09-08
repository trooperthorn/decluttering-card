import { describe, expect, it } from 'vitest';
import { objectToVariables, repeatItemKey } from '../src/repeat';

describe('objectToVariables', () => {
  it('converts a flat map into an array of single-key objects', () => {
    expect(objectToVariables({ command: 'on', name: 'ON' })).toEqual([{ command: 'on' }, { name: 'ON' }]);
  });

  it('returns an empty array for an empty item', () => {
    expect(objectToVariables({})).toEqual([]);
  });

  it('preserves non-string values (numbers, booleans, nested objects)', () => {
    expect(objectToVariables({ count: 3, show_icon: true, tap_action: { action: 'toggle' } })).toEqual([
      { count: 3 },
      { show_icon: true },
      { tap_action: { action: 'toggle' } },
    ]);
  });
});

describe('repeatItemKey', () => {
  it('prefers name when present', () => {
    expect(repeatItemKey({ name: 'ON', id: 'x', command: 'on' }, 0)).toBe('ON');
  });

  it('falls back to id when name is absent', () => {
    expect(repeatItemKey({ id: 'scene_1', command: 'scene_1' }, 2)).toBe('scene_1');
  });

  it('falls back to the index when neither name nor id is present', () => {
    expect(repeatItemKey({ command: 'up' }, 5)).toBe('5');
  });

  it('falls back to the index when name is an empty string', () => {
    expect(repeatItemKey({ name: '', command: 'up' }, 1)).toBe('1');
  });

  it('falls back to the index when name is present but not a string', () => {
    expect(repeatItemKey({ name: 42 } as unknown as Record<string, unknown>, 3)).toBe('3');
  });
});
