import { useEffect, useState } from "react";
import {
  applyStopPictures,
  asStopPictures,
  STOP_PICTURES_KEY,
  type StopPictures,
} from "@/lib/stop-pictures";

function stored(): StopPictures {
  try {
    return asStopPictures(window.localStorage.getItem(STOP_PICTURES_KEY));
  } catch {
    return "illustrations";
  }
}

/** The stop-pictures setting, applied to the page and saved on change. */
export function useStopPictures(): [StopPictures, (next: StopPictures) => void] {
  const [value, setValue] = useState<StopPictures>("illustrations");
  useEffect(() => {
    const v = stored();
    setValue(v);
    applyStopPictures(v, document.documentElement);
  }, []);
  const set = (next: StopPictures) => {
    setValue(next);
    applyStopPictures(next, document.documentElement);
    try {
      window.localStorage.setItem(STOP_PICTURES_KEY, next);
    } catch {
      /* private mode: kept for this visit */
    }
  };
  return [value, set];
}
