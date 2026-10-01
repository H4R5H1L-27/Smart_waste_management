"""Seed VIT Chennai campus bins and model foot-traffic fill levels."""

from __future__ import annotations

import random
from datetime import datetime, timezone

from db import (
    get_bin,
    list_bins,
    seed_history_and_analytics,
    update_collection_time,
    update_fill,
    upsert_bin,
    utcnow,
)

# Greater Chennai Corporation (GCC) Central Logistics & Transfer Depot — Guindy
DEPOT = {
    "lat": 13.0103,
    "lng": 80.2155,
    "name": "Greater Chennai Corporation (GCC) Central Logistics Depot, Guindy",
}

# 158 Major City-Wide Bins across Greater Chennai Corporation (15 Zones & High-Demand Commercial Hubs)
SEED_BINS = [
    # --- 1. T. Nagar Commercial & Retail Corridor (High Waste / High Foot Traffic) ---
    ("tn-pondy", "T. Nagar · Pondy Bazaar Pedestrian Plaza", 13.0416, 80.2337, False, 88.0, "high"),
    ("tn-rang1", "T. Nagar · Ranganathan Street North", 13.0401, 80.2285, False, 94.0, "high"),
    ("tn-rang2", "T. Nagar · Ranganathan St / Mambalam Station", 13.0378, 80.2268, False, 91.0, "high"),
    ("tn-panagal", "T. Nagar · Panagal Park East Bus Bay", 13.0435, 80.2320, False, 76.0, "high"),
    ("tn-usman1", "T. Nagar · South Usman Road Flyover Corner", 13.0360, 80.2295, False, 82.0, "high"),
    ("tn-usman2", "T. Nagar · North Usman Road Commercial Hub", 13.0455, 80.2355, False, 64.0, "medium"),
    ("tn-bus", "T. Nagar · Central Bus Terminus Concourse", 13.0422, 80.2290, False, 85.0, "high"),
    ("tn-natesan", "T. Nagar · Natesan Park Sports Walkway", 13.0408, 80.2392, False, 42.0, "medium"),
    ("tn-gnchetty", "T. Nagar · G.N. Chetty Road Junction", 13.0465, 80.2420, False, 55.0, "medium"),
    ("tn-venkat", "T. Nagar · Venkatanarayana Road Temple Gate", 13.0385, 80.2360, False, 68.0, "medium"),

    # --- 2. Koyambedu Wholesale Market & Intermodal Transit (Highest Organic Waste Demand) ---
    ("kym-flower", "Koyambedu · Wholesale Flower Market Gate 3", 13.0695, 80.1915, False, 96.0, "high"),
    ("kym-veg1", "Koyambedu · Wholesale Vegetable Market Block A", 13.0680, 80.1930, False, 92.0, "high"),
    ("kym-veg2", "Koyambedu · Wholesale Vegetable Market Block C", 13.0672, 80.1945, False, 89.0, "high"),
    ("kym-fruit", "Koyambedu · Wholesale Fruit Market North Bay", 13.0705, 80.1925, False, 93.0, "high"),
    ("kym-cmbt1", "Koyambedu · CMBT Bus Terminus Bay 1-3", 13.0675, 80.2055, False, 86.0, "high"),
    ("kym-cmbt2", "Koyambedu · CMBT Metro Intermodal Hub", 13.0690, 80.2070, False, 74.0, "high"),
    ("kym-outer", "Koyambedu · Outer Ring Road Cargo Terminal", 13.0650, 80.1880, False, 68.0, "medium"),
    ("kym-grain", "Koyambedu · Foodgrains Market Wholesale Yard", 13.0660, 80.1960, False, 61.0, "medium"),

    # --- 3. Marina Beach & Triplicane / Royapettah Corridor ---
    ("mar-prom1", "Marina Beach · Kamarajar Salai Promenade North", 13.0560, 80.2830, False, 91.0, "high"),
    ("mar-prom2", "Marina Beach · Kamarajar Salai Promenade South", 13.0480, 80.2810, False, 88.0, "high"),
    ("mar-light", "Marina Beach · Lighthouse & Seafood Market", 13.0395, 80.2790, False, 93.0, "high"),
    ("mar-anna", "Marina Beach · Anna Memorial Beach Plaza", 13.0645, 80.2845, False, 82.0, "high"),
    ("mar-swim", "Marina Beach · Marina Swimming Pool Plaza", 13.0605, 80.2835, False, 75.0, "high"),
    ("trip-pycrofts", "Triplicane · Pycrofts Road Market", 13.0565, 80.2730, False, 79.0, "high"),
    ("trip-temple", "Triplicane · Parthasarathy Temple Car Street", 13.0540, 80.2770, False, 65.0, "medium"),
    ("trip-high", "Triplicane · Triplicane High Road Bazaar", 13.0585, 80.2710, False, 74.0, "high"),
    ("roy-express", "Royapettah · Express Avenue Mall Gate 1", 13.0590, 80.2635, False, 72.0, "high"),
    ("roy-clock", "Royapettah · High Road Clock Tower Junction", 13.0505, 80.2640, False, 61.0, "medium"),
    ("roy-hosp", "Royapettah · Government Hospital Emergency Gate", 13.0530, 80.2615, False, 83.0, "high"),

    # --- 4. Mylapore & Alwarpet Cultural / Market Zone ---
    ("myl-kapali", "Mylapore · Kapaleeshwarar Temple North Mada St", 13.0335, 80.2695, False, 85.0, "high"),
    ("myl-south", "Mylapore · South Mada Street Flower Walkway", 13.0315, 80.2685, False, 87.0, "high"),
    ("myl-luz", "Mylapore · Luz Corner Junction & Market", 13.0360, 80.2630, False, 81.0, "high"),
    ("myl-kutcheri", "Mylapore · Kutchery Road Commercial Bazaar", 13.0345, 80.2740, False, 67.0, "medium"),
    ("myl-tank", "Mylapore · Chitrakulam Tank West Bank", 13.0325, 80.2720, False, 58.0, "medium"),
    ("alw-ttk", "Alwarpet · TTK Road & Chamiers Junction", 13.0310, 80.2520, False, 52.0, "medium"),
    ("alw-eldams", "Alwarpet · Eldams Road Commercial Walkway", 13.0390, 80.2510, False, 48.0, "medium"),
    ("alw-music", "Alwarpet · Music Academy Flyover Intersection", 13.0440, 80.2560, False, 63.0, "medium"),

    # --- 5. George Town, Parrys Corner & Central Railway Terminus ---
    ("cntrl-mgr", "Central · MGR Central Railway Station Front Concourse", 13.0825, 80.2755, False, 95.0, "high"),
    ("cntrl-ripon", "Central · GCC Ripon Building Perimeter", 13.0810, 80.2730, False, 35.0, "low"),
    ("cntrl-sub", "Central · Park Town Suburban Station Subway", 13.0795, 80.2760, False, 84.0, "high"),
    ("cntrl-egm", "Egmore · Railway Station Gandhi Irwin Concourse", 13.0785, 80.2610, False, 83.0, "high"),
    ("egm-museum", "Egmore · Government Museum Pantheon Road", 13.0690, 80.2560, False, 44.0, "medium"),
    ("par-broadway", "Parrys · Broadway Bus Terminus & NSC Bose Rd", 13.0880, 80.2870, False, 92.0, "high"),
    ("par-flower", "Parrys · Flower Bazaar & Badrian Street", 13.0895, 80.2850, False, 94.0, "high"),
    ("par-court", "Parrys · Madras High Court Gate 4", 13.0870, 80.2885, False, 58.0, "medium"),
    ("par-kasimedu", "Kasimedu · Fishing Harbour Main Auction Bay", 13.1160, 80.2970, False, 96.0, "high"),
    ("par-port", "Parrys · Chennai Port Gate Rajaji Salai", 13.0950, 80.2930, False, 62.0, "medium"),
    ("par-mint", "George Town · Mint Street Wholesale Gold Market", 13.0920, 80.2790, False, 89.0, "high"),
    ("par-sowcarpet", "Sowcarpet · Govindappa Naicken St Bazaar", 13.0945, 80.2810, False, 91.0, "high"),

    # --- 6. Anna Nagar & Kilpauk Urban Core ---
    ("an-roundtana", "Anna Nagar · Roundtana Central Intersection", 13.0850, 80.2150, False, 84.0, "high"),
    ("an-shanthi", "Anna Nagar · Shanthi Colony Food Street", 13.0885, 80.2085, False, 89.0, "high"),
    ("an-tower", "Anna Nagar · Tower Park Main Gate", 13.0875, 80.2190, False, 56.0, "medium"),
    ("an-2ndave", "Anna Nagar · 2nd Avenue Commercial Arcade", 13.0830, 80.2120, False, 63.0, "medium"),
    ("an-west", "Anna Nagar · West Depot & Bus Terminus", 13.0905, 80.1980, False, 71.0, "medium"),
    ("an-east", "Anna Nagar · East Metro Station Concourse", 13.0845, 80.2220, False, 66.0, "medium"),
    ("kil-med", "Kilpauk · Medical College Hospital Entrance", 13.0780, 80.2430, False, 78.0, "high"),
    ("kil-water", "Kilpauk · Water Works Garden Walkway", 13.0835, 80.2370, False, 38.0, "low"),
    ("kil-kelly", "Kilpauk · Kellys Corner & Taylors Road", 13.0815, 80.2470, False, 57.0, "medium"),

    # --- 7. Nungambakkam & Mount Road (Anna Salai) Corridor ---
    ("nung-knk", "Nungambakkam · Khader Nawaz Khan Road High St", 13.0615, 80.2450, False, 54.0, "medium"),
    ("nung-college", "Nungambakkam · College Road WCC Gate", 13.0685, 80.2435, False, 45.0, "medium"),
    ("nung-sterling", "Nungambakkam · Sterling Rd / Loyola College", 13.0655, 80.2325, False, 73.0, "high"),
    ("nung-village", "Nungambakkam · Village Road Commercial Crossing", 13.0620, 80.2390, False, 68.0, "medium"),
    ("tl-spencer", "Anna Salai · Spencer Plaza Main Concourse", 13.0610, 80.2600, False, 69.0, "medium"),
    ("tl-thousand", "Anna Salai · Thousand Lights Mosque Corner", 13.0560, 80.2540, False, 77.0, "high"),
    ("tl-gemini", "Anna Salai · Gemini Flyover & Semmozhi Poonga", 13.0515, 80.2515, False, 58.0, "medium"),
    ("tl-teynampet", "Anna Salai · Teynampet SIET College Gate", 13.0450, 80.2480, False, 65.0, "medium"),
    ("tl-nandanam", "Anna Salai · Nandanam YMCA Grounds Signal", 13.0290, 80.2370, False, 72.0, "high"),

    # --- 8. Guindy, Kathipara & Airport Transit Hub ---
    ("gnd-depot", "Guindy · GCC Central Logistics Depot (Base)", 13.0103, 80.2155, False, 12.0, "low"),
    ("gnd-ind1", "Guindy · Industrial Estate Phase 1 Main Rd", 13.0140, 80.2110, False, 77.0, "high"),
    ("gnd-ind2", "Guindy · Industrial Estate SIDCO Complex", 13.0080, 80.2070, False, 64.0, "medium"),
    ("gnd-station", "Guindy · Railway & Metro Transit Node", 13.0075, 80.2135, False, 88.0, "high"),
    ("gnd-kathipara", "Guindy · Kathipara Urban Square & Cloverleaf", 13.0065, 80.2030, False, 75.0, "high"),
    ("gnd-race", "Guindy · Race Course Road Promenade", 13.0125, 80.2240, False, 34.0, "low"),
    ("alan-mount", "Alandur · St. Thomas Mount Railway Footpath", 12.9985, 80.1985, False, 66.0, "medium"),
    ("alan-metro", "Alandur · Asarkhana Intermodal Metro Station", 13.0040, 80.2010, False, 71.0, "medium"),
    ("air-t1", "Meenambakkam · International Airport T1 Domestic", 12.9850, 80.1710, False, 59.0, "high"),
    ("air-t2", "Meenambakkam · International Airport T2 Terminal", 12.9820, 80.1680, False, 52.0, "high"),

    # --- 9. Adyar, Besant Nagar & Thiruvanmiyur Coastal Hub ---
    ("ady-lb", "Adyar · L.B. Road Commercial Bazaar", 13.0055, 80.2565, False, 82.0, "high"),
    ("ady-gandhi", "Adyar · Gandhi Nagar 1st Main Road", 13.0110, 80.2520, False, 50.0, "medium"),
    ("ady-sardar", "Adyar · Sardar Patel Road Signal", 13.0070, 80.2485, False, 73.0, "high"),
    ("ady-signal", "Adyar · Malar Hospital Junction", 13.0090, 80.2600, False, 61.0, "medium"),
    ("bes-elliot", "Besant Nagar · Elliot's Beach Promenade Center", 12.9995, 80.2690, False, 92.0, "high"),
    ("bes-church", "Besant Nagar · Velankanni Church Road", 13.0010, 80.2665, False, 78.0, "high"),
    ("bes-bus", "Besant Nagar · Bus Terminus M.G. Road", 12.9980, 80.2630, False, 70.0, "medium"),
    ("thir-temple", "Thiruvanmiyur · Marundeeswarar Temple East St", 12.9860, 80.2605, False, 70.0, "medium"),
    ("thir-beach", "Thiruvanmiyur · Beach Front Food Court", 12.9820, 80.2675, False, 86.0, "high"),
    ("thir-bus", "Thiruvanmiyur · Bus Terminus ECR Junction", 12.9845, 80.2570, False, 77.0, "high"),
    ("iitm-gate", "Adyar · IIT Madras Main Gate Sardar Patel Rd", 13.0060, 80.2420, False, 38.0, "low"),
    ("iitm-hostel", "Adyar · IIT Madras Taramani Campus Gate", 12.9920, 80.2330, False, 42.0, "medium"),

    # --- 10. Velachery & Medavakkam Commercial Transit ---
    ("vel-phoenix", "Velachery · Phoenix Marketcity Main Entrance", 12.9915, 80.2170, False, 93.0, "high"),
    ("vel-bypass", "Velachery · 100 Feet Bypass Road Signal", 12.9785, 80.2215, False, 84.0, "high"),
    ("vel-station", "Velachery · MRTS Terminal Station Footpath", 12.9800, 80.2185, False, 76.0, "high"),
    ("vel-taramani", "Velachery · Taramani Link Road Commercial Hub", 12.9740, 80.2310, False, 68.0, "medium"),
    ("vel-dhandees", "Velachery · Dhandeeswaram Main Road Market", 12.9720, 80.2220, False, 80.0, "high"),
    ("med-junc", "Medavakkam · Koot Road Junction & Market", 12.9185, 80.1915, False, 85.0, "high"),
    ("med-mambk", "Medavakkam · Mambakkam Highway Crossing", 12.9050, 80.1850, False, 62.0, "medium"),
    ("med-perumb", "Medavakkam · Perumbakkam Main Road Hub", 12.8980, 80.1980, False, 74.0, "high"),

    # --- 11. OMR (Rajiv Gandhi Salai) IT Corridor ---
    ("omr-tidel", "OMR · Tidel Park Campus Entrance", 12.9890, 80.2475, False, 75.0, "high"),
    ("omr-kandanch", "OMR · Kandanchavadi Commercial Junction", 12.9730, 80.2485, False, 82.0, "high"),
    ("omr-perungudi", "OMR · Perungudi Toll Plaza & Food Court", 12.9660, 80.2460, False, 89.0, "high"),
    ("omr-thoraipk", "OMR · Thoraipakkam 200 Ft Radial Rd Signal", 12.9415, 80.2340, False, 81.0, "high"),
    ("omr-karapkk", "OMR · Karapakkam TCS Campus Gate", 12.9230, 80.2310, False, 73.0, "medium"),
    ("omr-shol1", "OMR · Sholinganallur Junction Commercial Corner", 12.9010, 80.2280, False, 92.0, "high"),
    ("omr-elcot", "OMR · ELCOT SEZ Gate 2 Sholinganallur", 12.8950, 80.2250, False, 67.0, "medium"),
    ("omr-navalur", "OMR · Navalur Vivira Mall Food Walk", 12.8480, 80.2260, False, 83.0, "high"),
    ("omr-siruseri", "OMR · SIPCOT IT Park Main Avenue Siruseri", 12.8280, 80.2190, False, 72.0, "medium"),
    ("omr-kelam", "OMR · Kelambakkam Junction Market Bus Stand", 12.7880, 80.2200, False, 78.0, "medium"),

    # --- 12. Vadapalani, Ashok Nagar & Kodambakkam ---
    ("vad-temple", "Vadapalani · Murugan Temple South Sannadhi", 13.0535, 80.2125, False, 90.0, "high"),
    ("vad-forum", "Vadapalani · Nexus Vijaya Mall Food Entrance", 13.0510, 80.2100, False, 87.0, "high"),
    ("vad-bus", "Vadapalani · Bus Depot 100 Feet Road", 13.0500, 80.2135, False, 79.0, "high"),
    ("vad-metro", "Vadapalani · Metro Station Platform Concourse", 13.0520, 80.2115, False, 73.0, "high"),
    ("ashok-pillar", "Ashok Nagar · Ashok Pillar Junction 1st Ave", 13.0365, 80.2115, False, 71.0, "medium"),
    ("ashok-metro", "Ashok Nagar · Metro Station Entry Bay", 13.0350, 80.2105, False, 64.0, "medium"),
    ("ashok-11th", "Ashok Nagar · 11th Avenue Shopping Row", 13.0330, 80.2150, False, 58.0, "medium"),
    ("kod-subway", "Kodambakkam · Railway Station Subway Market", 13.0515, 80.2260, False, 82.0, "high"),
    ("kod-power", "Kodambakkam · Power House Junction Arcot Rd", 13.0540, 80.2205, False, 76.0, "high"),

    # --- 13. Porur & Valasaravakkam West Corridor ---
    ("por-junc", "Porur · Roundana & Tollgate Junction", 13.0355, 80.1585, False, 89.0, "high"),
    ("por-dlf", "Porur · DLF Cybercity Mount-Poonamallee Rd", 13.0230, 80.1740, False, 84.0, "high"),
    ("por-srmc", "Porur · Sri Ramachandra Hospital Medical Gate", 13.0420, 80.1440, False, 78.0, "high"),
    ("val-arcot", "Valasaravakkam · Arcot Road Commercial Strip", 13.0470, 80.1770, False, 69.0, "medium"),
    ("val-kesav", "Valasaravakkam · Kesavardhini Community Park", 13.0510, 80.1810, False, 45.0, "medium"),
    ("por-mugal", "Mugalivakkam · Main Road Commercial Crossing", 13.0180, 80.1690, False, 66.0, "medium"),

    # --- 14. Tambaram, Chromepet & GST Road Corridor ---
    ("tam-san1", "Tambaram Sanatorium · GST Road Commercial Gate", 12.9370, 80.1340, False, 88.0, "high"),
    ("tam-san2", "Tambaram Sanatorium · Railway Footbridge Bay", 12.9350, 80.1320, False, 82.0, "high"),
    ("tam-west", "Tambaram West · Gandhi Road Bazaar", 12.9255, 80.1205, False, 94.0, "high"),
    ("tam-east", "Tambaram East · Railway Bus Terminus Bay", 12.9235, 80.1285, False, 89.0, "high"),
    ("chr-gst", "Chromepet · GST Road Commercial Arcade", 12.9515, 80.1415, False, 86.0, "high"),
    ("chr-hosp", "Chromepet · Government Hospital Entrance", 12.9540, 80.1390, False, 65.0, "medium"),
    ("pal-market", "Pallavaram · Friday Market Grounds", 12.9680, 80.1470, False, 95.0, "high"),
    ("pal-station", "Pallavaram · Railway Station Concourse", 12.9695, 80.1495, False, 77.0, "high"),
    ("van-zoo", "Vandalur · Arignar Anna Zoo Main Gate Plaza", 12.8795, 80.0825, False, 87.0, "high"),
    ("van-rail", "Vandalur · Railway Station Overbridge East", 12.8905, 80.0810, False, 71.0, "medium"),

    # --- 15. Ambattur, Perambur & North Chennai Core ---
    ("amb-ot", "Ambattur · OT Bus Terminus MTH Road", 13.1140, 80.1480, False, 84.0, "high"),
    ("amb-estate", "Ambattur · Industrial Estate 3rd Main Rd", 13.0980, 80.1650, False, 76.0, "medium"),
    ("amb-station", "Ambattur · Railway Station North Entry", 13.1110, 80.1550, False, 71.0, "medium"),
    ("per-loco", "Perambur · Loco Works Railway Station Footpath", 13.1070, 80.2360, False, 79.0, "high"),
    ("per-market", "Perambur · Market Paper Mills Road", 13.1120, 80.2430, False, 85.0, "high"),
    ("mad-bus", "Madhavaram · Mofussil Bus Terminus (MMBT)", 13.1490, 80.2190, False, 83.0, "high"),
    ("mad-round", "Madhavaram · Roundtana GNT Road Junction", 13.1420, 80.2280, False, 72.0, "medium"),
    ("thir-toll", "Thiruvottiyur · High Road Tollgate Concourse", 13.1610, 80.3010, False, 86.0, "high"),
    ("thir-market", "Thiruvottiyur · Market & Theradi Temple Road", 13.1650, 80.3030, False, 88.0, "high"),
    ("thir-metro", "Thiruvottiyur · Wimco Nagar Metro Terminal", 13.1720, 80.3060, False, 75.0, "medium"),

    # --- 16. South Suburb & Educational Nodes (Preserving backward test compatibility) ---
    ("ab1", "VIT Chennai · Academic Block 1 (Vandalur-Kelambakkam)", 12.8424, 80.1536, False, 78.0, "high"),
    ("ab2", "VIT Chennai · Academic Block 2", 12.8429, 80.1542, False, 48.0, "medium"),
    ("ab3", "VIT Chennai · Academic Block 3", 12.8419, 80.1545, False, 54.0, "medium"),
    ("ab4", "VIT Chennai · Academic Block 4", 12.8411, 80.1548, False, 62.0, "medium"),
    ("ab5", "VIT Chennai · Academic Block 5", 12.8404, 80.1552, False, 36.0, "medium"),
    ("hstlA", "VIT Chennai · Hostel Block A", 12.8388, 80.1558, False, 58.0, "medium"),
    ("hstlB", "VIT Chennai · Hostel Block B", 12.8382, 80.1562, False, 44.0, "medium"),
    ("hstlC", "VIT Chennai · Hostel Block C", 12.8376, 80.1566, False, 24.0, "low"),
    ("hstlD", "VIT Chennai · Hostel Block D", 12.8370, 80.1570, False, 68.0, "medium"),
    ("hstlE", "VIT Chennai · Hostel Block E", 12.8364, 80.1574, False, 20.0, "low"),
    ("hstlF", "VIT Chennai · Hostel Block F", 12.8358, 80.1578, False, 52.0, "medium"),
    ("nsq", "VIT Chennai · North Square Commercial Yard", 12.8436, 80.1530, False, 84.0, "high"),
    ("gzbo", "VIT Chennai · Gazebo Park", 12.8421, 80.1528, False, 28.0, "low"),
    ("mga", "VIT Chennai · MG Auditorium Grounds", 12.8415, 80.1522, False, 32.0, "low"),
    ("health", "VIT Chennai · Health Center Frontage", 12.8398, 80.1538, False, 16.0, "low"),
    ("gymd", "VIT Chennai · Gymkhana & Dominos (Physical ESP32 IoT Node)", 12.8392, 80.1546, True, 22.0, "high"),
]

FILL_RATE_PER_HOUR = {
    "high": 8.0,
    "medium": 4.0,
    "low": 1.5,
}


def seed_bins() -> None:
    now = utcnow()
    for bin_id, name, lat, lng, is_real, fill, traffic in SEED_BINS:
        existing = get_bin(bin_id)
        upsert_bin(bin_id, name, lat, lng, fill, is_real, traffic=traffic, last_collected_at=now)
        if existing is None:
            update_fill(bin_id, fill)
    seed_history_and_analytics()


def drift_once(hours_step: float = 0.25) -> None:
    """Nudge simulated bins upward based on foot traffic; occasionally 'collect' a full one."""
    for bin_row in list_bins():
        if bin_row["is_real"]:
            continue
        traffic = bin_row.get("traffic", "medium")
        rate = FILL_RATE_PER_HOUR.get(traffic, 4.0)
        # Believable increment based on traffic rate plus slight natural variance
        increment = (rate * hours_step) + random.uniform(-0.15, 0.35)
        increment = max(0.1, increment)

        fill = bin_row["fill_percent"]
        if fill >= 96.0 and random.random() < 0.20:
            fill = round(random.uniform(6.0, 16.0), 1)
            update_collection_time(bin_row["id"])
        else:
            fill = min(100.0, round(fill + increment, 1))
        update_fill(bin_row["id"], fill)


def collect_bins(threshold: float = 70.0) -> list[str]:
    """Simulate emptying all bins currently above the threshold."""
    collected = []
    now = utcnow()
    for bin_row in list_bins():
        if float(bin_row["fill_percent"]) > threshold:
            new_fill = round(random.uniform(4.0, 12.0), 1)
            update_fill(bin_row["id"], new_fill)
            update_collection_time(bin_row["id"], now)
            collected.append(bin_row["id"])
    return collected

