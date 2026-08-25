// Shared parsing/formatting for the "music identity" list fields
// (instruments, favorite artists/albums/songs) — all comma-separated free
// text in the edit form, all text[] columns in user_profiles (see
// db/migrations/0005_profile_fields.sql).
export const MAX_LIST_ITEMS = 12;
export const MAX_LIST_ITEM_LENGTH = 60;
export const MAX_BIO_LENGTH = 280;

// "Drums, Bass, Bass" -> ["Drums", "Bass"] — trims, drops empties, dedupes
// case-insensitively (keeping the first casing seen), and caps length so a
// pasted wall of text can't blow up storage or the pill list's layout.
export function parseListInput(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const item = raw.trim().slice(0, MAX_LIST_ITEM_LENGTH);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

export function formatListInput(items: string[] | null | undefined): string {
  return (items ?? []).join(", ");
}

export type MusicPillGroup = { label: string; items: string[] };

// Profile view (§4.7) renders one pill row per category, but only for
// categories that actually have something in them — an account with no
// favorite albums set shouldn't show an empty "ALBUMS" heading. Pulled out
// as a pure function so that "only populated categories render" is
// covered by a unit test rather than only by eyeballing the page.
export function buildMusicPillGroups(fields: {
  instruments?: string[] | null;
  favorite_artists?: string[] | null;
  favorite_albums?: string[] | null;
  favorite_songs?: string[] | null;
} | null | undefined): MusicPillGroup[] {
  return [
    { label: "plays", items: fields?.instruments ?? [] },
    { label: "artists", items: fields?.favorite_artists ?? [] },
    { label: "albums", items: fields?.favorite_albums ?? [] },
    { label: "songs", items: fields?.favorite_songs ?? [] },
  ].filter((group) => group.items.length > 0);
}
