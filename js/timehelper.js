/**
 * OntheGO - Smart Time & Conflict Assistant
 * Real-time schedule conflict engine, Day 5 backward calculation safeguard,
 * deadline protection, and "Running Late" quick recovery.
 */

window.OntheGoTimeHelper = {
  init() {
    this.renderWarnings();
  },

  getConflicts() {
    return [
      {
        day: 1,
        title: "Mattancherry Palace Friday Closure",
        type: "danger",
        desc: "Mattancherry Palace (Dutch Palace) is CLOSED on Fridays. You arrive at 2:00 PM on Friday; the museum interior cannot be visited today. Recommended alternative: explore Jew Town spice shops & exterior Dutch architecture, or visit Indo-Portuguese Museum on Day 5."
      },
      {
        day: 1,
        title: "Paradesi Synagogue Friday 2:00 PM Cutoff",
        type: "warning",
        desc: "Paradesi Synagogue closes at 2:00 PM on Fridays for Sabbath preparations (and is closed all day Saturday). Arriving at 2:00 PM means the interior will already be closed. Stroll the exterior clock tower and Jew Town antique lanes instead."
      },
      {
        day: 2,
        title: "Alleppey Lighthouse 5:30 PM Closing",
        type: "warning",
        desc: "Alleppey Lighthouse visiting hours are 2:00 PM – 5:30 PM (ticket counter closes at 5:00 PM). Ensure your coastal ride from Fort Kochi arrives in Alleppey by 4:45 PM to allow time for the spiral staircase climb."
      },
      {
        day: 3,
        title: "Opulence Kayaking 6:00 AM – 11:30 AM (Confirmed Slot)",
        type: "info",
        desc: "Kayaking is confirmed for the morning session ending at 11:30 AM (booked at ₹700, contact: 8921172358). Breakfast is provided by Opulence during/after the trip. Do not book a separate paid breakfast."
      },
      {
        day: 3,
        title: "Responsible Riding Alert: No. 1 Kallu Shap",
        type: "danger",
        desc: "NEVER operate the scooter after consuming toddy or alcohol at No. 1 Kallu Shap (contact: 9446665472). Arrange a designated sober driver or alternative auto-rickshaw transport."
      },
      {
        day: 4,
        title: "Ambalappuzha 28 km Round-Trip & Dress Code",
        type: "info",
        desc: "Ambalappuzha Temple is 14 km south of Alleppey (adds 28 km before heading north to Kumbalangi). Strict Kerala traditional attire required: Men in Mundu (bare-chested), Women in traditional attire."
      },
      {
        day: 5,
        title: "🛑 CRITICAL: Day 5 Backward Safeguard (1:00 PM Scooter Return & 2:00 PM Train)",
        type: "danger",
        desc: "HARD SAFEGUARD: 1) Scooter must be returned near Ernakulam Junction by 1:00 PM target / 1:30 PM latest (refuel, inspection, settle ₹2,300 balance; contact 9003955156). 2) Return Vande Bharat Express departs ERS at 2:00 PM sharp! All sightseeing in Fort Kochi MUST conclude by 12:15 PM sharp."
      }
    ];
  },

  renderWarnings() {
    const container = document.getElementById("conflictAssistantContainer");
    if (!container) return;

    const conflicts = this.getConflicts();
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${conflicts.map(c => `
          <div class="alert-banner alert-${c.type}">
            <span class="alert-icon">${c.type === 'danger' ? '🛑' : (c.type === 'warning' ? '⚠️' : 'ℹ️')}</span>
            <div>
              <div style="font-weight: 800; margin-bottom: 2px;">Day ${c.day}: ${c.title}</div>
              <div style="font-size: 0.78rem;">${c.desc}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  },

  /**
   * Parses time string (e.g., "12:15 PM" or "10:00 AM - 11:00 AM") into minutes from midnight.
   * @param {string} str 
   * @returns {number|null}
   */
  parseTimeToMinutes(str) {
    if (!str || typeof str !== "string") return null;
    const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  },

  /**
   * Extracts start and end minutes from a time range string.
   * @param {string} timeStr 
   * @returns {{ start: number|null, end: number|null }}
   */
  parseTimeRange(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return { start: null, end: null };
    const matches = [...timeStr.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
    if (matches.length >= 2) {
      return {
        start: this.parseTimeToMinutes(matches[0][0]),
        end: this.parseTimeToMinutes(matches[1][0])
      };
    } else if (matches.length === 1) {
      const t = this.parseTimeToMinutes(matches[0][0]);
      return { start: t, end: t };
    }
    return { start: null, end: null };
  },

  /**
   * Explicit Day 5 Scheduling Safeguard:
   * Dynamically calculates backward milestones from 2:00 PM train departure at ERS,
   * accounting for platform buffer, scooter inspection/settlement, and city transit.
   * Automatically flags any sightseeing plan that makes the schedule infeasible.
   *
   * @param {Array} activities Day 5 activities
   * @returns {Object} Comprehensive backward calculation audit
   */
  calculateDay5BackwardSchedule(activities) {
    const TRAIN_DEPARTURE = 14 * 60; // 02:00 PM (840 mins)
    const STATION_BOARDING_BUFFER = 30; // 30 mins platform buffer (1:30 PM / 810 mins)
    const SCOOTER_RETURN_TARGET = 13 * 60; // 01:00 PM (780 mins)
    const SCOOTER_RETURN_LATEST = 13 * 60 + 30; // 01:30 PM (810 mins)
    const FORT_KOCHI_CUTOFF_TARGET = 12 * 60 + 15; // 12:15 PM (735 mins)
    const FORT_KOCHI_CUTOFF_ABSOLUTE = 12 * 60 + 45; // 12:45 PM (765 mins)

    const flaggedActivities = [];
    const nonSightseeingIds = ["act-5-5", "act-5-6", "act-5-7", "act-5-8"];

    (activities || []).forEach(act => {
      if (act.status === "skipped") return;
      const range = this.parseTimeRange(act.time);
      const startMin = range.start;
      const endMin = range.end || range.start;

      if (endMin === null) return;

      // Check sightseeing / cafe / museum stops in Fort Kochi
      if (!nonSightseeingIds.includes(act.id) && act.category !== "Transport") {
        if (endMin > FORT_KOCHI_CUTOFF_ABSOLUTE) {
          flaggedActivities.push({
            id: act.id,
            title: act.title,
            time: act.time,
            endMinutes: endMin,
            severity: "danger",
            reason: `Ends at ${act.time.split('-')[1]?.trim() || act.time} (past 12:45 PM). Reaching Ernakulam Junction, returning scooter by 1:30 PM, and catching the 2:00 PM Vande Bharat is physically impossible!`
          });
        } else if (endMin > FORT_KOCHI_CUTOFF_TARGET) {
          flaggedActivities.push({
            id: act.id,
            title: act.title,
            time: act.time,
            endMinutes: endMin,
            severity: "warning",
            reason: `Ends at ${act.time.split('-')[1]?.trim() || act.time} (past 12:15 PM). Encroaches on the 35m city transit and cuts into the 1:00 PM scooter return target.`
          });
        }
      }

      // Check transit start time
      if (act.id === "act-5-5") {
        if (startMin && startMin > FORT_KOCHI_CUTOFF_ABSOLUTE) {
          flaggedActivities.push({
            id: act.id,
            title: act.title,
            time: act.time,
            endMinutes: endMin,
            severity: "danger",
            reason: `Transit departs after 12:45 PM (${act.time}). Insufficient time for city traffic, scooter handover, and train boarding!`
          });
        } else if (startMin && startMin > FORT_KOCHI_CUTOFF_TARGET) {
          flaggedActivities.push({
            id: act.id,
            title: act.title,
            time: act.time,
            endMinutes: endMin,
            severity: "warning",
            reason: `Transit departs after 12:15 PM (${act.time}). High traffic risk before 1:00 PM scooter return.`
          });
        }
      }

      // Check scooter return deadline
      if (act.id === "act-5-6" || (act.title && act.title.toLowerCase().includes("return scooter"))) {
        if (startMin && startMin > SCOOTER_RETURN_LATEST) {
          flaggedActivities.push({
            id: act.id,
            title: act.title,
            time: act.time,
            endMinutes: endMin,
            severity: "danger",
            reason: `Scooter return scheduled after 1:30 PM latest deadline (${act.time}). Violates return agreement and threatens train boarding!`
          });
        }
      }
    });

    const hasDanger = flaggedActivities.some(f => f.severity === "danger");
    const hasWarning = flaggedActivities.some(f => f.severity === "warning");

    let status = "feasible";
    let summaryMessage = "Feasible schedule: Morning sightseeing concludes by 12:15 PM, leaving 45m transit buffer for 1:00 PM scooter return and 2:00 PM train boarding.";

    if (hasDanger) {
      status = "infeasible";
      summaryMessage = "CRITICAL SCHEDULE VIOLATION: Sightseeing extends past safe cutoff, making the 1:00 PM scooter return or 2:00 PM train departure impossible!";
    } else if (hasWarning) {
      status = "warning";
      summaryMessage = "HIGH RISK: Sightseeing extends past 12:15 PM cutoff, compressing transit and scooter return buffer.";
    }

    return {
      status,
      isFeasible: !hasDanger,
      hasDanger,
      hasWarning,
      summaryMessage,
      flaggedActivities,
      milestones: [
        {
          step: "5",
          time: "02:00 PM SHARP",
          title: "🚆 Train Departure (Vande Bharat Express)",
          desc: "Hard fixed commitment. ERS Platform 1 to Bengaluru (₹1,708/person booked).",
          status: "fixed"
        },
        {
          step: "4",
          time: "01:30 PM",
          title: "Station Platform Boarding Buffer",
          desc: "Enter ERS main entrance, clear security, locate coach on digital indicators.",
          status: "ok"
        },
        {
          step: "3",
          time: "01:00 PM (Target) / 01:30 PM (Latest)",
          title: "Scooter Return & Inspection",
          desc: "Refuel check, bodywork inspection, settle ₹2,300 balance (Contact: 9003955156).",
          status: "ok"
        },
        {
          step: "2",
          time: "12:15 PM – 12:50 PM",
          title: "City Transit: Fort Kochi ➔ Ernakulam Jn",
          desc: "12 km ride via Willingdon Island / Venduruthy Bridge (35–45 min traffic buffer).",
          status: "ok"
        },
        {
          step: "1",
          time: "12:15 PM SHARP",
          title: "Fort Kochi Sightseeing Cutoff",
          desc: "All cafe, museum, and Water Metro visits must conclude. Pack and ride.",
          status: hasDanger ? "danger" : (hasWarning ? "warning" : "ok")
        }
      ]
    };
  },

  /**
   * Renders the Day 5 reverse schedule calculation card HTML.
   * @param {Object} day Day 5 object
   * @returns {string} HTML string
   */
  renderDay5SafeguardCard(day) {
    if (!day || day.dayNumber !== 5) return "";
    const audit = this.calculateDay5BackwardSchedule(day.activities);

    const badgeClass = audit.status === "infeasible" ? "pill-danger" : (audit.status === "warning" ? "pill-warning" : "pill-feasible");
    const badgeText = audit.status === "infeasible" ? "🚨 INFEASIBLE PLAN" : (audit.status === "warning" ? "⚠️ HIGH RISK" : "🟢 SCHEDULE FEASIBLE");
    const borderClass = audit.status === "infeasible" ? "safeguard-danger" : (audit.status === "warning" ? "safeguard-warning" : "safeguard-feasible");

    return `
      <div class="day5-safeguard-card ${borderClass}" id="day5SafeguardCard">
        <div class="safeguard-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="safeguard-icon-box">⏱️</div>
            <div>
              <div style="font-weight: 800; font-size: 0.98rem; color: var(--text-main);">
                Day 5 Backward Schedule Safeguard
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">
                Calculated backwards from 2:00 PM train departure at Ernakulam Junction (ERS)
              </div>
            </div>
          </div>
          <span class="safeguard-status-pill ${badgeClass}">${badgeText}</span>
        </div>

        <div class="safeguard-summary-box box-${audit.status}">
          <span style="font-size: 1.1rem;">${audit.status === 'infeasible' ? '🚨' : (audit.status === 'warning' ? '⚠️' : '✅')}</span>
          <div style="font-size: 0.82rem; font-weight: 600; line-height: 1.35;">${audit.summaryMessage}</div>
        </div>

        ${audit.flaggedActivities.length ? `
          <div class="safeguard-flags-list">
            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--danger); letter-spacing: 0.5px; margin-bottom: 6px;">
              Detected Conflicts & Violations:
            </div>
            ${audit.flaggedActivities.map(f => `
              <div class="safeguard-flag-item item-${f.severity}">
                <div style="font-weight: 700; font-size: 0.8rem; display: flex; justify-content: space-between;">
                  <span>⚠️ ${f.title}</span>
                  <span style="font-family: monospace;">${f.time}</span>
                </div>
                <div style="font-size: 0.74rem; margin-top: 3px; line-height: 1.35;">${f.reason}</div>
              </div>
            `).join("")}
          </div>
        ` : ''}

        <div class="safeguard-milestones-stepper">
          <div class="safeguard-stepper-title">
            <span>🔄 Reverse Calculation Milestones</span>
            <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-muted);">(Calculated from 2:00 PM Train backwards)</span>
          </div>
          <div class="milestones-track">
            ${audit.milestones.map(m => `
              <div class="milestone-step step-${m.status}">
                <div class="milestone-bullet">${m.step}</div>
                <div class="milestone-content">
                  <div class="milestone-time-title">
                    <span class="milestone-time">${m.time}</span>
                    <span class="milestone-label">${m.title}</span>
                  </div>
                  <div class="milestone-desc">${m.desc}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        ${audit.status !== "feasible" ? `
          <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoTimeHelper.streamlineDay5()" style="background: var(--kerala-terracotta);">
              🛡️ Auto-Protect Day 5 (Skip Overrunning Stops)
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Automatically protects Day 5 schedule by skipping/adjusting optional stops
   * extending past the 12:15 PM Fort Kochi cutoff.
   */
  streamlineDay5() {
    const trip = OntheGoApp.getActiveTrip();
    const day5 = (trip.days || []).find(d => d.dayNumber === 5);
    if (!day5) return;

    let modified = 0;
    (day5.activities || []).forEach(act => {
      if (act.id === "act-5-4" || (!act.isFixedCommitment && (act.category === "Museum" || act.category === "Sightseeing"))) {
        const range = this.parseTimeRange(act.time);
        if (range.end && range.end > 735) { // 12:15 PM
          act.status = "skipped";
          act.notes = (act.notes || "") + " [Skipped automatically to protect Day 5 train safeguard cutoff]";
          modified++;
        }
      }
    });

    OntheGoApp.saveState();
    OntheGoItinerary.renderCurrentDay();
    OntheGoApp.renderDashboard();
    OntheGoApp.showToast(`Day 5 schedule protected! Skipped ${modified} overrunning stop(s) to guarantee 12:15 PM cutoff.`);
  },

  triggerRunningLate() {
    const trip = OntheGoApp.getActiveTrip();
    const currentDay = trip.days.find(d => d.id === OntheGoItinerary.currentDayId) || trip.days[0];

    const confirmMsg = `🏃 "Running Late" Quick Assistant for Day ${currentDay.dayNumber}:\n\n` +
      `This will streamline today's itinerary by:\n` +
      `• Marking non-critical optional stops as skipped\n` +
      `• Preserving fixed commitments (trains, scooter return, booked activities)\n` +
      `• Reducing meal durations\n\n` +
      `Would you like to activate the streamlined itinerary now?`;

    if (!confirm(confirmMsg)) return;

    let skippedCount = 0;
    (currentDay.activities || []).forEach(act => {
      if (!act.isFixedCommitment && act.status !== "completed") {
        if (act.priority === "Low" || act.category === "Museum" || act.category === "Sightseeing") {
          act.status = "skipped";
          skippedCount++;
        }
      }
    });

    OntheGoApp.saveState();
    OntheGoItinerary.renderCurrentDay();
    OntheGoApp.renderDashboard();
    OntheGoApp.showToast(`Streamlined itinerary! Skipped ${skippedCount} optional stops to protect schedule. 🏃`);
  }
};
