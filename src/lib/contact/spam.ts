import crypto from "node:crypto";
import type { ContactFormInput } from "./schema";

export interface SpamChallenge {
  token: string;
  salt: string;
  difficulty: number;
}

export interface SpamVerificationResult {
  allowed: boolean;
  action: "accept" | "silent_drop" | "reject";
  reason: string;
  code?: string;
  score: number;
}

export interface AntiSpamOptions {
  secret?: string;
  minSubmissionTimeMs?: number;
  maxTokenAgeMs?: number;
  difficulty?: number;
  now?: number;
  enforceChallenge?: boolean;
}

export interface ContentSpamEvaluation {
  isSpam: boolean;
  score: number;
  reasons: string[];
}

let inMemorySecret: string | null = null;
const consumedTokens = new Map<string, number>();

export function getSpamSecret(): string {
  if (process.env.CONTACT_SPAM_SECRET) {
    return process.env.CONTACT_SPAM_SECRET;
  }
  if (!inMemorySecret) {
    inMemorySecret = crypto.randomBytes(32).toString("hex");
  }
  return inMemorySecret;
}

export function setSpamSecretForTesting(secret: string | null): void {
  inMemorySecret = secret;
}

export function clearSpamStores(): void {
  consumedTokens.clear();
}

export function createSpamChallenge(
  options: { secret?: string; difficulty?: number; now?: number } = {},
): SpamChallenge {
  const secret = options.secret ?? getSpamSecret();
  const difficulty = options.difficulty ?? 3;
  const now = options.now ?? Date.now();
  const salt = crypto.randomBytes(12).toString("hex");

  const payload = `${now}:${salt}:${difficulty}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const token = `${now}.${salt}.${difficulty}.${signature}`;

  return {
    token,
    salt,
    difficulty,
  };
}

export function verifyPoWSolution(
  salt: string,
  solution: number | string,
  difficulty: number,
): boolean {
  if (difficulty <= 0) return true;
  const prefix = "0".repeat(difficulty);
  const input = `${salt}:${solution}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return hash.startsWith(prefix);
}

export function solvePoWNode(salt: string, difficulty: number): number {
  if (difficulty <= 0) return 0;
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (nonce < 2_000_000) {
    const input = `${salt}:${nonce}`;
    const hash = crypto.createHash("sha256").update(input).digest("hex");
    if (hash.startsWith(prefix)) {
      return nonce;
    }
    nonce += 1;
  }
  return nonce;
}

function cleanupConsumedTokens(now: number, maxAgeMs: number): void {
  const cutoff = now - maxAgeMs;
  for (const [salt, timestamp] of consumedTokens.entries()) {
    if (timestamp < cutoff) {
      consumedTokens.delete(salt);
    }
  }
}

export function isTokenConsumed(salt: string): boolean {
  return consumedTokens.has(salt);
}

export function markTokenConsumed(salt: string, now: number = Date.now()): void {
  consumedTokens.set(salt, now);
}

export function evaluateContentSpam(data: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  message: string;
}): ContentSpamEvaluation {
  let score = 0;
  const reasons: string[] = [];
  const text = data.message;

  // 1. HTML tag injection
  if (/<(?:a|href|script|iframe|img|object|embed|style)[\s\S]*>/i.test(text)) {
    score += 50;
    reasons.push("html_tags");
  }

  // 2. BBCode tag injection
  if (/\[(?:url|link|b|i|img)[=\]]/i.test(text)) {
    score += 50;
    reasons.push("bbcode_tags");
  }

  // 3. Markdown links
  if (/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/i.test(text)) {
    score += 50;
    reasons.push("markdown_links");
  }

  // 4. Hyperlink density & suspicious links
  const urlMatches = text.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi) ?? [];
  if (urlMatches.length >= 2) {
    score += 45;
    reasons.push("multiple_urls");
  } else if (urlMatches.length === 1) {
    score += 15;
    reasons.push("single_url");
    if (text.length < 80) {
      score += 25;
      reasons.push("short_message_with_url");
    }
  }

  // 5. Spam keywords (SEO services, crypto scams, casino/pills, bulk traffic)
  const spamKeywordRegex =
    /\b(?:seo\s+services?|rank(?:ing)?\s+on\s+google|search\s+engine\s+ranking|first\s+page\s+of\s+google|guest\s+posts?|backlinks?|domain\s+authority|increase\s+traffic|leads?\s+generation|cryptocurrency|bitcoin|forex\s+trading|casino\s+online|poker\s+online|viagra|cialis|whatsapp:\s*\+|telegram:\s*@)\b/i;
  if (spamKeywordRegex.test(text)) {
    score += 45;
    reasons.push("spam_keywords");
  }

  // 6. Cyrillic marketing spam (targeting English medical practice)
  if (/[\u0400-\u04FF]/.test(text)) {
    score += 45;
    reasons.push("cyrillic_script");
  }

  // 7. Suspicious identical names with promotional content
  if (
    data.firstName.trim().toLowerCase() === data.lastName.trim().toLowerCase() &&
    data.firstName.trim().length > 3 &&
    score > 0
  ) {
    score += 20;
    reasons.push("identical_names");
  }

  return {
    isSpam: score >= 40,
    score,
    reasons,
  };
}

export function isAnyHoneypotTriggered(data: {
  website?: string | null;
  company?: string | null;
}): boolean {
  if (typeof data.website === "string" && data.website.trim().length > 0) {
    return true;
  }
  if (typeof data.company === "string" && data.company.trim().length > 0) {
    return true;
  }
  return false;
}

export function verifySpamChallengeToken(
  token: string | undefined,
  solution: number | string | undefined,
  options: AntiSpamOptions = {},
): SpamVerificationResult {
  const now = options.now ?? Date.now();
  const secret = options.secret ?? getSpamSecret();
  const minTimeMs = options.minSubmissionTimeMs ?? 2500;
  const maxAgeMs = options.maxTokenAgeMs ?? 2 * 60 * 60 * 1000;

  cleanupConsumedTokens(now, maxAgeMs);

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Missing challenge token",
      score: 100,
    };
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Malformed challenge token",
      score: 100,
    };
  }

  const [tsStr, salt, diffStr, signature] = parts;
  const timestamp = Number.parseInt(tsStr ?? "", 10);
  const difficulty = Number.parseInt(diffStr ?? "", 10);

  if (
    Number.isNaN(timestamp) ||
    Number.isNaN(difficulty) ||
    !salt ||
    !signature ||
    signature.length !== 64
  ) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Invalid challenge token fields",
      score: 100,
    };
  }

  // Verify HMAC signature
  const expectedPayload = `${timestamp}:${salt}:${difficulty}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expectedSignature, "hex");
    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      return {
        allowed: false,
        action: "silent_drop",
        reason: "Invalid challenge token signature",
        score: 100,
      };
    }
  } catch {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Invalid signature encoding",
      score: 100,
    };
  }

  // Check token expiration (allow grace for slight clock skew)
  const elapsed = now - timestamp;
  if (elapsed > maxAgeMs) {
    return {
      allowed: false,
      action: "reject",
      code: "TOKEN_EXPIRED",
      reason: "Form session expired. Please submit again.",
      score: 0,
    };
  }

  // Check time-to-submit minimum threshold (bot speed detection)
  if (elapsed < minTimeMs) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: `Submitted too fast (${elapsed}ms < ${minTimeMs}ms)`,
      score: 90,
    };
  }

  // Check replay
  if (isTokenConsumed(salt)) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Challenge token has already been used",
      score: 100,
    };
  }

  // Check PoW solution
  if (solution === undefined || solution === null || solution === "") {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Missing challenge solution",
      score: 100,
    };
  }

  if (!verifyPoWSolution(salt, solution, difficulty)) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Invalid challenge solution",
      score: 100,
    };
  }

  // Mark token as consumed
  markTokenConsumed(salt, now);

  return {
    allowed: true,
    action: "accept",
    reason: "Valid challenge token and solution",
    score: 0,
  };
}

export function evaluateSubmissionSpam(
  data: ContactFormInput,
  options: AntiSpamOptions = {},
): SpamVerificationResult {
  // 1. Honeypots
  if (isAnyHoneypotTriggered(data)) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: "Honeypot field triggered",
      score: 100,
    };
  }

  // 2. Content Heuristics
  const contentResult = evaluateContentSpam(data);
  if (contentResult.isSpam) {
    return {
      allowed: false,
      action: "silent_drop",
      reason: `Content flagged as spam (${contentResult.reasons.join(", ")})`,
      score: contentResult.score,
    };
  }

  // 3. Challenge Token (if enforced or if token provided)
  const isVitest = Boolean(process.env.VITEST);
  const shouldEnforce =
    options.enforceChallenge ??
    (process.env.ENFORCE_SPAM_CHALLENGE === "true" ||
      (process.env.NODE_ENV === "production" && !isVitest));

  if (shouldEnforce || (data.antiSpamToken && data.antiSpamToken.trim().length > 0)) {
    const tokenResult = verifySpamChallengeToken(
      data.antiSpamToken,
      data.antiSpamSolution,
      options,
    );
    if (!tokenResult.allowed) {
      return tokenResult;
    }
  }

  return {
    allowed: true,
    action: "accept",
    reason: "Passed all spam checks",
    score: contentResult.score,
  };
}
