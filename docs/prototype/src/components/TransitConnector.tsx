import React, { useState } from 'react';
import { TransitLeg, TransitMode } from '../types';
import { Car, Footprints, Train, Ship, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface TransitConnectorProps {
  leg: TransitLeg;
  onHoverLeg?: (leg: TransitLeg | null) => void;
  onClickLeg?: (leg: TransitLeg) => void;
  isActive?: boolean;
}

const MODE_CONFIG: Record<TransitMode, { icon: React.FC<{ className?: string }>; label: string; color: string; bg: string }> = {
  walk: { icon: Footprints, label: 'Walk', color: '#2A9D8F', bg: '#EAF6F4' },
  drive: { icon: Car, label: 'Drive', color: '#E76F51', bg: '#FDEEE9' },
  transit: { icon: Train, label: 'Transit', color: '#3D5A80', bg: '#EBF2F7' },
  train: { icon: Train, label: 'Train', color: '#3D5A80', bg: '#EBF2F7' },
  ferry: { icon: Ship, label: 'Ferry/Boat', color: '#264653', bg: '#E5ECF0' }
};

export const TransitConnector: React.FC<TransitConnectorProps> = ({
  leg,
  onHoverLeg,
  onClickLeg,
  isActive = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const config = MODE_CONFIG[leg.mode] || MODE_CONFIG.drive;
  const IconComponent = config.icon;

  return (
    <div
      id={`transit-connector-${leg.id}`}
      className="relative pl-10 pr-2 py-1 my-0.5 group transition-colors select-none"
      onMouseEnter={() => onHoverLeg?.(leg)}
      onMouseLeave={() => onHoverLeg?.(null)}
    >
      {/* Sleek vertical connecting line */}
      <div className="absolute left-[26px] top-0 bottom-0 w-0.5 bg-[#E6DDD0] group-hover:bg-[#D97742] transition-colors" />

      {/* Slim transit capsule */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onClickLeg?.(leg);
            if (leg.instructions) {
              setExpanded(!expanded);
            }
          }}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer shadow-2xs ${
            isActive
              ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] ring-2 ring-[#2A9D8F]/20'
              : 'bg-[#FCFBF8] text-[#5C5248] border-[#E8DFD3] hover:border-[#D97742] hover:bg-white'
          }`}
          title={leg.instructions ? "Click to view route & highlight on map" : "Click to highlight on map"}
        >
          <IconComponent className={`w-3 h-3 ${isActive ? 'text-white' : 'text-[#7A6E63]'}`} />
          <span className="font-semibold">{leg.durationMinutes} min {config.label.toLowerCase()}</span>
          {leg.instructions && (
            <span className="text-[10px] text-[#A39688] ml-0.5">
              {expanded ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
            </span>
          )}
        </button>
      </div>

      {/* Expandable turn-by-turn route detail */}
      {expanded && leg.instructions && (
        <div className="mt-1 text-xs text-[#5C5247] bg-[#F7F4EE] border border-[#E8DFD3] p-2 rounded-xl flex items-start gap-1.5 animate-in fade-in duration-150">
          <MapPin className="w-3 h-3 text-[#D97742] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">{leg.instructions}</p>
        </div>
      )}
    </div>
  );
};
