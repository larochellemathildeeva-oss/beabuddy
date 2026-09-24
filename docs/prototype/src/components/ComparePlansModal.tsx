import React from 'react';
import { PlanOption } from '../types';
import { X, Check, Compass, Sparkles, MapPin, Footprints } from 'lucide-react';
import { MascotAvatar } from './MascotAvatar';

interface ComparePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanOption[];
  activePlanId: string;
  onSelectPlan: (plan: PlanOption) => void;
}

export const ComparePlansModal: React.FC<ComparePlansModalProps> = ({
  isOpen,
  onClose,
  plans,
  activePlanId,
  onSelectPlan
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] border border-[#E8DFD3] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD3] bg-white">
          <div className="flex items-center gap-2.5">
            <MascotAvatar size="sm" />
            <div>
              <h2 className="text-base font-bold text-[#2C2623]">Compare Day Ideas</h2>
              <p className="text-xs text-[#8C7A6B]">Choose the pacing that fits your mood</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[75vh] overflow-y-auto">
          {plans.map((p) => {
            const isCurrent = p.id === activePlanId;
            const day1 = p.days[0];
            const stopCount = day1 ? day1.items.length : 0;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-white border-[#D96B43] shadow-md ring-2 ring-[#D96B43]/20'
                    : 'bg-white/70 border-[#E8DFD3] hover:border-[#B5A597]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                      {p.id.toUpperCase()}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold text-[#D96B43] bg-[#FAF5EE] px-2 py-0.5 rounded-md">
                        Active Plan
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-[#2C2623] mb-1 leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-xs text-[#716458] mb-3 leading-relaxed">
                    {p.tagline}
                  </p>

                  <div className="space-y-1.5 py-2 border-t border-b border-[#F0EBE1] text-[11px] text-[#5C473A]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8C7A6B]">Daily Stops:</span>
                      <span className="font-semibold">{stopCount} stops</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8C7A6B]">Pacing:</span>
                      <span className="font-semibold">{p.pacing.split('·')[0]}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8C7A6B]">Walk:</span>
                      <span className="font-semibold">{p.pacing.split('·')[1] || 'Moderate'}</span>
                    </div>
                  </div>

                  {/* Sample highlights */}
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold uppercase text-[#8C7A6B] block mb-1">
                      Day 1 Flow
                    </span>
                    <ul className="text-[11px] text-[#4A3B32] space-y-1">
                      {day1?.items.slice(0, 3).map((item, i) => (
                        <li key={i} className="truncate flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D96B43] shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlan(p);
                      onClose();
                    }}
                    disabled={isCurrent}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-[#FAF5EE] text-[#8C7A6B] cursor-default'
                        : 'bg-[#2C2623] hover:bg-black text-white'
                    }`}
                  >
                    {isCurrent ? 'Currently Loaded' : 'Switch to this Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
