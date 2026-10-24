import { browser } from 'wxt/browser';
import type { Accent } from '@/core/model/settings';
import { drawBrandIcon } from '@/shared/ui/brand-icon';

function imageData(size: number, accent: Accent): ImageData {
  return drawBrandIcon(size, accent).getContext('2d')!.getImageData(0, 0, size, size);
}

/** Updates the toolbar icon to match the chosen accent. Failures are non-fatal. */
export async function updateActionIcon(accent: Accent): Promise<void> {
  try {
    await browser.action.setIcon({
      imageData: { 16: imageData(16, accent), 32: imageData(32, accent) },
    });
  } catch (e) {
    console.warn('[interview-prep] could not update toolbar icon', e);
  }
}
