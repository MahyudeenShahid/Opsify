import os
import json
from typing import List, Dict, Any

def scan_chats_for_incomplete_orders(chats_payload: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Agentic System 1: Incomplete Order Extraction Agent.
    Scans recent chats to identify intents for orders/restocks that haven't been entered into the ledger yet.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import JsonOutputParser
            
            # Setup the LangChain model
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-lite",
                temperature=0.1,
                google_api_key=api_key
            )
            
            # Define output parser
            parser = JsonOutputParser()
            
            # Create LangChain Prompt Template
            prompt = PromptTemplate(
                template="""You are a sales & procurement intelligence agent for an ERP system.
You are provided with a JSON list of chat rooms and their recent messages:
{chats}

Your job is to read all of today's chats and extract any INCOMPLETE/PENDING order intents.
An incomplete order intent is when:
1. A customer requests a product purchase but no booking has been made yet.
2. A supplier proposes a product restocking/reorder but it hasn't been approved yet.

Analyze the conversations. Focus on:
- "Bob Malone" wanting to buy "Copper Wire" (quantity: 50, cost is cost_price or selling_price * qty).
- "Alice" talking about a milk reorder.

{format_instructions}

Each object MUST have the following structure:
- "chat_id": (string)
- "type": "SALE" (customer purchase) or "RESTOCK" (supplier procurement)
- "contact_name": (string, e.g. "Bob Malone")
- "item": (string, category name: "Milk", "Wire", "Pipe", "Bread")
- "quantity": (number, e.g. 50)
- "value": (number, total cost)
- "warehouse_id": (number, 1 for Alpha Depot)
- "reason": (string, short reasoning)
""",
                input_variables=["chats"],
                partial_variables={"format_instructions": parser.get_format_instructions()},
            )
            
            # LangChain Runnable Chain (Prompt -> LLM -> Parser)
            chain = prompt | llm | parser
            
            # Invoke the LangChain pipeline
            result = chain.invoke({"chats": json.dumps(chats_payload)})
            
            # Handle case where LLM returns a single object instead of array
            if isinstance(result, dict):
                return [result]
            elif isinstance(result, list):
                return result
                
        except Exception as e:
            print(f"[Agentic Chat Scan] LangChain GenAI parsing failed, falling back to local heuristics: {str(e)}")

    # --- LOCAL HEURISTICS / SIMULATOR FALLBACK ---
    # Scans the messages in-memory for typical demo trigger keywords
    incomplete_orders = []
    
    for chat in chats_payload:
        chat_id = chat.get("id", "")
        messages = chat.get("messages", [])
        
        # Determine contact name
        user_name = "Unknown"
        users = chat.get("users", [])
        if users:
            user_name = users[0].get("name", "Unknown")
            
        # Analyze Alice (Dairy Supplier) Chat
        if "alice" in chat_id.lower() or "dairy" in user_name.lower():
            # Check if we already have a milk restock in mind
            has_milk_reorder = any(
                "reorder" in m.get("text", "").lower() or "low on full cream" in m.get("text", "").lower()
                for m in messages
            )
            if has_milk_reorder:
                incomplete_orders.append({
                    "chat_id": chat_id,
                    "type": "RESTOCK",
                    "contact_name": user_name,
                    "item": "Milk",
                    "quantity": 25.0,
                    "value": 2500.0, # 25 Liters * cost_price (Rs 100)
                    "warehouse_id": 1, # Alpha Depot
                    "reason": "Supplier Alice proposed Full Cream Milk restock due to low warehouse levels."
                })
                
        # Analyze Bob (Hardware Buyer) Chat
        elif "bob" in chat_id.lower() or "hardware" in user_name.lower():
            has_wire_request = any(
                "copper wire" in m.get("text", "").lower() or "buy 50" in m.get("text", "").lower()
                for m in messages
            )
            if has_wire_request:
                incomplete_orders.append({
                    "chat_id": chat_id,
                    "type": "SALE",
                    "contact_name": user_name,
                    "item": "Wire",
                    "quantity": 50.0,
                    "value": 2250.0, # 50 meters * selling_price (Rs 45)
                    "warehouse_id": 1, # Alpha Depot
                    "reason": "Customer Bob requested 50 meters of Copper Wire in chat."
                })
                
        # Analyze Charlie (Alpha Depot Manager) Chat
        elif "charlie" in chat_id.lower() or "depot" in user_name.lower():
            # General helper fallback
            has_stock_ready = any(
                "ready" in m.get("text", "").lower() for m in messages
            )
            if has_stock_ready:
                incomplete_orders.append({
                    "chat_id": chat_id,
                    "type": "ADJUSTMENT",
                    "contact_name": user_name,
                    "item": "Bread",
                    "quantity": 20.0,
                    "value": 0.0,
                    "warehouse_id": 1,
                    "reason": "Manager Charlie indicated stock readiness for Bread."
                })

    return incomplete_orders
