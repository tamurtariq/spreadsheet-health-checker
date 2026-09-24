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
  `DiffChecker` (Pro/Team feature), `FileUpload`.
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
