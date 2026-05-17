const BASE_URL = 'http://127.0.0.1:8000/api';

export interface OrderResponse {
  execution_status: string;
  trace_logs: string[];
  intent: any;
  provider: any;
}

export const ApiService = {
  async sendOrder(message: string): Promise<OrderResponse> {
    const response = await fetch(`${BASE_URL}/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Failed to send order');
    return response.json();
  },

  async getProducts(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async getTransactions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/transactions`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },

  async recordTransaction(type: 'sale' | 'restock', data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/transactions/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to record ${type}`);
    return response.json();
  }
};
