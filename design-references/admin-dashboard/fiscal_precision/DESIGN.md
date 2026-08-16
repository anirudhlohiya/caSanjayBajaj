---
name: Fiscal Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#4a5e86'
  primary: '#001433'
  on-primary: '#ffffff'
  primary-container: '#12294d'
  on-primary-container: '#7c91bb'
  inverse-primary: '#b2c7f3'
  secondary: '#305ea4'
  on-secondary: '#ffffff'
  secondary-container: '#87b1fd'
  on-secondary-container: '#064287'
  tertiary: '#041528'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a2a3e'
  on-tertiary-container: '#8191a9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#b2c7f3'
  on-primary-fixed: '#011b3e'
  on-primary-fixed-variant: '#32476c'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#abc7ff'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#0e458a'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

This design system is engineered for high-density financial data management, emphasizing reliability, clarity, and institutional trust. The visual language follows a **Modern Corporate** aesthetic—a refined evolution of traditional fintech interfaces that prioritizes utility over decoration.

The system utilizes a structured, card-based architecture to organize complex accounting workflows into digestible modules. High whitespace ratios prevent cognitive overload during prolonged usage, while a disciplined application of the brand's navy palette reinforces a sense of professional authority. The emotional response is one of "calm efficiency"—the UI should feel like a high-performance tool that recedes into the background to let the data lead.

## Colors

The palette is anchored by **Primary Navy Blue**, used for core navigation and high-level structural elements to ground the interface. **Secondary Soft Blue** serves as the primary action color for buttons, active states, and focus indicators.

Functional colors are critical for accounting:
- **Neutral Grey (#F8FAFC)**: Used exclusively for the application background to create separation from white content cards.
- **Success/Error**: Standardized green and red for balance sheets, credit/debit indicators, and system status.
- **Borders (#E2E8F0)**: A low-contrast grey used for table dividers and card strokes to maintain structure without visual noise.

## Typography

The design system utilizes **Inter** exclusively for its exceptional legibility in data-heavy environments. The typeface is optimized for small-scale clarity, particularly in large tables and financial reports.

**Key Rules:**
- **Tabular Figures**: For all financial values, `font-variant-numeric: tabular-nums` must be enabled to ensure decimal points and digits align vertically in tables.
- **Hierarchy**: Use `headline-lg` only for page titles. Dashboards should primarily use `headline-sm` for card titles to maximize vertical density.
- **Labels**: Small uppercase labels are used for table headers and section grouping in the sidebar.

## Layout & Spacing

This design system employs a **Fixed-Fluid Hybrid Grid**. The sidebar navigation is fixed (240px expanded / 64px collapsed), while the main content area utilizes a fluid 12-column grid.

**Breakpoints:**
- **Desktop (1280px+):** Sidebar remains visible; 24px page margins; 16px gutters.
- **Tablet (768px - 1279px):** Sidebar collapses to icons only; 16px page margins.
- **Mobile (<768px):** Sidebar hidden (hamburger menu toggle); cards stack vertically; 12px page margins.

A strict 4px spacing scale is used to ensure mathematical harmony between elements. Content should be grouped into cards with `lg` (24px) padding for summaries and `md` (16px) padding for data tables to maintain a dense but readable information flow.

## Elevation & Depth

To maintain a "Professional Fintech" feel, this design system avoids heavy shadows. Depth is communicated through **Tonal Layering** and **Subtle Outlines**:

- **Level 0 (Background):** Neutral Grey (#F8FAFC).
- **Level 1 (Cards/Sidebar):** White (#FFFFFF) with a 1px border (#E2E8F0).
- **Level 2 (Dropdowns/Modals):** White (#FFFFFF) with a soft, diffused shadow (0px 4px 12px rgba(0, 0, 0, 0.05)) and 1px border.

Interactive rows (tables/lists) do not use shadows on hover; instead, they utilize a background color shift to `#F1F5F9` to indicate focus without disrupting the page's vertical rhythm.

## Shapes

The design system adopts a **Soft** shape language to balance professional rigors with modern UI sensibilities. 

- **Containers & Cards:** 0.5rem (8px) corner radius.
- **Buttons & Inputs:** 0.25rem (4px) corner radius.
- **Status Badges/Chips:** 1rem (Pill-shaped) to distinguish them from interactive buttons.

Sharp corners are avoided to prevent the UI from appearing dated, but radii never exceed 8px for structural elements to maintain a serious, "precise" aesthetic.

## Components

### Buttons
- **Primary:** Navy Blue background, white text. No gradient.
- **Secondary:** White background, Navy Blue border (1px), Navy Blue text.
- **Ghost:** No border or background; text only. Used for "Cancel" or less frequent actions.

### Data Tables
- **Header:** Light grey background (#F8FAFC), bold labels, 1px bottom border.
- **Rows:** 48px minimum height, subtle 1px bottom border (#E2E8F0), `#F1F5F9` hover state.
- **Alignment:** Text data is left-aligned; currency and numerical data are right-aligned.

### Input Fields
- **Default State:** 1px border (#E2E8F0), 4px radius, white background.
- **Focus State:** 1px border (#2C5AA0) with a 2px soft blue outer glow (ring).
- **Validation:** Error states must include both a red border and a supporting helper icon for accessibility.

### Status Chips
- Small, pill-shaped indicators for "Paid", "Pending", "Overdue". Use low-saturation background tints with high-saturation text (e.g., Light Green background with Dark Green text).

### Summary Widgets (Cards)
- Used at the top of dashboards to show KPIs. Must include a `headline-sm` title, a large numerical value, and a small trend indicator (percentage increase/decrease).