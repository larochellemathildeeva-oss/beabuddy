import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TripDetail } from "@/components/TripDetail";

const sample = new URLSearchParams(location.search).get("sample") ?? "default";
const guest = sample === "guest";
const trip = {
  id: "t1",
  title: "JQAPALA A",
  city: "Hiroshima",
  country: "Japan",
  start_date: sample === "undated" ? null : "2026-10-07",
  end_date: sample === "undated" ? null : "2026-10-08",
  dates_status: "fixed",
  status: "upcoming",
  budget_enabled: true,
  owner_id: guest ? "someone-else" : "me",
} as never;

createRoot(document.getElementById("root")!).render(
  <div style={{ width: 390 }} className="bg-background px-3 py-3">
    <Toaster />
    <TripDetail
      trip={trip}
      photos={[]}
      members={[
        { id: "m1", trip_id: "t1", user_id: guest ? "someone-else" : "me", role: "owner", display_name: guest ? "Chloé" : "Mattie" },
        ...(guest ? [{ id: "m2", trip_id: "t1", user_id: "me", role: "member", display_name: "Mattie" }] : []),
      ]}
      companionsLine="Flying solo"
      me={{ id: "me", name: "Mattie" }}
      onInvite={async () => "K7Q2PM"}
      onRevokeInvite={async () => {}}
      onUpdate={async () => {}}
      onDelete={async () => {}}
      onLeave={async () => {}}
      onRemoveMember={async () => {}}
    />
  </div>,
);
