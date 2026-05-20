import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Trash2, CheckCircle, XCircle, Clock, ChevronDown } from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  orders: any[];
  inventory: any[];
  warehouses: any[];
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  PENDING:   { color: '#FFB800', bg: 'rgba(255,184,0,0.12)',  icon: Clock,        label: 'Pending' },
  FULFILLED: { color: '#00E676', bg: 'rgba(0,230,118,0.12)',  icon: CheckCircle,  label: 'Fulfilled' },
  CANCELLED: { color: '#FF2A55', bg: 'rgba(255,42,85,0.12)',  icon: XCircle,      label: 'Cancelled' },
};

export const OrderManager: React.FC<Props> = ({ orders, inventory, warehouses, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state — store the full object so we get both id and name
  const [customerName, setCustomerName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showWarehousePicker, setShowWarehousePicker] = useState(false);

  const handleAddOrder = async () => {
    if (!customerName || !selectedProduct || !quantity || !unitPrice) {
      Alert.alert('Incomplete', 'Please fill in Customer, select a Product, Quantity and Unit Price.');
      return;
    }
    setIsSubmitting(true);
    try {
      const wh = selectedWarehouse || warehouses[0];
      await ApiService.addOrder({
        customer_name: customerName,
        product_id: selectedProduct.id,
        warehouse_id: wh ? wh.id : 1,
        quantity: parseFloat(quantity),
        unit_price: parseFloat(unitPrice),
      });
      setCustomerName('');
      setSelectedProduct(null);
      setSelectedWarehouse(null);
      setQuantity('');
      setUnitPrice('');
      setShowForm(false);
      onRefresh();
      Alert.alert('✅ Order Created', 'Order has been placed successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-fill unit price from product's selling_price
  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    if (product.selling_price) setUnitPrice(String(product.selling_price));
    setShowProductPicker(false);
  };

  const handleStatusChange = async (orderId: any, newStatus: string) => {
    try {
      await ApiService.updateOrderStatus(orderId, newStatus);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = (orderId: any, ref: string) => {
    Alert.alert(
      'Delete Order',
      `Delete order "${ref}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteOrder(orderId);
              onRefresh();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const totalRevenue = orders.reduce((sum, o) => o.status !== 'CANCELLED' ? sum + (o.total_value || 0) : sum, 0);
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <View style={styles.container}>
      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(255,196,0,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.summaryLabel}>TOTAL ORDERS</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.secondary }]}>{orders.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(255,184,0,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.summaryLabel}>PENDING</Text>
          <Text style={[styles.summaryValue, { color: '#FFB800' }]}>{pendingCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(0,230,118,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.summaryLabel}>ORDER VALUE</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.primary }]}>
            {totalRevenue >= 1000 ? `Rs ${(totalRevenue / 1000).toFixed(1)}K` : `Rs ${totalRevenue.toFixed(0)}`}
          </Text>
        </View>
      </View>

      {/* Add Order Toggle */}
      <TouchableOpacity style={styles.addToggleBtn} onPress={() => setShowForm(!showForm)}>
        <LinearGradient
          colors={showForm ? ['rgba(255,42,85,0.15)', 'rgba(255,42,85,0.05)'] : Theme.gradients.primary}
          style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <Plus size={18} color={showForm ? Theme.colors.error : '#000'} />
        <Text style={[styles.addToggleText, { color: showForm ? Theme.colors.error : '#000' }]}>
          {showForm ? 'Cancel Order Form' : 'Create New Order'}
        </Text>
      </TouchableOpacity>

      {/* Create Order Form */}
      {showForm && (
        <View style={styles.formCard}>
          <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.formTitle}>📋 New Order</Text>

          <TextInput
            style={styles.input}
            placeholder="Customer Name *"
            placeholderTextColor={Theme.colors.textMuted}
            value={customerName}
            onChangeText={setCustomerName}
          />

          {/* Product Selector */}
          <Text style={styles.inputLabel}>PRODUCT *</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => { setShowProductPicker(v => !v); setShowWarehousePicker(false); }}>
            <Text style={[styles.selectorText, !selectedProduct && { color: Theme.colors.textMuted }]}>
              {selectedProduct ? `${selectedProduct.name} (ID: ${selectedProduct.id})` : 'Tap to select product…'}
            </Text>
            <ChevronDown size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>
          {showProductPicker && (
            <View style={styles.pickerList}>
              {inventory.length === 0 ? (
                <Text style={styles.pickerEmpty}>No products available. Add stock first.</Text>
              ) : inventory.map((p: any) => (
                <TouchableOpacity key={p.id} style={styles.pickerItem} onPress={() => handleSelectProduct(p)}>
                  <Text style={styles.pickerItemTitle}>{p.name}</Text>
                  <Text style={styles.pickerItemSub}>Stock: {p.stock} {p.unit} · Rs {p.selling_price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Warehouse Selector */}
          <Text style={[styles.inputLabel, { marginTop: 4 }]}>WAREHOUSE</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => { setShowWarehousePicker(v => !v); setShowProductPicker(false); }}>
            <Text style={[styles.selectorText, !selectedWarehouse && { color: Theme.colors.textMuted }]}>
              {selectedWarehouse ? selectedWarehouse.name : (warehouses[0]?.name || 'Tap to select warehouse…')}
            </Text>
            <ChevronDown size={16} color={Theme.colors.textMuted} />
          </TouchableOpacity>
          {showWarehousePicker && (
            <View style={styles.pickerList}>
              {warehouses.map((w: any) => (
                <TouchableOpacity key={w.id} style={styles.pickerItem} onPress={() => { setSelectedWarehouse(w); setShowWarehousePicker(false); }}>
                  <Text style={styles.pickerItemTitle}>{w.name}</Text>
                  <Text style={styles.pickerItemSub}>{w.location}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>QUANTITY *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>UNIT PRICE (Rs) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
                value={unitPrice}
                onChangeText={setUnitPrice}
              />
            </View>
          </View>

          {quantity && unitPrice ? (
            <View style={styles.totalPreview}>
              <Text style={styles.totalLabel}>Order Total:</Text>
              <Text style={styles.totalValue}>
                Rs {(parseFloat(quantity || '0') * parseFloat(unitPrice || '0')).toFixed(2)}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleAddOrder} disabled={isSubmitting}>
            <LinearGradient colors={Theme.gradients.secondary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            {isSubmitting
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={styles.submitText}>Place Order</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Orders List */}
      <Text style={styles.listTitle}>All Orders ({orders.length})</Text>
      {orders.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No orders yet. Create your first order above.</Text>
        </View>
      )}
      {orders.map((order: any) => {
        const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
        const Icon = cfg.icon;
        return (
          <View key={order.id} style={[styles.orderCard, { borderColor: `${cfg.color}40` }]}>
            <LinearGradient colors={[cfg.bg, 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />

            {/* Order Header */}
            <View style={styles.orderHeader}>
              <View style={styles.orderRef}>
                <Text style={styles.orderRefText}>{order.order_ref}</Text>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                  <Icon size={10} color={cfg.color} />
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(order.id, order.order_ref)} style={styles.deleteBtn}>
                <Trash2 size={16} color={Theme.colors.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Order Details */}
            <View style={styles.orderDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>CUSTOMER</Text>
                <Text style={styles.detailValue}>{order.customer_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>PRODUCT</Text>
                <Text style={styles.detailValue}>{order.product_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>QTY</Text>
                <Text style={styles.detailValue}>{order.quantity} {order.unit}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>TOTAL</Text>
                <Text style={[styles.detailValue, { color: Theme.colors.secondary }]}>
                  Rs {(order.total_value || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Status Action Buttons */}
            {order.status === 'PENDING' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.statusBtn, { backgroundColor: 'rgba(0,230,118,0.12)', borderColor: Theme.colors.primary }]}
                  onPress={() => handleStatusChange(order.id, 'FULFILLED')}
                >
                  <CheckCircle size={14} color={Theme.colors.primary} />
                  <Text style={[styles.statusBtnText, { color: Theme.colors.primary }]}>Fulfill</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusBtn, { backgroundColor: 'rgba(255,42,85,0.1)', borderColor: Theme.colors.error }]}
                  onPress={() => handleStatusChange(order.id, 'CANCELLED')}
                >
                  <XCircle size={14} color={Theme.colors.error} />
                  <Text style={[styles.statusBtnText, { color: Theme.colors.error }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.xl },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: Theme.spacing.md },
  summaryCard: { flex: 1, borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.sm, overflow: 'hidden', alignItems: 'center' },
  summaryLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '900' },

  addToggleBtn: { height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  addToggleText: { fontSize: 14, fontWeight: '800' },

  formCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  formTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md },
  inputLabel: { color: Theme.colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  input: { height: 46, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: '#FFF', fontSize: 14, marginBottom: Theme.spacing.sm },
  row: { flexDirection: 'row', gap: 8 },
  halfWrap: { flex: 1 },

  // Dropdown selector styles
  selectorBtn: { height: 46, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Theme.spacing.sm },
  selectorText: { color: '#FFF', fontSize: 14, flex: 1 },
  pickerList: { backgroundColor: 'rgba(26,34,52,0.98)', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, marginBottom: Theme.spacing.sm, maxHeight: 200, overflow: 'hidden' },
  pickerItem: { paddingVertical: 10, paddingHorizontal: Theme.spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  pickerItemTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  pickerItemSub: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 1 },
  pickerEmpty: { color: Theme.colors.textMuted, fontSize: 13, padding: Theme.spacing.md, textAlign: 'center' },

  totalPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.08)', borderRadius: Theme.borderRadius.sm, padding: Theme.spacing.sm, marginBottom: Theme.spacing.sm, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)' },
  totalLabel: { color: Theme.colors.textMuted, fontSize: 13 },
  totalValue: { color: Theme.colors.primary, fontSize: 16, fontWeight: '900' },

  submitBtn: { height: 48, borderRadius: Theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  submitText: { color: '#000', fontSize: 14, fontWeight: '900' },

  listTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md, letterSpacing: -0.3 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center' },

  orderCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderRef: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  orderRefText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800' },
  deleteBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: Theme.spacing.sm },
  orderDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Theme.spacing.sm },
  detailItem: {},
  detailLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  detailValue: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4 },
  statusBtn: { flex: 1, height: 36, borderRadius: Theme.borderRadius.sm, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  statusBtnText: { fontSize: 12, fontWeight: '800' },
  orderDate: { color: Theme.colors.textMuted, fontSize: 10, marginTop: 4 },
});
