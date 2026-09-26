/**
 * Béa design system — entry point.
 *
 * Consumers must load these fonts in their app's <head>:
 *   <link rel="preconnect" href="https://fonts.googleapis.com">
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 *   <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
 */
import "./styles.css";

export { AppShell } from "./components/AppShell";
export { BeaProvider, BeaFontLinks } from "./components/BeaProvider";
export { ComparePins } from "./components/ComparePins";
export { AddVisitedCity } from "./components/AddVisitedCity";

export { CustomizeHome } from "./components/CustomizeHome";
export { DocumentVault } from "./components/DocumentVault";
export { PackingLists } from "./components/PackingLists";
export { PlaceSearchInput } from "./components/PlaceSearchInput";
export { Globe } from "./components/Globe";
export { NearbyMapPin } from "./components/NearbyMapPin";
export { PageGuide } from "./components/PageGuide";
export { HomeTripHero } from "./components/HomeTripCard";
export { pickActiveTrip } from "./lib/home-trip";
export { TripStops } from "./components/TripStops";
export { ItineraryImport } from "./components/ItineraryImport";
export { ItineraryDirections } from "./components/ItineraryDirections";
export * from "./data/atlas";

export { Tour, useTourControl, startFirstRunTour, resumeOrReplayTour } from "./components/Tour";
export { TripBudget } from "./components/TripBudget";
export { Constants } from "./integrations/supabase/types";
export type { Database } from "./integrations/supabase/types";
export { supabase } from "./integrations/supabase/client";
export * from "./hooks/useAuth";
export * from "./hooks/useTrips";
export * from "./hooks/usePhotoMemories";
export * from "./hooks/useRecommendations";
export * from "./hooks/useFutureNotes";
export * from "./hooks/usePacking";
export * from "./hooks/useExpenses";
export * from "./hooks/useVault";
export * from "./hooks/useTripBudget";
export * from "./hooks/useHomeLayout";
export * from "./hooks/useStatsLayout";
export * from "./hooks/useLegalConsent";
export * from "./hooks/useOfflineDirections";
export * from "./hooks/useRates";
export * from "./hooks/useTripStops";
export { cn } from "./lib/utils";
export * from "./components/ui/button";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/calendar";
export * from "./components/ui/sheet";
export { toast } from "sonner";
export * from "./components/ui/switch";
export * from "./components/ui/sonner";
export * from "./components/ui/tooltip";
export { useIsMobile } from "./hooks/use-mobile";
