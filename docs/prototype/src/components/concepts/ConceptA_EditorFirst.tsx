import React, { useState } from 'react';
import { DayItinerary, ItineraryItem, TransitLeg, UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../../types';
import { deriveTransitLeg, recalculateItemTimes } from '../../utils/geoUtils';
import { BeaInsightBanner } from '../BeaInsightBanner';
import { InteractiveMap } from '../InteractiveMap';
import { InSituBuddingNode } from '../InSituBuddingNode';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  MapPin,
  Trash2,
  Calendar,
  Map,
  X,
  ArrowRight,
  Sparkles,
  Ticket,
  Sliders
} from 'lucide-react';

interface ConceptAProps {
  day: DayItinerary;
  allDays: DayItinerary[];
  onReorder: (newItems: ItineraryItem[]) => void;
  onUpdateItem: (item: ItineraryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItemToDay: (itemId: string, targetDayNumber: number) => void;
  onOpenAddModal: (defaultTime?: string, insertIndex?: number) => void;
  activeItemId: string | null;
  onSelectItem: (id: string) => void;
  preferences?: UserUiPreferences;
  onOpenCustomizeModal?: () => void;
  activeBuddingIndex?: number | null;
  onSetBuddingIndex?: (index: number | null) => void;
}

export const ConceptA_EditorFirst: React.FC<ConceptAProps> = ({
  day,
  allDays,
  onReorder,
  onUpdateItem,
  onDeleteItem,
  onMoveItemToDay,
  onOpenAddModal,
  activeItemId,
  onSelectItem,
  preferences,
  onOpenCustomizeModal,
  activeBuddingIndex,
  onSetBuddingIndex
}) => {
  const prefs = preferences || DEFAULT_UI_PREFERENCES;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMapDrawer, setShowMapDrawer] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);

  const [localBuddingIndex, setLocalBuddingIndex] = useState<number | null>(null);
  const effectiveBuddingIndex = activeBuddingIndex !== undefined && activeBuddingIndex !== null
    ? activeBuddingIndex
    : localBuddingIndex;

  const setBuddingSlot = (index: number | null) => {
    setLocalBuddingIndex(index);
    if (onSetBuddingIndex) onSetBuddingIndex(index);
  };

  const items = day.items;

  // Move item up or down in order
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Reassign order
    const updated = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    onReorder(updated);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onSelectItem(id);
  };

  const handleInsertStopInSitu = (itemData: Omit<ItineraryItem, 'id' | 'order'>, insertIndex: number) => {
    const newItem: ItineraryItem = {
      ...itemData,
      id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      order: insertIndex + 1
    };
    const currentItems = [...items];
    currentItems.splice(insertIndex, 0, newItem);
    const resequenced = currentItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    const recalculated = recalculateItemTimes(resequenced, items[0]?.time || '08:45');
    onReorder(recalculated);
    onSelectItem(newItem.id);
    setBuddingSlot(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto">
      {/* Concept A Badge & Editorial Subhead */}
      <div className="px-5 pt-4 pb-2 border-b border-[#E8DFD3] bg-white shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#D96B43]">
              Concept A · Editor First
            </span>
            <span className="text-[11px] text-[#8C7A6B]">· Planning Optimized</span>
          </div>
          <h2 className="text-sm font-bold text-[#2C2623] mt-0.5">{day.title}</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowMapDrawer(!showMapDrawer)}
          className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
            showMapDrawer
              ? 'bg-[#2C2623] text-white border-[#2C2623]'
              : 'bg-[#FAF5EE] text-[#5C473A] border-[#E8DFD3] hover:border-[#D96B43]'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>{showMapDrawer ? 'Hide Map' : 'Map Context'}</span>
        </button>

        {onOpenCustomizeModal && (
          <button
            type="button"
            onClick={onOpenCustomizeModal}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-[#E8DFD3] bg-[#FAF5EE] text-[#5C473A] hover:text-[#D96B43] transition-all"
            title="Personalize UI features"
          >
            <Sliders className="w-3.5 h-3.5 text-[#D96B43]" />
            <span className="hidden sm:inline">Customize</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-3.5 flex-1 pb-24">
        {/* Béa's Single Daily Note */}
        {prefs.showBeaInsights && (
          <BeaInsightBanner insight={day.beaDailyInsight} variant="minimal" />
        )}

        {/* Action strip: Quick Add & Count */}
        <div className="flex items-center justify-between px-1 text-xs text-[#716458]">
          <span className="font-semibold">{items.length} scheduled stops</span>
          <button
            type="button"
            onClick={() => setBuddingSlot(effectiveBuddingIndex === 0 ? null : 0)}
            className="text-xs font-bold text-[#D96B43] hover:underline flex items-center gap-1 min-h-[44px] px-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Morning Stop</span>
          </button>
        </div>

        {/* Timeline Items List */}
        <div className="space-y-2">
          {/* Top Morning Starter Budding Slot */}
          {prefs.showInSituBudding && items.length > 0 && (
            <InSituBuddingNode
              nextItem={items[0]}
              insertIndex={0}
              isOpen={effectiveBuddingIndex === 0}
              onOpenChange={(open) => setBuddingSlot(open ? 0 : null)}
              onInsertStop={handleInsertStopInSitu}
              label="Add Morning Starter Stop"
            />
          )}

          {items.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const isSelected = activeItemId === item.id;
            const nextItem = items[index + 1];
            const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

            return (
              <React.Fragment key={item.id}>
                {/* Timeline Card */}
                <div
                  className={`bg-white rounded-2xl border transition-all shadow-xs ${
                    isSelected
                      ? 'border-[#D96B43] ring-2 ring-[#D96B43]/15'
                      : 'border-[#E8DFD3] hover:border-[#B5A597]'
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-2.5">
                    {/* Drag & Reorder Controls */}
                    <div className="flex flex-col items-center justify-center shrink-0 pt-0.5 space-y-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        title="Move stop earlier"
                        className="w-6 h-6 rounded flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE] disabled:opacity-20"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] font-bold text-[#8C7A6B]">{index + 1}</span>
                      <button
                        type="button"
                        disabled={index === items.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        title="Move stop later"
                        className="w-6 h-6 rounded flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE] disabled:opacity-20"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0" onClick={() => toggleExpand(item.id)}>
                      <div className="flex items-center gap-2">
                        {editingTimeId === item.id ? (
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) => {
                              onUpdateItem({ ...item, time: e.target.value });
                            }}
                            onBlur={() => setEditingTimeId(null)}
                            autoFocus
                            className="text-xs font-mono font-bold text-[#D96B43] border border-[#D96B43] rounded px-1"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTimeId(item.id);
                            }}
                            title="Click to edit time"
                            className="text-xs font-mono font-bold text-[#D96B43] hover:underline"
                          >
                            {item.time}
                          </button>
                        )}
                        <span className="text-[11px] text-[#8C7A6B]">· {item.neighborhood || 'Central'}</span>
                        {item.isBooked && (
                          <span className="text-[10px] font-semibold text-[#2A9D8F] bg-[#EAF6F4] px-1.5 py-0.5 rounded">
                            Booked
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-[#2C2623] mt-0.5 leading-snug cursor-pointer">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-[#716458] truncate">{item.subtitle}</p>
                    </div>

                    {/* Quick Move Day & Delete dropdown */}
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        aria-label="Move stop to another day"
                        value={day.dayNumber}
                        onChange={(e) => {
                          const targetDay = Number(e.target.value);
                          if (targetDay !== day.dayNumber) {
                            onMoveItemToDay(item.id, targetDay);
                          }
                        }}
                        className="text-[10px] bg-[#FAF5EE] border border-[#E8DFD3] rounded-lg px-1.5 py-1 text-[#5C473A] focus:outline-none"
                      >
                        {allDays.map((d) => (
                          <option key={d.dayNumber} value={d.dayNumber}>
                            D{d.dayNumber}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A8988B] hover:text-[#C85235] hover:bg-[#FDEEE9]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progressive Disclosure: Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 border-t border-[#F0EBE1] text-xs text-[#5C473A] space-y-2 bg-[#FCFAF7] rounded-b-2xl">
                      {item.notes && (
                        <div className="p-2 bg-white rounded-xl border border-[#E8DFD3]">
                          <span className="font-semibold text-[#3B2518] block text-[11px] mb-0.5">
                            Notes
                          </span>
                          <p className="text-[11px] leading-relaxed text-[#5C473A]">{item.notes}</p>
                        </div>
                      )}

                      {item.ticketInfo && (
                        <div className="flex items-center gap-2 text-[11px] text-[#2A9D8F] bg-[#EAF6F4] p-2 rounded-xl">
                          <Ticket className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.ticketInfo}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-[#8C7A6B] pt-1">
                        <span>{item.address}</span>
                        <span>Est. stay: {item.estimatedStayMinutes} min</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* In-Situ Budding Node: Direct stop insertion into editor */}
                {prefs.showInSituBudding && nextItem && (
                  <InSituBuddingNode
                    prevItem={item}
                    nextItem={nextItem}
                    leg={leg}
                    insertIndex={index + 1}
                    isOpen={effectiveBuddingIndex === index + 1}
                    onOpenChange={(open) => setBuddingSlot(open ? index + 1 : null)}
                    onInsertStop={handleInsertStopInSitu}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom End-of-Day Budding Slot */}
        {prefs.showInSituBudding && items.length > 0 && (
          <InSituBuddingNode
            prevItem={items[items.length - 1]}
            insertIndex={items.length}
            isOpen={effectiveBuddingIndex === items.length}
            onOpenChange={(open) => setBuddingSlot(open ? items.length : null)}
            onInsertStop={handleInsertStopInSitu}
            label="Add Stop to End of Day"
          />
        )}
      </div>

      {/* On-Demand Contextual Map Drawer */}
      {showMapDrawer && (
        <div className="h-64 border-t border-[#E8DFD3] bg-white shrink-0 relative animate-in slide-in-from-bottom duration-200">
          <div className="absolute top-2 right-2 z-30">
            <button
              type="button"
              onClick={() => setShowMapDrawer(false)}
              className="w-7 h-7 bg-white/90 rounded-full shadow-md flex items-center justify-center text-[#2C2623]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
      )}
    </div>
  );
};
