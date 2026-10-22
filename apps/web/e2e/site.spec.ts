import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test('published program links open their details, including Arabic slugs', async ({
  page,
  request,
}) => {
  for (const locale of ['ar', 'en']) {
    const response = await request.get(`/api/v1/programs?locale=${locale}`);
    expect(response.ok()).toBeTruthy();
    const { items } = await response.json();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      await page.goto(`/${locale}/programs`);
      await page
        .locator('.program-detail-card')
        .filter({
          has: page.getByRole('heading', { name: item.title, exact: true }),
        })
        .click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title);
    }
  }
});

test('public journey works in both languages with the same program', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('إحنا بنبني مستقبل');
  await page.getByRole('link', { name: 'اكتشف برامجنا', exact: true }).first().click();
  await expect(page.locator('.program-detail-card')).toHaveCount(4);
  await page.locator('.program-detail-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('التعليم');
  await expect(page).toHaveURL(/\/ar\/programs\/education$/);
  const originalPath = new URL(page.url()).pathname.replace('/ar/', '/en/');
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(originalPath + '$'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Education');
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 768, 1280]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/ar');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    if (width < 640) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await expect(page.locator('#mobile-nav')).toBeVisible();
      await page.locator('#mobile-nav').getByRole('link', { name: 'برامجنا', exact: true }).click();
      await expect(page.locator('.program-detail-card')).toHaveCount(4);
    } else if (width === 1280) {
      await mkdir(path.resolve(__dirname, '../../../work'), { recursive: true });
      await page.screenshot({
        path: path.resolve(__dirname, '../../../work/home-desktop.png'),
        fullPage: true,
      });
    }
    if (width === 390) {
      await page.goto('/ar');
      await page.screenshot({
        path: path.resolve(__dirname, '../../../work/home-mobile.png'),
        fullPage: true,
      });
    }
  });
}

test('administration requires sign in and unknown content is not exposed', async ({ page }) => {
  await page.goto('/ar/admin');
  await expect(page.getByLabel('البريد الإلكتروني', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'برنامج جديد', exact: true })).toHaveCount(0);
  await page.goto('/ar/programs/this-program-does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Page not found');
});

test('all four homepage sections open content with photographs and a working viewer', async ({
  page,
}) => {
  for (let index = 0; index < 4; index++) {
    await page.goto('/ar');
    const card = page.locator('.pillar-card').nth(index);
    const title = await card.locator('h3').innerText();
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('.prose-text')).not.toBeEmpty();
    expect(
      await page.locator('.program-photo-section .gallery-card').count(),
    ).toBeGreaterThanOrEqual(3);
    await page.locator('.program-photo-section .gallery-card').first().click();
    await expect(page.getByRole('dialog', { name: 'عارض الصور' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/programs/education');
  await expect(page.locator('.program-photo-section .gallery-card').first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('program contact action opens the contact form on the configured host', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar/programs/education');
  await page
    .locator('article.reading-content')
    .getByRole('link', { name: 'تواصل معنا', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ar\/contact$/);
  await expect(page.getByRole('heading', { name: 'اكتب رسالتك', exact: true })).toBeVisible();
  await expect(page.locator('#request-description')).toBeVisible();
  let submittedKey = '';
  await page.route('**/api/v1/contact', async (route) => {
    submittedKey = route.request().postDataJSON().submissionKey;
    await route.fulfill({ json: { reference: 'MOBILE-PREVIEW-TEST', delivery: 'LocalPreview' } });
  });
  await page.locator('#applicant-name').fill('Mobile preview test');
  await page.locator('#applicant-email').fill('mobile-preview@example.invalid');
  await page
    .locator('#request-description')
    .fill('I would like to ask about foundation activities and services.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'إرسال الطلب', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('MOBILE-PREVIEW-TEST');
  expect(submittedKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(errors).toEqual([]);
});
