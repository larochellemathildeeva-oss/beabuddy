import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark, Check, Trash2 } from "lucide-react";
import { COMPLETE_PX, lockAxis, swipeOutcome, TRAY_PX } from "@/lib/swipe";

/**
 * A stop card you can swipe, from the prototype's gesture engine.
 *
 * Right marks it done (or not done). Left docks it open on "Save" and
 * "Delete"; a long pull left deletes straight away. Every one of these has a
 * button on the card as well, so nothing depends on the gesture — it is the
 * quick way, not the only way.
 *
 * The axis locks after a few pixels: a mostly-vertical drag is handed back to
 * the page and scrolls as normal. A drag that starts on a button, link or
 * field is left to that control, and the click a finished swipe would fire is
 * swallowed so it cannot also open or toggle something.
 */
export function SwipeRow({
  children,
  done,
  disabled = false,
  onToggleDone,
  onSave,
  onDelete,
}: {
  children: ReactNode;
  done: boolean;
  /** Off while the list is in edit mode, where the row is all fields. */
  disabled?: boolean;
  onToggleDone: () => void;
  onSave?: (() => void) | undefined;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [docked, setDocked] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    base: number;
    axis: "x" | "y" | null;
    id: number;
  } | null>(null);
  const swallowClick = useRef(false);

  // Tapping anywhere else closes an open tray.
  useEffect(() => {
    if (!docked) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setDocked(false);
        setOffset(0);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [docked]);

  useEffect(() => {
    if (disabled) {
      setDocked(false);
      setOffset(0);
    }
  }, [disabled]);

  const end = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.axis !== "x") return;
    // The click a finished swipe fires arrives straight after this; if the
    // browser sends none, the flag must not eat the next real tap.
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    const outcome = swipeOutcome(offset);
    if (outcome === "complete") {
      setDocked(false);
      setOffset(0);
      onToggleDone();
    } else if (outcome === "delete") {
      setDocked(false);
      setOffset(0);
      onDelete();
    } else if (outcome === "open") {
      setDocked(true);
      setOffset(-TRAY_PX);
    } else {
      setDocked(false);
      setOffset(0);
    }
  };

  const reveal = offset > 0 ? Math.min(1, offset / COMPLETE_PX) : 0;

  return (
    <div ref={root} className="relative overflow-hidden rounded-2xl">
      {/* Behind the card, left: the done underlay a right swipe uncovers. */}
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center gap-2 rounded-2xl px-4 text-[13.5px] font-bold ${
          offset > COMPLETE_PX ? "bg-nexttime text-white" : "bg-nexttime/20 text-nexttime"
        }`}
        style={{ opacity: offset > 0 ? 1 : 0 }}
      >
        <Check className="size-5" style={{ transform: `scale(${0.6 + reveal * 0.6})` }} />
        {offset > COMPLETE_PX
          ? done
            ? "Release: not done"
            : "Release: done"
          : done
            ? "Not done"
            : "Done"}
      </div>

      {/* Behind the card, right: Save and Delete, docked by a left swipe. */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: TRAY_PX, opacity: offset < 0 ? 1 : 0 }}
        aria-hidden={!docked}
      >
        {onSave && (
          <button
            type="button"
            tabIndex={docked ? 0 : -1}
            onClick={() => {
              setDocked(false);
              setOffset(0);
              onSave();
            }}
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-primary text-[11.5px] font-bold text-primary-foreground"
          >
            <Bookmark className="size-4" aria-hidden />
            Save
          </button>
        )}
        <button
          type="button"
          tabIndex={docked ? 0 : -1}
          onClick={() => {
            setDocked(false);
            setOffset(0);
            onDelete();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-r-2xl bg-destructive text-[11.5px] font-bold text-destructive-foreground"
        >
          <Trash2 className="size-4" aria-hidden />
          Delete
        </button>
      </div>

      <div
        className={`relative touch-pan-y ${dragging ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none"}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label"))
            return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            base: docked ? -TRAY_PX : 0,
            axis: null,
            id: e.pointerId,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.axis) {
            d.axis = lockAxis(dx, dy);
            if (d.axis === "y") {
              drag.current = null;
              return;
            }
            if (d.axis === "x") {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
            }
          }
          if (d.axis === "x") setOffset(Math.max(-220, Math.min(120, d.base + dx)));
        }}
        onPointerUp={end}
        // With a mouse, a drag over the card selects its text, and pressing
        // on that selection starts the browser's own drag, which cancels the
        // swipe. Nothing here is meant to be dragged out, so that never starts.
        onDragStart={(e) => e.preventDefault()}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setOffset(docked ? -TRAY_PX : 0);
        }}
        onClickCapture={(e) => {
          if (swallowClick.current) {
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          } else if (docked) {
            // Tapping the card body while open closes it, and does nothing else.
            e.preventDefault();
            e.stopPropagation();
            setDocked(false);
            setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
