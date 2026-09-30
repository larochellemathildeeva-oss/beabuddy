import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ruleProblems } from "./migration-check.mjs";

const table = (extra) => ({
  name: "20990101000000_x.sql",
  sql: `CREATE TABLE public.things (id uuid PRIMARY KEY);\n${extra}`,
});

test("a table with RLS, service_role and no anon passes", () => {
  const sql = `ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.things TO authenticated;
GRANT ALL ON public.things TO service_role;`;
  assert.deepEqual(ruleProblems([table(sql)]), []);
});

test("a table without grants, without RLS or granted to anon is refused", () => {
  const bare = ruleProblems([table("")]);
  assert.equal(bare.length, 2);
  assert.match(bare.join("\n"), /ROW LEVEL SECURITY/);
  assert.match(bare.join("\n"), /service_role/);

  const anon = ruleProblems([
    table(`ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.things TO service_role;
GRANT SELECT ON public.things TO anon;`),
  ]);
  assert.equal(anon.length, 1);
  assert.match(anon[0], /anon/);
});

test("a grant in a later file counts, and a later revoke from anon clears it", () => {
  const later = {
    name: "20990102000000_y.sql",
    sql: `GRANT ALL ON public.things TO service_role; REVOKE ALL ON public.things FROM anon;`,
  };
  const first = table(`ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.things TO anon;`);
  assert.deepEqual(ruleProblems([first, later]), []);
});

test("a later DISABLE ROW LEVEL SECURITY is caught, a later ENABLE clears it", () => {
  const ok = `ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.things TO service_role;`;
  const off = {
    name: "20990102000000_off.sql",
    sql: "ALTER TABLE public.things DISABLE ROW LEVEL SECURITY;",
  };
  const on = {
    name: "20990103000000_on.sql",
    sql: "ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;",
  };
  const disabled = ruleProblems([table(ok), off]);
  assert.equal(disabled.length, 1);
  assert.match(disabled[0], /ROW LEVEL SECURITY/);
  assert.deepEqual(ruleProblems([table(ok), off, on]), []);
});

test("a dropped and recreated table must enable RLS again", () => {
  const first = table(`ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.things TO service_role;`);
  const again = {
    name: "20990102000000_again.sql",
    sql: `DROP TABLE public.things;
CREATE TABLE public.things (id uuid);
GRANT ALL ON public.things TO service_role;`,
  };
  assert.match(ruleProblems([first, again]).join("\n"), /ROW LEVEL SECURITY/);
});

test("schema-wide and default grants to anon are caught", () => {
  const ok = `ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.things TO service_role;`;
  for (const sql of [
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;",
    "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;",
  ]) {
    const found = ruleProblems([table(ok), { name: "20990102000000_broad.sql", sql }]);
    assert.equal(found.length, 1, sql);
    assert.match(found[0], /anon/);
  }
  assert.deepEqual(
    ruleProblems([
      table(ok),
      {
        name: "20990102000000_sr.sql",
        sql: "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;",
      },
    ]),
    [],
  );
});

test("this repo's migrations keep the rules", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") }));
  assert.deepEqual(ruleProblems(files), []);
});
