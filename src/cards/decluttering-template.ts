import { html, TemplateResult, css, CSSResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DeclutteringTemplateConfig } from '../types';
import { DeclutteringElement } from '../elements/declutter-element';
import { registerCustomCard } from '../register-custom-card';

registerCustomCard({
  type: 'decluttering-template',
  name: 'Decluttering template',
  description: 'Define a reusable template for decluttering cards to instantiate.',
});

@customElement('decluttering-template')
export class DeclutteringTemplate extends DeclutteringElement {
  @property({ type: Boolean, reflect: true }) preview = false;

  @state() private _template?: string;

  static getConfigElement(): HTMLElement {
    return document.createElement('decluttering-template-editor');
  }

  static getStubConfig(): DeclutteringTemplateConfig {
    return {
      type: 'custom:decluttering-template',
      template: 'follow_the_sun',
      card: {
        type: 'entity',
        entity: 'sun.sun',
      },
    };
  }

  static get styles(): CSSResult {
    return css`
      ${DeclutteringElement.styles}
      .badge {
        margin: 8px;
        color: var(--primary-color);
      }
      :host([preview]) {
        display: block !important;
        border: 1px solid var(--primary-color);
      }
    `;
  }

  public setConfig(config: DeclutteringTemplateConfig): void {
    if (!config.template) {
      throw new Error('Missing template property');
    }
    this._template = config.template;
    this._setTemplateConfig(config, undefined);
  }

  protected render(): TemplateResult | void {
    this.setHidden(!this.preview);
    if (this.preview) {
      return html`
        <div class="badge">${this._template}</div>
        ${super.render()}
      `;
    }
    return html``;
  }

  private setHidden(hidden: boolean): void {
    if (this.hasAttribute('hidden') !== hidden) {
      this.toggleAttribute('hidden', hidden);
      this.dispatchEvent(
        new Event('card-visibility-changed', {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}
