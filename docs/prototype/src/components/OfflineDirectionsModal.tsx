import React, { useState } from 'react';
import { DayItinerary } from '../types';
import { deriveTransitLeg, calculateRouteStats } from '../utils/geoUtils';
import { downloadOfflineDirectionsText, openOfflineDirectionsPrintWindow } from '../utils/offlineDirections';
import {
  Download,
  Printer,
  FileText,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  X,
  Compass,
  Navigation,
  Smartphone,
  ShieldCheck
} from 'lucide-react';

interface OfflineDirectionsModalProps {
  day: DayItinerary;
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineDirectionsModal: React.FC<OfflineDirectionsModalProps> = ({
  day,
  isOpen,
  onClose
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const items = day.items;
  const stats = calculateRouteStats(items);

  const handleDownloadTxt = () => {
    downloadOfflineDirectionsText(day);
    setDownloadSuccess('text');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handlePrintOrPdf = () => {
    openOfflineDirectionsPrintWindow(day);
    setDownloadSuccess('pdf');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] rounded-3xl max-w-xl w-full border border-[#EADBCE] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#EADBCE] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF5EE] border border-[#FCD9C6] flex items-center justify-center text-[#D96B43]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#2C2623]">
                  Download Offline Directions
                </h3>
                <span className="text-[10px] font-bold bg-[#EAF6F4] text-[#2A9D8F] px-2 py-0.5 rounded-full border border-[#D0EBE7]">
                  Offline Ready
                </span>
              </div>
              <p className="text-xs text-[#8C7A6B]">
                Day {day.dayNumber}: {day.title} ({items.length} stops)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#FAF5EE] text-[#716458] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
          {/* Quick Notice banner */}
          <div className="p-3.5 bg-[#FAF5EE] rounded-2xl border border-[#EADBCE] flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#2A9D8F] shrink-0 mt-0.5" />
            <div className="text-xs text-[#5C473A] leading-relaxed">
              <span className="font-bold text-[#2C2623]">No Wi-Fi or data connection required.</span>{' '}
              Downloaded directions contain every stop address, GPS coordinates, arrival times, leave-by warnings, and transit step notes.
            </div>
          </div>

          {/* Quick stats grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-white rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] text-[#8C7A6B] block">Total Stops</span>
              <span className="text-xs font-bold text-[#2C2623]">{items.length} locations</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] text-[#8C7A6B] block">Transit Distance</span>
              <span className="text-xs font-bold text-[#2C2623]">~{stats.totalDistanceKm} km</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] text-[#8C7A6B] block">Estimated Travel</span>
              <span className="text-xs font-bold text-[#2C2623]">~{stats.totalDurationMinutes} mins</span>
            </div>
          </div>

          {/* Download Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Action 1: Print / PDF */}
            <button
              type="button"
              onClick={handlePrintOrPdf}
              className="p-3.5 bg-white hover:bg-[#FAF8F5] active:scale-[0.98] border-2 border-[#D96B43] rounded-2xl text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-[#FFF5EE] flex items-center justify-center text-[#D96B43]">
                  <Printer className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#D96B43] uppercase tracking-wide">
                  Recommended
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2C2623] group-hover:text-[#D96B43]">
                  Save as PDF / Print
                </h4>
                <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                  Formatted document with itinerary maps, directions, and emergency contacts.
                </p>
              </div>
            </button>

            {/* Action 2: Plain Text File */}
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="p-3.5 bg-white hover:bg-[#FAF8F5] active:scale-[0.98] border border-[#EADBCE] hover:border-[#D96B43] rounded-2xl text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-[#FAF5EE] flex items-center justify-center text-[#716458]">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-[#8C7A6B]">
                  Lightweight .TXT
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2C2623] group-hover:text-[#D96B43]">
                  Download Text Guide
                </h4>
                <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                  Universal text file readable in any notes app or e-reader without formatting bugs.
                </p>
              </div>
            </button>
          </div>

          {/* Feedback message */}
          {downloadSuccess && (
            <div className="p-3 bg-[#EAF6F4] text-[#2A9D8F] rounded-xl border border-[#D0EBE7] text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {downloadSuccess === 'text'
                  ? 'Directions file downloaded! Save it to your phone’s Files or Notes app.'
                  : 'Print preview window opened! Use "Save as PDF" for offline access.'}
              </span>
            </div>
          )}

          {/* Directions Preview List */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#2C2623]">
                Directions Preview ({items.length} steps)
              </span>
              <span className="text-[10px] text-[#8C7A6B]">
                Includes step-by-step connections
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {items.map((item, idx) => {
                const nextItem = items[idx + 1];
                const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

                return (
                  <div key={item.id} className="p-2.5 bg-white rounded-xl border border-[#EADBCE] text-xs">
                    <div className="flex items-center justify-between font-semibold text-[#2C2623]">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#2C2623] text-white text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <span className="font-mono text-[#D96B43] text-[11px]">{item.time}</span>
                    </div>

                    <p className="text-[11px] text-[#716458] ml-7 mt-0.5 truncate">
                      📍 {item.address}
                    </p>

                    {/* Next step connector with turn-by-turn steps */}
                    {leg && nextItem && (
                      <div className="mt-2 pt-2 border-t border-[#F5EFE6] ml-7 space-y-1.5 text-[11px] text-[#716458]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#D96B43] font-bold">
                            <Navigation className="w-3 h-3" />
                            <span>{leg.instructions}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-[#5C473A]">
                            ~{leg.durationMinutes}m ({leg.distanceKm} km)
                          </span>
                        </div>

                        {leg.steps && leg.steps.length > 0 && (
                          <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#EADBCE] space-y-1 mt-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                              Turn-by-Turn Steps ({leg.steps.length}):
                            </span>
                            {leg.steps.slice(0, 3).map((step) => (
                              <div key={step.id} className="text-[10px] text-[#4A3B32] flex items-start gap-1">
                                <span className="font-bold text-[#D96B43]">{step.stepNumber}.</span>
                                <span className="break-words">{step.instruction}</span>
                                {step.distanceMeters && (
                                  <span className="text-[#8C7A6B] shrink-0 font-medium">({step.distanceMeters}m)</span>
                                )}
                              </div>
                            ))}
                            {leg.steps.length > 3 && (
                              <span className="text-[9px] text-[#8C7A6B] italic block">
                                + {leg.steps.length - 3} more steps in full offline document
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-[#EADBCE] flex items-center justify-between">
          <span className="text-[11px] text-[#8C7A6B] flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Accessible anytime in airplane mode</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#FAF5EE] hover:bg-[#F2EDE4] text-[#2C2623] font-semibold text-xs rounded-xl border border-[#EADBCE] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
