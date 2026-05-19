import json
from datetime import datetime, timedelta
from company_brain.inventory import get_db_connection, record_sale
from agents.bidding_agent import execute_geographical_bidding
from broker.event_broker import broker
import asyncio

class CompanyBrainGraph:
    def __init__(self):
        pass

    async def run(self, event_json_str: str) -> str:
        try:
            event = json.loads(event_json_str)
            if event.get("event_type") != "CUSTOMER_ORDER_BOOKED":
                raise ValueError("Invalid event_type. Expected CUSTOMER_ORDER_BOOKED.")
                
            payload = event.get("payload", {})
            order_id = payload.get("order_id")
            item_name = payload.get("item")
            qty = float(payload.get("quantity", 1.0))
            sale_price = float(payload.get("total_value", 0.0))
            warehouse_id = int(payload.get("warehouse_id", 1)) # Default to Alpha Depot (1)
            customer_zone = payload.get("customer_zone", "Unknown")
            customer_name = payload.get("customer_name", "Anonymous")
            customer_phone = payload.get("customer_phone", "+92-300-0000000")
            
            dispatch_status = "READY"
            provider_id = payload.get("provider_id", "internal")
            profit_margin = sale_price
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Find the product
            cursor.execute("SELECT * FROM products WHERE name = ?", (item_name,))
            product = cursor.fetchone()
            
            if product:
                product_id = product["id"]
                cost_price = product["cost_price"]
                profit_margin = sale_price - (cost_price * qty)
                
                # Find warehouse specific stock
                cursor.execute("SELECT stock, reorder_threshold FROM product_warehouses WHERE product_id = ? AND warehouse_id = ?", (product_id, warehouse_id))
                wh_data = cursor.fetchone()
                
                if wh_data:
                    current_stock = wh_data["stock"]
                    reorder_threshold = wh_data["reorder_threshold"]
                    
                    if current_stock < qty:
                        dispatch_status = "DELAYED_OUT_OF_STOCK"
                    else:
                        record_sale(product_id, warehouse_id, qty, sale_price)
                        current_stock -= qty
                        await broker.publish("SYSTEM_LOG", "CompanyBrain", {"message": f"Recorded sale of {qty} {product['unit']} from Warehouse {warehouse_id}."})
                    
                    # Procurement Engine
                    if current_stock <= reorder_threshold:
                        cursor.execute("SELECT location FROM warehouses WHERE id = ?", (warehouse_id,))
                        wh_location = cursor.fetchone()["location"]
                        await self._trigger_genai_bidding(cursor, product, current_stock, wh_location)
                else:
                    dispatch_status = "ERROR_PRODUCT_NOT_IN_WAREHOUSE"
            
            conn.close()
            
            output_payload = {
                "order_id": order_id,
                "item": item_name,
                "provider_id": provider_id,
                "dispatch_status": dispatch_status,
                "profit_margin": profit_margin,
                "warehouse_id": warehouse_id,
                "customer_zone": customer_zone,
                "customer_name": customer_name,
                "customer_phone": customer_phone
            }
            
            # Broadcast the dispatch event
            await broker.publish("BUSINESS_DISPATCH_CONFIRMED", "CompanyBrain", output_payload)
            
            return json.dumps({
                "event_type": "BUSINESS_DISPATCH_CONFIRMED",
                "payload": output_payload
            })
            
        except Exception as e:
            return json.dumps({"status": "ERROR", "message": str(e)})
            
    async def _trigger_genai_bidding(self, cursor, product, current_stock, warehouse_location):
        product_id = product["id"]
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        
        cursor.execute("SELECT SUM(quantity) FROM transactions WHERE product_id = ? AND type = 'SALE' AND timestamp >= ?", 
                       (product_id, thirty_days_ago))
        row = cursor.fetchone()
        sold = row[0] if row and row[0] else 0.0
        daily_velocity = sold / 30.0 if sold > 0 else 0.5
        
        days_remaining = current_stock / daily_velocity if daily_velocity > 0 else 999
        urgency = "HIGH" if days_remaining <= 2 else "LOW"
        
        await broker.publish("SYSTEM_LOG", "ProcurementEngine", {
            "message": f"Reorder threshold tripped for {product['name']} at {warehouse_location}. Urgency: {urgency}. Invoking GenAI Bidding Agent..."
        })
        
        # Call the standalone AI Agent
        decision = execute_geographical_bidding(product["name"], warehouse_location, urgency)
        
        await broker.publish("PROCUREMENT_DECISION", "BiddingAgent", {
            "product": product["name"],
            "selected_vendor": decision["vendor"],
            "reason": decision["reason"],
            "agent_type": decision["agent"]
        })
