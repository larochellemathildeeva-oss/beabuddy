/**
 * Béa in profile, mid-trot — the app icon, side on and moving.
 *
 * The icon is a sticker: a cream French bulldog under a bold black outline,
 * pink inside the bat ears — which are as
 * wide at the base as they are tall, the tell that separates them from a
 * rabbit's, tongue out, yellow bandana. This is that dog
 * turned sideways and given legs, so the loading state is recognisably her
 * rather than a generic dog shape.
 *
 * Draw order is doing real work here. The ears come before the head so the
 * head covers their bases — a bat ear rises from behind the skull, and drawing
 * it last left an outline slicing across her forehead. The far side is drawn
 * first and a shade darker so four legs read as depth rather than a tangle.
 *
 * Drawn rather than photographed: no asset, colours that follow the theme, and
 * parts that move independently, which a picture of her could not do. Diagonal
 * pairs alternate — a trot, the gait a short-legged dog actually uses, and the
 * one that reads as running at this size.
 */
export function BeaDog({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 66 44"
      className={`bea-dog aspect-[66/44] h-auto ${className}`}
      role="img"
      aria-label="Béa, a French bulldog, running"
    >
      <g className="bea-coat-far">
        <rect className="bea-part-leg-aft-far" x="21" y="27" width="5.5" height="12" rx="2.75" />
        <rect className="bea-part-leg-fore-far" x="38" y="27" width="5.5" height="12" rx="2.75" />
      </g>

      <g className="bea-part-body">
        {/* Both ears first, so the head hides where they join it. */}
        <path className="bea-coat-far" d="M41.3 17.5C41.3 6.2 43.2 3 45.8 3S50.3 6.2 50.3 17.5z" />
        <g className="bea-part-ear">
          <path className="bea-coat" d="M47 17.5C47 3.4 49.4 0 52.4 0S57.8 3.4 57.8 17.5z" />
          <path className="bea-ear-inner" d="M49.8 16C49.8 5.6 51.2 3.2 52.4 3.2S55 5.6 55 16z" />
        </g>

        {/* A stub, not a tail. */}
        <rect className="bea-part-tail bea-coat" x="13" y="19" width="7" height="6" rx="3" />

        {/* Compact and deep-chested: barely twice as long as it is deep. */}
        <rect x="16" y="15" width="30" height="17" rx="8" className="bea-coat" />

        {/* Head nearly as tall as the body, and square with it. */}
        <rect x="39" y="11" width="21" height="18" rx="7" className="bea-coat" />

        {/* Flat pushed-in face: a shelf on the front, not a snout. */}
        <rect x="53.5" y="17" width="10" height="9.5" rx="4.5" className="bea-coat" />
        <circle cx="61" cy="20.6" r="1.9" className="bea-nose" />

        {/* Tongue out, as she is drawn on the icon. */}
        <path
          className="bea-tongue"
          d="M57.8 26.4q2.8-1 4.9.4c0 2.7-1 4.4-2.5 4.4s-2.4-1.8-2.4-4.8z"
        />

        {/* One eye in profile, with the sticker's highlight. */}
        <circle cx="50.2" cy="19" r="2.4" className="bea-eye" />
        <circle cx="51.1" cy="18.1" r="0.8" className="bea-eye-light" />

        {/* The yellow bandana, knotted at the throat and clear of the legs. */}
        <path className="bea-scarf" d="M47.5 28q4.3 2.5 8.6 0L51.8 35z" />
        <circle cx="50.2" cy="30.6" r="0.9" className="bea-scarf-leaf" />
        <circle cx="53" cy="29.8" r="0.75" className="bea-scarf-leaf" />
      </g>

      <g className="bea-coat-near">
        <rect className="bea-part-leg-aft-near" x="24" y="27" width="6" height="12" rx="3" />
        <rect className="bea-part-leg-fore-near" x="41" y="27" width="6" height="12" rx="3" />
      </g>
    </svg>
  );
}
