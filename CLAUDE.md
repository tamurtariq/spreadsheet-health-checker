## Project overview

Spreadsheet Health Checker is a SaaS tool that analyzes uploaded spreadsheets
(CSV/XLSX) for formula errors, data-quality issues, and structural problems,
and returns a scored health report. It's built with Astro (SSR, `output:
"server"`) using the `@astrojs/cloudflare` adapter, deployed to Cloudflare
Pages/Workers, with Cloudflare D1 (SQL) for persistence and Cloudflare KV for
sessions. React islands handle interactive UI; everything else is `.astro`.

Production URL: https://tools.foviq.com/

### Architecture

- `src/pages/*.astro` — routed pages (SSR). Each wraps its content in
  `src/layouts/Layout.astro` via `<Layout title="...">`.
- `src/components/*.tsx` — React islands: `Analyzer` (upload + run checks),
  `HealthReport` (results view, PDF export via a lazy-loaded `pdf-lib`),
  `DiffChecker` (Pro/Team feature), `FileUpload` (thin wrapper around the
  generic `FileDropZone`). `src/components/ToolsNav.astro` is the shared,
  themed nav bar used by tool pages (see "Multi-tool platform" below).
- `src/lib/parser.ts` + `src/lib/engine.ts` — parse uploaded files and run
  checks (`src/lib/checks/{formula,data,structure}.ts`) to produce a
  `HealthReport`.
- `src/lib/auth/` — magic-link auth, sessions (KV), subscriptions/tiers, API
  keys, rate limiting. Tiers (`free`/`pro`/`team`) and their limits are
  defined in `getTierLimits()` in `src/lib/auth/index.ts`.
- `functions/api/**` — Cloudflare Pages Functions for the public API
  (`/api/v1/scan`), auth endpoints, team/API-key management, and the email
  digest cron.
- `migrations/*.sql` — D1 schema (users, sessions, subscriptions, api_keys,
  team_members, etc.).
- `src/content/blog/*.md` — blog content collection (SEO), schema in
  `src/content.config.ts`.

### Astro component prop gotcha (caused a full site outage — see below)

`.astro` frontmatter does **not** auto-bind props. Any prop referenced in a
template (e.g. `{title}`) must be explicitly pulled out of `Astro.props`:

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
```

Because this project renders in `server` (SSR) mode, a missing destructure
isn't caught at build time — `astro build` succeeds either way. The
`ReferenceError` only fires at request time, on every hit, producing a blank
white screen / 500 in production with no build-time warning. When adding or
editing a shared component (especially `Layout.astro`), verify every
`{prop}` used in the template has a corresponding `Astro.props` destructure
before pushing, and prefer testing a real request (`astro dev`/`preview`,
not just `astro build`) for any layout/shared-component change.

### Wrangler preview-deploy KV gotcha

`wrangler.jsonc`'s top-level `kv_namespaces[].preview_id` is **not** read by
`@astrojs/cloudflare`'s config generator for PR preview deploys (`wrangler
preview`, run by Cloudflare Workers Builds). It only checks whether a
top-level `previews` block already defines the binding; if absent, it injects
a bare `{ binding: "SESSION" }` with no id, causing `binding SESSION of type
kv_namespace must have a namespace_id specified [code: 10021]`. Any KV
binding needs an explicit `previews.kv_namespaces` entry with its own `id` in
`wrangler.jsonc` (see the existing `SESSION` entry) — don't assume
`preview_id` alone covers it. Verify by rebuilding and inspecting
`dist/server/wrangler.json`'s `previews` block directly; the GitHub Checks
API doesn't expose Cloudflare's build log text, so this can't be diagnosed
from PR check output alone — get the log from the Cloudflare dashboard link
in the PR's deploy comment.

### Multi-tool platform (tools.foviq.com)

This project is meant to host more than one tool (the health checker today;
a Lead CSV Cleaner and others planned) under the same Astro app, sharing
auth, billing scaffolding, and UI primitives. Decisions made so far:

- **Shared components for reuse across tools**: `src/components/ToolsNav.astro`
  (themed nav bar + auth-aware menu — pass `theme="hero"` for a dark/gradient
  header or `theme="light"` for a white one, plus `logoText`) and
  `src/components/FileDropZone.tsx` (generic drag-and-drop file picker;
  takes an `onRun(file, setProgress)` pipeline function so each tool supplies
  its own processing logic while reusing the upload UI, validation, progress
  bar, and error display). `FileUpload.tsx` is a thin health-checker-specific
  wrapper around `FileDropZone`.
- **Scan quota is shared, not per-tool**: `scan_counters` in D1 is keyed only
  by `user_id` (see `migrations/0001_initial_schema.sql`), and
  `functions/api/scans/track.ts` / `getTierLimits()` have no per-tool
  dimension. New tools should call the same `/api/scans/track` endpoint and
  draw from the same monthly allowance rather than getting their own — this
  was a deliberate choice (ships faster, no migration, and is a stronger
  upgrade incentive) over adding a `tool` column to `scan_counters`. Revisit
  only if that product decision changes.
- **Billing is not actually wired up**: `subscriptions.lemon_squeezy_id` is a
  schema column only — there is no checkout or webhook integration anywhere
  in `functions/api/**`. The upgrade buttons in `dashboard.astro` and
  `Analyzer.tsx` are `alert('Upgrade flow coming soon')` placeholders. Don't
  assume Pro/Team gating can actually be purchased until this is built.
- **Routing convention**: each tool gets a root-level slug (e.g.
  `/lead-csv-cleaner`), not a `/tools/*` namespace, to avoid any risk to the
  existing homepage's SEO.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
