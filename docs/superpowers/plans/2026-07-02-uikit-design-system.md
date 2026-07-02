# WordForge — UIKit + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a production-grade frontend UI foundation for `apps/client` — layered design tokens (Indigo Focus), a seeded shadcn/ui component kit, two WordForge composites, a runtime light/dark theme, and Storybook as the build/documentation/verification harness.

**Architecture:** Tailwind v4 CSS variables in `styles.css` restructured into three token layers (primitive → semantic → component). shadcn primitives generated into `common/ui/` (no barrels; direct imports). A MobX `ThemeStore` (factory + DI provider) lives in `common/theme/` (documented FEOD deviation, per user) and is added to the existing `AppGraph` in `composition-root.ts`. Storybook (latest, `@storybook/react-vite`) reuses the client's Vite config; every component gets a colocated `*.stories.tsx`. Visual verification is driven by the Playwright MCP browser against a running Storybook.

**Tech Stack:** React 18, Vite 8, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (new-york), MobX, TanStack Router, React Hook Form, Storybook (react-vite) + addon-a11y + addon-themes + addon-docs, `@fontsource-variable/*`, Vitest, Playwright MCP.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-02-uikit-design-system-design.md` is authoritative.
- **FEOD (enforced):** import direction strictly downward `app → pages → modules → common`; `common/` has **no barrel/`index.ts`** files — import directly (`@/common/ui/button`); components are thin `observer` wrappers, **all logic in MobX stores**.
- **Tokens:** components/features reference **semantic** tokens only (`bg-primary`, `text-success`, `bg-streak`) — never primitives, never raw hex.
- **Formatting/style (oxfmt):** single quotes, no semicolons. Run `pnpm format` before every commit; hooks enforce it.
- **Dependencies:** add via `pnpm add` (`--filter client`, `-Dw` for root) — never hand-edit versions into `package.json`.
- **TypeScript:** `erasableSyntaxOnly` + `verbatimModuleSyntax` on — no enums, no class parameter-properties; use `as const` unions and `import type`.
- **Alias:** `@/` → `apps/client/src`.
- **Commits:** conventional-commit style, scoped `(client)`; commit after each task.
- **All commands run from repo root** unless stated; per-package commands use `pnpm --filter client …`.

---

## Task 0: Fix the `@/` alias resolution (Vite/Vitest/Storybook prerequisite)

`vite.config.ts` has `resolve: { tsconfigPaths: true }` — not a real Vite option (silently ignored). Storybook will reuse this config, so `@/` must resolve for real. Fix once, benefits app + tests + Storybook.

**Files:**
- Modify: `apps/client/vite.config.ts`
- Add dep: `vite-tsconfig-paths` (dev)

**Interfaces:**
- Produces: a working `@/*` → `src/*` alias in all Vite/Vitest contexts.

- [ ] **Step 1: Add the plugin dependency**

```bash
pnpm add -D --filter client vite-tsconfig-paths
```

- [ ] **Step 2: Rewrite `vite.config.ts` to use the plugin**

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 3: Verify existing tests still resolve `@/` and pass**

Run: `pnpm --filter client test`
Expected: PASS — existing suites (`composition-root.test.ts`, `httpClient.test.ts`, `auth.service.test.ts`, `session.store.test.ts`, `authApi.test.ts`) green; no "Cannot find module '@/…'" errors.

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS (build emits `dist/`).

- [ ] **Step 5: Format + commit**

```bash
pnpm format
git add apps/client/vite.config.ts apps/client/package.json package.json pnpm-lock.yaml
git commit -m "fix(client): resolve @/ alias via vite-tsconfig-paths"
```

---

## Task 1: Design tokens — restructure `styles.css` into three layers (Indigo Focus) + fonts

Replace the flat shadcn neutral vars with a layered token system: primitives (raw OKLCH scales), semantic (roles per theme, incl. product tokens `--success`/`--streak`/`--warning`/`--info`), and the Tailwind bridge (`@theme inline`). Wire self-hosted fonts.

**Files:**
- Modify: `apps/client/src/app/assets/styles.css` (full replace)
- Add deps: `@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans`

**Interfaces:**
- Produces (Tailwind utilities usable everywhere): `bg-background text-foreground bg-primary text-primary-foreground bg-success text-success-foreground bg-streak text-streak-foreground bg-warning bg-info bg-card bg-muted text-muted-foreground border-border ring-ring` · `rounded-sm|md|lg|xl` · `shadow-xs|sm|md|lg` · `font-sans` (Inter) · `font-heading` (Plus Jakarta Sans). Dark mode via `.dark` class on an ancestor.

- [ ] **Step 1: Add the font packages**

```bash
pnpm add --filter client @fontsource-variable/inter @fontsource-variable/plus-jakarta-sans
```

- [ ] **Step 2: Replace `styles.css` with the layered token system**

```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/plus-jakarta-sans';
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

/* ============================================================
   LAYER 1 — PRIMITIVES (theme-agnostic raw scales, OKLCH)
   Only the shades actually used by the semantic layer.
   Swapping palette direction = edit this block.
   ============================================================ */
:root {
  --white: oklch(1 0 0);
  --black: oklch(0 0 0);

  /* Indigo (primary family) */
  --indigo-50: oklch(0.962 0.018 277);
  --indigo-100: oklch(0.93 0.033 277);
  --indigo-400: oklch(0.673 0.163 277);
  --indigo-500: oklch(0.585 0.203 277);
  --indigo-600: oklch(0.511 0.226 277);
  --indigo-950: oklch(0.262 0.09 277);

  /* Green (success / "знаю" / progress) */
  --green-500: oklch(0.723 0.192 149);
  --green-600: oklch(0.627 0.17 149);

  /* Amber (streak 🔥) */
  --amber-400: oklch(0.828 0.147 78);
  --amber-500: oklch(0.769 0.16 74);

  /* Red (destructive / "не знаю") */
  --red-400: oklch(0.704 0.181 22);
  --red-600: oklch(0.577 0.223 27);

  /* Blue (info) */
  --blue-500: oklch(0.623 0.19 259);

  /* Neutrals (cool, slate-ish) */
  --neutral-50: oklch(0.984 0.003 247);
  --neutral-100: oklch(0.968 0.005 247);
  --neutral-200: oklch(0.92 0.006 247);
  --neutral-400: oklch(0.704 0.02 256);
  --neutral-500: oklch(0.554 0.03 257);
  --neutral-800: oklch(0.28 0.03 257);
  --neutral-900: oklch(0.22 0.028 265);
  --neutral-950: oklch(0.17 0.024 275);
}

/* ============================================================
   LAYER 2 — SEMANTIC (role → primitive, per theme)
   shadcn role names preserved + product roles added.
   ============================================================ */
:root {
  --radius: 0.75rem;

  --background: var(--white);
  --foreground: var(--indigo-950);
  --card: var(--white);
  --card-foreground: var(--indigo-950);
  --popover: var(--white);
  --popover-foreground: var(--indigo-950);

  --primary: var(--indigo-600);
  --primary-foreground: var(--white);
  --secondary: var(--neutral-100);
  --secondary-foreground: var(--indigo-950);
  --muted: var(--neutral-100);
  --muted-foreground: var(--neutral-500);
  --accent: var(--indigo-50);
  --accent-foreground: var(--indigo-600);

  --destructive: var(--red-600);
  --destructive-foreground: var(--white);

  /* product-semantic (used by features + composites) */
  --success: var(--green-600);
  --success-foreground: var(--white);
  --streak: var(--amber-500);
  --streak-foreground: var(--neutral-950);
  --warning: var(--amber-500);
  --warning-foreground: var(--neutral-950);
  --info: var(--blue-500);
  --info-foreground: var(--white);

  --border: var(--neutral-200);
  --input: var(--neutral-200);
  --ring: var(--indigo-600);
}

.dark {
  --background: var(--neutral-950);
  --foreground: oklch(0.92 0.01 285);
  --card: var(--neutral-900);
  --card-foreground: oklch(0.92 0.01 285);
  --popover: var(--neutral-900);
  --popover-foreground: oklch(0.92 0.01 285);

  --primary: var(--indigo-400);
  --primary-foreground: var(--neutral-950);
  --secondary: var(--neutral-800);
  --secondary-foreground: oklch(0.92 0.01 285);
  --muted: var(--neutral-800);
  --muted-foreground: var(--neutral-400);
  --accent: var(--neutral-800);
  --accent-foreground: var(--indigo-400);

  --destructive: var(--red-400);
  --destructive-foreground: var(--neutral-950);

  --success: var(--green-500);
  --success-foreground: var(--neutral-950);
  --streak: var(--amber-400);
  --streak-foreground: var(--neutral-950);
  --warning: var(--amber-400);
  --warning-foreground: var(--neutral-950);
  --info: var(--blue-500);
  --info-foreground: var(--neutral-950);

  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: var(--indigo-400);
}

/* ============================================================
   LAYER 3 — COMPONENT (Tailwind bridge)
   Exposes semantic tokens as utilities + fonts/radius/shadow.
   ============================================================ */
@theme inline {
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-heading: 'Plus Jakarta Sans Variable', ui-sans-serif, system-ui, sans-serif;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-xs: 0 1px 2px 0 oklch(0.2 0.04 277 / 0.06);
  --shadow-sm: 0 1px 3px 0 oklch(0.2 0.04 277 / 0.08), 0 1px 2px -1px oklch(0.2 0.04 277 / 0.08);
  --shadow-md: 0 4px 12px -2px oklch(0.2 0.04 277 / 0.1), 0 2px 6px -2px oklch(0.2 0.04 277 / 0.08);
  --shadow-lg: 0 12px 28px -6px oklch(0.2 0.04 277 / 0.14), 0 4px 10px -4px oklch(0.2 0.04 277 / 0.1);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-streak: var(--streak);
  --color-streak-foreground: var(--streak-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-heading);
  }
}
```

- [ ] **Step 3: Smoke-check that the app builds with the new tokens**

Run: `pnpm --filter client build`
Expected: PASS — no unknown-utility errors; fonts resolve.

- [ ] **Step 4: Format + commit**

```bash
pnpm format
git add apps/client/src/app/assets/styles.css apps/client/package.json package.json pnpm-lock.yaml
git commit -m "feat(client): layered design tokens (Indigo Focus) + self-hosted fonts"
```

---

## Task 2: Install & configure Storybook (react-vite + a11y + themes + docs)

**Files:**
- Create: `apps/client/.storybook/main.ts`, `apps/client/.storybook/preview.ts`
- Modify: `apps/client/package.json` (scripts + deps added by init)
- Modify: `apps/client/.gitignore` (ignore `storybook-static/`)

**Interfaces:**
- Produces: `pnpm --filter client storybook` (dev server on :6006) and `pnpm --filter client build-storybook`; a global light/dark toolbar toggle; the a11y panel; stories glob `src/**/*.stories.@(ts|tsx)` + `src/**/*.mdx`.

- [ ] **Step 1: Initialize Storybook (auto-detects Vite + React)**

```bash
cd apps/client && pnpm dlx storybook@latest init --yes --package-manager pnpm ; cd ../..
```

Expected: creates `.storybook/`, adds `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-docs` (and possibly `@storybook/addon-vitest`), and `storybook`/`build-storybook` scripts to `apps/client/package.json`. It may generate example stories under `src/stories/` — delete that folder if present:

```bash
rm -rf apps/client/src/stories
```

- [ ] **Step 2: Remove the Vitest/Playwright story-test addon if init added it (YAGNI — see spec §7.1)**

```bash
pnpm remove --filter client @storybook/addon-vitest 2>/dev/null || true
rm -f apps/client/.storybook/vitest.setup.ts apps/client/vitest.workspace.ts apps/client/vitest.shims.d.ts
```

(If none existed, these are no-ops.)

- [ ] **Step 3: Add the themes addon**

```bash
cd apps/client && pnpm dlx storybook@latest add @storybook/addon-themes ; cd ../..
```

- [ ] **Step 4: Write `.storybook/main.ts`**

```ts
import { defineMain } from '@storybook/react-vite/node'

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
})
```

- [ ] **Step 5: Write `.storybook/preview.ts`** (real tokens + light/dark decorator)

```ts
import { withThemeByClassName } from '@storybook/addon-themes'
import type { Preview, ReactRenderer } from '@storybook/react-vite'
import '../src/app/assets/styles.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
    viewport: {
      options: {
        mobile: { name: 'Mobile 375', styles: { width: '375px', height: '812px' } },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' } },
        laptop: { name: 'Laptop 1024', styles: { width: '1024px', height: '768px' } },
        desktop: { name: 'Desktop 1440', styles: { width: '1440px', height: '900px' } },
      },
    },
    a11y: { test: 'error' },
  },
  decorators: [
    withThemeByClassName<ReactRenderer>({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
}

export default preview
```

- [ ] **Step 6: Ignore the static build output**

Add a line to `apps/client/.gitignore`:

```
storybook-static
```

- [ ] **Step 7: Verify Storybook builds**

Run: `pnpm --filter client build-storybook`
Expected: PASS — `storybook-static/` produced, no config errors. (If the Storybook 10 build fails against Vite 8, pin Storybook 9: `pnpm dlx storybook@^9 upgrade` — per spec §7 fallback — then re-run.)

- [ ] **Step 8: Format + commit**

```bash
pnpm format
git add apps/client/.storybook apps/client/package.json apps/client/.gitignore package.json pnpm-lock.yaml
git commit -m "chore(client): set up Storybook (react-vite, a11y, themes, docs)"
```

---

## Task 3: Generate shadcn primitives + colocated stories

Generate the approved primitive set into `@/common/ui`, then add one colocated CSF3 story per component. `button` is the fully-worked exemplar; the rest follow the same template with the variants listed.

**Files:**
- Create (via CLI): `apps/client/src/common/ui/{button,input,label,form,select,checkbox,switch,dialog,dropdown-menu,tabs,sonner,card,badge,progress,skeleton,avatar,separator}.tsx`
- Create: a `*.stories.tsx` beside each of the above.

**Interfaces:**
- Consumes: design tokens from Task 1.
- Produces: `Button` (variants `default|secondary|destructive|outline|ghost|link`, sizes `default|sm|lg|icon`), `Card` (+ `CardHeader/CardTitle/CardDescription/CardContent/CardFooter`), `Badge` (variants `default|secondary|destructive|outline`), `Progress` (prop `value: number`), and the rest — used by Tasks 4–6.

- [ ] **Step 1: Generate the primitives**

```bash
cd apps/client && pnpm dlx shadcn@latest add button input label form select checkbox switch dialog dropdown-menu tabs sonner card badge progress skeleton avatar separator --yes ; cd ../..
```

Expected: files land in `src/common/ui/` (per `components.json` aliases). Radix deps auto-installed. If the CLI reports the CSS already has variables, accept/keep ours from Task 1.

- [ ] **Step 2: Typecheck the generated code**

Run: `pnpm --filter client typecheck`
Expected: PASS. (If any generated import uses a path the alias doesn't cover, fix to `@/common/...`.)

- [ ] **Step 3: Write the exemplar story `common/ui/button.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Продолжить' },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Не знаю' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Link: Story = { args: { variant: 'link' } }
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
export const Disabled: Story = { args: { disabled: true } }
```

- [ ] **Step 4: Write a story for each remaining primitive** using this template (replace `Cmp`, `title`, and the exported stories with the variants below).

Template:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cmp } from './cmp'

const meta = { title: 'UI/Cmp', component: Cmp, tags: ['autodocs'] } satisfies Meta<typeof Cmp>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }
```

Variants/args to render per component (add one exported `Story` each):
- **input** — `Default` (`args: { placeholder: 'например, resilient' }`), `Disabled` (`args: { disabled: true, placeholder: 'недоступно' }`).
- **label** — `Default` renders `<Label htmlFor="w">Слово</Label>` via a `render`.
- **form** — a `render` with a minimal `react-hook-form` `useForm` wrapping one `FormField`+`Input` labeled "Слово"; story `Default`.
- **select** — `render` a `Select` with `SelectTrigger`/`SelectContent` and options `A1 A2 B1 B2 C1 C2`; story `Default` + `Placeholder`.
- **checkbox** — `Default`, `Checked` (`args: { defaultChecked: true }`).
- **switch** — `Default`, `On` (`args: { defaultChecked: true }`).
- **dialog** — `render` a `Dialog` with a `Button` trigger "Добавить слово" and a `DialogContent`/`DialogHeader`/`DialogTitle`; story `Default`.
- **dropdown-menu** — `render` a trigger button + 3 items ("Учить", "Скрыть", "Удалить"); story `Default`.
- **tabs** — `render` `Tabs` with `TabsList` ("Карточки", "Викторина", "Письмо") and matching `TabsContent`; story `Default`.
- **sonner** — `render` a `Button` calling `toast('Сохранено')` plus a `<Toaster />`; story `Default`.
- **card** — `render` a `Card` with header/title/description/content/footer; story `Default`.
- **badge** — `Default`, `Secondary` (`args: { variant: 'secondary', children: 'A2' }`), `Destructive`, `Outline`.
- **progress** — `AtStart` (`args: { value: 15 }`), `Midway` (`args: { value: 60 }`), `Full` (`args: { value: 100 }`).
- **skeleton** — `Default` renders `<Skeleton className="h-6 w-40" />`.
- **avatar** — `render` an `Avatar` with `AvatarFallback` "АС"; story `Default`.
- **separator** — `Default` renders text/`Separator`/text.

- [ ] **Step 5: Verify all stories compile via a Storybook build**

Run: `pnpm --filter client build-storybook`
Expected: PASS — every story indexes and builds; no import/type errors.

- [ ] **Step 6: Format + lint + commit**

```bash
pnpm format && pnpm --filter client lint
git add apps/client/src/common/ui apps/client/package.json apps/client/components.json package.json pnpm-lock.yaml
git commit -m "feat(client): seed shadcn primitives with colocated stories"
```

---

## Task 4: `WordCard` composite + story

Presentational vocabulary card built from `card` + `badge` + `button`. No business logic, no fetching — props in, callbacks out.

**Files:**
- Create: `apps/client/src/common/ui/word-card.tsx`
- Create: `apps/client/src/common/ui/word-card.stories.tsx`

**Interfaces:**
- Consumes: `Card*`, `Badge`, `Button` (Task 3); `cn` from `@/common/utilities/cn`; `lucide-react` `Volume2`.
- Produces: `WordCard` with props `WordCardProps` `{ word: string; translation: string; level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'; category?: string; example?: string; onSpeak?: () => void }`.

- [ ] **Step 1: Write the failing story (drives the component's existence)**

`common/ui/word-card.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { WordCard } from './word-card'

const meta = {
  title: 'WordForge/WordCard',
  component: WordCard,
  tags: ['autodocs'],
  args: {
    word: 'resilient',
    translation: 'устойчивый, жизнестойкий',
    level: 'B2',
    category: 'эмоции',
    example: 'She stayed resilient through every setback.',
  },
} satisfies Meta<typeof WordCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Minimal: Story = { args: { category: undefined, example: undefined } }
export const LongExample: Story = {
  args: {
    example:
      'Despite losing the first three rounds, the resilient challenger came back to win the championship in a stunning display of grit.',
  },
}
```

- [ ] **Step 2: Run Storybook build to confirm it fails (component missing)**

Run: `pnpm --filter client build-storybook`
Expected: FAIL — cannot resolve `./word-card`.

- [ ] **Step 3: Implement `common/ui/word-card.tsx`**

```tsx
import { Volume2 } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader } from './card'

export type WordCardProps = {
  word: string
  translation: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  category?: string
  example?: string
  onSpeak?: () => void
}

export function WordCard({
  word,
  translation,
  level,
  category,
  example,
  onSpeak,
}: WordCardProps) {
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-heading text-2xl font-semibold text-foreground">
            {word}
          </h3>
          <p className="text-muted-foreground">{translation}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Озвучить произношение"
          onClick={onSpeak}
        >
          <Volume2 className="size-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{level}</Badge>
          {category ? <Badge variant="secondary">{category}</Badge> : null}
        </div>
        {example ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Пример: </span>
            {example}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run Storybook build to confirm it passes**

Run: `pnpm --filter client build-storybook`
Expected: PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
pnpm format && pnpm --filter client lint
git add apps/client/src/common/ui/word-card.tsx apps/client/src/common/ui/word-card.stories.tsx
git commit -m "feat(client): WordCard composite + story"
```

---

## Task 5: `StatPill` composite + story

Compact metric chip (streak 🔥 / «к повторению» / «выучено»). Uses `--streak` token and tabular figures.

**Files:**
- Create: `apps/client/src/common/ui/stat-pill.tsx`
- Create: `apps/client/src/common/ui/stat-pill.stories.tsx`

**Interfaces:**
- Consumes: `cn` from `@/common/utilities/cn`; `lucide-react`.
- Produces: `StatPill` with props `{ icon?: ReactNode; value: number | string; label: string; tone?: 'default' | 'streak' | 'success' }`.

- [ ] **Step 1: Write the failing story**

`common/ui/stat-pill.stories.tsx`:

```tsx
import { Flame, GraduationCap, RotateCcw } from 'lucide-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatPill } from './stat-pill'

const meta = {
  title: 'WordForge/StatPill',
  component: StatPill,
  tags: ['autodocs'],
} satisfies Meta<typeof StatPill>

export default meta
type Story = StoryObj<typeof meta>

export const Streak: Story = {
  args: { icon: <Flame className="size-4" />, value: 7, label: 'дней подряд', tone: 'streak' },
}
export const DueToday: Story = {
  args: { icon: <RotateCcw className="size-4" />, value: 24, label: 'к повторению' },
}
export const Learned: Story = {
  args: { icon: <GraduationCap className="size-4" />, value: 142, label: 'выучено', tone: 'success' },
}
```

- [ ] **Step 2: Run Storybook build to confirm it fails**

Run: `pnpm --filter client build-storybook`
Expected: FAIL — cannot resolve `./stat-pill`.

- [ ] **Step 3: Implement `common/ui/stat-pill.tsx`**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/common/utilities/cn'

export type StatPillProps = {
  icon?: ReactNode
  value: number | string
  label: string
  tone?: 'default' | 'streak' | 'success'
}

const toneClasses = {
  default: 'bg-muted text-muted-foreground',
  streak: 'bg-streak/15 text-streak-foreground',
  success: 'bg-success/15 text-success',
} as const

export function StatPill({ icon, value, label, tone = 'default' }: StatPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
        toneClasses[tone],
      )}
    >
      {icon}
      <span className="font-heading text-base font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}
```

- [ ] **Step 4: Run Storybook build to confirm it passes**

Run: `pnpm --filter client build-storybook`
Expected: PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
pnpm format && pnpm --filter client lint
git add apps/client/src/common/ui/stat-pill.tsx apps/client/src/common/ui/stat-pill.stories.tsx
git commit -m "feat(client): StatPill composite + story"
```

---

## Task 6: `ThemeStore` (TDD) + provider in `common/theme/` + wire into the graph + `ThemeToggle`

Runtime light/dark. Store factory with injected side-effect ports (repo IoC style), unit-tested. `common/theme/` placement is a **documented FEOD deviation** (theme is normally a `core` submodule) — per user instruction; carry a justifying comment.

**Files:**
- Create: `apps/client/src/common/theme/theme.store.ts`
- Create: `apps/client/src/common/theme/theme.store.test.ts`
- Create: `apps/client/src/common/theme/theme.provider.tsx`
- Create: `apps/client/src/common/ui/theme-toggle.tsx`
- Create: `apps/client/src/common/ui/theme-toggle.stories.tsx`
- Modify: `apps/client/src/app/composition-root.ts`

**Interfaces:**
- Consumes: `makeAutoObservable` (mobx); `createDi` (`@/common/lib/react/create-di`); `observer` (mobx-react-lite); `lucide-react` `Moon`/`Sun`.
- Produces: `createThemeStore(deps: ThemeStoreDeps): ThemeStore` where `ThemeStoreDeps = { getInitialTheme: () => Theme; persist: (t: Theme) => void; applyClass: (isDark: boolean) => void }`, `Theme = 'light' | 'dark'`, `ThemeStore = { theme: Theme; readonly isDark: boolean; setTheme(t): void; toggle(): void }`; `ThemeProvider` (`{ value: ThemeStore; children }`) + `useThemeStore()`; `ThemeToggle` (observer). `AppGraph` gains `theme: ThemeStore`.

- [ ] **Step 1: Write the failing test `common/theme/theme.store.test.ts`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { createThemeStore } from './theme.store'

function makeDeps(initial: 'light' | 'dark' = 'light') {
  return {
    getInitialTheme: () => initial,
    persist: vi.fn(),
    applyClass: vi.fn(),
  }
}

describe('theme store', () => {
  it('seeds from getInitialTheme and applies the class on creation', () => {
    const deps = makeDeps('dark')
    const store = createThemeStore(deps)

    expect(store.theme).toBe('dark')
    expect(store.isDark).toBe(true)
    expect(deps.applyClass).toHaveBeenCalledWith(true)
  })

  it('toggle flips the theme, applies the class, and persists', () => {
    const deps = makeDeps('light')
    const store = createThemeStore(deps)
    deps.applyClass.mockClear()

    store.toggle()

    expect(store.theme).toBe('dark')
    expect(deps.applyClass).toHaveBeenLastCalledWith(true)
    expect(deps.persist).toHaveBeenLastCalledWith('dark')
  })

  it('setTheme sets an explicit value', () => {
    const store = createThemeStore(makeDeps('dark'))
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(store.isDark).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter client test common/theme/theme.store.test.ts`
Expected: FAIL — cannot resolve `./theme.store`.

- [ ] **Step 3: Implement `common/theme/theme.store.ts`**

```ts
// FEOD deviation (documented): theme is normally a modules/core submodule, but
// per project decision it lives in common/. Store keeps side effects in injected
// ports so it stays a testable, single-responsibility unit.
import { makeAutoObservable } from 'mobx'

export type Theme = 'light' | 'dark'

export type ThemeStoreDeps = {
  getInitialTheme: () => Theme
  persist: (theme: Theme) => void
  applyClass: (isDark: boolean) => void
}

export function createThemeStore(deps: ThemeStoreDeps) {
  const store = makeAutoObservable({
    theme: deps.getInitialTheme(),
    get isDark() {
      return this.theme === 'dark'
    },
    setTheme(theme: Theme) {
      this.theme = theme
      deps.applyClass(theme === 'dark')
      deps.persist(theme)
    },
    toggle() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
  })
  deps.applyClass(store.isDark)
  return store
}

export type ThemeStore = ReturnType<typeof createThemeStore>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter client test common/theme/theme.store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `common/theme/theme.provider.tsx`**

```tsx
import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { ThemeStore } from './theme.store'

export const { Injector, useDi: useThemeStore } = createDi<ThemeStore>()

export const ThemeProvider = ({
  value,
  children,
}: {
  value: ThemeStore
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
```

- [ ] **Step 6: Wire `theme` into `AppGraph` — modify `app/composition-root.ts`**

Add imports and extend the graph (real ports use `localStorage`, `matchMedia`, `document.documentElement`):

```ts
import { createThemeStore } from '@/common/theme/theme.store'
import type { ThemeStore } from '@/common/theme/theme.store'
```

Extend `AppGraph`:

```ts
export type AppGraph = {
  session: SessionStore
  authService: AuthService
  theme: ThemeStore
}
```

In `createGraph()`, before the `return`, add:

```ts
  const theme = createThemeStore({
    getInitialTheme: () => {
      const stored = localStorage.getItem('wf.theme')
      if (stored === 'light' || stored === 'dark') return stored
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    },
    persist: (value) => localStorage.setItem('wf.theme', value),
    applyClass: (isDark) =>
      document.documentElement.classList.toggle('dark', isDark),
  })
```

and return it:

```ts
  return { session, authService, theme }
```

- [ ] **Step 7: Implement `common/ui/theme-toggle.tsx`**

```tsx
import { Moon, Sun } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { Button } from './button'
import { useThemeStore } from '@/common/theme/theme.provider'

export const ThemeToggle = observer(() => {
  const theme = useThemeStore()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme.isDark ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => theme.toggle()}
    >
      {theme.isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
})
```

- [ ] **Step 8: Write `common/ui/theme-toggle.stories.tsx`** (provide a store via the provider; toolbar still controls the visual theme)

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeToggle } from './theme-toggle'
import { ThemeProvider } from '@/common/theme/theme.provider'
import { createThemeStore } from '@/common/theme/theme.store'

const store = createThemeStore({
  getInitialTheme: () => 'light',
  persist: () => {},
  applyClass: () => {},
})

const meta = {
  title: 'WordForge/ThemeToggle',
  component: ThemeToggle,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider value={store}>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- [ ] **Step 9: Verify — unit test, composition-root test, typecheck, storybook build**

Run: `pnpm --filter client test && pnpm --filter client typecheck && pnpm --filter client build-storybook`
Expected: PASS — theme store tests green, existing `composition-root.test.ts` still green (graph now has `theme`), stories build.

- [ ] **Step 10: Format + lint + commit**

```bash
pnpm format && pnpm --filter client lint
git add apps/client/src/common/theme apps/client/src/common/ui/theme-toggle.tsx apps/client/src/common/ui/theme-toggle.stories.tsx apps/client/src/app/composition-root.ts
git commit -m "feat(client): runtime light/dark ThemeStore + ThemeToggle"
```

---

## Task 7: Foundations documentation (MDX)

Doc-only Storybook pages that render the **live** CSS variables so docs never drift from tokens.

**Files:**
- Create: `apps/client/.storybook/foundations/Colors.mdx`
- Create: `apps/client/.storybook/foundations/Typography.mdx`
- Create: `apps/client/.storybook/foundations/SpacingRadius.mdx`

**Interfaces:**
- Consumes: the tokens from Task 1 (via `styles.css`, already imported in `preview.ts`).

- [ ] **Step 1: `Colors.mdx`** — swatches driven by semantic tokens

```mdx
import { Meta } from '@storybook/addon-docs/blocks'

<Meta title="Foundations/Colors" />

# Colors — Indigo Focus

Reference **semantic** tokens only (`bg-primary`, `text-success`, `bg-streak`). Never primitives or raw hex.

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
  {[
    ['background', '--color-background'],
    ['foreground', '--color-foreground'],
    ['primary', '--color-primary'],
    ['secondary', '--color-secondary'],
    ['muted', '--color-muted'],
    ['accent', '--color-accent'],
    ['success', '--color-success'],
    ['streak', '--color-streak'],
    ['warning', '--color-warning'],
    ['info', '--color-info'],
    ['destructive', '--color-destructive'],
    ['border', '--color-border'],
  ].map(([name, token]) => (
    <div key={name} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ height: 56, background: `var(${token})` }} />
      <div style={{ padding: 8, fontSize: 12, fontFamily: 'var(--font-sans)' }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <code style={{ color: 'var(--color-muted-foreground)' }}>{token}</code>
      </div>
    </div>
  ))}
</div>

Toggle the toolbar theme (light/dark) to preview both palettes.
```

- [ ] **Step 2: `Typography.mdx`**

```mdx
import { Meta } from '@storybook/addon-docs/blocks'

<Meta title="Foundations/Typography" />

# Typography

- **Heading / display:** Plus Jakarta Sans — `font-heading`
- **Body / reading:** Inter — `font-sans` (tabular figures for counters/timers)
- Base 16px · line-height 1.5–1.6 · headings 600–700 · body 400 · labels 500

<div style={{ fontFamily: 'var(--font-heading)' }}>
  <p style={{ fontSize: 36, fontWeight: 700, margin: '4px 0' }}>Учи слова каждый день</p>
  <p style={{ fontSize: 24, fontWeight: 600, margin: '4px 0' }}>resilient — устойчивый</p>
</div>
<p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: 1.6, maxWidth: '60ch' }}>
  She stayed resilient through every setback, turning each failure into a lesson.
</p>
<p style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>
  Стрик: 7 · К повторению: 24 · Выучено: 142
</p>
```

- [ ] **Step 3: `SpacingRadius.mdx`**

```mdx
import { Meta } from '@storybook/addon-docs/blocks'

<Meta title="Foundations/Spacing & Radius" />

# Spacing, Radius & Elevation

**Spacing** — Tailwind's 4px scale; section rhythm tiers `16 / 24 / 32 / 48`.

<div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
  {[4, 8, 12, 16, 24, 32, 48].map((n) => (
    <div key={n} style={{ textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: n, height: n, background: 'var(--color-primary)', borderRadius: 2 }} />
      {n}
    </div>
  ))}
</div>

**Radius** — `rounded-sm | md | lg | xl`

<div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
  {['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'].map((r) => (
    <div key={r} style={{ width: 72, height: 48, background: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: `var(${r})`, fontSize: 11, fontFamily: 'var(--font-sans)', display: 'grid', placeItems: 'center' }}>
      {r.replace('--radius-', '')}
    </div>
  ))}
</div>

**Elevation** — `shadow-xs | sm | md | lg`

<div style={{ display: 'flex', gap: 20, marginTop: 16, padding: 16 }}>
  {['--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg'].map((s) => (
    <div key={s} style={{ width: 72, height: 48, background: 'var(--color-card)', borderRadius: 8, boxShadow: `var(${s})`, fontSize: 11, fontFamily: 'var(--font-sans)', display: 'grid', placeItems: 'center' }}>
      {s.replace('--shadow-', '')}
    </div>
  ))}
</div>
```

- [ ] **Step 4: Verify the docs build**

Run: `pnpm --filter client build-storybook`
Expected: PASS — three Foundations pages index under "Foundations/…".

- [ ] **Step 5: Format + commit**

```bash
pnpm format
git add apps/client/.storybook/foundations
git commit -m "docs(client): Storybook Foundations (colors, typography, spacing)"
```

---

## Task 8: Playwright visual verification pass (the main visual gate)

Drive the running Storybook via the Playwright MCP browser; verify seeded components render correctly in **light + dark** at **375 / 768 / 1024 / 1440**, no console errors, focus/hover states work, capture screenshots, and confirm the a11y panel shows no critical violations.

**Files:** none (verification only). Produces screenshot evidence + a short findings note.

- [ ] **Step 1: Start Storybook in the background**

```bash
pnpm --filter client storybook --ci --quiet &
```

Wait until `http://localhost:6006` responds (poll with a short loop or the Monitor tool).

- [ ] **Step 2: Verify story iframe URLs load without console errors**

Using the Playwright MCP browser, navigate to each and check `browser_console_messages` is clean:
- `http://localhost:6006/iframe.html?id=ui-button--default`
- `http://localhost:6006/iframe.html?id=wordforge-wordcard--default`
- `http://localhost:6006/iframe.html?id=wordforge-statpill--streak`
- `http://localhost:6006/iframe.html?id=wordforge-themetoggle--default`
- `http://localhost:6006/iframe.html?id=ui-progress--midway`
- `http://localhost:6006/iframe.html?id=ui-dialog--default`

Expected: each renders; no red console errors.

- [ ] **Step 3: Light + dark at each breakpoint for the key components**

For `wordforge-wordcard--default` and `wordforge-statpill--streak`:
- append `&globals=theme:light` and `&globals=theme:dark` to the iframe URL to force each theme (addon-themes global),
- `browser_resize` to 375, 768, 1024, 1440 widths,
- `browser_take_screenshot` at each combination.

Expected: readable in both themes at every width; no clipped/overflowing content; tokens visibly differ light vs dark.

- [ ] **Step 4: Focus/hover states**

On `ui-button--default`: `browser_hover` the button and screenshot; `browser_press_key` Tab to move focus and screenshot the focus ring.
Expected: visible hover change and a visible focus ring (`outline-ring`).

- [ ] **Step 5: a11y check**

Open the Storybook UI (not the iframe) for `WordForge/WordCard` and `UI/Button`, open the **Accessibility** panel.
Expected: no **critical** (serious/critical) axe violations (contrast, labels, roles). Note any minor items.

- [ ] **Step 6: Stop Storybook and record findings**

Stop the background Storybook process. Summarize: components verified, screenshots captured, any a11y notes. No commit (verification only) unless a fix was needed — if a token/contrast fix is required, make it in `styles.css`, re-run the relevant step, and commit as `fix(client): …`.

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- §2.1 alias fix → Task 0 ✓
- §3 palette + §3.2 fonts + §3.3 radius/elevation/spacing → Task 1 ✓
- §4 three token layers → Task 1 ✓
- §5 primitive set → Task 3 ✓; WordCard → Task 4 ✓; StatPill → Task 5 ✓
- §6 ThemeStore/provider/toggle + graph wiring (common placement) → Task 6 ✓
- §7 Storybook config + addons + scripts → Task 2 ✓; conventions (CSF3, autodocs, colocated) → Tasks 3–6 ✓; Foundations docs → Task 7 ✓
- §7.1 keep Vitest, skip addon-vitest → Task 2 step 2 ✓
- §10 verification (unit test, storybook build, Playwright pass, a11y) → Tasks 6 + 8 ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; the primitive-story template lists explicit per-component variants (not "similar to").

**Type consistency:** `createThemeStore(deps)` / `ThemeStore` / `ThemeStoreDeps` / `useThemeStore` / `ThemeProvider` consistent across Task 6 store, provider, toggle, story, and composition-root. `AppGraph` extended consistently. `WordCardProps` / `StatPillProps` match their stories. Provider shape (`value` prop) matches the existing `SessionProvider`/`AuthServiceProvider`.
