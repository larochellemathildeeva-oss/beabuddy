import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    const ask = (columns: string) =>
      linksTable()
        .select(columns)
        .eq("trip_id", tripId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }) as unknown as Promise<{
        data: LinkRow[] | null;
        error: DbError;
      }>;
    let { data, error } = await ask("id, token, expires_at, revoked_at, follow_along");
    if (isMissingColumn(error, ["follow_along"])) {
      setCanFollow(false);
      ({ data, error } = await ask("id, token, expires_at, revoked_at"));
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
      const { error } = (await linksTable().insert(
        canFollow && follow
          ? { trip_id: tripId, token, follow_along: true }
          : { trip_id: tripId, token },
      )) as { error: unknown };
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

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      const { error } = (await linksTable()
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)) as { error: unknown };
      if (error) throw error;
      await load();
      toast("Link turned off", { description: "It no longer opens the trip." });
    } catch {
      toast.error("That didn't save. Try again.");
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
            {link.follow_along ? " · following along" : ""}
          </span>
          {canFollow && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setFollowing(link.id, !link.follow_along)}
              className="min-h-11 min-w-11 px-1 text-[13px] font-semibold text-foreground underline underline-offset-2 disabled:opacity-60"
            >
              {link.follow_along ? "Plan only" : "Follow along"}
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
