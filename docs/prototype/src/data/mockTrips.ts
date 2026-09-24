import { DayItinerary, PlanOption, SavedPlace } from '../types';
import { functionsdescription, FUNCTIONS_DOCUMENTATION } from './functionsDescription';

export { functionsdescription, FUNCTIONS_DOCUMENTATION };

export const INITIAL_DAYS: DayItinerary[] = [
  {
    dayNumber: 1,
    dateString: 'Wed, Oct 7',
    title: 'Peace Park & Sacred Miyajima Island',
    beaDailyInsight: "The ferry at 11:45 is the only thing I'd be careful not to miss. Everything in the morning is a peaceful walk.",
    items: [
      {
        id: 'stop-1',
        order: 1,
        time: '08:45',
        title: 'Hiroshima Peace Memorial Park',
        subtitle: 'Cenotaph & Atomic Bomb Dome riverside promenade',
        address: '1-2 Nakajimacho, Naka Ward, Hiroshima',
        neighborhood: 'Peace Park District',
        category: 'attraction',
        coordinates: { lat: 34.3955, lng: 132.4536 },
        notes: 'Quiet early morning atmosphere. Walk across Motoyasu bridge to hear the Peace Bell.',
        estimatedStayMinutes: 40,
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1578637387939-43c525550085?auto=format&fit=crop&w=800&q=80',
        localTip: 'Ring the Peace Bell gently with both hands; early mornings offer complete, reverent calm.'
      },
      {
        id: 'stop-2',
        order: 2,
        time: '09:30',
        title: 'Peace Memorial Museum',
        subtitle: 'Permanent Exhibition · English audio guide #4',
        address: '1-2 Nakajimacho, Naka Ward, Hiroshima',
        neighborhood: 'Peace Park District',
        category: 'culture',
        coordinates: { lat: 34.3917, lng: 132.4526 },
        isBooked: true,
        ticketInfo: 'Entry Confirmed (#JP-8841)',
        bookingCode: 'AIRBNB-EXP-8841',
        notes: 'Reserved morning entry. Respectful silence observed in the gallery.',
        estimatedStayMinutes: 75,
        cost: '¥200',
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
        localTip: 'Head straight to audio guide desk #4 right after check-in for the complete quiet walk.'
      },
      {
        id: 'stop-3',
        order: 3,
        time: '11:00',
        title: "Children's Peace Monument & Paper Cranes",
        subtitle: 'Memorial to Sadako Sasaki with international crane carousels',
        address: '1 Nakajimacho, Naka Ward, Hiroshima',
        neighborhood: 'Peace Park District',
        category: 'culture',
        coordinates: { lat: 34.3938, lng: 132.4531 },
        notes: 'Millions of folded paper cranes from children around the globe.',
        estimatedStayMinutes: 25,
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80',
        localTip: 'Take a moment at the glass carousels to read messages from schoolchildren across 80+ nations.'
      },
      {
        id: 'stop-4',
        order: 4,
        time: '11:45',
        title: 'Motoyasubashi River Pier Ferry',
        subtitle: 'Aqua Net High-Speed Boat to Miyajima Island',
        address: '1-1 Nakajimacho (Riverside)',
        neighborhood: 'Peace Park Pier',
        category: 'transport',
        coordinates: { lat: 34.3934, lng: 132.4538 },
        isBooked: true,
        ticketInfo: 'Boarding Pass #B-14 · Pier 2',
        bookingCode: 'FERRY-MOTO-1145',
        notes: 'Scenic 45-minute river-to-bay cruise directly to Miyajima shrine pier.',
        estimatedStayMinutes: 45,
        cost: '¥2,200',
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        localTip: 'Bypasses train & tram transfers completely; sit on the upper or right side for Atomic Dome river views.'
      },
      {
        id: 'stop-5',
        order: 5,
        time: '13:00',
        title: 'Lunch at Kakiya (牡蠣屋)',
        subtitle: 'Charcoal-grilled Hiroshima oysters & lemon draft beer',
        address: '539 Miyajimacho, Hatsukaichi, Hiroshima',
        neighborhood: 'Miyajima Omotesando',
        category: 'food',
        coordinates: { lat: 34.2982, lng: 132.3204 },
        notes: 'Counter seating fills up by 13:15. Order the oyster gratin and tasting flight.',
        estimatedStayMinutes: 50,
        cost: '¥3,200',
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
        localTip: 'Pair the grilled oyster set with Setouchi craft lemon beer — crisp, unpasteurized, and brewed on-island.'
      },
      {
        id: 'stop-6',
        order: 6,
        time: '14:15',
        title: 'Machiya-dori Old Cedar Lane',
        subtitle: 'Preserved Edo-period timber merchant houses & paper lanterns',
        address: 'Takimachi, Miyajima',
        neighborhood: 'Miyajima Historic',
        category: 'leisure',
        coordinates: { lat: 34.2968, lng: 132.3215 },
        notes: 'Peaceful alternative to the shopping arcade. Friendly wild deer rest in the shade.',
        estimatedStayMinutes: 45,
        rating: 4.7,
        imageUrl: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=800&q=80',
        localTip: 'Vastly quieter than the front arcade; gentle tame deer often snooze under cedar eaves here.'
      },
      {
        id: 'stop-7',
        order: 7,
        time: '15:30',
        title: 'Itsukushima Shrine & Floating Torii Gate',
        subtitle: 'UNESCO Shinto shrine built over the tidal lagoon',
        address: '1-1 Miyajimacho, Hatsukaichi',
        neighborhood: 'Itsukushima Sanctuary',
        category: 'attraction',
        coordinates: { lat: 34.2958, lng: 132.3198 },
        notes: 'Low tide reaches peak at 16:15; you can walk right out on the sand to the vermilion gate.',
        estimatedStayMinutes: 70,
        cost: '¥300',
        rating: 5.0,
        imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
        localTip: 'Step directly onto the sandbar at 16:00 to touch the 500-year-old camphor tree trunks at the base of the gate.'
      },
      {
        id: 'stop-8',
        order: 8,
        time: '17:15',
        title: 'Sunset Ferry back to Hiroshima',
        subtitle: 'JR Miyajima Ferry to Miyajimaguchi Station',
        address: 'Miyajima Port Pier 1',
        neighborhood: 'Miyajima Harbor',
        category: 'transport',
        coordinates: { lat: 34.3005, lng: 132.3217 },
        notes: 'Departs every 15 minutes. Best sunset views from the upper right deck.',
        estimatedStayMinutes: 20,
        cost: '¥200',
        rating: 4.6
      }
    ]
  },
  {
    dayNumber: 2,
    dateString: 'Thu, Oct 8',
    title: 'Historic Castle, Strolling Gardens & Okonomiyaki',
    beaDailyInsight: 'Everything before lunch is walkable. Take your time in the tea house at Shukkeien Garden.',
    items: [
      {
        id: 'stop-2-1',
        order: 1,
        time: '09:00',
        title: 'Hiroshima Castle & Carp Tower',
        subtitle: '16th-century fortress, moat gardens & samurai arms gallery',
        address: '21-1 Motomachi, Naka Ward, Hiroshima',
        neighborhood: 'Castle Grounds',
        category: 'attraction',
        coordinates: { lat: 34.4027, lng: 132.4593 },
        notes: 'Panoramic top-floor view across the surrounding stone moats and pines.',
        estimatedStayMinutes: 60,
        cost: '¥370',
        rating: 4.7
      },
      {
        id: 'stop-2-2',
        order: 2,
        time: '10:30',
        title: 'Shukkeien Traditional Strolling Garden',
        subtitle: 'Miniature lake, stone moon bridges & weeping bamboo grove',
        address: '2-11 Kaminoboricho, Naka Ward, Hiroshima',
        neighborhood: 'Kaminoboricho',
        category: 'culture',
        coordinates: { lat: 34.4005, lng: 132.4674 },
        notes: 'Order fresh whisked matcha and seasonal wagashi sweet at the lakeside pavilion.',
        estimatedStayMinutes: 75,
        cost: '¥260',
        rating: 4.9
      },
      {
        id: 'stop-2-3',
        order: 3,
        time: '12:30',
        title: 'Okonomimura (Okonomiyaki Village)',
        subtitle: 'Four floors of sizzling teppan counters & yakisoba crepe layering',
        address: '5-13 Shintentechi, Naka Ward, Hiroshima',
        neighborhood: 'Shintentechi Food Hub',
        category: 'food',
        coordinates: { lat: 34.3913, lng: 132.4623 },
        notes: 'Take the elevator to 2nd floor to Sarashina stall. Pork, cabbage, squid & egg special.',
        estimatedStayMinutes: 60,
        cost: '¥1,300',
        rating: 4.8
      },
      {
        id: 'stop-2-4',
        order: 4,
        time: '14:30',
        title: 'Orizuru Tower Observatory & Paper Crane Drop',
        subtitle: 'Open-air cedar deck overlooking the Peace Dome & origami glass wall',
        address: '1-2-1 Otemachi, Naka Ward, Hiroshima',
        neighborhood: 'Peace Park District',
        category: 'leisure',
        coordinates: { lat: 34.3958, lng: 132.4542 },
        notes: 'Fold your own origami paper crane and slide it down the transparent glass tower facade.',
        estimatedStayMinutes: 60,
        cost: '¥2,200',
        rating: 4.6
      },
      {
        id: 'stop-2-5',
        order: 5,
        time: '17:30',
        title: 'Nagarekawa Lantern-Lit Alleys & Craft Sake',
        subtitle: 'Evening izakayas, local Saijo junmai ginjo sake & tempura',
        address: 'Nagarekawa-cho, Naka Ward, Hiroshima',
        neighborhood: 'Nagarekawa',
        category: 'food',
        coordinates: { lat: 34.3905, lng: 132.4645 },
        notes: 'Cozy counter bars with English chalkboard menus. Try the seasonal fish sashimi plate.',
        estimatedStayMinutes: 90,
        rating: 4.8
      }
    ]
  },
  {
    dayNumber: 3,
    dateString: 'Fri, Oct 9',
    title: 'Mount Misen Summit & Forest Temples',
    beaDailyInsight: 'You have plenty of time this afternoon. The ropeway up Mount Misen has clear visibility today.',
    items: [
      {
        id: 'stop-3-1',
        order: 1,
        time: '09:30',
        title: 'Mitaki-dera Mountain Temple & Cedar Glen',
        subtitle: 'Hidden hillside monastery with mossy Jizo statues & waterfalls',
        address: '411 Mitakiyama, Nishi Ward, Hiroshima',
        neighborhood: 'Mount Mitaki',
        category: 'culture',
        coordinates: { lat: 34.4225, lng: 132.4312 },
        notes: 'Serene bamboo forest path away from all tourist crowds. Red pagoda amid maples.',
        estimatedStayMinutes: 80,
        rating: 4.9
      },
      {
        id: 'stop-3-2',
        order: 2,
        time: '11:45',
        title: 'Miyajima Ropeway to Mount Misen',
        subtitle: 'Two-stage scenic cable car ascending through virgin primeval forest',
        address: 'Momijidani Park, Miyajima',
        neighborhood: 'Mount Misen',
        category: 'attraction',
        coordinates: { lat: 34.2885, lng: 132.3245 },
        isBooked: true,
        ticketInfo: 'Roundtrip Ticket #RP-402',
        bookingCode: 'ROPEWAY-MISEN-402',
        notes: 'Panoramic 360-degree vistas across Seto Inland Sea islands.',
        estimatedStayMinutes: 90,
        cost: '¥2,000',
        rating: 4.9
      },
      {
        id: 'stop-3-3',
        order: 3,
        time: '14:00',
        title: 'Reikado Hall & The Eternal Flame',
        subtitle: 'Sacred fire burning continuously for over 1,200 years since Kobo Daishi',
        address: 'Mount Misen Summit Path',
        neighborhood: 'Mount Misen',
        category: 'culture',
        coordinates: { lat: 34.2795, lng: 132.3195 },
        notes: 'The sacred flame used to light the Peace Flame in Hiroshima Peace Memorial Park.',
        estimatedStayMinutes: 45,
        rating: 4.8
      },
      {
        id: 'stop-3-4',
        order: 4,
        time: '16:00',
        title: 'Momijidani Teahouse & Fresh Momiji Manju',
        subtitle: 'Warm maple leaf-shaped cakes with roasted green tea',
        address: 'Momijidani Park, Miyajima',
        neighborhood: 'Momijidani Valley',
        category: 'food',
        coordinates: { lat: 34.2935, lng: 132.3255 },
        notes: 'Relax under the Japanese red maple bridge with hot hojicha.',
        estimatedStayMinutes: 40,
        cost: '¥600',
        rating: 4.7
      }
    ]
  }
];

export const SAVED_PLACES: SavedPlace[] = [
  {
    id: 'saved-1',
    title: 'Sarashina Teppanyaki Bar',
    category: 'food',
    address: 'Okonomimura 2F, Shintentechi',
    neighborhood: 'Shintentechi',
    notes: 'Recommended by local host Ken for crispy noodles okonomiyaki.',
    coordinates: { lat: 34.3915, lng: 132.4628 },
    recommendedTimeMinutes: 45
  },
  {
    id: 'saved-2',
    title: 'Daisho-in Buddhist Temple',
    category: 'culture',
    address: '210 Miyajimacho, Hatsukaichi',
    neighborhood: 'Miyajima Foothills',
    notes: '500 rakan stone statues wearing knitted beanies, prayer wheel staircase.',
    coordinates: { lat: 34.2932, lng: 132.3155 },
    recommendedTimeMinutes: 60
  },
  {
    id: 'saved-3',
    title: 'Fukuromachi Elementary School Peace Museum',
    category: 'culture',
    address: '3-26 Fukuromachi, Naka Ward',
    neighborhood: 'Fukuromachi',
    notes: 'Chalk messages left on the blackened plaster walls by survivors searching for family.',
    coordinates: { lat: 34.3908, lng: 132.4578 },
    recommendedTimeMinutes: 40
  },
  {
    id: 'saved-4',
    title: 'Hassho Okonomiyaki (Hatchobori)',
    category: 'food',
    address: '10-6 Yagenbori, Naka Ward',
    neighborhood: 'Yagenbori',
    notes: 'Famous for double-cooked soba noodles with extra cabbage crunch.',
    coordinates: { lat: 34.3892, lng: 132.4665 },
    recommendedTimeMinutes: 50
  }
];

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'plan-a',
    name: 'Plan A: Balanced Heritage & Island',
    tagline: 'Peace Memorial, riverboat cruise & low-tide Torii Gate',
    vibe: 'Reflective, culturally rich, comfortable pacing',
    pacing: '3-4 stops/day · 4.8 km total walk',
    days: INITIAL_DAYS
  },
  {
    id: 'plan-b',
    name: 'Plan B: Culinary & Hidden Alleyways',
    tagline: 'Morning food market, craft sake tastings & teppan masters',
    vibe: 'Food-first, neighborhood strolling, leisurely mornings',
    pacing: '4-5 food & culture stops/day · 3.9 km total walk',
    days: [
      {
        dayNumber: 1,
        dateString: 'Wed, Oct 7',
        title: 'Morning Market & Island Seafood Feasts',
        beaDailyInsight: 'The morning fish market opens early. You have an easy, open afternoon for grazing.',
        items: [
          {
            id: 'plan-b-1',
            order: 1,
            time: '09:00',
            title: 'Hiroshima Central Seafood Market',
            subtitle: 'Morning tuna auctions & steaming fish broth stalls',
            address: 'Kusatsu Harbor, Nishi Ward',
            neighborhood: 'Harbor District',
            category: 'food',
            coordinates: { lat: 34.3795, lng: 132.4105 },
            notes: 'Try the fresh uni rice bowl with pickled ginger.',
            estimatedStayMinutes: 60,
            rating: 4.8
          },
          {
            id: 'plan-b-2',
            order: 2,
            time: '11:15',
            title: 'Miyajima Ferry & Omotesando Oyster Crawl',
            subtitle: 'Grilled oysters in ponzu, cheese, and garlic butter',
            address: 'Omotesando, Miyajima',
            neighborhood: 'Miyajima Arcade',
            category: 'food',
            coordinates: { lat: 34.2985, lng: 132.3205 },
            notes: 'Hop between three street vendors along the waterfront.',
            estimatedStayMinutes: 90,
            rating: 4.9
          },
          {
            id: 'plan-b-3',
            order: 3,
            time: '14:30',
            title: 'Itsukushima Shrine Lagoon Stroll',
            subtitle: 'Low tide ocean walk & red vermilion gate reflections',
            address: '1-1 Miyajimacho, Hatsukaichi',
            neighborhood: 'Itsukushima Sanctuary',
            category: 'attraction',
            coordinates: { lat: 34.2958, lng: 132.3198 },
            notes: 'Walk barefoot on the sandbars at low tide.',
            estimatedStayMinutes: 60,
            rating: 5.0
          },
          {
            id: 'plan-b-4',
            order: 4,
            time: '17:30',
            title: 'Craft Beer & Momiji Ale at Miyajima Brewery',
            subtitle: 'Brewpub with floor-to-ceiling windows on the Seto Inland Sea',
            address: '459-2 Miyajimacho',
            neighborhood: 'Miyajima Waterfront',
            category: 'food',
            coordinates: { lat: 34.2975, lng: 132.3202 },
            notes: 'Sample the Setouchi Weizen and local lemon cider.',
            estimatedStayMinutes: 75,
            rating: 4.7
          }
        ]
      },
      INITIAL_DAYS[1],
      INITIAL_DAYS[2]
    ]
  },
  {
    id: 'plan-c',
    name: 'Plan C: Fast Highlights & Scenic Viewpoints',
    tagline: 'High-speed itinerary covering all top photography landmarks',
    vibe: 'Dynamic, panoramic photography, brisk transit',
    pacing: '5 stops/day · 6.5 km total walk',
    days: INITIAL_DAYS
  }
];
