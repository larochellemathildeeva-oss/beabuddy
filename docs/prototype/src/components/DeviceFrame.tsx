import React from 'react';
import { ViewportDevice } from '../types';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

interface DeviceFrameProps {
  device: ViewportDevice;
  children: React.ReactNode;
  onChangeDevice?: (device: ViewportDevice) => void;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device,
  children,
  onChangeDevice
}) => {
  if (device === 'desktop') {
    return <div className="w-full h-full flex-1 flex flex-col min-h-0">{children}</div>;
  }

  if (device === 'tablet') {
    return (
      <div className="w-full h-full flex-1 flex justify-center items-stretch sm:items-start p-0 sm:py-6 sm:px-4 bg-[#FAF8F5] sm:bg-[#F2EDE4] overflow-hidden sm:overflow-y-auto min-h-0">
        <div className="w-full sm:max-w-[820px] bg-[#FAF8F5] sm:rounded-[36px] border-0 sm:border-[10px] border-[#2C2623] shadow-none sm:shadow-2xl overflow-hidden flex flex-col flex-1 sm:flex-initial h-full sm:h-[860px] relative min-h-0">
          {/* Tablet Status Bar - only on simulated desktop preview */}
          <div className="hidden sm:flex h-7 bg-[#2C2623] text-stone-300 text-[11px] font-semibold items-center justify-between px-6 select-none shrink-0">
            <span>9:41 AM</span>
            <div className="w-2.5 h-2.5 rounded-full bg-stone-700" />
            <div className="flex items-center gap-2">
              <span>100%</span>
              <div className="w-4 h-2.5 border border-stone-400 rounded-xs relative">
                <div className="w-2.5 h-1.5 bg-stone-300 mx-auto mt-0.5" />
              </div>
            </div>
          </div>
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 h-full">{children}</div>
          {/* Home indicator */}
          <div className="hidden sm:flex h-4 bg-[#FAF8F5] justify-center items-center shrink-0">
            <div className="w-32 h-1 bg-stone-400 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // Mobile iPhone 16 Frame
  return (
    <div className="w-full h-full flex-1 flex justify-center items-stretch sm:items-start p-0 sm:py-4 sm:px-4 bg-[#FAF8F5] sm:bg-[#F2EDE4] overflow-hidden sm:overflow-y-auto min-h-0">
      <div className="w-full sm:max-w-[420px] bg-[#FAF8F5] sm:rounded-[44px] border-0 sm:border-[10px] border-[#2C2623] shadow-none sm:shadow-2xl overflow-hidden flex flex-col flex-1 sm:flex-initial h-full sm:h-[840px] relative min-h-0">
        {/* Dynamic Island / Status Bar - only on desktop preview */}
        <div className="hidden sm:flex h-10 bg-[#2C2623] text-stone-200 text-[12px] font-semibold items-center justify-between px-7 select-none shrink-0 relative">
          <span>9:41</span>
          {/* Dynamic Island Pill */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-5 bg-black rounded-full flex items-center justify-end px-2">
            <div className="w-2 h-2 rounded-full bg-[#1A1A1A] border border-stone-800" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-2.5 flex items-end gap-0.5">
              <span className="w-0.5 h-1 bg-stone-300 rounded-xs" />
              <span className="w-0.5 h-1.5 bg-stone-300 rounded-xs" />
              <span className="w-0.5 h-2.5 bg-stone-300 rounded-xs" />
            </div>
            <div className="w-5 h-2.5 border border-stone-400 rounded-xs relative">
              <div className="w-3.5 h-1.5 bg-stone-300 mx-auto mt-0.5 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 h-full">{children}</div>

        {/* Home indicator bar - only on desktop preview */}
        <div className="hidden sm:flex h-5 bg-[#FAF8F5] justify-center items-center shrink-0">
          <div className="w-28 h-1 bg-stone-400 rounded-full" />
        </div>
      </div>
    </div>
  );
};
