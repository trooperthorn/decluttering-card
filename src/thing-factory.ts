import { createThing } from 'custom-card-helpers';
import { LovelaceThing, LovelaceThingConfig, LovelaceThingType } from './types';
import { HELPERS } from './card-helpers';

// Extracted from DeclutteringElement (Phase 3) so the new for_each repeater
// can create N things the same way the single-template path always has,
// instead of re-implementing (and risking drifting from) the same
// HELPERS-vs-createThing-fallback and ll-rebuild-handling logic twice.
export async function createLovelaceThing(
  thingConfig: LovelaceThingConfig,
  thingType: LovelaceThingType,
  handler: (thing: LovelaceThing) => void,
): Promise<void> {
  let thing: LovelaceThing;
  if (HELPERS) {
    if (thingType === 'card') {
      if (thingConfig.type === 'divider') thing = (await HELPERS).createRowElement(thingConfig);
      else thing = (await HELPERS).createCardElement(thingConfig);
    } else if (thingType === 'row') {
      thing = (await HELPERS).createRowElement(thingConfig);
    } else if (thingType === 'element') {
      thing = (await HELPERS).createHuiElement(thingConfig);
    } else {
      throw new Error(`Unsupported thing type '${thingType}'`);
    }
  } else {
    thing = createThing(thingConfig, thingType === 'row');
  }
  thing.addEventListener(
    'll-rebuild',
    (ev) => {
      ev.stopPropagation();
      createLovelaceThing(thingConfig, thingType, (newThing: LovelaceThing) => {
        thing.replaceWith(newThing);
        handler(newThing);
      });
    },
    { once: true },
  );
  thing.id = 'declutter-child';
  handler(thing);
}
