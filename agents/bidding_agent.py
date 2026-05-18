import os
import json
from company_brain.inventory import get_db_connection

def search_nearby_vendors(product: str, location: str) -> str:
    """
    Mock Google Places / Search Tool.
    In a real environment, this would call the Google Maps Places API to find nearby suppliers.
    Here we simulate regional variations.
    """
    mock_vendors = []
    
    if location.lower() == "karachi":
        mock_vendors = [
            {"name": "Karachi Wholesale Traders", "unit_price": 105.0, "lead_time_days": 1},
            {"name": "Sindh Supply Co.", "unit_price": 95.0, "lead_time_days": 3}
        ]
    elif location.lower() == "lahore":
        mock_vendors = [
            {"name": "Lahore Regional Depot", "unit_price": 110.0, "lead_time_days": 1},
            {"name": "Punjab Bulk Suppliers", "unit_price": 90.0, "lead_time_days": 4}
        ]
    else:
        mock_vendors = [
            {"name": "National Express Freight", "unit_price": 120.0, "lead_time_days": 2}
        ]
        
    return json.dumps(mock_vendors)

def execute_geographical_bidding(product_name: str, warehouse_location: str, urgency: str) -> dict:
    """
    Executes the GenAI Agent to parse nearby vendors and select the best one based on urgency.
    Gracefully falls back to a deterministic algorithm if GEMINI_API_KEY is not set or google-genai is missing.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    
    # Try the Google GenAI approach first
    if api_key:
        try:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=api_key)
            
            prompt = f"""
            You are an expert procurement agent.
            Our warehouse in '{warehouse_location}' is running low on '{product_name}'.
            The urgency of this restock is: {urgency}.
            
            If urgency is HIGH, you MUST pick the vendor with the lowest lead_time_days to save the stock out.
            If urgency is LOW, you MUST pick the vendor with the lowest unit_price to maximize profit.
            
            Please use your tool to search for nearby vendors in {warehouse_location}, evaluate the JSON array, and return your final choice.
            Return ONLY a JSON object with this exact format:
            {{"selected_vendor": "Vendor Name", "reason": "Short explanation"}}
            """
            
            # Using function calling
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[search_nearby_vendors],
                    temperature=0.1,
                ),
            )
            
            # Assuming the model returns the JSON block directly or calls the function.
            # In a full ADK/ReAct loop, we'd process the function call. 
            # For this simple implementation, let's extract the response text.
            resp_text = response.text
            # Basic JSON extraction
            start = resp_text.find("{")
            end = resp_text.rfind("}") + 1
            if start != -1 and end != -1:
                decision = json.loads(resp_text[start:end])
                return {"vendor": decision.get("selected_vendor"), "reason": decision.get("reason"), "agent": "Gemini 2.5 GenAI"}
                
        except Exception as e:
            print(f"[Agentic Fallback] GenAI execution failed: {str(e)}")
            
    # --- FALLBACK DETERMINISTIC LOGIC ---
    print(f"[Agentic Fallback] Using local geographical matching for {warehouse_location}")
    vendors_json = search_nearby_vendors(product_name, warehouse_location)
    vendors = json.loads(vendors_json)
    
    if not vendors:
        return {"vendor": "Unknown", "reason": "No vendors found locally.", "agent": "Local Fallback"}
        
    if urgency == "HIGH":
        selected = min(vendors, key=lambda x: x["lead_time_days"])
        reason = f"Urgency is HIGH. Selected fastest local delivery ({selected['lead_time_days']} days)."
    else:
        selected = min(vendors, key=lambda x: x["unit_price"])
        reason = f"Urgency is LOW. Selected cheapest local bulk price (Rs {selected['unit_price']})."
        
    return {"vendor": selected["name"], "reason": reason, "agent": "Local Fallback Algorithm"}
