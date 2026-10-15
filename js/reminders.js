/**
 * OntheGO - Stage 3: Departure & Activity Reminders Engine
 * Handles time-zone aware notifications, lead times, quiet hours,
 * duplicate prevention, snoozing, dismissal, and Web Notification API.
 */

window.OntheGoReminders = {
  checkInterval: null,
  TIMEZONE: "Asia/Kolkata",

  init() {
    this.ensureRemindersState();
    this.syncItineraryReminders();
    this.startReminderLoop();
  },

  ensureRemindersState() {
    if (!OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.reminders)) {
      OntheGoApp.state.reminders = [];
    }
    if (!OntheGoApp.state.reminderSettings) {
      OntheGoApp.state.reminderSettings = {
        enabled: true,
        defaultLeadMins: 30,
        quietHoursEnabled: true,
        quietHoursStart: "22:30",
        quietHoursEnd: "06:30",
        timeZone: "Asia/Kolkata"
      };
    }
  },

  /**
   * Requests device notification permissions from user.
   */
  async requestNotificationPermission() {
    if (!("Notification" in window)) {
      OntheGoApp.showToast("Browser does not support desktop notifications. In-app alerts will be used.");
      return "unsupported";
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        OntheGoApp.showToast("🔔 Device notifications enabled for OntheGO!");
        this.sendNativeNotification("OntheGO Reminders Active", {
          body: "You will receive timely alerts for departures, check-ins, and bookings."
        });
      } else {
        OntheGoApp.showToast("Notification permission denied. OntheGO will use in-app alerts.");
      }
      return permission;
    } catch (e) {
      console.warn("Notification permission error:", e);
      return "denied";
    }
  },

  /**
   * Generates or synchronizes reminders from active trip activities and fixed commitments.
   */
  syncItineraryReminders() {
    const trip = OntheGoApp.getActiveTrip();
    if (!trip || !trip.days) return;

    this.ensureRemindersState();
    const existing = OntheGoApp.state.reminders;
    const existingMap = new Map(existing.map(r => [r.id, r]));

    // Hard constraints and fixed commitments lead times
    trip.days.forEach(day => {
      const dateStr = day.isoDate || "2026-10-16";
      (day.activities || []).forEach(act => {
        const timeParsed = this.parseTimeOnDate(act.time, dateStr);
        if (!timeParsed) return;

        let category = "activity";
        let leadMins = OntheGoApp.state.reminderSettings.defaultLeadMins || 30;
        let isHardConstraint = false;

        if (act.isFixedCommitment || act.id === "act-5-8" || act.id === "act-1-1") {
          category = "departure";
          leadMins = 60; // 1 hr buffer for train departure/arrival
          isHardConstraint = true;
        } else if (act.category === "Accommodation" || act.title.toLowerCase().includes("check in")) {
          category = "checkin";
          leadMins = 45;
          isHardConstraint = true;
        } else if (act.id === "act-3-1") {
          category = "booking_deadline";
          leadMins = 45;
          isHardConstraint = true;
        } else if (act.id === "act-5-6") {
          category = "booking_deadline"; // Scooter return
          leadMins = 60;
          isHardConstraint = true;
        }

        const reminderId = `rem-${act.id}`;
        if (!existingMap.has(reminderId)) {
          existing.push({
            id: reminderId,
            activityId: act.id,
            title: act.title,
            scheduledTime: timeParsed.toISOString(),
            triggerMinutesBefore: leadMins,
            category,
            status: "scheduled",
            isHardConstraint
          });
        }
      });
    });

    OntheGoApp.saveState();
  },

  /**
   * Helper to parse time strings like "2:00 PM" into Date on given ISO date.
   */
  parseTimeOnDate(timeStr, dateStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = (match[3] || "").toUpperCase();

    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    const [y, m, d] = dateStr.split("-").map(Number);
    // In IST (UTC+5:30)
    const date = new Date(Date.UTC(y, m - 1, d, hour - 5, minute - 30));
    return isNaN(date.getTime()) ? null : date;
  },

  /**
   * Periodic reminder evaluation loop.
   */
  startReminderLoop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    // Run evaluation every 30 seconds
    this.checkInterval = setInterval(() => {
      this.evaluatePendingReminders();
    }, 30000);

    // Run immediate check
    this.evaluatePendingReminders();
  },

  /**
   * Checks all scheduled reminders against simulated or real local time.
   */
  evaluatePendingReminders(mockNowDate = null) {
    if (!OntheGoApp.state || !OntheGoApp.state.reminderSettings?.enabled) return;

    const now = mockNowDate || new Date();
    const reminders = OntheGoApp.state.reminders || [];
    const isQuiet = this.isInQuietHours(now);

    reminders.forEach(rem => {
      if (rem.status === "dismissed") return;

      const schedDate = new Date(rem.scheduledTime);
      const leadMs = (rem.triggerMinutesBefore || 30) * 60 * 1000;
      const fireThresholdMs = schedDate.getTime() - leadMs;

      // Handle snoozed reminders
      if (rem.status === "snoozed" && rem.snoozedUntil) {
        const snoozeDate = new Date(rem.snoozedUntil);
        if (now >= snoozeDate) {
          this.triggerReminder(rem, isQuiet);
        }
        return;
      }

      // Handle scheduled reminders
      if (rem.status === "scheduled") {
        if (now.getTime() >= fireThresholdMs) {
          this.triggerReminder(rem, isQuiet);
        }
      }
    });
  },

  /**
   * Checks if a date falls within quiet hours (e.g. 22:30 to 06:30).
   */
  isInQuietHours(date) {
    const settings = OntheGoApp.state?.reminderSettings;
    if (!settings || !settings.quietHoursEnabled) return false;

    const [startH, startM] = (settings.quietHoursStart || "22:30").split(":").map(Number);
    const [endH, endM] = (settings.quietHoursEnd || "06:30").split(":").map(Number);

    const currentH = date.getHours();
    const currentM = date.getMinutes();
    const currentVal = currentH * 60 + currentM;
    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;

    if (startVal > endVal) {
      // Overnight quiet hours (e.g. 22:30 to 06:30)
      return currentVal >= startVal || currentVal < endVal;
    } else {
      return currentVal >= startVal && currentVal < endVal;
    }
  },

  /**
   * Fires a reminder if not muted by quiet hours (hard constraints bypass quiet hours).
   */
  triggerReminder(rem, isQuiet) {
    // Duplicate prevention: if already fired, skip
    if (rem.status === "fired") return;

    if (isQuiet && !rem.isHardConstraint) {
      rem.isQuietHourMuted = true;
      return;
    }

    rem.status = "fired";
    rem.lastFiredAt = new Date().toISOString();
    OntheGoApp.saveState();

    // Create an actionable in-app notification
    this.createActionableNotification({
      type: rem.category === "departure" ? "departure_reminder" : "booking_deadline",
      title: `🔔 Upcoming: ${rem.title}`,
      reason: `Scheduled in ${rem.triggerMinutesBefore} mins (${new Date(rem.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST)`,
      relevantTime: rem.scheduledTime,
      source: rem.isHardConstraint ? "Fixed Commitment Safeguard" : "OntheGO Scheduler",
      recommendedActionText: `Prepare for ${rem.title}. Check directions and booking documents.`,
      actionPayload: { reminderId: rem.id }
    });

    // Send native desktop/mobile notification
    this.sendNativeNotification(`OntheGO: ${rem.title}`, {
      body: `Starts in ${rem.triggerMinutesBefore} mins! ${rem.isHardConstraint ? '⚠️ Hard Constraint: Boarding / Check-in deadline.' : ''}`
    });

    this.renderRemindersUI();
  },

  /**
   * Creates structured notification in notifications store (Component 6).
   */
  createActionableNotification({ type, title, reason, relevantTime, source, recommendedActionText, actionPayload }) {
    if (!OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.notifications)) {
      OntheGoApp.state.notifications = [];
    }

    // Avoid duplicate active notifications with the exact same title & reason
    const existing = OntheGoApp.state.notifications.find(n => n.title === title && n.status === "active");
    if (existing) return;

    const notif = {
      id: "notif-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      type: type || "departure_reminder",
      title,
      reason,
      relevantTime: relevantTime || new Date().toISOString(),
      source: source || "OntheGO Engine",
      recommendedActionText: recommendedActionText || "Review itinerary details.",
      actionPayload: actionPayload || {},
      timestamp: new Date().toISOString(),
      status: "active"
    };

    OntheGoApp.state.notifications.unshift(notif);
    // Cap notifications at 50
    if (OntheGoApp.state.notifications.length > 50) {
      OntheGoApp.state.notifications = OntheGoApp.state.notifications.slice(0, 50);
    }

    OntheGoApp.saveState();
    OntheGoApp.showToast(`${title}`);
    this.renderNotificationBadge();
    this.renderActionableNotificationsBanner();
  },

  /**
   * Snoozes a reminder by a specific duration (default 15 mins).
   */
  snoozeReminder(reminderId, minutes = 15) {
    const rem = (OntheGoApp.state.reminders || []).find(r => r.id === reminderId);
    if (!rem) return;

    const snoozeTarget = new Date(Date.now() + minutes * 60 * 1000);
    rem.status = "snoozed";
    rem.snoozedUntil = snoozeTarget.toISOString();
    OntheGoApp.saveState();

    OntheGoApp.showToast(`Snoozed "${rem.title}" for ${minutes} mins. ⏰`);
    this.renderRemindersUI();
    this.renderActionableNotificationsBanner();
  },

  /**
   * Dismisses a reminder.
   */
  dismissReminder(reminderId) {
    const rem = (OntheGoApp.state.reminders || []).find(r => r.id === reminderId);
    if (!rem) return;

    rem.status = "dismissed";
    OntheGoApp.saveState();
    OntheGoApp.showToast(`Dismissed reminder for "${rem.title}".`);
    this.renderRemindersUI();
    this.renderActionableNotificationsBanner();
  },

  /**
   * Accepts, dismisses, or snoozes an actionable notification.
   */
  handleNotificationAction(notifId, action) {
    const notifs = OntheGoApp.state?.notifications || [];
    const notif = notifs.find(n => n.id === notifId);
    if (!notif) return;

    if (action === "accept") {
      notif.status = "accepted";
      if (notif.actionPayload?.recommendationId && window.OntheGoEngine) {
        OntheGoEngine.applyRecommendation(notif.actionPayload.recommendationId);
      } else {
        OntheGoApp.showToast(`Accepted recommendation: "${notif.title}"`);
      }
    } else if (action === "snooze") {
      notif.status = "snoozed";
      notif.snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      OntheGoApp.showToast(`Snoozed notification for 15 mins.`);
    } else {
      notif.status = "dismissed";
      OntheGoApp.showToast("Notification dismissed.");
    }

    OntheGoApp.saveState();
    this.renderNotificationBadge();
    this.renderActionableNotificationsBanner();
  },

  sendNativeNotification(title, options) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          icon: "./icon.png",
          badge: "./icon.png",
          ...options
        });
      } catch (e) {
        console.warn("Could not dispatch native notification:", e);
      }
    }
  },

  /**
   * Updates notification bell badge in app header.
   */
  renderNotificationBadge() {
    const notifs = OntheGoApp.state?.notifications || [];
    const activeCount = notifs.filter(n => n.status === "active").length;
    const badge = document.getElementById("headerNotifBadge");
    if (badge) {
      if (activeCount > 0) {
        badge.innerText = activeCount;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
  },

  /**
   * Renders high-priority actionable notification banner in Today Dashboard.
   */
  renderActionableNotificationsBanner() {
    const container = document.getElementById("dashActionableNotifsContainer");
    if (!container) return;

    const notifs = OntheGoApp.state?.notifications || [];
    const activeNotifs = notifs.filter(n => n.status === "active");

    if (!activeNotifs.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = activeNotifs.slice(0, 3).map(n => `
      <div class="alert-banner alert-warning" style="margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">${n.type === 'delay' ? '⏱️' : n.type === 'weather_disruption' ? '🌊' : '🔔'}</span>
            <div>
              <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${n.title}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${n.source} • ${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</div>
            </div>
          </div>
          <button type="button" class="icon-btn" style="width: 24px; height: 24px;" onclick="OntheGoReminders.handleNotificationAction('${n.id}', 'dismiss')">✕</button>
        </div>

        <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin: 0;">
          <b>Reason:</b> ${n.reason}
        </p>

        <div style="font-size: 0.76rem; background: rgba(0,0,0,0.03); padding: 6px 8px; border-radius: var(--radius-xs); color: var(--text-main);">
          💡 <b>Recommended Action:</b> ${n.recommendedActionText}
        </div>

        <div class="stop-actions-row" style="margin-top: 4px;">
          <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoReminders.handleNotificationAction('${n.id}', 'accept')">
            ✓ Accept & Apply
          </button>
          <button type="button" class="btn-sm" onclick="OntheGoReminders.handleNotificationAction('${n.id}', 'snooze')">
            ⏰ Postpone 15m
          </button>
          <button type="button" class="btn-sm" onclick="OntheGoReminders.handleNotificationAction('${n.id}', 'dismiss')">
            ✕ Dismiss
          </button>
        </div>
      </div>
    `).join("");
  },

  /**
   * Renders the Reminders Configuration & History Hub.
   */
  renderRemindersUI() {
    const container = document.getElementById("remindersListContainer");
    if (!container) return;

    this.ensureRemindersState();
    const reminders = OntheGoApp.state.reminders || [];
    const settings = OntheGoApp.state.reminderSettings;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Reminder Settings Card -->
        <div class="stop-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <h4 style="margin: 0; font-size: 0.92rem; font-weight: 800;">🔔 Reminder Preferences</h4>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0;">Time-zone aware (IST / Asia/Kolkata)</p>
            </div>
            <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoReminders.requestNotificationPermission()">
              Enable Device Push
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.76rem;">
            <div>
              <label class="form-label">Default Lead Time</label>
              <select class="form-select" onchange="OntheGoReminders.updateDefaultLead(this.value)">
                <option value="15" ${settings.defaultLeadMins === 15 ? 'selected' : ''}>15 mins before</option>
                <option value="30" ${settings.defaultLeadMins === 30 ? 'selected' : ''}>30 mins before</option>
                <option value="45" ${settings.defaultLeadMins === 45 ? 'selected' : ''}>45 mins before</option>
                <option value="60" ${settings.defaultLeadMins === 60 ? 'selected' : ''}>60 mins before</option>
              </select>
            </div>
            <div>
              <label class="form-label">Quiet Hours (Mute Non-Critical)</label>
              <div style="font-size: 0.76rem; color: var(--text-main); padding-top: 6px;">
                🌙 ${settings.quietHoursStart} - ${settings.quietHoursEnd}
              </div>
            </div>
          </div>
        </div>

        <!-- Reminders List -->
        <div class="stop-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; font-size: 0.92rem; font-weight: 800;">Scheduled Trip Reminders</h4>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${reminders.length} tracked</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto;">
            ${!reminders.length ? `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 16px;">
                No scheduled reminders yet. Synchronizing from your active itinerary.
              </div>
            ` : reminders.map(r => {
              const sched = new Date(r.scheduledTime);
              const schedTimeStr = sched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const schedDateStr = sched.toLocaleDateString([], { month: 'short', day: 'numeric' });

              return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.76rem;">
                  <div>
                    <div style="font-weight: 700; color: var(--text-main);">
                      ${r.isHardConstraint ? '⚠️ ' : ''}${r.title}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 2px;">
                      🗓️ ${schedDateStr} at ${schedTimeStr} • Lead: ${r.triggerMinutesBefore}m before
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="split-tag ${r.status === 'fired' ? 'tag-settle' : r.status === 'snoozed' ? 'tag-custom' : 'tag-equal'}">
                      ${r.status}
                    </span>
                    ${r.status !== 'dismissed' ? `
                      <button type="button" class="btn-sm" style="padding: 2px 6px; font-size: 0.68rem;" onclick="OntheGoReminders.snoozeReminder('${r.id}', 15)" title="Snooze 15m">⏰</button>
                      <button type="button" class="btn-sm" style="padding: 2px 6px; font-size: 0.68rem;" onclick="OntheGoReminders.dismissReminder('${r.id}')" title="Dismiss">✕</button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  },

  updateDefaultLead(mins) {
    if (!OntheGoApp.state.reminderSettings) return;
    OntheGoApp.state.reminderSettings.defaultLeadMins = parseInt(mins, 10) || 30;
    OntheGoApp.saveState();
    OntheGoApp.showToast(`Updated default reminder lead to ${mins} minutes.`);
  }
};
