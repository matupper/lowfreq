import { effectiveInviteStatus, formatInviteToken } from "@/lib/invites";
import { revokeInvite } from "./invite/actions";

export type Inviter = {
  inviter_id: string;
  inviter_name: string;
  joined_at: string;
};

export type InviteTreeRow = {
  invite_id: string;
  token: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  invitee_id: string | null;
  invitee_name: string | null;
  invitee_joined_at: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// The one person-to-person connection that got this user into the app —
// distinguished from the invitee list below rather than folded into it as
// just another row. Renders nothing for a user with no inviter (e.g. a
// seed/first account) instead of an empty or broken-looking card.
export function InvitedByCard({ inviter }: { inviter: Inviter | null }) {
  if (!inviter) return null;

  return (
    <div
      data-testid="invited-by-card"
      className="rotate-[-0.6deg] rounded-sm border border-riso-pink bg-surface-2 px-4 py-3 flex items-center gap-3"
    >
      <span className="w-2 h-2 rounded-full bg-riso-pink shrink-0" aria-hidden="true" />
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-[10px] text-kraft uppercase tracking-wide">
          invited by
        </span>
        <span className="font-display text-2xl leading-none tracking-wide truncate">
          {inviter.inviter_name}
        </span>
        <span className="font-mono text-[11px] text-kraft pt-1">
          got you in {dateFormatter.format(new Date(inviter.joined_at))}
        </span>
      </div>
    </div>
  );
}

export function InviteeList({ tree }: { tree: InviteTreeRow[] }) {
  if (tree.length === 0) {
    return (
      <p className="text-sm text-kraft">
        Haven&rsquo;t invited anyone yet — generate a stamp above to let someone
        in.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 pt-2">
      {tree.map((row) => (
        <InviteeRow key={row.invite_id} row={row} />
      ))}
    </ul>
  );
}

function InviteeRow({ row }: { row: InviteTreeRow }) {
  const status = effectiveInviteStatus(row.status, row.expires_at);

  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-none">
      <span
        className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center font-mono text-[11px] text-kraft shrink-0"
        aria-hidden="true"
      >
        {row.invitee_name ? row.invitee_name.charAt(0).toUpperCase() : "?"}
      </span>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {row.invitee_name ? (
          <>
            <span className="text-sm truncate">{row.invitee_name}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-kraft border border-riso-pink rounded-full px-2.5 py-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-riso-pink" />
              joined
            </span>
          </>
        ) : (
          <>
            <span className="font-mono text-xs text-kraft">
              {formatInviteToken(row.token)}
            </span>
            {status === "unused" ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-kraft">
                  not redeemed yet
                </span>
                <form action={revokeInvite.bind(null, row.invite_id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] text-kraft underline underline-offset-2"
                  >
                    revoke
                  </button>
                </form>
              </div>
            ) : (
              <span className="font-mono text-[11px] text-kraft shrink-0">
                {status}
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}
