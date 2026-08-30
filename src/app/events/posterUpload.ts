import type { createClient } from "@/lib/supabase/server";

const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const POSTER_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type PosterValidation =
  | { hasPoster: false }
  | { hasPoster: true; error: string }
  | { hasPoster: true; error: null; file: File; extension: string };

// Checks the file-type/size constraints the <input accept> is only a UI
// hint for. Deliberately takes no DB/storage dependency so callers (e.g.
// events/new/actions.ts) can validate before writing anything, instead of
// discovering an invalid poster only after an events row already exists.
export function validatePosterFile(formData: FormData): PosterValidation {
  const posterFile = formData.get("poster");
  const hasPoster = posterFile instanceof File && posterFile.size > 0;
  if (!hasPoster) return { hasPoster: false };

  if (posterFile.size > MAX_POSTER_BYTES) {
    return { hasPoster: true, error: "Poster image must be under 5MB." };
  }
  const extension = POSTER_EXTENSION_BY_TYPE[posterFile.type];
  if (!extension) {
    return { hasPoster: true, error: "Poster must be a JPEG, PNG, WebP, or GIF image." };
  }

  return { hasPoster: true, error: null, file: posterFile, extension };
}

// Adapts profile/edit/actions.ts's proven avatar-upload pattern to a
// per-event (not per-user) storage path — see
// db/migrations/0008_event_posters.sql. Callers must have already validated
// the file via validatePosterFile. Returns an error message on failure,
// null otherwise.
export async function uploadEventPoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  file: File,
  extension: string
): Promise<string | null> {
  const path = `${eventId}/poster.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("event-posters")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return "Couldn't upload that image. Try again.";
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("event-posters").getPublicUrl(path);
  // A fixed path means the public URL string never changes on re-upload, so
  // a cache-busting query param is what actually makes a replaced poster
  // show the new image instead of a stale cached one.
  const posterUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("events")
    .update({ poster_url: posterUrl })
    .eq("id", eventId);
  if (updateError) {
    // Roll back the just-uploaded object so a DB-update failure doesn't
    // leave it orphaned (create path) or leave two poster files stored for
    // one event (edit path) with no events row pointing at the new one.
    await supabase.storage.from("event-posters").remove([path]);
    return "Poster uploaded, but couldn't save it to the event. Try again.";
  }

  // Only safe to remove a prior poster uploaded under a different extension
  // once the DB confirms the new path is live — clean it up now so it
  // doesn't stick around as an orphaned public object. Doing this before the
  // update above risked leaving events.poster_url pointing at a 404 if that
  // update failed.
  const { data: existingPosterFiles } = await supabase.storage
    .from("event-posters")
    .list(eventId);
  const stalePosterPaths = (existingPosterFiles ?? [])
    .filter((file) => file.name.startsWith("poster.") && file.name !== `poster.${extension}`)
    .map((file) => `${eventId}/${file.name}`);
  if (stalePosterPaths.length > 0) {
    await supabase.storage.from("event-posters").remove(stalePosterPaths);
  }

  return null;
}
