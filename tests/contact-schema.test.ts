import { describe, expect, it } from "vitest";
import {
  contactFormSchema,
  formatZodFieldErrors,
  isHoneypotTriggered,
  normalizeRawContactPayload,
} from "@/lib/contact/schema";

describe("contactFormSchema", () => {
  it("accepts valid contact submission and trims whitespace", () => {
    const parsed = contactFormSchema.safeParse({
      email: "  patient@example.com  ",
      firstName: "  Jane ",
      lastName: " Doe  ",
      phoneNumber: " (937) 555-0199 ",
      message: "  I would like to schedule an appointment.  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        email: "patient@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: "(937) 555-0199",
        message: "I would like to schedule an appointment.",
        website: "",
      });
    }
  });

  it("allows empty phone number", () => {
    const parsed = contactFormSchema.safeParse({
      email: "patient@example.com",
      firstName: "Jane",
      lastName: "Doe",
      phoneNumber: "",
      message: "Question about plantar fasciitis.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and missing required fields", () => {
    const parsed = contactFormSchema.safeParse({
      email: "not-an-email",
      firstName: "",
      lastName: "   ",
      phoneNumber: "abc",
      message: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = formatZodFieldErrors(parsed.error);
      expect(errors.email).toBeDefined();
      expect(errors.firstName).toBeDefined();
      expect(errors.lastName).toBeDefined();
      expect(errors.phoneNumber).toBeDefined();
      expect(errors.message).toBeDefined();
    }
  });
});

describe("normalizeRawContactPayload", () => {
  it("maps legacy kebab-case form field names to camelCase", () => {
    const normalized = normalizeRawContactPayload({
      email: "a@b.com",
      "first-name": "Alice",
      "last-name": "Smith",
      "phone-number": "937-555-1234",
      message: "Hello",
    });

    expect(normalized).toEqual({
      email: "a@b.com",
      firstName: "Alice",
      lastName: "Smith",
      phoneNumber: "937-555-1234",
      message: "Hello",
      website: "",
    });
  });
});

describe("isHoneypotTriggered", () => {
  it("returns false when website is empty or whitespace", () => {
    expect(isHoneypotTriggered({ website: "" })).toBe(false);
    expect(isHoneypotTriggered({ website: "   " })).toBe(false);
  });

  it("returns true when website has a value", () => {
    expect(isHoneypotTriggered({ website: "https://spam.example" })).toBe(true);
  });
});
