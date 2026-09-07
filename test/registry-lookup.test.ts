// @vitest-environment jsdom
//
// registry-lookup.ts seeds a window-level cache at module load time, same
// reason as for-each.test.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getEntityRegistry,
  getRegistryGeneration,
  subscribeToRegistryChanges,
} from '../src/registry-lookup';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (window as any).declutteringCard_registryCache;
  if (existing) {
    delete existing.entities;
    delete existing.devices;
    delete existing.areas;
    delete existing.labels;
    delete existing.floors;
    existing.generation = 0;
    existing.subscribed = false;
  }
});

function fakeHass(entities: unknown[]) {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    states: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callWS: async (msg: { type: string }) => {
      if (msg.type === 'config/entity_registry/list') return entities;
      return [];
    },
    connection: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subscribeEvents: async (callback: () => void, eventType: string) => {
        listeners[eventType] = listeners[eventType] ?? [];
        listeners[eventType].push(callback);
        return () => undefined;
      },
    },
    // Test-only helper to simulate HA firing a registry-updated event.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __fireEvent: (eventType: string) => {
      (listeners[eventType] ?? []).forEach((cb) => cb());
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('registry change subscription (kiosk live-update requirement)', () => {
  it('starts at generation 0 and only subscribes once even if called repeatedly', async () => {
    const hass = fakeHass([]);
    expect(getRegistryGeneration()).toBe(0);
    subscribeToRegistryChanges(hass);
    subscribeToRegistryChanges(hass);
    subscribeToRegistryChanges(hass);
    // Only one subscribeEvents call per event type should have happened -
    // verified indirectly below by confirming exactly one generation bump
    // per fired event, not three.
    hass.__fireEvent('entity_registry_updated');
    await Promise.resolve();
    expect(getRegistryGeneration()).toBe(1);
  });

  it('bumps the generation when entity_registry_updated fires', async () => {
    const hass = fakeHass([]);
    subscribeToRegistryChanges(hass);
    expect(getRegistryGeneration()).toBe(0);
    hass.__fireEvent('entity_registry_updated');
    expect(getRegistryGeneration()).toBe(1);
  });

  it('bumps the generation independently for each registry event type', async () => {
    const hass = fakeHass([]);
    subscribeToRegistryChanges(hass);
    hass.__fireEvent('area_registry_updated');
    hass.__fireEvent('label_registry_updated');
    hass.__fireEvent('device_registry_updated');
    expect(getRegistryGeneration()).toBe(3);
  });

  it('re-fetches the entity registry after entity_registry_updated invalidates the cache', async () => {
    const hass = fakeHass([{ entity_id: 'sensor.before', entity_category: null }]);
    subscribeToRegistryChanges(hass);

    const before = await getEntityRegistry(hass);
    expect(before['sensor.before']).toBeDefined();

    // Simulate a newly-added entity becoming visible in a fresh registry list -
    // this is exactly what an always-on kiosk needs without a page reload.
    hass.callWS = async (msg: { type: string }) => {
      if (msg.type === 'config/entity_registry/list') {
        return [{ entity_id: 'sensor.after', entity_category: null }];
      }
      return [];
    };
    hass.__fireEvent('entity_registry_updated');

    const after = await getEntityRegistry(hass);
    expect(after['sensor.after']).toBeDefined();
    expect(after['sensor.before']).toBeUndefined();
  });

  it('does not invalidate an unrelated registry slice', async () => {
    const hass = fakeHass([{ entity_id: 'sensor.stable', entity_category: null }]);
    subscribeToRegistryChanges(hass);
    await getEntityRegistry(hass);

    hass.callWS = async () => {
      throw new Error('should not refetch entities on an area_registry_updated event');
    };
    hass.__fireEvent('area_registry_updated');

    // Should resolve from the still-cached promise, not hit the throwing callWS above.
    const entities = await getEntityRegistry(hass);
    expect(entities['sensor.stable']).toBeDefined();
  });
});
