/**
 * Outgoing mail hook.
 *
 * No mail library ships with the project, so this is a single seam to plug
 * one in (nodemailer, Resend, SES, …). Until then `mailConfigured()` is false
 * and callers fall back to their development behaviour.
 *
 * Example with nodemailer (`bun add nodemailer`):
 *
 *   import nodemailer from 'nodemailer'
 *   const transport = nodemailer.createTransport({
 *     host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
 *     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
 *   })
 *   export async function sendMail(m: Mail) {
 *     await transport.sendMail({ from: process.env.SMTP_FROM, ...m })
 *   }
 */
export type Mail = { to: string; subject: string; text: string }

export function mailConfigured(): boolean {
  return false
}

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[mailer] (not configured) would send "${mail.subject}" to ${mail.to}`)
  }
}
