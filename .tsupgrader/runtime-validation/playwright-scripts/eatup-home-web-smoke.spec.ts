import { test, expect } from '@playwright/test';

test.use({ channel: 'msedge' });

test('eatup-home-web-smoke', async ({ page }) => {
  await page.route("**/*", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === "http://localhost:8082") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto('http://localhost:8082');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('heading', { name: 'EatUp' })).toBeVisible();
});
