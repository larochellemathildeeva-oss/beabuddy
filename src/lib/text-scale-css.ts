/**
 * Makes every pixel font size and line height in Béa's CSS follow the
 * traveller's text size (accessibility.ts): `font-size: 13px` becomes
 * `font-size: calc(13px * var(--text-scale, 1))`. The app sets its sizes in
 * pixels, about two thousand of them, so a root font size alone would move
 * almost nothing. Run by lightningcss on every stylesheet (vite.config.ts);
 * pure, and tested.
 */
import type { CustomAtRules, Declaration, Visitor } from "lightningcss";

type Dimension = { unit: string; value: number };
type LengthDeclaration = {
  property: string;
  value?: { type?: string; value?: { type?: string; value?: Dimension } };
};

const SCALED = ["font-size", "line-height"] as const;

/** The px number of a plain `13px` value, else null (rem, %, var(), calc() …). */
export function plainPx(decl: LengthDeclaration): number | null {
  const v = decl.value;
  if (v?.type !== "length" || v.value?.type !== "dimension") return null;
  const dim = v.value.value;
  return dim && dim.unit === "px" && dim.value > 0 ? dim.value : null;
}

const space = { type: "token", value: { type: "white-space", value: " " } } as const;

/** `calc(<px>px * var(--text-scale, 1))` as a lightningcss declaration. */
export function scaledDeclaration(property: (typeof SCALED)[number], px: number) {
  return {
    property: "unparsed",
    value: {
      propertyId: { property },
      value: [
        {
          type: "function",
          value: {
            name: "calc",
            arguments: [
              { type: "length", value: { unit: "px", value: px } },
              space,
              { type: "token", value: { type: "delim", value: "*" } },
              space,
              {
                type: "var",
                value: {
                  name: { ident: "--text-scale" },
                  fallback: [{ type: "token", value: { type: "number", value: 1 } }],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function scale(property: (typeof SCALED)[number]) {
  return (decl: Declaration): Declaration | undefined => {
    const px = plainPx(decl as LengthDeclaration);
    return px === null ? undefined : (scaledDeclaration(property, px) as unknown as Declaration);
  };
}

/** The lightningcss visitor (`css.lightningcss.visitor`). */
export const textScaleVisitor: Visitor<CustomAtRules> = {
  Declaration: {
    "font-size": scale("font-size"),
    "line-height": scale("line-height"),
  },
};
