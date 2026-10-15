/**
 * OntheGO - Stage 4: Persistent IndexedDB Storage Layer
 * Provides robust offline data storage independent of browser cache limits.
 * Manages trip state, sync queue, offline documents, map manifests, and error logs.
 * Includes automatic memory-store fallback for sandboxed, headless, or restricted environments.
 */

window.OntheGoStorage = {
  DB_NAME: "OntheGO_LocalDB",
  DB_VERSION: 1,
  db: null,
  isReady: false,
  useMemoryFallback: false,
  memoryStore: {
    trip_state: {},
    sync_queue: {},
    offline_documents: {},
    offline_maps: {},
    audit_error_logs: [],
    state_snapshots: {}
  },

  STORES: {
    TRIP_STATE: "trip_state",
    SYNC_QUEUE: "sync_queue",
    DOCUMENTS: "offline_documents",
    MAP_MANIFESTS: "offline_maps",
    ERROR_LOGS: "audit_error_logs",
    SNAPSHOTS: "state_snapshots"
  },

  /**
   * Initializes the IndexedDB database with all required object stores.
   * Includes a 350ms race timer fallback to memoryStore if IndexedDB hangs or is restricted.
   * @returns {Promise<boolean>}
   */
  async init() {
    if (typeof window === "undefined" || !window.indexedDB) {
      console.warn("IndexedDB not supported in this environment; using memory/localStorage store.");
      this.useMemoryFallback = true;
      this.isReady = true;
      return true;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const fallbackTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn("IndexedDB open timed out; activating memory fallback.");
          this.useMemoryFallback = true;
          this.isReady = true;
          resolve(true);
        }
      }, 350);

      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Object Store 1: Trip State & Core Records
          if (!db.objectStoreNames.contains(this.STORES.TRIP_STATE)) {
            db.createObjectStore(this.STORES.TRIP_STATE, { keyPath: "id" });
          }

          // Object Store 2: Offline Sync Queue
          if (!db.objectStoreNames.contains(this.STORES.SYNC_QUEUE)) {
            const queueStore = db.createObjectStore(this.STORES.SYNC_QUEUE, { keyPath: "opId" });
            queueStore.createIndex("status", "status", { unique: false });
            queueStore.createIndex("timestamp", "timestamp", { unique: false });
            queueStore.createIndex("idempotencyKey", "idempotencyKey", { unique: false });
          }

          // Object Store 3: Essential Offline Documents & Bookings
          if (!db.objectStoreNames.contains(this.STORES.DOCUMENTS)) {
            const docStore = db.createObjectStore(this.STORES.DOCUMENTS, { keyPath: "id" });
            docStore.createIndex("category", "category", { unique: false });
          }

          // Object Store 4: Offline Map Route Manifests & Addresses
          if (!db.objectStoreNames.contains(this.STORES.MAP_MANIFESTS)) {
            db.createObjectStore(this.STORES.MAP_MANIFESTS, { keyPath: "dayId" });
          }

          // Object Store 5: Sanitized Error Logs
          if (!db.objectStoreNames.contains(this.STORES.ERROR_LOGS)) {
            const logStore = db.createObjectStore(this.STORES.ERROR_LOGS, { keyPath: "id", autoIncrement: true });
            logStore.createIndex("timestamp", "timestamp", { unique: false });
            logStore.createIndex("level", "level", { unique: false });
          }

          // Object Store 6: Pre-migration & Pre-sync State Snapshots
          if (!db.objectStoreNames.contains(this.STORES.SNAPSHOTS)) {
            const snapStore = db.createObjectStore(this.STORES.SNAPSHOTS, { keyPath: "snapshotId" });
            snapStore.createIndex("timestamp", "timestamp", { unique: false });
          }
        };

        request.onsuccess = (event) => {
          if (!resolved) {
            clearTimeout(fallbackTimer);
            resolved = true;
            this.db = event.target.result;
            this.isReady = true;
            this.useMemoryFallback = false;
            resolve(true);
          }
        };

        request.onerror = (event) => {
          if (!resolved) {
            clearTimeout(fallbackTimer);
            resolved = true;
            console.warn("IndexedDB open error:", event.target?.error);
            this.useMemoryFallback = true;
            this.isReady = true;
            resolve(true);
          }
        };
      } catch (err) {
        if (!resolved) {
          clearTimeout(fallbackTimer);
          resolved = true;
          console.warn("IndexedDB initialization exception:", err);
          this.useMemoryFallback = true;
          this.isReady = true;
          resolve(true);
        }
      }
    });
  },

  /**
   * Saves the complete trip state snapshot into IndexedDB (or fallback memory).
   * @param {Object} state
   * @returns {Promise<boolean>}
   */
  async saveTripState(state) {
    if (!state) return false;
    const record = {
      id: "active_trip_state",
      timestamp: new Date().toISOString(),
      schemaVersion: state.schemaVersion || 8,
      state: JSON.parse(JSON.stringify(state))
    };
    if (this.useMemoryFallback || !this.db) {
      this.memoryStore.trip_state["active_trip_state"] = record;
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.TRIP_STATE], "readwrite");
        const store = tx.objectStore(this.STORES.TRIP_STATE);
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          this.memoryStore.trip_state["active_trip_state"] = record;
          resolve(true);
        };
      } catch (e) {
        this.memoryStore.trip_state["active_trip_state"] = record;
        resolve(true);
      }
    });
  },

  /**
   * Hydrates trip state from IndexedDB.
   * Useful when localStorage is cleared or corrupted.
   * @returns {Promise<Object|null>}
   */
  async loadTripState() {
    if (this.useMemoryFallback || !this.db) {
      const rec = this.memoryStore.trip_state["active_trip_state"];
      return rec && rec.state ? JSON.parse(JSON.stringify(rec.state)) : null;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.TRIP_STATE], "readonly");
        const store = tx.objectStore(this.STORES.TRIP_STATE);
        const req = store.get("active_trip_state");
        req.onsuccess = () => {
          if (req.result && req.result.state) {
            resolve(req.result.state);
          } else {
            const rec = this.memoryStore.trip_state["active_trip_state"];
            resolve(rec && rec.state ? JSON.parse(JSON.stringify(rec.state)) : null);
          }
        };
        req.onerror = () => {
          const rec = this.memoryStore.trip_state["active_trip_state"];
          resolve(rec && rec.state ? JSON.parse(JSON.stringify(rec.state)) : null);
        };
      } catch (e) {
        const rec = this.memoryStore.trip_state["active_trip_state"];
        resolve(rec && rec.state ? JSON.parse(JSON.stringify(rec.state)) : null);
      }
    });
  },

  /**
   * Creates a restorable recovery snapshot before a risky operation (migration or bulk sync).
   * @param {Object} state
   * @param {string} reason
   * @returns {Promise<string|null>} snapshotId
   */
  async createRecoverySnapshot(state, reason = "manual_backup") {
    if (!state) return null;
    const snapshotId = "snap_" + Date.now();
    const record = {
      snapshotId,
      reason,
      timestamp: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(state))
    };
    if (this.useMemoryFallback || !this.db) {
      this.memoryStore.state_snapshots[snapshotId] = record;
      return snapshotId;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.SNAPSHOTS], "readwrite");
        const store = tx.objectStore(this.STORES.SNAPSHOTS);
        const req = store.put(record);
        req.onsuccess = () => resolve(snapshotId);
        req.onerror = () => {
          this.memoryStore.state_snapshots[snapshotId] = record;
          resolve(snapshotId);
        };
      } catch (e) {
        this.memoryStore.state_snapshots[snapshotId] = record;
        resolve(snapshotId);
      }
    });
  },

  /**
   * Persists an offline queued operation.
   * @param {Object} op
   * @returns {Promise<boolean>}
   */
  async saveQueueOperation(op) {
    if (!op || !op.opId) return false;
    const copy = JSON.parse(JSON.stringify(op));
    if (this.useMemoryFallback || !this.db) {
      this.memoryStore.sync_queue[op.opId] = copy;
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.SYNC_QUEUE], "readwrite");
        const store = tx.objectStore(this.STORES.SYNC_QUEUE);
        const req = store.put(copy);
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          this.memoryStore.sync_queue[op.opId] = copy;
          resolve(true);
        };
      } catch (e) {
        this.memoryStore.sync_queue[op.opId] = copy;
        resolve(true);
      }
    });
  },

  /**
   * Retrieves all pending queued operations.
   * @returns {Promise<Array>}
   */
  async getQueueOperations() {
    if (this.useMemoryFallback || !this.db) {
      return Object.values(this.memoryStore.sync_queue);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.SYNC_QUEUE], "readonly");
        const store = tx.objectStore(this.STORES.SYNC_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Object.values(this.memoryStore.sync_queue));
      } catch (e) {
        resolve(Object.values(this.memoryStore.sync_queue));
      }
    });
  },

  /**
   * Removes or marks an operation as completed.
   * @param {string} opId
   * @returns {Promise<boolean>}
   */
  async removeQueueOperation(opId) {
    if (!opId) return false;
    if (this.useMemoryFallback || !this.db) {
      delete this.memoryStore.sync_queue[opId];
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.SYNC_QUEUE], "readwrite");
        const store = tx.objectStore(this.STORES.SYNC_QUEUE);
        const req = store.delete(opId);
        req.onsuccess = () => {
          delete this.memoryStore.sync_queue[opId];
          resolve(true);
        };
        req.onerror = () => {
          delete this.memoryStore.sync_queue[opId];
          resolve(true);
        };
      } catch (e) {
        delete this.memoryStore.sync_queue[opId];
        resolve(true);
      }
    });
  },

  /**
   * Clears the entire sync queue store in IndexedDB.
   */
  async clearQueue() {
    this.memoryStore.sync_queue = {};
    if (this.useMemoryFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.SYNC_QUEUE], "readwrite");
        const store = tx.objectStore(this.STORES.SYNC_QUEUE);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Saves essential offline booking documents.
   * @param {Array<Object>} docs
   */
  async saveDocuments(docs) {
    if (!Array.isArray(docs)) return false;
    docs.forEach(doc => {
      if (doc && doc.id) {
        this.memoryStore.offline_documents[doc.id] = JSON.parse(JSON.stringify(doc));
      }
    });
    if (this.useMemoryFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.DOCUMENTS], "readwrite");
        const store = tx.objectStore(this.STORES.DOCUMENTS);
        docs.forEach(doc => store.put(JSON.parse(JSON.stringify(doc))));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  },

  /**
   * Loads all saved offline documents.
   * @returns {Promise<Array>}
   */
  async getDocuments() {
    if (this.useMemoryFallback || !this.db) {
      return Object.values(this.memoryStore.offline_documents);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.DOCUMENTS], "readonly");
        const store = tx.objectStore(this.STORES.DOCUMENTS);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          resolve(res.length > 0 ? res : Object.values(this.memoryStore.offline_documents));
        };
        req.onerror = () => resolve(Object.values(this.memoryStore.offline_documents));
      } catch (e) {
        resolve(Object.values(this.memoryStore.offline_documents));
      }
    });
  },

  /**
   * Saves offline route manifests with step cues and coordinates.
   * @param {string} dayId
   * @param {Object} manifest
   */
  async saveMapManifest(dayId, manifest) {
    if (!dayId) return false;
    const record = { dayId, ...manifest, lastUpdated: new Date().toISOString() };
    this.memoryStore.offline_maps[dayId] = record;
    if (this.useMemoryFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.MAP_MANIFESTS], "readwrite");
        const store = tx.objectStore(this.STORES.MAP_MANIFESTS);
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  },

  /**
   * Logs a sanitized client error to IndexedDB without PII or sensitive keys.
   * @param {Object} logEntry
   */
  async logSanitizedError(logEntry) {
    if (!logEntry) return false;
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...logEntry
    };
    this.memoryStore.audit_error_logs.push(entry);
    if (this.useMemoryFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.STORES.ERROR_LOGS], "readwrite");
        const store = tx.objectStore(this.STORES.ERROR_LOGS);
        const req = store.add(entry);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }
};
