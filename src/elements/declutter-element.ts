import { LitElement, html, TemplateResult, css, CSSResult } from 'lit';
import { state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard } from 'custom-card-helpers';
import { TemplateConfig, VariablesConfig, LovelaceThing, LovelaceThingConfig, LovelaceThingType } from '../types';
import deepReplace from '../template-engine';
import { getThingType } from '../templates-registry';
import { createLovelaceThing } from '../thing-factory';
import { assertNoRecursion, threadChainIntoNestedReference } from '../template-chain';

export abstract class DeclutteringElement extends LitElement {
  @state() protected _hass?: HomeAssistant;
  @state() protected _thing?: LovelaceThing;

  private _thingConfig?: LovelaceThingConfig;
  private _thingType?: LovelaceThingType;
  private _ro?: ResizeObserver;
  private _savedStyles?: Map<string, [string, string]>;

  set hass(hass: HomeAssistant) {
    if (!hass) return;
    this._hass = hass;
    if (this._thing) this._thing.hass = hass;
  }

  static get styles(): CSSResult {
    return css`
      :host(.child-card-hidden) {
        display: none;
      }
    `;
  }

  protected firstUpdated(): void {
    this.updateComplete.then(() => {
      this._displayHidden();
    });
  }

  protected _displayHidden(): void {
    if (this._thing?.style.display === 'none') {
      this.classList.add('child-card-hidden');
    } else if (this.classList.contains('child-card-hidden')) {
      this.classList.remove('child-card-hidden');
    }
  }

  protected _setTemplateConfig(
    templateName: string,
    templateConfig: TemplateConfig,
    variables: VariablesConfig[] | undefined,
    inheritedChain: string[] = [],
  ): void {
    assertNoRecursion(inheritedChain, templateName);
    const chain = [...inheritedChain, templateName];

    const thingType = getThingType(templateConfig);
    if (!thingType) {
      throw new Error('You must define one card, element, or row in the template');
    }
    const thingConfig = deepReplace(variables, templateConfig);
    // If this template's own content is itself a nested decluttering-card
    // reference, thread the chain through it - a nested reference mounts as
    // a genuinely separate custom element with no other way to know which
    // templates are already being instantiated above it.
    threadChainIntoNestedReference(thingConfig, chain);

    this._thingConfig = thingConfig;
    this._thingType = thingType;
    createLovelaceThing(thingConfig, thingType, (thing: LovelaceThing) => {
      if (this._thingConfig === thingConfig) {
        this._setThing(thing, thingType === 'element' ? thingConfig.style : undefined);
      }
    });
  }

  private _setThing(thing: LovelaceThing, style?: Record<string, string>): void {
    this._savedStyles?.forEach((v, k) => this.style.setProperty(k, v[0], v[1]));
    this._savedStyles = undefined;

    if (style) {
      this._savedStyles = new Map();
      Object.keys(style).forEach((prop) => {
        this._savedStyles?.set(prop, [this.style.getPropertyValue(prop), this.style.getPropertyPriority(prop)]);
        this.style.setProperty(prop, style[prop]);
      });
    }

    this._thing = thing;
    if (this._hass) thing.hass = this._hass;
    this._ro = new ResizeObserver(() => {
      this._displayHidden();
    });
    this._ro.observe(thing);
  }

  protected render(): TemplateResult | void {
    if (!this._hass || !this._thing) return html``;

    return html` ${this._thing} `;
  }

  // for LovelaceCard
  public getCardSize(): Promise<number> | number {
    return this._thing && this._thingType === 'card' ? (this._thing as LovelaceCard).getCardSize() : 1;
  }

  // Sections-view sizing (backlog item): delegate to the wrapped thing's own
  // getGridOptions() when it defines one - a decluttering-card should size like
  // whatever it's wrapping, not force every template into the same box. Falls
  // back to HA's own full-width default when the thing doesn't define one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getGridOptions(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = (this._thing as any)?.getGridOptions?.();
    return inner ?? { columns: 12, min_columns: 1 };
  }
}
