/**
 * Japanese block addresses, written the way the map can read them.
 *
 * A Japanese address is a district, its chōme (block group), a block and a
 * building: "2-3-23 Shinsaibashisuji" is Shinsaibashisuji 2-chōme, block 3,
 * building 23. The map knows the district and its chōme, not the numbers in
 * front of it: that line found an address in Fuchū, Tokyo, and nothing inside
 * Osaka. "Shinsaibashisuji 2-chome 3-23" finds the right block, a short walk
 * from the door. Pure, so it is tested.
 */

/** A district's name, in Latin letters: "Shinsaibashisuji", "Higashi-Shinsaibashi". */
const NAME = String.raw`(\p{L}[\p{L}'’. -]*\p{L})`;
const CHOME = String.raw`(\d{1,2})[\s-]*ch[oō]me\b`;
/** The block and, when given, the building: "3-23", "3". */
const REST = String.raw`(\d{1,4})(?:-(\d{1,4}))?`;

const PATTERNS: { re: RegExp; order: "numbersFirst" | "nameFirst"; needsJapan: boolean }[] = [
  // "2-chōme-3-23 Shinsaibashisuji", as Google writes it.
  {
    re: new RegExp(`^${CHOME}[\\s-]*${REST}\\s+${NAME}$`, "iu"),
    order: "numbersFirst",
    needsJapan: false,
  },
  // "Shinsaibashisuji 2-chome 3-23".
  {
    re: new RegExp(`^${NAME}\\s+${CHOME}[\\s-]*${REST}$`, "iu"),
    order: "nameFirst",
    needsJapan: false,
  },
  // "2-3-23 Shinsaibashisuji": three numbers in front are a Japanese address.
  {
    re: new RegExp(`^(\\d{1,2})-(\\d{1,4})-(\\d{1,4})\\s+${NAME}$`, "u"),
    order: "numbersFirst",
    needsJapan: false,
  },
  // "Shinsaibashisuji 2-3-23".
  {
    re: new RegExp(`^${NAME}\\s+(\\d{1,2})-(\\d{1,4})-(\\d{1,4})$`, "u"),
    order: "nameFirst",
    needsJapan: false,
  },
  // "2-3 Shinsaibashisuji": only when the trip is in Japan; elsewhere that is
  // a house number (Queens writes "12-34 45th Ave").
  {
    // The empty group stands for the building number this form has none of.
    re: new RegExp(`^(\\d{1,2})-(\\d{1,4})()\\s+${NAME}$`, "u"),
    order: "numbersFirst",
    needsJapan: true,
  },
];

/**
 * The address rewritten for the map, most exact first: the block, then the
 * chōme alone. Empty when it is not a Japanese block address, so callers try
 * it as typed. `inJapan` lets the shorter "2-3 Name" form count.
 */
export function japaneseAddressQueries(text: string, inJapan = false): string[] {
  const trimmed = text.trim();
  const comma = trimmed.indexOf(",");
  const head = (comma < 0 ? trimmed : trimmed.slice(0, comma)).trim();
  const tail = comma < 0 ? "" : trimmed.slice(comma);
  for (const { re, order, needsJapan } of PATTERNS) {
    if (needsJapan && !inJapan) continue;
    const m = re.exec(head);
    if (!m) continue;
    const [chome, block, building, name] =
      order === "numbersFirst" ? [m[1], m[2], m[3], m[4]] : [m[2], m[3], m[4], m[1]];
    if (!chome || !block || !name) continue;
    const district = name.trim();
    const numbers = building ? `${block}-${building}` : block;
    return [`${district} ${chome}-chome ${numbers}${tail}`, `${district} ${chome}-chome${tail}`];
  }
  return [];
}

/** Does this area, as the trip writes it, name Japan? */
export function namesJapan(area: string | null | undefined): boolean {
  return /\bjapan\b|日本/i.test(area ?? "");
}
