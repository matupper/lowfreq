"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatInviteToken, type InviteStatus } from "@/lib/invites";

const STATUS_LABEL: Record<InviteStatus, string> = {
  unused: "one stamp, one entry",
  used: "already used",
  expired: "expired",
  revoked: "cancelled",
};

// The one screen where the ink-stamp visual + Special Elite face are used,
// per the style guide's motif budget — verification/invite confirmation
// only, nowhere else.
export default function InviteStamp({
  joinUrl,
  token,
  status,
  expiresAt,
}: {
  joinUrl: string;
  token: string;
  status: InviteStatus;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const live = status === "unused";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatInviteToken(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is already visible on screen.
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={`relative w-56 h-56 rounded-full border-4 flex items-center justify-center p-5 -rotate-1 ${
          live ? "border-stamp-red" : "border-line opacity-50"
        }`}
      >
        <div className="bg-ink p-3 rounded-[2px]">
          <QRCodeSVG value={joinUrl} size={160} level="M" />
        </div>
      </div>

      <p className="font-accent text-stamp-red text-lg text-center">
        {STATUS_LABEL[status]}
      </p>

      {live && expiresAt && <ExpiryCountdown expiresAt={expiresAt} />}

      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-[11px] text-kraft uppercase tracking-wide">
          or hand over this code
        </p>
        <button
          type="button"
          onClick={copyCode}
          className="font-mono text-2xl tracking-[0.15em] text-ink border border-line rounded-[2px] px-5 py-3"
        >
          {formatInviteToken(token)}
        </button>
        <span className="font-mono text-[11px] text-kraft h-4">
          {copied ? "copied" : " "}
        </span>
      </div>
    </div>
  );
}

// docs/designdoc.md §4.8: "Phase 2: visible countdown once expiry is
// implemented." Ticks client-side only — the server-rendered expiry
// doesn't need to be re-fetched to stay accurate, just re-formatted.
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remainingMs, setRemainingMs] = useState(
    () => new Date(expiresAt).getTime() - Date.now()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0) {
    return <p className="font-mono text-[11px] text-stamp-red">expiring…</p>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="font-mono text-[11px] text-kraft">
      expires in {minutes}:{seconds.toString().padStart(2, "0")}
    </p>
  );
}
