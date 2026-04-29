/**
 * FILE OBJECTIVE:
 * - Unit tests for the root `app/layout.tsx` to ensure deterministic html/body
 *   attributes are rendered and to catch hydration-mismatch regressions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/layout.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | add layout rendering assertions
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from '../../../app/layout';

describe('RootLayout', () => {
  it('renders html lang and stable html/body class attributes', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );

    expect(markup).toMatch(/<html[^>]*lang="en"/);
    // html should contain the h-full class and at least one font variable token
    expect(markup).toMatch(/<html[^>]*class="[^"]*h-full[^"]*"/);
    // body should include base tailwind classes used by the app
    expect(markup).toMatch(/<body[^>]*class="[^"]*font-sans[^"]*antialiased[^"]*h-full[^"]*"/);
    expect(markup).toContain('child');
  });
});
