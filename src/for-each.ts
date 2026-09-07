import { HomeAssistant } from 'custom-card-helpers';
import { ForEachConfig, VariablesConfig } from './types';
import { resolveEntityContext, ResolvedEntityContext } from './registry-lookup';

export interface ForEachMatch {
  context: ResolvedEntityContext;
  variables: VariablesConfig[];
  groupLabel: string;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function matchesAny(candidates: string[] | undefined, wanted: string[] | undefined): boolean {
  if (!wanted) return true;
  if (!candidates || candidates.length === 0) return false;
  return wanted.some((w) => candidates.includes(w));
}

function globOrRegexToRegExp(pattern: string): RegExp {
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 1) {
    return new RegExp(pattern.slice(1, -1));
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

// Resolves a `for_each` selector against the live registry, applying every
// filter, then sorting and grouping - the whole point being that a
// decluttering-card fragment says WHAT it wants ("media players in the
// Kitchen") instead of listing WHICH entity ids happen to match today, the
// same "no hand-maintained lists" principle the dashboard's own
// auto-entities fragments already lean on.
export async function resolveForEach(hass: HomeAssistant, config: ForEachConfig): Promise<ForEachMatch[]> {
  const area = toArray(config.area);
  const label = toArray(config.label);
  const domain = toArray(config.domain);
  const deviceClass = toArray(config.device_class);
  const floor = toArray(config.floor);
  const excludeRegExp = config.exclude ? globOrRegexToRegExp(config.exclude) : undefined;
  const excludeStates = new Set(config.exclude_states ?? []);

  const entityIds = Object.keys(hass.states);
  const contexts = await Promise.all(entityIds.map((id) => resolveEntityContext(hass, id)));

  const matches: ForEachMatch[] = [];
  contexts.forEach((context) => {
    if (domain && !domain.includes(context.domain)) return;
    if (area && !(context.areaId && area.includes(context.areaId))) return;
    if (floor && !(context.floorId && floor.includes(context.floorId))) return;
    if (label && !matchesAny(context.labelIds, label)) return;
    if (deviceClass) {
      const dc = hass.states[context.entityId]?.attributes?.device_class;
      if (!dc || !deviceClass.includes(dc)) return;
    }
    if (excludeRegExp && excludeRegExp.test(context.entityId)) return;
    if (excludeStates.size > 0) {
      const state = hass.states[context.entityId]?.state;
      if (state && excludeStates.has(state)) return;
    }

    const variables: VariablesConfig[] = [
      { entity: context.entityId },
      { name: context.name },
      { area: context.areaName ?? '' },
      { floor: context.floorName ?? '' },
      { label: context.labelNames.join(', ') },
      { domain: context.domain },
    ];

    matches.push({
      context,
      variables,
      groupLabel: context.areaName ?? 'Ungrouped',
    });
  });

  if (config.sort_by) {
    const sortKey = config.sort_by;
    matches.sort((a, b) => {
      if (sortKey === 'name') return a.context.name.localeCompare(b.context.name);
      if (sortKey === 'area') return (a.context.areaName ?? '').localeCompare(b.context.areaName ?? '');
      if (sortKey === 'state') {
        const stateA = hass.states[a.context.entityId]?.state ?? '';
        const stateB = hass.states[b.context.entityId]?.state ?? '';
        return stateA.localeCompare(stateB);
      }
      return 0;
    });
  }

  return matches;
}
