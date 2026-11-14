import nodemailer from "nodemailer";
import type { ContactSubmission } from "./schema";

export interface DeliveryResult {
  channel: "resend" | "smtp" | "webhook" | "log";
}

export class ContactConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactConfigurationError";
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatContactEmailText(submission: ContactSubmission): string {
  return [
    `New contact form message from ${submission.firstName} ${submission.lastName}`,
    "",
    `Name: ${submission.firstName} ${submission.lastName}`,
    `Email: ${submission.email}`,
    `Phone: ${submission.phoneNumber || "Not provided"}`,
    "",
    "Message:",
    submission.message,
  ].join("\n");
}

export function formatContactEmailHtml(submission: ContactSubmission): string {
  const fullName = escapeHtml(`${submission.firstName} ${submission.lastName}`);
  const email = escapeHtml(submission.email);
  const phone = escapeHtml(submission.phoneNumber || "Not provided");
  const message = escapeHtml(submission.message).replaceAll("\n", "<br />");

  return `
    <h2>New Contact Form Message</h2>
    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <hr />
    <p><strong>Message:</strong></p>
    <p>${message}</p>
  `.trim();
}

export async function sendContactMessage(
  submission: ContactSubmission,
  env: Record<string, string | undefined> = process.env,
): Promise<DeliveryResult> {
  if (env.RESEND_API_KEY) {
    const to = env.CONTACT_TO_EMAIL;
    const from = env.CONTACT_FROM_EMAIL;

    if (!to || !from) {
      throw new ContactConfigurationError(
        "RESEND_API_KEY is set, but CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL is missing.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: submission.email,
        subject: `Website Contact: ${submission.firstName} ${submission.lastName}`,
        text: formatContactEmailText(submission),
        html: formatContactEmailHtml(submission),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Resend API error (${response.status}): ${errorBody}`);
    }

    return { channel: "resend" };
  }

  if (env.SMTP_HOST) {
    const port = Number.parseInt(env.SMTP_PORT ?? "587", 10);
    const secure = env.SMTP_SECURE === "true" || port === 465;
    const to = env.CONTACT_TO_EMAIL;
    const from = env.CONTACT_FROM_EMAIL ?? env.SMTP_USER;

    if (!to || !from) {
      throw new ContactConfigurationError(
        "SMTP_HOST is set, but CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL is missing.",
      );
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      replyTo: submission.email,
      subject: `Website Contact: ${submission.firstName} ${submission.lastName}`,
      text: formatContactEmailText(submission),
      html: formatContactEmailHtml(submission),
    });

    return { channel: "smtp" };
  }

  if (env.CONTACT_WEBHOOK_URL) {
    const response = await fetch(env.CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        source: "karen-kirpaul-website",
        submittedAt: new Date().toISOString(),
        ...submission,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    return { channel: "webhook" };
  }

  if (env.NODE_ENV === "production" && env.ALLOW_LOG_ONLY_CONTACT !== "true") {
    throw new ContactConfigurationError(
      "Contact delivery is not configured. Set SMTP_HOST or CONTACT_WEBHOOK_URL.",
    );
  }

  console.info("[contact] Delivery in log-only mode:", {
    firstName: submission.firstName,
    lastName: submission.lastName,
    email: submission.email,
    hasPhone: Boolean(submission.phoneNumber),
    messageLength: submission.message.length,
  });

  return { channel: "log" };
}
