import sys
import os
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def build_workbook():
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Styling Palette
    FONT_FAMILY = "Segoe UI"
    
    # Colors
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
        ws.row_dimensions[1].height = 40

        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=max_col)
        sub_cell = ws.cell(row=2, column=1)
        sub_cell.value = subtitle_text
        sub_cell.font = Font(name=FONT_FAMILY, size=10, italic=True, color="94A3B8")
        sub_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 22

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
            adjusted_width = min(max(max_len + padding, 11), 60)
            ws.column_dimensions[col_letter].width = adjusted_width

    # =========================================================================
    # TAB 1: TRIP OVERVIEW & TRAIN LOGISTICS
    # =========================================================================
    ws_ov = wb.create_sheet(title="Trip Overview")
    ws_ov.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ov, "KERALA EXPEDITION: KOCHI - ALLEPPEY - VARKALA", "96-Hour Explorer • Bengaluru Outbound & Inbound • Master Travel Guide", max_col=7)

    overview_meta = [
        ("Trip Title", "Kerala Expedition: Kochi - Alleppey - Varkala", "Travel Dates", "16th Sep - 20th Sep"),
        ("Origin Hub", "Bengaluru (SBC / SMVB / KJM)", "Destination Hub", "Ernakulam Junction (ERS), Kochi"),
        ("Total Duration", "96 Hours (4 Days & 4 Nights)", "Total Distance", "360 km (Full Circuit)"),
        ("Primary Transit", "Rented Scooter (Optional: Train/KSRTC)", "Participants", "Me & Riding Partner (2 Riders)"),
        ("Hydration Frequency", "Every 90 mins (High Humidity)", "NH-66 Delay Cushion", "45 mins buffer per leg"),
        ("Sleep Target", "4 - 6 Hours Solid Recharge Nightly", "Meal Windows", "30m - 1h fixed slots (08:00 AM, 02:00 PM, 08:00 PM)")
    ]

    r = 4
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_c = ws_ov.cell(row=r, column=1, value="📌 TRIP MASTER PARAMETERS")
    sec_c.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_c.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 25
    r += 1

    for row_data in overview_meta:
        ws_ov.row_dimensions[r].height = 22
        style_data_cell(ws_ov.cell(row=r, column=1), row_data[0], bg=C_CARD_BG, fg="334155", bold=True, align="left")
        
        # Cols 2-3
        style_data_cell(ws_ov.cell(row=r, column=2), row_data[1], bg=C_ROW_WHITE, fg="0F172A", bold=False, align="left")
        style_data_cell(ws_ov.cell(row=r, column=3), "", bg=C_ROW_WHITE)
        ws_ov.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        
        # Col 4
        style_data_cell(ws_ov.cell(row=r, column=4), row_data[2], bg=C_CARD_BG, fg="334155", bold=True, align="left")
        
        # Cols 5-7
        style_data_cell(ws_ov.cell(row=r, column=5), row_data[3], bg=C_ROW_WHITE, fg="0F172A", bold=False, align="left")
        style_data_cell(ws_ov.cell(row=r, column=6), "", bg=C_ROW_WHITE)
        style_data_cell(ws_ov.cell(row=r, column=7), "", bg=C_ROW_WHITE)
        ws_ov.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
        r += 1

    r += 1
    # Train Logistics Section
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_train = ws_ov.cell(row=r, column=1, value="🚆 BENGALURU ⇄ KOCHI TRAIN CONNECTIONS")
    sec_train.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_train.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 25
    r += 1

    ws_ov.row_dimensions[r].height = 24
    style_header_cell(ws_ov.cell(row=r, column=1), "Direction", bg=C_ACCENT_SKY)
    style_header_cell(ws_ov.cell(row=r, column=2), "Origin Station", bg=C_ACCENT_SKY)
    style_header_cell(ws_ov.cell(row=r, column=3), "Destination Hub", bg=C_ACCENT_SKY)
    style_header_cell(ws_ov.cell(row=r, column=4), "Target Timing", bg=C_ACCENT_SKY)
    style_header_cell(ws_ov.cell(row=r, column=5), "Popular Train Services", bg=C_ACCENT_SKY)
    style_header_cell(ws_ov.cell(row=r, column=6), "", bg=C_ACCENT_SKY)
    ws_ov.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
    style_header_cell(ws_ov.cell(row=r, column=7), "Logistics & Cloakroom", bg=C_ACCENT_SKY)
    r += 1

    train_data = [
        ("🟢 Outbound", "Bengaluru (SBC / SMVB / KJM)", "Ernakulam Junction (ERS)", "Arrive: 16th Sep - 02:00 PM", "Kanyakumari Exp (16526), Island Exp (16371), SMVB Kochuveli Special", "Cloakroom on Platform 1 ERS for bulky luggage. Freshen up at station waiting room."),
        ("🔴 Return", "Ernakulam Junction (ERS)", "Bengaluru (SBC / SMVB)", "Depart: 20th Sep - 02:00 PM", "Kochuveli SMVB Exp, Kanyakumari SBC Exp, Ernakulam SBC Intercity", "Reach ERS by 01:15 PM (45m prior). Return scooter & claim ₹2,000 deposit by 12:30 PM.")
    ]

    for td in train_data:
        ws_ov.row_dimensions[r].height = 35
        style_data_cell(ws_ov.cell(row=r, column=1), td[0], bold=True, align="center")
        style_data_cell(ws_ov.cell(row=r, column=2), td[1])
        style_data_cell(ws_ov.cell(row=r, column=3), td[2])
        style_data_cell(ws_ov.cell(row=r, column=4), td[3], bold=True)
        style_data_cell(ws_ov.cell(row=r, column=5), td[4])
        style_data_cell(ws_ov.cell(row=r, column=6), "")
        ws_ov.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
        style_data_cell(ws_ov.cell(row=r, column=7), td[5])
        r += 1

    r += 1
    # 5-Day Circuit Summary
    for c in range(1, 8):
        ws_ov.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ov.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    sec_circ = ws_ov.cell(row=r, column=1, value="🗺 5-DAY CIRCUIT ROUTE OVERVIEW")
    sec_circ.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_circ.alignment = Alignment(horizontal="left", vertical="center")
    ws_ov.row_dimensions[r].height = 25
    r += 1

    ws_ov.row_dimensions[r].height = 24
    circuit_hdrs = ["Day", "Date", "Title & Theme", "Route Legs", "Distance", "Est. Travel", "Road Conditions & Key Highlights"]
    for c_idx, h_text in enumerate(circuit_hdrs, start=1):
        style_header_cell(ws_ov.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    circuit_data = [
        ("Day 1", "16th Sep", "Bengaluru Train Arrival & Fort Kochi Trail", "ERS -> Mattancherry -> Fort Kochi -> Marine Drive -> Kumbalangi", "35 km", "1 hr 15 mins", "Heavy traffic on MG Road/Menaka. Sunset Minar Cruise (5:45 PM), Zostel Kumbalangi stay."),
        ("Day 2", "17th Sep", "Kumbalangi Kayaking & Coastal Transit to Alleppey", "Kumbalangi -> Chellanam Coast -> No.1 Kallu Shop -> Alleppey", "65 km", "2 hrs 15 mins", "Take scenic Chellanam-Marari coastal road. Mangrove kayak (6:30 AM), Toddy shop feast, Pagoda Resort."),
        ("Day 3", "18th Sep", "Alleppey Shikara & Ride to Varkala Cliff", "Alleppey -> Ambalapuzha -> Kayamkulam -> Kollam Bypass -> Varkala", "110 km", "3 hrs 30 mins (+45m buffer)", "NH-66 road widening between Haripad & Kollam. Morning Shikara (6:30 AM), Ocean Breeze Resort, Black Sand Beach."),
        ("Day 4", "19th Sep", "Varkala Explorer: Surfing, Kappil Lake & Cliff Chill", "North Cliff -> Papanasam Beach -> Kappil Lake & Beach -> Janardhana", "25 km", "45 mins", "Breezy scenic coastal ride. Morning surf/mineral springs, InDa Cafe, Kappil sea-lake bridge, Darjeeling Cafe acoustic night."),
        ("Day 5", "20th Sep", "Return Transit to Ernakulam & Bengaluru Train", "Varkala -> Kollam -> Alleppey -> Cherthala -> Ernakulam (ERS)", "185 km", "4 hrs 45 mins (+45m buffer)", "CRITICAL: Depart by 06:45 AM! Cherthala/Aroor bottlenecks. Return scooter by 12:15 PM, 02:00 PM Bengaluru train.")
    ]

    for cd in circuit_data:
        ws_ov.row_dimensions[r].height = 32
        style_data_cell(ws_ov.cell(row=r, column=1), cd[0], bold=True, align="center")
        style_data_cell(ws_ov.cell(row=r, column=2), cd[1], align="center")
        style_data_cell(ws_ov.cell(row=r, column=3), cd[2], bold=True)
        style_data_cell(ws_ov.cell(row=r, column=4), cd[3])
        style_data_cell(ws_ov.cell(row=r, column=5), cd[4], align="center")
        style_data_cell(ws_ov.cell(row=r, column=6), cd[5], align="center")
        style_data_cell(ws_ov.cell(row=r, column=7), cd[6])
        r += 1

    auto_fit_columns(ws_ov, max_cols=7)

    # =========================================================================
    # TAB 2: FULL MASTER ITINERARY (CHRONOLOGICAL 5-DAY SCHEDULE)
    # =========================================================================
    ws_it = wb.create_sheet(title="Full Master Itinerary")
    ws_it.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_it, "COMPLETE 5-DAY MASTER ITINERARY & TIMELINE", "Chronological Schedule, Activity Details, Locations, Booking POCs, Costs & Navigation Links", max_col=11)

    r = 4
    it_headers = [
        "Day #", "Date", "Time Window", "Category", "Activity / Event Title", 
        "Location / Venue", "Booking Status", "Cost (₹)", "Point of Contact (POC)", "POC Phone", "Operational Notes & Action Items"
    ]
    ws_it.row_dimensions[r].height = 28
    for c_idx, h_text in enumerate(it_headers, start=1):
        style_header_cell(ws_it.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    activities_all = [
        # Day 1
        ("Day 1", "16th Sep", "02:00 PM", "Transit", "Arrive at Ernakulam Junction (ERS) from Bengaluru", "Ernakulam Junction Railway Station", "Not Required", 0, "Station Helpdesk / Cloakroom", "139", "Arrive via Bengaluru train. Freshen up at station waiting room, collect day-packs. Cloakroom at Platform 1."),
        ("Day 1", "16th Sep", "02:00 PM - 03:00 PM", "Meal", "🍱 Day 1 Lunch Window (30m - 1h)", "Grand Hotel / Bimbis / Station Canteen, MG Road", "Not Required", 450, "-", "-", "Quick authentic Kerala Sadhya or Meals before starting local exploration."),
        ("Day 1", "16th Sep", "03:00 PM", "Rental", "Pick up Vehicle (Scooter / Local Transit)", "Rental Point near Ernakulam Junction", "Action Required", 2000, "Scooter Rental POC", "-", "⚠️ Compare rental vs train/bus. Check tire tread, brakes & lights. Take 360° vehicle video."),
        ("Day 1", "16th Sep", "03:45 PM", "Sightseeing", "Mattancherry Palace (Dutch Palace) & Jew Town", "Jew Town, Mattancherry", "Not Required", 50, "-", "-", "Explore antique shops, spice aromas, Synagogue lane."),
        ("Day 1", "16th Sep", "04:45 PM", "Sightseeing", "Fort Kochi & Chinese Fishing Nets Promenade", "Fort Kochi Beach", "Not Required", 0, "-", "-", "Walk along Vasco da Gama Square, quick iced coffee at Loafer's Corner or Kashi Art Cafe."),
        ("Day 1", "16th Sep", "05:45 PM", "Activity", "Marine Drive Sunset Cruise (Minar Cruise)", "Marine Drive Walkway, Ernakulam", "Action Required", 500, "Capt. Abirag Ambas", "+918075264663", "⚠️ Advance booking needed! Call Captain to lock 5:45 PM sunset cruise slot."),
        ("Day 1", "16th Sep", "08:00 PM - 09:00 PM", "Meal", "🍽 Day 1 Dinner Window (30m - 1h)", "Kumbalangi Village Restaurant / Seagull Fort Kochi", "Not Required", 600, "-", "-", "Fresh sea catch, appam & stew, Kerala parotta."),
        ("Day 1", "16th Sep", "09:00 PM", "Stay", "Check-in at Zostel Kochi (Kumbalangi)", "Zostel Kochi (Kumbalangi)", "Action Required", 1600, "Zostel Kumbalangi Front Desk", "+918921696499", "⚠️ Call to reserve dorm/room. Rest & recharge."),
        ("Day 1", "16th Sep", "11:30 PM - 05:30 AM", "Rest", "🌙 Rest & Sleep Window (6 Hours)", "Zostel Kumbalangi", "Not Required", 0, "-", "-", "Charge powerbanks, hydrate, get solid rest for 6:30 AM sunrise kayaking."),

        # Day 2
        ("Day 2", "17th Sep", "06:30 AM", "Activity", "Kumbalangi Backwater Mangrove Sunrise Kayaking", "Kumbalangi Backwaters", "Action Required", 800, "Kayak Guide", "+919074717022", "⚠️ Advance booking required. Serene paddle through mangrove canals."),
        ("Day 2", "17th Sep", "08:00 AM - 09:00 AM", "Meal", "🍳 Day 2 Breakfast Window (30m - 1h)", "Kumbalangi Local Tea Shop / Zostel Cafe", "Not Required", 200, "-", "-", "Puttu with kadala curry or hot Idlis with coconut chutney & chai."),
        ("Day 2", "17th Sep", "11:00 AM", "Transit", "Check-out & Start Scenic Ride to Alleppey", "Chellanam Coastal Road / NH66", "Not Required", 200, "-", "-", "Ride along coast. Quick coconut water stop."),
        ("Day 2", "17th Sep", "02:00 PM - 03:00 PM", "Meal", "🍱 Day 2 Lunch: No.1 Kallu (Toddy) Shop Feast (30m - 1h)", "No.1 Kallu Shop, near Alleppey", "Walk-in", 800, "Toddy Shop Manager", "+919446665472", "Karimeen Pollichathu, spicy crab, duck roast, fresh sweet toddy."),
        ("Day 2", "17th Sep", "03:30 PM", "Stay", "Check-in at Pagoda Resort, Alleppey", "Pagoda Resort, Chungam, Alappuzha", "Action Required", 2500, "Pagoda Resort Reception", "+919895553421", "⚠️ Call to confirm booking. Transit POC (Senate): +91 89216 96499."),
        ("Day 2", "17th Sep", "05:15 PM", "Sightseeing", "Alleppey Beach, Old Pier & Lighthouse Sunset", "Alappuzha Beach", "Not Required", 50, "-", "-", "Sunset on old pier remnants, tea and snacks."),
        ("Day 2", "17th Sep", "08:00 PM - 09:00 PM", "Meal", "🍽 Day 2 Dinner Window (30m - 1h)", "Halais Restaurant / Thaff Alleppey", "Not Required", 650, "-", "-", "Al Faham chicken, butter naan, or seafood curry."),
        ("Day 2", "17th Sep", "11:30 PM - 05:30 AM", "Rest", "🌙 Rest & Sleep Window (6 Hours)", "Pagoda Resort Alleppey", "Not Required", 0, "-", "-", "Early sleep to catch 6:30 AM Kuttanad Shikara ride."),

        # Day 3
        ("Day 3", "18th Sep", "06:30 AM", "Activity", "Early Morning Shikara Ride in Kuttanad Canals", "Punnamada / Finish Point Jetty, Alleppey", "Action Required", 1500, "Shikara Operator", "+919809809822", "⚠️ Advance booking needed! 3 hours peaceful backwater village exploration."),
        ("Day 3", "18th Sep", "08:00 AM - 09:00 AM", "Meal", "🍳 Day 3 Breakfast Window (30m - 1h)", "Village Canal Tea Stall / Pagoda Resort", "Not Required", 250, "-", "-", "Hot Neyyappam, Pazham pori (banana fritters), and tea on canal side."),
        ("Day 3", "18th Sep", "11:30 AM", "Transit", "Check-out & Depart for Varkala (110 km)", "NH66 Highway towards Kollam", "Not Required", 350, "-", "-", "Highway ride with safety cushion. Alternative: Quick 1.5h Train from ALLP to VAK."),
        ("Day 3", "18th Sep", "02:00 PM - 03:00 PM", "Meal", "🍱 Day 3 Lunch Window (30m - 1h)", "Ramees Restaurant / Indian Coffee House, Kollam Bypass", "Not Required", 500, "-", "-", "Biryani or meals, hydrate with fresh lime soda."),
        ("Day 3", "18th Sep", "04:00 PM", "Stay", "Check-in at Ocean Breeze Resort, Varkala", "Ocean Breeze Resort, Varkala", "Action Required", 2200, "Ocean Breeze Reception", "+919037666030", "⚠️ Call to confirm room and scooter parking."),
        ("Day 3", "18th Sep", "05:15 PM", "Sightseeing", "Black Sand Beach & South Cliff Sunset", "Black Sand Beach & South Cliff", "Not Required", 0, "-", "-", "Volcanic black sand beach and panoramic cliff sunset."),
        ("Day 3", "18th Sep", "08:30 PM - 09:15 PM", "Meal", "🍽 Day 3 Dinner: North Cliff Cafe del Mar", "North Cliff, Varkala", "Not Required", 850, "-", "-", "Candlelight grilled catch of the day on cliff edge."),
        ("Day 3", "18th Sep", "12:00 AM - 06:00 AM", "Rest", "🌙 Rest & Sleep Window (6 Hours)", "Ocean Breeze Resort Varkala", "Not Required", 0, "-", "-", "Sound of ocean waves, solid rest before surfing & Kappil ride."),

        # Day 4
        ("Day 4", "19th Sep", "07:00 AM", "Activity", "Morning Surf / Papanasam Beach Holy Springs", "Papanasam Main Beach, Varkala", "Walk-in", 800, "Surf School (Walk-in)", "-", "Gentle morning waves, natural mineral springs cascading down red cliffs."),
        ("Day 4", "19th Sep", "08:00 AM - 09:00 AM", "Meal", "🍳 Day 4 Breakfast: InDa Cafe Sourdough & Bowls (30m - 1h)", "InDa Cafe, North Cliff", "Not Required", 550, "-", "-", "Dragonfruit smoothie bowl, sourdough toast, cold brew."),
        ("Day 4", "19th Sep", "02:00 PM", "Sightseeing", "Coastal Ride to Kappil Beach & Backwater Lake", "Kappil Beach Road (7km North)", "Not Required", 0, "-", "-", "Arabian Sea on left, backwater lake on right separated by narrow bridge."),
        ("Day 4", "19th Sep", "02:00 PM - 03:00 PM", "Meal", "🍱 Day 4 Lunch Window (30m - 1h)", "Kappil Sea Breeze / Odayam Beach Shack", "Not Required", 500, "-", "-", "Fresh fish curry meals by the seaside."),
        ("Day 4", "19th Sep", "05:45 PM", "Sightseeing", "South Cliff Sunset & Helipad Viewpoint", "South Cliff Helipad, Varkala", "Not Required", 0, "-", "-", "Quiet golden hour viewpoint."),
        ("Day 4", "19th Sep", "08:00 PM - 09:00 PM", "Meal", "🍽 Day 4 Dinner: Darjeeling Cafe Acoustic Night (30m - 1h)", "Darjeeling Cafe, North Cliff", "Not Required", 850, "-", "-", "Momos, pancakes, live acoustic music on cliff edge."),
        ("Day 4", "19th Sep", "11:30 PM - 05:30 AM", "Rest", "🌙 Rest & Sleep Window (6 Hours)", "Ocean Breeze Resort Varkala", "Not Required", 0, "-", "-", "Pack bags tonight for sharp 06:30 AM early morning return ride/train."),

        # Day 5
        ("Day 5", "20th Sep", "06:30 AM", "Transit", "Early Check-out & Depart Varkala", "Ocean Breeze Resort / Varkala Sivagiri Station", "Not Required", 0, "-", "-", "If taking Train option: Board Varkala to Ernakulam train (2.5 hrs). If Scooter: start early on NH-66."),
        ("Day 5", "20th Sep", "08:00 AM - 09:00 AM", "Meal", "🍳 Day 5 Highway Breakfast Window (30m - 1h)", "Indian Coffee House / Veg Highway Restaurant, NH66", "Not Required", 250, "-", "-", "Crispy ghee roast dosa, hot filter coffee."),
        ("Day 5", "20th Sep", "12:15 PM", "Rental", "Return Rented Scooter & Collect Security Deposit", "Scooter Drop Hub near Ernakulam Junction", "Action Required", 0, "Rental POC", "-", "Staff checks vehicle, return helmets, claim back ₹2,000 security deposit."),
        ("Day 5", "20th Sep", "01:00 PM - 02:00 PM", "Meal", "🍱 Day 5 Lunch Window (30m - 1h)", "Ernakulam Junction Station Area / Aryaas", "Not Required", 300, "-", "-", "Quick train-side lunch and pack snacks for Bengaluru journey."),
        ("Day 5", "20th Sep", "01:30 PM", "Transit", "Arrive at Ernakulam Junction (ERS) & Board Bengaluru Train", "Ernakulam Junction (ERS)", "Not Required", 0, "Train Helpdesk", "139", "🎯 Train departs at 02:00 PM sharp. 96-hour Kerala expedition complete!")
    ]

    for idx, act in enumerate(activities_all):
        ws_it.row_dimensions[r].height = 28
        row_bg = C_ROW_ALT if idx % 2 == 1 else C_ROW_WHITE
        
        cat_fg = "0F172A"
        if act[3] in ["Transit", "Rental"]:
            cat_fg = "0284C7"
        elif act[3] == "Meal":
            cat_fg = "059669"
        elif act[3] in ["Activity", "Sightseeing"]:
            cat_fg = "D97706"
        elif act[3] in ["Stay", "Rest"]:
            cat_fg = "6366F1"

        style_data_cell(ws_it.cell(row=r, column=1), act[0], bg=row_bg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=2), act[1], bg=row_bg, align="center")
        style_data_cell(ws_it.cell(row=r, column=3), act[2], bg=row_bg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=4), act[3], bg=row_bg, fg=cat_fg, bold=True, align="center")
        style_data_cell(ws_it.cell(row=r, column=5), act[4], bg=row_bg, bold=True)
        style_data_cell(ws_it.cell(row=r, column=6), act[5], bg=row_bg)
        style_data_cell(ws_it.cell(row=r, column=7), act[6], bg=row_bg, align="center", fg="E11D48" if act[6]=="Action Required" else "475569", bold=(act[6]=="Action Required"))
        style_data_cell(ws_it.cell(row=r, column=8), act[7], bg=row_bg, align="right", num_format="₹#,##0")
        style_data_cell(ws_it.cell(row=r, column=9), act[8], bg=row_bg)
        style_data_cell(ws_it.cell(row=r, column=10), act[9], bg=row_bg, align="center")
        style_data_cell(ws_it.cell(row=r, column=11), act[10], bg=row_bg)
        r += 1

    # Total row
    ws_it.row_dimensions[r].height = 28
    for c in range(1, 12):
        cell = ws_it.cell(row=r, column=c)
        cell.fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
        cell.border = header_border

    ws_it.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    tot_label = ws_it.cell(row=r, column=1, value="TOTAL ESTIMATED DIRECT ACTIVITIES & STAY EXPENSES:")
    tot_label.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_label.alignment = Alignment(horizontal="right", vertical="center")
    
    tot_val = ws_it.cell(row=r, column=8)
    tot_val.value = f"=SUM(H5:H{r-1})"
    tot_val.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_val.alignment = Alignment(horizontal="right", vertical="center")
    tot_val.number_format = "₹#,##0"

    auto_fit_columns(ws_it, max_cols=11)

    # =========================================================================
    # TAB 3: TRANSIT & ROUTE COMPARISON (SCOOTER vs TRAIN vs BUS)
    # =========================================================================
    ws_tr = wb.create_sheet(title="Transit Comparison")
    ws_tr.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_tr, "TRANSIT MODE & ROUTE ANALYSIS", "Compare Rented Scooter vs Local Trains (MEMU/Express) vs KSRTC Swift Buses across all 4 Route Legs", max_col=8)

    r = 4
    for c in range(1, 9):
        ws_tr.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_tr.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_tr = ws_tr.cell(row=r, column=1, value="🛵 TRANSIT MODES MACRO COMPARISON")
    sec_tr.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_tr.alignment = Alignment(horizontal="left", vertical="center")
    ws_tr.row_dimensions[r].height = 25
    r += 1

    mode_hdrs = ["Transit Mode", "Est. Total Cost (₹)", "Daily Rental (₹)", "Fuel Est. (₹)", "Refundable Deposit (₹)", "Total Travel Time", "Flexibility & Fatigue Factor", "Pros & Considerations"]
    ws_tr.row_dimensions[r].height = 24
    for c_idx, h_text in enumerate(mode_hdrs, start=1):
        style_header_cell(ws_tr.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    modes_data = [
        ("🛵 Rented Scooter", 4500, 500, 1100, 2000, "12.5 hrs", "Max Flexibility • High Fatigue (NH-66 roadworks)", "Pros: Door-to-door freedom, scenic Chellanam coastal route, visit Kappil lake bridge at sunset.\nCons: 5-hour exhausting return ride on Day 5, strict helmet enforcement, sun & rain exposure."),
        ("🚆 Train (MEMU / Express)", 800, 0, 0, 0, "5.5 hrs", "Station-to-Station • Low Fatigue (AC/Seating)", "Pros: Super fast (ERS to Varkala in 2.5 - 3h vs 5h road), cheap tickets, beat all highway traffic bottlenecks.\nCons: Fixed timetable schedules, need local autos or short-term rentals at Alleppey and Varkala."),
        ("🚌 KSRTC Swift / Super Fast", 1100, 0, 0, 0, "8.5 hrs", "High Frequency • Low-Moderate Fatigue", "Pros: Very frequent services from Ernakulam KSRTC Stand, AC Minnal & Swift options, budget friendly.\nCons: Stuck in same NH-66 diversions as scooters, drops at highway junctions.")
    ]

    for md in modes_data:
        ws_tr.row_dimensions[r].height = 45
        style_data_cell(ws_tr.cell(row=r, column=1), md[0], bold=True)
        style_data_cell(ws_tr.cell(row=r, column=2), md[1], align="right", num_format="₹#,##0")
        style_data_cell(ws_tr.cell(row=r, column=3), md[2], align="right", num_format="₹#,##0")
        style_data_cell(ws_tr.cell(row=r, column=4), md[3], align="right", num_format="₹#,##0")
        style_data_cell(ws_tr.cell(row=r, column=5), md[4], align="right", num_format="₹#,##0")
        style_data_cell(ws_tr.cell(row=r, column=6), md[5], align="center", bold=True)
        style_data_cell(ws_tr.cell(row=r, column=7), md[6])
        style_data_cell(ws_tr.cell(row=r, column=8), md[7])
        r += 1

    r += 1
    # Leg by Leg Section
    for c in range(1, 9):
        ws_tr.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_tr.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_leg = ws_tr.cell(row=r, column=1, value="📊 LEG-BY-LEG TRANSIT BREAKDOWN & HIGHWAY ROAD NOTES")
    sec_leg.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_leg.alignment = Alignment(horizontal="left", vertical="center")
    ws_tr.row_dimensions[r].height = 25
    r += 1

    ws_tr.row_dimensions[r].height = 24
    style_header_cell(ws_tr.cell(row=r, column=1), "Leg Name", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=2), "Distance", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=3), "🛵 Scooter Option", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=4), "🚆 Train Option", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=5), "🚌 KSRTC Bus Option", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=6), "Road Status & Strategic Recommendation", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=7), "", bg=C_ACCENT_SKY)
    style_header_cell(ws_tr.cell(row=r, column=8), "", bg=C_ACCENT_SKY)
    ws_tr.merge_cells(start_row=r, start_column=6, end_row=r, end_column=8)
    r += 1

    legs_data = [
        ("Leg 1: Ernakulam ➔ Kumbalangi", "15 km", "35 mins • ₹50 fuel • Scenic backwater bridge ride.", "N/A (No rail station in Kumbalangi village; use auto from ERS).", "45 mins • ₹20 (Local bus from Menaka / Thoppumpady).", "City traffic in MG Road/Menaka. Easy short ride once over Thoppumpady bridge."),
        ("Leg 2: Kumbalangi ➔ Alleppey", "65 km", "2 hrs 15 mins • ₹200 fuel • Chellanam-Marari coastal route.", "1 hr 10 mins • ₹40 (Train ERS to ALLP). Super fast & chill.", "2 hrs • ₹80 (KSRTC Fast Passenger via NH-66).", "Avoid NH-66 highway dust by taking coastal road through Chellanam & Mararikulam."),
        ("Leg 3: Alleppey ➔ Varkala Cliff", "110 km", "3 hrs 30 mins (+45m buffer) • ₹350 fuel • Active NH-66 widening.", "1 hr 45 mins • ₹65 (Direct Train ALLP ➔ VAK). Beat fatigue!", "3 hrs 15 mins • ₹140 (KSRTC Super Fast to Kallambalam + auto).", "Heavy flyover construction and diversions near Haripad & Kollam. Keep helmet visors down."),
        ("Leg 4: Varkala ➔ Ernakulam Return", "185 km", "4 hrs 45 mins (+45m buffer) • ₹600 fuel • Exhausting, depart 6:45 AM!", "2 hrs 45 mins • ₹110 (Jan Shatabdi / Express / Vande Bharat).", "4 hrs 30 mins • ₹220 (KSRTC Swift AC / Super Deluxe).", "Crucial bottleneck at Cherthala/Aroor. If on scooter, leave by 06:45 AM sharp to guarantee 02:00 PM Bengaluru train connection.")
    ]

    for ld in legs_data:
        ws_tr.row_dimensions[r].height = 42
        style_data_cell(ws_tr.cell(row=r, column=1), ld[0], bold=True)
        style_data_cell(ws_tr.cell(row=r, column=2), ld[1], align="center")
        style_data_cell(ws_tr.cell(row=r, column=3), ld[2])
        style_data_cell(ws_tr.cell(row=r, column=4), ld[3])
        style_data_cell(ws_tr.cell(row=r, column=5), ld[4])
        style_data_cell(ws_tr.cell(row=r, column=6), ld[5])
        style_data_cell(ws_tr.cell(row=r, column=7), "")
        style_data_cell(ws_tr.cell(row=r, column=8), "")
        ws_tr.merge_cells(start_row=r, start_column=6, end_row=r, end_column=8)
        r += 1

    auto_fit_columns(ws_tr, max_cols=8)

    # =========================================================================
    # TAB 4: ACCOMMODATIONS & CONTACTS (POC DIRECTORY)
    # =========================================================================
    ws_ct = wb.create_sheet(title="Stays & Contacts Directory")
    ws_ct.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ct, "ACCOMMODATIONS & KEY CONTACTS DIRECTORY", "Points of Contact, Direct Phone Numbers, Booking Status, Price Estimates & Guidance", max_col=8)

    r = 4
    ct_hdrs = ["Category", "Name / Property", "Point of Contact (POC)", "Phone Number", "Booking Status", "Advance Needed?", "Estimated Price", "Operational Notes & Tips"]
    ws_ct.row_dimensions[r].height = 26
    for c_idx, h_text in enumerate(ct_hdrs, start=1):
        style_header_cell(ws_ct.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    contacts_data = [
        ("Stay", "Zostel Kochi (Kumbalangi)", "Zostel Front Desk", "+918921696499", "Not Booked", "Yes (Online/Call)", "₹799 (Dorm) / ₹2,400 (Private)", "Book online or call for 16th night stay. Quiet backwater village location."),
        ("Stay", "Pagoda Resort (Alleppey)", "Pagoda Resort Reception", "+919895553421", "Not Booked", "Yes (Advance)", "₹2,200 - ₹2,800 / night", "Inquire availability for 17th night. Check secure scooter parking on premises."),
        ("Stay", "Ocean Breeze Resort (Varkala)", "Ocean Breeze Reception", "+919037666030", "Not Booked", "Yes (Advance)", "₹1,800 - ₹2,500 / night", "Inquire for 18th & 19th nights (2 nights). Located near cliff walk."),
        ("Activity", "Marine Drive Sunset Cruise (Minar Cruise)", "Capt. Abirag Ambas", "+918075264663", "Not Booked", "Yes (Call 1-2 days prior)", "₹400 - ₹600 / person", "Call ahead to book upper deck slot for 5:45 PM sunset cruise."),
        ("Activity", "Alleppey Backwater Shikara Ride", "Shikara Operator", "+919809809822", "Not Booked", "Yes (Advance)", "₹600 - ₹800 / hour (3 hrs rec.)", "Confirm 6:30 AM early morning slot to explore peaceful narrow village canals."),
        ("Activity", "Kumbalangi Mangrove Kayaking", "Kayak Guide", "+919074717022", "Not Booked", "Yes (Prior Evening)", "₹400 - ₹500 / person", "Call previous evening to confirm tide timings and sunrise guide."),
        ("Food", "No.1 Kallu (Toddy) Shop", "Toddy Shop Manager", "+919446665472", "Walk-in", "No (Call ahead)", "₹600 - ₹900 for 2", "Call ahead on Day 2 to check fresh specialty Karimeen & Crab availability."),
        ("Transit", "Kochi-Alleppey Transit Coordinator", "Senate", "+918921696499", "Active Contact", "No", "N/A", "Point of contact for route advice, vehicle queries & transit coordination."),
        ("Transit", "Indian Railways Ernakulam Enquiry", "ERS Station Helpdesk", "139", "Active Contact", "No", "Toll Free", "Train PNR enquiry, platform status, and Platform 1 cloakroom status.")
    ]

    for cd in contacts_data:
        ws_ct.row_dimensions[r].height = 28
        style_data_cell(ws_ct.cell(row=r, column=1), cd[0], bold=True, align="center")
        style_data_cell(ws_ct.cell(row=r, column=2), cd[1], bold=True)
        style_data_cell(ws_ct.cell(row=r, column=3), cd[2])
        style_data_cell(ws_ct.cell(row=r, column=4), cd[3], align="center", bold=True)
        style_data_cell(ws_ct.cell(row=r, column=5), cd[4], align="center", fg="E11D48" if cd[4]=="Not Booked" else "059669")
        style_data_cell(ws_ct.cell(row=r, column=6), cd[5], align="center")
        style_data_cell(ws_ct.cell(row=r, column=7), cd[6], align="right")
        style_data_cell(ws_ct.cell(row=r, column=8), cd[7])
        r += 1

    auto_fit_columns(ws_ct, max_cols=8)

    # =========================================================================
    # TAB 5: CURATED RECOMMENDATIONS & OFF-BEAT GEMS (20+ SPOTS)
    # =========================================================================
    ws_rec = wb.create_sheet(title="Curated Recommendations")
    ws_rec.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_rec, "CURATED RECOMMENDATIONS & OFF-BEAT GEMS", "20+ Handpicked Sights, Hidden Waterfronts, Toddy Shops, Heritage Cafés & Beach Viewpoints", max_col=9)

    r = 4
    rec_hdrs = ["Region", "Spot Name", "Category", "Type", "Rating", "Best Time", "Approx Cost", "Must-Try / Key Highlights", "Insider Tips & Guidance"]
    ws_rec.row_dimensions[r].height = 26
    for c_idx, h_text in enumerate(rec_hdrs, start=1):
        style_header_cell(ws_rec.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    recs_data = [
        # Fort Kochi & Mattancherry
        ("Fort Kochi", "Kashi Art Café", "Café & Chill", "Classic", "4.6 ★", "03:30 PM - 05:30 PM", "₹400 for 2", "Cold brew coffee, Chocolate cake, Spinach mushroom toast", "Gets crowded around 4 PM; great spot to escape afternoon heat."),
        ("Fort Kochi", "Pepper House Courtyard & Waterfront", "Off-Beat Sights", "Off-Beat ⭐", "4.8 ★", "04:00 PM - 06:00 PM", "Free Entry (₹350 cafe)", "Waterfront lemon mint tea, Dutch architectural walk, Artisan bakery", "Much quieter than Princess Street. Watch huge cargo ships glide by across harbor channel."),
        ("Mattancherry", "Ginger House Museum Restaurant", "Off-Beat Food", "Off-Beat ⭐", "4.5 ★", "03:00 PM - 05:00 PM", "₹700 for 2", "Ginger tea, Fish molly with appam, Homemade ginger ice cream", "India's only museum restaurant; dine next to a 105ft snake boat. Enter via Jew Town antique showroom."),
        ("Kochi Islands", "Kuzhupilly Beach & Backwater Lagoon", "Off-Beat Sights", "Off-Beat ⭐", "4.7 ★", "05:00 PM - 06:30 PM", "Free", "Prawn farm country roads, Kite flying, Golden hour sunset", "Ride across Goshree bridges from Marine Drive. Road cutting through shrimp fields is cinematic."),
        ("Fort Kochi", "Loafer's Corner Cafe", "Café & Chill", "Classic", "4.5 ★", "02:00 PM - 05:00 PM", "₹450 for 2", "Ginger lime soda, Pasta, Banoffee pie", "Sit on the 1st floor window ledge overlooking Princess Street for great people watching."),
        ("Mattancherry", "Kayees Rahmathulla Hotel", "Food & Heritage", "Classic", "4.4 ★", "12:30 PM - 02:00 PM", "₹500 for 2", "Malabar Mutton Dum Biryani (Kaima rice), Fish Fry, Sulaimani", "World famous mutton biryani sells out by 02:00 PM sharp!"),
        
        # Kumbalangi & Chellanam
        ("Kumbalangi", "Chellanam Seawall & Harbour Pier", "Off-Beat Sights", "Off-Beat ⭐", "4.6 ★", "05:15 PM - 06:15 PM", "Free", "Fried sardines at beach stalls, Sunset seawall walk", "Giant tetrapod seawall where Arabian sea waves crash. Take coastal road to Alleppey."),

        # Alleppey & Kuttanad
        ("Alleppey", "Kainakary Chithira Toddy Shop", "Off-Beat Food", "Off-Beat ⭐", "4.9 ★", "01:00 PM - 03:00 PM", "₹650 for 2", "Kuttanadan Duck Roast, Pearl Spot (Karimeen) Fry, Tapioca (Kappa)", "Accessible only by boat or narrow village motorcycle bunds below sea level. Ask Shikara to moor here."),
        ("Alleppey", "Pathiramanal Island (Sands of Midnight)", "Off-Beat Sights", "Off-Beat ⭐", "4.7 ★", "07:00 AM - 09:30 AM", "₹600 boat hire", "Bamboo walkway through wild island forest, 90+ rare bird species", "10-acre uninhabited emerald island in Vembanad Lake. Combine with morning Shikara."),
        ("Alleppey", "Thottappally Spillway & Casuarina Forest", "Off-Beat Sights", "Off-Beat ⭐", "4.6 ★", "04:30 PM - 06:00 PM", "Free", "Pine forest scooter photography, Bridge view of ocean merger", "Where Kuttanad fresh backwaters meet Arabian Sea. Great stop on ride from Alleppey to Varkala."),
        ("Alleppey", "Marari Beach (Mararikulam)", "Sunset & Views", "Classic", "4.7 ★", "05:00 PM - 06:30 PM", "Free", "Sunset walk, Tender coconut, Fresh fruit platters", "Clean coconut-fringed white sand beach 14km north of Alleppey. Far less crowded than town beach."),

        # Munroe Island & Kollam
        ("Kollam / Munroe", "Munroe Island Mangrove Canoe Canals", "Off-Beat Sights", "Off-Beat ⭐", "4.9 ★", "06:30 AM - 08:30 AM", "₹800 (2h canoe)", "Hand-paddled sunrise canoe ride, Mangrove arch tunnels, Coir retting", "Archipelago of 8 hidden islands. Far more intimate and peaceful than Alleppey's big houseboat channels."),

        # Varkala & Kappil
        ("Varkala", "Nedunganda Pine Forest Beach & Cliff", "Off-Beat Sights", "Off-Beat ⭐", "4.8 ★", "03:30 PM - 05:30 PM", "Free", "Hammock chilling between pine trees, Secluded beach walk", "Dense Australian pine forest growing right up to the emerald sea edge north of Odayam. Zero shops; total solitude."),
        ("Varkala Coast", "Ponnumthuruthu (Golden Island) Temple", "Off-Beat Sights", "Off-Beat ⭐", "4.7 ★", "06:00 AM - 09:00 AM", "₹100 ferry", "Traditional wooden ferry crossing, 100-yr Shiva temple in lake", "Isolated island in Anjengo backwaters. Coincide with evening deeparadhana temple oil lamps."),
        ("Varkala Coast", "Anchuthengu (Anjengo) Fort & Lighthouse", "Off-Beat Heritage", "Off-Beat ⭐", "4.5 ★", "03:00 PM - 05:00 PM", "₹50 for 2", "130-foot lighthouse spiral climb, 1695 East India Co. fort ramparts", "Lighthouse closes at 5:00 PM sharp. 360° views of coconut canopy and Arabian Sea."),
        ("Varkala", "Chilakoor Beach & Red Laterite Headland", "Off-Beat Sights", "Off-Beat ⭐", "4.7 ★", "05:30 PM - 06:30 PM", "Free", "Sunset meditation, Coastal scooter cruise, Red laterite formations", "Tranquil coastal road past South Cliff without commercial cafe music."),
        ("Varkala", "Darjeeling Cafe (North Cliff)", "Café & Chill", "Classic", "4.6 ★", "05:00 PM - 10:30 PM", "₹650 for 2", "Momos, Shakshuka, Nutella pancakes, Live acoustic music", "Iconic cliff-edge bohemian seating. Grab front-row mattress by 5:15 PM for sunset."),
        ("Varkala", "InDa Cafe & Boutique", "Café & Chill", "Classic", "4.7 ★", "08:30 AM - 03:00 PM", "₹600 for 2", "Avocado sourdough toast, Dragon fruit smoothie bowl, Cold drip", "Peaceful bamboo garden cafe set back from cliff noise. Fast Wi-Fi & phone charging."),
        ("Varkala", "Kappil Beach & Edava Nadayara Backwaters", "Sunset & Views", "Classic", "4.8 ★", "04:30 PM - 06:15 PM", "Free", "Sea-lake bridge viewpoint, Golden hour scooter photospot", "Narrow bridge where backwaters meet Arabian Sea. 15 mins north of Varkala cliff.")
    ]

    for rd in recs_data:
        ws_rec.row_dimensions[r].height = 30
        style_data_cell(ws_rec.cell(row=r, column=1), rd[0], bold=True, align="center")
        style_data_cell(ws_rec.cell(row=r, column=2), rd[1], bold=True)
        style_data_cell(ws_rec.cell(row=r, column=3), rd[2], align="center")
        style_data_cell(ws_rec.cell(row=r, column=4), rd[3], align="center", fg=C_ACCENT_EMERALD if "Off-Beat" in rd[3] else "475569", bold=("Off-Beat" in rd[3]))
        style_data_cell(ws_rec.cell(row=r, column=5), rd[4], align="center", bold=True)
        style_data_cell(ws_rec.cell(row=r, column=6), rd[5], align="center")
        style_data_cell(ws_rec.cell(row=r, column=7), rd[6], align="right")
        style_data_cell(ws_rec.cell(row=r, column=8), rd[7])
        style_data_cell(ws_rec.cell(row=r, column=9), rd[8])
        r += 1

    auto_fit_columns(ws_rec, max_cols=9)

    # =========================================================================
    # TAB 6: EXPENSES & BUDGET SPLITTER
    # =========================================================================
    ws_ex = wb.create_sheet(title="Budget & Expenses")
    ws_ex.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ex, "BUDGET ESTIMATION & EXPENSE SPLITTER", "Itemized Budget Categories, Active Paid Log, 2-Rider Split Calculation & Settlement", max_col=8)

    r = 4
    for c in range(1, 9):
        ws_ex.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_b = ws_ex.cell(row=r, column=1, value="💰 MACRO ESTIMATED BUDGET BREAKDOWN (2 RIDERS)")
    sec_b.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_b.alignment = Alignment(horizontal="left", vertical="center")
    ws_ex.row_dimensions[r].height = 25
    r += 1

    ws_ex.row_dimensions[r].height = 24
    style_header_cell(ws_ex.cell(row=r, column=1), "Budget Category", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=2), "Details & Inclusions", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=3), "", bg=C_HEADER_BG)
    ws_ex.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    style_header_cell(ws_ex.cell(row=r, column=4), "Est. Total Cost (₹)", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=5), "Cost Per Person (₹)", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=6), "Notes & Payment Terms", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=7), "", bg=C_HEADER_BG)
    style_header_cell(ws_ex.cell(row=r, column=8), "", bg=C_HEADER_BG)
    ws_ex.merge_cells(start_row=r, start_column=6, end_row=r, end_column=8)
    r += 1

    budget_items = [
        ("Train Transit (Bengaluru ⇄ ERS)", "Outbound & Inbound Train Tickets (2 Riders)", 2800, "=D6/2", "IRCTC Sleeper / 3AC bookings"),
        ("Scooter Rental", "4-5 Days Scooter Rental (₹500/day)", 2500, "=D7/2", "Paid to Ernakulam rental vendor"),
        ("Fuel (Petrol)", "~360 km + local exploring @ 40 km/l", 1100, "=D8/2", "Fuel up at BPCL / IndianOil pumps"),
        ("Accommodations (4 Nights)", "Zostel Kumbalangi (1N), Pagoda Alleppey (1N), Ocean Breeze Varkala (2N)", 6300, "=D9/2", "Split equally between 2 riders"),
        ("Key Activities", "Minar Sunset Cruise, Kumbalangi Kayaking, Alleppey Shikara, Surfing", 3600, "=D10/2", "Direct operator payments"),
        ("Food & Daily Meals", "Breakfasts, Lunches (Toddy shops/cafes), Dinners (30m-1h slots)", 5500, "=D11/2", "Local authentic seafood & cafes"),
        ("Refundable Security Deposit", "Scooter Security Deposit (Returned on Day 5)", 2000, 2000, "Paid by Me, 100% refunded on Day 5")
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
        style_data_cell(ws_ex.cell(row=r, column=6), bi[4])
        style_data_cell(ws_ex.cell(row=r, column=7), "")
        style_data_cell(ws_ex.cell(row=r, column=8), "")
        ws_ex.merge_cells(start_row=r, start_column=6, end_row=r, end_column=8)
        r += 1

    # Budget Total Row
    ws_ex.row_dimensions[r].height = 26
    for c in range(1, 9):
        cell = ws_ex.cell(row=r, column=c)
        cell.fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
        cell.border = header_border

    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    tot_lbl = ws_ex.cell(row=r, column=1, value="ESTIMATED TOTAL EXPEDITION BUDGET (EXCL. DEPOSIT):")
    tot_lbl.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    tot_lbl.alignment = Alignment(horizontal="right", vertical="center")
    
    b_tot_cell = ws_ex.cell(row=r, column=4, value=f"=SUM(D{start_b_row}:D{r-2})")
    b_tot_cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    b_tot_cell.number_format = "₹#,##0"
    b_tot_cell.alignment = Alignment(horizontal="right", vertical="center")

    b_per_cell = ws_ex.cell(row=r, column=5, value=f"=D{r}/2")
    b_per_cell.font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    b_per_cell.number_format = "₹#,##0"
    b_per_cell.alignment = Alignment(horizontal="right", vertical="center")
    r += 2

    # Active Logged Expenses & Split
    for c in range(1, 9):
        ws_ex.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ex.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
    sec_l = ws_ex.cell(row=r, column=1, value="🧾 ACTIVE LOGGED EXPENSE LEDGER & SPLITWISE MATH")
    sec_l.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_l.alignment = Alignment(horizontal="left", vertical="center")
    ws_ex.row_dimensions[r].height = 25
    r += 1

    e_hdrs = ["Date", "Expense Title", "Category", "Paid By", "Split With", "Amount (₹)", "My Share (₹)", "Partner Share (₹)"]
    ws_ex.row_dimensions[r].height = 24
    for c_idx, h_text in enumerate(e_hdrs, start=1):
        style_header_cell(ws_ex.cell(row=r, column=c_idx), h_text, bg=C_HEADER_BG)
    r += 1

    logged_expenses = [
        ("16th Sep", "Bengaluru -> Kochi Train Tickets (2 Riders)", "Transit", "Me", "Me, Riding Partner", 1400, f"=F{r}/2", f"=F{r}/2"),
        ("16th Sep", "Scooter Rental Advance / Booking", "Rental", "Me", "Me, Riding Partner", 1000, f"=F{r+1}/2", f"=F{r+1}/2"),
        ("16th Sep", "Scooter Refundable Security Deposit", "Deposit", "Me", "Me (Refundable)", 2000, f"=F{r+2}", 0)
    ]

    start_e_row = r
    for le in logged_expenses:
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
    tot_log_lbl = ws_ex.cell(row=r, column=1, value="TOTAL LOGGED SPEND TO DATE:")
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
    # TAB 7: CHECKLIST & KERALA TRAVEL GUIDELINES
    # =========================================================================
    ws_ck = wb.create_sheet(title="Checklist & Safety")
    ws_ck.views.sheetView[0].showGridLines = True
    apply_title_banner(ws_ck, "TRIP PACKING CHECKLIST & KERALA SAFETY GUIDELINES", "Essential Documents, Riding Gear, AI Camera Traffic Rules, Hydration & Highway Precautions", max_col=6)

    r = 4
    for c in range(1, 7):
        ws_ck.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ck.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    sec_ck = ws_ck.cell(row=r, column=1, value="🎒 PRE-TRIP PACKING & READINESS CHECKLIST")
    sec_ck.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_ck.alignment = Alignment(horizontal="left", vertical="center")
    ws_ck.row_dimensions[r].height = 25
    r += 1

    ws_ck.row_dimensions[r].height = 24
    style_header_cell(ws_ck.cell(row=r, column=1), "Category", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=2), "Checklist Item Description", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=3), "", bg=C_HEADER_BG)
    ws_ck.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    style_header_cell(ws_ck.cell(row=r, column=4), "Status", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=5), "Priority", bg=C_HEADER_BG)
    style_header_cell(ws_ck.cell(row=r, column=6), "Guidance & Importance", bg=C_HEADER_BG)
    r += 1

    checklist_data = [
        ("Documents", "Bengaluru Train Tickets & IRCTC e-Ticket downloaded", "✅ Done", "High", "Keep offline PDF accessible on phone without mobile network."),
        ("Documents", "Physical Driver's License & DigiLocker copy", "✅ Done", "High", "Mandatory for vehicle rental vendor and Kerala MVD checks."),
        ("Safety", "Two ISI certified Helmets (Rider & Pillion)", "⏳ Pending", "Critical", "Mandatory in Kerala! AI traffic surveillance cameras issue auto-fines for unstrapped/missing helmets."),
        ("Navigation", "Download Offline Google Maps (Kochi, Alleppey, Varkala)", "✅ Done", "High", "Vital for coastal and village canal bunds where mobile signal can drop."),
        ("Gear", "Waterproof pouch for Phone / Scooter mount", "⏳ Pending", "High", "Protects against sudden coastal rain bursts and allows handlebar navigation."),
        ("Gear", "Lightweight Rain Poncho / Windcheater", "⏳ Pending", "Medium", "Essential for sudden monsoon showers while riding on NH-66."),
        ("Bookings", "Call Minar Cruise & Shikara Operator to confirm slots", "⏳ Pending", "High", "Book sunset Minar slot (5:45 PM) and morning Kuttanad Shikara (6:30 AM)."),
        ("Bookings", "Call Pagoda & Ocean Breeze Resorts to lock rooms", "⏳ Pending", "High", "Confirm 17th night Alleppey and 18-19th nights Varkala room availability."),
        ("Gear", "Powerbank (20,000 mAh) + fast charging cables", "⏳ Pending", "High", "Keep phones charged during long navigation rides and video recording.")
    ]

    for ckd in checklist_data:
        ws_ck.row_dimensions[r].height = 24
        style_data_cell(ws_ck.cell(row=r, column=1), ckd[0], bold=True, align="center")
        style_data_cell(ws_ck.cell(row=r, column=2), ckd[1], bold=True)
        style_data_cell(ws_ck.cell(row=r, column=3), "")
        ws_ck.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        style_data_cell(ws_ck.cell(row=r, column=4), ckd[2], align="center", fg=C_ACCENT_EMERALD if "Done" in ckd[2] else C_ACCENT_AMBER, bold=True)
        style_data_cell(ws_ck.cell(row=r, column=5), ckd[3], align="center", fg=C_ACCENT_ROSE if ckd[3]=="Critical" else "0F172A", bold=(ckd[3]=="Critical"))
        style_data_cell(ws_ck.cell(row=r, column=6), ckd[4])
        r += 1

    r += 1
    # Kerala Specific Road Rules & Guidelines
    for c in range(1, 7):
        ws_ck.cell(row=r, column=c).fill = PatternFill(start_color=C_SECTION_BG, end_color=C_SECTION_BG, fill_type="solid")
    ws_ck.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    sec_sf = ws_ck.cell(row=r, column=1, value="🛡 KERALA ROAD SAFETY & EXPEDITION GUIDELINES")
    sec_sf.font = Font(name=FONT_FAMILY, size=12, bold=True, color=C_SECTION_FG)
    sec_sf.alignment = Alignment(horizontal="left", vertical="center")
    ws_ck.row_dimensions[r].height = 25
    r += 1

    safety_rules = [
        ("AI Traffic Surveillance", "Over 700+ AI-enabled cameras operate across Kerala highways. Both rider & pillion MUST wear strapped ISI helmets. Speed limits are strictly monitored."),
        ("NH-66 Roadwork & Dust", "Major 6-lane widening work is active between Haripad, Kayamkulam, and Kollam. Expect gravel diversions, sudden lane shifts, and heavy dust. Keep helmet visors down."),
        ("Hydration & Sun Protection", "Coastal Kerala is extremely humid. Hydrate every 90 minutes with tender coconut water or fresh lime soda. Use high SPF sunscreen."),
        ("Day 5 Critical Train Return", "The return train departs ERS at 02:00 PM sharp. You MUST depart Varkala by 06:45 AM if riding scooter to absorb Aroor/Cherthala bottlenecks and return the vehicle by 12:15 PM."),
        ("Alternative Train Safety Valve", "If fatigue is high on Day 3 or Day 5, take the local express/MEMU train (ALLP ➔ VAK takes only 1h 45m vs 3.5h road; VAK ➔ ERS takes 2h 45m vs 5h road).")
    ]

    for sr in safety_rules:
        ws_ck.row_dimensions[r].height = 28
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
