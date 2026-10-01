import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_CALL } from "@/lib/ai-errors";
import { isSavedDirectionItem } from "@/lib/direction-stops";
import {
  DAY_EDIT_MAX_DAYS,
  DAY_EDIT_MAX_REQUEST,
  DAY_EDIT_MAX_STOPS,
  dayEditPrompt,
  readDayEdit,
  type DayEditPlan,
} from "@/lib/day-edit";
import { tripDays } from "@/lib/stop-move";

const DayEditInput = z.object({
  tripId: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stopIds: z.array(z.string().min(1).max(64)).min(1).max(DAY_EDIT_MAX_STOPS),
  request: z.string().trim().min(1).max(DAY_EDIT_MAX_REQUEST),
});

const DayEditSchema = z.object({
  stops: z
    .array(z.object({ stop: z.string(), day: z.string(), time: z.string() }))
    .max(DAY_EDIT_MAX_STOPS * 2),
  reply: z.string(),
});

/**
 * Béa's version of one day, for the stops the traveller ticked. Saves
 * nothing: the traveller sees it beside the day as it is, and applies it.
 *
 * The trip and its stops are read here, as the traveller (row security
 * decides), never taken from the request; the ticked ids only say which of
 * that day's stops may change. Shares the plan-edit hourly cap.
 */
export const askDayEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DayEditInput.parse(input))
  .handler(async ({ data, context }): Promise<DayEditPlan> => {
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
    const stops = (rows ?? []).filter((row) => row.title.trim() && !isSavedDirectionItem(row));
    const dayStops = stops.filter((row) => row.day_date === data.day);
    const days = tripDays(trip.start_date, trip.end_date, stops);
    if (!days.includes(data.day) || dayStops.length === 0) {
      throw new Error("There's nothing planned on that day yet.");
    }
    if (dayStops.length > DAY_EDIT_MAX_STOPS || days.length > DAY_EDIT_MAX_DAYS) {
      throw new Error("This day is too full for Béa to rework in one go. Move stops one by one.");
    }
    const onDay = new Set(dayStops.map((row) => row.id));
    const selected = new Set(data.stopIds.filter((id) => onDay.has(id)));
    if (selected.size === 0) throw new Error("Those stops aren't on that day any more.");

    const { reserveAi } = await import("@/lib/ai-quota.server");
    await reserveAi(context.userId, "dayEdit");
    const { withModelFallback } = await import("@/lib/ai.server");
    try {
      const result = await withModelFallback((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: DayEditSchema }),
          reasoning: "low",
          prompt: dayEditPrompt(data.request, dayStops, selected, days, data.day),
        }),
      );
      return readDayEdit(
        result.output.stops,
        dayStops,
        selected,
        days,
        data.day,
        result.output.reply,
      );
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't work that out. Try saying it another way.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
