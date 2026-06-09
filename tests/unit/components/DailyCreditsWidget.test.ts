/** @jest-environment jsdom */
/**
 * FILE OBJECTIVE:
 * - Entry-point shim that runs DailyCreditsWidget.spec.tsx under the jsdom environment.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | import jest-dom matchers so node-project run also has them
 * - 2026-06-09T00:00:00Z | claude | move jsdom docblock to first line so Jest picks it up
 * - 2026-06-08T00:00:00Z | claude | initial shim for task S1-3
 */

import '@testing-library/jest-dom';
import './DailyCreditsWidget.spec.tsx';
