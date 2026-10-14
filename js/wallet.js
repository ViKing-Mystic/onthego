/**
 * OntheGO - Bookings & Contacts Wallet Module
 * Dedicated wallet for emergency contacts, hotel hosts, train tickets,
 * Opulence kayaking operator, and scooter return logistics.
 */

window.OntheGoWallet = {
  init() {
    this.renderContacts();
  },

  getContacts() {
    return OntheGoApp.state.contacts || OntheGoDefaultData.contacts;
  },

  renderContacts() {
    const container = document.getElementById("walletContainer");
    if (!container) return;

    const contacts = this.getContacts();

    container.innerHTML = contacts.map(c => {
      const hasPhone = !!c.phone && c.phone !== "N/A";
      const isBooked = (c.status || "").toLowerCase().includes("booked");

      return `
        <div class="stop-card" style="margin-bottom: 12px; border-left: 4px solid ${isBooked ? 'var(--seafoam-green)' : 'var(--sunset-coral)'};">
          <div class="stop-header">
            <div>
              <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--ocean-teal-light); letter-spacing: 0.5px;">${c.role}</span>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">${c.name}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span style="font-size: 0.72rem; font-weight: 700; background: ${isBooked ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${isBooked ? 'var(--seafoam-light)' : 'var(--warning)'}; padding: 3px 8px; border-radius: 4px;">
                ${c.status || 'Active'}
              </span>
              ${c.isUserProvided ? `<span class="user-provided-badge" style="font-size: 0.65rem;">📝 User-Provided Info</span>` : ''}
            </div>
          </div>

          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
            ${c.location ? `📍 <b>Location:</b> ${c.location} • ` : ''}
            ${c.time ? `⏱ <b>Timing:</b> ${c.time} • ` : ''}
            ${c.returnDeadline ? `<span style="color: var(--danger); font-weight: 800;">🛑 Return Deadline: ${c.returnDeadline} • </span>` : ''}
            ${c.totalCost ? `<span style="color: var(--text-main); font-weight: 700;">💰 Total: ₹${c.totalCost} (Adv: ₹${c.advancePaid || 0}, Due: ₹${c.balanceDue || 0})</span>` : (c.cost ? `<span style="color: var(--text-main); font-weight: 700;">💰 Rate: ₹${c.cost}</span>` : '')}
          </div>

          ${c.bookingRef ? `
            <div style="font-size: 0.74rem; color: var(--text-dim); margin-bottom: 6px;">
              <b>Booking Reference / Status:</b> ${c.bookingRef}
            </div>
          ` : ''}

          <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">
            ${c.notes || ''}
          </p>

          <div class="stop-actions-row">
            ${hasPhone ? `
              <a href="tel:${c.phone}" class="btn-call-action">
                📞 Call ${c.phone}
              </a>
              <button type="button" class="btn-sm" onclick="OntheGoWallet.copyNumber('${c.phone}')">
                📋 Copy
              </button>
            ` : ''}

            ${c.lat && c.lng ? `
              <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}" target="_blank" rel="noopener" class="btn-nav-action">
                🧭 Map
              </a>
            ` : ''}

            <button type="button" class="btn-sm" onclick="OntheGoWallet.editNote('${c.id}')">
              ✏️ Add Note
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  copyNumber(phone) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      OntheGoApp.showToast(`Phone ${phone} copied to clipboard! 📋`);
    } else {
      prompt("Copy phone number:", phone);
    }
  },

  editNote(contactId) {
    const contacts = this.getContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const newNote = prompt(`Edit booking note for ${contact.name}:`, contact.notes || "");
    if (newNote !== null) {
      contact.notes = newNote.trim();
      OntheGoApp.saveState();
      this.renderContacts();
      OntheGoApp.showToast("Contact note saved! ✓");
    }
  }
};
