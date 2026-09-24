import React from 'react';
import { UserUiPreferences, DEFAULT_UI_PREFERENCES } from '../types';
import {
  X,
  Sliders,
  Sparkles,
  Compass,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Layout,
  Palette,
  Layers,
  Footprints,
  PlusCircle,
  Clock,
  Image,
  Lightbulb,
  Building2,
  Play
} from 'lucide-react';
import { MascotAvatar } from './MascotAvatar';

interface CustomizeUiModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserUiPreferences;
  onUpdatePreferences: (newPrefs: UserUiPreferences) => void;
  onResetDefaults?: () => void;
}

type PresetKey = 'full' | 'navigator' | 'zen' | 'editor';

const PRESETS: Record<
  PresetKey,
  {
    name: string;
    description: string;
    icon: string;
    prefs: Partial<UserUiPreferences>;
  }
> = {
  full: {
    name: 'Full Béa Experience',
    description: 'All proactive insights, transit connectors, and rich visual previews enabled.',
    icon: '✨',
    prefs: {
      showBeaInsights: true,
      showTransitLegs: true,
      showInSituBudding: true,
      showNeighborhoodGrouping: true,
      showLeaveByBuffers: true,
      showStopPhotos: true,
      showEstimatedStays: true,
      showMapFlowAnimation: true,
      mascotPresence: 'expressive',
      layoutDensity: 'comfortable'
    }
  },
  navigator: {
    name: 'Focused Navigator',
    description: 'Prioritizes walking routes, leave-by buffers, and high-density map glanceability.',
    icon: '🧭',
    prefs: {
      showBeaInsights: false,
      showTransitLegs: true,
      showInSituBudding: false,
      showNeighborhoodGrouping: true,
      showLeaveByBuffers: true,
      showStopPhotos: false,
      showEstimatedStays: true,
      showMapFlowAnimation: true,
      mascotPresence: 'calm',
      layoutDensity: 'compact'
    }
  },
  zen: {
    name: 'Minimalist Zen',
    description: 'Distraction-free, monochrome clarity with minimal mascot and clean text.',
    icon: '🍃',
    prefs: {
      showBeaInsights: false,
      showTransitLegs: false,
      showInSituBudding: false,
      showNeighborhoodGrouping: false,
      showLeaveByBuffers: false,
      showStopPhotos: false,
      showEstimatedStays: false,
      showMapFlowAnimation: false,
      mascotPresence: 'minimal',
      layoutDensity: 'compact'
    }
  },
  editor: {
    name: 'Trip Planner & Editor',
    description: 'Designed for adding stops, reorganizing items, and tweaking stay durations.',
    icon: '✍️',
    prefs: {
      showBeaInsights: true,
      showTransitLegs: true,
      showInSituBudding: true,
      showNeighborhoodGrouping: true,
      showLeaveByBuffers: false,
      showStopPhotos: true,
      showEstimatedStays: true,
      showMapFlowAnimation: false,
      mascotPresence: 'calm',
      layoutDensity: 'comfortable'
    }
  }
};

export const CustomizeUiModal: React.FC<CustomizeUiModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  onResetDefaults
}) => {
  if (!isOpen) return null;

  const handleToggle = (key: keyof UserUiPreferences) => {
    onUpdatePreferences({
      ...preferences,
      [key]: !preferences[key]
    });
  };

  const handleSelectPreset = (presetKey: PresetKey) => {
    onUpdatePreferences({
      ...preferences,
      ...PRESETS[presetKey].prefs
    });
  };

  const handleReset = () => {
    if (onResetDefaults) {
      onResetDefaults();
    } else {
      onUpdatePreferences(DEFAULT_UI_PREFERENCES);
    }
  };

  // Count how many features differ from defaults
  const modifiedCount = Object.keys(DEFAULT_UI_PREFERENCES).filter(
    (k) => preferences[k as keyof UserUiPreferences] !== DEFAULT_UI_PREFERENCES[k as keyof UserUiPreferences]
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2623]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#FFFDF9] rounded-3xl border border-[#EADBCE] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EADBCE] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FAF5EE] border border-[#EADBCE] flex items-center justify-center text-[#D96B43] shadow-2xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base sm:text-lg text-[#2C2623] leading-none">
                  Personalize Experience
                </h3>
                {modifiedCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF5EE] text-[#D96B43] border border-[#EADBCE]">
                    {modifiedCount} customized
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8C7A6B] mt-0.5">
                Toggle visible features, layout density, and Béa's companion level
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {modifiedCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset to default settings"
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#F2EDE4] border border-[#EADBCE] transition-all flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#FAF5EE] hover:bg-[#F2EDE4] text-[#716458] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#716458] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B43]" />
                <span>Quick Persona Presets</span>
              </span>
              <span className="text-[11px] text-[#8C7A6B]">One-tap configuration</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                const preset = PRESETS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className="p-3 rounded-2xl border border-[#EADBCE] bg-[#FAF8F5] hover:bg-[#FAF5EE] hover:border-[#D96B43] text-left transition-all group flex flex-col justify-between shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  >
                    <div>
                      <span className="text-xl block mb-1">{preset.icon}</span>
                      <span className="text-xs font-bold text-[#2C2623] group-hover:text-[#D96B43] transition-colors block">
                        {preset.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8C7A6B] mt-1 leading-tight line-clamp-2">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Feature Visibility Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-2">
              <span className="text-xs font-bold text-[#716458] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#D96B43]" />
                <span>Itinerary Features & Controls</span>
              </span>
              <span className="text-[11px] text-[#8C7A6B]">Show or hide elements</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Béa Insights Banner */}
              <div
                onClick={() => handleToggle('showBeaInsights')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showBeaInsights
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showBeaInsights ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">Béa Daily Insights</span>
                    <input
                      type="checkbox"
                      checked={preferences.showBeaInsights}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Proactive morning advice, crowd forecasts, and local cultural context at the top of each day.
                  </p>
                </div>
              </div>

              {/* Transit Connectors */}
              <div
                onClick={() => handleToggle('showTransitLegs')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showTransitLegs
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showTransitLegs ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Footprints className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">Transit & Walking Legs</span>
                    <input
                      type="checkbox"
                      checked={preferences.showTransitLegs}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Walking minutes, ferry connections, distance markers, and directional links between stops.
                  </p>
                </div>
              </div>

              {/* In-Situ Budding Nodes */}
              <div
                onClick={() => handleToggle('showInSituBudding')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showInSituBudding
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showInSituBudding ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">"Add Stop Between" Nodes</span>
                    <input
                      type="checkbox"
                      checked={preferences.showInSituBudding}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Tactile budding buttons along connectors to insert cafes or stops directly inside the route.
                  </p>
                </div>
              </div>

              {/* Neighborhood District Grouping */}
              <div
                onClick={() => handleToggle('showNeighborhoodGrouping')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showNeighborhoodGrouping
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showNeighborhoodGrouping ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">District Grouping Headers</span>
                    <input
                      type="checkbox"
                      checked={preferences.showNeighborhoodGrouping}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Cluster stops by area (e.g. Peace Park District, Miyajima Island) to preserve geographic flow.
                  </p>
                </div>
              </div>

              {/* Leave By Humane Buffers */}
              <div
                onClick={() => handleToggle('showLeaveByBuffers')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showLeaveByBuffers
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showLeaveByBuffers ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">"Leave By" Buffer Windows</span>
                    <input
                      type="checkbox"
                      checked={preferences.showLeaveByBuffers}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Calculate stress-free departure reminders with built-in 10-15 minute breathing room.
                  </p>
                </div>
              </div>

              {/* Stop Destination Photos */}
              <div
                onClick={() => handleToggle('showStopPhotos')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showStopPhotos
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showStopPhotos ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Image className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">Destination Photo Thumbnails</span>
                    <input
                      type="checkbox"
                      checked={preferences.showStopPhotos}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Display scenic photography cards for temples, parks, shrines, and okonomiyaki dining.
                  </p>
                </div>
              </div>

              {/* Estimated Stay Durations */}
              <div
                onClick={() => handleToggle('showEstimatedStays')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showEstimatedStays
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showEstimatedStays ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">Estimated Stay Chips</span>
                    <input
                      type="checkbox"
                      checked={preferences.showEstimatedStays}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Show "~45m stay" badges so you know how long to spend at each landmark.
                  </p>
                </div>
              </div>

              {/* Map Route Flow Animation */}
              <div
                onClick={() => handleToggle('showMapFlowAnimation')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  preferences.showMapFlowAnimation
                    ? 'bg-[#FFFDF9] border-[#D96B43]/40 shadow-xs ring-1 ring-[#D96B43]/10'
                    : 'bg-[#FAF8F5]/80 border-[#EADBCE] opacity-75'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    preferences.showMapFlowAnimation ? 'bg-[#D96B43] text-white' : 'bg-[#FAF5EE] text-[#8C7A6B]'
                  }`}
                >
                  <Play className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2C2623]">Map Flow & Replay Controls</span>
                    <input
                      type="checkbox"
                      checked={preferences.showMapFlowAnimation}
                      onChange={() => {}}
                      className="accent-[#D96B43] w-4 h-4 rounded"
                    />
                  </div>
                  <p className="text-[11px] text-[#716458] mt-0.5 leading-snug">
                    Enable the "Replay Flow" animated transit trail and travel flow buttons on maps.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Companion & Layout Ergonomics */}
          <div className="space-y-4 pt-2 border-t border-[#F0EBE1]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#716458] uppercase tracking-wider flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-[#D96B43]" />
                <span>Companion & Layout Feel</span>
              </span>
            </div>

            {/* Mascot Presence */}
            <div>
              <label className="text-xs font-bold text-[#2C2623] block mb-1.5">
                Béa Mascot Companion Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    key: 'expressive',
                    name: 'Expressive',
                    desc: 'Full reactions, animated states, proactive prompts',
                    avatarState: 'found' as const
                  },
                  {
                    key: 'calm',
                    name: 'Calm',
                    desc: 'Quiet presence, gentle status indicator',
                    avatarState: 'idle' as const
                  },
                  {
                    key: 'minimal',
                    name: 'Zen Minimal',
                    desc: 'Discreet icon only, zero unsolicited popups',
                    avatarState: 'idle' as const
                  }
                ].map((item) => {
                  const isSelected = preferences.mascotPresence === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          mascotPresence: item.key as UserUiPreferences['mascotPresence']
                        })
                      }
                      className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#FFFDF9] border-[#D96B43] ring-1 ring-[#D96B43]/20 shadow-xs'
                          : 'bg-[#FAF8F5] border-[#EADBCE] hover:bg-[#FAF5EE]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <MascotAvatar
                          size="sm"
                          state={item.avatarState}
                          className={`w-6 h-6 ${isSelected ? 'ring-2 ring-[#D96B43]' : ''}`}
                        />
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#D96B43]" />}
                      </div>
                      <span className="text-xs font-bold text-[#2C2623]">{item.name}</span>
                      <span className="text-[10px] text-[#8C7A6B] leading-tight mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout Density */}
            <div>
              <label className="text-xs font-bold text-[#2C2623] block mb-1.5">
                List Density & Spacing
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: 'comfortable',
                    title: 'Comfortable',
                    desc: 'Spacious touch targets, relaxed reading for leisurely day strolls'
                  },
                  {
                    key: 'compact',
                    title: 'Tactical Compact',
                    desc: 'Tighter lines and condensed cards for fast on-the-go glances'
                  }
                ].map((d) => {
                  const isSelected = preferences.layoutDensity === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          layoutDensity: d.key as UserUiPreferences['layoutDensity']
                        })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-[#FFFDF9] border-[#D96B43] ring-1 ring-[#D96B43]/20 shadow-xs'
                          : 'bg-[#FAF8F5] border-[#EADBCE] hover:bg-[#FAF5EE]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#2C2623]">{d.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#D96B43]" />}
                      </div>
                      <p className="text-[11px] text-[#716458] mt-1 leading-snug">{d.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Theme */}
            <div>
              <label className="text-xs font-bold text-[#2C2623] block mb-1.5">
                Accent Theme Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'terracotta', name: 'Terracotta', hex: '#D96B43', label: 'Hiroshima Warmth' },
                  { key: 'sage', name: 'Sage Garden', hex: '#2A9D8F', label: 'Peace Park' },
                  { key: 'indigo', name: 'Seto Azure', hex: '#2563EB', label: 'Inland Sea' },
                  { key: 'warmCharcoal', name: 'Charcoal', hex: '#2C2623', label: 'Monochrome' }
                ].map((th) => {
                  const isSelected = preferences.accentTheme === th.key;
                  return (
                    <button
                      key={th.key}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          accentTheme: th.key as UserUiPreferences['accentTheme']
                        })
                      }
                      className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#FFFDF9] border-[#2C2623] ring-1 ring-[#2C2623]/20 shadow-xs'
                          : 'bg-[#FAF8F5] border-[#EADBCE] hover:bg-[#FAF5EE]'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full shadow-2xs border border-white flex items-center justify-center"
                        style={{ backgroundColor: th.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-[11px] font-bold text-[#2C2623] leading-none">
                        {th.name}
                      </span>
                      <span className="text-[9px] text-[#8C7A6B] leading-none">{th.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EADBCE] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#8C7A6B]">
            <Check className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Preferences saved automatically to this device</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-[#D96B43] hover:bg-[#C25832] rounded-xl shadow-xs transition-all active:scale-95"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
