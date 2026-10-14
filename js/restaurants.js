/**
 * OntheGO - Searchable Restaurant Directory Module
 * Comprehensive verified directory for Kochi, Fort Kochi, Mattancherry & Alleppey.
 */

window.OntheGoRestaurants = {
  regionFilter: "all",
  mealFilter: "all",
  vegFilter: "all",
  searchQuery: "",
  sortBy: "rating",

  init() {
    this.renderFilters();
    this.renderDirectory();
  },

  renderFilters() {
    // Event listeners can be attached if needed
  },

  setRegion(region) {
    this.regionFilter = region;
    this.updateActiveFilterUI();
    this.renderDirectory();
  },

  setMeal(meal) {
    this.mealFilter = meal;
    this.updateActiveFilterUI();
    this.renderDirectory();
  },

  setVeg(veg) {
    this.vegFilter = veg;
    this.updateActiveFilterUI();
    this.renderDirectory();
  },

  setSearch(query) {
    this.searchQuery = (query || "").toLowerCase().trim();
    this.renderDirectory();
  },

  setSort(sort) {
    this.sortBy = sort;
    this.renderDirectory();
  },

  updateActiveFilterUI() {
    document.querySelectorAll(".rest-region-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === this.regionFilter);
    });
    document.querySelectorAll(".rest-meal-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === this.mealFilter);
    });
  },

  renderDirectory() {
    const container = document.getElementById("restaurantListContainer");
    const countBadge = document.getElementById("restaurantCountBadge");
    if (!container) return;

    const all = OntheGoDefaultData.restaurants || [];

    let filtered = all.filter(r => {
      // Region
      if (this.regionFilter !== "all" && r.region.toLowerCase() !== this.regionFilter.toLowerCase()) {
        return false;
      }
      // Meal
      if (this.mealFilter !== "all") {
        if (!r.bestUseCase || !r.bestUseCase.toLowerCase().includes(this.mealFilter.toLowerCase())) {
          return false;
        }
      }
      // Veg
      if (this.vegFilter === "veg") {
        if (!r.vegSuitability || !r.vegSuitability.toLowerCase().includes("veg")) return false;
      }
      // Search
      if (this.searchQuery) {
        const hay = `${r.name} ${r.area} ${r.cuisine} ${r.speciality}`.toLowerCase();
        if (!hay.includes(this.searchQuery)) return false;
      }
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (this.sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (this.sortBy === "price") return (a.pricePerPerson || 0) - (b.pricePerPerson || 0);
      if (this.sortBy === "reviews") return (b.reviewCount || 0) - (a.reviewCount || 0);
      return a.name.localeCompare(b.name);
    });

    if (countBadge) countBadge.innerText = `${filtered.length} Places`;

    if (!filtered.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: var(--bg-card); border-radius: var(--radius-md);">
          <p style="color: var(--text-muted); font-size: 0.88rem;">No restaurants match your filters.</p>
          <button class="btn-sm btn-primary-sm" style="margin-top: 10px;" onclick="OntheGoRestaurants.setRegion('all'); OntheGoRestaurants.setMeal('all');">Reset Filters</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(r => {
      const isPrimary = r.status === "Primary Choice";

      return `
        <div class="stop-card" style="margin-bottom: 12px; border-left: 4px solid ${isPrimary ? 'var(--sunset-coral)' : 'var(--ocean-teal)'};">
          <div class="stop-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; font-weight: 800; background: ${isPrimary ? 'rgba(249,115,22,0.15)' : 'rgba(13,148,136,0.15)'}; color: ${isPrimary ? 'var(--sunset-coral)' : 'var(--ocean-teal-light)'}; padding: 2px 7px; border-radius: 4px;">
                ${r.status}
              </span>
              <span style="font-size: 0.72rem; font-weight: 700; color: #fbbf24;">⭐ ${r.rating} (${r.reviewCount.toLocaleString('en-IN')}+ reviews)</span>
            </div>
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted);">${r.area}, ${r.region}</span>
          </div>

          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 4px 0;">${r.name}</div>
          
          <div style="font-size: 0.76rem; color: var(--ocean-teal-light); font-weight: 600; margin-bottom: 4px;">
            🍱 ${r.cuisine}
          </div>

          <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
            <b>Must-Eat:</b> ${r.speciality}
          </div>

          <div style="font-size: 0.74rem; color: var(--text-dim); margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 10px;">
            <span>💰 ${r.priceCategory}</span>
            <span>⏱ ${r.openingHours}</span>
            <span>🥗 ${r.vegSuitability}</span>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">
            ${r.reason}
          </p>

          <div class="stop-actions-row">
            <a href="${r.mapUrl}" target="_blank" rel="noopener" class="btn-nav-action">
              🧭 Directions
            </a>

            ${r.phone ? `
              <a href="tel:${r.phone}" class="btn-call-action">
                📞 Call
              </a>
            ` : ''}

            <button type="button" class="btn-sm" onclick="OntheGoRestaurants.quickAddToDay('${r.id}')">
              ➕ Add to Itinerary
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  quickAddToDay(restaurantId) {
    const r = (OntheGoDefaultData.restaurants || []).find(item => item.id === restaurantId);
    if (!r) return;

    const trip = OntheGoApp.getActiveTrip();
    const day = trip.days.find(d => d.id === OntheGoItinerary.currentDayId) || trip.days[0];

    const newStop = {
      id: "act-rest-" + Date.now(),
      order: (day.activities?.length || 0) + 1,
      title: `${r.name} (${r.cuisine})`,
      time: "Meal Break",
      category: "Restaurant",
      location: r.address || `${r.area}, ${r.region}`,
      lat: r.lat,
      lng: r.lng,
      cost: r.pricePerPerson || 300,
      notes: r.speciality ? `Must-eat: ${r.speciality}. ${r.reason}` : r.reason,
      status: "pending",
      verified: true,
      mapUrl: r.mapUrl
    };

    day.activities = day.activities || [];
    day.activities.push(newStop);

    OntheGoApp.saveState();
    OntheGoApp.showToast(`Added "${r.name}" to Day ${day.dayNumber}! ✓`);
    OntheGoItinerary.renderCurrentDay();
    OntheGoApp.renderDashboard();
  }
};
