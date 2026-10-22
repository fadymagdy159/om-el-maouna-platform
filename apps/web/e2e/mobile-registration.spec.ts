import { test, expect, chromium, webkit, devices } from '@playwright/test';
test.skip(process.env.COMMUNITY_LIVE !== '1', 'Isolated community database only.');
for (const engine of ['chromium', 'webkit'] as const)
  test(`mobile registration, confirmation and login over LAN: ${engine}`, async () => {
    test.setTimeout(60000);
    const browser = await (engine === 'webkit'
      ? webkit.launch({ channel: undefined })
      : chromium.launch({ channel: 'chrome' }));
    try {
      const context = await browser.newContext({
        ...devices['iPhone 13'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL,
      });
      const page = await context.newPage();
      const email = `mobile-${engine}-${Date.now()}@example.invalid`,
        password = 'MobileRegistrationFixture-4831';
      await page.goto('/ar/register');
      await page.locator('#signup-name').fill('Mobile registration test');
      await page.locator('#signup-email').fill(email);
      await page.locator('#new-password').fill(password);
      await page.locator('#repeat-password').fill(password);
      const response = page.waitForResponse(
        (r) => r.url().endsWith('/api/v1/auth/register') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'إنشاء حساب', exact: true }).click();
      const result = await response;
      expect(result.status(), await result.text()).toBe(200);
      await page.goto('/ar/signin');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: 'إظهار', exact: true }).click();
      await expect(page.locator('#password')).toHaveAttribute('type', 'text');
      await page.getByRole('button', { name: 'إخفاء', exact: true }).click();
      await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
      await expect(page).toHaveURL(/\/ar\/confirm-email/);
      expect((await page.request.get('/api/v1/me/profile')).status()).toBe(401);
      await page.getByRole('button', { name: 'تأكيد البريد', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('تم تأكيد بريدك');
      await page.goto('/ar/signin');
      await page.locator('input[type=email]').fill(email);
      await page.locator('input[type=password]').fill(password);
      await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
      await expect(page).toHaveURL(/\/ar\/account$/);
      await page.goto('/ar/register');
      await page.locator('#signup-name').fill('Do not replace existing profile');
      await page.locator('#signup-email').fill(email);
      await page.locator('#new-password').fill(password);
      await page.locator('#repeat-password').fill(password);
      await page.getByRole('button', { name: 'إنشاء حساب', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('حسابك موجود ومفعّل بالفعل');
      await expect(page.getByText('البريد في وضع التجربة المحلية', { exact: true })).toHaveCount(0);
    } finally {
      await browser.close();
    }
  });
