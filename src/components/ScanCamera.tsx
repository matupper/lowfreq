"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { normalizeInviteToken } from "@/lib/invites";

type Status = "starting" | "scanning" | "denied" | "unsupported";

// A scanned invite deep-links to /signup?token=...; a raw code (someone
// scanning a code printed without a URL) is used as-is.
function extractToken(decodedText: string): string {
  try {
    const url = new URL(decodedText);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) return normalizeInviteToken(fromUrl);
  } catch {
    // Not a URL — fall through to treating it as a raw token.
  }
  return normalizeInviteToken(decodedText);
}

export default function ScanCamera() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== "undefined" && navigator.mediaDevices
      ? "starting"
      : "unsupported"
  );

  useEffect(() => {
    let cancelled = false;

    // Already reflected in the lazy initial state above — nothing to wire
    // up if the browser can't do this at all.
    if (!navigator.mediaDevices) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus("scanning");
        tick();
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);

      if (code?.data) {
        const token = extractToken(code.data);
        if (token) {
          router.push(`/signup?token=${token}`);
          return;
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  if (status === "denied" || status === "unsupported") {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8 justify-center">
        <div className="space-y-1">
          <h1 className="font-display text-3xl leading-none tracking-wide">
            CAN&apos;T REACH THE CAMERA
          </h1>
          <p className="text-sm text-kraft leading-relaxed max-w-xs pt-4">
            {status === "denied"
              ? "Camera access was denied. You can still enter your invite code by hand."
              : "This browser can't open the camera here. Enter your invite code by hand instead."}
          </p>
        </div>
        <Link
          href="/?manual=1"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Enter code manually
        </Link>
        <Link href="/" className="text-kraft font-mono text-xs py-1.5 text-center">
          &larr; back
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6">
      <Link href="/" className="font-mono text-xs text-kraft">
        &larr; back
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-3xl leading-none tracking-wide">
          SCAN THE STAMP
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2">
          Line up the QR code inside the frame.
        </p>
      </div>

      <div className="relative aspect-square rounded-[2px] overflow-hidden bg-surface-2 border border-line">
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-8 pointer-events-none">
          <div className="absolute inset-0 border-2 border-dashed border-ink/70 rounded-[2px]" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <Link
        href="/?manual=1"
        className="text-kraft font-mono text-xs py-1.5 text-center"
      >
        Have a code instead? Enter it manually
      </Link>
    </main>
  );
}
