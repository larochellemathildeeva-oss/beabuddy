export interface LatLng {
  lat: number;
  lng: number;
}

export type TransitMode = 'walk' | 'drive' | 'transit' | 'ferry' | 'train';

export interface DirectionStep {
  id: string;
  stepNumber: number;
  instruction: string;
  distanceMeters?: number;
  durationMinutes?: number;
  landmark?: string;
  actionIcon?: 'straight' | 'turn-right' | 'turn-left' | 'board' | 'arrive';
}

export interface TransitLeg {
  id: string;
  fromId: string;
  toId: string;
  mode: TransitMode;
  distanceKm: number;
  durationMinutes: number;
  instructions?: string;
  scenicNote?: string;
  steps?: DirectionStep[];
  googleMapsUrl?: string;
}

export type ItemCategory = 'attraction' | 'food' | 'transport' | 'hotel' | 'culture' | 'leisure';

export interface ItineraryItem {
  id: string;
  order: number;
  time: string;
  title: string;
  subtitle: string;
  address: string;
  neighborhood?: string;
  category: ItemCategory;
  coordinates: LatLng;
  notes?: string;
  isBooked?: boolean;
  ticketInfo?: string;
  bookingCode?: string;
  estimatedStayMinutes?: number;
  cost?: string;
  rating?: number;
  imageUrl?: string;
  localTip?: string;
  isCompleted?: boolean;
  isArchived?: boolean;
}

export interface DayItinerary {
  dayNumber: number;
  dateString: string;
  title: string;
  beaDailyInsight: string;
  items: ItineraryItem[];
}

export interface PlanOption {
  id: string;
  name: string;
  tagline: string;
  vibe: string;
  pacing: string;
  days: DayItinerary[];
}

export interface SavedPlace {
  id: string;
  title: string;
  category: ItemCategory;
  address: string;
  neighborhood: string;
  notes: string;
  coordinates: LatLng;
  recommendedTimeMinutes: number;
}

export type ConceptType = 'unified' | 'conceptC' | 'conceptB' | 'conceptA';
export type ViewportDevice = 'mobile' | 'tablet' | 'desktop';
export type MainViewTab = 'prototype' | 'motionSystem' | 'designReview';

export interface UserUiPreferences {
  // Feature Visibility Toggles
  showBeaInsights: boolean;
  showTransitLegs: boolean;
  showInSituBudding: boolean;
  showNeighborhoodGrouping: boolean;
  showLeaveByBuffers: boolean;
  showStopPhotos: boolean;
  showEstimatedStays: boolean;
  showMapFlowAnimation: boolean;

  // Display & Companion
  mascotPresence: 'expressive' | 'calm' | 'minimal';
  layoutDensity: 'comfortable' | 'compact';
  accentTheme: 'terracotta' | 'sage' | 'indigo' | 'warmCharcoal';
}

export const DEFAULT_UI_PREFERENCES: UserUiPreferences = {
  showBeaInsights: true,
  showTransitLegs: true,
  showInSituBudding: true,
  showNeighborhoodGrouping: true,
  showLeaveByBuffers: true,
  showStopPhotos: true,
  showEstimatedStays: true,
  showMapFlowAnimation: true,
  mascotPresence: 'expressive',
  layoutDensity: 'comfortable',
  accentTheme: 'terracotta'
};
