import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type HomeSectionKey =
  | "trip"
  | "shortcuts"
  
  | "waiting"
  | "recent"
  | "future";

export type HomeLayout = Record<HomeSectionKey, boolean>;

export const HOME_SECTIONS: { key: HomeSectionKey; label: string; hint: string }[] = [
  { key: "trip", label: "Current trip", hint: "The trip card at the top of Home." },
  { key: "shortcuts", label: "Story & memories", hint: "Travel story and City memories shortcuts." },
  { key: "waiting", label: "Waiting for you", hint: "Your most recent saved recommendation." },
  { key: "recent", label: "Recent memories", hint: "Cities from your latest photos." },
  { key: "future", label: "Future me note", hint: "The newest note you left for yourself." },
];

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  trip: true,
  shortcuts: true,
  waiting: true,
  recent: true,
  future: true,
};

const keyFor = (userId: string | undefined) => `bea-home-layout-${userId ?? "anon"}`;

function read(userId: string | undefined): HomeLayout {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_HOME_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<HomeLayout>;
    return { ...DEFAULT_HOME_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

export function useHomeLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);

  useEffect(() => {
    setLayout(read(user?.id));
  }, [user?.id]);

  const toggle = useCallback(
    (key: HomeSectionKey) => {
      setLayout((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          window.localStorage.setItem(keyFor(user?.id), JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [user?.id],
  );

  const reset = useCallback(() => {
    setLayout(DEFAULT_HOME_LAYOUT);
    try {
      window.localStorage.removeItem(keyFor(user?.id));
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  return { layout, toggle, reset };
}
