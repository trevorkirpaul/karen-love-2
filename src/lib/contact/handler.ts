import {
  ContactConfigurationError,
  sendContactMessage,
  type DeliveryResult,
} from "@/lib/contact/mailer";
import { checkRateLimit } from "@/lib/contact/rate-limit";
import {
  contactFormSchema,
  formatZodFieldErrors,
  isHoneypotTriggered,
  normalizeRawContactPayload,
  type ContactSubmission,
} from "@/lib/contact/schema";

export interface ContactHandlerDeps {
  sendMessage?: (submission: ContactSubmission) => Promise<DeliveryResult>;
}

function jsonResponse(body: Record<string, unknown>, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function getClientIp(request: Request, fallbackAddress?: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return fallbackAddress ?? "unknown";
}

async function parseRequestBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  try {
    if (contentType.includes("application/json")) {
      const parsed: unknown = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    }

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const record: Record<string, unknown> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          record[key] = value;
        }
      }
      return record;
    }

    const text = await request.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleContactPost(
  request: Request,
  clientAddress?: string,
  deps: ContactHandlerDeps = {},
): Promise<Response> {
  const rawBody = await parseRequestBody(request);
  if (!rawBody) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid request payload. Expected JSON or form data.",
      },
      400,
    );
  }

  const normalized = normalizeRawContactPayload(rawBody);
  const parsed = contactFormSchema.safeParse(normalized);

  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: "Please review the highlighted fields and try again.",
        fieldErrors: formatZodFieldErrors(parsed.error),
      },
      400,
    );
  }

  // Silently accept honeypot submissions to avoid tipping off automated bots
  if (isHoneypotTriggered(parsed.data)) {
    return jsonResponse(
      {
        ok: true,
        message: "You have successfully sent your message.",
      },
      200,
    );
  }

  const clientIp = getClientIp(request, clientAddress);
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        ok: false,
        error: "Too many messages sent recently. Please wait a few minutes before trying again.",
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const submission: ContactSubmission = {
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phoneNumber: parsed.data.phoneNumber,
    message: parsed.data.message,
  };

  try {
    const deliver = deps.sendMessage ?? ((data: ContactSubmission) => sendContactMessage(data));
    await deliver(submission);

    return jsonResponse(
      {
        ok: true,
        message: "You have successfully sent your message.",
      },
      200,
    );
  } catch (error) {
    if (error instanceof ContactConfigurationError) {
      console.error("[contact] Configuration error:", error.message);
      return jsonResponse(
        {
          ok: false,
          error: "Contact service is temporarily unavailable. Please call the office directly.",
        },
        503,
      );
    }

    console.error("[contact] Failed to deliver contact message:", error);
    return jsonResponse(
      {
        ok: false,
        error: "Your message could not be sent. Please try again later or call the office.",
      },
      500,
    );
  }
}
