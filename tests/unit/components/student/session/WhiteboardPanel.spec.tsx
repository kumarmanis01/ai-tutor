/** @jest-environment jsdom */
/**
 * FILE OBJECTIVE:
 * - Basic unit test for `WhiteboardPanel` to ensure the component renders without crashing.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/session/WhiteboardPanel.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T12:55:00Z | copilot | add basic render test for WhiteboardPanel
 */

import React from 'react';
import { render } from '@testing-library/react';

import WhiteboardPanel from '@/components/student/session/WhiteboardPanel';

describe('WhiteboardPanel', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <WhiteboardPanel sessionId="s1" conceptName="Fractions" aiSteps={[]} visualHint={null} /> as any,
    );
    expect(container).toBeTruthy();
  });

  it('resolves runtime CSS variable for primary color and applies to swatches', async () => {
    // Set a deterministic runtime CSS variable that the component will read
    document.documentElement.style.setProperty('--color-primary', 'rgb(83,74,183)');
    document.documentElement.style.setProperty('--color-success', 'rgb(29,158,117)');
    document.documentElement.style.setProperty('--color-error', 'rgb(226,75,74)');

    const { findAllByLabelText } = render(
      <WhiteboardPanel sessionId="s1" conceptName="Fractions" aiSteps={[]} visualHint={null} /> as any,
    );

    // Toolbar swatches are rendered with aria-label `Color ${c}`; wait for them
    const swatches = await findAllByLabelText(/Color/);
    // The second swatch should be the primary color (resolved at runtime)
    expect(swatches.length).toBeGreaterThanOrEqual(2);
    const primarySwatch = swatches[1] as HTMLElement;
    // JSDOM normalizes rgb() strings; check computed style
    const bg = primarySwatch.style.backgroundColor || window.getComputedStyle(primarySwatch).backgroundColor;
    expect(bg).toBe('rgb(83, 74, 183)');
  });
});

/** @jest-environment jsdom */