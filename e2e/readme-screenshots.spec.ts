/**
 * Regenerates the screenshots in docs/images used by the README.
 * Skipped in normal runs. Usage: npm run build && README_SHOTS=1 npx playwright test readme
 */
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const OUT = resolve(import.meta.dirname, '../docs/images');

test.skip(!process.env.README_SHOTS, 'Set README_SHOTS=1 to regenerate README screenshots');

/** A plain stand-in for a problem page, so the widget has something to sit on. */
const problemPage = (title: string) => `<!doctype html><html><head><title>${title}</title>
<style>
  body { margin: 0; background: #1e1e1e; color: #d4d4d4; font: 15px/1.6 system-ui, sans-serif; }
  main { max-width: 620px; padding: 40px 48px; }
  h1 { color: #fff; font-size: 22px; margin: 0 0 16px; }
  code { background: #2d2d2d; padding: 2px 6px; border-radius: 4px; }
  pre { background: #2d2d2d; padding: 12px 16px; border-radius: 8px; }
</style></head><body><main>
  <h1>Contains Duplicate</h1>
  <p>Given an integer array <code>nums</code>, return <code>true</code> if any value appears more than once in the array, otherwise return <code>false</code>.</p>
  <pre>Input: nums = [1, 2, 3, 3]
Output: true</pre>
  <pre>Input: nums = [1, 2, 3, 4]
Output: false</pre>
  <p>Recommended time and space complexity: O(n) time and O(n) space.</p>
</main></body></html>`;

async function solve(page: Page, slug: string, outcome: string, note?: string) {
  await page.goto(`https://neetcode.io/problems/${slug}`);
  const toolbar = page.getByRole('toolbar', { name: 'How did it go?' });
  if (note) {
    await toolbar.getByRole('button', { name: 'Show details' }).click();
    await page.getByRole('textbox', { name: 'Notes' }).fill(note);
  }
  await toolbar.getByRole('button', { name: outcome, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
}

test('readme screenshots', async ({ context, extensionId }) => {
  await context.route('https://neetcode.io/problems/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: problemPage('Contains Duplicate | NeetCode') }),
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 760 });

  // A little history so the screens aren't empty.
  await solve(page, 'is-anagram', 'Solved', 'Count characters with a hash map, compare counts.');
  await solve(page, 'two-integer-sum', 'Needed hints', 'Store value -> index, look up target - n.');

  // On-page tracker, details open with a note in progress.
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  const toolbar = page.getByRole('toolbar', { name: 'How did it go?' });
  await page.getByRole('region', { name: 'Timer' }).getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(3200);
  await toolbar.getByRole('button', { name: 'Show details' }).click();
  await page
    .getByRole('textbox', { name: 'Notes' })
    .fill('Hash set. Return true on the first repeat.');
  await page.getByRole('textbox', { name: 'Notes' }).blur();
  await page.screenshot({ path: `${OUT}/tracker.png` });

  await toolbar.getByRole('button', { name: 'Solved easily' }).click();
  await expect(page.getByRole('status')).toContainText('Saved');

  // Dashboard.
  const dash = await context.newPage();
  await dash.setViewportSize({ width: 1280, height: 900 });
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dash.getByText('Goal met.')).toBeVisible();
  await dash.waitForTimeout(300);
  await dash.screenshot({ path: `${OUT}/dashboard.png` });

  await dash.goto(`chrome-extension://${extensionId}/dashboard.html#/themes`);
  await expect(dash.getByRole('radio', { name: 'Grape' })).toBeVisible();
  await dash.waitForTimeout(300);
  await dash.screenshot({
    path: `${OUT}/themes.png`,
    clip: { x: 0, y: 0, width: 1280, height: 792 },
  });

  // Popup.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 470 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('Goal met.')).toBeVisible();
  await popup.waitForTimeout(300);
  await popup.screenshot({ path: `${OUT}/popup.png` });
});
