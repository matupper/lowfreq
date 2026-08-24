import { describe, expect, it } from "vitest";
import {
  buildMusicPillGroups,
  formatListInput,
  parseListInput,
  MAX_LIST_ITEMS,
  MAX_LIST_ITEM_LENGTH,
} from "./profile-fields";

describe("parseListInput", () => {
  it("trims and splits comma-separated text", () => {
    expect(parseListInput("Drums,  Bass ,Vocals")).toEqual([
      "Drums",
      "Bass",
      "Vocals",
    ]);
  });

  it("drops empty items from stray commas", () => {
    expect(parseListInput("Drums,, ,Bass,")).toEqual(["Drums", "Bass"]);
  });

  it("dedupes case-insensitively, keeping the first casing seen", () => {
    expect(parseListInput("Drums, drums, DRUMS")).toEqual(["Drums"]);
  });

  it("caps the number of items", () => {
    const input = Array.from({ length: MAX_LIST_ITEMS + 5 }, (_, i) => `item${i}`).join(",");
    expect(parseListInput(input)).toHaveLength(MAX_LIST_ITEMS);
  });

  it("caps the length of each item", () => {
    const long = "x".repeat(MAX_LIST_ITEM_LENGTH + 20);
    expect(parseListInput(long)[0]).toHaveLength(MAX_LIST_ITEM_LENGTH);
  });

  it("returns an empty list for blank input", () => {
    expect(parseListInput("")).toEqual([]);
    expect(parseListInput("   ")).toEqual([]);
  });
});

describe("formatListInput", () => {
  it("joins items with a comma and space", () => {
    expect(formatListInput(["Drums", "Bass"])).toBe("Drums, Bass");
  });

  it("returns an empty string for null/undefined/empty input", () => {
    expect(formatListInput(null)).toBe("");
    expect(formatListInput(undefined)).toBe("");
    expect(formatListInput([])).toBe("");
  });
});

describe("buildMusicPillGroups", () => {
  it("omits categories with no items — an account with nothing set gets no groups", () => {
    expect(buildMusicPillGroups(null)).toEqual([]);
    expect(buildMusicPillGroups(undefined)).toEqual([]);
    expect(
      buildMusicPillGroups({
        instruments: [],
        favorite_artists: [],
        favorite_albums: [],
        favorite_songs: [],
      })
    ).toEqual([]);
  });

  it("includes only the categories that actually have items, in a fixed order", () => {
    expect(
      buildMusicPillGroups({
        instruments: ["Drums"],
        favorite_artists: [],
        favorite_albums: ["Damaged"],
        favorite_songs: null,
      })
    ).toEqual([
      { label: "plays", items: ["Drums"] },
      { label: "albums", items: ["Damaged"] },
    ]);
  });

  it("includes every category when all are set", () => {
    const groups = buildMusicPillGroups({
      instruments: ["Drums"],
      favorite_artists: ["Black Flag"],
      favorite_albums: ["Damaged"],
      favorite_songs: ["Rise Above"],
    });
    expect(groups.map((g) => g.label)).toEqual([
      "plays",
      "artists",
      "albums",
      "songs",
    ]);
  });
});
