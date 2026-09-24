import { useState } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import type { MemberRow } from "@/hooks/useTrips";

export type TripInvite = {
  code: string;
  expires_at: string | null;
  revoked_at: string | null;
  use_count: number;
  max_uses: number;
};

/**
 * Who is on the trip, and how to bring someone else in.
 *
 * Lifted out of the trip page's settings sheet, unchanged in behaviour, so
 * the day route's Trip tab can show the same thing: invite codes, the member
 * list, removing someone (owner only) and leaving (everyone else). The
 * confirmations travel with it, because taking away someone's access and
 * walking out of a trip are the two things here with no undo.
 */
export function TripPeople({
  trip,
  meId,
  members,
  invites,
  onInvite,
  onRevokeInvite,
  onRemoveMember,
  onLeave,
  onChanged,
  onLeft,
}: {
  trip: { id: string; owner_id: string };
  meId: string | null;
  members: MemberRow[];
  invites: TripInvite[];
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeave: () => Promise<void>;
  /** Reload whatever holds `invites`, after a code is made or revoked. */
  onChanged: () => Promise<void>;
  /** After leaving succeeds, for a parent that has something to close. */
  onLeft?: (() => void) | undefined;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; label: string } | null>(null);

  const iAmOwner = meId === trip.owner_id;
  const active = inviteCode
    ? { code: inviteCode, expires_at: null as string | null }
    : invites.find(
        (inv) =>
          !inv.revoked_at &&
          inv.use_count < inv.max_uses &&
          (!inv.expires_at || Date.parse(inv.expires_at) > Date.now()),
      );

  return (
    <>
      <p className="text-[12px] text-muted-foreground">
        Codes expire in 7 days and work once. Creating a new code revokes the previous open one.
      </p>
      <button
        onClick={async () => {
          const code = await onInvite();
          setInviteCode(code);
          await onChanged();
        }}
        className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
      >
        Create an invite code
      </button>
      {active && (
        <div className="mt-2 space-y-2 text-center">
          <p className="text-[14.5px] text-muted-foreground">
            Share this code:{" "}
            <span className="font-semibold tracking-widest text-foreground">{active.code}</span>
          </p>
          {active.expires_at && (
            <p className="text-[12px] text-muted-foreground">
              Expires {new Date(active.expires_at).toLocaleDateString()}
            </p>
          )}
          <button
            type="button"
            onClick={async () => {
              await onRevokeInvite(active.code);
              setInviteCode("");
              await onChanged();
            }}
            className="text-[13px] font-semibold text-destructive underline"
          >
            Revoke this code
          </button>
        </div>
      )}

      {members.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[12px] font-semibold text-muted-foreground">People on this trip</p>
          <ul className="mt-2 space-y-2">
            {members.map((m) => {
              const isMe = m.user_id === meId;
              const isOwner = m.user_id === trip.owner_id;
              const label =
                m.display_name?.trim() || (isMe ? "You" : isOwner ? "Owner" : "Traveler");
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[14.5px]">
                  <span>
                    {label}
                    {isOwner ? " · owner" : ""}
                    {isMe && !isOwner ? " · you" : ""}
                  </span>
                  {iAmOwner && !isMe && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove({ id: m.user_id, label })}
                      className="text-[13px] font-semibold text-destructive underline"
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {meId && !iAmOwner && (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="mt-3 w-full rounded-xl border border-destructive/40 px-4 py-2 text-[14.5px] font-semibold text-destructive"
            >
              Leave trip
            </button>
          )}
          {iAmOwner && !members.some((m) => m.user_id !== meId) && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              You&apos;re the only person here. Delete the trip from settings if you want it gone.
            </p>
          )}
        </div>
      )}

      <ConfirmSheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this trip?"
        body="You will lose access to the itinerary, the stops and the budget. Someone still on the trip would have to invite you back."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeave(false);
          void onLeave().then(
            () => onLeft?.(),
            (e: unknown) =>
              toast.error(e instanceof Error ? e.message : "Couldn't leave that trip."),
          );
        }}
      />

      <ConfirmSheet
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.label ?? "this person"}?`}
        body="They lose access to this trip immediately, including the itinerary and anything they added to it."
        confirmLabel="Remove"
        onConfirm={() => {
          const target = confirmRemove;
          setConfirmRemove(null);
          if (!target) return;
          void onRemoveMember(target.id).catch((e: unknown) =>
            toast.error(e instanceof Error ? e.message : "Couldn't remove them."),
          );
        }}
      />
    </>
  );
}
