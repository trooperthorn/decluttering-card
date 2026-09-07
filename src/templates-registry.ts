import { LovelaceConfig } from 'custom-card-helpers';
import { DeclutteringTemplateConfig, TemplateConfig, LovelaceThingType } from './types';

export function getTemplateConfig(ll: LovelaceConfig, template: string): TemplateConfig | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templates = (ll as any).decluttering_templates;
  const config = templates?.[template] as TemplateConfig;
  if (config) return config;

  if (ll.views) {
    for (const view of ll.views) {
      if (view.cards) {
        for (const card of view.cards) {
          if (card.type === 'custom:decluttering-template' && card.template === template) {
            return card as DeclutteringTemplateConfig;
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections = (view as any).sections;
      if (sections) {
        for (const section of sections) {
          if (section.cards) {
            for (const card of section.cards) {
              if (card.type === 'custom:decluttering-template' && card.template === template) {
                return card as DeclutteringTemplateConfig;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export function getTemplates(ll: LovelaceConfig): Record<string, TemplateConfig> {
  const templates: Record<string, TemplateConfig> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dt = (ll as any).decluttering_templates;
  if (dt) Object.assign(templates, dt);

  if (ll.views) {
    for (const view of ll.views) {
      if (view.cards) {
        for (const card of view.cards) {
          if (card.type === 'custom:decluttering-template') {
            templates[card.template] = card as DeclutteringTemplateConfig;
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections = (view as any).sections;
      if (sections) {
        for (const section of sections) {
          if (section.cards) {
            for (const card of section.cards) {
              if (card.type === 'custom:decluttering-template') {
                templates[card.template] = card as DeclutteringTemplateConfig;
              }
            }
          }
        }
      }
    }
  }
  return templates;
}

export function getThingType(templateConfig: TemplateConfig): LovelaceThingType | undefined {
  const thingTypes = Object.keys(templateConfig).filter((key) => ['card', 'row', 'element'].includes(key));
  return thingTypes.length === 1 ? (thingTypes[0] as LovelaceThingType) : undefined;
}
