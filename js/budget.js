/**
 * OntheGO - Stage 5: Budget Intelligence & Predictive Spend Forecasting
 * Forecasts trip expenditure against the target budget (₹3,200/day = ₹16,000 total).
 * Separates confirmed expenses from committed balances and variable run-rate projections.
 * Generates actionable warnings with transparent assumptions when budget limits are at risk.
 */

window.OntheGoBudget = {
  DAILY_BUDGET_PAISE: 320000, // ₹3,200.00
  TOTAL_TRIP_DAYS: 5,
  TOTAL_TRIP_BUDGET_PAISE: 1600000, // ₹16,000.00 (16,000 * 100)

  // Committed future costs known in advance
  FIXED_COMMITTED_UNPAID: [
    {
      id: "commit_scooter_bal",
      description: "Scooter Rental Balance Settlement (due on 20 Oct by 1:00 PM)",
      amountPaise: 230000, // ₹2,300.00 (₹2,800 total - ₹500 advance)
      category: "Transport",
      dueDay: 5,
      isHardCommitment: true
    },
    {
      id: "commit_train_return",
      description: "Return Vande Bharat Express (2 travellers @ ₹1,708)",
      amountPaise: 341600, // ₹3,416.00
      category: "Transport",
      dueDay: 5,
      isHardCommitment: true
    }
  ],

  init() {
    this.renderBudgetWidget();
  },

  /**
   * Generates comprehensive budget analysis and forecast.
   * @returns {Object}
   */
  calculateBudgetForecast() {
    const expenses = OntheGoApp.state?.expenses || [];
    const targetDailyINR = OntheGoApp.state?.preferences?.budgetSensitivity?.targetDailySpendINR || 3200;
    const targetBudgetPaise = targetDailyINR * this.TOTAL_TRIP_DAYS * 100;

    // 1. Calculate actual paid expenditure so far
    let confirmedPaidPaise = 0;
    const byCategoryPaise = {};

    expenses.forEach(e => {
      const paise = e.amountInInrPaise !== undefined
        ? e.amountInInrPaise
        : (e.amountPaise !== undefined ? e.amountPaise : Math.round((parseFloat(e.amount) || 0) * 100));

      confirmedPaidPaise += paise;
      const cat = e.category || "General";
      byCategoryPaise[cat] = (byCategoryPaise[cat] || 0) + paise;
    });

    // 2. Identify committed unpaid balances
    let committedUnpaidPaise = 0;
    this.FIXED_COMMITTED_UNPAID.forEach(c => {
      // Check if already paid in ledger to avoid double-counting
      const alreadyPaid = expenses.some(e => {
        const desc = (e.description || e.title || "").toLowerCase();
        return (c.id === "commit_scooter_bal" && (desc.includes("scooter balance") || desc.includes("scooter settlement"))) ||
               (c.id === "commit_train_return" && desc.includes("return vande"));
      });

      if (!alreadyPaid) {
        committedUnpaidPaise += c.amountPaise;
      }
    });

    // 3. Trip Progression & Variable Burn Rate Calculation
    // Estimate elapsed days from itinerary activity completions or current day
    const trip = OntheGoApp.getActiveTrip();
    let currentDayNumber = 1;
    let completedStopsCount = 0;
    let totalStopsCount = 0;

    (trip.days || []).forEach(d => {
      totalStopsCount += (d.activities || []).length;
      const comp = (d.activities || []).filter(a => a.status === "completed").length;
      completedStopsCount += comp;
      if (comp > 0) currentDayNumber = Math.max(currentDayNumber, d.dayNumber);
    });

    const elapsedDays = Math.max(1, currentDayNumber);
    const remainingDays = Math.max(0, this.TOTAL_TRIP_DAYS - elapsedDays);

    // Variable spend (excludes prepaid/fixed transit so rate isn't distorted)
    const variableSpendSoFarPaise = Math.max(0, confirmedPaidPaise - 50000); // subtract ₹500 initial advance
    const variableRatePerDayPaise = elapsedDays > 0 ? Math.round(variableSpendSoFarPaise / elapsedDays) : targetDailyINR * 100;

    // 4. Projected Total Spend Forecast
    // Projected = Confirmed Paid + Committed Unpaid + (Variable Daily Run Rate * Remaining Days)
    const projectedVariableRemainingPaise = variableRatePerDayPaise * remainingDays;
    const projectedTotalPaise = confirmedPaidPaise + committedUnpaidPaise + projectedVariableRemainingPaise;

    const projectedVariancePaise = targetBudgetPaise - projectedTotalPaise;
    const isExceedingBudget = projectedVariancePaise < 0;

    // 5. Warning Trigger & Explanation
    let warningLevel = "safe"; // "safe" | "caution" | "critical"
    let warningMessage = null;

    if (isExceedingBudget) {
      const overageINR = Math.abs(projectedVariancePaise) / 100;
      if (overageINR > 2500) {
        warningLevel = "critical";
        warningMessage = `CRITICAL BUDGET FORECAST: Current spending trajectory exceeds total ₹${(targetBudgetPaise / 100).toLocaleString("en-IN")} budget by ₹${overageINR.toLocaleString("en-IN")}. Adjust variable meal & snack choices to stay within limits.`;
      } else {
        warningLevel = "caution";
        warningMessage = `BUDGET ADVISORY: Spending trend projects exceeding the target ₹${(targetBudgetPaise / 100).toLocaleString("en-IN")} budget by ₹${overageINR.toLocaleString("en-IN")}. Remaining flexible budget is tight.`;
      }
    }

    return {
      targetBudgetINR: targetBudgetPaise / 100,
      targetBudgetPaise,
      targetDailyINR,
      confirmedPaidINR: confirmedPaidPaise / 100,
      confirmedPaidPaise,
      committedUnpaidINR: committedUnpaidPaise / 100,
      committedUnpaidPaise,
      projectedTotalINR: Math.round(projectedTotalPaise / 100),
      projectedTotalPaise,
      projectedVarianceINR: Math.round(projectedVariancePaise / 100),
      projectedVariancePaise,
      projectedOverageINR: isExceedingBudget ? Math.abs(Math.round(projectedVariancePaise / 100)) : 0,
      isExceedingBudget,
      warningLevel,
      warningMessage,
      assumptions: {
        confirmedPaidINR: confirmedPaidPaise / 100,
        committedCostsCount: this.FIXED_COMMITTED_UNPAID.length,
        committedUnpaidList: this.FIXED_COMMITTED_UNPAID.map(c => ({
          description: c.description,
          amountINR: c.amountPaise / 100
        })),
        elapsedDays,
        remainingDays,
        variableRatePerDayINR: Math.round(variableRatePerDayPaise / 100),
        variableDailyRateINR: Math.round(variableRatePerDayPaise / 100),
        disclaimer: "Forecast distinguishes confirmed settled payments from committed future liabilities. Optional stops are excluded until confirmed."
      }
    };
  },

  renderBudgetWidget() {
    const container = document.getElementById("budgetIntelligenceContainer");
    if (!container) return;

    const forecast = this.calculateBudgetForecast();

    const bannerBg = forecast.warningLevel === "critical"
      ? "rgba(220, 38, 38, 0.08)"
      : (forecast.warningLevel === "caution" ? "rgba(245, 158, 11, 0.08)" : "rgba(13, 130, 138, 0.08)");

    const bannerBorder = forecast.warningLevel === "critical"
      ? "#dc2626"
      : (forecast.warningLevel === "caution" ? "#f59e0b" : "var(--ocean-teal)");

    container.innerHTML = `
      <div class="card" style="margin-bottom: 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0 0 2px 0;">
              💡 Budget Intelligence & Forecast
            </h3>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Target: ₹${forecast.targetDailyINR.toLocaleString("en-IN")}/day • 5-Day Cap: ₹${forecast.targetBudgetINR.toLocaleString("en-IN")}
            </div>
          </div>
          <span class="route-meta-badge" style="background: ${forecast.isExceedingBudget ? 'rgba(220,38,38,0.1)' : 'rgba(21,128,61,0.1)'}; color: ${forecast.isExceedingBudget ? '#b91c1c' : '#15803d'}; font-size: 0.75rem; font-weight: 700;">
            ${forecast.isExceedingBudget ? '⚠️ Budget Alert' : '✓ On Track'}
          </span>
        </div>

        ${forecast.warningMessage ? `
          <div style="background: ${bannerBg}; border-left: 3px solid ${bannerBorder}; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 0.82rem; color: var(--text-main); line-height: 1.4;">
            ${forecast.warningMessage}
          </div>
        ` : ''}

        <!-- 3-Box Forecast Comparison -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
          <div style="background: var(--bg-sand); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; text-align: center;">
            <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Confirmed Paid</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
              ₹${forecast.confirmedPaidINR.toLocaleString("en-IN")}
            </div>
          </div>

          <div style="background: var(--bg-sand); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; text-align: center;">
            <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: var(--ocean-teal);">Committed Unpaid</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--ocean-teal); margin-top: 2px;">
              ₹${forecast.committedUnpaidINR.toLocaleString("en-IN")}
            </div>
          </div>

          <div style="background: var(--bg-sand); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; text-align: center;">
            <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: ${forecast.isExceedingBudget ? '#b91c1c' : '#15803d'};">Projected Total</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: ${forecast.isExceedingBudget ? '#b91c1c' : '#15803d'}; margin-top: 2px;">
              ₹${forecast.projectedTotalINR.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        <!-- Transparent Assumptions Dropdown / Details -->
        <div style="font-size: 0.78rem; background: rgba(0,0,0,0.02); border-radius: 8px; padding: 8px 10px; color: var(--text-muted);">
          <b>Forecast Assumptions:</b>
          <div style="margin-top: 4px;">• Committed liabilities: Scooter return balance ₹2,300 + Vande Bharat ₹3,416.</div>
          <div>• Estimated variable run rate: ~₹${forecast.assumptions.variableRatePerDayINR.toLocaleString("en-IN")}/day over ${forecast.assumptions.remainingDays} remaining day(s).</div>
          <div style="font-style: italic; margin-top: 2px; font-size: 0.72rem;">${forecast.assumptions.disclaimer}</div>
        </div>
      </div>
    `;
  }
};
