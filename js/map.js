/**
 * OntheGO - Interactive Map & Route Planner Module
 * Leaflet & OpenStreetMap / CartoDB integration with custom pins,
 * multi-stop day routes, coastal highway highlight, Stage 7 nearby backups, and offline fallback.
 */

window.OntheGoMap = {
  map: null,
  markersLayer: null,
  routePolyline: null,
  coastalPolyline: null,
  activeDayFilter: "day-1",
  activeCategoryFilter: "all",
  showBackupsOnMap: false,
  isInitialized: false,
  DEFAULT_CARTO_KEY: "cb1_4itb_1_cf9e5a75cd3fbf7109538e38",
  CARTO_API_KEY: (typeof window !== "undefined" && (window.CARTO_API_KEY || (window.localStorage && localStorage.getItem("carto_api_key")) || (window.ENV && window.ENV.CARTO_API_KEY))) || "cb1_4itb_1_cf9e5a75cd3fbf7109538e38",

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

  getApiKey() {
    return this.CARTO_API_KEY || (typeof window !== "undefined" && window.localStorage && localStorage.getItem("carto_api_key")) || this.DEFAULT_CARTO_KEY;
  },

  setApiKey(key) {
    this.CARTO_API_KEY = key || this.DEFAULT_CARTO_KEY;
    if (typeof window !== "undefined" && window.localStorage) {
      if (key) {
        localStorage.setItem("carto_api_key", key);
      } else {
        localStorage.removeItem("carto_api_key");
      }
    }
    this.updateTileLayer();
  },

  updateTileLayer() {
    if (!this.map || typeof L === "undefined") return;
    const key = this.getApiKey();
    // CARTO basemaps require ?key= parameter (not ?api_key=)
    const cartoTileUrl = key
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    if (this.currentTileLayer) {
      try { this.map.removeLayer(this.currentTileLayer); } catch (_) {}
    }

    this.currentTileLayer = L.tileLayer(cartoTileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(this.map);

    // If Carto tiles error out (e.g. invalid key or network restrictions), automatically fall back to OSM
    if (key) {
      let errCount = 0;
      this.currentTileLayer.on("tileerror", () => {
        errCount++;
        if (errCount >= 3 && this.currentTileLayer && !this._osmFallbackActive) {
          this._osmFallbackActive = true;
          console.warn("Carto tile errors encountered; falling back to OpenStreetMap tiles.");
          try { this.map.removeLayer(this.currentTileLayer); } catch (_) {}
          this.currentTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(this.map);
        }
      });
    }
  },

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

      this.updateTileLayer();

      this.markersLayer = L.layerGroup().addTo(this.map);
      this.isInitialized = true;

      this.renderDayRouteMap();
      this.renderDayFilterButtons();

      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 150);
    } catch (e) {
      console.warn("Leaflet map initialization failed, loading offline fallback:", e);
      this.renderOfflineFallback();
    }
  },

  toggleBackupsOnMap() {
    this.showBackupsOnMap = !this.showBackupsOnMap;
    const btn = document.getElementById("mapToggleBackupsBtn");
    if (btn) {
      btn.classList.toggle("active", this.showBackupsOnMap);
      btn.style.background = this.showBackupsOnMap ? "var(--kerala-terracotta)" : "";
      btn.style.color = this.showBackupsOnMap ? "#ffffff" : "";
    }
    this.renderDayRouteMap();
    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast(this.showBackupsOnMap ? "Showing nearby verified backups on map 🔀" : "Hidden backup candidates from map");
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
      const escape = window.OntheGoSecurity ? OntheGoSecurity.escapeHTML : (x) => x;
      const popupHtml = `
        <div style="min-width: 220px; font-family: inherit; padding: 4px;">
          <div style="font-size: 0.72rem; color: #0d9488; font-weight: 800;">DAY ${stop.dayNum || 1} • #${stop.order || idx + 1} (${escape(stop.category || 'Stop')})</div>
          <div style="font-size: 0.95rem; font-weight: 800; margin: 3px 0; color: #0f172a;">${escape(stop.title)}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">⏱ ${escape(stop.time || 'Flexible')} • 💰 ${stop.cost > 0 ? '₹' + stop.cost : 'Free/Prepaid'}</div>
          <p style="font-size: 0.76rem; line-height: 1.35; color: #334155; margin-bottom: 8px;">${escape(stop.notes || '')}</p>
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

    // ==========================================
    // STAGE 7: GEOGRAPHICALLY AWARE BACKUP MARKERS
    // ==========================================
    if (this.showBackupsOnMap && window.OntheGoCatalogue) {
      const allDestinations = OntheGoCatalogue.getAllDestinations();
      const plannedTitles = new Set(stopsToRender.map(s => s.title.toLowerCase()));

      allDestinations.forEach(b => {
        if (!b.lat || !b.lng || plannedTitles.has(b.name.toLowerCase())) return;

        // Find nearest planned stop on the active day
        let closestDist = Infinity;
        let closestStop = null;
        stopsToRender.forEach(s => {
          if (!s.lat || !s.lng) return;
          const d = window.OntheGoEngine
            ? OntheGoEngine.calculateHaversineDistanceKm(s.lat, s.lng, b.lat, b.lng)
            : 5;
          if (d < closestDist) {
            closestDist = d;
            closestStop = s;
          }
        });

        // Only render if reasonably nearby (within 8 km of a planned stop)
        if (closestDist > 8.0) return;

        const groupObj = OntheGoCatalogue.GROUPS.find(g => g.id === b.backupGroup);
        const pin = L.marker([b.lat, b.lng], {
          icon: L.divIcon({
            className: "custom-map-icon",
            html: `<div class="custom-marker-pin pin-backup"><span>🔀</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -26]
          })
        });

        const escape = window.OntheGoSecurity ? OntheGoSecurity.escapeHTML : (x) => x;
        const navUrl = b.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + ' ' + b.address)}`;
        const popupHtml = `
          <div style="min-width: 240px; font-family: inherit; padding: 4px;">
            <div style="font-size: 0.72rem; color: #ea580c; font-weight: 800;">
              🔀 BACKUP CANDIDATE • ${escape(groupObj?.name || b.backupGroup)}
            </div>
            <div style="font-size: 0.96rem; font-weight: 800; margin: 3px 0; color: #0f172a;">${escape(b.name)}</div>
            <div style="font-size: 0.74rem; color: #b45309; margin-bottom: 4px;">
              ⭐ ${b.rating} (${b.reviewCount ? b.reviewCount.toLocaleString() : 'N/A'} reviews) • 💰 ${escape(b.priceRange)}
            </div>
            <div style="font-size: 0.72rem; color: #334155; margin-bottom: 6px; line-height: 1.35;">
              <b>Why Recommended:</b> ${escape(b.shortDescription || b.notes || 'Nearby alternative')}
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 6px;">
              ⏱ <b>Travel Impact:</b> +${closestDist.toFixed(1)} km from ${escape(closestStop?.title || 'planned stop')}
              ${b.phone && b.phone !== 'not verified' ? `<br>📞 <a href="tel:${escape(b.phone)}">${escape(b.phone)}</a>` : ''}
              <br><b>Verification:</b> <span class="badge-${b.confidenceStatus}">${(b.confidenceStatus || 'verified').toUpperCase()}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <a href="${navUrl}" target="_blank" rel="noopener" style="flex: 1; text-align: center; background: #4285F4; color: white; padding: 6px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-decoration: none;">
                🧭 Directions
              </a>
              ${closestStop ? `
                <button type="button" onclick="OntheGoBackups.openSwapModal('${closestStop.id}', '${b.id}')" style="flex: 1; text-align: center; background: #0d828a; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer;">
                  ⚖️ Compare & Swap
                </button>
              ` : ''}
            </div>
          </div>
        `;

        pin.bindPopup(popupHtml);
        this.markersLayer.addLayer(pin);
      });
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
    const day = (trip.days || []).find(d => d.id === this.activeDayFilter) || trip.days[0];
    if (!day) return;

    container.innerHTML = `
      <div style="padding: 16px; background: var(--bg-card); height: 100%; overflow-y: auto;">
        <div class="alert-banner alert-warning" style="margin-bottom: 12px;">
          <span class="alert-icon">⚠️</span>
          <div>
            <b>MAP PROVIDER OFFLINE LIMITATION:</b>
            <div style="font-size: 0.76rem; margin-top: 2px; line-height: 1.35;">
              The map provider (Leaflet / OpenStreetMap / CartoDB) does not support caching dynamic vector tiles or turn-by-turn navigation without active mobile data. OntheGO caches exact waypoint coordinates, verified physical addresses, and pre-saved navigation links below for offline road-trip navigation.
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0; color: var(--text-main);">Day ${day.dayNumber} Offline Route Manifest:</h4>
          <span class="route-meta-badge">${day.activities?.length || 0} Waypoints</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(day.activities || []).map(a => `
            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span class="stop-time-badge" style="font-size: 0.7rem;">⏱ ${a.time || 'Flexible'}</span>
                  <span class="stop-cat-badge cat-${(a.category || 'Sightseeing').toLowerCase()}" style="font-size: 0.68rem;">${a.category}</span>
                  ${a.isFixedCommitment ? `<span style="font-size: 0.66rem; font-weight: 800; color: var(--sunset-coral); background: rgba(249,115,22,0.15); padding: 1px 5px; border-radius: 4px;">Fixed</span>` : ''}
                  <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main); margin-top: 4px;">${a.title}</div>
                  <div style="font-size: 0.76rem; color: var(--ocean-teal-light); margin-top: 2px;">📍 ${a.address || a.location || 'Kochi Coast'}</div>
                  ${a.lat && a.lng ? `<div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">🌐 GPS: ${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</div>` : ''}
                  ${a.phone ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">📞 <a href="tel:${a.phone.replace(/\\s+/g, '')}">${a.phone}</a></div>` : ''}
                </div>
                <div style="flex-shrink: 0; margin-left: 10px;">
                  <a href="${a.mapUrl || '#'}" target="_blank" class="btn-sm btn-primary-sm" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem;">
                    🧭 Open Saved Link
                  </a>
                </div>
              </div>
              ${a.notes ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 4px;">💡 ${a.notes}</div>` : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
};
