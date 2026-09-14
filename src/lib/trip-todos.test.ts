import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dueLabel,
  dueState,
  isMissingTodosTable,
  sortTodos,
  starterTodos,
  todosFromPaste,
} from "./trip-todos.ts";

const todo = (id: string, due_on: string | null, done = false) => ({
  id,
  title: id,
  due_on,
  done,
});

test("isMissingTodosTable spots an un-applied migration", () => {
  assert.equal(
    isMissingTodosTable({ message: 'relation "public.trip_todos" does not exist' }),
    true,
  );
  assert.equal(
    isMissingTodosTable({
      message: "Could not find the table 'public.trip_todos' in the schema cache",
    }),
    true,
  );
});

test("isMissingTodosTable ignores unrelated errors", () => {
  assert.equal(isMissingTodosTable({ message: "network request failed" }), false);
  assert.equal(isMissingTodosTable({ message: 'relation "trips" does not exist' }), false);
  assert.equal(isMissingTodosTable(null), false);
});

test("dueState ranks urgency against a reference day", () => {
  assert.equal(dueState("2026-04-01", "2026-04-05"), "overdue");
  assert.equal(dueState("2026-04-05", "2026-04-05"), "today");
  assert.equal(dueState("2026-04-09", "2026-04-05"), "soon");
  assert.equal(dueState("2026-06-01", "2026-04-05"), "later");
  assert.equal(dueState(null, "2026-04-05"), "none");
});

test("dueState treats the seventh day as soon and the eighth as later", () => {
  assert.equal(dueState("2026-04-12", "2026-04-05"), "soon");
  assert.equal(dueState("2026-04-13", "2026-04-05"), "later");
});

test("dueLabel reads like a person wrote it", () => {
  assert.equal(dueLabel("2026-04-05", "2026-04-05"), "Today");
  assert.equal(dueLabel("2026-04-06", "2026-04-05"), "Tomorrow");
  assert.equal(dueLabel("2026-04-08", "2026-04-05"), "In 3 days");
  assert.equal(dueLabel("2026-04-04", "2026-04-05"), "1 day late");
  assert.equal(dueLabel("2026-04-01", "2026-04-05"), "4 days late");
  assert.equal(dueLabel(null, "2026-04-05"), "");
});

test("sortTodos puts open items first, soonest due first", () => {
  const sorted = sortTodos([
    todo("undated", null),
    todo("late", "2026-04-01"),
    todo("soon", "2026-04-03"),
  ]);
  assert.deepEqual(
    sorted.map((t) => t.id),
    ["late", "soon", "undated"],
  );
});

test("sortTodos sinks finished items", () => {
  const sorted = sortTodos([
    todo("done-early", "2026-04-01", true),
    todo("open-late", "2026-09-01"),
  ]);
  assert.deepEqual(
    sorted.map((t) => t.id),
    ["open-late", "done-early"],
  );
});

test("sortTodos does not mutate its input", () => {
  const input = [todo("b", "2026-04-09"), todo("a", "2026-04-01")];
  sortTodos(input);
  assert.deepEqual(
    input.map((t) => t.id),
    ["b", "a"],
  );
});

test("starterTodos adapts to what the trip already has", () => {
  const abroad = starterTodos({ international: true, hasLodging: false, hasFlights: false });
  assert.ok(abroad.includes("Check passport expiry date"));
  assert.ok(abroad.includes("Book somewhere to stay"));

  const sorted = starterTodos({ international: false, hasLodging: true, hasFlights: true });
  assert.ok(!sorted.includes("Check passport expiry date"));
  assert.ok(!sorted.includes("Book somewhere to stay"));
  assert.ok(sorted.includes("Travel insurance"));
});

test("todosFromPaste splits a pasted list and trims bullets", () => {
  assert.deepEqual(todosFromPaste("- Passport\n* Visa\n1. Insurance\n\n  • Transfer  "), [
    "Passport",
    "Visa",
    "Insurance",
    "Transfer",
  ]);
});

test("todosFromPaste caps a runaway paste", () => {
  const many = Array.from({ length: 60 }, (_, i) => `Task ${i}`).join("\n");
  assert.equal(todosFromPaste(many).length, 25);
});

test("todosFromPaste drops empty and over-long lines", () => {
  assert.deepEqual(todosFromPaste("\n\n   \n"), []);
  assert.deepEqual(todosFromPaste(`ok\n${"x".repeat(201)}`), ["ok"]);
});
