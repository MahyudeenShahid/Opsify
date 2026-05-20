import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert, Animated, Linking, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Download, RefreshCw, LayoutDashboard, Package, FileText, ShoppingCart, Activity, Warehouse } from 'lucide-react-native';

import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { useAppData } from '../core/AppDataContext';
import { OverviewDashboard } from '../components/inventory/OverviewDashboard';
import { ProductManager } from '../components/inventory/ProductManager';
import { OrderManager } from '../components/inventory/OrderManager';
import { ActivityLogViewer } from '../components/inventory/ActivityLogViewer';
import { WarehouseManager } from '../components/inventory/WarehouseManager';

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────
const ShimmerSkeleton = () => {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const SkeletonBlock = ({ height = 60, width = '100%' as any, borderRadius = 12, style = {} as any }) => (
    <Animated.View style={[{ height, width, borderRadius, backgroundColor: Theme.colors.surfaceMid, marginBottom: 12, opacity }, style]} />
  );
  return (
    <View style={{ padding: 16, gap: 4 }}>
      <SkeletonBlock height={30} width="55%" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonBlock height={90} width="48%" />
        <SkeletonBlock height={90} width="48%" />
      </View>
      <SkeletonBlock height={60} />
      <SkeletonBlock height={60} />
      <SkeletonBlock height={60} />
    </View>
  );
};

// ─── Animated Tab Button ──────────────────────────────────────────────────────
const AnimatedTabButton = ({ tab, isActive, onPress }: { tab: typeof TABS[0]; isActive: boolean; onPress: () => void }) => {
  const scale   = React.useRef(new Animated.Value(1)).current;
  const bgAnim  = React.useRef(new Animated.Value(isActive ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(bgAnim, { toValue: isActive ? 1 : 0, ...Theme.animation.springFast, useNativeDriver: false }).start();
  }, [isActive]);
  const Icon = tab.icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, ...Theme.animation.springFast, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...Theme.animation.spring, useNativeDriver: true }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[styles.tabButton, isActive && styles.tabButtonActive, { transform: [{ scale }] }]}>
        <Icon size={14} color={isActive ? Theme.colors.primary : Theme.colors.textMuted} />
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};
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
  const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);

  const { inventory, orders, warehouses, suggestions, predictions, profitSummary, isLoading, refresh, refreshOrders } = useAppData();

  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only refresh if not already fresh – context handles debouncing
    refresh();
  }, []);

  // Fade in when data arrives
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      Animated.timing(contentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isLoading]);

  const fetchData = () => refresh(true);

  const handleDownloadCSV = async () => {
    setIsDownloadingCSV(true);
    try {
      const url = ApiService.getExportCsvUrl();
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'opsify_ledger_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open export URL: ' + url);
        }
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        (window as any).alert('Download Failed: ' + e.message);
      } else {
        Alert.alert('Download Failed', e.message);
      }
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
      </View>

      <View style={styles.headerButtonsRow}>
        {pendingOrders > 0 && (
          <TouchableOpacity style={[styles.badge, { borderColor: Theme.colors.secondary }]} onPress={() => setActiveTab('orders')}>
            <Text style={[styles.badgeText, { color: Theme.colors.secondary }]}>📋 {pendingOrders} Pending</Text>
          </TouchableOpacity>
        )}
        {lowStockCount > 0 && (
          <TouchableOpacity style={[styles.badge, { borderColor: Theme.colors.error }]} onPress={() => setActiveTab('stock')}>
            <Text style={[styles.badgeText, { color: Theme.colors.error }]}>⚠️ {lowStockCount} Alerts</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadCSV} disabled={isDownloadingCSV}>
          {isDownloadingCSV ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Download color={Theme.colors.primary} size={16} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={fetchData}>
          <RefreshCw color={Theme.colors.textMuted} size={16} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabWrapper}>
        <BlurView intensity={30} tint="dark" style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map(tab => (
              <AnimatedTabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onPress={() => setActiveTab(tab.id)}
              />
            ))}
          </ScrollView>
        </BlurView>
      </View>

      {/* Content — Activity tab doesn't need the scrollContainer wrapper */}
      {activeTab === 'activity' ? (
        <ActivityLogViewer />
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ShimmerSkeleton />
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
                  onRefresh={refreshOrders}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.xs,
  },
  title: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  subtitle: { color: Theme.colors.primary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginTop: 2 },
  
  headerButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Theme.spacing.md, marginBottom: Theme.spacing.md },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 12, height: 32, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '800' },

  tabWrapper: { marginHorizontal: Theme.spacing.md, marginBottom: Theme.spacing.md, borderRadius: Theme.borderRadius.pill, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.border },
  tabContainer: { backgroundColor: Theme.colors.glass },
  tabScroll: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 4, gap: 2 },
  tabButton: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', gap: 5, borderRadius: Theme.borderRadius.pill },
  tabButtonActive: {
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.25)',
  },
  tabText: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: Theme.colors.primary, fontWeight: '800' },

  scrollContainer: { flex: 1 },
  contentContainer: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.xxl * 2 },
  loaderContainer: { marginTop: 100, alignItems: 'center', justifyContent: 'center' },
  loaderText: { color: Theme.colors.textMuted, marginTop: 16, fontSize: 14, letterSpacing: 1 },
});
