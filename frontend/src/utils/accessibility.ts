/**
 * Accessibility utilities and helpers.
 *
 * Provides functions to enhance accessibility with ARIA attributes,
 * keyboard navigation, and color contrast checking.
 */

import * as React from 'react';

/**
 * ARIA attribute helpers
 */
export const aria = {
  /**
   * Adds ARIA labels and descriptions to elements
   */
  label: (id: string, label: string, description?: string) => ({
    id,
    'aria-label': label,
    ...(description && { 'aria-describedby': `${id}-description` }),
  }),

  /**
   * Marks an element as a live region for dynamic content updates
   */
  liveRegion: (politeness: 'off' | 'polite' | 'assertive' = 'polite') => ({
    'aria-live': politeness,
    'aria-atomic': 'true',
    'aria-relevant': 'additions text',
  }),

  /**
   * Marks an element as a status message
   */
  status: (politeness: 'polite' | 'assertive' = 'polite') => ({
    role: 'status',
    ...aria.liveRegion(politeness),
  }),

  /**
   * Marks an element as an alert message
   */
  alert: (politeness: 'assertive' | 'polite' = 'assertive') => ({
    role: 'alert',
    ...aria.liveRegion(politeness),
  }),

  /**
   * Provides ARIA attributes for a button
   */
  button: (label: string, pressed?: boolean, disabled?: boolean) => ({
    'aria-label': label,
    ...(pressed !== undefined && { 'aria-pressed': pressed }),
    ...(disabled && { 'aria-disabled': true }),
  }),

  /**
   * Provides ARIA attributes for a dialog/modal
   */
  dialog: (label: string, describedBy?: string) => ({
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': label,
    ...(describedBy && { 'aria-describedby': describedBy }),
  }),

  /**
   * Provides ARIA attributes for a listbox or dropdown
   */
  listbox: (label: string, expanded: boolean, required?: boolean) => ({
    role: 'listbox',
    'aria-label': label,
    'aria-expanded': expanded,
    ...(required && { 'aria-required': 'true' }),
  }),

  /**
   * Provides ARIA attributes for a tablist and tabs
   */
  tablist: (label: string) => ({
    role: 'tablist',
    'aria-label': label,
  }),

  tab: (id: string, selected: boolean, controls: string) => ({
    role: 'tab',
    id,
    'aria-selected': selected,
    'aria-controls': controls,
    tabIndex: selected ? 0 : -1,
  }),

  tabpanel: (id: string, labelledBy: string) => ({
    role: 'tabpanel',
    id,
    'aria-labelledby': labelledBy,
    tabIndex: 0,
  }),
};

/**
 * Keyboard navigation utilities
 */
export const keyboard = {
  /**
   * Common keyboard key codes
   */
  keys: {
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    SPACE: ' ',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown',
  },

  /**
   * Checks if an event is from a keyboard interaction that should trigger an action
   */
  isActionKey: (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    const key = event.key;
    return key === keyboard.keys.ENTER || key === keyboard.keys.SPACE;
  },

  /**
   * Checks if an event is from a keyboard navigation key
   */
  isNavigationKey: (event: React.KeyboardEvent | KeyboardEvent): boolean => {
    const key = event.key;
    return [
      keyboard.keys.ARROW_UP,
      keyboard.keys.ARROW_DOWN,
      keyboard.keys.ARROW_LEFT,
      keyboard.keys.ARROW_RIGHT,
      keyboard.keys.HOME,
      keyboard.keys.END,
      keyboard.keys.PAGE_UP,
      keyboard.keys.PAGE_DOWN,
    ].includes(key);
  },

  /**
   * Creates a keyboard event handler for roving tabindex
   */
  rovingTabIndexHandler: (
    currentIndex: number,
    itemCount: number,
    onIndexChange: (index: number) => void
  ) => {
    return (event: React.KeyboardEvent) => {
      switch (event.key) {
        case keyboard.keys.ARROW_DOWN:
        case keyboard.keys.ARROW_RIGHT:
          event.preventDefault();
          onIndexChange((currentIndex + 1) % itemCount);
          break;
        case keyboard.keys.ARROW_UP:
        case keyboard.keys.ARROW_LEFT:
          event.preventDefault();
          onIndexChange((currentIndex - 1 + itemCount) % itemCount);
          break;
        case keyboard.keys.HOME:
          event.preventDefault();
          onIndexChange(0);
          break;
        case keyboard.keys.END:
          event.preventDefault();
          onIndexChange(itemCount - 1);
          break;
      }
    };
  },

  /**
   * Creates a keyboard event handler for closing elements (ESC key)
   */
  closeHandler: (onClose: () => void) => {
    return (event: React.KeyboardEvent) => {
      if (event.key === keyboard.keys.ESCAPE) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
  },
};

/**
 * Color contrast utilities
 */
export const contrast = {
  /**
   * Calculates luminance of a color (0-1)
   * Based on WCAG 2.1 formula
   */
  luminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Parses a hex color string to RGB
   */
  hexToRgb: (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : null;
  },

  /**
   * Calculates contrast ratio between two colors (1-21)
   */
  ratio: (color1: string, color2: string): number | null => {
    const rgb1 = contrast.hexToRgb(color1);
    const rgb2 = contrast.hexToRgb(color2);

    if (!rgb1 || !rgb2) return null;

    const l1 = contrast.luminance(rgb1[0], rgb1[1], rgb1[2]);
    const l2 = contrast.luminance(rgb2[0], rgb2[1], rgb2[2]);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  },

  /**
   * Checks if contrast ratio meets WCAG 2.1 AA standard (4.5:1 for normal text)
   */
  meetsAA: (color1: string, color2: string, largeText?: boolean): boolean => {
    const ratio = contrast.ratio(color1, color2);
    if (!ratio) return false;

    const required = largeText ? 3 : 4.5;
    return ratio >= required;
  },

  /**
   * Checks if contrast ratio meets WCAG 2.1 AAA standard (7:1 for normal text)
   */
  meetsAAA: (color1: string, color2: string, largeText?: boolean): boolean => {
    const ratio = contrast.ratio(color1, color2);
    if (!ratio) return false;

    const required = largeText ? 4.5 : 7;
    return ratio >= required;
  },

  /**
   * Generates an accessible color pair (foreground, background) that meets WCAG AA
   */
  accessiblePair: (
    background: string,
    foregroundOptions: string[]
  ): string | null => {
    for (const foreground of foregroundOptions) {
      if (contrast.meetsAA(foreground, background)) {
        return foreground;
      }
    }
    return null;
  },
};

/**
 * Focus management utilities
 */
export const focus = {
  /**
   * Traps focus within a container element
   */
  trap: (element: HTMLElement): (() => void) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  },

  /**
   * Moves focus to the first focusable element in a container
   */
  moveToFirst: (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    if (focusable) focusable.focus();
  },

  /**
   * Restores focus to the previously focused element
   */
  restore: (previousElement: HTMLElement | null) => {
    if (previousElement && typeof previousElement.focus === 'function') {
      previousElement.focus();
    }
  },
};

/**
 * Screen reader utilities
 */
export const screenReader = {
  /**
   * Announces a message to screen readers
   */
  announce: (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const container = document.getElementById('sr-announcements');
    if (!container) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', politeness);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    container.appendChild(announcement);

    // Remove after a delay to prevent accumulation
    setTimeout(() => {
      if (container.contains(announcement)) {
        container.removeChild(announcement);
      }
    }, 1000);
  },

  /**
   * Creates a screen-reader only element
   */
  only: (text: string) => ({
    className: 'sr-only',
    children: text,
  }),
};

/**
 * Accessibility validation utilities
 */
export const validation = {
  /**
   * Validates that an element has an accessible label
   */
  hasLabel: (element: HTMLElement): boolean => {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledby = element.hasAttribute('aria-labelledby');
    const hasLabel = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');

    return !!(hasAriaLabel || hasAriaLabelledby || hasLabel);
  },

  /**
   * Validates that interactive elements have keyboard support
   */
  isKeyboardAccessible: (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();
    const hasTabindex = element.hasAttribute('tabindex');
    const tabindexValue = element.getAttribute('tabindex');

    // Native interactive elements are keyboard accessible by default
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
      return true;
    }

    // Custom interactive elements need tabindex="0" or tabindex="-1" (programmatically focusable)
    return hasTabindex && tabindexValue !== null;
  },
};

/**
 * HOC to add accessibility props to a component
 */
export function withAccessibility<P extends object>(
  Component: React.ComponentType<P>,
  accessibilityProps: Record<string, any>
): React.ComponentType<P> {
  const AccessibleComponent = (props: P) => {
    return React.createElement(Component, { ...accessibilityProps, ...props });
  };
  return AccessibleComponent;
}

export default {
  aria,
  keyboard,
  contrast,
  focus,
  screenReader,
  validation,
  withAccessibility,
};