import { test, expect } from '@playwright/test';
import path from 'node:path';
test('approved homepage artwork, story banner and responsive section cards', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ar');
    await expect(page.locator('.hero-photo .reference-photo')).toBeVisible();
    await expect(page.locator('.participation h2')).toHaveText('كن جزءًا من قصة النجاح');
    for (const image of await page.locator('.reference-photo image').all())
      expect(
        await image.evaluate(
          (el) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img.naturalWidth > 0);
              img.onerror = () => resolve(false);
              img.src = el.getAttribute('href')!;
            }),
        ),
      ).toBeTruthy();
    await expect(page.locator('.pillar-card')).toHaveCount(4);
    const story = page.locator('.success-story-image');
    await story.scrollIntoViewIfNeeded();
    await expect
      .poll(() => story.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBeTruthy();
    await page
      .locator('.participation')
      .screenshot({ path: path.resolve(__dirname, `../../../work/success-story-${width}.png`) });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: path.resolve(__dirname, `../../../work/approved-home-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .locator('.participation')
    .getByRole('link', { name: 'ساهم الآن', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ar\/contribute$/);
});
