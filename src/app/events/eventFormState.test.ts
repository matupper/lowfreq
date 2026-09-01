import { describe, expect, it } from "vitest";
import { parseEventFields } from "./eventFormState";

function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseEventFields", () => {
  it("rejects a submission with no title", () => {
    const result = parseEventFields(
      makeFormData({ title: "  ", startTime: "2026-09-01T20:00", venueId: "venue-1" })
    );
    expect(result).toEqual({ ok: false, error: "Title is required." });
  });

  it("rejects a submission with no venue picked", () => {
    const result = parseEventFields(
      makeFormData({ title: "Basement Show", startTime: "2026-09-01T20:00", venueId: "" })
    );
    expect(result).toEqual({ ok: false, error: "Pick a venue." });
  });

  it("rejects an unparseable start time", () => {
    const result = parseEventFields(
      makeFormData({ title: "Basement Show", startTime: "not-a-date", venueId: "venue-1" })
    );
    expect(result).toEqual({ ok: false, error: "Pick a valid date and time." });
  });

  it("parses a valid submission, trimming title/description", () => {
    const result = parseEventFields(
      makeFormData({
        title: "  Basement Show  ",
        description: "  bring earplugs  ",
        startTime: "2026-09-01T20:00",
        venueId: "venue-1",
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a valid parse result");
    expect(result.title).toBe("Basement Show");
    expect(result.description).toBe("bring earplugs");
    expect(result.venueId).toBe("venue-1");
    expect(result.startTime.getTime()).toBe(new Date("2026-09-01T20:00").getTime());
  });
});
