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

registerCustomCard({
  type: 'decluttering-card',
  name: 'Decluttering card',
  description: 'Reuse multiple times the same card configuration with variables to declutter your config.',
});

interface ForEachItem {
  thing: LovelaceThing;
  entityId: string;
}

interface ForEachGroup {
  label: string;
  items: ForEachItem[];
}

interface ForEachDebugRow {
  entityId: string;
  variables: Record<string, unknown>;
}

@customElement('decluttering-card')
export class DeclutteringCard extends DeclutteringElement {
  // Phase 3: the `for_each` selector. Undefined means "not in for_each mode",
  // in which case every override below just delegates to the base class's
  // existing single-template behavior - this feature is additive, not a
  // replacement for the original one-template-one-card usage.
  private _forEachConfig?: DeclutteringCardConfig;

  @state() private _forEachGroups?: ForEachGroup[];
  @state() private _forEachDebugRows?: ForEachDebugRow[];

  // Guards against a stale async resolution (from a superseded setConfig or
  // hass update) clobbering a newer one that finished first.
  private _forEachResolveToken = 0;

  // The registry generation this card last resolved against (see
  // registry-lookup.ts's subscribeToRegistryChanges). Comparing against the
  // live generation on every hass update is what lets this card notice a
  // registry change and re-resolve without anyone reloading the page - a
  // requirement on an always-on kiosk display, not just a nice-to-have.
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

    if (config.for_each) {
      this._forEachConfig = config;
      this._forEachGroups = undefined;
      this._forEachDebugRows = undefined;
      if (this._hass) this._resolveForEach(config, this._hass);
      return;
    }

    this._forEachConfig = undefined;
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
    this._forEachGroups?.forEach((group) => {
      group.items.forEach((item) => {
        item.thing.hass = hass;
      });
    });
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
        entityId: match.context.entityId,
        variables: Object.fromEntries(match.variables.map((v) => [Object.keys(v)[0], Object.values(v)[0]])),
      }));
      return;
    }

    // Created in `matches` order into an index-aligned array first, since
    // each thing resolves asynchronously and would otherwise land in
    // whichever order its own creation happened to finish - which would
    // silently undo `sort_by`.
    const created: (ForEachItem & { groupLabel: string })[] = new Array(matches.length);
    await Promise.all(
      matches.map(
        (match, index) =>
          new Promise<void>((resolve) => {
            const mergedVariables = [...match.variables, ...(config.variables ?? [])];
            const thingConfig = deepReplace(mergedVariables, templateConfig);
            threadChainIntoNestedReference(thingConfig, chain);
            createLovelaceThing(thingConfig, thingType, (thing) => {
              thing.hass = hass;
              created[index] = { thing, entityId: match.context.entityId, groupLabel: match.groupLabel };
              resolve();
            });
          }),
      ),
    );
    if (token !== this._forEachResolveToken) return;

    const groups = new Map<string, ForEachItem[]>();
    created.forEach(({ thing, entityId, groupLabel }) => {
      const key = forEachConfig.group_by === 'area' ? groupLabel : '';
      const list = groups.get(key) ?? [];
      list.push({ thing, entityId });
      groups.set(key, list);
    });

    this._forEachDebugRows = undefined;
    this._forEachGroups = [...groups.entries()].map(([label, items]) => ({ label, items }));
  }

  protected render(): TemplateResult | void {
    if (!this._forEachConfig) return super.render() as TemplateResult | void;

    if (this._forEachDebugRows) {
      if (this._forEachDebugRows.length === 0) {
        return html`<div class="declutter-empty">No entities matched this for_each selector.</div>`;
      }
      return html`
        ${this._forEachDebugRows.map(
          (row) => html`
            <div class="declutter-debug-row">
              <div class="declutter-debug-entity">${row.entityId}</div>
              <pre>${JSON.stringify(row.variables, null, 2)}</pre>
            </div>
          `,
        )}
      `;
    }

    if (!this._forEachGroups) return html``;

    const totalItems = this._forEachGroups.reduce((sum, group) => sum + group.items.length, 0);
    if (totalItems === 0) {
      const message = this._forEachConfig.for_each?.empty_message;
      return message ? html`<div class="declutter-empty">${message}</div>` : html``;
    }

    const layout = this._forEachConfig.for_each?.layout ?? 'stack';
    const columns = this._forEachConfig.for_each?.columns ?? 2;
    const groupBy = this._forEachConfig.for_each?.group_by;

    return html`
      <div class="declutter-for-each" style="--declutter-columns: ${columns}">
        ${this._forEachGroups.map(
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

  public getCardSize(): Promise<number> | number {
    if (!this._forEachConfig) return super.getCardSize();
    const count = this._forEachGroups?.reduce((sum, group) => sum + group.items.length, 0) ?? 0;
    return Math.max(1, count);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getGridOptions(): Record<string, any> {
    if (!this._forEachConfig) return super.getGridOptions();
    return { columns: 12, min_columns: 1 };
  }
}
