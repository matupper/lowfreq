"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeHandle, isValidHandle, HANDLE_FORMAT_HINT } from "@/lib/handle";
import { parseListInput, MAX_BIO_LENGTH } from "@/lib/profile-fields";

export type ProfileEditState = { error: string } | null;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function updateProfile(
  _prevState: ProfileEditState,
  formData: FormData
): Promise<ProfileEditState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const handle = normalizeHandle((formData.get("handle") as string) ?? "");
  if (!isValidHandle(handle)) {
    return { error: `Handle: ${HANDLE_FORMAT_HINT}.` };
  }

  // Set the handle first — fail fast on a uniqueness collision (the
  // lower(handle) unique index, see db/migrations/0005_profile_fields.sql)
  // before spending effort on an avatar upload.
  const { error: handleError } = await supabase.rpc("set_handle", {
    p_handle: handle,
  });
  if (handleError) {
    if (handleError.code === "23505") {
      return { error: "That handle's taken. Try another." };
    }
    throw handleError;
  }

  const avatarFile = formData.get("avatar");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { error: "Avatar image must be under 5MB." };
    }
    const extension = AVATAR_EXTENSION_BY_TYPE[avatarFile.type];
    if (!extension) {
      return { error: "Avatar must be a JPEG, PNG, WebP, or GIF image." };
    }

    // Fixed filename per user so re-uploads overwrite in place (upsert)
    // instead of accumulating orphaned objects — see the storage RLS
    // comment in db/migrations/0005_profile_fields.sql.
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
    if (uploadError) {
      return { error: "Couldn't upload that image. Try again." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    // A fixed path means the public URL string never changes on re-upload,
    // so a cache-busting query param is what actually makes a replaced
    // avatar show the new image instead of a stale cached one.
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: avatarError } = await supabase.rpc("set_avatar_url", {
      p_avatar_url: avatarUrl,
    });
    if (avatarError) throw avatarError;
  }

  const bio = ((formData.get("bio") as string) ?? "").trim().slice(0, MAX_BIO_LENGTH);
  const instruments = parseListInput((formData.get("instruments") as string) ?? "");
  const favoriteArtists = parseListInput((formData.get("favoriteArtists") as string) ?? "");
  const favoriteAlbums = parseListInput((formData.get("favoriteAlbums") as string) ?? "");
  const favoriteSongs = parseListInput((formData.get("favoriteSongs") as string) ?? "");

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      bio: bio || null,
      instruments,
      favorite_artists: favoriteArtists,
      favorite_albums: favoriteAlbums,
      favorite_songs: favoriteSongs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (profileError) throw profileError;

  redirect("/profile");
}
