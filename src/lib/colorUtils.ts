

// src/lib/colorUtils.ts
import type { ThemePalette } from '@/types/firestore';

/**
 * Converts a HEX color string to an HSL string "H S% L%".
 * @param hex The HEX color string (e.g., "#RRGGBB" or "#RGB").
 * @returns The HSL string or an empty string if conversion fails.
 */
export function hexToHslString(hex: string | null | undefined): string {
  if (!hex || typeof hex !== 'string') return "";
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    return ""; // Invalid HEX format
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

/**
 * Converts an HSL string "H S% L%" to a HEX color string.
 * @param hslString The HSL string (e.g., "210 50% 75%").
 * @returns The HEX color string (e.g., "#RRGGBB") or an empty string if conversion fails.
 */
export function hslStringToHex(hslString: string | null | undefined): string {
  if (!hslString || typeof hslString !== 'string') return "";
  const parts = hslString.match(/(\d+)\s*(\d+)%?\s*(\d+)%?/);
  if (!parts) return "";

  let h = parseInt(parts[1], 10);
  let s = parseInt(parts[2], 10) / 100;
  let l = parseInt(parts[3], 10) / 100;

  if (s < 0) s = 0; if (s > 1) s = 1;
  if (l < 0) l = 0; if (l > 1) l = 1;


  if (s === 0) {
    const grayVal = Math.round(l * 255);
    const grayHex = grayVal.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}`;
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  h /= 360;

  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


// Define the complete default HSL palettes based on globals.css (New Premium Cinema Palette)
export const DEFAULT_LIGHT_THEME_COLORS_HSL: Required<ThemePalette> = {
  background: "210 20% 98%", /* Studio Paper #F8FAFC */
  foreground: "222 47% 11%", /* Deep Obsidian Slate #0F172A */
  card: "0 0% 100%", /* Pure Crisp White */
  "card-foreground": "222 47% 11%",
  popover: "0 0% 100%",
  "popover-foreground": "222 47% 11%",
  primary: "243 75% 59%", /* Royal Cinema Indigo #4F46E5 */
  "primary-foreground": "0 0% 100%",
  secondary: "215 28% 94%", /* Soft Slate Mist #F1F5F9 */
  "secondary-foreground": "222 47% 11%",
  muted: "215 28% 94%",
  "muted-foreground": "215 16% 47%", /* Sophisticated Editorial Gray #64748B */
  accent: "38 92% 50%", /* Hollywood Cinema Amber / Gold #F59E0B */
  "accent-foreground": "0 0% 100%",
  destructive: "0 84.2% 60.2%",
  "destructive-foreground": "0 0% 98%",
  border: "214 32% 91%", /* Hairline Slate Border #E2E8F0 */
  input: "214 32% 91%",
  ring: "243 75% 59%",
  "chart-1": "243 75% 59%",
  "chart-2": "38 92% 50%",
  "chart-3": "173 58% 39%",
  "chart-4": "215 16% 47%",
  "chart-5": "0 84.2% 60.2%",
  "sidebar-background": "0 0% 100%",
  "sidebar-foreground": "222 47% 11%",
  "sidebar-primary": "243 75% 59%",
  "sidebar-primary-foreground": "0 0% 100%",
  "sidebar-accent": "215 28% 94%",
  "sidebar-accent-foreground": "222 47% 11%",
  "sidebar-border": "214 32% 91%",
  "sidebar-ring": "243 75% 59%",
};

export const DEFAULT_DARK_THEME_COLORS_HSL: Required<ThemePalette> = {
  background: "224 71% 4%", /* Midnight OLED Obsidian #0B0F17 */
  foreground: "210 40% 98%", /* Diamond Studio White #F8FAFC */
  card: "222 47% 8%", /* Elevated Midnight Slate #111827 */
  "card-foreground": "210 40% 98%",
  popover: "222 47% 8%",
  "popover-foreground": "210 40% 98%",
  primary: "239 84% 67%", /* Luminous Electric Iris #818CF8 */
  "primary-foreground": "224 71% 4%",
  secondary: "217 33% 15%", /* Deep Midnight Slate #1E293B */
  "secondary-foreground": "210 40% 98%",
  muted: "217 33% 15%",
  "muted-foreground": "215 20% 65%", /* Soft Silver Slate #94A3B8 */
  accent: "38 92% 50%", /* Luminous Cinema Gold #F59E0B */
  "accent-foreground": "0 0% 100%",
  destructive: "0 70% 50%",
  "destructive-foreground": "0 0% 98%",
  border: "217 33% 18%", /* Hairline Midnight Border #1E293B */
  input: "217 33% 18%",
  ring: "239 84% 67%",
  "chart-1": "239 84% 67%",
  "chart-2": "38 92% 50%",
  "chart-3": "160 60% 45%",
  "chart-4": "280 65% 60%",
  "chart-5": "340 75% 55%",
  "sidebar-background": "224 71% 4%",
  "sidebar-foreground": "210 40% 98%",
  "sidebar-primary": "239 84% 67%",
  "sidebar-primary-foreground": "224 71% 4%",
  "sidebar-accent": "217 33% 15%",
  "sidebar-accent-foreground": "210 40% 98%",
  "sidebar-border": "217 33% 18%",
  "sidebar-ring": "239 84% 67%",
};

// Deriving keys from an actual object helps with static analysis
export const THEME_PALETTE_KEYS = Object.keys(DEFAULT_LIGHT_THEME_COLORS_HSL) as Array<keyof ThemePalette>;

/**
 * Generates CSS variable declarations for a given theme palette.
 * @param palette The (potentially partial) theme palette from Firestore.
 * @param defaultPalette The fallback default HSL palette.
 * @returns A string of CSS variable declarations.
 */
export const generatePaletteCssVariables = (palette: Partial<ThemePalette> | undefined, defaultPalette: Required<ThemePalette>): string => {
  let cssText = "";
  (Object.keys(defaultPalette) as Array<keyof ThemePalette>).forEach(key => {
    const cssVarName = `--${key}`;
    const hslValue = palette?.[key] || defaultPalette[key];
    if (hslValue) {
      cssText += `  ${cssVarName}: ${hslValue};\n`;
    }
  });
  return cssText;
};

// Keys for the admin theme settings UI (the core customizable ones)
export const CORE_THEME_PALETTE_KEYS: Array<keyof Pick<ThemePalette, 'primary' | 'foreground' | 'accent' | 'background' | 'secondary' | 'card' | 'border' | 'destructive' | 'input' | 'ring' | 'primary-foreground' | 'secondary-foreground' | 'card-foreground' | 'popover' | 'popover-foreground' | 'muted' | 'muted-foreground' | 'accent-foreground' | 'destructive-foreground' >> = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring'
];
