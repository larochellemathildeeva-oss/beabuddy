import logo from "@/assets/bea-logo.png";

/**
 * Béa's logo with her name, for the screens a newcomer sees first: landing,
 * sign-up and the welcome. The dot is the brand's accent.
 */
export function BeaWordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={logo}
        alt=""
        aria-hidden
        className={big ? "size-14 object-contain" : "size-10 object-contain"}
        width={big ? 56 : 40}
        height={big ? 56 : 40}
      />
      <span className={`font-display leading-none ${big ? "text-[44px]" : "text-[32px]"}`}>
        Béa<span className="text-primary">.</span>
      </span>
    </span>
  );
}
