import { test, expect } from '@playwright/test';
test('repeat registration directs existing users to sign in or recovery without claiming mail was sent', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/csrf')) return route.fulfill({ json: { token: 'fixture' } });
    if (p.endsWith('/auth/register'))
      return route.fulfill({ json: { accepted: true, delivery: 'LocalPreview' } });
    return route.fulfill({ status: 401 });
  });
  await page.goto('/en/register');
  await page.locator('#signup-name').fill('Existing member');
  await page.locator('#signup-email').fill('existing@example.invalid');
  await page.locator('#new-password').fill('ExistingMemberFixture-4831');
  await page.locator('#repeat-password').fill('ExistingMemberFixture-4831');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Continue to your account');
  await expect(
    page.locator('.auth-card').getByRole('link', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?', exact: true })).toBeVisible();
  await expect(page.getByText('Local email preview', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
});
