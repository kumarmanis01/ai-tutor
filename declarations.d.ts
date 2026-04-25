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
