'use strict';
/**
 * ESLint rule: no-direct-mailer-send
 * Bans importing sendMail, sendMailSafe, or sendEmail from @/lib/mailer or lib/mailer.ts.
 * All email sends must go through sendEmailUnified or sendEmailUnifiedSafe from @/lib/mail.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban direct use of sendMail/sendMailSafe from lib/mailer. Use sendEmailUnified/sendEmailUnifiedSafe from lib/mail instead.',
      recommended: true,
    },
    messages: {
      noDirectMailer:
        "Import '{{ name }}' from '@/lib/mail' instead of '@/lib/mailer'. Use sendEmailUnified or sendEmailUnifiedSafe.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        const isMailer =
          src === '@/lib/mailer' ||
          src === '@/lib/mailer.js' ||
          src === '../../lib/mailer' ||
          src === '../../lib/mailer.js' ||
          src === '../../../lib/mailer' ||
          src === '../../../lib/mailer.js';
        if (!isMailer) return;
        const banned = ['sendMail', 'sendMailSafe', 'sendEmail'];
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            banned.includes(specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'noDirectMailer',
              data: { name: specifier.imported.name },
            });
          }
        }
      },
    };
  },
};
