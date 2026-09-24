import React from 'react';
import { DayItinerary } from '../types';

interface DaySelectorProps {
  days: DayItinerary[];
  activeDayIndex: number;
  onSelectDay: (index: number) => void;
  className?: string;
}

export const DaySelector: React.FC<DaySelectorProps> = ({
  days,
  activeDayIndex,
  onSelectDay,
  className = ''
}) => {
  return (
    <div className={`relative flex items-center w-full min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 overscroll-x-contain w-full">
        {days.map((day, idx) => {
          const isActive = idx === activeDayIndex;
          const stopCount = day.items.length;

          return (
            <button
              key={day.dayNumber}
              type="button"
              onClick={() => onSelectDay(idx)}
              className={`min-h-[40px] sm:min-h-[46px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-left transition-all whitespace-nowrap shrink-0 flex items-center gap-2 sm:gap-3 border shadow-2xs ${
                isActive
                  ? 'bg-[#2C2623] text-white border-[#2C2623] shadow-sm scale-[1.01]'
                  : 'bg-white hover:bg-[#FAF8F5] text-[#5C473A] border-[#EADBCE]'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#E89E78]' : 'text-[#8C7A6B]'}`}>
                  Day {day.dayNumber}
                </span>
                <span className={`text-xs font-semibold tracking-tight ${isActive ? 'text-[#FFFDF9]' : 'text-[#2C2623]'}`}>
                  {day.dateString}
                </span>
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg ${
                  isActive ? 'bg-white/15 text-stone-200' : 'bg-[#FAF5EE] text-[#716458]'
                }`}
              >
                {stopCount} stops
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
