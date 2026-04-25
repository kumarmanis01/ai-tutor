import { test, expect } from '@playwright/test';

// Simple E2E smoke test: ensure onboarding page loads without a runtime Next error
// and no obvious "global is not defined" client error that breaks rendering.

test('onboarding page does not surface global runtime error', async ({ page }) => {
  const url = process.env.E2E_BASE_URL ?? 'http://localhost:3000/student/onboarding';
  await page.goto(url, { waitUntil: 'networkidle' });
  // give client-side scripts a moment to run
  await page.waitForTimeout(1000);

  // Ensure the Next error page is not shown
  await expect(page.locator('text=Something went wrong!')).toHaveCount(0);
  // Ensure the specific runtime complaint isn't present
  await expect(page.locator('text=global is not defined')).toHaveCount(0);
});
