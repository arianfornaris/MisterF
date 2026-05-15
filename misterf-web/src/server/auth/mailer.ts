import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import type { AuthUser } from './repository.js';

type MailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export async function sendEmailVerification(
  user: AuthUser,
  code: string,
): Promise<void> {
  await sendMail({
    to: user.email,
    subject: 'Tu código de verificación de Mister F',
    text: [
      `Hola ${user.fullName},`,
      '',
      `Tu código de verificación es: ${code}`,
      '',
      'El código vence en 24 horas.',
      '',
      'Mister F',
    ].join('\n'),
    html: renderCodeEmail({
      code,
      intro: `Hola ${escapeHtml(user.fullName)}, usa este código para verificar tu correo.`,
      title: 'Verifica tu correo',
      ttl: '24 horas',
    }),
  });
}

export async function sendPasswordReset(
  user: AuthUser,
  code: string,
): Promise<void> {
  await sendMail({
    to: user.email,
    subject: 'Tu código para cambiar el password de Mister F',
    text: [
      `Hola ${user.fullName},`,
      '',
      `Tu código para cambiar el password es: ${code}`,
      '',
      'El código vence en 1 hora. Si no pediste este cambio, ignora este email.',
      '',
      'Mister F',
    ].join('\n'),
    html: renderCodeEmail({
      code,
      intro: `Hola ${escapeHtml(user.fullName)}, usa este código para cambiar tu password.`,
      title: 'Cambia tu password',
      ttl: '1 hora',
    }),
  });
}

export function isMailerConfigured(): boolean {
  return Boolean(
    env.smtpHost &&
      env.smtpUser &&
      env.smtpPassword &&
      env.mailFrom,
  );
}

export function getMailerConfigurationError(): string {
  return 'Falta configurar SMTP_HOST, SMTP_USER, SMTP_PASSWORD o RESEND_SMTP_API_KEY, y MAIL_FROM en ecosystem.config.cjs.';
}

async function sendMail(message: MailMessage): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: requireMailConfig('SMTP_HOST', env.smtpHost),
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: requireMailConfig('SMTP_USER', env.smtpUser),
      pass: requireMailConfig('SMTP_PASSWORD', env.smtpPassword),
    },
  });

  await transporter.sendMail({
    from: requireMailConfig('MAIL_FROM', env.mailFrom),
    html: message.html,
    subject: message.subject,
    text: message.text,
    to: message.to,
  });
}

function requireMailConfig(name: string, value: string): string {
  if (!value) {
    throw new Error(`${name} is required to send email.`);
  }

  return value;
}

function renderCodeEmail(input: {
  code: string;
  intro: string;
  title: string;
  ttl: string;
}): string {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:32px;background:#f7f7f7;color:#222;font-family:Georgia,'Times New Roman',serif;">
        <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;padding:32px;">
          <p style="margin:0 0 8px;color:#eb6864;">Mister F</p>
          <h1 style="margin:0 0 18px;font-size:30px;font-weight:400;">${input.title}</h1>
          <p style="font-size:17px;line-height:1.5;">${input.intro}</p>
          <p style="margin:28px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;letter-spacing:6px;color:#1f6f8b;">${input.code}</p>
          <p style="font-size:15px;line-height:1.5;color:#666;">Este código vence en ${input.ttl}. No compartas este código con nadie.</p>
        </main>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
