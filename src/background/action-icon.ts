import { browser } from 'wxt/browser';
import type { Accent } from '@/core/model/settings';
import { PALETTES } from '@/shared/ui/palettes';

/** Draws the toolbar icon (rounded square with a check) in the accent color. */
function draw(size: number, fill: string, shade: string): ImageData {
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
  return ctx.getImageData(0, 0, s, s);
}

/** Updates the toolbar icon to match the chosen accent. Failures are non-fatal. */
export async function updateActionIcon(accent: Accent): Promise<void> {
  try {
    const { accent: fill, shade } = PALETTES[accent].light;
    await browser.action.setIcon({
      imageData: { 16: draw(16, fill, shade), 32: draw(32, fill, shade) },
    });
  } catch (e) {
    console.warn('[interview-prep] could not update toolbar icon', e);
  }
}
