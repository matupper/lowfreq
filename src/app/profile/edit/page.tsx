import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditForm from "@/components/ProfileEditForm";
import { formatListInput } from "@/lib/profile-fields";

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [userRow, profileRow] = await Promise.all([
    supabase.from("users").select("handle, avatar_url").eq("id", user.id).single(),
    supabase
      .from("user_profiles")
      .select("bio, instruments, favorite_artists, favorite_albums, favorite_songs")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const identity = userRow.data;
  const profile = profileRow.data;

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          EDIT PROFILE
        </h1>
      </div>

      <ProfileEditForm
        defaults={{
          handle: identity?.handle ?? "",
          avatarUrl: identity?.avatar_url ?? null,
          bio: profile?.bio ?? "",
          instruments: formatListInput(profile?.instruments),
          favoriteArtists: formatListInput(profile?.favorite_artists),
          favoriteAlbums: formatListInput(profile?.favorite_albums),
          favoriteSongs: formatListInput(profile?.favorite_songs),
        }}
      />
    </main>
  );
}
