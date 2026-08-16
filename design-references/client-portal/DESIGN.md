---
name: Fiscal Integrity
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474e'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
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
  tertiary: '#10161b'
  on-tertiary: '#ffffff'
  tertiary-container: '#242a30'
  on-tertiary-container: '#8b9198'
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
  tertiary-fixed: '#dee3eb'
  tertiary-fixed-dim: '#c2c7cf'
  on-tertiary-fixed: '#171c22'
  on-tertiary-fixed-variant: '#42474e'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
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
  label-lg:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 1rem
  margin-tablet: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
  container-padding: 1.25rem
---

## Brand & Style

This design system is engineered for high-stakes financial environments where clarity and security are paramount. The aesthetic follows a **Professional / Modern** philosophy, blending the systematic rigor of Material Design 3 with a refined, boutique financial services feel. 

The interface prioritizes information density and document management without sacrificing legibility. Every element is designed to evoke a sense of stability, precision, and institutional trust. Whitespace is used strategically to separate complex data sets, ensuring that the client feels in control of their financial narrative.

## Colors

The palette is anchored by deep Navy Blue to represent authority and longevity. 

- **Primary (#12294D):** Used for headers, primary actions, and high-level navigation. It provides the "weight" necessary for a financial institution.
- **Secondary (#2C5AA0):** Utilized for interactive elements like links, active states, and focus indicators.
- **Tertiary & Neutrals:** Soft blues and grays are reserved for surface containers, background shading, and subtle borders to keep the UI light and breathable.
- **Status Colors:** Follow a high-chroma but professional tone. Success (Received), Warning (Pending), and Error (Action Required) must be clearly legible against white and light gray backgrounds.

## Typography

The design system utilizes **Inter** for its exceptional legibility in data-heavy contexts. 

- **Hierarchy:** Use bold weights for currency amounts and section headers to ensure quick scanning of financial health.
- **Numerical Data:** Tabular figures should be used for all financial tables to ensure decimal points align perfectly.
- **Mobile Scaling:** Large displays are capped at 32px to maintain a professional document feel rather than a marketing aesthetic. 
- **Labels:** Uppercase styling is reserved exclusively for small `label-lg` tokens used in table headers or metadata descriptors.

## Layout & Spacing

This design system follows a **Fluid Grid** model based on Material Design 3 specifications.

- **Mobile (0-599dp):** 4-column grid with 16px (1rem) side margins and 16px gutters.
- **Tablet (600dp+):** 8-column grid with 32px (2rem) side margins.
- **Vertical Rhythm:** A strict 8px base unit (0.5rem) governs all vertical spacing. Components are stacked with `stack-md` as the default gap.
- **Alignment:** Content within cards should use a consistent `container-padding` of 20px (1.25rem) to ensure data doesn't feel cramped against card borders.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** supplemented by very subtle, diffuse shadows.

- **Level 0 (Background):** White (#FFFFFF) or Neutral (#F8F9FA).
- **Level 1 (Cards/Surfaces):** White background with a 1px border (#DDE2E8). For interactivity, a soft shadow (0px 2px 8px rgba(18, 41, 77, 0.05)) is applied.
- **Level 2 (Active Elements/FAB):** Primary Navy (#12294D) with a more pronounced elevation shadow to indicate the highest layer of the z-axis.
- **Scrims:** For modals and bottom sheets, use a 40% opacity Navy (#12294D) overlay to maintain brand consistency even in the background blur.

## Shapes

The shape language balances the seriousness of the firm with modern mobile expectations.

- **Cards & Modals:** Use `rounded-lg` (16px) as the standard for all primary containers and document previews.
- **Inputs & Buttons:** Use `rounded` (8px) to provide a precise, structured feel.
- **Chips:** Use `rounded-xl` (24px) or full pill-shape for status indicators to distinguish them from actionable buttons.
- **Bottom Sheets:** Only the top corners are rounded (16px), maintaining a grounded connection to the bottom of the viewport.

## Components

### Buttons
- **Primary:** Solid Navy (#12294D) with white text. 8px corner radius.
- **Secondary:** Transparent with 1px border (#DDE2E8) and Navy text.
- **FAB:** Circular or extended FAB in Navy with an icon for "Upload Document" or "New Query."

### Chips (Status)
- **Pending:** Soft Amber background, Dark Orange text.
- **Received:** Soft Emerald background, Dark Green text.
- **Report Ready:** Soft Blue (#E8EDF5) background, Secondary Blue (#2C5AA0) text.

### Inputs
- **Material 3 Outlined:** 1px border (#DDE2E8). On focus, the border thickens and changes to Secondary Blue (#2C5AA0). Labels sit on the border.

### Cards
- Standard document cards feature an icon (PDF/Excel), the file name, the date, and a status chip. 
- Shadow is minimal; depth is primarily conveyed via the 1px border.

### Bottom Navigation
- Fixed at the bottom with 4-5 icons: Dashboard, Documents, Reports, Messages, and Profile. Active state uses a subtle tonal pill indicator behind the icon.