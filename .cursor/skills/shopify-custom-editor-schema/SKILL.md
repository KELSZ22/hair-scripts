---
name: shopify-custom-editor-schema
description: >-
  For custom Shopify theme Liquid (especially custom-prefixed files), always add
  a theme editor schema so settings are configurable in the Shopify admin. Use
  when adding or editing custom sections, blocks, snippets tied to schema, or
  any storefront UI that should be merchant-editable.
---

# Custom theme work → theme editor schema

## Rule

Any **new custom theme code** you add (this project uses the **`custom-` file name prefix** for new files) must be **configurable in the Shopify theme editor**. That means:

- **Sections** (`sections/custom-*.liquid`): include a full `{% schema %}` with `name`, `settings`, optional `blocks` / `presets`, and stable setting `id` values.
- **Blocks** (`blocks/custom-*.liquid` or new block types): include `{% schema %}` on the block with `settings` merchants need (labels, text, toggles, colors, etc.).
- **Do not** leave merchant-facing copy, layout toggles, or URLs only hardcoded in Liquid if they should be editable—expose them as **schema settings** and read `section.settings.*` or `block.settings.*` in Liquid.

## Schema hygiene

- Use **`t:` translation keys** for schema `label` / `info` / `content` (headers) when the rest of the theme does; add matching keys to `locales/en.default.schema.json` (and storefront strings to `locales/en.default.json` where needed).
- For **`type`: `text` / `textarea`**: do **not** use `"default": ""`**—Shopify rejects blank defaults; omit `default` or use a non-empty default.
- Prefer **sensible non-empty defaults** for selects/ranges/checkboxes** so the section/block looks correct before configuration.
- Preserve existing **`id` values** in schema when editing shipped sections/blocks so merchant data is not lost.

## Liquid

- Output schema-driven values with guards (`!= blank`) and **escape** untrusted text in HTML attributes (`| escape`) unless the theme intentionally allows HTML from settings.
