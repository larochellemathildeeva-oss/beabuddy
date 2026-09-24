import React, { useState } from 'react';
import { DayItinerary } from '../types';
import { X, FileText, ArrowRight, Check, Sparkles } from 'lucide-react';
import { MascotAvatar } from './MascotAvatar';

interface ImportItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedDays: DayItinerary[]) => void;
}

const TEMPLATES: { title: string; subtitle: string; days: DayItinerary[] }[] = [
  {
    title: 'Paris: Left Bank & Le Marais (3 Days)',
    subtitle: 'Boutiques, historic bistros, Seine sunset & Rodin gardens',
    days: [
      {
        dayNumber: 1,
        dateString: 'Day 1',
        title: 'Le Marais, Place des Vosges & Canal St-Martin',
        beaDailyInsight: 'Everything in Le Marais is walking distance. Stop for a brioche at Poilâne.',
        items: [
          {
            id: 'paris-1',
            order: 1,
            time: '09:00',
            title: 'Café de Flore & Boulevard Saint-Germain',
            subtitle: 'Classic morning espresso and pain au chocolat',
            address: '172 Boulevard Saint-Germain, 75006 Paris',
            neighborhood: 'Saint-Germain-des-Prés',
            category: 'food',
            coordinates: { lat: 48.8542, lng: 2.3325 },
            estimatedStayMinutes: 45
          },
          {
            id: 'paris-2',
            order: 2,
            time: '10:30',
            title: 'Musée d’Orsay',
            subtitle: 'Impressionist galleries & clock tower window',
            address: '1 Rue de la Légion d’Honneur, 75007 Paris',
            neighborhood: 'Left Bank Quay',
            category: 'culture',
            coordinates: { lat: 48.8599, lng: 2.3265 },
            isBooked: true,
            ticketInfo: 'Fast Track Entry #PARIS-772',
            estimatedStayMinutes: 90
          },
          {
            id: 'paris-3',
            order: 3,
            time: '13:00',
            title: 'Lunch at Chez Janou',
            subtitle: 'Provençal bistro & bottomless chocolate mousse',
            address: '2 Rue Roger Verlomme, 75003 Paris',
            neighborhood: 'Le Marais',
            category: 'food',
            coordinates: { lat: 48.8558, lng: 2.3662 },
            estimatedStayMinutes: 60
          },
          {
            id: 'paris-4',
            order: 4,
            time: '15:00',
            title: 'Place des Vosges & Maison de Victor Hugo',
            subtitle: '17th-century arcaded royal square & garden lawns',
            address: 'Place des Vosges, 75004 Paris',
            neighborhood: 'Le Marais',
            category: 'attraction',
            coordinates: { lat: 48.8555, lng: 2.3654 },
            estimatedStayMinutes: 60
          }
        ]
      }
    ]
  },
  {
    title: 'Kyoto: Higashiyama Ancient Paths (2 Days)',
    subtitle: 'Wooden machiya alleys, Kiyomizu-dera & Nanzen-ji aqueduct',
    days: [
      {
        dayNumber: 1,
        dateString: 'Day 1',
        title: 'Kiyomizu-dera to Gion Lantern Walk',
        beaDailyInsight: 'The wooden stage at Kiyomizu is quietest before 10 AM. Enjoy the breeze.',
        items: [
          {
            id: 'kyoto-1',
            order: 1,
            time: '08:30',
            title: 'Kiyomizu-dera Temple',
            subtitle: 'Famous cantilevered timber veranda overlooking cherry valleys',
            address: '1-294 Kiyomizu, Higashiyama, Kyoto',
            neighborhood: 'Higashiyama',
            category: 'attraction',
            coordinates: { lat: 34.9948, lng: 135.785 },
            estimatedStayMinutes: 75
          },
          {
            id: 'kyoto-2',
            order: 2,
            time: '10:30',
            title: 'Sannenzaka & Ninenzaka Stone Steps',
            subtitle: 'Preserved Edo-era flagstone streets lined with teahouses',
            address: '2 Chome Kiyomizu, Higashiyama',
            neighborhood: 'Higashiyama Historic',
            category: 'leisure',
            coordinates: { lat: 34.9982, lng: 135.7818 },
            estimatedStayMinutes: 60
          },
          {
            id: 'kyoto-3',
            order: 3,
            time: '12:30',
            title: 'Tofu Kaiseki Lunch at Tousuiro',
            subtitle: 'Traditional Kyoto obanzai & hot pot silken tofu',
            address: '517-3 Kiyomotocho, Gion',
            neighborhood: 'Gion',
            category: 'food',
            coordinates: { lat: 35.0055, lng: 135.7725 },
            estimatedStayMinutes: 75
          }
        ]
      }
    ]
  }
];

export const ImportItineraryModal: React.FC<ImportItineraryModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'paste'>('presets');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  if (!isOpen) return null;

  const handleCustomParse = () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setTimeout(() => {
      // Create clean parsed stops from lines
      const lines = rawText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const items = lines.slice(0, 5).map((line, idx) => ({
        id: `imported-${Date.now()}-${idx}`,
        order: idx + 1,
        time: `${9 + idx * 2}:00`,
        title: line.replace(/^[-*•\d.]\s*/, ''),
        subtitle: 'Imported from notes',
        address: 'Downtown area',
        neighborhood: 'Central',
        category: 'attraction' as const,
        coordinates: {
          lat: 34.3955 + idx * 0.005,
          lng: 132.4536 + idx * 0.005
        },
        estimatedStayMinutes: 60
      }));

      const parsedDay: DayItinerary = {
        dayNumber: 1,
        dateString: 'Imported Day',
        title: 'Custom Imported Plan',
        beaDailyInsight: 'I organized your stops chronologically. Review the times to match your rhythm.',
        items
      };

      onImport([parsedDay]);
      setIsParsing(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] border border-[#E8DFD3] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD3] bg-white">
          <div className="flex items-center gap-2.5">
            <MascotAvatar size="sm" />
            <div>
              <h2 className="text-base font-bold text-[#2C2623]">Import Itinerary</h2>
              <p className="text-xs text-[#8C7A6B]">Bring in travel plans instantly</p>
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

        {/* Tab switch */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'presets'
                ? 'bg-[#2C2623] text-white border-[#2C2623]'
                : 'bg-white text-[#716458] border-[#E8DFD3]'
            }`}
          >
            Curated Inspiration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'paste'
                ? 'bg-[#2C2623] text-white border-[#2C2623]'
                : 'bg-white text-[#716458] border-[#E8DFD3]'
            }`}
          >
            Paste Notes / Bookings
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'presets' ? (
            <div className="space-y-3">
              <p className="text-xs text-[#716458] mb-2">
                Select a crafted itinerary to test how Béa presents and structures the day:
              </p>
              {TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-white border border-[#E8DFD3] rounded-2xl hover:border-[#D96B43] transition-all flex items-center justify-between group cursor-pointer"
                  onClick={() => {
                    onImport(tmpl.days);
                    onClose();
                  }}
                >
                  <div className="pr-4">
                    <h4 className="text-sm font-bold text-[#2C2623] group-hover:text-[#D96B43] transition-colors">
                      {tmpl.title}
                    </h4>
                    <p className="text-xs text-[#8C7A6B] mt-0.5">{tmpl.subtitle}</p>
                    <span className="text-[11px] text-[#716458] font-medium mt-1 inline-block">
                      {tmpl.days[0].items.length} curated stops
                    </span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-[#D96B43] bg-[#FAF5EE] group-hover:bg-[#D96B43] group-hover:text-white rounded-xl transition-colors"
                  >
                    Load Plan
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#716458]">
                Paste confirmation emails, bulleted list from Apple Notes, or Airbnb reservation details:
              </p>
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="• 09:30 Peace Memorial Museum&#10;• 11:45 Motoyasubashi River Ferry&#10;• 13:00 Lunch at Kakiya&#10;• 15:30 Itsukushima Torii Gate"
                className="w-full p-3 bg-white border border-[#E8DFD3] rounded-xl text-xs text-[#2C2623] font-mono placeholder:font-sans placeholder:text-[#B5A597] focus:outline-none focus:border-[#D96B43]"
              />
              <button
                type="button"
                disabled={isParsing || !rawText.trim()}
                onClick={handleCustomParse}
                className="w-full py-2.5 bg-[#D96B43] hover:bg-[#C25832] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {isParsing ? (
                  <span>Structuring Day...</span>
                ) : (
                  <>
                    <span>Convert to Béa Itinerary</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
