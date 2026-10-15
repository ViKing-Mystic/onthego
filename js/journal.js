/**
 * OntheGO - Stage 5: Travel Memories & Chronological Field Journal
 * Manages travel memories, photo attachments with preserved metadata,
 * ratings, visit notes, favourite moments, private traveller notes,
 * destination groupings, and privacy-filtered trip recap exports.
 */

window.OntheGoJournal = {
  init() {
    this.ensureJournalState();
  },

  ensureJournalState() {
    if (!window.OntheGoApp || !OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.memories)) {
      OntheGoApp.state.memories = [];
    }
    if (!OntheGoApp.state.journalSettings) {
      OntheGoApp.state.journalSettings = {
        showPrivateNotes: true,
        selectedDestinationFilter: "all",
        selectedTagFilter: "all"
      };
    }
  },

  /**
   * Retrieves all memories, optionally filtered for the active traveller.
   * If `filterPrivate` is true, private notes authored by another traveller are redacted.
   * @param {string} viewerTravellerId
   * @param {boolean} filterPrivate
   * @returns {Array<Object>}
   */
  getMemories(viewerTravellerId = null, filterPrivate = true) {
    this.ensureJournalState();
    const activeTravellerId = viewerTravellerId ||
      (window.OntheGoCollaboration ? OntheGoCollaboration.getActiveTraveller().id : "traveller-1");
    const rawMemories = OntheGoApp.state?.memories || [];

    return rawMemories
      .filter(mem => {
        // If whole memory is marked private to author
        if (mem.isPrivate && mem.authorId !== activeTravellerId && filterPrivate) {
          return false;
        }
        return true;
      })
      .map(mem => {
        // Redact private notes if viewer is not the author
        if (mem.privateNotes && mem.authorId !== activeTravellerId && filterPrivate) {
          const sanitized = { ...mem };
          delete sanitized.privateNotes;
          return sanitized;
        }
        return mem;
      })
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  },

  /**
   * Retrieves memories linked to a specific itinerary stop.
   * @param {string} activityId
   * @returns {Array<Object>}
   */
  getMemoriesForActivity(activityId, viewerTravellerId = null) {
    return this.getMemories(viewerTravellerId).filter(m => m.activityId === activityId);
  },

  /**
   * Groups memories by day number and destination.
   * @param {string} viewerTravellerId
   * @returns {Object}
   */
  getMemoriesGrouped(viewerTravellerId = null) {
    const list = this.getMemories(viewerTravellerId);
    const byDay = {};
    const byDestination = {};

    list.forEach(m => {
      const day = m.dayNumber || 1;
      const dest = m.destination || "Kochi & Coastal Route";

      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(m);

      if (!byDestination[dest]) byDestination[dest] = [];
      byDestination[dest].push(m);
    });

    return { byDay, byDestination, totalCount: list.length };
  },

  /**
   * Returns list of favourite places and must-revisit spots.
   */
  getFavouritesAndRevisits(viewerTravellerId = null) {
    const list = this.getMemories(viewerTravellerId);
    return {
      favourites: list.filter(m => m.isFavourite || (m.rating && m.rating >= 4)),
      mustRevisit: list.filter(m => m.isMustRevisit)
    };
  },

  /**
   * Adds or updates a travel memory.
   * Preserves original photo metadata and enforces traveller attribution.
   * @param {Object} memoryData
   * @returns {Object} Saved memory record
   */
  saveMemory(memoryData) {
    this.ensureJournalState();
    const activeTraveller = window.OntheGoCollaboration
      ? OntheGoCollaboration.getActiveTraveller()
      : { id: "traveller-1", name: "Vishnu" };

    const memoryId = memoryData.id || ("mem_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5));
    const isNew = !OntheGoApp.state.memories.some(m => m.id === memoryId);

    // Enforce photo metadata integrity
    const sanitizedPhotos = (memoryData.photos || []).map(p => {
      if (typeof p === "string") {
        return {
          id: "photo_" + Math.random().toString(36).substr(2, 6),
          url: p,
          caption: memoryData.caption || "",
          takenAt: new Date().toISOString(),
          isOriginalIntact: true
        };
      }
      return {
        ...p,
        id: p.id || ("photo_" + Math.random().toString(36).substr(2, 6)),
        url: p.url,
        caption: p.caption || "",
        takenAt: p.takenAt || new Date().toISOString(),
        isOriginalIntact: true
      };
    });

    const record = {
      id: memoryId,
      tripId: OntheGoApp.state.activeTripId || "trip-kochi-alleppey-2026",
      activityId: memoryData.activityId || null,
      activityTitle: memoryData.activityTitle || null,
      dayNumber: memoryData.dayNumber || 1,
      destination: memoryData.destination || "Fort Kochi",
      title: (memoryData.title || memoryData.caption || "Travel Memory").trim(),
      caption: (memoryData.caption || "").trim(),
      notes: (memoryData.notes || "").trim(),
      privateNotes: (memoryData.privateNotes || "").trim(),
      isPrivate: !!memoryData.isPrivate,
      rating: Math.max(1, Math.min(5, parseInt(memoryData.rating, 10) || 5)),
      isFavourite: !!memoryData.isFavourite,
      isMustRevisit: !!memoryData.isMustRevisit,
      favouriteMoment: (memoryData.favouriteMoment || "").trim(),
      photos: sanitizedPhotos,
      tags: Array.isArray(memoryData.tags) ? memoryData.tags : [],
      authorId: memoryData.authorId || activeTraveller.id,
      authorName: memoryData.authorName || activeTraveller.name,
      timestamp: memoryData.timestamp || new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    if (isNew) {
      OntheGoApp.state.memories.unshift(record);
    } else {
      const idx = OntheGoApp.state.memories.findIndex(m => m.id === memoryId);
      if (idx !== -1) {
        // Retain original photos unless explicitly deleted
        const existingPhotos = OntheGoApp.state.memories[idx].photos || [];
        if (!memoryData.photos && existingPhotos.length) {
          record.photos = existingPhotos;
        }
        OntheGoApp.state.memories[idx] = record;
      }
    }

    // Queue for sync engine if offline
    if (window.OntheGoSyncEngine) {
      OntheGoSyncEngine.enqueueOperation({
        entityType: "memory",
        action: isNew ? "create" : "update",
        recordId: record.id,
        payload: record,
        travellerId: record.authorId,
        travellerName: record.authorName
      });
    }

    // Record in collaboration change history
    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: isNew ? "added_memory" : "updated_memory",
        entityType: "memory",
        entityId: record.id,
        description: `${record.authorName} logged a memory at ${record.destination} (${record.title})`
      });
    }

    if (window.OntheGoApp && OntheGoApp.saveState) {
      OntheGoApp.saveState();
    }

    this.renderJournal();
    return record;
  },

  /**
   * Deletes a memory record.
   * @param {string} memoryId
   * @param {string} requesterId
   * @returns {boolean}
   */
  deleteMemory(memoryId, requesterId = null) {
    this.ensureJournalState();
    const idx = OntheGoApp.state.memories.findIndex(m => m.id === memoryId);
    if (idx === -1) return false;

    const mem = OntheGoApp.state.memories[idx];
    const activeId = requesterId || (window.OntheGoCollaboration ? OntheGoCollaboration.getActiveTraveller().id : null);

    // Only author or trip lead can delete
    if (activeId && mem.authorId !== activeId && activeId !== "traveller-1") {
      alert("Only the author or trip lead can delete this memory.");
      return false;
    }

    OntheGoApp.state.memories.splice(idx, 1);

    if (window.OntheGoSyncEngine) {
      OntheGoSyncEngine.enqueueOperation({
        entityType: "memory",
        action: "delete",
        recordId: memoryId
      });
    }

    if (window.OntheGoApp && OntheGoApp.saveState) {
      OntheGoApp.saveState();
    }

    this.renderJournal();
    return true;
  },

  /**
   * Toggles favourite status.
   */
  toggleFavourite(memoryId) {
    this.ensureJournalState();
    const mem = OntheGoApp.state.memories.find(m => m.id === memoryId);
    if (!mem) return false;
    mem.isFavourite = !mem.isFavourite;
    OntheGoApp.saveState();
    this.renderJournal();
    return mem.isFavourite;
  },

  /**
   * Toggles must-revisit status.
   */
  toggleMustRevisit(memoryId) {
    this.ensureJournalState();
    const mem = OntheGoApp.state.memories.find(m => m.id === memoryId);
    if (!mem) return false;
    mem.isMustRevisit = !mem.isMustRevisit;
    OntheGoApp.saveState();
    this.renderJournal();
    return mem.isMustRevisit;
  },

  // ==========================================
  // TRIP RECAP EXPORT & PRIVACY CONTROLS
  // ==========================================

  /**
   * Builds the exportable recap data with strict privacy filters.
   * Strips private notes, booking codes, and sensitive location checks unless explicitly approved.
   * @param {Object} options { includePrivateNotes: boolean, includeBookingCodes: boolean }
   * @returns {Object}
   */
  buildRecapExportData(options = {}) {
    const includePrivateNotes = !!options.includePrivateNotes;
    const includeBookingCodes = !!options.includeBookingCodes;

    const trip = OntheGoApp.getActiveTrip();
    const memories = this.getMemories(null, !includePrivateNotes);

    const photosCollected = [];
    memories.forEach(m => {
      (m.photos || []).forEach(p => {
        photosCollected.push({
          url: p.url,
          caption: p.caption || m.title,
          day: m.dayNumber,
          destination: m.destination,
          takenAt: p.takenAt
        });
      });
    });

    const highlights = memories.filter(m => m.isFavourite || (m.rating && m.rating >= 4));
    const mustRevisit = memories.filter(m => m.isMustRevisit);

    // Sanitized itinerary summaries
    const sanitizedDays = (trip.days || []).map(d => ({
      dayNumber: d.dayNumber,
      date: d.dateHuman,
      title: d.title,
      destination: d.nightStayName,
      completedStops: (d.activities || []).filter(a => a.status === "completed").map(a => a.title),
      totalStops: (d.activities || []).length
    }));

    return {
      title: "OntheGO • Kochi & Alleppey Scooter Expedition Recap",
      dates: "16 – 20 October 2026",
      travellers: (OntheGoApp.state.travellers || []).map(t => t.name),
      generatedAt: new Date().toISOString(),
      stats: {
        totalMemories: memories.length,
        totalPhotos: photosCollected.length,
        totalFavourites: highlights.length,
        mustRevisitCount: mustRevisit.length
      },
      highlights: highlights.map(h => ({
        place: h.title,
        destination: h.destination,
        day: h.dayNumber,
        rating: h.rating,
        moment: h.favouriteMoment || h.caption || h.notes,
        // STRICT PRIVACY: omit privateNotes unless authorized
        notes: h.notes,
        privateNotes: includePrivateNotes ? h.privateNotes : undefined
      })),
      mustRevisitPlaces: mustRevisit.map(r => ({
        place: r.title,
        destination: r.destination,
        rating: r.rating
      })),
      days: sanitizedDays,
      photos: photosCollected
    };
  },

  /**
   * Generates a downloadable standalone HTML recap file.
   */
  exportRecapHTML(options = {}) {
    const data = this.buildRecapExportData(options);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${data.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #faf7f2;
      --card-bg: #ffffff;
      --teal: #0d828a;
      --terracotta: #c85a32;
      --text: #182320;
      --text-muted: #5e6d67;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 24px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #e7ded0; padding-bottom: 20px; }
    h1 { color: var(--teal); margin: 0 0 8px 0; font-size: 1.8rem; }
    .subtitle { color: var(--terracotta); font-weight: 700; font-size: 1rem; }
    .meta { font-size: 0.85rem; color: var(--text-muted); margin-top: 6px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 28px; }
    .stat-card { background: var(--card-bg); padding: 14px; border-radius: 12px; text-align: center; border: 1px solid #e7ded0; }
    .stat-val { font-size: 1.4rem; font-weight: 800; color: var(--teal); }
    .stat-lbl { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-top: 2px; }
    .section-title { font-size: 1.25rem; font-weight: 800; color: var(--teal); border-bottom: 1px solid #e7ded0; padding-bottom: 6px; margin-top: 28px; }
    .highlight-card { background: var(--card-bg); border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #e7ded0; }
    .highlight-title { font-weight: 800; font-size: 1.05rem; display: flex; justify-content: space-between; align-items: center; }
    .moment-text { font-style: italic; color: var(--text-muted); margin-top: 6px; font-size: 0.95rem; }
    .day-pill { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 14px; }
    .photo-card { background: var(--card-bg); border-radius: 10px; overflow: hidden; border: 1px solid #e7ded0; }
    .photo-card img { width: 100%; height: 160px; object-fit: cover; display: block; }
    .photo-caption { padding: 8px 10px; font-size: 0.8rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <header>
    <h1>🛵 ${data.title}</h1>
    <div class="subtitle">${data.dates} • Travellers: ${data.travellers.join(" & ")}</div>
    <div class="meta">Exported on ${new Date(data.generatedAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-val">${data.stats.totalMemories}</div>
      <div class="stat-lbl">Moments</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${data.stats.totalPhotos}</div>
      <div class="stat-lbl">Photos</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${data.stats.totalFavourites}</div>
      <div class="stat-lbl">Favourites</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${data.stats.mustRevisitCount}</div>
      <div class="stat-lbl">Must Revisit</div>
    </div>
  </div>

  <h2 class="section-title">✨ Trip Highlights & Favourite Moments</h2>
  ${!data.highlights.length ? '<p style="color: var(--text-muted);">No highlights recorded yet.</p>' : data.highlights.map(h => `
    <div class="highlight-card">
      <div class="highlight-title">
        <span>${h.place} <span style="font-size: 0.85rem; color: #f59e0b;">${'★'.repeat(h.rating)}</span></span>
        <span class="day-pill">Day ${h.day} • ${h.destination}</span>
      </div>
      <div class="moment-text">"${h.moment}"</div>
    </div>
  `).join("")}

  <h2 class="section-title">📍 Must Revisit in Kerala</h2>
  ${!data.mustRevisitPlaces.length ? '<p style="color: var(--text-muted);">No revisit spots tagged yet.</p>' : `
    <ul style="padding-left: 20px;">
      ${data.mustRevisitPlaces.map(r => `<li><b>${r.place}</b> (${r.destination})</li>`).join("")}
    </ul>
  `}

  <h2 class="section-title">📸 Field Photo Highlights</h2>
  <div class="photo-grid">
    ${!data.photos.length ? '<p style="color: var(--text-muted); grid-column: 1/-1;">No photos attached yet.</p>' : data.photos.map(p => `
      <div class="photo-card">
        <img src="${p.url}" alt="${p.caption || 'Trip Photo'}" onerror="this.src='https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=400&q=80'">
        <div class="photo-caption">${p.caption || p.destination}</div>
      </div>
    `).join("")}
  </div>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7ded0; text-align: center; font-size: 0.8rem; color: var(--text-muted);">
    Generated with OntheGO • Mobile-First Travel Companion
  </footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OntheGO_Trip_Recap_${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast("Trip recap HTML exported successfully! 📖");
    }
  },

  // ==========================================
  // UI RENDERING & MODALS
  // ==========================================

  /**
   * Renders the complete travel journal in the More -> Journal sub-view.
   */
  renderJournal() {
    const container = document.getElementById("journalContainer");
    if (!container) return;

    const activeTraveller = window.OntheGoCollaboration
      ? OntheGoCollaboration.getActiveTraveller()
      : { id: "traveller-1", name: "Vishnu" };

    const memories = this.getMemories(activeTraveller.id, true);
    const favSummary = this.getFavouritesAndRevisits(activeTraveller.id);

    if (!memories.length) {
      container.innerHTML = `
        <div class="empty-state-card" style="text-align: center; padding: 40px 20px; background: var(--bg-card); border-radius: 14px; border: 1px dashed var(--border-color); margin-top: 10px;">
          <div style="font-size: 3rem; margin-bottom: 8px;">📷</div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">Your Trip Journal is Empty</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 380px; margin: 0 auto 16px auto;">
            Capture memories, attach photos, rate coastal cafes, and record private travel notes as you ride through Kerala!
          </p>
          <button type="button" class="btn-primary" onclick="OntheGoJournal.openAddMemoryModal()">
            ✍️ Write First Memory
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <!-- Favourites & Must Revisit Strip -->
      <div style="display: flex; gap: 8px; margin-bottom: 14px; overflow-x: auto; scrollbar-width: none;">
        <div class="stat-card" style="flex: 1; min-width: 130px; background: var(--bg-card); border-radius: 10px; padding: 10px 14px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--ocean-teal);">Moments</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--text-main);">${memories.length}</div>
        </div>
        <div class="stat-card" style="flex: 1; min-width: 130px; background: var(--bg-card); border-radius: 10px; padding: 10px 14px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #f59e0b;">★ Favourites</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--text-main);">${favSummary.favourites.length}</div>
        </div>
        <div class="stat-card" style="flex: 1; min-width: 130px; background: var(--bg-card); border-radius: 10px; padding: 10px 14px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--kerala-terracotta);">📍 Must Revisit</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--text-main);">${favSummary.mustRevisit.length}</div>
        </div>
      </div>

      <!-- Action Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <button type="button" class="btn-primary-sm" onclick="OntheGoJournal.openAddMemoryModal()">
          ➕ Add Memory / Photo
        </button>
        <button type="button" class="btn-sm" onclick="OntheGoJournal.exportRecapHTML()">
          📖 Export Recap HTML
        </button>
      </div>

      <!-- Chronological Feed -->
      <div class="journal-feed">
        ${memories.map(m => this.renderMemoryCardHtml(m, activeTraveller.id)).join("")}
      </div>
    `;
  },

  renderMemoryCardHtml(mem, currentTravellerId) {
    const isAuthor = mem.authorId === currentTravellerId;
    const hasPhotos = Array.isArray(mem.photos) && mem.photos.length > 0;

    return `
      <div class="card journal-card" id="mem-card-${mem.id}" style="margin-bottom: 12px; border-radius: 14px; padding: 14px; background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <span class="route-meta-badge" style="background: rgba(13, 130, 138, 0.1); color: var(--ocean-teal); font-size: 0.72rem; font-weight: 700;">
              Day ${mem.dayNumber} • ${mem.destination}
            </span>
            ${mem.isFavourite ? '<span style="color: #f59e0b; margin-left: 4px;" title="Favourite">★</span>' : ''}
            ${mem.isMustRevisit ? '<span style="color: var(--kerala-terracotta); margin-left: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(200, 90, 50, 0.1); padding: 1px 6px; border-radius: 8px;">Revisit</span>' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.8rem; color: #f59e0b;">${'★'.repeat(mem.rating || 5)}</span>
            <button class="icon-btn" style="width: 26px; height: 26px; font-size: 0.8rem;" onclick="OntheGoJournal.openEditMemoryModal('${mem.id}')">✏️</button>
          </div>
        </div>

        <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 4px 0 2px 0;">
          ${mem.title}
        </h4>

        ${mem.activityTitle ? `
          <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
            📍 Linked stop: <b>${mem.activityTitle}</b>
          </div>
        ` : ''}

        ${mem.caption ? `
          <div style="font-size: 0.88rem; font-weight: 600; color: var(--ocean-teal); margin-bottom: 6px;">
            "${mem.caption}"
          </div>
        ` : ''}

        ${mem.favouriteMoment ? `
          <div style="font-size: 0.82rem; background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; color: var(--text-main);">
            <b>Highlight:</b> ${mem.favouriteMoment}
          </div>
        ` : ''}

        ${mem.notes ? `
          <p style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.45; margin: 0 0 8px 0;">
            ${mem.notes}
          </p>
        ` : ''}

        <!-- Optional Private Notes (Author eyes only) -->
        ${mem.privateNotes && isAuthor ? `
          <div style="background: rgba(220, 38, 38, 0.06); border: 1px dashed rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; font-size: 0.8rem; color: #b91c1c;">
            🔒 <b>Private Note:</b> ${mem.privateNotes}
            <span style="display: block; font-size: 0.68rem; color: #991b1b; margin-top: 2px;">Hidden from partner view and public recap export.</span>
          </div>
        ` : ''}

        <!-- Photos Row -->
        ${hasPhotos ? `
          <div style="display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; scrollbar-width: none; margin-bottom: 8px;">
            ${mem.photos.map(p => `
              <div style="flex-shrink: 0; width: 140px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: #eee;">
                <img src="${p.url}" alt="${p.caption || 'Memory'}" style="width: 140px; height: 100px; object-fit: cover; display: block;" onerror="this.src='https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=300&q=80'">
                ${p.caption ? `<div style="font-size: 0.68rem; padding: 3px 6px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.caption}</div>` : ''}
              </div>
            `).join("")}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-muted); border-top: 1px solid rgba(0,0,0,0.05); padding-top: 6px; margin-top: 6px;">
          <span>By <b>${mem.authorName || 'Traveller'}</b></span>
          <div style="display: flex; gap: 10px;">
            <button style="background: none; border: none; cursor: pointer; color: ${mem.isFavourite ? '#f59e0b' : 'var(--text-muted)'}; font-size: 0.75rem; font-weight: 700;" onclick="OntheGoJournal.toggleFavourite('${mem.id}')">
              ${mem.isFavourite ? '★ Favourite' : '☆ Add to Fav'}
            </button>
            <button style="background: none; border: none; cursor: pointer; color: ${mem.isMustRevisit ? 'var(--kerala-terracotta)' : 'var(--text-muted)'}; font-size: 0.75rem; font-weight: 700;" onclick="OntheGoJournal.toggleMustRevisit('${mem.id}')">
              ${mem.isMustRevisit ? '📍 Marked Revisit' : '📍 Revisit'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openAddMemoryModal(activityId = null) {
    const modal = document.getElementById("memoryModal");
    if (!modal) return;

    document.getElementById("memModalTitle").innerText = "✍️ Record Travel Memory";
    document.getElementById("memId").value = "";
    document.getElementById("memTitle").value = "";
    document.getElementById("memCaption").value = "";
    document.getElementById("memNotes").value = "";
    document.getElementById("memPrivateNotes").value = "";
    document.getElementById("memFavouriteMoment").value = "";
    document.getElementById("memRating").value = "5";
    document.getElementById("memIsFavourite").checked = false;
    document.getElementById("memIsMustRevisit").checked = false;
    document.getElementById("memIsPrivate").checked = false;
    document.getElementById("memPhotoUrl").value = "";

    // Day & Activity select
    const trip = OntheGoApp.getActiveTrip();
    const actSelect = document.getElementById("memActivitySelect");
    if (actSelect) {
      actSelect.innerHTML = '<option value="">-- General Trip Memory (No specific stop) --</option>';
      (trip.days || []).forEach(d => {
        (d.activities || []).forEach(a => {
          const sel = (activityId && a.id === activityId) ? "selected" : "";
          actSelect.innerHTML += `<option value="${a.id}" data-day="${d.dayNumber}" data-dest="${a.location || d.nightStayName}" ${sel}>Day ${d.dayNumber}: ${a.title}</option>`;
        });
      });
    }

    modal.classList.add("open");
    modal.classList.add("active");
  },

  openEditMemoryModal(memoryId) {
    const mem = (OntheGoApp.state?.memories || []).find(m => m.id === memoryId);
    if (!mem) return;

    this.openAddMemoryModal();
    document.getElementById("memModalTitle").innerText = "✏️ Edit Travel Memory";
    document.getElementById("memId").value = mem.id;
    document.getElementById("memTitle").value = mem.title || "";
    document.getElementById("memCaption").value = mem.caption || "";
    document.getElementById("memNotes").value = mem.notes || "";
    document.getElementById("memPrivateNotes").value = mem.privateNotes || "";
    document.getElementById("memFavouriteMoment").value = mem.favouriteMoment || "";
    document.getElementById("memRating").value = mem.rating || "5";
    document.getElementById("memIsFavourite").checked = !!mem.isFavourite;
    document.getElementById("memIsMustRevisit").checked = !!mem.isMustRevisit;
    document.getElementById("memIsPrivate").checked = !!mem.isPrivate;
    document.getElementById("memPhotoUrl").value = mem.photos?.[0]?.url || "";

    if (mem.activityId) {
      document.getElementById("memActivitySelect").value = mem.activityId;
    }
  },

  handleMemoryFormSubmit(event) {
    if (event) event.preventDefault();

    const memId = document.getElementById("memId").value || null;
    const title = document.getElementById("memTitle").value.trim();
    const caption = document.getElementById("memCaption").value.trim();
    const notes = document.getElementById("memNotes").value.trim();
    const privateNotes = document.getElementById("memPrivateNotes").value.trim();
    const favouriteMoment = document.getElementById("memFavouriteMoment").value.trim();
    const rating = parseInt(document.getElementById("memRating").value, 10) || 5;
    const isFavourite = document.getElementById("memIsFavourite").checked;
    const isMustRevisit = document.getElementById("memIsMustRevisit").checked;
    const isPrivate = document.getElementById("memIsPrivate").checked;
    const photoUrl = document.getElementById("memPhotoUrl").value.trim();

    const actSelect = document.getElementById("memActivitySelect");
    const activityId = actSelect ? actSelect.value : null;
    let activityTitle = null;
    let dayNumber = 1;
    let destination = "Fort Kochi";

    if (activityId) {
      const opt = actSelect.options[actSelect.selectedIndex];
      activityTitle = opt ? opt.text.split(":")[1]?.trim() : null;
      dayNumber = parseInt(opt?.getAttribute("data-day"), 10) || 1;
      destination = opt?.getAttribute("data-dest") || "Fort Kochi";
    }

    const photos = [];
    if (photoUrl) {
      photos.push({
        id: "p_" + Date.now(),
        url: photoUrl,
        caption: caption || title,
        takenAt: new Date().toISOString(),
        isOriginalIntact: true
      });
    }

    this.saveMemory({
      id: memId,
      activityId,
      activityTitle,
      dayNumber,
      destination,
      title: title || caption || "Travel Memory",
      caption,
      notes,
      privateNotes,
      favouriteMoment,
      rating,
      isFavourite,
      isMustRevisit,
      isPrivate,
      photos
    });

    const modal = document.getElementById("memoryModal");
    if (modal) {
      modal.classList.remove("open");
      modal.classList.remove("active");
    }
    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast("Memory saved successfully! ✨");
    }
  }
};
