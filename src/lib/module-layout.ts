/**
 * The modules a screen shows (Home, World) and their order: the "Customize"
 * sheets, as in the mockups ("Choose and reorder modules to make this your
 * own"). Stored as `{"order": [...], "on": [...]}` under the account's synced
 * setting; the older shape, one true/false per section, still reads.
 *
 * Pure, so reading, toggling and moving are tested.
 */

export type ModuleLayout<K extends string> = {
  /** Every module, in the order the traveller chose (new ones at the end). */
  order: K[];
  /** The ones switched on. */
  on: ReadonlySet<K>;
};

export function defaultModules<K extends string>(
  keys: readonly K[],
  defaults: readonly K[],
): ModuleLayout<K> {
  // The defaults first, in their own order, then the rest as the catalogue lists them.
  const order = [...defaults, ...keys.filter((k) => !defaults.includes(k))];
  return { order, on: new Set(defaults) };
}

/** A stored layout read against today's modules: unknown names dropped, new ones added off. */
export function readModules<K extends string>(
  raw: string | null,
  keys: readonly K[],
  defaults: readonly K[],
): ModuleLayout<K> {
  const fallback = defaultModules(keys, defaults);
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== "object") return fallback;
  const known = (v: unknown): v is K => typeof v === "string" && keys.includes(v as K);
  const obj = parsed as Record<string, unknown>;
  const storedOrder = obj["order"];
  const storedOn = obj["on"];
  if (Array.isArray(storedOrder) && Array.isArray(storedOn)) {
    const order = [...new Set(storedOrder.filter(known))];
    for (const k of fallback.order) if (!order.includes(k)) order.push(k);
    return { order, on: new Set(storedOn.filter(known)) };
  }
  // The first layouts were one switch per section, in a fixed order.
  const on = new Set<K>();
  for (const k of keys) {
    const v = obj[k];
    if (v === true || (v === undefined && defaults.includes(k))) on.add(k);
  }
  return { order: fallback.order, on };
}

export function writeModules<K extends string>(layout: ModuleLayout<K>): string {
  return JSON.stringify({ order: layout.order, on: layout.order.filter((k) => layout.on.has(k)) });
}

/** The modules to draw, in order. */
export function shownModules<K extends string>(layout: ModuleLayout<K>): K[] {
  return layout.order.filter((k) => layout.on.has(k));
}

export function toggleModule<K extends string>(layout: ModuleLayout<K>, key: K): ModuleLayout<K> {
  const on = new Set(layout.on);
  if (on.has(key)) on.delete(key);
  else on.add(key);
  return { order: layout.order, on };
}

/**
 * One step up (-1) or down (+1) among the modules that are on, so a tap
 * always moves it past something you can see; off ones keep their place.
 */
export function moveModule<K extends string>(
  layout: ModuleLayout<K>,
  key: K,
  step: -1 | 1,
  /** Modules that keep their place on the screen: the others move past them. */
  fixed: ReadonlySet<K> = new Set(),
): ModuleLayout<K> {
  const shown = shownModules(layout).filter((k) => !fixed.has(k));
  const at = shown.indexOf(key);
  const other = shown[at + step];
  if (at < 0 || other === undefined) return layout;
  const order = [...layout.order];
  const i = order.indexOf(key);
  const j = order.indexOf(other);
  order[i] = other;
  order[j] = key;
  return { order, on: layout.on };
}

export type ModuleRow<K extends string> = { full: K } | { pair: [K] | [K, K] };

/**
 * The shown modules as rows: a wide one alone, small ones two to a row, as
 * the mockups' module cards sit. A small one left alone takes half a row.
 */
export function moduleRows<K extends string>(
  shown: readonly K[],
  isSmall: (key: K) => boolean,
): ModuleRow<K>[] {
  const rows: ModuleRow<K>[] = [];
  let pending: K | null = null;
  for (const key of shown) {
    if (!isSmall(key)) {
      if (pending) rows.push({ pair: [pending] });
      pending = null;
      rows.push({ full: key });
    } else if (pending) {
      rows.push({ pair: [pending, key] });
      pending = null;
    } else pending = key;
  }
  if (pending) rows.push({ pair: [pending] });
  return rows;
}
