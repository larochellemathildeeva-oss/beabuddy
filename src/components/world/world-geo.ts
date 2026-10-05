import { feature, mesh } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import coarseTopo from "world-atlas/countries-110m.json";

/**
 * The globe's countries and their shared borders. The coarse 110m outline is
 * bundled so the globe draws at once; `loadDetailedWorld` fetches the 50m
 * outline (about 750 KB) as its own chunk and the globe swaps it in.
 */
export type WorldGeo = {
  world: FeatureCollection<Geometry, { name?: string }>;
  borders: MultiLineString;
};

type AnyTopology = Parameters<typeof feature>[0];

function build(source: unknown): WorldGeo {
  const topo = source as AnyTopology;
  const countries = topo.objects["countries"]!;
  return {
    world: feature(topo, countries) as unknown as FeatureCollection<Geometry, { name?: string }>,
    borders: mesh(topo, countries as never, (a: unknown, b: unknown) => a !== b),
  };
}

export type WorldFeature = Feature<Geometry, { name?: string }>;

export const coarseWorld: WorldGeo = build(coarseTopo);

let detailed: Promise<WorldGeo> | undefined;

export function loadDetailedWorld(): Promise<WorldGeo> {
  detailed ??= import("world-atlas/countries-50m.json").then((m) => build(m.default));
  return detailed;
}
