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
- [ ] Dependency vulnerabilities from `npm audit` are mostly in the aging
      Babel-based build toolchain (a legacy of the original upstream
      project), not runtime code shipped to the browser - acceptable, but
      not fully clean; a bigger toolchain modernization (dropping Babel
      entirely now that the Lit 3 / modern-browser baseline may not need
      its polyfills) would close this but wasn't in scope for this pass

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
- [ ] Live-verified against a real HA instance, not just unit-tested (the
      registry entry field names `for_each` depends on - `entity_id`,
      `device_id`, `area_id`, `labels`, `floor_id` - are long-stable HA
      conventions but have not been checked against a live `callWS`
      response)

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
