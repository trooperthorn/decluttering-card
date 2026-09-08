# Changelog

Hand-maintained as of the entry below - the release process switched from
`semantic-release` (which had been silently broken since this repo was
forked: `package.json`'s `repository.url` still pointed at the upstream
repo, so it compared against the wrong remote and never actually published
anything) to the same CalVer (`YYYY.MM.DD.N`) convention Sean's other HA
repos use. See `docs/quality-scale.md` for the full detail.

## Unreleased

### Added

- `for_each`: stamp a template once per entity matching an `area`/`label`/
  `domain`/`device_class`/`floor` selector, resolved against the live
  registry - no more pairing a separate `auto-entities` card with this one.
  Registry data refreshes on Home Assistant's own registry-change events,
  not just once per page load, for always-on kiosk displays that may not
  reload for weeks. Supports `sort_by`/`group_by`, `layout`/`columns`,
  `empty_message`, and a `debug: true` mode for authoring a selector against
  live data.
- `repeat`: `for_each`'s registry-free sibling - stamp a template once per
  item in a literal, hand-authored list, for the case a selector can't
  express at all (the same single entity invoked with a different literal
  parameter each time, e.g. a remote's `command`).
- `[[key|default]]` inline fallback syntax for template variables.
- Nested `custom:decluttering-card` references now guard against infinite
  self-reference recursion instead of hanging the browser.
- A visual regression test suite (Playwright), scoped to what's actually
  self-contained in this card's own rendering (the `for_each`/`repeat`
  debug and empty-state views).

### Fixed

- The variable-substitution engine used a sequence of string replaces
  instead of a real merge, so `variables:` vs. a template's own `default`
  had accidental, not explicit, precedence. Also fixed: an unescaped
  variable key could match more than its own literal token if it contained
  a regex metacharacter like `.`.
- `getLovelaceConfig()` now imports `custom-card-helpers`' own
  implementation instead of a private, drifting copy of the identical hack.

### Changed

- Migrated to Lit 3, TypeScript 5.6, ESLint 8, Prettier 3; dropped the
  `resize-observer` polyfill (native support is universal now).
- Split the single 664-line source file into modules
  (`elements/`, `cards/`, `editors/`, `template-engine.ts`, etc.).
- `hacs.json` gained a `homeassistant` floor (`2024.8.0`) - it had none,
  despite depending on the label/floor registries.

## 1.0.0 (2023-04-02)


### Bug Fixes

* card broken with HA 2023.4 beta and up ([0ccd5b0](https://github.com/custom-cards/decluttering-card/commit/0ccd5b05a99202c80de21606df1b8e94ea9ee668)), closes [#63](https://github.com/custom-cards/decluttering-card/issues/63)
