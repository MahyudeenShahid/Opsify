# File: tools/database.py
#
# ## Purpose
# Hyperlocal provider registry for System 1: Customer Brain.
# Provides zone-aware matching with adjacency fallback so that every valid
# Karachi zone returns useful results even when no provider is in that exact zone.

from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Zone adjacency map — if no providers found in requested zone, search these
# neighbours in order before falling back to the full city pool.
# ---------------------------------------------------------------------------
ZONE_ADJACENCY: Dict[str, List[str]] = {
    "Gulshan":    ["Nazimabad", "PECHS", "Clifton", "DHA", "Saddar"],
    "DHA":        ["Clifton", "Saddar", "Korangi", "Gulshan", "PECHS"],
    "Clifton":    ["DHA", "Saddar", "Gulshan", "PECHS"],
    "Saddar":     ["Clifton", "PECHS", "Lyari", "Gulshan", "DHA"],
    "PECHS":      ["Gulshan", "Saddar", "Clifton", "DHA"],
    "Nazimabad":  ["Gulshan", "Saddar", "PECHS", "North Karachi"],
    "Korangi":    ["DHA", "Clifton", "Saddar"],
    "Lyari":      ["Saddar", "Clifton"],
    "North Karachi": ["Nazimabad", "Gulshan"],
    "Malir":      ["Korangi", "DHA", "Gulshan"],
    "Landhi":     ["Korangi", "Malir", "DHA"],
    "Unknown":    ["Gulshan", "DHA", "Clifton", "Saddar", "PECHS"],
}

# ---------------------------------------------------------------------------
# Provider Registry — 30+ providers across all zones and categories
# Fields: id, name, category, location, rating, price_per_hr, phone, experience_years, available
# ---------------------------------------------------------------------------
MOCK_PROVIDERS: List[Dict[str, Any]] = [
    # ── Electricians ───────────────────────────────────────────────────────
    {"id": "E001", "name": "Ali Electrician",        "category": "Electrician",    "location": "Gulshan",      "rating": 4.8, "price_per_hr": 1000, "phone": "+92-321-1111001", "experience_years": 8,  "available": True},
    {"id": "E002", "name": "Kamran Wiring Works",    "category": "Electrician",    "location": "DHA",          "rating": 4.2, "price_per_hr": 800,  "phone": "+92-333-1111002", "experience_years": 5,  "available": True},
    {"id": "E003", "name": "Faisal Electric",        "category": "Electrician",    "location": "Clifton",      "rating": 4.6, "price_per_hr": 1100, "phone": "+92-345-1111003", "experience_years": 12, "available": True},
    {"id": "E004", "name": "Raza Electric Pro",      "category": "Electrician",    "location": "PECHS",        "rating": 4.4, "price_per_hr": 950,  "phone": "+92-312-1111004", "experience_years": 7,  "available": True},
    {"id": "E005", "name": "Saeed Power Tech",       "category": "Electrician",    "location": "Saddar",       "rating": 4.0, "price_per_hr": 750,  "phone": "+92-321-1111005", "experience_years": 4,  "available": True},
    {"id": "E006", "name": "Tariq Electrical",       "category": "Electrician",    "location": "Nazimabad",    "rating": 4.3, "price_per_hr": 900,  "phone": "+92-300-1111006", "experience_years": 6,  "available": True},
    {"id": "E007", "name": "Hassan Electric",        "category": "Electrician",    "location": "Korangi",      "rating": 4.1, "price_per_hr": 850,  "phone": "+92-333-1111007", "experience_years": 5,  "available": True},

    # ── Plumbers ───────────────────────────────────────────────────────────
    {"id": "P001", "name": "Zain Plumber",           "category": "Plumber",        "location": "DHA",          "rating": 4.9, "price_per_hr": 1200, "phone": "+92-321-2222001", "experience_years": 10, "available": True},
    {"id": "P002", "name": "Ahmed Pipe Works",       "category": "Plumber",        "location": "Gulshan",      "rating": 4.5, "price_per_hr": 1000, "phone": "+92-333-2222002", "experience_years": 8,  "available": True},
    {"id": "P003", "name": "Rizwan Plumbing",        "category": "Plumber",        "location": "Clifton",      "rating": 4.7, "price_per_hr": 1100, "phone": "+92-345-2222003", "experience_years": 6,  "available": True},
    {"id": "P004", "name": "Imran Pipe Solutions",   "category": "Plumber",        "location": "PECHS",        "rating": 4.2, "price_per_hr": 950,  "phone": "+92-312-2222004", "experience_years": 5,  "available": True},
    {"id": "P005", "name": "Khalid Water Works",     "category": "Plumber",        "location": "Saddar",       "rating": 4.3, "price_per_hr": 900,  "phone": "+92-300-2222005", "experience_years": 7,  "available": True},
    {"id": "P006", "name": "Usman Drain Specialist", "category": "Plumber",        "location": "Nazimabad",    "rating": 4.0, "price_per_hr": 800,  "phone": "+92-321-2222006", "experience_years": 4,  "available": True},
    {"id": "P007", "name": "Waseem Plumbing",        "category": "Plumber",        "location": "Korangi",      "rating": 4.6, "price_per_hr": 1050, "phone": "+92-333-2222007", "experience_years": 9,  "available": True},

    # ── AC Technicians ─────────────────────────────────────────────────────
    {"id": "A001", "name": "Bilal AC Tech",          "category": "AC Technician",  "location": "Clifton",      "rating": 4.5, "price_per_hr": 1500, "phone": "+92-321-3333001", "experience_years": 7,  "available": True},
    {"id": "A002", "name": "Cool Air Services",      "category": "AC Technician",  "location": "DHA",          "rating": 4.8, "price_per_hr": 1600, "phone": "+92-333-3333002", "experience_years": 10, "available": True},
    {"id": "A003", "name": "Arctic HVAC",            "category": "AC Technician",  "location": "Gulshan",      "rating": 4.6, "price_per_hr": 1400, "phone": "+92-345-3333003", "experience_years": 8,  "available": True},
    {"id": "A004", "name": "FrostFix AC",            "category": "AC Technician",  "location": "PECHS",        "rating": 4.3, "price_per_hr": 1300, "phone": "+92-312-3333004", "experience_years": 5,  "available": True},
    {"id": "A005", "name": "IceCool Repairs",        "category": "AC Technician",  "location": "Saddar",       "rating": 4.1, "price_per_hr": 1200, "phone": "+92-300-3333005", "experience_years": 4,  "available": True},
    {"id": "A006", "name": "ChillTech Services",     "category": "AC Technician",  "location": "Nazimabad",    "rating": 4.4, "price_per_hr": 1350, "phone": "+92-321-3333006", "experience_years": 6,  "available": True},

    # ── Milk / Dairy ───────────────────────────────────────────────────────
    {"id": "M001", "name": "Dairy Farm Delivery",    "category": "Milk",           "location": "Gulshan",      "rating": 4.7, "price_per_hr": 300,  "phone": "+92-321-4444001", "experience_years": 5,  "available": True},
    {"id": "M002", "name": "Pure Milk Express",      "category": "Milk",           "location": "DHA",          "rating": 4.5, "price_per_hr": 320,  "phone": "+92-333-4444002", "experience_years": 3,  "available": True},
    {"id": "M003", "name": "Clifton Dairy Hub",      "category": "Milk",           "location": "Clifton",      "rating": 4.6, "price_per_hr": 340,  "phone": "+92-345-4444003", "experience_years": 4,  "available": True},
    {"id": "M004", "name": "Farm Fresh Delivery",    "category": "Milk",           "location": "PECHS",        "rating": 4.4, "price_per_hr": 310,  "phone": "+92-312-4444004", "experience_years": 2,  "available": True},
    {"id": "M005", "name": "Saddar Milk Centre",     "category": "Milk",           "location": "Saddar",       "rating": 4.2, "price_per_hr": 290,  "phone": "+92-300-4444005", "experience_years": 6,  "available": True},

    # ── Carpenter ─────────────────────────────────────────────────────────
    {"id": "C001", "name": "Master Carpenter KHI",  "category": "Carpenter",      "location": "Gulshan",      "rating": 4.7, "price_per_hr": 1100, "phone": "+92-321-5555001", "experience_years": 15, "available": True},
    {"id": "C002", "name": "Woodcraft DHA",          "category": "Carpenter",      "location": "DHA",          "rating": 4.5, "price_per_hr": 1200, "phone": "+92-333-5555002", "experience_years": 10, "available": True},
    {"id": "C003", "name": "Precision Woodworks",    "category": "Carpenter",      "location": "Clifton",      "rating": 4.6, "price_per_hr": 1300, "phone": "+92-345-5555003", "experience_years": 12, "available": True},

    # ── Painter ───────────────────────────────────────────────────────────
    {"id": "PT001", "name": "Bright Strokes Painting", "category": "Painter",     "location": "Saddar",       "rating": 4.4, "price_per_hr": 700,  "phone": "+92-312-6666001", "experience_years": 8,  "available": True},
    {"id": "PT002", "name": "ColorPro KHI",          "category": "Painter",        "location": "Gulshan",      "rating": 4.6, "price_per_hr": 750,  "phone": "+92-321-6666002", "experience_years": 6,  "available": True},
    {"id": "PT003", "name": "Elite Painters",        "category": "Painter",        "location": "DHA",          "rating": 4.8, "price_per_hr": 900,  "phone": "+92-333-6666003", "experience_years": 12, "available": True},

    # ── Mason / Construction ──────────────────────────────────────────────
    {"id": "MS001", "name": "Solid Structures KHI",  "category": "Mason",          "location": "Korangi",      "rating": 4.5, "price_per_hr": 1000, "phone": "+92-300-7777001", "experience_years": 20, "available": True},
    {"id": "MS002", "name": "BuildRight Masonry",    "category": "Mason",          "location": "Gulshan",      "rating": 4.3, "price_per_hr": 900,  "phone": "+92-345-7777002", "experience_years": 15, "available": True},
]

# ---------------------------------------------------------------------------
# Category aliases — maps Urdu/common alternate names to canonical category
# ---------------------------------------------------------------------------
CATEGORY_ALIASES: Dict[str, str] = {
    "electrician": "Electrician",
    "bijli":        "Electrician",
    "electric":     "Electrician",
    "plumber":      "Plumber",
    "pani":         "Plumber",
    "pipe":         "Plumber",
    "ac technician": "AC Technician",
    "ac tech":      "AC Technician",
    "cooling":      "AC Technician",
    "milk":         "Milk",
    "dairy":        "Milk",
    "doodh":        "Milk",
    "carpenter":    "Carpenter",
    "wood":         "Carpenter",
    "painter":      "Painter",
    "painting":     "Painter",
    "mason":        "Mason",
    "construction": "Mason",
}


def _normalise_category(category: str) -> str:
    """Resolve category aliases to canonical name."""
    key = category.lower().strip()
    return CATEGORY_ALIASES.get(key, category)


def query_mock_provider_db(location: str, category: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """
    Zone-aware hyperlocal provider search with adjacency fallback.

    Strategy:
    1. Search exact zone match (only available providers).
    2. If < 3 results, expand to adjacent zones in order.
    3. If still empty, return all city-wide matches.

    All results are sorted by (-rating, price_per_hr) for quality-first ordering.
    """
    canonical = _normalise_category(category)
    zone = location.strip()

    def _search(zones: List[str]) -> List[Dict[str, Any]]:
        seen = set()
        found = []
        for z in zones:
            for p in MOCK_PROVIDERS:
                if p["id"] not in seen and p["available"]:
                    cat_match = canonical.lower() in p["category"].lower()
                    zone_match = (z.lower() == p["location"].lower())
                    if cat_match and zone_match:
                        found.append({**p, "zone_match": z})
                        seen.add(p["id"])
        return found

    # Step 1: Exact zone
    results = _search([zone])

    # Step 2: Expand to adjacent zones
    if len(results) < 3:
        neighbours = ZONE_ADJACENCY.get(zone, ZONE_ADJACENCY["Unknown"])
        results += [r for r in _search(neighbours) if r["id"] not in {x["id"] for x in results}]

    # Step 3: City-wide fallback
    if not results:
        all_zones = list({p["location"] for p in MOCK_PROVIDERS})
        results = _search(all_zones)

    # Sort by best rating first, then cheapest
    results.sort(key=lambda x: (-x["rating"], x["price_per_hr"]))
    return results[:max_results]


def get_all_providers() -> List[Dict[str, Any]]:
    """Return the full provider registry."""
    return MOCK_PROVIDERS


def get_provider_by_id(provider_id: str) -> Dict[str, Any] | None:
    return next((p for p in MOCK_PROVIDERS if p["id"] == provider_id), None)
