/**
 * Preview-only stand-in for the generated Supabase client: an in-memory,
 * read-mostly query builder over sample-db.ts so the app's real hooks run.
 */
import { TABLES, USER } from "../../../sample-db";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;
const ok = <T>(data: T) => ({
  data,
  error: null,
  count: Array.isArray(data) ? data.length : null,
  status: 200,
});

function builder(table: string) {
  const filters: Filter[] = [];
  let write = false;
  let one: "single" | "maybe" | null = null;
  let limit = Infinity;
  const order: { col: string; asc: boolean }[] = [];
  const run = () => {
    if (write)
      return ok(
        one ? { id: `new-${Math.random().toString(36).slice(2, 8)}` } : [],
      );
    let rows = (TABLES[table] ?? []).filter((r) => filters.every((f) => f(r)));
    for (const o of [...order].reverse())
      rows = [...rows].sort((a, b) => {
        const x = a[o.col] as string | number | null;
        const y = b[o.col] as string | number | null;
        if (x === y) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
      });
    rows = rows.slice(0, limit);
    if (one) return ok(rows[0] ?? null);
    return ok(rows);
  };
  const api: Record<string, unknown> = {
    select: () => proxy,
    insert: () => ((write = true), proxy),
    update: () => ((write = true), proxy),
    upsert: () => ((write = true), proxy),
    delete: () => ((write = true), proxy),
    eq: (c: string, v: unknown) => (
      filters.push((r) => !(c in r) || r[c] === v),
      proxy
    ),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), proxy),
    in: (c: string, v: unknown[]) => (
      filters.push((r) => !(c in r) || v.includes(r[c])),
      proxy
    ),
    is: (c: string, v: unknown) => (
      filters.push((r) => !(c in r) || r[c] === v),
      proxy
    ),
    order: (col: string, o?: { ascending?: boolean }) => (
      order.push({ col, asc: o?.ascending !== false }),
      proxy
    ),
    limit: (n: number) => ((limit = n), proxy),
    range: (a: number, b: number) => ((limit = b - a + 1), proxy),
    single: () => ((one = "single"), proxy),
    maybeSingle: () => ((one = "maybe"), proxy),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(res, rej),
  };
  const proxy: unknown = new Proxy(api, {
    get: (t, k: string) => (k in t ? t[k] : () => proxy),
  });
  return proxy;
}

const session = {
  user: USER,
  access_token: "preview",
  refresh_token: "preview",
  expires_at: 4e9,
};
const channel = (): unknown =>
  new Proxy({} as Record<string, unknown>, {
    get: (_t, k) => (k === "then" ? undefined : () => channel()),
  });
const asyncAny = (): unknown =>
  new Proxy({} as Record<string, unknown>, {
    get: (_t, k) =>
      k === "then" ? undefined : async () => ({ data: {}, error: null }),
  });

export const supabase = {
  from: (t: string) => builder(t),
  rpc: async () => ({ data: null, error: null }),
  channel,
  removeChannel: async () => "ok",
  removeAllChannels: async () => [],
  functions: {
    invoke: async () => ({ data: null, error: { message: "preview" } }),
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
      createSignedUrls: async () => ({ data: [], error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      upload: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
  auth: new Proxy(
    {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: USER }, error: null }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        setTimeout(() => cb("INITIAL_SESSION", session), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    } as Record<string, unknown>,
    {
      get: (t, k: string) => t[k] ?? (asyncAny() as Record<string, unknown>)[k],
    },
  ),
} as never;
