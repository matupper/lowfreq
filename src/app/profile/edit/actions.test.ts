import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();
const upsert = vi.fn();
const storageUpload = vi.fn();
const storageGetPublicUrl = vi.fn();
const storageList = vi.fn();
const storageRemove = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
    from: (table: string) => {
      if (table !== "user_profiles") throw new Error(`unexpected table: ${table}`);
      return { upsert };
    },
    storage: {
      from: (bucket: string) => {
        if (bucket !== "avatars") throw new Error(`unexpected bucket: ${bucket}`);
        return {
          upload: storageUpload,
          getPublicUrl: storageGetPublicUrl,
          list: storageList,
          remove: storageRemove,
        };
      },
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { updateProfile } from "./actions";

function baseFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("handle", overrides.handle ?? "dj_rust");
  fd.set("bio", overrides.bio ?? "");
  fd.set("instruments", overrides.instruments ?? "");
  fd.set("favoriteArtists", overrides.favoriteArtists ?? "");
  fd.set("favoriteAlbums", overrides.favoriteAlbums ?? "");
  fd.set("favoriteSongs", overrides.favoriteSongs ?? "");
  return fd;
}

describe("updateProfile", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    upsert.mockReset();
    storageUpload.mockReset();
    storageGetPublicUrl.mockReset();
    storageList.mockReset();
    storageRemove.mockReset();
  });

  it("rejects an invalid handle before calling any RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await updateProfile(null, baseFormData({ handle: "a" }));

    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces a handle-taken error on a unique-index collision (23505) instead of throwing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    const result = await updateProfile(null, baseFormData({ handle: "taken_handle" }));

    expect(result).toEqual({ error: "That handle's taken. Try another." });
    expect(rpc).toHaveBeenCalledWith("set_handle", { p_handle: "taken_handle" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves handle and empty optional fields, then redirects to /profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });

    await expect(updateProfile(null, baseFormData())).rejects.toThrow(
      "REDIRECT:/profile"
    );

    expect(rpc).toHaveBeenCalledWith("set_handle", { p_handle: "dj_rust" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        bio: null,
        instruments: [],
        favorite_artists: [],
        favorite_albums: [],
        favorite_songs: [],
      }),
      { onConflict: "user_id" }
    );
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("parses comma-separated list fields into arrays", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });

    await expect(
      updateProfile(
        null,
        baseFormData({ instruments: "Drums, Bass", favoriteArtists: "Black Flag" })
      )
    ).rejects.toThrow("REDIRECT:/profile");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        instruments: ["Drums", "Bass"],
        favorite_artists: ["Black Flag"],
      }),
      { onConflict: "user_id" }
    );
  });

  it("rejects an avatar image over the 5MB limit without uploading", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });

    const fd = baseFormData();
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "avatar.png", {
      type: "image/png",
    });
    fd.set("avatar", oversized);

    const result = await updateProfile(null, fd);

    expect(result).toEqual({ error: "Avatar image must be under 5MB." });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects an unsupported avatar mime type", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });

    const fd = baseFormData();
    const svg = new File(["<svg></svg>"], "avatar.svg", { type: "image/svg+xml" });
    fd.set("avatar", svg);

    const result = await updateProfile(null, fd);

    expect(result).toEqual({
      error: "Avatar must be a JPEG, PNG, WebP, or GIF image.",
    });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("uploads a valid avatar, sets its public URL, and redirects", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
    storageUpload.mockResolvedValue({ error: null });
    storageList.mockResolvedValue({ data: [] });
    storageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example/avatars/user-1/avatar.png" },
    });

    const fd = baseFormData();
    const image = new File([new Uint8Array(100)], "avatar.png", { type: "image/png" });
    fd.set("avatar", image);

    await expect(updateProfile(null, fd)).rejects.toThrow("REDIRECT:/profile");

    expect(storageUpload).toHaveBeenCalledWith(
      "user-1/avatar.png",
      image,
      expect.objectContaining({ upsert: true, contentType: "image/png" })
    );
    expect(rpc).toHaveBeenCalledWith(
      "set_avatar_url",
      expect.objectContaining({
        p_avatar_url: expect.stringContaining(
          "https://storage.example/avatars/user-1/avatar.png?v="
        ),
      })
    );
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("removes a stale avatar object left behind by a prior upload under a different extension", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
    storageUpload.mockResolvedValue({ error: null });
    storageList.mockResolvedValue({
      data: [{ name: "avatar.jpg" }, { name: "avatar.png" }],
    });
    storageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example/avatars/user-1/avatar.png" },
    });

    const fd = baseFormData();
    const image = new File([new Uint8Array(100)], "avatar.png", { type: "image/png" });
    fd.set("avatar", image);

    await expect(updateProfile(null, fd)).rejects.toThrow("REDIRECT:/profile");

    expect(storageList).toHaveBeenCalledWith("user-1");
    expect(storageRemove).toHaveBeenCalledWith(["user-1/avatar.jpg"]);
  });
});
