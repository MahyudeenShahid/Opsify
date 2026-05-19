import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If using a physical phone with Expo Go, set your computer's local IP here.
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api';
  } else if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api'; // Loopback to host from Android Emulator
  } else {
    return 'http://localhost:8000/api'; // iOS Simulator loopback
  }
};

const BASE_URL = getBaseUrl();

// Reads EXPO_PUBLIC_OPSIFY_API_KEY or OPSIFY_API_KEY from environment.
const API_KEY = (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_OPSIFY_API_KEY || process.env?.OPSIFY_API_KEY)) || '';

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
};


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
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Failed to send order');
    return response.json();
  },

  async getWarehouses(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/warehouses`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch warehouses');
    return response.json();
  },

  async syncSheets(sheetName?: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/sheets/sync`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ sheet_name: sheetName || null }),
    });
    if (!response.ok) throw new Error('Failed to sync sheets');
    return response.json();
  },

  async getProducts(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/products`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async addProduct(data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/products/add`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to add product');
    }
    return response.json();
  },

  async getSuppliers(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/suppliers`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch suppliers');
    return response.json();
  },

  async addSupplier(data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/suppliers/add`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to add supplier');
    }
    return response.json();
  },

  async getTransactions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/transactions`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },

  async getDemandPredictions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/inventory/predictions`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch predictions');
    return response.json();
  },

  async getReorderSuggestions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/inventory/suggestions`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch reorder suggestions');
    return response.json();
  },

  async recordTransaction(type: 'sale' | 'restock' | 'adjustment', data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/transactions/${type}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || `Failed to record ${type}`);
    }
    return response.json();
  },

  async scanChats(chats: any[]): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/agents/scan-chats`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(chats),
    });
    if (!response.ok) throw new Error('Failed to scan chats');
    return response.json();
  },

  async deepScanChats(chatsWithMessages: any[]): Promise<any> {
    const response = await fetch(`${BASE_URL}/agents/deep-scan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(chatsWithMessages),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Deep scan failed');
    }
    return response.json();
  },

  async getScanState(): Promise<any> {
    const response = await fetch(`${BASE_URL}/agents/scan-state`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to get scan state');
    return response.json();
  },

  async rejectOrder(order: { chat_id: string; item: string; quantity: number; type: string }): Promise<any> {
    const response = await fetch(`${BASE_URL}/agents/reject-order`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(order),
    });
    if (!response.ok) throw new Error('Failed to reject order');
    return response.json();
  },


  async searchVendors(query: string, location: string): Promise<any[]> {
    const response = await fetch(
      `${BASE_URL}/vendors/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`,
      { headers: authHeaders() }
    );
    if (!response.ok) throw new Error('Failed to search vendors');
    const res = await response.json();
    return res.vendors;
  },

  // ─── System 3: Action Brain ───────────────────────────────────────────
  async dispatchJob(data: {
    order_id: string;
    destination: string;
    item: string;
    customer_name: string;
    customer_phone: string;
  }): Promise<any> {
    const response = await fetch(`${BASE_URL}/action/dispatch`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to dispatch job');
    }
    return response.json();
  },

  async advanceJob(jobId: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/action/jobs/${jobId}/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to advance job');
    }
    return response.json();
  },

  async getJob(jobId: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/action/jobs/${jobId}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Job not found');
    return response.json();
  },

  async listJobs(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/action/jobs`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to list jobs');
    return response.json();
  },

  async listRiders(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/action/riders`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to list riders');
    return response.json();
  },

  async listZones(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/action/zones`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to list zones');
    const res = await response.json();
    return res.zones;
  },

  // ─── System 2: Procurement & Chat ────────────────────────────────────────
  async getSupplierSuggestions(productName: string, lat: number, lng: number): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/procurement/suggest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ product_name: productName, lat, lng }),
    });
    if (!response.ok) throw new Error('Failed to fetch vendor suggestions');
    const res = await response.json();
    return res.suggestions;
  },

  async approveProcurement(data: {
    product_id: number;
    warehouse_id: number;
    quantity: number;
    vendor: any;
  }): Promise<any> {
    const response = await fetch(`${BASE_URL}/procurement/approve`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Procurement approval failed');
    }
    return response.json();
  },

  async sendChatMessage(messages: { role: 'user' | 'assistant'; content: string }[], userId?: string): Promise<any> {
    const body: any = { messages };
    if (userId) body.user_id = userId;

    const response = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Chat failed');
    }
    return response.json();
  },

  async getAgriDemandFeed(lat?: number, lng?: number): Promise<any> {
    const response = await fetch(`${BASE_URL}/agri/demand-feed?lat=${lat || 24.8138}&lng=${lng || 67.0366}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch agricultural demand feed');
    return response.json();
  },

  async dispatchAgriShared(lat?: number, lng?: number): Promise<any> {
    const response = await fetch(`${BASE_URL}/agri/dispatch-shared`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ lat: lat || 24.8138, lng: lng || 67.0366 }),
    });
    if (!response.ok) throw new Error('Failed to dispatch shared logistics');
    return response.json();
  },

  getExportCsvUrl(): string {
    return `${BASE_URL}/export/csv`;
  },

  // ─── Product CRUD ─────────────────────────────────────────────────────────
  async updateProduct(id: number, data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to update product');
    }
    return response.json();
  },

  async deleteProduct(id: number): Promise<any> {
    const response = await fetch(`${BASE_URL}/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete product');
    }
    return response.json();
  },

  // ─── Supplier CRUD ────────────────────────────────────────────────────────
  async updateSupplier(id: number, data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to update supplier');
    }
    return response.json();
  },

  async deleteSupplier(id: number): Promise<any> {
    const response = await fetch(`${BASE_URL}/suppliers/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete supplier');
    }
    return response.json();
  },

  async deleteAllSuppliers(): Promise<any> {
    const response = await fetch(`${BASE_URL}/suppliers/all`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete all suppliers');
    }
    return response.json();
  },

  // ─── Orders CRUD ──────────────────────────────────────────────────────────
  async getOrders(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/orders`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
  },

  async addOrder(data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/orders/add`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to create order');
    }
    return response.json();
  },

  async updateOrderStatus(id: number, status: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to update order status');
    }
    return response.json();
  },

  async deleteOrder(id: number): Promise<any> {
    const response = await fetch(`${BASE_URL}/orders/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete order');
    }
    return response.json();
  },

  // ─── Analytics ────────────────────────────────────────────────────────────
  async getProfitSummary(): Promise<any> {
    const response = await fetch(`${BASE_URL}/analytics/profit`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch profit summary');
    return response.json();
  },
};

