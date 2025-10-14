import nodemailer from 'nodemailer';

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
    // Log success info to the server console
    console.log('Email sent:', info);
  } catch (error) {
    // Log any errors to the server console
    console.error('Failed to send email:', error);
    throw error; // Re-throw to let caller handle it
  }
}
