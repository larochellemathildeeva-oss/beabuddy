import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ItineraryItem, TransitLeg } from '../types';
import { deriveTransitLeg } from '../utils/geoUtils';
import { Play, Sparkles } from 'lucide-react';

interface InteractiveMapProps {
  items: ItineraryItem[];
  activeItemId: string | null;
  onSelectItem: (id: string) => void;
  className?: string;
  showTransitLegs?: boolean;
  showFlowAnimationControl?: boolean;
  accentColor?: string;
  dayNumber?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  items,
  activeItemId,
  onSelectItem,
  className = 'w-full h-full min-h-0',
  showTransitLegs = true,
  showFlowAnimationControl = true,
  accentColor = '#D96B43',
  dayNumber
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineBackgroundRef = useRef<L.Polyline | null>(null);
  const polylineAnimatedRef = useRef<L.Polyline | null>(null);
  const [isFlowAnimating, setIsFlowAnimating] = useState(false);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = items[0]?.coordinates.lat ?? 34.3955;
    const initialLng = items[0]?.coordinates.lng ?? 132.4536;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    // CartoDB Voyager tiles: fast, high-reliability CDN, beautiful warm travel styling, zero iframe blocking
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    // Repeated robust size invalidations to guarantee tile load on mobile viewports & flex containers
    const timers = [50, 150, 300, 600, 1200].map((delay) =>
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, delay)
    );

    // Handle container resize
    const container = mapContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(container);
    }

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Trigger seamless SVG flow path draw-in
  const triggerFlowAnimation = () => {
    setIsFlowAnimating(true);
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);

    // Remove existing polylines
    if (polylineBackgroundRef.current) {
      polylineBackgroundRef.current.remove();
      polylineBackgroundRef.current = null;
    }
    if (polylineAnimatedRef.current) {
      polylineAnimatedRef.current.remove();
      polylineAnimatedRef.current = null;
    }

    const map = mapInstanceRef.current;
    if (!map || items.length <= 1) return;

    const latLngs: L.LatLngExpression[] = items.map((i) => [i.coordinates.lat, i.coordinates.lng]);

    // 1. Soft glowing background polyline representing full track
    polylineBackgroundRef.current = L.polyline(latLngs, {
      color: '#D96B43',
      weight: 4,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // 2. Foreground animated SVG flow path line with progressive draw
    const animatedLine = L.polyline(latLngs, {
      color: '#D96B43',
      weight: 3.5,
      opacity: 0.95,
      className: 'map-flow-line-animated map-flow-active-pulse',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    polylineAnimatedRef.current = animatedLine;

    // Direct SVG element stroke-dash setup for guaranteed cross-browser path flow
    setTimeout(() => {
      const pathEl = animatedLine.getElement() as (SVGPathElement & HTMLElement) | null;
      if (pathEl && pathEl.style) {
        const totalLength = typeof pathEl.getTotalLength === 'function' ? pathEl.getTotalLength() : 1200;
        pathEl.style.strokeDasharray = `${totalLength}`;
        pathEl.style.strokeDashoffset = `${totalLength}`;
        pathEl.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.25, 1, 0.5, 1)';
        requestAnimationFrame(() => {
          if (pathEl.style) {
            pathEl.style.strokeDashoffset = '0';
          }
        });
      }
    }, 40);

    animationTimerRef.current = setTimeout(() => {
      setIsFlowAnimating(false);
    }, 2000);
  };

  // Update Markers & Polylines when items change or active day switches
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (polylineBackgroundRef.current) {
      polylineBackgroundRef.current.remove();
      polylineBackgroundRef.current = null;
    }
    if (polylineAnimatedRef.current) {
      polylineAnimatedRef.current.remove();
      polylineAnimatedRef.current = null;
    }

    if (items.length === 0) return;

    const latLngs: L.LatLngExpression[] = [];

    // Add Markers with sequential pop-in animation
    items.forEach((item, index) => {
      const isSelected = item.id === activeItemId;
      const lat = item.coordinates.lat;
      const lng = item.coordinates.lng;
      latLngs.push([lat, lng]);

      const pinColor = isSelected ? '#D96B43' : '#2C2623';
      const bgColor = isSelected ? '#FAF5EE' : '#FFFFFF';
      const scaleClass = isSelected ? 'scale-110 z-30' : 'hover:scale-105';
      const delayStyle = `animation-delay: ${index * 120}ms`;

      const customIcon = L.divIcon({
        className: 'custom-itinerary-pin',
        html: `
          <div class="transition-transform duration-200 ${scaleClass} map-pin-pop flex flex-col items-center" style="${delayStyle}">
            <div style="background-color: ${bgColor}; border: 2.5px solid ${pinColor}; color: ${pinColor};" 
                 class="w-7 h-7 rounded-full shadow-md flex items-center justify-center font-bold text-xs ring-2 ring-black/5">
              ${index + 1}
            </div>
            <div style="border-top-color: ${pinColor};" class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] -mt-[1px]"></div>
          </div>
        `,
        iconSize: [28, 34],
        iconAnchor: [14, 34],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-1 max-w-[200px]">
          <div class="text-[11px] text-[#8C7A6B] font-medium">${item.time} · Stop ${index + 1}</div>
          <div class="text-xs font-bold text-[#2C2623] leading-tight mt-0.5">${item.title}</div>
          <div class="text-[11px] text-[#716458] mt-1">${item.address}</div>
        </div>
      `);

      marker.on('click', () => {
        onSelectItem(item.id);
      });

      markersRef.current[item.id] = marker;
    });

    // Draw route line if enabled and trigger animated path flow
    if (showTransitLegs && latLngs.length > 1) {
      triggerFlowAnimation();
    }

    // Fit bounds smoothly to all stops
    try {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (e) {
      // Safe catch for edge geometry
    }
  }, [items, showTransitLegs, dayNumber]);

  // Pan to active item
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeItemId) return;

    const activeItem = items.find((i) => i.id === activeItemId);
    if (activeItem) {
      map.panTo([activeItem.coordinates.lat, activeItem.coordinates.lng], {
        animate: true,
        duration: 0.5
      });
      const marker = markersRef.current[activeItemId];
      if (marker && !marker.isPopupOpen()) {
        marker.openPopup();
      }
    }
  }, [activeItemId, items]);

  const recenterRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || items.length === 0) return;
    const latLngs = items.map((i) => [i.coordinates.lat, i.coordinates.lng] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    map.invalidateSize();
  };

  return (
    <div className={`relative overflow-hidden w-full h-full min-h-[220px] ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" style={{ minHeight: '220px' }} />

      {/* Floating Travel Flow Indicator & Controls */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
        <button
          type="button"
          onClick={recenterRoute}
          title="Fit full route in view"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/95 hover:bg-white text-[#2C2623] backdrop-blur-md rounded-xl border border-[#EADBCE] shadow-xs text-[11px] font-semibold transition-all active:scale-95"
        >
          <Sparkles className="w-3 h-3 text-[#2A9D8F]" />
          <span>Fit Route</span>
        </button>

        {showTransitLegs && showFlowAnimationControl && items.length > 1 && (
          <button
            type="button"
            onClick={triggerFlowAnimation}
            title="Replay itinerary travel flow animation"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 hover:bg-white text-[#2C2623] backdrop-blur-md rounded-xl border border-[#EADBCE] shadow-xs text-[11px] font-semibold transition-all active:scale-95"
          >
            <Play className={`w-3 h-3 text-[#D96B43] ${isFlowAnimating ? 'animate-spin' : ''}`} />
            <span>{isFlowAnimating ? 'Flow…' : 'Replay'}</span>
          </button>
        )}
      </div>

      {/* Legend pill for travel path */}
      {showTransitLegs && items.length > 1 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-[#EADBCE] text-[10px] text-[#716458] flex items-center gap-2 shadow-2xs">
          <span className="w-2.5 h-0.5 bg-[#D96B43] rounded-full inline-block" />
          <span className="font-semibold text-[#2C2623]">{items.length} Stops Connected</span>
          <span className="text-[#8C7A6B]">Day {dayNumber || 1}</span>
        </div>
      )}
    </div>
  );
};
