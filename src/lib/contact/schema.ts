import { z } from "zod";

const PHONE_REGEX = /^[+]?[\d\s().-]{7,25}$/;

export const contactFormSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .trim()
    .min(1, "Email is required.")
    .max(254, "Email must be 254 characters or fewer.")
    .pipe(z.email("Please enter a valid email address.")),
  firstName: z
    .string({ error: "First name is required." })
    .transform((val) => val.replace(/[\r\n]+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "First name is required.")
        .max(100, "First name must be 100 characters or fewer."),
    ),
  lastName: z
    .string({ error: "Last name is required." })
    .transform((val) => val.replace(/[\r\n]+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Last name is required.")
        .max(100, "Last name must be 100 characters or fewer."),
    ),
  phoneNumber: z
    .string()
    .trim()
    .max(30, "Phone number must be 30 characters or fewer.")
    .refine((val) => val === "" || PHONE_REGEX.test(val), {
      message: "Please enter a valid phone number.",
    })
    .optional()
    .default(""),
  message: z
    .string({ error: "Message is required." })
    .trim()
    .min(1, "Message is required.")
    .max(5000, "Message must be 5,000 characters or fewer."),
  website: z.string().optional().default(""),
  company: z.string().optional().default(""),
  antiSpamToken: z.string().optional().default(""),
  antiSpamSolution: z.union([z.string(), z.number()]).optional().default(""),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export interface ContactSubmission {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  message: string;
}

export function normalizeRawContactPayload(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    email: raw.email,
    firstName: raw.firstName ?? raw["first-name"],
    lastName: raw.lastName ?? raw["last-name"],
    phoneNumber: raw.phoneNumber ?? raw["phone-number"] ?? "",
    message: raw.message,
    website: raw.website ?? "",
    company: raw.company ?? "",
    antiSpamToken: raw.antiSpamToken ?? raw["anti-spam-token"] ?? "",
    antiSpamSolution: raw.antiSpamSolution ?? raw["anti-spam-solution"] ?? "",
  };
}

export function isHoneypotTriggered(
  data: Pick<ContactFormInput, "website"> & { company?: string | null },
): boolean {
  const website = typeof data.website === "string" ? data.website.trim() : "";
  const company = typeof data.company === "string" ? data.company.trim() : "";
  return website.length > 0 || company.length > 0;
}

export function formatZodFieldErrors(
  error: z.ZodError<ContactFormInput>,
): Partial<Record<keyof ContactSubmission, string>> {
  const fieldErrors: Partial<Record<keyof ContactSubmission, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof ContactSubmission | undefined;
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
