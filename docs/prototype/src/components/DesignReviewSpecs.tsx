import React, { useState } from 'react';
import { MascotAvatar } from './MascotAvatar';
import {
  Sparkles,
  CheckCircle2,
  Layers,
  Map,
  Edit3,
  Compass,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Tablet,
  HeartHandshake
} from 'lucide-react';

export const DesignReviewSpecs: React.FC = () => {
  const [activeConceptTab, setActiveConceptTab] = useState<'all' | 'A' | 'B' | 'C' | 'recommendation'>('recommendation');

  return (
    <div className="flex-1 bg-[#FAF8F5] overflow-y-auto p-6 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header Lockup */}
      <div className="bg-white border border-[#E8DFD3] rounded-3xl p-6 md:p-8 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MascotAvatar size="md" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#D96B43]">
                Airbnb Product Design Review
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2C2623] tracking-tight">
              Béa: First-Principles Itinerary Architecture
            </h1>
            <p className="text-sm text-[#716458] mt-2 max-w-3xl leading-relaxed">
              Executive design specification and evaluation by Head of Product Design.
              Start from scratch: zero dashboards, zero enterprise telemetry, pure progressive disclosure,
              and a calm travel companion rooted in human empathy.
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#F0EBE1] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveConceptTab('recommendation')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeConceptTab === 'recommendation'
                ? 'bg-[#2C2623] text-white shadow-xs'
                : 'bg-[#FAF5EE] text-[#5C473A] hover:bg-[#F2EDE4]'
            }`}
          >
            🏆 Executive Recommendation
          </button>
          <button
            type="button"
            onClick={() => setActiveConceptTab('A')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeConceptTab === 'A'
                ? 'bg-[#2C2623] text-white shadow-xs'
                : 'bg-[#FAF5EE] text-[#5C473A] hover:bg-[#F2EDE4]'
            }`}
          >
            Concept A: Editor First
          </button>
          <button
            type="button"
            onClick={() => setActiveConceptTab('B')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeConceptTab === 'B'
                ? 'bg-[#2C2623] text-white shadow-xs'
                : 'bg-[#FAF5EE] text-[#5C473A] hover:bg-[#F2EDE4]'
            }`}
          >
            Concept B: Map Balanced
          </button>
          <button
            type="button"
            onClick={() => setActiveConceptTab('C')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeConceptTab === 'C'
                ? 'bg-[#2C2623] text-white shadow-xs'
                : 'bg-[#FAF5EE] text-[#5C473A] hover:bg-[#F2EDE4]'
            }`}
          >
            Concept C: Travel Companion
          </button>
          <button
            type="button"
            onClick={() => setActiveConceptTab('all')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeConceptTab === 'all'
                ? 'bg-[#2C2623] text-white shadow-xs'
                : 'bg-[#FAF5EE] text-[#5C473A] hover:bg-[#F2EDE4]'
            }`}
          >
            📊 Comparative Matrix
          </button>
        </div>
      </div>

      {/* RECOMMENDATION TAB */}
      {(activeConceptTab === 'recommendation' || activeConceptTab === 'all') && (
        <div className="bg-white border-2 border-[#D96B43] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D96B43] bg-[#FAF5EE] px-3 py-1 rounded-full">
              Final Design Decision
            </span>
            <span className="text-xs text-[#8C7A6B]">Airbnb Core Product Philosophy</span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-[#2C2623]">
            Winning Choice: Concept C (Travel Companion) with Concept A’s Tactile Micro-Interactions
          </h2>

          <div className="prose text-xs md:text-sm text-[#4A3B32] space-y-4 leading-relaxed">
            <p>
              As Head of Product Design at Airbnb, our mission has never been to build spreadsheet software for travelers.
              Travel is inherently romantic, sensory, and occasionally anxious. When someone touches down in Hiroshima or lands in Paris,
              they do not want to manage an operations pipeline. They want to glance down at their phone in the morning sun,
              understand their entire day in under <strong>5 seconds</strong>, and feel assured that everything is taken care of.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E8DFD3]">
                <h4 className="font-bold text-[#2C2623] mb-1">1. The 5-Second Day Arc</h4>
                <p className="text-xs text-[#716458]">
                  Concept C solves Principle 1 ("Day is the Hero") better than any layout. The visual morning / afternoon / evening rhythm bar gives instant temporal shape without demanding cognitive parsing.
                </p>
              </div>
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E8DFD3]">
                <h4 className="font-bold text-[#2C2623] mb-1">2. Béa’s Authentic Voice</h4>
                <p className="text-xs text-[#716458]">
                  Béa is not a chatbot that nags or generates endless paragraphs. Concept C limits Béa to exactly 1 thoughtful, quiet observation per day ("The ferry at 11:45 is the only thing I'd be careful not to miss"), preserving her warmth and credibility.
                </p>
              </div>
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E8DFD3]">
                <h4 className="font-bold text-[#2C2623] mb-1">3. Progressive Calm</h4>
                <p className="text-xs text-[#716458]">
                  Stops remain collapsed to time, title, and neighborhood. When walking on the street, one thumb tap unveils the gate ticket, booking code, or host notes. No clutter, zero dashboard anxiety.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#FAF5EE] rounded-2xl border border-[#EADBCE] text-xs text-[#3B2518]">
              <strong>The Hybrid Synthesis:</strong> We take Concept C’s "Day is Hero" header and "Now & Next" anchor as the primary baseline, while borrowing Concept A's inline drag reordering and inline "+ Insert stop" slots for edit mode. This gives travelers the emotional warmth of a companion with the effortless dexterity of Notion Calendar.
            </div>
          </div>
        </div>
      )}

      {/* CONCEPT A DEEP-DIVE */}
      {(activeConceptTab === 'A' || activeConceptTab === 'all') && (
        <div className="bg-white border border-[#E8DFD3] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#D96B43]">Concept A</span>
              <h2 className="text-xl font-bold text-[#2C2623]">Editor First (Planning Optimized)</h2>
            </div>
            <span className="text-xs text-[#8C7A6B] bg-[#FAF8F5] px-3 py-1 rounded-full">Linear / Notion Inspired</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#4A3B32]">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">1. Screen Hierarchy</h4>
                <p className="text-[#716458] leading-relaxed">
                  Day navigation tabs sit at the top, immediately followed by Béa's minimal 1-line note. The timeline list occupies 85% of screen height with persistent drag handles and inline controls. Map is strictly secondary and summoned via an on-demand drawer.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">2. Mobile Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Compact 393px vertical layout. Reorder chevrons and drag grab handles are sized for 44px touch targets. Single-line metadata with unboxed bullet separators prevents horizontal wrapping.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">3. Tablet Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  On tablet (820px canvas), Concept A opens into a 2-column layout: left column displays the master days and timeline list; right column displays the full-height contextual map and live transit route calculator.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">4. Timeline Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Notion Calendar aesthetic. High-contrast tabular hours (e.g. "09:30"), title, and neighborhood subtitle. Transit connectors between cards show walking time and distance without noisy badges.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">5. Map Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  The map never intrudes on editing. It lives behind a quiet "Map Context" pill at the top right, expanding into a bottom drawer that displays numbered pins and route lines on demand.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">6. Editing Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Zero modals for basic changes. Tapping the timestamp turns it into an inline time input. Up/down chevrons instantly shift items. A single dropdown selector allows moving any stop to Day 2 or Day 3 without submenu digging.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">7. Add-Stop Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Inline insertion zones ("+ Insert stop") sit between every transit leg. Clicking inserts a stop directly into that time gap with automatically suggested timestamps based on neighboring legs.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">8. Day Overview Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Scannable list with total stop counter and total duration. Prioritizes chronological rigor and completeness over visual abstraction.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">9. Béa Integration</h4>
                <p className="text-[#716458] leading-relaxed">
                  Béa appears as a quiet editorial footnote at the very top: "🐶 Béa: Everything before lunch is walkable. Take your time." No popup bubbles, no unsolicited recommendations.
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8DFD3]">
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">10. Pros & Cons</h4>
                <p className="text-[#2A9D8F] font-semibold">Pros: Highest editing velocity, lowest latency for builders, seamless batch multi-day changes.</p>
                <p className="text-[#C85235] font-semibold mt-1">Cons: Less intuitive spatial context for unfamiliar cities; can feel slightly utilitarian when on the street.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONCEPT B DEEP-DIVE */}
      {(activeConceptTab === 'B' || activeConceptTab === 'all') && (
        <div className="bg-white border border-[#E8DFD3] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2A9D8F]">Concept B</span>
              <h2 className="text-xl font-bold text-[#2C2623]">Map Balanced (Spatial Harmony)</h2>
            </div>
            <span className="text-xs text-[#8C7A6B] bg-[#FAF8F5] px-3 py-1 rounded-full">Apple Maps / Airbnb Inspired</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#4A3B32]">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">1. Screen Hierarchy</h4>
                <p className="text-[#716458] leading-relaxed">
                  A continuous 50/50 dual-surface split. The top half is a live interactive Leaflet map; the bottom half is a bottom sheet with 3 tactile snap positions (Peek 36%, Balanced 58%, Full List 88%).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">2. Mobile Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  One-handed thumb navigation. The bottom sheet handle sits directly in the thumb reach zone. Swiping up reveals the itinerary; swiping down exposes the full city geography.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">3. Tablet Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  On tablet, the bottom sheet converts into a floating left sidebar (380px wide) with frosted backdrop blur, leaving 60% of the screen for an expansive spatial exploration canvas.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">4. Timeline Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Organized by <strong>Neighborhood Groupings</strong> (e.g. &quot;Peace Memorial Corridor&quot; · 3 stops to &quot;Miyajima Island Waterfront&quot; · 4 stops). Groups help travelers mentally anchor where they will be during each slice of the day.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">5. Map Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Warm CartoDB Voyager tiles matching Airbnb palette. Stop numbers match timeline card numbers. Walking lines are rendered with subtle terracotta dashed polylines.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">6. Editing Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Requires snapping the sheet to full height for comfortable reordering, or tapping an individual card to adjust its time. Slightly slower than Concept A but prevents spatial mistakes.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">7. Add-Stop Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Can tap directly on the map or tap the sticky "+ Add Stop" button in the top bar. Automatically pulls neighborhood and geolocation into the new stop.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">8. Day Overview Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  The map itself serves as the overview: travelers instantly see if stops form a clean line or zigzag foolishly across bridges and bays.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">9. Béa Integration</h4>
                <p className="text-[#716458] leading-relaxed">
                  Béa's insight floats as a gentle pill card right above the bottom sheet handle: "The ferry is the only thing I'd be careful not to miss." It anchors the connection between physical map and timeline.
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8DFD3]">
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">10. Pros & Cons</h4>
                <p className="text-[#2A9D8F] font-semibold">Pros: Exceptional spatial clarity, prevents zigzag itineraries, very intuitive for first-time visitors.</p>
                <p className="text-[#C85235] font-semibold mt-1">Cons: Map takes 40-50% of vertical canvas, resulting in fewer stops visible simultaneously on smaller phone screens.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONCEPT C DEEP-DIVE */}
      {(activeConceptTab === 'C' || activeConceptTab === 'all') && (
        <div className="bg-white border border-[#E8DFD3] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#D96B43]">Concept C</span>
              <h2 className="text-xl font-bold text-[#2C2623]">Travel Companion (Rapid Day Comprehension)</h2>
            </div>
            <span className="text-xs text-[#8C7A6B] bg-[#FAF8F5] px-3 py-1 rounded-full">Airbnb Pure Empathy</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#4A3B32]">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">1. Screen Hierarchy</h4>
                <p className="text-[#716458] leading-relaxed">
                  1. "Day is the Hero" Day Arc (Morning / Afternoon / Evening rhythm bar).
                  2. Béa’s warm daily note.
                  3. "Now & Next" situational anchor card.
                  4. Clean progressive disclosure timeline.
                  5. Full map toggle on demand.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">2. Mobile Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Calm, elegant single-column feed. Card heights are optimized for rapid scanning: collapsed cards measure only 64px tall, allowing 5+ stops to fit on a single screen without scrolling.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">3. Tablet Mockup Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  On tablet, the Day Arc expands into a prominent horizontal header banner showing morning, afternoon, and evening daylight curves, while timeline cards display rich ticket codes and notes side-by-side.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">4. Timeline Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Progressive disclosure: Collapsed state shows only Time, Title, and Neighborhood. One gentle tap expands the card to display booking confirmations, QR codes, private notes, and transit walking step.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">5. Map Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  Map is accessible via a dedicated "Day Map" toggle in the header or via inline transit links. It does not compete for attention when the traveler simply wants to know what comes next.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">6. Editing Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Inline "+ Add Stop" buttons and drag reorder triggers. Moving items between days or deleting a stop is accessible via simple sheet menus without cluttering the resting companion view.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">7. Add-Stop Workflow</h4>
                <p className="text-[#716458] leading-relaxed">
                  Fast modal with time picker, duration estimate, and category chips. Automatically nests into the correct Morning, Afternoon, or Evening segment of the Day Arc.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">8. Day Overview Design</h4>
                <p className="text-[#716458] leading-relaxed">
                  The visual 3-stage Day Arc is the crown jewel: within 2 seconds of opening the app, a user sees the proportion of their day committed to morning vs afternoon vs evening.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">9. Béa Integration</h4>
                <p className="text-[#716458] leading-relaxed">
                  Béa feels like a real thoughtful friend sitting beside you. Her daily note is concise, empathetic, and strictly limited to 1 observation per day (e.g. "Everything before lunch is walkable. Take your time in Shukkeien Garden.").
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8DFD3]">
                <h4 className="font-bold text-sm text-[#2C2623] mb-1">10. Pros & Cons</h4>
                <p className="text-[#2A9D8F] font-semibold">Pros: Highest emotional satisfaction, zero cognitive overload, fastest day comprehension (&lt;5s), true to Béa’s identity.</p>
                <p className="text-[#C85235] font-semibold mt-1">Cons: Map is hidden behind 1 tap (mitigated by our hybrid synthesis).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARATIVE MATRIX */}
      <div className="bg-white border border-[#E8DFD3] rounded-3xl p-6 md:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-[#2C2623]">Head-to-Head Architectural Evaluation</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#4A3B32] border-collapse">
            <thead>
              <tr className="border-b border-[#E8DFD3] text-[#8C7A6B]">
                <th className="py-2.5 px-3 font-semibold">Dimension</th>
                <th className="py-2.5 px-3 font-semibold text-[#D96B43]">Concept A: Editor First</th>
                <th className="py-2.5 px-3 font-semibold text-[#2A9D8F]">Concept B: Map Balanced</th>
                <th className="py-2.5 px-3 font-semibold text-[#2C2623]">Concept C: Travel Companion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1]">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-[#2C2623]">Primary Optimization</td>
                <td className="py-2.5 px-3">Trip Planning & Reorganizing</td>
                <td className="py-2.5 px-3">Spatial Navigation & Geography</td>
                <td className="py-2.5 px-3 font-bold text-[#D96B43]">Instant Day Comprehension & Peace of Mind</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-[#2C2623]">5-Second Day Comprehension</td>
                <td className="py-2.5 px-3 text-[#C85235]">Fair (Requires reading list)</td>
                <td className="py-2.5 px-3 text-[#E9C46A]">Good (Spatial map view)</td>
                <td className="py-2.5 px-3 font-bold text-[#2A9D8F]">Best in Class (Visual Day Arc)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-[#2C2623]">On-Street Utility</td>
                <td className="py-2.5 px-3 text-[#E9C46A]">Moderate (Dense text)</td>
                <td className="py-2.5 px-3 text-[#2A9D8F]">High (Live map)</td>
                <td className="py-2.5 px-3 font-bold text-[#2A9D8F]">Highest ("Now & Next" + Tickets)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-[#2C2623]">Béa Mascot Natural Fit</td>
                <td className="py-2.5 px-3 text-[#8C7A6B]">Subtle micro-note</td>
                <td className="py-2.5 px-3 text-[#8C7A6B]">Floating map callout</td>
                <td className="py-2.5 px-3 font-bold text-[#D96B43]">Warm, Thoughtful Daily Anchor</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-[#2C2623]">Reordering Speed</td>
                <td className="py-2.5 px-3 font-bold text-[#2A9D8F]">Instant (Inline chevrons)</td>
                <td className="py-2.5 px-3 text-[#8C7A6B]">Moderate (Sheet expansion needed)</td>
                <td className="py-2.5 px-3 text-[#2A9D8F]">Fast (Smooth drag & edit)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
