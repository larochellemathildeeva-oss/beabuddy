import { ItineraryItem, TransitLeg } from '../types';
import { deriveTransitLeg } from './geoUtils';

export interface StreetGuidanceStep {
  stepNumber: number;
  instruction: string;
  landmarkCue: string;
  distanceMeters: number;
}

export interface TravelerSituationalState {
  // 1. Where am I right now?
  currentStop: ItineraryItem;
  currentIndex: number;
  totalStops: number;
  japaneseAddress: string;
  streetCornerName: string;
  landmarkClues: string;
  arrivedTime: string;

  // 2. What comes next?
  nextStop: ItineraryItem | null;
  nextTargetTime: string;
  isNextCriticalOrBooked: boolean;
  nextStopBookingBadge?: string;

  // 4. How do I get there?
  transitLegToNext: TransitLeg | null;
  walkingMinutesToNext: number;
  distanceKmToNext: number;
  navigationUrl: string;
  streetSteps: StreetGuidanceStep[];
  primaryTransitMode: string;
}

// Localized Hiroshima street knowledge & landmarks
const HIROSHIMA_STREET_CONTEXTS: Record<string, { corner: string; clues: string; jp: string; steps: StreetGuidanceStep[] }> = {
  'stop-1': {
    corner: 'Hiroshima Station South Exit · Matsubaracho',
    clues: 'Tram stop #1, #2, #6 directly across from the Shinkansen concourse',
    jp: '広島駅 南口 (松原町)',
    steps: [
      { stepNumber: 1, instruction: 'Exit Hiroshima Station via South Exit gates', landmarkCue: 'Follow signs for Hiroshima Dentetsu (Hiroden) Streetcar', distanceMeters: 80 },
      { stepNumber: 2, instruction: 'Board Tram Line #2 or #6 towards Genbaku-Dome-mae', landmarkCue: 'Platform 2 (Green & White trams)', distanceMeters: 40 },
      { stepNumber: 3, instruction: 'Ride 14 mins across Kyobashi & Enko rivers', landmarkCue: 'Disembark at Genbaku-Dome-mae or Chuden-mae', distanceMeters: 2800 }
    ]
  },
  'stop-2': {
    corner: 'Peace Memorial Park South Gate · Heiwa Odori & Nakajimacho',
    clues: 'Directly facing the Flame of Peace and Cenotaph archway looking north',
    jp: '広島平和記念資料館 (中島町1-2)',
    steps: [
      { stepNumber: 1, instruction: 'Exit museum north doors toward the Peace Fountain', landmarkCue: 'Paved tree-lined promenade with stone lanterns', distanceMeters: 120 },
      { stepNumber: 2, instruction: 'Walk 350m straight north past the Memorial Cenotaph', landmarkCue: 'Look for the Atomic Bomb Dome rising across the river', distanceMeters: 350 },
      { stepNumber: 3, instruction: 'Cross Motoyasubashi Bridge to the riverbank', landmarkCue: 'Arrive at the base of the Genbaku Dome', distanceMeters: 180 }
    ]
  },
  'stop-3': {
    corner: 'Aioi Bridge & Motoyasu Riverbank · Otemachi 1-chome',
    clues: 'Iconic dome ruins directly adjacent to Motoyasubashi riverside promenade',
    jp: '原爆ドーム · 平和記念公園北 (大手町1-10)',
    steps: [
      { stepNumber: 1, instruction: 'Head east along Aioi-dori toward Hondori shopping arcade', landmarkCue: 'Follow Hiroden tram tracks eastbound', distanceMeters: 300 },
      { stepNumber: 2, instruction: 'Turn south at the Hondori covered entrance', landmarkCue: 'Large glass arcade canopy with banners', distanceMeters: 150 },
      { stepNumber: 3, instruction: 'Nagata-ya is located at the corner near Peace Park exit', landmarkCue: 'Noren curtain with okonomiyaki lantern', distanceMeters: 100 }
    ]
  },
  'stop-4': {
    corner: 'Hondori Covered Arcade & Otemachi Corner',
    clues: 'Near Motoyasu Bridge west entrance of Hondori pedestrian shopping arcade',
    jp: 'お好み焼 長田屋 (大手町1-7-19)',
    steps: [
      { stepNumber: 1, instruction: 'Walk 200m north back to Genbaku-Dome-mae tram stop', landmarkCue: 'Cross Aioi-dori at the main crosswalk', distanceMeters: 200 },
      { stepNumber: 2, instruction: 'Board Hiroden Line #2 tram bound for Hiroden-miyajima-guchi', landmarkCue: 'Red & white articulated streetcars', distanceMeters: 50 },
      { stepNumber: 3, instruction: 'Ride scenic line through western Hiroshima bay (approx 50 mins)', landmarkCue: 'Terminus is Miyajimaguchi Pier station', distanceMeters: 18500 }
    ]
  },
  'stop-5': {
    corner: 'Miyajimaguchi Ferry Terminal Pier · Hatsukaichi',
    clues: 'JR West & Matsudai Ferry boarding gates with clear signs for Miyajima Island',
    jp: '宮島口フェリー乗り場 (廿日市市宮島口)',
    steps: [
      { stepNumber: 1, instruction: 'Walk through ferry terminal turnstiles (IC cards / JR pass accepted)', landmarkCue: 'Follow passenger gangway to boarding ramp', distanceMeters: 50 },
      { stepNumber: 2, instruction: 'Board JR West Ferry on the upper starboard deck', landmarkCue: 'Starboard side offers direct view of floating Torii gate on approach', distanceMeters: 30 },
      { stepNumber: 3, instruction: '10-minute crossing across Seto Inland Sea to Miyajima Pier', landmarkCue: 'Disembark at Miyajima Port passenger terminal', distanceMeters: 2000 }
    ]
  },
  'stop-6': {
    corner: 'Miyajima Omotesando Shopping Street · Machiya Way',
    clues: 'Scent of woodfire grilled oysters, momiji manju bakeries, and wild deer along street',
    jp: '表参道商店街 · 牡蠣屋 (宮島町539)',
    steps: [
      { stepNumber: 1, instruction: 'Follow Omotesando street toward the coastal pine forest path', landmarkCue: 'Stone lanterns lining the shoreline', distanceMeters: 250 },
      { stepNumber: 2, instruction: 'Walk through the large stone Torii entrance of Itsukushima', landmarkCue: 'Red lacquered wooden bridges and prayer hall', distanceMeters: 150 },
      { stepNumber: 3, instruction: 'Descend to the sandy tidal flats at low tide or shrine deck at high tide', landmarkCue: 'Direct waterfront view of the Grand Vermilion Gate', distanceMeters: 100 }
    ]
  },
  'stop-7': {
    corner: 'Itsukushima Shrine Waterfront Boardwalk · Miyajima Cove',
    clues: 'Overlooking the iconic Vermilion O-Torii Gate standing in the sea',
    jp: '厳島神社 大鳥居 (宮島町1-1)',
    steps: [
      { stepNumber: 1, instruction: 'Follow stone lantern path northeast back to Miyajima Pier', landmarkCue: 'Retrace coastal walkway along the deer park', distanceMeters: 800 },
      { stepNumber: 2, instruction: 'Board return ferry back to Miyajimaguchi Station', landmarkCue: 'Ferries depart every 15 mins until 22:00', distanceMeters: 2000 },
      { stepNumber: 3, instruction: 'Take JR Sanyo Main Line train 28 mins back to Hiroshima Station', landmarkCue: 'Platform 1 eastbound trains', distanceMeters: 21000 }
    ]
  },
  'stop-8': {
    corner: 'Ekie Dining Concourse 1F · Hiroshima Station North Shinkansen Gate',
    clues: 'Ekie gourmet street featuring Hiroshima lemon ramen, craft beer, and sake bars',
    jp: 'ekie 広島駅 飲食フロア (松原町1-2)',
    steps: [
      { stepNumber: 1, instruction: 'Walk to Shinkansen ticket gates or south city bus terminal', landmarkCue: 'Central Information counter and luggage storage', distanceMeters: 50 }
    ]
  }
};

/**
 * Computes traveler situational awareness state for the 3 questions:
 * 1. Where am I right now?
 * 2. What comes next?
 * 4. How do I get there?
 */
export function computeTravelerSituationalState(
  items: ItineraryItem[],
  activeItemId: string | null
): TravelerSituationalState {
  if (!items || items.length === 0) {
    const fallbackItem: ItineraryItem = {
      id: 'fallback-item',
      title: 'Hiroshima Peace Memorial Park',
      subtitle: 'Historic park dedicated to the legacy of peace',
      time: '09:00',
      order: 1,
      category: 'attraction',
      address: 'Nakajimacho, Naka Ward, Hiroshima',
      coordinates: { lat: 34.3928, lng: 132.4526 }
    };
    return {
      currentStop: fallbackItem,
      currentIndex: 0,
      totalStops: 1,
      japaneseAddress: '広島平和記念公園',
      streetCornerName: 'Heiwa Odori & Motoyasubashi',
      landmarkClues: 'Facing the Peace Cenotaph arch looking north',
      arrivedTime: '09:00',
      nextStop: null,
      nextTargetTime: 'End of Day',
      isNextCriticalOrBooked: false,
      transitLegToNext: null,
      walkingMinutesToNext: 0,
      distanceKmToNext: 0,
      navigationUrl: 'https://maps.google.com',
      streetSteps: [],
      primaryTransitMode: 'walk'
    };
  }

  // Determine active index
  let currentIndex = items.findIndex((it) => it.id === activeItemId);
  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const currentStop = items[currentIndex] || items[0];
  const nextStop = currentIndex + 1 < items.length ? items[currentIndex + 1] : null;

  // Transit to next stop
  const transitLeg = currentStop && nextStop ? deriveTransitLeg(currentStop, nextStop) : null;
  const transitMins = transitLeg?.durationMinutes || 10;
  const distanceKm = transitLeg?.distanceKm || 0.5;

  // Google Maps Universal Deep Link
  const originCoord = `${currentStop.coordinates.lat},${currentStop.coordinates.lng}`;
  const destCoord = nextStop
    ? `${nextStop.coordinates.lat},${nextStop.coordinates.lng}`
    : originCoord;
  const navMode = transitLeg?.mode === 'walk' ? 'walking' : 'transit';
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destCoord}&travelmode=${navMode}`;

  // Hiroshima Street Contexts lookup
  const localContext = HIROSHIMA_STREET_CONTEXTS[currentStop.id] || {
    corner: currentStop.address,
    clues: currentStop.subtitle || 'Central walkway near landmark entrance',
    jp: currentStop.title,
    steps: [
      {
        stepNumber: 1,
        instruction: `Depart ${currentStop.title} heading toward ${nextStop?.title || 'next stop'}`,
        landmarkCue: 'Follow pedestrian signs along main avenue',
        distanceMeters: Math.round(distanceKm * 1000)
      }
    ]
  };

  return {
    currentStop,
    currentIndex,
    totalStops: items.length,
    japaneseAddress: localContext.jp,
    streetCornerName: localContext.corner,
    landmarkClues: localContext.clues,
    arrivedTime: currentStop.time,

    nextStop,
    nextTargetTime: nextStop ? nextStop.time : 'End of day',
    isNextCriticalOrBooked: !!(nextStop?.isBooked || nextStop?.category === 'transport'),
    nextStopBookingBadge: nextStop?.ticketInfo || (nextStop?.isBooked ? 'Confirmed Booking' : undefined),

    transitLegToNext: transitLeg,
    walkingMinutesToNext: transitMins,
    distanceKmToNext: distanceKm,
    navigationUrl,
    streetSteps: localContext.steps,
    primaryTransitMode: transitLeg?.mode || 'walk'
  };
}
