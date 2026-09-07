import { LitElement, html, TemplateResult, css, CSSResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor, LovelaceConfig } from 'custom-card-helpers';
import { DeclutteringTemplateConfig } from '../types';
import { DeclutteringElement } from '../elements/declutter-element';
import { getThingType } from '../templates-registry';
import { loadCardEditorPicker, loadRowEditor } from '../editor-loaders';

@customElement('decluttering-template-editor')
export class DeclutteringTemplateEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DeclutteringTemplateConfig;
  @state() private _selectedTab = 'settings';

  @property() public lovelace?: LovelaceConfig;
  @property() public hass?: HomeAssistant;

  private _loadedElements = false;

  private static schema = [
    {
      name: 'template',
      label: 'Template to define',
      selector: { text: {} },
    },
    {
      name: 'thingType',
      label: 'Type of thing to template',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'card', label: 'Card' },
            { value: 'row', label: 'Row' },
            { value: 'element', label: 'Element' },
          ],
        },
      },
    },
    {
      name: 'default',
      label: 'Variables',
      helper: 'Example: - variable_name: default_value',
      selector: { object: {} },
    },
  ];

  public setConfig(config: DeclutteringTemplateConfig): void {
    this._config = config;
  }

  static get styles(): CSSResult {
    return css`
      ${DeclutteringElement.styles}
      .toolbar {
        display: flex;
        --paper-tabs-selection-bar-color: var(--primary-color);
        --paper-tab-ink: var(--primary-color);
      }
      paper-tabs {
        display: flex;
        font-size: 14px;
        flex-grow: 1;
        text-transform: uppercase;
      }
    `;
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();

    if (!this._loadedElements) {
      await loadCardEditorPicker();
      await loadRowEditor();
      this._loadedElements = true;
    }
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._config) return html``;

    const error: Record<string, string | string[]> = {};
    if (this._config.default !== undefined && !Array.isArray(this._config.default)) {
      error.default = 'The list of variables must be an array of key and value pairs';
    }

    const data = {
      template: this._config.template,
      thingType: getThingType(this._config) ?? 'card',
      default: this._config.default,
    };

    return html`
      <div class="toolbar">
        <paper-tabs
          attr-for-selected="name"
          fallback-selection="settings"
          scrollable
          .selected=${this._selectedTab}
          @iron-activate=${this._activateTab}
        >
          <paper-tab name="settings">Settings</paper-tab>
          ${
            data.thingType === 'card'
              ? html`
                  <paper-tab name="card">Card</paper-tab>
                  <paper-tab name="change_card">Change Card Type</paper-tab>
                `
              : data.thingType === 'row'
                ? html` <paper-tab name="row">Row</paper-tab> `
                : html``
          }
        </paper-tabs>
      </div>
      ${
        this._selectedTab === 'settings'
          ? html`
              <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${DeclutteringTemplateEditor.schema}
                .error=${error}
                .computeLabel=${(s): string => s.label ?? s.name}
                .computeHelper=${(s): string => s.helper ?? ''}
                @value-changed=${this._valueChanged}
              ></ha-form>
            `
          : this._selectedTab === 'card'
            ? html`
                <hui-card-element-editor
                  .hass=${this.hass}
                  .lovelace=${this.lovelace}
                  .value=${this._config.card}
                  @config-changed=${this._cardChanged}
                ></hui-card-element-editor>
              `
            : this._selectedTab === 'change_card'
              ? html`
                  <hui-card-picker
                    .hass=${this.hass}
                    .lovelace=${this.lovelace}
                    @config-changed=${this._cardPicked}
                  ></hui-card-picker>
                `
              : this._selectedTab === 'row'
                ? html`
            <hui-row-element-editor
              .hass=${this.hass}
              .lovelace=${this.lovelace}
              .value=${this._config.row}
              @config-changed=${this._rowChanged}
            ></hui-card-element-editor>
          `
                : html``
      }
    `;
  }

  private _activateTab(ev: CustomEvent): void {
    this._selectedTab = ev.detail.selected;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) return;
    const data = ev.detail.value;
    const config = { ...this._config, template: data.template, default: data.default };
    DeclutteringTemplateEditor.stubMember(data.thingType === 'card', config, 'card', {
      type: 'entity',
      entity: 'sun.sun',
    });
    DeclutteringTemplateEditor.stubMember(data.thingType === 'row', config, 'row', {
      entity: 'sun.sun',
    });
    DeclutteringTemplateEditor.stubMember(data.thingType === 'element', config, 'element', {
      type: 'icon',
      icon: 'mdi:weather-sunny',
      style: {
        color: 'yellow',
      },
    });
    this._fireConfigChanged(config);
  }

  private _cardChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config) return;

    const config = { ...this._config, card: ev.detail.config };
    this._fireConfigChanged(config);
  }

  private _cardPicked(ev: CustomEvent): void {
    this._selectedTab = 'card';
    this._cardChanged(ev);
  }

  private _rowChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config) return;

    const config = { ...this._config, row: ev.detail.config };
    this._fireConfigChanged(config);
  }

  private _fireConfigChanged(config: DeclutteringTemplateConfig): void {
    fireEvent(this, 'config-changed', { config });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static stubMember(include: boolean, dict: any, name: string, stub: any): void {
    if (include) {
      if (!(name in dict)) dict[name] = stub;
    } else {
      delete dict[name];
    }
  }
}
