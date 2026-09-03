// Shared between the create (new/actions.ts) and edit ([id]/edit/actions.ts)
// server actions so EventForm.tsx can be typed against one state shape
// regardless of which action it's bound to.
export type EventFormState = { error: string } | null;

export type ParsedEventFields =
  | { ok: true; title: string; description: string; startTime: Date; venueId: string }
  | { ok: false; error: string };

export function parseEventFields(formData: FormData): ParsedEventFields {
  const title = ((formData.get("title") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const startTimeInput = (formData.get("startTime") as string) ?? "";
  const venueId = (formData.get("venueId") as string) ?? "";

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (!venueId) {
    return { ok: false, error: "Pick a venue." };
  }
  const startTime = new Date(startTimeInput);
  if (Number.isNaN(startTime.getTime())) {
    return { ok: false, error: "Pick a valid date and time." };
  }

  return { ok: true, title, description, startTime, venueId };
}
