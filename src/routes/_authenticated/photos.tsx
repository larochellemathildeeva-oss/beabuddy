import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { LoadError } from "@/components/LoadError";
import { BeaRunning } from "@/components/BeaRunning";
import { supabase } from "@/integrations/supabase/client";
import { readExif } from "@/lib/exif";
import { reverseGeocode } from "@/lib/geocode";
import { isNetworkFailure } from "@/lib/ai-errors";
import { uploadPhotoFile } from "@/lib/photo-upload";

export const Route = createFileRoute("/_authenticated/photos")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Photo memories — Béa" },
      {
        name: "description",
        content:
          "Import photos from your phone and let Béa group them into city memories with dates and captions.",
      },
      { property: "og:title", content: "Photo memories — Béa" },
      {
        property: "og:description",
        content: "Import photos from your phone into your Béa travel memory vault.",
      },
    ],
  }),
  component: PhotosPage,
});

const SKIP_KEY = "bea-photo-consent-skip";
const PHOTO_INPUT_ID = "photo-import-input";

type ImportMode = "both" | "locations";

type PhotoRow = {
  id: string;
  storage_path: string;
  city: string | null;
  country: string | null;
  caption: string | null;
  taken_at: string | null;
};

const isLocationOnly = (r: PhotoRow) => r.storage_path.startsWith("location-only:");

function PhotosPage() {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const [skipPrompt, setSkipPrompt] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [mode, setMode] = useState<ImportMode>("both");
  const [showLibrary, setShowLibrary] = useState(false);
  // A failed read is said, not shown as "no photos yet".
  const [loadError, setLoadError] = useState(false);
  // Deleting removes the photo for good, so it asks first.
  const [deleting, setDeleting] = useState<PhotoRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirmCard = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(SKIP_KEY) === "yes") {
      setSkipPrompt(true);
      setConsented(true);
    }
  }, []);

  // Runs as the label's own tap opens the picker — no scripted click, which
  // iPhones do not always follow through on.
  const agree = () => {
    if (dontAsk) {
      try {
        localStorage.setItem(SKIP_KEY, "yes");
      } catch {
        // Private browsing: the prompt simply shows again next time.
      }
      setSkipPrompt(true);
    }
    setConsented(true);
  };

  // Safari on iPhone has been seen to fire `input` without `change` after the
  // photo picker's check mark, so both land here.
  const onPicked = (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    setPending(files);
    setStatus(null);
  };

  // The confirmation sits below the fold on a phone; bring it up so picking
  // photos visibly does something.
  useEffect(() => {
    if (pending.length)
      confirmCard.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pending]);

  const load = async () => {
    const uid = (await supabase.auth.getSession()).data.session?.user.id;
    if (!uid) return;
    // Only this traveller's own: a shared trip's stops can carry other
    // travellers' photos, which are theirs to keep or delete.
    const { data, error } = await supabase
      .from("photo_memories")
      .select("id, storage_path, city, country, caption, taken_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setLoadError(!!error);
    if (error) return;
    const list = (data ?? []) as PhotoRow[];
    setRows(list);
    const next: Record<string, string> = {};
    for (const r of list) {
      if (isLocationOnly(r)) continue;
      const { data: signed } = await supabase.storage
        .from("photo-memories")
        .createSignedUrl(r.storage_path, 3600);
      if (signed?.signedUrl) next[r.id] = signed.signedUrl;
    }
    setUrls(next);
  };

  useEffect(() => {
    void load();
  }, []);

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setStatus(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const keepPhotos = mode === "both";

      let detected = 0;
      let skipped = 0;
      for (const file of Array.from(files)) {
        const exif = await readExif(file);
        let placeCity = city || null;
        let placeCountry = country || null;
        if (exif.lat != null && exif.lon != null) {
          const place = await reverseGeocode(exif.lat, exif.lon);
          if (place && (place.city || place.country)) {
            placeCity = place.city || placeCity;
            placeCountry = place.country || placeCountry;
            detected += 1;
          }
        }

        if (!keepPhotos && exif.lat == null && exif.lon == null && !placeCity) {
          skipped += 1;
          continue;
        }

        // GPS is dropped from the file bytes; lat/lon still go into the row.
        const path = keepPhotos
          ? await uploadPhotoFile(uid, file)
          : `location-only:${crypto.randomUUID()}`;

        const { error: rowErr } = await supabase.from("photo_memories").insert({
          user_id: uid,
          storage_path: path,
          city: placeCity,
          country: placeCountry,
          lat: exif.lat ?? null,
          lon: exif.lon ?? null,
          taken_at: exif.takenAt ?? new Date(file.lastModified).toISOString(),
        });
        if (rowErr) throw rowErr;
      }
      const kept = files.length - skipped;
      setStatus(
        keepPhotos
          ? `${files.length} photo${files.length > 1 ? "s" : ""} added${
              detected ? ` · ${detected} placed automatically from their own location` : ""
            }.`
          : `${kept} location${kept === 1 ? "" : "s"} added to your map. No photo was kept.${
              skipped
                ? ` ${skipped} had no location saved inside, so ${skipped > 1 ? "they were" : "it was"} skipped.`
                : ""
            }`,
      );

      await load();
      setPending([]);
      if (!skipPrompt) setConsented(false);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setStatus("Upload didn't finish — check your connection and try again.");
      } else {
        setStatus(friendlyError(err, "Upload failed. Try again."));
      }
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remove = async (row: PhotoRow) => {
    setStatus(null);
    // The row first: if that fails, the photo stays whole.
    const { error } = await supabase.from("photo_memories").delete().eq("id", row.id);
    if (error) {
      setStatus(friendlyError(error, "Couldn't delete that photo. Try again."));
      return;
    }
    if (!isLocationOnly(row)) {
      await supabase.storage.from("photo-memories").remove([row.storage_path]);
    }
    await load();
  };

  const groups = rows.reduce<Record<string, PhotoRow[]>>((acc, r) => {
    const key = r.city ? `${r.city}${r.country ? `, ${r.country}` : ""}` : "Unsorted";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <AppShell eyebrow="Photo memories" title="Import from your phone.">
      <div className="space-y-5">
        <ol className="card-soft space-y-2 p-4 text-[16px] text-muted-foreground">
          <li>1. Tap Choose photos and pick them from your camera roll.</li>
          <li>
            2. Béa reads the location saved inside each photo and works out the city and country on
            its own.
          </li>
          <li>3. Only fill the boxes below for photos with no location saved in them.</li>
        </ol>

        {!consented && (
          <div data-guide="photo-privacy" className="card-soft space-y-2 p-4">
            <p className="label-caps text-foreground">Privacy, in plain words</p>
            <ul className="space-y-1.5 text-[16px] text-muted-foreground">
              <li>
                · Your account details and photos live in your private Béa account (our secure
                Supabase database), tied only to your email.
              </li>
              <li>
                · Photos are stored privately — only you can see them, and only while signed in.
              </li>
              <li>
                · If a photo has a location saved inside it, Béa reads that spot to place it on your
                map. Nothing else is taken from the photo.
              </li>
              <li>· Your photos are never shared, sold, or used to advertise to you.</li>
              <li>· You can delete any photo at any time and it's gone for good.</li>
            </ul>
            <label className="flex items-start gap-2.5 pt-1 text-[16px] text-muted-foreground">
              <input
                type="checkbox"
                checked={dontAsk}
                onChange={(e) => setDontAsk(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              Don't ask me this every time.
            </label>
            <label
              htmlFor={PHOTO_INPUT_ID}
              onClick={agree}
              className="block w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-center text-[16px] font-semibold text-primary-foreground"
            >
              I understand — choose photos
            </label>
          </div>
        )}

        <div data-guide="photo-keep" className="card-soft space-y-2 p-4">
          <p className="label-caps text-foreground">What should Béa keep?</p>
          <button
            onClick={() => setMode("both")}
            className={`w-full rounded-xl border p-3 text-left ${mode === "both" ? "border-primary bg-elevated" : "border-border/60"}`}
          >
            <p className="text-[16px] font-medium">Locations and the photos</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Your photos are saved privately in your account and shown on your city memory pages.
            </p>
          </button>
          <button
            onClick={() => setMode("locations")}
            className={`w-full rounded-xl border p-3 text-left ${mode === "locations" ? "border-primary bg-elevated" : "border-border/60"}`}
          >
            <p className="text-[16px] font-medium">Locations only — don't keep my photos</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Béa reads only where each photo was taken to place a pin on your map. Nothing from the
              picture itself is uploaded or stored. Photos with no location saved inside are
              skipped.
            </p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (fallback)"
            className="rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[16px] outline-none focus:border-primary"
          />
          <input
            aria-label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[16px] outline-none focus:border-primary"
          />
        </div>

        {/* Visually hidden rather than display:none — Safari on iPhone can drop
            the picked files from an input that is not rendered at all. */}
        <input
          ref={fileInput}
          id={PHOTO_INPUT_ID}
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => onPicked(e.currentTarget)}
          onInput={(e) => onPicked(e.currentTarget)}
        />

        {pending.length > 0 ? (
          <div ref={confirmCard} className="card-soft space-y-3 p-4">
            <p className="font-display text-[18px] leading-snug">
              {mode === "both"
                ? "Are you certain you want to upload all these photos?"
                : "Read the locations from these photos?"}
            </p>
            <p className="text-[16px] text-muted-foreground">
              {mode === "both"
                ? `${pending.length} photo${pending.length > 1 ? "s" : ""} selected. They'll be saved privately to your Béa account.`
                : `${pending.length} photo${pending.length > 1 ? "s" : ""} selected. Only the place each one was taken is kept — no picture is uploaded.`}
            </p>

            {busy && <BeaRunning moment="photos.working" />}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPending([]);
                  if (fileInput.current) fileInput.current.value = "";
                }}
                disabled={busy}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-[16px] font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void onFiles(pending)}
                disabled={busy}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-[16px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy
                  ? mode === "both"
                    ? "Uploading…"
                    : "Reading locations…"
                  : mode === "both"
                    ? "Yes, upload them"
                    : "Yes, locations only"}
              </button>
            </div>
          </div>
        ) : consented && !busy ? (
          <label
            htmlFor={PHOTO_INPUT_ID}
            className="block w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-center text-[16px] font-semibold text-primary-foreground"
          >
            Choose photos
          </label>
        ) : (
          <button
            disabled
            className="w-full rounded-xl bg-primary px-4 py-3 text-[16px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            Choose photos
          </button>
        )}
        {status && <p className="text-[13px] text-muted-foreground">{status}</p>}

        {rows.length > 0 && (
          <section className="card-soft p-4">
            <div className="flex items-baseline justify-between">
              <p className="label-caps text-foreground">Already imported</p>
              <button
                onClick={() => setShowLibrary((v) => !v)}
                className="text-[13px] text-primary"
              >
                {showLibrary ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {rows.length} item{rows.length > 1 ? "s" : ""} across {Object.keys(groups).length}{" "}
              place{Object.keys(groups).length > 1 ? "s" : ""}. They live on your city memory pages
              — open them here only if you want to remove one.
            </p>

            {showLibrary && (
              <div className="mt-3 space-y-4">
                {Object.entries(groups).map(([label, list]) => (
                  <div key={label}>
                    <p className="label-caps mb-2 text-foreground">
                      {label} · {list.length}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {list.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setDeleting(r)}
                          aria-label={`Delete ${r.caption ?? `photo from ${label}`}`}
                          title="Tap to delete"
                          className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted p-1 text-center text-[13px] text-muted-foreground"
                        >
                          {urls[r.id] ? (
                            <img
                              src={urls[r.id]}
                              alt={r.caption ?? `Photo from ${label}`}
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            "Location only"
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <ConfirmSheet
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          title="Delete this photo?"
          body="It is removed from your photo memories and from any trip it was added to, for good."
          confirmLabel="Delete photo"
          onConfirm={() => {
            const row = deleting;
            setDeleting(null);
            if (row) void remove(row);
          }}
        />

        {loadError && <LoadError what="your photos" onRetry={() => void load()} />}

        {!loadError && rows.length === 0 && (
          <p className="text-[16px] text-muted-foreground">
            No photos yet. Once you import a few, each city becomes its own memory page.
          </p>
        )}

        <Link
          to="/memories"
          className="block rounded-xl bg-primary px-4 py-3 text-center text-[16px] font-semibold text-primary-foreground"
        >
          See your city memory pages
        </Link>

        <Link
          to="/profile"
          className="block text-[16px] text-muted-foreground underline underline-offset-4"
        >
          Back to your profile
        </Link>
      </div>
    </AppShell>
  );
}
