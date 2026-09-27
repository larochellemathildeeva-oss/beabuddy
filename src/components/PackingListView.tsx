import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Bath,
  Briefcase,
  Check,
  CheckCheck,
  ChevronDown,
  EllipsisVertical,
  FileText,
  Luggage,
  Minus,
  Package,
  Pencil,
  Pill,
  Plane,
  Plug,
  Plus,
  Shirt,
  Snowflake,
  Sun,
  X,
} from "lucide-react";
import type { PackItemRow, PackRow } from "@/hooks/usePacking";
import {
  SECTION_MAX_LEN,
  diffPackEdit,
  groupPackItems,
  guessSection,
  hasPackEdits,
  normalizeSection,
  sectionChoices,
  sectionKind,
  uniqueSections,
  type PackEditItem,
  type SectionKind,
} from "@/lib/packing-sections";

const KIND_ICON: Record<SectionKind, ComponentType<{ className?: string }>> = {
  clothes: Shirt,
  toiletries: Bath,
  electronics: Plug,
  documents: FileText,
  medication: Pill,
  beach: Sun,
  cold: Snowflake,
  work: Briefcase,
  travel: Plane,
  other: Package,
};

const UNSORTED = "__none";
const keyOf = (section: string | null) => section ?? UNSORTED;

let keySeq = 0;
const newKey = () => `new-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

function fromRows(rows: PackItemRow[]): PackEditItem[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      key: r.id,
      id: r.id,
      label: r.label,
      section: r.section,
      quantity: r.quantity,
      packed: r.packed,
    }));
}

type Actions = {
  toggleItem: (id: string, packed: boolean) => Promise<void>;
  saveEdits: (listId: string, edited: PackEditItem[]) => Promise<void>;
  saveAsNewPack: (listId: string, name: string, edited: PackEditItem[]) => Promise<string>;
};

/**
 * One packing list, grouped into sections that fold away. Ticking things off
 * saves straight away; adding, removing, renaming or moving things is held as
 * an unsaved edit until the traveller chooses to update this list or keep it
 * as it was and save the changes as a new one.
 */
export function PackingListView({
  pack,
  rows,
  actions,
  onSavedAsNew,
}: {
  pack: PackRow;
  rows: PackItemRow[];
  actions: Actions;
  onSavedAsNew: (id: string) => void;
}) {
  const [edit, setEdit] = useState<PackEditItem[] | null>(null);
  const [emptySections, setEmptySections] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<{ key: string; value: string } | null>(null);
  const [newSection, setNewSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  /** One section only, from the chips; null shows them all. */
  const [only, setOnly] = useState<string | null>(null);

  const saved = useMemo(() => fromRows(rows), [rows]);
  const view = edit ?? saved;

  // A different list starts fresh, with its first unfinished section open.
  useEffect(() => {
    setEdit(null);
    setEmptySections([]);
    setMenuFor(null);
    setRenaming(null);
    setEditingItem(null);
    setAddingIn(null);
    setNewName(null);
    setSaveError(null);
    const groups = groupPackItems(fromRows(rows).map((item, position) => ({ ...item, position })));
    const first = groups.find((g) => g.items.some((i) => !i.packed)) ?? groups[0];
    setOpen(new Set(first ? [keyOf(first.section)] : []));
    // Only when the list itself changes, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.id]);

  const groups = useMemo(() => {
    const grouped = groupPackItems(view.map((item, position) => ({ ...item, position })));
    const have = new Set(grouped.map((g) => keyOf(g.section)));
    for (const s of emptySections) if (!have.has(s)) grouped.push({ section: s, items: [] });
    return grouped;
  }, [view, emptySections]);

  const sections = uniqueSections([...view.map((i) => i.section), ...emptySections]);
  const dirty = edit !== null && hasPackEdits(diffPackEdit(rows, edit));
  const total = view.length;
  const done = view.filter((i) => i.packed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const mutate = (fn: (items: PackEditItem[]) => PackEditItem[]) => {
    setSaveError(null);
    setEdit((current) => fn(current ?? saved));
  };

  const toggle = (item: PackEditItem, packed: boolean) => {
    // With nothing else changed, a tick saves straight away.
    if (!dirty && item.id) {
      setEdit(null);
      void actions.toggleItem(item.id, packed);
      return;
    }
    mutate((items) => items.map((i) => (i.key === item.key ? { ...i, packed } : i)));
  };

  const addItem = (label: string, section: string | null) => {
    const clean = label.trim();
    if (!clean) return;
    const heading = normalizeSection(section);
    mutate((items) => [
      ...items,
      { key: newKey(), label: clean, section: heading, quantity: 1, packed: false },
    ]);
    setEmptySections((s) => s.filter((x) => x !== heading));
    setOpen((o) => new Set(o).add(keyOf(heading)));
  };

  const renameSection = (from: string | null, to: string) => {
    const heading = normalizeSection(to);
    if (!heading || heading === from) return;
    // Renaming onto a heading the list already has merges the two.
    const target = sections.find((s) => s.toLowerCase() === heading.toLowerCase()) ?? heading;
    mutate((items) => items.map((i) => (i.section === from ? { ...i, section: target } : i)));
    setEmptySections((s) => s.map((x) => (x === from ? target : x)));
    setOpen((o) => {
      const next = new Set(o);
      if (next.delete(keyOf(from))) next.add(target);
      return next;
    });
  };

  const deleteSection = (section: string | null) => {
    mutate((items) => items.filter((i) => i.section !== section));
    setEmptySections((s) => s.filter((x) => x !== section));
  };

  const discard = () => {
    setEdit(null);
    setEmptySections([]);
    setNewName(null);
    setSaveError(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setSaveError(null);
    try {
      await fn();
    } catch {
      setSaveError("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveHere = () =>
    run(async () => {
      if (!edit) return;
      await actions.saveEdits(pack.id, edit);
      discard();
    });

  const saveAsNew = () =>
    run(async () => {
      if (!edit) return;
      const name = (newName ?? "").trim() || `${pack.name} (edited)`;
      const id = await actions.saveAsNewPack(pack.id, name, edit);
      discard();
      onSavedAsNew(id);
    });

  return (
    <div className={dirty ? "pb-2" : ""}>
      <div className="tile-card-3 mb-3 flex items-center gap-3 px-3.5 py-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-elevated">
          <Luggage className="size-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px]">
              <b>
                {done} of {total}
              </b>{" "}
              packed
            </p>
            <span className="text-[13px] font-semibold">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Packed"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {groups.length > 1 && (
        <div
          role="group"
          aria-label="Sections"
          className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 text-[13px] font-semibold"
        >
          {[
            { key: null, label: "All", count: total },
            ...groups.map((g) => ({
              key: keyOf(g.section),
              label: g.section ?? "Unsorted",
              count: g.items.length,
            })),
          ].map((chip) => (
            <button
              key={chip.key ?? "all"}
              type="button"
              aria-pressed={only === chip.key}
              onClick={() => setOnly(chip.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 ${
                only === chip.key
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {chip.label} · {chip.count}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {groups.map((group, g) => {
          const key = keyOf(group.section);
          if (only !== null && only !== key) return null;
          const isOpen = open.has(key);
          const count = group.items.length;
          const packed = group.items.filter((i) => i.packed).length;
          const complete = count > 0 && packed === count;
          const Icon = KIND_ICON[group.section ? sectionKind(group.section) : "other"];
          const title = group.section ?? "Unsorted";
          return (
            <section
              key={key}
              className={`tile-card-${(g % 5) + 1} transition-colors ${
                complete ? "ring-1 ring-primary/40" : ""
              }`}
            >
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated">
                  <Icon
                    className={`size-[18px] ${complete ? "text-primary" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                </span>
                {renaming?.key === key ? (
                  <form
                    className="flex flex-1 gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      renameSection(group.section, renaming.value);
                      setRenaming(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.value}
                      maxLength={SECTION_MAX_LEN}
                      onChange={(e) => setRenaming({ key, value: e.target.value })}
                      aria-label="Section name"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1 text-[14.5px]"
                    />
                    <button
                      type="submit"
                      aria-label="Save section name"
                      className="rounded-lg bg-primary px-2 text-primary-foreground"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel"
                      onClick={() => setRenaming(null)}
                      className="rounded-lg border border-border px-2"
                    >
                      <X className="size-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpen((o) => {
                        const next = new Set(o);
                        if (!next.delete(key)) next.add(key);
                        return next;
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-[20px] leading-tight">
                      {title}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] ${
                        complete
                          ? "bg-primary/10 font-semibold text-primary"
                          : "bg-elevated text-muted-foreground"
                      }`}
                    >
                      {complete && <CheckCheck className="size-3.5" />}
                      {packed} of {count}
                    </span>
                  </button>
                )}
                {renaming?.key !== key && (
                  <>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`${title} options`}
                        aria-expanded={menuFor === key}
                        onClick={() => setMenuFor(menuFor === key ? null : key)}
                        className="rounded-lg p-1 text-muted-foreground"
                      >
                        <EllipsisVertical className="size-4" />
                      </button>
                      {menuFor === key && (
                        <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl border border-border bg-card text-[13.5px] shadow-md">
                          <button
                            type="button"
                            onClick={() => {
                              setRenaming({ key, value: group.section ?? "" });
                              setMenuFor(null);
                            }}
                            className="block w-full px-3 py-2 text-left"
                          >
                            {group.section ? "Rename section" : "Name this section"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteSection(group.section);
                              setMenuFor(null);
                            }}
                            className="block w-full px-3 py-2 text-left text-destructive"
                          >
                            Remove section
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={isOpen ? `Fold ${title}` : `Open ${title}`}
                      onClick={() =>
                        setOpen((o) => {
                          const next = new Set(o);
                          if (!next.delete(key)) next.add(key);
                          return next;
                        })
                      }
                      className="p-1 text-muted-foreground"
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </>
                )}
              </div>

              {isOpen && (
                <ul className="divide-y divide-border/60 px-3.5 pb-2.5">
                  {group.items.map((item) =>
                    editingItem === item.key ? (
                      <ItemEditor
                        key={item.key}
                        item={item}
                        sections={sections}
                        onDone={(patch) => {
                          mutate((items) =>
                            items.map((i) => (i.key === item.key ? { ...i, ...patch } : i)),
                          );
                          if (patch.section !== undefined) {
                            setOpen((o) => new Set(o).add(keyOf(patch.section ?? null)));
                          }
                          setEditingItem(null);
                        }}
                        onCancel={() => setEditingItem(null)}
                      />
                    ) : (
                      <li key={item.key} className="flex items-center gap-3 py-2.5">
                        <input
                          id={`pack-${item.key}`}
                          type="checkbox"
                          checked={item.packed}
                          onChange={(e) => toggle(item, e.target.checked)}
                          className="size-5 shrink-0 accent-primary"
                        />
                        <label
                          htmlFor={`pack-${item.key}`}
                          className={`min-w-0 flex-1 text-[15px] ${
                            item.packed ? "text-muted-foreground line-through" : "font-semibold"
                          }`}
                        >
                          {item.label}
                        </label>
                        {item.quantity > 1 && (
                          <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[12px] font-semibold tabular-nums">
                            ×{item.quantity}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingItem(item.key)}
                          aria-label={`Edit ${item.label}`}
                          className="p-1 text-muted-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mutate((items) => items.filter((i) => i.key !== item.key))}
                          aria-label={`Remove ${item.label}`}
                          className="p-1 text-muted-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ),
                  )}
                  <li className="pt-2">
                    {addingIn?.key === key ? (
                      <form
                        className="flex gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addItem(addingIn.value, group.section);
                          setAddingIn({ key, value: "" });
                        }}
                      >
                        <input
                          autoFocus
                          value={addingIn.value}
                          onChange={(e) => setAddingIn({ key, value: e.target.value })}
                          placeholder={`Add to ${title}`}
                          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
                        />
                        <button
                          type="submit"
                          disabled={!addingIn.value.trim()}
                          className="rounded-xl bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          aria-label="Done adding"
                          onClick={() => setAddingIn(null)}
                          className="rounded-xl border border-border px-2.5"
                        >
                          <X className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingIn({ key, value: "" })}
                        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-2 text-[14px] text-muted-foreground"
                      >
                        <Plus className="size-4" /> Add item
                      </button>
                    )}
                  </li>
                </ul>
              )}
            </section>
          );
        })}

        {total === 0 && groups.length === 0 && (
          <p className="py-4 text-center text-[13px] text-muted-foreground">
            Nothing in this pack yet.
          </p>
        )}

        {newSection !== null ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const heading = normalizeSection(newSection);
              if (!heading) return;
              const existing = sections.find((s) => s.toLowerCase() === heading.toLowerCase());
              if (!existing) setEmptySections((s) => [...s, heading]);
              setOpen((o) => new Set(o).add(existing ?? heading));
              setAddingIn({ key: existing ?? heading, value: "" });
              setNewSection(null);
            }}
          >
            <input
              autoFocus
              value={newSection}
              maxLength={SECTION_MAX_LEN}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="Section name — e.g. Electronics"
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
            />
            <button
              type="submit"
              disabled={!newSection.trim()}
              className="rounded-xl bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => setNewSection(null)}
              className="rounded-xl border border-border px-2.5"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNewSection("")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2.5 text-[14px] text-muted-foreground"
          >
            <Plus className="size-4" /> Add section
          </button>
        )}
      </div>

      <QuickAdd sections={sections} onAdd={addItem} />

      {dirty && (
        <div className="sticky bottom-2 mt-3 space-y-2 rounded-2xl border border-primary bg-card p-3 shadow-md">
          <p className="text-[13.5px] font-semibold">You changed this list.</p>
          <p className="text-[12.5px] text-muted-foreground">
            Keep “{pack.name}” as it was and save your version as a new list, or update this one.
          </p>
          {newName !== null && (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`${pack.name} (edited)`}
              aria-label="Name for the new list"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
            />
          )}
          {saveError && <p className="text-[13px] text-destructive">{saveError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => (newName === null ? setNewName("") : void saveAsNew())}
              className="rounded-xl bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {newName === null ? "Save as new list" : "Save new list"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveHere()}
              className="rounded-xl border border-border px-3 py-2 text-[14px] font-medium disabled:opacity-50"
            >
              Update this list
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={discard}
            className="w-full text-center text-[12.5px] text-muted-foreground underline"
          >
            Discard changes
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The add box under the list. Once something is typed it asks which section
 * the item goes in, with Béa's best guess already picked.
 */
function QuickAdd({
  sections,
  onAdd,
}: {
  sections: string[];
  onAdd: (label: string, section: string | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const guess = guessSection(draft, sections);
  const choice = custom !== null ? normalizeSection(custom) : (picked ?? guess);
  const choices = sectionChoices(sections);
  if (guess && !choices.includes(guess)) choices.unshift(guess);

  const reset = () => {
    setDraft("");
    setPicked(null);
    setCustom(null);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim() || !choice) return;
        onAdd(draft, choice);
        reset();
      }}
      className="mt-3 space-y-2"
    >
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item"
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || !choice}
          className="rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {draft.trim() && (
        <div className="space-y-1.5 rounded-xl bg-elevated p-2.5">
          <p className="text-[12.5px] text-muted-foreground">
            Which section does “{draft.trim()}” go in?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((s) => {
              const on = custom === null && choice === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPicked(s);
                    setCustom(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-[13px] ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            {custom === null ? (
              <button
                type="button"
                onClick={() => setCustom("")}
                className="rounded-full border border-dashed border-border bg-card px-3 py-1 text-[13px]"
              >
                + New section
              </button>
            ) : (
              <input
                autoFocus
                value={custom}
                maxLength={SECTION_MAX_LEN}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="New section"
                aria-label="New section name"
                className="w-36 rounded-full border border-primary bg-card px-3 py-1 text-[13px]"
              />
            )}
          </div>
        </div>
      )}
    </form>
  );
}

function ItemEditor({
  item,
  sections,
  onDone,
  onCancel,
}: {
  item: PackEditItem;
  sections: string[];
  onDone: (patch: Partial<Pick<PackEditItem, "label" | "quantity" | "section">>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [quantity, setQuantity] = useState(item.quantity);
  const [section, setSection] = useState(item.section ?? "");
  const choices = sectionChoices(sections);

  return (
    <li className="space-y-2 rounded-xl border border-primary bg-card p-2.5">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Item"
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[14.5px]"
      />
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            aria-label="One fewer"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-1.5"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-6 text-center text-[13.5px]">{quantity}</span>
          <button
            type="button"
            aria-label="One more"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="p-1.5"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          aria-label="Section"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[13.5px]"
        >
          <option value="">Unsorted</option>
          {choices.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-[13px] text-muted-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() =>
            onDone({ label: label.trim(), quantity, section: normalizeSection(section) })
          }
          className="rounded-lg bg-primary px-3 py-1 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </li>
  );
}
