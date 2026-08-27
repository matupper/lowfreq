import type { createClient } from "@/lib/supabase/server";

const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const POSTER_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Adapts profile/edit/actions.ts's proven avatar-upload pattern to a
// per-event (not per-user) storage path — see
// db/migrations/0008_event_posters.sql. A missing file isn't an error, a
// poster is optional. Returns an error message on failure, null otherwise.
export async function uploadEventPoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  formData: FormData
): Promise<string | null> {
  const posterFile = formData.get("poster");
  const hasPoster = posterFile instanceof File && posterFile.size > 0;
  if (!hasPoster) return null;

  if (posterFile.size > MAX_POSTER_BYTES) {
    return "Poster image must be under 5MB.";
  }
  const extension = POSTER_EXTENSION_BY_TYPE[posterFile.type];
  if (!extension) {
    return "Poster must be a JPEG, PNG, WebP, or GIF image.";
  }

  const path = `${eventId}/poster.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("event-posters")
    .upload(path, posterFile, { upsert: true, contentType: posterFile.type });
  if (uploadError) {
    return "Couldn't upload that image. Try again.";
  }

  // A prior poster uploaded under a different extension lives at a
  // different path and won't be overwritten by the upsert above — clean it
  // up so it doesn't stick around as an orphaned public object.
  const { data: existingPosterFiles } = await supabase.storage
    .from("event-posters")
    .list(eventId);
  const stalePosterPaths = (existingPosterFiles ?? [])
    .filter((file) => file.name.startsWith("poster.") && file.name !== `poster.${extension}`)
    .map((file) => `${eventId}/${file.name}`);
  if (stalePosterPaths.length > 0) {
    await supabase.storage.from("event-posters").remove(stalePosterPaths);
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
    return "Poster uploaded, but couldn't save it to the event. Try again.";
  }

  return null;
}
