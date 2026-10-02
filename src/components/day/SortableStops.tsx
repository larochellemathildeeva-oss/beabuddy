import type { CSSProperties, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "@/components/icons";

const dragTitle = (item: { data: { current?: Record<string, unknown> | undefined } }) => {
  const title = item.data.current?.["title"];
  return typeof title === "string" && title.trim() ? title : "stop";
};

/**
 * One day's stops, reordered by dragging a grip. Only the grip starts a drag,
 * so scrolling the list and swiping a card keep working as before; a
 * keyboard can pick a stop up with Space and move it with the arrows.
 *
 * The list no longer asks the parent to remove connectors/Now/group labels
 * while a drag is active. Removing those rows changed the list's height under
 * the traveller's finger. Keeping the document in place is more important;
 * the sortable rows themselves still animate around the lifted card.
 */
export function SortableDay({
  ids,
  onDrop,
  onDragging,
  children,
}: {
  /** The stops shown, in order. */
  ids: string[];
  onDrop: (activeId: string, overId: string) => void;
  /** Kept for the caller's settled-state cleanup; drag no longer collapses rows. */
  onDragging: (dragging: boolean) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    // A few pixels before a drag starts, so a tap on the grip is not a move.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const end = (event: DragEndEvent) => {
    onDragging(false);
    if (event.over && event.active.id !== event.over.id) {
      onDrop(String(event.active.id), String(event.over.id));
    }
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To move a stop, press Space. Use the arrow keys to choose its new place, then press Space again. Press Escape to cancel.",
        },
        announcements: {
          onDragStart({ active }) {
            return `Picked up ${dragTitle(active)}.`;
          },
          onDragOver({ active, over }) {
            if (!over || active.id === over.id) return undefined;
            return `${dragTitle(active)} is over ${dragTitle(over)}.`;
          },
          onDragEnd({ active, over }) {
            if (!over || active.id === over.id) return `${dragTitle(active)} stayed where it was.`;
            return `Moved ${dragTitle(active)} near ${dragTitle(over)}.`;
          },
          onDragCancel({ active }) {
            return `Move cancelled. ${dragTitle(active)} returned to its place.`;
          },
        },
      }}
      onDragStart={() => {
        // Intentionally do not set the parent's old "dragging" presentation:
        // it removed non-sortable timeline rows and made the list shrink.
      }}
      onDragCancel={() => onDragging(false)}
      onDragEnd={end}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** What a sortable stop hands its card: the row, its style, and the grip. */
export type SortableBind = {
  liRef: (el: HTMLLIElement | null) => void;
  liStyle: CSSProperties;
  dragHandle: ReactNode;
};

export function SortableStop({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: (bind: SortableBind) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { title } });
  const translated = CSS.Translate.toString(transform);
  const liStyle: CSSProperties = {
    transform: isDragging ? `${translated || "translate3d(0, 0, 0)"} scale(1.02)` : translated,
    transition,
    transformOrigin: "center center",
    ...(isDragging
      ? {
          zIndex: 40,
          position: "relative",
          opacity: 1,
          filter: "drop-shadow(0 10px 14px rgb(0 0 0 / 0.12))",
        }
      : {}),
  };
  const dragHandle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      // The card's swipe listens on the row too; a drag is not a swipe.
      onPointerDown={(e) => {
        e.stopPropagation();
        listeners?.["onPointerDown"]?.(e);
      }}
      aria-label={`Drag to reorder ${title}`}
      className="tap-44 -ml-1 grid w-6 shrink-0 cursor-grab touch-none place-items-center self-stretch rounded-lg text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
  return <>{children({ liRef: setNodeRef, liStyle, dragHandle })}</>;
}
