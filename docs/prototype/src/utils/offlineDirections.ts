import { DayItinerary } from '../types';
import { deriveTransitLeg, calculateRouteStats } from './geoUtils';

/**
 * Generates an offline-ready, beautifully styled printable HTML document for a day itinerary.
 * Opens in a clean window or triggers print/PDF download.
 */
export function generateOfflineDirectionsHtml(day: DayItinerary, allDays?: DayItinerary[]): string {
  const items = day.items;
  const stats = calculateRouteStats(items);

  const legs = items.slice(0, items.length - 1).map((item, idx) => {
    const next = items[idx + 1];
    const leg = deriveTransitLeg(item, next);
    return {
      from: item,
      to: next,
      leg
    };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Offline Directions & Day Guide – Day ${day.dayNumber}: ${day.title}</title>
  <style>
    @page {
      margin: 14mm 12mm;
      size: A4 portrait;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2C2623;
      background: #FFFFFF;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
      font-size: 13px;
    }
    .header {
      border-bottom: 2px solid #D96B43;
      padding-bottom: 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge {
      display: inline-block;
      background: #FAF5EE;
      color: #D96B43;
      border: 1px solid #EADBCE;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 20px;
      margin: 2px 0 4px 0;
      color: #1E1917;
    }
    .meta-line {
      color: #716458;
      font-size: 12px;
    }
    .stats-bar {
      background: #FAF7F2;
      border: 1px solid #EADBCE;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 11px;
    }
    .stats-item strong {
      display: block;
      font-size: 13px;
      color: #2C2623;
    }
    .tip-box {
      background: #FFF9F3;
      border-left: 3px solid #D96B43;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 20px;
      font-size: 11px;
      color: #5C473A;
    }
    .stop-card {
      border: 1px solid #E8DFD5;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .stop-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .stop-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stop-num {
      background: #2C2623;
      color: #FFFFFF;
      font-weight: bold;
      font-size: 11px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stop-title {
      font-size: 14px;
      font-weight: 700;
      color: #2C2623;
      margin: 0;
    }
    .stop-time {
      font-family: monospace;
      font-weight: 700;
      font-size: 13px;
      color: #D96B43;
    }
    .stop-address {
      color: #716458;
      font-size: 11px;
      margin: 2px 0 6px 30px;
    }
    .stop-desc {
      font-size: 12px;
      color: #4A3B32;
      margin: 4px 0 6px 30px;
    }
    .stop-tags {
      margin-left: 30px;
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #716458;
    }
    .booking-tag {
      color: #2A9D8F;
      font-weight: 600;
    }
    .secret-tip {
      margin: 6px 0 2px 30px;
      background: #FDFBF7;
      border: 1px dashed #E0D4C5;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      color: #5C473A;
      font-style: italic;
    }
    .transit-step {
      margin: 6px 0 10px 42px;
      padding: 8px 12px;
      background: #F4EFEB;
      border-left: 2px dashed #D96B43;
      border-radius: 0 6px 6px 0;
      font-size: 11px;
      page-break-inside: avoid;
    }
    .transit-step strong {
      color: #D96B43;
    }
    .transit-leave {
      display: inline-block;
      background: #FFF5EE;
      color: #C85327;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #FCD9C6;
      margin-top: 4px;
      font-size: 10px;
    }
    .emergency-box {
      margin-top: 24px;
      border-top: 1px solid #EADBCE;
      padding-top: 12px;
      font-size: 10px;
      color: #8C7A6B;
      display: flex;
      justify-content: space-between;
    }
    .print-btn-bar {
      position: sticky;
      top: 0;
      background: #2C2623;
      color: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .btn {
      background: #D96B43;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
    .btn:hover {
      background: #C85327;
    }
    @media print {
      .print-btn-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <div>
      <strong>📥 Offline Step-by-Step Directions Ready</strong>
      <div style="font-size: 11px; color: #D8C7BA;">Save as PDF or print to keep all coordinates, transit legs, and departure tips offline.</div>
    </div>
    <button class="btn" onclick="window.print()">🖨️ Save as PDF / Print</button>
  </div>

  <div class="header">
    <div>
      <span class="badge">Offline Travel Guide · Day ${day.dayNumber}</span>
      <h1>${day.title}</h1>
      <div class="meta-line">${day.dateString} · ${items.length} Curated Stops</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #8C7A6B;">
      <div>Generated via Béa Companion</div>
      <div>Works 100% Offline</div>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stats-item">
      <span>Total Stops</span>
      <strong>${items.length} locations</strong>
    </div>
    <div class="stats-item">
      <span>Transit Distance</span>
      <strong>~${stats.totalDistanceKm} km total</strong>
    </div>
    <div class="stats-item">
      <span>Travel Time</span>
      <strong>~${stats.totalDurationMinutes} mins in transit</strong>
    </div>
    <div class="stats-item">
      <span>Active Window</span>
      <strong>${items[0]?.time || '08:30'} – ${items[items.length - 1]?.time || '20:00'}</strong>
    </div>
  </div>

  ${day.beaDailyInsight ? `
  <div class="tip-box">
    <strong>💡 Béa’s Daily Advice:</strong> ${day.beaDailyInsight}
  </div>` : ''}

  <div class="itinerary-flow">
    ${items.map((item, idx) => {
      const nextItem = items[idx + 1];
      const leg = nextItem ? deriveTransitLeg(item, nextItem) : null;

      // Calculate departure time
      let leaveByStr = '';
      if (nextItem && leg) {
        const [nh, nm] = nextItem.time.split(':').map(Number);
        const nextMins = nh * 60 + nm;
        const leaveMins = Math.max(0, nextMins - leg.durationMinutes);
        const lh = String(Math.floor(leaveMins / 60) % 24).padStart(2, '0');
        const lm = String(leaveMins % 60).padStart(2, '0');
        leaveByStr = `${lh}:${lm}`;
      }

      return `
      <div class="stop-card">
        <div class="stop-header">
          <div class="stop-title-row">
            <div class="stop-num">${idx + 1}</div>
            <h3 class="stop-title">${item.title}</h3>
          </div>
          <div class="stop-time">${item.time}</div>
        </div>
        <div class="stop-address">📍 ${item.address} · <em>${item.neighborhood || 'Central'}</em></div>
        <div class="stop-desc">${item.subtitle}</div>
        
        <div class="stop-tags">
          <span>⏱️ Stay: ~${item.estimatedStayMinutes || 45} mins</span>
          ${item.cost ? `<span>💳 Cost: ${item.cost}</span>` : ''}
          ${item.ticketInfo ? `<span class="booking-tag">🎟️ ${item.ticketInfo} ${item.bookingCode ? `(${item.bookingCode})` : ''}</span>` : ''}
          <span>📌 GPS: ${item.coordinates.lat.toFixed(4)}, ${item.coordinates.lng.toFixed(4)}</span>
        </div>

        ${item.localTip ? `
        <div class="secret-tip">
          <strong>Insider Tip:</strong> "${item.localTip}"
        </div>` : ''}

        ${item.notes ? `
        <div style="margin-left: 30px; margin-top: 4px; font-size: 11px; color: #716458;">
          <strong>Notes:</strong> ${item.notes}
        </div>` : ''}
      </div>

      ${leg && nextItem ? `
      <div class="transit-step">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div><strong>➡️ Turn-by-Turn Directions to Stop #${idx + 2} (${nextItem.title}):</strong></div>
          <span style="font-size: 10px; color: #8C7A6B;">~${leg.durationMinutes}m · ${leg.distanceKm} km (${leg.mode})</span>
        </div>
        
        <div style="margin: 6px 0; font-size: 11px; color: #3E3228;">
          ${leg.instructions}
        </div>

        ${leg.steps && leg.steps.length > 0 ? `
        <div style="margin-top: 8px; border-top: 1px dashed #DCCFBF; padding-top: 6px;">
          <strong style="font-size: 10px; color: #A0522D; text-transform: uppercase; letter-spacing: 0.5px;">Navigation Steps:</strong>
          <ol style="margin: 4px 0 6px 16px; padding: 0; font-size: 11px; line-height: 1.5; color: #403227;">
            ${leg.steps.map(s => `
              <li style="margin-bottom: 4px;">
                <strong>${s.instruction}</strong>
                ${s.landmark ? `<span style="color: #8C7A6B; font-size: 10px;"> [Landmark: ${s.landmark}]</span>` : ''}
                ${s.distanceMeters ? `<span style="font-size: 10px; color: #D96B43; font-weight: bold;"> (~${s.distanceMeters}m)</span>` : ''}
              </li>
            `).join('')}
          </ol>
        </div>` : ''}

        <div class="transit-leave">
          ⏱️ Target Departure: Leave by <strong>${leaveByStr}</strong> to reach ${nextItem.title} on time
        </div>
      </div>` : ''}
      `;
    }).join('')}
  </div>

  <div class="emergency-box">
    <div>🇯🇵 Japan Emergency: Police 110 · Ambulance/Fire 119 · Japan Helpline: 0570-000-911</div>
    <div>Document created with Béa Smart Travel Companion · Keep saved on mobile device for offline navigation.</div>
  </div>
</body>
</html>`;
}

/**
 * Generates and downloads a clean plain text directions file (.txt) formatted for easy reading on any offline device
 */
export function downloadOfflineDirectionsText(day: DayItinerary) {
  const items = day.items;
  const stats = calculateRouteStats(items);

  let output = `====================================================\n`;
  output += `OFFLINE TRAVEL DIRECTIONS & STEP-BY-STEP ITINERARY\n`;
  output += `Day ${day.dayNumber}: ${day.title}\n`;
  output += `Date: ${day.dateString} | Total Stops: ${items.length}\n`;
  output += `Total Distance: ~${stats.totalDistanceKm} km | Total Transit: ~${stats.totalDurationMinutes} mins\n`;
  output += `====================================================\n\n`;

  if (day.beaDailyInsight) {
    output += `DAILY INSIGHT:\n"${day.beaDailyInsight}"\n\n`;
  }

  items.forEach((item, idx) => {
    output += `----------------------------------------------------\n`;
    output += `STOP #${idx + 1} [${item.time}]: ${item.title.toUpperCase()}\n`;
    output += `----------------------------------------------------\n`;
    output += `Summary: ${item.subtitle}\n`;
    output += `Address: ${item.address}\n`;
    output += `Neighborhood: ${item.neighborhood || 'Central'}\n`;
    output += `GPS Coordinates: ${item.coordinates.lat.toFixed(5)}, ${item.coordinates.lng.toFixed(5)}\n`;
    output += `Estimated Stay: ~${item.estimatedStayMinutes || 45} minutes\n`;
    if (item.cost) output += `Cost: ${item.cost}\n`;
    if (item.ticketInfo) output += `Booking: ${item.ticketInfo} (Code: ${item.bookingCode || 'N/A'})\n`;
    if (item.localTip) output += `Local Tip: "${item.localTip}"\n`;
    if (item.notes) output += `Notes: ${item.notes}\n`;

    const nextItem = items[idx + 1];
    if (nextItem) {
      const leg = deriveTransitLeg(item, nextItem);
      const [nh, nm] = nextItem.time.split(':').map(Number);
      const nextMins = nh * 60 + nm;
      const leaveMins = Math.max(0, nextMins - leg.durationMinutes);
      const lh = String(Math.floor(leaveMins / 60) % 24).padStart(2, '0');
      const lm = String(leaveMins % 60).padStart(2, '0');
      const leaveByStr = `${lh}:${lm}`;

      output += `\n>> TRANSIT TO NEXT STOP (#${idx + 2}: ${nextItem.title}):\n`;
      output += `   Method: ${leg.mode.toUpperCase()} (~${leg.durationMinutes} mins, ${leg.distanceKm} km)\n`;
      output += `   Summary: ${leg.instructions}\n`;
      if (leg.steps && leg.steps.length > 0) {
        output += `   TURN-BY-TURN DIRECTIONS:\n`;
        leg.steps.forEach(s => {
          output += `     ${s.stepNumber}. ${s.instruction}`;
          if (s.distanceMeters) output += ` [${s.distanceMeters}m]`;
          if (s.landmark) output += ` (Landmark: ${s.landmark})`;
          output += `\n`;
        });
      }
      output += `   *** TARGET DEPARTURE: Leave by ${leaveByStr} *** (to arrive at ${nextItem.time})\n\n`;
    } else {
      output += `\n>> End of scheduled itinerary for Day ${day.dayNumber}.\n\n`;
    }
  });

  output += `====================================================\n`;
  output += `EMERGENCY CONTACTS (JAPAN):\n`;
  output += `Police: 110 | Ambulance & Fire: 119\n`;
  output += `Japan Visitor Hotline (24/7 English): 050-3816-2720\n`;
  output += `====================================================\n`;

  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Day-${day.dayNumber}-Offline-Directions-${day.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens print / PDF preview window containing full styled offline directions document
 */
export function openOfflineDirectionsPrintWindow(day: DayItinerary, allDays?: DayItinerary[]) {
  const html = generateOfflineDirectionsHtml(day, allDays);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
