import nodemailer from "nodemailer"

export type EmailSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string }

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (!value) return fallback
  return value === "true" || value === "1" || value.toLowerCase() === "yes"
}

function createTransport() {
  const host = requireEnv("SMTP_HOST")
  const port = Number(process.env.SMTP_PORT ?? "587")
  const secure = parseBool(process.env.SMTP_SECURE, port === 465)
  const rejectUnauthorized = parseBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true)

  const user = requireEnv("SMTP_USER")
  const pass = requireEnv("SMTP_PASS")

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  })
}

export async function sendEmail(args: { to: string; subject: string; text: string; html?: string | null }): Promise<EmailSendResult> {
  try {
    const from = requireEnv("EMAIL_FROM")
    const replyTo = process.env.EMAIL_REPLY_TO
    const transporter = createTransport()
    const info = await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html ?? undefined,
      replyTo: replyTo || undefined,
    })
    return { ok: true, messageId: info.messageId }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Email send failed" }
  }
}
