import React, { useState, useEffect, useRef } from 'react';
import { ItineraryItem, TransitLeg, ItemCategory } from '../types';
import { Plus, X, Sparkles, Footprints, Bus, Car, Ship, Check, Clock, Train, Compass, Coffee, Camera, Utensils, Landmark } from 'lucide-react';
import { MascotAvatar } from './MascotAvatar';

export interface InSituBuddingNodeProps {
  prevItem?: ItineraryItem | null;
  nextItem?: ItineraryItem | null;
  leg?: TransitLeg | null;
  insertIndex: number;
  onInsertStop: (item: Omit<ItineraryItem, 'id' | 'order'>, index: number) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  className?: string;
  autoFocusOnOpen?: boolean;
}

const QUICK_SUGGESTIONS: Array<{ title: string; category: ItemCategory; stay: number; icon: string; subtitle: string }> = [
  { title: 'Artisan Coffee & Pastry', category: 'food', stay: 30, icon: '☕', subtitle: 'Cozy boutique pour-over & seasonal sweets' },
  { title: 'Riverside Scenic Lookout', category: 'leisure', stay: 25, icon: '📸', subtitle: 'Picturesque waterfront reflection walkway' },
  { title: 'Peace Park Paper Crane Shop', category: 'culture', stay: 20, icon: '🕊️', subtitle: 'Handmade origami & symbolic memory crafts' },
  { title: 'Local Okonomiyaki Spot', category: 'food', stay: 45, icon: '🍱', subtitle: 'Fresh sizzling cabbage & noodle teppan hot plate' },
  { title: 'Matcha & Sweet Tea Pavilion', category: 'culture', stay: 35, icon: '🍵', subtitle: 'Tranquil garden view matcha & traditional wagashi' },
  { title: 'Hidden Alley Vintage Gallery', category: 'culture', stay: 30, icon: '🎨', subtitle: 'Curated local pottery & artisanal crafts' }
];

const CATEGORY_CHIPS: Array<{ id: ItemCategory; label: string; icon: React.ReactNode }> = [
  { id: 'food', label: 'Food & Drink', icon: <Utensils className="w-3 h-3" /> },
  { id: 'attraction', label: 'Sightseeing', icon: <Compass className="w-3 h-3" /> },
  { id: 'culture', label: 'Culture & Art', icon: <Landmark className="w-3 h-3" /> },
  { id: 'leisure', label: 'Park / Leisure', icon: <Camera className="w-3 h-3" /> },
  { id: 'transport', label: 'Transit Waypoint', icon: <Footprints className="w-3 h-3" /> }
];

export const InSituBuddingNode: React.FC<InSituBuddingNodeProps> = ({
  prevItem,
  nextItem,
  leg,
  insertIndex,
  onInsertStop,
  isOpen: controlledIsOpen,
  onOpenChange,
  label,
  className = '',
  autoFocusOnOpen = true
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isExpanded = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [title, setTitle] = useState('');
  const [stayMinutes, setStayMinutes] = useState(30);
  const [category, setCategory] = useState<ItemCategory>('food');
  const [customSubtitle, setCustomSubtitle] = useState('');

  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setOpen = (val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalIsOpen(val);
    }
  };

  // Auto-scroll into view when expanded
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (autoFocusOnOpen) {
          inputRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, autoFocusOnOpen]);

  // Compute transit icon
  const TransitIcon =
    leg?.mode === 'ferry' ? Ship : leg?.mode === 'train' ? Train : leg?.mode === 'transit' ? Bus : leg?.mode === 'drive' ? Car : Footprints;

  const handleApplySuggestion = (sug: typeof QUICK_SUGGESTIONS[0]) => {
    setTitle(sug.title);
    setStayMinutes(sug.stay);
    setCategory(sug.category);
    setCustomSubtitle(sug.subtitle);
  };

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || 'Scenic Discovery Waypoint';

    // Derive approximate coordinates
    let lat = 34.3955;
    let lng = 132.4536;
    let fallbackNeighborhood = 'Central District';
    let referenceSubtitle = '';

    if (prevItem && nextItem) {
      lat = (prevItem.coordinates.lat + nextItem.coordinates.lat) / 2;
      lng = (prevItem.coordinates.lng + nextItem.coordinates.lng) / 2;
      fallbackNeighborhood = prevItem.neighborhood || nextItem.neighborhood || 'Central';
      referenceSubtitle = `Discovered along route between ${prevItem.title.split(' ')[0]} and ${nextItem.title.split(' ')[0]}`;
    } else if (prevItem) {
      lat = prevItem.coordinates.lat + 0.003;
      lng = prevItem.coordinates.lng + 0.003;
      fallbackNeighborhood = prevItem.neighborhood || 'Central';
      referenceSubtitle = `Evening stop following ${prevItem.title.split(' ')[0]}`;
    } else if (nextItem) {
      lat = nextItem.coordinates.lat - 0.003;
      lng = nextItem.coordinates.lng - 0.003;
      fallbackNeighborhood = nextItem.neighborhood || 'Central';
      referenceSubtitle = `Morning starter before ${nextItem.title.split(' ')[0]}`;
    }

    onInsertStop(
      {
        title: finalTitle,
        subtitle: customSubtitle || referenceSubtitle || `${fallbackNeighborhood} · ${stayMinutes}m visit`,
        time: prevItem?.time || '09:00', // Will be recalculated by parent time sequence
        address: `${fallbackNeighborhood}, Hiroshima`,
        neighborhood: fallbackNeighborhood,
        estimatedStayMinutes: stayMinutes,
        coordinates: { lat, lng },
        category: category
      },
      insertIndex
    );

    setOpen(false);
    setTitle('');
    setCustomSubtitle('');
  };

  // Determine display label
  const buttonLabel = label || (
    prevItem && nextItem
      ? 'Add Stop Between'
      : nextItem
      ? 'Add Morning Starter Stop'
      : 'Add Stop to End of Day'
  );

  return (
    <div ref={nodeRef} className={`relative py-1 my-1 transition-all ${className}`}>
      {/* Transit Connector Spine */}
      <div className="flex flex-col items-center">
        {/* Upper connecting spine with elastic expansion */}
        <div
          className={`w-0.5 border-l-2 transition-all duration-300 ${
            isExpanded
              ? 'h-5 border-solid border-[#D96B43]'
              : 'h-3 border-dashed border-[#D9CEBF]'
          }`}
        />

        {/* In-situ budding trigger button or expanded slot */}
        {!isExpanded ? (
          <div
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => setOpen(true)}
          >
            {/* Transit snippet */}
            {leg && (
              <span className="text-[10px] text-[#8C7A6B] bg-[#FAF5EE] px-2 py-0.5 rounded-full border border-[#EADBCE] flex items-center gap-1 group-hover:border-[#D96B43] transition-colors">
                <TransitIcon className="w-2.5 h-2.5 text-[#D96B43]" />
                <span>{leg.durationMinutes}m {leg.mode}</span>
                {leg.distanceKm && <span>· {leg.distanceKm.toFixed(1)}km</span>}
              </span>
            )}

            {/* Tactile Budding Button */}
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#FFF5EE] text-[#5C473A] hover:text-[#D96B43] border border-[#EADBCE] hover:border-[#D96B43] text-[11px] font-semibold transition-all shadow-2xs group-hover:scale-105 active:scale-95 group-hover:shadow-xs"
            >
              <span className="w-4 h-4 rounded-full bg-[#FFF5EE] text-[#D96B43] flex items-center justify-center font-bold text-xs border border-[#FCD9C6]">
                +
              </span>
              <span>{buttonLabel}</span>
            </button>
          </div>
        ) : (
          /* ========================================================================= */
          /* EXPANDED BUDDING IN-SITU CARD (Zero-Modal Elastic Insertion)              */
          /* ========================================================================= */
          <div className="w-full bg-[#FFFDF9] rounded-2xl border-2 border-dashed border-[#D96B43] p-3.5 sm:p-4 shadow-md space-y-3 animate-in zoom-in-95 duration-200 ring-4 ring-[#D96B43]/10">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <MascotAvatar state="sniffing" size="sm" className="w-7 h-7 ring-1 ring-[#D96B43]/40 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-[#D96B43]">
                      Budding In-Situ Stop
                    </span>
                    <span className="text-[9px] uppercase tracking-wider bg-[#FFF5EE] text-[#D96B43] font-bold px-1.5 py-0.5 rounded border border-[#FCD9C6]">
                      Zero-Modal Flow
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-[#8C7A6B] truncate">
                    {prevItem && nextItem ? (
                      <>Slotting directly between {prevItem.time} ({prevItem.title.split(' ')[0]}) and {nextItem.time} ({nextItem.title.split(' ')[0]})</>
                    ) : nextItem ? (
                      <>Slotting as opening morning stop before {nextItem.time}</>
                    ) : prevItem ? (
                      <>Slotting as evening stop following {prevItem.title.split(' ')[0]}</>
                    ) : (
                      <>Slotting new stop into day</>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-xl bg-[#FAF5EE] hover:bg-[#EADBCE] text-[#716458] hover:text-[#2C2623] flex items-center justify-center transition-colors shrink-0"
                title="Collapse budding slot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Suggestion Recommendation Chips */}
            <div>
              <span className="text-[10px] font-bold text-[#716458] uppercase tracking-wider block mb-1">
                Béa’s Instant Route Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleApplySuggestion(sug)}
                    className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-xl bg-[#FAF5EE] hover:bg-[#FFF5EE] hover:border-[#D96B43] border border-[#EADBCE] text-[#5C473A] flex items-center gap-1.5 transition-all active:scale-95 text-left"
                  >
                    <span>{sug.icon}</span>
                    <span className="font-semibold text-[#2C2623]">{sug.title}</span>
                    <span className="text-[#8C7A6B] font-mono">({sug.stay}m)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleCommit} className="space-y-2.5 pt-1 border-t border-[#F0EBE1]">
              <div className="space-y-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter venue or activity name (e.g. Orizuru Tower Café)..."
                  className="w-full text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-[#EADBCE] bg-white outline-none focus:border-[#D96B43] focus:ring-2 focus:ring-[#D96B43]/15 transition-all text-[#2C2623] placeholder:text-[#B5A597]"
                />
              </div>

              {/* Category Chips Selector */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {CATEGORY_CHIPS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all shrink-0 ${
                      category === cat.id
                        ? 'bg-[#2C2623] text-white shadow-2xs'
                        : 'bg-[#FAF5EE] text-[#716458] hover:bg-[#EADBCE] border border-[#EADBCE]'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
                {/* Stay duration picker */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#716458]">
                  <Clock className="w-3.5 h-3.5 text-[#D96B43]" />
                  <span className="font-medium">Stay:</span>
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setStayMinutes(mins)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                        stayMinutes === mins
                          ? 'bg-[#D96B43] text-white shadow-2xs font-bold'
                          : 'bg-[#FAF5EE] text-[#716458] hover:bg-[#EADBCE] border border-[#EADBCE]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#716458] hover:bg-[#FAF5EE] border border-[#EADBCE] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#D96B43] hover:bg-[#C25832] shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Insert Stop Directly</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Zero-modal feedback assurance */}
            <div className="text-[10px] text-[#2A9D8F] flex items-center gap-1.5 pt-0.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Zero-modal insertion: Timeline, transit steps, and times recalculate live in-situ.</span>
            </div>
          </div>
        )}

        {/* Lower connecting spine */}
        <div
          className={`w-0.5 border-l-2 transition-all duration-300 ${
            isExpanded
              ? 'h-5 border-solid border-[#D96B43]'
              : 'h-3 border-dashed border-[#D9CEBF]'
          }`}
        />
      </div>
    </div>
  );
};
