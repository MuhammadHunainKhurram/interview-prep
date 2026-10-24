import type { Accent } from '@/core/model/settings';
import { PALETTES } from './palettes';

/**
 * The app icon (rounded square with a check) drawn in the accent color. Used for the
 * toolbar icon and the dashboard/popup tab icon so they always match the theme.
 */
export function drawBrandIcon(size: number, accent: Accent): OffscreenCanvas {
  const { accent: fill, shade } = PALETTES[accent].light;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const s = size;
  const r = s * 0.22;
  const inset = s * 0.02;
  const path = () => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, s - inset * 2, s - inset * 2, r);
  };
  path();
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, s, s * 0.9);
  ctx.restore();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = s * 0.17;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.27, s * 0.5);
  ctx.lineTo(s * 0.43, s * 0.66);
  ctx.lineTo(s * 0.74, s * 0.34);
  ctx.stroke();
  return canvas;
}

let faviconUrl: string | undefined;

/** Points the page's tab icon at the brand icon in the given accent. */
export async function setFavicon(accent: Accent): Promise<void> {
  try {
    const blob = await drawBrandIcon(64, accent).convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.append(link);
    }
    link.type = 'image/png';
    link.href = url;
    if (faviconUrl) URL.revokeObjectURL(faviconUrl);
    faviconUrl = url;
  } catch (e) {
    console.warn('[interview-prep] could not update tab icon', e);
  }
}
