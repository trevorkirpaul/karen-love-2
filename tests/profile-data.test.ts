import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_URL,
  CLINICAL_SERVICES,
  CREDENTIALS_TIMELINE,
  DOCTOR_PROFILE,
  HELPFUL_LINKS,
  LOCATIONS,
  PUBLICATIONS,
} from "@/data/profile";

describe("profile data integrity", () => {
  it("contains required doctor profile fields and valid LinkedIn URL", () => {
    expect(DOCTOR_PROFILE.fullName).toContain("Karen Kirpaul");
    expect(DOCTOR_PROFILE.bioParagraphs.length).toBeGreaterThanOrEqual(4);
    expect(() => new URL(DOCTOR_PROFILE.linkedInUrl)).not.toThrow();
  });

  it("contains valid location items", () => {
    expect(LOCATIONS.length).toBeGreaterThanOrEqual(1);
    for (const loc of LOCATIONS) {
      expect(loc.name.length).toBeGreaterThan(0);
      expect(loc.items.length).toBeGreaterThan(0);
      for (const item of loc.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.href.length).toBeGreaterThan(0);
      }
    }
  });

  it("contains valid helpful links and publications", () => {
    expect(HELPFUL_LINKS.length).toBe(5);
    for (const link of HELPFUL_LINKS) {
      expect(() => new URL(link.href)).not.toThrow();
    }

    expect(PUBLICATIONS.length).toBe(2);
    for (const pub of PUBLICATIONS) {
      expect(pub.citation.length).toBeGreaterThan(0);
      expect(pub.year).toMatch(/^\d{4}$/);
    }
  });

  it("contains valid clinical services, credentials timeline, and appointment URL", () => {
    expect(() => new URL(APPOINTMENT_URL)).not.toThrow();
    expect(CLINICAL_SERVICES.length).toBe(4);
    for (const service of CLINICAL_SERVICES) {
      expect(service.title.length).toBeGreaterThan(0);
      expect(service.description.length).toBeGreaterThan(0);
    }

    expect(CREDENTIALS_TIMELINE.length).toBe(4);
    for (const cred of CREDENTIALS_TIMELINE) {
      expect(cred.title.length).toBeGreaterThan(0);
      expect(cred.institution.length).toBeGreaterThan(0);
    }
  });
});
