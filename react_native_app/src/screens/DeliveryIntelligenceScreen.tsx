import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Animated, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Navigation, Package, Clock, CheckCircle, Truck, MapPin,
  Phone, Send, ChevronDown, ChevronUp, RefreshCw, User,
  AlertTriangle, Zap, Box, XCircle,
} from 'lucide-react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

// ── Status pipeline ───────────────────────────────────────────────────────────
const STATUS_STEPS = ['PENDING', 'PACKED', 'DISPATCHED', 'FULFILLED'] as const;
type OrderStatus = typeof STATUS_STEPS[number] | 'CANCELLED';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  PENDING:    { color: '#FFB800', bg: 'rgba(255,184,0,0.1)',   label: 'Pending',    emoji: '🕐' },
  PACKED:     { color: '#00B0FF', bg: 'rgba(0,176,255,0.1)',   label: 'Packed',     emoji: '📦' },
  DISPATCHED: { color: '#9B59B6', bg: 'rgba(155,89,182,0.1)', label: 'Dispatched', emoji: '🚚' },
  FULFILLED:  { color: Theme.colors.primary, bg: 'rgba(0,230,118,0.1)', label: 'Delivered', emoji: '✅' },
  CANCELLED:  { color: Theme.colors.error,   bg: 'rgba(255,42,85,0.1)',  label: 'Cancelled', emoji: '❌' },
};

function relativeTime(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const diff  = Date.now() - new Date(isoStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (hours < 1)   return 'Just now';
    if (hours < 24)  return `${hours}h ago`;
    if (days === 1)  return 'Yesterday';
    return `${days} days ago`;
  } catch { return ''; }
}

function estimatedDelivery(createdAt?: string, leadDays = 2): string {
  if (!createdAt) return 'Unknown';
  try {
    const date = new Date(createdAt);
    date.setDate(date.getDate() + leadDays);
    return date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  } catch { return 'Unknown'; }
}

// ── Dispatch Modal ────────────────────────────────────────────────────────────
const DispatchModal: React.FC<{
  order: any;
  visible: boolean;
  onClose: () => void;
  onDispatched: () => void;
}> = ({ order, visible, onClose, onDispatched }) => {
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDispatch = async () => {
    if (!courierName.trim() || !courierPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter courier name and phone number.');
      return;
    }
    setIsLoading(true);
    try {
      await ApiService.dispatchOrder(order.id, courierName.trim(), courierPhone.trim());
      onDispatched();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <LinearGradient colors={['rgba(26,34,52,0.98)', 'rgba(17,22,34,0.98)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Truck size={18} color={Theme.colors.primary} />
            <Text style={styles.modalTitle}>Assign Courier</Text>
            <TouchableOpacity onPress={onClose}><XCircle size={20} color={Theme.colors.textMuted} /></TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Order #{order?.id} · {order?.customer_name}
          </Text>

          <Text style={styles.inputLabel}>Courier Name</Text>
          <TextInput
            style={styles.modalInput}
            value={courierName}
            onChangeText={setCourierName}
            placeholder="e.g. Ahmed Ali"
            placeholderTextColor={Theme.colors.textMuted}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.modalInput}
            value={courierPhone}
            onChangeText={setCourierPhone}
            placeholder="+92-300-1234567"
            placeholderTextColor={Theme.colors.textMuted}
            keyboardType="phone-pad"
          />

          <TouchableOpacity style={styles.dispatchBtn} onPress={handleDispatch} disabled={isLoading}>
            <LinearGradient colors={Theme.gradients.primary} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            {isLoading
              ? <ActivityIndicator size="small" color="#000" />
              : <><Truck size={16} color="#000" /><Text style={styles.dispatchBtnText}>Dispatch Order</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Order Card ────────────────────────────────────────────────────────────────
const OrderCard: React.FC<{
  order: any;
  onStatusChange: (id: number, status: string) => void;
  onDispatch: (order: any) => void;
  onRefresh: () => void;
}> = ({ order, onStatusChange, onDispatch, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const currentStep = STATUS_STEPS.indexOf(order.status as any);

  const handleWhatsApp = () => {
    if (!order.courier_phone) { Alert.alert('No courier assigned yet.'); return; }
    const msg = encodeURIComponent(`Hi! Your order #${order.id} (${order.product_name} × ${order.quantity}) is on the way. Tracking Ref: ${order.order_ref}`);
    Linking.openURL(`whatsapp://send?phone=${order.courier_phone}&text=${msg}`).catch(() =>
      Linking.openURL(`https://api.whatsapp.com/send?phone=${order.courier_phone}&text=${msg}`)
    );
  };

  const nextStatus = STATUS_STEPS[currentStep + 1];

  return (
    <View style={[styles.orderCard, { borderColor: `${statusCfg.color}40` }]}>
      <LinearGradient colors={[statusCfg.bg, 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />

      {/* Card Header */}
      <TouchableOpacity style={styles.cardHeaderRow} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}60` }]}>
          <Text style={styles.statusEmoji}>{statusCfg.emoji}</Text>
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.orderRef}>{order.order_ref}</Text>
          <Text style={styles.customerName}>{order.customer_name}</Text>
        </View>
        <Text style={styles.orderValue}>Rs {order.total_value?.toFixed(0)}</Text>
        {expanded ? <ChevronUp size={16} color={Theme.colors.textMuted} /> : <ChevronDown size={16} color={Theme.colors.textMuted} />}
      </TouchableOpacity>

      {/* Quick Info Row */}
      <View style={styles.quickInfoRow}>
        <View style={styles.qInfo}><Package size={11} color={Theme.colors.textMuted} /><Text style={styles.qInfoText}>{order.product_name}</Text></View>
        <View style={styles.qInfo}><Box size={11} color={Theme.colors.textMuted} /><Text style={styles.qInfoText}>×{order.quantity} {order.unit}</Text></View>
        <View style={styles.qInfo}><Clock size={11} color={Theme.colors.textMuted} /><Text style={styles.qInfoText}>{relativeTime(order.created_at)}</Text></View>
      </View>

      {/* Status Pipeline */}
      <View style={styles.pipeline}>
        {STATUS_STEPS.map((step, i) => {
          const done    = i <= currentStep;
          const isCurr  = i === currentStep;
          const stepCfg = STATUS_CONFIG[step];
          return (
            <React.Fragment key={step}>
              <View style={[styles.pipeStep, done && { borderColor: stepCfg.color, backgroundColor: `${stepCfg.color}15` }]}>
                <Text style={[styles.pipeStepText, { color: done ? stepCfg.color : Theme.colors.textMuted }]}>
                  {STATUS_CONFIG[step].emoji}
                </Text>
                <Text style={[styles.pipeStepLabel, { color: done ? stepCfg.color : Theme.colors.textMuted }]}>
                  {STATUS_CONFIG[step].label}
                </Text>
              </View>
              {i < STATUS_STEPS.length - 1 && (
                <View style={[styles.pipeConnector, done && i < currentStep && { backgroundColor: stepCfg.color }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {expanded && (
        <View style={styles.expandedSection}>
          {/* Detail rows */}
          {[
            { label: 'Order Ref', value: order.order_ref },
            { label: 'Product', value: order.product_name },
            { label: 'Qty', value: `${order.quantity} ${order.unit || 'units'}` },
            { label: 'Unit Price', value: `Rs ${order.unit_price}` },
            { label: 'Total', value: `Rs ${order.total_value?.toFixed(2)}` },
            { label: 'Warehouse', value: order.warehouse_name || 'Main' },
            { label: 'Est. Delivery', value: estimatedDelivery(order.created_at) },
            ...(order.courier_name ? [
              { label: 'Courier', value: order.courier_name },
              { label: 'Courier Ph.', value: order.courier_phone },
            ] : []),
          ].map(row => (
            <View key={row.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {order.status !== 'FULFILLED' && order.status !== 'CANCELLED' && nextStatus && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: STATUS_CONFIG[nextStatus].color, backgroundColor: STATUS_CONFIG[nextStatus].bg }]}
                onPress={() => onStatusChange(order.id, nextStatus)}
              >
                <CheckCircle size={14} color={STATUS_CONFIG[nextStatus].color} />
                <Text style={[styles.actionBtnText, { color: STATUS_CONFIG[nextStatus].color }]}>
                  Mark {STATUS_CONFIG[nextStatus].label}
                </Text>
              </TouchableOpacity>
            )}

            {order.status === 'PACKED' && !order.courier_name && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: Theme.colors.primary, backgroundColor: 'rgba(0,230,118,0.1)' }]}
                onPress={() => onDispatch(order)}
              >
                <Truck size={14} color={Theme.colors.primary} />
                <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Assign Courier</Text>
              </TouchableOpacity>
            )}

            {order.courier_phone && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#25D366', backgroundColor: 'rgba(37,211,102,0.1)' }]}
                onPress={handleWhatsApp}
              >
                <Phone size={14} color="#25D366" />
                <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            {order.status !== 'CANCELLED' && order.status !== 'FULFILLED' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: Theme.colors.error, backgroundColor: 'rgba(255,42,85,0.08)' }]}
                onPress={() => onStatusChange(order.id, 'CANCELLED')}
              >
                <XCircle size={14} color={Theme.colors.error} />
                <Text style={[styles.actionBtnText, { color: Theme.colors.error }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};


// ── Main Screen ───────────────────────────────────────────────────────────────
export const DeliveryIntelligenceScreen: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [dispatchTarget, setDispatchTarget] = useState<any | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchOrders();
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getOrders();
      setOrders(data);
    } catch (e) {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await ApiService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const FILTER_OPTIONS: { id: 'ALL' | OrderStatus; label: string; emoji: string }[] = [
    { id: 'ALL',        label: 'All',        emoji: '📋' },
    { id: 'PENDING',    label: 'Pending',    emoji: '🕐' },
    { id: 'PACKED',     label: 'Packed',     emoji: '📦' },
    { id: 'DISPATCHED', label: 'Dispatched', emoji: '🚚' },
    { id: 'FULFILLED',  label: 'Delivered',  emoji: '✅' },
    { id: 'CANCELLED',  label: 'Cancelled',  emoji: '❌' },
  ];

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  // Summary stats
  const stats = {
    total:      orders.length,
    pending:    orders.filter(o => o.status === 'PENDING').length,
    inTransit:  orders.filter(o => o.status === 'DISPATCHED' || o.status === 'PACKED').length,
    delivered:  orders.filter(o => o.status === 'FULFILLED').length,
    revenue:    orders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + (o.total_value || 0), 0),
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <View style={styles.agentBadge}>
          <View style={styles.agentDot} />
          <Text style={styles.agentBadgeText}>DELIVERY INTELLIGENCE · LIVE</Text>
        </View>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Delivery Hub</Text>
            <Text style={styles.headerSub}>Track, dispatch, and manage all orders</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders} disabled={isLoading}>
            {isLoading ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <RefreshCw size={18} color={Theme.colors.primary} />}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* KPI Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll} contentContainerStyle={styles.kpiContent}>
        {[
          { label: 'Total Orders', value: stats.total, color: Theme.colors.primary },
          { label: 'Pending', value: stats.pending, color: '#FFB800' },
          { label: 'In Transit', value: stats.inTransit, color: '#9B59B6' },
          { label: 'Delivered', value: stats.delivered, color: Theme.colors.primary },
          { label: 'Revenue', value: `Rs ${stats.revenue >= 1000 ? (stats.revenue / 1000).toFixed(1) + 'K' : stats.revenue.toFixed(0)}`, color: Theme.colors.secondary },
        ].map(kpi => (
          <View key={kpi.label} style={styles.kpiCard}>
            <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
            <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.filterPill, filter === opt.id && styles.filterPillActive]}
            onPress={() => setFilter(opt.id)}
          >
            <Text style={styles.filterEmoji}>{opt.emoji}</Text>
            <Text style={[styles.filterText, filter === opt.id && styles.filterTextActive]}>{opt.label}</Text>
            {filter !== 'ALL' && opt.id !== 'ALL' && (
              <Text style={[styles.filterCount, filter === opt.id && { color: Theme.colors.primary }]}>
                {orders.filter(o => o.status === opt.id).length}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.ordersList} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.emptyText}>Loading orders...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Navigation size={48} color={Theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No {filter !== 'ALL' ? filter.toLowerCase() : ''} orders</Text>
            <Text style={styles.emptyText}>Orders you create will appear here. Track their journey from pending to delivered.</Text>
          </View>
        ) : (
          filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onDispatch={o => setDispatchTarget(o)}
              onRefresh={fetchOrders}
            />
          ))
        )}
      </ScrollView>

      {/* Dispatch Modal */}
      {dispatchTarget && (
        <DispatchModal
          order={dispatchTarget}
          visible={!!dispatchTarget}
          onClose={() => setDispatchTarget(null)}
          onDispatched={() => { fetchOrders(); setDispatchTarget(null); }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: { paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.sm },
  agentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.primary },
  agentBadgeText: { color: Theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  kpiScroll: { flexGrow: 0 },
  kpiContent: { paddingHorizontal: Theme.spacing.md, gap: 8, paddingBottom: 12 },
  kpiCard: { minWidth: 100, borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: 12, overflow: 'hidden' },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  kpiLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: Theme.spacing.md, gap: 6, paddingBottom: 10 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border },
  filterPillActive: { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: Theme.colors.primary },
  filterEmoji: { fontSize: 11 },
  filterText: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: Theme.colors.primary },
  filterCount: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700' },

  ordersList: { paddingHorizontal: Theme.spacing.md, paddingBottom: 100, gap: 10 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: Theme.colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  orderCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, padding: Theme.spacing.md, overflow: 'hidden' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  statusEmoji: { fontSize: 11 },
  statusLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  orderRef: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  customerName: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 1 },
  orderValue: { color: Theme.colors.primary, fontSize: 14, fontWeight: '900', marginRight: 8 },

  quickInfoRow: { flexDirection: 'row', gap: 12, marginBottom: Theme.spacing.md },
  qInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qInfoText: { color: Theme.colors.textMuted, fontSize: 10 },

  pipeline: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.spacing.sm },
  pipeStep: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pipeStepText: { fontSize: 12 },
  pipeStepLabel: { fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.3 },
  pipeConnector: { width: 8, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0 },

  expandedSection: { marginTop: Theme.spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: Theme.spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  detailLabel: { color: Theme.colors.textMuted, fontSize: 11 },
  detailValue: { color: Theme.colors.text, fontSize: 11, fontWeight: '600' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Theme.spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Theme.borderRadius.sm, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontWeight: '800' },

  // Dispatch Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', flex: 1 },
  modalSubtitle: { color: Theme.colors.textMuted, fontSize: 13, marginBottom: 20 },
  inputLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.borderRadius.md, color: '#FFF', fontSize: 15, paddingHorizontal: 14, height: 48, marginBottom: 16 },
  dispatchBtn: { height: 50, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', marginTop: 4 },
  dispatchBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
});
