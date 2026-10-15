import { usePlaceNow } from "@/hooks/usePlaceNow";
import type { ItineraryRow } from "@/hooks/useTrips";
import { describeWeather, formatTemp, usesFahrenheit } from "@/lib/weather";

/** Today's weather at the day's first placed stop; nothing for other days. */
export function DayWeather({ items }: { items: readonly ItineraryRow[] }) {
  const at = items.find((i) => typeof i.lat === "number" && typeof i.lon === "number");
  const now = usePlaceNow(at?.lat, at?.lon);
  if (now.status !== "ready") return null;
  const w = now.weather;
  const fahrenheit = usesFahrenheit(
    typeof navigator === "undefined" ? undefined : navigator.language,
  );
  return (
    <span className="shrink-0 text-right text-[13px] leading-[1.35]">
      <span className="block">{formatTemp(w.temp, fahrenheit)}</span>
      <span className="block text-muted-foreground">{describeWeather(w.code).label}</span>
    </span>
  );
}
