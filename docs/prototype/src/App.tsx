import React, { useState } from 'react';
import {
  DayItinerary,
  ItineraryItem,
  PlanOption,
  SavedPlace,
  UserUiPreferences,
  DEFAULT_UI_PREFERENCES
} from './types';
import { INITIAL_DAYS, PLAN_OPTIONS, SAVED_PLACES } from './data/mockTrips';
import { recalculateItemTimes } from './utils/geoUtils';
import { Header } from './components/Header';
import { DaySelector } from './components/DaySelector';
import { ConceptUnified } from './components/concepts/ConceptUnified';
import { AddItemModal } from './components/AddItemModal';
import { ImportItineraryModal } from './components/ImportItineraryModal';
import { ComparePlansModal } from './components/ComparePlansModal';
import { SavedPlacesDrawer } from './components/SavedPlacesDrawer';
import { OfflineDirectionsModal } from './components/OfflineDirectionsModal';
import { CustomizeUiModal } from './components/CustomizeUiModal';
import { FunctionsDescriptionModal } from './components/FunctionsDescriptionModal';
import { MascotAvatar } from './components/MascotAvatar';
import { RotateCcw, X, Check, Archive, Trash2 } from 'lucide-react';

export default function App() {
  const [days, setDays] = useState<DayItinerary[]>(INITIAL_DAYS);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Modals & Trays
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalDefaultTime, setAddModalDefaultTime] = useState<string>('12:00');
  const [addModalInsertIndex, setAddModalInsertIndex] = useState<number | undefined>(undefined);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isFunctionsModalOpen, setIsFunctionsModalOpen] = useState(false);

  // User UI Personalization State (persisted to localStorage)
  const [preferences, setPreferences] = useState<UserUiPreferences>(() => {
    try {
      const saved = localStorage.getItem('bea_ui_preferences');
      if (saved) {
        return { ...DEFAULT_UI_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to defaults
    }
    return DEFAULT_UI_PREFERENCES;
  });

  const handleUpdatePreferences = (newPrefs: UserUiPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem('bea_ui_preferences', JSON.stringify(newPrefs));
    } catch {
      // ignore storage quota errors
    }
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_UI_PREFERENCES);
    try {
      localStorage.removeItem('bea_ui_preferences');
    } catch {
      // ignore
    }
  };

  const customizedCount = Object.keys(DEFAULT_UI_PREFERENCES).reduce((count, key) => {
    const k = key as keyof UserUiPreferences;
    return preferences[k] !== DEFAULT_UI_PREFERENCES[k] ? count + 1 : count;
  }, 0);

  // Plans & Saved Places
  const [plans, setPlans] = useState<PlanOption[]>(PLAN_OPTIONS);
  const [activePlanId, setActivePlanId] = useState<string>('plan-a');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(SAVED_PLACES);

  // Swipe Action Toast notification (Completed, Archived, Deleted) with 1-click Undo
  const [actionToast, setActionToast] = useState<{
    id: string;
    type: 'complete' | 'archive' | 'delete';
    title: string;
    message: string;
    onUndo?: () => void;
  } | null>(null);

  const currentDay = days[activeDayIndex] || days[0];

  // Reorder items in current day
  const handleReorder = (newItems: ItineraryItem[]) => {
    const updatedDays = [...days];
    const recalculated = recalculateItemTimes(newItems, newItems[0]?.time || '08:45');
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculated
    };
    setDays(updatedDays);
  };

  // Update a single item
  const handleUpdateItem = (updatedItem: ItineraryItem) => {
    const updatedItems = currentDay.items.map((it) =>
      it.id === updatedItem.id ? updatedItem : it
    );
    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: updatedItems
    };
    setDays(updatedDays);
  };

  // Toggle complete state of an activity (triggered via swipe right or complete button)
  const handleToggleComplete = (itemId: string) => {
    const item = currentDay.items.find((it) => it.id === itemId);
    if (!item) return;
    const willBeCompleted = !item.isCompleted;

    const updatedItems = currentDay.items.map((it) =>
      it.id === itemId ? { ...it, isCompleted: willBeCompleted } : it
    );
    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: updatedItems
    };
    setDays(updatedDays);

    setActionToast({
      id: `complete-${Date.now()}`,
      type: 'complete',
      title: willBeCompleted ? 'Marked Completed! 🎉' : 'Marked Incomplete',
      message: `"${item.title}" ${willBeCompleted ? 'completed' : 're-opened'}`,
      onUndo: () => {
        const revertedItems = currentDay.items.map((it) =>
          it.id === itemId ? { ...it, isCompleted: !willBeCompleted } : it
        );
        const revertedDays = [...days];
        revertedDays[activeDayIndex] = {
          ...currentDay,
          items: revertedItems
        };
        setDays(revertedDays);
        setActionToast(null);
      }
    });

    setTimeout(() => {
      setActionToast((curr) => (curr?.id.startsWith('complete-') ? null : curr));
    }, 4500);
  };

  // Archive activity to Saved Gems and remove from day schedule (triggered via swipe left or archive button)
  const handleArchiveItem = (itemId: string) => {
    const itemToArchive = currentDay.items.find((it) => it.id === itemId);
    if (!itemToArchive) return;
    const prevItems = [...currentDay.items];
    const remaining = currentDay.items.filter((it) => it.id !== itemId);
    const recalculated = recalculateItemTimes(remaining, remaining[0]?.time || '08:45');

    // Add to saved places collection
    const archivedGem: SavedPlace = {
      id: `archived-${Date.now()}-${itemToArchive.id}`,
      title: itemToArchive.title,
      category: itemToArchive.category,
      address: itemToArchive.address,
      neighborhood: itemToArchive.neighborhood || 'Hiroshima',
      notes: itemToArchive.notes || itemToArchive.subtitle,
      coordinates: itemToArchive.coordinates,
      recommendedTimeMinutes: itemToArchive.estimatedStayMinutes || 45
    };
    setSavedPlaces((prev) => [archivedGem, ...prev]);

    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculated
    };
    setDays(updatedDays);

    setActionToast({
      id: `archive-${Date.now()}`,
      type: 'archive',
      title: 'Archived to Saved Places',
      message: `"${itemToArchive.title}" saved to gems`,
      onUndo: () => {
        const revertedDays = [...days];
        revertedDays[activeDayIndex] = {
          ...currentDay,
          items: prevItems
        };
        setDays(revertedDays);
        setSavedPlaces((prev) => prev.filter((p) => p.id !== archivedGem.id));
        setActionToast(null);
      }
    });

    setTimeout(() => {
      setActionToast((curr) => (curr?.id.startsWith('archive-') ? null : curr));
    }, 5000);
  };

  // Delete a stop with 1-click Undo
  const handleDeleteItem = (itemId: string) => {
    const itemToDelete = currentDay.items.find((it) => it.id === itemId);
    if (!itemToDelete) return;
    const prevItems = [...currentDay.items];
    const remaining = currentDay.items.filter((it) => it.id !== itemId);
    const recalculated = recalculateItemTimes(remaining, remaining[0]?.time || '08:45');

    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculated
    };
    setDays(updatedDays);

    setActionToast({
      id: `delete-${Date.now()}`,
      type: 'delete',
      title: 'Activity Deleted',
      message: `"${itemToDelete.title}" removed from Day ${currentDay.dayNumber}`,
      onUndo: () => {
        const revertedDays = [...days];
        revertedDays[activeDayIndex] = {
          ...currentDay,
          items: prevItems
        };
        setDays(revertedDays);
        setActionToast(null);
      }
    });

    setTimeout(() => {
      setActionToast((curr) => (curr?.id.startsWith('delete-') ? null : curr));
    }, 5000);
  };

  // Move a stop between days
  const handleMoveItemToDay = (itemId: string, targetDayNumber: number) => {
    const itemToMove = currentDay.items.find((it) => it.id === itemId);
    if (!itemToMove) return;

    const sourceRemaining = currentDay.items.filter((it) => it.id !== itemId);
    const targetDayIndex = days.findIndex((d) => d.dayNumber === targetDayNumber);
    if (targetDayIndex === -1) return;

    const targetDay = days[targetDayIndex];
    const targetItems = [...targetDay.items, { ...itemToMove, order: targetDay.items.length + 1 }];

    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculateItemTimes(sourceRemaining, '08:45')
    };
    updatedDays[targetDayIndex] = {
      ...targetDay,
      items: recalculateItemTimes(targetItems, targetItems[0]?.time || '09:00')
    };

    setDays(updatedDays);
  };

  // Add stop to active day
  const handleAddItem = (newItem: ItineraryItem, insertIndex?: number) => {
    const currentItems = [...currentDay.items];
    const index = insertIndex !== undefined ? insertIndex : currentItems.length;
    currentItems.splice(index, 0, newItem);

    const reordered = currentItems.map((item, idx) => ({ ...item, order: idx + 1 }));
    const recalculated = recalculateItemTimes(reordered, reordered[0]?.time || '08:45');

    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculated
    };
    setDays(updatedDays);
    setActiveItemId(newItem.id);
  };

  // Open add modal with optional gap position
  const handleOpenAddModalWithContext = (defaultTime?: string, insertIndex?: number) => {
    setAddModalDefaultTime(defaultTime || '12:00');
    setAddModalInsertIndex(insertIndex);
    setIsAddModalOpen(true);
  };

  // In-Situ Budding Stop Insertion State & Trigger
  const [activeBuddingIndex, setActiveBuddingIndex] = useState<number | null>(null);

  const handleTriggerBudding = (insertIndex?: number) => {
    if (insertIndex !== undefined) {
      setActiveBuddingIndex(insertIndex);
      return;
    }
    const activeIdx = activeItemId ? currentDay.items.findIndex((it) => it.id === activeItemId) : -1;
    const target = activeIdx >= 0 ? activeIdx + 1 : 1;
    setActiveBuddingIndex(target);
  };

  const handleDirectInsertStop = (itemData: Omit<ItineraryItem, 'id' | 'order'>, insertIndex: number) => {
    const newItem: ItineraryItem = {
      ...itemData,
      id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      order: insertIndex + 1
    };
    handleAddItem(newItem, insertIndex);
    setActiveBuddingIndex(null);
  };

  // Import days from modal
  const handleImportDays = (importedDays: DayItinerary[]) => {
    setDays(importedDays);
    setActiveDayIndex(0);
    setActiveItemId(null);
  };

  // Switch plan option
  const handleSelectPlan = (plan: PlanOption) => {
    setActivePlanId(plan.id);
    setDays(plan.days);
    setActiveDayIndex(0);
    setActiveItemId(null);
  };

  // Add saved place into active day
  const handleAddSavedPlaceToDay = (savedPlace: SavedPlace) => {
    const newItem: ItineraryItem = {
      id: `from-saved-${Date.now()}`,
      order: currentDay.items.length + 1,
      time: '14:30',
      title: savedPlace.title,
      subtitle: `${savedPlace.neighborhood} · Added from saved gems`,
      address: savedPlace.address,
      neighborhood: savedPlace.neighborhood,
      category: savedPlace.category,
      coordinates: savedPlace.coordinates,
      notes: savedPlace.notes,
      estimatedStayMinutes: savedPlace.recommendedTimeMinutes
    };

    handleAddItem(newItem);
    setIsSavedDrawerOpen(false);
  };

  // Route Optimization Feedback State (Incorporates Motion Specs animated delight directly into app)
  const [optimizationToast, setOptimizationToast] = useState<{
    savedMinutes: number;
    prevItems: ItineraryItem[];
  } | null>(null);

  const handleOptimizeCurrentDay = () => {
    const items = currentDay.items;
    const prevItems = [...items];
    const optimized = [...items].sort((a, b) => a.coordinates.lng - b.coordinates.lng);
    const reordered = optimized.map((it, idx) => ({ ...it, order: idx + 1 }));
    const recalculated = recalculateItemTimes(reordered, '08:45');
    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: recalculated,
      beaDailyInsight: '✨ Route geographically optimized: eliminated city backtracking to save ~42 minutes of walking.'
    };
    setDays(updatedDays);
    setOptimizationToast({ savedMinutes: 42, prevItems });

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      setOptimizationToast((curr) => (curr?.prevItems === prevItems ? null : curr));
    }, 6000);
  };

  const handleUndoOptimize = () => {
    if (!optimizationToast) return;
    const updatedDays = [...days];
    updatedDays[activeDayIndex] = {
      ...currentDay,
      items: optimizationToast.prevItems,
      beaDailyInsight: INITIAL_DAYS[activeDayIndex]?.beaDailyInsight || currentDay.beaDailyInsight
    };
    setDays(updatedDays);
    setOptimizationToast(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#FAF8F5] text-[#2C2623] flex flex-col font-sans">
      {/* Universal Top Bar */}
      <Header
        onOpenAddModal={() => handleTriggerBudding()}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenCompareModal={() => setIsCompareModalOpen(true)}
        onOpenSavedDrawer={() => setIsSavedDrawerOpen(true)}
        onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
        onOpenCustomizeModal={() => setIsCustomizeModalOpen(true)}
        onOpenFunctionsDocs={() => setIsFunctionsModalOpen(true)}
        customizedCount={customizedCount}
        savedCount={savedPlaces.length}
      />

      {/* Main Itinerary Content Area */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
        {/* Route Optimization Animated Feedback Banner (Tactile Motion feature) */}
        {optimizationToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="bg-[#2C2623] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-[#FAF5EE]/20 flex items-center gap-3 text-xs">
              <MascotAvatar size="sm" className="w-6 h-6" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#E28C67]">Route Optimized!</span>
                <span className="text-white/90">Saved ~{optimizationToast.savedMinutes}m of city walking</span>
              </div>
              <button
                type="button"
                onClick={handleUndoOptimize}
                className="ml-2 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold text-white flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => setOptimizationToast(null)}
                className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
                aria-label="Dismiss toast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Swipe Action Instant Feedback Toast (Completed, Archived, Deleted with Undo) */}
        {actionToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="bg-[#2C2623] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-[#FAF5EE]/20 flex items-center gap-3 text-xs max-w-[90vw] sm:max-w-md">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                actionToast.type === 'complete'
                  ? 'bg-[#2A9D8F] text-white'
                  : actionToast.type === 'archive'
                  ? 'bg-[#D96B43] text-white'
                  : 'bg-[#E76F51] text-white'
              }`}>
                {actionToast.type === 'complete' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                {actionToast.type === 'archive' && <Archive className="w-3.5 h-3.5" />}
                {actionToast.type === 'delete' && <Trash2 className="w-3.5 h-3.5" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#E28C67] truncate">{actionToast.title}</div>
                <div className="text-white/80 text-[11px] truncate">{actionToast.message}</div>
              </div>

              {actionToast.onUndo && (
                <button
                  type="button"
                  onClick={actionToast.onUndo}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold text-white flex items-center gap-1 transition-all shrink-0 active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActionToast(null)}
                className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white shrink-0"
                aria-label="Dismiss action toast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Day Navigation Strip */}
        <div className="bg-[#FFFDF9]/90 backdrop-blur-md border-b border-[#EADBCE] px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 shadow-2xs shrink-0">
          <DaySelector
            days={days}
            activeDayIndex={activeDayIndex}
            onSelectDay={setActiveDayIndex}
          />

          {/* In-Itinerary Optimize Button & Day Indicator */}
          <div className="flex items-center gap-2.5 text-xs text-[#8C7A6B] shrink-0">
            <button
              type="button"
              onClick={handleOptimizeCurrentDay}
              title="Geographically optimize route order to minimize backtracking"
              className="px-2.5 py-1 rounded-xl text-xs font-semibold text-[#D96B43] bg-[#FAF5EE] hover:bg-[#F2EDE4] border border-[#EADBCE] flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <span>🪄 Optimize Route</span>
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <span>·</span>
              <span className="font-semibold text-[#2C2623]">{currentDay.title}</span>
              <span className="text-[#8C7A6B] font-medium">({currentDay.items.length} stops)</span>
            </div>
          </div>
        </div>

        {/* Real Production Application Workspace (Full-width, responsive) */}
        <div className="flex-1 w-full min-h-0 h-full overflow-hidden bg-[#FAF8F5]">
          <ConceptUnified
            day={currentDay}
            allDays={days}
            onReorder={handleReorder}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onToggleComplete={handleToggleComplete}
            onArchiveItem={handleArchiveItem}
            onMoveItemToDay={handleMoveItemToDay}
            onOpenAddModal={handleOpenAddModalWithContext}
            activeItemId={activeItemId}
            onSelectItem={setActiveItemId}
            preferences={preferences}
            onOpenCustomizeModal={() => setIsCustomizeModalOpen(true)}
            activeBuddingIndex={activeBuddingIndex}
            onSetBuddingIndex={setActiveBuddingIndex}
            onDirectInsertStop={handleDirectInsertStop}
          />
        </div>
      </div>

      {/* Supporting Modals & Trays */}
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddItem={(item) => handleAddItem(item, addModalInsertIndex)}
        defaultTime={addModalDefaultTime}
        existingCount={currentDay.items.length}
      />

      <ImportItineraryModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportDays}
      />

      <ComparePlansModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        plans={plans}
        activePlanId={activePlanId}
        onSelectPlan={handleSelectPlan}
      />

      <SavedPlacesDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedPlaces={savedPlaces}
        onAddPlaceToDay={handleAddSavedPlaceToDay}
        activeDayNumber={currentDay.dayNumber}
      />

      <OfflineDirectionsModal
        day={currentDay}
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />

      <CustomizeUiModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onResetDefaults={handleResetPreferences}
      />

      <FunctionsDescriptionModal
        isOpen={isFunctionsModalOpen}
        onClose={() => setIsFunctionsModalOpen(false)}
      />
    </div>
  );
}
