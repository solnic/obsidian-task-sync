/**
 * Color utility functions for badge styling and text readability
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace("#", "");

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (hex.length !== 6) {
    return null;
  }

  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  return { r, g, b };
}

/**
 * Convert RGB string to RGB values
 */
function rgbStringToRgb(
  rgbString: string
): { r: number; g: number; b: number } | null {
  const matches = rgbString.match(/\d+/g);
  if (matches && matches.length >= 3) {
    return {
      r: parseInt(matches[0]),
      g: parseInt(matches[1]),
      b: parseInt(matches[2]),
    };
  }
  return null;
}

/**
 * Convert any color format to RGB values
 */
function colorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;

  // Handle hex colors
  if (color.startsWith("#")) {
    return hexToRgb(color);
  }

  // Handle rgb/rgba colors
  if (color.startsWith("rgb")) {
    return rgbStringToRgb(color);
  }

  // Handle named colors by creating a temporary element
  const tempElement = document.createElement("div");
  tempElement.style.color = color;
  document.body.appendChild(tempElement);
  const computedColor = getComputedStyle(tempElement).color;
  document.body.removeChild(tempElement);

  if (computedColor.startsWith("rgb")) {
    return rgbStringToRgb(computedColor);
  }

  return null;
}

/**
 * Calculate the relative luminance of a color
 * Based on WCAG 2.1 guidelines
 */
function getLuminance(r: number, g: number, b: number): number {
  // Convert to sRGB
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Apply gamma correction
  const rLinear =
    rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear =
    gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear =
    bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine the best text color (black or white) for a given background color
 * Returns the color that provides better contrast
 */
export function getOptimalTextColor(backgroundColor: string): string {
  const rgb = colorToRgb(backgroundColor);
  if (!rgb) {
    // Fallback to white for invalid colors
    return "white";
  }

  const backgroundLuminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // Luminance of white and black
  const whiteLuminance = 1;
  const blackLuminance = 0;

  // Calculate contrast ratios
  const whiteContrast = getContrastRatio(backgroundLuminance, whiteLuminance);
  const blackContrast = getContrastRatio(backgroundLuminance, blackLuminance);

  // Return the color with better contrast
  // WCAG AA requires at least 4.5:1 contrast ratio for normal text
  return whiteContrast > blackContrast ? "white" : "black";
}

/**
 * Check if a color is considered "bright" (light)
 * Uses a simple threshold based on luminance
 */
export function isBrightColor(backgroundColor: string): boolean {
  const rgb = colorToRgb(backgroundColor);
  if (!rgb) {
    return false;
  }

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  // Threshold of 0.5 - colors above this are considered bright
  return luminance > 0.5;
}

/**
 * Apply optimal text color to a badge element
 * Sets the CSS custom property --badge-text-color based on background color
 */
export function applyOptimalTextColor(
  element: HTMLElement,
  backgroundColor: string
): void {
  const textColor = getOptimalTextColor(backgroundColor);
  element.style.setProperty("--badge-text-color", textColor);

  // Also adjust text shadow based on text color
  if (textColor === "black") {
    element.style.textShadow = "0 1px 2px rgba(255, 255, 255, 0.3)";
  } else {
    element.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.2)";
  }
}

/**
 * Extract background color from CSS variable or direct color value
 */
export function extractBackgroundColor(element: HTMLElement): string | null {
  const computedStyle = getComputedStyle(element);
  const backgroundColor = computedStyle.backgroundColor;

  // Convert RGB to hex if needed
  if (backgroundColor.startsWith("rgb")) {
    const matches = backgroundColor.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }

  return backgroundColor.startsWith("#") ? backgroundColor : null;
}
