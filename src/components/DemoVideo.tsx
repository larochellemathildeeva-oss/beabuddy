import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DemoVideoSource } from "@/lib/demo-video";

/**
 * The demo video, full-bleed over the app.
 *
 * Deliberately not autoplaying an embed: a video that starts talking the
 * moment a panel opens is the thing people close fastest. A file gets
 * `controls` and starts on the poster frame; an embed is left to its own
 * player.
 */
export function DemoVideo({ source, onClose }: { source: DemoVideoSource; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="How Béa works"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-white/90">How Béa works</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the video"
            className="grid size-9 place-items-center rounded-full border border-white/30 text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
          {source.kind === "file" ? (
            <video
              src={source.src}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full"
            />
          ) : (
            <iframe
              src={source.src}
              title="How Béa works"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full border-0"
            />
          )}
        </div>

        <p className="mt-2 text-center text-[12.5px] text-white/70">
          Press Escape, or tap outside, to close.
        </p>
      </div>
    </div>,
    document.body,
  );
}
