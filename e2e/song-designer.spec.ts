import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SONG_FILES_DIR = path.join(__dirname, '..', 'data', 'files', 'songs');

/** Strip any #BODY section from all .song files to start clean. */
function cleanSongParts() {
  if (!fs.existsSync(SONG_FILES_DIR)) return;
  for (const file of fs.readdirSync(SONG_FILES_DIR)) {
    if (!file.endsWith('.song')) continue;
    const filePath = path.join(SONG_FILES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const bodyIdx = content.indexOf('\n#BODY');
    if (bodyIdx !== -1) {
      fs.writeFileSync(filePath, content.slice(0, bodyIdx) + '\n', 'utf-8');
    }
  }
}

/** Get the first song ID from the API. */
async function getFirstSongId(page: Page): Promise<number> {
  const response = await page.request.get('http://localhost:3001/api/songs');
  const songs = await response.json();
  return songs[0].id;
}

/** Select a song and navigate to Song Designer. */
async function setupSongDesigner(page: Page) {
  const songId = await getFirstSongId(page);
  // Navigate directly via hash — this sets both activeComponent and selectedSongId
  await page.goto(`#song-designer/${songId}`);
  await expect(page.locator('text=Song Parts')).toBeVisible({ timeout: 10_000 });
}

test.beforeEach(async () => {
  cleanSongParts();
});

test.describe('Song Designer', () => {
  test('shows "No song selected" when no song is selected', async ({ page }) => {
    await page.goto('#song-designer');
    await expect(page.locator('text=No song selected')).toBeVisible();
  });

  test('shows Song Parts toolbar when a song is selected', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.locator('text=Song Parts')).toBeVisible();
    await expect(page.locator('text=0 parts')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Part' })).toBeVisible();
  });

  test('URL hash includes song-designer and song id', async ({ page }) => {
    await setupSongDesigner(page);
    expect(page.url()).toContain('#song-designer/');
  });

  test('timeline is visible on Song Designer view', async ({ page }) => {
    await setupSongDesigner(page);
    // Transport controls should be visible (from TimelineVisualizer)
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('creates a part via + Add Part button', async ({ page }) => {
    await setupSongDesigner(page);
    // Wait for timeline to be ready
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '+ Add Part' }).click();

    // A pill with dashed border (unsaved) should appear with "name..." placeholder
    await expect(page.locator('text=name...')).toBeVisible();
  });

  test('names a part via the dropdown and saves it', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Add a part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await expect(page.locator('text=name...')).toBeVisible();

    // Click the name placeholder to open dropdown
    await page.locator('text=name...').click();

    // Dropdown should show "+ Create new"
    await expect(page.locator('text=+ Create new')).toBeVisible();

    // Click Create new to show the input
    await page.locator('text=+ Create new').click();

    // Type a name and press Enter
    const nameInput = page.locator('input[placeholder="Part name..."]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Intro');
    await nameInput.press('Enter');

    // Part counter should update
    await expect(page.locator('text=1 part')).toBeVisible();

    // The .song file should now contain the part
    await page.waitForTimeout(500);
    const songFiles = fs.readdirSync(SONG_FILES_DIR).filter((f) => f.endsWith('.song'));
    let foundPart = false;
    for (const file of songFiles) {
      const content = fs.readFileSync(path.join(SONG_FILES_DIR, file), 'utf-8');
      if (content.includes('#BODY') && content.includes('Intro')) {
        foundPart = true;
        break;
      }
    }
    expect(foundPart).toBe(true);
  });

  test('stance badge cycles through stances on click', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Create and name a part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await page.locator('text=name...').click();
    await page.locator('text=+ Create new').click();
    const nameInput = page.locator('input[placeholder="Part name..."]');
    await nameInput.fill('Verse');
    await nameInput.press('Enter');
    await expect(page.locator('text=1 part')).toBeVisible();

    // Default stance is Centered — badge shows "C"
    const badge = page.locator('button[title*="Stance"]');
    await expect(badge).toHaveText('C');

    // Click to cycle: Centered -> Right
    await badge.click();
    await expect(badge).toHaveText('R');

    // Click to cycle: Right -> Left
    await badge.click();
    await expect(badge).toHaveText('L');

    // Click to cycle: Left -> Centered
    await badge.click();
    await expect(badge).toHaveText('C');
  });

  test('deletes a part', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Create and name a part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await page.locator('text=name...').click();
    await page.locator('text=+ Create new').click();
    const nameInput = page.locator('input[placeholder="Part name..."]');
    await nameInput.fill('Drop');
    await nameInput.press('Enter');
    await expect(page.locator('text=1 part')).toBeVisible();

    // Hover over the pill to reveal the delete button, then click it
    const pill = page.locator('text=Drop').first();
    await pill.hover();
    await page.getByTitle('Delete part').click();

    await expect(page.locator('text=0 parts')).toBeVisible();
  });

  test('parts persist across page reload', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Create and name a part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await page.locator('text=name...').click();
    await page.locator('text=+ Create new').click();
    const nameInput = page.locator('input[placeholder="Part name..."]');
    await nameInput.fill('Chorus');
    await nameInput.press('Enter');
    await expect(page.locator('text=1 part')).toBeVisible();

    // Reload page
    await page.reload();

    // Navigate back — song should still be selected from hash
    await expect(page.locator('text=Song Parts')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=1 part')).toBeVisible({ timeout: 10_000 });
  });

  test('existing parts appear in the dropdown for reuse', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Create first part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await page.locator('text=name...').click();
    await page.locator('text=+ Create new').click();
    const nameInput = page.locator('input[placeholder="Part name..."]');
    await nameInput.fill('Bridge');
    await nameInput.press('Enter');
    await expect(page.locator('text=1 part')).toBeVisible();

    // Create second part
    await page.getByRole('button', { name: '+ Add Part' }).click();
    await page.locator('text=name...').click();

    // The dropdown should show "Bridge" as an existing option
    await expect(page.locator('text=+ Create new')).toBeVisible();
    await expect(page.locator('button:has-text("Bridge")')).toBeVisible();
  });

  test('stance legend is displayed', async ({ page }) => {
    await setupSongDesigner(page);
    await expect(page.locator('text=Right')).toBeVisible();
    await expect(page.locator('text=Left')).toBeVisible();
    await expect(page.locator('text=Centered')).toBeVisible();
  });
});
