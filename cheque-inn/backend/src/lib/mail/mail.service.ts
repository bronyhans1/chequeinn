import { ENV, isSmtpConfigured } from "../../config/env";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporterPromise: Promise<{
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) => Promise<unknown>;
} | null> | null = null;

async function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const nodemailer = await import("nodemailer");
      return nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_SECURE,
        auth:
          ENV.SMTP_USER && ENV.SMTP_PASS
            ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS }
            : undefined,
      });
    })();
  }
  return transporterPromise;
}

/**
 * Optional SMTP — no-op when not configured. Failures are logged, not thrown to callers.
 */
export async function sendMailSafe(input: SendMailInput): Promise<boolean> {
  if (!isSmtpConfigured() || !ENV.NOTIFICATION_EMAIL_ENABLED) {
    return false;
  }
  try {
    const transport = await getTransporter();
    if (!transport) return false;
    await transport.sendMail({
      from: ENV.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br/>"),
    });
    return true;
  } catch (err) {
    console.warn("[mail] send failed", err instanceof Error ? err.message : err);
    return false;
  }
}
