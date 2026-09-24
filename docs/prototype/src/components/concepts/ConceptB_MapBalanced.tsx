import React, { useState } from 'react';
import { DayItinerary, ItineraryItem, TransitLeg, UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../../types';
import { deriveTransitLeg, recalculateItemTimes } from '../../utils/geoUtils';
import { InteractiveMap } from '../InteractiveMap';
import { BeaInsightBanner } from '../BeaInsightBanner';
import { InSituBuddingNode } from '../InSituBuddingNode';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Clock,
  Compass,
  Maximize2,
  Minimize2,
  Navigation,
  Layers,
  Footprints,
  Plus,
  Ticket,
  Sliders
} from 'lucide-react';

interface ConceptBProps {
  day: DayItinerary;
  allDays: DayItinerary[];
  onOpenAddModal: (defaultTime?: string, insertIndex?: number) => void;
  activeItemId: string | null;
  onSelectItem: (id: string) => void;
  onAddItemDirect?: (item: Omit<ItineraryItem, 'id' | 'order'>, index: number) => void;
  preferences?: UserUiPreferences;
  onOpenCustomizeModal?: () => void;
  activeBuddingIndex?: number | null;
  onSetBuddingIndex?: (index: number | null) => void;
}

type SheetSnap = 'peek' | 'half' | 'full';

export const ConceptB_MapBalanced: React.FC<ConceptBProps> = ({
  day,
  allDays,
  onOpenAddModal,
  activeItemId,
  onSelectItem,
  onAddItemDirect,
  preferences,
  onOpenCustomizeModal,
  activeBuddingIndex,
  onSetBuddingIndex
}) => {
  const prefs = preferences || DEFAULT_UI_PREFERENCES;
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [localBuddingIndex, setLocalBuddingIndex] = useState<number | null>(null);
  const effectiveBuddingIndex = activeBuddingIndex !== undefined && activeBuddingIndex !== null
    ? activeBuddingIndex
    : localBuddingIndex;

  const setBuddingSlot = (index: number | null) => {
    setLocalBuddingIndex(index);
    if (onSetBuddingIndex) onSetBuddingIndex(index);
  };

  const items = day.items;

  // Group items by neighborhood to give spatial clarity
  const neighborhoodGroups = items.reduce((acc, item) => {
    const hood = item.neighborhood || 'Central District';
    if (!acc[hood]) {
      acc[hood] = [];
    }
    acc[hood].push(item);
    return acc;
  }, {} as Record<string, ItineraryItem[]>);

  // Responsive split ratio heights (flex-based with generous min-heights to guarantee Leaflet renders)
  const splitStyles: Record<SheetSnap, { map: string; list: string }> = {
    half: { map: 'flex-1 min-h-[260px]', list: 'flex-1 min-h-[200px]' }, // 50/50 Dual View
    peek: { map: 'flex-[2] min-h-[340px]', list: 'flex-1 min-h-[160px]' }, // Map Focus + Floating Card Deck
    full: { map: 'h-[160px] shrink-0', list: 'flex-1 min-h-[280px]' } // List Focus
  };

  const activeIdx = items.findIndex((it) => it.id === activeItemId);
  const currentStopIdx = activeIdx >= 0 ? activeIdx : 0;
  const currentMapStop = items[currentStopIdx] || items[0];
  const nextMapStop = items[currentStopIdx + 1] || null;
  const transitLegToNext = currentMapStop && nextMapStop ? deriveTransitLeg(currentMapStop, nextMapStop) : null;

  const handlePrevStop = () => {
    const prevIdx = (currentStopIdx - 1 + items.length) % items.length;
    onSelectItem(items[prevIdx].id);
  };

  const handleNextStop = () => {
    const nextIdx = (currentStopIdx + 1) % items.length;
    onSelectItem(items[nextIdx].id);
  };

  const handleInsertStop = (itemData: Omit<ItineraryItem, 'id' | 'order'>, insertIndex: number) => {
    if (onAddItemDirect) {
      onAddItemDirect(itemData, insertIndex);
    } else {
      onOpenAddModal(itemData.time, insertIndex);
    }
    setBuddingSlot(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
      {/* Concept B Top Context Bar */}
      <div className="shrink-0 z-30 px-3 sm:px-4 py-2 bg-white border-b border-[#E8DFD3] flex flex-col gap-1.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span className="text-xs sm:text-sm font-bold text-[#2C2623]">
              Synchronized Map & Stops
            </span>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF5EE] border border-[#E8DFD3] text-[#8C7A6B]">
              {items.length} stops
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Split Ratio Toggles */}
            <div className="flex items-center bg-[#FAF5EE] rounded-xl p-0.5 border border-[#E8DFD3] text-[10px] sm:text-xs font-semibold text-[#716458]">
              <button
                type="button"
                onClick={() => setSheetSnap('half')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  sheetSnap === 'half' ? 'bg-[#2A9D8F] text-white shadow-xs font-bold' : 'hover:text-[#2C2623]'
                }`}
              >
                50/50 Dual
              </button>
              <button
                type="button"
                onClick={() => setSheetSnap('peek')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  sheetSnap === 'peek' ? 'bg-[#2C2623] text-white shadow-xs font-bold' : 'hover:text-[#2C2623]'
                }`}
              >
                Map + Cards
              </button>
              <button
                type="button"
                onClick={() => setSheetSnap('full')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  sheetSnap === 'full' ? 'bg-[#2C2623] text-white shadow-xs font-bold' : 'hover:text-[#2C2623]'
                }`}
              >
                List Focus
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const target = currentStopIdx >= 0 ? currentStopIdx + 1 : 1;
                setBuddingSlot(effectiveBuddingIndex === target ? null : target);
              }}
              className="text-xs font-bold text-[#D96B43] hover:text-white hover:bg-[#D96B43] flex items-center gap-1 px-2.5 py-1 bg-[#FAF5EE] rounded-xl border border-[#E8DFD3] hover:border-[#D96B43] transition-all shadow-2xs active:scale-95"
              title="Bud Stop In-Situ (Zero-Modal timeline insertion)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bud Stop</span>
            </button>

            {onOpenCustomizeModal && (
              <button
                type="button"
                onClick={onOpenCustomizeModal}
                className="text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] flex items-center gap-1 px-2.5 py-1 bg-[#FAF5EE] rounded-xl border border-[#E8DFD3] transition-all"
                title="Personalize UI features"
              >
                <Sliders className="w-3.5 h-3.5 text-[#D96B43]" />
                <span className="hidden sm:inline">Customize</span>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Quick Jump Stop Pill Track */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] text-[#8C7A6B] font-semibold shrink-0 uppercase tracking-wider">
            Jump to:
          </span>
          {items.map((it, idx) => {
            const isSel = it.id === currentMapStop.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelectItem(it.id)}
                className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-all ${
                  isSel
                    ? 'bg-[#D96B43] text-white shadow-xs scale-105 font-bold'
                    : 'bg-white text-[#5C473A] border border-[#E8DFD3] hover:border-[#D96B43]'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-black/15 flex items-center justify-center text-[9px]">
                  {idx + 1}
                </span>
                <span>{it.time}</span>
                <span className="truncate max-w-[90px]">{it.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 h-full">
        {/* Top Half: Interactive Route Map + Floating Active Stop Card */}
        <div className={`w-full transition-all duration-300 relative border-b border-[#E8DFD3] shrink-0 min-h-[220px] ${splitStyles[sheetSnap].map}`}>
          <InteractiveMap
            items={items}
            activeItemId={currentMapStop.id}
            onSelectItem={onSelectItem}
            className="w-full h-full"
            showTransitLegs={prefs.showTransitLegs}
            showFlowAnimationControl={prefs.showMapFlowAnimation}
            dayNumber={day.dayNumber}
          />

          {/* Seamless Floating Active Stop Card (Apple Maps Style) */}
          {sheetSnap !== 'full' && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[500] pointer-events-none">
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border border-[#EADBCE] shadow-lg p-2.5 sm:p-3 transition-all hover:shadow-xl">
                <div className="flex items-center justify-between gap-2 text-xs">
                  {/* Stop index & time indicator */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#2C2623] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {currentStopIdx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#D96B43]">
                      {currentMapStop.time}
                    </span>
                    <span className="text-[10px] sm:text-xs text-[#8C7A6B] bg-[#FAF5EE] px-2 py-0.5 rounded-full border border-[#EADBCE] truncate">
                      {currentMapStop.neighborhood || 'Central'}
                    </span>
                  </div>

                  {/* Prev / Next Stop Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handlePrevStop}
                      title="Previous stop"
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center justify-center text-[#2C2623] transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-[#8C7A6B]">
                      {currentStopIdx + 1}/{items.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextStop}
                      title="Next stop"
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center justify-center text-[#2C2623] transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title and subtitle */}
                <div className="mt-1 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[#2C2623] leading-snug truncate">
                      {currentMapStop.title}
                    </h4>
                    {sheetSnap === 'peek' && (
                      <p className="text-[11px] sm:text-xs text-[#5C473A] truncate mt-0.5">
                        {currentMapStop.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-[#8C7A6B] shrink-0 font-medium pt-0.5">
                    ~{currentMapStop.estimatedStayMinutes}m stay
                  </span>
                </div>

                {/* Transit leg to next stop info & Quick action */}
                {transitLegToNext && sheetSnap === 'peek' && (
                  <div className="mt-2 pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-[11px] sm:text-xs text-[#716458] gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-[#C85327] font-semibold truncate">
                      <Footprints className="w-3 h-3 text-[#D96B43] shrink-0" />
                      <span>{transitLegToNext.durationMinutes}m {transitLegToNext.mode === 'ferry' ? 'ferry' : 'walk'} to Stop {currentStopIdx + 2}</span>
                    </div>
                    {transitLegToNext.googleMapsUrl && (
                      <a
                        href={transitLegToNext.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A9D8F] hover:underline font-semibold flex items-center gap-0.5 shrink-0"
                      >
                        <span>Directions</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Half: Synchronized Timeline Sheet */}
        <div className={`w-full transition-all duration-300 flex flex-col bg-white overflow-hidden min-h-0 flex-1 ${splitStyles[sheetSnap].list}`}>
          {/* Header of Timeline */}
          <div className="px-4 py-2 border-b border-[#F0EBE1] bg-[#FAF8F5] flex items-center justify-between shrink-0">
            <div>
              <span className="text-xs font-bold text-[#2C2623]">{day.title}</span>
              <span className="text-[11px] text-[#8C7A6B] block">
                {items.length} stops · {Object.keys(neighborhoodGroups).length} neighborhood zones
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#8C7A6B]">
              <Compass className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Tap pin or card to sync</span>
            </div>
          </div>

          {/* Scrollable Itinerary with Neighborhood Groupings */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-16">
            {prefs.showBeaInsights && (
              <div className="mb-2">
                <BeaInsightBanner insight={day.beaDailyInsight} />
              </div>
            )}

            {Object.entries(neighborhoodGroups).map(([neighborhood, groupItems], groupIdx) => (
              <div key={neighborhood} className="space-y-2">
                {/* Neighborhood Section Header (can be hidden if user disabled grouping) */}
                {prefs.showNeighborhoodGrouping && (
                  <div className="flex items-center gap-2 pt-1 pb-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2A9D8F]" />
                    <h3 className="text-xs font-bold text-[#2C2623] tracking-wide">
                      {neighborhood}
                    </h3>
                    <span className="text-[11px] text-[#8C7A6B]">
                      ({groupItems.length} stops)
                    </span>
                  </div>
                )}

                {/* Items in this cluster */}
                <div className={`space-y-2 ${prefs.showNeighborhoodGrouping ? 'pl-2 border-l-2 border-[#E8DFD3]' : ''}`}>
                  {groupItems.map((item, itemIdx) => {
                    const isSelected = (activeItemId || currentMapStop.id) === item.id;
                    const isExpanded = expandedId === item.id;
                    const globalIndex = items.findIndex((i) => i.id === item.id);
                    const nextItem = items[globalIndex + 1];
                    const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

                    return (
                      <div key={item.id} className="space-y-1">
                        <div
                          onClick={() => {
                            onSelectItem(item.id);
                            setExpandedId(isExpanded ? null : item.id);
                          }}
                          className={`${prefs.layoutDensity === 'compact' ? 'p-2.5' : 'p-3'} rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#FAF5EE] border-[#D96B43] shadow-xs ring-2 ring-[#D96B43]/20'
                              : 'bg-white border-[#E8DFD3] hover:border-[#B5A597]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isSelected ? 'bg-[#D96B43]' : 'bg-[#2C2623]'
                              }`}>
                                {globalIndex + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-[#D96B43]">
                                    {item.time}
                                  </span>
                                  {item.isBooked && (
                                    <span className="text-[10px] text-[#2A9D8F] font-semibold bg-[#EAF6F4] px-1.5 py-0.5 rounded">
                                      Booked
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-bold text-[#2C2623] mt-0.5 leading-snug">
                                  {item.title}
                                </h4>
                                <p className="text-[11px] text-[#716458] truncate">{item.subtitle}</p>
                              </div>
                            </div>

                            {prefs.showEstimatedStays && (
                              <span className="text-[11px] text-[#8C7A6B] shrink-0">
                                ~{item.estimatedStayMinutes}m
                              </span>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-2.5 pt-2 border-t border-[#F0EBE1] text-xs text-[#5C473A] space-y-1.5">
                              {item.notes && (
                                <p className="text-[11px] bg-white p-2 rounded-xl border border-[#E8DFD3]">
                                  {item.notes}
                                </p>
                              )}
                              {item.ticketInfo && (
                                <div className="text-[11px] text-[#2A9D8F] flex items-center gap-1.5">
                                  <Ticket className="w-3.5 h-3.5" />
                                  <span>{item.ticketInfo}</span>
                                </div>
                              )}
                              <div className="text-[11px] text-[#8C7A6B] flex items-center justify-between">
                                <span>{item.address}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSheetSnap('peek');
                                  }}
                                  className="text-[#D96B43] hover:underline font-semibold"
                                >
                                  View on Map
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* In-Situ Budding Node: Direct stop insertion into list */}
                        {prefs.showInSituBudding && nextItem && (
                          <InSituBuddingNode
                            prevItem={item}
                            nextItem={nextItem}
                            leg={leg}
                            insertIndex={globalIndex + 1}
                            isOpen={effectiveBuddingIndex === globalIndex + 1}
                            onOpenChange={(open) => setBuddingSlot(open ? globalIndex + 1 : null)}
                            onInsertStop={handleInsertStop}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom End-of-Day Budding Slot */}
            {prefs.showInSituBudding && items.length > 0 && (
              <div className="pt-1">
                <InSituBuddingNode
                  prevItem={items[items.length - 1]}
                  insertIndex={items.length}
                  isOpen={effectiveBuddingIndex === items.length}
                  onOpenChange={(open) => setBuddingSlot(open ? items.length : null)}
                  onInsertStop={handleInsertStop}
                  label="Add Stop to End of Day"
                />
              </div>
            )}
          </div>
      </div>
    </div>
  </div>
  );
};
