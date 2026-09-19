import { expect, type Page, test } from '@playwright/test';

import { readKaplayMatchResultSelectedValue } from '../support/kaplay-layout-evidence';

const renderBridge = async (
  page: Page,
  checkedValue: 'draw' | 'team1' | 'team2' | null,
) => {
  await page.setContent(`
    <fieldset data-testid="kaplay-match-result-choice-bridge">
      <label>
        <input
          ${checkedValue === 'team1' ? 'checked' : ''}
          name="kaplay-match-result-choice"
          type="radio"
          value="team1"
        />
        Team 1
      </label>
      <label>
        <input
          ${checkedValue === 'team2' ? 'checked' : ''}
          name="kaplay-match-result-choice"
          type="radio"
          value="team2"
        />
        Team 2
      </label>
      <label>
        <input
          ${checkedValue === 'draw' ? 'checked' : ''}
          name="kaplay-match-result-choice"
          type="radio"
          value="draw"
        />
        Draw
      </label>
    </fieldset>
  `);
};

test.describe('Kaplay layout evidence selected-value read', () => {
  test('returns null immediately for a ready bridge with no checked input', async ({
    page,
  }) => {
    await renderBridge(page, null);

    await expect(
      readKaplayMatchResultSelectedValue(page, { timeoutMs: 1_000 }),
    ).resolves.toBeNull();
    await expect(page.locator('input:checked')).toHaveCount(0);
    expect(page.isClosed()).toBe(false);
  });

  for (const selectedValue of ['team1', 'team2', 'draw'] as const) {
    test(`returns ${selectedValue} for the current checked input`, async ({
      page,
    }) => {
      await renderBridge(page, selectedValue);

      await expect(
        readKaplayMatchResultSelectedValue(page, { timeoutMs: 1_000 }),
      ).resolves.toBe(selectedValue);
      await expect(
        page.locator(`input[value="${selectedValue}"]`),
      ).toBeChecked();
    });
  }

  test('fails when the required bridge is missing', async ({ page }) => {
    await page.setContent('<main>No Kaplay bridge here.</main>');

    await expect(
      readKaplayMatchResultSelectedValue(page, { timeoutMs: 250 }),
    ).rejects.toThrow(/kaplay-match-result-choice-bridge|locator/i);
  });

  test('fails when the page is already closed', async ({ page }) => {
    await renderBridge(page, null);
    await page.close();

    await expect(
      readKaplayMatchResultSelectedValue(page, { timeoutMs: 1_000 }),
    ).rejects.toThrow(/closed|Target page/i);
  });
});
