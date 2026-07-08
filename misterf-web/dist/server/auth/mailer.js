import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { translate } from '../i18n/index.js';
export async function sendEmailVerification(user, code, locale = 'es') {
    const t = (key, params) => translate(locale, key, params);
    await sendMail({
        to: user.email,
        subject: t('email.verifySubject'),
        text: [
            t('email.greeting', { name: user.fullName }),
            '',
            t('email.verifyCodeLine', { code }),
            '',
            t('email.verifyTtlLine'),
            '',
            t('email.signature'),
        ].join('\n'),
        html: renderCodeEmail({
            code,
            intro: t('email.verifyIntro', { name: escapeHtml(user.fullName) }),
            title: t('email.verifyTitle'),
            ttl: t('email.ttl24'),
            expiresNote: t('email.expiresNote', { ttl: t('email.ttl24') }),
        }),
    });
}
export async function sendPasswordReset(user, code, locale = 'es') {
    const t = (key, params) => translate(locale, key, params);
    await sendMail({
        to: user.email,
        subject: t('email.resetSubject'),
        text: [
            t('email.greeting', { name: user.fullName }),
            '',
            t('email.resetCodeLine', { code }),
            '',
            t('email.resetTtlLine'),
            '',
            t('email.signature'),
        ].join('\n'),
        html: renderCodeEmail({
            code,
            intro: t('email.resetIntro', { name: escapeHtml(user.fullName) }),
            title: t('email.resetTitle'),
            ttl: t('email.ttl1'),
            expiresNote: t('email.expiresNote', { ttl: t('email.ttl1') }),
        }),
    });
}
export function isMailerConfigured() {
    return Boolean(env.smtpHost &&
        env.smtpUser &&
        env.smtpPassword &&
        env.mailFrom);
}
export function getMailerConfigurationError(locale = 'es') {
    return translate(locale, 'email.configError');
}
async function sendMail(message) {
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
function requireMailConfig(name, value) {
    if (!value) {
        throw new Error(`${name} is required to send email.`);
    }
    return value;
}
function renderCodeEmail(input) {
    return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:32px;background:#f7f7f7;color:#222;font-family:Georgia,'Times New Roman',serif;">
        <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;padding:32px;">
          <p style="margin:0 0 8px;color:#eb6864;">Mister F</p>
          <h1 style="margin:0 0 18px;font-size:30px;font-weight:400;">${input.title}</h1>
          <p style="font-size:17px;line-height:1.5;">${input.intro}</p>
          <p style="margin:28px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;letter-spacing:6px;color:#1f6f8b;">${input.code}</p>
          <p style="font-size:15px;line-height:1.5;color:#666;">${input.expiresNote}</p>
        </main>
      </body>
    </html>
  `;
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
//# sourceMappingURL=mailer.js.map