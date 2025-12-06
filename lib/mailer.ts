import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

export function getEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: true,
    requireTLS: true,
    tls: { ciphers: 'SSLv3' },
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
    debug: true,
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  const transporter = getEmailTransporter();
  try {
    // Send the actual email
    const info = await transporter.sendMail({
      from:
        from ||
        process.env.EMAIL_FROM_NOREPLY ||
        `"Spinzy Academy" <${process.env.EMAIL_SERVER_USER}>`,
      to,
      subject,
      html,
      text,
    });
    // Log success info using central logger
    logger.add(`Email sent: ${JSON.stringify(info)}`, { className: 'mailer', methodName: 'sendEmail' });
  } catch (error) {
    // Log any errors using central logger
    logger.add(`Failed to send email: ${String(error)}`, { className: 'mailer', methodName: 'sendEmail' });
    throw error; // Re-throw to let caller handle it
  }
}
