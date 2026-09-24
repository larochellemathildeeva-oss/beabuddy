import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Compass,
  Layers,
  Activity,
  Zap,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Check,
  Footprints,
  Eye,
  Shuffle,
  FileText,
  MousePointer,
  HelpCircle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { MascotAvatar } from './MascotAvatar';

export type MotionFlowId =
  | 'import'
  | 'add-stop'
  | 'reorder'
  | 'edit-stop'
  | 'day-switch'
  | 'map-sync'
  | 'split-view'
  | 'optimize'
  | 'compare'
  | 'active-trip'
  | 'mascot'
  | 'springs';

export type MascotState = 'idle' | 'thinking' | 'sniffing' | 'running' | 'found';

export const MotionDesignDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MotionFlowId>('optimize');
  const [mascotState, setMascotState] = useState<MascotState>('thinking');

  // --- 1. Import Itinerary State ---
  const [importStage, setImportStage] = useState<number>(0); // 0: Raw text, 1: Extraction, 2: Projection, 3: Route Weave, 4: Crystallized
  const [isImportPlaying, setIsImportPlaying] = useState<boolean>(false);

  // --- 2. Add Stop State ---
  const [isAddBudding, setIsAddBudding] = useState<boolean>(false);

  // --- 3. Reorder Stop State ---
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [reorderItems, setReorderItems] = useState([
    { id: '1', title: 'Miyajima Ferry Terminal', time: '09:00', duration: '15m' },
    { id: '2', title: 'Itsukushima Floating Torii', time: '09:30', duration: '90m' },
    { id: '3', title: 'Mount Misen Ropeway', time: '11:15', duration: '120m' },
    { id: '4', title: 'Omotesando Shopping Street', time: '13:45', duration: '60m' },
  ]);
  const [dragTilt, setDragTilt] = useState<number>(0);

  // --- 4. Edit Stop State ---
  const [isEditExpanded, setIsEditExpanded] = useState<boolean>(false);

  // --- 5. Day Switching State ---
  const [activeJournalDay, setActiveJournalDay] = useState<number>(1);
  const [isDayTransitioning, setIsDayTransitioning] = useState<boolean>(false);

  // --- 6. Map Sync State ---
  const [selectedPinId, setSelectedPinId] = useState<string>('stop-2');
  const [pinPulse, setPinPulse] = useState<boolean>(false);

  // --- 7. Split View State ---
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage

  // --- 8. Itinerary Optimization State ---
  const [optimizeStage, setOptimizeStage] = useState<'initial' | 'detaching' | 'reordering' | 'settled'>('initial');
  const [optimizedRoute, setOptimizedRoute] = useState([
    { id: 's1', title: '1. Hiroshima Peace Memorial', tag: 'Morning', efficiency: 'Order 1' },
    { id: 's3', title: '2. Atomic Bomb Dome', tag: 'Across River (2m walk)', efficiency: 'Order 2 (Was #4)' },
    { id: 's2', title: '3. Orizuru Tower Café', tag: 'Adjacent (3m walk)', efficiency: 'Order 3' },
    { id: 's4', title: '4. Okonomimura Dinner', tag: 'Evening (Downtown)', efficiency: 'Order 4' },
  ]);

  // --- 9. Compare Itineraries State ---
  const [activePlanOption, setActivePlanOption] = useState<'A' | 'B'>('A');

  // --- 10. Active Trip State ---
  const [activeStopStep, setActiveStopStep] = useState<number>(1); // 1 = at stop 1, 2 = progressing, 3 = at stop 2

  // --- Springs Playground State ---
  const [springPreset, setSpringPreset] = useState<'instant' | 'snappy' | 'fluid' | 'spatial' | 'lazy'>('fluid');
  const [springTestActive, setSpringTestActive] = useState<boolean>(false);

  // Handlers for interactive sequences
  const runImportSequence = () => {
    setIsImportPlaying(true);
    setImportStage(1);
    setTimeout(() => setImportStage(2), 700);
    setTimeout(() => setImportStage(3), 1500);
    setTimeout(() => {
      setImportStage(4);
      setIsImportPlaying(false);
    }, 2300);
  };

  const runOptimizeSequence = () => {
    setOptimizeStage('detaching');
    setTimeout(() => {
      setOptimizeStage('reordering');
    }, 350);
    setTimeout(() => {
      setOptimizeStage('settled');
    }, 950);
  };

  const handleDaySwitch = (newDay: number) => {
    if (newDay === activeJournalDay) return;
    setIsDayTransitioning(true);
    setTimeout(() => {
      setActiveJournalDay(newDay);
      setIsDayTransitioning(false);
    }, 320);
  };

  const triggerSpringTest = () => {
    setSpringTestActive(false);
    setTimeout(() => setSpringTestActive(true), 20);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FDFBF7] text-[#2C2623] overflow-y-auto">
      {/* Top Banner / Philosophy Header */}
      <div className="bg-[#2C2623] text-[#FAF5EE] px-4 sm:px-8 py-6 border-b border-[#3E3530] shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#D96B43]/20 text-[#E89E78] border border-[#D96B43]/40 text-xs font-bold uppercase tracking-wider">
                Apple HI · Airbnb Motion · Linear Systems
              </span>
              <span className="text-xs text-stone-400">Spec v1.0 Live Lab</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 text-white">
              Béa Motion Design System
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl leading-relaxed">
              Every animation answers: <span className="text-[#E89E78] font-semibold">What changed? Where did it go? Where did it come from? What is Béa doing? What should I focus on next?</span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#38302A] p-2.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <MascotAvatar size="md" className="ring-2 ring-[#D96B43]" />
            <div className="text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Béa Companion</span>
                <span className="w-2 h-2 rounded-full bg-[#2A9D8F] inline-block animate-ping" />
              </div>
              <p className="text-[11px] text-stone-300">Direct manipulation & spatial permanence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for all 10 Flows + Mascot + Springs */}
      <div className="bg-[#FAF5EE] border-b border-[#EADBCE] px-4 sm:px-8 py-2.5 sticky top-0 z-30 shadow-2xs overflow-x-auto no-scrollbar">
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 min-w-max">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B] mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[#D96B43]" />
            <span>Interactive Flows:</span>
          </span>

          {[
            { id: 'optimize', label: '8. Optimize Day', highlight: true },
            { id: 'import', label: '1. Import & Assembly' },
            { id: 'add-stop', label: '2. Add Stop (Budding)' },
            { id: 'reorder', label: '3. Reorder Physics' },
            { id: 'edit-stop', label: '4. In-Situ Edit' },
            { id: 'day-switch', label: '5. Journal Turn' },
            { id: 'map-sync', label: '6. Map ↔ Timeline' },
            { id: 'split-view', label: '7. Split View' },
            { id: 'compare', label: '9. Compare Diff' },
            { id: 'active-trip', label: '10. Active Trip' },
            { id: 'mascot', label: '🐶 Béa Mascot', highlight: true },
            { id: 'springs', label: '⚡ Springs Lab' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as MotionFlowId)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-[#2C2623] text-white shadow-xs scale-[1.02]'
                  : item.highlight
                  ? 'bg-white text-[#D96B43] border border-[#F0D5C3] hover:bg-[#F2EDE4]'
                  : 'bg-white/80 text-[#5C473A] hover:bg-white hover:text-[#2C2623] border border-[#EADBCE]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage Area */}
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-8 flex-1">
        {/* ========================================================================= */}
        {/* FLOW 8: ITINERARY OPTIMIZATION */}
        {/* ========================================================================= */}
        {activeTab === 'optimize' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Context & Rubric Bar */}
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F0EBE1] pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                      Flow 8 · Linear-Grade Living Re-Sort
                    </span>
                    <span className="text-xs text-[#8C7A6B]">Zero Spinners · Zero Percentages</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                    Itinerary Optimization in Motion
                  </h2>
                  <p className="text-xs sm:text-sm text-[#716458] mt-1 max-w-xl">
                    Instead of a cold loading spinner, the itinerary detaches, slides along physical tracks, and visibly resolves transit friction into an elegant geographical circuit.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setOptimizeStage('initial');
                    }}
                    className="p-2.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] text-[#5C473A] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    onClick={runOptimizeSequence}
                    disabled={optimizeStage !== 'initial'}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
                      optimizeStage === 'initial'
                        ? 'bg-[#D96B43] hover:bg-[#C85327] text-white active:scale-95'
                        : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Optimize Day Route</span>
                  </button>
                </div>
              </div>

              {/* Stage Progress Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 text-xs">
                <div className={`p-2.5 rounded-xl border transition-all ${optimizeStage === 'initial' ? 'bg-[#FFF5EE] border-[#D96B43] text-[#2C2623] font-bold' : 'bg-[#FAF8F5] border-[#EADBCE] text-stone-400'}`}>
                  1. Detachment (180ms)
                </div>
                <div className={`p-2.5 rounded-xl border transition-all ${optimizeStage === 'detaching' ? 'bg-[#FFF5EE] border-[#D96B43] text-[#2C2623] font-bold' : 'bg-[#FAF8F5] border-[#EADBCE] text-stone-400'}`}>
                  2. Kinetic Drift (440ms)
                </div>
                <div className={`p-2.5 rounded-xl border transition-all ${optimizeStage === 'reordering' ? 'bg-[#FFF5EE] border-[#D96B43] text-[#2C2623] font-bold' : 'bg-[#FAF8F5] border-[#EADBCE] text-stone-400'}`}>
                  3. Path Untangle (280ms)
                </div>
                <div className={`p-2.5 rounded-xl border transition-all ${optimizeStage === 'settled' ? 'bg-[#E8F5E9] border-[#2A9D8F] text-[#1B4D3E] font-bold' : 'bg-[#FAF8F5] border-[#EADBCE] text-stone-400'}`}>
                  4. Locked (-48 mins saved)
                </div>
              </div>
            </div>

            {/* Live Interactive Visualization Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Interactive Timeline Items Reorganizing */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-4">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-[#F0EBE1]">
                  <span className="font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Timeline Sequence (Day 1: Hiroshima Central)
                  </span>
                  <span className="font-mono font-bold text-[#D96B43]">
                    {optimizeStage === 'settled' ? 'Saved: 48m transit' : 'Total Transit: 1h 42m'}
                  </span>
                </div>

                <div className="space-y-3 relative min-h-[340px]">
                  {/* Item 1 */}
                  <div
                    style={{
                      transform: optimizeStage === 'detaching'
                        ? 'scale(1.02) translateY(-2px)'
                        : optimizeStage === 'reordering' || optimizeStage === 'settled'
                        ? 'translateY(0px)'
                        : 'translateY(0px)',
                      transition: 'all 0.5s cubic-bezier(0.2, 0.0, 0, 1.0)',
                    }}
                    className={`p-4 rounded-2xl border transition-all ${
                      optimizeStage === 'settled'
                        ? 'bg-[#FDFBF7] border-[#2A9D8F]'
                        : optimizeStage === 'detaching'
                        ? 'bg-[#FAF5EE] border-[#D96B43] shadow-md'
                        : 'bg-[#FAF8F5] border-[#EADBCE]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#2C2623] text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-[#2C2623]">Hiroshima Peace Memorial Park</h4>
                          <p className="text-xs text-[#716458]">09:00 AM · Central Naka-ku</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-[#8C7A6B] bg-white px-2.5 py-1 rounded-lg border border-[#EADBCE]">
                        Anchor Origin
                      </span>
                    </div>
                  </div>

                  {/* Transit Indicator 1 */}
                  <div className="pl-6 flex items-center gap-2 text-xs text-[#8C7A6B]">
                    <span className="w-1.5 h-6 border-l-2 border-dashed border-[#D96B43]/60" />
                    {optimizeStage === 'settled' ? (
                      <span className="text-[#2A9D8F] font-bold bg-[#E8F5E9] px-2 py-0.5 rounded-md animate-in fade-in">
                        ⚡ 2 min walk across bridge (Was 25 min tram ride)
                      </span>
                    ) : (
                      <span>25 min tram ride across town</span>
                    )}
                  </div>

                  {/* Item 2 (Swaps position in optimization!) */}
                  <div
                    style={{
                      transform: optimizeStage === 'detaching'
                        ? 'scale(1.04) translateY(-4px)'
                        : optimizeStage === 'reordering' || optimizeStage === 'settled'
                        ? 'translateY(0px)'
                        : 'translateY(0px)',
                      transition: 'all 0.65s cubic-bezier(0.2, 0.0, 0, 1.0)',
                    }}
                    className={`p-4 rounded-2xl border transition-all ${
                      optimizeStage === 'settled'
                        ? 'bg-[#FFFDF9] border-[#2A9D8F] shadow-sm'
                        : optimizeStage === 'detaching'
                        ? 'bg-[#FFF5EE] border-[#D96B43] shadow-lg'
                        : 'bg-[#FAF8F5] border-[#EADBCE]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center transition-colors ${optimizeStage === 'settled' ? 'bg-[#2A9D8F]' : 'bg-[#D96B43]'}`}>
                          {optimizeStage === 'settled' ? '2' : '4'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[#2C2623]">Atomic Bomb Dome (Genbaku Dome)</h4>
                            {optimizeStage === 'settled' && (
                              <span className="text-[10px] font-bold text-white bg-[#2A9D8F] px-1.5 py-0.5 rounded">
                                Relocated Next Door
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#716458]">Immediately across the river</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#D96B43]">
                        {optimizeStage === 'settled' ? '10:45 AM' : '04:30 PM'}
                      </span>
                    </div>
                  </div>

                  {/* Transit Indicator 2 */}
                  <div className="pl-6 flex items-center gap-2 text-xs text-[#8C7A6B]">
                    <span className="w-1.5 h-6 border-l-2 border-dashed border-[#D96B43]/60" />
                    <span>3 min walk</span>
                  </div>

                  {/* Item 3 */}
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#2C2623] text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-[#2C2623]">Orizuru Tower Observation Deck</h4>
                          <p className="text-xs text-[#716458]">11:45 AM · Paper Crane Wall & Café</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#716458]">Adjacent</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Geographic Map Trace & Motion Breakdown */}
              <div className="lg:col-span-5 space-y-4">
                {/* Simulated Geographic Path untangling */}
                <div className="bg-[#2C2623] text-white rounded-3xl p-5 border border-[#3E3530] shadow-sm">
                  <div className="flex items-center justify-between text-xs text-stone-300 pb-3 border-b border-white/10">
                    <span className="font-bold uppercase tracking-wider text-[#E89E78] flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Geographic Path Topology</span>
                    </span>
                    <span>Kinetic Settle</span>
                  </div>

                  <div className="py-6 flex flex-col items-center justify-center relative">
                    <svg viewBox="0 0 280 140" className="w-full h-36">
                      {/* Grid background */}
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      </pattern>
                      <rect width="280" height="140" fill="url(#grid)" />

                      {/* Route Path: Before vs After */}
                      {optimizeStage === 'settled' ? (
                        // Smooth clean direct route
                        <path
                          d="M 40 70 Q 100 35 150 50 T 240 75"
                          fill="none"
                          stroke="#2A9D8F"
                          strokeWidth="3.5"
                          strokeDasharray="6 3"
                          className="animate-in fade-in"
                        />
                      ) : (
                        // Disjointed criss-crossing path
                        <path
                          d="M 40 70 L 220 30 L 110 110 L 240 75"
                          fill="none"
                          stroke="#E89E78"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                          opacity={optimizeStage === 'detaching' ? '0.3' : '1'}
                          className="transition-opacity duration-300"
                        />
                      )}

                      {/* Pins */}
                      <circle cx="40" cy="70" r="6" fill="#FFFDF9" stroke="#D96B43" strokeWidth="3" />
                      <circle cx="150" cy="50" r="6" fill={optimizeStage === 'settled' ? '#2A9D8F' : '#E89E78'} stroke="#FFFDF9" strokeWidth="2" />
                      <circle cx="240" cy="75" r="6" fill="#FFFDF9" stroke="#2C2623" strokeWidth="2.5" />
                    </svg>

                    <div className="text-center mt-2">
                      <span className="text-xs font-mono font-bold text-[#E89E78]">
                        {optimizeStage === 'settled' ? '✓ Circuit Straightened · 0 Backtracks' : '⚠️ 2 Inefficient City Backtracks Detected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* The Motion Specification Explainer */}
                <div className="bg-[#FAF5EE] rounded-3xl p-5 border border-[#EADBCE] text-xs space-y-2.5">
                  <div className="font-bold text-[#2C2623] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
                    <span>Why This Interaction Exists</span>
                  </div>
                  <p className="text-[#716458] leading-relaxed">
                    Instant page reflows cause cognitive disorientation. By giving stops physical inertia and translating them past each other on offset Z-planes, the traveler witnesses the elimination of geographic backtracking with their own eyes.
                  </p>
                  <div className="pt-2 border-t border-[#EADBCE] flex items-center justify-between text-[#8C7A6B]">
                    <span>Token: <code className="font-mono text-[#2C2623]">motion.spring.lazy</code></span>
                    <span>Mass: 1.4 · Zeta: 0.92</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 1: IMPORT & VISIBLE ASSEMBLY */}
        {/* ========================================================================= */}
        {activeTab === 'import' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0EBE1] pb-5">
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                    Flow 1 · Spatial Ingestion & Projection
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                    Itinerary Import (Visible Assembly)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#716458] mt-1">
                    Raw text does not jump into a database. It breathes, tokenizes into place pills, projects onto coordinates, and crystallizes into tickets.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setImportStage(0)}
                    className="p-2.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] text-[#5C473A] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={runImportSequence}
                    disabled={isImportPlaying}
                    className="px-5 py-2.5 rounded-xl bg-[#D96B43] hover:bg-[#C85327] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Assembly Flow</span>
                  </button>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4 text-[11px]">
                {['1. Raw Paste', '2. Entity Extraction', '3. Map Projection', '4. Route Weave', '5. Crystallize'].map((label, idx) => (
                  <div
                    key={label}
                    className={`p-2 rounded-xl border text-center font-semibold transition-all ${
                      importStage === idx
                        ? 'bg-[#2C2623] text-white border-[#2C2623] shadow-xs'
                        : importStage > idx
                        ? 'bg-[#E8F5E9] text-[#1B4D3E] border-[#2A9D8F]'
                        : 'bg-[#FAF8F5] text-stone-400 border-[#EADBCE]'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Stage Animation Display */}
            <div className="bg-[#FAF5EE] rounded-3xl p-6 border border-[#EADBCE] min-h-[380px] flex flex-col justify-center items-center relative overflow-hidden">
              {importStage === 0 && (
                <div className="w-full max-w-lg bg-white p-5 rounded-2xl border border-[#EADBCE] shadow-xs space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">Pasted Traveler Notes:</div>
                  <div className="p-3 bg-[#FAF8F5] rounded-xl font-mono text-xs text-[#2C2623] leading-relaxed border border-[#EADBCE]">
                    "Day 2 in Miyajima: Take 9am ferry from Miyajimaguchi, photograph floating Great Torii Gate, hike up Mount Misen ropeway around 11:30, and grab grilled oysters at Omotesando shopping street."
                  </div>
                  <div className="text-[11px] text-[#716458] flex items-center gap-1.5">
                    <MousePointer className="w-3.5 h-3.5 text-[#D96B43]" />
                    <span>Click "Run Assembly Flow" above to watch Béa extract and anchor this trip.</span>
                  </div>
                </div>
              )}

              {importStage === 1 && (
                <div className="w-full max-w-lg space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D96B43]">
                      Extracting Geographic Tokens...
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 justify-center">
                    {['Miyajimaguchi Pier', 'Itsukushima Great Torii', 'Mount Misen Ropeway', 'Omotesando Shopping Arcade'].map((place, idx) => (
                      <div
                        key={place}
                        style={{ animationDelay: `${idx * 150}ms` }}
                        className="px-4 py-2 rounded-2xl bg-white border-2 border-[#D96B43] text-xs font-bold text-[#2C2623] shadow-md flex items-center gap-2 animate-in slide-in-from-bottom-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#D96B43]" />
                        <span>{place}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStage >= 2 && importStage <= 3 && (
                <div className="w-full max-w-xl bg-[#2C2623] p-6 rounded-3xl text-white border border-white/10 shadow-lg relative animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-stone-300 pb-3 border-b border-white/10">
                    <span className="font-bold text-[#E89E78]">Geographic Pin Elevation & Landing</span>
                    <span>{importStage === 3 ? 'Tracing Road Network...' : 'Touchdown Shockwaves'}</span>
                  </div>
                  <div className="h-44 relative flex items-center justify-around">
                    {['Pier (09:00)', 'Floating Torii (09:30)', 'Misen Ropeway (11:30)', 'Omotesando (13:30)'].map((p, i) => (
                      <div key={p} className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                        <div className="w-7 h-7 rounded-full bg-[#D96B43] text-white text-xs font-bold flex items-center justify-center ring-4 ring-white/20 animate-pulse">
                          {i + 1}
                        </div>
                        <span className="text-[10px] text-stone-300 text-center max-w-[80px] leading-tight mt-1">{p}</span>
                      </div>
                    ))}
                    {importStage === 3 && (
                      <div className="absolute inset-x-8 top-12 h-1 bg-[#2A9D8F] rounded-full animate-in slide-in-from-left duration-700" />
                    )}
                  </div>
                </div>
              )}

              {importStage === 4 && (
                <div className="w-full max-w-lg space-y-3 animate-in fade-in duration-300">
                  <div className="text-center mb-2">
                    <span className="text-xs font-bold text-[#2A9D8F] bg-[#E8F5E9] px-3 py-1 rounded-full border border-[#2A9D8F]/30">
                      ✓ Assembled into Synchronized Day Timeline
                    </span>
                  </div>
                  {['09:00 AM · Miyajima Ferry Crossing', '09:30 AM · Itsukushima Great Torii Gate', '11:30 AM · Mount Misen Ropeway Summit'].map((item, i) => (
                    <div key={item} className="p-3.5 bg-white rounded-2xl border border-[#EADBCE] shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#2C2623] text-white text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </div>
                        <span className="text-xs font-bold text-[#2C2623]">{item}</span>
                      </div>
                      <span className="text-[10px] text-[#8C7A6B] font-medium">Mapped & Ready</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 2: ADD STOP (IN-SITU TIMELINE BUDDING) */}
        {/* ========================================================================= */}
        {activeTab === 'add-stop' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 2 · Zero-Modal Insertion
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Add Stop: In-Situ Timeline Budding
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Tapping add does not sever spatial memory with a modal window. The adjacent items part elastically, and the new stop buds directly from the connecting spine.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-4">
              {/* Stop 1 */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EADBCE]">
                <div className="text-xs font-mono font-bold text-[#D96B43]">10:00 AM</div>
                <div className="text-sm font-bold text-[#2C2623]">Peace Memorial Park Walk</div>
              </div>

              {/* Insertion Node on Transit Spine */}
              <div className="py-2 flex flex-col items-center justify-center relative">
                <div className={`w-0.5 bg-[#D96B43] transition-all duration-300 ${isAddBudding ? 'h-8' : 'h-4'}`} />
                <button
                  onClick={() => setIsAddBudding(!isAddBudding)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1 ${
                    isAddBudding
                      ? 'bg-[#2C2623] text-white scale-105'
                      : 'bg-[#FFF5EE] text-[#D96B43] border border-[#FCD9C6] hover:scale-105'
                  }`}
                >
                  <span>{isAddBudding ? '✕ Collapse Slot' : '+ Add Stop Between'}</span>
                </button>
                <div className={`w-0.5 bg-[#D96B43] transition-all duration-300 ${isAddBudding ? 'h-8' : 'h-4'}`} />
              </div>

              {/* Budding Card Container */}
              {isAddBudding && (
                <div className="p-4 rounded-2xl bg-[#FFFDF9] border-2 border-dashed border-[#D96B43] shadow-md space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between text-xs text-[#D96B43] font-bold">
                    <span>Budding In-Situ Slot</span>
                    <span className="text-[10px] bg-[#FFF5EE] px-2 py-0.5 rounded">11:15 AM Window</span>
                  </div>
                  <input
                    type="text"
                    defaultValue="Orizuru Tower Café & Pastry"
                    placeholder="Search venue or activity..."
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-[#EADBCE] bg-white outline-none focus:border-[#D96B43]"
                  />
                  <div className="text-[10px] text-[#8C7A6B] flex items-center gap-1">
                    <Check className="w-3 h-3 text-[#2A9D8F]" />
                    <span>Transit recalculates live without closing this view</span>
                  </div>
                </div>
              )}

              {/* Stop 2 */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EADBCE]">
                <div className="text-xs font-mono font-bold text-[#D96B43]">12:30 PM</div>
                <div className="text-sm font-bold text-[#2C2623]">Okonomiyaki Lunch Reservation</div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 3: REORDER PHYSICS */}
        {/* ========================================================================= */}
        {activeTab === 'reorder' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 3 · Direct Manipulation Kinematics
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Reorder Stop Physics & Velocity Tilt
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Lift scales the item up to 1.035, applies an inertia rotation tilt based on horizontal drag velocity, and reflows neighboring slots with damped springs.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8C7A6B] pb-2 border-b border-[#F0EBE1]">
                <span>Click & hold or drag test:</span>
                <span>Tilt Angle: {dragTilt.toFixed(1)}°</span>
              </div>

              {reorderItems.map((item, idx) => {
                const isDragging = draggedIndex === idx;
                return (
                  <div
                    key={item.id}
                    onMouseDown={() => {
                      setDraggedIndex(idx);
                      setDragTilt(idx % 2 === 0 ? 3.2 : -2.8);
                    }}
                    onMouseUp={() => {
                      setDraggedIndex(null);
                      setDragTilt(0);
                    }}
                    style={{
                      transform: isDragging
                        ? `scale(1.04) rotate(${dragTilt}deg) translateY(-4px)`
                        : 'scale(1) rotate(0deg) translateY(0)',
                      transition: isDragging
                        ? 'transform 0.1s ease-out'
                        : 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
                    }}
                    className={`p-4 rounded-2xl border cursor-grab select-none transition-shadow ${
                      isDragging
                        ? 'bg-[#FFF5EE] border-[#D96B43] shadow-xl z-20 ring-2 ring-[#D96B43]/30'
                        : 'bg-[#FAF8F5] border-[#EADBCE] hover:border-[#D96B43]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#2C2623] text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#2C2623]">{item.title}</h4>
                          <span className="text-[10px] text-[#716458]">{item.time} · {item.duration}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">
                        {isDragging ? 'Lifting' : 'Press to Drag'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 4: IN-SITU EDIT STOP */}
        {/* ========================================================================= */}
        {activeTab === 'edit-stop' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 4 · In-Situ Morphing
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Stop Expansion: Zero Context Switches
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Tapping a card expands its geometry smoothly in place. Typography cross-fades optically without pixel blur.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-3">
              <div
                onClick={() => setIsEditExpanded(!isEditExpanded)}
                style={{
                  transition: 'all 0.4s cubic-bezier(0.2, 0.0, 0, 1.0)',
                }}
                className={`p-4 rounded-2xl border cursor-pointer ${
                  isEditExpanded
                    ? 'bg-[#2A231F] text-white border-[#D96B43] shadow-lg'
                    : 'bg-[#FAF8F5] text-[#2C2623] border-[#EADBCE] hover:border-[#D96B43]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-mono font-bold ${isEditExpanded ? 'text-[#E89E78]' : 'text-[#D96B43]'}`}>
                      09:30 AM
                    </span>
                    <h3 className="font-display text-base font-bold leading-snug">
                      Itsukushima Floating Torii Gate
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-300 ${
                      isEditExpanded ? 'rotate-180 text-[#E89E78]' : 'text-[#8C7A6B]'
                    }`}
                  />
                </div>

                {/* Staggered Expanded Details Reveal */}
                {isEditExpanded && (
                  <div className="mt-4 pt-3 border-t border-white/10 space-y-3 text-xs animate-in fade-in duration-200">
                    <p className="text-stone-300 text-[11px] leading-relaxed">
                      High tide is at 10:14 AM — the shrine appears to float on the bay. Walk across the sandy seabed during low tide in the late afternoon.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
                      <span className="text-[#2A9D8F] font-semibold">✓ Ferry Ticket Stored</span>
                      <span className="text-stone-400">Tap again to collapse</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 5: DAY SWITCHING (SPATIAL JOURNAL) */}
        {/* ========================================================================= */}
        {activeTab === 'day-switch' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 5 · Spatial Journal Metaphor
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Day Switching: Turning Bound Pages
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Day transitions travel along the horizontal X/Z axis like turning pages in a travel journal, accompanied by a ballistic map altitude curve.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-center gap-2 bg-[#FAF5EE] p-1.5 rounded-2xl border border-[#EADBCE]">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDaySwitch(d)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeJournalDay === d
                        ? 'bg-[#2C2623] text-white shadow-xs'
                        : 'text-[#716458] hover:text-[#2C2623]'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>

              {/* Journal Sheet with X/Z rotation */}
              <div
                style={{
                  transform: isDayTransitioning
                    ? 'translateX(-30px) scale(0.95) rotateY(-8deg)'
                    : 'translateX(0px) scale(1.0) rotateY(0deg)',
                  transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                  transformStyle: 'preserve-3d',
                }}
                className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-md min-h-[220px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#8C7A6B] pb-2 border-b border-[#F0EBE1]">
                    <span>JOURNAL PAGE</span>
                    <span className="font-mono font-bold text-[#D96B43]">Day {activeJournalDay} of 3</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#2C2623] mt-2">
                    {activeJournalDay === 1
                      ? 'Hiroshima Memorial & Downtown Eats'
                      : activeJournalDay === 2
                      ? 'Miyajima Island & Shrine Ascent'
                      : 'Onomichi Temple Walk & Cycling Coast'}
                  </h3>
                  <p className="text-xs text-[#716458] mt-1">
                    {activeJournalDay === 1
                      ? '3 scheduled stops · 1.8 km total walking distance'
                      : activeJournalDay === 2
                      ? '4 scheduled stops · Ferry crossing + ropeway summit'
                      : '2 scheduled stops · Scenic coastal seaside line'}
                  </p>
                </div>
                <div className="text-[11px] text-[#8C7A6B] pt-3 border-t border-[#F0EBE1] flex items-center justify-between">
                  <span>Camera Arc: Ballistic Zoom</span>
                  <span className="text-[#2A9D8F] font-semibold">Synchronized</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 6: MAP ↔ TIMELINE SYNCHRONIZATION */}
        {/* ========================================================================= */}
        {activeTab === 'map-sync' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 6 · Bi-Directional Kinetic Resonance
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Map ↔ Timeline Synchronized Selection
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Selecting a pin leaps the marker and scrolls the card. Selecting a card pans the map camera and casts a shockwave wave.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* Simulated Map View */}
              <div className="bg-[#2C2623] text-white rounded-3xl p-5 border border-[#3E3530] shadow-sm flex flex-col justify-between h-64">
                <div className="flex items-center justify-between text-xs text-stone-300">
                  <span className="font-bold text-[#E89E78]">MAP SURFACE</span>
                  <span className="text-[10px]">Click any pin:</span>
                </div>

                <div className="flex items-center justify-around py-4">
                  {[
                    { id: 'stop-1', label: '1' },
                    { id: 'stop-2', label: '2' },
                    { id: 'stop-3', label: '3' },
                  ].map((pin) => {
                    const isSelected = selectedPinId === pin.id;
                    return (
                      <button
                        key={pin.id}
                        onClick={() => {
                          setSelectedPinId(pin.id);
                          setPinPulse(true);
                          setTimeout(() => setPinPulse(false), 300);
                        }}
                        style={{
                          transform: isSelected ? 'scale(1.3) translateY(-6px)' : 'scale(1) translateY(0)',
                          transition: 'all 0.24s cubic-bezier(0.2, 0.0, 0, 1.0)',
                        }}
                        className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#D96B43] text-white shadow-xl ring-4 ring-white/30'
                            : 'bg-white text-[#2C2623]'
                        }`}
                      >
                        {pin.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-[10px] text-stone-400 text-center">
                  Map camera centers on visible centroid above sheet
                </span>
              </div>

              {/* Simulated Timeline View */}
              <div className="bg-white rounded-3xl p-5 border border-[#EADBCE] shadow-xs flex flex-col justify-around h-64">
                {[
                  { id: 'stop-1', title: '1. Peace Memorial Park' },
                  { id: 'stop-2', title: '2. Atomic Bomb Dome' },
                  { id: 'stop-3', title: '3. Okonomiyaki Dinner' },
                ].map((item) => {
                  const isSelected = selectedPinId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPinId(item.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#FFF5EE] border-[#D96B43] font-bold text-[#2C2623] shadow-xs'
                          : 'bg-[#FAF8F5] border-[#EADBCE] text-[#716458]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.title}</span>
                        {isSelected && <span className="text-[10px] text-[#D96B43]">✓ In Focus</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 7: SPLIT VIEW ORCHESTRATION */}
        {/* ========================================================================= */}
        {activeTab === 'split-view' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 7 · Adaptive Density Surface
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Split View: Real-Time Viewport Balance
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Zero-latency dragging of the divider collapses map labels into dots when compressed, and expands timeline rows into rich cards when widened.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8C7A6B]">
                <span>Timeline: {splitRatio}%</span>
                <span>Map: {100 - splitRatio}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                value={splitRatio}
                onChange={(e) => setSplitRatio(Number(e.target.value))}
                className="w-full accent-[#D96B43] cursor-ew-resize"
              />

              <div className="h-64 rounded-3xl border border-[#EADBCE] overflow-hidden flex shadow-sm">
                {/* Timeline Side */}
                <div
                  style={{ width: `${splitRatio}%` }}
                  className="bg-white p-4 border-r border-[#EADBCE] flex flex-col justify-center transition-all overflow-hidden"
                >
                  <span className="text-xs font-bold text-[#2C2623]">Timeline Pane</span>
                  <p className="text-[11px] text-[#716458] mt-1">
                    {splitRatio > 45
                      ? 'Expanded: Shows high-res thumbnails, stay estimates & insider tips'
                      : 'Compact: Condensed rows'}
                  </p>
                </div>

                {/* Map Side */}
                <div
                  style={{ width: `${100 - splitRatio}%` }}
                  className="bg-[#2C2623] text-white p-4 flex flex-col justify-center transition-all overflow-hidden"
                >
                  <span className="text-xs font-bold text-[#E89E78]">Map Pane</span>
                  <p className="text-[11px] text-stone-300 mt-1">
                    {100 - splitRatio < 35
                      ? 'Density Mode: Minimal dots'
                      : 'Full Mode: Rich pin cards'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 9: COMPARE ITINERARIES (MORPHING DIFF) */}
        {/* ========================================================================= */}
        {activeTab === 'compare' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 9 · Morphing Diff Engine
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Compare Itineraries: The Anchor Rule
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Stops identical in both options <span className="font-bold text-[#2C2623]">do not move or flash</span>. Only true differences slide in or out.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-center gap-2 bg-[#FAF5EE] p-1.5 rounded-2xl border border-[#EADBCE]">
                <button
                  onClick={() => setActivePlanOption('A')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activePlanOption === 'A' ? 'bg-[#2C2623] text-white' : 'text-[#716458]'
                  }`}
                >
                  Plan A (Relaxed Scenic)
                </button>
                <button
                  onClick={() => setActivePlanOption('B')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activePlanOption === 'B' ? 'bg-[#2C2623] text-white' : 'text-[#716458]'
                  }`}
                >
                  Plan B (Active Explorer)
                </button>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-3">
                {/* Anchor stop (Always static) */}
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EADBCE] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2623]">09:00 AM · Peace Memorial Park</span>
                  <span className="text-[10px] bg-stone-200 text-stone-600 px-2 py-0.5 rounded font-bold">
                    Anchor (Unchanged)
                  </span>
                </div>

                {/* Conditional Stop */}
                {activePlanOption === 'A' ? (
                  <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#2A9D8F] flex items-center justify-between animate-in slide-in-from-left duration-250">
                    <span className="text-xs font-bold text-[#1B4D3E]">11:30 AM · Shukkeien Traditional Garden</span>
                    <span className="text-[10px] text-[#2A9D8F] font-bold">Plan A Exclusive</span>
                  </div>
                ) : (
                  <div className="p-3 bg-[#FFF5EE] rounded-xl border border-[#D96B43] flex items-center justify-between animate-in slide-in-from-right duration-250">
                    <span className="text-xs font-bold text-[#C85327]">11:00 AM · Mount Misen Summit Hike</span>
                    <span className="text-[10px] text-[#D96B43] font-bold">Plan B Exclusive</span>
                  </div>
                )}

                {/* Evening Anchor */}
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EADBCE] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2623]">06:00 PM · Okonomimura Dinner</span>
                  <span className="text-[10px] bg-stone-200 text-stone-600 px-2 py-0.5 rounded font-bold">
                    Anchor (Unchanged)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW 10: ACTIVE TRIP PROGRESSION */}
        {/* ========================================================================= */}
        {activeTab === 'active-trip' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Flow 10 · Live Progression Choreography
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Active Trip: Current → Next Stop Progression
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Marking a stop complete softens the previous card, sends an energetic pulse down the transit spine, and elevates the "Leave By" card.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8C7A6B]">Live Status Simulator</span>
                <button
                  onClick={() => setActiveStopStep(activeStopStep === 1 ? 2 : 1)}
                  className="px-3 py-1 bg-[#D96B43] text-white rounded-lg text-xs font-bold hover:bg-[#C85327] transition-all"
                >
                  {activeStopStep === 1 ? 'Depart / Complete Stop' : 'Reset to Stop 1'}
                </button>
              </div>

              {/* Stop 1 (Completed or Current) */}
              <div
                style={{
                  transform: activeStopStep === 2 ? 'scale(0.97) translateY(-4px)' : 'scale(1)',
                  transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
                }}
                className={`p-4 rounded-2xl border ${
                  activeStopStep === 2
                    ? 'bg-[#FAF8F5] text-stone-400 border-stone-200'
                    : 'bg-[#2A231F] text-white border-[#D96B43] shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#E89E78]">
                      {activeStopStep === 2 ? '✓ Completed' : '📍 Currently Here'}
                    </span>
                    <h3 className="font-bold text-sm">Peace Memorial Park</h3>
                  </div>
                  {activeStopStep === 2 && (
                    <CheckCircle2 className="w-5 h-5 text-[#2A9D8F]" />
                  )}
                </div>
              </div>

              {/* Energy Pulse on Spine */}
              <div className="py-2 flex items-center justify-center relative">
                <div className={`w-1 h-10 rounded-full transition-all duration-500 ${
                  activeStopStep === 2 ? 'bg-[#D96B43] ring-4 ring-[#D96B43]/30 animate-pulse' : 'bg-stone-200'
                }`} />
              </div>

              {/* Stop 2 (Elevating to Current) */}
              <div
                style={{
                  transform: activeStopStep === 2 ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.35s cubic-bezier(0.2, 0.0, 0, 1.0)',
                }}
                className={`p-4 rounded-2xl border ${
                  activeStopStep === 2
                    ? 'bg-[#2A231F] text-white border-[#D96B43] shadow-xl'
                    : 'bg-white text-[#2C2623] border-[#EADBCE]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${
                      activeStopStep === 2 ? 'text-[#E89E78]' : 'text-[#8C7A6B]'
                    }`}>
                      {activeStopStep === 2 ? '📍 Now Active Focus' : 'Up Next'}
                    </span>
                    <h3 className="font-bold text-sm">Orizuru Tower Observation Deck</h3>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    activeStopStep === 2 ? 'bg-[#FFF5EE] text-[#C85327] animate-bounce' : 'bg-[#FAF5EE] text-[#716458]'
                  }`}>
                    Leave by 10:45 AM
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BÉA MASCOT KINEMATICS STUDIO */}
        {/* ========================================================================= */}
        {activeTab === 'mascot' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Mascot Motion Architecture · Exactly 5 Purposeful States
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Béa Mascot Kinematics Studio
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Béa is an intelligent, observant travel companion — never a distracting cartoon. Béa never dances, never bounces uncontrollably, and appears only when meaningful.
              </p>
            </div>

            {/* Mascot Interactive Studio */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left: Interactive State Switcher & Live Canvas */}
              <div className="md:col-span-6 bg-white rounded-3xl p-8 border border-[#EADBCE] shadow-xs flex flex-col items-center justify-center space-y-6 text-center">
                <div className="flex flex-wrap gap-2 justify-center">
                  {(['idle', 'thinking', 'sniffing', 'running', 'found'] as MascotState[]).map((state) => (
                    <button
                      key={state}
                      onClick={() => setMascotState(state)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                        mascotState === state
                          ? 'bg-[#2C2623] text-white shadow-xs scale-105'
                          : 'bg-[#FAF5EE] text-[#5C473A] border border-[#EADBCE] hover:bg-[#F2EDE4]'
                      }`}
                    >
                      {state === 'found' ? 'Found It! ✨' : state}
                    </button>
                  ))}
                </div>

                {/* Simulated Character Stage with Physical Micro-Motion */}
                <div className="w-48 h-48 rounded-full bg-[#FAF5EE] border-2 border-[#EADBCE] flex items-center justify-center relative shadow-inner overflow-hidden">
                  <div
                    style={{
                      transform: mascotState === 'thinking'
                        ? 'rotate(6deg) translateY(-2px)'
                        : mascotState === 'sniffing'
                        ? 'scaleX(1.05) translateY(4px)'
                        : mascotState === 'running'
                        ? 'translateY(-4px) rotate(-3deg)'
                        : mascotState === 'found'
                        ? 'scale(1.1) translateY(-6px)'
                        : 'translateY(0px)',
                      transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
                    }}
                    className={`transition-all ${mascotState === 'idle' ? 'animate-pulse duration-1000' : ''}`}
                  >
                    <MascotAvatar size="lg" className="w-24 h-24 ring-4 ring-white shadow-md" />
                  </div>

                  {/* Contextual sparkle for Found state */}
                  {mascotState === 'found' && (
                    <div className="absolute top-4 right-8 text-[#D96B43] animate-bounce">
                      ✨
                    </div>
                  )}

                  {/* Footfall trail for running state */}
                  {mascotState === 'running' && (
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 text-[#D96B43] opacity-60">
                      <Footprints className="w-4 h-4 animate-ping" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-lg font-bold text-[#2C2623] capitalize">
                    Current Pose: {mascotState}
                  </h3>
                  <p className="text-xs text-[#716458] mt-0.5">
                    {mascotState === 'idle' && 'Calm 3.6s breath cycle with occasional 3° ear perk'}
                    {mascotState === 'thinking' && 'Head tilted 6°, eyes soft, evaluating route options'}
                    {mascotState === 'sniffing' && 'Nose twitches in rapid 3-bursts (80ms), deep link extraction'}
                    {mascotState === 'running' && 'Forward lope (540ms loop), streamlined aerodynamics'}
                    {mascotState === 'found' && 'Proud seated pop (-4px), crisp nod, double tail wag'}
                  </p>
                </div>
              </div>

              {/* Right: Technical Spec for Mascot States */}
              <div className="md:col-span-6 space-y-3">
                {[
                  {
                    title: '1. Idle (Attentive Companion)',
                    timing: '3600ms breath cycle · 3° ear perk every 6-8s',
                    why: 'Signals system readiness and companionship without competing for visual attention.',
                  },
                  {
                    title: '2. Thinking (Contemplative & Focused)',
                    timing: '240ms head tilt · 2200ms calm breath',
                    why: 'Reassures traveler that the agent is evaluating complex trade-offs thoughtfully.',
                  },
                  {
                    title: '3. Sniffing (Deep Search / Extraction)',
                    timing: '80ms nose bursts · X-axis data band scan',
                    why: 'Personifies raw parsing and ticket verification as an intuitive physical trail search.',
                  },
                  {
                    title: '4. Running (Pathfinding & Long Distance)',
                    timing: '540ms gait loop · 3px clamped vertical bounce',
                    why: 'Communicates spatial distance and physical travel effort during multi-city queries.',
                  },
                  {
                    title: '5. Found It! (Quiet Confirmation)',
                    timing: '180ms nod · 2 calm tail sweeps · Settle at 600ms',
                    why: 'Provides crisp, satisfying closure to an agent operation without annoying modal popups.',
                  },
                ].map((spec) => (
                  <div key={spec.title} className="p-4 bg-white rounded-2xl border border-[#EADBCE] shadow-2xs">
                    <h4 className="text-xs font-bold text-[#2C2623]">{spec.title}</h4>
                    <p className="text-[11px] font-mono text-[#D96B43] mt-0.5">{spec.timing}</p>
                    <p className="text-[11px] text-[#716458] mt-1 leading-relaxed">{spec.why}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SPRINGS & KINEMATICS LAB */}
        {/* ========================================================================= */}
        {activeTab === 'springs' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFF5EE] text-[#C85327] border border-[#FCD9C6] text-xs font-bold">
                Newtonian Springs Playground · Token Verification
              </span>
              <h2 className="font-display text-2xl font-bold text-[#2C2623] mt-1.5">
                Harmonic Oscillator & Motion Token Lab
              </h2>
              <p className="text-xs sm:text-sm text-[#716458] mt-1">
                Zero arbitrary cubic-bezier easing for interruptible elements. Béa runs on physical springs defined by Mass, Stiffness, and Damping.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Preset Selector & Test Stage */}
              <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'instant', name: 'Instant (120ms)', m: 0.5, k: 900, d: 45 },
                    { id: 'snappy', name: 'Snappy (240ms)', m: 0.8, k: 450, d: 35 },
                    { id: 'fluid', name: 'Fluid (380ms)', m: 1.0, k: 280, d: 26 },
                    { id: 'spatial', name: 'Spatial (520ms)', m: 1.2, k: 180, d: 23 },
                    { id: 'lazy', name: 'Lazy (680ms)', m: 1.4, k: 120, d: 21 },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSpringPreset(preset.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        springPreset === preset.id
                          ? 'bg-[#2C2623] text-white shadow-xs'
                          : 'bg-[#FAF5EE] text-[#5C473A] border border-[#EADBCE]'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="h-44 bg-[#FAF5EE] rounded-2xl border border-[#EADBCE] p-4 flex items-center justify-between relative overflow-hidden">
                  <div className="text-xs text-[#8C7A6B]">Origin (0px)</div>

                  {/* Physics Block */}
                  <div
                    style={{
                      transform: springTestActive ? 'translateX(-10px)' : 'translateX(-220px)',
                      transition: springPreset === 'instant'
                        ? 'transform 0.12s cubic-bezier(0.1, 0.9, 0.2, 1)'
                        : springPreset === 'snappy'
                        ? 'transform 0.24s cubic-bezier(0.15, 1, 0.3, 1)'
                        : springPreset === 'fluid'
                        ? 'transform 0.38s cubic-bezier(0.2, 1, 0.4, 1)'
                        : springPreset === 'spatial'
                        ? 'transform 0.52s cubic-bezier(0.25, 1, 0.5, 1)'
                        : 'transform 0.68s cubic-bezier(0.3, 1, 0.6, 1)',
                    }}
                    className="w-16 h-16 rounded-2xl bg-[#D96B43] text-white font-bold text-xs flex items-center justify-center shadow-lg"
                  >
                    Spring
                  </div>

                  <div className="text-xs text-[#8C7A6B]">Target</div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={triggerSpringTest}
                    className="px-5 py-2.5 rounded-xl bg-[#2C2623] text-white text-xs font-bold hover:bg-[#3E3530] transition-transform active:scale-95 flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#E89E78]" />
                    <span>Fire Spring Animation</span>
                  </button>

                  <span className="text-xs font-mono text-[#716458]">
                    Token: <strong className="text-[#2C2623]">motion.spring.{springPreset}</strong>
                  </span>
                </div>
              </div>

              {/* Tokens Table */}
              <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-[#EADBCE] shadow-xs space-y-4">
                <h3 className="font-display text-base font-bold text-[#2C2623]">
                  Béa Motion Token Spec
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                    <div className="font-bold text-[#2C2623]">Instant (m=0.5, k=900, ζ=1.0)</div>
                    <p className="text-[11px] text-[#716458]">Hit ripples, icon toggles, pin pops</p>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                    <div className="font-bold text-[#2C2623]">Snappy (m=0.8, k=450, ζ=0.88)</div>
                    <p className="text-[11px] text-[#716458]">Direct drag release, timeline slot clears</p>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                    <div className="font-bold text-[#2C2623]">Fluid (m=1.0, k=280, ζ=0.82)</div>
                    <p className="text-[11px] text-[#716458]">Card expansions, sheet detent snaps</p>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                    <div className="font-bold text-[#2C2623]">Spatial (m=1.2, k=180, ζ=0.85)</div>
                    <p className="text-[11px] text-[#716458]">Map camera pan, ballistic flyover, split pane</p>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                    <div className="font-bold text-[#2C2623]">Lazy (m=1.4, k=120, ζ=0.92)</div>
                    <p className="text-[11px] text-[#716458]">Full itinerary cascade re-sort, route optimization</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
