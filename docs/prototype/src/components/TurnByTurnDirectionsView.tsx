import React, { useState } from 'react';
import { TransitLeg, ItineraryItem } from '../types';
import {
  Navigation,
  Footprints,
  Compass,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  ArrowRight,
  ShieldAlert,
  Ship,
  Train
} from 'lucide-react';

interface TurnByTurnDirectionsViewProps {
  leg: TransitLeg;
  fromItem: ItineraryItem;
  toItem: ItineraryItem;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export const TurnByTurnDirectionsView: React.FC<TurnByTurnDirectionsViewProps> = ({
  leg,
  fromItem,
  toItem,
  defaultExpanded = false,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // Derive leave by time
  const [nh, nm] = toItem.time.split(':').map(Number);
  const nextTotalMins = nh * 60 + nm;
  const leaveTotalMins = Math.max(0, nextTotalMins - leg.durationMinutes);
  const lh = String(Math.floor(leaveTotalMins / 60) % 24).padStart(2, '0');
  const lm = String(leaveTotalMins % 60).padStart(2, '0');
  const leaveByStr = `${lh}:${lm}`;

  const modeIcon = () => {
    if (leg.mode === 'ferry') return <Ship className="w-3.5 h-3.5 text-[#D96B43]" />;
    if (leg.mode === 'transit' || leg.mode === 'train') return <Train className="w-3.5 h-3.5 text-[#2A9D8F]" />;
    return <Footprints className="w-3.5 h-3.5 text-[#D96B43]" />;
  };

  const modeLabel = () => {
    if (leg.mode === 'ferry') return 'Scenic Ferry';
    if (leg.mode === 'transit') return 'City Tram / Transit';
    if (leg.mode === 'train') return 'Train';
    if (leg.mode === 'drive') return 'Taxi / Drive';
    return 'Walk';
  };

  return (
    <div className="my-1.5 rounded-2xl bg-[#FAF6F0] border border-[#EADBCE] p-2.5 sm:p-3 text-xs text-[#2C2623] transition-all shadow-2xs">
      {/* Header bar / collapsed toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl bg-white border border-[#EADBCE] flex items-center justify-center shrink-0 shadow-2xs">
            {modeIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-[#2C2623]">
                {leg.durationMinutes}m {modeLabel()}
              </span>
              <span className="text-[10px] font-medium text-[#8C7A6B]">
                ({leg.distanceKm} km)
              </span>
              <span className="text-[10px] font-bold bg-[#FFF5EE] text-[#C85327] px-2 py-0.5 rounded-full border border-[#FCD9C6]">
                Leave by {leaveByStr}
              </span>
            </div>
            <p className="text-[11px] text-[#716458] truncate mt-0.5">
              {leg.instructions}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {leg.googleMapsUrl && (
            <a
              href={leg.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white hover:bg-[#F2EDE4] border border-[#EADBCE] text-[#5C473A] hover:text-[#D96B43] transition-colors"
              title="Open turn-by-turn navigation in Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F2EDE4] border border-[#EADBCE] text-xs font-semibold text-[#5C473A] hover:text-[#2C2623] transition-colors shadow-2xs"
          >
            <span>{isExpanded ? 'Hide Steps' : 'View Directions'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#D96B43]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#D96B43]" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Turn-by-turn Step by Step Guidance */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[#EADBCE] space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] text-[#8C7A6B] px-1">
            <span className="font-bold text-[#2C2623] uppercase tracking-wider text-[10px]">
              Turn-by-Turn Walking Directions
            </span>
            <span>Target arrival: {toItem.time}</span>
          </div>

          <div className="space-y-2">
            {leg.steps && leg.steps.length > 0 ? (
              leg.steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-[#EADBCE] shadow-2xs"
                >
                  <div className="w-5 h-5 rounded-full bg-[#2C2623] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.stepNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#2C2623] font-medium leading-relaxed break-words">
                      {step.instruction}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-[#8C7A6B]">
                      {step.landmark && (
                        <span className="flex items-center gap-1 text-[#5C473A] bg-[#FAF6F0] px-1.5 py-0.5 rounded">
                          <MapPin className="w-2.5 h-2.5 text-[#D96B43]" />
                          <span className="font-medium truncate max-w-[180px]">
                            {step.landmark}
                          </span>
                        </span>
                      )}
                      {step.distanceMeters && (
                        <span className="font-semibold text-[#D96B43]">
                          ~{step.distanceMeters}m
                        </span>
                      )}
                      {step.durationMinutes && (
                        <span>~{step.durationMinutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 bg-white rounded-xl border border-[#EADBCE] text-xs text-[#716458]">
                {leg.instructions}
              </div>
            )}
          </div>

          {/* Quick helper tip */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#716458]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D96B43] shrink-0" />
              <span>
                Plan to depart <span className="font-bold text-[#2C2623]">{fromItem.title}</span> at{' '}
                <span className="font-bold text-[#C85327]">{leaveByStr}</span>
              </span>
            </div>
            {leg.googleMapsUrl && (
              <a
                href={leg.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#2A9D8F] hover:underline flex items-center gap-1"
              >
                <span>Live Navigation in Maps</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
