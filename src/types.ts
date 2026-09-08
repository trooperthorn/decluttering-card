import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DeclutteringCardConfig extends LovelaceCardConfig {
  variables?: VariablesConfig[];
  template: string;
  for_each?: ForEachConfig;
  repeat?: RepeatConfig;
}

// `repeat` is for_each's registry-free sibling: stamp the template once per
// item in a literal, hand-authored list instead of once per registry match.
// For the case for_each can't help with at all - the same single entity
// (e.g. one remote) invoked repeatedly with different literal parameters
// (a different `command` each time) rather than a different entity each
// time, which isn't a selection problem for_each's area/label/domain
// matching has any way to express.
export interface RepeatConfig {
  /** Each item is a plain flat map of variable name to value, merged the same way for_each's auto-bound variables are - a real supplied `variables:` entry for the same key still overrides it. */
  items: Record<string, unknown>[];
  layout?: 'stack' | 'grid';
  /** Only used when layout is "grid". Defaults to 2. */
  columns?: number;
  /** Shown instead of an empty card when `items` is empty. */
  empty_message?: string;
  /** Renders each item's resolved variables instead of the real card, for authoring against a long items list. */
  debug?: boolean;
}

// Selector fields are ANDed together (area + domain means "this area AND this
// domain"); within one field, an array is ORed ("kitchen" OR "great_room").
// Floor is included even though El Rancho Assist is single-floor today and it
// has zero practical effect there - it's the exact same registry-list pattern
// as area/label/domain, so there's no real cost to having it ready for a
// multi-floor home.
export interface ForEachConfig {
  area?: string | string[];
  label?: string | string[];
  domain?: string | string[];
  device_class?: string | string[];
  floor?: string | string[];
  /** A `/regex/` (slash-delimited) or a `*` glob, matched against entity_id. */
  exclude?: string;
  /** States to skip, e.g. ["unavailable", "unknown"]. No default - opt in. */
  exclude_states?: string[];
  sort_by?: 'name' | 'state' | 'area';
  group_by?: 'area';
  layout?: 'stack' | 'grid';
  /** Only used when layout is "grid". Defaults to 2. */
  columns?: number;
  /** Shown instead of an empty card when nothing matches the selector. */
  empty_message?: string;
  /** Renders each match's resolved variables instead of the real card, for authoring against live registry data. */
  debug?: boolean;
}

export interface DeclutteringTemplateConfig extends LovelaceCardConfig, TemplateConfig {
  template: string;
}

export interface VariablesConfig {
  [key: string]: any;
}

export interface TemplateConfig {
  default?: VariablesConfig[];
  card?: any;
  row?: any;
  element?: any;
}

export interface LovelaceElement extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: LovelaceElementConfig): void;
}

export interface LovelaceElementConfig {
  type: string;
  style: Record<string, string>;
  [key: string]: any;
}

export interface LovelaceRow extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: LovelaceRowConfig);
}

export interface LovelaceRowConfig {
  type?: string;
  [key: string]: any;
}

export type LovelaceThing = LovelaceCard | LovelaceElement | LovelaceRow;
export type LovelaceThingConfig = LovelaceCardConfig | LovelaceElementConfig | LovelaceRowConfig;
export type LovelaceThingType = 'card' | 'row' | 'element';
