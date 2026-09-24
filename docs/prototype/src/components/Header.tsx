import React from 'react';
import { MascotAvatar } from './MascotAvatar';
import {
  Plus,
  Bookmark,
  Scale,
  FileDown,
  Sliders,
  MapPin,
  Calendar,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onOpenCompareModal: () => void;
  onOpenSavedDrawer: () => void;
  onOpenOfflineModal?: () => void;
  onOpenCustomizeModal?: () => void;
  onOpenFunctionsDocs?: () => void;
  savedCount: number;
  customizedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenImportModal,
  onOpenCompareModal,
  onOpenSavedDrawer,
  onOpenOfflineModal,
  onOpenCustomizeModal,
  onOpenFunctionsDocs,
  savedCount,
  customizedCount = 0
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#EADBCE] px-3 sm:px-6 py-2.5 transition-all shadow-[0_2px_12px_-4px_rgba(44,38,35,0.06)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Lockup & Companion Mascot */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative group cursor-pointer">
            <MascotAvatar size="md" className="w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-[#EADBCE] group-hover:ring-[#D96B43] transition-all duration-300 transform group-hover:scale-105" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#2A9D8F] rounded-full ring-2 ring-white" title="Béa is active" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#2C2623] leading-none">
                Béa
              </span>
            </div>
            <span className="text-[10px] tracking-wider uppercase text-[#8C7A6B] font-medium mt-0.5 whitespace-nowrap">
              Itinerary Companion
            </span>
          </div>
        </div>

        {/* Center Trip Context */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#5C473A] bg-[#FAF5EE] px-3.5 py-1.5 rounded-full border border-[#EADBCE]">
          <div className="flex items-center gap-1 font-semibold text-[#2C2623]">
            <MapPin className="w-3.5 h-3.5 text-[#D96B43]" />
            <span>Hiroshima & Miyajima</span>
          </div>
          <span className="text-[#C4B2A3]">·</span>
          <div className="flex items-center gap-1 text-[#716458]">
            <Calendar className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <span>3 Days (Oct 14 – 16)</span>
          </div>
        </div>

        {/* Actions & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenOfflineModal && (
            <button
              type="button"
              onClick={onOpenOfflineModal}
              title="Download Offline Directions (PDF & TXT)"
              className="hidden xs:flex px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] items-center gap-1 transition-all shadow-2xs"
            >
              <FileDown className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden sm:inline">Offline</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenImportModal}
            title="Import Itinerary"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] hidden md:flex items-center gap-1 transition-all shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-[#D96B43]" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={onOpenCompareModal}
            title="Compare Plans"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] hidden md:flex items-center gap-1 transition-all shadow-2xs"
          >
            <Scale className="w-3.5 h-3.5 text-[#D96B43]" />
            <span>Compare</span>
          </button>

          <button
            type="button"
            onClick={onOpenSavedDrawer}
            title="Saved Places"
            className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center gap-1 transition-all shadow-2xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#D96B43]" />
            <span className="w-4 h-4 rounded-full bg-[#D96B43] text-white text-[10px] flex items-center justify-center font-bold shadow-xs">
              {savedCount}
            </span>
          </button>

          {onOpenFunctionsDocs && (
            <button
              type="button"
              onClick={onOpenFunctionsDocs}
              title="View Functions & UX/UI Specification (functionsdescription)"
              className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center gap-1.5 transition-all shadow-2xs group"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden lg:inline">UX Specs</span>
            </button>
          )}

          {onOpenCustomizeModal && (
            <button
              type="button"
              onClick={onOpenCustomizeModal}
              title="Personalize UI & Visible Features"
              className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C473A] hover:text-[#D96B43] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center gap-1.5 transition-all shadow-2xs relative group"
            >
              <Sliders className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden sm:inline">Customize</span>
              {customizedCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#D96B43] animate-pulse" title={`${customizedCount} features customized`} />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-[#D96B43] hover:bg-[#C25832] rounded-xl shadow-xs flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stop</span>
          </button>
        </div>
      </div>
    </header>
  );
};
