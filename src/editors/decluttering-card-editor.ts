import { LitElement, html, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor, LovelaceConfig } from 'custom-card-helpers';
import { DeclutteringCardConfig, TemplateConfig } from '../types';
import { getLovelaceConfig } from '../lovelace-lookup';
import { getTemplates } from '../templates-registry';

@customElement('decluttering-card-editor')
export class DeclutteringCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _lovelace?: LovelaceConfig;
  @state() private _config?: DeclutteringCardConfig;

  @property() public hass?: HomeAssistant;

  private _templates?: Record<string, TemplateConfig>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _schema: any;

  set lovelace(lovelace: LovelaceConfig) {
    this._lovelace = lovelace;
    this._templates = undefined;
    this._schema = undefined;
  }

  public setConfig(config: DeclutteringCardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._config) return html``;

    if (!this._lovelace) {
      // The lovelace property is not set when editing row elements so we retrieve it here
      this._lovelace = getLovelaceConfig() ?? undefined;
      if (!this._lovelace) return;
    }

    if (!this._templates) this._templates = getTemplates(this._lovelace);
    if (!this._schema) {
      this._schema = [
        {
          name: 'template',
          label: 'Template to use',
          selector: {
            select: {
              mode: 'dropdown',
              sort: true,
              custom_value: true,
              options: Object.keys(this._templates),
            },
          },
        },
        {
          name: 'variables',
          label: 'Variables',
          helper: 'Example: - variable_name: value',
          selector: { object: {} },
        },
      ];
    }

    const error: Record<string, string | string[]> = {};
    if (!this._templates[this._config.template]) {
      error.template = 'No template exists with this name';
    }
    if (this._config.variables !== undefined && !Array.isArray(this._config.variables)) {
      error.variables = 'The list of variables must be an array of key and value pairs';
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._schema}
        .error=${error}
        .computeLabel=${(s): string => s.label ?? s.name}
        .computeHelper=${(s): string => s.helper ?? ''}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    fireEvent(this, 'config-changed', { config: ev.detail.value });
  }
}
