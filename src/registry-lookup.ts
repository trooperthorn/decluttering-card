import { HomeAssistant } from 'custom-card-helpers';

// Registries are NOT reliably available as flat properties on `hass` for a
// third-party custom element (checked against the current HA frontend docs
// and confirmed by reading thomasloven/lovelace-auto-entities' real,
// currently-maintained source: it fetches them the same way this does, via
// one-shot `hass.callWS` registry-list calls, not `hass.areas`/`hass.devices`/
// `hass.entities`). This mirrors that verified-working pattern rather than
// the newer Lit-context system, which isn't published anywhere a HACS card
// can actually import it from.
//
// Cached per page session, same starting point as auto-entities - but this
// runs on always-on kiosk displays that may never reload for weeks, where
// "wait for a reload" isn't acceptable: an entity added to an area, or
// relabeled, has to show up in a for_each selector without anyone touching
// the display. subscribeToRegistryChanges() below listens for HA's own
// registry-updated events and invalidates just the affected cache slice,
// so the next resolution picks up fresh data - no polling, no reload.

export interface EntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  labels?: string[];
  platform?: string;
  name?: string | null;
  original_name?: string | null;
  disabled_by?: string | null;
  hidden_by?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  labels?: string[];
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  floor_id?: string | null;
  labels?: string[];
}

export interface LabelRegistryEntry {
  label_id: string;
  name: string;
}

export interface FloorRegistryEntry {
  floor_id: string;
  name: string;
}

interface RegistryCache {
  entities?: Promise<Record<string, EntityRegistryEntry>>;
  devices?: Promise<Record<string, DeviceRegistryEntry>>;
  areas?: Promise<Record<string, AreaRegistryEntry>>;
  labels?: Promise<Record<string, LabelRegistryEntry>>;
  floors?: Promise<Record<string, FloorRegistryEntry>>;
  // Bumped every time any registry-updated event fires. A for_each card
  // compares this against the generation it last resolved against (see
  // cards/decluttering-card.ts) to decide whether to re-resolve - cheap to
  // check on every hass update, no polling needed.
  generation: number;
  subscribed?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
w.declutteringCard_registryCache = w.declutteringCard_registryCache || ({ generation: 0 } as RegistryCache);
const cache: RegistryCache = w.declutteringCard_registryCache;

export function getRegistryGeneration(): number {
  return cache.generation;
}

type CacheableSlice = 'entities' | 'devices' | 'areas' | 'labels';

const REGISTRY_EVENTS: { event: string; slice: CacheableSlice }[] = [
  { event: 'entity_registry_updated', slice: 'entities' },
  { event: 'device_registry_updated', slice: 'devices' },
  { event: 'area_registry_updated', slice: 'areas' },
  { event: 'label_registry_updated', slice: 'labels' },
  // No floor_registry_updated event is documented; floors change rarely
  // enough (and area_registry_updated already fires when an area's floor_id
  // changes) that this is an acceptable gap rather than something to poll for.
];

// Idempotent and safe to call on every hass update - only subscribes once
// per page, matching the singleton-cache pattern above. Subscriptions are
// deliberately never torn down: the cache and its subscriptions are meant
// to outlive any single card instance for the life of the page, exactly
// like the cache itself already does.
export function subscribeToRegistryChanges(hass: HomeAssistant): void {
  if (cache.subscribed) return;
  cache.subscribed = true;
  for (const { event, slice } of REGISTRY_EVENTS) {
    hass.connection.subscribeEvents(() => {
      delete cache[slice];
      cache.generation += 1;
    }, event);
  }
}

function listByKey<T>(hass: HomeAssistant, registryType: string, keyField: keyof T): Promise<Record<string, T>> {
  return hass.callWS<T[]>({ type: `config/${registryType}_registry/list` }).then((items) =>
    items.reduce(
      (acc, item) => {
        const key = item[keyField];
        if (typeof key === 'string') acc[key] = item;
        return acc;
      },
      {} as Record<string, T>,
    ),
  );
}

export function getEntityRegistry(hass: HomeAssistant): Promise<Record<string, EntityRegistryEntry>> {
  cache.entities = cache.entities ?? listByKey<EntityRegistryEntry>(hass, 'entity', 'entity_id');
  return cache.entities;
}

export function getDeviceRegistry(hass: HomeAssistant): Promise<Record<string, DeviceRegistryEntry>> {
  cache.devices = cache.devices ?? listByKey<DeviceRegistryEntry>(hass, 'device', 'id');
  return cache.devices;
}

export function getAreaRegistry(hass: HomeAssistant): Promise<Record<string, AreaRegistryEntry>> {
  cache.areas = cache.areas ?? listByKey<AreaRegistryEntry>(hass, 'area', 'area_id');
  return cache.areas;
}

export function getLabelRegistry(hass: HomeAssistant): Promise<Record<string, LabelRegistryEntry>> {
  cache.labels = cache.labels ?? listByKey<LabelRegistryEntry>(hass, 'label', 'label_id');
  return cache.labels;
}

export function getFloorRegistry(hass: HomeAssistant): Promise<Record<string, FloorRegistryEntry>> {
  cache.floors = cache.floors ?? listByKey<FloorRegistryEntry>(hass, 'floor', 'floor_id');
  return cache.floors;
}

export interface ResolvedEntityContext {
  entityId: string;
  name: string;
  areaId?: string;
  areaName?: string;
  floorId?: string;
  floorName?: string;
  labelIds: string[];
  labelNames: string[];
  deviceId?: string;
  domain: string;
}

export async function resolveEntityContext(hass: HomeAssistant, entityId: string): Promise<ResolvedEntityContext> {
  const [entities, devices, areas, labels, floors] = await Promise.all([
    getEntityRegistry(hass),
    getDeviceRegistry(hass),
    getAreaRegistry(hass),
    getLabelRegistry(hass),
    getFloorRegistry(hass),
  ]);

  const entity = entities[entityId];
  const device = entity?.device_id ? devices[entity.device_id] : undefined;
  const areaId = entity?.area_id ?? device?.area_id ?? undefined;
  const area = areaId ? areas[areaId] : undefined;
  const floorId = area?.floor_id ?? undefined;
  const floor = floorId ? floors[floorId] : undefined;
  const labelIds = [...(entity?.labels ?? []), ...(device?.labels ?? []), ...(area?.labels ?? [])];
  const uniqueLabelIds = [...new Set(labelIds)];

  const state = hass.states[entityId];
  const name =
    entity?.name ??
    state?.attributes?.friendly_name ??
    entity?.original_name ??
    device?.name_by_user ??
    device?.name ??
    entityId;

  return {
    entityId,
    name,
    areaId,
    areaName: area?.name,
    floorId,
    floorName: floor?.name,
    labelIds: uniqueLabelIds,
    labelNames: uniqueLabelIds.map((id) => labels[id]?.name).filter((n): n is string => Boolean(n)),
    deviceId: entity?.device_id ?? undefined,
    domain: entityId.split('.', 1)[0],
  };
}
