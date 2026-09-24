import React, { useState } from 'react';
import { ItemCategory, ItineraryItem, LatLng } from '../types';
import { X, Plus, Clock, MapPin, Tag } from 'lucide-react';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: ItineraryItem, insertIndex?: number) => void;
  defaultTime?: string;
  existingCount: number;
}

const CATEGORIES: { id: ItemCategory; label: string }[] = [
  { id: 'attraction', label: 'Attraction' },
  { id: 'food', label: 'Food & Drink' },
  { id: 'culture', label: 'Culture & Art' },
  { id: 'leisure', label: 'Leisure / Park' },
  { id: 'transport', label: 'Transit / Ferry' }
];

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  defaultTime = '12:00',
  existingCount
}) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(defaultTime);
  const [category, setCategory] = useState<ItemCategory>('attraction');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('Central District');
  const [stayMinutes, setStayMinutes] = useState(45);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newItem: ItineraryItem = {
      id: `custom-stop-${Date.now()}`,
      order: existingCount + 1,
      time: time || '12:00',
      title: title.trim(),
      subtitle: `${neighborhood} · ${stayMinutes}m visit`,
      address: address.trim() || 'Central City Area',
      neighborhood: neighborhood.trim() || 'Downtown',
      category,
      coordinates: {
        lat: 34.3955 + (Math.random() - 0.5) * 0.02,
        lng: 132.4536 + (Math.random() - 0.5) * 0.02
      },
      notes: notes.trim() || undefined,
      estimatedStayMinutes: stayMinutes
    };

    onAddItem(newItem);
    setTitle('');
    setAddress('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] border border-[#E8DFD3] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD3] bg-white">
          <div>
            <h2 className="text-base font-bold text-[#2C2623]">Add a Stop</h2>
            <p className="text-xs text-[#8C7A6B]">Insert into your day's timeline</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] hover:bg-[#FAF5EE]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-[#5C473A] mb-1">
              Place Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shukkeien Garden, Café de Flore"
              className="w-full px-3.5 py-2.5 bg-white border border-[#E8DFD3] rounded-xl text-sm text-[#2C2623] placeholder:text-[#B5A597] focus:outline-none focus:border-[#D96B43]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C473A] mb-1">
                Time
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E8DFD3] rounded-xl">
                <Clock className="w-3.5 h-3.5 text-[#8C7A6B]" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-xs font-medium text-[#2C2623] bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C473A] mb-1">
                Est. Duration
              </label>
              <select
                value={stayMinutes}
                onChange={(e) => setStayMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[#E8DFD3] rounded-xl text-xs text-[#2C2623] focus:outline-none focus:border-[#D96B43]"
              >
                <option value={20}>20 min (Quick)</option>
                <option value={45}>45 min (Standard)</option>
                <option value={75}>1 hr 15m (Extended)</option>
                <option value={120}>2 hours (Deep dive)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C473A] mb-1">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    category === c.id
                      ? 'bg-[#2C2623] text-white border-[#2C2623]'
                      : 'bg-white text-[#5C473A] border-[#E8DFD3] hover:border-[#D96B43]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C473A] mb-1">
              Neighborhood / Area
            </label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g. Peace Park District, Le Marais"
              className="w-full px-3.5 py-2 bg-white border border-[#E8DFD3] rounded-xl text-xs text-[#2C2623] focus:outline-none focus:border-[#D96B43]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C473A] mb-1">
              Notes or Booking reference
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Low tide at 16:00, tickets saved in email"
              className="w-full px-3.5 py-2 bg-white border border-[#E8DFD3] rounded-xl text-xs text-[#2C2623] focus:outline-none focus:border-[#D96B43]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#716458] hover:text-[#2C2623] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#D96B43] hover:bg-[#C25832] rounded-xl shadow-xs transition-colors"
            >
              Add to Itinerary
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
