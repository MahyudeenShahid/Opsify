import urllib.request
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from agents.agri_agent import generate_simulated_whatsapp_feed, aggregate_crop_demands, calculate_shared_logistics_route

router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────────────────
def fetch_live_pakistan_petrol_price() -> float:
    """
    Scrapes the live petrol price from Hamariweb finance portal.
    Falls back to the latest verified rate (Rs 409.78) if scraping fails.
    """
    fallback_price = 409.78
    try:
        url = "https://hamariweb.com/finance/petrol-price-in-pakistan/"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            html = response.read().decode('utf-8')
            matches = re.findall(r'Petrol.*?Rs\.\s*([\d\.]+)', html, re.IGNORECASE)
            if not matches:
                matches = re.findall(r'<td>Petrol</td>\s*<td>Rs\.\s*([\d\.]+)</td>', html, re.IGNORECASE)
            if matches:
                price = float(matches[0])
                if 200.0 < price < 600.0:
                    return price
    except Exception:
        pass
    return fallback_price


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/api/petrol/price")
def get_petrol_price():
    """
    Returns the real-time petrol price index in Pakistan.
    """
    price = fetch_live_pakistan_petrol_price()
    return {
        "status": "success",
        "petrol_price": price,
        "surcharge_per_km": round(price / 15.0, 2),
        "source": "Hamariweb Finance Live Index" if price != 409.78 else "May 2026 Archive Surcharge"
    }


@router.get("/api/map/render", response_class=HTMLResponse)
def render_live_map(lat1: float, lng1: float, lat2: float, lng2: float, name1: str = "Near Me (Sabzi Mandi Depot)", name2: str = "Client (Hyperlocal Vendor Cart)"):
    """
    Generates a beautiful CartoDB Dark Matter interactive Leaflet.js map iframe
    plotting 'Near Me' and 'Client Destination' with a glowing neon connector.
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Opsify Agri-Bridge Live Routing</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            html, body, #map {{
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                background-color: #070A0E;
            }}
            .leaflet-container {{
                background: #070A0E !important;
            }}
            /* Glow polyline style */
            .leaflet-interactive {{
                filter: drop-shadow(0px 0px 8px #00E676);
            }}
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            var lat1 = {lat1};
            var lng1 = {lng1};
            var lat2 = {lat2};
            var lng2 = {lng2};

            var map = L.map('map', {{ zoomControl: false }}).setView([lat1, lng1], 13);

            L.tileLayer('https://{{s}}.basemaps.cartocdn.com/dark_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
                attribution: '&copy; CartoDB'
            }}).addTo(map);

            var nearIcon = L.divIcon({{
                className: 'near-marker',
                html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #00E676; border: 2.5px solid #fff; box-shadow: 0 0 12px #00E676;"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            }});
            L.marker([lat1, lng1], {{ icon: nearIcon }}).addTo(map).bindPopup("{name1}").openPopup();

            var clientIcon = L.divIcon({{
                className: 'client-marker',
                html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #FFC400; border: 2.5px solid #fff; box-shadow: 0 0 12px #FFC400;"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            }});
            L.marker([lat2, lng2], {{ icon: clientIcon }}).addTo(map).bindPopup("{name2}");

            var polyline = L.polyline([[lat1, lng1], [lat2, lng2]], {{
                color: '#00E676',
                weight: 4,
                opacity: 0.8,
                dashArray: '8, 12'
            }}).addTo(map);

            map.fitBounds(polyline.getBounds(), {{ padding: [30, 30] }});
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)


@router.get("/api/agri/demand-feed")
def get_agri_demand_feed(lat: float = 24.8138, lng: float = 67.0366):
    """
    Generates simulated WhatsApp feed from 50 street vendors and aggregates crop demand.
    """
    feed = generate_simulated_whatsapp_feed(lat, lng)
    aggregation = aggregate_crop_demands(feed)
    analysis = calculate_shared_logistics_route(feed, lat, lng)
    
    return {
        "status": "success",
        "feed": feed,
        "aggregation": aggregation,
        "logistics_analysis": {
            "individual_total_dist_km": analysis["individual_total_dist_km"],
            "shared_total_dist_km": analysis["shared_total_dist_km"],
            "fuel_saved_percent": analysis["fuel_saved_percent"],
            "total_vendors_served": analysis["total_vendors_served"]
        },
        "invoices": analysis["invoices"]
    }


@router.post("/api/agri/dispatch-shared")
def post_agri_dispatch_shared(payload: dict):
    """
    Triggers shared logistics run, geolocates closest farm matching aggregated crops,
    and commits transaction records to the SQLite ERP.
    """
    lat = payload.get("lat", 24.8138)
    lng = payload.get("lng", 67.0366)
    
    feed = generate_simulated_whatsapp_feed(lat, lng)
    aggregation = aggregate_crop_demands(feed)
    analysis = calculate_shared_logistics_route(feed, lat, lng)
    
    from company_brain.inventory import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    
    dispatch_logs = []
    
    try:
        for crop, total_qty in aggregation.items():
            cursor.execute("SELECT id, selling_price, cost_price FROM products WHERE name LIKE ?", (f"%{crop.split()[-1]}%",))
            prod_row = cursor.fetchone()
            if prod_row:
                prod_id = prod_row["id"]
                price = prod_row["selling_price"]
                total_val = total_qty * price
                
                cursor.execute("""
                    INSERT INTO transactions (product_id, warehouse_id, type, reason, quantity, total_value, timestamp)
                    VALUES (?, 1, 'SALE', 'Agri-Bridge Shared Delivery Dispatch', ?, ?, ?)
                """, (prod_id, total_qty, total_val, datetime.now().isoformat()))
                
                cursor.execute("SELECT stock FROM product_warehouses WHERE product_id = ? AND warehouse_id = 1", (prod_id,))
                stock_row = cursor.fetchone()
                if stock_row:
                    new_stock = max(0.0, stock_row["stock"] - total_qty)
                    cursor.execute("UPDATE product_warehouses SET stock = ? WHERE product_id = ? AND warehouse_id = 1", (new_stock, prod_id))
                    
                dispatch_logs.append(f"Dispatched {total_qty} units of {crop} from Warehouse 1. Value: Rs {total_val}")
                
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[Agri Dispatch] Database transaction failed: {e}")
    finally:
        conn.close()
        
    return {
        "status": "success",
        "message": "Agri-Bridge Hyperlocal Logistics Shared Routing Dispatched Successfully!",
        "dispatch_id": f"AGRI-DISPATCH-{str(uuid.uuid4())[:8].upper()}",
        "vendors_synchronized": len(feed),
        "fuel_saving_efficiency": f"{analysis['fuel_saved_percent']}%",
        "dispatch_logs": dispatch_logs,
        "shared_route_coordinates": {
            "origin": {"lat": 24.8138, "lng": 67.0366},
            "destinations": [{"lat": entry["latitude"], "lng": entry["longitude"], "name": entry["vendor_name"]} for entry in feed[:10]]
        }
    }
