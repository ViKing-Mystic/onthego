/**
 * OntheGO - On-the-Go Checklist Module
 * Persistent checklist organized into Before Leaving, Daily, and End of Trip.
 */

window.OntheGoChecklist = {
  init() {
    this.renderChecklist();
  },

  getChecklistData() {
    return OntheGoApp.state.checklist || OntheGoDefaultData.checklist;
  },

  renderChecklist() {
    const container = document.getElementById("checklistContainer");
    if (!container) return;

    const groups = this.getChecklistData();
    let totalItems = 0;
    let completedItems = 0;

    groups.forEach(g => {
      g.items.forEach(it => {
        totalItems++;
        if (it.done) completedItems++;
      });
    });

    const totalPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const progressEl = document.getElementById("checklistTotalProgress");
    if (progressEl) {
      progressEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; margin-bottom: 4px;">
          <span>Overall Readiness</span>
          <span>${completedItems}/${totalItems} (${totalPct}%)</span>
        </div>
        <div class="checklist-progress-bar">
          <div class="checklist-progress-fill" style="width: ${totalPct}%;"></div>
        </div>
      `;
    }

    container.innerHTML = groups.map((g, gIdx) => {
      const gTotal = g.items.length;
      const gDone = g.items.filter(it => it.done).length;
      const gPct = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;

      return `
        <div class="checklist-group-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main);">${g.group}</h4>
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--seafoam-light);">${gDone}/${gTotal} (${gPct}%)</span>
          </div>

          <div class="checklist-progress-bar">
            <div class="checklist-progress-fill" style="width: ${gPct}%;"></div>
          </div>

          <div style="display: flex; flex-direction: column;">
            ${g.items.map(it => `
              <label class="checklist-item-row" style="cursor: pointer;">
                <input type="checkbox" class="checklist-checkbox" ${it.done ? 'checked' : ''} onchange="OntheGoChecklist.toggleItem('${it.id}', this.checked)">
                <span style="${it.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}; font-weight: 500;">
                  ${it.text}
                </span>
                ${it.completedBy ? `<span style="font-size: 0.65rem; color: var(--coastal-turquoise); margin-left: 6px; font-weight: 600;">(${it.completedBy === 'traveller-1' ? 'Vishnu 🛵' : 'Co-rider 🌴'})</span>` : ''}
                ${it.priority === 'High' ? `<span style="margin-left: auto; font-size: 0.64rem; font-weight: 800; color: var(--sunset-coral); background: rgba(249,115,22,0.15); padding: 1px 5px; border-radius: 3px;">Important</span>` : ''}
              </label>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  },

  toggleItem(itemId, isChecked) {
    const groups = this.getChecklistData();
    for (const g of groups) {
      const item = g.items.find(it => it.id === itemId);
      if (item) {
        item.done = isChecked;
        item.completedBy = isChecked ? (window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1") : null;
        item.completedAt = isChecked ? new Date().toISOString() : null;

        if (window.OntheGoCollaboration) {
          OntheGoCollaboration.recordChange({
            action: isChecked ? "completed" : "updated",
            entityType: "checklist",
            entityId: item.id,
            description: `${isChecked ? 'Checked off' : 'Unchecked'} checklist task: "${item.text}"`
          });
        }

        OntheGoApp.saveState();
        this.renderChecklist();
        return;
      }
    }
  },

  openAddTaskModal() {
    const text = prompt("Enter new checklist task item:");
    if (!text || !text.trim()) return;

    const groups = this.getChecklistData();
    // Add to daily or first group
    if (groups.length > 0) {
      const newItem = {
        id: "chk-custom-" + Date.now(),
        text: text.trim(),
        done: false,
        priority: "Normal",
        assignedTo: window.OntheGoCollaboration ? OntheGoCollaboration.activeTravellerId : "traveller-1"
      };
      groups[0].items.push(newItem);

      if (window.OntheGoCollaboration) {
        OntheGoCollaboration.recordChange({
          action: "created",
          entityType: "checklist",
          entityId: newItem.id,
          description: `Added checklist task: "${text.trim()}"`
        });
      }

      OntheGoApp.saveState();
      this.renderChecklist();
      OntheGoApp.showToast("Custom task added to checklist! ✓");
    }
  },

  resetChecklist() {
    if (!confirm("Are you sure you want to reset all checklist progress?")) return;
    const defaultData = OntheGoDefaultData.checklist;
    OntheGoApp.state.checklist = JSON.parse(JSON.stringify(defaultData));
    OntheGoApp.saveState();
    this.renderChecklist();
    OntheGoApp.showToast("Checklist reset to defaults.");
  }
};
