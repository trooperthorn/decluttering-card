import { VariablesConfig } from './types';

// repeat's registry-free sibling to for-each.ts: converts one item from a
// literal `repeat.items` list (a plain flat map, the natural way to author
// this in YAML) into the VariablesConfig[] shape template-engine.ts expects
// (an array of single-key objects, matching the existing `variables:` and
// `default:` convention).
export function objectToVariables(item: Record<string, unknown>): VariablesConfig[] {
  return Object.entries(item).map(([key, value]) => ({ [key]: value }));
}

// A short, human-readable label for a repeat item - used in the debug view
// and as each stamped thing's group key. Prefers a `name` or `id` field if
// the item has one (the common case, since most repeat items are meant to be
// distinguishable that way already), falling back to its position in the list.
export function repeatItemKey(item: Record<string, unknown>, index: number): string {
  if (typeof item.name === 'string' && item.name.length > 0) return item.name;
  if (typeof item.id === 'string' && item.id.length > 0) return item.id;
  return String(index);
}
