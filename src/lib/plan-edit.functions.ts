import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_CALL } from "@/lib/ai-errors";
import { isSavedDirectionItem } from "@/lib/direction-stops";
import {
  PLAN_EDIT_MAX_DAYS,
  PLAN_EDIT_MAX_EARLIER,
  PLAN_EDIT_MAX_MOVES,
  PLAN_EDIT_MAX_REQUEST,
  PLAN_EDIT_MAX_STOPS,
  combineMoves,
  planAfter,
  planEditPrompt,
  readPendingMoves,
  readPlanEdit,
} from "@/lib/plan-edit";
import { tripDays, type StopMove } from "@/lib/stop-move";

const PlanEditInput = z.object({
  tripId: z.string().uuid(),
  request: z.string().trim().min(1).max(PLAN_EDIT_MAX_REQUEST),
  /**
   * The answer to the traveller's earlier requests, shown but not applied
   * yet, so a follow-up ("and the market too") adds to it instead of
   * starting over from the saved plan.
   */
  pending: z
    .object({
      requests: z
        .array(z.string().trim().min(1).max(PLAN_EDIT_MAX_REQUEST))
        .max(PLAN_EDIT_MAX_EARLIER),
      moves: z
        .array(
          z.object({
            id: z.string().uuid(),
            day_date: z.string().max(20).nullable(),
            at: z.union([
              z.enum(["start", "end"]),
              z.object({ after: z.string().uuid() }),
              z.object({ index: z.number().int().min(0).max(PLAN_EDIT_MAX_STOPS) }),
            ]),
            time_label: z.string().max(10).nullable().optional(),
          }),
        )
        .max(PLAN_EDIT_MAX_MOVES),
    })
    .optional(),
});

const PlanEditSchema = z.object({
  moves: z
    .array(
      z.object({
        stop: z.string(),
        day: z.string(),
        after: z.string(),
        time: z.string(),
      }),
    )
    .max(PLAN_EDIT_MAX_MOVES),
  reply: z.string(),
});

/** `moves` is everything to apply: earlier pending moves and the new ones together. */
export type PlanEditAnswer = { moves: StopMove[]; reply: string };

/**
 * Read a change to the plan in plain words as a list of moves. Saves
 * nothing: the traveller sees the moves first and applies them.
 *
 * The trip and its stops are read here, as the traveller (row security
 * decides), never taken from the request, so the model only ever sees a
 * trip its caller belongs to. Calls are capped per person.
 */
export const askPlanEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanEditInput.parse(input))
  .handler(async ({ data, context }): Promise<PlanEditAnswer> => {
    const { allowPlanEdit } = await import("@/lib/plan-edit-limit.server");
    if (!allowPlanEdit(context.userId)) {
      throw new Error("Béa needs a short break. Try again in a few minutes.");
    }

    const [{ data: trip }, { data: rows, error }] = await Promise.all([
      context.supabase
        .from("trips")
        .select("start_date, end_date")
        .eq("id", data.tripId)
        .maybeSingle(),
      context.supabase
        .from("itinerary_items")
        .select("id, title, kind, day_date, time_label, position")
        .eq("trip_id", data.tripId)
        .order("day_date", { ascending: true })
        .order("position", { ascending: true }),
    ]);
    if (!trip || error) throw new Error("Béa couldn't open this trip.");
    const saved = (rows ?? []).filter((row) => row.title.trim() && !isSavedDirectionItem(row));
    if (saved.length === 0) throw new Error("There's nothing on this trip to move yet.");
    const days = tripDays(trip.start_date, trip.end_date, saved);
    if (saved.length > PLAN_EDIT_MAX_STOPS || days.length > PLAN_EDIT_MAX_DAYS) {
      throw new Error(
        "This trip is too long for Béa to rearrange in one go. Move stops one by one.",
      );
    }

    // Béa reads the plan as the traveller sees it, earlier changes in place.
    const pending = readPendingMoves(data.pending?.moves ?? [], saved, days);
    const stops = planAfter(saved, pending);
    const earlier = pending.length > 0 ? (data.pending?.requests ?? []) : [];

    const { reserveAi } = await import("@/lib/ai-quota.server");
    await reserveAi(context.userId, "planEdit");
    const { withModelFallback } = await import("@/lib/ai.server");
    try {
      const result = await withModelFallback((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: PlanEditSchema }),
          reasoning: "low",
          prompt: planEditPrompt(data.request, stops, days, earlier),
        }),
      );
      const moves = readPlanEdit(result.output.moves, stops, days);
      return {
        moves: moves.length > 0 ? combineMoves(saved, [...pending, ...moves]) : [],
        reply: result.output.reply.trim().slice(0, 300),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't work that out. Try saying it another way.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
