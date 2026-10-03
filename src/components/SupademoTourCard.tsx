import { useState } from "react";
import { PlayCircle } from "@/components/icons";

type SupademoApi = {
  open: (id: string, options?: { type?: "showcase" }) => void;
};

declare global {
  interface Window {
    Supademo?: SupademoApi;
  }
}

const SDK_SRC = "https://script.supademo.com/supademo.js";
const SHOWCASE_ID = import.meta.env["VITE_SUPADEMO_SHOWCASE_ID"]?.trim();
const DEMO_ID = import.meta.env["VITE_SUPADEMO_DEMO_ID"]?.trim();

let sdkPromise: Promise<SupademoApi> | null = null;

function target(): { id: string; type: "showcase" | "demo" } | null {
  if (SHOWCASE_ID) return { id: SHOWCASE_ID, type: "showcase" };
  if (DEMO_ID) return { id: DEMO_ID, type: "demo" };
  return null;
}

function loadSupademo(): Promise<SupademoApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Supademo is client-only"));
  if (window.Supademo) return Promise.resolve(window.Supademo);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<SupademoApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement("script");

    const finish = () => {
      if (window.Supademo) resolve(window.Supademo);
      else reject(new Error("Supademo SDK loaded without an API"));
    };
    const fail = () => reject(new Error("Supademo SDK failed to load"));

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.src = SDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

export function SupademoTourCard() {
  const demo = target();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!demo) return null;

  const open = async () => {
    setOpening(true);
    setFailed(false);
    try {
      const supademo = await loadSupademo();
      supademo.open(demo.id, demo.type === "showcase" ? { type: "showcase" } : undefined);
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="card-soft space-y-3 p-4">
      <div>
        <p className="label-caps text-primary">Interactive overview</p>
        <h2 className="mt-1 font-display text-[21px] leading-snug">See Béa end to end</h2>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">
          Click through a guided product demo. The “Show me” walks below still use your real Béa
          screens when you want hands-on help.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void open()}
        disabled={opening}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14.5px] font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70"
      >
        <PlayCircle className="size-4" aria-hidden />
        {opening ? "Opening…" : "Open interactive demo"}
      </button>
      {failed && (
        <p role="status" className="text-[13.5px] text-muted-foreground">
          The demo could not open. Your in-app walkthroughs below still work normally.
        </p>
      )}
    </section>
  );
}
