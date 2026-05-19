import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle, Package, Plus, RefreshCw } from 'lucide-react-native';
import { Theme } from '../../core/theme';

interface Props {
  profitSummary: any;
  suggestions: any[];
  inventory: any[];
  orders: any[];
  onRecordSale: () => void;
  onAddStock: () => void;
  onNewOrder: () => void;
  onRefresh: () => void;
}

const AnimatedKpiCard = ({ label, value, sub, color, icon: Icon, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.kpiCard, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.kpiIconWrap, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </Animated.View>
  );
};

const fmt = (n: number) => {
  if (!n) return 'Rs 0';
  if (n >= 1000000) return `Rs ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `Rs ${(n / 1000).toFixed(1)}K`;
  return `Rs ${n.toFixed(0)}`;
};

export const OverviewDashboard: React.FC<Props> = ({
  profitSummary, suggestions, inventory, orders, onRecordSale, onAddStock, onNewOrder, onRefresh
}) => {
  const summary = profitSummary || {};
  const totalRevenue = summary.total_revenue || 0;
  const totalProfit = summary.total_profit || 0;
  const totalMargin = summary.total_margin_pct || 0;
  const lowStockCount = summary.low_stock_count || suggestions?.length || 0;
  const perProduct: any[] = summary.per_product || [];

  const pendingOrders = orders?.filter((o: any) => o.status === 'PENDING').length || 0;
  const fulfilledOrders = orders?.filter((o: any) => o.status === 'FULFILLED').length || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Business Overview</Text>
          <Text style={styles.subtitle}>LIVE ERP ANALYTICS DASHBOARD</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={16} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <AnimatedKpiCard
          label="TOTAL REVENUE"
          value={fmt(totalRevenue)}
          sub="All time sales"
          color={Theme.colors.primary}
          icon={DollarSign}
          delay={0}
        />
        <AnimatedKpiCard
          label="GROSS PROFIT"
          value={fmt(totalProfit)}
          sub={`${totalMargin.toFixed(1)}% margin`}
          color={totalProfit >= 0 ? '#00FFA3' : Theme.colors.error}
          icon={totalProfit >= 0 ? TrendingUp : TrendingDown}
          delay={80}
        />
        <AnimatedKpiCard
          label="PENDING ORDERS"
          value={`${pendingOrders}`}
          sub={`${fulfilledOrders} fulfilled`}
          color={Theme.colors.secondary}
          icon={ShoppingCart}
          delay={160}
        />
        <AnimatedKpiCard
          label="LOW STOCK ALERTS"
          value={`${lowStockCount}`}
          sub={`${inventory?.length || 0} total items`}
          color={lowStockCount > 0 ? Theme.colors.error : Theme.colors.primary}
          icon={AlertTriangle}
          delay={240}
        />
      </View>

      {/* Quick Action Bar */}
      <View style={styles.actionBar}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: Theme.colors.primary }]} onPress={onRecordSale}>
            <DollarSign size={16} color={Theme.colors.primary} />
            <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Record Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,196,0,0.1)', borderColor: Theme.colors.secondary }]} onPress={onAddStock}>
            <Package size={16} color={Theme.colors.secondary} />
            <Text style={[styles.actionBtnText, { color: Theme.colors.secondary }]}>Add Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(0,176,255,0.1)', borderColor: '#00B0FF' }]} onPress={onNewOrder}>
            <Plus size={16} color="#00B0FF" />
            <Text style={[styles.actionBtnText, { color: '#00B0FF' }]}>New Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Per-Product Profit Breakdown */}
      {perProduct.length > 0 && (
        <View style={styles.profitSection}>
          <Text style={styles.sectionTitle}>Profit by Product</Text>
          {perProduct.map((p: any, i: number) => {
            const barPct = perProduct[0]?.profit > 0 ? Math.max(p.profit / perProduct[0].profit, 0) : 0;
            return (
              <View key={p.product_id || i} style={styles.profitRow}>
                <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
                <View style={styles.profitTop}>
                  <Text style={styles.profitName}>{p.product_name}</Text>
                  <View style={styles.profitBadges}>
                    <Text style={[styles.profitValue, { color: p.profit >= 0 ? '#00FFA3' : Theme.colors.error }]}>
                      {fmt(p.profit)}
                    </Text>
                    <View style={[styles.marginBadge, { backgroundColor: p.margin_pct >= 20 ? 'rgba(0,255,163,0.15)' : 'rgba(255,145,0,0.15)', borderColor: p.margin_pct >= 20 ? '#00FFA3' : Theme.colors.warning }]}>
                      <Text style={[styles.marginText, { color: p.margin_pct >= 20 ? '#00FFA3' : Theme.colors.warning }]}>{p.margin_pct.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(barPct * 100)}%`, backgroundColor: p.profit >= 0 ? Theme.colors.primary : Theme.colors.error }]} />
                </View>
                <View style={styles.profitMeta}>
                  <Text style={styles.profitMetaText}>Revenue: {fmt(p.revenue)}</Text>
                  <Text style={styles.profitMetaText}>Cost: {fmt(p.cost)}</Text>
                  <Text style={styles.profitMetaText}>Sold: {p.qty_sold} units</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Low Stock Alerts Preview */}
      {suggestions?.length > 0 && (
        <View style={styles.alertSection}>
          <View style={styles.alertHeader}>
            <AlertTriangle size={16} color={Theme.colors.error} />
            <Text style={styles.alertTitle}>⚠️ Reorder Alerts ({suggestions.length})</Text>
          </View>
          {suggestions.slice(0, 3).map((s: any, i: number) => (
            <View key={i} style={[styles.alertCard, { borderColor: s.urgency === 'CRITICAL' ? Theme.colors.error : s.urgency === 'HIGH' ? Theme.colors.warning : '#FFB800' }]}>
              <LinearGradient
                colors={[s.urgency === 'CRITICAL' ? 'rgba(255,42,85,0.08)' : 'rgba(255,145,0,0.06)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.alertCardRow}>
                <View style={[styles.urgencyDot, { backgroundColor: s.urgency === 'CRITICAL' ? Theme.colors.error : s.urgency === 'HIGH' ? Theme.colors.warning : '#FFB800' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertProductName}>{s.product_name}</Text>
                  <Text style={styles.alertMeta}>{s.warehouse_name} · Stock: {s.current_stock} · Threshold: {s.threshold}</Text>
                </View>
                <View style={[styles.urgencyBadge, { backgroundColor: s.urgency === 'CRITICAL' ? 'rgba(255,42,85,0.2)' : 'rgba(255,145,0,0.2)' }]}>
                  <Text style={[styles.urgencyText, { color: s.urgency === 'CRITICAL' ? Theme.colors.error : Theme.colors.warning }]}>{s.urgency}</Text>
                </View>
              </View>
            </View>
          ))}
          {suggestions.length > 3 && (
            <Text style={styles.moreAlerts}>+{suggestions.length - 3} more alerts. Check System 2 Agent.</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Theme.spacing.lg },
  kpiCard: { width: '48%', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: Theme.spacing.sm },
  kpiLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  kpiSub: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },

  // Quick Actions
  actionBar: { marginBottom: Theme.spacing.lg },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.sm, letterSpacing: -0.3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, height: 48, borderRadius: Theme.borderRadius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },

  // Profit breakdown
  profitSection: { marginBottom: Theme.spacing.lg },
  profitRow: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm, overflow: 'hidden' },
  profitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  profitName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  profitBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profitValue: { fontSize: 16, fontWeight: '900' },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  marginText: { fontSize: 11, fontWeight: '800' },
  barTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  profitMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  profitMetaText: { color: Theme.colors.textMuted, fontSize: 11 },

  // Alert section
  alertSection: { marginBottom: Theme.spacing.lg },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Theme.spacing.sm },
  alertTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  alertCard: { borderRadius: Theme.borderRadius.md, borderWidth: 1.5, padding: Theme.spacing.md, marginBottom: Theme.spacing.xs, overflow: 'hidden' },
  alertCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  alertProductName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  alertMeta: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  urgencyText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  moreAlerts: { color: Theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
});
