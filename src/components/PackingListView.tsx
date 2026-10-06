import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Bath,
  Briefcase,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
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
  Trash2,
  X,
} from "@/components/icons";
import { prepTint } from "@/components/prep-tint";
import type { PackItemRow, PackRow } from "@/hooks/usePacking";
import {
  SECTION_MAX_LEN,
  diffPackEdit,
  groupPackItems,
  guessSection,
  hasPackEdits,
  itemKind,
  normalizeSection,
  sectionChoices,
  sectionKind,
  uniqueSections,
  type PackEditItem,
  type SectionKind,
} from "@/lib/packing-sections";
import { todosFromPaste } from "@/lib/trip-todos";

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
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");

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

  const selectOnly = (key: string | null) => {
    setOnly(key);
    if (key !== null) setOpen((o) => new Set(o).add(key));
  };

  const addPasted = () => {
    const lines = todosFromPaste(paste, 60);
    if (lines.length === 0) return;
    const known = [...sections];
    for (const line of lines) {
      const section = guessSection(line, known);
      if (section && !known.includes(section)) known.push(section);
      addItem(line, section);
    }
    setPaste("");
    setPasting(false);
  };

  const toggleOpen = (key: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // Open sections are cards of their own; folded ones in a row share a card,
  // one line each, as in the master.
  const visibleGroups = groups
    .map((group, g) => ({ group, g, key: keyOf(group.section) }))
    .filter(({ key }) => only === null || only === key);
  const runs: Array<{ open: boolean; entries: typeof visibleGroups }> = [];
  for (const entry of visibleGroups) {
    const isOpen = open.has(entry.key);
    const last = runs[runs.length - 1];
    if (!isOpen && last && !last.open) last.entries.push(entry);
    else runs.push({ open: isOpen, entries: [entry] });
  }

  const sectionMenu = (key: string, section: string | null, title: string) => (
    <div className="relative">
      <button
        type="button"
        aria-label={`${title} options`}
        aria-expanded={menuFor === key}
        onClick={() => setMenuFor(menuFor === key ? null : key)}
        className="grid size-8 place-items-center rounded-full text-muted-foreground"
      >
        <EllipsisVertical className="size-4" />
      </button>
      {menuFor === key && (
        <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-border bg-card text-[13.5px] shadow-md">
          <button
            type="button"
            onClick={() => {
              setRenaming({ key, value: section ?? "" });
              setMenuFor(null);
            }}
            className="block w-full px-3 py-2 text-left"
          >
            {section ? "Rename section" : "Name this section"}
          </button>
          <button
            type="button"
            onClick={() => {
              deleteSection(section);
              setMenuFor(null);
            }}
            className="block w-full px-3 py-2 text-left text-destructive"
          >
            Remove section
          </button>
        </div>
      )}
    </div>
  );

  const renameForm = (key: string, section: string | null) =>
    renaming?.key === key ? (
      <form
        className="flex flex-1 gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          renameSection(section, renaming.value);
          setRenaming(null);
        }}
      >
        <input
          autoFocus
          value={renaming.value}
          maxLength={SECTION_MAX_LEN}
          onChange={(e) => setRenaming({ key, value: e.target.value })}
          aria-label="Section name"
          className="min-w-0 flex-1 rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[14.5px]"
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
    ) : null;

  return (
    <div className="space-y-3">
      <div className="plain-card px-4 py-3.5">
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-[23px] leading-none">
            {done} of {total} {total === 1 ? "item" : "items"} packed
          </p>
          <span className="shrink-0 text-[15px] tabular-nums">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Packed"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-3 h-2 overflow-hidden rounded-full bg-elevated"
        >
          <div
            className="h-full rounded-full bg-foreground/60 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {groups.length > 1 && (
        <div role="group" aria-label="Sections" className="grid grid-cols-3 gap-2">
          {[
            { key: null, label: "All items", n: total, Icon: Luggage },
            ...groups.map((g) => ({
              key: keyOf(g.section),
              label: g.section ?? "Unsorted",
              n: g.items.length,
              Icon: KIND_ICON[g.section ? sectionKind(g.section) : "other"],
            })),
          ].map((tile, i) => {
            const on = only === tile.key;
            return (
              <button
                key={tile.key ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => selectOnly(tile.key)}
                className={`tile-card-${(i % 5) + 1} flex min-h-[92px] min-w-0 flex-col justify-between gap-2 p-3 text-left transition-shadow ${
                  on ? "ring-2 ring-foreground/55" : ""
                }`}
              >
                <span className="flex items-start justify-between">
                  <tile.Icon className="size-6 text-foreground" aria-hidden />
                  <ChevronRight className="size-4 shrink-0 text-foreground" aria-hidden />
                </span>
                <span className="block min-w-0">
                  <span className="block truncate text-[13.5px] leading-tight" title={tile.label}>
                    {tile.label}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {tile.n} {tile.n === 1 ? "item" : "items"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {runs.map((run) =>
        run.open ? (
          run.entries.map(({ group, g, key }) => {
            const count = group.items.length;
            const packed = group.items.filter((i) => i.packed).length;
            const complete = count > 0 && packed === count;
            const Icon = KIND_ICON[group.section ? sectionKind(group.section) : "other"];
            const title = group.section ?? "Unsorted";
            return (
              <section key={key} className="plain-card px-3.5 pb-2 pt-2">
                <div className="flex items-center gap-2.5 py-1">
                  <Icon className="size-[22px] shrink-0 text-foreground" aria-hidden />
                  {renameForm(key, group.section) ?? (
                    <>
                      <button
                        type="button"
                        aria-expanded
                        onClick={() => toggleOpen(key)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate font-display text-[21px] leading-tight">
                          {title}
                        </span>
                        <span
                          className={`flex shrink-0 items-center gap-1 text-[13px] ${
                            complete ? "font-semibold text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {complete && <CheckCheck className="size-3.5" aria-hidden />}
                          {packed} of {count}
                        </span>
                      </button>
                      {sectionMenu(key, group.section, title)}
                      <button
                        type="button"
                        aria-label={`Fold ${title}`}
                        onClick={() => toggleOpen(key)}
                        className="grid size-8 place-items-center text-foreground"
                      >
                        <ChevronDown className="size-4 rotate-180" aria-hidden />
                      </button>
                    </>
                  )}
                </div>

                <ul className="divide-y divide-border border-t border-border">
                  {group.items.map((item, i) =>
                    editingItem === item.key ? (
                      <ItemEditor
                        key={item.key}
                        item={item}
                        sections={sections}
                        onDone={(patch) => {
                          mutate((items) =>
                            items.map((x) => (x.key === item.key ? { ...x, ...patch } : x)),
                          );
                          if (patch.section !== undefined) {
                            setOpen((o) => new Set(o).add(keyOf(patch.section ?? null)));
                          }
                          setEditingItem(null);
                        }}
                        onRemove={() => {
                          mutate((items) => items.filter((x) => x.key !== item.key));
                          setEditingItem(null);
                        }}
                        onCancel={() => setEditingItem(null)}
                      />
                    ) : (
                      <PackItem
                        key={item.key}
                        item={item}
                        tint={g + i + 1}
                        fallback={Icon}
                        onToggle={(on) => toggle(item, on)}
                        onEdit={() => setEditingItem(item.key)}
                      />
                    ),
                  )}
                  <li className="py-1.5">
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
                          aria-label={`Add to ${title}`}
                          autoFocus
                          value={addingIn.value}
                          onChange={(e) => setAddingIn({ key, value: e.target.value })}
                          placeholder={`Add to ${title}`}
                          className="min-w-0 flex-1 rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
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
                        className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground"
                      >
                        <Plus className="size-3.5" aria-hidden /> Add to {title}
                      </button>
                    )}
                  </li>
                </ul>
              </section>
            );
          })
        ) : (
          <div
            key={`folded-${run.entries[0]!.key}`}
            className="plain-card divide-y divide-border px-3.5"
          >
            {run.entries.map(({ group, key }) => {
              const count = group.items.length;
              const packed = group.items.filter((i) => i.packed).length;
              const complete = count > 0 && packed === count;
              const Icon = KIND_ICON[group.section ? sectionKind(group.section) : "other"];
              const title = group.section ?? "Unsorted";
              return (
                <div key={key} className="flex items-center gap-2.5 py-1.5">
                  <Icon className="size-5 shrink-0 text-foreground" aria-hidden />
                  {renameForm(key, group.section) ?? (
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-label={`Open ${title}, ${packed} of ${count} packed`}
                      onClick={() => toggleOpen(key)}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-display text-[19px] leading-tight">
                        {title}
                      </span>
                      <span
                        className={`flex shrink-0 items-center gap-1 text-[13px] ${
                          complete ? "font-semibold text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {complete && <CheckCheck className="size-3.5" aria-hidden />}
                        {packed} of {count}
                      </span>
                      <ChevronDown className="ml-2 size-4 shrink-0 text-foreground" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}

      {total === 0 && groups.length === 0 && (
        <p className="plain-card px-4 py-5 text-center text-[13.5px] text-muted-foreground">
          Nothing in this list yet. Add things below, or paste a list.
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
            setOnly(null);
            setNewSection(null);
          }}
        >
          <input
            aria-label="Section name"
            autoFocus
            value={newSection}
            maxLength={SECTION_MAX_LEN}
            onChange={(e) => setNewSection(e.target.value)}
            placeholder="Section name — e.g. Electronics"
            className="min-w-0 flex-1 rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
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
          className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground"
        >
          <Plus className="size-3.5" aria-hidden /> New section
        </button>
      )}

      {pasting && (
        <div className="plain-card space-y-2 p-3">
          <textarea
            autoFocus
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            aria-label="Paste a packing list"
            placeholder={"Passport\nPhone charger\nSwimsuit"}
            className="w-full rounded-2xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
          />
          <p className="text-[12px] text-muted-foreground">
            One thing per line. Béa sorts each into a section; you can move them after.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={todosFromPaste(paste, 60).length === 0}
              onClick={addPasted}
              className="btn-primary px-4 py-2 text-[14.5px] disabled:opacity-40 disabled:shadow-none"
            >
              Add {todosFromPaste(paste, 60).length || ""} items
            </button>
            <button
              type="button"
              onClick={() => setPasting(false)}
              className="text-[13.5px] text-muted-foreground underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* The ways in and, once something changed, the choice to keep it: one bar at the foot. */}
      <div className="sticky -bottom-4 z-[5] -mx-4 space-y-2 border-t border-border bg-card px-4 pb-4 pt-3">
        {dirty && (
          <div className="space-y-2 rounded-2xl border border-primary bg-card p-3">
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
                className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
              />
            )}
            {saveError && (
              <p role="alert" className="text-[14px] text-destructive">
                {saveError}
              </p>
            )}
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
        <QuickAdd
          sections={sections}
          onAdd={addItem}
          pasting={pasting}
          onPaste={() => setPasting((v) => !v)}
        />
      </div>
    </div>
  );
}

/** One item: tick, what kind of thing it is, its name and count; tap to edit. */
function PackItem({
  item,
  tint,
  fallback,
  onToggle,
  onEdit,
}: {
  item: PackEditItem;
  tint: number;
  fallback: ComponentType<{ className?: string }>;
  onToggle: (packed: boolean) => void;
  onEdit: () => void;
}) {
  const kind = itemKind(item.label);
  const Mark = kind === "other" ? fallback : KIND_ICON[kind];
  return (
    <li className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={item.packed}
        aria-label={item.packed ? `Unpack ${item.label}` : `Pack ${item.label}`}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-5 shrink-0 accent-foreground"
      />
      <span
        aria-hidden
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${prepTint(tint)}`}
      >
        <Mark className="size-[18px] text-foreground" />
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${item.label}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1 leading-snug">
          <span
            className={`block text-[14.5px] ${
              item.packed ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {item.label}
          </span>
          {item.quantity > 1 && (
            <span className="block text-[12.5px] text-muted-foreground tabular-nums">
              ×{item.quantity}
            </span>
          )}
        </span>
        <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The add bar at the foot of the list. Once something is typed it asks which
 * section the item goes in, with Béa's best guess already picked.
 */
function QuickAdd({
  sections,
  onAdd,
  pasting,
  onPaste,
}: {
  sections: string[];
  onAdd: (label: string, section: string | null) => void;
  pasting: boolean;
  onPaste: () => void;
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
      className="space-y-2"
    >
      {draft.trim() && (
        <div className="space-y-1.5 rounded-2xl bg-elevated p-2.5">
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
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-card"
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
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1.5">
          <Plus className="size-[18px] shrink-0 text-foreground" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add item"
            aria-label="Add an item"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none placeholder:text-foreground"
          />
          {draft.trim() && (
            <button
              type="submit"
              disabled={!choice}
              aria-label="Add this item"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onPaste}
          aria-expanded={pasting}
          className="flex shrink-0 items-center gap-1.5 text-[15px] underline underline-offset-2"
        >
          <FileText className="size-5" aria-hidden />
          Paste list
        </button>
      </div>
    </form>
  );
}

function ItemEditor({
  item,
  sections,
  onDone,
  onRemove,
  onCancel,
}: {
  item: PackEditItem;
  sections: string[];
  onDone: (patch: Partial<Pick<PackEditItem, "label" | "quantity" | "section">>) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [quantity, setQuantity] = useState(item.quantity);
  const [section, setSection] = useState(item.section ?? "");
  const choices = sectionChoices(sections);

  return (
    <li className="my-2 space-y-2 rounded-2xl bg-elevated p-2.5">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Item"
        className="w-full rounded-lg border border-[var(--field-border)] bg-card px-2.5 py-1.5 text-[14.5px]"
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
          className="min-w-0 flex-1 rounded-lg border border-[var(--field-border)] bg-card px-2 py-1.5 text-[13.5px]"
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
          onClick={onRemove}
          className="mr-auto flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-[13px] font-semibold text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Remove
        </button>
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
