import { LovelaceConfig } from 'custom-card-helpers';

// Phase 5 imported custom-card-helpers' own getLovelace() here instead of a
// private copy, on the theory that the widely-depended-on package would track
// HA's frontend restructurings better than a copy nobody here would remember
// to fix. That didn't hold: custom-card-helpers@1.5.0's getLovelace() still
// hardcodes `app-drawer-layout partial-panel-resolver`, but HA's frontend
// replaced <app-drawer-layout> with <ha-drawer> before this was even written
// (confirmed live on HA 2026.9.1 - <ha-drawer> is what's actually in the DOM,
// so every card render failed with "could not locate the Lovelace
// configuration"). Back to owning this walk directly, but tolerant of both
// the old and new wrapper element so a future rename doesn't have to mean
// another silent breakage - this is unavoidably coupled to an undocumented
// HA internal either way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLovelace(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any = document.querySelector('home-assistant');
  root = root && root.shadowRoot;
  root = root && root.querySelector('home-assistant-main');
  root = root && root.shadowRoot;
  root =
    root &&
    (root.querySelector('ha-drawer partial-panel-resolver') ||
      root.querySelector('app-drawer-layout partial-panel-resolver') ||
      root.querySelector('partial-panel-resolver'));
  root = (root && root.shadowRoot) || root;
  root = root && root.querySelector('ha-panel-lovelace');
  root = root && root.shadowRoot;
  root = root && root.querySelector('hui-root');
  if (root) {
    const ll = root.lovelace;
    ll.current_view = root.___curView;
    return ll;
  }
  return null;
}

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
