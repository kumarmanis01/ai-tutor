import { test, expect } from '@playwright/test';

// Use local dev server as base URL
test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });

// Helper to stub the four home APIs with provided payloads
async function stubHomeApis(
  page,
  { nextAction = null, todayGoal = {}, learningSnapshot = {}, dailyPlan = {} } = {}
) {
  await page.route('**/api/home/next-action', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(nextAction),
    })
  );

  await page.route('**/api/home/today-goal', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(todayGoal),
    })
  );

  await page.route('**/api/home/learning-snapshot', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(learningSnapshot),
    })
  );

  await page.route('**/api/home/daily-plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dailyPlan),
    })
  );
}

test.describe('Dashboard Home e2e', () => {
  test('New user onboarding shows Start CTA', async ({ page }) => {
    // nextAction intentionally missing fields to simulate new user
    await stubHomeApis(page, {
      nextAction: null,
      todayGoal: { targetMinutes: 0, completedMinutes: 0, streakDays: 0 },
      learningSnapshot: { subjects: [] },
      dailyPlan: { slots: [], assignments: [] },
    });

    await page.goto('/dashboard');

    // CTA should be the fallback "Start Lesson"
    const cta = page.getByRole('button', { name: /Start Lesson/ });
    await expect(cta).toBeVisible();
  });

  test('Weak mastery shows Practice Topic CTA', async ({ page }) => {
    await stubHomeApis(page, {
      nextAction: {
        subject: 'Math',
        chapter: 'Fractions',
        topic: 'Adding Fractions',
        actionType: 'practice',
        progressPct: 20,
        masteryLevel: 'weak',
        ruleId: 'r-weak',
        reasonLabel: 'low-mastery',
      },
      todayGoal: { targetMinutes: 20, completedMinutes: 5, streakDays: 1 },
      learningSnapshot: { subjects: [] },
      dailyPlan: { slots: [], assignments: [] },
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: /Practice Topic/ })).toBeVisible();
  });

  test('Returning after gap shows refresher microcopy in Why tooltip', async ({ page }) => {
    await stubHomeApis(page, {
      nextAction: {
        subject: 'Science',
        chapter: 'Forces',
        topic: 'Gravity refresher',
        actionType: 'lesson',
        progressPct: 10,
        masteryLevel: 'improving',
        ruleId: 'r-return',
        reasonLabel: 'refresher: returning after gap',
      },
      todayGoal: {},
      learningSnapshot: {},
      dailyPlan: {},
    });

    await page.goto('/dashboard');

    const whyButton = page.getByLabel(/Why this\?/);
    await whyButton.focus();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveAttribute('aria-label', /refresher: returning after gap/);
  });

  test('Quick Chat not visible on Home', async ({ page }) => {
    await stubHomeApis(page, {
      nextAction: null,
      todayGoal: {},
      learningSnapshot: {},
      dailyPlan: {},
    });

    await page.goto('/dashboard');

    // Ensure no Quick Chat text exists on the Home page
    const quickChat = page.locator('text=Quick Chat');
    await expect(quickChat).toHaveCount(0);
  });
});
