import nodemailer from 'nodemailer';
import { config } from '@docly/config';

// Thin wrapper around SMTP (nodemailer). When SMTP_HOST is unset (local/dev),
// sends are logged instead of attempted, so the auth flows work end-to-end
// without a mail account - this is the only place that decides "send vs. log".
const smtpTransport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    })
  : null;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!smtpTransport) {
    // eslint-disable-next-line no-console
    console.warn(
      `[email:dev] SMTP_HOST not set - logging instead of sending.
To: ${input.to}
Subject: ${input.subject}
${input.html}`
    );
    return;
  }

  await smtpTransport.sendMail({ from: config.EMAIL_FROM, to: input.to, subject: input.subject, html: input.html });
}

export function buildVerificationUrl(token: string): string {
  return `${config.WEB_APP_URL}/verify-email?token=${token}`;
}

export function buildPasswordResetUrl(token: string): string {
  return `${config.WEB_APP_URL}/reset-password?token=${token}`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = buildVerificationUrl(token);
  await sendEmail({
    to,
    subject: 'Verify your email address',
    html: `<p>Welcome to Docly. Confirm your email address to finish setting up your account.</p>
<p><a href="${url}">Verify email address</a></p>
<p>This link expires in ${config.EMAIL_VERIFICATION_EXPIRY}. If you didn't create a Docly account, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = buildPasswordResetUrl(token);
  await sendEmail({
    to,
    subject: 'Reset your password',
    html: `<p>We received a request to reset the password for your Docly account.</p>
<p><a href="${url}">Reset password</a></p>
<p>This link expires in ${config.PASSWORD_RESET_EXPIRY} and can only be used once. If you didn't request this, you can ignore this email - your password won't change.</p>`,
  });
}
