import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissingTodosTable } from "@/lib/trip-todos";
import { runOptimistic } from "@/lib/optimistic";
import { tap } from "@/lib/haptics";
import { toast } from "sonner";

export type TodoRow = {
  id: string;
  trip_id: string;
  title: string;
  notes: string | null;
  due_on: string | null;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  assigned_to: string | null;
  position: number;
};

export type NewTodo = {
  title: string;
  notes?: string;
  due_on?: string;
  assigned_to?: string;
};

const COLS = "id, trip_id, title, notes, due_on, done, done_at, done_by, assigned_to, position";

export function useTripTodos(tripId: string | null, uid: string | null) {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** True when the migration has not been applied to this database yet. */
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setTodos([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("trip_todos")
      .select(COLS)
      .eq("trip_id", tripId)
      .order("done", { ascending: true })
      .order("position", { ascending: true });
    if (error) {
      setUnavailable(isMissingTodosTable(error));
      setTodos([]);
    } else {
      setUnavailable(false);
      setTodos((data ?? []) as TodoRow[]);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const addTodo = useCallback(
    async (todo: NewTodo) => {
      if (!tripId) throw new Error("Open a trip first");
      const { error } = await supabase.from("trip_todos").insert({
        trip_id: tripId,
        title: todo.title,
        notes: todo.notes || null,
        due_on: todo.due_on || null,
        assigned_to: todo.assigned_to || null,
        position: todos.length,
        created_by: uid,
      });
      if (error) throw error;
      await load();
    },
    [tripId, uid, todos.length, load],
  );

  const toggleTodo = useCallback(
    async (id: string, done: boolean) => {
      // Ticking something off should feel instant. The reload right after puts
      // the row where the server actually has it; on failure that same reload
      // is what puts the tick back, and the toast is what stops that looking
      // like the app breaking on its own.
      const label = todos.find((t) => t.id === id)?.title ?? "that";
      return runOptimistic({
        apply: () => {
          setTodos((cur) => cur.map((t) => (t.id === id ? { ...t, done } : t)));
          tap();
        },
        write: () =>
          supabase
            .from("trip_todos")
            .update({
              done,
              done_at: done ? new Date().toISOString() : null,
              done_by: done ? uid : null,
            })
            .eq("id", id),
        reconcile: load,
        report: ({ title, body }) => toast.error(title, { description: body }),
        label,
        action: done ? "tick off" : "un-tick",
      });
    },
    [uid, load, todos],
  );

  const updateTodo = useCallback(
    async (id: string, patch: Partial<Pick<TodoRow, "title" | "notes" | "due_on">>) => {
      const { error } = await supabase
        .from("trip_todos")
        .update({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
          ...(patch.due_on !== undefined ? { due_on: patch.due_on || null } : {}),
        })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const removeTodo = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("trip_todos").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const addMany = useCallback(
    async (titles: string[]) => {
      if (!tripId || titles.length === 0) return;
      const { error } = await supabase.from("trip_todos").insert(
        titles.map((title, index) => ({
          trip_id: tripId,
          title,
          position: todos.length + index,
          created_by: uid,
        })),
      );
      if (error) throw error;
      await load();
    },
    [tripId, uid, todos.length, load],
  );

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return {
    todos,
    open,
    done,
    loading,
    unavailable,
    addTodo,
    addMany,
    toggleTodo,
    updateTodo,
    removeTodo,
    reload: load,
  };
}
