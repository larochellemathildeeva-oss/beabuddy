/**
 * Which migrations has the live database not had?
 *
 * Migrations here are applied by hand in the Supabase SQL editor, so the
 * database keeps no record of which ran. This replays every file in
 * supabase/migrations in order — what each creates, drops, grants and
 * revokes — and prints ONE query that checks the end state against the live
 * database. Paste it into the SQL editor: every row it returns is something
 * a migration leaves that the database does not match, and the file that
 * does it. No rows: every migration is in.
 *
 *   npm run db:check              prints the query
 *   npm run db:check -- --list    what each file is checked by, no SQL
 *
 * Checked: tables, columns, functions, triggers, policies, indexes, named
 * constraints (and a foreign key's ON DELETE rule), table privileges and
 * function EXECUTE — present where a migration made or granted them, absent
 * where one dropped or revoked them. Not checked: data changes and the body
 * of a replaced function, which leave nothing new to look for.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "../supabase/migrations");

/** Comments and function bodies out: a body can say CREATE inside a string. */
function stripped(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''");
}

const unquote = (s) => s.replace(/"/g, "");
/** `public.trips`, `"public"."trips"`, `trips` → { schema, name }. */
function qualified(raw) {
  const parts = unquote(raw).split(".");
  return parts.length === 2
    ? { schema: parts[0].toLowerCase(), name: parts[1] }
    : { schema: "public", name: parts[0] };
}
const roles = (list) =>
  list
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
const TABLE_PRIVS = ["select", "insert", "update", "delete"];
function privs(list) {
  const out = new Set();
  for (const p of list
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())) {
    if (p.startsWith("all")) TABLE_PRIVS.forEach((x) => out.add(x));
    else if (TABLE_PRIVS.includes(p)) out.add(p);
  }
  return [...out];
}

const ID = `(?:"[^"]+"|\\w+)(?:\\.(?:"[^"]+"|\\w+))?`;
const DELETE_RULE = {
  "set null": "n",
  cascade: "c",
  restrict: "r",
  "no action": "a",
  "set default": "d",
};

/**
 * Everything one file does, in the order it does it:
 * { op: "make" | "drop", kind, ...identity }.
 */
export function readMigration(sql) {
  const text = stripped(sql);
  const events = [];
  const on = (re, fn) => {
    for (const m of text.matchAll(re))
      for (const e of [fn(m)].flat()) if (e) events.push({ at: m.index, ...e });
  };
  const rx = (s) => new RegExp(s, "gi");

  on(rx(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${ID})`), (m) => {
    const t = qualified(m[1]);
    return { op: "make", kind: "table", schema: t.schema, name: t.name };
  });
  on(rx(`drop\\s+table\\s+(?:if\\s+exists\\s+)?(${ID})`), (m) => {
    const t = qualified(m[1]);
    return { op: "drop", kind: "table", schema: t.schema, name: t.name };
  });
  // ALTER TABLE x … ; — every column and constraint in the statement.
  on(rx(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?(${ID})([^;]*)`), (m) => {
    const t = qualified(m[1]);
    const base = { schema: t.schema, table: t.name };
    const out = [];
    // Clauses split on top-level commas, so each is read on its own.
    for (const clause of m[2].split(/,(?![^()]*\))/)) {
      let c;
      if ((c = clause.match(/add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)/i)))
        out.push({ op: "make", kind: "column", ...base, name: unquote(c[1]) });
      else if ((c = clause.match(/drop\s+column\s+(?:if\s+exists\s+)?("?\w+"?)/i)))
        out.push({ op: "drop", kind: "column", ...base, name: unquote(c[1]) });
      else if ((c = clause.match(/rename\s+column\s+("?\w+"?)\s+to\s+("?\w+"?)/i))) {
        out.push({ op: "drop", kind: "column", ...base, name: unquote(c[1]) });
        out.push({ op: "make", kind: "column", ...base, name: unquote(c[2]) });
      } else if ((c = clause.match(/add\s+constraint\s+("?\w+"?)([\s\S]*)/i))) {
        const rule = c[2].match(
          /on\s+delete\s+(set\s+null|cascade|restrict|no\s+action|set\s+default)/i,
        );
        out.push({
          op: "make",
          kind: "constraint",
          ...base,
          name: unquote(c[1]),
          ...(rule ? { onDelete: DELETE_RULE[rule[1].toLowerCase().replace(/\s+/g, " ")] } : {}),
        });
      } else if ((c = clause.match(/drop\s+constraint\s+(?:if\s+exists\s+)?("?\w+"?)/i)))
        out.push({ op: "drop", kind: "constraint", ...base, name: unquote(c[1]) });
    }
    return out;
  });
  on(rx(`create\\s+(?:or\\s+replace\\s+)?function\\s+(${ID})`), (m) => {
    const f = qualified(m[1]);
    return { op: "make", kind: "function", schema: f.schema, name: f.name };
  });
  on(rx(`drop\\s+function\\s+(?:if\\s+exists\\s+)?(${ID})`), (m) => {
    const f = qualified(m[1]);
    return { op: "drop", kind: "function", schema: f.schema, name: f.name };
  });
  on(
    rx(
      `create\\s+(?:or\\s+replace\\s+)?(?:constraint\\s+)?trigger\\s+("?\\w+"?)\\s[\\s\\S]*?\\son\\s+(${ID})`,
    ),
    (m) => {
      const t = qualified(m[2]);
      return { op: "make", kind: "trigger", schema: t.schema, table: t.name, name: unquote(m[1]) };
    },
  );
  on(rx(`drop\\s+trigger\\s+(?:if\\s+exists\\s+)?("?\\w+"?)\\s+on\\s+(${ID})`), (m) => {
    const t = qualified(m[2]);
    return { op: "drop", kind: "trigger", schema: t.schema, table: t.name, name: unquote(m[1]) };
  });
  on(rx(`create\\s+policy\\s+("[^"]+"|\\w+)\\s+on\\s+(${ID})`), (m) => {
    const t = qualified(m[2]);
    return { op: "make", kind: "policy", schema: t.schema, table: t.name, name: unquote(m[1]) };
  });
  on(rx(`drop\\s+policy\\s+(?:if\\s+exists\\s+)?("[^"]+"|\\w+)\\s+on\\s+(${ID})`), (m) => {
    const t = qualified(m[2]);
    return { op: "drop", kind: "policy", schema: t.schema, table: t.name, name: unquote(m[1]) };
  });
  on(
    rx(
      `create\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?("?\\w+"?)\\s+on\\s+(${ID})`,
    ),
    (m) => {
      const t = qualified(m[2]);
      return { op: "make", kind: "index", schema: t.schema, name: unquote(m[1]) };
    },
  );
  on(rx(`drop\\s+index\\s+(?:concurrently\\s+)?(?:if\\s+exists\\s+)?(${ID})`), (m) => {
    const t = qualified(m[1]);
    return { op: "drop", kind: "index", schema: t.schema, name: t.name };
  });
  // Table privileges, one per privilege and role.
  on(
    rx(
      `(grant|revoke)\\s+([\\w,\\s]+?)\\s+on\\s+(?:table\\s+)?(${ID})\\s+(?:to|from)\\s+([\\w,\\s]+?)\\s*;`,
    ),
    (m) => {
      if (/\b(execute|usage)\b/i.test(m[2]) || /^\s*function\b/i.test(m[3])) return [];
      const t = qualified(m[3]);
      const op = m[1].toLowerCase() === "grant" ? "make" : "drop";
      return privs(m[2]).flatMap((priv) =>
        roles(m[4]).map((role) => ({
          op,
          kind: "grant",
          schema: t.schema,
          table: t.name,
          name: `${priv} to ${role}`,
          priv,
          role,
        })),
      );
    },
  );
  // EXECUTE on a function, one per role.
  on(
    rx(
      `(grant|revoke)\\s+execute\\s+on\\s+function\\s+(${ID})\\s*\\([^)]*\\)\\s+(?:to|from)\\s+([\\w,\\s]+?)\\s*;`,
    ),
    (m) => {
      const f = qualified(m[2]);
      const op = m[1].toLowerCase() === "grant" ? "make" : "drop";
      return roles(m[3]).map((role) => ({
        op,
        kind: "execute",
        schema: f.schema,
        name: f.name,
        role,
      }));
    },
  );
  return events.sort((a, b) => a.at - b.at);
}

const keyOf = (o) =>
  [
    o.kind,
    o.schema,
    o.table ?? "",
    o.kind === "grant" ? o.name : (o.name ?? "").toLowerCase(),
    o.role ?? "",
  ].join("|");

/** Kinds whose absence is checked when the last word on them is a drop or revoke. */
const ABSENCE_CHECKED = new Set(["policy", "grant", "execute"]);

/**
 * The end state after every file, in order: for each object, the last thing
 * any file did to it, and which file that was. A table dropped takes its
 * columns, triggers, policies, constraints and grants with it.
 */
export function endState(files) {
  const last = new Map();
  for (const f of files) {
    for (const e of readMigration(f.sql)) {
      if (e.op === "drop" && e.kind === "table") {
        for (const [k, v] of last) {
          if (
            v.schema === e.schema &&
            (v.table === e.name || (v.kind === "table" && v.name === e.name))
          )
            last.delete(k);
        }
        continue;
      }
      last.set(keyOf(e), { ...e, file: f.name });
    }
  }
  const publicRevoked = (e) => last.get(keyOf({ ...e, role: "public" }))?.op === "drop";
  return [...last.values()].filter(
    (e) =>
      e.op === "make" ||
      (ABSENCE_CHECKED.has(e.kind) &&
        // Every role can run a function PUBLIC can, so revoking one role
        // while PUBLIC keeps it changes nothing to look for.
        (e.kind !== "execute" || e.role === "public" || publicRevoked(e))),
  );
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** SQL that is true when the database matches this end state. */
function checkOf(o) {
  const rel = lit(`${o.schema}.${o.table ?? o.name}`);
  const fn = `select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ${lit(o.schema)} and p.proname = ${lit(o.name)}`;
  const present = (() => {
    switch (o.kind) {
      case "table":
      case "index":
        return `to_regclass(${lit(`${o.schema}.${o.name}`)}) is not null`;
      case "column":
        return `exists (select 1 from information_schema.columns where table_schema = ${lit(o.schema)} and table_name = ${lit(o.table)} and column_name = ${lit(o.name)})`;
      case "function":
        return `exists (${fn})`;
      case "trigger":
        return `exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname = ${lit(o.schema)} and c.relname = ${lit(o.table)} and t.tgname = ${lit(o.name)})`;
      case "policy":
        return `exists (select 1 from pg_policies where schemaname = ${lit(o.schema)} and tablename = ${lit(o.table)} and policyname = ${lit(o.name)})`;
      case "constraint":
        return `exists (select 1 from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${lit(o.schema)} and c.relname = ${lit(o.table)} and k.conname = ${lit(o.name)}${o.onDelete ? ` and k.confdeltype = ${lit(o.onDelete)}` : ""})`;
      case "grant":
        return `(to_regclass(${rel}) is not null and exists (select 1 from pg_roles where rolname = ${lit(o.role)}) and has_table_privilege(${lit(o.role)}, ${rel}, ${lit(o.priv)}))`;
      case "execute":
        // Any overload of the name the role may run.
        return `exists (select 1 from (${fn}) f where ${o.role === "public" ? "" : `exists (select 1 from pg_roles where rolname = ${lit(o.role)}) and `}has_function_privilege(${lit(o.role)}, f.oid, 'execute'))`;
      default:
        return "true";
    }
  })();
  if (o.op === "make") return present;
  // Revoked or dropped: absent, and a missing table or function is absent too.
  if (o.kind === "grant") return `not coalesce(${present}, false)`;
  return `not ${present}`;
}

function describe(o) {
  const gone = o.op === "drop";
  if (o.kind === "column") return `column ${o.schema}.${o.table}.${o.name}`;
  if (o.kind === "constraint")
    return `constraint ${o.name} on ${o.schema}.${o.table}${o.onDelete ? ` (on delete ${Object.keys(DELETE_RULE).find((k) => DELETE_RULE[k] === o.onDelete)})` : ""}`;
  if (o.kind === "trigger") return `trigger "${o.name}" on ${o.schema}.${o.table}`;
  if (o.kind === "policy")
    return `${gone ? "policy still there that should be dropped" : "policy"} "${o.name}" on ${o.schema}.${o.table}`;
  if (o.kind === "grant")
    return gone
      ? `${o.priv} on ${o.schema}.${o.table} still granted to ${o.role}`
      : `grant ${o.name} on ${o.schema}.${o.table}`;
  if (o.kind === "execute")
    return gone
      ? `${o.role} can still run ${o.schema}.${o.name}()`
      : `execute on ${o.schema}.${o.name}() for ${o.role}`;
  return `${o.kind} ${o.schema}.${o.name}`;
}

export function checkQuery(state) {
  const rows = [...state]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((o) => `  (${lit(o.file)}, ${lit(describe(o))}, ${checkOf(o)})`);
  return [
    "-- Rows returned = migrations (or parts of them) this database does not match. Run each file listed, oldest first.",
    "-- No rows = every migration is in.",
    "with checks(migration, not_matching, ok) as (values",
    rows.join(",\n"),
    ")",
    "select migration, not_matching from checks where not ok order by migration, not_matching;",
  ].join("\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
  const state = endState(files);
  if (process.argv.includes("--list")) {
    for (const f of files) {
      const mine = state.filter((o) => o.file === f.name);
      console.log(
        `${f.name}\n${mine.length ? mine.map((o) => `  - ${describe(o)}`).join("\n") : "  (nothing left to check: later files replaced all of it, or it only changes data)"}`,
      );
    }
  } else {
    console.log(checkQuery(state));
  }
}
