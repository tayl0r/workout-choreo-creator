import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const MOVES_FILE = path.join(__dirname, '..', 'data', 'files', 'moves', 'all.moves');

test.beforeEach(async () => {
  // Delete the moves file so each test starts with fresh seed data
  if (fs.existsSync(MOVES_FILE)) {
    fs.unlinkSync(MOVES_FILE);
  }
});

test.describe('Moves page', () => {
  test('loads with seed data and shows move cards', async ({ page }) => {
    await page.goto('#moves');
    // Wait for cards to load — seed data has 20 moves
    const cards = page.locator('textarea');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(20);
    // First card should start with #
    const firstValue = await cards.first().inputValue();
    expect(firstValue).toMatch(/^# /);
  });

  test('shows tag filter chips', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    // Should have an "all" chip and at least some tag chips
    await expect(page.getByRole('button', { name: 'all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'punch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'kick' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'defense' })).toBeVisible();
  });

  test('displays tags in bracket format', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    // Find a card with tags and verify bracket format
    const firstValue = await page.locator('textarea').first().inputValue();
    const tagsLine = firstValue.split('\n')[2] ?? '';
    expect(tagsLine).toMatch(/^\[.+\]/);
  });

  test('filters cards by tag', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    const allCount = await page.locator('textarea').count();

    // Click "kick" tag filter
    await page.getByRole('button', { name: 'kick' }).click();
    const kickCount = await page.locator('textarea').count();
    expect(kickCount).toBeLessThan(allCount);
    expect(kickCount).toBeGreaterThan(0);

    // Every visible card should have [kick] in its tags line
    const textareas = page.locator('textarea');
    for (let i = 0; i < kickCount; i++) {
      const val = await textareas.nth(i).inputValue();
      const lines = val.split('\n');
      expect(lines[2]?.toLowerCase()).toContain('[kick]');
    }

    // Click "all" to clear filter
    await page.getByRole('button', { name: 'all' }).click();
    const resetCount = await page.locator('textarea').count();
    expect(resetCount).toBe(allCount);
  });

  test('creates a new move via the + button', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    const initialCount = await page.locator('textarea').count();

    // Click the + button
    await page.getByTitle('Add new move').click();
    const newCount = await page.locator('textarea').count();
    expect(newCount).toBe(initialCount + 1);

    // The new card should be focused
    const lastTextarea = page.locator('textarea').last();
    await expect(lastTextarea).toBeFocused();

    // Type a new move
    await lastTextarea.fill('# spinning backfist\nRotating strike with the back of the fist\npunch, advanced');

    // Blur to trigger save
    await lastTextarea.blur();
    await page.waitForTimeout(1000);

    // Reload and verify it persisted
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const afterReload = page.locator('textarea');
    let found = false;
    for (let i = 0; i < await afterReload.count(); i++) {
      const val = await afterReload.nth(i).inputValue();
      if (val.includes('spinning backfist')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('edits a move and auto-saves on blur', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();

    // Find the jab card
    const textareas = page.locator('textarea');
    let jabIndex = -1;
    for (let i = 0; i < await textareas.count(); i++) {
      const val = await textareas.nth(i).inputValue();
      if (val.startsWith('# jab\n')) {
        jabIndex = i;
        break;
      }
    }
    expect(jabIndex).toBeGreaterThanOrEqual(0);

    const jabTextarea = textareas.nth(jabIndex);
    await jabTextarea.fill('# jab\nQuick straight punch with lead hand\npunch, basic, fast');
    await jabTextarea.blur();
    await page.waitForTimeout(1000);

    // Reload and check persistence
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const after = page.locator('textarea');
    let found = false;
    for (let i = 0; i < await after.count(); i++) {
      const val = await after.nth(i).inputValue();
      if (val.includes('# jab') && val.includes('fast')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('auto-saves after 3 second debounce', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();

    const firstTextarea = page.locator('textarea').first();
    const originalValue = await firstTextarea.inputValue();
    const originalName = originalValue.split('\n')[0];

    // Modify the description without blurring
    await firstTextarea.click();
    await firstTextarea.fill(originalName + '\nModified description for debounce test\ntest-tag');

    // Wait for debounce (3s) + save time
    await page.waitForTimeout(4000);

    // Should show "saved" indicator
    // Reload to verify persistence
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const after = page.locator('textarea');
    let found = false;
    for (let i = 0; i < await after.count(); i++) {
      const val = await after.nth(i).inputValue();
      if (val.includes('modified description for debounce test')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('deletes a move by clearing all text', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    const initialCount = await page.locator('textarea').count();

    // Find the sprawl card
    const textareas = page.locator('textarea');
    let sprawlIndex = -1;
    for (let i = 0; i < await textareas.count(); i++) {
      const val = await textareas.nth(i).inputValue();
      if (val.includes('# sprawl')) {
        sprawlIndex = i;
        break;
      }
    }
    expect(sprawlIndex).toBeGreaterThanOrEqual(0);

    // Clear the text
    await textareas.nth(sprawlIndex).fill('');
    await textareas.nth(sprawlIndex).blur();
    await page.waitForTimeout(1000);

    // Card should be gone
    const afterCount = await page.locator('textarea').count();
    expect(afterCount).toBe(initialCount - 1);

    // Reload and verify it's gone
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const afterReload = page.locator('textarea');
    for (let i = 0; i < await afterReload.count(); i++) {
      const val = await afterReload.nth(i).inputValue();
      expect(val).not.toContain('# sprawl');
    }
  });

  test('deleting the name shows error in console and can be fixed', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();

    // Find the hook card
    const textareas = page.locator('textarea');
    let hookIndex = -1;
    for (let i = 0; i < await textareas.count(); i++) {
      const val = await textareas.nth(i).inputValue();
      if (val.startsWith('# hook\n')) {
        hookIndex = i;
        break;
      }
    }
    expect(hookIndex).toBeGreaterThanOrEqual(0);

    const hookTextarea = textareas.nth(hookIndex);

    // Delete just the name, keeping the # prefix
    await hookTextarea.fill('# \nCircular punch targeting the side\npunch, power');
    await hookTextarea.blur();
    await page.waitForTimeout(1000);

    // Should show error in the ErrorConsole
    await expect(page.locator('text=Move must have a name')).toBeVisible();

    // Fix by adding a new name
    await hookTextarea.fill('# lead hook\nCircular punch targeting the side\npunch, power');
    await hookTextarea.blur();
    await page.waitForTimeout(1000);

    // Reload and verify the rename persisted
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const after = page.locator('textarea');
    let found = false;
    for (let i = 0; i < await after.count(); i++) {
      const val = await after.nth(i).inputValue();
      if (val.includes('# lead hook')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('abandoning a new blank card removes it on blur', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    const initialCount = await page.locator('textarea').count();

    // Click + to add a new card
    await page.getByTitle('Add new move').click();
    expect(await page.locator('textarea').count()).toBe(initialCount + 1);

    // Blur without typing anything
    await page.locator('textarea').last().blur();
    await page.waitForTimeout(500);

    // Card should be removed
    expect(await page.locator('textarea').count()).toBe(initialCount);
  });

  test('renaming a move preserves cursor and saves correctly', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();

    // Find the cross card
    const textareas = page.locator('textarea');
    let crossIndex = -1;
    for (let i = 0; i < await textareas.count(); i++) {
      const val = await textareas.nth(i).inputValue();
      if (val.startsWith('# cross\n')) {
        crossIndex = i;
        break;
      }
    }
    expect(crossIndex).toBeGreaterThanOrEqual(0);

    const crossTextarea = textareas.nth(crossIndex);
    await crossTextarea.fill('# power cross\nPowerful straight punch with rear hand\npunch, power, basic');
    // Don't blur — let debounce handle it
    await page.waitForTimeout(4000);

    // Card should still be focused (cursor not reset)
    await expect(crossTextarea).toBeFocused();

    // Reload and verify
    await page.reload();
    await expect(page.locator('textarea').first()).toBeVisible();
    const after = page.locator('textarea');
    let found = false;
    for (let i = 0; i < await after.count(); i++) {
      const val = await after.nth(i).inputValue();
      if (val.includes('# power cross')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('URL hash is set to #moves', async ({ page }) => {
    await page.goto('#moves');
    await expect(page.locator('textarea').first()).toBeVisible();
    expect(page.url()).toContain('#moves');
  });
});
