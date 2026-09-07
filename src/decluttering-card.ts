// Entry point kept at this path so rollup.config.js's `input` doesn't need to
// change. Everything else lives in its own module now (Phase 1 of the rework -
// this file used to be 664 lines mixing two cards, two editors, and every
// helper function in one place).
import * as pjson from '../package.json';
// Side-effecting imports: each module registers its own custom element via
// the @customElement decorator and pushes its window.customCards entry.
import './cards/decluttering-card';
import './editors/decluttering-card-editor';
import './cards/decluttering-template';
import './editors/decluttering-template-editor';

console.info(
  `%c DECLUTTERING-CARD \n%c   Version ${pjson.version}   `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);
