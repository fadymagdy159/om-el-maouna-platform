import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Profile } from '../src/features/identity/profile-editor';

test('regular sign in opens a personal profile without requesting administration', async ({
  page,
}) => {
  let authenticated = false;
  let adminRequested = false;
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.includes('/admin/')) adminRequested = true;
    if (p.endsWith('/csrf')) return route.fulfill({ json: { token: 'fixture' } });
    if (p.endsWith('/auth/login')) {
      authenticated = true;
      return route.fulfill({ json: { requiresMfa: false } });
    }
    if (!authenticated) return route.fulfill({ status: 401 });
    if (p.endsWith('/me'))
      return route.fulfill({
        json: { displayName: 'Member', isAdministrator: false, mfaVerified: false },
      });
    return route.fulfill({
      json: {
        displayName: 'Member',
        email: 'member@example.invalid',
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
        age: null,
        avatarVersion: null,
        isAdministrator: false,
      },
    });
  });
  await page.goto('/en/signin');
  await page.getByLabel('Email address', { exact: true }).fill('member@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('FixtureOnlyPassword');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Member');
  expect(adminRequested).toBeFalsy();
});

// UI fixtures do not log into or modify the user's development administrator.
test('profile edits persist in the UI and update the header on mobile', async ({ page }) => {
  let profile: Profile = {
    displayName: 'مدير تجريبي',
    email: 'demo@example.invalid',
    phoneNumber: null,
    dateOfBirth: null,
    gender: null,
    age: null,
    avatarVersion: null,
    isAdministrator: true,
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/csrf')) return route.fulfill({ json: { token: 'ui-fixture' } });
    if (url.pathname.endsWith('/me/profile')) {
      if (route.request().method() === 'PUT')
        profile = { ...profile, ...route.request().postDataJSON(), age: 26 };
      return route.fulfill({ json: profile });
    }
    if (url.pathname.endsWith('/me/avatar')) {
      if (route.request().method() === 'GET')
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#377b55"/></svg>',
        });
      profile = {
        ...profile,
        avatarVersion: route.request().method() === 'DELETE' ? null : 'photo-v1',
      };
      return route.request().method() === 'DELETE'
        ? route.fulfill({ status: 204 })
        : route.fulfill({ json: profile });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar/account');
  await expect(page.getByLabel('الاسم', { exact: true })).toHaveValue('مدير تجريبي');
  await page.getByLabel('الاسم', { exact: true }).fill('مدير المؤسسة');
  await page.getByLabel('رقم التليفون (اختياري)').fill('+201001234567');
  await page.getByLabel('تاريخ الميلاد (اختياري)').fill('2000-03-15');
  await page.getByLabel('النوع (اختياري)').selectOption('Male');
  await page.getByRole('button', { name: 'حفظ بياناتي', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('تم حفظ بياناتك.');
  await expect(page.locator('.account-entry')).toContainText('مدير المؤسسة');
  await page.reload();
  await expect(page.getByLabel('الاسم', { exact: true })).toHaveValue('مدير المؤسسة');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('الصورة الشخصية', { exact: true }).setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('status')).toHaveText('تم تحديث صورتك الشخصية.');
  await expect(page.locator('.profile-photo-row img')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await mkdir(path.resolve(__dirname, '../../../work'), { recursive: true });
  await page.screenshot({ path: path.resolve(__dirname, '../../../work/profile-mobile.png'), fullPage: true });
});

test('archive has a count and restoring a program returns it to active drafts', async ({
  page,
}) => {
  const row = {
    id: 'fixture',
    category: 'Education',
    status: 'Archived',
    version: 1,
    sortOrder: 0,
    acceptsSupportRequests: false,
    translations: [
      {
        locale: 'ar',
        title: 'برنامج مؤرشف للتجربة',
        slug: 'demo',
        summary: '',
        body: '',
        eligibilityText: '',
      },
      {
        locale: 'en',
        title: 'Archived demo',
        slug: 'demo',
        summary: '',
        body: '',
        eligibilityText: '',
      },
    ],
  };
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/csrf')) return route.fulfill({ json: { token: 'ui-fixture' } });
    if (p.endsWith('/me'))
      return route.fulfill({
        json: { displayName: 'Demo administrator', isAdministrator: true, mfaVerified: true },
      });
    if (p.endsWith('/me/profile')) return route.fulfill({ status: 401 });
    if (p.endsWith('/admin/overview'))
      return route.fulfill({ json: { programs: 1, publishedPrograms: 0, users: 0 } });
    if (p.endsWith('/admin/programs')) return route.fulfill({ json: [row] });
    if (p.endsWith('/restore')) {
      row.status = 'Draft';
      row.version++;
      return route.fulfill({ json: row });
    }
    return route.continue();
  });
  await page.goto('/ar/admin/archive');
  await expect(page.getByRole('heading', { name: 'البرامج المؤرشفة', exact: true })).toBeVisible();
  await expect(page.locator('.admin-tabs .active')).toContainText('1');
  await expect(page.getByRole('heading', { name: 'برنامج مؤرشف للتجربة' })).toBeVisible();
  await page.getByRole('button', { name: 'استعادة كمسودة', exact: true }).click();
  await expect(page.locator('.admin-tabs .active')).toContainText('0');
  await expect(page.getByText('الأرشيف فارغ.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'البرامج النشطة', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'برنامج مؤرشف للتجربة' })).toBeVisible();
  await expect(page.locator('.program-admin-row .badge')).toHaveText('مسودة');
});
