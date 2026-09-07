import { getLovelace, LovelaceConfig } from 'custom-card-helpers';

// Phase 5: this used to be a private copy of the exact same shadow-DOM-walking
// hack `custom-card-helpers` itself ships as `getLovelace()` - confirmed
// identical against the package's published source. Importing the shared
// version means this stays in sync with whatever the widely-depended-on
// package does the next time Home Assistant restructures its frontend shadow
// DOM, instead of drifting out of sync in a private copy nobody else fixes.
//
// The one thing the shared package doesn't cover is Cast mode (`hc-main`),
// so that path stays local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLovelaceCast(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any = document.querySelector('hc-main');
  root = root && root.shadowRoot;
  root = root && root.querySelector('hc-lovelace');
  root = root && root.shadowRoot;
  root = root && root.querySelector('hui-view');
  if (root) {
    const ll = root.lovelace;
    ll.current_view = root.___curView;
    return ll;
  }
  return null;
}

export function getLovelaceConfig(): LovelaceConfig | null {
  const ll = getLovelace() || getLovelaceCast();
  if (!ll) {
    // eslint-disable-next-line no-console
    console.error(
      'decluttering-card: could not locate the Lovelace configuration through either the normal or Cast DOM path. ' +
        'This usually means a Home Assistant frontend update moved something this card depends on - ' +
        'please open an issue with your Home Assistant version.',
    );
    return null;
  }
  return ll.config;
}
