import { chromium, test as base, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

const EXTENSION_PATH = resolve(import.meta.dirname, '../.output/chrome-mv3');

/** A fake problem page, so tests never hit the real sites. */
export function fakeProblemPage(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`;
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await context.route('https://neetcode.io/**', (route) => {
      const slug = new URL(route.request().url()).pathname.split('/')[2] ?? 'unknown';
      const titles: Record<string, string> = {
        'duplicate-integer': 'Contains Duplicate | NeetCode',
        'is-anagram': 'Valid Anagram | NeetCode',
      };
      return route.fulfill({
        contentType: 'text/html',
        body: fakeProblemPage(titles[slug] ?? 'NeetCode'),
      });
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
