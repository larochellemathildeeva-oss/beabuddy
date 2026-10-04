/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ItineraryRow, MemberRow, Presence, TripRow } from "@/hooks/useTrips";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { PrepTab } from "@/components/TripPrep";
import type { OptimizePreset, PlannerTab } from "@/components/ItineraryImport";
import type { TripBarPosition } from "@/hooks/useTripBarPosition";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EasePreset } from "@/lib/day-ease";
import type { InsideEntry } from "@/lib/inside-list";
import type { UseNavigateResult } from "@tanstack/react-router";
import type { ScheduleUpdate } from "@/lib/itinerary-schedule-write";
import type { BudgetItem } from "@/hooks/useTripBudget";
import type { ExpenseRow } from "@/hooks/useExpenses";
import type { NewStop, StopRow } from "@/hooks/useTripStops";
import type { SavedDirections } from "@/hooks/useOfflineDirections";
import type { TravelChoice } from "@/lib/travel-mode";
import type { RouteLeg } from "@/lib/directions.functions";
import type { SignatureStop } from "@/lib/offline-directions";
import type { SavedMap } from "@/lib/offline-map";
import type { DirectionStop } from "@/lib/direction-stops";
import type { PlaceLike } from "@/lib/captured-place";
import type { PackItemRow, PackRow } from "@/hooks/usePacking";
import type { PackDraftItem, PackEditItem } from "@/lib/packing-sections";
import type { BookingTile, TripMenuSection } from "@/components/day/TripMenuSheet";
import type { BookingFilter } from "@/components/day/TripBookings";
import type { TripDocument } from "@/lib/trip-documents";
import type { StopPhoto, StopPhotosAdded } from "@/hooks/useStopPhotos";
import type { TimelineDayGroup } from "@/lib/timeline-groups";
import type { KnownLeg } from "@/lib/directions-reuse";
import type { ConsequenceResult, TravelLeg } from "@/lib/itinerary-change";
import type { ReviewChangeSet, ReviewProposal } from "@/lib/itinerary-review";
import type { ReviewRow } from "@/hooks/useScheduleReview";
import type { StopMove } from "@/lib/stop-move";
import type { DayEditSave } from "@/components/day/DayEditSheet";
import type { TripViewKey, TripViewPrefs } from "@/hooks/useTripViewPrefs";
import type { DayChip } from "@/lib/trip-days";
import type { CheckupFinding, CheckupIdDocument } from "@/lib/trip-checkup";

export interface TripDetailCtx {
  trip: TripRow;
  photos: TripPhotoRow[];
  members: MemberRow[];
  companionsLine: string;
  me: { id: string | null; name: string };
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onUpdate: (patch: Partial<TripRow>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  openPrep: PrepTab | undefined;
  openView: "bookings" | undefined;
  openPlan: { tab: PlannerTab; ask?: string | undefined } | undefined;
  navigate: UseNavigateResult<string>;
  barPosition: "top" | "bottom" | "side";
  setBarPosition: (next: TripBarPosition) => void;
  bookingsOpen: boolean;
  setBookingsOpen: Dispatch<SetStateAction<boolean>>;
  bookingsRef: RefObject<HTMLElement | null>;
  plannerOpen: boolean;
  setPlannerOpen: Dispatch<SetStateAction<boolean>>;
  plannerTab: PlannerTab;
  setPlannerTab: Dispatch<SetStateAction<PlannerTab>>;
  plannerAsk: string;
  setPlannerAsk: Dispatch<SetStateAction<string>>;
  optimizePreset: OptimizePreset | null;
  setOptimizePreset: Dispatch<SetStateAction<OptimizePreset | null>>;
  easeDay: (preset: EasePreset, day: string, dayLabel: string) => void;
  activeId: string;
  board: {
    items: ItineraryRow[];
    invites: {
      code: string;
      email: string | null;
      accepted_at: string | null;
      expires_at: string | null;
      revoked_at: string | null;
      use_count: number;
      max_uses: number;
    }[];
    present: Presence[];
    addItem: (item: {
      day_date?: string;
      time_label?: string;
      kind: string;
      title: string;
      detail?: string;
      address?: string;
      lat?: number;
      lon?: number;
    }) => Promise<string | undefined>;
    addItems: (
      additions: Array<{
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
        planned_stay_minutes?: number;
        booked?: boolean;
        inside?: InsideEntry[];
        parent_index?: number;
        pin_check?: string | null;
        position?: number;
      }>,
    ) => Promise<string[] | undefined>;
    removeItems: (ids: string[]) => Promise<void>;
    upsertItems: (
      additions: Array<{
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
      }>,
    ) => Promise<void>;
    applySchedule: (updates: ScheduleUpdate[]) => Promise<void>;
    updateItem: (
      id: string,
      patch: Partial<
        Pick<
          ItineraryRow,
          | "title"
          | "detail"
          | "time_label"
          | "kind"
          | "day_date"
          | "address"
          | "lat"
          | "lon"
          | "planned_stay_minutes"
          | "time_locked"
          | "booked"
          | "booking_ref"
          | "booking_details"
          | "parent_id"
          | "inside"
          | "pin_check"
        >
      >,
    ) => Promise<void>;
    setProgress: (
      writes: { id: string; patch: Partial<Pick<ItineraryRow, "arrived_at" | "left_at">> }[],
    ) => Promise<void>;
    insertItemAfter: (
      afterId: string,
      item: {
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
      },
    ) => Promise<string | undefined>;
    removeItem: (id: string) => Promise<void>;
    setEditing: (label: string | null) => void;
    reload: () => Promise<void>;
  };
  removeWithUndo: (input: {
    label: string;
    count?: number;
    remove: () => Promise<void>;
    restore: () => Promise<void>;
  }) => Promise<void>;
  scheduleErrorText: (
    e: unknown,
  ) =>
    | "Someone else changed this stop just now. Béa kept their version."
    | "Only part of that change saved. The stop shows what was kept."
    | "Fixed and Flexible aren't set up yet."
    | "Couldn't save that change. Check your connection."
    | "Couldn't save that change. Try again in a moment.";
  saveCard: (
    id: string,
    patch: Parameters<
      (
        id: string,
        patch: Partial<
          Pick<
            ItineraryRow,
            | "title"
            | "detail"
            | "time_label"
            | "kind"
            | "day_date"
            | "address"
            | "lat"
            | "lon"
            | "planned_stay_minutes"
            | "time_locked"
            | "booked"
            | "booking_ref"
            | "booking_details"
            | "parent_id"
            | "inside"
            | "pin_check"
          >
        >,
      ) => Promise<void>
    >[1],
  ) => void;
  budget: {
    items: BudgetItem[];
    spent: ExpenseRow[];
    budget: { amount: number; currency: string };
    totals: {
      planned: number;
      spent: number;
      claimable: number;
      target: number;
      remaining: number;
      pct: number;
      over: boolean;
      byCategory: [string, { planned: number; spent: number }][];
      receipts: number;
    };
    loading: boolean;
    addItem: (item: {
      label: string;
      category: string;
      amount: number;
      currency: string;
    }) => Promise<void>;
    addItems: (
      additions: Array<{ label: string; category: string; amount: number; currency: string }>,
    ) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    setTripBudget: (amount: number, currency: string) => Promise<void>;
    reload: () => Promise<void>;
  };
  cities: {
    stops: StopRow[];
    countries: string[];
    loading: boolean;
    addStop: (s: NewStop) => Promise<void>;
    addStops: (list: NewStop[]) => Promise<void>;
    updateStop: (id: string, patch: Partial<Omit<StopRow, "id" | "trip_id">>) => Promise<void>;
    removeStop: (id: string) => Promise<void>;
    moveStop: (id: string, dir: -1 | 1) => Promise<void>;
    missingHome: { city: string; country: string; arrive_on: string; depart_on: string } | null;
    addHome: () => Promise<void>;
    reload: () => Promise<void>;
  };
  fullRoute: (
    | StopRow
    | {
        city: string;
        country: string;
        arrive_on: string;
        depart_on: string;
        id: string;
        kind: string;
        lat: null;
        lon: null;
      }
  )[];
  routeCities: (
    | StopRow
    | {
        city: string;
        country: string;
        arrive_on: string;
        depart_on: string;
        id: string;
        kind: string;
        lat: null;
        lon: null;
      }
  )[];
  cityChoice: string;
  setCityChoice: Dispatch<SetStateAction<string>>;
  chosenCity:
    | StopRow
    | {
        city: string;
        country: string;
        arrive_on: string;
        depart_on: string;
        id: string;
        kind: string;
        lat: null;
        lon: null;
      }
    | null;
  dir: {
    saved: SavedDirections | null;
    busy: boolean;
    error: string;
    download: (
      stops: { title: string; address?: string | null; lat?: number | null; lon?: number | null }[],
      area?: string,
      travel?: TravelChoice,
    ) => Promise<void>;
    keep: (
      result: { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] },
      stops: SignatureStop[],
    ) => boolean;
    clear: () => void;
  };
  travel: TravelChoice;
  setTravel: Dispatch<SetStateAction<TravelChoice>>;
  chooseTravel: (choice: TravelChoice) => void;
  dayMaps: {
    maps: Record<string, string>;
    busy: boolean;
    error: string;
    save: (days: { day: string; points: { lat: number; lon: number }[] }[]) => Promise<void>;
    clear: () => void;
  };
  offlineMap: {
    saved: SavedMap | null;
    busy: boolean;
    progress: { done: number; total: number } | null;
    error: string;
    save: (days: readonly { points: readonly { lat: number; lon: number }[] }[]) => Promise<void>;
    clear: () => void;
  };
  directionStops: DirectionStop[];
  routeStops: DirectionStop[];
  stopItems: ItineraryRow[];
  savedTravel: Map<string, RouteLeg>;
  lookupTown: any;
  findingCities: boolean;
  setFindingCities: Dispatch<SetStateAction<boolean>>;
  canFindCities: boolean;
  findCities: () => Promise<void>;
  lookupArea: string;
  directionArea: string | undefined;
  routeRun: any;
  directionsFor: string[] | null;
  setDirectionsFor: Dispatch<SetStateAction<string[] | null>>;
  nearOn: (day: string | null | undefined) => string | undefined;
  triedPlacing: RefObject<Set<string>>;
  triedPlacingRows: RefObject<Set<string>>;
  latestItems: RefObject<ItineraryRow[]>;
  vaultPlaces: PlaceLike[] | null;
  setVaultPlaces: Dispatch<SetStateAction<PlaceLike[] | null>>;
  loadVaultPlaces: () => Promise<PlaceLike[]>;
  isKept: (item: ItineraryRow) => boolean;
  keeping: RefObject<Set<string>>;
  keepItemAsReco: (item: ItineraryRow) => Promise<void>;
  removeTimelineItem: (item: ItineraryRow) => Promise<void>;
  foldProps: (
    item: ItineraryRow,
  ) => { foldInto?: never; onFold?: never } | { foldInto: string; onFold: () => void };
  savedFitsTimeline: boolean;
  liveLegs: RouteLeg[] | null;
  setLiveLegs: Dispatch<SetStateAction<RouteLeg[] | null>>;
  tripCenter: { lat: number; lon: number } | null;
  dayCenters: Map<string, { lat: number; lon: number }>;
  centerOn: (day: string | null | undefined) => { lat: number; lon: number } | null;
  itemsById: Map<string, ItineraryRow>;
  nestedCounts: Map<string, number>;
  nestProps: (item: ItineraryRow) =>
    | { flat: boolean; onInside: (next: InsideEntry[]) => undefined }
    | {
        nestedStops: number;
        onInside: (next: InsideEntry[]) => undefined;
        parentTitle?: string;
        flat?: never;
      };
  withNear: (day: string | null | undefined) => {
    center?: { lat: number; lon: number };
    near?: string;
  };
  strayIds: Set<string>;
  directionIndexById: Map<string, number>;
  legFor: (fromId: string, toId: string) => RouteLeg | undefined;
  travelInto: (from: ItineraryRow, to: ItineraryRow, strict?: boolean) => RouteLeg | undefined;
  templates: {
    signedIn: boolean;
    loading: boolean;
    packs: PackRow[];
    items: PackItemRow[];
    createPack: (
      name: string,
      emoji: string,
      starter?: Array<string | PackDraftItem>,
    ) => Promise<string>;
    renamePack: (id: string, name: string) => Promise<void>;
    deletePack: (id: string) => Promise<void>;
    duplicatePack: (listId: string) => Promise<void>;
    saveEdits: (listId: string, edited: PackEditItem[]) => Promise<void>;
    saveAsNewPack: (listId: string, name: string, edited: PackEditItem[]) => Promise<string>;
    addItem: (
      listId: string,
      label: string,
      section?: string | null,
      quantity?: number,
    ) => Promise<void>;
    toggleItem: (id: string, packed: boolean) => Promise<void>;
    updateItem: (
      id: string,
      patch: Partial<Pick<PackItemRow, "label" | "quantity">>,
    ) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    resetPack: (listId: string) => Promise<void>;
    attachToTrip: (templateId: string, targetTripId: string) => Promise<string | null>;
    reload: () => Promise<void>;
  };
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  sheetSection: TripMenuSection | null;
  setSheetSection: Dispatch<SetStateAction<TripMenuSection | null>>;
  packTemplateId: string;
  setPackTemplateId: Dispatch<SetStateAction<string>>;
  packMsg: string;
  setPackMsg: Dispatch<SetStateAction<string>>;
  prepSignal: number;
  setPrepSignal: Dispatch<SetStateAction<number>>;
  currencyOpen: boolean;
  setCurrencyOpen: Dispatch<SetStateAction<boolean>>;
  prepAsk: { tab: PrepTab; n: number } | null;
  setPrepAsk: Dispatch<SetStateAction<{ tab: PrepTab; n: number } | null>>;
  addingTimeline: boolean;
  setAddingTimeline: Dispatch<SetStateAction<boolean>>;
  timelineOpen: boolean;
  setTimelineOpen: Dispatch<SetStateAction<boolean>>;
  timelineByDay: boolean;
  setTimelineByDay: Dispatch<SetStateAction<boolean>>;
  collapsedDays: Record<string, boolean>;
  setCollapsedDays: Dispatch<SetStateAction<Record<string, boolean>>>;
  editingTimeline: boolean;
  setEditingTimeline: Dispatch<SetStateAction<boolean>>;
  directionsOpen: boolean;
  setDirectionsOpen: Dispatch<SetStateAction<boolean>>;
  directionsBusy: boolean;
  setDirectionsBusy: Dispatch<SetStateAction<boolean>>;
  directionsButton:
    | { onDirections: () => void; directionsBusy: boolean }
    | { onDirections?: never; directionsBusy?: never };
  savedDirectionRows: ItineraryRow[];
  removeDirectionRows: () => Promise<void>;
  timelineMenuOpen: boolean;
  setTimelineMenuOpen: Dispatch<SetStateAction<boolean>>;
  dayEditOpen: boolean;
  setDayEditOpen: Dispatch<SetStateAction<boolean>>;
  dayEditStart: { day: string; ask: string } | null;
  setDayEditStart: Dispatch<SetStateAction<{ day: string; ask: string } | null>>;
  minutesNow: number;
  setMinutesNow: Dispatch<SetStateAction<number>>;
  todayKey: string;
  addDay: string;
  setAddDay: Dispatch<SetStateAction<string>>;
  bookingFilter: BookingFilter;
  setBookingFilter: Dispatch<SetStateAction<BookingFilter>>;
  bookingDocs: { docs: TripDocument[]; reload: () => Promise<void> };
  stopPhotos: {
    available: boolean;
    photos: StopPhoto[];
    byStop: Map<string, StopPhoto[]>;
    add: (item: ItineraryRow | null, files: File[]) => Promise<StopPhotosAdded>;
    remove: (photo: StopPhoto) => Promise<void>;
  };
  tripPrefs: { list: string[]; save: (next: string[]) => Promise<void>; onPhone: boolean };
  keptOffline: boolean;
  others: Presence[];
  allDayGroups: TimelineDayGroup<ItineraryRow>[];
  timelineGroups: TimelineDayGroup<ItineraryRow>[];
  moveDays: string[];
  movingId: string | null;
  setMovingId: Dispatch<SetStateAction<string | null>>;
  knownDirections: (KnownLeg | undefined)[];
  knownLegs: TravelLeg[];
  scheduleReview: {
    review: (
      scope: "stops" | "all",
      proposal: ReviewProposal,
      after?: () => Promise<void>,
    ) => { updates: ScheduleUpdate[]; previous: ScheduleUpdate[] } | null;
    sheet: {
      open: boolean;
      result: ConsequenceResult | null;
      changeSet: ReviewChangeSet | null;
      directIds: ReadonlySet<string>;
      stops: readonly ReviewRow[];
      busy: boolean;
      refreshed: boolean;
      onApply: () => undefined;
      onClose: () => void;
    };
  };
  movingStop: ItineraryRow | null;
  moveStops: (moves: StopMove[], summary?: string) => Promise<void>;
  applyDayEdit: ({ updates, added, summary }: DayEditSave) => Promise<void>;
  moveProps: (item: ItineraryRow) => {
    onMove: (direction: -1 | 1) => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveTo: () => void;
  };
  dayChoice: string | null;
  setDayChoice: Dispatch<SetStateAction<string | null>>;
  chosenDay: string;
  shownGroups: TimelineDayGroup<ItineraryRow>[];
  todayGroup: TimelineDayGroup<ItineraryRow> | undefined;
  nowStop: ItineraryRow | null;
  jumpToNow: () => void;
  jumpToStop: (stopId: string) => void;
  dayCardsRef: RefObject<HTMLDivElement | null>;
  offerDays: boolean;
  perspective: "map" | "overview" | "companion" | "timeline";
  setPerspective: Dispatch<SetStateAction<"map" | "overview" | "companion" | "timeline">>;
  activePerspective:
    | { readonly id: "overview"; readonly label: "Overview"; readonly hint: "" }
    | {
        readonly id: "companion";
        readonly label: "Companion";
        readonly hint: "Where you are now, what is next, and when to leave.";
      }
    | { readonly id: "map"; readonly label: "Map"; readonly hint: "" }
    | {
        readonly id: "timeline";
        readonly label: "Timeline";
        readonly hint: "The day in order: reorder, retime, add and edit.";
      };
  viewKey: string;
  hideDone: boolean;
  setHideDone: Dispatch<SetStateAction<boolean>>;
  byArea: boolean;
  setByArea: Dispatch<SetStateAction<boolean>>;
  compactCards: boolean;
  setCompactCards: Dispatch<SetStateAction<boolean>>;
  draggingDay: string | null;
  setDraggingDay: Dispatch<SetStateAction<string | null>>;
  doneCount: number;
  hidingDone: boolean;
  restored: RefObject<boolean>;
  view: { prefs: TripViewPrefs; toggle: (key: TripViewKey) => void };
  toCheck: ItineraryRow[];
  pinReviewOpen: boolean;
  setPinReviewOpen: Dispatch<SetStateAction<boolean>>;
  docsByStop: Map<string, string[]>;
  docProps: (item: ItineraryRow) =>
    | {
        photos: {
          title: string;
          photos: StopPhoto[];
          available: boolean;
          uid: string | null;
          onAdd: (files: File[]) => Promise<StopPhotosAdded>;
          onRemove: (photo: StopPhoto) => Promise<void>;
        };
        linkedDocuments?: never;
        onOpenDocuments?: never;
      }
    | {
        photos: {
          title: string;
          photos: StopPhoto[];
          available: boolean;
          uid: string | null;
          onAdd: (files: File[]) => Promise<StopPhotosAdded>;
          onRemove: (photo: StopPhoto) => Promise<void>;
        };
        linkedDocuments: number;
        onOpenDocuments: () => undefined;
      };
  linkedDocProps: (
    item: ItineraryRow,
  ) =>
    | { linkedDocuments?: never; onOpenDocuments?: never }
    | { linkedDocuments: number; onOpenDocuments: () => undefined };
  openBookings: (kind: BookingFilter) => void;
  savedOpen: boolean;
  setSavedOpen: Dispatch<SetStateAction<boolean>>;
  addOpen: boolean;
  setAddOpen: Dispatch<SetStateAction<boolean>>;
  citySignal: number;
  setCitySignal: Dispatch<SetStateAction<number>>;
  addToDay: string | null;
  addToDayLabel: string | null;
  peekId: string | null;
  setPeekId: Dispatch<SetStateAction<string | null>>;
  mapFocus: string | null;
  setMapFocus: Dispatch<SetStateAction<string | null>>;
  locate: (item: ItineraryRow) => void;
  addBetween: { afterId: string; time: string } | null;
  setAddBetween: Dispatch<SetStateAction<{ afterId: string; time: string } | null>>;
  insertAnchor: RefObject<string | null>;
  toggleDone: (item: ItineraryRow) => void;
  companionDay: TimelineDayGroup<ItineraryRow> | null;
  nowStops: ItineraryRow[];
  peekStop: ItineraryRow | null;
  tripStopsForNow: ItineraryRow[];
  nowLegs: (RouteLeg | undefined)[];
  tripWide: { international: boolean; hasLodging: boolean; hasFlights: boolean };
  tripCountries: (string | null)[];
  cityDayKeys: Set<string>;
  chips: DayChip[];
  ordinalFor: (key: string) => string;
  datedDayCount: number;
  companionOrdinal: string;
  companionPlace: string;
  companionDateLine: string;
  cityNames: string[];
  tripArt: string;
  companionArt: string;
  bookingCounts: Record<BookingTile, number>;
  openAddBetween: (item: ItineraryRow, next: ItineraryRow) => void;
  tripNote: string | null;
  idDocuments: CheckupIdDocument[];
  checkup: CheckupFinding[] | null;
}
