import { html, css, CSSResult, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import { DeclutteringCardConfig, LovelaceThing } from '../types';
import { DeclutteringElement } from '../elements/declutter-element';
import { getLovelaceConfig } from '../lovelace-lookup';
import { getTemplateConfig, getThingType } from '../templates-registry';
import { registerCustomCard } from '../register-custom-card';
import { resolveForEach, ForEachMatch } from '../for-each';
import { subscribeToRegistryChanges, getRegistryGeneration } from '../registry-lookup';
import { createLovelaceThing } from '../thing-factory';
import deepReplace from '../template-engine';
import { assertNoRecursion, extractInheritedChain, threadChainIntoNestedReference } from '../template-chain';
import { objectToVariables, repeatItemKey } from '../repeat';

registerCustomCard({
  type: 'decluttering-card',
  name: 'Decluttering card',
  description: 'Reuse multiple times the same card configuration with variables to declutter your config.',
});

// Shared between for_each (registry-matched) and repeat (a literal list) -
// both end up as "N stamped things, presented the same way", just resolved
// from different sources. `key` is the entity_id for a for_each match, or a
// synthetic label for a repeat item.
interface StampedItem {
  thing: LovelaceThing;
  key: string;
}

interface StampedGroup {
  label: string;
  items: StampedItem[];
}

interface StampedDebugRow {
  key: string;
  variables: Record<string, unknown>;
}

@customElement('decluttering-card')
export class DeclutteringCard extends DeclutteringElement {
  // Phase 3: the `for_each` selector (registry-matched). Phase 6: `repeat`
  // (a literal list) - for_each's sibling for the case a selector can't
  // express at all: the same single entity invoked repeatedly with
  // different literal parameters (e.g. one remote, a different `command`
  // each time), rather than a different entity each time. Undefined means
  // "not in that mode", in which case every override below just delegates
  // to the base class's original single-template behavior - both features
  // are additive, never a replacement for the original usage.
  private _forEachConfig?: DeclutteringCardConfig;
  private _repeatConfig?: DeclutteringCardConfig;

  @state() private _forEachGroups?: StampedGroup[];
  @state() private _forEachDebugRows?: StampedDebugRow[];
  @state() private _repeatGroups?: StampedGroup[];
  @state() private _repeatDebugRows?: StampedDebugRow[];

  // Guards against a stale async resolution (from a superseded setConfig or
  // hass update) clobbering a newer one that finished first.
  private _forEachResolveToken = 0;
  private _repeatResolveToken = 0;

  // The registry generation this card last resolved against (see
  // registry-lookup.ts's subscribeToRegistryChanges). Comparing against the
  // live generation on every hass update is what lets this card notice a
  // registry change and re-resolve without anyone reloading the page - a
  // requirement on an always-on kiosk display, not just a nice-to-have.
  // repeat has no registry involved, so it has no equivalent staleness check.
  private _forEachResolvedGeneration = -1;

  static get styles(): CSSResult {
    return css`
      ${DeclutteringElement.styles}
      .declutter-for-each {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .declutter-group-items.declutter-layout-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .declutter-group-items.declutter-layout-grid {
        display: grid;
        grid-template-columns: repeat(var(--declutter-columns, 2), 1fr);
        gap: 8px;
      }
      .declutter-group-header {
        font-weight: 500;
        padding: 4px 0;
        color: var(--secondary-text-color);
      }
      .declutter-empty {
        padding: 16px;
        color: var(--secondary-text-color);
        text-align: center;
      }
      .declutter-debug-row {
        border: 1px dashed var(--divider-color);
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .declutter-debug-entity {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .declutter-debug-row pre {
        margin: 0;
        font-size: 12px;
        overflow-x: auto;
        white-space: pre-wrap;
      }
    `;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('decluttering-card-editor');
  }

  static getStubConfig(): DeclutteringCardConfig {
    return {
      type: 'custom:decluttering-card',
      template: 'follow_the_sun',
    };
  }

  public setConfig(config: DeclutteringCardConfig): void {
    if (!config.template) {
      throw new Error('Missing template object in your config');
    }
    if (config.for_each && config.repeat) {
      throw new Error('A decluttering-card can use for_each or repeat, not both, on the same card.');
    }

    if (config.for_each) {
      this._repeatConfig = undefined;
      this._repeatGroups = undefined;
      this._repeatDebugRows = undefined;
      this._forEachConfig = config;
      this._forEachGroups = undefined;
      this._forEachDebugRows = undefined;
      if (this._hass) this._resolveForEach(config, this._hass);
      return;
    }

    if (config.repeat) {
      this._forEachConfig = undefined;
      this._forEachGroups = undefined;
      this._forEachDebugRows = undefined;
      this._repeatConfig = config;
      this._repeatGroups = undefined;
      this._repeatDebugRows = undefined;
      if (this._hass) this._resolveRepeat(config, this._hass);
      return;
    }

    this._forEachConfig = undefined;
    this._repeatConfig = undefined;
    const ll = getLovelaceConfig();
    if (!ll) {
      throw new Error('Could not retrieve the lovelace configuration.');
    }
    const templateConfig = getTemplateConfig(ll, config.template);
    if (!templateConfig) {
      throw new Error(
        `The template "${config.template}" doesn't exist in decluttering_templates or in a custom:decluttering-template card`,
      );
    }
    this._setTemplateConfig(config.template, templateConfig, config.variables, extractInheritedChain(config));
  }

  set hass(hass: HomeAssistant) {
    super.hass = hass;

    if (this._forEachConfig) {
      subscribeToRegistryChanges(hass);
      const staleResult = !this._forEachGroups && !this._forEachDebugRows;
      const staleRegistry = this._forEachResolvedGeneration !== getRegistryGeneration();
      if (staleResult || staleRegistry) {
        this._resolveForEach(this._forEachConfig, hass);
      }
    }
    if (this._repeatConfig && !this._repeatGroups && !this._repeatDebugRows) {
      this._resolveRepeat(this._repeatConfig, hass);
    }
    this._forEachGroups?.forEach((group) => group.items.forEach((item) => (item.thing.hass = hass)));
    this._repeatGroups?.forEach((group) => group.items.forEach((item) => (item.thing.hass = hass)));
  }

  private async _resolveForEach(config: DeclutteringCardConfig, hass: HomeAssistant): Promise<void> {
    const forEachConfig = config.for_each;
    if (!forEachConfig) return;
    const token = ++this._forEachResolveToken;
    // Captured now, not after resolving: if a registry event lands while
    // this resolution is still in flight, this snapshot is already stale
    // against the new generation, so the next hass update re-resolves again
    // instead of the change being missed.
    this._forEachResolvedGeneration = getRegistryGeneration();

    const ll = getLovelaceConfig();
    if (!ll) {
      throw new Error('Could not retrieve the lovelace configuration.');
    }
    const templateConfig = getTemplateConfig(ll, config.template);
    if (!templateConfig) {
      throw new Error(
        `The template "${config.template}" doesn't exist in decluttering_templates or in a custom:decluttering-template card`,
      );
    }
    const thingType = getThingType(templateConfig);
    if (!thingType) {
      throw new Error('You must define one card, element, or row in the template');
    }
    const inheritedChain = extractInheritedChain(config);
    assertNoRecursion(inheritedChain, config.template);
    const chain = [...inheritedChain, config.template];

    const matches: ForEachMatch[] = await resolveForEach(hass, forEachConfig);
    if (token !== this._forEachResolveToken) return;

    if (forEachConfig.debug) {
      this._forEachGroups = undefined;
      this._forEachDebugRows = matches.map((match) => ({
        key: match.context.entityId,
        variables: Object.fromEntries(match.variables.map((v) => [Object.keys(v)[0], Object.values(v)[0]])),
      }));
      return;
    }

    // Created in `matches` order into an index-aligned array first, since
    // each thing resolves asynchronously and would otherwise land in
    // whichever order its own creation happened to finish - which would
    // silently undo `sort_by`.
    const created: (StampedItem & { groupLabel: string })[] = new Array(matches.length);
    await Promise.all(
      matches.map(
        (match, index) =>
          new Promise<void>((resolve) => {
            const mergedVariables = [...match.variables, ...(config.variables ?? [])];
            const thingConfig = deepReplace(mergedVariables, templateConfig);
            threadChainIntoNestedReference(thingConfig, chain);
            createLovelaceThing(thingConfig, thingType, (thing) => {
              thing.hass = hass;
              created[index] = { thing, key: match.context.entityId, groupLabel: match.groupLabel };
              resolve();
            });
          }),
      ),
    );
    if (token !== this._forEachResolveToken) return;

    const groups = new Map<string, StampedItem[]>();
    created.forEach(({ thing, key, groupLabel }) => {
      const groupKey = forEachConfig.group_by === 'area' ? groupLabel : '';
      const list = groups.get(groupKey) ?? [];
      list.push({ thing, key });
      groups.set(groupKey, list);
    });

    this._forEachDebugRows = undefined;
    this._forEachGroups = [...groups.entries()].map(([label, items]) => ({ label, items }));
  }

  private async _resolveRepeat(config: DeclutteringCardConfig, hass: HomeAssistant): Promise<void> {
    const repeatConfig = config.repeat;
    if (!repeatConfig) return;
    const token = ++this._repeatResolveToken;

    const ll = getLovelaceConfig();
    if (!ll) {
      throw new Error('Could not retrieve the lovelace configuration.');
    }
    const templateConfig = getTemplateConfig(ll, config.template);
    if (!templateConfig) {
      throw new Error(
        `The template "${config.template}" doesn't exist in decluttering_templates or in a custom:decluttering-template card`,
      );
    }
    const thingType = getThingType(templateConfig);
    if (!thingType) {
      throw new Error('You must define one card, element, or row in the template');
    }
    const inheritedChain = extractInheritedChain(config);
    assertNoRecursion(inheritedChain, config.template);
    const chain = [...inheritedChain, config.template];

    const items = repeatConfig.items ?? [];

    if (repeatConfig.debug) {
      this._repeatGroups = undefined;
      this._repeatDebugRows = items.map((item, index) => ({
        key: repeatItemKey(item, index),
        variables: item,
      }));
      return;
    }

    const created: StampedItem[] = new Array(items.length);
    await Promise.all(
      items.map(
        (item, index) =>
          new Promise<void>((resolve) => {
            const mergedVariables = [...objectToVariables(item), ...(config.variables ?? [])];
            const thingConfig = deepReplace(mergedVariables, templateConfig);
            threadChainIntoNestedReference(thingConfig, chain);
            createLovelaceThing(thingConfig, thingType, (thing) => {
              thing.hass = hass;
              created[index] = { thing, key: repeatItemKey(item, index) };
              resolve();
            });
          }),
      ),
    );
    if (token !== this._repeatResolveToken) return;

    this._repeatDebugRows = undefined;
    this._repeatGroups = [{ label: '', items: created }];
  }

  private _renderDebugRows(rows: StampedDebugRow[], emptyMessage: string): TemplateResult {
    if (rows.length === 0) {
      return html`<div class="declutter-empty">${emptyMessage}</div>`;
    }
    return html`
      ${rows.map(
        (row) => html`
          <div class="declutter-debug-row">
            <div class="declutter-debug-entity">${row.key}</div>
            <pre>${JSON.stringify(row.variables, null, 2)}</pre>
          </div>
        `,
      )}
    `;
  }

  private _renderGroups(
    groups: StampedGroup[],
    layout: 'stack' | 'grid',
    columns: number,
    groupBy: boolean,
    emptyMessage?: string,
  ): TemplateResult {
    const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
    if (totalItems === 0) {
      return emptyMessage ? html`<div class="declutter-empty">${emptyMessage}</div>` : html``;
    }
    return html`
      <div class="declutter-for-each" style="--declutter-columns: ${columns}">
        ${groups.map(
          (group) => html`
            ${groupBy ? html`<div class="declutter-group-header">${group.label}</div>` : ''}
            <div class="declutter-group-items declutter-layout-${layout}">
              ${group.items.map((item) => html`${item.thing}`)}
            </div>
          `,
        )}
      </div>
    `;
  }

  protected render(): TemplateResult | void {
    if (this._forEachConfig) {
      if (this._forEachDebugRows) {
        return this._renderDebugRows(this._forEachDebugRows, 'No entities matched this for_each selector.');
      }
      if (!this._forEachGroups) return html``;
      const forEach = this._forEachConfig.for_each;
      return this._renderGroups(
        this._forEachGroups,
        forEach?.layout ?? 'stack',
        forEach?.columns ?? 2,
        Boolean(forEach?.group_by),
        forEach?.empty_message,
      );
    }

    if (this._repeatConfig) {
      if (this._repeatDebugRows) {
        return this._renderDebugRows(this._repeatDebugRows, 'This repeat list has no items.');
      }
      if (!this._repeatGroups) return html``;
      const repeat = this._repeatConfig.repeat;
      return this._renderGroups(
        this._repeatGroups,
        repeat?.layout ?? 'stack',
        repeat?.columns ?? 2,
        false,
        repeat?.empty_message,
      );
    }

    return super.render() as TemplateResult | void;
  }

  public getCardSize(): Promise<number> | number {
    const groups = this._forEachGroups ?? this._repeatGroups;
    if (!groups) return super.getCardSize();
    const count = groups.reduce((sum, group) => sum + group.items.length, 0);
    return Math.max(1, count);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getGridOptions(): Record<string, any> {
    if (!this._forEachConfig && !this._repeatConfig) return super.getGridOptions();
    return { columns: 12, min_columns: 1 };
  }
}
