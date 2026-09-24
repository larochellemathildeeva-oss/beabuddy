import React from 'react';
import { ItineraryItem, SavedPlace } from '../types';
import { X, Bookmark, Plus, MapPin, Clock } from 'lucide-react';

interface SavedPlacesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedPlaces: SavedPlace[];
  onAddPlaceToDay: (place: SavedPlace) => void;
  activeDayNumber: number;
}

export const SavedPlacesDrawer: React.FC<SavedPlacesDrawerProps> = ({
  isOpen,
  onClose,
  savedPlaces,
  onAddPlaceToDay,
  activeDayNumber
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[#FAF8F5] border-l border-[#E8DFD3] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8DFD3] bg-white">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#D96B43]" />
            <h2 className="text-sm font-bold text-[#2C2623]">Saved Places ({savedPlaces.length})</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <p className="text-xs text-[#716458] leading-relaxed">
            Stashed spots and recommendations. Tap to slot them directly into <strong>Day {activeDayNumber}</strong>:
          </p>

          {savedPlaces.map((sp) => (
            <div
              key={sp.id}
              className="p-3.5 bg-white border border-[#E8DFD3] rounded-2xl hover:border-[#D96B43] transition-all space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#2C2623] group-hover:text-[#D96B43] transition-colors">
                    {sp.title}
                  </h4>
                  <div className="text-[11px] text-[#8C7A6B] flex items-center gap-1.5 mt-0.5">
                    <span>{sp.neighborhood}</span>
                    <span>·</span>
                    <span>~{sp.recommendedTimeMinutes}m</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddPlaceToDay(sp);
                  }}
                  className="px-2.5 py-1 bg-[#FAF5EE] hover:bg-[#D96B43] text-[#D96B43] hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Day {activeDayNumber}</span>
                </button>
              </div>

              {sp.notes && (
                <p className="text-[11px] text-[#5C473A] bg-[#FAF5EE] p-2 rounded-xl">
                  {sp.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
