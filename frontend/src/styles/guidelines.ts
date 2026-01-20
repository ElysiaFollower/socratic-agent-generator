/**
 * Style Guidelines for Socratic Agent Generator
 *
 * This file provides guidelines and utility functions for consistent styling.
 * It complements design-tokens.ts with practical usage examples and patterns.
 */

import { typography, spacing, borders, shadows, breakpoints } from './design-tokens';

// ============================================================================
// TYPOGRAPHY GUIDELINES
// ============================================================================

/**
 * Typography scale with usage recommendations
 */
export const typographyGuidelines = {
  // Heading styles
  h1: {
    fontSize: typography.fontSizes['4xl'], // 2.25rem (36px)
    fontWeight: typography.fontWeights.bold,
    lineHeight: typography.lineHeights.tight,
    letterSpacing: typography.letterSpacings.tighter,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Primary page titles, major sections',
  },
  h2: {
    fontSize: typography.fontSizes['3xl'], // 1.875rem (30px)
    fontWeight: typography.fontWeights.bold,
    lineHeight: typography.lineHeights.tight,
    letterSpacing: typography.letterSpacings.tighter,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Section headings, important subsections',
  },
  h3: {
    fontSize: typography.fontSizes['2xl'], // 1.5rem (24px)
    fontWeight: typography.fontWeights.semibold,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacings.tight,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Subsection headings, card titles',
  },
  h4: {
    fontSize: typography.fontSizes.xl, // 1.25rem (20px)
    fontWeight: typography.fontWeights.semibold,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacings.tight,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Small section headings, dialog titles',
  },
  h5: {
    fontSize: typography.fontSizes.lg, // 1.125rem (18px)
    fontWeight: typography.fontWeights.semibold,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacings.normal,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Minor headings, list group titles',
  },
  h6: {
    fontSize: typography.fontSizes.base, // 1rem (16px)
    fontWeight: typography.fontWeights.semibold,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacings.normal,
    fontFamily: typography.fontFamilies.heading,
    useCase: 'Smallest headings, inline section titles',
  },

  // Body text styles
  bodyLarge: {
    fontSize: typography.fontSizes.lg, // 1.125rem (18px)
    fontWeight: typography.fontWeights.normal,
    lineHeight: typography.lineHeights.relaxed,
    fontFamily: typography.fontFamilies.body,
    useCase: 'Lead paragraphs, important content',
  },
  body: {
    fontSize: typography.fontSizes.base, // 1rem (16px)
    fontWeight: typography.fontWeights.normal,
    lineHeight: typography.lineHeights.relaxed,
    fontFamily: typography.fontFamilies.body,
    useCase: 'Default body text, paragraphs',
  },
  bodySmall: {
    fontSize: typography.fontSizes.sm, // 0.875rem (14px)
    fontWeight: typography.fontWeights.normal,
    lineHeight: typography.lineHeights.normal,
    fontFamily: typography.fontFamilies.body,
    useCase: 'Secondary text, descriptions',
  },
  caption: {
    fontSize: typography.fontSizes.xs, // 0.75rem (12px)
    fontWeight: typography.fontWeights.normal,
    lineHeight: typography.lineHeights.normal,
    fontFamily: typography.fontFamilies.body,
    useCase: 'Captions, helper text, metadata',
  },

  // Special text styles
  code: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.mono,
    lineHeight: typography.lineHeights.normal,
    useCase: 'Inline code, technical terms',
  },
  button: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    fontFamily: typography.fontFamilies.body,
    letterSpacing: typography.letterSpacings.wide,
    textTransform: 'uppercase' as const,
    useCase: 'Button labels, CTAs',
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    fontFamily: typography.fontFamilies.body,
    letterSpacing: typography.letterSpacings.wide,
    textTransform: 'uppercase' as const,
    useCase: 'Form labels, filter labels',
  },
};

/**
 * Responsive typography utility
 * Returns font size scaled based on viewport width
 */
export function responsiveFontSize(
  baseSize: keyof typeof typography.fontSizes,
  scalingFactor: number = 0.5
): string {
  const basePx = parseFloat(typography.fontSizes[baseSize]) * 16;
  const scaledPx = basePx * (1 + scalingFactor * 0.1);
  return `${scaledPx / 16}rem`;
}

// ============================================================================
// SPACING GUIDELINES
// ============================================================================

/**
 * Spacing system based on 8px unit
 */
export const spacingGuidelines = {
  // Common spacing patterns
  container: {
    padding: spacing[6], // 1.5rem (24px)
    margin: '0 auto',
    maxWidth: breakpoints['2xl'], // 1536px
  },
  section: {
    paddingY: spacing[12], // 3rem (48px)
    paddingX: spacing[6], // 1.5rem (24px)
  },
  card: {
    padding: spacing[4], // 1rem (16px)
    gap: spacing[3], // 0.75rem (12px)
  },
  button: {
    paddingX: spacing[4], // 1rem (16px)
    paddingY: spacing[2], // 0.5rem (8px)
    gap: spacing[2], // 0.5rem (8px)
  },
  input: {
    paddingX: spacing[3], // 0.75rem (12px)
    paddingY: spacing[2], // 0.5rem (8px)
  },
  list: {
    gap: spacing[2], // 0.5rem (8px)
    padding: spacing[2], // 0.5rem (8px)
  },

  // Spacing scale reference
  scale: {
    '0': spacing[0],  // 0
    '0.5': spacing[0.5], // 0.125rem (2px)
    '1': spacing[1],   // 0.25rem (4px)
    '1.5': spacing[1.5], // 0.375rem (6px)
    '2': spacing[2],   // 0.5rem (8px) - Base unit
    '2.5': spacing[2.5], // 0.625rem (10px)
    '3': spacing[3],   // 0.75rem (12px)
    '3.5': spacing[3.5], // 0.875rem (14px)
    '4': spacing[4],   // 1rem (16px)
    '5': spacing[5],   // 1.25rem (20px)
    '6': spacing[6],   // 1.5rem (24px)
    '7': spacing[7],   // 1.75rem (28px)
    '8': spacing[8],   // 2rem (32px)
    '9': spacing[9],   // 2.25rem (36px)
    '10': spacing[10], // 2.5rem (40px)
    '12': spacing[12], // 3rem (48px)
    '16': spacing[16], // 4rem (64px)
    '20': spacing[20], // 5rem (80px)
    '24': spacing[24], // 6rem (96px)
    '32': spacing[32], // 8rem (128px)
    '40': spacing[40], // 10rem (160px)
    '48': spacing[48], // 12rem (192px)
    '56': spacing[56], // 14rem (224px)
    '64': spacing[64], // 16rem (256px)
  },
};

/**
 * Returns spacing value based on the 8px grid
 */
export function space(multiplier: number): string {
  const base = 0.5; // 8px = 0.5rem
  return `${multiplier * base}rem`;
}

// ============================================================================
// LAYOUT GUIDELINES
// ============================================================================

/**
 * Layout grid system
 */
export const layoutGuidelines = {
  // Grid columns
  columns: {
    1: 'repeat(1, minmax(0, 1fr))',
    2: 'repeat(2, minmax(0, 1fr))',
    3: 'repeat(3, minmax(0, 1fr))',
    4: 'repeat(4, minmax(0, 1fr))',
    6: 'repeat(6, minmax(0, 1fr))',
    12: 'repeat(12, minmax(0, 1fr))',
  },

  // Common layout patterns
  sidebar: {
    width: '16rem', // 256px
    collapsedWidth: '4rem', // 64px
    gap: spacing[4], // 1rem (16px)
  },
  header: {
    height: '4rem', // 64px
    paddingX: spacing[6], // 1.5rem (24px)
  },
  footer: {
    height: '3rem', // 48px
    paddingX: spacing[6],
  },

  // Breakpoint-based layout adjustments
  breakpoints: {
    mobile: `@media (max-width: ${breakpoints.sm})`,
    tablet: `@media (min-width: ${breakpoints.sm}) and (max-width: ${breakpoints.lg})`,
    desktop: `@media (min-width: ${breakpoints.lg})`,
  },
};

// ============================================================================
// BORDER & SHADOW GUIDELINES
// ============================================================================

/**
 * Border radius usage guidelines
 */
export const borderGuidelines = {
  // Common radius applications
  button: borders.radius.xl, // 0.75rem (12px)
  card: borders.radius.xl, // 0.75rem (12px)
  input: borders.radius.lg, // 0.5rem (8px)
  badge: borders.radius.full, // 9999px (pill shape)
  avatar: borders.radius.full,
  tooltip: borders.radius.base, // 0.25rem (4px)

  // Scale reference
  scale: borders.radius,
};

/**
 * Shadow usage guidelines
 */
export const shadowGuidelines = {
  // Common shadow applications
  card: shadows.md,
  cardHover: shadows.lg,
  dropdown: shadows.xl,
  modal: shadows['2xl'],
  button: shadows.sm,
  buttonHover: shadows.base,
  inset: shadows.inner,

  // Elevation levels
  levels: {
    0: shadows.none,
    1: shadows.sm,
    2: shadows.base,
    3: shadows.md,
    4: shadows.lg,
    5: shadows.xl,
    6: shadows['2xl'],
  },
};

// ============================================================================
// COLOR USAGE GUIDELINES (Complementary to design-tokens)
// ============================================================================

export const colorGuidelines = {
  // Semantic color applications
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onAccent: '#ffffff',
    success: 'var(--color-success-600)',
    warning: 'var(--color-warning-600)',
    error: 'var(--color-error-600)',
    info: 'var(--color-info-600)',
  },
  background: {
    default: 'var(--color-bg)',
    surface: 'var(--color-surface)',
    surfaceMuted: 'var(--color-surface-muted)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  border: {
    default: 'var(--color-border)',
    focus: 'var(--focus-ring)',
    success: 'var(--color-success-300)',
    warning: 'var(--color-warning-300)',
    error: 'var(--color-error-300)',
  },
  state: {
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.08)',
    selected: 'rgba(0, 0, 0, 0.12)',
    disabled: 'rgba(0, 0, 0, 0.12)',
  },
};

// ============================================================================
// ANIMATION GUIDELINES
// ============================================================================

export const animationGuidelines = {
  // Timing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Durations
  duration: {
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Common animations
  transitions: {
    fade: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slideUp: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slideDown: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    scale: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a consistent box shadow with optional elevation
 */
export function elevation(level: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  return shadowGuidelines.levels[level];
}

/**
 * Creates a consistent border radius
 */
export function borderRadius(size: keyof typeof borders.radius): string {
  return borders.radius[size];
}

/**
 * Creates responsive styles for different breakpoints
 */
export function responsiveStyle<T>(
  styles: Record<keyof typeof breakpoints, T>
): Partial<Record<string, T>> {
  return Object.entries(styles).reduce((acc, [breakpoint, style]) => {
    acc[`@media (min-width: ${breakpoints[breakpoint as keyof typeof breakpoints]})`] = style;
    return acc;
  }, {} as Record<string, T>);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  typography: typographyGuidelines,
  spacing: spacingGuidelines,
  layout: layoutGuidelines,
  border: borderGuidelines,
  shadow: shadowGuidelines,
  color: colorGuidelines,
  animation: animationGuidelines,
};