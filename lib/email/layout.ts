/**
 * FILE OBJECTIVE:
 * - Centralised header/footer and shared email primitives used by all
 *   email templates (student, parent, admin).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/layout.spec.ts (not included)
 *
 * EDIT LOG:
 * - 2026-05-20T00:00:00Z | copilot | created shared email layout primitives
 */

export const BASE = [
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
  'max-width:520px;',
  'margin:0 auto;',
  'color:#1a1a1a;',
  'padding:0 8px;',
].join('')

export const BTN = [
  'display:inline-block;',
  'padding:12px 28px;',
  'background:#534AB7;',
  'color:#ffffff;',
  'text-decoration:none;',
  'border-radius:8px;',
  'font-weight:600;',
  'font-size:15px;',
].join('')

export const FOOTER = `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;margin-top:32px;padding-top:16px;">
    <tr>
      <td style="text-align:left;color:#888;font-size:12px;">Spinzy Academy</td>
      <td style="text-align:center;color:#888;font-size:12px;">
        <a href="https://spinzyacademy.com" style="color:#888;text-decoration:none;">https://spinzyacademy.com</a>
      </td>
      <td style="text-align:right;color:#888;font-size:12px;">
        <a href="https://spinzyacademy.com/privacy" style="color:#888;text-decoration:none;">Privacy</a>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="color:#888;font-size:12px;padding-top:8px;">
        You are receiving this because you have a Spinzy Academy account.
      </td>
    </tr>
  </table>
`

export const LOGO = `
  <img src="https://spinzyacademy.com/logos/logo-email.png"
       alt="Spinzy Academy" height="40"
       style="margin-bottom:24px;display:block;">
`

// Mobile viewport + dark-mode-aware styles for email clients that
// respect them (Apple Mail, Outlook on macOS / iOS, Gmail mobile). Other
// clients ignore the tags safely. Inject once per email body.
export const EMAIL_HEAD = `
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @media (prefers-color-scheme: dark) {
      body, .spinzy-card { background:#1a1a1a !important; color:#f1f1f1 !important; }
      a { color:#a8a3ff !important; }
    }
    @media (max-width: 480px) {
      .spinzy-card { padding:10px !important; }
    }
  </style>
`
