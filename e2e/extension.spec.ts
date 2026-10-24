import { expect, test } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS;

test('tracks a solve from the widget through to the dashboard', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto('https://neetcode.io/problems/duplicate-integer');

  // Outcome buttons are visible without opening anything.
  const outcomes = page.getByRole('toolbar', { name: 'How did it go?' });
  await expect(outcomes.getByRole('button', { name: 'Solved easily' })).toBeVisible();
  await expect(outcomes.getByRole('button', { name: "Didn't solve" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/widget-collapsed.png` });

  // Timer lives bottom-left.
  const timer = page.getByRole('region', { name: 'Timer' });
  await timer.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1500);
  await expect(timer.getByText(/^0:0[1-9]$/)).toBeVisible();

  // Details: pattern prefilled, notes.
  await outcomes.getByRole('button', { name: 'Show details' }).click();
  const details = page.getByRole('region', { name: 'Problem details' });
  await expect(details.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
  await expect(details.getByText('New today')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Remove Arrays & Hashing' })).toBeVisible();
  await details
    .getByRole('textbox', { name: 'Notes' })
    .fill('Hash set; return early on the first repeat.');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/widget.png` });

  await outcomes.getByRole('button', { name: 'Solved', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await expect(details.getByText('Done today')).toBeVisible();
  await expect(details.getByText('Attempts')).toBeVisible();
  // Saving stops and clears the timer.
  await expect(timer.getByRole('button', { name: 'Start' })).toBeVisible();

  // Dashboard reflects it.
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dash.getByText('2 problems to go.')).toBeVisible();
  await expect(dash).toHaveTitle('Interview Prep');
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });

  await dash.goto(`chrome-extension://${extensionId}/dashboard.html#/history`);
  await expect(dash.getByText('Hash set; return early on the first repeat.')).toBeVisible();
  await expect(dash).toHaveTitle('Interview Prep');
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/history.png`, fullPage: true });

  // In-page navigation to another problem updates the widget; details stay open.
  await page.evaluate(() => history.pushState({}, '', '/problems/is-anagram'));
  await expect(page.getByRole('heading', { name: 'Valid Anagram' })).toBeVisible({
    timeout: 5000,
  });
});

test('undo removes the attempt', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  const outcomes = page.getByRole('toolbar', { name: 'How did it go?' });
  await outcomes.getByRole('button', { name: "Didn't solve" }).click();
  await expect(page.getByRole('status')).toContainText("Didn't solve");
  await outcomes.getByRole('button', { name: 'Show details' }).click();
  const details = page.getByRole('region', { name: 'Problem details' });
  await expect(details.getByText('Done today')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(details.getByText('Done today')).toBeHidden();
  await expect(details.getByText('New today')).toBeVisible();
});

test('the toolbar can be dragged, remembers its spot, and the panel closes on outside click', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  const toolbar = page.getByRole('toolbar', { name: 'How did it go?' });
  const grip = toolbar.getByRole('button', { name: 'Move toolbar' });
  await expect(grip).toBeVisible();

  const before = (await toolbar.boundingBox())!;
  const g = (await grip.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x - 400, g.y + 300, { steps: 8 });
  await page.mouse.up();
  const after = (await toolbar.boundingBox())!;
  expect(after.x).toBeLessThan(before.x - 350);
  expect(after.y).toBeGreaterThan(before.y + 250);

  // Persists across reloads.
  await page.reload();
  await expect.poll(async () => (await toolbar.boundingBox())!.x).toBeLessThan(before.x - 350);

  // In the lower half, the panel opens above the toolbar.
  await toolbar.getByRole('button', { name: 'Show details' }).click();
  const details = page.getByRole('region', { name: 'Problem details' });
  await expect(details).toBeVisible();
  const panel = (await details.boundingBox())!;
  const bar = (await toolbar.boundingBox())!;
  expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y + 1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/widget-moved.png` });

  // Clicking elsewhere on the page closes it.
  await page.mouse.click(200, 200);
  await expect(details).toBeHidden();

  // Double-click on the grip puts it back.
  await grip.dblclick();
  await expect.poll(async () => (await toolbar.boundingBox())!.x).toBeGreaterThan(before.x - 5);
});

test('pattern picker is a short searchable list', async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  await page.getByRole('button', { name: 'Show details' }).click();
  const details = page.getByRole('region', { name: 'Problem details' });
  await details.getByRole('button', { name: '+ Add pattern' }).click();
  const list = details.getByRole('listbox', { name: 'Patterns' });
  await expect(list).toBeVisible();
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(241);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pattern-picker.png` });

  await details.getByRole('combobox', { name: 'Search patterns' }).fill('slid');
  await expect(list.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(details.getByRole('button', { name: 'Remove Sliding Window' })).toBeVisible();
  await expect(list).toBeHidden();

  // Escape closes the picker without closing the details panel.
  await details.getByRole('button', { name: '+ Add pattern' }).click();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(details).toBeVisible();
});

test('problem sections collapse and stay collapsed', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#/problems`);
  const header = page.getByRole('button', { name: /^Arrays & Hashing/ });
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Contains Duplicate')).toBeVisible();

  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Contains Duplicate')).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: /^Arrays & Hashing/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  // Searching shows matches even in collapsed sections.
  await page.getByRole('searchbox', { name: 'Search problems' }).fill('duplicate');
  await expect(page.getByText('Contains Duplicate')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search problems' }).fill('');

  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.getByRole('button', { name: /^Two Pointers/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/problems-collapsed.png`, fullPage: true });
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByRole('button', { name: /^Arrays & Hashing/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('settings reject out-of-range values', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html#/settings`);
  const rest = page.getByLabel('Extra rest days per month');
  await rest.fill('60');
  await expect(page.getByText('Extra rest days can be at most 8 per month')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();

  await rest.fill('');
  await expect(page.getByText('Extra rest days must be a number')).toBeVisible();

  await rest.fill('3');
  await page.getByLabel('Daily goal').fill('2');
  await page.getByLabel('Minimum reviews').fill('5');
  await expect(page.getByText('Minimum reviews cannot be more than the daily goal')).toBeVisible();

  await page.getByLabel('Minimum reviews').fill('1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings.png`, fullPage: true });

  // All 7 weekdays can't be rest days.
  for (const d of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sat', exact: true })).toBeDisabled();
});

test('themes tab changes the accent everywhere', async ({ context, extensionId }) => {
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html#/themes`);
  await expect(dash.getByRole('heading', { name: 'Themes' })).toBeVisible();
  await expect(dash.getByRole('radio', { name: 'Grape' })).toHaveAttribute('aria-checked', 'true');
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/themes.png`, fullPage: true });

  await dash.getByRole('radio', { name: 'Ocean' }).click();
  await expect(dash.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true');
  await expect
    .poll(() => dash.evaluate(() => document.documentElement.style.getPropertyValue('--ip-accent')))
    .toBe('#2ec4b6');
  // The tab icon is redrawn in the theme color.
  await expect
    .poll(() =>
      dash.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? ''),
    )
    .toMatch(/^blob:/);

  await dash.getByRole('radio', { name: /Light/ }).click();
  await expect
    .poll(() => dash.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('light');
  await dash.waitForTimeout(400); // let color transitions finish
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/themes-ocean-light.png`, fullPage: true });

  // The on-page widget follows.
  const page = await context.newPage();
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  await expect(page.getByRole('toolbar', { name: 'How did it go?' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            document.querySelector('interview-prep-widget') as HTMLElement | null
          )?.style.getPropertyValue('--ip-accent') ?? '',
      ),
    )
    .toBe('#2ec4b6');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/widget-ocean-light.png` });
});

test('popup shows today', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('Contains Duplicate')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/popup.png` });
});
