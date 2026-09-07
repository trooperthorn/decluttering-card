// @vitest-environment jsdom
//
// registry-lookup.ts seeds a window-level cache at module load time (so the
// cache survives across every card instance on the same page, matching the
// pattern lovelace-auto-entities uses), so even importing it needs a
// `window` global. vitest's default environment is plain Node.
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveForEach } from '../src/for-each';

// registry-lookup.ts's cache is a window-level singleton by design (so it
// survives across every card instance on one real dashboard page) - which
// means it also survives across tests in this same file unless cleared. Each
// test still uses distinct ids as a second line of defense, but clearing
// between tests is what actually gives each test its own registry data.
beforeEach(() => {
  // registry-lookup.ts binds its module-level `cache` variable to this exact
  // object at import time, so reassigning/deleting the window property
  // itself wouldn't be seen by the module - the object's own fields have to
  // be cleared instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (window as any).declutteringCard_registryCache;
  if (existing) {
    delete existing.entities;
    delete existing.devices;
    delete existing.areas;
    delete existing.labels;
    delete existing.floors;
  }
});

// Minimal fake HomeAssistant: real hass.callWS returns registry-list arrays
// keyed by type ("config/area_registry/list" etc, see registry-lookup.ts).
// The registry-lookup cache is a `window`-level singleton shared across
// tests in the same process, so every test here uses distinct entity/area/
// device/label ids to avoid one test's cached lookups leaking into another's
// assertions.
function fakeHass(fixtures: {
  states: Record<string, { state: string; attributes?: Record<string, unknown> }>;
  entities?: unknown[];
  devices?: unknown[];
  areas?: unknown[];
  labels?: unknown[];
  floors?: unknown[];
}) {
  const registries: Record<string, unknown[]> = {
    entity: fixtures.entities ?? [],
    device: fixtures.devices ?? [],
    area: fixtures.areas ?? [],
    label: fixtures.labels ?? [],
    floor: fixtures.floors ?? [],
  };
  return {
    states: fixtures.states,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callWS: async (msg: { type: string }) => {
      const match = /^config\/(\w+)_registry\/list$/.exec(msg.type);
      if (!match) throw new Error(`unexpected callWS type in test: ${msg.type}`);
      return registries[match[1]] ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('resolveForEach', () => {
  it('matches entities by area and domain, ANDed together', async () => {
    const hass = fakeHass({
      states: {
        'binary_sensor.t1_leak': { state: 'off' },
        'sensor.t1_temp': { state: '70' },
        'binary_sensor.t1_leak_garage': { state: 'off' },
      },
      entities: [
        { entity_id: 'binary_sensor.t1_leak', area_id: 'area_t1_kitchen' },
        { entity_id: 'sensor.t1_temp', area_id: 'area_t1_kitchen' },
        { entity_id: 'binary_sensor.t1_leak_garage', area_id: 'area_t1_garage' },
      ],
      areas: [
        { area_id: 'area_t1_kitchen', name: 'Kitchen' },
        { area_id: 'area_t1_garage', name: 'Garage' },
      ],
    });

    const matches = await resolveForEach(hass, { area: 'area_t1_kitchen', domain: 'binary_sensor' });
    expect(matches.map((m) => m.context.entityId)).toEqual(['binary_sensor.t1_leak']);
  });

  it('OR-matches within a field when given an array', async () => {
    const hass = fakeHass({
      states: {
        'light.t2_a': { state: 'on' },
        'light.t2_b': { state: 'on' },
        'light.t2_c': { state: 'on' },
      },
      entities: [
        { entity_id: 'light.t2_a', area_id: 'area_t2_a' },
        { entity_id: 'light.t2_b', area_id: 'area_t2_b' },
        { entity_id: 'light.t2_c', area_id: 'area_t2_c' },
      ],
      areas: [
        { area_id: 'area_t2_a', name: 'A' },
        { area_id: 'area_t2_b', name: 'B' },
        { area_id: 'area_t2_c', name: 'C' },
      ],
    });

    const matches = await resolveForEach(hass, { area: ['area_t2_a', 'area_t2_b'] });
    expect(matches.map((m) => m.context.entityId).sort()).toEqual(['light.t2_a', 'light.t2_b']);
  });

  it('matches by label, inherited from the device when the entity itself has none', async () => {
    const hass = fakeHass({
      states: { 'binary_sensor.t3_leak': { state: 'off' } },
      entities: [{ entity_id: 'binary_sensor.t3_leak', device_id: 'device_t3' }],
      devices: [{ id: 'device_t3', labels: ['label_t3_safety'] }],
      labels: [{ label_id: 'label_t3_safety', name: 'Safety' }],
    });

    const matches = await resolveForEach(hass, { label: 'label_t3_safety' });
    expect(matches).toHaveLength(1);
    expect(matches[0].context.labelNames).toEqual(['Safety']);
  });

  it('filters by device_class', async () => {
    const hass = fakeHass({
      states: {
        'binary_sensor.t4_moisture': { state: 'off', attributes: { device_class: 'moisture' } },
        'binary_sensor.t4_motion': { state: 'off', attributes: { device_class: 'motion' } },
      },
      entities: [{ entity_id: 'binary_sensor.t4_moisture' }, { entity_id: 'binary_sensor.t4_motion' }],
    });

    const matches = await resolveForEach(hass, { device_class: 'moisture' });
    expect(matches.map((m) => m.context.entityId)).toEqual(['binary_sensor.t4_moisture']);
  });

  it('excludes entity ids matching a glob', async () => {
    const hass = fakeHass({
      states: { 'sensor.t5_keep': { state: 'x' }, 'sensor.t5_diagnostic_drop': { state: 'x' } },
      entities: [{ entity_id: 'sensor.t5_keep' }, { entity_id: 'sensor.t5_diagnostic_drop' }],
    });

    const matches = await resolveForEach(hass, { exclude: '*_diagnostic_*' });
    expect(matches.map((m) => m.context.entityId)).toEqual(['sensor.t5_keep']);
  });

  it('excludes entity ids matching a /regex/', async () => {
    const hass = fakeHass({
      states: { 'sensor.t6_a': { state: 'x' }, 'sensor.t6_b_2': { state: 'x' } },
      entities: [{ entity_id: 'sensor.t6_a' }, { entity_id: 'sensor.t6_b_2' }],
    });

    const matches = await resolveForEach(hass, { exclude: '/_2$/' });
    expect(matches.map((m) => m.context.entityId)).toEqual(['sensor.t6_a']);
  });

  it('excludes entities whose current state is in exclude_states', async () => {
    const hass = fakeHass({
      states: { 'sensor.t7_ok': { state: 'ok' }, 'sensor.t7_gone': { state: 'unavailable' } },
      entities: [{ entity_id: 'sensor.t7_ok' }, { entity_id: 'sensor.t7_gone' }],
    });

    const matches = await resolveForEach(hass, { exclude_states: ['unavailable'] });
    expect(matches.map((m) => m.context.entityId)).toEqual(['sensor.t7_ok']);
  });

  it('sorts by name', async () => {
    const hass = fakeHass({
      states: {
        'sensor.t8_z': { state: 'x', attributes: { friendly_name: 'Zeta' } },
        'sensor.t8_a': { state: 'x', attributes: { friendly_name: 'Alpha' } },
      },
      entities: [{ entity_id: 'sensor.t8_z' }, { entity_id: 'sensor.t8_a' }],
    });

    const matches = await resolveForEach(hass, { sort_by: 'name' });
    expect(matches.map((m) => m.context.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('builds the standard variable set for each match', async () => {
    const hass = fakeHass({
      states: { 'binary_sensor.t9_leak': { state: 'off', attributes: { friendly_name: 'Kitchen Leak' } } },
      entities: [{ entity_id: 'binary_sensor.t9_leak', area_id: 'area_t9' }],
      areas: [{ area_id: 'area_t9', name: 'Kitchen' }],
    });

    const matches = await resolveForEach(hass, {});
    const asObject = Object.fromEntries(matches[0].variables.map((v) => [Object.keys(v)[0], Object.values(v)[0]]));
    expect(asObject).toEqual({
      entity: 'binary_sensor.t9_leak',
      name: 'Kitchen Leak',
      area: 'Kitchen',
      floor: '',
      label: '',
      domain: 'binary_sensor',
    });
  });

  it('returns an empty array, not an error, when nothing matches', async () => {
    const hass = fakeHass({ states: { 'sensor.t10_x': { state: 'x' } }, entities: [{ entity_id: 'sensor.t10_x' }] });
    const matches = await resolveForEach(hass, { area: 'area_that_does_not_exist' });
    expect(matches).toEqual([]);
  });
});
