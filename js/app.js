/**
 * OntheGO - Master App Controller
 * Orchestrates navigation tabs, dashboard widgets, online/offline status,
 * weather integration, state persistence, and modular initialization.
 */

window.OntheGoApp = {
  state: null,
  activeTab: "today",
  activeMoreSubTab: "wallet",
  STORAGE_KEY: "onthego_master_state_v2",

  init() {
    this.loadState();
    this.setupTheme();
    this.bindEvents();
    this.setupConnectivity();
    this.setupServiceWorker();

    // Initialize sub-modules
    if (window.OntheGoCollaboration) OntheGoCollaboration.init();
    OntheGoItinerary.init();
    OntheGoExpenses.init();
    OntheGoChecklist.init();
    OntheGoWallet.init();
    OntheGoRestaurants.init();
    OntheGoBackups.init();
    OntheGoTimeHelper.init();

    // Render dashboard and weather
    this.renderDashboard();
    this.fetchWeather();
  },

  loadState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (window.OntheGoMigrations && typeof OntheGoMigrations.migrate === "function") {
          this.state = OntheGoMigrations.migrate(parsed);
        } else {
          this.state = parsed;
        }
        this.saveState();
      } else {
        if (window.OntheGoMigrations && typeof OntheGoMigrations.getFreshDefaultState === "function") {
          this.state = OntheGoMigrations.getFreshDefaultState();
        } else {
          this.state = JSON.parse(JSON.stringify(window.OntheGoDefaultData));
        }
        this.saveState();
      }
    } catch (e) {
      console.warn("Error loading state from storage, resetting to default:", e);
      if (window.OntheGoMigrations && typeof OntheGoMigrations.getFreshDefaultState === "function") {
        this.state = OntheGoMigrations.getFreshDefaultState();
      } else {
        this.state = JSON.parse(JSON.stringify(window.OntheGoDefaultData));
      }
    }
  },

  saveState() {
    try {
      if (this.state && !this.state.schemaVersion) {
        this.state.schemaVersion = 5;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Error saving state to localStorage:", e);
    }
  },

  getActiveTrip() {
    if (!this.state.trips || !this.state.trips.length) {
      this.state = window.OntheGoMigrations ? OntheGoMigrations.getFreshDefaultState() : JSON.parse(JSON.stringify(window.OntheGoDefaultData));
    }
    let trip = this.state.trips.find(t => t.id === this.state.activeTripId);
    if (!trip) {
      trip = this.state.trips[0];
      this.state.activeTripId = trip.id;
    }
    return trip;
  },

  getTravellers() {
    if (!this.state.travellers || !this.state.travellers.length) {
      this.state.travellers = (window.OntheGoDefaultData && window.OntheGoDefaultData.travellers) || [];
    }
    return this.state.travellers;
  },

  getTravellerById(id) {
    return this.getTravellers().find(t => t.id === id) || { id, name: id, avatar: "👤" };
  },

  setupTheme() {
    const savedTheme = localStorage.getItem("onthego_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.updateThemeToggleIcon(savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("onthego_theme", next);
    this.updateThemeToggleIcon(next);
    this.showToast(`Switched to ${next === "light" ? "Coastal Daylight" : "Night"} theme.`);
  },

  updateThemeToggleIcon(theme) {
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.innerText = theme === "dark" ? "☀️" : "🌙";
  },

  setupConnectivity() {
    const updateStatus = () => {
      const isOnline = navigator.onLine;
      const badge = document.getElementById("headerStatusBadge");
      if (badge) {
        if (isOnline) {
          badge.className = "header-status-pill status-online";
          badge.innerHTML = "🟢 Online";
        } else {
          badge.className = "header-status-pill status-offline";
          badge.innerHTML = "🔴 Offline (Saved Data)";
        }
      }
    };

    window.addEventListener("online", () => {
      updateStatus();
      this.showToast("Connection restored! You are online. 🟢");
      this.fetchWeather();
    });

    window.addEventListener("offline", () => {
      updateStatus();
      this.showToast("No connection. OntheGO is running in offline mode. 🔴");
    });

    updateStatus();
  },

  setupServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .then(() => console.log("OntheGO PWA Service Worker Registered"))
        .catch(err => console.log("Service Worker Registration Failed:", err));
    }
  },

  bindEvents() {
    // Bottom nav handlers
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab) this.switchTab(tab);
      });
    });

    // Desktop nav handlers
    document.querySelectorAll(".desktop-nav-tab-btn").forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab) this.switchTab(tab);
      });
    });
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    // Toggle active view
    document.querySelectorAll(".tab-view").forEach(v => {
      v.classList.toggle("active", v.id === `view-${tabId}`);
    });

    // Update bottom nav active state
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
    });

    // Update desktop nav active state
    document.querySelectorAll(".desktop-nav-tab-btn").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
    });

    // If switching to map, trigger map resize
    if (tabId === "map") {
      setTimeout(() => OntheGoMap.init(), 100);
    } else if (tabId === "today") {
      this.renderDashboard();
    } else if (tabId === "itinerary") {
      OntheGoItinerary.renderCurrentDay();
    } else if (tabId === "expenses") {
      OntheGoExpenses.init();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  switchMoreSubTab(subTabId) {
    this.activeMoreSubTab = subTabId;
    document.querySelectorAll(".more-sub-view").forEach(v => {
      v.style.display = v.id === `more-sub-${subTabId}` ? "block" : "none";
    });
    document.querySelectorAll(".more-nav-pill").forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-sub") === subTabId);
    });

    if (subTabId === "backups") {
      OntheGoBackups.init();
    } else if (subTabId === "restaurants") {
      OntheGoRestaurants.init();
    } else if (subTabId === "checklist") {
      OntheGoChecklist.init();
    } else if (subTabId === "wallet") {
      OntheGoWallet.init();
    } else if (subTabId === "conflicts") {
      OntheGoTimeHelper.init();
    } else if (subTabId === "collaboration") {
      if (window.OntheGoCollaboration) OntheGoCollaboration.renderCollaborationView();
    }
  },

  renderDashboard() {
    const trip = this.getActiveTrip();
    const day = (trip.days || []).find(d => d.id === OntheGoItinerary.currentDayId) || trip.days[0];
    if (!day) return;

    // Render Hero Stats
    const totalActivities = (trip.days || []).reduce((acc, d) => acc + (d.activities?.length || 0), 0);
    const completedActivities = (trip.days || []).reduce((acc, d) => acc + (d.activities?.filter(a => a.status === 'completed').length || 0), 0);
    const dayTotal = day.activities ? day.activities.length : 0;
    const dayCompleted = day.activities ? day.activities.filter(a => a.status === 'completed').length : 0;

    const progEl = document.getElementById("dashDayProgress");
    if (progEl) {
      progEl.innerText = `${dayCompleted}/${dayTotal} Done`;
    }

    // Render Dashboard Day Selector
    const daySelectorEl = document.getElementById("dashDaySelector");
    if (daySelectorEl) {
      daySelectorEl.innerHTML = (trip.days || []).map(d => `
        <button type="button" class="day-pill ${d.id === day.id ? 'active' : ''}" onclick="OntheGoItinerary.switchDay('${d.id}')">
          <div class="day-pill-num">Day ${d.dayNumber}</div>
          <div class="day-pill-title">${d.dateHuman}</div>
        </button>
      `).join("");
    }

    // Next Incomplete Stop
    const upcomingContainer = document.getElementById("dashUpcomingStopContainer");
    const incompleteStops = (day.activities || []).filter(a => a.status !== "completed" && a.status !== "skipped");
    const nextStop = incompleteStops[0] || (day.activities ? day.activities[0] : null);

    if (upcomingContainer && nextStop) {
      upcomingContainer.innerHTML = `
        <div class="upcoming-stop-card">
          <div class="upcoming-label">Upcoming Stop • Day ${day.dayNumber}</div>
          <div class="upcoming-stop-title">${nextStop.title}</div>
          <div class="upcoming-stop-meta">
            <span>⏱ ${nextStop.time || 'Flexible'}</span>
            <span>📍 ${nextStop.location || 'Kochi'}</span>
            <span>🏷 ${nextStop.category}</span>
            ${nextStop.isFixedCommitment ? `<span style="color: var(--sunset-coral); font-weight: 800;">Fixed Commitment</span>` : ''}
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">${nextStop.notes || ''}</p>
          <div class="stop-actions-row">
            <a href="${nextStop.mapUrl || '#'}" target="_blank" rel="noopener" class="btn-nav-action">
              🧭 Navigate in Google Maps
            </a>
            ${nextStop.phone ? `<a href="tel:${nextStop.phone}" class="btn-call-action">📞 Call</a>` : ''}
            <button class="btn-sm btn-primary-sm" onclick="OntheGoItinerary.toggleComplete('${nextStop.id}', true)">
              ✓ Mark Complete
            </button>
            <button class="btn-sm" onclick="OntheGoBackups.openForStop('${nextStop.id}')">
              🔀 Alternatives
            </button>
          </div>
        </div>
      `;
    }

    // Tonight's Accommodation Widget
    const stayContainer = document.getElementById("dashStayWidgetContainer");
    if (stayContainer) {
      const stayPhone = day.nightStayPhone;
      stayContainer.innerHTML = `
        <div class="stay-widget-card">
          <div class="stay-widget-info">
            <span class="stay-widget-lbl">🏨 Tonight's Base Camp</span>
            <span class="stay-widget-name">${day.nightStayName || "Stay Base"}</span>
            <span class="stay-widget-sub">Day ${day.dayNumber} Night • ${stayPhone ? 'Ph: ' + stayPhone : 'Booking Confirmed'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            ${stayPhone ? `<a href="tel:${stayPhone}" class="btn-call-action" title="Call Host">📞 Call</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(day.nightStayName || 'Fort Kochi')}" target="_blank" rel="noopener" class="btn-nav-action">🧭 Map</a>
          </div>
        </div>
      `;
    }

    // Day Reminders & Warnings
    const warnContainer = document.getElementById("dashWarningContainer");
    if (warnContainer) {
      let alertsHtml = "";

      // Day 5 critical hard commitments & reverse schedule safeguard
      if (day.dayNumber === 5) {
        const audit = window.OntheGoTimeHelper ? OntheGoTimeHelper.calculateDay5BackwardSchedule(day.activities) : null;
        alertsHtml += `
          <div class="alert-banner ${audit && audit.status === 'infeasible' ? 'alert-danger' : (audit && audit.status === 'warning' ? 'alert-warning' : 'alert-info')}">
            <span class="alert-icon">${audit && audit.status === 'infeasible' ? '🚨' : '⏱️'}</span>
            <div>
              <b>DAY 5 BACKWARD SAFEGUARD (${audit ? audit.status.toUpperCase() : 'ACTIVE'}):</b>
              <div style="margin-top: 2px;">• <b>12:15 PM Cutoff:</b> Sightseeing in Fort Kochi must conclude (35m transit buffer).</div>
              <div>• <b>1:00 PM Target (1:30 PM Latest):</b> Scooter return, inspection & ₹2,300 balance settlement (Contact: 9003955156).</div>
              <div>• <b>2:00 PM Sharp:</b> Return Vande Bharat Express departure to Bangalore (ERS Platform 1).</div>
              ${audit && audit.flaggedActivities.length ? `
                <div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.06); border-radius: 4px; font-weight: 700; color: var(--danger);">
                  ⚠️ ${audit.flaggedActivities[0].reason}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Day 3 early-morning kayaking
      if (day.dayNumber === 3) {
        alertsHtml += `
          <div class="alert-banner alert-info">
            <span class="alert-icon">🏄</span>
            <div>
              <b>DAY 3 KAYAKING (6:00 AM – 11:30 AM):</b>
              <div>Opulence Kayaking (8921172358). Breakfast is included with the activity! Carry a waterproof phone pouch.</div>
            </div>
          </div>
          <div class="alert-banner alert-danger" style="margin-top: 6px;">
            <span class="alert-icon">⚠️</span>
            <div><b>RESPONSIBLE RIDING:</b> Never ride scooter after drinking at No. 1 Kallu Shap! Arrange sober driver.</div>
          </div>
        `;
      }

      // Day 1 Friday closure
      if (day.dayNumber === 1) {
        alertsHtml += `
          <div class="alert-banner alert-warning">
            <span class="alert-icon">⚠️</span>
            <div>
              <b>FRIDAY TIME-SENSITIVE NOTICE:</b>
              <div>Mattancherry Palace is CLOSED on Fridays. Paradesi Synagogue closes at 2:00 PM today. Explore Jew Town and waterfront instead.</div>
            </div>
          </div>
        `;
      }

      // Day 2 Lighthouse alert
      if (day.dayNumber === 2) {
        alertsHtml += `
          <div class="alert-banner alert-warning">
            <span class="alert-icon">⏱️</span>
            <div>
              <b>ALLEPPEY LIGHTHOUSE (Closes 5:30 PM):</b>
              <div>Ticket counter closes at 5:00 PM. Arrive before 4:45 PM to climb the spiral staircase!</div>
            </div>
          </div>
        `;
      }

      warnContainer.innerHTML = alertsHtml;
    }

    // Mini Expense Summary in Dashboard
    const totalSpent = (this.state.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const expWidgetEl = document.getElementById("dashExpenseWidgetVal");
    if (expWidgetEl) expWidgetEl.innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
  },

  startTodayRoute() {
    const trip = this.getActiveTrip();
    const day = (trip.days || []).find(d => d.id === OntheGoItinerary.currentDayId) || trip.days[0];
    if (!day || !day.activities || !day.activities.length) return;

    // Find next incomplete stop or first stop
    const next = day.activities.find(a => a.status !== "completed" && a.status !== "skipped") || day.activities[0];
    if (next && next.mapUrl) {
      window.open(next.mapUrl, "_blank");
    } else {
      this.switchTab("map");
    }
  },

  fetchWeather() {
    const weatherValEl = document.getElementById("dashWeatherWidgetVal");
    const weatherSubEl = document.getElementById("dashWeatherWidgetSub");
    if (!weatherValEl) return;

    // Open-Meteo free API for Kochi / Alleppey area (Lat 9.965, Lon 76.242)
    fetch("https://api.open-meteo.com/v1/forecast?latitude=9.965&longitude=76.242&current_weather=true")
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const wind = Math.round(data.current_weather.windspeed);
          weatherValEl.innerText = `${temp}°C 🌤️`;
          if (weatherSubEl) weatherSubEl.innerText = `Kochi Coast • ${wind} km/h breeze`;
        }
      })
      .catch(() => {
        // Graceful offline fallback
        weatherValEl.innerText = `29°C 🌴`;
        if (weatherSubEl) weatherSubEl.innerText = `Tropical Coastal Kerala (Cached)`;
      });
  },

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>🛵</span> <div>${message}</div>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  },

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
  },

  exportBackupJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `OntheGO_Backup_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast("Itinerary backup exported successfully! 💾");
  },

  importBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.trips) {
          this.state = window.OntheGoMigrations ? OntheGoMigrations.migrate(parsed) : parsed;
          this.saveState();
          this.closeModals();
          OntheGoItinerary.init();
          OntheGoExpenses.init();
          OntheGoChecklist.init();
          this.renderDashboard();
          this.showToast("Itinerary backup restored and migrated successfully! ✓");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Error parsing backup JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  },

  resetToDefault() {
    if (!confirm("Are you sure you want to reset all data to the default verified itinerary? Custom stops and logged expenses will be reset.")) {
      return;
    }
    this.state = window.OntheGoMigrations ? OntheGoMigrations.getFreshDefaultState() : JSON.parse(JSON.stringify(window.OntheGoDefaultData));
    this.saveState();
    this.closeModals();
    OntheGoItinerary.init();
    OntheGoExpenses.init();
    OntheGoChecklist.init();
    OntheGoWallet.init();
    OntheGoBackups.init();
    if (window.OntheGoCollaboration) OntheGoCollaboration.init();
    this.renderDashboard();
    this.showToast("OntheGO reset to default verified itinerary. 🔄");
  }
};

// Auto-initialize when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  OntheGoApp.init();
});
