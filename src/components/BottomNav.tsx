"use client";

import Link from "next/link";

// Direction C — "Poster Bar" (see the nav-landing-direction captain
// decision). Flush to the bottom edge, heavy 2px solid ink top border —
// reads as the bottom edge of a poster board, not a tear line. Labels use
// the display face (Anton) instead of mono, matching flyer headline type.
// Active state: a thick riso-pink underline bar, like a highlighter stroke.
// Tabs are Shows / Map / Profile — Feed is unbuilt and out of scope (see
// CLAUDE.md's "Nav tabs" note).

export type NavKey = "shows" | "map" | "profile";

const ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "shows", label: "shows", href: "/home" },
  { key: "map", label: "map", href: "/home?view=map" },
  { key: "profile", label: "profile", href: "/profile" },
];

function IconShows({ className }: { className?: string }) {
  // Ticket stub — two notches on the vertical sides.
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M2.5 6.5a1.5 1.5 0 0 0 0-3V3a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 0 0 3v3a1.5 1.5 0 0 0 0 3v.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-.5a1.5 1.5 0 0 0 0-3Z" strokeLinejoin="round" />
      <path d="M9 3v14" strokeDasharray="1.5 2" />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  // A pin — the same mark EventMap.tsx uses for a venue.
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        d="M10 2.5c-3 0-5.25 2.2-5.25 5.1 0 3.6 5.25 9.4 5.25 9.4s5.25-5.8 5.25-9.4c0-2.9-2.25-5.1-5.25-5.1Z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="7.6" r="1.8" />
    </svg>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="10" cy="6.75" r="3.25" />
      <path d="M3.5 17c1.1-3.4 3.9-5.25 6.5-5.25S15.9 13.6 17 17" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<NavKey, (props: { className?: string }) => React.JSX.Element> = {
  shows: IconShows,
  map: IconMap,
  profile: IconProfile,
};

type Props = {
  active: NavKey;
  // "shows"/"map" are in-page view state on the /home route itself (see
  // HomeBrowser's view state + focus-jump pattern) — "profile" always
  // navigates via its href instead, since it's a separate route, so this
  // is never called for it. When onSelect isn't passed at all (i.e. this
  // nav is rendered from a route other than /home, such as /profile),
  // every tab falls back to its href so tapping "shows"/"map" navigates
  // back to /home instead of doing nothing.
  onSelect?: (key: "shows" | "map") => void;
};

export default function BottomNav({ active, onSelect }: Props) {
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t-2 border-ink bg-surface z-20">
      <div className="grid grid-cols-3 max-w-md mx-auto">
        {ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.key === active;
          const content = (
            <>
              <Icon className={`w-5 h-5 ${isActive ? "text-ink" : "text-kraft"}`} />
              <span
                className={`font-display text-[13px] tracking-wide leading-none ${
                  isActive ? "text-ink" : "text-kraft"
                }`}
              >
                {item.label.toUpperCase()}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-4 right-4 h-[3px] bg-riso-pink" />
              )}
            </>
          );
          const className = "relative flex flex-col items-center gap-1.5 py-3.5";
          const key = item.key;

          if (key !== "profile" && onSelect) {
            return (
              <button
                key={key}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(key)}
                className={className}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
