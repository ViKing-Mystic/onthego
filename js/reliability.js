/**
 * OntheGO - Stage 4: Reliability, Network Monitoring & Sanitized Logging
 * Handles live/simulated network transitions, API timeout/retry policies,
 * duplicate submission guards, and privacy-preserving error diagnostics.
 */

window.OntheGoReliability = {
  isSimulatedOffline: false,
  networkListenersAttached: false,
  activeSubmissions: new Set(),

  init() {
    this.setupNetworkMonitoring();
  },

  /**
   * Evaluates effective connectivity (considering hardware network + user simulation).
   * @returns {boolean}
   */
  isOnline() {
    if (this.isSimulatedOffline) return false;
    return typeof navigator.onLine === "boolean" ? navigator.onLine : true;
  },

  /**
   * Toggles simulated offline mode for Kerala backroads testing.
   * @param {boolean} simulateOffline
   */
  setSimulatedOffline(simulateOffline) {
    this.isSimulatedOffline = !!simulateOffline;
    this.updateNetworkUI();
    const message = this.isSimulatedOffline
      ? "Simulating Kerala backroad offline mode (mobile data off) 📵"
      : "Simulated offline mode disabled. Cellular network active 🟢";
    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast(message);
    }
    // If returning online, trigger sync
    if (this.isOnline() && window.OntheGoSyncEngine) {
      OntheGoSyncEngine.processSyncQueue();
    }
  },

  setupNetworkMonitoring() {
    if (this.networkListenersAttached) return;

    window.addEventListener("online", () => {
      this.updateNetworkUI();
      if (window.OntheGoApp && OntheGoApp.showToast) {
        OntheGoApp.showToast("Connection restored! Cellular data connected. 🟢");
      }
      if (window.OntheGoSyncEngine) {
        OntheGoSyncEngine.processSyncQueue();
      }
      if (window.OntheGoApp && OntheGoApp.fetchWeather) {
        OntheGoApp.fetchWeather();
      }
    });

    window.addEventListener("offline", () => {
      this.updateNetworkUI();
      if (window.OntheGoApp && OntheGoApp.showToast) {
        OntheGoApp.showToast("No internet connection. Switched to offline IndexedDB mode. 🔴");
      }
    });

    this.networkListenersAttached = true;
    this.updateNetworkUI();
  },

  /**
   * Refreshes the header status indicators and pending sync badges.
   */
  updateNetworkUI() {
    const isOnline = this.isOnline();
    const statusBadge = document.getElementById("headerStatusBadge");
    const syncPill = document.getElementById("headerSyncStatusPill");

    const pendingCount = (window.OntheGoSyncEngine && OntheGoSyncEngine.getPendingCount)
      ? OntheGoSyncEngine.getPendingCount()
      : (OntheGoApp.state?.syncQueue?.filter(q => q.status === "pending")?.length || 0);

    if (statusBadge) {
      if (isOnline) {
        statusBadge.className = "header-status-pill status-online";
        statusBadge.innerHTML = "🟢 Online";
        statusBadge.title = "Cellular / Wi-Fi connected";
      } else {
        statusBadge.className = "header-status-pill status-offline";
        statusBadge.innerHTML = this.isSimulatedOffline ? "📵 Simulated Offline" : "🔴 Offline (Local IDB)";
        statusBadge.title = "Operating locally from device IndexedDB cache";
      }
    }

    if (syncPill) {
      if (pendingCount > 0) {
        syncPill.className = "header-status-pill status-offline";
        syncPill.style.background = "#fff7ed";
        syncPill.style.color = "#c2410c";
        syncPill.style.borderColor = "#fdba74";
        syncPill.innerHTML = `🟠 Pending (${pendingCount})`;
        syncPill.title = `${pendingCount} offline edit(s) waiting for cellular sync. Click to view queue.`;
        syncPill.onclick = () => {
          if (window.OntheGoApp) {
            OntheGoApp.switchTab("more");
            OntheGoApp.switchMoreSubTab("sync-queue");
          }
        };
      } else {
        syncPill.className = "header-status-pill status-online";
        syncPill.style.background = "";
        syncPill.style.color = "";
        syncPill.style.borderColor = "";
        syncPill.innerHTML = "🟢 Synced";
        syncPill.title = "All local edits synchronized across devices";
        syncPill.onclick = () => {
          if (window.OntheGoApp) {
            OntheGoApp.switchTab("more");
            OntheGoApp.switchMoreSubTab("sync-queue");
          }
        };
      }
    }
  },

  /**
   * Protected HTTP Fetch with configurable timeout and exponential backoff retries.
   * @param {string} url
   * @param {Object} options
   * @param {Object} config
   * @returns {Promise<Response>}
   */
  async fetchWithRetry(url, options = {}, config = {}) {
    const {
      timeoutMs = 5000,
      maxRetries = 3,
      backoffMs = 1000
    } = config;

    if (!this.isOnline()) {
      throw new Error("Offline: network request blocked while offline or simulated offline.");
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok && response.status >= 500 && attempt < maxRetries - 1) {
          // Server error, retry with backoff
          attempt++;
          await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
          continue;
        }
        return response;
      } catch (err) {
        clearTimeout(timer);
        attempt++;
        if (attempt >= maxRetries) {
          this.logError(`Network request failed after ${maxRetries} attempts: ${this.sanitizeUrl(url)}`, {
            error: err.name === "AbortError" ? "Timeout" : err.message
          });
          throw err;
        }
        // Jittered exponential backoff
        const delay = backoffMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  },

  /**
   * Idempotency Guard: Prevents double submission on rapid form clicks.
   * @param {string} submissionKey
   * @param {number} lockDurationMs
   * @returns {boolean} true if permitted, false if duplicate/locked
   */
  guardSubmission(submissionKey, lockDurationMs = 1500) {
    if (this.activeSubmissions.has(submissionKey)) {
      return false;
    }
    this.activeSubmissions.add(submissionKey);
    setTimeout(() => this.activeSubmissions.delete(submissionKey), lockDurationMs);
    return true;
  },

  /**
   * Generates a deterministic idempotency key for transactions.
   * @param {string} prefix
   * @param {string} seed
   * @returns {string}
   */
  generateIdempotencyKey(prefix = "txn", seed = "") {
    const raw = `${prefix}_${seed}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  },

  /**
   * Sanitizes text to remove API keys, bearer tokens, PINs, passwords, and sensitive credentials.
   * @param {string|Object} input
   * @returns {string|Object}
   */
  sanitize(input) {
    if (!input) return input;
    if (typeof input === "object") {
      const copy = JSON.parse(JSON.stringify(input));
      const sensitiveKeys = ["apikey", "api_key", "token", "accesspin", "pin", "password", "secret", "bearer", "authorization"];
      const redact = (obj) => {
        for (const k in obj) {
          if (typeof obj[k] === "object" && obj[k] !== null) {
            redact(obj[k]);
          } else if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
            obj[k] = "[REDACTED_SECRET]";
          } else if (typeof obj[k] === "string") {
            obj[k] = this.sanitize(obj[k]);
          }
        }
      };
      redact(copy);
      return copy;
    }

    if (typeof input === "string") {
      return input
        .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
        .replace(/(?:api_key|apikey|token|password|pin)=([a-zA-Z0-9_\-]+)/gi, "$1=[REDACTED]");
    }
    return input;
  },

  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.has("key")) parsed.searchParams.set("key", "[REDACTED]");
      if (parsed.searchParams.has("api_key")) parsed.searchParams.set("api_key", "[REDACTED]");
      return parsed.toString();
    } catch {
      return url.split("?")[0] + "?[REDACTED_QUERY]";
    }
  },

  /**
   * Privacy-preserving diagnostic error logging.
   * @param {string} message
   * @param {Object} metadata
   */
  logError(message, metadata = {}) {
    const sanitizedMeta = this.sanitize(metadata);
    const entry = {
      level: "ERROR",
      message: this.sanitize(message),
      meta: sanitizedMeta,
      online: this.isOnline(),
      timestamp: new Date().toISOString()
    };
    console.error("[OntheGO Reliability]", entry.message, entry.meta);
    if (window.OntheGoStorage && OntheGoStorage.logSanitizedError) {
      OntheGoStorage.logSanitizedError(entry);
    }
  },

  logWarn(message, metadata = {}) {
    const entry = {
      level: "WARN",
      message: this.sanitize(message),
      meta: this.sanitize(metadata),
      online: this.isOnline(),
      timestamp: new Date().toISOString()
    };
    console.warn("[OntheGO Reliability]", entry.message, entry.meta);
  }
};
