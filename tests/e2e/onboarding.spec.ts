let playwrightAvailable = true;
try {
  require.resolve('@playwright/test');
} catch {
  playwrightAvailable = false;
}

if (!playwrightAvailable) {
  // If Playwright isn't installed in this environment, register a skipped Jest test.
  // This keeps CI/dev runs stable when E2E tooling isn't present while marking the
  // suite as intentionally skipped instead of failing due to zero tests.
  // eslint-disable-next-line no-console
  console.warn('Skipping E2E onboarding.spec.ts: @playwright/test not installed');
   
  test.skip('skipped E2E onboarding: @playwright/test not installed', () => {});
} else {
  // Import lazily so the file can be parsed when Playwright is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { test, expect } = require('@playwright/test');

  // Basic e2e check: open/close onboarding modal via Profile page trigger
  // Assumes the Profile page renders a button that calls useOnboarding().open({ force: true })
  test.describe('Onboarding modal', () => {
    test('opens from Profile and can be closed', async ({ page }) => {
      await page.goto('/profile');

      // Click the Update Profile button to open onboarding
      const trigger = page.getByRole('button', { name: /update profile/i });
      await expect(trigger).toBeVisible();
      await trigger.click();

      // Modal should appear
      const heading = page.getByRole('heading', { name: /complete your profile/i });
      await expect(heading).toBeVisible();

      // Close via Cancel
      const cancel = page.getByRole('button', { name: /cancel/i });
      await expect(cancel).toBeVisible();
      await cancel.click();

      // Modal should disappear
      await expect(heading).toBeHidden();
    });
  });
}
