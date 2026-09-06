/** Rotates so the create/save note does not always say the same thing. */
export const TRIP_STILL_EDITABLE = [
  "It's okay — this isn't a boarding pass. You can still change the trip after it's added.",
  "Béa does not lock the door behind you. Budget, dates, friends: all fair game later.",
  "Forgot a checkbox? Fine. This is a first draft of a holiday, not a treaty.",
  "Nothing here is carved in stone, except maybe the bakery stop. Edit whenever.",
  "Changes still work after the trip exists. Béa has seen worse last-minute plot twists.",
] as const;

export function tripStillEditableNote(at = new Date()): string {
  const day = Math.floor(at.getTime() / 86_400_000);
  return TRIP_STILL_EDITABLE[
    ((day % TRIP_STILL_EDITABLE.length) + TRIP_STILL_EDITABLE.length) % TRIP_STILL_EDITABLE.length
  ]!;
}

export function tripCompanionsLine(
  members: { user_id: string; display_name: string | null }[],
  myId: string | null,
): string {
  const others = members.filter((m) => m.user_id !== myId);
  if (others.length === 0) return "Flying Solo";
  const names = others.map((m) => m.display_name?.trim()).filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return others.length === 1 ? "With a friend" : `With ${others.length} friends`;
  }
  return `With ${names.join(", ")}`;
}
