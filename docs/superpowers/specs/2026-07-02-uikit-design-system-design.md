# WordForge — UIKit + Design System — Design Spec

**Date:** 2026-07-02
**Status:** Draft (awaiting user review)
**Scope:** Frontend design-system foundation for `apps/client` — layered design tokens, a seeded shadcn/ui component kit, two WordForge composite components, and Storybook as the development/documentation harness.

---

## 1. Goal

Establish a **production-grade UI foundation** so all future feature work (auth screens, dictionary catalog, three training modes, results) builds on a consistent, themeable, documented component kit rather than ad-hoc styling.

Concretely, after this work:

- A **layered token system** (primitive → semantic → component) lives in `styles.css`, in OKLCH, with a real brand palette and light/dark parity.
- A **base set of shadcn/ui primitives** is generated into `common/ui/`, plus **two WordForge composite components** (`WordCard`, `StatPill`) as reference for "how we build on top of primitives".
- **Storybook** runs against the client's Vite config, renders every component with the real theme, supports a **light/dark toggle** and an **a11y (axe) pass**, and hosts **Foundations docs** (colors, typography, spacing, radius, elevation).
- A minimal **`ThemeStore` + `ThemeToggle`** gives the app runtime light/dark switching, mirroring the existing `Session` store pattern.

Out of scope (YAGNI): building actual feature screens; Playwright/browser-based story interaction tests; visual-regression snapshots; i18n of component copy.

---

## 2. Context & constraints

- **Stack (already scaffolded):** React 18 + Vite + TS, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui configured (`components.json`, style `new-york`, base color `neutral`, `cssVariables: true`), MobX, TanStack Router, React Hook Form.
- **Current state:** `common/ui/` is empty (`.gitkeep` only) — **no components generated yet**. `styles.css` holds only the default shadcn neutral semantic vars. No Storybook.
- **FEOD rules that bind this work:**
  - `common/` = single-file entities, **no barrel/`index.ts`** — import directly (`@/common/ui/button`). Primitives and composites live here.
  - Import direction strictly downward: `app → pages → modules → common`.
  - **All logic in MobX stores**; components are thin `observer` wrappers. Applies to the theme toggle.
  - Alias `@/` → `apps/client/src`.
- **Responsive target:** phone **and** tablet **and** desktop (not mobile-first only). Breakpoints `375 / 768 / 1024 / 1440`. Touch targets ≥44px, no horizontal scroll, `min-h-dvh` over `100vh`.
- **Design intelligence source:** `ui-ux-pro-max` skill — friendly-but-focused adult learning tone (deliberately **not** the "kids" default of Baloo 2 / Comic Neue).

### 2.1 Pre-existing bug to fix (in scope)

`vite.config.ts` has `resolve: { tsconfigPaths: true }` — **not a valid Vite option** (silently ignored), so the `@/` alias is not actually resolved by Vite/Vitest. We add the `vite-tsconfig-paths` plugin and remove the dead option. This fixes alias resolution uniformly for the app, Vitest, **and** Storybook (which reuses this Vite config). Small, in-the-blast-radius fix — required for Storybook to resolve `@/`.

---

## 3. Design language

### 3.1 Palette — "Indigo Focus" (recommended default)

Learning indigo primary + green "know/progress" + amber streak. Reversible: because tokens are layered, swapping the direction later means editing the **primitive** scale + a few **semantic** mappings, not touching components.

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Primary | `#4F46E5` | lifted indigo | primary CTA, active nav, focus ring |
| Primary-foreground | `#FFFFFF` | `#EEF0FF` | text on primary |
| Success | `#16A34A` | `#22C55E` | "знаю", SRS progress, correct answer |
| Streak | `#F59E0B` | `#FBBF24` | streak 🔥, "к повторению" highlight |
| Destructive | `#DC2626` | `#F87171` | "не знаю", errors, destructive actions |
| Background | `#FFFFFF` | `#0F1220` | app surface |
| Foreground | `#1E1B4B` | `#E7E7F5` | body text |
| Muted-foreground | `#64748B` | `#9AA0B4` | secondary text, ≥3:1 |
| Border | `#E2E4F0` | `oklch(1 0 0 / 12%)` | dividers, input borders |

All values converted to **OKLCH** in implementation (consistent with the existing file). Every fg/bg pair verified ≥4.5:1 (body) / ≥3:1 (large/secondary) in **both** themes.

Product-semantic tokens beyond shadcn's defaults: `--success`, `--success-foreground`, `--streak`, `--streak-foreground`, `--warning`, `--info`. These are what feature code and composites reference — never raw hex.

Alternatives captured for the review gate: **Teal Scholar** (academic teal, LMS palette) and **Warm Coral** (warmer, Duolingo-ish energy). Switching = swap the primitive palette block.

### 3.2 Typography

Self-hosted via `@fontsource` (prod-grade: no external request, no FOIT, works offline — consistent with the "prod-grade for practice" project goal). Google Fonts CDN import is the fallback if we want zero deps.

- **Heading / UI display:** **Plus Jakarta Sans** — friendly geometric, modern, not childish.
- **Body / reading:** **Inter** — high legibility at small sizes, excellent for English word cards + Russian Cyrillic coverage, has **tabular figures** (used for stat counters/timers to prevent layout shift).
- Type scale (rem): `12 · 14 · 16 · 18 · 20 · 24 · 30 · 36`. Base body **16px**, line-height 1.5–1.6. Weight hierarchy: headings 600–700, body 400, labels 500.
- Registered as `--font-sans` (Inter) and `--font-heading` (Plus Jakarta) in `@theme inline`, exposing `font-sans` / `font-heading` utilities.

### 3.3 Radius, elevation, spacing

- **Radius:** keep the layered `--radius` system; bump base to `0.75rem` for a friendlier feel. Exposes `rounded-sm/md/lg/xl`.
- **Elevation:** add a consistent shadow scale `--shadow-xs · sm · md · lg` (soft, low-spread, tuned for both themes — dark mode uses subtler shadows + border emphasis). Exposed as `shadow-xs…` via theme.
- **Spacing:** keep Tailwind's default 4px scale (already a 4/8 rhythm) — do **not** override. Document the intended rhythm tiers (`16 / 24 / 32 / 48`) in Foundations.

---

## 4. Token architecture (three layers)

`styles.css` is restructured into three clearly-commented blocks. shadcn's existing semantic var **names** are preserved (so generated components keep working) but are now **sourced from primitives**.

```
/* ---- LAYER 1: PRIMITIVES (theme-agnostic raw scales, OKLCH) ---- */
:root {
  --indigo-50 … --indigo-950;
  --green-…, --amber-…, --red-…, --neutral-…;
  --white, --black;
}

/* ---- LAYER 2: SEMANTIC (role → primitive, per theme) ---- */
:root {           /* light */
  --background: var(--white);
  --primary: var(--indigo-600);
  --success: var(--green-600);
  --streak: var(--amber-500);
  /* …all shadcn roles + product roles… */
}
.dark {           /* dark: desaturated/lifted variants, not inverted */
  --background: var(--neutral-950);
  --primary: var(--indigo-400);
  /* … */
}

/* ---- LAYER 3: COMPONENT (Tailwind bridge) ---- */
@theme inline {
  --color-primary: var(--primary);
  --color-success: var(--success);
  --color-streak: var(--streak);
  --font-sans: 'Inter', …;
  --font-heading: 'Plus Jakarta Sans', …;
  --radius-lg: var(--radius);
  --shadow-md: …;
}
```

**Rule for all downstream code:** components and features reference **semantic** tokens (`bg-primary`, `text-success`, `bg-streak`) — never primitives, never raw hex. This is what makes a palette swap a one-file change.

---

## 5. Component inventory

Generated via the shadcn CLI (`pnpm dlx shadcn@latest add …`) into `@/common/ui` per the existing `components.json` aliases. Each is a single file, no barrel.

**Forms / input:** `button`, `input`, `label`, `form` (RHF wrapper — `react-hook-form` already present), `select`, `checkbox`, `switch`
**Overlay / nav:** `dialog`, `dropdown-menu`, `tabs`, `sonner` (toasts)
**Display:** `card`, `badge`, `progress`, `skeleton`, `avatar`, `separator`

**WordForge composites (hand-written, presentational, in `common/ui/`):**

- **`WordCard`** — renders a vocabulary card (EN word, RU translation, CEFR badge, category, example, 🔊 button slot). Pure props-in / callbacks-out; **no business logic, no data fetching** (FEOD: logic stays in stores). Built from `card` + `badge` + `button` + tokens. The reference for "compose primitives into a product component."
- **`StatPill`** — compact metric chip (streak 🔥, "к повторению", "выучено"). Uses `--streak` token, tabular figures, an icon slot (Lucide, per `components.json`).

Icons: **Lucide** (already the configured `iconLibrary`). No emoji as structural icons — 🔥/🔊 shown here are content labels, actual UI icons are Lucide SVGs.

---

## 6. Runtime theming

Minimal, FEOD-correct, mirrors the existing `modules/core/modules/Session` pattern.

- **`ThemeStore`** (MobX, in `modules/core/modules/Theme/`) — holds `theme: 'light' | 'dark' | 'system'`, resolves effective theme, toggles `.dark` on `document.documentElement`, persists to `localStorage`, and seeds initial value from `prefers-color-scheme`. All logic here (no logic in the component).
- **`ThemeToggle`** (`common/ui/theme-toggle.tsx`) — thin `observer` button (Lucide sun/moon) calling `store.toggle()`. Presentational; store injected via the existing DI/provider mechanism (`create-di` / provider pattern already in the repo).
- Initial theme class is applied before first paint (small inline set in the theme provider) to avoid a flash.

---

## 7. Storybook harness

**Storybook 9** with the **`@storybook/react-vite`** framework, reusing `apps/client/vite.config.ts` (so Tailwind v4 + the `@/` alias via `vite-tsconfig-paths` work automatically). Exact versions verified against current docs during the implementation plan.

**Config (`apps/client/.storybook/`):**

- `main.ts` — framework `@storybook/react-vite`; `stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx']`; addons: **`@storybook/addon-a11y`** (axe pass), **`@storybook/addon-themes`** (light/dark toolbar via `withThemeByClassName`, toggling `.dark`), docs autodocs.
- `preview.ts` — imports `@/app/assets/styles.css` (real tokens); global `decorators` for the theme class + a padded, `bg-background text-foreground` canvas; `parameters` set backgrounds off (theme owns the background), viewport presets `375 / 768 / 1024 / 1440`.

**Story conventions:**

- **CSF3 + TypeScript** (`Meta` / `StoryObj`), `tags: ['autodocs']`.
- **Colocated** next to each component: `common/ui/button.tsx` → `common/ui/button.stories.tsx` (respects "no barrels, import directly").
- Each component story shows key variants/states (default, hover/active where relevant, disabled, loading, error) and renders correctly in both themes via the toolbar.
- **Foundations docs** (MDX) under `apps/client/.storybook/foundations/`: `Colors`, `Typography`, `Spacing & Radius`, `Elevation` — rendered from the live CSS variables so docs never drift from tokens.

**Scripts (client `package.json`):** `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`.

**Tooling fit:** oxfmt/oxlint already glob `.tsx` — stories are formatted/linted automatically. We do **not** add the Storybook ESLint plugin (repo uses oxlint, not ESLint). Turborepo: add a `build-storybook` task with `storybook-static/**` output (optional, low priority).

### 7.1 Testing decision

Keep the existing **Vitest + jsdom** setup for logic/behavior tests. Storybook runs **standalone** for building + documenting the kit. We deliberately **skip** `@storybook/addon-vitest` (browser/Playwright story-tests) for now — it adds Playwright weight and the project's primary learning focus is backend/infra. Revisit if we want story-as-test later. The a11y addon already gives per-story axe feedback cheaply.

---

## 8. File-level plan (where things land)

```
apps/client/
├── .storybook/
│   ├── main.ts
│   ├── preview.ts
│   └── foundations/            # Colors.mdx, Typography.mdx, Spacing.mdx, Elevation.mdx
├── src/
│   ├── app/assets/styles.css   # ← restructured into 3 token layers + fonts
│   ├── common/ui/
│   │   ├── button.tsx  + button.stories.tsx
│   │   ├── … (all generated primitives, each + .stories.tsx)
│   │   ├── word-card.tsx + word-card.stories.tsx      # composite
│   │   ├── stat-pill.tsx + stat-pill.stories.tsx      # composite
│   │   └── theme-toggle.tsx + theme-toggle.stories.tsx
│   └── modules/core/modules/Theme/
│       ├── theme.store.ts + theme.store.test.ts
│       ├── theme.provider.tsx
│       └── index.ts
├── vite.config.ts              # ← add vite-tsconfig-paths, drop dead option
└── package.json                # ← storybook scripts + deps
```

---

## 9. Dependencies to add

All via `pnpm add --filter client` (never hand-edit versions — project rule).

- **Dev:** `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-themes`, `vite-tsconfig-paths`.
- **Runtime (fonts):** `@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans` (or CDN import — decide at plan time).
- shadcn primitives pull their own Radix deps automatically via the CLI.

---

## 10. Testing & verification

- **`ThemeStore`** — unit test (Vitest): default from `prefers-color-scheme`, toggle flips class + persists, rehydrates from `localStorage`. Mirrors `session.store.test.ts`.
- **Storybook build** — `pnpm --filter client build-storybook` succeeds (catches broken stories/imports).
- **a11y** — no critical axe violations in the addon panel for seeded components (contrast, labels, focus).
- **Manual** — run Storybook, verify every component in light + dark at 375 / 768 / 1024 / 1440; confirm `@/` resolves; confirm `pnpm --filter client build` and `pnpm --filter client typecheck` stay green.
- **Hooks** — pre-push (format-check + lint + typecheck + test) passes.

---

## 11. Success criteria

1. `styles.css` has three explicit token layers with a real "Indigo Focus" palette, light/dark parity, OKLCH, fonts wired.
2. The full approved primitive set + `WordCard` + `StatPill` + `ThemeToggle` exist in `common/ui/`, each with a story.
3. Storybook runs (`pnpm --filter client storybook`), themes toggle, a11y panel active, Foundations docs render from live tokens.
4. `ThemeStore` switches the app theme at runtime and persists; unit-tested.
5. `@/` alias fixed; build, typecheck, lint, format, tests all green.

---

## 12. Open decision (for review gate)

- **Palette direction** — spec defaults to **Indigo Focus**; Teal Scholar / Warm Coral are one-primitive-block swaps if preferred.
- **Fonts** — self-hosted `@fontsource` (recommended) vs CDN import.
- Both are cheap to change precisely because of the layered-token design; flagged here so the choice is explicit, not silent.
