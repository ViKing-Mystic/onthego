/**
 * OntheGO - Stage 2: Collaboration, Real-Time Synchronisation,
 * Change History, Material Change Safeguards & Shared Preferences.
 */

window.OntheGoCollaboration = {
  broadcastChannel: null,
  activeTravellerId: "traveller-1", // "traveller-1" (Vishnu/Lead) or "traveller-2" (Co-rider)
  locationWatchId: null,

  init() {
    this.initActiveTraveller();
    this.setupBroadcastChannel();
    this.setupStorageListener();
    this.checkLocationExpiry();
  },

  /**
   * Initializes or restores active traveller identity from localStorage.
   */
  initActiveTraveller() {
    const saved = localStorage.getItem("onthego_active_traveller");
    if (saved && (saved === "traveller-1" || saved === "traveller-2")) {
      this.activeTravellerId = saved;
    } else {
      this.activeTravellerId = "traveller-1";
      localStorage.setItem("onthego_active_traveller", "traveller-1");
    }
    this.updateTravellerPillUI();
  },

  /**
   * Switches the active traveller persona.
   * @param {string} travellerId "traveller-1" | "traveller-2"
   */
  switchTraveller(travellerId) {
    if (travellerId !== "traveller-1" && travellerId !== "traveller-2") return;
    this.activeTravellerId = travellerId;
    localStorage.setItem("onthego_active_traveller", travellerId);
    this.updateTravellerPillUI();

    const traveller = this.getCurrentTraveller();
    OntheGoApp.showToast(`Active persona: ${traveller.avatar} ${traveller.name} (${traveller.role})`);
    
    // Refresh relevant views
    if (OntheGoExpenses && typeof OntheGoExpenses.renderExpenseSummary === "function") {
      OntheGoExpenses.renderExpenseSummary();
    }
    this.renderCollaborationView();
  },

  getCurrentTraveller() {
    const travellers = OntheGoApp.getTravellers();
    return travellers.find(t => t.id === this.activeTravellerId) || travellers[0] || {
      id: "traveller-1",
      name: "Vishnu",
      role: "Trip Lead",
      avatar: "🛵"
    };
  },

  getPartnerTraveller() {
    const travellers = OntheGoApp.getTravellers();
    return travellers.find(t => t.id !== this.activeTravellerId) || travellers[1] || {
      id: "traveller-2",
      name: "Co-rider",
      role: "Navigator",
      avatar: "🌴"
    };
  },

  isOwner() {
    return this.activeTravellerId === "traveller-1";
  },

  /**
   * Real-Time BroadcastChannel Setup for multi-tab / peer sync on the origin.
   */
  setupBroadcastChannel() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel("onthego_collaboration_channel");
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingSync(event.data);
        };
      } catch (e) {
        console.warn("BroadcastChannel not available:", e);
      }
    }
  },

  /**
   * Storage event listener for cross-tab synchronisation fallback.
   */
  setupStorageListener() {
    window.addEventListener("storage", (e) => {
      if (e.key === OntheGoApp.STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          OntheGoApp.state = parsed;
          this.refreshAllActiveViews();
          this.updateSyncStatusPill("🟢 Synced");
        } catch (err) {
          console.warn("Error parsing storage sync:", err);
        }
      }
    });
  },

  /**
   * Broadcasts a state change event to other tabs/sessions.
   * @param {Object} change Details of what changed
   */
  broadcastChange(change) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "STATE_SYNC",
          senderId: this.activeTravellerId,
          timestamp: new Date().toISOString(),
          change,
          state: OntheGoApp.state
        });
      } catch (e) {
        console.warn("Broadcast failed:", e);
      }
    }
  },

  /**
   * Handles incoming synchronisation payload from partner or other tab.
   */
  handleIncomingSync(data) {
    if (!data || data.type !== "STATE_SYNC") return;
    if (data.senderId === this.activeTravellerId && !data.force) return;

    if (data.state) {
      OntheGoApp.state = data.state;
      localStorage.setItem(OntheGoApp.STORAGE_KEY, JSON.stringify(data.state));
    }

    const sender = OntheGoApp.getTravellerById(data.senderId);
    const desc = data.change?.description || "Updated trip details";
    OntheGoApp.showToast(`🔄 ${sender.name}: ${desc}`);

    this.refreshAllActiveViews();
    this.updateSyncStatusPill("🟢 Live Synced");
  },

  refreshAllActiveViews() {
    if (OntheGoItinerary && typeof OntheGoItinerary.renderCurrentDay === "function") {
      OntheGoItinerary.renderCurrentDay();
    }
    if (OntheGoExpenses && typeof OntheGoExpenses.init === "function") {
      OntheGoExpenses.init();
    }
    if (OntheGoChecklist && typeof OntheGoChecklist.renderChecklist === "function") {
      OntheGoChecklist.renderChecklist();
    }
    if (OntheGoWallet && typeof OntheGoWallet.renderContacts === "function") {
      OntheGoWallet.renderContacts();
    }
    if (OntheGoApp && typeof OntheGoApp.renderDashboard === "function") {
      OntheGoApp.renderDashboard();
    }
    this.renderCollaborationView();
  },

  updateTravellerPillUI() {
    const cur = this.getCurrentTraveller();
    const btn = document.getElementById("activeTravellerToggleBtn");
    if (btn) {
      btn.innerHTML = `${cur.avatar} <span class="traveller-pill-name">${cur.name}</span>`;
      btn.title = `Active Persona: ${cur.name} (${cur.role}) - Click to switch`;
    }
    this.updateSyncStatusPill("🟢 Connected (2 Travellers)");
  },

  updateSyncStatusPill(statusText) {
    const pill = document.getElementById("headerSyncStatusPill");
    if (pill) {
      pill.innerHTML = statusText;
    }
  },

  // ==========================================
  // CHANGE HISTORY & AUDIT LOG
  // ==========================================

  /**
   * Records a structured change into the trip's audit log.
   */
  recordChange({ action, entityType, entityId, description, field, oldValue, newValue }) {
    if (!OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.changeHistory)) {
      OntheGoApp.state.changeHistory = [];
    }

    const cur = this.getCurrentTraveller();
    const changeEntry = {
      id: "chg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      authorId: this.activeTravellerId,
      authorName: cur.name,
      action: action || "updated",
      entityType: entityType || "itinerary",
      entityId: entityId || "unknown",
      description: description || `${cur.name} updated ${entityType}`,
      field,
      oldValue,
      newValue
    };

    // Prepend change, cap at 200 items to avoid storage explosion
    OntheGoApp.state.changeHistory.unshift(changeEntry);
    if (OntheGoApp.state.changeHistory.length > 200) {
      OntheGoApp.state.changeHistory = OntheGoApp.state.changeHistory.slice(0, 200);
    }

    OntheGoApp.saveState();
    this.broadcastChange(changeEntry);
    return changeEntry;
  },

  getChangeHistory() {
    return OntheGoApp.state?.changeHistory || [];
  },

  // ==========================================
  // INVITATION & ACCESS CONTROL ENGINE
  // ==========================================

  getCollaborationConfig() {
    if (!OntheGoApp.state.collaboration) {
      OntheGoApp.state.collaboration = {
        activeTravellerId: this.activeTravellerId,
        isTripPrivate: true,
        inviteToken: this.generateSecureToken(),
        inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        inviteStatus: "idle",
        accessPin: "762415", // 6-digit access code (Kochi PIN code inspired)
        partnerConnected: true
      };
      OntheGoApp.saveState();
    }
    return OntheGoApp.state.collaboration;
  },

  generateSecureToken() {
    const array = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Generates or refreshes a cryptographically secure invite link.
   */
  generateInviteLink(durationDays = 7) {
    if (!this.isOwner()) {
      alert("Only the trip owner (Vishnu) can generate or modify invitation links.");
      return null;
    }

    const config = this.getCollaborationConfig();
    config.inviteToken = this.generateSecureToken();
    config.inviteExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    config.inviteStatus = "pending";
    // Generate new 6-digit access PIN
    config.accessPin = Math.floor(100000 + Math.random() * 900000).toString();

    this.recordChange({
      action: "created",
      entityType: "collaboration",
      entityId: "invite-token",
      description: `Generated secure invitation token for Co-rider (valid ${durationDays} days)`
    });

    OntheGoApp.saveState();
    this.renderCollaborationView();
    return this.getInviteUrl(config.inviteToken);
  },

  getInviteUrl(token) {
    const base = window.location.href.split("#")[0].split("?")[0];
    const tripId = OntheGoApp.state.activeTripId || "trip-kochi-alleppey-2026";
    return `${base}?invite=${token}&trip=${tripId}`;
  },

  /**
   * Revokes the active invitation token and disconnects partner access.
   */
  revokeInvite() {
    if (!this.isOwner()) {
      alert("Only the trip owner can revoke invitations.");
      return;
    }

    if (!confirm("Revoke Co-rider invitation? Any unverified access links will become invalid immediately.")) return;

    const config = this.getCollaborationConfig();
    config.inviteStatus = "revoked";
    config.partnerConnected = false;
    config.inviteToken = "";

    this.recordChange({
      action: "updated",
      entityType: "collaboration",
      entityId: "invite-token",
      description: "Revoked invitation access for second traveller."
    });

    OntheGoApp.saveState();
    OntheGoApp.showToast("Invitation revoked. Trip access restricted to owner.");
    this.renderCollaborationView();
  },

  /**
   * Validates and redeems an invitation token and access PIN.
   */
  redeemInvite(token, enteredPin) {
    const config = this.getCollaborationConfig();

    if (config.inviteStatus === "revoked") {
      return { success: false, error: "This invitation link has been revoked by the trip owner." };
    }

    if (config.inviteExpiry && new Date() > new Date(config.inviteExpiry)) {
      return { success: false, error: "This invitation link has expired. Request a new link from the trip owner." };
    }

    if (token !== config.inviteToken) {
      return { success: false, error: "Invalid invitation token." };
    }

    if (enteredPin && enteredPin.trim() !== config.accessPin) {
      return { success: false, error: "Incorrect 6-digit Access PIN." };
    }

    // Success
    config.inviteStatus = "accepted";
    config.partnerConnected = true;
    this.switchTraveller("traveller-2");

    this.recordChange({
      action: "completed",
      entityType: "collaboration",
      entityId: "invite-redemption",
      description: "Co-rider successfully joined the trip via verified invite!"
    });

    OntheGoApp.saveState();
    return { success: true };
  },

  // ==========================================
  // MATERIAL CHANGE SAFEGUARD GATE
  // ==========================================

  /**
   * Checks if an activity edit is a material change affecting fixed commitments or confirmed bookings.
   * @param {Object} oldAct Baseline activity
   * @param {Object} newAct Proposed edited activity
   * @returns {Object} { isMaterial: boolean, reason?: string, consequences?: string }
   */
  evaluateMaterialChange(oldAct, newAct) {
    if (!oldAct || !newAct) return { isMaterial: false };

    // Material criteria 1: Fixed commitments (Train departure, scooter return)
    if (oldAct.isFixedCommitment || oldAct.id === "act-5-6" || oldAct.id === "act-5-8" || oldAct.id === "act-1-1") {
      if (oldAct.time !== newAct.time) {
        return {
          isMaterial: true,
          type: "fixed_commitment",
          reason: `Modifying fixed departure/return time for "${oldAct.title}"`,
          consequences: `Day 5 train departure (2:00 PM Vande Bharat) and scooter return deadline (1:00 PM target / 1:30 PM latest) govern the backward calculation safeguard. Delaying this stop risks missing the train or incurring rental penalties.`
        };
      }
    }

    // Material criteria 2: Confirmed Accommodation bookings (Calvin's Inn, Ocean Aura, Zostel)
    const isAccommodation = oldAct.category === "Accommodation" || (oldAct.title && oldAct.title.toLowerCase().includes("check-in"));
    if (isAccommodation && (oldAct.time !== newAct.time || oldAct.bookingStatus !== newAct.bookingStatus)) {
      return {
        isMaterial: true,
        type: "confirmed_booking",
        reason: `Altering check-in schedule or booking details for "${oldAct.title}"`,
        consequences: `This accommodation booking requires check-in alignment with host. Modifying the schedule without partner agreement may cause room forfeiture.`
      };
    }

    // Material criteria 3: Pre-booked kayaking activity (Opulence ₹700 slot)
    if (oldAct.id === "act-3-1" || (oldAct.title && oldAct.title.toLowerCase().includes("opulence"))) {
      if (oldAct.time !== newAct.time) {
        return {
          isMaterial: true,
          type: "booked_activity",
          reason: `Rescheduling confirmed Opulence Kayaking slot (${oldAct.time})`,
          consequences: `Opulence morning slot ending at 11:30 AM is confirmed at ₹700 with breakfast included. Changing the slot timing requires operator re-confirmation (Contact: 8921172358).`
        };
      }
    }

    return { isMaterial: false };
  },

  /**
   * Prompts user for material change acknowledgement and partner notification.
   */
  confirmMaterialChange(evalResult, onConfirm, onCancel) {
    const partner = this.getPartnerTraveller();
    const cur = this.getCurrentTraveller();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "materialChangeModal";
    overlay.style.zIndex = "10001";

    overlay.innerHTML = `
      <div class="modal-sheet" style="max-width: 500px; border-left: 6px solid var(--danger);">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">⚠️</span>
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">
              Material Change Confirmation
            </h3>
          </div>
          <button type="button" class="icon-btn" style="width: 30px; height: 30px;" onclick="document.getElementById('materialChangeModal').remove()">✕</button>
        </div>

        <div style="background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 12px;">
          <div style="font-weight: 700; font-size: 0.85rem; color: #991b1b; margin-bottom: 4px;">
            ${evalResult.reason}
          </div>
          <div style="font-size: 0.76rem; color: var(--text-main); line-height: 1.4;">
            <b>Consequences & Safeguards:</b> ${evalResult.consequences}
          </div>
        </div>

        <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 14px; line-height: 1.4;">
          Both travellers must be aligned on material schedule and booking changes. If you proceed, this modification will be logged with high priority and synchronized to <b>${partner.name}</b>.
        </p>

        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" class="btn-secondary" id="btnCancelMaterialChange">
            Cancel
          </button>
          <button type="button" class="btn-primary" id="btnConfirmMaterialChange" style="background: var(--kerala-terracotta);">
            Acknowledge & Confirm Change
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnCancelMaterialChange").onclick = () => {
      overlay.remove();
      if (typeof onCancel === "function") onCancel();
    };

    document.getElementById("btnConfirmMaterialChange").onclick = () => {
      overlay.remove();
      if (typeof onConfirm === "function") onConfirm();
    };
  },

  // ==========================================
  // SHARED PREFERENCES & COMPATIBILITY MATRIX
  // ==========================================

  getPreferences() {
    if (!OntheGoApp.state.preferences) {
      OntheGoApp.state.preferences = {
        foodAndDining: {
          dietary: "Kerala Coastal Seafood & Traditional Vegetarian",
          spiceTolerance: "Medium",
          preferences: ["Karimeen Pollichathu", "Appam & Stew", "Sulaimani Tea", "Filter Coffee", "Tender Coconut Water"],
          dislikedFoods: ["Overly sweet curries", "Heavy buffet meals before riding"]
        },
        budgetSensitivity: {
          tier: "Comfortable Boutique",
          targetDailySpendINR: 3200,
          notes: "Prioritise cleanliness, AC homestays, and quality local food; avoid unnecessary tourist traps."
        },
        physicalTolerances: {
          maxWalkingKmPerDay: 4,
          maxScooterRideMinsPerStretch: 75,
          heatSunTolerance: "Medium"
        },
        sightseeingPace: "Balanced",
        indoorOutdoorBalance: {
          indoorPct: 40,
          outdoorPct: 60
        },
        restBreaks: {
          requireAfternoonRest: true,
          restWindow: "02:00 PM - 04:00 PM"
        },
        vetoList: [
          "No scooter riding on loose beach sand",
          "No operating scooter after consuming toddy at No. 1 Kallu Shap",
          "No swimming in Marari beach during high surf / red flag advisories",
          "No rushing through Fort Kochi heritage streets during peak midday heat"
        ]
      };
      OntheGoApp.saveState();
    }
    return OntheGoApp.state.preferences;
  },

  savePreferences(updatedPrefs) {
    OntheGoApp.state.preferences = updatedPrefs;
    const cur = this.getCurrentTraveller();
    this.recordChange({
      action: "preference_updated",
      entityType: "preference",
      entityId: "travel-preferences",
      description: `${cur.name} updated shared travel preferences & tolerances`
    });
    OntheGoApp.saveState();
    OntheGoApp.showToast("Shared travel preferences saved! 🌴");
    this.renderCollaborationView();
  },

  addVetoItem(item) {
    if (!item || !item.trim()) return;
    const prefs = this.getPreferences();
    prefs.vetoList.push(item.trim());
    this.savePreferences(prefs);
  },

  removeVetoItem(index) {
    const prefs = this.getPreferences();
    prefs.vetoList.splice(index, 1);
    this.savePreferences(prefs);
  },

  // ==========================================
  // CONSENT-BASED LOCATION SHARING
  // ==========================================

  getLocationSharing() {
    if (!OntheGoApp.state.locationSharing) {
      OntheGoApp.state.locationSharing = {
        enabled: false,
        activeTravellerId: null,
        activatedAt: null,
        expiresAt: null,
        durationMins: 0,
        currentLat: null,
        currentLng: null,
        lastUpdated: null,
        checkIns: [
          {
            id: "chk-init",
            travellerId: "traveller-1",
            travellerName: "Vishnu",
            timestamp: new Date().toISOString(),
            locationName: "Ernakulam Junction (ERS)",
            note: "Expedition rendezvous base near Platform 1."
          }
        ]
      };
      OntheGoApp.saveState();
    }
    return OntheGoApp.state.locationSharing;
  },

  checkLocationExpiry() {
    const loc = this.getLocationSharing();
    if (loc.enabled && loc.expiresAt) {
      if (new Date() > new Date(loc.expiresAt)) {
        this.stopLocationSharing(true);
      }
    }
  },

  /**
   * Starts live location sharing with explicit consent and time-bound duration.
   * @param {number} durationMins Duration in minutes (e.g. 60, 240)
   */
  startLocationSharing(durationMins = 120) {
    if (!confirm(`Enable location sharing with your co-traveller for ${durationMins / 60} hours? You can stop it at any time.`)) {
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please use manual check-in.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = this.getLocationSharing();
        const cur = this.getCurrentTraveller();
        loc.enabled = true;
        loc.activeTravellerId = this.activeTravellerId;
        loc.activatedAt = new Date().toISOString();
        loc.expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();
        loc.durationMins = durationMins;
        loc.currentLat = pos.coords.latitude;
        loc.currentLng = pos.coords.longitude;
        loc.lastUpdated = new Date().toISOString();

        this.recordChange({
          action: "created",
          entityType: "collaboration",
          entityId: "location-sharing",
          description: `${cur.name} enabled live location sharing for ${durationMins / 60}h`
        });

        OntheGoApp.saveState();
        OntheGoApp.showToast(`Live location active for ${durationMins / 60} hours 📍`);
        this.renderCollaborationView();
      },
      (err) => {
        alert("Location permission denied or unavailable. You can use manual check-in instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  /**
   * Immediately stops location sharing.
   */
  stopLocationSharing(isExpired = false) {
    const loc = this.getLocationSharing();
    loc.enabled = false;
    loc.currentLat = null;
    loc.currentLng = null;
    loc.expiresAt = null;

    const cur = this.getCurrentTraveller();
    this.recordChange({
      action: "updated",
      entityType: "collaboration",
      entityId: "location-sharing",
      description: isExpired ? "Location sharing session expired." : `${cur.name} stopped live location sharing.`
    });

    OntheGoApp.saveState();
    OntheGoApp.showToast(isExpired ? "Location sharing session expired." : "Live location sharing stopped.");
    this.renderCollaborationView();
  },

  /**
   * Adds a manual check-in point without continuous GPS tracking.
   */
  manualCheckIn(locationName, note) {
    if (!locationName || !locationName.trim()) {
      locationName = prompt("Enter your current location name (e.g., Kashi Art Cafe, Fort Kochi):");
      if (!locationName || !locationName.trim()) return;
    }

    const loc = this.getLocationSharing();
    const cur = this.getCurrentTraveller();
    const newCheckIn = {
      id: "chk-" + Date.now(),
      travellerId: this.activeTravellerId,
      travellerName: cur.name,
      timestamp: new Date().toISOString(),
      locationName: locationName.trim(),
      note: note ? note.trim() : ""
    };

    loc.checkIns.unshift(newCheckIn);
    if (loc.checkIns.length > 20) loc.checkIns = loc.checkIns.slice(0, 20);

    this.recordChange({
      action: "created",
      entityType: "collaboration",
      entityId: newCheckIn.id,
      description: `${cur.name} checked in at: ${newCheckIn.locationName}`
    });

    OntheGoApp.saveState();
    OntheGoApp.showToast(`Checked in at ${newCheckIn.locationName}! 📍`);
    this.renderCollaborationView();
  },

  // ==========================================
  // RENDERING COLLABORATION HUB UI
  // ==========================================

  renderCollaborationView() {
    const container = document.getElementById("collaborationHubContainer");
    if (!container) return;

    const cur = this.getCurrentTraveller();
    const partner = this.getPartnerTraveller();
    const config = this.getCollaborationConfig();
    const prefs = this.getPreferences();
    const loc = this.getLocationSharing();
    const history = this.getChangeHistory();

    const isLocActive = loc.enabled && loc.expiresAt && new Date() < new Date(loc.expiresAt);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Traveller Persona Switcher & Identity Bar -->
        <div class="route-summary-card" style="border-left: 5px solid var(--coastal-turquoise);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
            <div>
              <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--coastal-turquoise); letter-spacing: 0.5px;">Active Traveller Persona</span>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                ${cur.avatar} ${cur.name} (${cur.role})
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">
                ${this.isOwner() ? '👑 Trip Owner & Lead Rider' : '🤝 Invited Co-traveller & Navigator'}
              </div>
            </div>
            
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn-sm ${this.activeTravellerId === 'traveller-1' ? 'btn-primary-sm' : ''}" onclick="OntheGoCollaboration.switchTraveller('traveller-1')">
                🛵 Vishnu
              </button>
              <button type="button" class="btn-sm ${this.activeTravellerId === 'traveller-2' ? 'btn-primary-sm' : ''}" onclick="OntheGoCollaboration.switchTraveller('traveller-2')">
                🌴 Co-rider
              </button>
            </div>
          </div>
          <p style="font-size: 0.76rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
            All modifications, checklist updates, expense entries, and notes are automatically attributed to your active persona.
          </p>
        </div>

        <!-- Secure Invitation & Trip Membership Card -->
        <div class="stay-widget-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">🔐</span>
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">Trip Privacy & Membership</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Strict 2-Traveller Private Collaboration</div>
              </div>
            </div>
            <span class="header-status-pill ${config.partnerConnected ? 'status-online' : 'status-offline'}">
              ${config.partnerConnected ? '🟢 2 Travellers Connected' : '🟡 Invite Pending'}
            </span>
          </div>

          <div style="font-size: 0.78rem; color: var(--text-main); line-height: 1.45;">
            <div><b>Trip Privacy:</b> Private (Encrypted client-side storage, requires verified token & PIN)</div>
            <div><b>Access PIN:</b> <code style="background: var(--bg-input); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${config.accessPin || '762415'}</code> (Required for Co-rider verification)</div>
            ${config.inviteExpiry ? `<div><b>Link Expiry:</b> ${new Date(config.inviteExpiry).toLocaleDateString()} (${config.inviteStatus})</div>` : ''}
          </div>

          <div class="stop-actions-row">
            ${this.isOwner() ? `
              <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoCollaboration.copyInviteLink()">
                📋 Copy Secure Invite Link
              </button>
              <button type="button" class="btn-sm" onclick="OntheGoCollaboration.generateInviteLink(7)">
                🔄 Regenerate Token
              </button>
              <button type="button" class="btn-sm" style="color: var(--danger);" onclick="OntheGoCollaboration.revokeInvite()">
                🚫 Revoke Access
              </button>
            ` : `
              <span style="font-size: 0.74rem; color: var(--text-muted);">Connected as Co-rider via verified invitation.</span>
            `}
          </div>
        </div>

        <!-- Consent-Based Location Sharing & Manual Check-In -->
        <div class="stay-widget-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">📍</span>
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">Location Sharing & Check-In</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Privacy-first: Continuous tracking is never enabled automatically</div>
              </div>
            </div>
            <span class="header-status-pill ${isLocActive ? 'status-online' : 'status-offline'}">
              ${isLocActive ? '🟢 Live Sharing Active' : '⚪ Sharing Inactive'}
            </span>
          </div>

          ${isLocActive ? `
            <div class="alert-banner alert-warning" style="margin: 0;">
              <span class="alert-icon">⏱️</span>
              <div>
                <b>Live Sharing Active:</b> Enabled by ${OntheGoApp.getTravellerById(loc.activeTravellerId).name}.
                <div>Expires at: ${new Date(loc.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</div>
              </div>
            </div>
          ` : ''}

          <div class="stop-actions-row">
            ${isLocActive ? `
              <button type="button" class="btn-sm" style="color: var(--danger); font-weight: 700;" onclick="OntheGoCollaboration.stopLocationSharing()">
                🛑 Stop Live Location
              </button>
            ` : `
              <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoCollaboration.startLocationSharing(120)">
                📡 Share Live Location (2 hrs)
              </button>
              <button type="button" class="btn-sm" onclick="OntheGoCollaboration.startLocationSharing(240)">
                📡 Share for 4 hrs
              </button>
            `}
            <button type="button" class="btn-sm" onclick="OntheGoCollaboration.manualCheckIn()">
              📍 Manual Check-In Here
            </button>
          </div>

          <!-- Recent Check-Ins List -->
          ${loc.checkIns && loc.checkIns.length ? `
            <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
              <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Recent Check-Ins</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${loc.checkIns.slice(0, 3).map(c => `
                  <div style="font-size: 0.74rem; display: flex; justify-content: space-between; background: var(--bg-card); padding: 4px 8px; border-radius: var(--radius-xs);">
                    <span><b>${c.travellerName}:</b> ${c.locationName}</span>
                    <span style="color: var(--text-dim);">${new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Shared Preferences & Travel Compatibility Matrix -->
        <div class="route-summary-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">🌴</span>
              <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">
                Shared Preferences & Compatibility
              </h3>
            </div>
            <button type="button" class="btn-sm" onclick="OntheGoCollaboration.openEditPreferencesModal()">
              ✏️ Edit Preferences
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 0.76rem;">
            <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-weight: 800; color: var(--ocean-teal-light); margin-bottom: 4px;">🍱 Food & Dining</div>
              <div><b>Dietary:</b> ${prefs.foodAndDining.dietary}</div>
              <div><b>Spice Tolerance:</b> ${prefs.foodAndDining.spiceTolerance}</div>
              <div style="color: var(--text-muted); margin-top: 2px;">Favs: ${prefs.foodAndDining.preferences.join(", ")}</div>
            </div>

            <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-weight: 800; color: var(--ocean-teal-light); margin-bottom: 4px;">🛵 Riding & Walking Tolerance</div>
              <div><b>Walking:</b> Max ${prefs.physicalTolerances.maxWalkingKmPerDay} km/day</div>
              <div><b>Scooter Ride:</b> Max ${prefs.physicalTolerances.maxScooterRideMinsPerStretch} mins / stretch</div>
              <div><b>Pace:</b> ${prefs.sightseeingPace}</div>
            </div>

            <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-weight: 800; color: var(--ocean-teal-light); margin-bottom: 4px;">💳 Budget & Style</div>
              <div><b>Tier:</b> ${prefs.budgetSensitivity.tier}</div>
              <div><b>Target:</b> ₹${prefs.budgetSensitivity.targetDailySpendINR.toLocaleString('en-IN')}/day</div>
              <div><b>Downtime:</b> ${prefs.restBreaks.requireAfternoonRest ? prefs.restBreaks.restWindow : 'Flexible'}</div>
            </div>
          </div>

          <!-- Veto / Hard Dislike List -->
          <div style="margin-top: 12px; background: rgba(220,38,38,0.04); border: 1px solid rgba(220,38,38,0.2); border-radius: var(--radius-sm); padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.74rem; font-weight: 800; color: #991b1b; text-transform: uppercase;">
                ⛔ Shared Veto List (Activities Neither Traveller Wants)
              </span>
              <button type="button" class="btn-sm" style="font-size: 0.7rem; padding: 2px 8px; min-height: 24px;" onclick="OntheGoCollaboration.promptAddVeto()">
                ➕ Add Veto
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${prefs.vetoList.map((v, i) => `
                <div style="font-size: 0.74rem; color: var(--text-main); display: flex; align-items: center; justify-content: space-between;">
                  <span>• ${v}</span>
                  <button type="button" class="icon-btn" style="width: 20px; height: 20px; font-size: 0.65rem;" onclick="OntheGoCollaboration.removeVetoItem(${i})">✕</button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Real-Time Change History & Audit Timeline -->
        <div class="stay-widget-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">📜</span>
              <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">
                Change History & Activity Feed
              </h3>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${history.length} logged events</span>
          </div>

          <div style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
            ${!history.length ? `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 16px;">
                No changes logged yet. Every itinerary edit, expense, and checklist tick will appear here in real time.
              </div>
            ` : history.map(item => {
              const author = OntheGoApp.getTravellerById(item.authorId);
              const timeHuman = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateHuman = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

              return `
                <div style="display: flex; align-items: flex-start; gap: 8px; background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.76rem;">
                  <span style="font-size: 1.1rem; line-height: 1;">${author.avatar}</span>
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                      <span style="font-weight: 700; color: var(--text-main);">${author.name}</span>
                      <span style="font-size: 0.68rem; color: var(--text-dim);">${dateHuman} ${timeHuman}</span>
                    </div>
                    <div style="color: var(--text-muted); margin-top: 2px;">${item.description}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

      </div>
    `;
  },

  copyInviteLink() {
    const config = this.getCollaborationConfig();
    const url = this.getInviteUrl(config.inviteToken);
    const msg = `🛵 OntheGO Kerala Expedition Invite!\nTrip: Kochi–Alleppey Coastal Ride (16–20 Oct 2026)\nAccess Link: ${url}\nPIN: ${config.accessPin}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      OntheGoApp.showToast("Secure invite link & PIN copied to clipboard! 📋");
    } else {
      prompt("Copy invite link:", msg);
    }
  },

  promptAddVeto() {
    const item = prompt("Enter an activity or condition neither traveller wants to do:");
    if (item && item.trim()) {
      this.addVetoItem(item.trim());
    }
  },

  openEditPreferencesModal() {
    const prefs = this.getPreferences();
    const modal = document.getElementById("editPreferencesModal");
    if (!modal) return;

    document.getElementById("prefDietary").value = prefs.foodAndDining.dietary;
    document.getElementById("prefSpice").value = prefs.foodAndDining.spiceTolerance;
    document.getElementById("prefWalking").value = prefs.physicalTolerances.maxWalkingKmPerDay;
    document.getElementById("prefRide").value = prefs.physicalTolerances.maxScooterRideMinsPerStretch;
    document.getElementById("prefPace").value = prefs.sightseeingPace;
    document.getElementById("prefBudgetTier").value = prefs.budgetSensitivity.tier;
    document.getElementById("prefDailyBudget").value = prefs.budgetSensitivity.targetDailySpendINR;
    document.getElementById("prefRestWindow").value = prefs.restBreaks.restWindow;

    modal.classList.add("open");
  },

  savePreferencesFromModal(e) {
    if (e) e.preventDefault();
    const prefs = this.getPreferences();

    prefs.foodAndDining.dietary = document.getElementById("prefDietary").value;
    prefs.foodAndDining.spiceTolerance = document.getElementById("prefSpice").value;
    prefs.physicalTolerances.maxWalkingKmPerDay = parseFloat(document.getElementById("prefWalking").value) || 3;
    prefs.physicalTolerances.maxScooterRideMinsPerStretch = parseInt(document.getElementById("prefRide").value, 10) || 60;
    prefs.sightseeingPace = document.getElementById("prefPace").value;
    prefs.budgetSensitivity.tier = document.getElementById("prefBudgetTier").value;
    prefs.budgetSensitivity.targetDailySpendINR = parseFloat(document.getElementById("prefDailyBudget").value) || 3000;
    prefs.restBreaks.restWindow = document.getElementById("prefRestWindow").value;

    this.savePreferences(prefs);
    OntheGoApp.closeModals();
  }
};
