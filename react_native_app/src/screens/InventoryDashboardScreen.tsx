import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert, Animated, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { Download, RefreshCw, LayoutDashboard, Package, FileText, ShoppingCart, Activity, Warehouse } from 'lucide-react-native';

import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { OverviewDashboard } from '../components/inventory/OverviewDashboard';
import { ProductManager } from '../components/inventory/ProductManager';
import { OrderManager } from '../components/inventory/OrderManager';
import { ActivityLogViewer } from '../components/inventory/ActivityLogViewer';
import { WarehouseManager } from '../components/inventory/WarehouseManager';

// Removed: SalesManager, SupplierManager (Suppliers are in Agent tab, Sales are in Activity log)
type SubTab = 'overview' | 'stock' | 'orders' | 'warehouses' | 'activity';

const TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'stock',     label: 'Stock',     icon: Package },
  { id: 'orders',    label: 'Orders',    icon: ShoppingCart },
  { id: 'warehouses',label: 'Warehouses',icon: Warehouse },
  { id: 'activity',  label: 'Activity',  icon: Activity },
];

export const InventoryDashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);

  const [inventory, setInventory] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState<any>(null);

  const contentOpacity = useRef(new Animated.Value(0)).current;

  const fetchData = async () => {
    setIsLoading(true);
    Animated.timing(contentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    try {
      const [inv, preds, suggs, wh, ords, profit] = await Promise.all([
        ApiService.getProducts(),
        ApiService.getDemandPredictions(),
        ApiService.getReorderSuggestions(),
        ApiService.getWarehouses(),
        ApiService.getOrders().catch(() => []),
        ApiService.getProfitSummary().catch(() => null),
      ]);
      setInventory(inv);
      setPredictions(preds);
      setSuggestions(suggs);
      setWarehouses(wh);
      setOrders(ords);
      setProfitSummary(profit);
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
      Linking.openURL(`http://localhost:8000/api/export/csv`).catch(err => Alert.alert('Error', err.message));
    } catch (e: any) {
      Alert.alert('Download Failed', e.message);
    } finally {
      setIsDownloadingCSV(false);
    }
  };

  const pendingOrders  = orders.filter(o => o.status === 'PENDING').length;
  const lowStockCount  = suggestions.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ERP Hub</Text>
          <Text style={styles.subtitle}>BUSINESS OPERATIONS CENTER</Text>
        </View>
        <View style={styles.headerButtons}>
          {pendingOrders > 0 && (
            <TouchableOpacity style={[styles.badge, { borderColor: Theme.colors.secondary }]} onPress={() => setActiveTab('orders')}>
              <Text style={[styles.badgeText, { color: Theme.colors.secondary }]}>📋 {pendingOrders}</Text>
            </TouchableOpacity>
          )}
          {lowStockCount > 0 && (
            <TouchableOpacity style={[styles.badge, { borderColor: Theme.colors.error }]} onPress={() => setActiveTab('stock')}>
              <Text style={[styles.badgeText, { color: Theme.colors.error }]}>⚠️ {lowStockCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadCSV} disabled={isDownloadingCSV}>
            {isDownloadingCSV ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Download color={Theme.colors.primary} size={18} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={fetchData}>
            <RefreshCw color={Theme.colors.textMuted} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabWrapper}>
        <BlurView intensity={30} tint="dark" style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Icon size={14} color={isActive ? '#FFF' : Theme.colors.textMuted} />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BlurView>
      </View>

      {/* Content — Activity tab doesn't need the scrollContainer wrapper */}
      {activeTab === 'activity' ? (
        <ActivityLogViewer />
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={Theme.colors.primary} />
              <Text style={styles.loaderText}>Syncing ERP Data...</Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: contentOpacity }}>
              {activeTab === 'overview' && (
                <OverviewDashboard
                  profitSummary={profitSummary}
                  suggestions={suggestions}
                  inventory={inventory}
                  orders={orders}
                  onRecordSale={() => setActiveTab('stock')}
                  onAddStock={() => setActiveTab('stock')}
                  onNewOrder={() => setActiveTab('orders')}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'stock' && (
                <ProductManager inventory={inventory} onRefresh={fetchData} />
              )}
              {activeTab === 'orders' && (
                <OrderManager
                  orders={orders}
                  inventory={inventory}
                  warehouses={warehouses}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'warehouses' && (
                <WarehouseManager
                  warehouses={warehouses}
                  onRefresh={fetchData}
                />
              )}
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.sm,
  },
  title: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: Theme.colors.primary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginTop: 2 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: Theme.borderRadius.pill, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, height: 30, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '800' },

  tabWrapper: { marginHorizontal: Theme.spacing.md, marginBottom: Theme.spacing.md, borderRadius: Theme.borderRadius.pill, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.border },
  tabContainer: { backgroundColor: Theme.colors.glass },
  tabScroll: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 4, gap: 2 },
  tabButton: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', gap: 5, borderRadius: Theme.borderRadius.pill },
  tabButtonActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabText: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#FFF', fontWeight: 'bold' },

  scrollContainer: { flex: 1 },
  contentContainer: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.xxl * 2 },
  loaderContainer: { marginTop: 100, alignItems: 'center', justifyContent: 'center' },
  loaderText: { color: Theme.colors.textMuted, marginTop: 16, fontSize: 14, letterSpacing: 1 },
});
