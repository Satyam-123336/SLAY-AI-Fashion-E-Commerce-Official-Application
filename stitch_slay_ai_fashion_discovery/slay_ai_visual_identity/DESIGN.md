---
name: Slay AI Visual Identity
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
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d1b1a'
  on-tertiary-container: '#868381'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#e6e1df'
  tertiary-fixed-dim: '#cac6c3'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The design system is engineered for a high-fashion, AI-driven experience that balances editorial elegance with technical precision. It targets a fashion-forward audience that values curation, speed, and exclusivity.

The aesthetic follows a **Premium Minimalism** movement:
- **Zero-Friction:** Interfaces are stripped of non-functional decoration to prioritize imagery and AI-generated content.
- **Cinematic Pacing:** Large scale imagery, generous negative space, and deliberate typographic hierarchy.
- **High-Fidelity Interaction:** Micro-interactions should feel viscous and intentional, using spring-based physics for transitions.
- **Modern Utility:** Combining the starkness of Swiss design with the fluid capabilities of modern web tech.

## Colors

The palette is anchored in a high-contrast, monochromatic base to allow fashion photography to remain the focal point.

- **Soft Alabaster (#F9FAFB):** Used for the primary canvas. It provides a warmer, more premium feel than pure white, reducing eye strain during long curation sessions.
- **Deep Obsidian (#111111):** The color of authority. Reserved for primary actions, heavy headings, and high-impact UI elements.
- **Electric Indigo (#4F46E5):** A digital-first accent used sparingly for active states, AI-processing indicators, and primary notifications.
- **Muted Platinum (#E5E7EB):** A subtle structural color for hair-line borders and dividers, ensuring the grid remains visible but non-intrusive.

## Typography

This design system utilizes **Inter** exclusively to maintain a clean, systematic look. The character of the typography is defined by aggressive negative letter-spacing in larger sizes to create a "tight," editorial feel.

- **Display & Headlines:** Use tight tracking (-0.02em to -0.04em) and heavy weights to anchor the page.
- **Body Text:** Standard tracking for maximum readability. Use `body-md` for general descriptions and AI-generated insights.
- **Labels:** Always uppercase with increased letter-spacing (0.05em) to differentiate functional UI from content.

## Layout & Spacing

The layout philosophy is a **Fixed Grid with Fluid Containers**. 

- **Desktop:** A 12-column grid with a 1440px max-width. Use 64px outer margins to create a "frame" effect around the content.
- **Mobile:** A 4-column grid with 20px margins. 
- **Spacing Rhythm:** Based on a 4px baseline, but primary layout blocks should use 32px, 64px, and 128px increments to maintain a sense of "breathe-ability" common in luxury lookbooks.
- **Alignment:** Content is generally center-aligned or flush-left. Avoid justified text.

## Elevation & Depth

This design system avoids traditional shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Levels:** 
  - Level 0: Soft Alabaster (Background)
  - Level 1: Pure White (#FFFFFF) for floating cards or modals.
- **Borders:** Instead of shadows, use 1px Muted Platinum (#E5E7EB) borders to define shapes.
- **Interaction Depth:** On hover or tap, elements should slightly scale (1.02x) rather than casting a shadow, maintaining the "flat-premium" aesthetic.
- **Overlays:** Use a 40% opacity Deep Obsidian backdrop for modals to maintain focus without losing the context of the Soft Alabaster canvas.

## Shapes

The shape language is **Soft (Level 1)**. 

- UI elements like buttons and input fields use a 0.25rem (4px) radius. This provides a subtle "human" touch to the sharp typography without appearing too playful or "bubbly."
- **Imagery:** Fashion assets and product cards should maintain sharp (0px) corners to preserve the professional photography aesthetic.
- **AI Elements:** Special AI-generated containers may use `rounded-lg` (8px) to subtly distinguish them from the standard layout.

## Components

- **Primary Buttons:** Deep Obsidian background with White text. Rectangular with 4px radius. No shadow. Active state shifts to Electric Indigo.
- **Secondary Buttons:** Transparent background with 1px Muted Platinum border. 
- **Input Fields:** Minimalist style. No background; 1px bottom-border only in Muted Platinum. On focus, the border transitions to Deep Obsidian.
- **Product Cards:** No border, no shadow. Full-bleed imagery with typography placed directly below. 
- **Chips/Tags:** Small, `label-sm` typography, 100px radius (pill), light grey background (#F3F4F6) with no border.
- **AI Recommendation Slider:** A horizontal-scroll component with 1px Platinum borders and a subtle Electric Indigo glow at the edges to signify "AI Activity."
- **Navigation:** A persistent, high-blur (glassmorphism) top bar using Soft Alabaster at 80% opacity.