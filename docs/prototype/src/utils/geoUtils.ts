import { DirectionStep, ItineraryItem, LatLng, TransitLeg, TransitMode } from '../types';

/**
 * Calculates great-circle distance between two coordinates in kilometers (Haversine formula)
 */
export function calculateDistanceKm(coord1: LatLng, coord2: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Builds a direct Google Maps directions URL for seamless navigation
 */
export function buildGoogleMapsDirectionsUrl(
  from: ItineraryItem,
  to: ItineraryItem,
  mode: TransitMode = 'walk'
): string {
  const origin = encodeURIComponent(`${from.title}, ${from.address}`);
  const destination = encodeURIComponent(`${to.title}, ${to.address}`);
  const travelmode =
    mode === 'walk'
      ? 'walking'
      : mode === 'transit' || mode === 'ferry' || mode === 'train'
      ? 'transit'
      : 'driving';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelmode}`;
}

/**
 * Generates bespoke, realistic turn-by-turn navigation steps for any two consecutive itinerary items
 */
export function generateTurnByTurnDirections(
  from: ItineraryItem,
  to: ItineraryItem,
  mode: TransitMode,
  distanceKm: number
): DirectionStep[] {
  const fTitle = from.title.toLowerCase();
  const tTitle = to.title.toLowerCase();

  // 1. Peace Memorial Park -> Peace Memorial Museum
  if (fTitle.includes('peace memorial park') && tTitle.includes('museum')) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Exit the Cenotaph plaza and head south along the tree-lined Peace Boulevard promenade.',
        distanceMeters: 120,
        durationMinutes: 1,
        landmark: 'Peace Boulevard (Heiwa-odori)',
        actionIcon: 'straight'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Pass the Peace Flame and Pond of Peace on your right side.',
        distanceMeters: 150,
        durationMinutes: 2,
        landmark: 'Flame of Peace fountain',
        actionIcon: 'straight'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Turn gently left up the paved courtyard ramp toward the glass museum entrance.',
        distanceMeters: 110,
        durationMinutes: 1,
        landmark: 'Museum Courtyard / Audio Desk #4',
        actionIcon: 'turn-left'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: 'Arrive at the Peace Memorial Museum main ticket hall and audio guide pick-up.',
        distanceMeters: 20,
        durationMinutes: 1,
        landmark: 'Museum Main Lobby',
        actionIcon: 'arrive'
      }
    ];
  }

  // 2. Peace Memorial Museum -> Children's Peace Monument
  if (fTitle.includes('museum') && (tTitle.includes('children') || tTitle.includes('cranes'))) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Exit through the Museum East Wing sliding glass doors onto the central lawn.',
        distanceMeters: 80,
        durationMinutes: 1,
        landmark: 'East Wing Courtyard',
        actionIcon: 'straight'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Walk north along the grand stone axial promenade toward the Atomic Bomb Dome.',
        distanceMeters: 160,
        durationMinutes: 2,
        landmark: 'Cenotaph reflection axis',
        actionIcon: 'straight'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Bear slightly right past the Bell of Peace toward the circular monument plaza.',
        distanceMeters: 70,
        durationMinutes: 1,
        landmark: 'Bell of Peace',
        actionIcon: 'turn-right'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: "Arrive at Sadako Sasaki's Children's Peace Monument enclosed by colorful glass crane carousels.",
        distanceMeters: 10,
        durationMinutes: 1,
        landmark: 'Paper Crane Pavilions',
        actionIcon: 'arrive'
      }
    ];
  }

  // 3. Children's Peace Monument -> Motoyasubashi River Pier
  if (
    (fTitle.includes('children') || fTitle.includes('cranes')) &&
    (tTitle.includes('ferry') || tTitle.includes('pier') || tTitle.includes('motoyasu'))
  ) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Step away from the crane carousels and head directly east toward the Motoyasu Riverbank.',
        distanceMeters: 60,
        durationMinutes: 1,
        landmark: 'Riverside Walkway',
        actionIcon: 'straight'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Cross the wide pedestrian plaza immediately adjacent to Motoyasu Bridge (元安橋).',
        distanceMeters: 50,
        durationMinutes: 1,
        landmark: 'Motoyasu-bashi Bridge',
        actionIcon: 'straight'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Take the stone riverside steps down to Aqua Net Catamaran Pier #2 boarding gate.',
        distanceMeters: 40,
        durationMinutes: 1,
        landmark: 'Pier #2 Boarding Pontoon',
        actionIcon: 'board'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: 'Present reservation (FERRY-MOTO-1145) to board the high-speed boat to Miyajima.',
        distanceMeters: 10,
        durationMinutes: 1,
        landmark: 'Aqua Net High-Speed Boat',
        actionIcon: 'arrive'
      }
    ];
  }

  // 4. Ferry -> Kakiya (Miyajima)
  if (fTitle.includes('ferry') || fTitle.includes('pier')) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Board the Aqua Net cruiser for a 45-minute scenic journey along the river into Hiroshima Bay.',
        distanceMeters: 19000,
        durationMinutes: 45,
        landmark: 'Hiroshima Bay Scenic Route',
        actionIcon: 'board'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Disembark at Miyajima Pier #3 and exit through the main seaside welcome concourse.',
        distanceMeters: 80,
        durationMinutes: 1,
        landmark: 'Miyajima Island Terminal',
        actionIcon: 'straight'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Walk southwest past the stone deer monument and enter Omotesando Shopping Arcade.',
        distanceMeters: 180,
        durationMinutes: 2,
        landmark: 'Omotesando Covered Arcade Entrance',
        actionIcon: 'turn-left'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: 'Look for the wooden lattice storefront and cedar barrels of Kakiya on your right.',
        distanceMeters: 90,
        durationMinutes: 1,
        landmark: 'Kakiya Oyster Bar (牡蠣屋)',
        actionIcon: 'arrive'
      }
    ];
  }

  // 5. Kakiya -> Machiya-dori Old Cedar Lane
  if (fTitle.includes('kakiya') && (tTitle.includes('machiya') || tTitle.includes('cedar'))) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Exit Kakiya and turn right into the narrow stone-paved alleyway opposite the shop.',
        distanceMeters: 40,
        durationMinutes: 1,
        landmark: 'Connecting Lantern Alley',
        actionIcon: 'turn-right'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Walk 50 meters uphill through the stone passage away from the busy commercial street.',
        distanceMeters: 50,
        durationMinutes: 1,
        landmark: 'Machiya Historic Threshold',
        actionIcon: 'straight'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Turn left onto Machiya-dori, the tranquil historic street of preserved cedar merchant residences.',
        distanceMeters: 130,
        durationMinutes: 2,
        landmark: 'Machiya-dori Paper Lantern Way',
        actionIcon: 'turn-left'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: 'Arrive at the central cedar lane promenade where tame island deer rest in the shade.',
        distanceMeters: 20,
        durationMinutes: 1,
        landmark: 'Old Timber Merchant Houses',
        actionIcon: 'arrive'
      }
    ];
  }

  // 6. Machiya-dori -> Itsukushima Shrine / Floating Torii
  if (fTitle.includes('machiya') && (tTitle.includes('shrine') || tTitle.includes('torii') || tTitle.includes('itsukushima'))) {
    return [
      {
        id: 's1',
        stepNumber: 1,
        instruction: 'Walk southwest along Machiya-dori toward the base of the five-story pagoda hill.',
        distanceMeters: 110,
        durationMinutes: 2,
        landmark: 'Goju-no-to Pagoda Vista',
        actionIcon: 'straight'
      },
      {
        id: 's2',
        stepNumber: 2,
        instruction: 'Turn left down the stone stairway leading directly out to the Mikasa-hama shoreline.',
        distanceMeters: 90,
        durationMinutes: 1,
        landmark: 'Stone Lantern Shoreline Path',
        actionIcon: 'turn-left'
      },
      {
        id: 's3',
        stepNumber: 3,
        instruction: 'Follow the seaside path past granite stone lanterns facing the Grand Floating Torii Gate.',
        distanceMeters: 160,
        durationMinutes: 2,
        landmark: 'Grand Torii Viewing Beach',
        actionIcon: 'straight'
      },
      {
        id: 's4',
        stepNumber: 4,
        instruction: 'Ascend the entrance bridge into Itsukushima Shrine’s vermilion covered tidal corridors.',
        distanceMeters: 40,
        durationMinutes: 1,
        landmark: 'Shrine East Gate Entrance',
        actionIcon: 'arrive'
      }
    ];
  }

  // Smart Generalizer for other stops / custom activities
  const distanceMeters = Math.round(distanceKm * 1000);
  const legTime = Math.max(2, Math.round(distanceMeters / 75)); // ~4.5 km/h walk

  if (mode === 'ferry') {
    return [
      {
        id: 'gen-1',
        stepNumber: 1,
        instruction: `Exit ${from.title} and head towards the ferry terminal pier concourse.`,
        distanceMeters: 100,
        durationMinutes: 2,
        landmark: `${from.neighborhood || 'Harbor'} Pier Entrance`,
        actionIcon: 'straight'
      },
      {
        id: 'gen-2',
        stepNumber: 2,
        instruction: `Board the ferry / boat crossing toward ${to.neighborhood || to.title}.`,
        distanceMeters: Math.max(1000, distanceMeters - 200),
        durationMinutes: Math.max(15, legTime),
        landmark: 'Waterway Cruise',
        actionIcon: 'board'
      },
      {
        id: 'gen-3',
        stepNumber: 3,
        instruction: `Disembark and follow shoreline walkway towards ${to.title}.`,
        distanceMeters: 120,
        durationMinutes: 2,
        landmark: `${to.title} Shore Approach`,
        actionIcon: 'arrive'
      }
    ];
  }

  if (mode === 'transit' || mode === 'train') {
    return [
      {
        id: 'gen-1',
        stepNumber: 1,
        instruction: `Walk from ${from.title} to the nearest tram / transit stop along the main avenue.`,
        distanceMeters: 150,
        durationMinutes: 2,
        landmark: 'Transit Station Entrance',
        actionIcon: 'straight'
      },
      {
        id: 'gen-2',
        stepNumber: 2,
        instruction: `Board city tram toward ${to.neighborhood || to.title} (${Math.max(5, Math.round(distanceKm * 3))} mins).`,
        distanceMeters: distanceMeters - 250,
        durationMinutes: Math.max(5, Math.round(distanceKm * 3)),
        landmark: 'Local Streetcar Track',
        actionIcon: 'board'
      },
      {
        id: 'gen-3',
        stepNumber: 3,
        instruction: `Disembark and walk 100m to ${to.address}.`,
        distanceMeters: 100,
        durationMinutes: 2,
        landmark: `${to.title} Entrance`,
        actionIcon: 'arrive'
      }
    ];
  }

  // Default: Walking directions with progressive waypoints
  const halfDist = Math.round(distanceMeters / 2);
  return [
    {
      id: 'gen-1',
      stepNumber: 1,
      instruction: `Depart ${from.title} and head along ${from.neighborhood ? `${from.neighborhood} promenade` : 'the pedestrian sidewalk'}.`,
      distanceMeters: Math.round(distanceMeters * 0.3),
      durationMinutes: Math.max(1, Math.round(legTime * 0.3)),
      landmark: `${from.title} Departure Gate`,
      actionIcon: 'straight'
    },
    {
      id: 'gen-2',
      stepNumber: 2,
      instruction: `Follow pedestrian signage past local shops toward ${to.neighborhood || 'central district'}.`,
      distanceMeters: Math.round(distanceMeters * 0.4),
      durationMinutes: Math.max(1, Math.round(legTime * 0.4)),
      landmark: 'Pedestrian Crossing Waypoint',
      actionIcon: 'turn-right'
    },
    {
      id: 'gen-3',
      stepNumber: 3,
      instruction: `Continue along the walkway and look for the entrance of ${to.title} at ${to.address}.`,
      distanceMeters: Math.round(distanceMeters * 0.3),
      durationMinutes: Math.max(1, Math.round(legTime * 0.3)),
      landmark: `${to.title} Entrance`,
      actionIcon: 'arrive'
    }
  ];
}

/**
 * Derives realistic transit mode, duration, instructions, and turn-by-turn steps
 */
export function deriveTransitLeg(from: ItineraryItem, to: ItineraryItem): TransitLeg {
  const distance = calculateDistanceKm(from.coordinates, to.coordinates);
  
  // Check if crossing to/from Miyajima island (lat ~ 34.29-34.30, lng ~ 132.32)
  const isFromMiyajima = from.title.toLowerCase().includes('miyajima') || from.address.toLowerCase().includes('miyajima');
  const isToMiyajima = to.title.toLowerCase().includes('miyajima') || to.address.toLowerCase().includes('miyajima') || to.title.toLowerCase().includes('kakiya') || to.title.toLowerCase().includes('torii');
  
  const isWaterTransit = (isFromMiyajima !== isToMiyajima) && distance > 5;

  let mode: TransitMode = 'drive';
  let durationMinutes = 15;
  let instructions = 'Drive via local roads';

  if (isWaterTransit) {
    mode = 'ferry';
    durationMinutes = 45;
    instructions = 'Scenic high-speed river shuttle / ferry cruise across Hiroshima Bay';
  } else if (distance <= 1.2) {
    mode = 'walk';
    // Walking average ~4.5 km/h -> ~13 mins per km
    durationMinutes = Math.max(3, Math.round(distance * 13));
    instructions = `Pleasant ${Math.round(distance * 1000)}m pedestrian walk`;
  } else if (distance <= 4.0) {
    mode = 'transit';
    durationMinutes = Math.max(10, Math.round(distance * 5 + 4));
    instructions = 'Local tram line / streetcar';
  } else {
    mode = 'drive';
    // Driving average in city with traffic ~30 km/h -> 2 mins per km + buffer
    durationMinutes = Math.max(12, Math.round(distance * 2.2 + 5));
    instructions = `City transit or taxi ride (${distance} km)`;
  }

  const steps = generateTurnByTurnDirections(from, to, mode, distance);
  const googleMapsUrl = buildGoogleMapsDirectionsUrl(from, to, mode);

  return {
    id: `leg-${from.id}-${to.id}`,
    fromId: from.id,
    toId: to.id,
    mode,
    distanceKm: distance,
    durationMinutes,
    instructions,
    steps,
    googleMapsUrl
  };
}

/**
 * Calculates total route metrics (total distance in km, total transit time in mins)
 */
export function calculateRouteStats(items: ItineraryItem[]): {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: TransitLeg[];
} {
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  const legs: TransitLeg[] = [];

  for (let i = 0; i < items.length - 1; i++) {
    const leg = deriveTransitLeg(items[i], items[i + 1]);
    legs.push(leg);
    totalDistanceKm += leg.distanceKm;
    totalDurationMinutes += leg.durationMinutes;
  }

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes,
    legs
  };
}

/**
 * Automatically adjusts sequential timestamps based on durations and transit
 */
export function recalculateItemTimes(items: ItineraryItem[], startTime = '08:30'): ItineraryItem[] {
  if (items.length === 0) return items;

  let [currentHour, currentMin] = startTime.split(':').map(Number);

  return items.map((item, index) => {
    const formattedHour = String(currentHour).padStart(2, '0');
    const formattedMin = String(currentMin).padStart(2, '0');
    const timeStr = `${formattedHour}:${formattedMin}`;

    // Add estimated stay
    const stay = item.estimatedStayMinutes || 45;
    let nextTotalMinutes = currentHour * 60 + currentMin + stay;

    // Add transit to next stop if not last
    if (index < items.length - 1) {
      const leg = deriveTransitLeg(item, items[index + 1]);
      nextTotalMinutes += leg.durationMinutes;
    }

    currentHour = Math.floor(nextTotalMinutes / 60) % 24;
    currentMin = nextTotalMinutes % 60;

    return {
      ...item,
      order: index + 1,
      time: timeStr
    };
  });
}

/**
 * Smart Route Optimizer (Nearest Neighbor TSP)
 * Keeps first stop (usually airport/station/hotel) and reorders subsequent stops to minimize total travel distance
 */
export function optimizeRouteOrder(items: ItineraryItem[]): {
  optimizedItems: ItineraryItem[];
  distanceSavedKm: number;
  timeSavedMinutes: number;
} {
  if (items.length <= 2) {
    return {
      optimizedItems: items,
      distanceSavedKm: 0,
      timeSavedMinutes: 0
    };
  }

  const originalStats = calculateRouteStats(items);
  const remaining = [...items];
  const optimized: ItineraryItem[] = [remaining.shift()!]; // Keep start point

  while (remaining.length > 0) {
    const lastItem = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistanceKm(lastItem.coordinates, remaining[i].coordinates);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }

    optimized.push(remaining.splice(nearestIndex, 1)[0]);
  }

  // Recalculate times for optimized list
  const resequenced = recalculateItemTimes(optimized, items[0].time || '08:30');
  const optimizedStats = calculateRouteStats(resequenced);

  const distanceSavedKm = Math.max(0, Math.round((originalStats.totalDistanceKm - optimizedStats.totalDistanceKm) * 10) / 10);
  const timeSavedMinutes = Math.max(0, originalStats.totalDurationMinutes - optimizedStats.totalDurationMinutes);

  return {
    optimizedItems: resequenced,
    distanceSavedKm,
    timeSavedMinutes
  };
}

/**
 * Shifts a HH:mm timestamp string by deltaMinutes (+ or -)
 */
export function shiftTimeString(timeStr: string, deltaMinutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  let totalMins = h * 60 + m + deltaMinutes;
  // keep within 24h
  while (totalMins < 0) totalMins += 24 * 60;
  totalMins = totalMins % (24 * 60);
  const newH = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const newM = String(totalMins % 60).padStart(2, '0');
  return `${newH}:${newM}`;
}

/**
 * Cascades time shifts forward: pushes subsequent stops forward or backward by deltaMinutes
 */
export function cascadeItemTimes(
  items: ItineraryItem[],
  fromItemId: string,
  deltaMinutes: number
): ItineraryItem[] {
  let cascadeActive = false;
  return items.map((item) => {
    if (item.id === fromItemId) {
      cascadeActive = true;
      return item;
    }
    if (cascadeActive) {
      return {
        ...item,
        time: shiftTimeString(item.time, deltaMinutes)
      };
    }
    return item;
  });
}
