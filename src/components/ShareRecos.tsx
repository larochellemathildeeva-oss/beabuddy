import { useEffect, useMemo, useState } from "react";
import { formatTripLocation } from "@/lib/place-label";
import { Check, Copy, Inbox, Share2 } from "lucide-react";
import { claimSharedList, readSharedList, useRecoShares } from "@/hooks/useRecoShares";
import { findDuplicate } from "@/lib/captured-place";
import { fuzzyRank } from "@/lib/fuzzy";
import {
  shareStatusLine,
  shareSummaryLine,
  suggestedShareTitle,
  toKeptReco,
  type SharedList,
} from "@/lib/reco-share";
import type { NewReco, RecoRowDB } from "@/hooks/useRecommendations";

type Mode = "idle" | "picking" | "sent" | "opening";

const places = (n: number) => `${n} place${n === 1 ? "" : "s"}`;
const sendButtonLabel = (n: number) => (n === 0 ? "Share" : `Share ${places(n)}`);
const keepButtonLabel = (n: number) => (n === 0 ? "Keep" : `Keep ${places(n)}`);

/**
 * Send a handful of saved places to someone, and take in a list they sent you.
 *
 * A share is a snapshot: the rows you tick are copied behind a code, and what
 * the other person keeps lands in their own vault with your name on it. Nobody
 * gets to read your vault, and editing a place later does not rewrite a list
 * someone already has.
 */
export function ShareRecos({
  rows,
  uid,
  myName,
  onKept,
  request,
  onClose,
}: {
  rows: RecoRowDB[];
  uid: string | null;
  myName: string;
  onKept: (recos: NewReco[]) => Promise<void>;
  /**
   * Opened from somewhere else, such as the Recs "+" menu: no header row of
   * its own, and nothing on screen until asked. `n` changes on every ask, so
   * asking again after closing opens it again.
   */
  request?: { mode: "picking" | "opening"; n: number } | null;
  /** Called when a requested share is closed. */
  onClose?: () => void;
}) {
  const bare = request !== undefined;
  const s = useRecoShares(uid);
  const [mode, setMode] = useState<Mode>("idle");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [copied, setCopied] = useState(false);

  const [code, setCode] = useState("");
  const [incoming, setIncoming] = useState<SharedList | null>(null);
  const [keeping, setKeeping] = useState<Record<string, boolean>>({});
  const [kept, setKept] = useState("");

  const pickedRows = useMemo(() => rows.filter((r) => picked[r.id]), [rows, picked]);

  const existingForDupes = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name,
        city: r.city ?? "",
        ...(r.lat != null ? { lat: r.lat } : {}),
        ...(r.lon != null ? { lon: r.lon } : {}),
      })),
    [rows],
  );

  const searchable = useMemo(() => {
    if (!query.trim()) return rows;
    return fuzzyRank(rows, query, (r) => [r.name, r.city ?? "", r.country ?? "", r.notes ?? ""]);
  }, [rows, query]);

  useEffect(() => {
    if (!request) return;
    reset();
    setMode(request.mode);
    // Only a new ask reopens it; reset is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  const close = () => {
    reset();
    onClose?.();
  };

  const reset = () => {
    setMode("idle");
    setPicked({});
    setQuery("");
    setTitle("");
    setIncludeNotes(false);
    setError("");
    setSentCode("");
    setCopied(false);
    setCode("");
    setIncoming(null);
    setKeeping({});
  };

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const share = await s.createShare({
        recos: pickedRows,
        title: title.trim() || suggestedShareTitle(pickedRows),
        includeNotes,
        sharedByName: myName,
      });
      setSentCode(share.code);
      setMode("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make that share");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the code and copy it yourself.");
    }
  };

  const open = async () => {
    setBusy(true);
    setError("");
    setIncoming(null);
    try {
      const list = await readSharedList(code);
      if (!list) {
        setError("That list is empty now.");
        return;
      }
      setIncoming(list);
      // Everything that is not already in the vault starts ticked, so the
      // common case is one tap.
      const next: Record<string, boolean> = {};
      for (const item of list.items) {
        next[item.id] = !findDuplicate(existingForDupes, {
          name: item.name,
          city: item.city,
          lat: item.lat,
          lon: item.lon,
        });
      }
      setKeeping(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that code");
    } finally {
      setBusy(false);
    }
  };

  const keepChosen = async () => {
    if (!incoming) return;
    const chosen = incoming.items.filter((i) => keeping[i.id]);
    if (chosen.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await onKept(chosen.map((item) => toKeptReco(item, incoming.sharedByName)));
      await claimSharedList(code);
      setKept(`${chosen.length} place${chosen.length === 1 ? "" : "s"} saved to your vault.`);
      setIncoming(null);
      setCode("");
      setMode("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save those");
    } finally {
      setBusy(false);
    }
  };

  if (s.unavailable) {
    if (bare && !request) return null;
    return (
      <section className="surface border border-border/50 p-3.5">
        <p className="font-display text-[16.5px] leading-tight">Share places</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Not switched on for this database yet — the <code>reco_shares</code> migration still needs
          to be run.
        </p>
        {bare && (
          <button
            type="button"
            onClick={close}
            className="mt-2 rounded-lg border border-border bg-card px-2.5 py-1 text-[12.5px] font-semibold"
          >
            Close
          </button>
        )}
      </section>
    );
  }

  const live = s.shares.filter((share) => !share.revoked_at);

  if (bare && mode === "idle") {
    return kept ? <p className="text-[13px] text-primary">{kept}</p> : null;
  }

  return (
    <section data-guide="reco-share" className={bare ? "card-soft p-3.5" : undefined}>
      {bare ? (
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps">
            {mode === "opening" ? "Open a share" : mode === "sent" ? "Sent" : "Send places"}
          </p>
          {/* Not while a share is being made or kept: its answer would land
              in a panel already closed, and open it again. */}
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-[12.5px] font-semibold disabled:opacity-50"
          >
            {mode === "sent" ? "Done" : "Cancel"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label-caps">Share places</p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (mode === "picking") reset();
                else {
                  reset();
                  setMode("picking");
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-[13px] font-semibold"
            >
              <Share2 className="size-3.5" aria-hidden />
              {mode === "picking" ? "Cancel" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === "opening") reset();
                else {
                  reset();
                  setMode("opening");
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-[13px] font-semibold"
            >
              <Inbox className="size-3.5" aria-hidden />
              {mode === "opening" ? "Cancel" : "Open a share"}
            </button>
          </div>
        </div>
      )}

      {kept && mode === "idle" && <p className="mt-3 text-[13px] text-primary">{kept}</p>}

      {/* ---- Sending ---- */}
      {mode === "picking" && (
        <div className="mt-3 space-y-3">
          {rows.length === 0 ? (
            <p className="text-[14.5px] text-muted-foreground">
              Nothing saved yet. Save a few places first and you'll be able to send them on.
            </p>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your saved places"
                aria-label="Search your saved places"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
              />
              <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto border-y border-border/60">
                {searchable.slice(0, 60).map((row) => (
                  <li key={row.id}>
                    <label className="flex cursor-pointer items-start gap-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(picked[row.id])}
                        onChange={(e) =>
                          setPicked((prev) => ({ ...prev, [row.id]: e.target.checked }))
                        }
                        className="mt-0.5 size-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">{row.name}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {formatTripLocation(row.city, row.country) || "No city saved"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  pickedRows.length ? suggestedShareTitle(pickedRows) : "Give the list a name"
                }
                aria-label="Name this list"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
              />

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0"
                />
                <span className="text-[13px]">
                  Send my notes too
                  <span className="block text-[12px] text-muted-foreground">
                    Off by default. Your notes are yours — the name, city and map pin go either way.
                  </span>
                </span>
              </label>

              <p className="text-[12.5px] text-muted-foreground">
                {shareSummaryLine(pickedRows.length, includeNotes)}
              </p>

              <button
                type="button"
                disabled={pickedRows.length === 0 || busy}
                onClick={() => void send()}
                className="btn-primary w-full px-4 py-2 text-[14.5px] disabled:opacity-40 disabled:shadow-none"
              >
                {busy ? "Making the link…" : sendButtonLabel(pickedRows.length)}
              </button>
            </>
          )}
        </div>
      )}

      {/* ---- Sent ---- */}
      {mode === "sent" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-[13px] text-muted-foreground">
            Send them this code. It works for 30 days, and you can stop it any time.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-2 font-mono text-[16.5px] tracking-widest">
              {sentCode}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy the code"
              className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-border"
            >
              {copied ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <button type="button" onClick={reset} className="text-[12.5px] text-primary underline">
            Done
          </button>
        </div>
      )}

      {/* ---- Receiving ---- */}
      {mode === "opening" && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void open();
                }
              }}
              placeholder="Paste the code"
              aria-label="Paste the code you were sent"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 font-mono text-[14.5px] tracking-widest"
            />
            <button
              type="button"
              disabled={!code.trim() || busy}
              onClick={() => void open()}
              className="rounded-xl border border-border bg-card px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
            >
              {busy ? "…" : "Open"}
            </button>
          </div>

          {incoming && (
            <div className="space-y-2">
              <div>
                <p className="font-display text-[15px]">{incoming.title}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {incoming.sharedByName ? `From ${incoming.sharedByName} · ` : ""}
                  {incoming.items.length} place{incoming.items.length === 1 ? "" : "s"}
                  {incoming.note ? ` · ${incoming.note}` : ""}
                </p>
              </div>
              <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto border-y border-border/60">
                {incoming.items.map((item) => {
                  const already = findDuplicate(existingForDupes, {
                    name: item.name,
                    city: item.city,
                    lat: item.lat,
                    lon: item.lon,
                  });
                  return (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-start gap-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(keeping[item.id])}
                          onChange={(e) =>
                            setKeeping((prev) => ({ ...prev, [item.id]: e.target.checked }))
                          }
                          className="mt-0.5 size-5 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium">
                            {item.name}
                          </span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {formatTripLocation(item.city, item.country) || item.category}
                            {already ? " · already saved" : ""}
                          </span>
                          {item.notes && (
                            <span className="mt-0.5 block text-[12.5px] leading-snug">
                              {item.notes}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={busy || incoming.items.every((i) => !keeping[i.id])}
                onClick={() => void keepChosen()}
                className="btn-primary w-full px-4 py-2 text-[14.5px] disabled:opacity-40 disabled:shadow-none"
              >
                {busy
                  ? "Saving…"
                  : keepButtonLabel(incoming.items.filter((i) => keeping[i.id]).length)}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] text-destructive">{error}</p>}

      {/* ---- Shares you've sent ---- */}
      {(bare ? mode === "picking" : mode === "idle") && live.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
          {live.slice(0, 5).map((share) => (
            <li key={share.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">
                  {share.title || "Shared places"}
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {shareStatusLine(share)} · {share.code}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void s.stopShare(share.id)}
                className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1 text-[12.5px] font-semibold"
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
