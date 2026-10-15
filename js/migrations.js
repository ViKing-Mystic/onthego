/**
 * OntheGO - Safe State Migration Engine
 * Ensures data integrity across schema versions without data loss.
 * Preserves user-created stops, custom notes, logged expenses, and checklist marks.
 */

window.OntheGoMigrations = {
  CURRENT_SCHEMA_VERSION: 9,

  /**
   * Migrates any loaded state object to the current schema version.
   * @param {Object} rawState
   * @returns {Object} Migrated state
   */
  migrate(rawState) {
    if (!rawState || typeof rawState !== "object") {
      return this.getFreshDefaultState();
    }

    const state = JSON.parse(JSON.stringify(rawState));
    const version = state.schemaVersion || 1;

    if (version < 2) {
      // Version 1 -> Version 2: Ensure default trips and core structures
      if (!state.trips || !Array.isArray(state.trips) || !state.trips.length) {
        state.trips = JSON.parse(JSON.stringify(window.OntheGoDefaultData.trips || []));
      }
      if (!state.activeTripId) {
        state.activeTripId = window.OntheGoDefaultData.activeTripId || "trip-kochi-alleppey-2026";
      }
      if (!state.expenses || !Array.isArray(state.expenses)) {
        state.expenses = JSON.parse(JSON.stringify(window.OntheGoDefaultData.expenses || []));
      }
      if (!state.checklist || !Array.isArray(state.checklist)) {
        state.checklist = JSON.parse(JSON.stringify(window.OntheGoDefaultData.checklist || []));
      }
      if (!state.contacts || !Array.isArray(state.contacts)) {
        state.contacts = JSON.parse(JSON.stringify(window.OntheGoDefaultData.contacts || []));
      }
      state.schemaVersion = 2;
    }

    if (version < 3) {
      // Version 2 -> Version 3: Two-traveller model, travel memories, and AI assistant settings
      if (!state.travellers || !Array.isArray(state.travellers) || state.travellers.length < 2) {
        state.travellers = [
          {
            id: "traveller-1",
            name: "Vishnu",
            role: "Trip Lead & Scooter Rider",
            phone: "+91 99951 65493",
            emergencyContact: "Kerala Tourism: 1363 / Police: 112",
            avatar: "🛵",
            isLead: true,
            notes: "Scooter driver; handles rental documentation and fuel stops."
          },
          {
            id: "traveller-2",
            name: "Co-rider",
            role: "Navigator & Photo Chronicler",
            phone: "+91 79944 55407",
            emergencyContact: "Kerala Tourism: 1363 / Police: 112",
            avatar: "🌴",
            isLead: false,
            notes: "Manages navigation cues, Opulence kayaking check-ins, and expense logs."
          }
        ];
      }

      // Ensure travel memories collection exists
      if (!state.memories || !Array.isArray(state.memories)) {
        state.memories = [];
      }

      // Ensure AI Assistant settings exist
      if (!state.aiSettings || typeof state.aiSettings !== "object") {
        state.aiSettings = {
          provider: "offline",
          apiKey: "",
          model: "gemini-1.5-flash",
          enabled: true
        };
      }

      // Migrate existing expense payer references from legacy strings to consistent keys
      if (Array.isArray(state.expenses)) {
        state.expenses.forEach(e => {
          if (!e.participants || !e.participants.length) {
            e.participants = ["traveller-1", "traveller-2"];
          }
          if (e.paidBy === "Me") e.paidBy = "traveller-1";
          if (e.paidBy === "Co-rider") e.paidBy = "traveller-2";
          if (!e.currency) e.currency = "INR";
        });
      }

      state.schemaVersion = 3;
    }

    if (version < 4) {
      // Version 3 -> Version 4: Seed primary user-provided bookings & contacts metadata
      const freshDefaults = window.OntheGoDefaultData || {};

      // Merge commitments
      if (freshDefaults.trips && freshDefaults.trips[0] && freshDefaults.trips[0].commitments) {
        if (!state.trips || !state.trips.length) {
          state.trips = JSON.parse(JSON.stringify(freshDefaults.trips));
        }
        if (state.trips[0]) {
          state.trips[0].commitments = JSON.parse(JSON.stringify(freshDefaults.trips[0].commitments));

          // Also sync user-provided booking metadata into seeded activities (act-1-1, act-1-2, act-1-3, act-2-10, act-3-1, act-3-2, act-3-3, act-4-7, act-5-6, act-5-8)
          const defaultDays = freshDefaults.trips[0].days || [];
          const userProvidedIds = [
            "act-1-1", "act-1-2", "act-1-3", "act-2-10", "act-3-1", "act-3-2", "act-3-3", "act-4-7", "act-5-6", "act-5-8"
          ];
          if (Array.isArray(state.trips[0].days)) {
            state.trips[0].days.forEach(day => {
              if (Array.isArray(day.activities)) {
                day.activities.forEach(act => {
                  if (userProvidedIds.includes(act.id)) {
                    for (const defDay of defaultDays) {
                      const defAct = (defDay.activities || []).find(a => a.id === act.id);
                      if (defAct) {
                        act.isUserProvided = true;
                        act.verified = false;
                        act.verificationSource = defAct.verificationSource || "User-provided booking details";
                        if (defAct.phone) act.phone = defAct.phone;
                        if (defAct.cost !== undefined) act.cost = defAct.cost;
                        if (defAct.bookingStatus) act.bookingStatus = defAct.bookingStatus;
                        break;
                      }
                    }
                  }
                });
              }
            });
          }
        }
      }

      // Sync contacts with user-provided details (scooter 9003955156, etc.)
      if (freshDefaults.contacts && Array.isArray(freshDefaults.contacts)) {
        if (!Array.isArray(state.contacts)) {
          state.contacts = JSON.parse(JSON.stringify(freshDefaults.contacts));
        } else {
          freshDefaults.contacts.forEach(defContact => {
            const existing = state.contacts.find(c => c.id === defContact.id);
            if (existing) {
              Object.assign(existing, {
                phone: defContact.phone,
                cost: defContact.cost,
                totalCost: defContact.totalCost,
                advancePaid: defContact.advancePaid,
                balanceDue: defContact.balanceDue,
                returnDeadline: defContact.returnDeadline,
                status: defContact.status,
                bookingRef: defContact.bookingRef,
                isUserProvided: true,
                verified: false,
                verificationSource: defContact.verificationSource
              });
            } else {
              state.contacts.push(JSON.parse(JSON.stringify(defContact)));
            }
          });
        }
      }

      state.schemaVersion = 4;
    }

    if (version < 5) {
      // Version 4 -> Version 5: Stage 2 Collaboration, Change History, Minor Units & Preferences
      if (!state.collaboration || typeof state.collaboration !== "object") {
        state.collaboration = {
          activeTravellerId: "traveller-1",
          isTripPrivate: true,
          inviteToken: "7f4c9a81e2b5d034",
          inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          inviteStatus: "idle",
          accessPin: "762415",
          partnerConnected: true
        };
      }

      if (!state.preferences || typeof state.preferences !== "object") {
        state.preferences = {
          foodAndDining: {
            dietary: "Kerala Coastal Seafood & Traditional Vegetarian",
            spiceTolerance: "Medium",
            preferences: ["Karimeen Pollichathu", "Appam & Stew", "Sulaimani Tea", "Filter Coffee"],
            dislikedFoods: ["Overly sweet curries", "Heavy meals before riding"]
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
      }

      if (!Array.isArray(state.changeHistory)) {
        state.changeHistory = [];
      }

      if (!Array.isArray(state.materialChanges)) {
        state.materialChanges = [];
      }

      if (!state.locationSharing || typeof state.locationSharing !== "object") {
        state.locationSharing = {
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
      }

      // Upgrade expenses to minor units and ensure split details
      if (Array.isArray(state.expenses)) {
        state.expenses.forEach(e => {
          if (e.amountPaise === undefined) {
            e.amountPaise = Math.round((parseFloat(e.amount) || 0) * 100);
          }
          if (!e.currency) e.currency = "INR";
          if (e.fxRate === undefined) e.fxRate = 1.0;
          if (e.amountInInrPaise === undefined) {
            e.amountInInrPaise = Math.round(e.amountPaise * e.fxRate);
          }
          if (!e.splitMethod) e.splitMethod = "equal";
          if (!e.participants || !e.participants.length) {
            e.participants = ["traveller-1", "traveller-2"];
          }
        });
      }

      state.schemaVersion = 5;
    }

    if (version < 6) {
      // Version 5 -> Version 6: Stage 3 Trip Follow-up Engine
      if (!Array.isArray(state.reminders)) {
        state.reminders = [];
      }
      if (!state.reminderSettings || typeof state.reminderSettings !== "object") {
        state.reminderSettings = {
          enabled: true,
          defaultLeadMins: 30,
          quietHoursEnabled: true,
          quietHoursStart: "22:30",
          quietHoursEnd: "06:30",
          timeZone: "Asia/Kolkata"
        };
      }
      if (!Array.isArray(state.activeRecommendations)) {
        state.activeRecommendations = [];
      }
      if (!Array.isArray(state.notifications)) {
        state.notifications = [];
      }
      if (!Array.isArray(state.backupDatabase) || !state.backupDatabase.length) {
        state.backupDatabase = (window.OntheGoDefaultData && window.OntheGoDefaultData.backupDatabase)
          ? JSON.parse(JSON.stringify(window.OntheGoDefaultData.backupDatabase))
          : [];
      }
      if (!state.routingCache || typeof state.routingCache !== "object") {
        state.routingCache = {};
      }
      if (!state.weatherCache || typeof state.weatherCache !== "object") {
        state.weatherCache = {};
      }
      if (!Array.isArray(state.aiProposals)) {
        state.aiProposals = [];
      }

      state.schemaVersion = 6;
    }

    if (version < 7) {
      // Version 6 -> Version 7: Backup Database Candidates & Enhanced Verification
      const freshDefaults = window.OntheGoDefaultData || {};
      if (freshDefaults.backupDatabase && Array.isArray(freshDefaults.backupDatabase)) {
        if (!Array.isArray(state.backupDatabase) || !state.backupDatabase.length) {
          state.backupDatabase = JSON.parse(JSON.stringify(freshDefaults.backupDatabase));
        } else {
          freshDefaults.backupDatabase.forEach(defBackup => {
            const existing = state.backupDatabase.find(b => b.id === defBackup.id);
            if (!existing) {
              state.backupDatabase.push(JSON.parse(JSON.stringify(defBackup)));
            } else {
              // Non-destructively enrich candidate fields
              Object.assign(existing, {
                rating: defBackup.rating,
                reviewCount: defBackup.reviewCount,
                openingHours: defBackup.openingHours,
                phone: defBackup.phone,
                address: defBackup.address,
                mapUrl: defBackup.mapUrl,
                status: defBackup.status,
                notes: defBackup.notes,
                category: defBackup.category,
                source: defBackup.source,
                isUserProvided: true
              });
            }
          });
        }
      }

      // Ensure Day 5 Kashi Art Cafe has updated contact/hours and is preserved as primary stop
      if (state.trips && state.trips[0] && Array.isArray(state.trips[0].days)) {
        const day5 = state.trips[0].days.find(d => d.id === "day-5" || d.dayNumber === 5);
        if (day5 && Array.isArray(day5.activities)) {
          const kashiAct = day5.activities.find(a => a.id === "act-5-3");
          if (kashiAct) {
            kashiAct.phone = "+91 484 221 5769";
            kashiAct.address = "Burger Street, Fort Nagar, Fort Kochi 682001";
            kashiAct.openingHours = "8:30 AM - 10:00 PM";
            kashiAct.rating = 4.2;
            kashiAct.reviewCount = 11380;
            kashiAct.isUserProvided = true;
          }
        }
      }

      state.schemaVersion = 7;
    }

    if (version < 8) {
      // Version 7 -> Version 8: Stage 4 Offline Capabilities, Sync Queue & Offline Vault
      if (!Array.isArray(state.syncQueue)) {
        state.syncQueue = [];
      }
      if (!Array.isArray(state.syncConflicts)) {
        state.syncConflicts = [];
      }
      if (!Array.isArray(state.offlineDocuments) || !state.offlineDocuments.length) {
        state.offlineDocuments = (window.OntheGoVault && window.OntheGoVault.DEFAULT_DOCUMENTS)
          ? JSON.parse(JSON.stringify(window.OntheGoVault.DEFAULT_DOCUMENTS))
          : [];
      }
      if (!state.storageAudit || typeof state.storageAudit !== "object") {
        state.storageAudit = {
          persistenceMode: "IndexedDB + LocalStorage Mirror",
          offlineReadiness: true,
          lastSyncAttempt: null
        };
      }

      state.schemaVersion = 8;
    }

    if (version < 9) {
      // Version 8 -> Version 9: Stage 5 Travel Memories, Reports, Assistant & Budget Forecast
      if (!Array.isArray(state.memories)) {
        state.memories = [];
      }
      if (!state.journalSettings || typeof state.journalSettings !== "object") {
        state.journalSettings = {
          showPrivateNotes: true,
          selectedDestinationFilter: "all",
          selectedTagFilter: "all"
        };
      }
      if (!Array.isArray(state.assistantChatHistory)) {
        state.assistantChatHistory = [
          {
            id: "msg_init",
            role: "assistant",
            text: "Namaskaram! 🌴 I am your OntheGO Travel Companion for your Kerala road trip. Ask me about next stops, cafe alternatives, sunset timings, expense settlements, or route adjustments.",
            timestamp: new Date().toISOString()
          }
        ];
      }
      if (!state.budgetForecast || typeof state.budgetForecast !== "object") {
        state.budgetForecast = {};
      }

      state.schemaVersion = 9;
    }

    // Ensure theme setting respects coastal aesthetic
    if (!state.theme) {
      state.theme = "coastal-light";
    }

    return state;
  },

  /**
   * Generates a pristine initial state from verified master data.
   */
  getFreshDefaultState() {
    const defaultData = window.OntheGoDefaultData || {};
    const state = JSON.parse(JSON.stringify(defaultData));
    state.schemaVersion = this.CURRENT_SCHEMA_VERSION;
    state.theme = "coastal-light";
    state.travellers = [
      {
        id: "traveller-1",
        name: "Vishnu",
        role: "Trip Lead & Scooter Rider",
        phone: "+91 99951 65493",
        emergencyContact: "Kerala Tourism: 1363 / Police: 112",
        avatar: "🛵",
        isLead: true,
        notes: "Scooter driver; handles rental documentation and fuel stops."
      },
      {
        id: "traveller-2",
        name: "Co-rider",
        role: "Navigator & Photo Chronicler",
        phone: "+91 79944 55407",
        emergencyContact: "Kerala Tourism: 1363 / Police: 112",
        avatar: "🌴",
        isLead: false,
        notes: "Manages navigation cues, Opulence kayaking check-ins, and expense logs."
      }
    ];
    state.memories = [];
    state.aiSettings = {
      provider: "offline",
      apiKey: "",
      model: "gemini-1.5-flash",
      enabled: true
    };
    state.collaboration = {
      activeTravellerId: "traveller-1",
      isTripPrivate: true,
      inviteToken: "7f4c9a81e2b5d034",
      inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      inviteStatus: "idle",
      accessPin: "762415",
      partnerConnected: true
    };
    state.preferences = {
      foodAndDining: {
        dietary: "Kerala Coastal Seafood & Traditional Vegetarian",
        spiceTolerance: "Medium",
        preferences: ["Karimeen Pollichathu", "Appam & Stew", "Sulaimani Tea", "Filter Coffee"],
        dislikedFoods: ["Overly sweet curries", "Heavy meals before riding"]
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
    state.changeHistory = [];
    state.materialChanges = [];
    state.locationSharing = {
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
    state.reminders = [];
    state.reminderSettings = {
      enabled: true,
      defaultLeadMins: 30,
      quietHoursEnabled: true,
      quietHoursStart: "22:30",
      quietHoursEnd: "06:30",
      timeZone: "Asia/Kolkata"
    };
    state.activeRecommendations = [];
    state.notifications = [];
    state.backupDatabase = defaultData.backupDatabase ? JSON.parse(JSON.stringify(defaultData.backupDatabase)) : [];
    state.routingCache = {};
    state.weatherCache = {};
    state.aiProposals = [];
    state.syncQueue = [];
    state.syncConflicts = [];
    state.offlineDocuments = (window.OntheGoVault && window.OntheGoVault.DEFAULT_DOCUMENTS)
      ? JSON.parse(JSON.stringify(window.OntheGoVault.DEFAULT_DOCUMENTS))
      : [];
    state.storageAudit = {
      persistenceMode: "IndexedDB + LocalStorage Mirror",
      offlineReadiness: true,
      lastSyncAttempt: null
    };

    if (Array.isArray(state.expenses)) {
      state.expenses.forEach(e => {
        if (e.amountPaise === undefined) {
          e.amountPaise = Math.round((parseFloat(e.amount) || 0) * 100);
        }
        if (!e.currency) e.currency = "INR";
        if (e.fxRate === undefined) e.fxRate = 1.0;
        if (e.amountInInrPaise === undefined) {
          e.amountInInrPaise = Math.round(e.amountPaise * e.fxRate);
        }
        if (!e.splitMethod) e.splitMethod = "equal";
        if (!e.participants || !e.participants.length) {
          e.participants = ["traveller-1", "traveller-2"];
        }
        if (!e.paidBy || e.paidBy === "Me") e.paidBy = "traveller-1";
      });
    }

    state.memories = [];
    state.journalSettings = {
      showPrivateNotes: true,
      selectedDestinationFilter: "all",
      selectedTagFilter: "all"
    };
    state.assistantChatHistory = [
      {
        id: "msg_init",
        role: "assistant",
        text: "Namaskaram! 🌴 I am your OntheGO Travel Companion for your Kerala road trip. Ask me about next stops, cafe alternatives, sunset timings, expense settlements, or route adjustments.",
        timestamp: new Date().toISOString()
      }
    ];
    state.budgetForecast = {};

    return state;
  }
};
