import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Béa's named type sizes (styles.css @theme): without them, tailwind-merge
// reads `text-small` as a colour and drops the text colour beside it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "small", "body", "lead", "heading", "title", "display", "hero"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
