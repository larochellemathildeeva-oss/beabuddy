import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2 } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import { newShareToken, shareUrl } from "@/lib/trip-share";

type LinkRow = { id: string; token: string; expires_at: string; revoked_at: string | null };
type Query = ReturnType<typeof supabase.from>;

function linksTable(): Query {
  return (supabase as unknown as { from: (t: string) => Query }).from("trip_share_links");
}

/** The table arrives with a migration applied by hand; until then, no links. */
function isMissingTable(error: { message?: string; code?: string } | null): boolean {
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

  const load = useCallback(async () => {
    const { data, error } = (await linksTable()
      .select("id, token, expires_at, revoked_at")
      .eq("trip_id", tripId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })) as {
      data: LinkRow[] | null;
      error: { message?: string; code?: string } | null;
    };
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
      const { error } = (await linksTable().insert({ trip_id: tripId, token })) as {
        error: unknown;
      };
      if (error) throw error;
      await load();
      await copy(token);
    } catch {
      toast.error("The link didn't save. Try again.");
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
