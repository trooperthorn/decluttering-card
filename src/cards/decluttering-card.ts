import { customElement } from 'lit/decorators.js';
import { DeclutteringCardConfig } from '../types';
import { DeclutteringElement } from '../elements/declutter-element';
import { getLovelaceConfig } from '../lovelace-lookup';
import { getTemplateConfig } from '../templates-registry';
import { registerCustomCard } from '../register-custom-card';

registerCustomCard({
  type: 'decluttering-card',
  name: 'Decluttering card',
  description: 'Reuse multiple times the same card configuration with variables to declutter your config.',
});

@customElement('decluttering-card')
export class DeclutteringCard extends DeclutteringElement {
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
    this._setTemplateConfig(templateConfig, config.variables);
  }
}
