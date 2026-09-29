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

/**
 * One day's stops, reordered by dragging a grip. Only the grip starts a drag,
 * so scrolling the list and swiping a card keep working as before; a
 * keyboard can pick a stop up with Space and move it with the arrows.
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
  /** While a drag is on, the list hides what sits between the cards. */
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
      onDragStart={() => onDragging(true)}
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
  } = useSortable({ id });
  const liStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 40, position: "relative", opacity: 0.92 } : {}),
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
