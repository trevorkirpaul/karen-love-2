import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactConfigurationError } from "@/lib/contact/mailer";
import { clearRateLimitStore } from "@/lib/contact/rate-limit";
import { handleContactPost } from "@/pages/api/contact";

function makeJsonRequest(body: unknown, ip = "203.0.113.10"): Request {
  return new Request("https://example.com/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact handler", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("delivers a valid JSON submission and returns 200", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ channel: "smtp" });
    const response = await handleContactPost(
      makeJsonRequest({
        email: "patient@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: "937-555-0100",
        message: "Looking to schedule a consultation.",
      }),
      undefined,
      { sendMessage },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      email: "patient@example.com",
      firstName: "Jane",
      lastName: "Doe",
      phoneNumber: "937-555-0100",
      message: "Looking to schedule a consultation.",
    });
  });

  it("supports application/x-www-form-urlencoded submissions", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ channel: "log" });
    const params = new URLSearchParams({
      email: "patient@example.com",
      firstName: "John",
      lastName: "Smith",
      phoneNumber: "",
      message: "Hello doctor!",
    });

    const request = new Request("https://example.com/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-For": "203.0.113.11",
      },
      body: params.toString(),
    });

    const response = await handleContactPost(request, undefined, { sendMessage });
    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("returns 400 with fieldErrors on invalid input", async () => {
    const sendMessage = vi.fn();
    const response = await handleContactPost(
      makeJsonRequest({
        email: "bad-email",
        firstName: "",
        lastName: "Doe",
        message: "",
      }),
      undefined,
      { sendMessage },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.fieldErrors.email).toBeDefined();
    expect(json.fieldErrors.firstName).toBeDefined();
    expect(json.fieldErrors.message).toBeDefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("silently accepts honeypot submissions without calling sendMessage", async () => {
    const sendMessage = vi.fn();
    const response = await handleContactPost(
      makeJsonRequest({
        email: "bot@spam.example",
        firstName: "Spam",
        lastName: "Bot",
        message: "Buy cheap things",
        website: "https://spam.example",
      }),
      undefined,
      { sendMessage },
    );

    expect(response.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded for an IP", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ channel: "log" });
    const validPayload = {
      email: "patient@example.com",
      firstName: "Jane",
      lastName: "Doe",
      message: "Test message",
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await handleContactPost(makeJsonRequest(validPayload, "198.51.100.7"), undefined, {
        sendMessage,
      });
      expect(res.status).toBe(200);
    }

    const blocked = await handleContactPost(makeJsonRequest(validPayload, "198.51.100.7"), undefined, {
      sendMessage,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 503 on ContactConfigurationError and 500 on unexpected error", async () => {
    const validPayload = {
      email: "patient@example.com",
      firstName: "Jane",
      lastName: "Doe",
      message: "Test message",
    };

    const configErrorRes = await handleContactPost(
      makeJsonRequest(validPayload, "198.51.100.8"),
      undefined,
      {
        sendMessage: vi.fn().mockRejectedValue(new ContactConfigurationError("missing smtp")),
      },
    );
    expect(configErrorRes.status).toBe(503);

    const serverErrorRes = await handleContactPost(
      makeJsonRequest(validPayload, "198.51.100.9"),
      undefined,
      {
        sendMessage: vi.fn().mockRejectedValue(new Error("network down")),
      },
    );
    expect(serverErrorRes.status).toBe(500);
  });
});
