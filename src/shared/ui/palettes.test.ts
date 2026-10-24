import { describe, expect, it } from 'vitest';
import { ACCENT_IDS, DEFAULT_SETTINGS, SettingsSchema } from '@/core/model/settings';
import { PALETTES } from './palettes';

/** WCAG relative luminance contrast ratio between two hex colors. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACE = { light: '#ffffff', dark: '#18272e' };
const ON_COLOR = { light: '#14181c', dark: '#10181c' };

describe('accent palettes', () => {
  it('defines every accent', () => {
    expect(Object.keys(PALETTES).sort()).toEqual([...ACCENT_IDS].sort());
  });

  it.each(ACCENT_IDS)('%s keeps accent text readable in both modes', (id) => {
    for (const mode of ['light', 'dark'] as const) {
      expect(contrast(PALETTES[id][mode].text, SURFACE[mode])).toBeGreaterThanOrEqual(4.5);
      // Button labels sit on the accent fill.
      expect(contrast(ON_COLOR[mode], PALETTES[id][mode].accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('settings accept known accents only', () => {
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, accent: 'ocean' }).success).toBe(true);
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, accent: 'neon' }).success).toBe(false);
  });
});
