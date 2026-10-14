/**
 * OntheGO - Interactive Map & Route Planner Module
 * Leaflet & OpenStreetMap / CartoDB integration with custom pins,
 * multi-stop day routes, coastal highway highlight, and offline fallback.
 */

window.OntheGoMap = {
  map: null,
  markersLayer: null,
  routePolyline: null,
  coastalPolyline: null,
  activeDayFilter: "day-1",
  activeCategoryFilter: "all",
  isInitialized: false,

  // Scenic Chellanam - Andhakaranazhi - Mararikulam coastal highway coordinates
  COASTAL_HIGHWAY_WAYPOINTS: [
    [9.8780, 76.2620], // Puthenthodu Beach / Chellanam
    [9.8250, 76.2710], // Chellanam fishing harbour
    [9.7490, 76.2890], // Andhakaranazhi Beach & Lighthouse
    [9.6850, 76.2920], // Ottamassery beach stretch
    [9.6580, 76.2950], // Arthunkal coastal stretch
    [9.5995, 76.2980], // Marari Beach
    [9.5310, 76.3210]  // Thumpoly / Alleppey North
  ],

  init() {
    const container = document.getElementById("leafletMapContainer");
    if (!container) return;

    if (this.isInitialized && this.map) {
      setTimeout(() => this.map.invalidateSize(), 200);
      return;
    }

    try {
      if (typeof L === "undefined") {
        this.renderOfflineFallback();
        return;
      }

      this.map = L.map("leafletMapContainer", {
        zoomControl: true,
        attributionControl: false
      }).setView([9.9650, 76.2470], 13);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd"
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
      this.isInitialized = true;

      this.renderDayRouteMap();
      this.renderDayFilterButtons();
    } catch (e) {
      console.warn("Leaflet map initialization failed, loading offline fallback:", e);
      this.renderOfflineFallback();
    }
  },

  renderDayFilterButtons() {
    const filterContainer = document.getElementById("mapDayFilters");
    if (!filterContainer) return;

    const trip = OntheGoApp.getActiveTrip();
    const days = trip.days || [];

    filterContainer.innerHTML = `
      <button class="rec-filter-btn ${this.activeDayFilter === 'all' ? 'active' : ''}" onclick="OntheGoMap.setDayFilter('all')">All Days</button>
      ${days.map(d => `
        <button class="rec-filter-btn ${this.activeDayFilter === d.id ? 'active' : ''}" onclick="OntheGoMap.setDayFilter('${d.id}')">Day ${d.dayNumber}</button>
      `).join("")}
    `;
  },

  setDayFilter(dayId) {
    this.activeDayFilter = dayId;
    this.renderDayFilterButtons();
    this.renderDayRouteMap();
  },

  setCategoryFilter(category) {
    this.activeCategoryFilter = category;
    const buttons = document.querySelectorAll("#mapCatFilters .rec-filter-btn");
    buttons.forEach(btn => {
      if (btn.getAttribute("data-cat") === category) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    this.renderDayRouteMap();
  },

  onDayChanged(dayId) {
    this.activeDayFilter = dayId;
    this.renderDayFilterButtons();
    if (this.isInitialized && this.map) {
      this.renderDayRouteMap();
    }
  },

  createPinIcon(order, category) {
    let catClass = "pin-sight";
    const cat = (category || "").toLowerCase();
    if (cat.includes("restaurant") || cat.includes("meal") || cat.includes("food")) catClass = "pin-food";
    else if (cat.includes("stay") || cat.includes("accommodation")) catClass = "pin-stay";
    else if (cat.includes("heritage") || cat.includes("museum") || cat.includes("temple")) catClass = "pin-heritage";
    else if (cat.includes("beach")) catClass = "pin-sight";
    else if (cat.includes("activity") || cat.includes("kayak")) catClass = "pin-activity";
    else if (cat.includes("transport") || cat.includes("train") || cat.includes("metro")) catClass = "pin-transit";
    else if (cat.includes("backup")) catClass = "pin-backup";

    return L.divIcon({
      className: "custom-map-icon",
      html: `<div class="custom-marker-pin ${catClass}"><span>${order || '•'}</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28]
    });
  },

  renderDayRouteMap() {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.coastalPolyline) {
      this.map.removeLayer(this.coastalPolyline);
      this.coastalPolyline = null;
    }

    const trip = OntheGoApp.getActiveTrip();
    let stopsToRender = [];

    if (this.activeDayFilter === "all") {
      trip.days.forEach(d => {
        (d.activities || []).forEach(a => stopsToRender.push({ ...a, dayNum: d.dayNumber }));
      });
    } else {
      const day = trip.days.find(d => d.id === this.activeDayFilter) || trip.days[0];
      if (day) {
        (day.activities || []).forEach(a => stopsToRender.push({ ...a, dayNum: day.dayNumber }));
      }
    }

    // Apply category filter
    if (this.activeCategoryFilter !== "all") {
      stopsToRender = stopsToRender.filter(s => {
        return (s.category || "").toLowerCase().includes(this.activeCategoryFilter.toLowerCase());
      });
    }

    const routeCoords = [];

    stopsToRender.forEach((stop, idx) => {
      if (!stop.lat || !stop.lng) return;
      routeCoords.push([stop.lat, stop.lng]);

      const pin = L.marker([stop.lat, stop.lng], {
        icon: this.createPinIcon(stop.order || idx + 1, stop.category)
      });

      const navUrl = stop.mapUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.title + ', Kochi')}`;
      const popupHtml = `
        <div style="min-width: 220px; font-family: inherit; padding: 4px;">
          <div style="font-size: 0.72rem; color: #0d9488; font-weight: 800;">DAY ${stop.dayNum || 1} • #${stop.order || idx + 1} (${stop.category || 'Stop'})</div>
          <div style="font-size: 0.95rem; font-weight: 800; margin: 3px 0; color: #0f172a;">${stop.title}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">⏱ ${stop.time || 'Flexible'} • 💰 ${stop.cost > 0 ? '₹' + stop.cost : 'Free/Prepaid'}</div>
          <p style="font-size: 0.76rem; line-height: 1.35; color: #334155; margin-bottom: 8px;">${stop.notes || ''}</p>
          <a href="${navUrl}" target="_blank" rel="noopener" style="display: block; text-align: center; background: #4285F4; color: white; padding: 8px 10px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; text-decoration: none;">
            🧭 Google Maps Directions
          </a>
        </div>
      `;

      pin.bindPopup(popupHtml);
      this.markersLayer.addLayer(pin);
    });

    // Draw ordered route polyline
    if (routeCoords.length > 1) {
      this.routePolyline = L.polyline(routeCoords, {
        color: "#0d9488",
        weight: 4,
        opacity: 0.75,
        dashArray: "6, 8"
      }).addTo(this.map);

      this.map.fitBounds(this.routePolyline.getBounds(), { padding: [35, 35] });
    } else if (routeCoords.length === 1) {
      this.map.setView(routeCoords[0], 14);
    }

    // Always highlight the Chellanam - Mararikulam coastal highway if Day 2, Day 4, or All days
    if (this.activeDayFilter === "day-2" || this.activeDayFilter === "day-4" || this.activeDayFilter === "all") {
      this.coastalPolyline = L.polyline(this.COASTAL_HIGHWAY_WAYPOINTS, {
        color: "#f97316",
        weight: 5,
        opacity: 0.85
      }).addTo(this.map);

      this.coastalPolyline.bindPopup(`
        <div style="padding: 4px;">
          <b style="color: #ea580c;">🌊 Chellanam–Andhakaranazhi–Mararikulam Coastal Highway</b><br>
          <span style="font-size: 0.75rem; color: #64748b;">Scenic coastal scooter route hugging the Arabian Sea and coconut groves.</span>
        </div>
      `);
    }

    // Update Day Google Maps Full Route Link button
    this.updateGoogleMapsFullRouteBtn(stopsToRender);
  },

  updateGoogleMapsFullRouteBtn(stops) {
    const btn = document.getElementById("openFullRouteGoogleBtn");
    if (!btn) return;

    const validStops = (stops || []).filter(s => s.lat && s.lng);
    if (validStops.length < 2) {
      btn.style.display = "none";
      return;
    }

    btn.style.display = "inline-flex";
    const origin = `${validStops[0].lat},${validStops[0].lng}`;
    const destination = `${validStops[validStops.length - 1].lat},${validStops[validStops.length - 1].lng}`;
    const waypoints = validStops.slice(1, -1).slice(0, 8).map(s => `${s.lat},${s.lng}`).join("|");

    let fullGMapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      fullGMapUrl += `&waypoints=${waypoints}`;
    }

    btn.onclick = () => window.open(fullGMapUrl, "_blank");
  },

  renderOfflineFallback() {
    const container = document.getElementById("leafletMapContainer");
    if (!container) return;

    const trip = OntheGoApp.getActiveTrip();
    const day = trip.days.find(d => d.id === this.activeDayFilter) || trip.days[0];

    container.innerHTML = `
      <div style="padding: 20px; background: var(--bg-card); height: 100%; overflow-y: auto;">
        <div class="alert-banner alert-info" style="margin-bottom: 12px;">
          <span class="alert-icon">🗺️</span>
          <div><b>Offline / Saved Stop List:</b> Live map tiles require internet. Here are your saved itinerary stops with one-tap Google Maps coordinates.</div>
        </div>
        <h4 style="margin-bottom: 8px;">Day ${day.dayNumber} Route Stops:</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(day.activities || []).map(a => `
            <div style="background: var(--bg-input); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">${a.title}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">${a.time} • ${a.location || 'Kochi'}</div>
              </div>
              <a href="${a.mapUrl || '#'}" target="_blank" class="btn-sm btn-primary-sm" style="flex-shrink: 0;">🧭 Navigate</a>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
};
