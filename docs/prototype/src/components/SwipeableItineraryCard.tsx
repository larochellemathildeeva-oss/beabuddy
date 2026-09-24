import React, { useState, useRef, useEffect } from 'react';
import { ItineraryItem, UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../types';
import {
  Check,
  Archive,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Ticket,
  Map,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';

interface SwipeableItineraryCardProps {
  item: ItineraryItem;
  index: number;
  isCurrent?: boolean;
  isSelected?: boolean;
  isExpanded?: boolean;
  onToggleExpand: () => void;
  onSelect?: () => void;
  onToggleComplete: (itemId: string) => void;
  onArchive: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onLocateOnMap?: () => void;
  preferences?: UserUiPreferences;
}

export const SwipeableItineraryCard: React.FC<SwipeableItineraryCardProps> = ({
  item,
  index,
  isCurrent = false,
  isSelected = false,
  isExpanded = false,
  onToggleExpand,
  onSelect,
  onToggleComplete,
  onArchive,
  onDelete,
  onLocateOnMap,
  preferences
}) => {
  const prefs = preferences || DEFAULT_UI_PREFERENCES;
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Gesture State
  const [translateX, setTranslateX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isOpenActions, setIsOpenActions] = useState<boolean>(false);
  const [flashComplete, setFlashComplete] = useState<boolean>(false);

  // Gesture Tracking Refs
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentTranslateRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Keep ref synchronized with state for event callbacks
  useEffect(() => {
    currentTranslateRef.current = translateX;
  }, [translateX]);

  // Click outside to close open swipe actions
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpenActions) {
          setIsOpenActions(false);
          setTranslateX(0);
        }
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpenActions]);

  // =========================================================================
  // ROBUST POINTER GESTURE HANDLERS (Handles Touch, Mouse, and Trackpad)
  // =========================================================================

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left mouse click or single finger touch)
    if (e.button !== 0) return;

    // Do not initiate swipe if clicking directly on a button, select, or link inside the card
    const interactiveEl = (e.target as HTMLElement).closest('button, select, input, a');
    if (interactiveEl) {
      return;
    }

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    hasMovedRef.current = false;
    directionLockedRef.current = null;
    activePointerIdRef.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {
      // Browser may not support or allow capture on detached elements
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect direction lock in first 5px of movement
    if (directionLockedRef.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          directionLockedRef.current = 'horizontal';
          setIsDragging(true);
        } else {
          directionLockedRef.current = 'vertical';
        }
      }
    }

    if (directionLockedRef.current === 'horizontal') {
      hasMovedRef.current = true;
      const baseOffset = isOpenActions ? -140 : 0;
      let targetX = baseOffset + dx;

      // Elastic resistance past bounds
      if (targetX > 130) {
        targetX = 130 + (targetX - 130) * 0.25;
      } else if (targetX < -210) {
        targetX = -210 + (targetX + 210) * 0.25;
      }

      setTranslateX(targetX);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    activePointerIdRef.current = null;
    setIsDragging(false);

    if (directionLockedRef.current === 'horizontal') {
      const currentX = currentTranslateRef.current;

      // 1. SWIPE RIGHT: Trigger Complete / Incomplete
      if (currentX > 65) {
        setFlashComplete(true);
        onToggleComplete(item.id);
        setTranslateX(0);
        setIsOpenActions(false);
        setTimeout(() => setFlashComplete(false), 800);
        return;
      }

      // 2. FULL SWIPE LEFT: Quick Delete (> 170px)
      if (currentX < -170) {
        onDelete(item.id);
        setTranslateX(0);
        setIsOpenActions(false);
        return;
      }

      // 3. PARTIAL SWIPE LEFT: Reveal Archive & Delete Buttons (< -40px)
      if (currentX < -40) {
        setTranslateX(-140);
        setIsOpenActions(true);
        return;
      }

      // 4. Below threshold: Snap closed
      setTranslateX(0);
      setIsOpenActions(false);
    }

    directionLockedRef.current = null;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  // Click handler on card
  const handleCardClick = (e: React.MouseEvent) => {
    // If movement occurred during pointer interactions, swallow the click
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasMovedRef.current = false;
      return;
    }

    // If actions were already open and user taps card, snap it closed
    if (isOpenActions) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpenActions(false);
      setTranslateX(0);
      return;
    }

    // Normal tap: expand/collapse activity details
    onToggleExpand();
  };

  const isCompleted = !!item.isCompleted;
  const isRightThresholdPassed = translateX > 65;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl select-none group touch-pan-y"
    >
      {/* ============================================================ */}
      {/* 1. BACKGROUND ACTION: RIGHT SWIPE (Complete / Incomplete)    */}
      {/* ============================================================ */}
      <div
        className={`absolute inset-y-0 left-0 flex items-center px-4 transition-colors duration-150 ${
          isCompleted
            ? 'bg-[#D96B43]'
            : isRightThresholdPassed
            ? 'bg-[#21867a]'
            : 'bg-[#2A9D8F]'
        }`}
        style={{
          width: Math.max(0, translateX + 30),
          opacity: translateX > 8 ? 1 : 0
        }}
      >
        <div
          className="flex items-center gap-2 text-white font-bold text-xs"
          style={{
            transform: `scale(${isRightThresholdPassed ? 1.12 : Math.min(1, Math.max(0.75, translateX / 60))})`,
            transition: 'transform 0.15s ease-out'
          }}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
              isRightThresholdPassed ? 'bg-white text-[#21867a]' : 'bg-white/20 text-white'
            }`}
          >
            {isCompleted ? (
              <RotateCcw className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
          </div>
          <span className="font-semibold whitespace-nowrap hidden xs:inline">
            {isCompleted
              ? 'Mark Incomplete'
              : isRightThresholdPassed
              ? 'Release to Complete! 🎉'
              : 'Complete'}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. BACKGROUND ACTION: LEFT SWIPE (Archive & Delete)          */}
      {/* ============================================================ */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch z-0 bg-[#FAF5EE]"
        style={{
          width: 140,
          opacity: translateX < -10 || isOpenActions ? 1 : 0
        }}
      >
        {/* Archive Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTranslateX(0);
            setIsOpenActions(false);
            onArchive(item.id);
          }}
          className="flex-1 bg-[#D96B43] hover:bg-[#C25832] text-white flex flex-col items-center justify-center gap-1 transition-colors px-2 py-3 active:scale-95"
          title="Archive activity to Saved Places"
        >
          <Archive className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-tight">Archive</span>
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTranslateX(0);
            setIsOpenActions(false);
            onDelete(item.id);
          }}
          className="flex-1 bg-[#E76F51] hover:bg-[#D45A3C] text-white flex flex-col items-center justify-center gap-1 transition-colors px-2 py-3 active:scale-95"
          title="Delete stop from day"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-tight">Delete</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 3. FOREGROUND SWIPABLE CARD LAYER                            */}
      {/* ============================================================ */}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleCardClick}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
          touchAction: 'pan-y'
        }}
        className={`p-3.5 rounded-2xl border transition-colors cursor-grab active:cursor-grabbing bg-white relative z-10 select-none ${
          flashComplete
            ? 'ring-4 ring-[#2A9D8F]/30 border-[#2A9D8F]'
            : isCompleted
            ? 'bg-[#FAFBF9] border-[#D0EBE7]/80 text-[#5C473A]'
            : isSelected
            ? 'border-[#D96B43] ring-2 ring-[#D96B43]/15 shadow-sm'
            : 'border-[#EADBCE] hover:border-[#B5A597] shadow-2xs'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Sequence & Time */}
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`text-xs font-mono font-bold mt-0.5 ${
                  isCompleted ? 'text-[#2A9D8F]' : 'text-[#D96B43]'
                }`}
              >
                {item.time}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 ${
                  isCompleted
                    ? 'text-[#2A9D8F] bg-[#EAF6F4]'
                    : 'text-[#A8988B] bg-[#FAF5EE]'
                }`}
              >
                #{index + 1}
              </span>
            </div>

            {/* Title & Description */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4
                  className={`text-sm sm:text-base font-bold leading-snug transition-colors break-words ${
                    isCompleted
                      ? 'text-[#4A3B32] line-through decoration-[#2A9D8F]/60'
                      : 'text-[#2C2623] group-hover:text-[#D96B43]'
                  }`}
                >
                  {item.title}
                </h4>

                {/* Completed badge */}
                {isCompleted && (
                  <span className="text-[10px] font-bold text-[#2A9D8F] bg-[#EAF6F4] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#BDE0DB] shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Completed</span>
                  </span>
                )}

                {isCurrent && !isCompleted && (
                  <span className="text-[9px] font-bold text-white bg-[#D96B43] px-2 py-0.5 rounded-full shrink-0">
                    Current
                  </span>
                )}
              </div>

              <p
                className={`text-xs mt-0.5 line-clamp-2 leading-relaxed break-words ${
                  isCompleted ? 'text-[#8C7A6B]' : 'text-[#5C473A]'
                }`}
              >
                {item.subtitle}
              </p>

              {/* Metadata row */}
              <div className="text-xs text-[#716458] flex items-center gap-1.5 mt-1 flex-wrap">
                <span>{item.neighborhood || 'Central'}</span>
                <span aria-hidden="true">·</span>
                <span>~{item.estimatedStayMinutes}m</span>
                {item.cost && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.cost}</span>
                  </>
                )}
                {item.isBooked && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#2A9D8F] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Booked
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Icons & Expand Chevron */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {/* Desktop Quick Action Buttons (Available without dragging) */}
            <div
              className="flex items-center gap-0.5 mr-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onToggleComplete(item.id)}
                title={isCompleted ? 'Mark incomplete (or swipe right)' : 'Mark completed (or swipe right)'}
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  isCompleted
                    ? 'text-[#2A9D8F] bg-[#EAF6F4] hover:bg-[#D0EBE7]'
                    : 'text-[#8C7A6B] hover:text-[#2A9D8F] hover:bg-[#EAF6F4]'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onArchive(item.id)}
                title="Archive to Saved Places (or swipe left)"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#8C7A6B] hover:text-[#D96B43] hover:bg-[#FAF5EE] transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(item.id)}
                title="Delete stop (or swipe left)"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#8C7A6B] hover:text-[#E76F51] hover:bg-[#FDEEE9] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Expand / Collapse Chevron */}
            <div className="text-[#8C7A6B] group-hover:text-[#2C2623] transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#2C2623]" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Rich Progressive Disclosure */}
        {isExpanded && (
          <div className="mt-3.5 pt-3.5 border-t border-[#F0EBE1] text-xs text-[#5C473A] space-y-3">
            {item.imageUrl && prefs.showStopPhotos && (
              <div className="relative h-28 w-full rounded-xl overflow-hidden border border-[#EADBCE]">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-2.5">
                  <span className="text-white text-[11px] font-medium drop-shadow-xs">
                    {item.address}
                  </span>
                </div>
              </div>
            )}

            {item.notes && (
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EADBCE]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B] block mb-1">
                  Traveler Notes
                </span>
                <p className="text-[11px] leading-relaxed text-[#4A3B32]">{item.notes}</p>
              </div>
            )}

            {item.localTip && (
              <div className="p-3 bg-[#FDF9F2] rounded-xl border border-[#F0E3D0] flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B43] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D96B43] block mb-0.5">
                    Béa’s Secret Tip
                  </span>
                  <p className="text-[11px] leading-relaxed text-[#5C473A]">{item.localTip}</p>
                </div>
              </div>
            )}

            {item.ticketInfo && (
              <div className="text-[11px] text-[#2A9D8F] bg-[#EAF6F4] p-2.5 rounded-xl border border-[#D0EBE7] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{item.ticketInfo}</span>
                </div>
                {item.bookingCode && (
                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#BDE0DB]">
                    {item.bookingCode}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F0EBE1] gap-2 flex-wrap">
              <span className="text-xs text-[#8C7A6B] break-words flex-1 min-w-0">
                {item.address}
              </span>
              {onLocateOnMap && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLocateOnMap();
                  }}
                  className="text-[#D96B43] font-semibold hover:underline flex items-center gap-1 shrink-0 text-xs"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Locate on Map</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Micro-hint for swipe gestures */}
        <div className="flex items-center justify-between mt-1 pt-1 opacity-50 text-[9px] text-[#8C7A6B]">
          <span>👉 Swipe right to {isCompleted ? 're-open' : 'complete'}</span>
          <span>Swipe left to archive or delete 👈</span>
        </div>
      </div>
    </div>
  );
};
