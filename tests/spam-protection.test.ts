import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSpamStores,
  createSpamChallenge,
  evaluateContentSpam,
  evaluateSubmissionSpam,
  isAnyHoneypotTriggered,
  solvePoWNode,
  verifyPoWSolution,
  verifySpamChallengeToken,
} from "@/lib/contact/spam";

describe("Spam Protection - Proof-of-Work", () => {
  it("verifies correct PoW solutions", () => {
    const salt = "test-salt-abc";
    const difficulty = 2;
    const solution = solvePoWNode(salt, difficulty);

    expect(verifyPoWSolution(salt, solution, difficulty)).toBe(true);
  });

  it("rejects incorrect PoW solutions", () => {
    const salt = "test-salt-xyz";
    const difficulty = 3;
    // An arbitrary invalid nonce that doesn't start with 000
    expect(verifyPoWSolution(salt, "invalid-solution", difficulty)).toBe(false);
  });
});

describe("Spam Protection - Honeypots", () => {
  it("triggers when website field is filled", () => {
    expect(isAnyHoneypotTriggered({ website: "https://spam.example", company: "" })).toBe(true);
  });

  it("triggers when company field is filled", () => {
    expect(isAnyHoneypotTriggered({ website: "", company: "Acme Spammers Inc" })).toBe(true);
  });

  it("does not trigger when both are empty or whitespace", () => {
    expect(isAnyHoneypotTriggered({ website: "", company: "" })).toBe(false);
    expect(isAnyHoneypotTriggered({ website: "  ", company: "   " })).toBe(false);
  });
});

describe("Spam Protection - Content Heuristics", () => {
  it("flags HTML tag injections", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      message: 'Hello, please visit <a href="https://spam.example">my link</a>',
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("html_tags");
  });

  it("flags BBCode link injections", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      message: "Check this out [url=https://spam.example]click here[/url]",
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("bbcode_tags");
  });

  it("flags Markdown link injections", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      message: "Best deals [visit here](https://promo.example/deals)",
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("markdown_links");
  });

  it("flags multiple URLs in message", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      message: "Visit https://site1.example and also https://site2.example for more information.",
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("multiple_urls");
  });

  it("flags marketing and SEO spam keywords", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      message: "We can provide backlinks and guarantee first page of google search engine ranking.",
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("spam_keywords");
  });

  it("flags Cyrillic marketing spam", () => {
    const result = evaluateContentSpam({
      firstName: "Иван",
      lastName: "Иванов",
      email: "ivan@example.ru",
      message: "Продвижение сайтов в топ яндекса и гугла.",
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons).toContain("cyrillic_script");
  });

  it("allows normal patient medical inquiries", () => {
    const result = evaluateContentSpam({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phoneNumber: "937-555-0100",
      message:
        "Hello Dr. Kirpaul, I have been having severe pain in my left heel especially in the mornings. Do you have any openings next Tuesday for a new patient consultation?",
    });
    expect(result.isSpam).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });
});

describe("Spam Protection - Challenge Token & Time Verification", () => {
  beforeEach(() => {
    clearSpamStores();
  });

  it("accepts a valid challenge token solved after minimum threshold", () => {
    const createdTime = 1_000_000;
    const challenge = createSpamChallenge({ difficulty: 2, now: createdTime });
    const solution = solvePoWNode(challenge.salt, challenge.difficulty);

    // Submitted 5 seconds later
    const submitTime = createdTime + 5000;
    const result = verifySpamChallengeToken(challenge.token, solution, {
      now: submitTime,
      minSubmissionTimeMs: 2500,
    });

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("accept");
  });

  it("silently drops submissions completed faster than minimum threshold (bot speed)", () => {
    const createdTime = 1_000_000;
    const challenge = createSpamChallenge({ difficulty: 2, now: createdTime });
    const solution = solvePoWNode(challenge.salt, challenge.difficulty);

    // Submitted in 500ms (faster than human)
    const submitTime = createdTime + 500;
    const result = verifySpamChallengeToken(challenge.token, solution, {
      now: submitTime,
      minSubmissionTimeMs: 2500,
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("silent_drop");
    expect(result.reason).toContain("Submitted too fast");
  });

  it("rejects expired challenge tokens with TOKEN_EXPIRED code", () => {
    const createdTime = 1_000_000;
    const challenge = createSpamChallenge({ difficulty: 2, now: createdTime });
    const solution = solvePoWNode(challenge.salt, challenge.difficulty);

    // Submitted 3 hours later (beyond 2 hour max age)
    const submitTime = createdTime + 3 * 60 * 60 * 1000;
    const result = verifySpamChallengeToken(challenge.token, solution, {
      now: submitTime,
      maxTokenAgeMs: 2 * 60 * 60 * 1000,
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("reject");
    expect(result.code).toBe("TOKEN_EXPIRED");
  });

  it("silently drops replayed challenge tokens", () => {
    const createdTime = 1_000_000;
    const challenge = createSpamChallenge({ difficulty: 2, now: createdTime });
    const solution = solvePoWNode(challenge.salt, challenge.difficulty);
    const submitTime = createdTime + 4000;

    const firstAttempt = verifySpamChallengeToken(challenge.token, solution, {
      now: submitTime,
      minSubmissionTimeMs: 2500,
    });
    expect(firstAttempt.allowed).toBe(true);

    const replayAttempt = verifySpamChallengeToken(challenge.token, solution, {
      now: submitTime + 1000,
      minSubmissionTimeMs: 2500,
    });
    expect(replayAttempt.allowed).toBe(false);
    expect(replayAttempt.action).toBe("silent_drop");
    expect(replayAttempt.reason).toContain("already been used");
  });

  it("silently drops tampered or forged tokens", () => {
    const challenge = createSpamChallenge({ difficulty: 2 });
    const forgedToken = challenge.token.replace(/[0-9a-f]{8}$/, "00000000");

    const result = verifySpamChallengeToken(forgedToken, 123);
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("silent_drop");
  });
});

describe("Spam Protection - evaluateSubmissionSpam", () => {
  beforeEach(() => {
    clearSpamStores();
  });

  it("drops submissions that trigger honeypot", () => {
    const result = evaluateSubmissionSpam({
      email: "bot@spam.example",
      firstName: "Spam",
      lastName: "Bot",
      phoneNumber: "",
      message: "Test message",
      website: "https://spam.example",
      company: "",
      antiSpamToken: "",
      antiSpamSolution: "",
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("silent_drop");
  });

  it("drops submissions with spam content heuristics", () => {
    const result = evaluateSubmissionSpam({
      email: "marketer@example.com",
      firstName: "SEO",
      lastName: "Rank",
      phoneNumber: "",
      message: "We offer backlinks and guest post services to rank on google.",
      website: "",
      company: "",
      antiSpamToken: "",
      antiSpamSolution: "",
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("silent_drop");
  });

  it("accepts legitimate submissions with valid challenge token", () => {
    const createdTime = 10_000_000;
    const challenge = createSpamChallenge({ difficulty: 2, now: createdTime });
    const solution = solvePoWNode(challenge.salt, challenge.difficulty);

    const result = evaluateSubmissionSpam(
      {
        email: "patient@example.com",
        firstName: "Alice",
        lastName: "Smith",
        phoneNumber: "937-555-0199",
        message: "I need to schedule an appointment for an ingrown toenail.",
        website: "",
        company: "",
        antiSpamToken: challenge.token,
        antiSpamSolution: solution,
      },
      {
        now: createdTime + 4000,
        enforceChallenge: true,
      },
    );

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("accept");
  });
});
