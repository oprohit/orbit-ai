# ORBIT AI — Design System

Premium, calm, focused. Inspired by modern AI command centers (Gumloop / Linear /
Raycast-class density) — an original identity, no brand copying.
Not a chatbot UI. Not an admin dashboard. An **operating system for your digital life.**

## Palette

| Token | Hex | Use |
|---|---|---|
| bg | `#0B0B1E` | page background |
| surface | `#12122B` | panels, cards |
| surface-2 | `#181838` | raised, hover |
| line | `rgba(160,160,220,.14)` | hairline borders (1px) |
| text | `#ECEBFA` | primary text |
| muted | `#8F8FB4` | secondary text |
| faint | `#5D5D85` | captions, timestamps |
| accent | `#7C6CFF` | primary action, focus, links |
| accent-soft | `rgba(124,108,255,.14)` | tints, selection |
| ok | `#3DDC97` | success, connected, low risk |
| warn | `#FFB84D` | ask/approval, medium risk |
| danger | `#FF5C7A` | critical, blocked, failed |
| info | `#4DC4FF` | info, read-only |

Glow: `0 0 24px rgba(124,108,255,.25)` on primary buttons & active states — subtle, never neon.

## Typography

- **Space Grotesk** — display, headings, numerals (tabular for data).
- **Instrument Sans** — body / UI copy.
- **JetBrains Mono** — audit ledger, tool ids, parameters, timestamps.

Scale: 11px captions (uppercase, tracked) · 13px UI · 14px body · 16–18px card titles · 22–26px page titles.
Dense but readable: 12–16px padding in cards, 4–8px chips, 12px radius.

## Components

- **Card** — `surface` bg, 1px line border, 12px radius, 14/18px padding. No shadows except glow accents.
- **Status dot** — 6px: ok/warn/danger/info/faint with soft pulse for "live" states.
- **Risk badge** — LOW (ok) · MEDIUM (info) · HIGH (warn) · CRITICAL (danger); monospace label.
- **Button** — primary (accent, glow), ghost (line border), danger; 32–36px height, 12px radius.
- **Approval card** — left risk rail (2px colored), params in monospace table, Approve/Edit/Deny.
- **Progress** — 4px track (surface-2), accent fill, numeric label in Space Grotesk.
- **Timeline (audit)** — monospace timestamp rail, colored authorization chips, immutable.

## Motion

- 120–180ms ease-out on hover/press; 200ms fade+4px rise for new chat messages and cards.
- Status dot pulse (2.4s) only for live/pending states.
- No layout animation libraries; CSS transitions only. Respect `prefers-reduced-motion`.

## Layout

- **Desktop**: 232px sidebar (grouped nav) + content column max-w 1240px, 24px gutters.
- **Home = Command Center**: chat primary (left 58–62%) + context rail (right) — Today,
  important emails, pending approvals, active goals. Quick-action chips above input.
- **Mobile**: top bar + bottom tab bar (Home · Tasks · Goals · Approvals · More). Chat stays
  the primary action surface.
- **Demo mode**: permanent small badge in sidebar + banners where simulated data is shown.
  We never claim a simulated connector is live.
