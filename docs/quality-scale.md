# Quality scale

Home Assistant's own [integration quality scale](https://developers.home-assistant.io/docs/core/integration-quality-scale/)
only applies to backend integrations, not Lovelace frontend cards - there's
no official equivalent for this repo to target. This adapts the same idea
(Bronze/Silver/Gold/Platinum, each a real bar rather than a badge) to what
actually matters for a HACS-distributed frontend card, and tracks this
repo's status against it honestly - including where it's short.

## Bronze

- [x] README documents configuration
- [x] LICENSE present
- [x] CI runs on every PR (lint, build)
- [x] `hacs.json` present and accurate (`homeassistant` floor added:
      `2024.8.0`, covering the label/floor registries `for_each` depends on)
- [x] No long-abandoned or deprecated direct dependencies

## Silver

- [x] A real test suite covering core logic (42 tests: substitution engine,
      `for_each` selector matching, recursion guard, registry-change
      subscription)
- [x] CI runs tests, not just lint/build
- [x] CHANGELOG maintained (hand-maintained since the switch off
      `semantic-release` to CalVer - see the Gold section)
- [x] Issue templates for bug reports and feature requests (inherited from
      upstream, still accurate)

## Gold

- [x] Tagged, versioned GitHub Releases, `workflow_dispatch`-triggered,
      publishing the built bundle as a release asset (`dist/` is gitignored,
      so the asset is the only way the built JS reaches HACS). CalVer
      (`YYYY.MM.DD.N`), matching Sean's other HA repos - `.release.json` +
      `scripts/set_version.py`/`release_config.py`, copied as-is from
      `ha_int_monoprice_6chan` (they're already generic; they just read/write
      a JSON version field, no HA-specific assumptions). This replaced an
      inherited `semantic-release` setup that turned out to be silently
      broken: `package.json`'s `repository.url` still pointed at the
      upstream repo it was forked from, so semantic-release compared against
      the wrong remote and refused to publish anything at all, every time.
- [x] Live-update behavior considered for the intended deployment context
      (always-on kiosk displays): `for_each`'s registry data refreshes on
      HA's own registry-change events rather than requiring a page reload
- [x] Known limitations documented rather than silently assumed away (see
      below)
- [x] Dependency vulnerabilities from `npm audit`, mostly closed. The
      inherited Babel toolchain (`@babel/core`, the unused
      `@babel/plugin-proposal-*` pair, `@rollup/plugin-babel`, and the
      ancient standalone `babel-cli`) is gone entirely - confirmed it was
      pure dead weight first: `@babel/preset-env` was never even installed,
      and `@rollup/plugin-babel`'s default file-extension filter doesn't
      match the `.ts`-tagged modules this pipeline feeds it, so it had been
      silently transforming nothing. Removing it dropped 1,042 packages from
      `node_modules` and produced a byte-for-byte identical `dist/decluttering-card.js`
      (verified by md5sum before/after), confirming zero functional change.
      Also bumped `@rollup/plugin-terser` to 1.0.0, closing its
      `serialize-javascript` RCE/DoS advisories. What's left: `esbuild`
      (via `vite`/`vitest`) - fixing it means bumping to `vitest@5`, which
      requires Node >=22.12 and would drop the CI matrix's Node 20.x leg;
      left as a deliberate follow-up since that's a support-floor decision,
      not a toolchain cleanup.

## Platinum (aspirational, not required)

- [x] Visual regression testing, scoped: `playwright.config.ts` +
      `e2e/for-each-views.spec.ts` cover the parts of this card's rendering
      that are entirely self-contained (the `for_each` debug view and the
      empty-state message) - the parts that don't depend on Home Assistant's
      own internal components (`state-badge`, `ha-form`, etc.), which aren't
      available outside a running HA frontend, so a full end-to-end
      screenshot of a real instantiated template isn't achievable
      standalone. Baselines seeded and verified passing for real in CI
      2026-09-07 (not run locally - the sandboxed environment this was built
      in has no network access to Playwright's browser CDN, but
      `npx playwright test --list` confirmed the config and test file were
      syntactically valid before the first CI run proved the rest).
- [x] Live-verified against a real HA instance, not just unit-tested.
      Deployed 2026-09-07/08 to a real HA 2026.9.1 instance (El Rancho
      Assist): `for_each` (`area: kitchen, domain: light`/`cover`) correctly
      resolved and rendered the live registry's actual entities (confirmed
      by screenshot - "Kitchen Overhead Lights", "Kitchen Island Lights",
      five separately-named shades - none of which are hand-authored
      anywhere in the dashboard source, so this is real registry data
      flowing through, not a coincidence), and `repeat` correctly rendered
      an entire D-pad remote-control grid (12+ distinct buttons) from a
      single templated block. This is the deploy that also caught and fixed
      the `getLovelaceConfig()` / `ha-drawer` bug above - so "live-verified"
      here includes having found a real bug this way, not just a clean
      pass.

## Known limitations (Gold requires documenting these, not hiding them)

- **Registry data for `for_each` is cached per page session**, refreshed on
  HA's own `entity_registry_updated`/`device_registry_updated`/
  `area_registry_updated`/`label_registry_updated` websocket events. There is
  no documented `floor_registry_updated` event, so a floor's own
  name/contents changing isn't separately covered - acceptable since
  `area_registry_updated` already fires when an area's `floor_id` changes.
- **The `getLovelaceConfig()` DOM-walk** (needed to look up a
  `decluttering-card`'s referenced template from the live Lovelace config)
  reaches into Home Assistant's internal shadow DOM structure. There is no
  public, officially supported API for a third-party card to do this any
  other way; this fails loudly (a console error) rather than silently if a
  future HA frontend restructuring breaks it - which is exactly what
  happened live on HA 2026.9.1: `custom-card-helpers@1.5.0`'s own
  `getLovelace()` still hardcoded `app-drawer-layout partial-panel-resolver`,
  but that element had already been replaced with `ha-drawer`. Every card on
  every dashboard failed with "could not locate the Lovelace configuration".
  Fixed by owning this walk directly in `lovelace-lookup.ts` again (checking
  `ha-drawer`, then falling back to `app-drawer-layout`, then a bare
  `partial-panel-resolver`) instead of trusting an unmaintained dependency to
  track HA's internals - the coupling to an undocumented HA internal is
  unavoidable either way, but at least this way a fix doesn't wait on a third
  party.
- **Nested `custom:decluttering-card` references** are guarded against
  infinite self-reference recursion, but a very large or deep composition
  (many `for_each` matches each nesting further templates) has not been
  load-tested for real-world performance on kiosk-class hardware.
