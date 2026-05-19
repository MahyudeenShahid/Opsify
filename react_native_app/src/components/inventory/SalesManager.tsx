import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DollarSign, TrendingUp, Plus, ArrowDownLeft } from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  ledger: any[];
  inventory: any[];
  onRefresh: () => void;
}

const fmt = (n: number) => {
  if (n >= 1000000) return `Rs ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `Rs ${(n / 1000).toFixed(1)}K`;
  return `Rs ${n.toFixed(0)}`;
};

export const SalesManager: React.FC<Props> = ({ ledger, inventory, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('1');
  const [quantity, setQuantity] = useState('');
  const [revenue, setRevenue] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'SALE' | 'RESTOCK'>('SALE');

  const salesOnly = ledger.filter(tx => tx.type === 'SALE');
  const totalRevenue = salesOnly.reduce((s, tx) => s + (tx.total_value || 0), 0);
  const totalUnitsSold = salesOnly.reduce((s, tx) => s + (tx.quantity || 0), 0);

  // Group sales by product
  const byProduct: Record<string, { name: string; revenue: number; qty: number; unit: string }> = {};
  salesOnly.forEach(tx => {
    const k = tx.product_name || `Product #${tx.product_id}`;
    if (!byProduct[k]) byProduct[k] = { name: k, revenue: 0, qty: 0, unit: tx.unit || '' };
    byProduct[k].revenue += tx.total_value || 0;
    byProduct[k].qty += tx.quantity || 0;
  });
  const topProducts = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);

  const handleRecordSale = async () => {
    if (!productId || !quantity || !revenue) {
      Alert.alert('Incomplete', 'Fill in Product ID, Quantity and Revenue.');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.recordTransaction('sale', {
        product_id: parseInt(productId),
        warehouse_id: parseInt(warehouseId) || 1,
        quantity: parseFloat(quantity),
        value: parseFloat(revenue),
      });
      setProductId(''); setQuantity(''); setRevenue(''); setWarehouseId('1');
      setShowForm(false);
      onRefresh();
      Alert.alert('✅ Sale Recorded', 'Sale has been logged to the ledger.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLedger = filter === 'ALL' ? ledger : ledger.filter(tx => tx.type === filter);

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(0,230,118,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
          <DollarSign size={18} color={Theme.colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.summaryLabel}>TOTAL REVENUE</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.primary }]}>{fmt(totalRevenue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(255,196,0,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
          <TrendingUp size={18} color={Theme.colors.secondary} style={{ marginBottom: 6 }} />
          <Text style={styles.summaryLabel}>UNITS SOLD</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.secondary }]}>{totalUnitsSold.toFixed(0)}</Text>
        </View>
      </View>

      {/* Top Products by Revenue */}
      {topProducts.length > 0 && (
        <View style={styles.topSection}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          {topProducts.map((p, i) => (
            <View key={p.name} style={styles.topProductRow}>
              <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productMeta}>{p.qty.toFixed(0)} {p.unit} sold</Text>
              </View>
              <Text style={[styles.productRevenue, { color: Theme.colors.primary }]}>{fmt(p.revenue)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Record Sale Button */}
      <TouchableOpacity style={styles.recordSaleBtn} onPress={() => setShowForm(!showForm)}>
        <LinearGradient
          colors={showForm ? ['rgba(255,42,85,0.15)', 'rgba(255,42,85,0.05)'] : Theme.gradients.primary}
          style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <Plus size={18} color={showForm ? Theme.colors.error : '#000'} />
        <Text style={[styles.recordSaleBtnText, { color: showForm ? Theme.colors.error : '#000' }]}>
          {showForm ? 'Cancel' : 'Record Sale'}
        </Text>
      </TouchableOpacity>

      {/* Sale Form */}
      {showForm && (
        <View style={styles.formCard}>
          <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.formTitle}>💰 Record New Sale</Text>

          <View style={styles.row}>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>PRODUCT ID *</Text>
              <TextInput style={styles.input} placeholder="e.g. 1" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={productId} onChangeText={setProductId} />
            </View>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>WAREHOUSE ID</Text>
              <TextInput style={styles.input} placeholder="1" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={warehouseId} onChangeText={setWarehouseId} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>QUANTITY *</Text>
              <TextInput style={styles.input} placeholder="0" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
            </View>
            <View style={styles.halfWrap}>
              <Text style={styles.inputLabel}>REVENUE (Rs) *</Text>
              <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={revenue} onChangeText={setRevenue} />
            </View>
          </View>

          {inventory.length > 0 && (
            <View style={styles.productHints}>
              {inventory.slice(0, 5).map((p: any) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.hintChip, productId === String(p.id) && styles.hintChipActive]}
                  onPress={() => {
                    setProductId(String(p.id));
                    setRevenue(String(p.selling_price || ''));
                  }}
                >
                  <Text style={[styles.hintText, productId === String(p.id) && styles.hintTextActive]}>
                    {p.id}. {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleRecordSale} disabled={isSubmitting}>
            <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.submitText}>✔ Log Sale</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Ledger Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <View style={styles.filterChips}>
          {(['SALE', 'RESTOCK', 'ALL'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transaction List */}
      {filteredLedger.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No {filter === 'ALL' ? '' : filter.toLowerCase()} transactions yet.</Text>
        </View>
      )}
      {filteredLedger.map((tx: any, i: number) => {
        const isSale = tx.type === 'SALE';
        const isRestock = tx.type === 'RESTOCK';
        const color = isSale ? Theme.colors.primary : isRestock ? '#00B0FF' : Theme.colors.warning;
        return (
          <View key={tx.id || i} style={[styles.txCard, { borderColor: `${color}30` }]}>
            <LinearGradient colors={[`${color}08`, 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
            <View style={styles.txLeft}>
              <View style={[styles.txIcon, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
                {isSale ? <DollarSign size={14} color={color} /> : <ArrowDownLeft size={14} color={color} />}
              </View>
              <View>
                <Text style={styles.txProduct}>{tx.product_name || `Product #${tx.product_id}`}</Text>
                <Text style={styles.txMeta}>
                  {tx.type} · {tx.quantity} {tx.unit} · {tx.warehouse_name}
                </Text>
                {tx.reason && <Text style={styles.txReason}>Note: {tx.reason}</Text>}
                <Text style={styles.txDate}>{new Date(tx.timestamp).toLocaleString()}</Text>
              </View>
            </View>
            <Text style={[styles.txValue, { color }]}>
              {isSale ? '+' : '-'} Rs {(tx.total_value || 0).toFixed(0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.xl },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: Theme.spacing.md },
  summaryCard: { flex: 1, borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, overflow: 'hidden', alignItems: 'center' },
  summaryLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: '900' },

  topSection: { marginBottom: Theme.spacing.lg },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.sm, letterSpacing: -0.3 },
  topProductRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.sm, marginBottom: 6, overflow: 'hidden' },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: Theme.colors.primary, fontSize: 11, fontWeight: '900' },
  productName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  productMeta: { color: Theme.colors.textMuted, fontSize: 11 },
  productRevenue: { fontSize: 16, fontWeight: '900' },

  recordSaleBtn: { height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  recordSaleBtnText: { fontSize: 14, fontWeight: '800' },

  formCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  formTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md },
  inputLabel: { color: Theme.colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  input: { height: 46, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: '#FFF', fontSize: 14, marginBottom: Theme.spacing.sm },
  row: { flexDirection: 'row', gap: 8 },
  halfWrap: { flex: 1 },
  productHints: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Theme.spacing.sm },
  hintChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Theme.colors.border },
  hintChipActive: { backgroundColor: 'rgba(0,230,118,0.12)', borderColor: Theme.colors.primary },
  hintText: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  hintTextActive: { color: Theme.colors.primary },
  submitBtn: { height: 48, borderRadius: Theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  submitText: { color: '#000', fontSize: 14, fontWeight: '900' },

  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  filterChips: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border },
  filterChipActive: { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: Theme.colors.primary },
  filterChipText: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: Theme.colors.primary, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center' },

  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderRadius: Theme.borderRadius.md, borderWidth: 1, padding: Theme.spacing.md, marginBottom: 8, overflow: 'hidden' },
  txLeft: { flex: 1, flexDirection: 'row', gap: 10 },
  txIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txProduct: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  txMeta: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  txReason: { color: Theme.colors.warning, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  txDate: { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 },
  txValue: { fontSize: 15, fontWeight: '900' },
});
