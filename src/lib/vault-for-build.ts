import type { Pin } from "../data/atlas.ts";
import { rankOpportunities, type ScorePrefs } from "./score-opportunity.ts";

export type VaultReco = {
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  notes: string | null;
  recommended_by: string | null;
  lat: number | null;
  lon: number | null;
  pin_type: string | null;
  created_at: string;
};

export type VaultNote = {
  city: string;
  note: string;
};

function recoAsPin(row: VaultReco, index: number): Pin {
  return {
    id: `vault-${index}`,
    type: (row.pin_type as Pin["type"]) || "reco",
    name: row.name,
    city: row.city ?? "",
    country: row.country ?? "",
    lat: row.lat ?? Number.NaN,
    lon: row.lon ?? Number.NaN,
    ...(row.category ? { category: row.category } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.recommended_by ? { recommendedBy: row.recommended_by } : {}),
    dateAdded: row.created_at.slice(0, 10),
  };
}

export function vaultPrompt(
  destination: string,
  recos: VaultReco[],
  notes: VaultNote[],
  prefs: ScorePrefs,
  limit = 8,
): string {
  const ranked = rankOpportunities(
    recos.map(recoAsPin),
    prefs,
  ).slice(0, limit);

  const lines: string[] = [];
  if (ranked.length) {
    lines.push(
      `Saved vault places for ${destination}. Prefer these when they fit. Mark those items source "vault" and keep their names. New suggestions are source "new".`,
    );
    for (const { pin, score } of ranked) {
      lines.push(
        `- ${pin.name}${pin.city ? `, ${pin.city}` : ""}${pin.category ? ` · ${pin.category}` : ""}${
          pin.recommendedBy ? ` · saved by ${pin.recommendedBy}` : ""
        }${pin.notes ? ` · "${pin.notes}"` : ""} (${score.reasons[0]})`,
      );
    }
  }
  if (notes.length) {
    lines.push(`Notes they left themselves for later in ${destination}:`);
    for (const note of notes.slice(0, 8)) {
      lines.push(`- ${note.note}`);
    }
  }
  return lines.join("\n");
}

export function tagVaultItems<
  T extends { title: string; source?: "vault" | "new" | null | undefined },
>(
  items: T[],
  recos: VaultReco[],
): T[] {
  const names = recos.map((row) => row.name.trim().toLowerCase()).filter((name) => name.length > 2);
  if (!names.length) return items;
  return items.map((item) => {
    const title = item.title.trim().toLowerCase();
    const hit = names.some((name) => title.includes(name) || name.includes(title));
    return { ...item, source: hit ? "vault" : item.source === "vault" ? "new" : item.source ?? "new" };
  });
}
