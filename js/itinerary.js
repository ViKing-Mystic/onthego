/**
 * OntheGO - Interactive Itinerary Module
 * Clean, mobile-optimized, editable 5-day schedule manager with
 * conflict detection, reordering, backup links, and baseline restoration.
 */

window.OntheGoItinerary = {
  currentDayId: "day-1",
  activeCategoryFilter: "all",
  editingActivityId: null,

  init() {
    const trip = OntheGoApp.getActiveTrip();
    if (trip && trip.days && trip.days.length) {
      if (!trip.days.some(d => d.id === this.currentDayId)) {
        this.currentDayId = trip.days[0].id;
      }
    }
    this.renderDaySelector();
    this.renderCurrentDay();
  },

  renderDaySelector() {
    const container = document.getElementById("daySelectorContainer");
    if (!container) return;

    const trip = OntheGoApp.getActiveTrip();
    const days = trip.days || [];

    const daysHtml = days.map((day) => `
      <button type="button" class="day-pill ${day.id === this.currentDayId ? 'active' : ''}" onclick="OntheGoItinerary.switchDay('${day.id}')">
        <div class="day-pill-num">Day ${day.dayNumber}</div>
        <div class="day-pill-title">${day.dateHuman || ('Day ' + day.dayNumber)}</div>
      </button>
    `).join("");

    container.innerHTML = daysHtml;
  },

  switchDay(dayId) {
    this.currentDayId = dayId;
    this.renderDaySelector();
    this.renderCurrentDay();

    // Also update map if map is initialized
    if (window.OntheGoMap && typeof OntheGoMap.onDayChanged === 'function') {
      OntheGoMap.onDayChanged(dayId);
    }
    // Also update dashboard if active
    if (window.OntheGoApp && typeof OntheGoApp.renderDashboard === 'function') {
      OntheGoApp.renderDashboard();
    }
  },

  setCategoryFilter(category) {
    this.activeCategoryFilter = category;
    const buttons = document.querySelectorAll(".rec-filter-btn");
    buttons.forEach(btn => {
      if (btn.getAttribute("data-cat") === category) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    this.renderCurrentDay();
  },

  renderCurrentDay() {
    const container = document.getElementById("timelineContainer");
    const summaryContainer = document.getElementById("dayRouteSummaryContainer");
    if (!container) return;

    const trip = OntheGoApp.getActiveTrip();
    const day = (trip.days || []).find(d => d.id === this.currentDayId) || trip.days[0];
    if (!day) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">No day found.</div>`;
      if (summaryContainer) summaryContainer.innerHTML = "";
      return;
    }

    // Render Route Summary & Warning Alert
    if (summaryContainer) {
      const safeguardHtml = (day.dayNumber === 5 && window.OntheGoTimeHelper)
        ? OntheGoTimeHelper.renderDay5SafeguardCard(day)
        : "";

      summaryContainer.innerHTML = `
        <div class="route-summary-card">
          <div class="route-summary-header">
            <h3 class="route-theme-title">🛵 Day ${day.dayNumber}: ${day.theme}</h3>
            <span class="route-meta-badge">📍 ${day.distanceKm || 0} km • ⏱ ${day.estimatedRideTime || '1 hr'}</span>
          </div>
          <p class="route-path-desc"><b>Route:</b> ${day.route || 'Scenic coastal itinerary'}</p>
          ${day.warning ? `
            <div class="alert-banner alert-warning" style="margin-bottom: 0;">
              <span class="alert-icon">⚠️</span>
              <div>${day.warning}</div>
            </div>
          ` : ''}
        </div>
        ${safeguardHtml}
      `;
    }

    const day5Audit = (day.dayNumber === 5 && window.OntheGoTimeHelper)
      ? OntheGoTimeHelper.calculateDay5BackwardSchedule(day.activities)
      : null;

    const activities = day.activities || [];
    const filtered = activities.filter(a => {
      if (this.activeCategoryFilter === "all") return true;
      return a.category.toLowerCase() === this.activeCategoryFilter.toLowerCase();
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🛵</div>
          <p style="color: var(--text-muted); font-size: 0.88rem;">No stops in this category.</p>
          <button class="btn-sm btn-primary-sm" style="margin-top: 10px;" onclick="OntheGoItinerary.setCategoryFilter('all')">Show All Stops</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((act, idx) => {
      const isCompleted = act.status === "completed";
      const isSkipped = act.status === "skipped";
      const hasConflict = !!act.scheduleConflict;
      const safeguardFlag = day5Audit ? day5Audit.flaggedActivities.find(f => f.id === act.id) : null;

      return `
        <div class="stop-card ${isCompleted ? 'completed' : ''} ${act.isFixedCommitment ? 'is-fixed' : ''} ${hasConflict ? 'is-conflict' : ''} ${safeguardFlag ? 'is-conflict' : ''}" id="stop-card-${act.id}">
          
          <div class="stop-header">
            <div class="stop-time-row">
              <span class="stop-time-badge">⏱ ${act.time || 'Flexible'}</span>
              <span class="stop-cat-badge cat-${(act.category || 'Sightseeing').toLowerCase()}">${act.category}</span>
              ${act.isFixedCommitment ? `<span style="font-size: 0.68rem; font-weight: 800; color: var(--sunset-coral); background: rgba(249,115,22,0.15); padding: 2px 6px; border-radius: 4px;">Fixed Commitment</span>` : ''}
              ${act.pendingSync ? `<span class="split-tag tag-custom" style="background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; font-size: 0.68rem;">🕒 Pending Sync</span>` : ''}
              ${isSkipped ? `<span style="font-size: 0.68rem; font-weight: 700; color: var(--text-dim); background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">Skipped</span>` : ''}
              ${safeguardFlag ? `<span style="font-size: 0.68rem; font-weight: 800; color: var(--danger); background: rgba(220,38,38,0.15); padding: 2px 6px; border-radius: 4px;">🚨 Safeguard Alert</span>` : ''}
            </div>

            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="icon-btn" style="width: 32px; height: 32px; font-size: 0.85rem;" title="Move Up" onclick="OntheGoItinerary.moveActivity('${act.id}', -1)">▲</button>
              <button class="icon-btn" style="width: 32px; height: 32px; font-size: 0.85rem;" title="Move Down" onclick="OntheGoItinerary.moveActivity('${act.id}', 1)">▼</button>
              <button class="icon-btn" style="width: 32px; height: 32px; font-size: 0.85rem;" title="Edit Stop" onclick="OntheGoItinerary.openEditActivityModal('${act.id}')">✏️</button>
            </div>
          </div>

          <div class="stop-title-row">
            <input type="checkbox" class="stop-check-input" ${isCompleted ? 'checked' : ''} onchange="OntheGoItinerary.toggleComplete('${act.id}', this.checked)" title="Mark completed">
            <div class="stop-title">${act.title}</div>
          </div>

          ${act.location ? `
            <div class="stop-location-text">
              <span>📍</span> <span>${act.location}</span>
            </div>
          ` : ''}

          ${safeguardFlag ? `
            <div class="safeguard-act-alert ${safeguardFlag.severity}">
              <span>${safeguardFlag.severity === 'danger' ? '🚨' : '⚠️'}</span>
              <div><b>Day 5 Train Safeguard Alert:</b> ${safeguardFlag.reason}</div>
            </div>
          ` : ''}

          ${(() => {
            const risk = window.OntheGoWeather ? OntheGoWeather.getRiskForActivity(act.id) : null;
            if (!risk) return '';
            return `
              <div class="safeguard-act-alert ${risk.riskLevel === 'high' ? 'danger' : 'warning'}" style="margin-bottom: 6px;">
                <span>${risk.riskLevel === 'high' ? '🚨' : '🌊'}</span>
                <div>
                  <b>${risk.advisoryTitle}:</b> ${risk.advisoryDetails}
                  <div style="font-size: 0.7rem; margin-top: 2px; color: var(--text-main);">
                    📞 <b>Action:</b> ${risk.recommendation}
                  </div>
                </div>
              </div>
            `;
          })()}

          ${(() => {
            const advisory = window.OntheGoEngine ? OntheGoEngine.getOutdoorActivityAdvisory(act) : null;
            if (!advisory) return '';
            return `
              <div class="safeguard-act-alert warning" style="margin-bottom: 6px;">
                <span>🌊</span>
                <div>
                  <b>Outdoor Activity & Conditions Check:</b>
                  <div style="font-size: 0.74rem; color: var(--text-main); margin-top: 2px;">
                    ${advisory.message}
                  </div>
                  ${advisory.operatorPhone ? `
                    <div style="margin-top: 4px;">
                      <a href="tel:${advisory.operatorPhone.replace(/\\s+/g, '')}" class="btn-sm btn-primary-sm" style="font-size: 0.68rem; padding: 2px 8px;">📞 Call ${advisory.operatorName}</a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          })()}

          ${hasConflict ? `
            <div class="stop-conflict-badge">
              <span>⚠️</span>
              <div><b>Schedule Notice:</b> ${act.scheduleConflict}</div>
            </div>
          ` : ''}

          <div class="stop-desc">${act.notes || 'No road notes provided.'}</div>

          <div class="stop-verification-row">
            <div>
              ${act.isUserProvided ? `
                <span class="user-provided-badge" title="User-provided detail (not independently verified)">📝 User-Provided Booking (${act.verificationSource || 'User Details'})</span>
              ` : (act.verified ? `
                <span class="verified-badge">🟢 Verified (${act.verificationSource || 'Audited'})</span>
              ` : `
                <span class="unverified-badge">⚠️ Needs Verification</span>
              `)}
            </div>
            <div>
              ${act.cost > 0 ? `<span>💰 ₹${act.cost}</span>` : `<span>💰 Free / Prepaid</span>`}
            </div>
          </div>

          <div class="stop-actions-row">
            ${act.mapUrl ? `
              <a href="${act.mapUrl}" target="_blank" rel="noopener" class="btn-nav-action">
                🧭 Navigate (Google Maps)
              </a>
            ` : ''}

            ${act.phone ? `
              <a href="tel:${act.phone}" class="btn-call-action" title="Call ${act.phone}">
                📞 Call
              </a>
            ` : ''}

            <button type="button" class="btn-backup-action" onclick="OntheGoBackups.openForStop('${act.id}')">
              🔀 Alternatives & Backups
            </button>

            <button type="button" class="btn-sm" onclick="OntheGoJournal.openAddMemoryModal('${act.id}')" title="Attach photo or write memory for this stop">
              📷 Memory
            </button>

            <button type="button" class="btn-sm" onclick="OntheGoItinerary.toggleSkip('${act.id}')">
              ${isSkipped ? 'Unskip' : 'Skip'}
            </button>
          </div>

        </div>
      `;
    }).join("");
  },

  toggleComplete(actId, isComplete) {
    const trip = OntheGoApp.getActiveTrip();
    for (const day of trip.days) {
      const act = (day.activities || []).find(a => a.id === actId);
      if (act) {
        act.status = isComplete ? "completed" : "pending";
        act.lastModifiedAt = new Date().toISOString();
        act.lastModifiedBy = window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1";
        if (window.OntheGoCollaboration) {
          OntheGoCollaboration.recordChange({
            action: isComplete ? "completed" : "updated",
            entityType: "activity",
            entityId: act.id,
            description: `${isComplete ? 'Marked' : 'Unmarked'} "${act.title}" completed`
          });
        }
        OntheGoApp.saveState();
        this.renderCurrentDay();
        OntheGoApp.renderDashboard();
        OntheGoApp.showToast(isComplete ? `Marked "${act.title.substring(0, 24)}..." completed! 🎉` : "Stop status reset.");
        return;
      }
    }
  },

  toggleSkip(actId) {
    const trip = OntheGoApp.getActiveTrip();
    for (const day of trip.days) {
      const act = (day.activities || []).find(a => a.id === actId);
      if (act) {
        act.status = act.status === "skipped" ? "pending" : "skipped";
        act.lastModifiedAt = new Date().toISOString();
        act.lastModifiedBy = window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1";
        if (window.OntheGoCollaboration) {
          OntheGoCollaboration.recordChange({
            action: act.status === "skipped" ? "skipped" : "updated",
            entityType: "activity",
            entityId: act.id,
            description: `${act.status === "skipped" ? 'Skipped' : 'Restored'} "${act.title}"`
          });
        }
        OntheGoApp.saveState();
        this.renderCurrentDay();
        OntheGoApp.showToast(act.status === "skipped" ? "Stop marked as skipped." : "Stop restored.");
        return;
      }
    }
  },

  moveActivity(actId, direction) {
    const trip = OntheGoApp.getActiveTrip();
    const day = trip.days.find(d => d.id === this.currentDayId);
    if (!day || !day.activities) return;

    const idx = day.activities.findIndex(a => a.id === actId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= day.activities.length) return;

    // Swap
    const temp = day.activities[idx];
    day.activities[idx] = day.activities[newIdx];
    day.activities[newIdx] = temp;

    // Reassign order
    day.activities.forEach((a, i) => a.order = i + 1);

    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: "updated",
        entityType: "activity",
        entityId: actId,
        description: `Reordered itinerary stop: "${temp.title}"`
      });
    }

    OntheGoApp.saveState();
    this.renderCurrentDay();
    OntheGoApp.showToast("Itinerary order updated.");
  },

  openAddActivityModal() {
    const modal = document.getElementById("addActivityModal");
    if (!modal) return;

    const trip = OntheGoApp.getActiveTrip();
    const select = document.getElementById("newActDay");
    if (select) {
      select.innerHTML = trip.days.map(d => `
        <option value="${d.id}" ${d.id === this.currentDayId ? 'selected' : ''}>Day ${d.dayNumber}: ${d.dateHuman}</option>
      `).join("");
    }

    document.getElementById("addActModalTitle").innerText = "➕ Add Stop to Itinerary";
    document.getElementById("newActTitle").value = "";
    document.getElementById("newActTime").value = "10:00 AM";
    document.getElementById("newActLocation").value = "";
    document.getElementById("newActCost").value = "0";
    document.getElementById("newActNotes").value = "";
    this.editingActivityId = null;

    modal.classList.add("open");
  },

  openEditActivityModal(actId) {
    const trip = OntheGoApp.getActiveTrip();
    let targetAct = null;
    let targetDay = null;

    for (const d of trip.days) {
      const found = (d.activities || []).find(a => a.id === actId);
      if (found) {
        targetAct = found;
        targetDay = d;
        break;
      }
    }

    if (!targetAct) return;

    const modal = document.getElementById("addActivityModal");
    if (!modal) return;

    const select = document.getElementById("newActDay");
    if (select) {
      select.innerHTML = trip.days.map(d => `
        <option value="${d.id}" ${d.id === targetDay.id ? 'selected' : ''}>Day ${d.dayNumber}: ${d.dateHuman}</option>
      `).join("");
    }

    document.getElementById("addActModalTitle").innerText = "✏️ Edit Itinerary Stop";
    document.getElementById("newActTitle").value = targetAct.title || "";
    document.getElementById("newActTime").value = targetAct.time || "";
    document.getElementById("newActCategory").value = targetAct.category || "Sightseeing";
    document.getElementById("newActLocation").value = targetAct.location || "";
    document.getElementById("newActCost").value = targetAct.cost || 0;
    document.getElementById("newActNotes").value = targetAct.notes || "";

    this.editingActivityId = targetAct.id;
    modal.classList.add("open");
  },

  saveNewActivity(event) {
    event.preventDefault();
    const trip = OntheGoApp.getActiveTrip();
    const dayId = document.getElementById("newActDay").value;
    const title = document.getElementById("newActTitle").value;
    const time = document.getElementById("newActTime").value;
    const category = document.getElementById("newActCategory").value;
    const location = document.getElementById("newActLocation").value;
    const cost = parseFloat(document.getElementById("newActCost").value) || 0;
    const notes = document.getElementById("newActNotes").value;

    const targetDay = trip.days.find(d => d.id === dayId);
    if (!targetDay) return;

    if (this.editingActivityId) {
      // Find existing activity
      for (const d of trip.days) {
        const idx = (d.activities || []).findIndex(a => a.id === this.editingActivityId);
        if (idx !== -1) {
          const act = d.activities[idx];
          const proposedAct = { ...act, title, time, category, location, cost, notes };

          // Check if this is a material change to a confirmed booking or fixed departure
          const materialEval = window.OntheGoCollaboration ? OntheGoCollaboration.evaluateMaterialChange(act, proposedAct) : { isMaterial: false };

          if (materialEval.isMaterial) {
            OntheGoCollaboration.confirmMaterialChange(materialEval, () => {
              this.applyActivitySave(d, idx, proposedAct, dayId, targetDay, true);
            });
            return;
          }

          this.applyActivitySave(d, idx, proposedAct, dayId, targetDay, false);
          return;
        }
      }
    } else {
      const isOnline = (window.OntheGoReliability && OntheGoReliability.isOnline)
        ? OntheGoReliability.isOnline()
        : navigator.onLine;

      const newAct = {
        id: "act-custom-" + Date.now(),
        order: (targetDay.activities?.length || 0) + 1,
        title,
        time,
        category,
        location,
        lat: 9.965,
        lng: 76.242,
        cost,
        notes,
        status: "pending",
        pendingSync: !isOnline,
        verified: false,
        createdAt: new Date().toISOString(),
        lastModifiedBy: window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1",
        mapUrl: location ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}` : ""
      };
      targetDay.activities = targetDay.activities || [];
      targetDay.activities.push(newAct);

      if (!isOnline && window.OntheGoSyncEngine) {
        OntheGoSyncEngine.enqueueOperation({
          entityType: "activity",
          action: "create",
          recordId: newAct.id,
          payload: newAct
        });
      }

      if (window.OntheGoCollaboration) {
        OntheGoCollaboration.recordChange({
          action: "created",
          entityType: "activity",
          entityId: newAct.id,
          description: `Added new stop: "${title}" (${time})`
        });
      }

      OntheGoApp.showToast(isOnline ? "New stop added to itinerary! ✓" : "Offline: Stop saved locally & queued for sync 🕒");
      OntheGoApp.saveState();
      OntheGoApp.closeModals();
      this.renderCurrentDay();
      OntheGoApp.renderDashboard();
    }
  },

  applyActivitySave(d, idx, proposedAct, dayId, targetDay, wasMaterial) {
    const isOnline = (window.OntheGoReliability && OntheGoReliability.isOnline)
      ? OntheGoReliability.isOnline()
      : navigator.onLine;

    const act = d.activities[idx];
    act.title = proposedAct.title;
    act.time = proposedAct.time;
    act.category = proposedAct.category;
    act.location = proposedAct.location;
    act.cost = proposedAct.cost;
    act.notes = proposedAct.notes;
    act.pendingSync = !isOnline;
    act.lastModifiedAt = new Date().toISOString();
    act.lastModifiedBy = window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1";

    if (proposedAct.location) {
      act.mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(proposedAct.location)}`;
    }

    if (d.id !== dayId) {
      d.activities.splice(idx, 1);
      targetDay.activities = targetDay.activities || [];
      targetDay.activities.push(act);
    }

    if (!isOnline && window.OntheGoSyncEngine) {
      OntheGoSyncEngine.enqueueOperation({
        entityType: "activity",
        action: "update",
        recordId: act.id,
        payload: {
          title: act.title,
          time: act.time,
          category: act.category,
          location: act.location,
          cost: act.cost,
          notes: act.notes,
          mapUrl: act.mapUrl
        }
      });
    }

    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: wasMaterial ? "material_change" : "updated",
        entityType: "activity",
        entityId: act.id,
        description: `${wasMaterial ? '⚠️ Confirmed Material Change to' : 'Updated'} stop: "${act.title}" (${act.time})`
      });
    }

    OntheGoApp.showToast(isOnline ? (wasMaterial ? "Material change confirmed & synchronized! ⚠️" : "Stop updated successfully! ✓") : "Offline: Stop updated locally & queued for sync 🕒");
    OntheGoApp.saveState();
    OntheGoApp.closeModals();
    this.renderCurrentDay();
    OntheGoApp.renderDashboard();
  },

  restoreOriginalItinerary() {
    if (!confirm("Are you sure you want to restore the original baseline itinerary? All custom edits to stops will be reset to the verified master plan.")) {
      return;
    }
    const baseline = JSON.parse(JSON.stringify(window.OntheGoDefaultData));
    const activeTripId = OntheGoApp.state.activeTripId;
    const baselineTrip = baseline.trips.find(t => t.id === activeTripId) || baseline.trips[0];

    // Preserve expenses and checklist if desired, or restore days
    const currentTrip = OntheGoApp.getActiveTrip();
    currentTrip.days = baselineTrip.days;
    OntheGoApp.saveState();
    this.init();
    OntheGoApp.renderDashboard();
    OntheGoApp.showToast("Master baseline itinerary restored! 🔄");
  }
};
