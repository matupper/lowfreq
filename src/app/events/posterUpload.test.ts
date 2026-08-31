import { describe, expect, it, vi } from "vitest";
import { validatePosterFile, uploadEventPoster } from "./posterUpload";

function makeFormData(file: File | null): FormData {
  const formData = new FormData();
  if (file) formData.set("poster", file);
  return formData;
}

describe("validatePosterFile", () => {
  it("reports no poster when the field is empty", () => {
    expect(validatePosterFile(makeFormData(null))).toEqual({ hasPoster: false });
  });

  it("rejects a file over the 5MB cap", () => {
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "poster.jpg", {
      type: "image/jpeg",
    });
    const result = validatePosterFile(makeFormData(oversized));
    expect(result).toEqual({ hasPoster: true, error: "Poster image must be under 5MB." });
  });

  it("rejects an unsupported mime type", () => {
    const svg = new File(["<svg/>"], "poster.svg", { type: "image/svg+xml" });
    const result = validatePosterFile(makeFormData(svg));
    expect(result).toEqual({
      hasPoster: true,
      error: "Poster must be a JPEG, PNG, WebP, or GIF image.",
    });
  });

  it("accepts a valid poster and derives its extension from the mime type", () => {
    const png = new File(["fake-bytes"], "poster.png", { type: "image/png" });
    const result = validatePosterFile(makeFormData(png));
    expect(result.hasPoster).toBe(true);
    if (result.hasPoster && result.error === null) {
      expect(result.extension).toBe("png");
      expect(result.file).toBe(png);
    } else {
      throw new Error("expected a valid poster result");
    }
  });
});

describe("uploadEventPoster", () => {
  it("removes a stale poster left behind under a different extension and cache-busts the new URL", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const list = vi.fn().mockResolvedValue({
      data: [{ name: "poster.png" }, { name: "poster.jpg" }],
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/event-posters/event-1/poster.jpg" },
    });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const supabase = {
      storage: {
        from: (bucket: string) => {
          if (bucket !== "event-posters") throw new Error(`unexpected bucket: ${bucket}`);
          return { upload, list, remove, getPublicUrl };
        },
      },
      from: (table: string) => {
        if (table !== "events") throw new Error(`unexpected table: ${table}`);
        return { update };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const file = new File(["fake-bytes"], "poster.jpg", { type: "image/jpeg" });
    const error = await uploadEventPoster(supabase, "event-1", file, "jpg");

    expect(error).toBeNull();
    expect(upload).toHaveBeenCalledWith(
      "event-1/poster.jpg",
      file,
      expect.objectContaining({ upsert: true }),
    );
    // poster.jpg is the just-uploaded extension and must be left alone;
    // only the stale poster.png (a different extension) gets cleaned up.
    expect(remove).toHaveBeenCalledWith(["event-1/poster.png"]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        poster_url: expect.stringMatching(/^https:\/\/example\.com\/event-posters\/event-1\/poster\.jpg\?v=\d+$/),
      }),
    );
  });

  it("surfaces an error instead of writing poster_url when the storage upload fails", async () => {
    const upload = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn();

    const supabase = {
      storage: {
        from: () => ({ upload }),
      },
      from: () => ({ update }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const file = new File(["fake-bytes"], "poster.jpg", { type: "image/jpeg" });
    const error = await uploadEventPoster(supabase, "event-1", file, "jpg");

    expect(error).toBe("Couldn't upload that image. Try again.");
    expect(update).not.toHaveBeenCalled();
  });

  it("rolls back the just-uploaded object when the DB update fails, and never touches prior posters", async () => {
    // Regression coverage for the rollback-ordering fix: if the storage
    // upload succeeds but the events.poster_url update fails, the newly
    // uploaded object must be removed (no orphan) and the stale-poster
    // cleanup pass must not run at all — leaving events.poster_url pointing
    // at a 404 on partial failure is exactly what the fix prevents.
    const upload = vi.fn().mockResolvedValue({ error: null });
    const list = vi.fn().mockResolvedValue({ data: [{ name: "poster.png" }] });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/event-posters/event-1/poster.jpg" },
    });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "db down" } }),
    });

    const supabase = {
      storage: {
        from: (bucket: string) => {
          if (bucket !== "event-posters") throw new Error(`unexpected bucket: ${bucket}`);
          return { upload, list, remove, getPublicUrl };
        },
      },
      from: (table: string) => {
        if (table !== "events") throw new Error(`unexpected table: ${table}`);
        return { update };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const file = new File(["fake-bytes"], "poster.jpg", { type: "image/jpeg" });
    const error = await uploadEventPoster(supabase, "event-1", file, "jpg");

    expect(error).toBe("Poster uploaded, but couldn't save it to the event. Try again.");
    expect(remove).toHaveBeenCalledExactlyOnceWith(["event-1/poster.jpg"]);
    expect(list).not.toHaveBeenCalled();
  });
});
