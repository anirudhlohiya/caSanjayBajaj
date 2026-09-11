---
name: Fiscal Integrity
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5d5f5f'
  on-secondary: '#ffffff'
  secondary-container: '#dfe0e0'
  on-secondary-container: '#616363'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
  link: '#0070f3'
  cyan-accent: '#50e3c2'
  pink-accent: '#ff0080'
  canvas-soft: '#fafafa'
  canvas-inset: '#f5f5f5'
  hairline: '#ebebeb'
  hairline-strong: '#a1a1a1'
  dev-blue: '#007cf0'
  dev-teal: '#00dfd8'
  preview-purple: '#7928ca'
  ship-coral: '#ff4d4d'
  ship-amber: '#f9cb28'
typography:
  display-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -2.4px
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -1.28px
  display-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.96px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.28px
  label-mono:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-block:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  section-v: 128px
  container-max: 1200px
---

## Brand & Style

The design system embodies "Atmospheric Minimalism"—a high-fidelity, developer-centric aesthetic that balances the gravity of financial integrity with the precision of modern engineering. The brand personality is authoritative, technical, and hyper-polished, designed to evoke a sense of absolute reliability and sophisticated "under-the-hood" transparency.

The visual style is **Minimalist with High-Tech accents**. It relies on extreme monochromatic contrast (stark whites and deep inks) punctuated by vibrant, multi-stop mesh gradients. These gradients serve as the primary decorative engine, representing the "dynamic flow" of data and capital within a rigid, structured environment. The interface uses "Polarity Flipping" to define distinct content zones, alternating between dark-mode depth and light-mode clarity to maintain visual momentum without introducing unnecessary chrome.

## Colors

This color system is built on a foundation of high-contrast neutrals. **Ink (#171717)** and **Canvas (#FFFFFF)** are the primary drivers of the UI, used for text, backgrounds, and primary CTAs. 

### Decorative Mesh Gradients
The system utilizes three signature gradient pairs to signify different phases of financial data processing:
- **Analyze (Blue/Teal):** Used for technical insights and data exploration.
- **Review (Violet/Pink):** Used for audits and high-level summaries.
- **Execute (Coral/Amber):** Used for final transactions and reporting.

### Semantic Usage
Functional colors (Success, Error, Warning) follow standard conventions but are executed with high saturation to ensure they pop against the monochromatic base. Surfaces use `canvas-soft` for subtle sectioning and `hairline` for crisp, 1px boundaries that maintain a "blueprint" feel.

## Typography

The typography system is the cornerstone of the brand's editorial voice. It utilizes the **Geist** family to achieve a balance between a modernist Swiss influence and a technical, engineering-first aesthetic.

- **Headlines:** Must use aggressive negative tracking (as defined in the tokens) to create a dense, "locked-in" visual block. Headlines should often end with a period in brand moments to emphasize finality and authority.
- **Technical Narrative:** **Geist Mono** is not reserved solely for code; it is used for "eyebrows" (labels above headlines), metadata, and small labels to reinforce the system's analytical nature.
- **Scaling:** For mobile screens, `display-xl` should be replaced by `display-lg` to ensure legibility and prevent excessive line breaks.

## Layout & Spacing

The system follows a strict **4px rhythmic grid**. Layouts are primarily constructed using a 12-column fluid grid for desktop, which transitions to a single-column stack on mobile.

- **Vertical Rhythm:** Large vertical gaps (128px–192px) are used between major sections to allow the brand's "Atmospheric Minimalism" to breathe.
- **The Container:** Content is generally centered in a 1200px max-width container, though mesh gradient backgrounds and "Polarity Flip" sections should bleed to the edge of the viewport.
- **Margins & Gutters:** Desktop uses 32px gutters and 24px side margins. Mobile scales these down to 16px to maximize screen real estate for data-heavy views.

## Elevation & Depth

Elevation in the design system is subtle and structural, moving away from soft, floating shadows toward **Tonal Layering** and **Stacked Depth**.

- **Stacked Shadows:** Instead of high-blur shadows, use a 1px "hairline" border combined with two tight, low-opacity shadows (e.g., a 1px Y-offset shadow and a 4px Y-offset shadow, both under 10% opacity). This gives elements a physical "cut-out" appearance rather than a "floating" one.
- **Surface Insets:** Depth is often conveyed by "pushing" elements into the canvas using `canvas-soft-2` backgrounds, creating a nested, architectural feel.
- **Backdrop Blur:** Use sparingly on sticky navigation bars (12px blur) to maintain context while scrolling through high-contrast sections.

## Shapes

The shape language is precise and geometric, favoring "Soft" corners that feel modern but disciplined. 

- **Standard UI (6px):** Used for inputs, small buttons, and dropdown menus. This tight radius maintains the technical, slightly "sharp" aesthetic.
- **Cards (8px - 12px):** Standard containers use 8px, while larger marketing or pricing cards use 12px to feel more approachable.
- **Pills (100px):** Reserved exclusively for high-level marketing CTAs or status tags (e.g., "New," "Beta").
- **Borders:** All borders must be exactly 1px. Avoid using 2px or thicker borders as they interfere with the system's "precision engineering" narrative.

## Components

### Buttons
- **Primary:** Solid `ink` background with `canvas` text. No border.
- **Secondary:** `canvas` background with a 1px `hairline` border and `ink` text.
- **Ghost:** Transparent background with `ink` text. Subtle `canvas-soft` background on hover.

### Inputs & Form Fields
- Inputs use a `canvas` background with a `hairline` border. 
- Focus state: The border color remains `hairline`, but a 1px `primary` (ink) inner ring or outer glow is added to indicate activity without shifting layout.

### Cards
- Standard cards use an 8px radius with a 1px `hairline` border. 
- Use `canvas-soft` for the card background to provide a subtle lift from the `canvas` page background. 

### Chips & Tags
- Always use `Geist Mono` for tag labels.
- Minimal padding (4px vertical, 8px horizontal) to keep them compact and technical.

### Navigation
- Sticky top navigation with a `canvas` background and a bottom `hairline` divider. 
- Use `body-sm` weight 500 for navigation links to ensure high legibility at smaller sizes.