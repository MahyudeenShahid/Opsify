/**
 * AppDataContext — Single global source of truth for all shared ERP data.
 * Both ERPAgentScreen and InventoryDashboardScreen consume from this context
 * instead of each fetching their own copy, eliminating all duplicate requests.
 */
import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ApiService } from '../services/api';

interface AppData {
  inventory: any[];
  orders: any[];
  warehouses: any[];
  suggestions: any[];
  predictions: any[];
  suppliers: any[];
  products: any[];
  profitSummary: any;
  isLoading: boolean;
  lastFetched: number | null;
}

interface AppDataContextType extends AppData {
  refresh: (force?: boolean) => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<any[]>>;
  // products is inherited from AppData
}

const CACHE_TTL_MS = 30_000; // 30 seconds — don't re-fetch if data is fresh

const AppDataContext = createContext<AppDataContextType | null>(null);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchingRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    // Guard: Don't fetch if already fetching or if data is still fresh
    if (fetchingRef.current) return;
    if (!force && lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return;

    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const [inv, preds, suggs, wh, ords, sups, profit] = await Promise.all([
        ApiService.getProducts(),
        ApiService.getDemandPredictions(),
        ApiService.getReorderSuggestions(),
        ApiService.getWarehouses(),
        ApiService.getOrders().catch(() => []),
        ApiService.getSuppliers(),
        ApiService.getProfitSummary().catch(() => null),
      ]);
      setInventory(inv);
      setProducts(inv); // products alias = inventory list
      setPredictions(preds);
      setSuggestions(suggs);
      setWarehouses(wh);
      setOrders(ords);
      setSuppliers(sups);
      setProfitSummary(profit);
      setLastFetched(Date.now());
    } catch (e) {
      console.error('[AppDataContext] refresh error:', e);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [lastFetched]);

  const refreshOrders = useCallback(async () => {
    try {
      const ords = await ApiService.getOrders();
      setOrders(ords);
    } catch (e) {
      console.error('[AppDataContext] refreshOrders error:', e);
    }
  }, []);

  const refreshSuppliers = useCallback(async () => {
    try {
      const sups = await ApiService.getSuppliers();
      setSuppliers(sups);
    } catch (e) {
      console.error('[AppDataContext] refreshSuppliers error:', e);
    }
  }, []);

  return (
    <AppDataContext.Provider value={{
      inventory, orders, warehouses, suggestions, predictions, suppliers, products,
      profitSummary, isLoading, lastFetched,
      refresh, refreshOrders, refreshSuppliers,
      setOrders, setSuppliers,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
};
