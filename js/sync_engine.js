/**
 * OntheGO - Stage 4: Offline Synchronization Queue & Conflict Resolution Engine
 * Queues local operations while offline, prevents duplicate expense submissions,
 * detects concurrent edits between travellers, protects hard constraints, and provides retry actions.
 */

window.OntheGoSyncEngine = {
  isProcessing: false,
  activeSyncPromise: null,
  lastSyncTimestamp: null,

  init() {
    this.ensureSyncState();
    // Hydrate queue from IndexedDB if memory queue is empty
    this.hydrateFromIndexedDB();
  },

  ensureSyncState() {
    if (!OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.syncQueue)) {
      OntheGoApp.state.syncQueue = [];
    }
    if (!Array.isArray(OntheGoApp.state.syncConflicts)) {
      OntheGoApp.state.syncConflicts = [];
    }
  },

  async hydrateFromIndexedDB() {
    if (window.OntheGoStorage && OntheGoStorage.isReady) {
      try {
        const idbQueue = await OntheGoStorage.getQueueOperations();
        if (Array.isArray(idbQueue) && idbQueue.length) {
          this.ensureSyncState();
          // Merge items into state.syncQueue if not present
          idbQueue.forEach(idbOp => {
            if (!OntheGoApp.state.syncQueue.some(q => q.opId === idbOp.opId)) {
              OntheGoApp.state.syncQueue.push(idbOp);
            }
          });
          if (window.OntheGoReliability) OntheGoReliability.updateNetworkUI();
        }
      } catch (e) {
        console.warn("Could not hydrate queue from IndexedDB:", e);
      }
    }
  },

  /**
   * Enqueues an operation to be synced.
   * @param {Object} opParam
   * @returns {Object} Queued Operation
   */
  enqueueOperation(opParam) {
    this.ensureSyncState();

    const activeTraveller = (window.OntheGoCollaboration && OntheGoCollaboration.getActiveTraveller)
      ? OntheGoCollaboration.getActiveTraveller()
      : { id: "traveller-1", name: "Vishnu" };

    const travellerId = opParam.travellerId || activeTraveller.id;
    const travellerName = opParam.travellerName || activeTraveller.name;

    const idempotencyKey = opParam.idempotencyKey ||
      (window.OntheGoReliability ? OntheGoReliability.generateIdempotencyKey(opParam.entityType, opParam.recordId) : `op_${Date.now()}`);

    // Prevent duplicate enqueue of the exact same operation
    const existing = OntheGoApp.state.syncQueue.find(
      q => q.idempotencyKey === idempotencyKey && q.status === "pending"
    );
    if (existing) {
      return existing;
    }

    const op = {
      opId: "op_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      idempotencyKey,
      entityType: opParam.entityType, // "expense", "activity", "checklist", "preference", "contact"
      action: opParam.action, // "create", "update", "delete", "replace"
      recordId: opParam.recordId,
      payload: JSON.parse(JSON.stringify(opParam.payload || {})),
      baseVersion: opParam.baseVersion || 1,
      timestamp: new Date().toISOString(),
      travellerId,
      travellerName,
      status: "pending", // "pending" | "syncing" | "applied" | "failed" | "conflicted"
      retryCount: 0,
      error: null
    };

    OntheGoApp.state.syncQueue.push(op);

    // Persist to IndexedDB
    if (window.OntheGoStorage && OntheGoStorage.saveQueueOperation) {
      OntheGoStorage.saveQueueOperation(op);
    }

    if (window.OntheGoApp && OntheGoApp.saveState) {
      OntheGoApp.saveState();
    }

    if (window.OntheGoReliability) {
      OntheGoReliability.updateNetworkUI();
    }

    return op;
  },

  /**
   * Returns count of currently pending synchronization operations.
   * @returns {number}
   */
  getPendingCount() {
    this.ensureSyncState();
    return (OntheGoApp.state?.syncQueue || []).filter(q => q.status === "pending").length;
  },

  /**
   * Processes the sync queue deterministically when online.
   * Validates each item, checks for conflicts, prevents expense duplicates,
   * protects hard constraints, and records change audit.
   * @returns {Promise<Object>} Summary of sync run
   */
  async processSyncQueue() {
    this.ensureSyncState();
    const isOnline = (window.OntheGoReliability && OntheGoReliability.isOnline)
      ? OntheGoReliability.isOnline()
      : navigator.onLine;

    if (!isOnline) {
      return { success: false, message: "Device is offline. Changes remain queued in IndexedDB." };
    }

    if (this.isProcessing && this.activeSyncPromise) {
      const ongoingResult = await this.activeSyncPromise;
      if (this.getPendingCount() === 0) {
        return ongoingResult;
      }
    }

    this.isProcessing = true;
    this.activeSyncPromise = (async () => {
      this.renderSyncQueueUI();

      const queue = OntheGoApp.state.syncQueue.filter(q => q.status === "pending" || q.status === "failed");
      let appliedCount = 0;
      let conflictCount = 0;
      let errorCount = 0;

      // Take safety snapshot before applying sync batch
      if (window.OntheGoStorage && OntheGoStorage.createRecoverySnapshot) {
        await OntheGoStorage.createRecoverySnapshot(OntheGoApp.state, "pre_sync_batch");
      }

      for (const op of queue) {
        op.status = "syncing";

        try {
          // Step 1: Validation
          const validation = this.validateOperation(op);
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.reason}`);
          }

          // Step 2: Hard Travel Constraint Safeguard
          // Never allow an offline update or sync conflict to overwrite fixed commitments
          if (this.isViolatingHardConstraint(op)) {
            op.status = "conflicted";
            op.error = "Rejected: Cannot alter confirmed fixed booking or train departure.";
            conflictCount++;
            this.recordConflict(op, "Attempted modification of protected hard commitment.");
            continue;
          }

          // Step 3: Duplicate Expense Guard
          if (op.entityType === "expense" && op.action === "create") {
            const isDuplicate = this.detectDuplicateExpense(op.payload, op.idempotencyKey);
            if (isDuplicate) {
              op.status = "applied";
              op.notes = "Deduplicated: Expense already recorded in ledger.";
              appliedCount++;
              continue;
            }
          }

          // Step 4: Concurrent Conflict Detection (Between 2 Travellers)
          const conflict = this.detectConcurrentConflict(op);
          if (conflict.hasConflict) {
            if (conflict.canAutoReconcile) {
              // Apply 3-way field-level auto-merge
              this.applyReconciledChange(op, conflict.mergedPayload);
              op.status = "applied";
              op.notes = "Auto-reconciled non-overlapping field changes.";
              appliedCount++;
            } else {
              op.status = "conflicted";
              op.error = conflict.reason;
              conflictCount++;
              this.recordConflict(op, conflict.reason);
              continue;
            }
          } else {
            // Step 5: Deterministic Application
            this.applyOperation(op);
            op.status = "applied";
            appliedCount++;
          }

          // Record material change in history
          if (window.OntheGoCollaboration && OntheGoCollaboration.recordChange) {
            OntheGoCollaboration.recordChange({
              action: op.action,
              entityType: op.entityType,
              entityId: op.recordId,
              description: `${op.travellerName} synchronized ${op.entityType} (${op.action})`
            });
          }

        } catch (err) {
          op.status = "failed";
          op.retryCount = (op.retryCount || 0) + 1;
          op.error = err.message;
          errorCount++;
          if (window.OntheGoReliability) {
            OntheGoReliability.logError(`Sync op ${op.opId} failed: ${err.message}`, { op });
          }
        }
      }

      this.lastSyncTimestamp = new Date().toISOString();

      if (window.OntheGoApp && OntheGoApp.saveState) {
        OntheGoApp.saveState();
      }
      if (window.OntheGoReliability) {
        OntheGoReliability.updateNetworkUI();
      }

      // Refresh active views
      this.refreshActiveViews();
      this.renderSyncQueueUI();

      const summary = {
        success: errorCount === 0,
        appliedCount,
        conflictCount,
        errorCount,
        timestamp: this.lastSyncTimestamp
      };

      if (appliedCount > 0 && window.OntheGoApp && OntheGoApp.showToast) {
        OntheGoApp.showToast(`Sync complete: ${appliedCount} change(s) synced seamlessly. ✓`);
      }

      return summary;
    })();

    try {
      const res = await this.activeSyncPromise;
      return res;
    } finally {
      this.isProcessing = false;
      this.activeSyncPromise = null;
    }
  },

  /**
   * Validates operation payload for schema consistency.
   */
  validateOperation(op) {
    if (!op || !op.entityType || !op.action) {
      return { valid: false, reason: "Malformed operation descriptor." };
    }
    if (op.entityType === "expense" && op.action === "create") {
      const p = op.payload || {};
      const desc = p.description || p.title;
      if (!desc || (p.amount === undefined && p.amountPaise === undefined)) {
        return { valid: false, reason: "Missing required expense title/description or amount." };
      }
    }
    if (op.entityType === "activity" && op.action === "update") {
      if (!op.recordId) {
        return { valid: false, reason: "Missing activity ID for update." };
      }
    }
    return { valid: true };
  },

  /**
   * Protects fixed bookings (Train, Accommodation check-in, Opulence kayaking) from automated overwrite.
   */
  isViolatingHardConstraint(op) {
    if (op.entityType !== "activity") return false;

    const trip = OntheGoApp.getActiveTrip();
    for (const day of trip.days || []) {
      const act = (day.activities || []).find(a => a.id === op.recordId);
      if (act && act.isFixedCommitment) {
        // If operation attempts to cancel, delete, or postpone fixed commitments past deadline
        if (op.action === "delete" || (op.payload && op.payload.status === "skipped")) {
          return true;
        }
        if (act.id === "act-5-8" && op.payload && op.payload.time && op.payload.time !== "02:00 PM") {
          return true; // Fixed 2:00 PM Vande Bharat departure cannot be rescheduled offline
        }
      }
    }
    return false;
  },

  /**
   * Prevents duplicate expense insertions across devices or duplicate offline form submissions.
   */
  detectDuplicateExpense(newExp, idempotencyKey) {
    if (!newExp) return false;
    const expenses = OntheGoApp.state.expenses || [];

    // Check 1: Idempotency Key match
    if (idempotencyKey && expenses.some(e => e.idempotencyKey === idempotencyKey || e.id === idempotencyKey)) {
      return true;
    }

    // Check 2: Content Hash match (identical title/description, exact paise amount, payer, and same date)
    const newAmountPaise = newExp.amountPaise !== undefined
      ? newExp.amountPaise
      : Math.round((parseFloat(newExp.amount) || 0) * 100);
    const newTitle = (newExp.description || newExp.title || "").trim().toLowerCase();
    const newPayer = newExp.paidByTravellerId || newExp.paidBy;

    const dup = expenses.find(e => {
      const ePaise = e.amountPaise !== undefined ? e.amountPaise : Math.round((parseFloat(e.amount) || 0) * 100);
      const eTitle = (e.description || e.title || "").trim().toLowerCase();
      const ePayer = e.paidByTravellerId || e.paidBy;
      return (
        eTitle === newTitle &&
        ePaise === newAmountPaise &&
        (!newPayer || !ePayer || ePayer === newPayer) &&
        (e.date === newExp.date || Math.abs(new Date(e.createdAt || 0) - new Date(newExp.createdAt || 0)) < 120000)
      );
    });

    return !!dup;
  },

  /**
   * Detects concurrent modification collisions on the same record between 2 travellers.
   */
  detectConcurrentConflict(op) {
    if (op.entityType !== "activity" && op.entityType !== "checklist") {
      return { hasConflict: false };
    }

    const trip = OntheGoApp.getActiveTrip();
    let currentRecord = null;

    if (op.entityType === "activity") {
      for (const day of trip.days || []) {
        const a = (day.activities || []).find(act => act.id === op.recordId);
        if (a) {
          currentRecord = a;
          break;
        }
      }
    } else if (op.entityType === "checklist") {
      for (const group of OntheGoApp.state.checklist || []) {
        if (group.items && Array.isArray(group.items)) {
          const it = group.items.find(i => i.id === op.recordId);
          if (it) {
            currentRecord = it;
            break;
          }
        } else if (group.id === op.recordId) {
          currentRecord = group;
          break;
        }
      }
    }

    if (!currentRecord) return { hasConflict: false };

    // Check if record was edited after baseVersion or by another traveller
    const hasExternalEdits = currentRecord.lastModifiedBy &&
      currentRecord.lastModifiedBy !== op.travellerId &&
      new Date(currentRecord.lastModifiedAt || 0) > new Date(op.timestamp);

    if (!hasExternalEdits) {
      return { hasConflict: false };
    }

    // Examine overlapping field modifications
    const incomingFields = Object.keys(op.payload || {});
    const collidingFields = [];
    const mergedPayload = { ...currentRecord };

    incomingFields.forEach(field => {
      if (currentRecord[field] !== undefined && currentRecord[field] !== op.payload[field]) {
        // Disjoint safe fields (e.g. notes vs completed status) can merge
        if (field === "notes" && op.payload.notes && currentRecord.notes) {
          mergedPayload.notes = `${currentRecord.notes}\n[Update by ${op.travellerName}]: ${op.payload.notes}`;
        } else if (field === "tags" && Array.isArray(op.payload.tags) && Array.isArray(currentRecord.tags)) {
          mergedPayload.tags = Array.from(new Set([...currentRecord.tags, ...op.payload.tags]));
        } else {
          collidingFields.push(field);
        }
      } else {
        mergedPayload[field] = op.payload[field];
      }
    });

    if (collidingFields.length > 0) {
      return {
        hasConflict: true,
        canAutoReconcile: false,
        reason: `Concurrent collision on fields: [${collidingFields.join(", ")}] edited simultaneously by partner.`,
        currentRecord,
        incomingPayload: op.payload
      };
    }

    return {
      hasConflict: true,
      canAutoReconcile: true,
      mergedPayload
    };
  },

  /**
   * Applies the reconciled non-colliding payload.
   */
  applyReconciledChange(op, mergedPayload) {
    this.applyFieldUpdates(op.entityType, op.recordId, mergedPayload, op.travellerId);
  },

  /**
   * Applies validated operation to the live application state.
   */
  applyOperation(op) {
    const { entityType, action, recordId, payload, travellerId } = op;

    if (entityType === "expense") {
      if (action === "create") {
        if (!Array.isArray(OntheGoApp.state.expenses)) OntheGoApp.state.expenses = [];
        const newExpense = {
          ...payload,
          id: payload.id || `exp_${Date.now()}`,
          idempotencyKey: op.idempotencyKey,
          pendingSync: false,
          syncedAt: new Date().toISOString()
        };
        OntheGoApp.state.expenses.unshift(newExpense);
      } else if (action === "delete") {
        OntheGoApp.state.expenses = (OntheGoApp.state.expenses || []).filter(e => e.id !== recordId);
      }
    } else if (entityType === "activity") {
      this.applyFieldUpdates("activity", recordId, { ...payload, pendingSync: false }, travellerId);
    } else if (entityType === "checklist") {
      this.applyFieldUpdates("checklist", recordId, { ...payload, pendingSync: false }, travellerId);
    }
  },

  applyFieldUpdates(entityType, recordId, updates, travellerId) {
    if (entityType === "activity") {
      const trip = OntheGoApp.getActiveTrip();
      for (const day of trip.days || []) {
        const act = (day.activities || []).find(a => a.id === recordId);
        if (act) {
          Object.assign(act, updates);
          act.lastModifiedBy = travellerId;
          act.lastModifiedAt = new Date().toISOString();
          break;
        }
      }
    } else if (entityType === "checklist") {
      let found = false;
      for (const group of OntheGoApp.state.checklist || []) {
        if (group.items && Array.isArray(group.items)) {
          const it = group.items.find(i => i.id === recordId);
          if (it) {
            Object.assign(it, updates);
            it.lastModifiedBy = travellerId;
            it.lastModifiedAt = new Date().toISOString();
            found = true;
            break;
          }
        } else if (group.id === recordId) {
          Object.assign(group, updates);
          group.lastModifiedBy = travellerId;
          group.lastModifiedAt = new Date().toISOString();
          found = true;
          break;
        }
      }
      if (!found && Array.isArray(OntheGoApp.state.checklist) && OntheGoApp.state.checklist.length > 0) {
        const firstGroup = OntheGoApp.state.checklist[0];
        if (firstGroup.items) {
          firstGroup.items.push({
            id: recordId,
            text: updates.text || recordId,
            done: !!(updates.completed !== undefined ? updates.completed : updates.done),
            ...updates,
            lastModifiedBy: travellerId,
            lastModifiedAt: new Date().toISOString()
          });
        }
      }
    }
  },

  recordConflict(op, reason) {
    this.ensureSyncState();
    const conflictRecord = {
      conflictId: "cnf_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      opId: op.opId,
      entityType: op.entityType,
      recordId: op.recordId,
      travellerName: op.travellerName,
      timestamp: new Date().toISOString(),
      reason,
      payload: op.payload,
      resolved: false
    };
    OntheGoApp.state.syncConflicts.unshift(conflictRecord);
  },

  resolveConflict(conflictId, resolutionChoice) { // "keep_mine" | "accept_theirs" | "dismiss"
    this.ensureSyncState();
    const conflict = OntheGoApp.state.syncConflicts.find(c => c.conflictId === conflictId);
    if (!conflict) return;

    if (resolutionChoice === "keep_mine") {
      this.applyFieldUpdates(conflict.entityType, conflict.recordId, conflict.payload, "resolved");
      conflict.resolved = true;
      conflict.resolution = "Kept local edit";
    } else if (resolutionChoice === "accept_theirs") {
      conflict.resolved = true;
      conflict.resolution = "Accepted remote edit";
    } else {
      conflict.resolved = true;
      conflict.resolution = "Dismissed";
    }

    if (window.OntheGoApp && OntheGoApp.saveState) OntheGoApp.saveState();
    this.refreshActiveViews();
    this.renderSyncQueueUI();
  },

  refreshActiveViews() {
    if (window.OntheGoItinerary && OntheGoItinerary.renderCurrentDay) {
      OntheGoItinerary.renderCurrentDay();
    }
    if (window.OntheGoExpenses && OntheGoExpenses.render) {
      OntheGoExpenses.render();
    }
    if (window.OntheGoApp && OntheGoApp.renderDashboard) {
      OntheGoApp.renderDashboard();
    }
  },

  /**
   * Renders the Offline Synchronization Queue & Conflict Resolution Hub.
   */
  renderSyncQueueUI() {
    const container = document.getElementById("syncQueueContainer");
    if (!container) return;

    this.ensureSyncState();
    const queue = OntheGoApp.state.syncQueue || [];
    const conflicts = (OntheGoApp.state.syncConflicts || []).filter(c => !c.resolved);
    const isOnline = (window.OntheGoReliability && OntheGoReliability.isOnline)
      ? OntheGoReliability.isOnline()
      : navigator.onLine;

    const pending = queue.filter(q => q.status === "pending");
    const failed = queue.filter(q => q.status === "failed");

    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: 0.72rem; color: var(--ocean-teal); font-weight: 800; text-transform: uppercase;">
              Offline Synchronization Hub
            </div>
            <h3 style="margin: 2px 0; color: var(--text-main);">Sync Queue & Conflict Engine</h3>
          </div>
          <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoSyncEngine.processSyncQueue()" ${!isOnline || this.isProcessing ? 'disabled' : ''}>
            ${this.isProcessing ? '🔄 Syncing...' : '🔄 Sync Now'}
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px;">
          <div style="background: var(--bg-input); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-muted);">Connection</div>
            <div style="font-weight: 800; color: ${isOnline ? 'var(--ocean-teal)' : '#dc2626'}; font-size: 0.9rem;">
              ${isOnline ? '🟢 Connected' : '🔴 Offline / Cached'}
            </div>
          </div>
          <div style="background: var(--bg-input); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-muted);">Pending Edits</div>
            <div style="font-weight: 800; color: ${pending.length > 0 ? '#ea580c' : 'var(--ocean-teal)'}; font-size: 0.9rem;">
              ${pending.length} queued
            </div>
          </div>
          <div style="background: var(--bg-input); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-muted);">Conflicts</div>
            <div style="font-weight: 800; color: ${conflicts.length > 0 ? '#dc2626' : 'var(--text-muted)'}; font-size: 0.9rem;">
              ${conflicts.length} active
            </div>
          </div>
        </div>

        <!-- Testing Simulation Controls -->
        <div style="background: rgba(13, 130, 138, 0.06); padding: 10px; border-radius: var(--radius-sm); border: 1px dashed var(--ocean-teal); margin-bottom: 12px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--ocean-teal); margin-bottom: 6px;">
            🧪 Kerala Road-Trip Simulation Controls:
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-sm" style="font-size: 0.74rem;" onclick="OntheGoReliability.setSimulatedOffline(!OntheGoReliability.isSimulatedOffline)">
              ${(window.OntheGoReliability && OntheGoReliability.isSimulatedOffline) ? '🟢 Restore Cellular Network' : '📵 Cut Off Cellular (Simulate Offline)'}
            </button>
            <button type="button" class="btn-sm" style="font-size: 0.74rem;" onclick="OntheGoSyncEngine.clearCompleted()">
              🧹 Clear Synced History
            </button>
          </div>
        </div>

        <!-- Active Conflicts Section -->
        ${conflicts.length > 0 ? `
          <div style="margin-top: 14px;">
            <h4 style="color: #dc2626; font-size: 0.88rem; margin-bottom: 8px;">⚠️ Conflicting Partner Edits (${conflicts.length})</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${conflicts.map(c => `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 10px;">
                  <div style="font-weight: 700; font-size: 0.82rem; color: #991b1b;">${c.entityType.toUpperCase()}: ${c.recordId}</div>
                  <div style="font-size: 0.76rem; color: #7f1d1d; margin: 4px 0;">${c.reason}</div>
                  <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button type="button" class="btn-sm btn-primary-sm" style="font-size: 0.7rem;" onclick="OntheGoSyncEngine.resolveConflict('${c.conflictId}', 'keep_mine')">Keep My Version</button>
                    <button type="button" class="btn-sm" style="font-size: 0.7rem;" onclick="OntheGoSyncEngine.resolveConflict('${c.conflictId}', 'accept_theirs')">Accept Partner's</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}

        <!-- Queued Operations List -->
        <h4 style="font-size: 0.88rem; margin: 12px 0 8px 0; color: var(--text-main);">Queued Operations Manifest:</h4>
        ${queue.length === 0 ? `
          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.8rem;">
            No operations currently queued. All records synchronized! 🟢
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto;">
            ${queue.map(q => `
              <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                <div>
                  <span style="font-weight: 700; color: var(--text-main);">${q.action.toUpperCase()} ${q.entityType}</span>
                  <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 6px;">by ${q.travellerName}</span>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">Ref: ${q.recordId || q.idempotencyKey.substr(0, 16)} • ${new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  ${q.error ? `<div style="color: #dc2626; font-size: 0.7rem;">⚠️ ${q.error}</div>` : ''}
                </div>
                <div>
                  <span class="split-tag ${q.status === 'applied' ? 'tag-settled' : q.status === 'pending' ? 'tag-custom' : 'tag-refund'}">
                    ${q.status}
                  </span>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      </div>
    `;
  },

  clearCompleted() {
    this.ensureSyncState();
    OntheGoApp.state.syncQueue = (OntheGoApp.state.syncQueue || []).filter(q => q.status === "pending" || q.status === "failed");
    if (window.OntheGoApp && OntheGoApp.saveState) OntheGoApp.saveState();
    this.renderSyncQueueUI();
  }
};
