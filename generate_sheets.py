import sys
import os
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def build_workbook():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet

    # Styling Palette
    FONT_FAMILY = "Segoe UI"
    
    C_HEADER_BG = "0F172A"       # Dark Slate 900
    C_HEADER_FG = "FFFFFF"
    C_SECTION_BG = "1E293B"      # Slate 800
    C_SECTION_FG = "38BDF8"      # Light Sky Blue
    C_ACCENT_EMERALD = "059669"  # Emerald 600
    C_ACCENT_SKY = "0284C7"      # Sky 600
    C_ACCENT_AMBER = "D97706"    # Amber 600
    C_ACCENT_ROSE = "E11D48"     # Rose 600
    C_ROW_ALT = "F8FAFC"        # Slate 50
    C_ROW_WHITE = "FFFFFF"
    C_BORDER = "CBD5E1"         # Slate 300
    C_CARD_BG = "F1F5F9"        # Slate 100
    
    # Border definitions
    thin_border_side = Side(border_style="thin", color=C_BORDER)
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    thick_bottom_side = Side(border_style="medium", color="0F172A")
    header_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thick_bottom_side)

    def style_header_cell(cell, text, bg=C_HEADER_BG, fg=C_HEADER_FG, font_size=11, bold=True, align="center"):
        cell.value = text
        cell.font = Font(name=FONT_FAMILY, size=font_size, bold=bold, color=fg)
        cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
        cell.border = header_border

    def style_data_cell(cell, value, bg=C_ROW_WHITE, fg="0F172A", font_size=10, bold=False, align="left", num_format=None, wrap=True):
        cell.value = value
        cell.font = Font(name=FONT_FAMILY, size=font_size, bold=bold, color=fg)
        cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
        cell.border = thin_border
        if num_format:
            cell.number_format = num_format

    def apply_title_banner(ws, title_text, subtitle_text, max_col=10):
        for c in range(1, max_col + 1):
            cell = ws.cell(row=1, column=c)
            cell.fill = PatternFill(start_color=C_HEADER_BG, end_color=C_HEADER_BG, fill_type="solid")
            cell.border = thin_border
            cell2 = ws.cell(row=2, column=c)
            cell2.fill = PatternFill(start_color=C_HEADER_BG, end_color=C_HEADER_BG, fill_type="solid")
            cell2.border = thin_border
            
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max_col)
        title_cell = ws.cell(row=1, column=1)
        title_cell.value = f"🌴 {title_text}"
        title_cell.font = Font(name=FONT_FAMILY, size=16, bold=True, color="FFFFFF")
        title_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 42

        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=max_col)
        sub_cell = ws.cell(row=2, column=1)
        sub_cell.value = subtitle_text
        sub_cell.font = Font(name=FONT_FAMILY, size=10, italic=True, color="94A3B8")
        sub_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 24

    def auto_fit_columns(ws, max_cols=12, padding=3):
        for col in range(1, max_cols + 1):
            col_letter = get_column_letter(col)
            max_len = 0
            for row in range(1, ws.max_row + 1):
                cell = ws.cell(row=row, column=col)
                if row in [1, 2]:
                    continue
                if cell.value is not None:
                    lines = str(cell.value).split("\n")
                    for l in lines:
                        if len(l) > max_len:
                            max_len = len(l)
            adjusted_width = min(max(max_len + padding, 12), 65)
            ws.column_dimensions[col_letter].width = adjusted_width

    # =========================================================================
    # TAB 1: TRIP OVERVIEW & CORE COMMITMENTS
    # =========================================================================
    ws_ov = wb.create_sheet(title="Trip Overview")
    ws_ov.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ov, "KOCHI–ALLEPPEY COASTAL SCOOTER ESCAPE", "16–20 October 2026 • 96-Hour Master Travel Guide • Bengaluru Outbound & Return", max_col=7)

    r = 4
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_c = ws_ov.cell(row=r, column=1, value="📌 MASTER EXPEDITION PARAMETERS")
    sec_c.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_c.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 26
    r += 1

    overview_meta = [
        ("Trip Title", "Kochi–Alleppey Coastal Scooter Escape", "Travel Dates", "16th Oct (Fri) – 20th Oct (Tue) 2026"),
        ("Origin Station", "Bengaluru (Vande Bharat Express)", "Arrival Hub", "Ernakulam Junction Railway Station (ERS)"),
        ("Duration & Scope", "96 Hours (5 Days & 4 Nights)", "Total Circuit Distance", "~165 km (Coastal Highway + Local Exploration)"),
        ("Riding Team", "Vishnu (Lead / Rider) & Co-rider (Navigator)", "Primary Transit", "Rented Scooter (Pickup & Drop near ERS Station)"),
        ("Base Camps", "Fort Kochi (N1), Alleppey Beach (N2-N3), Kumbalangi (N4)", "Emergency Helplines", "Kerala Tourism: 1363 • Police: 112 • Ambulance: 108"),
        ("Riding Protocol", "Strict ISI Helmets (AI Camera Surveillance Active)", "Hydration Buffer", "Hydrate every 90 mins (Tender coconut / fresh lime)")
    ]

    for row_data in overview_meta:
        ws_ov.row_dimensions[r].height = 23
        style_data_cell(ws_ov.cell(row=r, column=1), row_data[0], bg=C_CARD_BG, fg="334155", bold=True, align="left")
        style_data_cell(ws_ov.cell(row=r, column=2), row_data[1], bg=C_ROW_WHITE, fg="0F172A", bold=False, align="left")
        style_data_cell(ws_ov.cell(row=r, column=3), "", bg=C_ROW_WHITE)
        ws_ov.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        style_data_cell(ws_ov.cell(row=r, column=4), row_data[2], bg=C_CARD_BG, fg="334155", bold=True, align="left")
        style_data_cell(ws_ov.cell(row=r, column=5), row_data[3], bg=C_ROW_WHITE, fg="0F172A", bold=False, align="left")
        style_data_cell(ws_ov.cell(row=r, column=6), "", bg=C_ROW_WHITE)
        style_data_cell(ws_ov.cell(row=r, column=7), "", bg=C_ROW_WHITE)
        ws_ov.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
        r += 1

    r += 1
    # Hard Fixed Deadlines Section
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_deadlines = ws_ov.cell(row=r, column=1, value="🛑 CRITICAL HARD DEADLINES & FIXED BOOKINGS")
    sec_deadlines.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_deadlines.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 26
    r += 1

    dl_hdrs = ["Event / Commitment", "Target Date & Time", "Location / Platform", "Booking Status", "Cost / Balance", "Contact POC", "Operational Instructions"]
    ws_ov.row_dimensions[r].height = 24
    for c_idx, h_text in enumerate(dl_hdrs, start=1):
        style_header_cell(ws_ov.cell(row=r, column=c_idx), h_text, bg=C_ACCENT_ROSE)
    r += 1

    hard_commitments = [
        ("🚆 Outbound Train Arrival", "16 Oct 2026, 02:00 PM", "Ernakulam Junction (ERS)", "Booked", "₹1,708 / person", "Railways: 139", "Vande Bharat from Bengaluru. De-board, exit station towards South/Main gate for scooter pickup."),
        ("🛵 Scooter Pickup", "16 Oct 2026, 02:30 PM", "Near Ernakulam Junction", "Advance Paid ₹500", "₹2,800 Total (Bal: ₹2,300)", "Vendor: 9003955156", "Inspect vehicle, take 360° video & odometer photo, verify RC & insurance, check helmet straps."),
        ("🛶 Opulence Kayaking", "18 Oct 2026, 06:00 AM – 11:30 AM", "Kainakary Backwaters, Alleppey", "Booked Slot", "₹700 (Breakfast Incl.)", "Opulence: 8921172358", "Sunrise canal kayaking in Kuttanad. Breakfast included. Wake up at 5:15 AM! Bring waterproof pouch."),
        ("🛑 Scooter Return Target", "20 Oct 2026, 01:00 PM (Latest 1:30 PM)", "Near Ernakulam Junction", "Hard Return Deadline", "Settle Bal ₹2,300", "Vendor: 9003955156", "MUST leave Fort Kochi by 12:15 PM! Cross Willingdon Island to beat city traffic. Settle balance."),
        ("🚆 Return Train Departure", "20 Oct 2026, 02:00 PM Sharp", "Ernakulam Junction (Platform 1)", "Booked", "₹1,708 / person", "Railways: 139", "Vande Bharat to Bengaluru. Enter station by 1:30 PM, pass security, board coach by 1:45 PM sharp.")
    ]

    for hc in hard_commitments:
        ws_ov.row_dimensions[r].height = 34
        style_data_cell(ws_ov.cell(row=r, column=1), hc[0], bold=True)
        style_data_cell(ws_ov.cell(row=r, column=2), hc[1], bold=True, align="center")
        style_data_cell(ws_ov.cell(row=r, column=3), hc[2])
        style_data_cell(ws_ov.cell(row=r, column=4), hc[3], align="center", fg=C_ACCENT_EMERALD, bold=True)
        style_data_cell(ws_ov.cell(row=r, column=5), hc[4], align="right", bold=True)
        style_data_cell(ws_ov.cell(row=r, column=6), hc[5], align="center")
        style_data_cell(ws_ov.cell(row=r, column=7), hc[6])
        r += 1

    r += 1
    # 5-Day Circuit Summary
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_circ = ws_ov.cell(row=r, column=1, value="🗺 5-DAY CIRCUIT OVERVIEW & BASE CAMPS")
    sec_circ.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_circ.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 26
    r += 1

    circ_hdrs = ["Day", "Date", "Theme & Territory", "Primary Route", "Dist (km)", "Ride Time", "Night Base Camp & Contact"]
    ws_ov.row_dimensions[r].height = 24
    for c_idx, h_text in enumerate(circ_hdrs, start=1):
        style_header_cell(ws_ov.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    circuit_data = [
        ("Day 1", "16 Oct (Fri)", "Arrival, Mattancherry & Fort Kochi Sunset", "ERS ➔ Calvin's Inn ➔ Warehouse Cafe ➔ Jew Town ➔ Manja Temple ➔ Chinese Nets ➔ Fort House", "22 km", "1h 10m", "Calvin's Inn, Fort Kochi (9995165493)"),
        ("Day 2", "17 Oct (Sat)", "Heritage Quarter & Coastal Ride to Alleppey", "Fort Kochi Walk ➔ Puthenthodu Beach ➔ Chellanam-Marari Coast ➔ Ocean Aura ➔ Lighthouse & Pier", "68 km", "2h 20m", "Ocean Aura Beach Stay, Alleppey (7994455407)"),
        ("Day 3", "18 Oct (Sun)", "Opulence Kayaking, Shaap Feast & Marari Sunset", "Kainakary Kayaking ➔ No. 1 Kallu Shap ➔ Marari Beach Afternoon & Sunset ➔ Ocean Aura", "32 km", "1h 10m", "Ocean Aura Beach Stay, Alleppey (7994455407)"),
        ("Day 4", "19 Oct (Mon)", "Ambalappuzha Temple & Kumbalangi Backwaters", "Ambalappuzha Temple ➔ Coastal Ride North ➔ Lunch in Kochi ➔ Zostel Kumbalangi ➔ Canoe / SUP", "75 km", "2h 35m", "Zostel Kumbalangi (0484 223 8899)"),
        ("Day 5", "20 Oct (Tue)", "Water Metro, Kashi Brunch, Scooter Drop & Departure", "Zostel Kumbalangi ➔ Fort Kochi Water Metro ➔ Kashi Art Cafe ➔ Scooter Return (1 PM) ➔ ERS Train (2 PM)", "28 km", "1h 15m", "Boarding Vande Bharat Express to Bengaluru")
    ]

    for cd in circuit_data:
        ws_ov.row_dimensions[r].height = 32
        style_data_cell(ws_ov.cell(row=r, column=1), cd[0], bold=True, align="center")
        style_data_cell(ws_ov.cell(row=r, column=2), cd[1], align="center")
        style_data_cell(ws_ov.cell(row=r, column=3), cd[2], bold=True)
        style_data_cell(ws_ov.cell(row=r, column=4), cd[3])
        style_data_cell(ws_ov.cell(row=r, column=5), cd[4], align="center")
        style_data_cell(ws_ov.cell(row=r, column=6), cd[5], align="center")
        style_data_cell(ws_ov.cell(row=r, column=7), cd[6], bold=True)
        r += 1

    auto_fit_columns(ws_ov, max_cols=7)

    # =========================================================================
    # TAB 2: MASTER ITINERARY (CHRONOLOGICAL 5-DAY TIMELINE)
    # =========================================================================
    ws_it = wb.create_sheet(title="Master Itinerary")
    ws_it.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_it, "COMPLETE 5-DAY MASTER ITINERARY & CHRONOLOGICAL SCHEDULE", "All Activities, Stops, Time Windows, Locations, Booking References, Costs, Contacts & Operational Notes", max_col=11)

    r = 4
    it_headers = [
        "Day #", "Date", "Time Window", "Category", "Activity / Event Title",
        "Location / Venue", "Booking Status", "Est. Cost (₹)", "Contact POC", "Phone / Helpdesk", "Operational Guidelines, Cautions & Navigation Notes"
    ]
    ws_it.row_dimensions[r].height = 28
    for c_idx, h_text in enumerate(it_headers, start=1):
        style_header_cell(ws_it.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    activities_master = [
        # DAY 1
        ("Day 1", "16 Oct (Fri)", "02:00 PM", "Transport", "🚆 Arrive at Ernakulam Junction (Vande Bharat Express)", "Ernakulam Junction Railway Station (ERS)", "Booked", 1708, "Station Helpdesk", "139", "De-board Vande Bharat (₹1,708/person). Freshen up at station waiting room, collect bags, head towards station exit for scooter pickup."),
        ("Day 1", "16 Oct (Fri)", "02:30 PM", "Transport", "🛵 Collect Scooter near Railway Station", "Near Ernakulam Junction Railway Station", "₹500 Advance Paid", 2800, "Rental Vendor", "9003955156", "Total ₹2,800 rental, ₹500 prepaid (balance ₹2,300 payable upon return on 20 Oct). Take 360° video of scooter body, inspect tyres, brakes, fuel gauge & verify RC/insurance."),
        ("Day 1", "16 Oct (Fri)", "03:15 PM", "Accommodation", "🏨 Check-in at Calvin's Inn, Fort Kochi", "K.J. Herschel Road / Calvathy, Fort Kochi", "Booked", 0, "Calvin's Inn Host", "9995165493", "Quiet boutique homestay in Fort Kochi. Unload bags, freshen up quickly, and ride into Mattancherry for late afternoon lunch."),
        ("Day 1", "16 Oct (Fri)", "04:00 PM - 04:45 PM", "Restaurant", "🍽 Late Lunch: The Warehouse Cafe", "Bazaar Road, Mattancherry", "Walk-in", 500, "The Warehouse Cafe", "+91 484 222 3445", "Restored waterfront spice godown overlooking harbour shipping channel. Enjoy cold brew coffee, fish bites, or light sandwiches. (⭐ 4.2 / 5)."),
        ("Day 1", "16 Oct (Fri)", "05:00 PM - 05:30 PM", "Sightseeing", "🏛 Mattancherry Palace (Dutch Palace) Grounds & Exterior", "Palace Road, Mattancherry", "Grounds Free", 0, "ASI Helpdesk", "-", "⚠️ Notice: Interior museum is CLOSED on Fridays (ASI weekly closure). External 1555 Portuguese-Dutch architecture, temple pond & courtyard are open."),
        ("Day 1", "16 Oct (Fri)", "05:30 PM - 06:15 PM", "Sightseeing", "🕍 Jew Town Stroll & Paradesi Synagogue Exterior", "Synagogue Lane, Jew Town, Mattancherry", "Walk-in", 0, "Jew Town Trust", "-", "⚠️ Shabbat Closure: Synagogue interior closed Fri & Sat. Enjoy cobblestone spice street, antique showrooms, and the 1568 clock tower exterior."),
        ("Day 1", "16 Oct (Fri)", "06:15 PM - 06:45 PM", "Restaurant", "☕ Coffee Break: Ginger House / Cafe Crafters", "Jew Town Waterfront, Mattancherry", "Walk-in", 250, "Ginger House Restaurant", "+91 484 221 3456", "Sip signature iced ginger tea right on the water deck beside the 108-foot antique snake boat, or enjoy cardamom filter coffee."),
        ("Day 1", "16 Oct (Fri)", "06:45 PM - 07:15 PM", "Temple", "🛕 Manja Bhagavathi Temple (Cherlai)", "Cherlai Enclave, Mattancherry", "Free Entry (Modest Attire)", 0, "Temple Board", "-", "⭐ Off-Beat Sacred Gem! Dedicated to Goddess Bhadrakali in Konkani heritage enclave. Famous for sacred turmeric (manja) offerings & evening oil lamps."),
        ("Day 1", "16 Oct (Fri)", "07:30 PM - 08:15 PM", "Sightseeing", "🌅 Chinese Fishing Nets & Vasco da Gama Square Dusk", "River Road / Vasco da Gama Sq, Fort Kochi", "Public Promenade", 0, "Heritage Council", "-", "Cantilevered 14th-century fishing nets silhouetted against the Arabian sea mouth. Stroll the breezy promenade and watch fishermen haul counterweights."),
        ("Day 1", "16 Oct (Fri)", "08:30 PM - 09:45 PM", "Restaurant", "🍽 Waterfront Dinner: Fort House Restaurant", "2/6A Calvathy Road, Fort Kochi", "Recommended to Call", 850, "Fort House Reception", "+91 484 221 7103", "Romantic open-air timber jetty restaurant over Cochin harbor. Famous for Karimeen Pollichathu, Kerala prawn curry, appams & coconut pudding. (⭐ 4.4 / 5)."),
        ("Day 1", "16 Oct (Fri)", "10:00 PM - 10:45 PM", "Restaurant", "🍰 Cheesecake & Nightcap: Trouvaille", "Bastian Street, Fort Kochi", "Walk-in", 300, "Trouvaille Cafe", "+91 80860 99933", "Parisian boutique patisserie in Fort Kochi. Signature Burnt Basque Cheesecake, dark chocolate tarts & artisanal gelato. (Open till 10:30 PM)."),
        ("Day 1", "16 Oct (Fri)", "11:00 PM", "Rest", "🌙 Night Rest at Calvin's Inn", "Calvin's Inn, Fort Kochi", "Booked", 0, "Host", "9995165493", "Charge devices, hydrate, get solid rest for Saturday morning heritage walk & coastal ride to Alleppey."),

        # DAY 2
        ("Day 2", "17 Oct (Sat)", "08:00 AM - 09:00 AM", "Restaurant", "🍳 Breakfast at Qissa Cafe or Pandhal Deli (David Hall)", "KB Jacob Rd (Qissa) / Parade Ground (Pandhal)", "Walk-in", 350, "Qissa Cafe", "+91 484 221 6806", "Qissa is 2 mins walk from Calvin's Inn (shakshuka, banana pancakes, pour-over). Pandhal David Hall offers European courtyard dining under rain trees."),
        ("Day 2", "17 Oct (Sat)", "09:15 AM - 09:45 AM", "Sightseeing", "⛪ St. Francis CSI Church (India's Oldest European Church)", "Opposite Parade Ground, Fort Kochi", "Free Entry", 0, "Church Trust", "-", "Built 1503. Historic burial place of Portuguese explorer Vasco da Gama who died in Kochi in 1524. Timber ceiling with punkahs and gravestones."),
        ("Day 2", "17 Oct (Sat)", "09:45 AM - 10:45 AM", "Sightseeing", "🏘 Colonial Heritage Quarter Loop", "Princess St, Peter Celli St & Burgher St", "Walk-in", 150, "Heritage Trail", "-", "Compact walkable colonial cluster. Pastel Portuguese villas, bougainvillea balconies, street bookstalls, and Peter Celli craft burger corner."),
        ("Day 2", "17 Oct (Sat)", "10:45 AM - 11:30 AM", "Restaurant", "📖 Snack & Indie Books: Loafer's Corner / Printed Matter", "Princess Street & Calvathy Road", "Walk-in", 250, "Loafer's Corner", "+91 484 221 8202", "Browse curated indie art zines at Printed Matter. Grab Sulaimani tea & Pazham Pori at Kerala Cafe, or climb into Loafer's Corner vintage wooden attic."),
        ("Day 2", "17 Oct (Sat)", "11:30 AM - 12:15 PM", "Sightseeing", "⛪ Santa Cruz Cathedral Basilica", "K.J. Herschel Road / Bastion Street", "Free Entry", 0, "Diocese of Cochin", "-", "One of India's 8 Basilicas. Magnificent whitewashed twin Gothic spires, Italian frescoed ceilings of the Passion of Christ, and stained glass windows."),
        ("Day 2", "17 Oct (Sat)", "12:30 PM - 01:00 PM", "Transport", "📦 Check out Calvin's Inn & Begin Coastal Ride", "Calvin's Inn, Fort Kochi", "Check-out", 0, "Host", "9995165493", "Secure bags onto scooter footboard/carrier. Fuel up near Thoppumpady before hitting coastal road heading south towards Alleppey."),
        ("Day 2", "17 Oct (Sat)", "01:30 PM - 02:15 PM", "Beach", "🌊 Seaside Stop: Puthenthodu Beach (Chellanam)", "Puthenthodu Beach, Chellanam Coastal Road", "Open Beach", 0, "Coastal Council", "-", "⭐ Breathtaking granite sea-wall coastal break! Waves crashing against giant tetrapods, salty sea spray, and quiet roadside tender coconut stalls."),
        ("Day 2", "17 Oct (Sat)", "02:15 PM - 03:30 PM", "Transport", "🛵 Ride Chellanam–Andhakaranazhi–Marari Coastal Road", "Chellanam ➔ Andhakaranazhi ➔ Mararikulam", "Scenic Highway", 0, "Kerala PWD", "-", "Scenic coastal scooter road hugging Arabian sea. Thick coconut groves, backwaters on left and crashing surf on right. Avoid riding onto loose beach sand."),
        ("Day 2", "17 Oct (Sat)", "03:30 PM - 04:15 PM", "Beach", "🌴 Break: Andhakaranazhi Beach & Lagoon Bridge", "Andhakaranazhi Beach, Pattanakkad", "Open Beach", 50, "Alappuzha DTPC", "-", "Stunning spot where backwater lagoon merges with ocean through aerial bridge walkway. Grab fresh coconut water and snap coastal photos."),
        ("Day 2", "17 Oct (Sat)", "04:45 PM - 05:15 PM", "Accommodation", "🏨 Check-in at Ocean Aura Beach Stay", "Munnodi Temple Road, Thumpoly Beach, Alleppey", "Booked", 0, "Host Contact", "7994455407", "Beachfront stay on Thumpoly Beach. Unload bags, wash off road dust, head immediately to Alleppey Lighthouse before 5:00 PM ticket counter cutoff!"),
        ("Day 2", "17 Oct (Sat)", "05:15 PM - 05:45 PM", "Sightseeing", "🚨 Alleppey Lighthouse (Climb Spiral Staircase)", "Civil Station Ward, Alappuzha Beach", "Ticket ₹20", 20, "DTPC Alappuzha", "-", "⚠️ Cutoff Alert: Hours 2:00 PM – 5:30 PM (entry ticket cutoff 5:00 PM). Shoes off at base. Climb 100+ wooden spiral steps for 360° panoramic views."),
        ("Day 2", "17 Oct (Sat)", "05:45 PM - 07:00 PM", "Beach", "🌅 Sunset at Alleppey Beach & Old Sea Pier", "Alappuzha Beach Front", "Open Beach", 0, "Kerala Tourism", "-", "Historic 150-year-old teak sea pier extending into the waves. Stroll the sands, enjoy roasted peanuts, and watch golden sunset over the Arabian Sea."),
        ("Day 2", "17 Oct (Sat)", "07:30 PM - 09:15 PM", "Restaurant", "🍽 Dinner at Cafe Catamaran", "Alappuzha Beach Road, Kanjiramchira", "Walk-in", 450, "Cafe Catamaran", "+91 97455 52200", "Open-air beachfront cafe overlooking the dark waves. Known for Chicken Badiya, Alfaham grills, thin crust pizza, fresh mint mojitos & dessert. (⭐ 4.3)."),
        ("Day 2", "17 Oct (Sat)", "09:30 PM", "Rest", "🌙 Early Night at Ocean Aura Beach Stay", "Ocean Aura Beach Stay, Thumpoly", "Booked", 0, "Host", "7994455407", "🛑 CRITICAL: Sleep early! Day 3 morning kayaking starts at 06:00 AM sharp with Opulence. Set alarms for 05:15 AM."),

        # DAY 3
        ("Day 3", "18 Oct (Sun)", "06:00 AM - 11:30 AM", "Activity", "🛶 Kayaking with Opulence Backwater Adventures", "Kainakary Backwaters, Alleppey", "Booked Slot", 700, "Opulence Guide", "8921172358", "Booked at ₹700. Morning session ending at 11:30 AM. Glide through narrow village canals of Kuttanad, water lilies & village bridges. Breakfast included!"),
        ("Day 3", "18 Oct (Sun)", "11:30 AM - 12:15 PM", "Restaurant", "🍳 Provided Kerala Breakfast & Refresh", "Opulence Finishing Camp, Kainakary", "Included in Kayaking", 0, "Opulence Camp", "8921172358", "Enjoy hot authentic Kerala breakfast (Puttu/kadala or Idli/sambar) provided by Opulence. Change into fresh dry clothes for afternoon ride."),
        ("Day 3", "18 Oct (Sun)", "12:45 PM - 02:15 PM", "Restaurant", "🍽 Feast at No. 1 Kallu Shap", "Mararikulam Road, Kanjikuzhy / Kalavoor", "Walk-in", 450, "Shaap Manager", "9446665472", "Authentic shaap dining: Karimeen Pollichathu, spicy crab/duck roast, tapioca & fresh sweet toddy. ⚠️ Responsible riding: Never ride after alcohol; designate sober driver!"),
        ("Day 3", "18 Oct (Sun)", "02:45 PM - 06:15 PM", "Beach", "🏖 Marari Beach: Relaxation & Swimming", "Marari Beach, Mararikulam", "Open Beach", 0, "Local Ward", "-", "Clean coconut-fringed white sand beach. Swim only where conditions and local fishermen permit. Relax under palm shade with fresh tender coconuts."),
        ("Day 3", "18 Oct (Sun)", "06:15 PM - 07:15 PM", "Sightseeing", "🌅 Crimson Sunset at Marari Beach", "Marari Beach Front", "Open Sunset", 0, "Local Sunset 6:05 PM", "-", "Spectacular crimson sunset over the open sea. Peaceful village ambience with traditional wooden fishing canoes parked on the sand."),
        ("Day 3", "18 Oct (Sun)", "07:45 PM - 09:15 PM", "Restaurant", "🍽 Dinner: Hotel Brothers or Borma Cafe", "Alleppey Town (Brothers) / Beach (Borma)", "Walk-in", 350, "Hotel Brothers", "+91 477 224 3535", "Hearty Kerala dinner at historic Hotel Brothers (famous duck roast, Neymeen fish curry, appams since 1973) or aesthetic dessert & pasta at Borma Cafe."),
        ("Day 3", "18 Oct (Sun)", "09:30 PM", "Rest", "🌙 Return to Ocean Aura Stay & Rest", "Ocean Aura Beach Stay, Thumpoly", "Booked", 0, "Host", "7994455407", "Pack luggage tonight for tomorrow morning checkout and ride to Ambalappuzha Temple and Kumbalangi."),

        # DAY 4
        ("Day 4", "19 Oct (Mon)", "07:30 AM - 08:15 AM", "Transport", "🛵 Early Scooter Ride South to Ambalappuzha", "Alleppey ➔ Ambalappuzha (14 km via NH66)", "Highway Ride", 0, "NH66 Route", "-", "Breezy early morning ride south towards the historic temple town of Ambalappuzha (14 km south of Alleppey)."),
        ("Day 4", "19 Oct (Mon)", "08:15 AM - 09:30 AM", "Temple", "🛕 Darshan: Ambalappuzha Sree Krishna Temple", "SH12, Ambalappuzha", "Free Entry", 80, "Devaswom Board", "-", "15th-century shrine dedicated to Parthasarathi (Lord Krishna). Sacred pond & famous Palpayasam. ⚠️ Strict dress code: Men must wear Mundu bare-chested; Women in saree/salwar."),
        ("Day 4", "19 Oct (Mon)", "09:30 AM - 10:15 AM", "Restaurant", "🍳 Traditional Kerala Breakfast near Temple", "Ambalappuzha Temple Junction", "Walk-in", 150, "Temple Eateries", "-", "Steaming hot idlis, crispy uzhunnu vada, ghee roast dosas, coconut chutney, sambar, and hot filter coffee."),
        ("Day 4", "19 Oct (Mon)", "10:15 AM - 11:30 AM", "Accommodation", "📦 Return to Ocean Aura Stay & Complete Checkout", "Ocean Aura Beach Stay, Thumpoly", "Check-out by 11:30 AM", 0, "Host", "7994455407", "Ride back to Alleppey, collect luggage, settle room dues if any, and bid farewell to Ocean Aura hosts."),
        ("Day 4", "19 Oct (Mon)", "11:45 AM - 01:45 PM", "Transport", "🛵 Scenic Coastal Scooter Ride North to Kumbalangi", "Alleppey ➔ Marari ➔ Chellanam ➔ Kumbalangi", "Scenic Route", 0, "Coastal Highway", "-", "Ride north along the coastline enjoying sea breeze, coconut palm avenues, and tranquil backwater bridges heading towards Kumbalangi."),
        ("Day 4", "19 Oct (Mon)", "02:00 PM - 03:00 PM", "Restaurant", "🍽 Lunch in Kochi: Canvas Pizzeria or Fort Paragon", "Fort Kochi / Thoppumpady", "Walk-in", 450, "Canvas Restaurant", "+91 484 221 4455", "Wood-fired artisanal pizza and pasta at Canvas, or hearty Malabar biryani and fish curry meals at Fort Paragon."),
        ("Day 4", "19 Oct (Mon)", "03:30 PM - 04:15 PM", "Accommodation", "🏨 Check-in at Zostel Kumbalangi (Base Camp 2)", "Kallancherry, Kumbalangi, Kochi", "Booked", 0, "Zostel Desk", "+91 484 223 8899", "Serene waterfront hostel nestled on the backwater rim surrounded by Chinese fishing nets and mangroves. Unload bags and enjoy backwater breeze."),
        ("Day 4", "19 Oct (Mon)", "04:30 PM - 06:00 PM", "Activity", "🦀 Kumbalangi Tourism Village & Backwater Stroll", "Kumbalangi Integrated Tourism Village", "Village Walk", 150, "Eco Tourism Society", "-", "India's first model eco-tourism village! See traditional crab farming, coir yarn spinning, coconut leaf weaving, and silent narrow waterways."),
        ("Day 4", "19 Oct (Mon)", "06:00 PM - 07:15 PM", "Activity", "🛶 Stand-Up Paddleboarding (SUP) or Sunset Canoe", "Kumbalangi Backwater Jetty (Zostel Shore)", "Subject to Weather", 400, "Zostel Activities", "+91 484 223 8899", "Gliding across calm backwaters on a paddleboard as the sky turns orange and purple. Alternatively, take a gentle country canoe row."),
        ("Day 4", "19 Oct (Mon)", "07:15 PM - 08:15 PM", "Sightseeing", "🌅 Sunset over Kumbalangi Chinese Fishing Nets", "Kumbalangi Waterfront / Puthenthodu Beach", "Open Sunset", 0, "Sunset 6:04 PM", "-", "Watch the sun dip behind distant coconut crowns and cantilevered Chinese fishing nets reflected across still waters."),
        ("Day 4", "19 Oct (Mon)", "08:30 PM - 09:45 PM", "Restaurant", "🍽 Dinner: Kumbalangi Seafood Shack / Zostel Cafe", "Kumbalangi Village", "Walk-in", 350, "Local Shacks / Zostel", "-", "Fresh pearl spot fish fry (Karimeen), squid roast, Kerala parottas, or comfort pasta at Zostel common deck."),
        ("Day 4", "19 Oct (Mon)", "10:15 PM", "Rest", "🌙 Night Rest at Zostel Kumbalangi", "Zostel Kumbalangi", "Booked", 0, "Host", "+91 484 223 8899", "Pack bags tonight for Day 5 departure: 1:00 PM hard scooter return deadline and 2:00 PM train to Bangalore!"),

        # DAY 5
        ("Day 5", "20 Oct (Tue)", "07:45 AM - 08:30 AM", "Transport", "📦 Check out Zostel Kumbalangi & Morning Ride", "Kumbalangi ➔ Fort Kochi (15 km)", "Check-out Completed", 0, "Route Estimate", "-", "Pack all luggage, clear dues, and ride north into Fort Kochi Water Metro terminal area (~30-35 mins)."),
        ("Day 5", "20 Oct (Tue)", "08:45 AM - 09:45 AM", "Activity", "⛴️ Kochi Water Metro: Fort Kochi ⇄ High Court", "Fort Kochi Water Metro Terminal", "Ticket ₹40/way", 80, "Water Metro Helpdesk", "1800 425 0345", "Hybrid-electric catamaran gliding across harbor channel. 20-min crossing. Check schedule (boats every 15-20m). Safeguard brunch & 1:00 PM scooter return!"),
        ("Day 5", "20 Oct (Tue)", "10:00 AM - 11:00 AM", "Restaurant", "☕ Farewell Brunch: Kashi Art Cafe", "Burger Street, Fort Kochi", "Walk-in", 450, "Kashi Art Cafe", "+91 484 221 5769", "Tranquil open-air courtyard gallery shaded by lush rain foliage. Signature warm chocolate cake, poached eggs on sourdough & artisanal pour-over coffee. (⭐ 4.2)."),
        ("Day 5", "20 Oct (Tue)", "11:15 AM - 12:00 PM", "Museum", "🏛 Indo-Portuguese Museum (Bishop's House) [Optional]", "Bishop Kureethara Road, Fort Kochi", "Ticket ₹20", 20, "Diocese Tourism", "-", "⚠️ STRICTLY OPTIONAL: 16th-century Portuguese religious art & teak altarpieces. Skip immediately if running behind schedule. Depart Fort Kochi by 12:15 PM!"),
        ("Day 5", "20 Oct (Tue)", "12:15 PM - 12:50 PM", "Transport", "🛵 Ride Fort Kochi ➔ Scooter Drop near ERS", "Fort Kochi ➔ Ernakulam Junction (12 km)", "Transit Buffer", 0, "Route Estimate", "-", "⚠️ CRITICAL TRANSIT: Cross Willingdon Island into Ernakulam mainland. Allow 35-40 mins for urban traffic and bridge signals. Target arrival before 1:00 PM."),
        ("Day 5", "20 Oct (Tue)", "12:50 PM - 01:15 PM", "Transport", "🛑 Return Scooter near Ernakulam Junction", "Rental Return Point near ERS Station", "Balance Due ₹2,300", 2300, "Scooter Vendor", "9003955156", "🛑 HARD DEADLINE: Return scooter by 1:00 PM (latest 1:30 PM). Inspect bodywork, return helmets, settle ₹2,300 balance payment."),
        ("Day 5", "20 Oct (Tue)", "01:15 PM - 01:45 PM", "Transport", "🚉 Station Access & Platform Boarding: ERS", "Ernakulam Junction Railway Station (Platform 1)", "Confirmed Ticket", 0, "Station Master", "139", "Enter ERS main entrance, pass security screening, check coach position on digital indicators, and reach platform by 01:30 PM."),
        ("Day 5", "20 Oct (Tue)", "02:00 PM", "Transport", "🚆 Board Vande Bharat Express to Bengaluru", "Ernakulam Junction Railway Station (ERS)", "Train Booked", 1708, "IRCTC Helpdesk", "139", "🎉 Expedition Complete! Board 2:00 PM sharp Vande Bharat Express to Bengaluru (₹1,708/person). Relax after 96 hours of Kerala adventure!")
    ]

    for idx, act in enumerate(activities_master):
        ws_it.row_dimensions[r].height = 28
        row_bg = C_ROW_ALT if idx % 2 == 1 else C_ROW_WHITE
        
        cat_fg = "0F172A"
        if act[3] in ["Transport"]:
            cat_fg = "0284C7"
        elif act[3] in ["Restaurant"]:
            cat_fg = "059669"
        elif act[3] in ["Activity", "Sightseeing", "Beach"]:
            cat_fg = "D97706"
        elif act[3] in ["Accommodation", "Rest"]:
            cat_fg = "6366F1"
        elif act[3] in ["Temple", "Museum"]:
            cat_fg = "9333EA"

        style_data_cell(ws_it.cell(row=r, column=1), act[0], bg=row_bg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=2), act[1], bg=row_bg, align="center")
        style_data_cell(ws_it.cell(row=r, column=3), act[2], bg=row_bg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=4), act[3], bg=row_bg, fg=cat_fg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=5), act[4], bg=row_bg, bold=True)
        style_data_cell(ws_it.cell(row=r, column=6), act[5], bg=row_bg)
        style_data_cell(ws_it.cell(row=r, column=7), act[6], bg=row_bg, align="center", fg="E11D48" if "Balance" in act[6] or "Advance" in act[6] else "0F172A", bold=("Booked" in act[6] or "Balance" in act[6]))
        style_data_cell(ws_it.cell(row=r, column=8), act[7], bg=row_bg, align="right", num_format="₹#,##0")
        style_data_cell(ws_it.cell(row=r, column=9), act[8], bg=row_bg)
        style_data_cell(ws_it.cell(row=r, column=10), act[9], bg=row_bg, align="center", bold=True)
        style_data_cell(ws_it.cell(row=r, column=11), act[10], bg=row_bg)
        r += 1

    # Total Row
    ws_it.row_dimensions[r].height = 28
    for c in range(1, 12):
        cell = ws_it.cell(row=r, column=c)
        cell.fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
        cell.border = header_border

    ws_it.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    tot_label = ws_it.cell(row=r, column=1, value="TOTAL ESTIMATED DIRECT EXPENSES RECORDED ABOVE:")
    tot_label.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_label.alignment = Alignment(horizontal="right", vertical="center")
    
    tot_val = ws_it.cell(row=r, column=8)
    tot_val.value = f"=SUM(H5:H{r-1})"
    tot_val.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_val.alignment = Alignment(horizontal="right", vertical="center")
    tot_val.number_format = "₹#,##0"

    auto_fit_columns(ws_it, max_cols=11)

    # =========================================================================
    # TAB 3: CONTACTS & BOOKINGS WALLET DIRECTORY
    # =========================================================================
    ws_ct = wb.create_sheet(title="Contacts & Bookings Wallet")
    ws_ct.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ct, "EMERGENCY CONTACTS & BOOKINGS WALLET", "Direct Phone Numbers, Venue POCs, Booking References, Operational Instructions & Emergency Helplines", max_col=8)

    r = 4
    ct_hdrs = ["Category / Entity", "Name / Property Title", "Role / Booking Scope", "Phone / Contact Number", "Status / Reference", "Dates / Timing", "Location Hub", "Key Instructions & Action Items"]
    ws_ct.row_dimensions[r].height = 26
    for c_idx, h_text in enumerate(ct_hdrs, start=1):
        style_header_cell(ws_ct.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    contacts_data = [
        # Bookings & Stays
        ("Accommodation", "Calvin's Inn", "Day 1 Stay (Fort Kochi)", "9995165493", "Booked (User-Provided)", "Check-in: 16 Oct 2:00 PM • Check-out: 17 Oct 11:30 AM", "K.J. Herschel Road, Fort Kochi", "Call host before arrival from station. Drop bags and head to Mattancherry for lunch."),
        ("Accommodation", "Ocean Aura Beach Stay", "Day 2 & Day 3 Stay (Alleppey)", "7994455407", "Booked (User-Provided)", "Check-in: 17 Oct 4:00 PM • Check-out: 19 Oct 11:00 AM", "Munnodi Temple Rd, Thumpoly Beach", "Beachfront stay on Thumpoly Beach with direct ocean access. Host contact: 7994455407."),
        ("Accommodation", "Zostel Kumbalangi", "Day 4 Stay (Kumbalangi)", "+91 484 223 8899", "Booked (User-Provided)", "Check-in: 19 Oct 2:00 PM • Check-out: 20 Oct 08:00 AM", "Kallancherry, Kumbalangi Backwaters", "Waterfront hostel nestled on backwater rim. Direct kayak/SUP access and sunset deck."),
        
        # Transits & Rentals
        ("Transport", "Vande Bharat Outbound", "Bengaluru ➔ Ernakulam Jn", "139", "Booked (₹1,708/person)", "16 Oct 2026, 02:00 PM Arrival", "Ernakulam Junction (ERS)", "Arrives 02:00 PM. De-board, exit towards South/Main gate to meet scooter vendor."),
        ("Transport", "Vande Bharat Return", "Ernakulam Jn ➔ Bengaluru", "139", "Booked (₹1,708/person)", "20 Oct 2026, 02:00 PM Departure", "Ernakulam Junction (Platform 1)", "🛑 HARD DEADLINE: Departs 02:00 PM sharp! Reach platform by 1:30 PM with confirmed e-ticket."),
        ("Transport", "Scooter Rental Provider", "Vehicle Rental & Return", "9003955156", "₹500 Advance Paid (Bal: ₹2,300)", "Pickup: 16 Oct 2:30 PM • Return: 20 Oct 1:00 PM", "Near Ernakulam Junction Railway Station", "🛑 HARD RETURN TARGET: 1:00 PM (latest 1:30 PM). Inspect bodywork, return helmets, settle ₹2,300 balance."),
        
        # Activities & Dining
        ("Activity", "Opulence Backwater Adventures", "Day 3 Early-Morning Kayaking", "8921172358", "Booked Slot (₹700 Total)", "18 Oct 2026, 06:00 AM – 11:30 AM", "Kainakary Backwaters, Alleppey", "Gliding through narrow Kuttanad canals. Breakfast provided. Host contact: 8921172358."),
        ("Food & Drink", "No. 1 Kallu Shap", "Day 3 Toddy Shop & Food Feast", "9446665472", "Walk-in Food Stop", "18 Oct 2026, 12:45 PM – 02:15 PM", "Mararikulam Rd, Kalavoor, Alleppey", "Authentic shaap dining: Karimeen Pollichathu, crab/duck roast & tapioca. Responsible riding reminder applies!"),
        ("Transport / Experience", "Kochi Water Metro", "Fort Kochi ⇄ High Court Catamaran", "1800 425 0345", "Counter / Kochi1 App (₹40/way)", "20 Oct 2026, 08:45 AM – 09:45 AM", "Fort Kochi Water Metro Terminal", "Modern AC hybrid-electric catamaran boat ride across harbor channel. Depart before 08:45 AM."),
        
        # Emergency & Helplines
        ("Emergency", "Kerala Tourism Toll-Free Helpline", "24/7 Traveller Assistance & Info", "1363", "Government Helpline", "24x7 Active", "Statewide Kerala", "Instant English/Hindi/Malayalam support for tourist queries, road status & emergency advice."),
        ("Emergency", "Kerala Police Emergency Response", "Police Assistance (Dial 112)", "112", "Emergency Police", "24x7 Active", "Statewide Kerala", "Immediate police dispatch for road accidents, disputes, or security assistance."),
        ("Emergency", "Ambulance / Medical Emergency", "Kerala Health Emergency Service", "108", "Medical Emergency", "24x7 Active", "Statewide Kerala", "Free emergency medical dispatch and hospital coordination.")
    ]

    for cd in contacts_data:
        ws_ct.row_dimensions[r].height = 28
        row_bg = C_ROW_ALT if "Emergency" in cd[0] else C_ROW_WHITE
        style_data_cell(ws_ct.cell(row=r, column=1), cd[0], bold=True, align="center")
        style_data_cell(ws_ct.cell(row=r, column=2), cd[1], bold=True)
        style_data_cell(ws_ct.cell(row=r, column=3), cd[2])
        style_data_cell(ws_ct.cell(row=r, column=4), cd[3], align="center", bold=True, fg="0284C7")
        style_data_cell(ws_ct.cell(row=r, column=5), cd[4], align="center", fg=C_ACCENT_EMERALD if "Booked" in cd[4] else "0F172A", bold=True)
        style_data_cell(ws_ct.cell(row=r, column=6), cd[5])
        style_data_cell(ws_ct.cell(row=r, column=7), cd[6])
        style_data_cell(ws_ct.cell(row=r, column=8), cd[7])
        r += 1

    auto_fit_columns(ws_ct, max_cols=8)

    # =========================================================================
    # TAB 4: CURATED RESTAURANTS & FOOD GUIDE
    # =========================================================================
    ws_fd = wb.create_sheet(title="Food & Restaurant Guide")
    ws_fd.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_fd, "CURATED RESTAURANT, CAFE & TODDY SHOP GUIDE", "Verified Eateries, Coastal Seafood, Heritage Godown Cafes, Bakeries & Shacks across Kochi, Alleppey & Kumbalangi", max_col=9)

    r = 4
    fd_hdrs = ["Region / Town", "Restaurant / Cafe Name", "Category & Cuisine", "Status", "Rating", "Opening Hours", "Price / Person", "Signature Specialities", "Operational Notes & Insider Guidance"]
    ws_fd.row_dimensions[r].height = 26
    for c_idx, h_text in enumerate(fd_hdrs, start=1):
        style_header_cell(ws_fd.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    food_data = [
        # Fort Kochi & Mattancherry
        ("Mattancherry", "The Warehouse Cafe", "Continental & Cafe", "Primary Choice", "4.2 ★ (1.4k)", "10:00 AM – 10:30 PM", "₹500", "Cold brew coffee, calamari bites, waterfront views", "Restored waterfront spice godown overlooking harbour shipping channel. Perfect arrival lunch."),
        ("Fort Kochi", "Fort House Restaurant", "Kerala Coastal & Seafood", "Primary Choice", "4.4 ★ (2.3k)", "12:30–3 PM, 6:30–10:30 PM", "₹850", "Karimeen Pollichathu, Kerala Prawn Curry, Appam", "Romantic wooden timber jetty over Cochin harbor water. Gentle waves and authentic Kerala preparations."),
        ("Fort Kochi", "Trouvaille", "French Patisserie & Desserts", "Primary Choice", "4.5 ★ (890)", "10:30 AM – 10:30 PM", "₹300", "Burnt Basque Cheesecake, Dark Chocolate Tart, Gelato", "The #1 boutique dessert haven in Fort Kochi. Parisian aesthetic, open late for dessert nightcap."),
        ("Fort Kochi", "Qissa Cafe", "European Breakfast & Bakery", "Primary Choice", "4.4 ★ (2.1k)", "8:00 AM – 10:00 PM", "₹350", "Shakshuka, Blueberry Pancakes, Pour-over Espresso", "2 minutes walk from Calvin's Inn. Exceptional breakfast before embarking on Saturday morning walk."),
        ("Fort Kochi", "Pandhal Cafe and Deli (David Hall)", "Artisanal Bakery & Continental", "Verified Backup", "4.5 ★ (3.3k)", "8:30 AM – 9:30 PM", "₹550", "Mattancherry Spice Cake, Sourdough Pizza, Cold Brew", "17th-century Dutch colonial bungalow with serene garden courtyard. Operated by CGH Earth."),
        ("Fort Kochi", "Kashi Art Cafe", "Art Cafe & Brunch", "Primary Choice (Day 5)", "4.2 ★ (11.4k)", "8:30 AM – 10:00 PM", "₹450", "Warm chocolate cake, poached eggs on sourdough, cold drip", "Iconic courtyard gallery shaded by lush rain foliage. Ideal for Day 5 farewell brunch."),
        ("Mattancherry", "Ginger House Museum Restaurant", "Heritage Seafood & Teas", "Verified Backup", "4.1 ★ (2.8k)", "10:00 AM – 09:30 PM", "₹650", "Signature Iced Ginger Tea, Fish Molly, Ginger Ice Cream", "India's only museum restaurant; dine right next to an authentic 108ft antique snake boat on the water."),
        ("Fort Kochi", "Loafer's Corner", "Cafe & Light Bites", "Verified Backup", "4.4 ★ (1.8k)", "10:30 AM – 10:30 PM", "₹350", "Ginger lime soda, pasta, Banoffee pie", "Cozy wooden attic overlooking Princess Street. Perfect people-watching spot."),
        ("Fort Kochi", "Canvas Restaurant & Pizzeria", "Artisanal Italian & Pizza", "Primary (Day 4 Lunch)", "4.3 ★ (1.2k)", "12:00 PM – 10:30 PM", "₹450", "Wood-fired Neapolitan pizza, pasta, iced teas", "Great lunch stop on return ride north from Alleppey to Kumbalangi."),
        ("Fort Kochi", "Fort Paragon", "Malabar Seafood & Biryani", "Verified Backup", "4.3 ★ (2.5k)", "12:00 PM – 11:00 PM", "₹450", "Malabar Fish Biryani, Chicken Dum Biryani, Fish Mango Curry", "Renowned Calicut Paragon branch in Fort Kochi. Fast service, authentic flavours."),

        # Alleppey & Marari
        ("Alleppey", "Cafe Catamaran", "Beachfront Continental & Grill", "Primary Choice", "4.3 ★ (2.1k)", "11:00 AM – 11:00 PM", "₹450", "Chicken Badiya, Alfaham grills, thin crust pizza", "Open-air beachfront cafe overlooking the dark waves. Breezy dinner spot on Day 2."),
        ("Alleppey", "No. 1 Kallu Shap", "Traditional Kerala Shaap Feast", "Primary Choice", "4.2 ★ (1.5k)", "10:00 AM – 08:30 PM", "₹450", "Karimeen Pollichathu, duck roast, spicy crab & tapioca", "Iconic authentic toddy shop feast on Day 3. Note: Never ride after alcohol; designate sober driver!"),
        ("Alleppey", "Hotel Brothers", "Kerala Heritage Cuisine", "Verified Backup", "4.2 ★ (3.1k)", "07:00 AM – 10:30 PM", "₹350", "Kuttanad duck roast, Neymeen curry, Appams", "Serving authentic traditional Alappuzha meals since 1973 near town center."),
        ("Alleppey", "Borma Cafe", "Bakery & Desserts", "Verified Backup", "4.4 ★ (850)", "10:00 AM – 10:00 PM", "₹300", "Fresh pastries, sourdough sandwiches, specialty coffee", "Modern aesthetic cafe near beach for evening coffee and light dessert."),
        ("Ambalappuzha", "Ambalappuzha Temple Eateries", "Traditional Vegetarian Breakfast", "Primary (Day 4 B'fast)", "4.5 ★", "06:30 AM – 11:30 AM", "₹150", "Ghee roast dosa, hot idlis, uzhunnu vada, filter coffee", "Freshly steamed South Indian breakfast right outside Ambalappuzha temple gates."),

        # Kumbalangi
        ("Kumbalangi", "Kumbalangi Village Seafood Shacks", "Local Village Catch", "Primary (Day 4 Dinner)", "4.4 ★", "12:00 PM – 10:00 PM", "₹350", "Fresh pearl spot fry, squid roast, Kerala parotta", "Authentic village home-style seafood right by the water in India's first eco-tourism village."),
        ("Kumbalangi", "Zostel Cafe & Kitchen", "Hostel Cafe & Comfort Foods", "Primary Backup", "4.3 ★", "08:00 AM – 10:30 PM", "₹300", "Pasta, sandwiches, masala chai, Kerala breakfast", "Dine on the open-air wooden deck over the Kumbalangi backwater rim.")
    ]

    for fd in food_data:
        ws_fd.row_dimensions[r].height = 28
        style_data_cell(ws_fd.cell(row=r, column=1), fd[0], bold=True, align="center")
        style_data_cell(ws_fd.cell(row=r, column=2), fd[1], bold=True)
        style_data_cell(ws_fd.cell(row=r, column=3), fd[2])
        style_data_cell(ws_fd.cell(row=r, column=4), fd[3], align="center", fg=C_ACCENT_EMERALD if "Primary" in fd[3] else "475569", bold=("Primary" in fd[3]))
        style_data_cell(ws_fd.cell(row=r, column=5), fd[4], align="center", bold=True)
        style_data_cell(ws_fd.cell(row=r, column=6), fd[5], align="center")
        style_data_cell(ws_fd.cell(row=r, column=7), fd[6], align="right", bold=True)
        style_data_cell(ws_fd.cell(row=r, column=8), fd[7])
        style_data_cell(ws_fd.cell(row=r, column=9), fd[8])
        r += 1

    auto_fit_columns(ws_fd, max_cols=9)

    # =========================================================================
    # TAB 5: BUDGET & EXPENSE SPLITTER (VISHNU & CO-RIDER)
    # =========================================================================
    ws_ex = wb.create_sheet(title="Budget & Expense Splitter")
    ws_ex.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ex, "TRIP BUDGET ESTIMATION & SPLITWISE LEDGER", "Estimated Total Outlay, Advance Payments, Balance Settlements & 2-Traveller Split Calculation", max_col=8)

    r = 4
    for c in range(1, 9):
        ws_ex.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_b = ws_ex.cell(row=r, column=1, value="💰 MACRO ESTIMATED BUDGET BREAKDOWN (2 TRAVELLERS)")
    sec_b.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_b.alignment = Alignment(horizontal="left", vertical="center")
    ws_ex.row_dimensions[r].height = 26
    r += 1

    ws_ex.row_dimensions[r].height = 24
    style_header_cell(ws_ex.cell(row=r, column=1), "Expense Category", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=2), "Details & Breakdown Inclusions", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=3), "", bg=C_HEADER_BG)
    ws_ex.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    style_header_cell(ws_ex.cell(row=r, column=4), "Est. Total (₹)", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=5), "Vishnu (₹)", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=6), "Co-rider (₹)", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=7), "Payment Status & Settlement Notes", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=8), "", bg=C_HEADER_BG)
    ws_ex.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8)
    r += 1

    budget_items = [
        ("🚆 Train (Vande Bharat Outbound)", "Bengaluru ➔ Ernakulam Jn (2 Tickets @ ₹1,708)", 3416, "=D6/2", "=D6/2", "Confirmed & Paid"),
        ("🚆 Train (Vande Bharat Return)", "Ernakulam Jn ➔ Bengaluru (2 Tickets @ ₹1,708)", 3416, "=D7/2", "=D7/2", "Confirmed & Paid"),
        ("🛵 Scooter Rental (Total)", "5-day rental package (₹500 advance + ₹2,300 balance)", 2800, "=D8/2", "=D8/2", "₹500 Advance Paid; ₹2,300 due 20 Oct"),
        ("⛽ Fuel (Petrol)", "~165 km + local buffer @ 40 km/l (~5 litres)", 600, "=D9/2", "=D9/2", "Fuel up at BPCL/IndianOil pumps"),
        ("🏨 Stays (4 Nights Total)", "Calvin's Inn (N1), Ocean Aura (N2-N3), Zostel (N4)", 6500, "=D10/2", "=D10/2", "Booked / User-Provided Accommodations"),
        ("🛶 Opulence Kayaking", "Kuttanad Backwater Kayaking (Slot booked with breakfast)", 700, "=D11/2", "=D11/2", "Booked at ₹700 (Incl. breakfast)"),
        ("⛴️ Kochi Water Metro", "Fort Kochi ⇄ High Court catamaran tickets (2 Riders)", 160, "=D12/2", "=D12/2", "Pay at counter / Kochi1 app"),
        ("🎟 Entry Tickets & Parking", "Alleppey Lighthouse (₹20), Ambalappuzha, tolls/parking", 250, "=D13/2", "=D13/2", "Pay on spot"),
        ("🍽 Meals, Cafes & Dining", "5-day dining (Warehouse, Fort House, Catamaran, Shaap, Kashi)", 5500, "=D14/2", "=D14/2", "Split equally as incurred")
    ]

    start_b_row = r
    for bi in budget_items:
        ws_ex.row_dimensions[r].height = 24
        style_data_cell(ws_ex.cell(row=r, column=1), bi[0], bold=True)
        style_data_cell(ws_ex.cell(row=r, column=2), bi[1])
        style_data_cell(ws_ex.cell(row=r, column=3), "")
        ws_ex.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        style_data_cell(ws_ex.cell(row=r, column=4), bi[2], align="right", num_format="₹#,##0")
        style_data_cell(ws_ex.cell(row=r, column=5), bi[3], align="right", num_format="₹#,##0")
        style_data_cell(ws_ex.cell(row=r, column=6), bi[4], align="right", num_format="₹#,##0")
        style_data_cell(ws_ex.cell(row=r, column=7), bi[5])
        style_data_cell(ws_ex.cell(row=r, column=8), "")
        ws_ex.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8)
        r += 1

    # Budget Total Row
    ws_ex.row_dimensions[r].height = 26
    for c in range(1, 9):
        cell = ws_ex.cell(row=r, column=c)
        cell.fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
        cell.border = header_border

    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    tot_lbl = ws_ex.cell(row=r, column=1, value="ESTIMATED TOTAL OUTLAY (2 TRAVELLERS):")
    tot_lbl.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_lbl.alignment = Alignment(horizontal="right", vertical="center")
    
    b_tot_cell = ws_ex.cell(row=r, column=4, value=f"=SUM(D{start_b_row}:D{r-1})")
    b_tot_cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    b_tot_cell.number_format = "₹#,##0"
    b_tot_cell.alignment = Alignment(horizontal="right", vertical="center")

    b_v_cell = ws_ex.cell(row=r, column=5, value=f"=SUM(E{start_b_row}:E{r-1})")
    b_v_cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    b_v_cell.number_format = "₹#,##0"
    b_v_cell.alignment = Alignment(horizontal="right", vertical="center")

    b_c_cell = ws_ex.cell(row=r, column=6, value=f"=SUM(F{start_b_row}:F{r-1})")
    b_c_cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    b_c_cell.number_format = "₹#,##0"
    b_c_cell.alignment = Alignment(horizontal="right", vertical="center")
    r += 2

    # Active Logged Expenses & Advance Tracking
    for c in range(1, 9):
        ws_ex.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_l = ws_ex.cell(row=r, column=1, value="🧾 PRE-PAID ADVANCES & BALANCE SETTLEMENT TRACKER")
    sec_l.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_l.alignment = Alignment(horizontal="left", vertical="center")
    ws_ex.row_dimensions[r].height = 26
    r += 1

    e_hdrs = ["Date Recorded", "Expense / Payment Title", "Category", "Paid By", "Split Method", "Total Paid (₹)", "Vishnu Share (₹)", "Co-rider Share (₹)"]
    ws_ex.row_dimensions[r].height = 24
    for c_idx, h_text in enumerate(e_hdrs, start=1):
        style_header_cell(ws_ex.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    logged_advances = [
        ("10 Oct 2026", "Scooter Rental Advance Deposit (Prepaid)", "Scooter Rental", "Vishnu", "Equal (50/50)", 500, f"=F{r}/2", f"=F{r}/2"),
        ("10 Oct 2026", "Vande Bharat Outbound (Bengaluru ➔ ERS)", "Train Tickets", "Vishnu", "Equal (50/50)", 3416, f"=F{r+1}/2", f"=F{r+1}/2"),
        ("10 Oct 2026", "Vande Bharat Return (ERS ➔ Bengaluru)", "Train Tickets", "Vishnu", "Equal (50/50)", 3416, f"=F{r+2}/2", f"=F{r+2}/2"),
        ("18 Oct 2026", "Opulence Kayaking Session (Slot Deposit)", "Activity", "Vishnu", "Equal (50/50)", 700, f"=F{r+3}/2", f"=F{r+3}/2"),
        ("20 Oct 2026 (Due)", "Scooter Rental Balance Payment (Due on Return)", "Scooter Rental", "Pending", "Equal (50/50)", 2300, f"=F{r+4}/2", f"=F{r+4}/2")
    ]

    start_e_row = r
    for le in logged_advances:
        ws_ex.row_dimensions[r].height = 24
        style_data_cell(ws_ex.cell(row=r, column=1), le[0], align="center")
        style_data_cell(ws_ex.cell(row=r, column=2), le[1], bold=True)
        style_data_cell(ws_ex.cell(row=r, column=3), le[2], align="center")
        style_data_cell(ws_ex.cell(row=r, column=4), le[3], align="center", bold=True)
        style_data_cell(ws_ex.cell(row=r, column=5), le[4], align="center")
        style_data_cell(ws_ex.cell(row=r, column=6), le[5], align="right", num_format="₹#,##0")
        style_data_cell(ws_ex.cell(row=r, column=7), le[6], align="right", num_format="₹#,##0")
        style_data_cell(ws_ex.cell(row=r, column=8), le[7], align="right", num_format="₹#,##0")
        r += 1

    # Total Logged Row
    ws_ex.row_dimensions[r].height = 26
    for c in range(1, 9):
        cell = ws_ex.cell(row=r, column=c)
        cell.fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
        cell.border = header_border

    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
    tot_log_lbl = ws_ex.cell(row=r, column=1, value="TOTAL COMMITTED PAYMENTS & ADVANCES:")
    tot_log_lbl.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_log_lbl.alignment = Alignment(horizontal="right", vertical="center")

    e_tot = ws_ex.cell(row=r, column=6, value=f"=SUM(F{start_e_row}:F{r-1})")
    e_tot.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    e_tot.number_format = "₹#,##0"
    e_tot.alignment = Alignment(horizontal="right", vertical="center")

    e_my = ws_ex.cell(row=r, column=7, value=f"=SUM(G{start_e_row}:G{r-1})")
    e_my.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    e_my.number_format = "₹#,##0"
    e_my.alignment = Alignment(horizontal="right", vertical="center")

    e_partner = ws_ex.cell(row=r, column=8, value=f"=SUM(H{start_e_row}:H{r-1})")
    e_partner.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    e_partner.number_format = "₹#,##0"
    e_partner.alignment = Alignment(horizontal="right", vertical="center")

    auto_fit_columns(ws_ex, max_cols=8)

    # =========================================================================
    # TAB 6: PACKING CHECKLIST & KERALA SAFETY RULES
    # =========================================================================
    ws_ck = wb.create_sheet(title="Checklist & Safety Guide")
    ws_ck.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ck, "PACKING CHECKLIST & KERALA ROAD SAFETY GUIDELINES", "Essential Documents, AI Camera Traffic Enforcement, Temple Dress Codes & Daily Action Items", max_col=6)

    r = 4
    for c in range(1, 7):
        ws_ck.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ck.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    sec_ck = ws_ck.cell(row=r, column=1, value="🎒 PRE-TRIP PACKING & GEAR CHECKLIST")
    sec_ck.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_ck.alignment = Alignment(horizontal="left", vertical="center")
    ws_ck.row_dimensions[r].height = 26
    r += 1

    ws_ck.row_dimensions[r].height = 24
    style_header_cell(ws_ck.cell(row=r, column=1), "Category", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=2), "Checklist Item Description", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=3), "", bg=C_HEADER_BG)
    ws_ck.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    style_header_cell(ws_ck.cell(row=r, column=4), "Status", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=5), "Priority", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=6), "Guidance, Safety Impact & Action Notes", bg=C_HEADER_BG)
    r += 1

    checklist_items = [
        ("Documents", "Train tickets confirmed (Outbound & Return Vande Bharat)", "✅ Confirmed", "High", "Keep offline PDF/IRCTC e-ticket handy on phone without relying on data connectivity."),
        ("Documents", "Valid physical Driving Licence and Digilocker copy ready", "✅ Ready", "Critical", "Mandatory for vehicle rental pickup near ERS and Kerala Motor Vehicles Dept (MVD) checks."),
        ("Transport", "Scooter pickup confirmation & ₹500 advance recorded", "✅ Confirmed", "Critical", "Contact: 9003955156. Pickup at 2:30 PM (16 Oct). Inspect vehicle body, tyres, brakes & RC."),
        ("Safety Gear", "Two ISI-certified Helmets with functioning chin straps", "⏳ Pack Today", "Critical", "🛑 MANDATORY: Kerala has 700+ AI-enabled traffic cameras. Fines auto-issued for unstrapped/missing helmets for both rider and pillion!"),
        ("Rain Gear", "Lightweight Rain Poncho / Windcheater & Backpack cover", "⏳ Pack Today", "High", "Essential for sudden coastal afternoon rain showers while riding on coastal highways."),
        ("Electronics", "Waterproof phone pouch with neck lanyard", "⏳ Pack Today", "Critical", "Vital for Opulence kayaking on Day 3 and coastal riding in rain."),
        ("Electronics", "High-capacity Power Bank (20,000 mAh) + fast cables", "⏳ Pack Today", "High", "Keep phones charged during all-day navigation, photo capture, and ticket validation."),
        ("Cash Buffer", "Emergency Cash (₹3,000 – ₹5,000 in ₹100/₹500 notes)", "⏳ Withdraw Today", "High", "Tender coconut stalls, toddy shop, boat ticket counters, and remote beach vendors often lack UPI."),
        ("Navigation", "Download Offline Google Maps (Kochi, Alleppey, Kumbalangi)", "⏳ Download Today", "High", "Crucial for coastal roads and canal bunds where cellular network signals fluctuate."),
        ("Attire", "Traditional Temple Attire (Mundu/veshti for Vishnu, Saree/salwar for Co-rider)", "⏳ Pack Today", "High", "Mandatory for Ambalappuzha Sree Krishna Temple darshan on Day 4. Strict dress code enforced!")
    ]

    for cki in checklist_items:
        ws_ck.row_dimensions[r].height = 24
        style_data_cell(ws_ck.cell(row=r, column=1), cki[0], bold=True, align="center")
        style_data_cell(ws_ck.cell(row=r, column=2), cki[1], bold=True)
        style_data_cell(ws_ck.cell(row=r, column=3), "")
        ws_ck.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        style_data_cell(ws_ck.cell(row=r, column=4), cki[2], align="center", fg=C_ACCENT_EMERALD if "✅" in cki[2] else C_ACCENT_AMBER, bold=True)
        style_data_cell(ws_ck.cell(row=r, column=5), cki[3], align="center", fg=C_ACCENT_ROSE if cki[3]=="Critical" else "0F172A", bold=(cki[3]=="Critical"))
        style_data_cell(ws_ck.cell(row=r, column=6), cki[4])
        r += 1

    r += 1
    # Kerala Specific Road Rules & Guidelines
    for c in range(1, 7):
        ws_ck.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ck.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    sec_sf = ws_ck.cell(row=r, column=1, value="🛡 KERALA ROAD SAFETY, CULTURAL LAWS & EXPEDITION GUIDELINES")
    sec_sf.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_sf.alignment = Alignment(horizontal="left", vertical="center")
    ws_ck.row_dimensions[r].height = 26
    r += 1

    safety_rules = [
        ("AI Traffic Camera Network", "Over 700+ AI-enabled cameras operate on Kerala roads. Both rider and pillion MUST wear strapped ISI helmets. Speed limits and lane discipline strictly monitored with automated challans."),
        ("Responsible Riding (Shaap)", "Never ride after consuming toddy or alcohol at No. 1 Kallu Shap! Arrange a designated sober driver or alternative auto transport. Kerala police enforce zero-tolerance breathalyzer checks."),
        ("Temple Sanctum Dress Codes", "Ambalappuzha Sree Krishna Temple strictly enforces traditional Kerala dress code: Men must wear Mundu (veshti) bare-chested; Women must wear saree, set-mundu, or salwar kameez."),
        ("Lighthouse Ticket Cutoff", "Alleppey Lighthouse operating window is 2:00 PM – 5:30 PM, but the ticket counter closes at 5:00 PM sharp. Arrive before 4:45 PM on Day 2 to climb the 100+ wooden spiral steps."),
        ("Day 5 Return Hard Deadlines", "Leave Fort Kochi NO LATER THAN 12:15 PM on Day 5. Cross Willingdon Island to absorb mainland traffic. Return scooter by 1:00 PM (latest 1:30 PM) to board the 2:00 PM Vande Bharat train comfortably.")
    ]

    for sr in safety_rules:
        ws_ck.row_dimensions[r].height = 30
        style_data_cell(ws_ck.cell(row=r, column=1), sr[0], bold=True, align="center")
        style_data_cell(ws_ck.cell(row=r, column=2), sr[1])
        for c in range(3, 7):
            style_data_cell(ws_ck.cell(row=r, column=c), "")
        ws_ck.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
        r += 1

    auto_fit_columns(ws_ck, max_cols=6)

    # Save workbook
    output_path = r"d:\Documents\OntheGo\Kerala_Expedition_Full_Itinerary.xlsx"
    wb.save(output_path)
    print(f"Successfully generated Excel workbook at: {output_path}")

if __name__ == "__main__":
    build_workbook()
