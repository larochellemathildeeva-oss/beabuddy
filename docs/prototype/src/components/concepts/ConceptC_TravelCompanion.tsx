import React, { useState } from 'react';
import { DayItinerary, ItineraryItem, TransitLeg, UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../../types';
import { deriveTransitLeg } from '../../utils/geoUtils';
import { BeaInsightBanner } from '../BeaInsightBanner';
import { MascotAvatar } from '../MascotAvatar';
import { InteractiveMap } from '../InteractiveMap';
import { InSituBuddingNode } from '../InSituBuddingNode';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation,
  Compass,
  Ticket,
  Footprints,
  Plus,
  ArrowRight,
  ExternalLink,
  Map,
  Sliders
} from 'lucide-react';

interface ConceptCProps {
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

export const ConceptC_TravelCompanion: React.FC<ConceptCProps> = ({
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFullMap, setShowFullMap] = useState(false);

  const [localBuddingIndex, setLocalBuddingIndex] = useState<number | null>(null);
  const effectiveBuddingIndex = activeBuddingIndex !== undefined && activeBuddingIndex !== null
    ? activeBuddingIndex
    : localBuddingIndex;

  const setBuddingSlot = (index: number | null) => {
    setLocalBuddingIndex(index);
    if (onSetBuddingIndex) onSetBuddingIndex(index);
  };

  const items = day.items;

  // Segment items into Day Arc (Morning, Afternoon, Evening)
  const morningItems = items.filter((it) => {
    const hour = parseInt(it.time.split(':')[0], 10);
    return hour < 12;
  });
  const afternoonItems = items.filter((it) => {
    const hour = parseInt(it.time.split(':')[0], 10);
    return hour >= 12 && hour < 17;
  });
  const eveningItems = items.filter((it) => {
    const hour = parseInt(it.time.split(':')[0], 10);
    return hour >= 17;
  });

  // Current and Next stop calculation (Priority for on-the-go travel)
  const activeIndex = items.findIndex((i) => i.id === activeItemId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentStop = items[currentIndex] || items[0];
  const nextStop = items[currentIndex + 1] || null;
  const transitToNext = currentStop && nextStop ? deriveTransitLeg(currentStop, nextStop) : null;

  const handleInsertStop = (itemData: Omit<ItineraryItem, 'id' | 'order'>, insertIndex: number) => {
    if (onAddItemDirect) {
      onAddItemDirect(itemData, insertIndex);
    } else {
      onOpenAddModal(itemData.time, insertIndex);
    }
    setBuddingSlot(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onSelectItem(id);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto">
      {/* Concept C Hero Banner */}
      <div className="px-5 pt-4 pb-3 bg-white border-b border-[#E8DFD3] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#D96B43]">
              Concept C · Travel Companion
            </span>
            <span className="text-[11px] text-[#8C7A6B]">· Day is Hero</span>
          </div>

          <div className="flex items-center gap-1.5">
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

            <button
              type="button"
              onClick={() => setShowFullMap(!showFullMap)}
              className="text-xs font-semibold text-[#5C473A] hover:text-[#2C2623] flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF5EE] rounded-xl border border-[#E8DFD3]"
            >
              <Map className="w-3.5 h-3.5 text-[#D96B43]" />
              <span>{showFullMap ? 'Timeline' : 'Day Map'}</span>
            </button>
          </div>
        </div>

        <h2 className="text-base font-bold text-[#2C2623] mt-1">{day.title}</h2>

        {/* 1. DAY IS THE HERO: Visual Day Arc (Under 5 seconds comprehension) */}
        <div className="mt-3 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E8DFD3]">
          <div className="flex items-center justify-between text-[11px] text-[#716458] mb-1.5 font-medium">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-[#D96B43]" /> Morning ({morningItems.length})
            </span>
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-[#E9C46A]" /> Afternoon ({afternoonItems.length})
            </span>
            <span className="flex items-center gap-1">
              <Sunset className="w-3 h-3 text-[#8C7A6B]" /> Evening ({eveningItems.length})
            </span>
          </div>

          {/* Visual Day Rhythm Bar with Stop Nodes */}
          <div className="w-full h-2.5 bg-[#E8DFD3] rounded-full flex overflow-hidden relative">
            <div
              style={{ width: `${(morningItems.length / Math.max(1, items.length)) * 100}%` }}
              className="h-full bg-[#D96B43]/70 border-r border-white/60"
              title="Morning Stops"
            />
            <div
              style={{ width: `${(afternoonItems.length / Math.max(1, items.length)) * 100}%` }}
              className="h-full bg-[#E9C46A]/80 border-r border-white/60"
              title="Afternoon Stops"
            />
            <div
              style={{ width: `${(eveningItems.length / Math.max(1, items.length)) * 100}%` }}
              className="h-full bg-[#8C7A6B]/70"
              title="Evening Stops"
            />
          </div>
          <p className="text-[10px] text-[#8C7A6B] mt-1 text-center font-medium">
            {items.length} total stops · 08:45 to 17:30
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 pb-24">
        {/* Full Map Toggle mode */}
        {showFullMap ? (
          <div className="h-[480px] rounded-3xl overflow-hidden border border-[#E8DFD3] shadow-md relative">
            <InteractiveMap
              items={items}
              activeItemId={activeItemId}
              onSelectItem={onSelectItem}
              className="w-full h-full"
              showTransitLegs={prefs.showTransitLegs}
              showFlowAnimationControl={prefs.showMapFlowAnimation}
              dayNumber={day.dayNumber}
            />
          </div>
        ) : (
          <>
            {/* Béa's Calm Daily Anchor */}
            {prefs.showBeaInsights && (
              <BeaInsightBanner insight={day.beaDailyInsight} variant="callout" />
            )}

            {/* "Now & Next" Situational Anchor Card (Traveler peace of mind) */}
            {currentStop && (
              <div className="bg-white rounded-2xl border border-[#E8DFD3] p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D96B43] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D96B43] animate-pulse" />
                    Now Focused
                  </span>
                  <span className="text-[11px] text-[#8C7A6B] font-medium">
                    Stop {currentIndex + 1} of {items.length}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#2C2623]">{currentStop.title}</h3>
                  <p className="text-[11px] text-[#716458]">{currentStop.address}</p>
                </div>

                {nextStop && transitToNext && (
                  <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-xs text-[#5C473A]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#8C7A6B]">Up next:</span>
                      <span className="font-semibold truncate max-w-[170px]">{nextStop.title}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#D96B43] shrink-0">
                      {transitToNext.durationMinutes}m {transitToNext.mode}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* In-Situ Budding Node Between Current and Next Stop */}
            {prefs.showInSituBudding && currentStop && nextStop && (
              <InSituBuddingNode
                prevItem={currentStop}
                nextItem={nextStop}
                leg={transitToNext}
                insertIndex={currentIndex + 1}
                isOpen={effectiveBuddingIndex === currentIndex + 1}
                onOpenChange={(open) => setBuddingSlot(open ? currentIndex + 1 : null)}
                onInsertStop={handleInsertStop}
                label="Bud Stop Between Now & Next"
              />
            )}

            {/* Progressive Disclosure Timeline Items */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#2C2623]">Timeline Flow</span>
                <button
                  type="button"
                  onClick={() => {
                    const target = currentIndex >= 0 ? currentIndex + 1 : 1;
                    setBuddingSlot(effectiveBuddingIndex === target ? null : target);
                  }}
                  className="text-xs font-bold text-[#D96B43] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Bud Stop</span>
                </button>
              </div>

              {items.map((item, index) => {
                const isExpanded = expandedId === item.id;
                const isSelected = activeItemId === item.id;
                const nextItem = items[index + 1];
                const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

                return (
                  <div key={item.id} className="space-y-1.5">
                    {/* Collapsed Card (Time, Title, Basic Location) */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-white ${
                        isSelected
                          ? 'border-[#D96B43] ring-2 ring-[#D96B43]/15 shadow-xs'
                          : 'border-[#E8DFD3] hover:border-[#B5A597]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xs font-mono font-bold text-[#D96B43] shrink-0 mt-0.5">
                            {item.time}
                          </span>

                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#2C2623] leading-snug">
                              {item.title}
                            </h4>
                            <div className="text-[11px] text-[#716458] flex items-center gap-1.5 mt-0.5">
                              <span>{item.neighborhood || 'Central'}</span>
                              {item.isBooked && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#2A9D8F] font-semibold">Booked</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-[#8C7A6B]">
                          <span className="text-[11px]">~{item.estimatedStayMinutes}m</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#2C2623]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Progressive Disclosure: Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#F0EBE1] text-xs text-[#5C473A] space-y-2.5 animate-in fade-in duration-150">
                          {item.notes && (
                            <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#E8DFD3]">
                              <span className="text-[10px] font-bold uppercase text-[#8C7A6B] block mb-0.5">
                                Notes & Context
                              </span>
                              <p className="text-[11px] leading-relaxed text-[#4A3B32]">
                                {item.notes}
                              </p>
                            </div>
                          )}

                          {item.ticketInfo && (
                            <div className="p-2.5 bg-[#EAF6F4] text-[#1E6F65] rounded-xl flex items-start gap-2">
                              <Ticket className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-xs block">{item.ticketInfo}</span>
                                {item.bookingCode && (
                                  <span className="font-mono text-[10px] opacity-80 block">
                                    Code: {item.bookingCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-[#8C7A6B] pt-1">
                            <span>{item.address}</span>
                            {item.cost && <span className="font-semibold">{item.cost}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Transit connector between stops */}
                    {prefs.showTransitLegs && leg && (
                      <div className="px-4 py-1 text-[11px] text-[#8C7A6B] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Footprints className="w-3.5 h-3.5 text-[#D96B43]" />
                          <span>
                            {leg.durationMinutes} min {leg.mode === 'ferry' ? 'water cruise' : 'walk'} ({leg.distanceKm} km)
                          </span>
                        </div>
                        {leg.mode === 'ferry' && (
                          <span className="text-[10px] font-semibold text-[#D96B43] bg-[#FAF5EE] px-1.5 py-0.5 rounded">
                            Scenic Transit
                          </span>
                        )}
                      </div>
                    )}

                    {/* In-Situ Budding Node Between Stops */}
                    {prefs.showInSituBudding && nextItem && (
                      <InSituBuddingNode
                        prevItem={item}
                        nextItem={nextItem}
                        leg={leg}
                        insertIndex={index + 1}
                        isOpen={effectiveBuddingIndex === index + 1}
                        onOpenChange={(open) => setBuddingSlot(open ? index + 1 : null)}
                        onInsertStop={handleInsertStop}
                      />
                    )}
                  </div>
                );
              })}

              {/* Bottom End-of-Day Budding Slot */}
              {prefs.showInSituBudding && items.length > 0 && (
                <InSituBuddingNode
                  prevItem={items[items.length - 1]}
                  insertIndex={items.length}
                  isOpen={effectiveBuddingIndex === items.length}
                  onOpenChange={(open) => setBuddingSlot(open ? items.length : null)}
                  onInsertStop={handleInsertStop}
                  label="Add Stop to End of Day"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
