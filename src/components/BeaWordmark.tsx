import logo from "@/assets/bea-logo.png";

/**
 * Béa's name as a wordmark — "Béa." with the accent dot — for the screens a
 * newcomer sees first: landing, sign-up and the welcome. `mark` puts her
 * logo beside it. `ink` keeps it dark whatever the theme, for screens painted
 * over light artwork.
 */
export function BeaWordmark({
  size = "md",
  mark = false,
  ink = false,
}: {
  size?: "md" | "lg";
  mark?: boolean;
  ink?: boolean;
}) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Béa">
      {mark && (
        <img
          src={logo}
          alt=""
          aria-hidden
          className={big ? "size-12 object-contain" : "size-9 object-contain"}
          width={big ? 48 : 36}
          height={big ? 48 : 36}
        />
      )}
      <span
        aria-hidden
        className={`font-display font-semibold leading-none tracking-[-0.02em] ${
          big ? "text-[44px]" : "text-[36px]"
        } ${ink ? "text-[#1d1a17]" : ""}`}
      >
        Béa<span className={ink ? "text-[#e2654a]" : "text-primary"}>.</span>
      </span>
    </span>
  );
}
