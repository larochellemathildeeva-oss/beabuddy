import React, { useState } from 'react';
import { DayItinerary, ItineraryItem, TransitLeg, UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../../types';
import { deriveTransitLeg, recalculateItemTimes } from '../../utils/geoUtils';
import { BeaInsightBanner } from '../BeaInsightBanner';
import { InteractiveMap } from '../InteractiveMap';
import { MascotAvatar } from '../MascotAvatar';
import { InSituBuddingNode } from '../InSituBuddingNode';
import { SwipeableItineraryCard } from '../SwipeableItineraryCard';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Route,
  Map,
  Compass,
  Plus,
  Trash2,
  Ticket,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  Navigation,
  CheckCircle2,
  RotateCw,
  Info,
  AlertCircle,
  Download,
  Footprints,
  Volume2,
  VolumeX,
  ThumbsUp,
  Check,
  Bookmark,
  Layers,
  Filter,
  Sliders
} from 'lucide-react';
import { OfflineDirectionsModal } from '../OfflineDirectionsModal';
import { TurnByTurnDirectionsView } from '../TurnByTurnDirectionsView';

interface ConceptUnifiedProps {
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
  onDirectInsertStop?: (itemData: Omit<ItineraryItem, 'id' | 'order'>, index: number) => void;
  onToggleComplete?: (itemId: string) => void;
  onArchiveItem?: (itemId: string) => void;
}

export type UnifiedPerspective = 'companion' | 'map' | 'editor';

export const ConceptUnified: React.FC<ConceptUnifiedProps> = ({
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
  onSetBuddingIndex,
  onDirectInsertStop,
  onToggleComplete,
  onArchiveItem
}) => {
  const prefs = preferences || DEFAULT_UI_PREFERENCES;
  // 3 Seamless Perspectives: Companion (on-the-go story), Map Split (spatial sync), Quick Editor (density & reordering)
  const [perspective, setPerspective] = useState<UnifiedPerspective>('companion');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [mapSplitSnap, setMapSplitSnap] = useState<'peek' | 'half' | 'full'>('half');
  // Grouping option: 'timeline' (chronological) or 'neighborhood' (spatial district view)
  const [timelineGroupMode, setTimelineGroupMode] = useState<'timeline' | 'neighborhood'>('timeline');
  // 3D card turn flip state for Current Stop
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  // Offline directions download modal state
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  // Expand turn-by-turn directions for Up Next stop
  const [showUpNextDirections, setShowUpNextDirections] = useState<boolean>(false);

  // In-Situ Budding State (Internal fallback if not controlled by parent)
  const [localBuddingIndex, setLocalBuddingIndex] = useState<number | null>(null);
  const effectiveBuddingIndex = activeBuddingIndex !== undefined && activeBuddingIndex !== null
    ? activeBuddingIndex
    : localBuddingIndex;

  const setBuddingSlot = (index: number | null) => {
    setLocalBuddingIndex(index);
    if (onSetBuddingIndex) onSetBuddingIndex(index);
  };

  // Neighborhood Collapse State (supports individual collapse per neighborhood)
  const [collapsedNeighborhoods, setCollapsedNeighborhoods] = useState<Record<string, boolean>>({});

  // Interactive Banner State
  const [ribbonFilter, setRibbonFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [bannerAudioPlaying, setBannerAudioPlaying] = useState<boolean>(false);
  const [bannerLiked, setBannerLiked] = useState<boolean>(false);
  const [bannerBookmarked, setBannerBookmarked] = useState<boolean>(false);
  const [bannerMascotState, setBannerMascotState] = useState<'idle' | 'thinking' | 'sniffing' | 'found'>('idle');
  const [showBannerDetails, setShowBannerDetails] = useState<boolean>(false);

  const items = day.items;

  // Day arc segments
  const morningItems = items.filter((it) => parseInt(it.time.split(':')[0], 10) < 12);
  const afternoonItems = items.filter((it) => {
    const h = parseInt(it.time.split(':')[0], 10);
    return h >= 12 && h < 17;
  });
  const eveningItems = items.filter((it) => parseInt(it.time.split(':')[0], 10) >= 17);

  // Active / Up Next item computation
  const activeIndex = items.findIndex((i) => i.id === activeItemId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentStop = items[currentIndex] || items[0];
  const nextStop = items[currentIndex + 1] || null;
  const transitToNext = currentStop && nextStop ? deriveTransitLeg(currentStop, nextStop) : null;

  // Compute "Leave By" time based on next stop arrival time minus transit duration
  const calculateLeaveBy = (nextItemTime: string, transitMinutes: number): string => {
    const [hStr, mStr] = nextItemTime.split(':');
    const totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const leaveMinutes = Math.max(0, totalMinutes - transitMinutes);
    const lh = Math.floor(leaveMinutes / 60) % 24;
    const lm = leaveMinutes % 60;
    return `${String(lh).padStart(2, '0')}:${String(lm).padStart(2, '0')}`;
  };

  const leaveByTime = nextStop && transitToNext
    ? calculateLeaveBy(nextStop.time, transitToNext.durationMinutes)
    : null;

  // Move item up/down for editor
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    const reordered = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    onReorder(reordered);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onSelectItem(id);
  };

  const handleToggleComplete = (itemId: string) => {
    if (onToggleComplete) {
      onToggleComplete(itemId);
    } else {
      const target = items.find((it) => it.id === itemId);
      if (target) {
        onUpdateItem({ ...target, isCompleted: !target.isCompleted });
      }
    }
  };

  const handleArchive = (itemId: string) => {
    if (onArchiveItem) {
      onArchiveItem(itemId);
    } else {
      onDeleteItem(itemId);
    }
  };

  // Neighborhood groups for spatial perspective
  const neighborhoodGroups = items.reduce((acc, item) => {
    const hood = item.neighborhood || 'Central District';
    if (!acc[hood]) acc[hood] = [];
    acc[hood].push(item);
    return acc;
  }, {} as Record<string, ItineraryItem[]>);

  // Neighborhood collapse actions
  const toggleNeighborhoodCollapse = (neighborhood: string) => {
    setCollapsedNeighborhoods((prev) => ({
      ...prev,
      [neighborhood]: !prev[neighborhood]
    }));
  };

  const collapseAllNeighborhoods = () => {
    const allCollapsed = Object.keys(neighborhoodGroups).reduce((acc, hood) => {
      acc[hood] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setCollapsedNeighborhoods(allCollapsed);
  };

  const expandAllNeighborhoods = () => {
    setCollapsedNeighborhoods({});
  };

  // Filter items for the interactive ribbon
  const displayedRibbonItems = items.filter((it) => {
    if (ribbonFilter === 'all') return true;
    const h = parseInt(it.time.split(':')[0], 10);
    if (ribbonFilter === 'morning') return h < 12;
    if (ribbonFilter === 'afternoon') return h >= 12 && h < 17;
    if (ribbonFilter === 'evening') return h >= 17;
    return true;
  });

  const handleBannerMascotClick = () => {
    const states: Array<'idle' | 'thinking' | 'sniffing' | 'found'> = ['thinking', 'sniffing', 'found', 'idle'];
    const nextIdx = (states.indexOf(bannerMascotState) + 1) % states.length;
    setBannerMascotState(states[nextIdx]);
  };

  // In-situ budding stop insertion with live time and path recalculation
  const handleInsertStopInSitu = (itemData: Omit<ItineraryItem, 'id' | 'order'>, insertIndex: number) => {
    if (onDirectInsertStop) {
      onDirectInsertStop(itemData, insertIndex);
    } else {
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
    }
    setBuddingSlot(null);
  };

  const splitStyles = {
    half: { map: 'flex-1 min-h-[260px]', list: 'flex-1 min-h-[200px]' }, // 50/50 Dual View
    peek: { map: 'flex-[2] min-h-[320px]', list: 'flex-1 min-h-[160px]' }, // Map Focus + Floating Stop Deck
    full: { map: 'h-[160px] shrink-0', list: 'flex-1 min-h-[280px]' } // List Focus with Map Mini-Strip
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FDFBF7] overflow-hidden h-full">
      {/* Perspective Mode Switcher - Intuitive, Flowy & Tactile */}
      <div className="px-3 sm:px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-[#EADBCE] shrink-0 flex items-center justify-between gap-1.5 shadow-2xs">
        <div className="flex items-center gap-1 bg-[#FAF5EE] p-1 rounded-xl border border-[#EADBCE] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPerspective('companion')}
            className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              perspective === 'companion'
                ? 'bg-white text-[#2C2623] shadow-xs ring-1 ring-[#D96B43]/20 font-bold'
                : 'text-[#716458] hover:text-[#2C2623]'
            }`}
          >
            <span>Companion</span>
          </button>

          <button
            type="button"
            onClick={() => setPerspective('map')}
            className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              perspective === 'map'
                ? 'bg-white text-[#2C2623] shadow-xs ring-1 ring-[#2A9D8F]/20 font-bold'
                : 'text-[#716458] hover:text-[#2C2623]'
            }`}
          >
            <span>Map Split</span>
          </button>

          <button
            type="button"
            onClick={() => setPerspective('editor')}
            className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              perspective === 'editor'
                ? 'bg-white text-[#2C2623] shadow-xs ring-1 ring-[#D96B43]/20 font-bold'
                : 'text-[#716458] hover:text-[#2C2623]'
            }`}
          >
            <span className="hidden sm:inline">Timeline Editor</span>
            <span className="sm:hidden">Timeline</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenCustomizeModal && (
            <button
              type="button"
              onClick={onOpenCustomizeModal}
              className="text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] transition-all shadow-2xs active:scale-95"
              title="Personalize visible features, layout & companion"
            >
              <Sliders className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden sm:inline">Customize</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOfflineModalOpen(true)}
            className="hidden sm:flex text-xs font-semibold text-[#5C473A] hover:text-[#2C2623] items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] transition-all shadow-2xs active:scale-95"
            title="Download offline step-by-step directions (PDF or TXT)"
          >
            <Download className="w-3.5 h-3.5 text-[#D96B43]" />
            <span className="hidden md:inline">Offline Directions</span>
            <span className="md:hidden text-xs">Offline</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = activeIndex >= 0 ? activeIndex + 1 : (currentIndex >= 0 ? currentIndex + 1 : 1);
              setBuddingSlot(effectiveBuddingIndex === target ? null : target);
            }}
            className="text-xs font-bold text-[#D96B43] hover:text-white hover:bg-[#D96B43] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5EE] border border-[#EADBCE] hover:border-[#D96B43] transition-all shadow-2xs active:scale-95 group"
            title="Bud Stop In-Situ (Zero-Modal timeline insertion)"
          >
            <span className="w-4 h-4 rounded-full bg-[#FFF5EE] group-hover:bg-white text-[#D96B43] flex items-center justify-center font-bold text-xs border border-[#FCD9C6] transition-colors">
              +
            </span>
            <span>Bud Stop</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PERSPECTIVE 1: TRAVEL COMPANION (Current & Next Hero Focus)   */}
      {/* ============================================================ */}
      {perspective === 'companion' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-4 space-y-4 pb-32 no-scrollbar">
          {/* HORIZONTAL MINI-CARD ITINERARY BANNER (Deeply interactive scrollable ribbon) */}
          <div className="bg-gradient-to-b from-white via-white to-[#FAF8F5] rounded-2xl border border-[#EADBCE] p-3 sm:p-3.5 shadow-2xs transition-all">
            {/* Header: Title & Interactive Time Arc Filter Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D96B43] shrink-0" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#2C2623]">
                  Day {day.dayNumber} Itinerary Ribbon
                </span>
                <span className="text-[10px] sm:text-xs text-[#8C7A6B] bg-[#FAF5EE] px-1.5 py-0.5 rounded-md border border-[#EADBCE] font-semibold">
                  {items.length} stops
                </span>
              </div>

              {/* Interactive Time-Arc Filter Pill Bar */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {(
                  [
                    { id: 'all', label: `All (${items.length})` },
                    { id: 'morning', label: `Morning (${morningItems.length})` },
                    { id: 'afternoon', label: `Afternoon (${afternoonItems.length})` },
                    { id: 'evening', label: `Evening (${eveningItems.length})` }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRibbonFilter(f.id)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                      ribbonFilter === f.id
                        ? 'bg-[#2C2623] text-white shadow-2xs'
                        : 'bg-[#FAF5EE] text-[#716458] hover:text-[#2C2623] border border-[#EADBCE]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Horizontally scrollable mini card track with responsive typography */}
            <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-1 overscroll-x-contain">
              {displayedRibbonItems.map((item) => {
                const globalIndex = items.findIndex((i) => i.id === item.id);
                const isSelected = activeItemId === item.id || (!activeItemId && globalIndex === 0);
                const isCurrent = globalIndex === currentIndex;
                const isNext = globalIndex === currentIndex + 1;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectItem(item.id);
                      setExpandedId(item.id);
                    }}
                    className={`shrink-0 w-40 sm:w-48 text-left p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all relative ${
                      isSelected
                        ? 'bg-[#2C2623] text-white border-[#2C2623] shadow-xs scale-[1.02]'
                        : isNext
                        ? 'bg-[#FAF5EE] text-[#2C2623] border-[#EADBCE] hover:border-[#D96B43]'
                        : 'bg-white text-[#5C473A] border-[#EADBCE] hover:border-[#B5A597]'
                    }`}
                  >
                    {/* Status badge & sequence number */}
                    <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                      <span className={`font-mono font-bold text-xs sm:text-sm ${isSelected ? 'text-[#E89E78]' : 'text-[#D96B43]'}`}>
                        {item.time}
                      </span>
                      {isCurrent ? (
                        <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#D96B43] text-white">
                          Current
                        </span>
                      ) : isNext ? (
                        <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-stone-200' : 'bg-[#EAF6F4] text-[#2A9D8F]'}`}>
                          Next
                        </span>
                      ) : (
                        <span className={`text-[9px] sm:text-[10px] font-medium ${isSelected ? 'text-stone-400' : 'text-[#A8988B]'}`}>
                          #{globalIndex + 1}
                        </span>
                      )}
                    </div>

                    <h5 className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 min-h-[32px] sm:min-h-[36px] break-words ${isSelected ? 'text-white' : 'text-[#2C2623]'}`}>
                      {item.title}
                    </h5>

                    <p className={`text-[10px] sm:text-xs truncate mt-1 ${isSelected ? 'text-stone-300' : 'text-[#8C7A6B]'}`}>
                      {item.neighborhood || 'Central'} · ~{item.estimatedStayMinutes}m
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Béa's Interactive Companion Banner Card (Multi-modal advice, reactions, audio player) */}
            <div className="mt-3 pt-3 border-t border-[#F0EBE1] bg-[#FAF5EE]/70 rounded-xl p-2.5 sm:p-3 border border-[#EADBCE]">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className="relative cursor-pointer hover:scale-110 active:scale-95 transition-transform shrink-0"
                    onClick={handleBannerMascotClick}
                    title="Tap Béa to interact"
                  >
                    <MascotAvatar size="sm" state={bannerMascotState} className="w-7 h-7 sm:w-8 sm:h-8 mt-0.5 ring-1 ring-[#D96B43]/30" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#2A9D8F] rounded-full ring-1 ring-white" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs sm:text-sm font-bold text-[#D96B43]">Béa’s Daily Guidance</span>
                      <span className="text-[10px] sm:text-xs text-[#8C7A6B]">· Companion insight</span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#4A3B32] italic leading-relaxed break-words font-medium">
                      "{day.beaDailyInsight || 'Pace yourself comfortably today—scenic spots are best enjoyed unhurried.'}"
                    </p>

                    {/* Interactive Context Action Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const miyajima = items.find((i) => i.title.toLowerCase().includes('shrine') || i.title.toLowerCase().includes('itsukushima'));
                          if (miyajima) {
                            onSelectItem(miyajima.id);
                            setExpandedId(miyajima.id);
                          }
                        }}
                        className="text-[10px] sm:text-xs font-semibold text-[#D96B43] bg-white hover:bg-[#FDF7F3] px-2 py-0.5 rounded-md border border-[#FCD9C6] flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3 h-3 text-[#D96B43]" />
                        <span>High Tide Tip (13:40)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowBannerDetails(!showBannerDetails)}
                        className="text-[10px] sm:text-xs font-semibold text-[#5C473A] bg-white hover:bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#EADBCE] flex items-center gap-1 transition-colors"
                      >
                        <span>{showBannerDetails ? 'Less Advice' : 'More Tips'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showBannerDetails ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expandable Advice Drawer */}
                    {showBannerDetails && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-[#EADBCE] text-xs sm:text-sm text-[#4A3B32] space-y-1 animate-fadeIn">
                        <div className="flex items-center gap-1.5 font-bold text-[#2C2623] text-xs sm:text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F]" />
                          <span>Local Transit & Weather Notes</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#5C473A] leading-snug">
                          The ferry departure at 11:45 has a breezy open deck. Keep your IC transport card ready for Hiroshima electric railway tram lines 1 and 2.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audio simulation and reactions */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setBannerAudioPlaying(!bannerAudioPlaying)}
                    title={bannerAudioPlaying ? 'Stop Voice Note' : 'Listen to Béa Voice Note'}
                    className={`p-1.5 rounded-lg border text-xs sm:text-sm transition-all flex items-center gap-1 ${
                      bannerAudioPlaying
                        ? 'bg-[#D96B43] text-white border-[#D96B43] shadow-xs animate-pulse'
                        : 'bg-white text-[#5C473A] border-[#EADBCE] hover:text-[#D96B43]'
                    }`}
                  >
                    {bannerAudioPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-[#8C7A6B]" />}
                    <span className="text-[10px] sm:text-xs font-medium hidden xs:inline">
                      {bannerAudioPlaying ? 'Playing' : 'Listen'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBannerLiked(!bannerLiked)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        bannerLiked
                          ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                          : 'bg-white text-[#716458] border-[#EADBCE] hover:text-[#2A9D8F]'
                      }`}
                      title="Helpful tip"
                    >
                      {bannerLiked ? <Check className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setBannerBookmarked(!bannerBookmarked)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        bannerBookmarked
                          ? 'bg-[#D96B43] text-white border-[#D96B43]'
                          : 'bg-white text-[#716458] border-[#EADBCE] hover:text-[#D96B43]'
                      }`}
                      title="Bookmark tip"
                    >
                      <Bookmark className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action Strip */}
              <div className="mt-2 pt-2 border-t border-[#EADBCE]/60 flex items-center justify-between text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setIsOfflineModalOpen(true)}
                  className="text-[11px] sm:text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3 text-[#D96B43]" />
                  <span>Download Offline Guide</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPerspective('map')}
                  className="text-[11px] sm:text-xs font-semibold text-[#2A9D8F] hover:underline flex items-center gap-1"
                >
                  <span>Sync with Map</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* LIVE DAY STOP ACTIVITY TRACKER (Real-time progression through stops) */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#EADBCE] shadow-2xs">
            <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2A9D8F] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2A9D8F]" />
                </span>
                <span className="font-bold text-[#2C2623] text-xs sm:text-sm">Live Journey Tracker</span>
              </div>
              <div className="text-[11px] sm:text-xs font-semibold text-[#8C7A6B]">
                Stop <span className="text-[#D96B43] font-bold">{currentIndex + 1}</span> of {items.length}
                <span className="ml-1.5 text-[#A8988B] hidden xs:inline">
                  ({Math.round(((currentIndex + 1) / items.length) * 100)}% complete)
                </span>
              </div>
            </div>

            {/* Stepper Progress Waypoint Track */}
            <div className="relative flex items-center justify-between my-2 px-1">
              {/* Background track line */}
              <div className="absolute left-2.5 right-2.5 top-1/2 -translate-y-1/2 h-1 bg-[#F0EBE1] rounded-full z-0" />
              {/* Active filled line */}
              <div
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-1 bg-[#D96B43] rounded-full transition-all duration-500 z-0"
                style={{
                  width: items.length > 1
                    ? `${(currentIndex / (items.length - 1)) * 100}%`
                    : '100%'
                }}
              />

              {/* Waypoint nodes */}
              {items.map((item, idx) => {
                const isPast = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isFuture = idx > currentIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectItem(item.id);
                      setIsCardFlipped(false);
                    }}
                    title={`${item.time} - ${item.title}`}
                    className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
                  >
                    <div
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold transition-all duration-300 ${
                        isCurrent
                          ? 'bg-[#D96B43] text-white ring-4 ring-[#D96B43]/25 scale-125 shadow-xs'
                          : isPast
                          ? 'bg-[#2A9D8F] text-white'
                          : 'bg-white text-[#8C7A6B] border border-[#D9CEBF] group-hover:border-[#D96B43]'
                      }`}
                    >
                      {isPast ? '✓' : idx + 1}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Context Strip: Responsive stacked pills so titles are never cut off */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 pt-2 text-xs sm:text-sm text-[#716458]">
              <div className="flex items-center gap-1.5 min-w-0 bg-[#FAF8F5] px-2.5 py-1.5 rounded-xl border border-[#F0EBE1]">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8C7A6B] shrink-0">Now:</span>
                <span className="font-bold text-[#2C2623] truncate text-xs sm:text-sm">{currentStop.title}</span>
              </div>
              {nextStop ? (
                <div className="flex items-center gap-1.5 min-w-0 bg-[#FFF8F5] px-2.5 py-1.5 rounded-xl border border-[#FCD9C6]/60 text-[#D96B43]">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#D96B43] shrink-0">Next:</span>
                  <span className="font-bold truncate text-xs sm:text-sm">{nextStop.title}</span>
                  {transitToNext && (
                    <span className="text-[10px] sm:text-xs text-[#8C7A6B] shrink-0 font-normal">
                      ({transitToNext.durationMinutes}m {transitToNext.mode === 'ferry' ? 'ferry' : 'walk'})
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-2.5 py-1.5 rounded-xl text-[#2A9D8F] font-semibold text-xs sm:text-sm">
                  <span>🎉 Trip completed for today!</span>
                </div>
              )}
            </div>
          </div>

          {/* DUAL HERO FOCUS: CURRENT & NEXT */}
          <div className="space-y-3">
            {/* 1. CURRENT ANCHOR STOP (Streamlined Compact Card with 3D Turn / Flip) */}
            {currentStop && (
              <div className="perspective-1000">
                <div
                  className={`relative transition-transform duration-500 transform-style-3d cursor-pointer ${
                    isCardFlipped ? 'rotate-y-180' : ''
                  }`}
                  onClick={() => setIsCardFlipped(!isCardFlipped)}
                >
                  {/* FRONT OF CARD (Clean, compact, no image, responsive typography) */}
                  <div className="backface-hidden rounded-2xl bg-gradient-to-br from-[#241E1B] via-[#332A25] to-[#1A1614] text-white p-4 sm:p-5 shadow-md border border-[#3E342F]">
                    {/* Top status & flip trigger */}
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D96B43] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D96B43]" />
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-[#E89E78]">
                          Current Stop
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-semibold bg-white/10 px-2 py-0.5 rounded text-stone-200">
                          {currentStop.time}
                        </span>
                      </div>

                      {/* Flip Hint Indicator */}
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-stone-300 hover:text-white bg-white/10 px-2 py-0.5 rounded-full transition-colors">
                        <RotateCw className="w-3 h-3 text-[#E89E78]" />
                        <span>Tap to turn over</span>
                      </div>
                    </div>

                    {/* Compact Title & Neighborhood */}
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-base sm:text-lg md:text-xl font-bold text-[#FFFDF9] leading-snug break-words">
                          {currentStop.title}
                        </h3>
                        <span className="text-xs sm:text-sm text-stone-300 font-medium shrink-0">
                          ~{currentStop.estimatedStayMinutes}m stay
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#E8DCD2] mt-1 line-clamp-2 leading-relaxed break-words">
                        {currentStop.subtitle}
                      </p>
                    </div>

                    {/* Quick address & cost pills */}
                    <div className="flex items-center justify-between text-xs sm:text-sm text-stone-300 mt-2.5 pt-2 border-t border-white/10 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#E89E78] shrink-0" />
                        <span className="truncate">{currentStop.address}</span>
                      </div>
                      {currentStop.cost && (
                        <span className="font-semibold text-[#E89E78] shrink-0 text-xs sm:text-sm">
                          {currentStop.cost}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BACK OF CARD (Turn-around Side: Insider tips, booking, logistics, notes) */}
                  <div className="rotate-y-180 backface-hidden absolute inset-0 rounded-2xl bg-[#2A231F] text-white p-4 sm:p-5 shadow-md border border-[#D96B43]/40 flex flex-col justify-between overflow-y-auto no-scrollbar">
                    <div>
                      <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 pb-1 border-b border-white/10">
                        <div className="flex items-center gap-1.5 text-[#E89E78] font-bold text-[10px] sm:text-xs uppercase tracking-wider">
                          <Info className="w-3.5 h-3.5" />
                          <span>Stop Intelligence & Details</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-stone-400 bg-white/10 px-2 py-0.5 rounded-full">
                          <RotateCw className="w-3 h-3" />
                          <span>Flip back</span>
                        </div>
                      </div>

                      {/* Secret Tip / Notes */}
                      {currentStop.localTip && (
                        <div className="mt-1.5 p-2 sm:p-2.5 rounded-xl bg-white/10 text-xs sm:text-sm text-[#FAF5EE] flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#E89E78] shrink-0 mt-0.5" />
                          <p className="text-xs sm:text-sm leading-relaxed italic text-stone-200 break-words">
                            "{currentStop.localTip}"
                          </p>
                        </div>
                      )}

                      {currentStop.notes && (
                        <p className="text-xs sm:text-sm text-stone-300 mt-1.5 leading-relaxed break-words">
                          📝 {currentStop.notes}
                        </p>
                      )}
                    </div>

                    {/* Booking ticket badge & Leave By Reminder */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm gap-2 flex-wrap">
                      {currentStop.ticketInfo ? (
                        <div className="flex items-center gap-1 text-[#2A9D8F] font-semibold">
                          <Ticket className="w-3.5 h-3.5" />
                          <span className="truncate">{currentStop.ticketInfo}</span>
                        </div>
                      ) : (
                        <span className="text-stone-400 text-[10px] sm:text-xs">No booking required</span>
                      )}

                      {leaveByTime && (
                        <span className="text-[#E89E78] font-bold text-[10px] sm:text-xs bg-[#D96B43]/20 px-2 py-0.5 rounded">
                          Target departure: {leaveByTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IN-SITU BUDDING CONNECTOR BETWEEN CURRENT & UP NEXT */}
            {prefs.showInSituBudding && currentStop && nextStop && (
              <div className="py-0.5">
                <InSituBuddingNode
                  prevItem={currentStop}
                  nextItem={nextStop}
                  leg={transitToNext}
                  insertIndex={currentIndex + 1}
                  isOpen={effectiveBuddingIndex === currentIndex + 1}
                  onOpenChange={(open) => setBuddingSlot(open ? currentIndex + 1 : null)}
                  onInsertStop={handleInsertStopInSitu}
                  label="Bud Stop Between Now & Next"
                />
              </div>
            )}

            {/* 2. UP NEXT STOP (With Prominent "Leave By" Tip, Transit Directions, and Navigation) */}
            {nextStop ? (
              <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#EADBCE] shadow-2xs hover:border-[#D96B43] transition-all group space-y-2.5">
                {/* Up Next Header & Leave By Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-[#8C7A6B]">
                    <ArrowRight className="w-3.5 h-3.5 text-[#D96B43] group-hover:translate-x-0.5 transition-transform" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#716458]">
                      Up Next Stop
                    </span>
                  </div>

                  {/* PROMINENT "LEAVE BY" TIP */}
                  {leaveByTime ? (
                    <div className="flex items-center gap-1.5 bg-[#FFF5EE] text-[#C85327] px-2.5 sm:px-3 py-1 rounded-full border border-[#FCD9C6] text-xs sm:text-sm font-bold shadow-2xs">
                      <Clock className="w-3 h-3 text-[#D96B43]" />
                      <span>Leave by {leaveByTime}</span>
                      <span className="text-[10px] sm:text-xs text-[#A87258] font-normal">
                        ({transitToNext?.durationMinutes}m {transitToNext?.mode === 'ferry' ? 'ferry' : 'walk'})
                      </span>
                    </div>
                  ) : transitToNext ? (
                    <div className="flex items-center gap-1 bg-[#FAF5EE] px-2 py-0.5 rounded-md text-xs sm:text-sm font-bold text-[#D96B43]">
                      <Navigation className="w-3 h-3" />
                      <span>{transitToNext.durationMinutes}m transit</span>
                    </div>
                  ) : null}
                </div>

                {/* Stop content */}
                <div
                  onClick={() => {
                    onSelectItem(nextStop.id);
                    setExpandedId(nextStop.id);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#D96B43]">
                      {nextStop.time}
                    </span>
                    <span className="text-xs sm:text-sm text-[#8C7A6B]">· {nextStop.neighborhood || 'Central'}</span>
                  </div>
                  <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#2C2623] group-hover:text-[#D96B43] transition-colors mt-0.5 leading-snug break-words">
                    {nextStop.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#716458] mt-1 line-clamp-2 leading-relaxed break-words">
                    {nextStop.subtitle}
                  </p>
                </div>

                {/* Turn-by-Turn Directions to Next Stop Button & Expander */}
                {transitToNext && (
                  <div className="pt-2 border-t border-[#F0EBE1]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUpNextDirections(!showUpNextDirections);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] text-xs sm:text-sm font-semibold text-[#2C2623] transition-colors shadow-2xs"
                      >
                        <Footprints className="w-3.5 h-3.5 text-[#D96B43]" />
                        <span>{showUpNextDirections ? 'Hide Directions' : `View Walking Directions (${transitToNext.durationMinutes}m)`}</span>
                        {showUpNextDirections ? (
                          <ChevronUp className="w-3.5 h-3.5 text-[#8C7A6B]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[#8C7A6B]" />
                        )}
                      </button>

                      {transitToNext.googleMapsUrl && (
                        <a
                          href={transitToNext.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#2A9D8F] hover:underline"
                        >
                          <span>Open in Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Inline directions dropdown on Up Next card */}
                    {showUpNextDirections && currentStop && (
                      <div className="mt-2">
                        <TurnByTurnDirectionsView
                          leg={transitToNext}
                          fromItem={currentStop}
                          toItem={nextStop}
                          defaultExpanded={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EADBCE] text-center text-xs text-[#8C7A6B]">
                🎉 You’ve reached the final scheduled stop for Day {day.dayNumber}!
              </div>
            )}
          </div>

          {/* STREAMLINED FULL DAY CHRONOLOGY OR NEIGHBORHOOD VIEW */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-xs font-bold text-[#2C2623] tracking-wide block">
                  {timelineGroupMode === 'timeline' ? 'All Scheduled Stops' : 'Stops by Neighbourhood'}
                </span>
                <span className="text-[10px] text-[#8C7A6B]">
                  {items.length} stops scheduled
                </span>
              </div>

              {/* Toggle: Time Sequence vs Neighborhood View */}
              <div className="flex items-center gap-1 bg-[#FAF5EE] p-0.5 rounded-xl border border-[#EADBCE]">
                <button
                  type="button"
                  onClick={() => setTimelineGroupMode('timeline')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    timelineGroupMode === 'timeline'
                      ? 'bg-white text-[#2C2623] shadow-2xs font-bold border border-[#EADBCE]'
                      : 'text-[#716458] hover:text-[#2C2623]'
                  }`}
                >
                  <Clock className="w-3 h-3 text-[#D96B43]" />
                  <span>Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineGroupMode('neighborhood')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    timelineGroupMode === 'neighborhood'
                      ? 'bg-white text-[#2C2623] shadow-2xs font-bold border border-[#EADBCE]'
                      : 'text-[#716458] hover:text-[#2C2623]'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-[#2A9D8F]" />
                  <span>Neighbourhood</span>
                </button>
              </div>
            </div>

            {/* OPTION A: TIMELINE VIEW */}
            {timelineGroupMode === 'timeline' && (
              <div className="space-y-2">
                {/* Morning Starter Budding Slot */}
                {prefs.showInSituBudding && items.length > 0 && (
                  <InSituBuddingNode
                    nextItem={items[0]}
                    insertIndex={0}
                    isOpen={effectiveBuddingIndex === 0}
                    onOpenChange={(open) => setBuddingSlot(open ? 0 : null)}
                    onInsertStop={handleInsertStopInSitu}
                    label="Bud Morning Starter Stop"
                  />
                )}

                {items.map((item, index) => {
                  const isExpanded = expandedId === item.id;
                  const isSelected = activeItemId === item.id;
                  const isCurrent = index === currentIndex;
                  const nextItem = items[index + 1];
                  const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

                  return (
                    <div key={item.id} className="space-y-1.5">
                      <SwipeableItineraryCard
                        item={item}
                        index={index}
                        isCurrent={isCurrent}
                        isSelected={isSelected}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleExpand(item.id)}
                        onSelect={() => onSelectItem(item.id)}
                        onToggleComplete={handleToggleComplete}
                        onArchive={handleArchive}
                        onDelete={onDeleteItem}
                        onLocateOnMap={() => {
                          onSelectItem(item.id);
                          setPerspective('map');
                        }}
                        preferences={prefs}
                      />

                      {/* Turn-by-Turn Directions between stops */}
                      {leg && nextItem && (
                        <div className="px-1 py-1">
                          <TurnByTurnDirectionsView
                            leg={leg}
                            fromItem={item}
                            toItem={nextItem}
                          />
                        </div>
                      )}

                      {/* In-Situ Budding Node: Direct in-timeline stop insertion */}
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
                    </div>
                  );
                })}

                {/* Evening End-of-Day Budding Slot */}
                {prefs.showInSituBudding && items.length > 0 && (
                  <InSituBuddingNode
                    prevItem={items[items.length - 1]}
                    insertIndex={items.length}
                    isOpen={effectiveBuddingIndex === items.length}
                    onOpenChange={(open) => setBuddingSlot(open ? items.length : null)}
                    onInsertStop={handleInsertStopInSitu}
                    label="Bud Stop to End of Day"
                  />
                )}
              </div>
            )}

            {/* OPTION B: NEIGHBOURHOOD CLUSTER VIEW (Collapsible per neighborhood) */}
            {timelineGroupMode === 'neighborhood' && (
              <div className="space-y-4">
                {/* Neighborhood Clusters Global Control Bar */}
                <div className="flex items-center justify-between px-1 bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EADBCE]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#D96B43]" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#2C2623]">Neighborhood Districts</h4>
                      <p className="text-[10px] sm:text-xs text-[#8C7A6B]">
                        {Object.keys(neighborhoodGroups).length} districts · {items.length} total stops
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
                    <button
                      type="button"
                      onClick={expandAllNeighborhoods}
                      className="px-2 sm:px-2.5 py-1 bg-white hover:bg-[#FAF5EE] text-[#5C473A] font-semibold rounded-lg border border-[#EADBCE] shadow-2xs transition-all"
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllNeighborhoods}
                      className="px-2 sm:px-2.5 py-1 bg-white hover:bg-[#FAF5EE] text-[#5C473A] font-semibold rounded-lg border border-[#EADBCE] shadow-2xs transition-all"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                {/* Individual Neighborhood Clusters */}
                {Object.entries(neighborhoodGroups).map(([neighborhood, nItems]) => {
                  const isNeighborhoodCollapsed = !!collapsedNeighborhoods[neighborhood];
                  const totalStayMinutes = nItems.reduce((acc, curr) => acc + (curr.estimatedStayMinutes || 45), 0);
                  const firstTime = nItems[0]?.time;
                  const lastTime = nItems[nItems.length - 1]?.time;

                  return (
                    <div
                      key={neighborhood}
                      className="bg-white rounded-2xl border border-[#EADBCE] shadow-2xs transition-all overflow-hidden"
                    >
                      {/* Neighborhood Section Header (Clickable toggle) */}
                      <div
                        onClick={() => toggleNeighborhoodCollapse(neighborhood)}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF8F5]/80 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FAF5EE] border border-[#EADBCE] flex items-center justify-center text-[#D96B43] shrink-0">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm sm:text-base font-bold text-[#2C2623] truncate">
                                {neighborhood}
                              </h4>
                              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF5EE] border border-[#EADBCE] text-[#D96B43]">
                                {nItems.length} {nItems.length === 1 ? 'stop' : 'stops'}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm text-[#8C7A6B] block mt-0.5">
                              {firstTime} – {lastTime} · ~{totalStayMinutes} mins total
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectItem(nItems[0].id);
                              setPerspective('map');
                            }}
                            className="text-xs sm:text-sm font-semibold text-[#2A9D8F] bg-[#EAF6F4] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#D0EBE7] hover:bg-[#DDF1EE] transition-colors"
                          >
                            Explore Area →
                          </button>

                          <div
                            className={`p-1 rounded-lg text-[#8C7A6B] hover:text-[#2C2623] transition-transform duration-200 ${
                              isNeighborhoodCollapsed ? '-rotate-90' : 'rotate-0'
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Collapsed State Summary Track (Mini Preview) */}
                      {isNeighborhoodCollapsed ? (
                        <div
                          onClick={() => toggleNeighborhoodCollapse(neighborhood)}
                          className="px-3.5 pb-3.5 pt-1 border-t border-[#F0EBE1] bg-[#FAF8F5]/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                            {nItems.map((item) => (
                              <span
                                key={item.id}
                                className="shrink-0 text-[10px] sm:text-xs bg-white text-[#5C473A] border border-[#EADBCE] px-2 py-1 rounded-lg font-medium flex items-center gap-1 shadow-2xs"
                              >
                                <span className="font-mono font-bold text-[#D96B43]">{item.time}</span>
                                <span className="truncate max-w-[130px]">{item.title}</span>
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] sm:text-xs text-[#8C7A6B] mt-1.5 flex items-center gap-1">
                            <span>Tap to expand full details for {neighborhood}</span>
                            <ChevronDown className="w-3 h-3 text-[#D96B43]" />
                          </p>
                        </div>
                      ) : (
                        /* Expanded Stops within this neighborhood */
                        <div className="p-3 sm:p-4 pt-1 border-t border-[#F0EBE1] space-y-2.5">
                          {nItems.map((item, nIdx) => {
                            const isExpanded = expandedId === item.id;
                            const isSelected = activeItemId === item.id;

                            return (
                              <SwipeableItineraryCard
                                key={item.id}
                                item={item}
                                index={nIdx}
                                isSelected={isSelected}
                                isExpanded={isExpanded}
                                onToggleExpand={() => toggleExpand(item.id)}
                                onSelect={() => onSelectItem(item.id)}
                                onToggleComplete={handleToggleComplete}
                                onArchive={handleArchive}
                                onDelete={onDeleteItem}
                                onLocateOnMap={() => {
                                  onSelectItem(item.id);
                                  setPerspective('map');
                                }}
                                preferences={prefs}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSPECTIVE 2: MAP BALANCED (Synchronized Live Split Flow)    */}
      {/* ============================================================ */}
      {perspective === 'map' && (() => {
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

        return (
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 h-full">
            {/* Top Toolbar: View mode toggles & quick stop pill track */}
            <div className="px-3 py-2 bg-white/95 backdrop-blur-md border-b border-[#EADBCE] shrink-0 flex flex-col gap-1.5 shadow-2xs z-20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#2A9D8F]" />
                  <span className="text-xs sm:text-sm font-bold text-[#2C2623]">
                    Map & Stops Sync
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF5EE] border border-[#EADBCE] text-[#8C7A6B]">
                    {items.length} stops
                  </span>
                </div>

                {/* Tactile Split Snap Controls */}
                <div className="flex items-center bg-[#FAF5EE] rounded-xl p-0.5 border border-[#EADBCE] text-[10px] sm:text-xs font-semibold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setMapSplitSnap('half')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      mapSplitSnap === 'half'
                        ? 'bg-[#2A9D8F] text-white shadow-xs font-bold'
                        : 'text-[#716458] hover:text-[#2C2623]'
                    }`}
                  >
                    50/50 Dual
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapSplitSnap('peek')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      mapSplitSnap === 'peek'
                        ? 'bg-[#2C2623] text-white shadow-xs font-bold'
                        : 'text-[#716458] hover:text-[#2C2623]'
                    }`}
                  >
                    Map + Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapSplitSnap('full')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      mapSplitSnap === 'full'
                        ? 'bg-[#2C2623] text-white shadow-xs font-bold'
                        : 'text-[#716458] hover:text-[#2C2623]'
                    }`}
                  >
                    List Focus
                  </button>
                </div>
              </div>

              {/* Horizontal Quick-Jump Stop Pill Track */}
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
                          : 'bg-white text-[#5C473A] border border-[#EADBCE] hover:border-[#D96B43]'
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

            {/* Upper Pane: Leaflet Interactive Map + Floating Stop Card Overlay */}
            <div className={`w-full transition-all duration-300 relative border-b border-[#EADBCE] shrink-0 min-h-[220px] ${splitStyles[mapSplitSnap].map}`}>
              <InteractiveMap
                items={items}
                activeItemId={currentMapStop.id}
                onSelectItem={onSelectItem}
                className="w-full h-full"
                showTransitLegs={true}
              />

              {/* Seamless Floating Active Stop Card (Apple Maps Style) */}
              {mapSplitSnap !== 'full' && (
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
                        {mapSplitSnap === 'peek' && (
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
                    {transitLegToNext && mapSplitSnap === 'peek' && (
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

            {/* Lower Pane: Synchronized Timeline Sheet with Neighborhood Groupings */}
            <div className={`w-full transition-all duration-300 flex flex-col bg-[#FAF8F5] overflow-y-auto p-3 sm:p-4 space-y-3.5 min-h-0 flex-1 pb-16 no-scrollbar ${splitStyles[mapSplitSnap].list}`}>
              <div className="flex items-center justify-between text-xs text-[#8C7A6B] pb-1 border-b border-[#EADBCE]">
                <span className="font-semibold text-[#2C2623] text-xs sm:text-sm">
                  Complete Itinerary Timeline
                </span>
                <span className="text-[10px] sm:text-xs">
                  Tap card to center on map
                </span>
              </div>

              {Object.entries(neighborhoodGroups).map(([neighborhood, groupItems]) => (
                <div key={neighborhood} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#2C2623] pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2A9D8F]" />
                    <span>{neighborhood}</span>
                    <span className="text-[10px] sm:text-xs text-[#8C7A6B] font-normal">({groupItems.length} stops)</span>
                  </div>

                  <div className="space-y-2">
                    {groupItems.map((item) => {
                      const isSelected = currentMapStop.id === item.id;
                      const globalIdx = items.findIndex((it) => it.id === item.id);
                      const isExpanded = expandedId === item.id;
                      const nextItem = items[globalIdx + 1];
                      const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

                      return (
                        <div key={item.id} className="space-y-1.5">
                          <SwipeableItineraryCard
                            item={item}
                            index={globalIdx}
                            isSelected={isSelected}
                            isExpanded={isExpanded}
                            onToggleExpand={() => {
                              onSelectItem(item.id);
                              setExpandedId(isExpanded ? null : item.id);
                            }}
                            onSelect={() => onSelectItem(item.id)}
                            onToggleComplete={handleToggleComplete}
                            onArchive={handleArchive}
                            onDelete={onDeleteItem}
                            onLocateOnMap={() => onSelectItem(item.id)}
                            preferences={prefs}
                          />

                          {/* Transit Connector Between Stops */}
                          {leg && (
                            <div className="py-1 px-3 text-[10px] sm:text-xs text-[#8C7A6B] flex items-center justify-between gap-2 bg-white/60 rounded-xl border border-[#F0EBE1] ml-2.5 mr-2.5">
                              <div className="flex items-center gap-2">
                                <Footprints className="w-3.5 h-3.5 text-[#D96B43]" />
                                <span>
                                  {leg.durationMinutes} min {leg.mode === 'ferry' ? 'water ferry' : 'walk'} ({leg.distanceKm} km) to Stop {globalIdx + 2}
                                </span>
                              </div>
                              {leg.googleMapsUrl && (
                                <a
                                  href={leg.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#2A9D8F] hover:underline font-semibold flex items-center gap-0.5"
                                >
                                  <span>Map route</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* In-Situ Budding Node in Map Split Sheet */}
                          {prefs.showInSituBudding && items[globalIdx + 1] && (
                            <InSituBuddingNode
                              prevItem={item}
                              nextItem={items[globalIdx + 1]}
                              leg={leg}
                              insertIndex={globalIdx + 1}
                              isOpen={effectiveBuddingIndex === globalIdx + 1}
                              onOpenChange={(open) => setBuddingSlot(open ? globalIdx + 1 : null)}
                              onInsertStop={handleInsertStopInSitu}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* PERSPECTIVE 3: QUICK EDITOR (High Density & Inline Actions)  */}
      {/* ============================================================ */}
      {perspective === 'editor' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3 pb-20 no-scrollbar">
          <div className="p-3 bg-white rounded-2xl border border-[#EADBCE] flex items-center justify-between text-xs text-[#716458] shadow-2xs">
            <span className="font-semibold text-[#2C2623]">{items.length} scheduled stops</span>
            <span className="text-[11px] text-[#8C7A6B]">Click time to change · In-situ budding enabled</span>
          </div>

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

            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                <div className="flex items-start gap-2">
                  {/* Reorder up/down buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0 pt-2 bg-white/70 p-1 rounded-xl border border-[#EADBCE]">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label="Move earlier"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE] disabled:opacity-20 transition-colors"
                      title="Move stop earlier"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label="Move later"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE] disabled:opacity-20 transition-colors"
                      title="Move stop later"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <SwipeableItineraryCard
                      item={item}
                      index={index}
                      isSelected={activeItemId === item.id}
                      isExpanded={expandedId === item.id}
                      onToggleExpand={() => toggleExpand(item.id)}
                      onSelect={() => onSelectItem(item.id)}
                      onToggleComplete={handleToggleComplete}
                      onArchive={handleArchive}
                      onDelete={onDeleteItem}
                      onLocateOnMap={() => {
                        onSelectItem(item.id);
                        setPerspective('map');
                      }}
                      preferences={prefs}
                    />
                  </div>
                </div>

                {/* In-Situ Budding Node in Editor */}
                {prefs.showInSituBudding && items[index + 1] && (
                  <InSituBuddingNode
                    prevItem={item}
                    nextItem={items[index + 1]}
                    insertIndex={index + 1}
                    isOpen={effectiveBuddingIndex === index + 1}
                    onOpenChange={(open) => setBuddingSlot(open ? index + 1 : null)}
                    onInsertStop={handleInsertStopInSitu}
                  />
                )}
              </React.Fragment>
            ))}

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
        </div>
      )}

      {/* Offline Directions Download Modal */}
      <OfflineDirectionsModal
        day={day}
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </div>
  );
};
