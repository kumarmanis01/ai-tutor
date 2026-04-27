/**
 * FILE OBJECTIVE:
 * - Provide ambient module declarations for React Email packages used by mail templates.
 *
 * LINKED UNIT TEST:
 * - __tests__/declarations.d.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T20:26:00Z | copilot | add module declarations for @react-email/components and @react-email/render
 */

declare module '@react-email/components' {
  import type { ComponentType } from 'react';

  export const Body: ComponentType<any>;
  export const Button: ComponentType<any>;
  export const Column: ComponentType<any>;
  export const Container: ComponentType<any>;
  export const Head: ComponentType<any>;
  export const Heading: ComponentType<any>;
  export const Html: ComponentType<any>;
  export const Img: ComponentType<any>;
  export const Preview: ComponentType<any>;
  export const Row: ComponentType<any>;
  export const Section: ComponentType<any>;
  export const Text: ComponentType<any>;
}

declare module '@react-email/render' {
  import type * as React from 'react';
  export function render(element: React.ReactElement, options?: { plainText?: boolean }): Promise<string>;
}
