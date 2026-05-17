# File: company_brain/graph.py
#
# ## Purpose
# Implement the autonomous state graph for System 2: Business Operations.
#
# ## Responsibility
# Handle incoming CUSTOMER_ORDER_BOOKED events, check inventory, process financial ledgers, 
# and autonomously trigger the Wholesaler Decision Algorithm if stock is low.
#
# ## Inputs
# JSON string of CUSTOMER_ORDER_BOOKED event.
#
# ## Outputs
# JSON string of BUSINESS_DISPATCH_CONFIRMED event.

import json
from datetime import datetime, timedelta
from company_brain.inventory import get_db_connection, record_sale

class CompanyBrainGraph:
    def __init__(self):
        pass

    def run(self, event_json_str: str) -> str:
        """
        Main entry point for the Company Brain pipeline.
        Strictly decoupled: Receives JSON, outputs JSON.
        """
        try:
            event = json.loads(event_json_str)
            if event.get("event_type") != "CUSTOMER_ORDER_BOOKED":
                raise ValueError("Invalid event_type. Expected CUSTOMER_ORDER_BOOKED.")
                
            payload = event.get("payload", {})
            order_id = payload.get("order_id")
            item_name = payload.get("item")
            qty = float(payload.get("quantity", 1.0))
            sale_price = float(payload.get("total_value", 0.0))
            
            # Node 1: Inventory Check & Ledger Recording
            dispatch_status = "READY"
            provider_id = payload.get("provider_id", "internal")
            profit_margin = sale_price
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Find the product ID for the requested item
            cursor.execute("SELECT * FROM products WHERE name = ?", (item_name,))
            product = cursor.fetchone()
            
            if product:
                product_id = product["id"]
                current_stock = product["stock"]
                reorder_threshold = product["reorder_threshold"]
                cost_price = product["cost_price"]
                profit_margin = sale_price - (cost_price * qty)
                
                # Check if stock is sufficient to fulfill
                if current_stock < qty:
                    dispatch_status = "DELAYED_OUT_OF_STOCK"
                else:
                    # Deduct stock and record sale securely
                    record_sale(product_id, qty, sale_price)
                    current_stock -= qty
                
                # Node 2: Procurement Engine Node
                if current_stock <= reorder_threshold:
                    self._run_wholesaler_decision_algorithm(cursor, product, current_stock)
            
            conn.close()
            
            # Node 3: Dispatch Event Output
            output_event = {
                "event_type": "BUSINESS_DISPATCH_CONFIRMED",
                "source": "CompanyBrain",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "order_id": order_id,
                    "item": item_name,
                    "provider_id": provider_id,
                    "dispatch_status": dispatch_status,
                    "profit_margin": profit_margin
                }
            }
            
            return json.dumps(output_event, indent=2)
            
        except Exception as e:
            return json.dumps({
                "status": "ERROR",
                "message": str(e)
            })
            
    def _run_wholesaler_decision_algorithm(self, cursor, product, current_stock):
        """
        Executes the Supplier Bidding & Choice Node.
        """
        product_id = product["id"]
        
        # Calculate daily velocity (simplified 30-day average)
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.execute("SELECT SUM(quantity) FROM transactions WHERE product_id = ? AND type = 'SALE' AND timestamp >= ?", 
                       (product_id, thirty_days_ago))
        row = cursor.fetchone()
        sold = row[0] if row and row[0] else 0.0
        daily_velocity = sold / 30.0 if sold > 0 else 0.5 # Default to 0.5 if no history
        
        # Determine Urgency
        # If current stock will deplete within 2 days based on velocity, it's HIGH urgency.
        days_remaining = current_stock / daily_velocity if daily_velocity > 0 else 999
        urgency = "HIGH" if days_remaining <= 2 else "LOW"
        
        # Fetch competing bids
        cursor.execute("SELECT * FROM suppliers")
        suppliers = cursor.fetchall()
        
        if not suppliers:
            return
            
        selected_supplier = None
        
        if urgency == "HIGH":
            # Case A: Prioritize fast dispatch speeds (min lead_time_days)
            selected_supplier = min(suppliers, key=lambda s: s["lead_time_days"] or 99)
            print(f"[COMPANY BRAIN] URGENCY HIGH for {product['name']}. Selected FASTEST supplier: {selected_supplier['name']} ({selected_supplier['lead_time_days']} days)")
        else:
            # Case B: Prioritize lowest unit price
            # Mocking dynamic bids based on base cost and supplier rating (higher rating = premium price)
            def get_bid_price(s):
                premium = (s["rating"] or 3.0) / 100.0 # 3-5% premium
                return product["cost_price"] * (1 + premium)
            
            selected_supplier = min(suppliers, key=lambda s: get_bid_price(s))
            print(f"[COMPANY BRAIN] URGENCY LOW for {product['name']}. Selected CHEAPEST supplier: {selected_supplier['name']}")
