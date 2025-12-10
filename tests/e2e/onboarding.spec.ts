import { test, expect } from '@playwright/test';

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
