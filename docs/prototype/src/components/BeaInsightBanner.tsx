import React, { useState } from 'react';
import { MascotAvatar } from './MascotAvatar';
import { Sparkles, Volume2, VolumeX, ThumbsUp, Bookmark, ChevronRight, Check } from 'lucide-react';

interface BeaInsightBannerProps {
  insight: string;
  variant?: 'minimal' | 'compact' | 'callout';
  className?: string;
  onExploreMore?: () => void;
}

export const BeaInsightBanner: React.FC<BeaInsightBannerProps> = ({
  insight,
  variant = 'compact',
  className = '',
  onExploreMore
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mascotState, setMascotState] = useState<'idle' | 'thinking' | 'sniffing' | 'found'>('idle');

  if (!insight) return null;

  const handleMascotClick = () => {
    const states: Array<'idle' | 'thinking' | 'sniffing' | 'found'> = ['thinking', 'sniffing', 'found', 'idle'];
    const nextIdx = (states.indexOf(mascotState) + 1) % states.length;
    setMascotState(states[nextIdx]);
  };

  if (variant === 'minimal') {
    return (
      <div className={`flex items-start gap-2.5 text-xs sm:text-sm text-[#5C473A] bg-[#FAF5EE] border border-[#EADBCE] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 transition-all ${className}`}>
        <MascotAvatar
          size="sm"
          state={mascotState}
          onClick={handleMascotClick}
          className="mt-0.5 cursor-pointer hover:scale-110 transition-transform shrink-0"
        />
        <div className="flex-1 leading-relaxed min-w-0">
          <span className="font-bold text-[#3B2518] text-xs sm:text-sm">Béa: </span>
          <span className="text-xs sm:text-sm text-[#5C473A] break-words">{insight}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-gradient-to-br from-[#FFFDF9] via-[#FAF5EE] to-[#F5ECE0] border border-[#EADBCE] rounded-2xl p-3 sm:p-4 shadow-2xs transition-all hover:shadow-xs ${className}`}
    >
      {/* Header bar with interactive Mascot and audio trigger */}
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="relative shrink-0" onClick={handleMascotClick} title="Tap Béa to interact">
          <MascotAvatar
            size="md"
            state={mascotState}
            className="w-8 h-8 sm:w-10 sm:h-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#2A9D8F] rounded-full ring-2 ring-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#2C2623] tracking-tight">
                Béa’s Daily Companion Note
              </span>
              <span className="text-[10px] sm:text-xs text-[#8C7A6B] bg-white/70 px-1.5 py-0.5 rounded-md border border-[#EADBCE] shrink-0 font-medium">
                Live Insight
              </span>
            </div>

            {/* Audio narration simulation button */}
            <button
              type="button"
              onClick={() => setIsPlayingAudio(!isPlayingAudio)}
              title={isPlayingAudio ? "Mute Béa's audio note" : "Listen to Béa's voice note"}
              className={`p-1.5 rounded-lg border text-xs transition-all flex items-center gap-1 shrink-0 ${
                isPlayingAudio
                  ? 'bg-[#D96B43] text-white border-[#D96B43] shadow-2xs animate-pulse'
                  : 'bg-white text-[#5C473A] border-[#EADBCE] hover:text-[#D96B43]'
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-[11px] font-semibold hidden xs:inline">Playing</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#8C7A6B]" />
                  <span className="text-[10px] sm:text-[11px] font-medium hidden xs:inline">Listen</span>
                </>
              )}
            </button>
          </div>

          {/* Note content with responsive typography */}
          <p className="text-xs sm:text-sm text-[#4A3B32] leading-relaxed break-words font-medium">
            {insight}
          </p>

          {/* Interactive contextual actions & chips */}
          <div className="mt-2.5 pt-2 border-t border-[#EADBCE]/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[10px] sm:text-xs font-semibold text-[#D96B43] bg-white hover:bg-[#FAF8F5] px-2 sm:px-2.5 py-1 rounded-lg border border-[#EADBCE] flex items-center gap-1 transition-all shadow-2xs active:scale-95"
              >
                <Sparkles className="w-3 h-3 text-[#D96B43]" />
                <span>{isExpanded ? 'Less details' : 'More advice'}</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {onExploreMore && (
                <button
                  type="button"
                  onClick={onExploreMore}
                  className="text-[10px] sm:text-xs font-semibold text-[#2A9D8F] bg-[#EAF6F4] hover:bg-[#DDF1EE] px-2 sm:px-2.5 py-1 rounded-lg border border-[#D0EBE7] transition-all shadow-2xs"
                >
                  Nearby Spots →
                </button>
              )}
            </div>

            {/* Helpful & Bookmark Reactions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setHasLiked(!hasLiked)}
                title="Mark this tip helpful"
                className={`p-1.5 rounded-lg border text-xs transition-all flex items-center gap-1 ${
                  hasLiked
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                    : 'bg-white text-[#716458] border-[#EADBCE] hover:text-[#2A9D8F]'
                }`}
              >
                {hasLiked ? <Check className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
                <span className="text-[10px] sm:text-[11px] font-semibold">{hasLiked ? 'Helpful' : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => setHasBookmarked(!hasBookmarked)}
                title="Save tip to your itinerary notes"
                className={`p-1.5 rounded-lg border text-xs transition-all ${
                  hasBookmarked
                    ? 'bg-[#D96B43] text-white border-[#D96B43]'
                    : 'bg-white text-[#716458] border-[#EADBCE] hover:text-[#D96B43]'
                }`}
              >
                <Bookmark className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Interactive Expanded Insights Tray */}
          {isExpanded && (
            <div className="mt-2.5 p-2.5 sm:p-3 bg-white/90 rounded-xl border border-[#EADBCE] space-y-2 text-xs sm:text-sm text-[#5C473A] animate-fadeIn">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#2C2623]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D96B43]" />
                <span>Béa’s Pacing & Local Etiquette</span>
              </div>
              <p className="text-xs sm:text-sm text-[#4A3B32] leading-snug">
                Travel lightly in the morning. Cash is preferred at small island shrines and local okonomiyaki counters. Keep your rail pass handy for the tram.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
