/**
 * Type-safe CSS variable access utilities.
 * Provides autocomplete and type checking for CSS custom properties.
 */

import { colors } from './design-tokens';

// ============================================================================
// CSS VARIABLE TYPES
// ============================================================================

/**
 * Color variable types with autocomplete support
 */
export type ColorVariable =
  | `--color-primary-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `--color-secondary-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `--color-accent-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `--color-neutral-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `--color-success-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900}`
  | `--color-warning-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900}`
  | `--color-error-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900}`
  | `--color-info-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900}`
  | '--color-primary'
  | '--color-secondary'
  | '--color-accent'
  | '--color-bg'
  | '--color-surface'
  | '--color-surface-muted'
  | '--color-border'
  | '--text-primary'
  | '--text-secondary'
  | '--text-muted'
  | '--focus-ring';

/**
 * Spacing variable types
 */
export type SpacingVariable =
  | `--spacing-${0 | '0-5' | 1 | '1-5' | 2 | '2-5' | 3 | '3-5' | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64}`;

/**
 * Radius variable types
 */
export type RadiusVariable =
  | `--radius-${'none' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'}`;

/**
 * Shadow variable types
 */
export type ShadowVariable =
  | `--shadow-${'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | 'inner' | 'none'}`;

/**
 * Transition variable types
 */
export type TransitionVariable =
  | `--transition-duration-${75 | 100 | 150 | 200 | 300 | 500 | 700 | 1000}`
  | '--transition-timing-default';

/**
 * Z-index variable types
 */
export type ZIndexVariable =
  | `--z-index-${'hide' | 'base' | 'dropdown' | 'sticky' | 'overlay' | 'modal' | 'popover' | 'tooltip'}`;

/**
 * Gradient variable types
 */
export type GradientVariable =
  | `--gradient-${'primary' | 'secondary' | 'accent' | 'subtle'}`;

/**
 * Font variable types
 */
export type FontVariable =
  | `--font-${'body' | 'heading' | 'mono'}`;

/**
 * All CSS variable types union
 */
export type CSSVariable =
  | ColorVariable
  | SpacingVariable
  | RadiusVariable
  | ShadowVariable
  | TransitionVariable
  | ZIndexVariable
  | GradientVariable
  | FontVariable;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets a CSS variable value with type safety
 */
export function cssVar(variable: CSSVariable): string {
  return `var(${variable})`;
}

/**
 * Gets a CSS variable value with fallback
 */
export function cssVarWithFallback(variable: CSSVariable, fallback: string): string {
  return `var(${variable}, ${fallback})`;
}

/**
 * Creates a CSS custom property declaration
 */
export function cssProperty(variable: CSSVariable, value: string): string {
  return `${variable}: ${value};`;
}

// ============================================================================
// SEMANTIC COLOR HELPERS (Most frequently used)
// ============================================================================

/**
 * Semantic color access with autocomplete
 */
export const color = {
  // Primary colors
  primary: {
    main: cssVar('--color-primary'),
    50: cssVar('--color-primary-50'),
    100: cssVar('--color-primary-100'),
    200: cssVar('--color-primary-200'),
    300: cssVar('--color-primary-300'),
    400: cssVar('--color-primary-400'),
    500: cssVar('--color-primary-500'),
    600: cssVar('--color-primary-600'),
    700: cssVar('--color-primary-700'),
    800: cssVar('--color-primary-800'),
    900: cssVar('--color-primary-900'),
    950: cssVar('--color-primary-950'),
  },

  // Background colors
  background: {
    default: cssVar('--color-bg'),
    surface: cssVar('--color-surface'),
    surfaceMuted: cssVar('--color-surface-muted'),
  },

  // Text colors
  text: {
    primary: cssVar('--text-primary'),
    secondary: cssVar('--text-secondary'),
    muted: cssVar('--text-muted'),
  },

  // Semantic colors (success, warning, error, info)
  success: {
    50: cssVar('--color-success-50'),
    100: cssVar('--color-success-100'),
    200: cssVar('--color-success-200'),
    300: cssVar('--color-success-300'),
    400: cssVar('--color-success-400'),
    500: cssVar('--color-success-500'),
    600: cssVar('--color-success-600'),
    700: cssVar('--color-success-700'),
    800: cssVar('--color-success-800'),
    900: cssVar('--color-success-900'),
  },

  warning: {
    50: cssVar('--color-warning-50'),
    100: cssVar('--color-warning-100'),
    200: cssVar('--color-warning-200'),
    300: cssVar('--color-warning-300'),
    400: cssVar('--color-warning-400'),
    500: cssVar('--color-warning-500'),
    600: cssVar('--color-warning-600'),
    700: cssVar('--color-warning-700'),
    800: cssVar('--color-warning-800'),
    900: cssVar('--color-warning-900'),
  },

  error: {
    50: cssVar('--color-error-50'),
    100: cssVar('--color-error-100'),
    200: cssVar('--color-error-200'),
    300: cssVar('--color-error-300'),
    400: cssVar('--color-error-400'),
    500: cssVar('--color-error-500'),
    600: cssVar('--color-error-600'),
    700: cssVar('--color-error-700'),
    800: cssVar('--color-error-800'),
    900: cssVar('--color-error-900'),
  },

  info: {
    50: cssVar('--color-info-50'),
    100: cssVar('--color-info-100'),
    200: cssVar('--color-info-200'),
    300: cssVar('--color-info-300'),
    400: cssVar('--color-info-400'),
    500: cssVar('--color-info-500'),
    600: cssVar('--color-info-600'),
    700: cssVar('--color-info-700'),
    800: cssVar('--color-info-800'),
    900: cssVar('--color-info-900'),
  },
};

/**
 * Spacing utilities with autocomplete
 */
export const spacing = {
  0: cssVar('--spacing-0'),
  0.5: cssVar('--spacing-0-5'),
  1: cssVar('--spacing-1'),
  1.5: cssVar('--spacing-1-5'),
  2: cssVar('--spacing-2'),
  2.5: cssVar('--spacing-2-5'),
  3: cssVar('--spacing-3'),
  3.5: cssVar('--spacing-3-5'),
  4: cssVar('--spacing-4'),
  5: cssVar('--spacing-5'),
  6: cssVar('--spacing-6'),
  7: cssVar('--spacing-7'),
  8: cssVar('--spacing-8'),
  9: cssVar('--spacing-9'),
  10: cssVar('--spacing-10'),
  12: cssVar('--spacing-12'),
  16: cssVar('--spacing-16'),
  20: cssVar('--spacing-20'),
  24: cssVar('--spacing-24'),
  32: cssVar('--spacing-32'),
  40: cssVar('--spacing-40'),
  48: cssVar('--spacing-48'),
  56: cssVar('--spacing-56'),
  64: cssVar('--spacing-64'),
};

/**
 * Radius utilities with autocomplete
 */
export const radius = {
  none: cssVar('--radius-none'),
  sm: cssVar('--radius-sm'),
  base: cssVar('--radius-base'),
  md: cssVar('--radius-md'),
  lg: cssVar('--radius-lg'),
  xl: cssVar('--radius-xl'),
  '2xl': cssVar('--radius-2xl'),
  '3xl': cssVar('--radius-3xl'),
  full: cssVar('--radius-full'),
};

/**
 * Shadow utilities with autocomplete
 */
export const shadow = {
  sm: cssVar('--shadow-sm'),
  base: cssVar('--shadow-base'),
  md: cssVar('--shadow-md'),
  lg: cssVar('--shadow-lg'),
  xl: cssVar('--shadow-xl'),
  '2xl': cssVar('--shadow-2xl'),
  inner: cssVar('--shadow-inner'),
  none: cssVar('--shadow-none'),
};

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

/**
 * React hook for accessing CSS variables in components
 */
export function useCssVariables() {
  return {
    color,
    spacing,
    radius,
    shadow,
    cssVar,
    cssVarWithFallback,
  };
}

// ============================================================================
// COMMON PATTERNS (Quick reference examples)
// ============================================================================

/**
 * Common styling patterns for quick use
 */
export const patterns = {
  // Button styles
  button: {
    primary: {
      backgroundColor: color.primary[600],
      color: '#ffffff',
      borderRadius: radius.xl,
      padding: `${spacing[2]} ${spacing[4]}`,
      boxShadow: shadow.sm,
      '&:hover': {
        backgroundColor: color.primary[700],
        boxShadow: shadow.base,
      },
    },
    secondary: {
      backgroundColor: 'transparent',
      color: color.primary[600],
      border: `2px solid ${color.primary[300]}`,
      borderRadius: radius.xl,
      padding: `${spacing[2]} ${spacing[4]}`,
      '&:hover': {
        backgroundColor: color.primary[50],
        borderColor: color.primary[400],
      },
    },
  },

  // Card styles
  card: {
    default: {
      backgroundColor: color.background.surface,
      borderRadius: radius.xl,
      border: `1px solid ${cssVar('--color-border')}`,
      padding: spacing[4],
      boxShadow: shadow.sm,
      '&:hover': {
        boxShadow: shadow.md,
        borderColor: color.primary[300],
      },
    },
  },

  // Input styles
  input: {
    default: {
      backgroundColor: color.background.surface,
      border: `2px solid ${cssVar('--color-border')}`,
      borderRadius: radius.lg,
      padding: `${spacing[2]} ${spacing[3]}`,
      color: color.text.primary,
      '&:focus': {
        borderColor: cssVar('--focus-ring'),
        boxShadow: `0 0 0 3px ${cssVar('--focus-ring')}20`,
      },
    },
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  cssVar,
  cssVarWithFallback,
  color,
  spacing,
  radius,
  shadow,
  useCssVariables,
  patterns,
};