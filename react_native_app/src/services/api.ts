import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If you are using a physical phone with Expo Go, change this to your computer's local IP (e.g., 'http://192.168.1.100:8000/api')
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api';
  } else if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api'; // Standard loopback to host from Android Emulator
  } else {
    return 'http://localhost:8000/api'; // iOS Simulator loopback
  }
};

const BASE_URL = getBaseUrl();

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

  async getWarehouses(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/warehouses`);
    if (!response.ok) throw new Error('Failed to fetch warehouses');
    return response.json();
  },

  async syncSheets(): Promise<any> {
    const response = await fetch(`${BASE_URL}/sheets/sync`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to sync sheets');
    return response.json();
  },

  async getProducts(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async addProduct(data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/products/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to add product');
    }
    return response.json();
  },

  async getSuppliers(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/suppliers`);
    if (!response.ok) throw new Error('Failed to fetch suppliers');
    return response.json();
  },

  async addSupplier(data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/suppliers/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to add supplier');
    }
    return response.json();
  },

  async getTransactions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/transactions`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },

  async getDemandPredictions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/inventory/predictions`);
    if (!response.ok) throw new Error('Failed to fetch predictions');
    return response.json();
  },

  async getReorderSuggestions(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/inventory/suggestions`);
    if (!response.ok) throw new Error('Failed to fetch reorder suggestions');
    return response.json();
  },

  async recordTransaction(type: 'sale' | 'restock' | 'adjustment', data: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/transactions/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chats),
    });
    if (!response.ok) throw new Error('Failed to scan chats');
    return response.json();
  }
};
