/**
 * Preview-only entry: mounts the REAL TanStack router with the package's
 * two new route files (/next, /trips/next) under a minimal root, a memory
 * history, and the app's own providers. Data comes from sample-db.ts via
 * the fake Supabase client. Not part of the app.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { BeaProvider } from "@/components/BeaProvider";
import { Route as NextHome } from "@/routes/next";
import { Route as TripsNext } from "@/routes/trips_.next";
import { TERRAIN_ART } from "@/lib/terrain-art";
import { TERRAIN_DEMO } from "./terrain-demo";

const q = new URLSearchParams(location.search);
const queryClient = new QueryClient();
// ?terrain=demo shows the terrain slot filled (the app ships it empty).
if (q.get("terrain") === "demo") Object.assign(TERRAIN_ART, TERRAIN_DEMO);

const root = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <BeaProvider>
        <Outlet />
      </BeaProvider>
    </QueryClientProvider>
  ),
});
const home = NextHome.update({
  id: "/next",
  path: "/next",
  getParentRoute: () => root,
} as never);
const trips = TripsNext.update({
  id: "/trips_/next",
  path: "/trips/next",
  getParentRoute: () => root,
} as never);
// Link targets the screens point at; in the preview they show where a tap goes.
const elsewhere = createRoute({
  getParentRoute: () => root,
  path: "$",
  component: () => (
    <div
      style={{ padding: 32, fontFamily: "Manrope, sans-serif", fontSize: 15 }}
    >
      Preview: this tap opens <b>{location.hash || "another screen"}</b> in the
      app.
    </div>
  ),
});

const start =
  q.get("screen") === "trips" ? `/trips/next${q.get("search") ?? ""}` : "/next";
const router = createRouter({
  routeTree: root.addChildren([home as never, trips as never, elsewhere]),
  history: createMemoryHistory({ initialEntries: [start] }),
  defaultPreload: false,
});
(window as unknown as { __router: unknown }).__router = router;

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
