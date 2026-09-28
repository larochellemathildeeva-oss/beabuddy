import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_CALL } from "@/lib/ai-errors";
import {
  PLAN_EDIT_MAX_DAYS,
  PLAN_EDIT_MAX_MOVES,
  PLAN_EDIT_MAX_REQUEST,
  PLAN_EDIT_MAX_STOPS,
  planEditPrompt,
  readPlanEdit,
} from "@/lib/plan-edit";
import type { StopMove } from "@/lib/stop-move";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const PlanEditInput = z.object({
  request: z.string().trim().min(1).max(PLAN_EDIT_MAX_REQUEST),
  days: z.array(z.string().regex(ISO_DAY)).max(PLAN_EDIT_MAX_DAYS),
  stops: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().max(200),
        day_date: z.string().regex(ISO_DAY).nullable(),
        time_label: z.string().max(40).nullable(),
        kind: z.string().max(40).nullable().optional(),
      }),
    )
    .min(1)
    .max(PLAN_EDIT_MAX_STOPS),
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

export type PlanEditAnswer = { moves: StopMove[]; reply: string };

/**
 * Read a change to the plan in plain words as a list of moves. Saves
 * nothing: the traveller sees the moves first and applies them.
 */
export const askPlanEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanEditInput.parse(input))
  .handler(async ({ data }): Promise<PlanEditAnswer> => {
    const { withModelFallback } = await import("@/lib/ai.server");
    try {
      const result = await withModelFallback((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: PlanEditSchema }),
          reasoning: "low",
          prompt: planEditPrompt(data.request, data.stops, data.days),
        }),
      );
      return {
        moves: readPlanEdit(result.output.moves, data.stops, data.days),
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
