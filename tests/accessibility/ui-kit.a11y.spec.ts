import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const shouldRun = Boolean(process.env.PLAYWRIGHT_ACCESSIBILITY ?? process.env.CI);

test.describe('Accessibility smoke', () => {
  test.skip(!shouldRun, 'Accessibility checks disabled outside CI/opt-in runs.');

  test('ui kit has no serious violations', async ({ page }) => {
    await page.goto('/ui-kit');
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const failures =
      results.violations?.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ) ?? [];
    const message =
      failures.length === 0
        ? ''
        : failures
            .map(
              (violation) =>
                `${violation.id}: ${violation.nodes
                  .map((node) => node.target.join(', '))
                  .join(' | ')}`,
            )
            .join('\n');
    expect(failures, `Serious/critical accessibility violations:\n${message}`).toHaveLength(0);
  });
});
