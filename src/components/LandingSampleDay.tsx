/**
 * One sample day, drawn the way a trip day reads in the app, so a visitor
 * sees what Béa makes before reading about it. Static and invented — the
 * caption says so — with no request or account behind it.
 */

type SampleStop = {
  time: string;
  title: string;
  /** Where the place came from: the point of Béa is that it was yours. */
  from: string;
  /** Getting to the next stop. */
  next?: string;
};

const SAMPLE_STOPS: readonly SampleStop[] = [
  {
    time: "09:30",
    title: "Pastéis de Belém",
    from: "Marta's tip",
    next: "6 min walk",
  },
  {
    time: "10:15",
    title: "Jerónimos Monastery",
    from: "Booked · ticket in Documents",
    next: "Tram 15E · 18 min",
  },
  { time: "12:30", title: "Time Out Market", from: "Saved from a link", next: "12 min walk" },
  { time: "14:00", title: "Alfama wander", from: "Your wishlist" },
];

/** Pin positions on the little map, in its 100 × 60 box (the view crops to the pins). */
const PIN_XY: readonly (readonly [number, number])[] = [
  [14, 44],
  [24, 36],
  [62, 30],
  [84, 18],
];

export function LandingSampleDay() {
  const path = PIN_XY.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");

  return (
    <figure className="surface overflow-hidden border border-border/50">
      <div className="border-b border-border/50 bg-card/60 p-3">
        <svg
          viewBox="0 12 100 42"
          className="h-auto w-full"
          role="img"
          aria-label="Map of the day's four stops along the river"
        >
          <path
            d="M0 52 C 20 48, 40 50, 60 42 S 90 34, 100 30 L100 60 L0 60 Z"
            className="fill-primary/10"
          />
          <path
            d={path}
            fill="none"
            className="stroke-primary"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
          />
          {PIN_XY.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="3.4" className="fill-primary" />
              <text
                x={x}
                y={y + 1.2}
                textAnchor="middle"
                className="fill-primary-foreground"
                style={{ fontSize: "3.4px", fontWeight: 700 }}
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="p-4">
        <p className="label-caps">Day 2 · Lisbon</p>
        <p className="mt-1 font-display text-[20px] leading-snug">Belém, then the old town</p>
        <ol className="mt-3">
          {SAMPLE_STOPS.map((stop, i) => (
            <li key={stop.title}>
              <div className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold leading-snug">
                    <span className="tabular-nums text-muted-foreground">{stop.time}</span>{" "}
                    {stop.title}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">{stop.from}</p>
                </div>
              </div>
              {stop.next && (
                <p className="my-1.5 ms-3 border-s border-dashed border-border py-1 ps-6 text-[12.5px] text-muted-foreground">
                  {stop.next}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="border-t border-border/50 px-4 py-2.5 text-[12.5px] text-muted-foreground">
        A sample day. Yours is built from the places you saved.
      </figcaption>
    </figure>
  );
}
