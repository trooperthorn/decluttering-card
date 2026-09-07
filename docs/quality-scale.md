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
- [x] CHANGELOG maintained (semantic-release, auto-generated from
      conventional commits)
- [x] Issue templates for bug reports and feature requests (inherited from
      upstream, still accurate)

## Gold

- [x] Tagged, versioned GitHub Releases via `semantic-release`
      (`workflow_dispatch`-triggered, publishes to GitHub Releases with the
      built bundle attached)
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

- [~] Visual regression testing - started, not finished. `playwright.config.ts` +
      `e2e/for-each-views.spec.ts` cover the parts of this card's rendering
      that are entirely self-contained (the `for_each` debug view and the
      empty-state message) - the parts that don't depend on Home Assistant's
      own internal components (`state-badge`, `ha-form`, etc.), which aren't
      available outside a running HA frontend, so a full end-to-end
      screenshot of a real instantiated template isn't achievable
      standalone. Could not be run or verified locally in the environment
      this was built in (no network access to Playwright's browser CDN);
      `npx playwright test --list` did confirm the config and test file are
      syntactically valid. The `visual-regression.yml` CI workflow's
      comparison step runs with `continue-on-error: true` until baseline
      screenshots are actually seeded - run it once with
      `workflow_dispatch` and `update_snapshots: true` to generate and
      commit them, then remove `continue-on-error` so it becomes a real gate.
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
  reaches into Home Assistant's internal shadow DOM structure via
  `custom-card-helpers`' own published implementation. There is no public,
  officially supported API for a third-party card to do this any other way;
  this fails loudly (a console error) rather than silently if a future HA
  frontend restructuring breaks it.
- **Nested `custom:decluttering-card` references** are guarded against
  infinite self-reference recursion, but a very large or deep composition
  (many `for_each` matches each nesting further templates) has not been
  load-tested for real-world performance on kiosk-class hardware.
