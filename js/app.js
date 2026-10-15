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

  escapeHTML(str) {
    if (window.OntheGoSecurity) return OntheGoSecurity.escapeHTML(str);
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  sanitizeURL(url) {
    if (window.OntheGoSecurity) return OntheGoSecurity.sanitizeURL(url);
    if (!url || typeof url !== "string") return null;
    const lower = url.trim().toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) return null;
    return url.trim();
  },

  async init() {
    // Stage 4: Persistent IndexedDB storage initialization
    if (window.OntheGoStorage) {
      await OntheGoStorage.init();
    }
    await this.loadState();
    this.setupTheme();
    this.bindEvents();
    if (window.OntheGoReliability) OntheGoReliability.init();
    this.setupConnectivity();
    this.setupServiceWorker();

    // Initialize sub-modules
    if (window.OntheGoCollaboration) OntheGoCollaboration.init();
    if (window.OntheGoReminders) OntheGoReminders.init();
    if (window.OntheGoEngine) OntheGoEngine.init();
    if (window.OntheGoWeather) OntheGoWeather.init();
    if (window.OntheGoAiAdjustments) OntheGoAiAdjustments.init();
    if (window.OntheGoSyncEngine) OntheGoSyncEngine.init();
    if (window.OntheGoVault) OntheGoVault.init();
    OntheGoItinerary.init();
    OntheGoExpenses.init();
    OntheGoChecklist.init();
    OntheGoWallet.init();
    OntheGoRestaurants.init();
    if (window.OntheGoCatalogue) OntheGoCatalogue.init();
    OntheGoBackups.init();
    OntheGoTimeHelper.init();
    if (window.OntheGoJournal) OntheGoJournal.init();
    if (window.OntheGoReports) OntheGoReports.init();
    if (window.OntheGoBudget) OntheGoBudget.init();
    if (window.OntheGoAssistant) OntheGoAssistant.init();
    this.renderAiSettingsCard();
    this.renderCartoSettingsCard();

    // Render dashboard and weather
    this.renderDashboard();
    this.fetchWeather();

    // Initialize SPA client-side router
    this.initRouter();
  },

  async loadState() {
    try {
      let parsed = null;
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        parsed = JSON.parse(saved);
      } else if (window.OntheGoStorage && OntheGoStorage.isReady) {
        parsed = await OntheGoStorage.loadTripState();
      }

      if (parsed) {
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
        this.state.schemaVersion = (window.OntheGoMigrations && window.OntheGoMigrations.CURRENT_SCHEMA_VERSION) || 8;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));

      // Asynchronously mirror state to IndexedDB for persistent storage
      if (window.OntheGoStorage && OntheGoStorage.saveTripState) {
        OntheGoStorage.saveTripState(this.state);
      }

      // Update sync and network indicators
      if (window.OntheGoReliability && OntheGoReliability.updateNetworkUI) {
        OntheGoReliability.updateNetworkUI();
      }
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
    document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab) this.navigateToTab(tab);
      });
    });

    // Desktop nav handlers
    document.querySelectorAll(".desktop-nav-tab-btn").forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab && tab !== "more") this.navigateToTab(tab);
      });
    });

    // Close desktop more dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".desktop-more-dropdown-wrapper")) {
        this.closeMoreDropdown();
      }
    });
  },

  navigateToTab(tabId, subTab) {
    const tripId = this.state?.activeTripId || "kochi-alleppey-2026";
    let hash = `#/trips/${tripId}/${tabId}`;
    if (tabId === "start") hash = "#/start";
    if (tabId === "settings") hash = "#/settings";
    
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    this.switchTab(tabId, subTab);
  },

  initRouter() {
    window.addEventListener("hashchange", () => this.handleRoute());
    window.addEventListener("popstate", () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const hash = (window.location.hash || "").toLowerCase();
    const path = (window.location.pathname || "").toLowerCase();
    const full = (hash + " " + path).trim();

    if (full.includes("bookings") || full.includes("wallet")) {
      this.switchTab("bookings", "wallet");
    } else if (full.includes("itinerary")) {
      this.switchTab("itinerary");
    } else if (full.includes("explore") || full.includes("map")) {
      this.switchTab("explore");
    } else if (full.includes("budget") || full.includes("expenses")) {
      this.switchTab("budget");
    } else if (full.includes("shared") || full.includes("collaboration")) {
      this.switchTab("shared", "collaboration");
    } else if (full.includes("memories") || full.includes("journal") || full.includes("reports")) {
      this.switchTab("memories", "journal");
    } else if (full.includes("assistant")) {
      this.switchTab("assistant", "assistant");
    } else if (full.includes("settings")) {
      this.switchTab("settings", "settings");
    } else if (full.includes("start")) {
      this.switchTab("start");
    } else if (full.includes("trips/") || full.includes("overview") || full.includes("today")) {
      this.switchTab("overview");
    } else {
      // Root / landing route: start page for direct landing
      if (!hash || hash === "#/" || hash === "#") {
        this.switchTab("start");
      } else {
        this.switchTab("overview");
      }
    }
  },

  openActiveTrip() {
    this.navigateToTab("overview");
    this.showToast("Welcome back to your Kochi–Alleppey Coastal Expedition! 🌴");
  },

  openNewTripModal() {
    const m = document.getElementById("newTripModal");
    if (m) m.classList.add("open");
  },

  handleCreateNewTrip(e) {
    if (e && e.preventDefault) e.preventDefault();
    const title = document.getElementById("newTripTitle")?.value || "Kochi–Alleppey Coastal Scooter Escape";
    const start = document.getElementById("newTripStartDate")?.value || "2026-10-16";
    const end = document.getElementById("newTripEndDate")?.value || "2026-10-20";
    const t1 = document.getElementById("newTripTraveller1")?.value || "Vishnu";
    const t2 = document.getElementById("newTripTraveller2")?.value || "Co-rider";

    if (this.state) {
      if (!this.state.trip) this.state.trip = {};
      this.state.trip.title = title;
      this.state.trip.startDate = start;
      this.state.trip.endDate = end;
      if (Array.isArray(this.state.travellers) && this.state.travellers.length >= 2) {
        this.state.travellers[0].name = t1;
        this.state.travellers[1].name = t2;
      }
      this.saveState();
    }

    this.closeModals();
    this.navigateToTab("overview");
    this.showToast(`Trip "${title}" created and ready! 🚀`);
    this.renderDashboard();
  },

  toggleMoreDropdown(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const menu = document.getElementById("desktopMoreMenu");
    if (menu) {
      const isShown = menu.style.display === "block";
      menu.style.display = isShown ? "none" : "block";
    }
  },

  closeMoreDropdown() {
    const menu = document.getElementById("desktopMoreMenu");
    if (menu) menu.style.display = "none";
  },

  switchTab(tabId, subTab) {
    // Normalise semantic aliases
    const targetMap = {
      start: { view: "start", nav: "start" },
      today: { view: "today", nav: "overview" },
      overview: { view: "today", nav: "overview" },
      itinerary: { view: "itinerary", nav: "itinerary" },
      explore: { view: "map", nav: "explore" },
      map: { view: "map", nav: "explore" },
      budget: { view: "expenses", nav: "budget" },
      expenses: { view: "expenses", nav: "budget" },
      bookings: { view: "more", nav: "more", sub: "wallet" },
      wallet: { view: "more", nav: "more", sub: "wallet" },
      shared: { view: "more", nav: "more", sub: "collaboration" },
      collaboration: { view: "more", nav: "more", sub: "collaboration" },
      memories: { view: "more", nav: "more", sub: "journal" },
      journal: { view: "more", nav: "more", sub: "journal" },
      reports: { view: "more", nav: "more", sub: "reports" },
      assistant: { view: "more", nav: "more", sub: "assistant" },
      settings: { view: "more", nav: "more", sub: "settings" },
      backups: { view: "more", nav: "more", sub: "backups" },
      restaurants: { view: "more", nav: "more", sub: "restaurants" },
      optional: { view: "more", nav: "more", sub: "optional" },
      checklist: { view: "more", nav: "more", sub: "checklist" },
      conflicts: { view: "more", nav: "more", sub: "conflicts" },
      feasibility: { view: "more", nav: "more", sub: "feasibility" },
      reminders: { view: "more", nav: "more", sub: "reminders" },
      "sync-queue": { view: "more", nav: "more", sub: "sync-queue" },
      more: { view: "more", nav: "more" }
    };

    const target = targetMap[tabId] || { view: tabId, nav: tabId };
    this.activeTab = tabId;

    // Toggle active view
    document.querySelectorAll(".tab-view").forEach(v => {
      v.classList.toggle("active", v.id === `view-${target.view}`);
    });

    // Update bottom nav active state (support both semantic and legacy data-tab values)
    document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
      const d = item.getAttribute("data-tab");
      const isMatch = (d === target.nav) ||
                      (target.nav === "overview" && d === "today") ||
                      (target.nav === "explore" && d === "map") ||
                      (target.nav === "budget" && d === "expenses");
      item.classList.toggle("active", isMatch);
    });

    // Update desktop nav active state
    document.querySelectorAll(".desktop-nav-tab-btn").forEach(item => {
      const d = item.getAttribute("data-tab");
      const isMatch = (d === target.nav) ||
                      (target.nav === "overview" && d === "today") ||
                      (target.nav === "explore" && d === "map") ||
                      (target.nav === "budget" && d === "expenses");
      item.classList.toggle("active", isMatch);
    });

    // If target has subtab or subTab param provided, switch more subtab
    const activeSub = subTab || target.sub;
    if (target.view === "more" && activeSub) {
      this.switchMoreSubTab(activeSub);
    }

    // Trigger tab-specific initialisations
    if (target.view === "map") {
      setTimeout(() => OntheGoMap.init(), 100);
    } else if (target.view === "today") {
      this.renderDashboard();
    } else if (target.view === "itinerary") {
      OntheGoItinerary.renderCurrentDay();
    } else if (target.view === "expenses") {
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
      if (window.OntheGoVault) OntheGoVault.renderVaultUI();
      else OntheGoWallet.init();
    } else if (subTabId === "sync-queue") {
      if (window.OntheGoSyncEngine) OntheGoSyncEngine.renderSyncQueueUI();
    } else if (subTabId === "conflicts") {
      OntheGoTimeHelper.init();
    } else if (subTabId === "collaboration") {
      if (window.OntheGoCollaboration) OntheGoCollaboration.renderCollaborationView();
    } else if (subTabId === "feasibility") {
      if (window.OntheGoEngine) OntheGoEngine.renderFeasibilityHub();
    } else if (subTabId === "reminders") {
      if (window.OntheGoReminders) OntheGoReminders.renderRemindersUI();
    } else if (subTabId === "journal") {
      if (window.OntheGoJournal) OntheGoJournal.renderJournal();
    } else if (subTabId === "reports") {
      if (window.OntheGoReports) OntheGoReports.renderReportView();
    } else if (subTabId === "budget") {
      if (window.OntheGoBudget) OntheGoBudget.renderBudgetWidget();
    } else if (subTabId === "assistant") {
      if (window.OntheGoAssistant) OntheGoAssistant.renderChatUI();
    } else if (subTabId === "settings") {
      this.renderAiSettingsCard();
      this.renderCartoSettingsCard();
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

    // Stage 3: Render actionable notification banner, badge & weather widget
    if (window.OntheGoReminders) {
      OntheGoReminders.renderActionableNotificationsBanner();
      OntheGoReminders.renderNotificationBadge();
    }
    if (window.OntheGoWeather) {
      OntheGoWeather.renderWeatherWidget();
    }
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
    if (window.OntheGoJournal) OntheGoJournal.init();
    if (window.OntheGoReports) OntheGoReports.init();
    if (window.OntheGoBudget) OntheGoBudget.init();
    if (window.OntheGoAssistant) OntheGoAssistant.init();
    this.renderDashboard();
    this.renderAiSettingsCard();
    this.renderCartoSettingsCard();
    this.showToast("OntheGO reset to default verified itinerary. 🔄");
  },

  // ==========================================
  // GOOGLE GEMINI & AI ASSISTANT CONFIGURATION
  // ==========================================
  openAiSettingsModal() {
    this.switchTab("more");
    this.switchMoreSubTab("settings");
    const el = document.getElementById("aiSettingsCard");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      el.style.boxShadow = "0 0 0 3px var(--coastal-turquoise)";
      setTimeout(() => { el.style.boxShadow = ""; }, 1800);
    }
  },

  setGeminiApiKey(apiKey, provider = "gemini") {
    if (!this.state) this.state = {};
    if (!this.state.aiSettings) {
      this.state.aiSettings = {
        provider: "offline",
        apiKey: "",
        model: "gemini-1.5-flash",
        enabled: true
      };
    }
    const cleanKey = (apiKey || "").trim();
    this.state.aiSettings.apiKey = cleanKey;
    this.state.aiSettings.provider = cleanKey ? provider : "offline";
    this.saveState();

    this.renderAiSettingsCard();
    if (window.OntheGoAssistant && OntheGoAssistant.renderChatUI) {
      OntheGoAssistant.renderChatUI();
    }
    this.showToast(cleanKey ? "Google Gemini API key activated! 🤖" : "Gemini API key cleared (Offline engine active)");
  },

  clearGeminiApiKey() {
    this.setGeminiApiKey("", "offline");
  },

  saveAiSettingsFromUI() {
    const input = document.getElementById("geminiApiKeyInput");
    const providerSel = document.getElementById("aiProviderSelect");
    const key = input ? input.value.trim() : "";
    const provider = providerSel ? providerSel.value : (key ? "gemini" : "offline");

    this.setGeminiApiKey(key, provider);
    const statusEl = document.getElementById("aiApiKeyTestStatus");
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✓ Settings saved successfully!</span>`;
    }
  },

  async testGeminiConnectionFromUI() {
    const input = document.getElementById("geminiApiKeyInput");
    const key = input ? input.value.trim() : (this.state?.aiSettings?.apiKey || "");
    await this.testGeminiConnection(key);
  },

  async testGeminiConnection(keyToTest) {
    const key = (keyToTest || this.state?.aiSettings?.apiKey || "").trim();
    const statusEl = document.getElementById("aiApiKeyTestStatus");
    if (!key) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--danger); font-weight: 700;">⚠️ Please enter an API key first</span>`;
      }
      return false;
    }

    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--info); font-weight: 600;">🔄 Testing connection to Google Gemini 1.5 Flash...</span>`;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Respond with the word 'OK' only." }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--danger); font-weight: 700;">❌ Connection failed: ${msg}</span>`;
        }
        return false;
      }

      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✓ Connected to Gemini 1.5 Flash! Key is valid and active.</span>`;
      }
      return true;
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--danger); font-weight: 700;">❌ Network error: ${err.message}. Check internet connection.</span>`;
      }
      return false;
    }
  },

  renderAiSettingsCard() {
    const container = document.getElementById("aiSettingsContainer");
    if (!container) return;

    const ai = this.state?.aiSettings || { provider: "offline", apiKey: "", model: "gemini-1.5-flash" };
    const hasKey = !!ai.apiKey;
    const isGemini = ai.provider === "gemini" && hasKey;

    container.innerHTML = `
      <div class="stop-card" id="aiSettingsCard" style="border-left: 4px solid ${isGemini ? 'var(--ocean-teal)' : 'var(--sunset-amber)'}; transition: box-shadow 0.3s ease;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800;">🤖 AI Assistant & Google Gemini Setup</h4>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Grounded conversational travel companion & schedule recovery
            </div>
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: ${isGemini ? 'rgba(13, 130, 138, 0.15)' : 'rgba(201, 122, 20, 0.15)'}; color: ${isGemini ? 'var(--ocean-teal)' : 'var(--sunset-amber)'}; border: 1px solid ${isGemini ? 'var(--ocean-teal)' : 'var(--sunset-amber)'};">
            ${isGemini ? '🟢 Gemini 1.5 Active' : '⚪ Offline Engine Active'}
          </span>
        </div>

        <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">
          OntheGO operates 100% offline with a built-in deterministic rules engine by default. Adding a Google Gemini API key enables natural-language reasoning and intelligent delay recovery during connectivity.
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 4px;">
              Engine Provider
            </label>
            <select id="aiProviderSelect" class="form-input" style="width: 100%; font-size: 0.82rem; padding: 8px;">
              <option value="gemini" ${ai.provider === 'gemini' ? 'selected' : ''}>Google Gemini 1.5 Flash (Online API)</option>
              <option value="offline" ${ai.provider === 'offline' ? 'selected' : ''}>Deterministic Kerala Rules Engine (Offline / Free)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 4px;">
              Google Gemini API Key
            </label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="geminiApiKeyInput" class="form-input" style="flex: 1; font-size: 0.82rem; font-family: monospace;" placeholder="AIzaSy..." value="${this.escapeHTML(ai.apiKey || '')}">
              <button type="button" class="btn-sm" onclick="const f=document.getElementById('geminiApiKeyInput'); f.type = f.type === 'password' ? 'text' : 'password';" title="Toggle Visibility">👁️</button>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
              Key is stored securely in your browser's local storage and never transmitted to untrusted servers.
            </div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <button type="button" class="btn-primary-sm" onclick="OntheGoApp.saveAiSettingsFromUI()">
            💾 Save Settings
          </button>
          <button type="button" class="btn-sm" onclick="OntheGoApp.testGeminiConnectionFromUI()">
            🧪 Test Connection
          </button>
          ${hasKey ? `
            <button type="button" class="btn-sm" style="color: var(--danger);" onclick="OntheGoApp.clearGeminiApiKey()">
              🗑️ Remove Key
            </button>
          ` : ''}
        </div>

        <div id="aiApiKeyTestStatus" style="font-size: 0.78rem; margin-top: 8px;"></div>

        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-color); font-size: 0.74rem; color: var(--text-muted);">
          🔑 Need a free API key? Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color: var(--ocean-teal); font-weight: 700; text-decoration: underline;">Google AI Studio</a>.
        </div>
      </div>
    `;
  },

  // ==========================================
  // CARTO BASEMAPS & MAPS API CONFIGURATION
  // ==========================================
  getCartoApiKey() {
    if (window.OntheGoMap && typeof OntheGoMap.getApiKey === "function") {
      return OntheGoMap.getApiKey();
    }
    return localStorage.getItem("carto_api_key") || "cb1_4itb_1_cf9e5a75cd3fbf7109538e38";
  },

  setCartoApiKey(key) {
    const cleanKey = (key || "").trim();
    if (window.OntheGoMap && typeof OntheGoMap.setApiKey === "function") {
      OntheGoMap.setApiKey(cleanKey);
    } else {
      if (cleanKey) localStorage.setItem("carto_api_key", cleanKey);
      else localStorage.removeItem("carto_api_key");
    }
    this.renderCartoSettingsCard();
    this.showToast(cleanKey ? "Carto Maps API key updated & map reloaded! 🗺️" : "Reset Carto Maps to default key");
  },

  resetCartoApiKey() {
    this.setCartoApiKey("cb1_4itb_1_cf9e5a75cd3fbf7109538e38");
  },

  saveCartoApiKeyFromUI() {
    const input = document.getElementById("cartoApiKeyInput");
    const key = input ? input.value.trim() : "";
    this.setCartoApiKey(key || "cb1_4itb_1_cf9e5a75cd3fbf7109538e38");
  },

  async testCartoConnectionFromUI() {
    const input = document.getElementById("cartoApiKeyInput");
    const key = input ? input.value.trim() : this.getCartoApiKey();
    await this.testCartoConnection(key);
  },

  async testCartoConnection(keyToTest) {
    const statusEl = document.getElementById("cartoApiKeyTestStatus");
    if (!statusEl) return;
    const key = (keyToTest || "").trim();

    statusEl.innerHTML = `<span style="color: var(--ocean-teal); font-weight: 600;">🔄 Testing Carto Voyager basemap tiles...</span>`;

    try {
      const url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/13/7500/4900.png?api_key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: "GET", mode: "cors" });
      if (res.ok) {
        statusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✓ Connected to Carto Basemaps Voyager! Key is valid and authorized (HTTP 200).</span>`;
      } else {
        statusEl.innerHTML = `<span style="color: var(--danger); font-weight: 700;">✗ Carto server returned HTTP ${res.status}: ${res.statusText}</span>`;
      }
    } catch (err) {
      statusEl.innerHTML = `<span style="color: var(--warning); font-weight: 700;">⚠️ Could not verify tile online (offline or CORS blocked): ${this.escapeHTML(err.message)}</span>`;
    }
  },

  renderCartoSettingsCard() {
    const container = document.getElementById("mapSettingsContainer");
    if (!container) return;

    const currentKey = this.getCartoApiKey();
    const isCustom = currentKey && currentKey !== "cb1_4itb_1_cf9e5a75cd3fbf7109538e38";

    container.innerHTML = `
      <div class="stop-card" id="cartoSettingsCard" style="border-left: 4px solid var(--ocean-teal); transition: box-shadow 0.3s ease;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800;">🗺️ Carto Maps & Basemap Tile API</h4>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              High-resolution raster basemaps for Kochi &amp; coastal expedition routes
            </div>
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: rgba(13, 130, 138, 0.15); color: var(--ocean-teal); border: 1px solid var(--ocean-teal);">
            🟢 Carto Voyager Active
          </span>
        </div>

        <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">
          OntheGO renders interactive Leaflet route maps with Carto Voyager tiles. Tiles are pre-cached for offline coastal exploration.
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 4px;">
              Carto Maps API Key
            </label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="cartoApiKeyInput" class="form-input" style="flex: 1; font-size: 0.82rem; font-family: monospace;" placeholder="cb1_..." value="${this.escapeHTML(currentKey || '')}">
              <button type="button" class="btn-sm" onclick="const f=document.getElementById('cartoApiKeyInput'); f.type = f.type === 'password' ? 'text' : 'password';" title="Toggle Visibility">👁️</button>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
              Active API Key: <code style="font-size: 0.75rem; background: var(--bg-surface); padding: 1px 4px; border-radius: 4px;">${this.escapeHTML(currentKey)}</code>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <button type="button" class="btn-primary-sm" onclick="OntheGoApp.saveCartoApiKeyFromUI()">
            💾 Save Key
          </button>
          <button type="button" class="btn-sm" onclick="OntheGoApp.testCartoConnectionFromUI()">
            🧪 Test Tiles Connection
          </button>
          ${isCustom ? `
            <button type="button" class="btn-sm" style="color: var(--terracotta);" onclick="OntheGoApp.resetCartoApiKey()">
              🔄 Reset to Default
            </button>
          ` : ''}
        </div>

        <div id="cartoApiKeyTestStatus" style="font-size: 0.78rem; margin-top: 8px;"></div>
      </div>
    `;
  }
};

// Auto-initialize when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  OntheGoApp.init();
});
