import json
from company_brain.firestore_inventory import (
    get_product_by_name,
    get_stock_record,
    get_warehouse_by_id,
    record_sale,
)
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
            
            product = get_product_by_name(item_name)
            
            if product:
                product_id = product["id"]
                cost_price = product["cost_price"]
                profit_margin = sale_price - (cost_price * qty)
                
                wh_data = get_stock_record(product_id, warehouse_id)
                
                if wh_data:
                    current_stock = wh_data["stock"]
                    reorder_threshold = wh_data["reorder_threshold"]
                    
                    if current_stock < qty:
                        dispatch_status = "DELAYED_OUT_OF_STOCK"
                    else:
                        sale_result = record_sale(product_id, warehouse_id, qty, sale_price)
                        if sale_result.get("status") != "success":
                            dispatch_status = "ERROR_STOCK_UPDATE_FAILED"
                            raise ValueError(sale_result.get("message", "Failed to record sale"))
                        current_stock = float(sale_result.get("remaining_stock", current_stock - qty))
                        await broker.publish("SYSTEM_LOG", "CompanyBrain", {"message": f"Recorded sale of {qty} {product['unit']} from Warehouse {warehouse_id}."})
                    
                    # Procurement Engine
                    if current_stock <= reorder_threshold:
                        warehouse = get_warehouse_by_id(warehouse_id) or {}
                        wh_location = warehouse.get("location", "Unknown")
                        await self._trigger_genai_bidding(product, warehouse_id, current_stock, wh_location)
                else:
                    dispatch_status = "ERROR_PRODUCT_NOT_IN_WAREHOUSE"
            
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
            
    async def _trigger_genai_bidding(self, product, warehouse_id, current_stock, warehouse_location):
        product_id = product["id"]
        
        from agents.bidding_agent import generate_procurement_suggestions
        
        await broker.publish("SYSTEM_LOG", "ProcurementEngine", {
            "message": f"Reorder threshold tripped for {product['name']} at {warehouse_location}. Extracting Top 5 Suppliers from Live Map API..."
        })
        
        lat, lng = 24.8607, 67.0011 # default Karachi
        if warehouse_location.lower() == "lahore":
            lat, lng = 31.5204, 74.3587
            
        suggestions = generate_procurement_suggestions(product["name"], lat, lng)
        
        await broker.publish("PROCUREMENT_SUGGESTION", "ProcurementEngine", {
            "product_id": product_id,
            "product_name": product["name"],
            "warehouse_id": warehouse_id,
            "warehouse_location": warehouse_location,
            "suggestions": suggestions
        })
