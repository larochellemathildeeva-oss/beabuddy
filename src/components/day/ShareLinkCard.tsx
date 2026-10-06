import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2 } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import { newShareToken, shareUrl } from "@/lib/trip-share";

type LinkRow = {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  follow_along?: boolean;
  include_photos?: boolean;
};
type DbError = { message?: string; code?: string } | null;
type Query = ReturnType<typeof supabase.from>;

function linksTable(): Query {
  return (supabase as unknown as { from: (t: string) => Query }).from("trip_share_links");
}

/** The table arrives with a migration applied by hand; until then, no links. */
function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    isMissingColumn(error, ["trip_share_links"])
  );
}

/**
 * A read-only link to the trip, for someone without an account: where you
 * will be and when, nothing else. Anyone on the trip can make one or turn
 * one off.
 */
export function ShareLinkCard({ tripId }: { tripId: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // "Follow along" arrives with its own migration; until then, plan only.
  const [canFollow, setCanFollow] = useState(true);
  const [follow, setFollow] = useState(true);
  // Photos on a link arrive with their own migration too; off unless chosen.
  const [canPhotos, setCanPhotos] = useState(true);
  const [photos, setPhotos] = useState(false);
  // Only the latest read for the trip on screen is shown: an Undo tapped
  // after switching trips, or a read overtaken by a newer one, is dropped.
  const shownTrip = useRef(tripId);
  shownTrip.current = tripId;
  const lastRead = useRef(0);

  const load = useCallback(async () => {
    // An Undo from another trip's card: its read must not cancel this one's.
    if (shownTrip.current !== tripId) return;
    const read = ++lastRead.current;
    const stale = () => read !== lastRead.current || shownTrip.current !== tripId;
    const ask = (columns: string) =>
      linksTable()
        .select(columns)
        .eq("trip_id", tripId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }) as unknown as Promise<{
        data: LinkRow[] | null;
        error: DbError;
      }>;
    let { data, error } = await ask(
      "id, token, expires_at, revoked_at, follow_along, include_photos",
    );
    if (stale()) return;
    if (isMissingColumn(error, ["include_photos"])) {
      setCanPhotos(false);
      ({ data, error } = await ask("id, token, expires_at, revoked_at, follow_along"));
      if (stale()) return;
    }
    if (isMissingColumn(error, ["follow_along"])) {
      setCanFollow(false);
      setCanPhotos(false);
      ({ data, error } = await ask("id, token, expires_at, revoked_at"));
      if (stale()) return;
    }
    if (isMissingTable(error)) {
      setReady(false);
      return;
    }
    setReady(true);
    setLinks((data ?? []).filter((l) => Date.parse(l.expires_at) > Date.now()));
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (token: string) => {
    const url = shareUrl(window.location.origin, token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Anyone with it can see the plan." });
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const token = newShareToken();
      const { error } = (await linksTable().insert({
        trip_id: tripId,
        token,
        ...(canFollow && follow ? { follow_along: true } : {}),
        ...(canPhotos && photos ? { include_photos: true } : {}),
      })) as { error: unknown };
      if (error) throw error;
      await load();
      await copy(token);
    } catch {
      toast.error("The link didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const setFollowing = async (id: string, on: boolean) => {
    setBusy(true);
    try {
      const { error } = (await linksTable().update({ follow_along: on }).eq("id", id)) as {
        error: unknown;
      };
      if (error) throw error;
      await load();
      toast(on ? "Following along" : "Plan only", {
        description: on
          ? "The link now shows the stop you're at."
          : "The link no longer shows where you are.",
      });
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const setShowPhotos = async (id: string, on: boolean) => {
    setBusy(true);
    try {
      const { error } = (await linksTable().update({ include_photos: on }).eq("id", id)) as {
        error: unknown;
      };
      if (error) throw error;
      await load();
      toast(on ? "Photos shown" : "Photos hidden", {
        description: on
          ? "Anyone with the link sees the trip's photos, except any you keep off links."
          : "The link no longer shows photos.",
      });
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      const { error } = (await linksTable()
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)) as { error: unknown };
      if (error) throw error;
      await load();
      // One tap, right beside Copy: easy to hit by mistake, so it can be undone.
      toast("Link turned off", {
        description: "It no longer opens the trip.",
        action: { label: "Undo", onClick: () => void restore(id) },
      });
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    setBusy(true);
    try {
      const { data, error } = (await linksTable()
        .update({ revoked_at: null })
        .eq("id", id)
        .select("id")) as { data: { id: string }[] | null; error: unknown };
      // No row back: the link is gone, or this traveller is no longer on the trip.
      if (error || !data?.length) toast.error("That link couldn't be turned back on.");
      else toast.success("Link back on");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (ready === false) return null;
  return (
    <section className="plain-card space-y-2.5 p-3.5" aria-labelledby="share-link">
      <p id="share-link" className="flex items-center gap-2 font-display text-[19px] leading-tight">
        <Link2 className="size-5 text-primary" aria-hidden />
        Read-only link
      </p>
      <p className="text-[13px] text-muted-foreground">
        For family or friends without Béa: the plan's days, times, places and addresses, always up
        to date. Never bookings, notes, documents or who is going. A link lasts 90 days, and you can
        turn it off.
        {canFollow &&
          " Following along also shows the stop you tapped “I'm here” at and the ones you've left — never your location."}
        {canPhotos &&
          " Photos are off unless you choose them, and a photo's owner can keep it off links."}
      </p>
      {links.map((link) => (
        <div
          key={link.id}
          className="flex flex-wrap items-center gap-2 rounded-xl bg-elevated px-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
            …/shared/{link.token.slice(0, 8)}… · until{" "}
            {new Date(link.expires_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          {canFollow && (
            <span
              className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${link.follow_along ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {link.follow_along ? "Live" : "Plan only"}
            </span>
          )}
          {canPhotos && link.include_photos && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold text-foreground">
              Photos
            </span>
          )}
          {canPhotos && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setShowPhotos(link.id, !link.include_photos)}
              className="min-h-11 min-w-11 px-1 text-[13px] font-semibold text-foreground underline underline-offset-2 disabled:opacity-60"
            >
              {link.include_photos ? "Hide photos" : "Show photos"}
            </button>
          )}
          {canFollow && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setFollowing(link.id, !link.follow_along)}
              className="min-h-11 min-w-11 px-1 text-[13px] font-semibold text-foreground underline underline-offset-2 disabled:opacity-60"
            >
              {link.follow_along ? "Stop following" : "Follow along"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy(link.token)}
            className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-primary"
          >
            <Copy className="size-4" aria-hidden />
            Copy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke(link.id)}
            className="min-h-9 text-[13px] font-semibold text-destructive disabled:opacity-60"
          >
            Turn off
          </button>
        </div>
      ))}
      {canFollow && (
        <label className="flex min-h-11 items-center gap-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
            className="size-4 accent-primary"
          />
          Let them follow along (shows the stop you're at)
        </label>
      )}
      {canPhotos && (
        <label className="flex min-h-11 items-center gap-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={photos}
            onChange={(e) => setPhotos(e.target.checked)}
            className="size-4 accent-primary"
          />
          Show the trip's photos on it
        </label>
      )}
      <button
        type="button"
        disabled={busy || ready === null}
        onClick={() => void create()}
        className="btn-primary w-full disabled:opacity-50"
      >
        {links.length ? "Make another link" : "Make a link and copy it"}
      </button>
    </section>
  );
}
