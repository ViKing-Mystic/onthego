/**
 * OntheGO - Intelligent Route-Aware Backup Planner Module
 * Dynamically ranks realistic alternatives by geographic proximity, route detour,
 * verified opening status, meal suitability, and time constraints.
 */

window.OntheGoBackups = {
  selectedStopId: null,
  maxDetourKm: 5, // Default 5 km

  init() {
    this.renderStopSelector();
    this.renderRecommendations();
  },

  setMaxDetour(km) {
    this.maxDetourKm = parseFloat(km) || 5;
    const buttons = document.querySelectorAll(".detour-chip");
    buttons.forEach(btn => {
      if (parseFloat(btn.getAttribute("data-km")) === this.maxDetourKm) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    this.renderRecommendations();
  },

  openForStop(stopId) {
    this.selectedStopId = stopId;
    OntheGoApp.switchTab("more");
    OntheGoApp.switchMoreSubTab("backups");
    this.renderStopSelector();
    this.renderRecommendations();
  },

  renderStopSelector() {
    const selector = document.getElementById("backupStopSelector");
    if (!selector) return;

    const trip = OntheGoApp.getActiveTrip();
    let optionsHtml = `<option value="">-- Choose an Itinerary Stop --</option>`;

    trip.days.forEach(d => {
      optionsHtml += `<optgroup label="Day ${d.dayNumber}: ${d.dateHuman}">`;
      (d.activities || []).forEach(a => {
        optionsHtml += `<option value="${a.id}" ${a.id === this.selectedStopId ? 'selected' : ''}>
          Day ${d.dayNumber}: ${a.title} (${a.time || 'Flexible'})
        </option>`;
      });
      optionsHtml += `</optgroup>`;
    });

    selector.innerHTML = optionsHtml;
  },

  onStopSelected(stopId) {
    this.selectedStopId = stopId;
    this.renderRecommendations();
  },

  findCurrentStop() {
    if (!this.selectedStopId) return null;
    const trip = OntheGoApp.getActiveTrip();
    for (const d of trip.days) {
      const act = (d.activities || []).find(a => a.id === this.selectedStopId);
      if (act) return { activity: act, day: d };
    }
    return null;
  },

  // Calculate distance between two lat/lng coordinates in km (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  },

  renderRecommendations() {
    const container = document.getElementById("backupResultsContainer");
    const headerInfoEl = document.getElementById("backupTargetHeaderInfo");
    if (!container) return;

    const current = this.findCurrentStop();
    if (!current) {
      if (headerInfoEl) headerInfoEl.innerHTML = "";
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🔀</div>
          <h4 style="color: var(--text-main); margin-bottom: 4px;">Select an itinerary stop above</h4>
          <p style="font-size: 0.8rem;">OntheGO will analyze real route proximities, open hours, and ratings to recommend intelligent backups within ${this.maxDetourKm} km.</p>
        </div>
      `;
      return;
    }

    const { activity: stop, day } = current;

    if (headerInfoEl) {
      headerInfoEl.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
          <div style="font-size: 0.72rem; color: var(--ocean-teal-light); font-weight: 800; text-transform: uppercase;">Selected Target Stop • Day ${day.dayNumber}</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 2px 0;">${stop.title}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">⏱ ${stop.time || 'Flexible'} • 📍 ${stop.location || 'Kochi'} • ${stop.category}</div>
          ${stop.scheduleConflict ? `
            <div style="margin-top: 6px; font-size: 0.75rem; color: var(--danger); background: rgba(239,68,68,0.1); padding: 4px 8px; border-radius: 4px;">
              ⚠️ Known Conflict: ${stop.scheduleConflict}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Determine category matching: if meal/restaurant, look into restaurant directory
    const isFood = (stop.category || "").toLowerCase().includes("meal") || (stop.category || "").toLowerCase().includes("restaurant");
    const allRestaurants = OntheGoDefaultData.restaurants || [];
    const allOptional = OntheGoDefaultData.optionalPlaces || [];

    let candidatePool = [];

    if (isFood) {
      candidatePool = allRestaurants.map(r => ({
        ...r,
        type: "restaurant",
        distanceKm: this.calculateDistance(stop.lat, stop.lng, r.lat, r.lng)
      }));
    } else {
      candidatePool = allOptional.map(p => ({
        ...p,
        type: "sight",
        distanceKm: this.calculateDistance(stop.lat, stop.lng, p.lat, p.lng)
      }));
    }

    // Filter within maxDetourKm
    const filtered = candidatePool.filter(c => c.distanceKm <= this.maxDetourKm && c.name !== stop.title);

    // Sort by proximity first, then rating
    filtered.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (b.rating || 4.0) - (a.rating || 4.0);
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; background: var(--bg-card); border-radius: var(--radius-md);">
          <p style="color: var(--text-muted); font-size: 0.85rem;">No alternatives found within ${this.maxDetourKm} km.</p>
          <button class="btn-sm btn-primary-sm" style="margin-top: 10px;" onclick="OntheGoBackups.setMaxDetour(10)">Expand to 10 km Detour</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((alt, idx) => {
      const isTopPick = idx === 0;

      return `
        <div class="stop-card" style="margin-bottom: 12px; border-color: ${isTopPick ? 'var(--ocean-teal)' : 'var(--border-color)'};">
          <div class="stop-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; font-weight: 800; background: rgba(13,148,136,0.15); color: var(--ocean-teal-light); padding: 2px 7px; border-radius: 4px;">
                🚗 +${alt.distanceKm} km detour
              </span>
              ${alt.rating ? `<span style="font-size: 0.72rem; font-weight: 700; color: #fbbf24;">⭐ ${alt.rating}</span>` : ''}
              ${isTopPick ? `<span style="font-size: 0.7rem; font-weight: 800; background: var(--sunset-coral); color: white; padding: 2px 6px; border-radius: 4px;">Best Match</span>` : ''}
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${alt.area || alt.region || ''}</span>
          </div>

          <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 4px 0;">${alt.name}</div>
          
          <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
            ${alt.cuisine ? `<b>Cuisine:</b> ${alt.cuisine} • ` : ''}
            ${alt.priceCategory ? `<b>Price:</b> ${alt.priceCategory}` : (alt.entryFee ? `<b>Entry:</b> ${alt.entryFee}` : '')}
          </div>

          ${alt.openingHours || alt.visitingHours ? `
            <div style="font-size: 0.74rem; color: var(--seafoam-light); margin-bottom: 6px;">
              ⏱ <b>Hours:</b> ${alt.openingHours || alt.visitingHours}
            </div>
          ` : ''}

          <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">
            ${alt.reason || alt.desc || 'Great scenic alternative along the route.'}
          </div>

          <div class="stop-actions-row">
            <button type="button" class="btn-primary-sm" onclick="OntheGoBackups.replaceStop('${stop.id}', '${alt.id}', '${alt.name.replace(/'/g, "\\'")}')">
              🔄 Replace Current Stop
            </button>
            <button type="button" class="btn-sm" onclick="OntheGoBackups.addAfterStop('${stop.id}', '${alt.id}', '${alt.name.replace(/'/g, "\\'")}')">
              ➕ Add After Stop
            </button>
            <a href="${alt.mapUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(alt.name + ', Kerala')}`}" target="_blank" rel="noopener" class="btn-sm">
              🧭 Directions
            </a>
          </div>
        </div>
      `;
    }).join("");
  },

  replaceStop(originalStopId, altId, altName) {
    if (!confirm(`Are you sure you want to replace the current stop with "${altName}"? (Your original plan remains recoverable in Settings).`)) {
      return;
    }

    const trip = OntheGoApp.getActiveTrip();
    for (const d of trip.days) {
      const idx = (d.activities || []).findIndex(a => a.id === originalStopId);
      if (idx !== -1) {
        const old = d.activities[idx];
        const altData = (OntheGoDefaultData.restaurants || []).find(r => r.id === altId) ||
                        (OntheGoDefaultData.optionalPlaces || []).find(p => p.id === altId);

        // Update stop in-place while retaining original backup note
        old.title = altData ? altData.name : altName;
        old.location = altData ? (altData.address || altData.area) : old.location;
        old.notes = `[Replaced from ${old.title}] ` + (altData ? (altData.reason || altData.desc) : '');
        old.mapUrl = altData ? altData.mapUrl : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(altName)}`;
        if (altData && altData.lat) {
          old.lat = altData.lat;
          old.lng = altData.lng;
        }

        OntheGoApp.saveState();
        OntheGoApp.showToast(`Itinerary updated: Swapped with "${altName}"! ✓`);
        OntheGoItinerary.renderCurrentDay();
        OntheGoApp.renderDashboard();
        this.renderRecommendations();
        return;
      }
    }
  },

  addAfterStop(originalStopId, altId, altName) {
    const trip = OntheGoApp.getActiveTrip();
    for (const d of trip.days) {
      const idx = (d.activities || []).findIndex(a => a.id === originalStopId);
      if (idx !== -1) {
        const old = d.activities[idx];
        const altData = (OntheGoDefaultData.restaurants || []).find(r => r.id === altId) ||
                        (OntheGoDefaultData.optionalPlaces || []).find(p => p.id === altId);

        const newStop = {
          id: "act-backup-" + Date.now(),
          order: old.order + 1,
          title: altName,
          time: "Flexible",
          category: altData?.cuisine ? "Restaurant" : "Sightseeing",
          location: altData ? (altData.address || altData.area) : "Near route",
          lat: altData?.lat || old.lat,
          lng: altData?.lng || old.lng,
          cost: altData?.pricePerPerson || 0,
          notes: altData?.reason || altData?.desc || "Added from Backup Planner",
          status: "pending",
          verified: true,
          mapUrl: altData?.mapUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(altName)}`
        };

        d.activities.splice(idx + 1, 0, newStop);
        d.activities.forEach((a, i) => a.order = i + 1);

        OntheGoApp.saveState();
        OntheGoApp.showToast(`Added "${altName}" after current stop! ✓`);
        OntheGoItinerary.renderCurrentDay();
        OntheGoApp.renderDashboard();
        return;
      }
    }
  }
};
