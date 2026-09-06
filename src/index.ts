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
export { HomeTripCard, pickActiveTrip } from "./components/HomeTripCard";
export { TripStops } from "./components/TripStops";
export { ItineraryImport } from "./components/ItineraryImport";
export { ItineraryDirections } from "./components/ItineraryDirections";
export * from "./data/atlas";

export { Tour, useTourControl, startTour } from "./components/Tour";
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
export * from "./components/ui/card";
export * from "./components/ui/input";
export * from "./components/ui/dialog";
export * from "./components/ui/accordion";
export * from "./components/ui/tooltip";
export * from "./components/ui/alert";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/aspect-ratio";
export * from "./components/ui/avatar";
export * from "./components/ui/badge";
export * from "./components/ui/breadcrumb";
export * from "./components/ui/calendar";
export * from "./components/ui/carousel";
export * from "./components/ui/chart";
export * from "./components/ui/checkbox";
export * from "./components/ui/collapsible";
export * from "./components/ui/command";
export * from "./components/ui/context-menu";
export * from "./components/ui/drawer";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/form";
export * from "./components/ui/hover-card";
export * from "./components/ui/input-otp";
export * from "./components/ui/label";
export * from "./components/ui/menubar";
export * from "./components/ui/navigation-menu";
export * from "./components/ui/pagination";
export * from "./components/ui/popover";
export * from "./components/ui/progress";
export * from "./components/ui/radio-group";
export * from "./components/ui/resizable";
export * from "./components/ui/scroll-area";
export * from "./components/ui/select";
export * from "./components/ui/separator";
export * from "./components/ui/sheet";
export * from "./components/ui/sidebar";
export * from "./components/ui/skeleton";
export * from "./components/ui/slider";
export * from "./components/ui/sonner";
export { toast } from "sonner";
export * from "./components/ui/switch";
export * from "./components/ui/table";
export * from "./components/ui/tabs";
export * from "./components/ui/textarea";
export * from "./components/ui/toggle";
export * from "./components/ui/toggle-group";
export { useIsMobile } from "./hooks/use-mobile";
