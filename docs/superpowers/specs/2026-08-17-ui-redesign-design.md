# OmniLog UI/UX Redesign — Design Spec

**Date:** 2026-08-17
**Status:** Approved, pending implementation plan
**Scope:** Presentation layer only. No changes to parsers, worker, aggregation, or IndexedDB.

---

## 1. Goal and Direction

Make OmniLog visually distinctive and deliberate rather than templated. The current UI is
stock Bootstrap 5.3 dark theme with ad-hoc inline styles; the goal is a coherent design
system that reads as an intentionally designed instrument.

**Chosen direction: precision instrument.** Restrained near-monochrome surfaces, one accent
hue used sparingly, tight grid, confident typography, data-forward. Reference points:
Linear, Vercel dashboards.

**Governing rule:** *color means something*. If a color is not encoding severity, HTTP
status, or interactivity, it is a neutral. This single rule eliminates most of what
currently reads as generated.

**Depth:** re-skin plus layout and hierarchy restructure. Same features, same routes.

**Theme:** dark only. No light theme. `index.html` hardcodes `data-bs-theme="dark"` and a
dark body background; adding a light theme is out of scope.

### Diagnosis — what specifically reads as "vibe coded"

1. No typographic identity. No webfont is loaded. `main.scss:13` declares
   `$font-family-monospace: 'JetBrains Mono', ...` but nothing fetches it, so log rows fall
   back to Consolas and body text is the OS default.
2. The semantic rainbow. `StatCards.tsx:20-45` places `text-primary`, `text-success`,
   `text-danger`, `text-info` in four adjacent cards. `LandingView.tsx:3-28` repeats the
   pattern. `Charts.tsx:188-191` and `231-237` hardcode seven raw Bootstrap hexes.
3. Stock Bootstrap blue `#0d6efd` as the accent — which matches neither end of the brand
   mark's `#58a6ff → #a371f7` gradient in `public/favicon.svg`.
4. Magic numbers instead of a scale: inline `fontSize` values of
   `0.7 / 0.75 / 0.8 / 0.85 / 0.875 / 0.9 / 1.1 / 1.3rem` scattered across files, plus
   `#161b22` hardcoded inline twice in `LandingView.tsx` when `$card-bg` exists.
5. An icon on nearly every label, including labels that read fine without one.
6. Flat surfaces — one border color, one card color, no elevation, so nothing has hierarchy.
7. Mismatched chart heights (`180 / 200 / 180 / 160`) leave cards in the same grid row
   bottoming out unevenly.
8. Decorative column color in `VirtualLogTable.tsx:243-246` — IP is `text-info`, method is
   `text-warning`, encoding nothing.

---

## 2. Technical Approach

**Token layer plus custom primitives; Bootstrap retained for layout.**

Keep Bootstrap's reset, grid (`row` / `col-*`), and neutral layout utilities (`d-flex`,
`gap-*`, `overflow-*`). These are not the problem. Replace Bootstrap's *opinionated*
component classes (`card`, `badge`, `btn`, `nav-tabs`, `table-dark`) with a small set of
`.ol-*` primitives that consume tokens.

Rejected alternatives:

- *SCSS variable overrides only* — recoloring `.badge` still leaves a Bootstrap badge with
  the same radius, padding ratio, and weight. Reaches roughly 40% of the goal and supports
  no layout restructure.
- *Remove Bootstrap entirely* — rewrites all 15 components at once including the virtual
  table, for a payoff mostly invisible next to the chosen approach.

### File structure

| File | Responsibility |
|---|---|
| `src/assets/_tokens.scss` | SCSS maps for color/type/space/radius; feeds Bootstrap overrides **and** emits `--ol-*` custom properties. Single source of truth — no hex literal exists outside this file. |
| `src/assets/_primitives.scss` | `.ol-panel`, `.ol-grid`, `.ol-stat`, `.ol-chip`, `.ol-btn`, `.ol-tabs`, `.ol-toolbar`. ~200 lines. |
| `src/assets/main.scss` | Imports tokens → Bootstrap → primitives → remaining app styles. Bootstrap variable overrides must stay above the `@import 'bootstrap/scss/bootstrap'` line. |
| `src/components/icons.tsx` | ~18 inline React SVG icon components. |
| `src/components/layout/Footer.tsx` | New. Carries About / Contact / Privacy / Terms. |

---

## 3. Color

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--ol-bg` | `#0a0c10` | page base (was `#0d1117`) |
| `--ol-surface-1` | `#12151b` | cards, panels |
| `--ol-surface-2` | `#181c24` | hover, raised, table header, toolbar |
| `--ol-border-subtle` | `#1e232c` | table row dividers, hairline grid |
| `--ol-border` | `#2a313c` | card and input borders |
| `--ol-border-strong` | `#3a434f` | focus rings, active tab |

The base drops darker than the current `#0d1117` specifically to give surfaces somewhere to
lift to. Two flat steps become four.

### Text

| Token | Value | Contrast on `--ol-surface-1` |
|---|---|---|
| `--ol-text` | `#e8ecf2` | ~15.9:1 |
| `--ol-text-dim` | `#98a2b0` | 7.15:1 |
| `--ol-text-faint` | `#616b7a` | 3.41:1 |

`--ol-text-faint` does **not** meet WCAG AA for normal text. It is restricted to
non-essential metadata that is duplicated or inferable elsewhere (e.g. row ordinals). It
must never carry the only copy of a piece of information. This is a hard constraint on
implementation, not a suggestion.

### Accent

`--ol-accent: #58a6ff`, taken from the light end of the brand mark's gradient. Contrast on
`--ol-bg` is 7.75:1.

Used **only** for interactive and selected state: focused input, active tab, links, drop
target. Never decorative.

`--ol-accent-alt: #a371f7` (the mark's dark end) is reserved for exactly two uses: the logo
gradient, and `FATAL` severity.

### Severity ramp

A temperature ramp that reads as ordered, replacing six unrelated hues. Cool colors recede,
warm colors advance.

| Level | Token value | Contrast on `--ol-surface-1` |
|---|---|---|
| `TRACE` | `#78838f` | 4.81:1 |
| `DEBUG` | `#8b95a3` | 6.10:1 |
| `INFO` | `#6e9fd4` | 6.66:1 |
| `WARN` | `#d9a441` | 8.21:1 |
| `ERROR` | `#e5534b` | 4.99:1 |
| `FATAL` | `#a371f7` | 5.51:1 |

> **Correction from the reviewed design.** `TRACE` and `DEBUG` were originally specified as
> `#5c6675` (3.17:1) and `#7a8695` (4.98:1). `#5c6675` fails WCAG AA for normal text at
> 3.17:1, which is not acceptable for a severity label — the one column in the table that
> exists to be read at a glance. Both were lightened; `DEBUG` moved up in step to keep the
> ramp's luminance ordering intact. The ramp still reads cool-to-warm as designed.

Every value above meets WCAG AA (4.5:1) for normal text on `--ol-surface-1`.

### HTTP status

`2xx #3fb950` (7.20:1) · `3xx #6e9fd4` (6.66:1) · `4xx #d9a441` (8.21:1) ·
`5xx #e5534b` (4.99:1) — all on `--ol-surface-1`.

### Saturation scales inversely with area

A 4px legend swatch and a 300px-wide bar must not use the same value. Every semantic color
ships as a pair:

- `--ol-sev-error` — full saturation, for text, icons, small indicators
- `--ol-sev-error-fill` — approximately 55% saturation, for chart fills and large areas

This is the specific mechanism that makes charts read as designed rather than generated, and
it is why `Charts.tsx` must never select a raw hex again.

### Stat cards go monochrome

`StatCards.tsx` currently renders four differently-colored icons in four adjacent boxes. New
treatment: no icon; label in `--ol-text-faint` at small caps; value large in tabular
numerals as the hero. The only card that may take color is Errors/Fatal, and only when the
count is non-zero.

---

## 4. Typography

### Families

- **Inter Variable** (`@fontsource-variable/inter`, latin subset, ~34 KB woff2) — all UI and
  prose. One file covers weights 400–700.
- **JetBrains Mono Variable** (latin subset, ~28 KB woff2) — log lines, IPs, timestamps, and
  raw text in the log table only.

**Monospace is not for numbers.** Inter has real tabular figures; stat values, counts, and
percentages use Inter with `font-variant-numeric: tabular-nums`. Using monospace to align
numerals is what makes dashboards accidentally look like terminals. Mono is used only where
the content genuinely is machine output.

**Dependency note:** `@fontsource/inter` remains a **devDependency** because
`scripts/prerender.mjs:26` needs static TTFs for satori, which cannot consume variable
fonts. The app takes `@fontsource-variable/inter` as a runtime dependency. This duplicates
in `node_modules` only, never in the shipped bundle.

### Scale

| Token | Size | Use |
|---|---|---|
| `--ol-fs-2xs` | 11px | badges, table meta |
| `--ol-fs-xs` | 12px | labels, captions |
| `--ol-fs-sm` | 13px | table body, dense UI |
| `--ol-fs-base` | 14px | app default |
| `--ol-fs-md` | 16px | marketing body |
| `--ol-fs-lg` | 18px | section leads |
| `--ol-fs-xl` | 22px | section headings |
| `--ol-fs-2xl` | 28px | page titles |
| `--ol-fs-3xl` | `clamp(2rem, 4.5vw, 3rem)` | hero |

### Weight, tracking, measure

- **Weights collapse to 400 / 500 / 600.** 700 survives only in the wordmark and the hero.
- **Optical tracking:** `-0.021em` at `2xl` and `3xl`; `+0.06em` on small uppercase labels.
  Untracked large type is why generated headings look slightly inflated.
- **`text-wrap: balance` on headings.** `LandingView.tsx:60` hard-codes a `<br />` to force a
  two-line hero break, which fails at other viewport widths. `text-wrap: pretty` on
  paragraphs.
- **Measure caps at ~68ch** via token, replacing the repeated inline `maxWidth: 560`.
- **Line-height by role:** 1.15 headings · 1.5 UI · 1.7 marketing prose · 1.45 table rows.

---

## 5. Layout Restructure

### The unifying move: hairline grids

Every grouping in the app is currently "floating boxes with borders" — feature cards, stat
cards, chart cards, step cards. One visual device repeated across four sections.

Replace most of them with a **hairline grid**: cells sharing single-pixel dividers inside
one bordered container, like a spec sheet or instrument panel. Denser, calmer, and the
single strongest move away from reading as Bootstrap.

Floating cards survive only where a thing genuinely is independent — the charts.

### Landing page

Container widens `900 → 1120`, and **section widths vary**: prose locks to ~620px, grids run
full width. Uniform section width is what currently makes the page feel monotonous.

- **Hero and dropzone become one composed unit.** Hero keeps center alignment, drops the
  hard `<br />`, and sits directly on the dropzone rather than being separated from it by a
  440px fixed-height box.
- **Dropzone loses three of five message layers.** It currently stacks: icon (3.5rem) →
  heading → "or browse" → five format badges → two lines of fine print → three more
  icon+label pairs beneath. New version: **icon (2rem) → one instruction → one sub-line**,
  in a calm panel — hairline border at rest, accent border plus subtle tint on drag.
  Everything evicted collapses into one quiet strip below:
  `Zero egress · Auto-detects format · 100 GB+ files · No account`. One line replaces
  eleven elements.
- **Feature grid → hairline 4-cell strip.** No per-card borders, no colored icons. Small
  caps label, one-line title, body in `--ol-text-dim`.
- **Supported formats stays a table** — it genuinely is tabular data. Restyled with hairline
  rows, format names in mono, no `table-dark`.
- **How It Works** loses its three cards and colored numbers; becomes a horizontal sequence
  with muted ordinals and hairline connectors.

### Dashboard

- **Date filter becomes a sticky toolbar** — `--ol-surface-2`, bottom hairline, pinned. It
  is currently a control competing with data at equal weight in the same scroll region.
- **Stat cards → one bordered strip of four cells** with hairline dividers, monochrome per
  §3.
- **Charts keep card treatment, with normalised heights.** Row one: time series (`col-lg-8`)
  and status donut (`col-lg-4`), both `220px`. Row two: top IPs and severity, both `200px`.
  Chart titles lose icons. The granularity toggle becomes a quiet segmented control instead
  of `btn-primary` / `btn-outline-secondary`.

### Log table

- Header row goes `--ol-surface-2` with small-caps tracked labels, and **sticks** on scroll.
- **IP and method columns lose their colors.** Severity is the only column that takes a hue,
  because it is the only column where color carries information. IP and timestamp go mono.
- Row separation moves from `border-secondary border-opacity-25` to a true hairline. Hover
  lifts to `--ol-surface-2` rather than a translucent white wash.

### Chrome

- **Navbar becomes tool-only:** wordmark, live analysis state (filename, format chip,
  progress), reset. Hairline bottom border; wordmark tracked tighter.
- **New footer** carrying About / Contact / Privacy / Terms, on the landing and static
  pages.

**Accepted tradeoff:** because the dashboard is a full-height `overflow: hidden` region, the
footer is not visible while an analysis is open, so legal links are unreachable in that
state. This was explicitly accepted in favour of an uncluttered navbar.

**Implementation note:** the landing page's scroll container is
`flex-grow-1 overflow-auto` under a global `html, body, #root { overflow: hidden }`. The
footer must be placed *inside* that scroll container, not as a sibling, or it will be
clipped.

---

## 6. Icons

Replace the full Bootstrap Icons font — approximately 120 KB woff2 plus its stylesheet,
imported eagerly at `main.tsx:5` — with inline React SVG components in
`src/components/icons.tsx`. 33 distinct glyphs are currently used; roughly 18 survive after
decorative ones are cut. Estimated ~4 KB, tree-shakeable, no additional request.

Delete `public/icons.svg`. It is dead weight containing bluesky/discord/github/documentation
symbols with a hardcoded `#aa3bff` purple, from an unrelated project; nothing in `src/`
references it.

Remove `bootstrap-icons` from dependencies and from `optimizeDeps.exclude` in
`vite.config.ts`.

---

## 7. Chart Color Bridge

`Charts.tsx` needs the palette as JS values. Hardcoding hex there re-creates the duplication
being removed, and a shared TS constants module risks being pulled into the eager chunk if
anything else ever imports it.

**Approach:** a `useChartTokens()` hook that reads the custom properties via
`getComputedStyle(document.documentElement)` inside a `useMemo`, with a hardcoded fallback
object used when a property resolves empty.

The fallback is required, not defensive: `src/entry-server.tsx` prerenders routes with no
DOM, so an unguarded `getComputedStyle` would throw during `scripts/prerender.mjs`.

The hook must live in `Charts.tsx`'s own module graph so it stays inside the async chunk.

---

## 8. Delivery

Nine phases, grouped into **three commits** on a feature branch. Each phase leaves the app
working and buildable.

**Commit 1 — Foundation**
1. Tokens, fonts, `main.scss` foundation. No component edits; site renders with shifted colors.
2. Primitives.

**Commit 2 — Surfaces**
3. Chrome — navbar slims to tool-only, new `Footer` component.
4. Landing — hero, dropzone, feature grid, formats table, steps.
5. Dashboard — sticky toolbar, stat strip, chart normalisation, token bridge.
6. Log table.
7. Static pages (About, Contact, Privacy, Terms).

**Commit 3 — Cleanup**
8. Icon sprite migration; drop `bootstrap-icons`; delete `public/icons.svg`.
9. Verification.

---

## 9. Verification

Run at the end of each phase:

- `npx tsc --noEmit`
- `npm run build` — must succeed **including** the prerender step
- `grep modulepreload dist/index.html` — must list **only** the runtime, react, virtual, and
  idb vendor chunks. Per `CLAUDE.md`, this is the constraint most likely to regress
  silently: a font import or a shared theme module placed in the wrong module graph is
  exactly how chart.js gets dragged into the eager chunk.
- Bundle size recorded before and after. A net **reduction** is expected despite adding two
  fonts, because the Bootstrap Icons font alone outweighs them.
- Contrast re-verified in-browser for every token pair that carries text, against the ratios
  recorded in §3.
- Visual check of every route via `npm run dev`: `/`, `/about`, `/contact`, `/privacy`,
  `/terms`, plus the three analytics states (idle, parsing, loaded) and both tabs.

---

## 10. Non-Goals

- No light theme.
- No changes to parsers, the worker, aggregation, IndexedDB, or any data path.
- No new routes or pages.
- No changes to feature set or functionality.
- No network calls added. Fonts are self-hosted; the zero-egress CSP in `public/_headers`
  is not modified or broadened.
