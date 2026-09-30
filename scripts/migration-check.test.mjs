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

test("this repo's migrations keep the rules", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") }));
  assert.deepEqual(ruleProblems(files), []);
});
