/**
 * Responsive design hooks and utilities.
 *
 * Provides hooks to detect viewport size and device type for responsive design.
 */

import { useState, useEffect, useMemo } from "react";

// Breakpoint values aligned with design tokens (in pixels)
export const BREAKPOINTS = {
  xs: 0,      // Extra small devices (portrait phones)
  sm: 640,    // Small devices (landscape phones)
  md: 768,    // Medium devices (tablets)
  lg: 1024,   // Large devices (desktops)
  xl: 1280,   // Extra large devices (large desktops)
  "2xl": 1536, // Extra extra large devices
} as const;

// Device type categories
export type DeviceType = "mobile" | "tablet" | "desktop" | "largeDesktop";

// Screen size categories
export type ScreenSize = keyof typeof BREAKPOINTS;

/**
 * Hook to get current viewport width and height
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}

/**
 * Hook to get current screen size based on breakpoints
 */
export function useScreenSize(): ScreenSize {
  const { width } = useViewport();

  return useMemo(() => {
    if (width >= BREAKPOINTS["2xl"]) return "2xl";
    if (width >= BREAKPOINTS.xl) return "xl";
    if (width >= BREAKPOINTS.lg) return "lg";
    if (width >= BREAKPOINTS.md) return "md";
    if (width >= BREAKPOINTS.sm) return "sm";
    return "xs";
  }, [width]);
}

/**
 * Hook to get device type category
 */
export function useDeviceType(): DeviceType {
  const screenSize = useScreenSize();

  return useMemo(() => {
    if (screenSize === "xs" || screenSize === "sm") return "mobile";
    if (screenSize === "md") return "tablet";
    if (screenSize === "lg" || screenSize === "xl") return "desktop";
    return "largeDesktop"; // 2xl
  }, [screenSize]);
}

/**
 * Hook to check if current viewport matches a breakpoint or range
 */
export function useBreakpoint(
  breakpoint: ScreenSize,
  direction: "up" | "down" | "only" = "up"
): boolean {
  const screenSize = useScreenSize();
  const breakpointValue = BREAKPOINTS[breakpoint];

  return useMemo(() => {
    const currentValue = BREAKPOINTS[screenSize];

    if (direction === "up") {
      return currentValue >= breakpointValue;
    } else if (direction === "down") {
      return currentValue <= breakpointValue;
    } else {
      // "only" - match exact breakpoint
      return screenSize === breakpoint;
    }
  }, [screenSize, breakpoint, direction]);
}

/**
 * Hook to get responsive values based on breakpoints
 */
export function useResponsiveValue<T>(
  values: Partial<Record<ScreenSize, T>>,
  defaultValue: T
): T {
  const screenSize = useScreenSize();

  return useMemo(() => {
    // Try to find value for current screen size, then fallback to smaller sizes
    let size: ScreenSize = screenSize;
    while (size !== "xs" && !(size in values)) {
      size = getPreviousSize(size);
    }

    return values[size] ?? defaultValue;
  }, [screenSize, values, defaultValue]);
}

/**
 * Utility function to get previous screen size
 */
function getPreviousSize(size: ScreenSize): ScreenSize {
  const sizes: ScreenSize[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
  const index = sizes.indexOf(size);
  return index > 0 ? sizes[index - 1] : "xs";
}

/**
 * Utility function to generate responsive styles object for MUI sx prop
 */
export function responsiveStyle<T>(
  styles: Partial<Record<ScreenSize, T>>
): Record<string, T> {
  const result: Record<string, T> = {};

  Object.entries(styles).forEach(([breakpoint, style]) => {
    if (style !== undefined) {
      const minWidth = BREAKPOINTS[breakpoint as ScreenSize];
      result[`@media (min-width: ${minWidth}px)`] = style;
    }
  });

  return result;
}

/**
 * Utility function to generate responsive CSS class names
 */
export function responsiveClassNames(
  classNames: Partial<Record<ScreenSize, string>>
): string {
  const screenSize = typeof window !== "undefined" ? useScreenSize() : "xs";
  return classNames[screenSize] || "";
}

/**
 * Predefined responsive helpers
 */
export const responsiveHelpers = {
  // Hide elements based on screen size
  hidden: {
    xs: { display: "none" },
    sm: { display: "none" },
    md: { display: "none" },
    lg: { display: "none" },
    xl: { display: "none" },
    "2xl": { display: "none" },
  },
  // Show elements only on specific screen sizes
  visible: {
    xs: { display: "block" },
    sm: { display: "block" },
    md: { display: "block" },
    lg: { display: "block" },
    xl: { display: "block" },
    "2xl": { display: "block" },
  },
  // Common responsive spacing patterns
  spacing: {
    sectionPadding: {
      xs: { padding: "var(--spacing-4)" },
      sm: { padding: "var(--spacing-6)" },
      md: { padding: "var(--spacing-8)" },
      lg: { padding: "var(--spacing-10)" },
    },
    containerWidth: {
      xs: { maxWidth: "100%" },
      sm: { maxWidth: "640px" },
      md: { maxWidth: "768px" },
      lg: { maxWidth: "1024px" },
      xl: { maxWidth: "1280px" },
      "2xl": { maxWidth: "1536px" },
    },
  },
} as const;

export default {
  useViewport,
  useScreenSize,
  useDeviceType,
  useBreakpoint,
  useResponsiveValue,
  responsiveStyle,
  responsiveClassNames,
  BREAKPOINTS,
};