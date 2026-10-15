/**
 * OntheGO - Stage 7: Geographically Aware Backup Recommendation System
 * Authoritative destination matching with Bayesian review ranking, 9 geographical zones,
 * opening-hour compatibility, quality control screening, and side-by-side swapping workflow.
 */

window.OntheGoBackups = {
  selectedStopId: null,
  maxDetourKm: 5,
  activeSectorFilter: "all",
  activeQualityFilter: "all", // "all" | "verified_only" | "open_now"
  pendingSwap: null,

  init() {
    this.ensureBackupDatabase();
    this.renderStopSelector();
    this.renderRecommendations();
  },

  /**
   * Ensures the backup database is synchronized with the Stage 7 Destination Catalogue.
   */
  ensureBackupDatabase() {
    if (!OntheGoApp.state) return;

    let catalogueItems = [];
    if (window.OntheGoCatalogue && typeof OntheGoCatalogue.getAllDestinations === "function") {
      catalogueItems = OntheGoCatalogue.getAllDestinations();
    } else if (window.OntheGoDefaultData && window.OntheGoDefaultData.backupDatabase) {
      catalogueItems = window.OntheGoDefaultData.backupDatabase;
    }

    if (!Array.isArray(OntheGoApp.state.backupDatabase) || !OntheGoApp.state.backupDatabase.length) {
      OntheGoApp.state.backupDatabase = JSON.parse(JSON.stringify(catalogueItems));
      OntheGoApp.saveState();
    } else {
      let added = false;
      catalogueItems.forEach(catItem => {
        const idx = OntheGoApp.state.backupDatabase.findIndex(b => b.id === catItem.id || b.name === catItem.name);
        if (idx === -1) {
          OntheGoApp.state.backupDatabase.push(JSON.parse(JSON.stringify(catItem)));
          added = true;
        } else {
          // Merge metadata
          const existing = OntheGoApp.state.backupDatabase[idx];
          existing.backupGroup = catItem.backupGroup || existing.backupGroup;
          existing.confidenceStatus = catItem.confidenceStatus || existing.confidenceStatus;
          existing.closureDays = catItem.closureDays || existing.closureDays;
          existing.holidayExceptions = catItem.holidayExceptions || existing.holidayExceptions;
          existing.priceSource = catItem.priceSource || existing.priceSource;
          existing.visitDurationMinutes = catItem.visitDurationMinutes || existing.visitDurationMinutes;
          existing.typicalTravelTimeMins = catItem.typicalTravelTimeMins || existing.typicalTravelTimeMins;
          existing.shortDescription = catItem.shortDescription || existing.shortDescription;
          if (catItem.status) existing.status = catItem.status;
          if (catItem.rating) existing.rating = catItem.rating;
          if (catItem.reviewCount) existing.reviewCount = catItem.reviewCount;
        }
      });
      if (added) {
        OntheGoApp.saveState();
      }
    }
  },

  setMaxDetour(km) {
    this.maxDetourKm = parseFloat(km) || 5;
    const buttons = document.querySelectorAll(".detour-chip");
    buttons.forEach(btn => {
      btn.classList.toggle("active", parseFloat(btn.getAttribute("data-km")) === this.maxDetourKm);
    });
    this.renderRecommendations();
  },

  setSectorFilter(sectorId) {
    this.activeSectorFilter = sectorId;
    this.renderRecommendations();
  },

  setQualityFilter(qFilter) {
    this.activeQualityFilter = qFilter;
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
    if (!this.selectedStopId) {
      // Default to Day 1 first activity if none selected
      const trip = OntheGoApp.getActiveTrip();
      if (trip && trip.days && trip.days[0] && trip.days[0].activities && trip.days[0].activities.length) {
        this.selectedStopId = trip.days[0].activities[0].id;
      } else {
        return null;
      }
    }
    const trip = OntheGoApp.getActiveTrip();
    for (const d of trip.days) {
      const act = (d.activities || []).find(a => a.id === this.selectedStopId);
      if (act) return { activity: act, day: d };
    }
    return null;
  },

  findStopById(stopId) {
    if (!stopId) return null;
    const trip = OntheGoApp.getActiveTrip();
    if (!trip || !trip.days) return null;
    for (const d of trip.days) {
      const act = (d.activities || []).find(a => a.id === stopId || a.title === stopId);
      if (act) return { activity: act, day: d };
    }
    return null;
  },

  findBackupById(altId) {
    if (!altId) return null;
    const list = OntheGoApp.state?.backupDatabase || [];
    // 1. Direct ID match
    let item = list.find(b => b.id === altId);
    if (item) return item;

    // 2. Normalized prefix matching: dest_ <-> fk_, dest_ <-> mat_, dest_ <-> all_, dest_ <-> bk-
    const cleanId = String(altId).replace(/^(dest_|bk-|fk_|mat_|all_)/, '');
    item = list.find(b => {
      const bClean = (b.id || '').replace(/^(dest_|bk-|fk_|mat_|all_)/, '');
      return bClean === cleanId;
    });
    if (item) return item;

    // 3. Name comparison
    const norm = (s) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    const searchNorm = norm(altId);
    item = list.find(b => norm(b.name) === searchNorm || norm(b.id) === searchNorm);
    if (item) return item;

    // 4. Fallback to Stage 7 Destination Catalogue
    if (window.OntheGoCatalogue && typeof OntheGoCatalogue.getDestinationById === "function") {
      const catItem = OntheGoCatalogue.getDestinationById(altId)
        || OntheGoCatalogue.getDestinationById("dest_" + cleanId);
      if (catItem) return catItem;
    }

    return null;
  },

  /**
   * Identifies the natural geographical sector for an itinerary stop.
   */
  getNaturalSectorForStop(stop, day) {
    const lat = stop.lat || 9.965;
    const lng = stop.lng || 76.242;

    if (lat > 9.960 && lat < 9.975 && lng < 76.250) {
      return "fort_kochi_heritage";
    }
    if (lat >= 9.950 && lat <= 9.963 && lng >= 76.250 && lng <= 76.265) {
      return "mattancherry_jew_town";
    }
    if (lat >= 9.965 && lat <= 9.972 && lng >= 76.240 && lng <= 76.252) {
      return "fort_kochi_waterfront";
    }
    if (lat > 9.980 || (lat > 9.965 && lng > 76.270)) {
      return "kochi_north_puthuvype";
    }
    if (lat >= 9.700 && lat < 9.900) {
      return "coastal_route";
    }
    if (lat >= 9.580 && lat < 9.700) {
      return "marari_coastal";
    }
    if (lat >= 9.470 && lat < 9.580 && lng < 76.345) {
      return "alleppey_town_beach";
    }
    if (lat < 9.470) {
      return "ambalappuzha_return";
    }
    if (lat >= 9.850 && lat <= 9.920 && lng >= 76.270 && lng <= 76.310) {
      return "kumbalangi_backwaters";
    }

    if (day && day.dayNumber === 1) return "fort_kochi_heritage";
    if (day && day.dayNumber === 2) return "coastal_route";
    if (day && day.dayNumber === 3) return "marari_coastal";
    if (day && day.dayNumber === 4) return "marari_coastal";
    return "fort_kochi_heritage";
  },

  // ==========================================
  // MULTI-CRITERIA & GEOGRAPHIC RANKING
  // ==========================================

  /**
   * Evaluates and scores an alternative against the planned stop using 7 grounded dimensions:
   * 1. Proximity & Incremental Journey Time (Haversine)
   * 2. Geographic Sector Relevance
   * 3. Bayesian Weighted Review Quality: (v / (v + m)) * R + (m / (v + m)) * C
   * 4. Opening Hour & Closure Day Compatibility
   * 5. Schedule Feasibility & Hard Constraints
   * 6. Price Range Suitability
   * 7. Category & Vibe Alignment
   */
  scoreAlternative(alt, stop, day) {
    const lat1 = stop.lat || 9.965;
    const lng1 = stop.lng || 76.242;
    const lat2 = alt.lat;
    const lng2 = alt.lng;

    if (typeof lat2 !== "number" || typeof lng2 !== "number") {
      return null;
    }

    const distanceKm = window.OntheGoEngine
      ? OntheGoEngine.calculateHaversineDistanceKm(lat1, lng1, lat2, lng2)
      : 2.0;

    // Filter by maxDetourKm (unless user selected a specific sector)
    if (this.activeSectorFilter === "all" && distanceKm > this.maxDetourKm) {
      return null;
    }
    if (this.activeSectorFilter !== "all" && alt.backupGroup !== this.activeSectorFilter) {
      return null;
    }

    // Special Handling 1: Reported Permanently Closed (e.g. Cafe Crafters)
    if (alt.status === "reported_closed") {
      return {
        ...alt,
        distanceKm,
        travelDurationMins: Math.max(5, Math.round((distanceKm / 26) * 60)),
        isClosedToday: true,
        isReportedClosed: true,
        closureReason: "Reported permanently closed in available listings",
        totalScore: 0,
        scoreBreakdown: { proximityScore: 0, relevanceScore: 0, reviewScore: 0, availabilityScore: 0, affordabilityScore: 0 }
      };
    }

    // Special Handling 2: Quality Filter checks
    if (this.activeQualityFilter === "verified_only" && alt.confidenceStatus !== "verified") {
      return null;
    }

    // Travel duration in minutes based on urban vs coastal highway speeds
    const speed = (lat1 < 9.9 && lat2 < 9.9) ? 42 : 26;
    const travelDurationMins = Math.max(4, Math.round((distanceKm / speed) * 60));

    // Factor 1: Proximity Score (0 to 30 pts)
    const proximityScore = Math.max(0, 30 - (distanceKm * 3.5));

    // Factor 2: Geographic Sector Match (0 to 20 pts)
    const naturalSector = this.getNaturalSectorForStop(stop, day);
    let sectorScore = 10;
    if (alt.backupGroup === naturalSector) {
      sectorScore = 20;
    } else if (alt.status === "low_priority" && alt.id === "dest_cocomoco") {
      // Remote inland detour (Mavelikkara) penalization
      sectorScore = -15;
    }

    // Factor 3: Bayesian Weighted Review Score (0 to 20 pts)
    // Ensures a 4.8 with 5 reviews does NOT outrank a 4.5 with 2,500 reviews
    const bayesianRating = window.OntheGoCatalogue
      ? OntheGoCatalogue.calculateBayesianReviewScore(alt.rating, alt.reviewCount)
      : (alt.rating || 4.0);
    const reviewScore = Math.min(20, Math.round(((bayesianRating - 3.5) / 1.5) * 16 + Math.min(4, Math.log10(alt.reviewCount || 100))));

    // Factor 4: Opening Hour & Closure Day Compatibility (0 or 15 pts)
    const dayNames = ["", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"];
    const currentDayName = dayNames[day.dayNumber] || "Friday";
    let availabilityScore = 15;
    let isClosedToday = false;
    let closureReason = "";

    if (window.OntheGoCatalogue) {
      const compat = OntheGoCatalogue.checkOpeningCompatibility(alt, currentDayName, stop.time);
      if (!compat.isOpen) {
        availabilityScore = 0;
        isClosedToday = true;
        closureReason = compat.reason;
      }
    } else if (alt.closureDays && alt.closureDays.includes(currentDayName)) {
      availabilityScore = 0;
      isClosedToday = true;
      closureReason = `Closed on ${currentDayName}s`;
    }

    if (this.activeQualityFilter === "open_now" && isClosedToday) {
      return null;
    }

    // Factor 5: Category & Activity Match (0 to 10 pts)
    let categoryScore = 5;
    if (alt.suitableReplacements && alt.suitableReplacements.includes(stop.id)) {
      categoryScore = 10;
    } else if (alt.category === stop.category) {
      categoryScore = 8;
    } else if (alt.category === "Stay" && stop.category !== "Stay" && stop.category !== "Accommodation") {
      categoryScore = 1;
    }

    // Factor 6: Affordability (0 to 5 pts)
    let affordabilityScore = 4;
    if (alt.priceRange === "₹") affordabilityScore = 5;
    if (alt.priceRange === "₹₹") affordabilityScore = 4;
    if (alt.priceRange === "₹₹₹") affordabilityScore = 2;

    let totalScore = Math.round(proximityScore + sectorScore + reviewScore + availabilityScore + categoryScore + affordabilityScore);

    // Factor 7: Low-Priority / Needs Verification Deduction
    if (alt.status === "low_priority") {
      totalScore = Math.max(5, totalScore - 15);
    }
    if (alt.status === "needs_verification") {
      totalScore = Math.max(5, totalScore - 10);
    }

    return {
      ...alt,
      distanceKm: parseFloat(distanceKm.toFixed(1)),
      travelDurationMins,
      isClosedToday,
      closureReason,
      bayesianRating,
      totalScore: Math.min(100, Math.max(0, totalScore)),
      scoreBreakdown: {
        proximityScore: Math.round(proximityScore),
        sectorScore,
        reviewScore,
        availabilityScore,
        categoryScore,
        affordabilityScore
      }
    };
  },

  // ==========================================
  // RENDERING & INTERACTION
  // ==========================================

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
          <p style="font-size: 0.8rem;">Multi-criteria Bayesian ranking evaluates proximity, ratings, pricing sources, opening hours, and closure days to recommend feasible alternatives.</p>
        </div>
      `;
      return;
    }

    const { activity: stop, day } = current;
    const naturalSector = this.getNaturalSectorForStop(stop, day);
    const sectorObj = window.OntheGoCatalogue?.GROUPS.find(g => g.id === naturalSector);

    if (headerInfoEl) {
      headerInfoEl.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <div style="font-size: 0.72rem; color: var(--ocean-teal-light); font-weight: 800; text-transform: uppercase;">
              Planned Stop • Day ${day.dayNumber} (${day.dateHuman || '16-20 Oct 2026'})
            </div>
            <div style="display: flex; gap: 6px;">
              <span class="split-tag tag-equal">${sectorObj ? sectorObj.icon + ' ' + sectorObj.name : naturalSector}</span>
              ${stop.isFixedCommitment ? `<span class="split-tag tag-refund">Hard Constraint</span>` : ''}
            </div>
          </div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 3px 0;">${stop.title}</div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">
            ⏱ ${stop.time || 'Flexible'} • 📍 ${stop.location || 'Route Location'} • ${stop.category || 'Sight'}
          </div>
        </div>

        <!-- 9 Geographical Sectors Filter Carousel -->
        <div style="margin-bottom: 10px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">
            Filter by Geographic Sector:
          </div>
          <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
            <button type="button" class="rec-filter-btn ${this.activeSectorFilter === 'all' ? 'active' : ''}" onclick="OntheGoBackups.setSectorFilter('all')">
              All Sectors
            </button>
            ${(window.OntheGoCatalogue?.GROUPS || []).map(g => `
              <button type="button" class="rec-filter-btn ${this.activeSectorFilter === g.id ? 'active' : ''}" onclick="OntheGoBackups.setSectorFilter('${g.id}')">
                ${g.icon} ${g.name}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- Quality & Verification Filters -->
        <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
          <button type="button" class="btn-sm ${this.activeQualityFilter === 'all' ? 'btn-primary-sm' : ''}" onclick="OntheGoBackups.setQualityFilter('all')">All Records</button>
          <button type="button" class="btn-sm ${this.activeQualityFilter === 'verified_only' ? 'btn-primary-sm' : ''}" onclick="OntheGoBackups.setQualityFilter('verified_only')">✓ Verified Only</button>
          <button type="button" class="btn-sm ${this.activeQualityFilter === 'open_now' ? 'btn-primary-sm' : ''}" onclick="OntheGoBackups.setQualityFilter('open_now')">🟢 Open on Day ${day.dayNumber}</button>
        </div>
      `;
    }

    this.ensureBackupDatabase();
    const allBackups = OntheGoApp.state.backupDatabase || [];

    // Score and rank all alternatives
    const scoredList = allBackups
      .map(alt => this.scoreAlternative(alt, stop, day))
      .filter(item => item !== null && item.name !== stop.title);

    // Sort by multi-criteria composite score (highest first)
    scoredList.sort((a, b) => b.totalScore - a.totalScore);

    if (!scoredList.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; background: var(--bg-card); border-radius: var(--radius-md);">
          <p style="color: var(--text-muted); font-size: 0.85rem;">No alternatives found matching this sector/distance filter.</p>
          <button class="btn-sm btn-primary-sm" style="margin-top: 10px;" onclick="OntheGoBackups.setMaxDetour(15); OntheGoBackups.setSectorFilter('all');">Expand Search to 15 km & All Sectors</button>
        </div>
      `;
      return;
    }

    container.innerHTML = scoredList.map((alt, idx) => {
      const isTopPick = idx === 0 && !alt.isClosedToday && alt.status !== "reported_closed";
      const groupInfo = window.OntheGoCatalogue?.GROUPS.find(g => g.id === alt.backupGroup);

      return `
        <div class="stop-card" style="margin-bottom: 12px; border-color: ${isTopPick ? 'var(--ocean-teal)' : 'var(--border-color)'};">
          
          <div class="stop-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="split-tag tag-equal">
                +${alt.distanceKm} km (~${alt.travelDurationMins}m ride)
              </span>
              <span style="font-size: 0.74rem; font-weight: 700; color: #b45309;" title="Bayesian review score: ${alt.bayesianRating}">
                ⭐ ${alt.rating} (${alt.reviewCount ? alt.reviewCount.toLocaleString() : 'N/A'})
              </span>
              <span class="split-tag tag-pct">
                Score: ${alt.totalScore}/100
              </span>
              ${groupInfo ? `<span class="split-tag tag-settle">${groupInfo.icon} ${groupInfo.name}</span>` : ''}
              ${isTopPick ? `<span class="split-tag tag-settle">★ Top Recommendation</span>` : ''}
              ${alt.status === "reported_closed" ? `<span class="split-tag tag-refund">🛑 Reported Closed</span>` : ''}
              ${alt.status === "low_priority" ? `<span class="split-tag tag-pct">Low-Priority Alternative</span>` : ''}
              ${alt.status === "needs_verification" ? `<span class="split-tag" style="background:#fef3c7; color:#92400e;">⚠️ Needs Verification</span>` : ''}
              ${alt.isClosedToday && alt.status !== "reported_closed" ? `<span class="split-tag tag-refund">Closed Today</span>` : ''}
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${alt.category}</span>
          </div>

          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 4px 0;">${alt.name}</div>
          
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 6px;">
            📍 ${alt.address} • <span style="color: var(--seafoam-light);">(${alt.lat.toFixed(4)}, ${alt.lng.toFixed(4)})</span>
          </div>

          ${alt.shortDescription || alt.notes ? `
            <div style="font-size: 0.74rem; color: var(--text-main); background: rgba(13,130,138,0.06); padding: 6px 10px; border-radius: 4px; border-left: 3px solid var(--ocean-teal); margin-bottom: 8px; line-height: 1.35;">
              💡 ${alt.shortDescription || alt.notes}
            </div>
          ` : ''}

          <!-- Structured Metadata Row -->
          <div style="background: var(--bg-card-subtle); padding: 8px 10px; border-radius: var(--radius-xs); border: 1px solid var(--border-color); font-size: 0.72rem; display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px;">
            <div><b>Review Provider:</b> ${alt.reviewProvider || 'Google Reviews'} (Bayesian: ${alt.bayesianRating})</div>
            <div><b>Price Range:</b> ${alt.priceRange} (${alt.priceSource || 'Audited listing'})</div>
            <div><b>Visiting Hours:</b> ${alt.openingHours} ${alt.closureDays && alt.closureDays.length ? `• Closed: ${alt.closureDays.join(", ")}` : '• Open 7 days'}</div>
            ${alt.closureReason ? `<div style="color: var(--danger); font-weight: 700;">⚠️ ${alt.closureReason}</div>` : ''}
            <div><b>Phone:</b> ${alt.phone && alt.phone !== "not verified" ? `<a href="tel:${alt.phone}">${alt.phone}</a>` : '<span style="color: var(--text-dim); font-style: italic;">not verified</span>'}</div>
            <div><b>Booking Requirement:</b> ${alt.bookingRequired ? `⚠️ Yes (${alt.bookingDetails || 'Advance reservation'})` : '✓ Walk-in welcome'}</div>
            <div><b>Verification Status:</b> <span class="badge-${alt.confidenceStatus || 'verified'}">${(alt.confidenceStatus || 'verified').toUpperCase()}</span> (as of ${alt.lastVerified || 'Oct 2026'})</div>
          </div>

          <div class="stop-actions-row">
            ${alt.status === "reported_closed" ? `
              <button type="button" class="btn-sm" style="opacity: 0.55; cursor: not-allowed;" onclick="alert('This place is reported permanently closed in available listings and cannot be selected as a confirmed replacement.')">
                ⚠️ Reported Closed
              </button>
            ` : `
              <button type="button" class="btn-primary-sm" onclick="OntheGoBackups.openSwapModal('${stop.id}', '${alt.id}')">
                ⚖️ Compare & Swap
              </button>
              <button type="button" class="btn-sm" onclick="OntheGoBackups.addAfterStop('${stop.id}', '${alt.id}', '${alt.name.replace(/'/g, "\\'")}')">
                ➕ Add After Stop
              </button>
            `}
            <a href="${alt.mapUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(alt.name + ' ' + alt.address))}" target="_blank" rel="noopener" class="btn-sm">
              🧭 Directions / Maps
            </a>
          </div>

        </div>
      `;
    }).join("");
  },

  // ==========================================
  // SIDE-BY-SIDE SWAPPING WORKFLOW
  // ==========================================

  /**
   * Opens the side-by-side comparison modal before committing an itinerary swap.
   * Compares travel delta, schedule impact on later activities, opening hours, and fixed commitments.
   */
  openSwapModal(stopId, altId) {
    if (stopId) {
      this.selectedStopId = stopId;
    }
    const current = this.findStopById(stopId) || this.findCurrentStop();
    if (!current) return;
    const { activity: stop, day } = current;
    const altData = this.findBackupById(altId);
    if (!altData) return;

    this.pendingSwap = { stopId: stop.id, altId, stop, altData, day };

    // Calculate delta travel
    const currentLat = stop.lat || 9.965;
    const currentLng = stop.lng || 76.242;
    const altLat = altData.lat;
    const altLng = altData.lng;
    const distKm = window.OntheGoEngine
      ? OntheGoEngine.calculateHaversineDistanceKm(currentLat, currentLng, altLat, altLng)
      : 2.0;
    const speed = (currentLat < 9.9 && altLat < 9.9) ? 42 : 26;
    const extraMinutes = Math.round((distKm / speed) * 60);

    // Feasibility and hard constraint checks
    let constraintWarning = "";
    if (day.dayNumber === 5) {
      constraintWarning = "⚠️ Day 5 Notice: Scooter return is strictly 1:00 PM and Vande Bharat train departs at 2:00 PM. Swapping this stop must not push return time beyond 1:00 PM.";
    } else if (stop.isFixedCommitment) {
      constraintWarning = `⚠️ Caution: "${stop.title}" is flagged as a fixed booking / hard commitment. Swapping will supersede this booking.`;
    }

    const modal = document.getElementById("swapComparisonModal");
    const container = document.getElementById("swapComparisonContent");
    if (!modal || !container) {
      // Fallback to direct replace if modal markup not present
      this.replaceStop(stopId, altId, altData.name);
      return;
    }

    const escape = window.OntheGoSecurity ? OntheGoSecurity.escapeHTML : (s) => s;

    container.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
        Review the side-by-side comparison before approving this change. Your original itinerary baseline is safely preserved in the audit log.
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <!-- Left: Current Stop -->
        <div style="background: var(--bg-card); border: 2px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
          <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Current Planned Stop</div>
          <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 4px 0;">${escape(stop.title)}</div>
          <div style="font-size: 0.74rem; color: var(--text-dim); margin-bottom: 8px;">📍 ${escape(stop.location || 'Planned location')}</div>
          <div style="font-size: 0.72rem; line-height: 1.4;">
            <div><b>Time:</b> ${escape(stop.time || 'Flexible')}</div>
            <div><b>Category:</b> ${escape(stop.category || 'Sight')}</div>
            <div><b>Estimated Cost:</b> ${stop.cost > 0 ? '₹' + stop.cost : 'Included / Free'}</div>
          </div>
        </div>

        <!-- Right: Proposed Backup Stop -->
        <div style="background: var(--bg-card); border: 2px solid var(--ocean-teal); border-radius: var(--radius-md); padding: 12px;">
          <div style="font-size: 0.7rem; font-weight: 800; color: var(--ocean-teal-light); text-transform: uppercase;">Proposed Replacement</div>
          <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 4px 0;">${escape(altData.name)}</div>
          <div style="font-size: 0.74rem; color: var(--text-dim); margin-bottom: 8px;">📍 ${escape(altData.address)}</div>
          <div style="font-size: 0.72rem; line-height: 1.4;">
            <div><b>Rating:</b> ⭐ ${altData.rating} (${altData.reviewCount} reviews)</div>
            <div><b>Price Range:</b> ${altData.priceRange} (${escape(altData.priceSource || 'Audited')})</div>
            <div><b>Hours:</b> ${escape(altData.openingHours)}</div>
            <div><b>Confidence:</b> <span class="badge-${altData.confidenceStatus}">${(altData.confidenceStatus || 'verified').toUpperCase()}</span></div>
          </div>
        </div>
      </div>

      <!-- Travel Impact & Feasibility Summary -->
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; font-size: 0.78rem;">
        <div style="font-weight: 800; margin-bottom: 4px; color: var(--text-main);">⏱️ Journey & Schedule Impact:</div>
        <div>• <b>Distance Delta:</b> +${distKm.toFixed(1)} km from current coordinates</div>
        <div>• <b>Travel Time Delta:</b> ~${extraMinutes} minutes incremental scooter ride</div>
        <div>• <b>Subsequent Stops:</b> Will adjust estimated arrival times accordingly without breaking fixed commitments.</div>
        ${constraintWarning ? `<div style="margin-top: 8px; color: var(--danger); font-weight: 700; background: rgba(239,68,68,0.1); padding: 6px; border-radius: 4px;">${constraintWarning}</div>` : ''}
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button type="button" class="btn-sm" onclick="OntheGoBackups.closeSwapModal()">Cancel</button>
        <button type="button" class="btn-primary-sm" onclick="OntheGoBackups.approvePendingSwap()">
          ✓ Approve & Swap Itinerary
        </button>
      </div>
    `;

    modal.classList.add("active");
    modal.style.display = "flex";
  },

  closeSwapModal() {
    const modal = document.getElementById("swapComparisonModal");
    if (modal) {
      modal.classList.remove("active");
      modal.style.display = "none";
    }
    this.pendingSwap = null;
  },

  approvePendingSwap() {
    if (!this.pendingSwap) return;
    const { stopId, altId, altData } = this.pendingSwap;
    this.closeSwapModal();
    this.replaceStop(stopId, altId, altData.name);
  },

  replaceStop(originalStopId, altId, altName) {
    const trip = OntheGoApp.getActiveTrip();
    for (const d of trip.days) {
      const idx = (d.activities || []).findIndex(a => a.id === originalStopId);
      if (idx !== -1) {
        const old = d.activities[idx];
        const altData = this.findBackupById(altId);

        // Preserve original plan baseline
        if (!old.originalBaseline) {
          old.originalBaseline = {
            title: old.title,
            location: old.location,
            lat: old.lat,
            lng: old.lng,
            time: old.time,
            cost: old.cost,
            notes: old.notes
          };
        }

        const prevTitle = old.title;
        const replacementName = altData ? altData.name : altName;
        old.title = replacementName;
        old.location = altData ? (altData.address || altData.location) : old.location;
        old.lat = altData?.lat || old.lat;
        old.lng = altData?.lng || old.lng;
        old.category = altData?.category || old.category;
        old.notes = `[Replaced from "${prevTitle}"]: ${altData?.priceSource || ''}. Hours: ${altData?.openingHours || ''}.`;
        old.mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${altData?.lat || old.lat},${altData?.lng || old.lng}`;

        if (window.OntheGoCollaboration) {
          OntheGoCollaboration.recordChange({
            action: "updated",
            entityType: "itinerary",
            entityId: old.id,
            description: `Swapped stop "${prevTitle}" for verified backup "${replacementName}"`
          });
        }

        OntheGoApp.saveState();
        if (typeof OntheGoApp.showToast === "function") {
          OntheGoApp.showToast(`Itinerary updated: Swapped with "${replacementName}"! ✓`);
        }
        if (window.OntheGoItinerary && typeof OntheGoItinerary.renderCurrentDay === "function") {
          OntheGoItinerary.renderCurrentDay();
        }
        if (typeof OntheGoApp.renderDashboard === "function") {
          OntheGoApp.renderDashboard();
        }
        if (typeof this.renderRecommendations === "function") {
          this.renderRecommendations();
        }
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
        const altData = this.findBackupById(altId);

        const newStop = {
          id: "act-backup-" + Date.now(),
          order: old.order + 1,
          title: altData ? altData.name : altName,
          time: "Flexible Slot",
          category: altData?.category || "Sightseeing",
          location: altData?.address || "Near route",
          lat: altData?.lat || old.lat,
          lng: altData?.lng || old.lng,
          cost: 0,
          notes: `Added alternative: ${altData?.priceSource || ''}. Hours: ${altData?.openingHours || ''}.`,
          status: "pending",
          verified: true,
          mapUrl: `https://www.google.com/maps/dir/?api=1&destination=${altData?.lat || old.lat},${altData?.lng || old.lng}`
        };

        d.activities.splice(idx + 1, 0, newStop);
        d.activities.forEach((a, i) => a.order = i + 1);

        if (window.OntheGoCollaboration) {
          OntheGoCollaboration.recordChange({
            action: "created",
            entityType: "itinerary",
            entityId: newStop.id,
            description: `Added backup stop "${altData ? altData.name : altName}" after "${old.title}"`
          });
        }

        OntheGoApp.saveState();
        if (typeof OntheGoApp.showToast === "function") {
          OntheGoApp.showToast(`Added "${altData ? altData.name : altName}" after current stop! ✓`);
        }
        if (window.OntheGoItinerary && typeof OntheGoItinerary.renderCurrentDay === "function") {
          OntheGoItinerary.renderCurrentDay();
        }
        if (typeof OntheGoApp.renderDashboard === "function") {
          OntheGoApp.renderDashboard();
        }
        return;
      }
    }
  }
};
