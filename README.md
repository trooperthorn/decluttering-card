# Decluttering Card
📝 Reuse multiple times the same card configuration with variables to declutter your config.

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![custom_updater][customupdaterbadge]][customupdater]
[![License][license-shield]](LICENSE.md)

[![Project Maintenance][maintenance-shield]][maintainer]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

[![Github][github]][maintainer]

This card is for [Lovelace](https://www.home-assistant.io/lovelace) on [Home Assistant](https://www.home-assistant.io/).

We all use multiple times the same block of configuration across our lovelace configuration and we don't want to change the same things in a hundred places across our configuration each time we want to modify something.

`decluttering-card` to the rescue!! This card allows you to reuse multiple times the same configuration in your lovelace configuration to avoid repetition and supports variables and default values.

## Configuration

### Defining your templates

There are two ways to define your templates. You can use both methods together.

#### Option 1. Create a template as a card with the visual editor or with YAML.

Add a *Custom: Decluttering template* card in any view of your dashboard to define your template,
set variables with their default values, and preview the results with those defaults with the
visual editor. The card type is `custom:decluttering-template` in YAML.

You can place the template card anywhere and it will only visible when the dashboard is in edit mode.
Each template must have a unique name.

**Example:**

```yaml
type: custom:decluttering-template
template: follow_the_sun
card:
  type: entity
  entity_id: sun.sun
```

#### Option 2. Create a template at the root of your lovelace configuration.

Open your dashboard's YAML configuration file or click on the *Raw configuration editor* menu item
in the dashboard.

The templates are defined in an object at the root of your lovelace configuration. This object is
named `decluttering_templates` and it contains your template declarations. Each template must have
a unique name.

**Example:**

```yaml
title: Example Dashboard
decluttering_templates:
  follow_the_sun:
    card:
      type: entity
      entity_id: sun.sun
  touch_the_sun:
    row:
      type: button
      entity: sun.sun
      action_name: Boop
  hello_sunshine:
    element:
      type: icon
      icon: mdi:weather-sunny
      title: Hello!
      style:
        color: yellow
views:
```

**Syntax:**

```yaml
decluttering_templates:
  <template name>:
    <template content>
  [...]
```

### Adding content to your templates

You can make decluttering templates for cards, entity rows, and picture elements. Each content type
has a different syntax and can be used in different places.

#### [Card](https://www.home-assistant.io/dashboards/cards/)

A decluttering template can hold a standard dashboard card, custom card, or another decluttering card.
It is particularly useful for complex cards such as stacks, grids, and tiles.

**Example:**

```yaml
type: custom:decluttering-template
template: follow_the_sun
card:
  type: entity
    entity_id: sun.sun
```

**Syntax:**

```yaml
type: custom:decluttering-template
template: <template_name>
card:
  # This is where you put your [Card](https://www.home-assistant.io/dashboards/cards/) configuration (it can be a card embedding other cards)
  type: <card_type>
    [...]
default:
  # An optional list of variables and their default values to substitute into the template
  - <variable_name>: <variable_value>
  - <variable_name>: <variable_value>
  [...]
```

#### [Entities card](https://www.home-assistant.io/dashboards/entities/) row

A decluttering template can hold an Entities card row such as a Button row or a Conditional row.

**Example:**

```yaml
type: custom:decluttering-template
template: touch_the_sun
row:
  type: button
  entity: sun.sun
  action_name: Boop
```

**Syntax:**

```yaml
type: custom:decluttering-template
template: <template_name>
row:
  # This is where you put your [Entities card](https://www.home-assistant.io/dashboards/entities/) row
  type: <element_type>
    [...]
default:
  # An optional list of variables and their default values to substitute into the template
  - <variable_name>: <variable_value>
  - <variable_name>: <variable_value>
  [...]
```

#### [Picture elements card](https://www.home-assistant.io/dashboards/picture-elements/) element

A decluttering template can hold a Picture elements card element such as an Icon or an Image.

**Example:**

```yaml
type: custom:decluttering-template
template: hello_sunshine
element:
  type: icon
  icon: mdi:weather-sunny
  title: Hello!
  style:
    color: yellow
```

**Syntax:**

```yaml
type: custom:decluttering-template
template: <template_name>
element:
  # This is where you put your [Picture elements card](https://www.home-assistant.io/dashboards/picture-elements/) element configuration
  type: <element_type>
    [...]
default:
  # An optional list of variables and their default values to substitute into the template
  - <variable_name>: <variable_value>
  - <variable_name>: <variable_value>
  [...]
```

#### Variables

Templates can contain variables. Each variable will later be replaced by a real value when you
instantiate a card which uses this template.

A variable needs to be enclosed in double square brackets `[[variable_name]]`. If a variable is alone
on its line, enclose it in single quotes: `'[[variable_name]]'`.

You can also define default values for your variables in the `default` object. The visual editor uses the
provided default values to render the preview.

**Example:**

```yaml
type: custom:decluttering-template
template: touch_anything
row:
  type: button
  entity: '[[what]]'
  action_name: '[[how]]'
default:
  what: sun.sun
  how: 'Boop'
```

You can also give a variable an inline fallback right in the token itself, with
`[[variable_name|fallback text]]` - if nothing supplies that variable (no
`variables:` entry on the card, no `default` entry on the template), the
fallback text is used instead of leaving a broken `[[...]]` token behind. A
real supplied variable (from either `variables:` or `default`) always takes
priority over the inline fallback. The fallback is always plain text, even for
a field that's normally a number or boolean - inline fallbacks don't carry
type information the way a real variable value does.

```yaml
row:
  type: button
  name: '[[room_name|Unnamed Zone]]'
```

### Stamping a template across many entities with `for_each`

Instead of instantiating a template once with hand-picked variables, a
`custom:decluttering-card` can select a whole set of entities from Home
Assistant's own area/label/device registries and stamp the template once per
match - the same job normally split across a `decluttering-card` plus a
separate `auto-entities` card, folded into one.

```yaml
type: custom:decluttering-card
template: safety_chip
for_each:
  area: kitchen
  domain: binary_sensor
  device_class: moisture
```

Every matched entity gets the template's `card`/`row`/`element` stamped with
an automatically-built set of variables, so the template can reference
`[[entity]]`, `[[name]]`, `[[area]]`, `[[floor]]`, `[[label]]`, and `[[domain]]`
without you passing any of them by hand. A `variables:` list alongside
`for_each` still works too - those apply identically to every match, on top
of the automatic ones.

**Selector fields** (all optional; each accepts a single value or a list -
a list is OR'd, e.g. `area: [kitchen, garage]`; different fields are AND'd
together):

- `area`, `label`, `domain`, `device_class`, `floor` - matched against Home
  Assistant's area/label/device/entity registries, not against entity id
  text. `floor` only has any effect on a multi-floor home.
- `exclude`: a `*` glob or a `/regex/` matched against the entity id, for the
  entities a registry filter alone can't rule out.
- `exclude_states`: a list of states to skip entirely, e.g. `[unavailable]`.
  Nothing is excluded by state unless you list one.

**Presentation fields:**

- `sort_by`: `name`, `state`, or `area`.
- `group_by`: `area` - adds a group header above each area's matches.
- `layout`: `stack` (default) or `grid`; `columns` sets the grid's column
  count (default 2).
- `empty_message`: shown instead of an empty card when nothing matches.
- `debug: true`: instead of rendering the real template, shows each matched
  entity id and its resolved variables - useful for checking a selector
  actually matches what you expect before wiring up the real template.

Registry data is cached for the page session, but the cache updates live:
this listens for Home Assistant's own `entity_registry_updated`,
`device_registry_updated`, `area_registry_updated`, and
`label_registry_updated` events and refreshes only the affected part of the
cache when one fires. An entity moved to a different area, relabeled, or
newly assigned shows up in a `for_each` selector without reloading the
page - built for always-on displays that may not be reloaded for weeks at a
time. (There's no `floor_registry_updated` event; a floor's contents change
via `area_registry_updated` instead, which is already covered.)

### Stamping a template across a literal list with `repeat`

`for_each` selects *different entities* from the registry - it has no way to
help when there's only **one** entity involved and what actually repeats is a
literal parameter, not the entity itself. The clearest example is a remote
control: the same `remote.*` entity, invoked over and over with a different
`command` each time.

```yaml
type: custom:decluttering-card
template: remote_cmd
variables:
  - remote_id: remote.rx_a3080_main_remote
repeat:
  items:
    - command: 'on'
      name: 'ON'
    - command: standby
      name: STANDBY
    - command: scene_1
      name: 'SCENE 1'
    - command: up
      icon: mdi:arrow-up-bold
      show_icon: true
```

Each item in `repeat.items` is a plain map of variable name to value - far
simpler than `for_each`, since there's no registry lookup involved at all,
just your own list, stamped once per item in the order you wrote it. A
`variables:` list alongside `repeat` still applies identically to every item,
same as with `for_each`.

`repeat` supports the same presentation options as `for_each` - `layout`
(`stack` or `grid`, with `columns`), `empty_message` for an empty `items`
list, and `debug: true` to see each item's resolved variables instead of the
real template while you're authoring a long list. It does not support
`sort_by` or `group_by` - your list's order already is the order, nothing to
sort. A card can use `for_each` or `repeat`, never both.

### Composing templates: one template referencing another

A template's `card`/`row`/`element` content can itself contain a
`custom:decluttering-card` reference to a *different* template. A value a
parent template resolves - from its own `variables:`, `default`s, or (for a
`for_each` card) the auto-bound `[[entity]]`/`[[name]]`/`[[area]]` - flows
straight into that nested reference's own `variables:` list as a plain
literal, because substitution runs over the whole card configuration before
Home Assistant ever creates the nested card as its own separate element.
Nothing extra is needed to make this work.

```yaml
decluttering_templates:
  room_status:
    card:
      type: vertical-stack
      cards:
        - type: custom:decluttering-card
          template: safety_badge
          variables:
            - room: '[[room_name]]'
        - type: custom:decluttering-card
          template: climate_badge
          variables:
            - room: '[[room_name]]'
  safety_badge:
    row:
      type: button
      name: '[[room|Unnamed Room]] - Safety'
  climate_badge:
    row:
      type: button
      name: '[[room|Unnamed Room]] - Climate'
```

```yaml
type: custom:decluttering-card
template: room_status
variables:
  - room_name: Kitchen
```

A template that ends up referencing itself - directly, or through a chain of
other templates (`room_status` embeds `safety_badge`, which embeds
`room_status` again) - throws a clear error instead of recursing forever,
since each nested reference mounts as a genuinely separate card with no
natural call stack to detect that with otherwise.

### Using the card

If your template content is a card, add a *Custom: Decluttering card* to your dashboard
to instantiate your template, set variables, and preview the results with the visual editor.
The card type is `custom:decluttering-template` in YAML.

If your template content is an Entities card row, first add a *Entities card* to your dashboard or
open an existing one. Then switch to the code editor and add a new item to the `entities`
list in YAML as shown below.

If your template content is an Picture elements card element, first add a *Picture elements* to your
dashboard or open an existing one. Then switch to the code editor and add a new item to the
`elements` list in YAML as shown below.

You can also use templates in different places than they were intended. For example, an
Entities card row or Picture elements card element can be displayed as a card in the dashboard but
it might not look right.

**Example which references the previous templates:**

```yaml
type: vertical-stack
cards:
  # A card
  - type: custom:decluttering-card
    template: follow_the_sun
  # An Entities card
  - type: entities
    entities:
      # An entity row
      - type: custom:decluttering-card
        template: touch_the_sun
      # An entity row with variables using default values
      - type: custom:decluttering-card
        template: touch_anything
      # An entity row with variables using specified values
      - type: custom:decluttering-card
        template: touch_anything
        variables:
          - what: sensor.moon_phase
          - how: 'Kiss'
  # A Picture elements card
  - type: picture-elements
    elements:
      - type: custom:decluttering-card
        template: hello_sunshine
        style:
          top: 50%
          left: 33%
      - type: custom:decluttering-card
        template: hello_sunshine
        style:
          top: 50%
          left: 66%
```

**Syntax:**

| Name | Type | Requirement | Description
| ---- | ---- | ------- | -----------
| type | string | **Required** | `custom:decluttering-card`
| template | object | **Required** | Name of your template
| variables | list | **Optional** | List of variables and their values to replace in the template content

## Installation

### Using HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=custom-cards&repository=decluttering-card&category=lovelace)

### Manually

#### Step 1

Save [decluttering-card](https://github.com/custom-cards/decluttering-card/releases/download/latest/decluttering-card.js) to `<config directory>/www/decluttering-card.js` on your Home Assistant instanse.

**Example:**

```bash
wget https://raw.githubusercontent.com/custom-cards/decluttering-card/master/dist/decluttering-card.js
mv decluttering-card.js /config/www/
```

#### Step 2

Link `decluttering-card` inside your `ui-lovelace.yaml` or Raw Editor in the UI Editor

```yaml
resources:
  - url: /local/decluttering-card.js
    type: module
```

## Troubleshooting

See this guide: [Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Developers
Fork and then clone the repo to your local machine. From the cloned directory run

`npm install && npm run build`


[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/decluttering-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/decluttering-card/commits/master
[customupdater]: https://github.com/custom-components/custom_updater
[customupdaterbadge]: https://img.shields.io/badge/custom__updater-true-success.svg?style=for-the-badge
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/lovelace-decluttering-card/118625
[license-shield]: https://img.shields.io/github/license/custom-cards/decluttering-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-RomRider-blue.svg?style=for-the-badge
[maintainer]: https://github.com/RomRider
[releases-shield]: https://img.shields.io/github/release/custom-cards/decluttering-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/decluttering-card/releases
[github]: https://img.shields.io/github/followers/RomRider.svg?style=social
