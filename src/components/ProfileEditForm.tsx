"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateProfile, type ProfileEditState } from "@/app/profile/edit/actions";
import { HANDLE_FORMAT_HINT } from "@/lib/handle";
import { MAX_BIO_LENGTH } from "@/lib/profile-fields";

const inputClass =
  "bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft";
const labelClass = "font-mono text-[11px] text-kraft uppercase tracking-wide";

export type ProfileEditDefaults = {
  handle: string;
  avatarUrl: string | null;
  bio: string;
  instruments: string;
  favoriteArtists: string;
  favoriteAlbums: string;
  favoriteSongs: string;
};

export default function ProfileEditForm({
  defaults,
}: {
  defaults: ProfileEditDefaults;
}) {
  const [state, formAction, pending] = useActionState<ProfileEditState, FormData>(
    updateProfile,
    null
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    defaults.avatarUrl
  );
  const [bio, setBio] = useState(defaults.bio);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <div
          className="w-18 h-18 rounded-full bg-surface-2 border border-line bg-cover bg-center shrink-0"
          style={
            avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined
          }
        />
        <label className="flex flex-col gap-1 cursor-pointer">
          <span className="font-mono text-xs text-riso-pink underline underline-offset-2">
            change photo
          </span>
          <span className="font-mono text-[10px] text-kraft">
            jpeg / png / webp / gif, up to 5MB
          </span>
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="handle" className={labelClass}>
          handle
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-kraft">@</span>
          <input
            id="handle"
            name="handle"
            type="text"
            required
            defaultValue={defaults.handle}
            autoComplete="off"
            className={`${inputClass} flex-1`}
          />
        </div>
        <span className="font-mono text-[10px] text-kraft">
          {HANDLE_FORMAT_HINT}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className={labelClass}>
          bio (optional)
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={MAX_BIO_LENGTH}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`${inputClass} resize-none`}
        />
        <span className="font-mono text-[10px] text-kraft self-end">
          {bio.length}/{MAX_BIO_LENGTH}
        </span>
      </div>

      <div className="space-y-4 border-t border-dashed border-line pt-6">
        <h2 className={labelClass}>music identity (optional)</h2>

        <ListField
          name="instruments"
          label="instruments played"
          placeholder="drums, bass, vocals"
          defaultValue={defaults.instruments}
        />
        <ListField
          name="favoriteArtists"
          label="favorite artists"
          placeholder="Black Flag, Bikini Kill"
          defaultValue={defaults.favoriteArtists}
        />
        <ListField
          name="favoriteAlbums"
          label="favorite albums"
          placeholder="Damaged, Reject All American"
          defaultValue={defaults.favoriteAlbums}
        />
        <ListField
          name="favoriteSongs"
          label="favorite songs"
          placeholder="Rise Above, Double Dare"
          defaultValue={defaults.favoriteSongs}
        />
      </div>

      {state?.error && (
        <p className="font-mono text-[11px] text-stamp-red">{state.error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 px-6 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "saving…" : "save profile"}
        </button>
        <Link href="/profile" className="font-mono text-xs text-kraft">
          cancel
        </Link>
      </div>
    </form>
  );
}

function ListField({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
      />
      <span className="font-mono text-[10px] text-kraft">comma separated</span>
    </div>
  );
}
