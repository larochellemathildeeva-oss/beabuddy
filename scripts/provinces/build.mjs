/**
 * Builds public/geo/admin1/: the world's provinces, states and prefectures,
 * one file per country, for the World globe.
 *
 * Source: Natural Earth 1:10m admin-1 states and provinces, public domain
 * (https://www.naturalearthdata.com). Not a dependency of the app: run this
 * by hand when the boundaries need refreshing, and commit the output.
 *
 *   curl -sSL -o /tmp/admin1.geojson \
 *     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   npx -y mapshaper@0.6 /tmp/admin1.geojson \
 *     -filter-fields adm1_code,name,admin,type_en,adm0_a3 \
 *     -rename-fields country=admin,kind=type_en \
 *     -simplify interval=400 keep-shapes \
 *     -split adm0_a3 -o /tmp/admin1-split.json format=topojson id-field=adm1_code
 *   node scripts/provinces/build.mjs /tmp/admin1-split.json
 *
 * (needs topojson-client, topojson-server and d3-geo resolvable, e.g. from
 * a scratch folder with them installed.)
 *
 * Simplified to within 400 m, not by a percentage: a percentage keeps the
 * big shapes and drops the small ones, and the small ones are where the
 * cities are — at 3% New York State lost Manhattan and Brooklyn entirely.
 * One file per country so the app fetches only the countries you have been
 * to; the whole world at this detail is several megabytes.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/`);
const { feature } = require("topojson-client");
const { topology } = require("topojson-server");
const { geoArea, geoBounds } = require("d3-geo");

const source = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = new URL("../../public/geo/admin1/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const reverseRings = (geometry) => {
  if (geometry.type === "Polygon") geometry.coordinates.forEach((r) => r.reverse());
  if (geometry.type === "MultiPolygon")
    geometry.coordinates.forEach((p) => p.forEach((r) => r.reverse()));
};
const round = (n) => Math.round(n * 1000) / 1000;

const index = [];
let rewound = 0;
for (const [a3, object] of Object.entries(source.objects)) {
  if (!/^[A-Z0-9]{3}$/.test(a3)) continue;
  const collection = feature(source, object);
  for (const f of collection.features) {
    // d3 reads an outline wound the wrong way as the whole planet minus it.
    if (geoArea(f) > 2 * Math.PI) {
      reverseRings(f.geometry);
      rewound++;
    }
    f.id = f.properties.adm1_code ?? f.id;
    f.properties = {
      name: f.properties.name ?? "",
      country: f.properties.country ?? "",
      kind: f.properties.kind ?? "Province",
    };
  }
  const file = topology({ p: collection }, 1e5);
  writeFileSync(new URL(`${a3}.json`, out), JSON.stringify(file));
  const [[w, s], [e, n]] = geoBounds(collection);
  index.push({
    a3,
    country: collection.features[0]?.properties.country ?? a3,
    bbox: [round(w), round(s), round(e), round(n)],
  });
}
index.sort((a, b) => a.a3.localeCompare(b.a3));
writeFileSync(new URL("index.json", out), JSON.stringify(index));
console.log(`${index.length} countries, ${rewound} outlines rewound`);
