import { describe, expect, it } from "vitest";
import { isValidHandle, normalizeHandle } from "./handle";

describe("normalizeHandle", () => {
  it("strips a leading @ and surrounding whitespace", () => {
    expect(normalizeHandle("  @dj_rust  ")).toBe("dj_rust");
  });

  it("leaves a handle with no @ unchanged apart from trimming", () => {
    expect(normalizeHandle(" basement_kid ")).toBe("basement_kid");
  });

  it("preserves case", () => {
    expect(normalizeHandle("@DJ_Rust")).toBe("DJ_Rust");
  });
});

describe("isValidHandle", () => {
  it("accepts letters, numbers, and underscore within length bounds", () => {
    expect(isValidHandle("dj_rust99")).toBe(true);
    expect(isValidHandle("abc")).toBe(true);
    expect(isValidHandle("a".repeat(20))).toBe(true);
  });

  it("rejects handles shorter than 3 or longer than 20 characters", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("a".repeat(21))).toBe(false);
  });

  it("rejects characters outside letters/numbers/underscore", () => {
    expect(isValidHandle("dj-rust")).toBe(false);
    expect(isValidHandle("dj rust")).toBe(false);
    expect(isValidHandle("dj.rust")).toBe(false);
    expect(isValidHandle("@djrust")).toBe(false);
  });

  it("rejects an empty handle", () => {
    expect(isValidHandle("")).toBe(false);
  });
});
