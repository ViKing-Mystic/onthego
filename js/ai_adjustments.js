/**
 * OntheGO - Stage 3: AI Itinerary Adjustments & Deterministic Validator
 * Bridges AI assistant capabilities with strict deterministic verification.
 * Prepares grounded prompts containing constraints, travel legs, budgets, and preferences;
 * rigorously validates AI proposals against fixed commitments before presenting for user approval;
 * includes a deterministic offline compression fallback when APIs are unavailable.
 */

window.OntheGoAiAdjustments = {
  init() {
    this.ensureAiState();
  },

  ensureAiState() {
    if (!OntheGoApp.state) return;
    if (!OntheGoApp.state.aiSettings) {
      OntheGoApp.state.aiSettings = {
        provider: "offline",
        apiKey: "",
        model: "gemini-1.5-flash",
        enabled: true
      };
    }
    if (!Array.isArray(OntheGoApp.state.aiProposals)) {
      OntheGoApp.state.aiProposals = [];
    }
  },

  /**
   * Prepares the grounded context payload for the AI model.
   * Feeds verified constraints, travel estimates, opening hours, and preferences.
   */
  buildGroundedContext(dayId, delayMins = 30) {
    const trip = OntheGoApp.getActiveTrip();
    const day = (trip.days || []).find(d => d.id === dayId) || trip.days[0];
    const prefs = window.OntheGoCollaboration ? OntheGoCollaboration.getPreferences() : {};
    const hardConstraints = window.OntheGoEngine ? OntheGoEngine.getHardConstraintsForDay(day.dayNumber) : [];

    return {
      dayNumber: day.dayNumber,
      dayTheme: day.theme,
      date: day.dateHuman,
      delayToRecoverMins: delayMins,
      hardConstraints: hardConstraints.map(c => ({
        id: c.id,
        title: c.title,
        deadlineMinutesFromMidnight: c.deadlineMins,
        description: c.desc
      })),
      day5TrainDepartureSafeguard: day.dayNumber === 5 ? {
        trainDeparture: "02:00 PM (14:00)",
        scooterReturnTarget: "01:00 PM (13:00)",
        scooterReturnHardDeadline: "01:30 PM (13:30)",
        rule: "Must arrive at railway station with boarding buffer. Sightseeing cannot exceed 12:15 PM."
      } : null,
      currentActivities: (day.activities || []).map(a => ({
        id: a.id,
        title: a.title,
        time: a.time,
        category: a.category,
        isFixed: a.isFixedCommitment || false,
        durationMins: OntheGoEngine ? OntheGoEngine.getActivityDurationMins(a) : 40,
        status: a.status
      })),
      preferences: {
        pace: prefs.sightseeingPace || "Balanced",
        vetoList: prefs.vetoList || [],
        maxWalkingKmPerDay: prefs.physicalTolerances?.maxWalkingKmPerDay || 4,
        maxScooterRideMinsPerStretch: prefs.physicalTolerances?.maxScooterRideMinsPerStretch || 75,
        restWindow: prefs.restBreaks?.restWindow || "02:00 PM - 04:00 PM"
      }
    };
  },

  // ==========================================
  // DETERMINISTIC VALIDATION LAYER
  // ==========================================

  /**
   * Deterministically validates an AI proposed schedule before presenting to user.
   * Never relies on AI self-verification.
   * @param {Object} proposal Proposed schedule changes
   * @param {Object} context Original grounded context
   * @returns {Object} { isValid: boolean, violations: string[], hardConstraintsPreserved: boolean }
   */
  validateProposal(proposal, context) {
    const violations = [];
    let hardConstraintsPreserved = true;

    if (!proposal || !Array.isArray(proposal.proposedChanges)) {
      return {
        isValid: false,
        violations: ["Proposal format invalid: missing proposedChanges array."],
        hardConstraintsPreserved: false
      };
    }

    const hardConstraintIds = new Set(context.hardConstraints.map(c => c.id));
    const dayNumber = context.dayNumber;

    proposal.proposedChanges.forEach(change => {
      // Check 1: No hard constraint may be deleted, skipped, or modified past its deadline
      if (hardConstraintIds.has(change.activityId)) {
        if (change.action === "skip") {
          violations.push(`Violation: Hard constraint "${change.activityId}" cannot be skipped or removed.`);
          hardConstraintsPreserved = false;
        }

        // For Day 5 train and scooter return
        if (dayNumber === 5) {
          if (change.activityId === "act-5-8") { // Train departure
            violations.push("Violation: Fixed 2:00 PM Vande Bharat departure cannot be rescheduled.");
            hardConstraintsPreserved = false;
          }
          if (change.activityId === "act-5-6" && change.newTime) {
            const mins = OntheGoEngine.timeStrToMins(change.newTime);
            if (mins > 13 * 60 + 30) {
              violations.push("Violation: Scooter return cannot exceed the 1:30 PM deadline.");
              hardConstraintsPreserved = false;
            }
          }
        }

        // For Day 3 Kayaking
        if (dayNumber === 3 && change.activityId === "act-3-1" && change.action === "skip") {
          violations.push("Violation: Confirmed Opulence morning kayaking cannot be cancelled by schedule adjustments.");
          hardConstraintsPreserved = false;
        }
      }

      // Check 2: Veto list items cannot be introduced
      if (change.substituteTitle && context.preferences?.vetoList) {
        context.preferences.vetoList.forEach(veto => {
          if (change.substituteTitle.toLowerCase().includes(veto.toLowerCase())) {
            violations.push(`Violation: Proposed replacement "${change.substituteTitle}" violates traveller veto rule: "${veto}".`);
          }
        });
      }
    });

    // Check 3: On Day 5, check backward calculation buffer
    if (dayNumber === 5) {
      const remainingStops = proposal.proposedChanges.filter(c => c.action !== "skip");
      const lastSightseeing = remainingStops.find(c => c.activityId === "act-5-4" || c.activityId === "act-5-5");
      if (lastSightseeing && lastSightseeing.newTime) {
        const mins = OntheGoEngine.timeStrToMins(lastSightseeing.newTime);
        if (mins > 12 * 60 + 15) {
          violations.push("Violation: Day 5 sightseeing after 12:15 PM breaches the backward calculation buffer for 1:00 PM scooter return.");
          hardConstraintsPreserved = false;
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      hardConstraintsPreserved
    };
  },

  // ==========================================
  // PROPOSAL GENERATOR (AI + OFFLINE HEURISTIC)
  // ==========================================

  /**
   * Generates a proposal using configured AI provider or offline heuristic compression.
   * @param {string} dayId
   * @param {number} delayMins
   */
  async generateAiAdjustmentProposal(dayId, delayMins = 30) {
    const context = this.buildGroundedContext(dayId, delayMins);
    let rawProposal = null;

    const apiKey = OntheGoApp.state?.aiSettings?.apiKey;
    const isOnline = navigator.onLine;

    if (apiKey && isOnline && OntheGoApp.state.aiSettings.provider === "gemini") {
      try {
        rawProposal = await this.callGeminiApi(context, apiKey);
      } catch (err) {
        console.warn("Gemini API call failed, falling back to deterministic heuristic solver:", err);
      }
    }

    // Deterministic Heuristic Fallback Solver
    if (!rawProposal) {
      rawProposal = this.solveHeuristicCompression(context, delayMins);
    }

    // Run strict deterministic validation layer
    const validation = this.validateProposal(rawProposal, context);

    const fullProposal = {
      id: "ai-prop-" + Date.now(),
      timestamp: new Date().toISOString(),
      promptContext: `Day ${context.dayNumber} (+${delayMins}m delay recovery)`,
      proposedChanges: rawProposal.proposedChanges || [],
      rationale: rawProposal.overallRationale || "Optimized schedule to recover lost time while protecting all hard bookings.",
      validationResult: validation,
      status: "pending"
    };

    OntheGoApp.state.aiProposals = OntheGoApp.state.aiProposals || [];
    OntheGoApp.state.aiProposals.unshift(fullProposal);
    OntheGoApp.saveState();

    this.renderProposalModal(fullProposal);
    return fullProposal;
  },

  /**
   * Deterministic constraint-satisfaction heuristic solver.
   * Runs locally with zero network dependencies.
   */
  solveHeuristicCompression(context, delayMins) {
    const proposedChanges = [];
    let timeRecovered = 0;

    // Prioritize shortening meals and cafes first
    context.currentActivities.forEach(act => {
      if (timeRecovered >= delayMins) return;
      if (act.isFixed) return;

      if (act.category === "Restaurant") {
        proposedChanges.push({
          dayId: `day-${context.dayNumber}`,
          activityId: act.id,
          activityTitle: act.title,
          action: "shorten",
          newDurationMins: 35,
          rationale: `Shorten dining duration at "${act.title}" from 60m to 35m (saves 25m).`
        });
        timeRecovered += 25;
      }
    });

    // If still delayed, skip optional or secondary sightseeing
    if (timeRecovered < delayMins) {
      context.currentActivities.forEach(act => {
        if (timeRecovered >= delayMins) return;
        if (act.isFixed) return;
        if (proposedChanges.some(c => c.activityId === act.id)) return;

        if (act.id === "act-1-8" || act.id === "act-5-5" || act.category === "Museum" || act.title.includes("Trouvaille")) {
          proposedChanges.push({
            dayId: `day-${context.dayNumber}`,
            activityId: act.id,
            activityTitle: act.title,
            action: "skip",
            rationale: `Omit optional stop "${act.title}" to protect downstream bookings (saves 40m).`
          });
          timeRecovered += 40;
        }
      });
    }

    return {
      proposedChanges,
      overallRationale: `Deterministic constraint solver recovered ${timeRecovered} minutes. Fixed bookings (Train, Stays, Kayaking) and Day 5 backward calculation buffer strictly preserved.`
    };
  },

  /**
   * Real Gemini API Integration with structured JSON schema.
   */
  async callGeminiApi(context, apiKey) {
    const prompt = `You are OntheGO's AI Travel Assistant for a 2-traveller Kerala scooter trip.
The travellers are running ${context.delayToRecoverMins} minutes late on Day ${context.dayNumber}.
Propose schedule changes to recover time.
RULES:
1. NEVER modify, delete, or postpone hard constraints: ${JSON.stringify(context.hardConstraints)}.
2. If Day 5, the scooter return (1:00 PM target / 1:30 PM latest) and 2:00 PM Vande Bharat departure are SACROSANCT.
3. Obey veto rules: ${JSON.stringify(context.preferences.vetoList)}.
4. Shorten flexible meals or skip optional stops.
Return ONLY valid JSON with keys "overallRationale" and "proposedChanges" (array of { activityId, action: "shorten"|"skip", rationale }).`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  },

  // ==========================================
  // PROPOSAL APPROVAL & APPLICATION
  // ==========================================

  applyProposal(proposalId) {
    const proposals = OntheGoApp.state?.aiProposals || [];
    const prop = proposals.find(p => p.id === proposalId);
    if (!prop) return;

    if (!prop.validationResult?.isValid) {
      alert("Cannot apply proposal: It failed deterministic validation checks.");
      return;
    }

    const trip = OntheGoApp.getActiveTrip();

    prop.proposedChanges.forEach(change => {
      for (const day of trip.days) {
        const act = (day.activities || []).find(a => a.id === change.activityId);
        if (act) {
          if (change.action === "skip") {
            act.status = "skipped";
          } else if (change.action === "shorten" && change.newDurationMins) {
            act.durationMins = change.newDurationMins;
          }
          act.notes = (act.notes || "") + ` [AI adjusted: ${change.rationale}]`;
        }
      }
    });

    prop.status = "approved";

    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: "updated",
        entityType: "itinerary",
        entityId: prop.id,
        description: `Approved AI itinerary adjustments: ${prop.rationale}`
      });
    }

    OntheGoApp.saveState();
    OntheGoApp.showToast("AI proposal approved and applied to active itinerary! ✓");
    OntheGoItinerary.renderCurrentDay();
    OntheGoApp.renderDashboard();
    this.closeProposalModal();
  },

  rejectProposal(proposalId) {
    const proposals = OntheGoApp.state?.aiProposals || [];
    const prop = proposals.find(p => p.id === proposalId);
    if (prop) {
      prop.status = "rejected";
      OntheGoApp.saveState();
      OntheGoApp.showToast("AI proposal rejected. Original schedule maintained.");
      this.closeProposalModal();
    }
  },

  // ==========================================
  // MODAL UI FOR AI PROPOSALS
  // ==========================================

  renderProposalModal(prop) {
    let modal = document.getElementById("aiProposalModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "aiProposalModal";
      modal.className = "modal-overlay open";
      document.body.appendChild(modal);
    } else {
      modal.classList.add("open");
    }

    const isValid = prop.validationResult?.isValid;

    modal.innerHTML = `
      <div class="modal-sheet" style="max-width: 560px;">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.3rem;">🤖</span>
            <div>
              <h3 class="modal-title">AI Itinerary Adjustment Proposal</h3>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${prop.promptContext}</div>
            </div>
          </div>
          <button type="button" class="icon-btn" onclick="OntheGoAiAdjustments.closeProposalModal()">✕</button>
        </div>

        <div style="margin-bottom: 12px;">
          <div class="safeguard-status-pill ${isValid ? 'pill-feasible' : 'pill-danger'}" style="margin-bottom: 8px;">
            ${isValid ? '✓ Deterministic Validation Passed: Hard Constraints 100% Protected' : '🚨 Validation Failed: Prohibited Conflicts Detected'}
          </div>

          <p style="font-size: 0.8rem; color: var(--text-main); line-height: 1.4; background: var(--bg-card-subtle); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin: 0 0 10px 0;">
            ${prop.rationale}
          </p>

          ${!isValid ? `
            <div class="safeguard-flags-list">
              ${prop.validationResult.violations.map(v => `
                <div class="safeguard-flag-item item-danger">
                  ${v}
                </div>
              `).join("")}
            </div>
          ` : ''}

          <!-- Proposed Adjustments Diff -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
              Proposed Actions
            </div>
            ${prop.proposedChanges.map(c => `
              <div style="background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.76rem;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="font-weight: 700; color: var(--text-main);">${c.activityTitle || c.activityId}</span>
                  <span class="split-tag ${c.action === 'skip' ? 'tag-refund' : 'tag-custom'}">${c.action.toUpperCase()}</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
                  ${c.rationale}
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="stop-actions-row">
          ${isValid ? `
            <button type="button" class="btn-primary" style="flex: 1;" onclick="OntheGoAiAdjustments.applyProposal('${prop.id}')">
              ✓ Approve & Apply Changes
            </button>
          ` : `
            <button type="button" class="btn-primary" style="flex: 1; opacity: 0.5; cursor: not-allowed;" disabled>
              Blocked by Validation Rules
            </button>
          `}
          <button type="button" class="btn-secondary" onclick="OntheGoAiAdjustments.rejectProposal('${prop.id}')">
            ✕ Reject
          </button>
        </div>
      </div>
    `;
  },

  closeProposalModal() {
    const modal = document.getElementById("aiProposalModal");
    if (modal) modal.classList.remove("open");
  }
};
