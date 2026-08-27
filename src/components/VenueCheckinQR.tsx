"use client";

import { QRCodeSVG } from "qrcode.react";

// Simpler sibling to InviteStamp — a reusable venue code has one lifecycle
// state that matters ("still good" vs "expired"), not InviteStamp's four
// (unused/used/expired/revoked) or its live single-use countdown. No
// ink-stamp/Special Elite treatment here — that motif is reserved for the
// personal invite-confirmation moment (see CLAUDE.md's style guide note).
export default function VenueCheckinQR({
  joinUrl,
  token,
  expired,
}: {
  joinUrl: string;
  token: string;
  expired: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`bg-ink p-2.5 rounded-[2px] shrink-0 ${expired ? "opacity-40" : ""}`}
      >
        <QRCodeSVG value={joinUrl} size={88} level="M" />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <p className="font-mono text-[11px] text-kraft">
          {expired
            ? "this show's check-in window has closed"
            : "print this and post it at the door"}
        </p>
        <p className="font-mono text-xs text-ink truncate">{token}</p>
      </div>
    </div>
  );
}
