export type RouteLeg = any;
const w = window as unknown as { __routeCalls?: unknown[] };
export const buildRoutes = async (input?: { data?: unknown }) => (((w.__routeCalls ??= []).push(input?.data ?? null)), { legs: [{ from: "", to: "", mode: "walking", distance: 1200, duration: 960, steps: [], mapUrl: "#" }], unresolved: [] });
