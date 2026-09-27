/**
 * Small tinted boxes on the To do and Packing sheet (icon tiles, group
 * marks): the quiet elevated beige in Calm and Dark, one of the five pastels
 * in Colorful. Written out in full so Tailwind sees every class.
 */
export const PREP_TINT = [
  "bg-elevated in-data-[theme=colorful]:bg-(--tile-1)",
  "bg-elevated in-data-[theme=colorful]:bg-(--tile-2)",
  "bg-elevated in-data-[theme=colorful]:bg-(--tile-3)",
  "bg-elevated in-data-[theme=colorful]:bg-(--tile-4)",
  "bg-elevated in-data-[theme=colorful]:bg-(--tile-5)",
] as const;

export const prepTint = (n: number) => PREP_TINT[((n % 5) + 5) % 5]!;
