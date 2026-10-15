/**
 * OntheGO - Stage 5: Comprehensive Trip Reports & Final Audit Generator
 * Generates audit reports comparing original vs actual itinerary,
 * completed/skipped/substituted stops, planned vs actual expenditure in minor units,
 * traveller split settlement balance, accommodation/transport summaries,
 * and unexpected delay timelines. Supports PDF/printable HTML export.
 */

window.OntheGoReports = {
  init() {
    this.renderReportView();
  },

  generateReport() {
    return this.generateReportData();
  },

  /**
   * Generates the comprehensive report data model.
   * @returns {Object}
   */
  generateReportData() {
    const trip = OntheGoApp.getActiveTrip();
    const defaultTrip = (window.OntheGoDefaultData && window.OntheGoDefaultData.trips)
      ? window.OntheGoDefaultData.trips[0]
      : trip;

    // 1. ORIGINAL VS ACTUAL ITINERARY AUDIT
    let totalPlannedStops = 0;
    let completedStops = 0;
    let skippedStops = 0;
    let substitutedStops = 0;
    const dayBreakdowns = [];

    (trip.days || []).forEach((day, dIdx) => {
      const defaultDay = defaultTrip.days?.[dIdx] || { activities: [] };
      const originalActivities = defaultDay.activities || [];
      const currentActivities = day.activities || [];

      totalPlannedStops += originalActivities.length;

      const dayCompleted = currentActivities.filter(a => a.status === "completed");
      const daySkipped = currentActivities.filter(a => a.status === "skipped");
      const daySubstituted = currentActivities.filter(a => a.substitutedBackupId || a.isSubstitute);

      completedStops += dayCompleted.length;
      skippedStops += daySkipped.length;
      substitutedStops += daySubstituted.length;

      dayBreakdowns.push({
        dayNumber: day.dayNumber,
        date: day.dateHuman,
        title: day.title,
        plannedCount: originalActivities.length,
        actualCount: currentActivities.length,
        completed: dayCompleted.map(a => ({ title: a.title, time: a.time, category: a.category })),
        skipped: daySkipped.map(a => ({ title: a.title, rationale: a.notes || "Skipped due to delay or schedule recovery" })),
        substituted: daySubstituted.map(a => ({
          original: a.originalTitle || a.title,
          replacement: a.title,
          reason: a.notes || "Substituted with backup candidate"
        }))
      });
    });

    // 2. PLANNED VS ACTUAL EXPENDITURE (MINOR UNITS IN PAISE)
    const targetDailySpendINR = OntheGoApp.state.preferences?.budgetSensitivity?.targetDailySpendINR || 3200;
    const totalPlannedBudgetPaise = targetDailySpendINR * 5 * 100; // ₹16,000 = 1,600,000 paise

    let totalActualPaise = 0;
    let totalPrepaidPaise = 0;
    const categoryTotalsPaise = {};
    const payerTotalsPaise = {
      "traveller-1": 0,
      "traveller-2": 0
    };

    (OntheGoApp.state.expenses || []).forEach(e => {
      const amtPaise = e.amountInInrPaise !== undefined
        ? e.amountInInrPaise
        : (e.amountPaise !== undefined ? e.amountPaise : Math.round((parseFloat(e.amount) || 0) * 100));

      totalActualPaise += amtPaise;
      if (e.isPrepaid) totalPrepaidPaise += amtPaise;

      const cat = e.category || "General";
      categoryTotalsPaise[cat] = (categoryTotalsPaise[cat] || 0) + amtPaise;

      const payerId = e.paidBy === "Me" ? "traveller-1" : (e.paidBy || "traveller-1");
      payerTotalsPaise[payerId] = (payerTotalsPaise[payerId] || 0) + amtPaise;
    });

    const budgetVariancePaise = totalPlannedBudgetPaise - totalActualPaise;

    // 3. SETTLEMENT BALANCE (2 TRAVELLERS)
    const splitLedger = window.OntheGoExpenses
      ? (typeof OntheGoExpenses.calculateNetSettlement === "function" ? OntheGoExpenses.calculateNetSettlement() : (typeof OntheGoExpenses.calculateSplits === "function" ? OntheGoExpenses.calculateSplits() : null))
      : null;

    // 4. ACCOMMODATION & TRANSPORT COMMITMENTS
    const commitments = trip.commitments || {};
    const accommodations = [
      {
        name: "Calvin's Inn",
        location: "Fort Kochi",
        checkIn: "16 Oct 2026",
        checkOut: "17 Oct 2026",
        status: "Booked (User-Provided)",
        contact: "+91 99951 65493",
        notes: "Quiet boutique stay in Fort Kochi. User-provided contact."
      },
      {
        name: "Ocean Aura Beach Stay",
        location: "Alleppey Coastal Road",
        checkIn: "17 Oct 2026",
        checkOut: "19 Oct 2026",
        status: "Booked (User-Provided)",
        contact: "+91 79944 55407",
        notes: "Beachfront stay on Thumpoly Beach. User-provided contact."
      },
      {
        name: "Zostel Kumbalangi",
        location: "Kumbalangi Backwaters",
        checkIn: "19 Oct 2026",
        checkOut: "20 Oct 2026",
        status: "Booked (User-Provided)",
        contact: "+91 484 2987123",
        notes: "Backwater village property with sunset canoe access."
      }
    ];

    const transports = [
      {
        service: "Return Vande Bharat Express",
        route: "Ernakulam Jn (ERS) ➔ Bangalore (SBC)",
        timing: "20 Oct 2026 • Departs 2:00 PM Sharp",
        fare: "₹1,708 per person",
        status: "Confirmed (Strict Hard Constraint)"
      },
      {
        service: "Scooter Rental (Access 125)",
        pickup: "16 Oct 2026 2:30 PM (Near ERS Station)",
        returnDeadline: "20 Oct 2026 by 1:00 PM target / 1:30 PM absolute deadline",
        financials: "₹2,800 total (₹500 advance paid, ₹2,300 balance due upon return)",
        contact: "+91 90039 55156",
        status: "Active Agreement (User-Provided)"
      }
    ];

    // 5. SAVED MEMORIES & FAVOURITES
    const memories = window.OntheGoJournal ? OntheGoJournal.getMemories(null, true) : [];
    const favourites = memories.filter(m => m.isFavourite || (m.rating && m.rating >= 4));

    // 6. UNEXPECTED DELAYS & MATERIAL CHANGES
    const changeLog = (OntheGoApp.state.changeHistory || []).slice(0, 30);

    return {
      title: `${trip.name || "Kochi–Alleppey Coastal Expedition"} • Final Trip Report & Travel Audit`,
      dates: "16 – 20 October 2026",
      travellers: OntheGoApp.state.travellers || [
        { id: "traveller-1", name: "Vishnu" },
        { id: "traveller-2", name: "Co-rider" }
      ],
      generatedAt: new Date().toISOString(),
      itineraryAudit: {
        totalPlannedStops,
        totalPlannedActivities: totalPlannedStops,
        completedStops,
        completedActivities: completedStops,
        skippedStops,
        substitutedStops,
        completionRatePct: totalPlannedStops > 0 ? Math.round((completedStops / totalPlannedStops) * 100) : 0,
        dayBreakdowns
      },
      financialAudit: {
        totalExpenditurePaise: totalActualPaise,
        totalExpenditureRupees: totalActualPaise / 100,
        plannedBudgetPaise: totalPlannedBudgetPaise,
        plannedBudgetINR: totalPlannedBudgetPaise / 100,
        actualSpentPaise: totalActualPaise,
        actualSpentINR: totalActualPaise / 100,
        prepaidPaise: totalPrepaidPaise,
        prepaidINR: totalPrepaidPaise / 100,
        variancePaise: budgetVariancePaise,
        varianceINR: budgetVariancePaise / 100,
        isUnderBudget: budgetVariancePaise >= 0,
        categoryTotalsINR: Object.entries(categoryTotalsPaise).map(([cat, paise]) => ({
          category: cat,
          amountINR: paise / 100
        })),
        payerTotalsINR: {
          "Vishnu": (payerTotalsPaise["traveller-1"] || 0) / 100,
          "Co-rider": (payerTotalsPaise["traveller-2"] || 0) / 100
        },
        settlementSummary: splitLedger,
        splitSettlement: splitLedger
      },
      accommodations,
      transports,
      memoriesSummary: {
        totalMemories: memories.length,
        favouritesCount: favourites.length,
        favourites: favourites.map(f => ({
          place: f.title,
          destination: f.destination,
          rating: f.rating,
          favouriteMoment: f.favouriteMoment || f.notes
        }))
      },
      unexpectedDelays: changeLog
    };
  },

  /**
   * Generates a printable HTML document for PDF generation or sharing.
   */
  exportReportHTML() {
    const data = this.generateReportData();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${data.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @media print {
      body { padding: 0; background: #fff; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    :root {
      --teal: #0d828a;
      --terracotta: #c85a32;
      --sand: #fdfbf7;
      --border: #e2d9cc;
      --text: #182320;
      --muted: #5e6d67;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--sand); color: var(--text); padding: 30px; max-width: 860px; margin: 0 auto; line-height: 1.5; font-size: 14px; }
    header { border-bottom: 2px solid var(--teal); padding-bottom: 16px; margin-bottom: 24px; }
    h1 { color: var(--teal); margin: 0 0 6px 0; font-size: 1.8rem; }
    .subtitle { color: var(--terracotta); font-weight: 700; font-size: 1.05rem; }
    .meta { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }
    .section-title { font-size: 1.25rem; font-weight: 800; color: var(--teal); border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 26px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .card { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
    .card-val { font-size: 1.35rem; font-weight: 800; color: var(--teal); }
    .card-lbl { font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--muted); margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; background: #fff; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    th { background: rgba(13, 130, 138, 0.08); color: var(--teal); font-weight: 800; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; }
    .badge-completed { background: #dcfce7; color: #15803d; }
    .badge-skipped { background: #fee2e2; color: #b91c1c; }
    .badge-sub { background: #fef3c7; color: #b45309; }
    .disclaimer { font-size: 0.78rem; color: var(--muted); background: #fefce8; border: 1px dashed #ca8a04; padding: 8px 12px; border-radius: 6px; margin: 12px 0; }
    .print-btn { background: var(--teal); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: right; margin-bottom: 16px;">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <header>
    <h1>🛵 ${data.title}</h1>
    <div class="subtitle">Dates: ${data.dates} • Travellers: ${data.travellers.map(t => t.name).join(" & ")}</div>
    <div class="meta">Generated: ${new Date(data.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</div>
  </header>

  <!-- 1. Executive Summary Cards -->
  <div class="grid-4">
    <div class="card">
      <div class="card-val">${data.itineraryAudit.completionRatePct}%</div>
      <div class="card-lbl">Route Completion</div>
    </div>
    <div class="card">
      <div class="card-val">₹${data.financialAudit.actualSpentINR.toLocaleString("en-IN")}</div>
      <div class="card-lbl">Total Actual Spend</div>
    </div>
    <div class="card">
      <div class="card-val" style="color: ${data.financialAudit.isUnderBudget ? '#15803d' : '#b91c1c'};">
        ${data.financialAudit.isUnderBudget ? 'Under ₹' : 'Over ₹'}${Math.abs(data.financialAudit.varianceINR).toLocaleString("en-IN")}
      </div>
      <div class="card-lbl">Budget Variance</div>
    </div>
    <div class="card">
      <div class="card-val">${data.memoriesSummary.totalMemories}</div>
      <div class="card-lbl">Moments Recorded</div>
    </div>
  </div>

  <!-- 2. Itinerary Audit -->
  <h2 class="section-title">📅 Itinerary Execution: Original vs. Actual</h2>
  <table>
    <thead>
      <tr>
        <th>Day</th>
        <th>Route / Destination</th>
        <th>Planned Stops</th>
        <th>Completed</th>
        <th>Skipped / Adjusted</th>
      </tr>
    </thead>
    <tbody>
      ${data.itineraryAudit.dayBreakdowns.map(d => `
        <tr>
          <td><b>Day ${d.dayNumber}</b></td>
          <td>${d.title}</td>
          <td>${d.plannedCount} stops</td>
          <td><span class="badge badge-completed">${d.completed.length} completed</span></td>
          <td>
            ${d.skipped.length ? `<span class="badge badge-skipped">${d.skipped.length} skipped</span> ` : ''}
            ${d.substituted.length ? `<span class="badge badge-sub">${d.substituted.length} substituted</span>` : ''}
            ${!d.skipped.length && !d.substituted.length ? '<span style="color: var(--muted);">None</span>' : ''}
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- 3. Financial Ledger & Split Settlement -->
  <h2 class="section-title">💳 Financial Ledger & Outstanding Settlement</h2>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px;">
    <div class="card">
      <h3 style="margin-top: 0; color: var(--teal); font-size: 0.95rem;">Expenditure by Category</h3>
      ${data.financialAudit.categoryTotalsINR.map(c => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee;">
          <span>${c.category}</span>
          <b>₹${c.amountINR.toLocaleString("en-IN")}</b>
        </div>
      `).join("")}
    </div>
    <div class="card">
      <h3 style="margin-top: 0; color: var(--teal); font-size: 0.95rem;">Traveller Contributions</h3>
      ${Object.entries(data.financialAudit.payerTotalsINR).map(([payer, amt]) => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee;">
          <span>${payer}</span>
          <b>₹${amt.toLocaleString("en-IN")}</b>
        </div>
      `).join("")}
      <div style="margin-top: 12px; padding: 10px; background: rgba(13, 130, 138, 0.08); border-radius: 8px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--teal);">Split Balance Status</div>
        <div style="font-size: 0.88rem; margin-top: 4px;">
          ${data.financialAudit.splitSettlement?.settlementSummary || 'All expenses balanced or settled equally.'}
        </div>
      </div>
    </div>
  </div>

  <!-- 4. Accommodation & Transport Summaries -->
  <h2 class="section-title">🏨 Accommodation & Transport Commitments</h2>
  <div class="disclaimer">
    ℹ️ Stored as user-provided booking and contact details; verify directly with providers.
  </div>

  <table>
    <thead>
      <tr>
        <th>Service / Stay</th>
        <th>Dates / Timings</th>
        <th>Status & Notes</th>
        <th>Contact</th>
      </tr>
    </thead>
    <tbody>
      ${data.accommodations.map(a => `
        <tr>
          <td><b>${a.name}</b><br><small style="color: var(--muted);">${a.location}</small></td>
          <td>${a.checkIn} ➔ ${a.checkOut}</td>
          <td>${a.status}</td>
          <td>${a.contact}</td>
        </tr>
      `).join("")}
      ${data.transports.map(t => `
        <tr>
          <td><b>${t.service}</b></td>
          <td>${t.timing || t.pickup}</td>
          <td>${t.status}<br><small style="color: var(--muted);">${t.financials || t.fare}</small></td>
          <td>${t.contact || 'IRCTC / 139'}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- 5. Trip Highlights & Favourites -->
  <h2 class="section-title">✨ Highlights & Favourites</h2>
  ${!data.memoriesSummary.favourites.length ? '<p style="color: var(--muted);">No favourites tagged yet.</p>' : `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">
      ${data.memoriesSummary.favourites.map(f => `
        <div class="card">
          <div style="display: flex; justify-content: space-between;">
            <b>${f.place}</b>
            <span style="color: #f59e0b;">${'★'.repeat(f.rating)}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">${f.destination}</div>
          <div style="font-size: 0.82rem; font-style: italic; margin-top: 6px;">"${f.favouriteMoment}"</div>
        </div>
      `).join("")}
    </div>
  `}

  <!-- 6. Unexpected Delays & Material Changes Log -->
  <h2 class="section-title">⏱️ Changes & Delay Audit Timeline</h2>
  ${!data.unexpectedDelays.length ? '<p style="color: var(--muted);">No unexpected delays or material changes logged.</p>' : `
    <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text);">
      ${data.unexpectedDelays.map(c => `
        <li style="margin-bottom: 6px;">
          <b>${new Date(c.timestamp).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}:</b>
          ${c.description}
        </li>
      `).join("")}
    </ul>
  `}

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); text-align: center; font-size: 0.8rem; color: var(--muted);">
    OntheGO Travel Itinerary App • Generated on ${new Date().toLocaleDateString("en-IN")}
  </footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OntheGO_Final_Trip_Report_Oct2026.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast("Trip report exported to standalone printable HTML! 📊");
    }
  },

  renderReportView() {
    const container = document.getElementById("reportsContainer");
    if (!container) return;

    const data = this.generateReportData();

    container.innerHTML = `
      <div class="card" style="margin-bottom: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
              📊 Trip Report & Final Audit
            </h3>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Dates: 16–20 Oct 2026 • 2 Travellers (Vishnu & Co-rider)
            </div>
          </div>
          <button type="button" class="btn-primary-sm" onclick="OntheGoReports.exportReportHTML()">
            💾 Export HTML / PDF
          </button>
        </div>

        <!-- 4-Box Stats -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px;">
          <div style="background: rgba(13, 130, 138, 0.06); padding: 10px; border-radius: 10px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--ocean-teal);">Planned vs Actual Spend</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
              ₹${data.financialAudit.actualSpentINR.toLocaleString("en-IN")} <span style="font-size: 0.76rem; font-weight: 500; color: var(--text-muted);">/ ₹${data.financialAudit.plannedBudgetINR.toLocaleString("en-IN")}</span>
            </div>
            <div style="font-size: 0.72rem; font-weight: 700; color: ${data.financialAudit.isUnderBudget ? '#15803d' : '#dc2626'}; margin-top: 2px;">
              ${data.financialAudit.isUnderBudget ? '✓ Under Budget by ₹' : '⚠️ Over Budget by ₹'}${Math.abs(data.financialAudit.varianceINR).toLocaleString("en-IN")}
            </div>
          </div>

          <div style="background: rgba(200, 90, 50, 0.06); padding: 10px; border-radius: 10px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--kerala-terracotta);">Route Completion</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
              ${data.itineraryAudit.completionRatePct}%
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
              ${data.itineraryAudit.completedStops}/${data.itineraryAudit.totalPlannedStops} stops done
            </div>
          </div>
        </div>

        <!-- Settlement Snapshot -->
        <div style="background: var(--bg-sand); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; margin-bottom: 14px;">
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Splitwise Settlement Status</div>
          <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
            ${data.financialAudit.splitSettlement?.settlementSummary || 'All expenses currently settled.'}
          </div>
        </div>

        <!-- Stays & Transports Quick View -->
        <h4 style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin: 10px 0 6px 0;">🏨 Accommodation & Stays</h4>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          ${data.accommodations.map(a => `
            <div style="font-size: 0.8rem; display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding: 4px 0;">
              <span><b>${a.name}</b> (${a.location})</span>
              <span style="color: var(--ocean-teal); font-weight: 600;">${a.checkIn.split(" ")[0]}–${a.checkOut.split(" ")[0]}</span>
            </div>
          `).join("")}
        </div>

        <h4 style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin: 10px 0 6px 0;">🛵 Transport Deadlines</h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${data.transports.map(t => `
            <div style="font-size: 0.8rem; border-bottom: 1px dashed var(--border-color); padding: 4px 0;">
              <div><b>${t.service}</b></div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${t.timing || t.pickup}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
};
