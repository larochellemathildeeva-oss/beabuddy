import { Bed, Binoculars, Coffee, MoreHorizontal, Utensils } from "@/components/icons";
import type { BrowseKind } from "@/lib/recs-browse";

/** The icon for each of the five kinds, on the landing's round buttons and the map's pins. */
export const KIND_ICON: Record<BrowseKind, typeof Utensils> = {
  Restaurants: Utensils,
  Cafés: Coffee,
  "Things to do": Binoculars,
  Stays: Bed,
  More: MoreHorizontal,
};
