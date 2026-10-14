/**
 * OntheGO - Stage 2: Shared Expense & Settlement Engine
 * Precision financial accounting using integer minor units (paise: ₹1 = 100 paise),
 * deterministic rounding, multi-split methods (equal, %, custom, personal, repayment, refund),
 * multi-currency support, receipt notes, and minimum transfer net settlement.
 */

window.OntheGoExpenses = {
  CATEGORIES: [
    { id: "Scooter Rental", icon: "🛵", color: "#f97316" },
    { id: "Petrol", icon: "⛽", color: "#ef4444" },
    { id: "Accommodation", icon: "🏨", color: "#10b981" },
    { id: "Train", icon: "🚆", color: "#8b5cf6" },
    { id: "Food and drinks", icon: "🍱", color: "#f59e0b" },
    { id: "Activities", icon: "🏄", color: "#0d9488" },
    { id: "Entry tickets", icon: "🎟️", color: "#0284c7" },
    { id: "Ferry / Water Metro", icon: "⛴️", color: "#06b6d4" },
    { id: "Parking", icon: "🅿️", color: "#64748b" },
    { id: "Shopping", icon: "🛍️", color: "#ec4899" },
    { id: "Settlement / Repayment", icon: "🤝", color: "#22c55e" },
    { id: "Refund / Credit", icon: "↩️", color: "#3b82f6" },
    { id: "Miscellaneous", icon: "💡", color: "#a855f7" }
  ],

  CURRENCIES: [
    { code: "INR", symbol: "₹", name: "Indian Rupee", fxRate: 1.0 },
    { code: "USD", symbol: "$", name: "US Dollar", fxRate: 83.5 },
    { code: "EUR", symbol: "€", name: "Euro", fxRate: 90.2 },
    { code: "GBP", symbol: "£", name: "British Pound", fxRate: 106.0 }
  ],

  editingExpenseId: null,

  init() {
    this.renderExpenseList();
    this.renderExpenseSummary();
  },

  getExpenses() {
    return OntheGoApp.state?.expenses || [];
  },

  /**
   * Converts any decimal currency amount into integer minor units (paise).
   * @param {number|string} amount 
   * @returns {number} Integer paise (e.g., 2800.50 -> 280050)
   */
  toPaise(amount) {
    const num = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  },

  /**
   * Converts integer minor units (paise) back to decimal units.
   * @param {number} paise 
   * @returns {number}
   */
  toRupees(paise) {
    return (paise || 0) / 100;
  },

  /**
   * Formats paise into Indian Rupee currency string.
   * @param {number} paise 
   * @returns {string}
   */
  formatPaise(paise) {
    const r = Math.abs(paise || 0) / 100;
    const formatted = r.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (paise < 0 ? "-₹" : "₹") + formatted;
  },

  /**
   * Deterministically calculates each traveller's share in minor units (paise).
   * Ensures that share1 + share2 exactly equals totalPaise with zero rounding leakage.
   */
  calculateSplitShares(amountPaise, splitMethod, paidBy, customT1Paise = 0, pctT1 = 50) {
    let t1SharePaise = 0;
    let t2SharePaise = 0;

    switch (splitMethod) {
      case "equal": {
        // Equal split with deterministic 1-paise allocation to payer
        t1SharePaise = Math.floor(amountPaise / 2);
        t2SharePaise = Math.floor(amountPaise / 2);
        const remainder = amountPaise - (t1SharePaise + t2SharePaise);
        if (remainder !== 0) {
          if (paidBy === "traveller-1") {
            t1SharePaise += remainder;
          } else {
            t2SharePaise += remainder;
          }
        }
        break;
      }

      case "percentage": {
        const pct1 = Math.max(0, Math.min(100, pctT1));
        t1SharePaise = Math.round((amountPaise * pct1) / 100);
        t2SharePaise = amountPaise - t1SharePaise; // Guarantees exact sum
        break;
      }

      case "custom": {
        t1SharePaise = Math.round(customT1Paise);
        t2SharePaise = amountPaise - t1SharePaise;
        break;
      }

      case "personal": {
        // Personal expense: 100% assigned to payer, 0 to partner
        if (paidBy === "traveller-1") {
          t1SharePaise = amountPaise;
          t2SharePaise = 0;
        } else {
          t1SharePaise = 0;
          t2SharePaise = amountPaise;
        }
        break;
      }

      case "repayment": {
        // Direct debt repayment from payer to other traveller
        t1SharePaise = 0;
        t2SharePaise = 0;
        break;
      }

      case "refund": {
        // Negative adjustment / credit
        t1SharePaise = Math.floor(amountPaise / 2);
        t2SharePaise = amountPaise - t1SharePaise;
        break;
      }

      default: {
        t1SharePaise = Math.floor(amountPaise / 2);
        t2SharePaise = amountPaise - t1SharePaise;
      }
    }

    return {
      "traveller-1": t1SharePaise,
      "traveller-2": t2SharePaise
    };
  },

  /**
   * Computes the net balance across all shared expenses, personal items, and repayments.
   * Calculates the exact minimum transfer needed to settle debts between Vishnu and Co-rider.
   *
   * @returns {Object} Comprehensive settlement report
   */
  calculateNetSettlement() {
    const expenses = this.getExpenses();

    // Minor units tracking
    let vishnuPaidTotalPaise = 0;
    let coRiderPaidTotalPaise = 0;
    let totalTripSharedPaise = 0;
    let totalTripPersonalPaise = 0;

    // Net balance in paise:
    // Positive means Co-rider owes Vishnu.
    // Negative means Vishnu owes Co-rider.
    let netBalancePaise = 0;

    expenses.forEach(e => {
      const isVishnu = e.paidBy === "traveller-1" || e.paidBy === "Me" || e.paidBy === "Vishnu";
      const payerId = isVishnu ? "traveller-1" : "traveller-2";

      // Calculate amount in INR paise
      const fx = e.fxRate || 1.0;
      const rawPaise = e.amountPaise !== undefined ? e.amountPaise : this.toPaise(e.amount);
      const inrPaise = Math.round(rawPaise * fx);

      if (isVishnu) {
        vishnuPaidTotalPaise += inrPaise;
      } else {
        coRiderPaidTotalPaise += inrPaise;
      }

      const method = e.splitMethod || "equal";

      if (method === "personal") {
        totalTripPersonalPaise += inrPaise;
        // Personal expenses have 0 debt impact
        return;
      }

      if (method === "repayment") {
        // A direct debt repayment between travellers
        if (isVishnu) {
          // Vishnu paid Co-rider directly -> reduces what Vishnu owes or adds to Co-rider debt
          netBalancePaise += inrPaise;
        } else {
          // Co-rider paid Vishnu directly -> reduces what Co-rider owes Vishnu
          netBalancePaise -= inrPaise;
        }
        return;
      }

      if (method === "refund") {
        // Refund credit
        const shares = this.calculateSplitShares(inrPaise, "refund", payerId);
        if (isVishnu) {
          // Vishnu received refund -> Vishnu owes Co-rider Co-rider's share of refund
          netBalancePaise -= shares["traveller-2"];
        } else {
          // Co-rider received refund -> Co-rider owes Vishnu Vishnu's share of refund
          netBalancePaise += shares["traveller-1"];
        }
        return;
      }

      // Standard shared expense (equal, percentage, custom)
      totalTripSharedPaise += inrPaise;
      const customT1 = e.splitDetails?.find(s => s.travellerId === "traveller-1")?.amountPaise || 0;
      const pctT1 = e.splitDetails?.find(s => s.travellerId === "traveller-1")?.percentage || 50;
      const shares = this.calculateSplitShares(inrPaise, method, payerId, customT1, pctT1);

      if (isVishnu) {
        // Vishnu paid total, Co-rider owes their share
        netBalancePaise += shares["traveller-2"];
      } else {
        // Co-rider paid total, Vishnu owes their share
        netBalancePaise -= shares["traveller-1"];
      }
    });

    const isBalanced = Math.abs(netBalancePaise) === 0;
    let suggestionText = "";
    let debtorName = "";
    let creditorName = "";

    if (isBalanced) {
      suggestionText = "🎉 All trip expenses are completely balanced! Neither traveller owes anything.";
    } else if (netBalancePaise > 0) {
      debtorName = "Co-rider";
      creditorName = "Vishnu";
      suggestionText = `🤝 Minimum Settlement: <b>Co-rider</b> should transfer <b>${this.formatPaise(netBalancePaise)}</b> to <b>Vishnu</b> to settle all shared debts.`;
    } else {
      debtorName = "Vishnu";
      creditorName = "Co-rider";
      suggestionText = `🤝 Minimum Settlement: <b>Vishnu</b> should transfer <b>${this.formatPaise(Math.abs(netBalancePaise))}</b> to <b>Co-rider</b> to settle all shared debts.`;
    }

    return {
      netBalancePaise,
      isBalanced,
      suggestionText,
      debtorName,
      creditorName,
      settlementAmountPaise: Math.abs(netBalancePaise),
      vishnuPaidTotalPaise,
      coRiderPaidTotalPaise,
      totalTripSharedPaise,
      totalTripPersonalPaise,
      totalOverallPaise: vishnuPaidTotalPaise + coRiderPaidTotalPaise
    };
  },

  renderExpenseSummary() {
    const settlement = this.calculateNetSettlement();
    const expenses = this.getExpenses();

    const totalEl = document.getElementById("expenseTotalSpent");
    const prepaidEl = document.getElementById("expensePrepaidSummary");
    const breakdownEl = document.getElementById("expenseCategoryBreakdownBar");
    const legendEl = document.getElementById("expenseCategoryLegend");
    const splitCardEl = document.getElementById("expenseSplitSummaryCard");

    if (totalEl) {
      totalEl.innerText = this.formatPaise(settlement.totalOverallPaise);
    }

    const prepaidPaise = expenses
      .filter(e => e.isPrepaid)
      .reduce((sum, e) => sum + (e.amountPaise !== undefined ? e.amountPaise : this.toPaise(e.amount)), 0);

    if (prepaidEl) {
      prepaidEl.innerText = `${this.formatPaise(prepaidPaise)} prepaid (includes ₹500 scooter advance)`;
    }

    // Category shares
    const catTotals = {};
    expenses.forEach(e => {
      const cat = e.category || "Miscellaneous";
      const p = e.amountPaise !== undefined ? e.amountPaise : this.toPaise(e.amount);
      catTotals[cat] = (catTotals[cat] || 0) + p;
    });

    if (breakdownEl && settlement.totalOverallPaise > 0) {
      breakdownEl.innerHTML = Object.keys(catTotals).map(cat => {
        const p = catTotals[cat];
        const pct = ((p / settlement.totalOverallPaise) * 100).toFixed(1);
        const catObj = this.CATEGORIES.find(c => c.id === cat) || { color: "#64748b" };
        return `<div class="expense-bar-segment" style="width: ${pct}%; background: ${catObj.color};" title="${cat}: ${this.formatPaise(p)} (${pct}%)"></div>`;
      }).join("");
    }

    if (legendEl) {
      legendEl.innerHTML = Object.keys(catTotals).map(cat => {
        const p = catTotals[cat];
        const catObj = this.CATEGORIES.find(c => c.id === cat) || { icon: "💡", color: "#64748b" };
        return `
          <div style="font-size: 0.72rem; display: flex; align-items: center; gap: 5px; background: var(--bg-card); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
            <span>${catObj.icon}</span>
            <span style="font-weight: 600;">${cat}:</span>
            <span style="color: var(--text-muted);">${this.formatPaise(p)}</span>
          </div>
        `;
      }).join("");
    }

    // Render Stage 2 Net Settlement & Transfer Card
    if (splitCardEl) {
      splitCardEl.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-top: 12px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.74rem; text-transform: uppercase; font-weight: 800; color: var(--coastal-turquoise); letter-spacing: 0.5px;">
              🤝 Two-Traveller Settlement Engine (Integer Minor Units)
            </div>
            <span style="font-size: 0.7rem; font-weight: 700; color: ${settlement.isBalanced ? 'var(--seafoam-green)' : 'var(--sunset-amber)'}; background: ${settlement.isBalanced ? 'rgba(39,130,113,0.1)' : 'rgba(201,122,20,0.1)'}; padding: 2px 8px; border-radius: 4px;">
              ${settlement.isBalanced ? 'All Balanced' : 'Settlement Required'}
            </span>
          </div>

          <div style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 10px; line-height: 1.4;">
            ${settlement.suggestionText}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.76rem; background: var(--bg-card-subtle); padding: 8px 10px; border-radius: var(--radius-sm); margin-bottom: 10px;">
            <div>
              <div style="color: var(--text-muted);">🛵 Paid by Vishnu:</div>
              <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${this.formatPaise(settlement.vishnuPaidTotalPaise)}</div>
            </div>
            <div>
              <div style="color: var(--text-muted);">🌴 Paid by Co-rider:</div>
              <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${this.formatPaise(settlement.coRiderPaidTotalPaise)}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 0.7rem; color: var(--text-dim);">
              Zero rounding loss • Deterministic remainder assignment
            </div>
            ${!settlement.isBalanced ? `
              <button type="button" class="btn-sm btn-primary-sm" onclick="OntheGoExpenses.recordSettlementRepayment(${settlement.settlementAmountPaise}, '${settlement.debtorName}')" style="background: var(--seafoam-green);">
                💸 Record Settlement Payment (${this.formatPaise(settlement.settlementAmountPaise)})
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }
  },

  renderExpenseList() {
    const container = document.getElementById("expenseListContainer");
    if (!container) return;

    const expenses = this.getExpenses();
    if (!expenses.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted);">
          No expenses recorded yet. Tap "Add Expense" to log your first road expense!
        </div>
      `;
      return;
    }

    // Sort newest first
    const sorted = [...expenses].sort((a, b) => new Date(b.date + " " + (b.time || "00:00")) - new Date(a.date + " " + (a.time || "00:00")));

    container.innerHTML = sorted.map(exp => {
      const catObj = this.CATEGORIES.find(c => c.id === exp.category) || { icon: "💡", color: "#64748b" };
      const paise = exp.amountPaise !== undefined ? exp.amountPaise : this.toPaise(exp.amount);
      const isVishnu = exp.paidBy === "traveller-1" || exp.paidBy === "Me" || exp.paidBy === "Vishnu";
      const payerName = isVishnu ? "Vishnu 🛵" : "Co-rider 🌴";

      let splitBadge = "";
      switch (exp.splitMethod) {
        case "equal":
          splitBadge = `<span class="split-tag tag-equal">50/50 Equal</span>`;
          break;
        case "percentage":
          splitBadge = `<span class="split-tag tag-pct">% Split</span>`;
          break;
        case "custom":
          splitBadge = `<span class="split-tag tag-custom">Custom</span>`;
          break;
        case "personal":
          splitBadge = `<span class="split-tag tag-personal">Personal (Excluded)</span>`;
          break;
        case "repayment":
          splitBadge = `<span class="split-tag tag-settle">Repayment 🤝</span>`;
          break;
        case "refund":
          splitBadge = `<span class="split-tag tag-refund">Refund ↩️</span>`;
          break;
        default:
          splitBadge = `<span class="split-tag tag-equal">50/50</span>`;
      }

      return `
        <div class="expense-item-row" id="exp-row-${exp.id}">
          <div class="expense-item-left">
            <div class="expense-cat-icon" style="color: ${catObj.color};">
              ${catObj.icon}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${exp.description}</span>
                ${splitBadge}
                ${exp.isPrepaid ? `<span class="prepaid-badge">Prepaid Deposit</span>` : ''}
              </div>

              <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                ${exp.date || 'Recent'} • Paid by <b>${payerName}</b> • ${exp.category}
                ${exp.currency && exp.currency !== "INR" ? `• (${exp.currency} ${exp.amount} @ fx ${exp.fxRate || 1})` : ''}
              </div>

              ${exp.notes ? `<div style="font-size: 0.7rem; color: var(--text-dim); font-style: italic; margin-top: 1px;">${exp.notes}</div>` : ''}
              ${exp.receiptNote ? `<div style="font-size: 0.68rem; color: var(--ocean-teal-light); margin-top: 1px;">🧾 Receipt: ${exp.receiptNote}</div>` : ''}
            </div>
          </div>

          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <div class="expense-item-amount ${exp.splitMethod === 'refund' ? 'amount-refund' : ''}">
              ${this.formatPaise(paise)}
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="icon-btn" style="width: 28px; height: 28px; font-size: 0.75rem;" title="Edit" onclick="OntheGoExpenses.openEditModal('${exp.id}')">✏️</button>
              <button type="button" class="icon-btn" style="width: 28px; height: 28px; font-size: 0.75rem; color: var(--danger);" title="Delete" onclick="OntheGoExpenses.deleteExpense('${exp.id}')">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  openAddModal() {
    const modal = document.getElementById("addExpenseModal");
    if (!modal) return;

    const cur = window.OntheGoCollaboration ? OntheGoCollaboration.getCurrentTraveller() : { id: "traveller-1" };

    document.getElementById("expModalTitle").innerText = "➕ Add Trip Expense";
    document.getElementById("expAmount").value = "";
    document.getElementById("expCurrency").value = "INR";
    document.getElementById("expFxRateRow").style.display = "none";
    document.getElementById("expDesc").value = "";
    document.getElementById("expCategory").value = "Food and drinks";
    document.getElementById("expDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("expPaidBy").value = cur.id === "traveller-2" ? "traveller-2" : "traveller-1";
    document.getElementById("expSplitMethod").value = "equal";
    document.getElementById("expCustomSplitRow").style.display = "none";
    document.getElementById("expPctSplitRow").style.display = "none";
    document.getElementById("expNotes").value = "";
    document.getElementById("expReceiptNote").value = "";
    document.getElementById("expIsPrepaid").checked = false;

    this.editingExpenseId = null;
    modal.classList.add("open");
  },

  openEditModal(expId) {
    const exp = this.getExpenses().find(e => e.id === expId);
    if (!exp) return;

    const modal = document.getElementById("addExpenseModal");
    if (!modal) return;

    document.getElementById("expModalTitle").innerText = "✏️ Edit Expense";
    document.getElementById("expAmount").value = exp.amount;
    document.getElementById("expCurrency").value = exp.currency || "INR";
    document.getElementById("expFxRateRow").style.display = exp.currency && exp.currency !== "INR" ? "block" : "none";
    document.getElementById("expFxRate").value = exp.fxRate || 1.0;
    document.getElementById("expDesc").value = exp.description;
    document.getElementById("expCategory").value = exp.category;
    document.getElementById("expDate").value = exp.date;
    document.getElementById("expPaidBy").value = (exp.paidBy === "Co-rider" || exp.paidBy === "traveller-2") ? "traveller-2" : "traveller-1";
    document.getElementById("expSplitMethod").value = exp.splitMethod || "equal";
    document.getElementById("expNotes").value = exp.notes || "";
    document.getElementById("expReceiptNote").value = exp.receiptNote || "";
    document.getElementById("expIsPrepaid").checked = !!exp.isPrepaid;

    this.toggleSplitInputs(exp.splitMethod || "equal");

    this.editingExpenseId = exp.id;
    modal.classList.add("open");
  },

  toggleSplitInputs(method) {
    const customRow = document.getElementById("expCustomSplitRow");
    const pctRow = document.getElementById("expPctSplitRow");
    if (customRow) customRow.style.display = method === "custom" ? "flex" : "none";
    if (pctRow) pctRow.style.display = method === "percentage" ? "flex" : "none";
  },

  handleCurrencyChange(curr) {
    const row = document.getElementById("expFxRateRow");
    const fxInput = document.getElementById("expFxRate");
    if (!row) return;

    if (curr === "INR") {
      row.style.display = "none";
      if (fxInput) fxInput.value = "1.0";
    } else {
      row.style.display = "block";
      const c = this.CURRENCIES.find(item => item.code === curr);
      if (fxInput) fxInput.value = c ? c.fxRate : "1.0";
    }
  },

  saveExpense(event) {
    event.preventDefault();
    const amountNum = parseFloat(document.getElementById("expAmount").value) || 0;
    const currency = document.getElementById("expCurrency").value || "INR";
    const fxRate = currency !== "INR" ? (parseFloat(document.getElementById("expFxRate").value) || 1.0) : 1.0;
    const description = document.getElementById("expDesc").value.trim();
    const category = document.getElementById("expCategory").value;
    const date = document.getElementById("expDate").value;
    const paidBy = document.getElementById("expPaidBy").value;
    const splitMethod = document.getElementById("expSplitMethod").value;
    const notes = document.getElementById("expNotes").value.trim();
    const receiptNote = document.getElementById("expReceiptNote").value.trim();
    const isPrepaid = document.getElementById("expIsPrepaid").checked;

    if (!amountNum || !description) {
      alert("Please enter a valid amount and description.");
      return;
    }

    const amountPaise = this.toPaise(amountNum);
    const amountInInrPaise = Math.round(amountPaise * fxRate);

    // Calculate split details in minor units
    let splitDetails = [];
    if (splitMethod === "custom") {
      const customT1 = parseFloat(document.getElementById("expCustomT1").value) || 0;
      const customT1Paise = this.toPaise(customT1);
      const customT2Paise = amountInInrPaise - customT1Paise;
      splitDetails = [
        { travellerId: "traveller-1", amountPaise: customT1Paise },
        { travellerId: "traveller-2", amountPaise: customT2Paise }
      ];
    } else if (splitMethod === "percentage") {
      const pctT1 = parseFloat(document.getElementById("expPctT1").value) || 50;
      const t1Paise = Math.round((amountInInrPaise * pctT1) / 100);
      splitDetails = [
        { travellerId: "traveller-1", amountPaise: t1Paise, percentage: pctT1 },
        { travellerId: "traveller-2", amountPaise: amountInInrPaise - t1Paise, percentage: 100 - pctT1 }
      ];
    } else {
      const shares = this.calculateSplitShares(amountInInrPaise, splitMethod, paidBy);
      splitDetails = [
        { travellerId: "traveller-1", amountPaise: shares["traveller-1"] },
        { travellerId: "traveller-2", amountPaise: shares["traveller-2"] }
      ];
    }

    OntheGoApp.state.expenses = OntheGoApp.state.expenses || [];

    if (this.editingExpenseId) {
      const exp = OntheGoApp.state.expenses.find(e => e.id === this.editingExpenseId);
      if (exp) {
        exp.amount = amountNum;
        exp.amountPaise = amountPaise;
        exp.currency = currency;
        exp.fxRate = fxRate;
        exp.amountInInrPaise = amountInInrPaise;
        exp.description = description;
        exp.category = category;
        exp.date = date;
        exp.paidBy = paidBy;
        exp.splitMethod = splitMethod;
        exp.splitDetails = splitDetails;
        exp.notes = notes;
        exp.receiptNote = receiptNote;
        exp.isPrepaid = isPrepaid;
        exp.lastModifiedBy = OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : paidBy;
      }
      if (window.OntheGoCollaboration) {
        OntheGoCollaboration.recordChange({
          action: "updated",
          entityType: "expense",
          entityId: exp.id,
          description: `Updated expense "${description}" (${this.formatPaise(amountInInrPaise)})`
        });
      }
      OntheGoApp.showToast("Expense updated! ✓");
    } else {
      const newExp = {
        id: "exp-" + Date.now(),
        amount: amountNum,
        amountPaise,
        currency,
        fxRate,
        amountInInrPaise,
        description,
        category,
        date,
        time: new Date().toTimeString().slice(0, 5),
        paidBy,
        participants: ["traveller-1", "traveller-2"],
        splitMethod,
        splitDetails,
        isPrepaid,
        notes,
        receiptNote,
        createdAt: new Date().toISOString(),
        lastModifiedBy: OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : paidBy
      };
      OntheGoApp.state.expenses.push(newExp);
      if (window.OntheGoCollaboration) {
        OntheGoCollaboration.recordChange({
          action: "created",
          entityType: "expense",
          entityId: newExp.id,
          description: `Logged ₹${amountNum} for "${description}" (${splitMethod} split)`
        });
      }
      OntheGoApp.showToast("Expense recorded! ✓");
    }

    OntheGoApp.saveState();
    OntheGoApp.closeModals();
    this.renderExpenseList();
    this.renderExpenseSummary();
    OntheGoApp.renderDashboard();
  },

  deleteExpense(expId) {
    const exp = this.getExpenses().find(e => e.id === expId);
    if (!exp) return;
    if (!confirm(`Delete expense "${exp.description}"?`)) return;

    OntheGoApp.state.expenses = (OntheGoApp.state.expenses || []).filter(e => e.id !== expId);

    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: "deleted",
        entityType: "expense",
        entityId: expId,
        description: `Deleted expense "${exp.description}" (${this.formatPaise(exp.amountPaise || this.toPaise(exp.amount))})`
      });
    }

    OntheGoApp.saveState();
    this.renderExpenseList();
    this.renderExpenseSummary();
    OntheGoApp.renderDashboard();
    OntheGoApp.showToast("Expense record removed.");
  },

  /**
   * 1-Click Settlement / Partial Repayment Helper.
   */
  recordSettlementRepayment(suggestedPaise, debtorName) {
    const debtorId = debtorName === "Vishnu" ? "traveller-1" : "traveller-2";
    const recipientId = debtorId === "traveller-1" ? "traveller-2" : "traveller-1";
    const recipientName = debtorId === "traveller-1" ? "Co-rider" : "Vishnu";

    const defaultAmount = this.toRupees(suggestedPaise);
    const amountStr = prompt(`Record settlement payment from ${debtorName} to ${recipientName}:\nEnter amount in ₹ (INR):`, defaultAmount);
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid settlement amount.");
      return;
    }

    const amountPaise = this.toPaise(amount);
    const repaymentExp = {
      id: "exp-settle-" + Date.now(),
      amount,
      amountPaise,
      currency: "INR",
      fxRate: 1.0,
      amountInInrPaise: amountPaise,
      description: `Debt Settlement: ${debtorName} ➔ ${recipientName}`,
      category: "Settlement / Repayment",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      paidBy: debtorId,
      participants: [debtorId, recipientId],
      splitMethod: "repayment",
      repaymentTo: recipientId,
      status: "settled",
      notes: `Direct settlement transfer of ${this.formatPaise(amountPaise)} via UPI / cash.`,
      createdAt: new Date().toISOString()
    };

    OntheGoApp.state.expenses = OntheGoApp.state.expenses || [];
    OntheGoApp.state.expenses.push(repaymentExp);

    if (window.OntheGoCollaboration) {
      OntheGoCollaboration.recordChange({
        action: "settlement",
        entityType: "expense",
        entityId: repaymentExp.id,
        description: `Recorded debt repayment of ${this.formatPaise(amountPaise)} from ${debtorName} to ${recipientName}`
      });
    }

    OntheGoApp.saveState();
    this.renderExpenseList();
    this.renderExpenseSummary();
    OntheGoApp.renderDashboard();
    OntheGoApp.showToast(`Settlement payment of ${this.formatPaise(amountPaise)} recorded! 🤝`);
  },

  exportCSV() {
    const expenses = this.getExpenses();
    if (!expenses.length) {
      alert("No expenses to export.");
      return;
    }

    const headers = ["ID", "Date", "Description", "Category", "Amount", "Currency", "Amount (INR Paise)", "Paid By", "Split Method", "Prepaid", "Notes", "Receipt"];
    const rows = expenses.map(e => {
      const paise = e.amountPaise !== undefined ? e.amountPaise : this.toPaise(e.amount);
      return [
        e.id,
        e.date,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.category || '').replace(/"/g, '""')}"`,
        e.amount,
        e.currency || 'INR',
        paise,
        e.paidBy || 'traveller-1',
        e.splitMethod || 'equal',
        e.isPrepaid ? 'Yes' : 'No',
        `"${(e.notes || '').replace(/"/g, '""')}"`,
        `"${(e.receiptNote || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OntheGO_Expenses_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    OntheGoApp.showToast("Expenses exported to CSV! 💾");
  }
};
