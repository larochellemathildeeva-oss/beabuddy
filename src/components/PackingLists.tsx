import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePacking } from "@/hooks/usePacking";

const STARTERS: Record<string, string[]> = {
  "🧳 Weekend": [
    "Passport / ID",
    "Phone + charger",
    "Toothbrush & toothpaste",
    "2 tops",
    "1 pair of trousers",
    "Underwear",
    "Socks",
    "Pyjamas",
    "Deodorant",
    "Medication",
  ],
  "🏖️ Beach": [
    "Swimsuit",
    "Sunscreen",
    "Sunglasses",
    "Hat",
    "Flip flops",
    "Beach towel",
    "Light dresses / shirts",
    "After-sun",
    "Book",
    "Water bottle",
  ],
  "🎿 Ski": [
    "Ski jacket",
    "Snow trousers",
    "Thermal base layers",
    "Gloves",
    "Goggles",
    "Helmet",
    "Wool socks",
    "Lip balm",
    "Hand warmers",
    "Après-ski boots",
  ],
  "💼 Work trip": [
    "Laptop + charger",
    "Adapters",
    "Notebook & pen",
    "Blazer",
    "Dress shirts",
    "Dress shoes",
    "Business cards",
    "Headphones",
    "Badge / lanyard",
  ],
};

export function PackingLists({
  tripId,
  label,
  hint,
  openSignal,
  hideTrigger = false,
}: {
  tripId?: string | null;
  label?: string;
  hint?: string;
  openSignal?: number;
  hideTrigger?: boolean;
} = {}) {
  const p = usePacking(tripId ?? null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [newPack, setNewPack] = useState("");
  const [starter, setStarter] = useState("");
  const [itemDraft, setItemDraft] = useState("");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setOpen(true);
      setShowNew(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (!activeId && p.packs[0]) setActiveId(p.packs[0].id);
    if (activeId && !p.packs.some((x) => x.id === activeId)) setActiveId(p.packs[0]?.id ?? "");
  }, [p.packs, activeId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = p.packs.find((x) => x.id === activeId) ?? null;
  const activeItems = p.items
    .filter((i) => i.list_id === activeId)
    .sort((a, b) => a.position - b.position);
  const done = activeItems.filter((i) => i.packed).length;
  const pct = activeItems.length ? Math.round((done / activeItems.length) * 100) : 0;

  return (
    <>
      {!hideTrigger && (
        <button
          data-guide="packing-lists"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-[12px] font-semibold"
        >
          <span>🧳 {label ?? "Packing lists"}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {p.packs.length === 0
              ? "Create a list"
              : `${p.packs.length} list${p.packs.length > 1 ? "s" : ""}`}
          </span>
        </button>
      )}

      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={label ?? "Packing lists"}
            onClick={(e) => e.stopPropagation()}
            className="rise flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="label-caps text-foreground">{label ?? "Packing lists"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {hint ?? "Tick things off as you pack."}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close packing lists"
                className="rounded-full border border-border px-3 py-1 text-[12px]"
              >
                Close
              </button>
            </div>

            {!p.signedIn ? (
              <p className="p-6 text-center text-[13px] text-muted-foreground">
                Sign in to save packing lists to your account.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {p.packs.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => setActiveId(pack.id)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] ${
                        pack.id === activeId ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {pack.emoji} {pack.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNew(!showNew)}
                    className="rounded-full border border-dashed border-border px-3 py-1.5 text-[12px]"
                  >
                    + New pack
                  </button>
                </div>

                {showNew && (
                  <div className="mb-3 space-y-2 rounded-xl border border-border p-3">
                    <input
                      value={newPack}
                      onChange={(e) => setNewPack(e.target.value)}
                      placeholder="Pack name — e.g. Ski week"
                      className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(STARTERS).map((k) => (
                        <button
                          key={k}
                          onClick={() => setStarter(starter === k ? "" : k)}
                          className={`rounded-full border px-3 py-1.5 text-[12px] ${
                            starter === k ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pick a starter to fill the pack, or leave it blank and add your own.
                    </p>
                    <button
                      disabled={!newPack.trim() && !starter}
                      onClick={async () => {
                        const name = newPack.trim() || starter.replace(/^\S+\s/, "");
                        const emoji = starter ? (starter.split(" ")[0] ?? "🧳") : "🧳";
                        const id = await p.createPack(name, emoji, starter ? (STARTERS[starter] ?? []) : []);
                        setActiveId(id);
                        setNewPack("");
                        setStarter("");
                        setShowNew(false);
                      }}
                      className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Create pack
                    </button>
                  </div>
                )}

                {!active && !showNew && (
                  <p className="py-6 text-center text-[13px] text-muted-foreground">
                    {tripId
                      ? "No packing list on this trip yet. Create one here, or attach a copy of a saved list when you make a trip."
                      : "No packs yet. Create one and reuse it for every trip."}
                  </p>
                )}

                {active && (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[12px] text-muted-foreground">
                        {done} of {activeItems.length} packed
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void p.resetPack(active.id)}
                          className="text-[11px] text-muted-foreground underline"
                        >
                          Uncheck all
                        </button>
                        <button
                          onClick={() => void p.duplicatePack(active.id)}
                          className="text-[11px] text-muted-foreground underline"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => void p.deletePack(active.id)}
                          className="text-[11px] text-muted-foreground underline"
                        >
                          Delete pack
                        </button>
                      </div>
                    </div>
                    <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <ul className="space-y-1">
                      {activeItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 rounded-xl px-1 py-1.5">
                          <input
                            id={`pack-${item.id}`}
                            type="checkbox"
                            checked={item.packed}
                            onChange={(e) => void p.toggleItem(item.id, e.target.checked)}
                            className="size-5 accent-[hsl(var(--primary))]"
                          />
                          <label
                            htmlFor={`pack-${item.id}`}
                            className={`flex-1 text-[14px] ${
                              item.packed ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {item.label}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </label>
                          <button
                            onClick={() => void p.removeItem(item.id)}
                            aria-label={`Remove ${item.label}`}
                            className="px-1 text-[12px] text-muted-foreground"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                      {activeItems.length === 0 && (
                        <li className="py-4 text-center text-[12px] text-muted-foreground">
                          Nothing in this pack yet.
                        </li>
                      )}
                    </ul>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!itemDraft.trim()) return;
                        void p.addItem(active.id, itemDraft.trim());
                        setItemDraft("");
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        value={itemDraft}
                        onChange={(e) => setItemDraft(e.target.value)}
                        placeholder="Add an item"
                        className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                      />
                      <button
                        type="submit"
                        disabled={!itemDraft.trim()}
                        className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Add
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
