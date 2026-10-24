import { expect, test } from './fixtures';

const SHOTS = process.env.E2E_SCREENSHOTS;

test('tracks a solve from the widget through to the dashboard', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto('https://neetcode.io/problems/duplicate-integer');

  const pill = page.getByRole('button', { name: /^Interview Prep:/ });
  await expect(pill).toBeVisible();
  await pill.click();

  const dialog = page.getByRole('dialog', { name: 'Track this problem' });
  await expect(dialog.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
  await expect(dialog.getByText('New today')).toBeVisible();
  // NeetCode section is pre-selected as the pattern.
  await expect(dialog.getByRole('button', { name: 'Remove Arrays & Hashing' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1500);
  await expect(dialog.getByText(/^0:0[1-9]$/)).toBeVisible();

  await dialog.getByRole('button', { name: '+ Add notes' }).click();
  await dialog
    .getByRole('textbox', { name: 'Notes' })
    .fill('Hash set; return early on the first repeat.');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/widget.png` });

  await dialog.getByRole('button', { name: 'Solved', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Saved');
  await expect(dialog.getByText('Done today')).toBeVisible();
  await expect(dialog.getByText('Attempts')).toBeVisible();

  // Dashboard reflects it.
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dash.getByText('1 of 3 done.')).toBeVisible();
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });

  await dash.goto(`chrome-extension://${extensionId}/dashboard.html#/history`);
  await expect(dash.getByText('Hash set; return early on the first repeat.')).toBeVisible();
  await expect(dash.getByText(/\d+s/).first()).toBeVisible();
  if (SHOTS) await dash.screenshot({ path: `${SHOTS}/history.png`, fullPage: true });

  // In-page navigation to another problem updates the widget.
  // The panel stays open across navigation.
  await page.evaluate(() => history.pushState({}, '', '/problems/is-anagram'));
  await expect(page.getByRole('heading', { name: 'Valid Anagram' })).toBeVisible({ timeout: 5000 });
  await expect(pill).toHaveAccessibleName('Interview Prep: New');
});

test('undo removes the attempt', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://neetcode.io/problems/duplicate-integer');
  await page.getByRole('button', { name: /^Interview Prep:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Track this problem' });
  await dialog.getByRole('button', { name: "Didn't solve" }).click();
  await expect(dialog.getByText('Done today')).toBeVisible();
  await dialog.getByRole('button', { name: 'Undo' }).click();
  await expect(dialog.getByText('Done today')).toBeHidden();
  await expect(dialog.getByText('New today')).toBeVisible();
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

test('popup shows today', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('Contains Duplicate')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/popup.png` });
});
