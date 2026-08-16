# 04 — UI/UX Design Brief

**Project:** CA Practice Management Platform — Phase 1 (GST Module)
**Related docs:** `../design-references/client-portal/DESIGN.md` ("Fiscal Integrity"), `../design-references/admin-dashboard/DESIGN.md` ("Fiscal Precision")

This brief translates the two approved design systems into implementation guidance for the Angular admin app and the Angular client PWA. It is the **visual contract** — frontend work must match these tokens and patterns.

---

## 1. Two design systems, one brand

The platform ships two distinct design languages, both anchored on the same deep-navy institutional identity:

| | **Client Portal** | **Admin Dashboard** |
|---|---|---|
| Design name | **Fiscal Integrity** | **Fiscal Precision** |
| Style | Professional / Modern (Material 3-flavored) | Modern Corporate / fintech |
| Mood | Trustworthy, calm, approachable for non-technical clients | Calm efficiency, data-dense, "recedes to let data lead" |
| Primary surface | Mobile-first, bottom navigation | Desktop-first, fixed sidebar |
| Radius personality | Softer (cards up to 16px) | Tighter (max 8px structural) |

**Shared brand anchor:** Primary Navy `#12294D` (headers, primary actions) and Secondary Blue `#2C5AA0` (links, active states, focus). Both systems use **Inter** for everything, with `tabular-nums` for financial figures.

---

## 2. Client Portal tokens ("Fiscal Integrity")

Source: `../design-references/client-portal/DESIGN.md` and the Tailwind config embedded in each `code.html`.

### Colors
| Role | Hex |
|---|---|
| Primary (navy) | `#001433` (surface-tint `#4a5e86`) |
| Primary container | `#12294D` |
| On primary | `#ffffff` |
| Secondary | `#305EA4` |
| Secondary container | `#87B1FD` |
| On-secondary-container | `#064287` |
| Background / surface | `#f8f9fa` |
| Surface container-lowest | `#ffffff` |
| Surface variant | `#e1e3e4` |
| Outline variant | `#c4c6cf` |
| On-surface | `#191c1d` |
| On-surface-variant | `#44474e` |
| Error / on-error | `#ba1a1a` / `#ffffff` |
| Error container / on- | `#ffdad6` / `#93000a` |

**Status chip colors (client app):**
- Pending → soft amber bg (`amber-100`), dark amber text (`amber-800`)
- Received → soft emerald bg (`emerald-100`), dark green text (`emerald-800`)
- Report Ready → soft blue `#E8EDF5` bg, Secondary Blue `#2C5AA0` text

### Typography
Inter throughout. Key roles: display-lg 32/40 (700), headline-md 24/32 (600), headline-sm 20/28 (600), title-lg 18/24 (600), body-lg 16/24, body-md 14/20, label-lg 12/16 (600, +0.05em uppercase for table headers/metadata), label-md 11/16 (500).

### Shape & radius
- Cards & modals: `rounded-lg` 16px (16px = `rounded-xl` in the client config)
- Inputs & buttons: 8px
- Chips/status: pill (`rounded-full`)
- Bottom sheets: only top corners 16px

### Elevation
- Level 0: white / `#F8F9FA`
- Level 1 (cards): white + 1px border `#DDE2E8`, soft shadow `0 2px 8px rgba(18,41,77,.05)`
- Level 2 (FAB/active): navy with stronger shadow
- Scrim: 40% navy `#12294D` overlay

### Layout
- Mobile (0–599): 4-col grid, 16px side margins, 16px gutters, 8px vertical rhythm base
- Tablet (600+): 8-col grid, 32px side margins
- Card padding: 20px (`1.25rem`); spacing scale `stack-sm .5 / stack-md 1 / stack-lg 1.5`

### Key components
- **Bottom navigation:** fixed bottom bar, 4 items (Home, Documents, Reports, Profile), active item = tonal pill (`secondary-container` bg), icons + labels.
- **FAB:** navy (primary-container), "add" icon, rotates on hover.
- **Status chips:** pill, low-saturation bg + high-saturation text.
- **Top app bar:** hamburger, "GST Portal" title, notification bell, avatar with initials.

---

## 3. Admin Dashboard tokens ("Fiscal Precision")

Source: `../design-references/admin-dashboard/DESIGN.md` and embedded Tailwind configs.

### Colors
| Role | Hex |
|---|---|
| Primary | `#001433` |
| Primary container | `#12294D` |
| Secondary | `#305EA4` |
| Secondary container | `#87B1FD` |
| Background | `#f7f9fb` |
| Surface (cards/sidebar) | `#ffffff` (border `#e2e8f0`/`outline-variant #c4c6cf`) |
| On-surface | `#191c1e` |
| On-surface-variant | `#44474e` |
| Error | `#ba1a1a` |
| Error container | `#ffdad6` |

### Typography
Inter exclusively. headline-lg 24/32 (600) for page titles only; headline-md 20/28 (600); headline-sm 16/24 (600) for card titles; body-lg 16/24; body-md 14/20; body-sm 13/18; label-md 12/16 (600, +0.05em uppercase); numeric-data 14/20 (500) with **`font-variant-numeric: tabular-nums`** (mandatory for all figures).

### Shape & radius
- Containers/cards: 8px
- Buttons/inputs: 4px
- Status chips/badges: pill
- Rule: structural radii never exceed 8px (keeps the "precise" feel)

### Elevation
- Level 0: bg `#f7f9fb`
- Level 1: white cards + 1px border
- Level 2 (dropdowns/modals): white + `0 4px 12px rgba(0,0,0,.05)` + 1px border
- Interactive rows: no shadow — background shift to `#F1F5F9` on hover

### Layout
- Fixed-fluid hybrid: sidebar 240px expanded / 64px collapsed (icons); content fluid 12-col
- Desktop 1280+: sidebar visible, 24px margins, 16px gutters
- Tablet 768–1279: sidebar icons-only, 16px margins
- Mobile <768: sidebar hidden (hamburger), cards stack, 12px margins
- 4px spacing scale; cards `lg` 24px padding for summaries, `md` 16px for tables

### Key components
- **Data tables:** header `#F8FAFC`, bold uppercase labels, 1px bottom border; rows min 48px height, 1px bottom border `#E2E8F0`, hover `#F1F5F9`; text left-aligned, currency/numbers right-aligned + tabular.
- **Buttons:** Primary navy solid; Secondary white + navy 1px border; Ghost text-only (Cancel).
- **Inputs:** 1px border `#E2E8F0`, 4px radius, white bg; focus border `#2C5AA0` + soft blue ring; errors red border + helper icon.
- **Status chips:** pill, low-saturation bg / high-saturation text (green = completed/success, grey = sent, red = pending review, blue = completed).
- **KPI summary cards:** headline-sm title, large numeric value (headline-lg), small trend chip (e.g. `trending_up +12% this quarter`).

---

## 4. Shared implementation rules

1. **Fonts:** Load Inter via Google Fonts (weights 400/500/600/700). Use `font-variant-numeric: tabular-nums` on every numeric value, table, and KPI.
2. **Icons:** Material Symbols Outlined, variation `'FILL' 0` default, `'FILL' 1` for active/selected states.
3. **Dark mode:** not in Phase 1 scope; both systems ship light-only.
4. **Accessibility:** WCAG-AA contrast for text on its background; focus rings using Secondary Blue; keyboard-navigable tables/filters; form labels on inputs (Material 3 outlined label-on-border).
5. **Responsiveness:** client app is mobile-first (desktop acceptable but must keep the bottom-nav pattern); admin app is desktop-first with a working tablet/mobile collapse.
6. **Consistency:** reuse the exact status-chip color semantics below — never invent new colors for states.

### Canonical status semantics (both apps)
| Status | Chip colors |
|---|---|
| Pending | amber bg / dark amber text |
| Received | emerald bg / dark green text |
| Processed / Completed | soft blue `#E8EDF5`/`#d3e4fe` bg, `#2C5AA0`/`#0e458a` text |
| Report Ready | soft blue bg, secondary blue text |
| Sent (neutral) | grey bg `#f2f4f6`, `#44474e` text |
| Error / Action required | red container bg `#ffdad6`, `#93000a` text |

## 5. Screen checklist (implementation target)

- **Client PWA** (mobile-first): Login, Dashboard, Upload Documents, Document Status, Filing Reports, Notifications, Profile — each with the components listed in §2.
- **Admin app** (desktop-first): Login, Overview, Clients List, Client Detail, Send Report (modal), Documents, Reports, Reminders, Staff & Permissions, Audit Logs, Settings — each with the components in §3.

Mockups to replicate 1:1: `../design-references/client-portal/*/code.html` and `../design-references/admin-dashboard/*/code.html`.