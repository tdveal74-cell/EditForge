# EditForge Flagship Spec — AAA

The design contract for every surface in the Studio OS. Same AAA tokens as Meta Supreme.
Restraint is house law: the spec exists so nothing has to be decided twice — and nothing
gets louder over time.

**Viewport rule:** Chromebook-first · native resolution · fluid upward scale.  
AAA is the entry standard. Studio monitoring (dual 5K, etc.) is the upward path for color/editorial suites — not a requirement to open the product.

---

## 0. Viewport & resolution (entry standard)

**Primary experience is optimized for the current HP Chromebook viewport first**, then scales upward automatically.

| Rule | Requirement |
|------|-------------|
| Entry device | HP Chromebook-class (compact laptop / convertible) |
| Rendering | Device native resolution and pixel density |
| Canvas | **No fixed canvas** — layout is fluid |
| Scaling | Automatic upward to larger / higher-DPI displays and suite monitors |
| Sharpness | **No blur** — respect `devicePixelRatio`; no forced 1× bitmap stretch |
| Screen use | **No wasted screen** — content and chrome use the available viewport efficiently |
| Quality bar | **AAA is the entry standard** — not a progressive enhancement after a degraded base |

Implementation implications:

- Use relative units, fluid grids, and container queries where useful.
- Prefer CSS that paints crisply at the device DPR (vector icons, `rem`/`em`, SVG, or properly generated high-DPI assets).
- Avoid fixed-pixel artboards or “design at 1440 then scale down.”
- Test and ship the Chromebook-class viewport as the primary experience; larger displays and suite monitors receive the same AAA quality with more space, not a different product.
- Color/editorial monitoring floors (e.g. dual 27″ 5K) remain valid for *suite* work; they do not redefine the entry UI bar.

---

## 1. Color

| Token | Hex | Role |
|-------|-----|------|
| `navy` | `#0A1628` | Ink. All primary text and primary actions. |
| `navy-900` | `#060D1A` | Deepest wells (rare). |
| `navy-800` | `#0F1C30` | Primary hover. |
| `navy-700` | `#16263E` | Raised dark surfaces. |
| `navy-600` | `#1F3252` | Secondary dark. |
| `navy-500` | `#2B4066` | Muted dark accents. |
| `amber` | `#D4A017` | The accent. Active indicators, focus rings, the one highlight per view. |
| `amber-600` | `#B8890F` | Amber hover / eyebrow text (AA on paper surfaces). |
| `amber-700` | `#96700C` | Amber text on light chips. |
| `amber-50` | `#FBF3DC` | Amber wash for AI-media chips only. |
| `surface` | `#F8F5F0` | Page paper. |
| `surface-elevated` | `#FFFFFF` | Cards, nav, anything raised. |
| `surface-muted` | `#F0EBE3` | Chips, quiet fills. |
| `surface-sunken` | `#EDE7DD` | Wells, inset areas. |
| `border` | `#E5DFD5` | Default hairline. |
| `border-faint` | `#EFEAE1` | Sub-dividers inside cards. |
| `border-strong` | `#D4CBBC` | Hover borders, emphasis hairlines. |

**Amber law.** Amber appears at most once per view as a fill (an accent button *or* an
active indicator *or* an AI-media chip family) plus the focus ring. Two amber fills
competing in one viewport is a spec violation.

**Text opacity ramp** (on paper): `text-navy` primary · `/70–/75` body · `/60–/65`
secondary · `/45` labels/eyebrows · `/40` metadata floor. Nothing readable below `/40`.

---

## 2. Type

System sans stack (self-contained, no webfont dependency). Scale:

| Step | Size | Use |
|------|------|-----|
| Display | `text-4xl`–`text-5xl` semibold, tracking-tight | Home hero only |
| H1 | `text-3xl` semibold, tracking-tight | Page titles |
| Section | `text-xs` medium, uppercase, tracking `0.15em`, `navy/45` | Section labels |
| Eyebrow | `text-xs` medium, uppercase, tracking `0.2–0.24em`, `amber-600` | Page eyebrows |
| Body | `text-sm`–`text-[15px]`, leading-relaxed | Prose |
| Detail | `text-xs` | Card metadata |
| Micro | `text-[10px]`–`text-[11px]` uppercase, tracking-wide | Badges, footers |

Numbers in data contexts are always `tabular-nums`.
Type remains legible and crisp at Chromebook-class sizes; scale upward with viewport, never down into blur.

---

## 3. Space, radius, elevation

- Layout: fluid first for Chromebook-class; `max-w-6xl` shell, `max-w-4xl`–`max-w-5xl` content, `px-6` gutters on larger screens. No fixed artboard.
- Radius: `card 0.75rem` · `control 0.5rem` · `pill 999px`. Nothing else.
- Elevation (two steps only):
  - `shadow-card` — resting cards.
  - `shadow-lifted` — hover/active emphasis, paired with `-translate-y-0.5`.
- Hairlines do hierarchy; shadows do affordance. Never both loudly.

---

## 4. Motion

| Token | Duration | Use |
|-------|----------|-----|
| `swift` | 120ms | Color/opacity micro-changes |
| `flagship` | 180ms | Default — hovers, lifts |
| `stately` | 240ms | Panels, larger reveals |

Easing: `ease-flagship` = `cubic-bezier(0.2, 0, 0, 1)`. No bounces, no springs, nothing
over 240ms. `prefers-reduced-motion` collapses all motion — implemented globally in
`globals.css`, not per component.

---

## 5. Interaction states

Every interactive element defines all five: rest · hover (color/border + optional lift) ·
active (`translate-y-px`) · focus-visible (2px amber outline, 2px offset — global) ·
disabled (`opacity-45`, no pointer events). Missing states are bugs, not polish debt.

---

## 6. Components

- **Button** (`components/ui/button.tsx`) — `primary | secondary | ghost | accent`,
  sizes `sm | md | lg`. `accent` obeys the amber law.
- **Card** (`components/ui/card.tsx`) — elevated surface; `interactive` adds lift.
- **Badge** (`components/ui/badge.tsx`) — `neutral | outline | accent | quiet`.
  Status mapping: operational→neutral, bridge→outline, ai-media→accent, planner→quiet.
- **PageHeader** (`components/PageHeader.tsx`) — eyebrow/title/description/actions.
  Every page uses it; ad-hoc headers are a violation.

---

## 7. Accessibility floor

WCAG 2.2 AA. Specifically: global `:focus-visible` ring; skip-to-content link in layout;
`aria-current="page"` on active nav; landmarks (`header`/`main`/`footer`); text contrast
per the opacity ramp; amber-as-text only in `amber-600`/`amber-700` weights on light
surfaces; reduced-motion honored globally. Targets sized for Chromebook touch/trackpad use.

---

## 8. Honesty marks

Simulated output is always labeled — mock/AI marks on generated media, "plan" vocabulary
for plan-only APIs, no UI that implies a live render when the provider is mocked. The UI
never claims more than `REPOSITORY_STATUS.md` does.

---

## 9. Quality gates

- CI: install · typecheck · test · build must pass (`.github/workflows/ci.yml`).
- Rubric pass recorded before master export — the gate is code, not convention.
- New surfaces ship on the primitives above; a new one-off style needs a spec change
  in this file first.
- Primary experience verified on Chromebook-class viewport at native DPR (no blur, no fixed canvas, no wasted screen).
- Fluid upward scale confirmed on larger / higher-DPI displays and suite monitors.

Hardware reference: `docs/HARDWARE.md` · Department map: `docs/STUDIO_OS.md`
