/**
 * The audits run the real import with no database: every read or write of
 * the Supabase admin client fails, which Béa reads as "not remembered"
 * (resolved-places.server.ts). A pin check then measures the lookup itself,
 * the same every run, not whatever earlier imports left in a table.
 */
export const supabaseAdmin = new Proxy(
  {},
  {
    get() {
      throw new Error("no database in the import audit");
    },
  },
);
