import { useState } from "react";
import { toast } from "sonner";
import { X } from "@/components/icons";
import { TRIP_PREFERENCE_CHOICES, TRIP_PREFERENCES_MAX } from "@/lib/trip-preferences";

/**
 * "Just for this trip": tap the ready-made ones, or type your own. Every plan
 * Béa drafts, reworks or rearranges for this trip reads them.
 */
export function TripPreferencesPanel({
  list,
  onPhone,
  onSave,
}: {
  list: string[];
  onPhone: boolean;
  onSave: (next: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const custom = list.filter((p) => !(TRIP_PREFERENCE_CHOICES as readonly string[]).includes(p));
  const full = list.length >= TRIP_PREFERENCES_MAX;

  const save = (next: string[]) =>
    void onSave(next).catch(() => toast.error("That didn't save. Try again."));
  const toggle = (choice: string) =>
    save(list.includes(choice) ? list.filter((p) => p !== choice) : [...list, choice]);

  return (
    <div className="space-y-3">
      <p className="plain-card p-3.5 text-[13.5px] text-muted-foreground">
        Your usual preferences still count. These are for this trip only, and when the two disagree,
        these win — in every plan Béa builds, reworks or rearranges for it.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TRIP_PREFERENCE_CHOICES.map((choice) => {
          const on = list.includes(choice);
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(choice)}
              className={`min-h-9 rounded-full border px-3 text-[13px] font-medium disabled:opacity-50 ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {custom.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {custom.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => save(list.filter((x) => x !== p))}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-foreground"
              >
                {p}
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">: remove</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || full) return;
          save([...list, draft]);
          setDraft("");
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          placeholder="Travelling with Dad, a museum a day…"
          aria-label="Add your own"
          className="min-w-0 flex-1 rounded-xl border border-[var(--field-border)] bg-card px-3 py-2.5 text-[14.5px] outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || full}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {onPhone && (
        <p className="text-[12px] text-muted-foreground">
          Kept on this phone for now: the others on this trip won't see these yet.
        </p>
      )}
    </div>
  );
}
