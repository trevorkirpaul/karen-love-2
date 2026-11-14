import { describe, expect, it, vi } from "vitest";
import {
  ContactConfigurationError,
  escapeHtml,
  formatContactEmailHtml,
  formatContactEmailText,
  sendContactMessage,
} from "@/lib/contact/mailer";

const sampleSubmission = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phoneNumber: "937-555-0100",
  message: "Hello <script>alert('xss')</script>\nLine 2",
};

describe("mailer formatting & escaping", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>"alert('x')" &</script>`)).toBe(
      "&lt;script&gt;&quot;alert(&#39;x&#39;)&quot; &amp;&lt;/script&gt;",
    );
  });

  it("formats plain text email body", () => {
    const text = formatContactEmailText(sampleSubmission);
    expect(text).toContain("karenkirpaul.com Contact Form Message");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("jane@example.com");
    expect(text).toContain("937-555-0100");
  });

  it("escapes user input in HTML email body and converts newlines", () => {
    const html = formatContactEmailHtml(sampleSubmission);
    expect(html).toContain("<h2>karenkirpaul.com Contact Form Message</h2>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;<br />Line 2");
  });
});

describe("sendContactMessage", () => {
  it("uses log channel in non-production when no transport is configured", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await sendContactMessage(sampleSubmission, { NODE_ENV: "test" });
    expect(result).toEqual({ channel: "log" });
    infoSpy.mockRestore();
  });

  it("throws ContactConfigurationError in production when no transport is configured", async () => {
    await expect(
      sendContactMessage(sampleSubmission, { NODE_ENV: "production" }),
    ).rejects.toBeInstanceOf(ContactConfigurationError);
  });

  it("throws ContactConfigurationError when SMTP_HOST is set without recipient/sender", async () => {
    await expect(
      sendContactMessage(sampleSubmission, { SMTP_HOST: "smtp.example.com" }),
    ).rejects.toBeInstanceOf(ContactConfigurationError);
  });

  it("delivers via Resend API to multiple comma-separated recipients", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendContactMessage(sampleSubmission, {
      RESEND_API_KEY: "re_test_key",
      CONTACT_FROM_EMAIL: "website@karenkirpaul.com",
      CONTACT_TO_EMAIL: "office@karenkirpaul.com, backup@karenkirpaul.com ",
    });

    expect(result).toEqual({ channel: "resend" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"to":["office@karenkirpaul.com","backup@karenkirpaul.com"]'),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("delivers via Resend API when RESEND_API_KEY is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendContactMessage(sampleSubmission, {
      RESEND_API_KEY: "re_test_key",
      CONTACT_FROM_EMAIL: "website@karenkirpaul.com",
      CONTACT_TO_EMAIL: "office@karenkirpaul.com",
    });

    expect(result).toEqual({ channel: "resend" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("throws ContactConfigurationError when RESEND_API_KEY is set without sender/recipient", async () => {
    await expect(
      sendContactMessage(sampleSubmission, { RESEND_API_KEY: "re_test_key" }),
    ).rejects.toBeInstanceOf(ContactConfigurationError);
  });

  it("delivers via webhook when CONTACT_WEBHOOK_URL is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendContactMessage(sampleSubmission, {
      CONTACT_WEBHOOK_URL: "https://hooks.example.com/contact",
    });

    expect(result).toEqual({ channel: "webhook" });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
