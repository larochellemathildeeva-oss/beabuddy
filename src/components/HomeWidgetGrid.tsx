import { type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HOME_SECTIONS, type HomeSectionKey } from "@/hooks/useHomeLayout";
import { HOME_WIDGET_SIZES, homeWidgetCells } from "@/lib/home-widget-grid";
import type { ModuleLayout, WidgetSize } from "@/lib/module-layout";

const labels = new Map(HOME_SECTIONS.map((module) => [module.key, module.label]));
const sizeLabels = { small: "Small · 1 × 1", wide: "Wide · 2 × 1", large: "Large · 2 × 2" };

/** Align centres so keyboard drops work between different widget spans. */
const widgetKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
  event.preventDefault();
  const { active, over, collisionRect, droppableRects, droppableContainers } = context;
  if (!active || !collisionRect) return;
  const currentId = over?.id ?? active.id;
  const current = droppableRects.get(currentId) ?? collisionRect;
  const candidates = droppableContainers.getEnabled().flatMap((entry) => {
    const rect = droppableRects.get(entry.id);
    if (!rect || entry.id === currentId) return [];
    const inDirection =
      event.code === "ArrowUp"
        ? rect.bottom <= current.top + 1
        : event.code === "ArrowDown"
          ? rect.top >= current.bottom - 1
          : event.code === "ArrowLeft"
            ? rect.right <= current.left + 1
            : rect.left >= current.right - 1;
    return inDirection ? [rect] : [];
  });
  const distance = (rect: typeof current) =>
    Math.hypot(
      rect.left + rect.width / 2 - (current.left + current.width / 2),
      rect.top + rect.height / 2 - (current.top + current.height / 2),
    );
  candidates.sort((a, b) => distance(a) - distance(b));
  const target = candidates[0];
  if (!target) return;
  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + (target.height - collisionRect.height) / 2,
  };
};

export function HomeWidgetGrid({
  modules,
  items,
  editing,
  render,
  onResize,
  onReorder,
}: {
  modules: ModuleLayout<HomeSectionKey>;
  items: HomeSectionKey[];
  editing: boolean;
  render: (key: HomeSectionKey) => ReactNode;
  onResize: (key: HomeSectionKey, size: WidgetSize) => void;
  onReorder: (active: HomeSectionKey, over: HomeSectionKey) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: widgetKeyboardCoordinates,
      scrollBehavior: "auto",
    }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const underPointer = pointerWithin(args);
        return underPointer.length ? underPointer : closestCenter(args);
      }}
      onDragEnd={({ active, over }) => {
        if (editing && over) onReorder(active.id as HomeSectionKey, over.id as HomeSectionKey);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space to pick up a widget, arrow keys to move, Space to drop, or Escape to cancel.",
        },
      }}
    >
      <SortableContext items={items} strategy={() => null}>
        <div className="home-widget-grid" data-editing={editing} aria-label="Home widgets">
          {homeWidgetCells(items, modules.sizes).map((cell) => (
            <HomeWidget key={cell.key} cell={cell} editing={editing} onResize={onResize}>
              {render(cell.key)}
            </HomeWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function HomeWidget({
  cell,
  editing,
  children,
  onResize,
}: {
  cell: ReturnType<typeof homeWidgetCells>[number];
  editing: boolean;
  children: ReactNode;
  onResize: (key: HomeSectionKey, size: WidgetSize) => void;
}) {
  // The grid repacks on drop. Only the picked-up tile follows the pointer;
  // other differently sized tiles retain their own dimensions.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useSortable({ id: cell.key, disabled: !editing });
  const label = labels.get(cell.key) ?? cell.key;
  return (
    <section
      ref={setNodeRef}
      className="home-widget"
      data-size={cell.size}
      data-module={cell.key}
      data-dragging={isDragging}
      aria-label={label}
      style={{
        gridColumn: `${cell.column} / span ${cell.columns}`,
        gridRow: `${cell.row} / span ${cell.rows}`,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="home-widget-inner">
        {editing && (
          <div className="home-widget-controls">
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="home-widget-handle"
              {...attributes}
              {...listeners}
              aria-label={`Move ${label}`}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                fill="currentColor"
              >
                {[7, 12, 17].flatMap((y) =>
                  [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />),
                )}
              </svg>
            </button>
            <label className="home-widget-size">
              <span>Size</span>
              <select
                aria-label={`Size of ${label}`}
                value={cell.size}
                onChange={(event) => onResize(cell.key, event.target.value as WidgetSize)}
              >
                {HOME_WIDGET_SIZES[cell.key].map((size) => (
                  <option key={size} value={size}>
                    {sizeLabels[size]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="home-widget-content" inert={editing ? true : undefined}>
          {children}
        </div>
      </div>
    </section>
  );
}
