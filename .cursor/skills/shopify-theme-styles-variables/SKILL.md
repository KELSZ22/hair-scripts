---
name: shopify-theme-styles-variables
description: >-
  Prefer existing theme CSS variables and design tokens over hard-coded sizes,
  colors, and fonts. Use when adding or editing Liquid {% stylesheet %} blocks,
  assets/*.css, or layout/typography in a Shopify theme that already defines
  tokens (e.g. this repo’s theme-styles-variables pattern).
---

# Theme styles and CSS variables

## Default approach

- **Do not** invent one-off `px` / `rem` / hex values when the theme already exposes a token for the same role.
- **Source of truth** for global tokens: `snippets/theme-styles-variables.liquid` (injected into `:root` via `{% style %}`). It defines typography, spacing, radii, motion, and more as **`var(--…)`**-friendly custom properties.
- **Usage patterns**: mirror nearby theme code—`assets/base.css`, existing `{% stylesheet %}` blocks in `sections/` and `blocks/`, and snippets such as `spacing-style`, `size-style`, `typography-style`.

## What to reuse (examples)

- **Typography**: `--font-paragraph--size`, `--font-paragraph--family`, `--font-heading--*`, `--font-size--*`, `--line-height--*`, `--letter-spacing--*`.
- **Spacing**: `--padding-*`, `--gap-*`, `--margin-*` (and section spacing patterns already used in the theme).
- **UI**: `--style-border-radius-inputs`, `--style-border-width-inputs`, input/colors such as `var(--color-input-text)` where the theme uses them.
- **Color schemes**: prefer theme **color scheme classes** (`color-{{ scheme }}` / existing section patterns) and `rgb(var(--color-foreground-rgb) / …)` style variables over raw hex for theme-controlled surfaces.

## Liquid `{% stylesheet %}`

- Use **`var(--token)`** for any value that exists in `theme-styles-variables.liquid` or is already standard in `base.css`.
- Prefer **existing utility classes** on wrappers if that matches the surrounding section/block.

## When something truly is not tokenized

- Add the smallest local rule only after checking for an existing variable or class.
- If a new token is justified, place it in the same **conceptual system** (naming, rem vs clamp) as `theme-styles-variables.liquid` rather than scattering magic numbers.
