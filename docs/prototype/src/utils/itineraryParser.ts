import { ItineraryItem, ItemCategory } from '../types';

// City center coordinate fallbacks if geocoder has not resolved yet
const CITY_ANCHORS: Record<string, { lat: number; lng: number }> = {
  tokyo: { lat: 35.6762, lng: 139.6503 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  hiroshima: { lat: 34.3976, lng: 132.4753 },
  miyajima: { lat: 34.2965, lng: 132.3197 },
  paris: { lat: 48.8566, lng: 2.3522 },
  rome: { lat: 41.9028, lng: 12.4964 },
  london: { lat: 51.5074, lng: -0.1278 },
  newyork: { lat: 40.7128, lng: -74.0060 },
  losangeles: { lat: 34.0522, lng: -118.2437 },
};

function detectCategory(text: string): ItemCategory {
  const lower = text.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('food') || lower.includes('eat') || lower.includes('restaurant') || lower.includes('bar') || lower.includes('ramen') || lower.includes('sushi') || lower.includes('oyster')) {
    return 'food';
  }
  if (lower.includes('museum') || lower.includes('memorial') || lower.includes('temple') || lower.includes('shrine') || lower.includes('castle') || lower.includes('palace') || lower.includes('art') || lower.includes('gallery') || lower.includes('history')) {
    return 'culture';
  }
  if (lower.includes('hotel') || lower.includes('check-in') || lower.includes('ryokan') || lower.includes('hostel') || lower.includes('airbnb') || lower.includes('resort')) {
    return 'hotel';
  }
  if (lower.includes('station') || lower.includes('train') || lower.includes('shinkansen') || lower.includes('airport') || lower.includes('flight') || lower.includes('ferry') || lower.includes('boat') || lower.includes('subway') || lower.includes('bus') || lower.includes('tram')) {
    return 'transport';
  }
  if (lower.includes('walk') || lower.includes('stroll') || lower.includes('park') || lower.includes('garden') || lower.includes('shop') || lower.includes('market') || lower.includes('beach') || lower.includes('spa') || lower.includes('onsen')) {
    return 'leisure';
  }
  return 'attraction';
}

function extractTime(line: string): string | null {
  // Matches "09:30", "9:30 AM", "14:00", "9am", "10:00 - 11:30"
  const timeRegex = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])\s*(am|pm)?\b/i;
  const match = line.match(timeRegex);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // Matches "9 AM" or "3pm"
  const shortTimeRegex = /\b([1-9]|1[0-2])\s*(am|pm)\b/i;
  const shortMatch = line.match(shortTimeRegex);
  if (shortMatch) {
    let hour = parseInt(shortMatch[1], 10);
    const meridiem = shortMatch[2].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  return null;
}

/**
 * Intelligent parser that converts raw AI chat outputs, blog itineraries, or bulleted lists into structured ItineraryItems
 */
export function parsePastedItinerary(
  rawText: string,
  baseCoords: { lat: number; lng: number } = { lat: 34.3976, lng: 132.4753 },
  destination = ''
): Omit<ItineraryItem, 'id' | 'order'>[] {
  // Normalize destination anchor if recognized
  const destClean = destination.toLowerCase().replace(/[^a-z]/g, '');
  const matchedAnchor = Object.entries(CITY_ANCHORS).find(([k]) => destClean.includes(k))?.[1] || baseCoords;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsedItems: Omit<ItineraryItem, 'id' | 'order'>[] = [];
  let fallbackHour = 9;
  let fallbackMinute = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Filter out generic headers like "Day 1:", "Morning:", "Here is your itinerary:"
    if (/^(day\s*\d+|here\s*is|itinerary|overview|afternoon|morning|evening|night)\b/i.test(rawLine) && rawLine.length < 30 && !rawLine.includes(' - ') && !rawLine.includes(': ')) {
      continue;
    }

    // Clean bullet symbols, dashes, numbers: "1. ", "- ", "* ", "• "
    let cleanLine = rawLine
      .replace(/^[\d]+[.)]\s*/, '')
      .replace(/^[-*•–—]\s*/, '')
      .replace(/^\[[ xX]\]\s*/, '')
      .trim();

    if (cleanLine.length < 3) continue;

    // Detect time if present
    const detectedTime = extractTime(cleanLine);
    let itemTime = detectedTime;

    if (!itemTime) {
      itemTime = `${String(fallbackHour).padStart(2, '0')}:${String(fallbackMinute).padStart(2, '0')}`;
      fallbackMinute += 45;
      if (fallbackMinute >= 60) {
        fallbackHour = (fallbackHour + Math.floor(fallbackMinute / 60)) % 24;
        fallbackMinute %= 60;
      }
    }

    // Strip time prefixes from the title string (e.g. "09:00 AM - Sensoji Temple" -> "Sensoji Temple")
    cleanLine = cleanLine
      .replace(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\s*(am|pm)?\b/gi, '')
      .replace(/\b([1-9]|1[0-2])\s*(am|pm)\b/gi, '')
      .replace(/^[-–—:\s]+/, '')
      .trim();

    // Check for "Title: Description" or "Title - Notes"
    let title = cleanLine;
    let subtitle = '';
    let notes = '';

    if (cleanLine.includes(' - ')) {
      const parts = cleanLine.split(' - ');
      title = parts[0].trim();
      subtitle = parts.slice(1).join(' - ').trim();
    } else if (cleanLine.includes(': ')) {
      const parts = cleanLine.split(': ');
      title = parts[0].trim();
      subtitle = parts.slice(1).join(': ').trim();
    } else if (cleanLine.includes('(') && cleanLine.endsWith(')')) {
      const match = cleanLine.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        title = match[1].trim();
        notes = match[2].trim();
      }
    }

    // Trim markdown bolding: **Title** -> Title
    title = title.replace(/\*\*/g, '').replace(/\*/g, '').trim();
    subtitle = subtitle.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    if (!title) continue;

    const category = detectCategory(`${title} ${subtitle} ${notes}`);

    // Generate slight geographic spread around the anchor coordinate so stops fan out across city center
    // ~1-3km spread
    const angle = (parsedItems.length * 0.9) + (Math.random() * 0.4);
    const radius = 0.008 + (parsedItems.length * 0.005);
    const latOffset = Math.sin(angle) * radius;
    const lngOffset = Math.cos(angle) * radius;

    parsedItems.push({
      title,
      subtitle: subtitle || 'Curated stop',
      category,
      time: itemTime,
      address: `${title}, Central Area`,
      notes: notes || (subtitle ? `Tip: ${subtitle}` : 'Added from AI import'),
      estimatedStayMinutes: category === 'food' ? 60 : category === 'hotel' ? 30 : 50,
      isBooked: category === 'hotel' || category === 'transport',
      coordinates: {
        lat: Math.round((matchedAnchor.lat + latOffset) * 10000) / 10000,
        lng: Math.round((matchedAnchor.lng + lngOffset) * 10000) / 10000,
      }
    });
  }

  return parsedItems;
}
