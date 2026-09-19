/**
 * Béa in profile, mid-trot.
 *
 * A French bulldog reads from three things and very little else: the tall
 * upright bat ears, the flat pushed-in face, and a body that is compact and
 * deep-chested on legs far too short for it. The first draft of this got all
 * three wrong and came out a dachshund — a long low sausage with a bump for an
 * ear — so the proportions here are deliberate: the body is barely twice as
 * long as it is deep, the head is nearly as tall as the body, and the ear is a
 * third of the whole animal and wider at its base than its tip.
 *
 * Drawn rather than photographed: it costs no asset, takes the theme's colours
 * in both schemes, and the parts move independently, which a picture could
 * not. Diagonal pairs alternate — a trot, which is the gait a short-legged dog
 * actually uses and the one that reads as running at this size.
 */
export function BeaDog({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 44"
      className={`bea-dog aspect-[64/44] h-auto ${className}`}
      role="img"
      aria-label="Béa, a French bulldog, running"
    >
      {/* Far side first, a shade darker, so four legs read as depth rather
          than a tangle. */}
      <g className="bea-coat-far">
        <rect className="bea-part-leg-aft-far" x="21" y="26" width="5.5" height="12" rx="2.75" />
        <rect className="bea-part-leg-fore-far" x="38" y="26" width="5.5" height="12" rx="2.75" />
        {/* The second ear, behind the head. */}
        <path d="M43.5 14.5 46 5.2q1.5-2.6 3 0l2.5 9.3z" />
      </g>

      <g className="bea-part-body">
        {/* A stub, not a tail. */}
        <rect className="bea-part-tail bea-coat" x="13" y="18" width="7" height="6" rx="3" />

        {/* Compact and deep: barely twice as long as it is deep. */}
        <rect x="16" y="14" width="30" height="17" rx="8" className="bea-coat" />

        {/* Head nearly as tall as the body, and square with it. */}
        <rect x="39" y="8" width="21" height="20" rx="7" className="bea-coat" />

        {/* The bat ear — wide at the base, upright, rounded at the tip. */}
        <path className="bea-part-ear bea-coat" d="M49 15 52 3.4q1.8-3 3.6 0L58.6 15z" />

        {/* Flat face: the muzzle is a shallow shelf, not a snout. */}
        <rect x="55" y="17" width="8" height="8" rx="3.6" className="bea-muzzle" />
        <circle cx="61.4" cy="19.6" r="1.9" className="bea-nose" />
        <circle cx="48.5" cy="15.5" r="1.7" className="bea-nose" />

        {/* The bandana, tucked under the jaw where a collar sits — the first
            attempt floated it out on her flank. */}
        <path className="bea-scarf" d="M45.5 26q4 2.2 8 0l-4 6.4z" />
      </g>

      {/* Near side last, in front of the body. */}
      <g className="bea-coat-near">
        <rect className="bea-part-leg-aft-near" x="24" y="26" width="6" height="12" rx="3" />
        <rect className="bea-part-leg-fore-near" x="41" y="26" width="6" height="12" rx="3" />
      </g>
    </svg>
  );
}
