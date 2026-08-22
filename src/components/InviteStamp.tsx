"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatInviteToken } from "@/lib/invites";

// The one screen where the ink-stamp visual + Special Elite face are used,
// per the style guide's motif budget — verification/invite confirmation
// only, nowhere else.
export default function InviteStamp({
  joinUrl,
  token,
  used,
}: {
  joinUrl: string;
  token: string;
  used: boolean;
}) {
  const [copied, setCopied] = useState(false);

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
          used ? "border-line opacity-50" : "border-stamp-red"
        }`}
      >
        <div className="bg-ink p-3 rounded-[2px]">
          <QRCodeSVG value={joinUrl} size={160} level="M" />
        </div>
      </div>

      <p className="font-accent text-stamp-red text-lg text-center">
        {used ? "already used" : "one stamp, one entry"}
      </p>

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
          {copied ? "copied" : " "}
        </span>
      </div>
    </div>
  );
}
