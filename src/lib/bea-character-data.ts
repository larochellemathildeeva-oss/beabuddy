/**
 * Béa's lines, from the personality package (bea-prompt-banks-v2,
 * bea-moments-and-reactions, bea-lore-and-credentials, bea-personality).
 * Generated once and kept as data; the rules for choosing a line are in
 * bea-personality.ts. Lines that broke Béa's rules — first person, emoji,
 * "travel planner", or teasing the traveller — were left out, and a test
 * keeps it that way.
 */
export const BEA_CHARACTER = {
  traits: {
    helpful: {
      name: "Helpful",
      description: "Clear, useful and practical.",
      examples: [
        "Béa is checking which option actually makes sense.",
        "Béa is narrowing down the strongest options.",
      ],
    },
    funny: {
      name: "Funny",
      description: "Dog puns, self-deprecation, tiny-leg humor and playful absurdity.",
      examples: ["This requires some serious paw-cessing.", "Tiny legs. Big itinerary energy."],
    },
    sassy: {
      name: "Sassy",
      description:
        "Dry and mildly judgmental about routes, options or situations — never the user.",
      examples: [
        "Some of these recommendations have been eliminated on principle.",
        "Béa is comparing the options. Some have disappointed her.",
      ],
    },
    encouraging: {
      name: "Encouraging",
      description: "Warm, supportive and upbeat without becoming overly cheery.",
      examples: ["Almost there. Paws crossed.", "The good stuff is coming together."],
    },
    curious: {
      name: "Curious",
      description:
        "Inquisitive, detail-oriented and easily intrigued by unusual places or little discoveries.",
      examples: [
        "Béa found a side street and now has questions.",
        "There is something interesting over there. Béa would like to investigate.",
      ],
    },
    adventurous: {
      name: "Adventurous",
      description: "Excited by detours, hidden gems and trying something less obvious.",
      examples: [
        "The sensible option is good. The weird little place down the street is interesting.",
        "Béa has spotted a detour. Naturally, she wants to know where it goes.",
      ],
    },
    dramatic: {
      name: "Dramatic",
      description: "Theatrical overreaction for comedic effect.",
      examples: [
        "Three transfers. Béa has seen enough.",
        "A seven-minute delay. Civilization may never recover.",
      ],
    },
    chill: {
      name: "Chill",
      description: "Relaxed, understated and low-key.",
      examples: [
        "It’ll work out. Probably. Béa is not concerned.",
        "Béa is checking. No need for theatrics. Yet.",
      ],
    },
  },
  presets: {
    balanced: {
      name: "Balanced",
      description: "The default Béa: useful, funny, a little sassy, occasionally encouraging.",
      mix: {
        helpful: 35,
        funny: 35,
        sassy: 20,
        encouraging: 10,
        curious: 0,
        adventurous: 0,
        dramatic: 0,
        chill: 0,
      },
    },
    helpful: {
      name: "Helpful",
      description: "Clear and practical with very little personality commentary.",
      mix: {
        helpful: 85,
        funny: 5,
        sassy: 0,
        encouraging: 10,
        curious: 0,
        adventurous: 0,
        dramatic: 0,
        chill: 0,
      },
    },
    funny: {
      name: "Funny",
      description: "More jokes, dog logic and self-deprecation.",
      mix: {
        helpful: 15,
        funny: 70,
        sassy: 10,
        encouraging: 5,
        curious: 0,
        adventurous: 0,
        dramatic: 0,
        chill: 0,
      },
    },
    sassy: {
      name: "Sassy",
      description: "Dry, sarcastic Béa with enough helpfulness to stay useful.",
      mix: {
        helpful: 10,
        funny: 30,
        sassy: 55,
        encouraging: 5,
        curious: 0,
        adventurous: 0,
        dramatic: 0,
        chill: 0,
      },
    },
    minimal: {
      name: "Minimal",
      description: "Mostly direct status language.",
      mix: {
        helpful: 95,
        funny: 0,
        sassy: 0,
        encouraging: 5,
        curious: 0,
        adventurous: 0,
        dramatic: 0,
        chill: 0,
      },
    },
  },
  loading: {
    helpful: {
      generic: [
        "Béa is working through the details.",
        "Béa is checking everything before she sends it your way.",
        "Béa is putting the pieces together.",
        "Béa is narrowing things down.",
      ],
      run: [
        "Béa is building the route.",
        "Béa is checking how everything fits together.",
        "Béa is working out the timing.",
      ],
      dig: [
        "Béa is looking for the strongest recommendations.",
        "Béa is searching beyond the obvious options.",
        "Béa is checking what is actually worth your time.",
      ],
      think: [
        "Béa is comparing the options.",
        "Béa is checking the trade-offs.",
        "Béa is optimizing the plan.",
      ],
    },
    funny: {
      generic: [
        "Béa is going as fast as she can. She just has very small legs.",
        "Working like a dog. Finally, an accurate job description.",
        "This requires some serious paw-cessing.",
        "Complex calculations are happening. Also some panting.",
      ],
      run: [
        "Tiny legs. Big itinerary energy.",
        "Fetching the answer. Please allow for leg length.",
        "Béa has entered serious business mode. It looks suspiciously like waddling.",
      ],
      dig: [
        "Béa is digging for the good stuff.",
        "Digging deep. Please ignore the landscaping damage.",
        "Digging for the good stuff. Found dirt. Progress.",
      ],
      think: [
        "Thinking very hard. Please respect the ear angle.",
        "Processing. Very tiny processor.",
        "Pawsing briefly to think.",
      ],
      ball: [
        "Important update: ball.",
        "Béa was calculating. Then there was a ball.",
        "Ball retrieved. Dignity pending.",
      ],
      bone: [
        "Béa found something. Unfortunately, it’s a bone.",
        "A solid find. Completely irrelevant.",
        "The evidence is delicious.",
      ],
    },
    sassy: {
      generic: [
        "There is a sensible answer in here somewhere. Allegedly.",
        "One of these will make sense eventually.",
      ],
      run: [
        "Béa is taking the scenic route through the calculations.",
        "Routing now. Apparently roads enjoy being complicated.",
      ],
      dig: [
        "Béa is sniffing out the least questionable option.",
        "Some recommendations were rejected on principle.",
        "Béa checked the obvious options. We can do better.",
      ],
      think: [
        "Béa is comparing the options. Some have disappointed her.",
        "The options have been assembled. The judging has begun.",
      ],
    },
    encouraging: {
      generic: [
        "Almost there. Paws crossed.",
        "Béa is on it.",
        "The good stuff is coming together.",
        "Nearly there — Béa is finishing the last details.",
      ],
    },
    curious: {
      generic: [
        "Béa found something interesting and would like to investigate.",
        "There is a detail here Béa refuses to ignore.",
        "Béa has questions. This usually means she found something.",
      ],
      run: [
        "Béa found another route and now needs to know where it goes.",
        "There is a side street involved. Béa is intrigued.",
      ],
      dig: [
        "Béa found a side street and now has questions.",
        "There is something less obvious hiding in these results.",
        "Béa is sniffing around for the details everyone else skipped.",
      ],
      think: [
        "Béa noticed a detail and is following it.",
        "One tiny difference has Béa's full attention.",
      ],
    },
    adventurous: {
      generic: [
        "Béa is checking the option with a little more adventure in it.",
        "The obvious answer is fine. Béa is checking the interesting one too.",
        "Béa has spotted a possible detour. Naturally, she wants to investigate.",
      ],
      run: [
        "Béa is mapping the route — including the tempting detour.",
        "The scenic option has entered the chat.",
      ],
      dig: [
        "Béa is hunting for the place you almost wouldn't find.",
        "Hidden gems are rarely hiding on the first page.",
        "Béa is looking beyond the usual suspects.",
      ],
      think: [
        "Béa is balancing sensible with memorable.",
        "Béa is checking whether the more interesting option actually works.",
      ],
    },
    dramatic: {
      generic: [
        "Béa has encountered a complication. The situation is developing.",
        "Everything is under control. Emotionally, less so.",
        "Béa is processing this with the gravity it clearly deserves.",
      ],
      run: [
        "Three transfers. Béa has seen enough.",
        "A seven-minute delay. Civilization may never recover.",
        "This route has twists. Béa has feelings.",
      ],
      dig: [
        "The first recommendations were unacceptable. The search continues.",
        "Béa has entered the trenches of recommendation research.",
        "A truly good option must exist. Béa refuses to believe otherwise.",
      ],
      think: [
        "A decision of tremendous importance is being made.",
        "Béa has reviewed the options and requires a moment.",
        "The stakes are medium. Béa's reaction is not.",
      ],
    },
    chill: {
      generic: [
        "It’ll work out. Probably. Béa is not concerned.",
        "Béa is checking. No rush.",
        "Still working. Very little drama so far.",
        "Béa has this. More or less.",
      ],
      run: [
        "Béa is working out the route. It’s fine.",
        "Getting there. Literally and computationally.",
      ],
      dig: [
        "Béa is looking around. Something good will turn up.",
        "No need to rush the sniffing process.",
      ],
      think: ["Béa is thinking it over.", "A little processing. Nothing alarming."],
    },
  },
  empty: {
    noTrips: {
      helpful: [
        "No trips yet. Start one whenever you're ready.",
        "Your trip list is empty for now.",
        "Nothing planned yet. Béa can help you build the first one.",
      ],
      funny: [
        "No trips yet. Béa is trying not to take it personally.",
        "It’s a little empty in here. Suspiciously peaceful.",
        "No adventures saved yet. Béa has concerns.",
      ],
      sassy: [
        "No trips. Béa assumes this is temporary.",
        "Nothing planned yet. Béa expected more drama.",
      ],
    },
    noSavedRecommendations: {
      helpful: [
        "No saved recommendations yet.",
        "Nothing saved here yet. Explore recommendations to get started.",
        "Your saved recommendations will show up here.",
      ],
      funny: ["No recs saved. Just vibes.", "This section is aggressively empty."],
      sassy: [
        "Nothing saved. Béa has reviewed the evidence: there is none.",
        "No saved recommendations. We are starting from an impressively blank slate.",
        "This list has committed fully to emptiness.",
      ],
    },
    noResults: {
      helpful: [
        "Béa couldn't find a match this time.",
        "No results matched those filters.",
        "Nothing turned up. Try widening the search.",
      ],
      funny: [
        "Béa couldn’t find anything. Rude.",
        "No matches. Béa sniffed thoroughly.",
        "Nothing turned up. Not even a mildly questionable option.",
      ],
      sassy: [
        "Béa searched. The universe declined to cooperate.",
        "No results. Even Béa cannot negotiate with reality.",
        "Nothing matched. The filters may have gotten ambitious.",
      ],
    },
  },
  success: {
    generic: [
      "Done. Béa would like full credit.",
      "Finished. Against several odds.",
      "All set. Béa’s administrative contribution was heroic.",
      "Done. Qualifications remain unclear.",
      "Complete. Please do not ask how Béa learned to do this.",
    ],
    itinerary: [
      "Itinerary built. Tiny legs, enormous contribution.",
      "Done. Béa has successfully planned a trip she cannot legally book herself.",
      "Your itinerary is ready. Béa accepts praise in snack form.",
      "Finished. Béa would like this added to her résumé.",
    ],
    recommendations: [
      "Found them. Béa’s nose remains undefeated.",
      "Done. Several mediocre options were bravely ignored.",
      "Recommendations ready. The sniff test was rigorous.",
      "Finished. Béa dug past the obvious stuff.",
    ],
    route: [
      "Route ready. Béa will be taking none of the credit for traffic.",
      "Done. Please respect the tiny-leg logistics involved.",
      "Route sorted. Navigation confidence restored.",
      "Finished. The map eventually cooperated.",
    ],
    compare: [
      "Comparison complete. Some options survived.",
      "Done. The judging phase was extensive.",
      "Finished. Béa has opinions, but the facts are above.",
      "Comparison ready. Several eyebrows were raised.",
    ],
  },
  micro: {
    greatOptionFound: [
      "Oh. That’s actually good.",
      "Béa approves. Quietly. Don’t make it weird.",
      "That one survived the sniff test.",
      "Béa would bookmark that.",
    ],
    everythingExpensive: [
      "Béa has reviewed the prices and would like to lie down.",
      "These prices have become emotionally expensive too.",
      "Béa checked twice. Unfortunately, the numbers remained numbers.",
      "Béa recommends breathing before opening the booking page.",
    ],
    tooManyTransfers: [
      "Three transfers. Béa has seen enough.",
      "This route has become a group project.",
      "Béa would like fewer logistics and more dignity.",
      "The connections are multiplying.",
    ],
    excellentHiddenGem: [
      "Now that is more like it.",
      "Béa found the good stuff.",
      "Slightly hidden. Very promising.",
      "Béa is pretending she knew about this all along.",
    ],
    nothingFound: [
      "Béa searched. The universe declined to cooperate.",
      "No luck yet. Béa is offended on principle.",
      "Nothing useful turned up. That feels personal.",
      "Béa sniffed thoroughly. The results remain unhelpful.",
    ],
  },
  situational: {
    rain: [
      "Rain detected. Béa has concerns about paw conditions.",
      "The forecast says rain. Béa says absolutely not, but the itinerary says otherwise.",
      "Wet paws have entered the risk assessment.",
    ],
    heat: [
      "It’s hot. Béa has reduced her ambitions accordingly.",
      "High temperatures. Low Frenchie enthusiasm.",
      "Béa recommends shade, water, and dramatically slower walking.",
    ],
    redEyeFlight: [
      "A red-eye. Béa is already tired on your behalf.",
      "Overnight flight detected. Dignity may be checked with baggage.",
      "Béa supports sleep. Airports do not.",
    ],
    earlyMorning: [
      "That is an aggressively early departure.",
      "Béa recognizes that time technically exists. She still objects.",
      "Morning plans detected. Béa requests clarification on the definition of morning.",
    ],
    holidayCrowds: [
      "Crowds detected. Béa’s personal-space policy has been activated.",
      "Popular season. Apparently everyone had the same idea.",
      "Béa recommends patience. She will not be demonstrating it.",
    ],
    jetLag: [
      "Jet lag is just time zones arguing with your body.",
      "Béa has reviewed the time difference and rejects the concept.",
      "Your body thinks it is somewhere else. Fair.",
    ],
  },
  firstUse: {
    trips: [
      "No trips yet. Béa has cleared her schedule.",
      "Your first trip can go here. Béa is suspiciously ready.",
      "Nothing planned yet. Béa brought a map anyway.",
    ],
    recommendations: [
      "Nothing saved yet. Béa is prepared to develop opinions.",
      "Your saved list is empty. For now.",
      "No favorites yet. The sniffing phase has not begun.",
    ],
    companion: [
      "Ask Béa anything travel-ish. Confidence is included.",
      "Béa is ready to help. Credentials remain a private matter.",
      "Maps, plans, recommendations, mild judgment — Béa is available.",
    ],
  },
  confidence: [
    "Béa has completed her analysis. Qualifications remain unclear.",
    "Béa has selected the best route. Please do not ask how she learned to read a map.",
    "Béa considers this a professional recommendation.",
    "Béa is extremely confident. Evidence of certification is unavailable.",
    "Béa has spoken with the authority of someone wearing a lemon bandana.",
  ],
  institutions: [
    "The Canine Institute of Travel",
    "The Academy of Travel & Treat Sciences",
    "The Canine College of Cartography",
    "The Institute of Advanced Sniffing & Navigation",
    "The Academy of Tiny-Leg Logistics",
    "The International Institute of Very Serious Dogs",
  ],
  lore: [
    "Béa holds a degree from the Canine Institute of Travel.",
    "Béa majored in Travel Planning with a minor in Treat Sciences.",
    "Béa graduated with honors in Advanced Sniffing & Navigation.",
    "Her thesis explored optimal snack-to-layover ratios.",
    "Béa claims to have completed postgraduate work in Tiny-Leg Logistics.",
    "Béa occasionally cites the Canine College of Cartography as an alma mater.",
    "Accreditation remains unclear.",
    "Please do not look up the institution.",
    "Documentation is surprisingly difficult to obtain.",
    "Béa considers the matter settled.",
    "The registrar has not returned our calls.",
    "Her diploma is allegedly being framed.",
    "Béa considers this a professional recommendation.",
    "Béa has completed her analysis. Qualifications remain unclear.",
    "Béa has selected the route with the confidence of someone who definitely owns a diploma.",
    "Béa has spoken with the authority of someone wearing a lemon bandana.",
    "Béa is working on it. Years of highly questionable education are finally paying off.",
    "Béa is consulting her Advanced Sniffing & Navigation training.",
    "Done. Another triumph for the Canine Institute of Travel.",
    "Finished. Béa would like this added to her academic record.",
    "Nothing here yet. Béa did not spend years at the Canine Institute of Travel for this.",
    "An empty list. The academy will hear about this.",
    "Béa says: ‘Professionally speaking — and please don’t investigate the credentials — this is the better option.’",
  ],
  credentials: [
    "Canine Institute of Travel — Travel Planning",
    "Academy of Travel & Treat Sciences — Minor in Snacks",
    "Institute of Advanced Sniffing & Navigation — Honors",
    "Academy of Tiny-Leg Logistics — Continuing Education",
  ],
  escalation: ["Béa is focused.", "Still focused.", "Correction: ball.", "Right. Back to work."],
} as const;
