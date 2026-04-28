/**
 * FILE OBJECTIVE:
 * - Provide ambient module declarations for external libraries used in the project.
 *
 * LINKED UNIT TEST:
 * - __tests__/declarations.d.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T20:22:00Z | copilot | normalize ambient declarations and move React Email module typings into types/
 */

declare module '*.json' {
  const value: string[];
  export default value;
}

declare module '@sentry/nextjs';

// Auto-declarations for third-party modules that may not ship TypeScript types
declare module 'resend' {
  export type ResendEmailSendOptions = {
    from?: string;
    to: string[];
    subject?: string;
    html?: string;
    text?: string;
    reply_to?: string;
    cc?: string[];
    [key: string]: any;
  };

  export type ResendSendResult = {
    data?: { id?: string } | null;
    error?: { message?: string } | null;
  };

  export class Resend {
    constructor(apiKey?: string);
    emails: {
      send(opts: ResendEmailSendOptions): Promise<ResendSendResult>;
    };
  }

  export default Resend;
}
declare module 'web-push';
declare module '@anthropic-ai/sdk';
