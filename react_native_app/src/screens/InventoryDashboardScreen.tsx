import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert, Animated, TextInput, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { Download, RefreshCw, BarChart2, Package, Users, FileText, Check, Link } from 'lucide-react-native';

import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { PredictiveDashboard } from '../components/inventory/PredictiveDashboard';
import { ProductManager } from '../components/inventory/ProductManager';
import { SupplierManager } from '../components/inventory/SupplierManager';
import { TransactionManager } from '../components/inventory/TransactionManager';

type SubTab = 'insights' | 'products' | 'suppliers' | 'transactions';

const TABS: { id: SubTab, label: string, icon: any }[] = [
  { id: 'insights', label: 'Insights', icon: BarChart2 },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'suppliers', label: 'Suppliers', icon: Users },
  { id: 'transactions', label: 'Ledger', icon: FileText }
];

export const InventoryDashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('insights');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);

  // Global State for UI
  const [inventory, setInventory] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Animations
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const fetchData = async () => {
    setIsLoading(true);
    Animated.timing(contentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    try {
      const [inv, led, preds, suggs, wh] = await Promise.all([
        ApiService.getProducts(),
        ApiService.getTransactions(),
        ApiService.getDemandPredictions(),
        ApiService.getReorderSuggestions(),
        ApiService.getWarehouses()
      ]);
      setInventory(inv);
      setLedger(led);
      setPredictions(preds);
      setSuggestions(suggs);
      setWarehouses(wh);
      
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDownloadCSV = async () => {
    setIsDownloadingCSV(true);
    try {
      const url = `http://localhost:8000/api/export/csv`;
      Linking.openURL(url).catch(err => {
        Alert.alert("Failed to open URL", err.message);
      });
    } catch (e: any) {
      Alert.alert("Download Failed", e.message);
    } finally {
      setIsDownloadingCSV(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Data Ledger</Text>
          <Text style={styles.subtitle}>Inventory & Analytics Hub</Text>
        </View>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadCSV} disabled={isDownloadingCSV}>
            {isDownloadingCSV ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Download color={Theme.colors.primary} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={fetchData}>
            <RefreshCw color={Theme.colors.textMuted} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Glassmorphic Tab Container */}
      <View style={styles.tabWrapper}>
        <BlurView intensity={30} tint="dark" style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <TouchableOpacity 
                key={tab.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={isActive ? '#FFF' : Theme.colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loaderText}>Syncing Ledger Nodes...</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: contentOpacity }}>
            {activeTab === 'insights' && <PredictiveDashboard
              predictions={predictions}
              suggestions={suggestions}
              products={inventory}
              warehouses={warehouses}
              onProcurementApproved={fetchData}
            />}
            {activeTab === 'products' && <ProductManager inventory={inventory} onRefresh={fetchData} />}
            {activeTab === 'suppliers' && <SupplierManager />}
            {activeTab === 'transactions' && <TransactionManager ledger={ledger} onRefresh={fetchData} />}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: Theme.colors.primary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.pill,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.glow,
  },


  tabWrapper: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.pill,
    overflow: 'hidden',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.glass,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.pill,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl * 2, // Space for global floating nav
  },
  loaderContainer: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: Theme.colors.textMuted,
    marginTop: 16,
    fontSize: 14,
    letterSpacing: 1,
  }
});
