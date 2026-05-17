import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

import { PredictiveDashboard } from '../components/inventory/PredictiveDashboard';
import { ProductManager } from '../components/inventory/ProductManager';
import { SupplierManager } from '../components/inventory/SupplierManager';
import { TransactionManager } from '../components/inventory/TransactionManager';

type SubTab = 'insights' | 'products' | 'suppliers' | 'transactions';

export const InventoryDashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('insights');
  const [isLoading, setIsLoading] = useState(false);

  // Global State for UI
  const [inventory, setInventory] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const inv = await ApiService.getProducts();
      const led = await ApiService.getTransactions();
      const preds = await ApiService.getDemandPredictions();
      const suggs = await ApiService.getReorderSuggestions();
      
      setInventory(inv);
      setLedger(led);
      setPredictions(preds);
      setSuggestions(suggs);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Opsify: ERP Hub</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
          <Text style={styles.refreshButtonText}>Refresh Data</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Navigation Tabs */}
      <View style={styles.tabContainer}>
        {(['insights', 'products', 'suppliers', 'transactions'] as SubTab[]).map((tab) => (
          <TouchableOpacity 
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
        ) : (
          <>
            {activeTab === 'insights' && <PredictiveDashboard predictions={predictions} suggestions={suggestions} />}
            {activeTab === 'products' && <ProductManager inventory={inventory} onRefresh={fetchData} />}
            {activeTab === 'suppliers' && <SupplierManager />}
            {activeTab === 'transactions' && <TransactionManager ledger={ledger} onRefresh={fetchData} />}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
  },
  refreshButtonText: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
    padding: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    borderRadius: Theme.borderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: Theme.colors.border,
  },
  tabText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: Theme.colors.text,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
  },
  loader: {
    marginTop: Theme.spacing.xl,
  },
});
