/**
 * OntheGO - Stage 4: Offline Documents Vault & Route Manifests
 * Stores verified booking confirmations, agreements, tickets, and step-by-step
 * route manifests locally with privacy controls (PIN and field masking).
 */

window.OntheGoVault = {
  isUnlocked: false,
  isMasked: true,

  DEFAULT_DOCUMENTS: [
    {
      id: "doc-vande-bharat",
      category: "Transport",
      title: "🚆 Vande Bharat Express Ticket (20608)",
      issuer: "Indian Railways (IRCTC)",
      bookingRef: "PNR: 4429-8812-VB",
      date: "20 October 2026",
      time: "02:00 PM Sharp (Boarding opens 01:40 PM)",
      route: "Ernakulam Junction (ERS) ➔ KSR Bengaluru (SBC)",
      travellers: "Vishnu & Co-rider (2 Seats)",
      seatInfo: "Coach C2 • Seats 34 & 35 (Window & Aisle)",
      amount: "₹1,708 per person (₹3,416 total paid)",
      status: "Confirmed (Strict Hard Constraint)",
      emergencyContact: "Railway Helpline: 139 / Station Master: 0484 2375131",
      notes: "Strict 2:00 PM departure from Ernakulam Junction Platform 1. Arrive at station NO LATER than 1:30 PM with scooter returned and settled.",
      isFixedCommitment: true
    },
    {
      id: "doc-scooter-rental",
      category: "Rental Agreement",
      title: "🛵 Honda Activa 6G Scooter Rental Agreement",
      issuer: "Ernakulam North/South Bike Rentals",
      bookingRef: "RENT-ACT-2026-9003",
      date: "16 Oct 2:30 PM ➔ 20 Oct 1:00 PM",
      time: "Return target: 1:00 PM | Hard cutoff: 1:30 PM",
      location: "Near Ernakulam Junction Railway Station (Platform 1 Exit)",
      contact: "+91 90039 55156",
      amount: "₹2,800 total (₹500 advance paid, ₹2,300 balance due on return)",
      status: "Advance Paid • Balance Due at Handover",
      emergencyContact: "Breakdown Support: +91 90039 55156 / Kerala Police: 112",
      notes: "Includes 2 ISI-certified helmets. Required documents: Original Driving Licence. Scooter must be returned with fuel matching pickup gauge (approx 3/4 tank) to receive deposit refund.",
      isFixedCommitment: true
    },
    {
      id: "doc-calvins-inn",
      category: "Stay",
      title: "🏨 Calvin's Inn Homestay Check-in Voucher",
      issuer: "Calvin's Inn, Fort Kochi",
      bookingRef: "BK-CALVIN-493",
      date: "16 October 2026 (Check-in from 2:00 PM)",
      location: "Near St. Francis Church, Fort Kochi 682001",
      contact: "+91 99951 65493",
      amount: "₹2,400 (AC Double Room)",
      status: "Confirmed",
      emergencyContact: "Host Desk: +91 99951 65493",
      notes: "Heritage homestay within walking distance of Princess Street and Vasco da Gama Square. Scooter parking available inside gate.",
      isFixedCommitment: true
    },
    {
      id: "doc-ocean-aura",
      category: "Stay",
      title: "🏖️ Ocean Aura Beach Stay Check-in Voucher",
      issuer: "Ocean Aura Beach Stay, Alleppey",
      bookingRef: "BK-OCEAN-407",
      date: "17 October 2026 (Check-in from 3:00 PM)",
      location: "Beach Road, Thumpoly, Alappuzha 688008",
      contact: "+91 79944 55407",
      amount: "₹2,800 (Beachfront AC Cottage)",
      status: "Confirmed",
      emergencyContact: "Host: +91 79944 55407",
      notes: "Quiet beachfront property north of Alleppey beach pier. Critical: Early rest required tonight for 6:00 AM Opulence kayaking rendezvous.",
      isFixedCommitment: true
    },
    {
      id: "doc-opulence-kayaking",
      category: "Activity",
      title: "🛶 Opulence Morning Backwater Kayaking Voucher",
      issuer: "Opulence Kayak Expeditions Alleppey",
      bookingRef: "KAYAK-OPU-2358",
      date: "18 October 2026 (06:00 AM - 11:30 AM)",
      location: "Kuppapuram canal junction, Alleppey",
      contact: "+91 89211 72358",
      amount: "₹700 per person (Pre-booked slot)",
      status: "Confirmed Morning Session",
      emergencyContact: "Kayak Guide: +91 89211 72358 / Tourism Police: 1363",
      notes: "Session strictly ends at 11:30 AM. Life jackets provided. Wear quick-dry clothing and carry waterproof phone pouches. Call operator by 6:00 AM to verify canal conditions.",
      isFixedCommitment: true
    },
    {
      id: "doc-zostel-kumbalangi",
      category: "Stay",
      title: "🌴 Zostel Kumbalangi Check-in Voucher (Base Camp 2)",
      issuer: "Zostel Kumbalangi Eco-Resort",
      bookingRef: "ZOS-KUMB-8899",
      date: "19 October 2026 (Check-in from 3:30 PM)",
      location: "Kallancherry, Kumbalangi 682007",
      contact: "+91 484 223 8899",
      amount: "₹2,200 (Private Waterfront Cabin)",
      status: "Confirmed",
      emergencyContact: "Zostel Front Desk: +91 484 223 8899",
      notes: "Nestled directly on the backwater rim surrounded by Chinese fishing nets. Sunset paddleboarding (SUP) equipment available on-site.",
      isFixedCommitment: true
    }
  ],

  init() {
    this.ensureVaultDocuments();
  },

  ensureVaultDocuments() {
    if (!OntheGoApp.state) return;
    if (!Array.isArray(OntheGoApp.state.offlineDocuments) || !OntheGoApp.state.offlineDocuments.length) {
      OntheGoApp.state.offlineDocuments = JSON.parse(JSON.stringify(this.DEFAULT_DOCUMENTS));
    }
    // Also cache to IndexedDB
    if (window.OntheGoStorage && OntheGoStorage.saveDocuments) {
      OntheGoStorage.saveDocuments(OntheGoApp.state.offlineDocuments);
    }
  },

  toggleMask() {
    this.isMasked = !this.isMasked;
    this.renderVaultUI();
    if (window.OntheGoApp && OntheGoApp.showToast) {
      OntheGoApp.showToast(this.isMasked ? "Sensitive booking details masked 🔒" : "Sensitive details revealed 👁️");
    }
  },

  maskText(text) {
    if (!this.isMasked || !text) return text;
    return text.toString().replace(/\d{4,}/g, m => m.substr(0, 2) + "••••" + m.substr(-2));
  },

  /**
   * Renders the Offline Documents Vault and Emergency Vouchers.
   */
  renderVaultUI() {
    const container = document.getElementById("walletContainer");
    if (!container) return;

    this.ensureVaultDocuments();
    const docs = OntheGoApp.state.offlineDocuments || [];

    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <div style="font-size: 0.72rem; color: var(--ocean-teal); font-weight: 800; text-transform: uppercase;">
              Offline Emergency Vault
            </div>
            <h3 style="margin: 2px 0; color: var(--text-main);">Confirmed Bookings & Vouchers</h3>
          </div>
          <button type="button" class="btn-sm" style="font-size: 0.75rem;" onclick="OntheGoVault.toggleMask()">
            ${this.isMasked ? '👁️ Reveal Details' : '🔒 Mask Sensitive Data'}
          </button>
        </div>

        <div class="alert-banner alert-info" style="margin-bottom: 12px; font-size: 0.76rem;">
          <span class="alert-icon">🛡️</span>
          <div>
            <b>OFFLINE SECURITY & LOCAL ACCESS:</b> All booking references, contacts, and tickets are stored in local device IndexedDB. They remain fully readable even with zero cellular signal across Kerala backwaters.
          </div>
        </div>

        <!-- Documents List -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${docs.map(doc => `
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span class="split-tag ${doc.isFixedCommitment ? 'tag-refund' : 'tag-settled'}">${doc.category}</span>
                  <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); margin: 4px 0;">${doc.title}</div>
                  <div style="font-size: 0.76rem; color: var(--ocean-teal-light); font-weight: 700;">${doc.issuer}</div>
                </div>
                <div style="text-align: right;">
                  <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-main);">${doc.date}</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 10px 0; background: var(--bg-card); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.76rem;">
                <div>
                  <span style="color: var(--text-muted);">Booking Reference:</span>
                  <div style="font-weight: 700; color: var(--text-main);">${this.maskText(doc.bookingRef)}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">Amount / Fare:</span>
                  <div style="font-weight: 700; color: var(--text-main);">${this.maskText(doc.amount)}</div>
                </div>
                ${doc.contact ? `
                  <div>
                    <span style="color: var(--text-muted);">Contact Phone:</span>
                    <div><a href="tel:${doc.contact.replace(/\s+/g, '')}" style="color: var(--ocean-teal); font-weight: 700;">📞 ${this.maskText(doc.contact)}</a></div>
                  </div>
                ` : ''}
                ${doc.seatInfo ? `
                  <div>
                    <span style="color: var(--text-muted);">Seat / Coach:</span>
                    <div style="font-weight: 700; color: var(--text-main);">${doc.seatInfo}</div>
                  </div>
                ` : ''}
              </div>

              ${doc.notes ? `
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 8px; line-height: 1.35;">
                  💡 ${doc.notes}
                </div>
              ` : ''}

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px; font-size: 0.72rem; color: var(--text-muted);">
                <span>🚨 ${doc.emergencyContact || 'Kerala Police: 112'}</span>
                ${doc.contact ? `
                  <a href="tel:${doc.contact.replace(/\s+/g, '')}" class="btn-sm btn-primary-sm" style="font-size: 0.7rem;">📞 Quick Call</a>
                ` : ''}
              </div>
            </div>
          `).join("")}
        </div>

        <!-- Offline Route Manifest Section -->
        <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <h4 style="color: var(--text-main); margin-bottom: 6px;">🗺️ Offline Waypoint Manifest & Navigation Links</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px;">
            ⚠️ <b>Map Provider Offline Limitation:</b> Leaflet vector tiles and live turn-by-turn navigation require an active internet connection. When offline, use these saved waypoint coordinates, physical addresses, and pre-cached external map links.
          </p>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button type="button" class="btn-sm btn-block" onclick="OntheGoMap.renderOfflineFallback()">
              📑 Open Offline Step-by-Step Manifest for Today
            </button>
          </div>
        </div>
      </div>
    `;
  }
};
